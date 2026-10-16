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
import { IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { GastoGasoil } from '../domain/gasto-gasoil.entity';
import { GastoGasoilRepository } from '../repo/gasto-gasoil.repository';
import { VehiculoRepository } from '../repo/vehiculo.repository';
import { StockGasoilService } from '../service/stock-gasoil.service';
import { gastoGasoilJson } from '../common/serialize';
import { dateOnlyToMillis, round2 } from '../common/dates';
import { ApiException, ApiValidationException } from './api-exception';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class GastoGasoilRequest {
  /** En POST es obligatorio; en PUT solo cambia si viene. */
  @IsOptional()
  @IsInt({ message: 'El vehículo es obligatorio' })
  vehiculoId?: number;

  @IsString({ message: 'La fecha es obligatoria' })
  fecha: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  estacion?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Los litros deben ser numéricos' })
  litros?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El precio por litro debe ser numérico' })
  precioLitro?: number;

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
  @IsString()
  @MaxLength(100)
  referencia?: string;
}

@Controller('api/gastos-gasoil')
export class GastoGasoilController {
  constructor(
    private readonly repo: GastoGasoilRepository,
    private readonly vehiculos: VehiculoRepository,
    private readonly stockGasoil: StockGasoilService,
  ) {}

  @Get()
  buscar(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('vehiculoId') vehiculoId?: string,
  ) {
    const id = vehiculoId ? Number(vehiculoId) : null;
    return this.repo.buscar(id, desde, hasta).then((lista) => lista.map(gastoGasoilJson));
  }

  /**
   * Stock por vehículo: comprado (gastos) menos usado (viajes).
   * Sin vehiculoId responde la lista de todos los vehículos (con placa).
   */
  @Get('stock')
  async stock(
    @Query('vehiculoId') vehiculoId?: string,
    @Query('excluirViajeId') excluirViajeId?: string,
  ) {
    if (!vehiculoId) {
      const vehiculos = await this.vehiculos.findAll();
      return Promise.all(
        vehiculos.map(async (v) => ({
          placa: v.placa,
          ...(await this.stockGasoil.disponible(v.id, null)),
        })),
      );
    }
    const id = Number(vehiculoId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ApiValidationException({ vehiculoId: 'El vehículo es obligatorio' });
    }
    const excluido = excluirViajeId ? Number(excluirViajeId) : null;
    return this.stockGasoil.disponible(id, excluido);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async crear(@Body() req: GastoGasoilRequest) {
    if (req.vehiculoId == null) {
      throw new ApiValidationException({ vehiculoId: 'El vehículo es obligatorio' });
    }
    this.validarFecha(req.fecha);
    const vehiculo = await this.vehiculos.findById(req.vehiculoId);
    if (!vehiculo) throw new ApiException(404, 'Vehículo no encontrado');

    const gasto = new GastoGasoil();
    gasto.vehiculo = vehiculo;
    gasto.fecha = new Date(dateOnlyToMillis(req.fecha));
    this.aplicar(gasto, req, true);
    return this.repo.save(gasto).then(gastoGasoilJson);
  }

  @Put(':id')
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: GastoGasoilRequest) {
    const gasto = await this.repo.findById(id);
    if (!gasto) throw new ApiException(404, 'Gasto de gasoil no encontrado');
    this.validarFecha(req.fecha);

    const vehiculoAntes = gasto.vehiculo?.id ?? null;
    const litrosAntes = gasto.litros ?? 0;
    if (req.vehiculoId != null) {
      const vehiculo = await this.vehiculos.findById(req.vehiculoId);
      if (!vehiculo) throw new ApiException(404, 'Vehículo no encontrado');
      gasto.vehiculo = vehiculo;
    }
    gasto.fecha = new Date(dateOnlyToMillis(req.fecha));
    this.aplicar(gasto, req, false);
    await this.validarStockEdicion(gasto, vehiculoAntes, litrosAntes);
    return this.repo.save(gasto).then(gastoGasoilJson);
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.findById(id))) {
      throw new ApiException(404, 'Gasto de gasoil no encontrado');
    }
    await this.repo.deleteById(id);
  }

  /**
   * Aplica los campos presentes. Reglas de montos:
   * - montoUsd: si no viene y hay litros × precio, se calcula.
   * - montoBs: si no viene, = montoUsd × tasa.
   */
  private aplicar(gasto: GastoGasoil, req: GastoGasoilRequest, esAlta: boolean) {
    if (req.estacion !== undefined) gasto.estacion = req.estacion.trim();
    if (req.referencia !== undefined) gasto.referencia = req.referencia.trim() || '0';
    if (req.tasa !== undefined) gasto.tasa = Number(req.tasa) || 0;
    if (req.litros !== undefined) gasto.litros = Number(req.litros) || 0;
    if (req.precioLitro !== undefined) gasto.precioLitro = Number(req.precioLitro) || 0;

    if (req.montoUsd != null && Number.isFinite(Number(req.montoUsd))) {
      gasto.montoUsd = Number(req.montoUsd);
    } else if (
      req.litros !== undefined ||
      req.precioLitro !== undefined ||
      (esAlta && (gasto.litros ?? 0) > 0)
    ) {
      gasto.montoUsd = round2((gasto.litros ?? 0) * (gasto.precioLitro ?? 0));
    }

    if (req.montoBs != null && Number.isFinite(Number(req.montoBs))) {
      gasto.montoBs = round2(Number(req.montoBs));
    } else if (esAlta || req.montoUsd !== undefined || req.tasa !== undefined) {
      gasto.montoBs = round2((gasto.montoUsd ?? 0) * (gasto.tasa ?? 0));
    }
  }

  private validarFecha(fecha: string) {
    if (!fecha || !FECHA_ISO.test(fecha)) {
      throw new ApiValidationException({ fecha: 'Formato de fecha inválido (AAAA-MM-DD)' });
    }
  }

  /**
   * La edición no puede dejar el stock del vehículo en negativo: el nuevo
   * stock = disponible actual − litros previos + litros nuevos.
   */
  private async validarStockEdicion(
    gasto: GastoGasoil,
    vehiculoAntes: number | null,
    litrosAntes: number,
  ) {
    const vehiculoId = gasto.vehiculo?.id;
    if (vehiculoId == null) return;
    const stock = await this.stockGasoil.disponible(vehiculoId, null);
    const mismoVehiculo = vehiculoAntes === vehiculoId;
    const stockTras = round2(
      stock.disponible - (mismoVehiculo ? litrosAntes : 0) + (gasto.litros ?? 0),
    );
    if (stockTras < 0) {
      throw new ApiValidationException({
        litros: 'La edición dejaría el stock de gasoil en negativo',
      });
    }
  }
}
