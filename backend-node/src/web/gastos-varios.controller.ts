import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { GastoVario } from '../domain/gasto-vario.entity';
import { TituloGasto } from '../domain/titulo-gasto.entity';
import { GastoVarioRepository } from '../repo/gasto-vario.repository';
import { TituloGastoRepository } from '../repo/titulo-gasto.repository';
import { gastoVarioJson } from '../common/serialize';
import { dateOnlyToMillis, round2, usdDesdeBs } from '../common/dates';
import { ApiException, ApiValidationException } from './api-exception';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class GastoVarioRequest {
  /** En POST es obligatorio; en PUT solo cambia si viene. */
  @IsOptional()
  @IsInt({ message: 'El título del gasto es obligatorio' })
  tituloGastoId?: number;

  @IsString({ message: 'La fecha es obligatoria' })
  fecha: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El monto en dólares debe ser numérico' })
  montoUsd?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El monto en bolívares debe ser numérico' })
  montoBs?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La tasa debe ser numérica' })
  tasa?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El %DB debe ser numérico' })
  porcentajeDb?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;
}

@Controller('api/gastos-varios')
export class GastoVarioController {
  constructor(
    private readonly repo: GastoVarioRepository,
    private readonly titulos: TituloGastoRepository,
  ) {}

  @Get()
  buscar(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('tituloId') tituloId?: string,
  ) {
    const id = tituloId ? Number(tituloId) : null;
    return this.repo.buscar(id, desde, hasta).then((lista) => lista.map(gastoVarioJson));
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async crear(@Body() req: GastoVarioRequest) {
    if (req.tituloGastoId == null) {
      throw new ApiValidationException({ tituloGastoId: 'El título del gasto es obligatorio' });
    }
    this.validarFecha(req.fecha);
    const titulo = await this.titulos.findById(req.tituloGastoId);
    if (!titulo) throw new ApiException(404, 'Título de gasto no encontrado');

    const gasto = new GastoVario();
    gasto.tituloGasto = titulo;
    this.aplicar(gasto, req, true);
    return this.repo.save(gasto).then(gastoVarioJson);
  }

  @Put(':id')
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: GastoVarioRequest) {
    const gasto = await this.repo.findById(id);
    if (!gasto) throw new ApiException(404, 'Gasto no encontrado');
    this.validarFecha(req.fecha);

    if (req.tituloGastoId != null) {
      const titulo = await this.titulos.findById(req.tituloGastoId);
      if (!titulo) throw new ApiException(404, 'Título de gasto no encontrado');
      gasto.tituloGasto = titulo;
    }
    this.aplicar(gasto, req, false);
    return this.repo.save(gasto).then(gastoVarioJson);
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.findById(id))) {
      throw new ApiException(404, 'Gasto no encontrado');
    }
    await this.repo.deleteById(id);
  }

  /** Aplica los campos presentes. El Monto Bs es la fuente: si viene sin
   *  Monto $, el de $ se deriva con la tasa (Bs ÷ tasa). */
  private aplicar(gasto: GastoVario, req: GastoVarioRequest, esAlta: boolean) {
    if (!esAlta || req.fecha) {
      gasto.fecha = new Date(dateOnlyToMillis(req.fecha));
    }
    if (req.numero !== undefined) gasto.numero = req.numero.trim() || '0';
    if (req.motivo !== undefined) gasto.motivo = req.motivo.trim();
    if (req.referencia !== undefined) gasto.referencia = req.referencia.trim() || '0';
    if (req.tasa !== undefined) gasto.tasa = Number(req.tasa) || 0;
    if (req.montoUsd !== undefined) gasto.montoUsd = Number(req.montoUsd) || 0;

    if (req.montoBs != null && Number.isFinite(Number(req.montoBs))) {
      gasto.montoBs = round2(Number(req.montoBs));
      if (req.montoUsd === undefined) gasto.montoUsd = usdDesdeBs(gasto.montoBs, gasto.tasa);
    } else if (esAlta || req.montoUsd !== undefined || req.tasa !== undefined) {
      gasto.montoBs = round2((gasto.montoUsd ?? 0) * (gasto.tasa ?? 0));
    }

    // %DB = Monto Bs × 0.3, salvo que venga digitado a mano.
    if (req.porcentajeDb != null && Number.isFinite(Number(req.porcentajeDb))) {
      gasto.porcentajeDb = Number(req.porcentajeDb);
    } else {
      gasto.porcentajeDb = round2((gasto.montoBs ?? 0) * 0.3);
    }
  }

  private validarFecha(fecha: string) {
    if (!fecha || !FECHA_ISO.test(fecha)) {
      throw new ApiValidationException({ fecha: 'Formato de fecha inválido (AAAA-MM-DD)' });
    }
  }
}
