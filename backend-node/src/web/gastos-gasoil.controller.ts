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
import { Vehiculo } from '../domain/vehiculo.entity';
import { GastoGasoilRepository } from '../repo/gasto-gasoil.repository';
import { VehiculoRepository } from '../repo/vehiculo.repository';
import { StockGasoilService } from '../service/stock-gasoil.service';
import { gastoGasoilJson } from '../common/serialize';
import { dateOnlyToMillis, round2 } from '../common/dates';
import { ApiException, ApiValidationException } from './api-exception';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class GastoGasoilRequest {
  /** Opcional: sin vehículo el gasto igual se registra. */
  @IsOptional()
  @IsInt({ message: 'El vehículo debe ser un id válido' })
  vehiculoId?: number | null;

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
   * Stock GLOBAL de gasoil (todos los vehículos): comprado menos usado.
   * `excluirViajeId` sirve al editar un viaje para ignorar sus litros actuales.
   */
  @Get('stock')
  stock(@Query('excluirViajeId') excluirViajeId?: string) {
    const excluido = excluirViajeId ? Number(excluirViajeId) : null;
    return this.stockGasoil.global(excluido);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async crear(@Body() req: GastoGasoilRequest) {
    this.validarFecha(req.fecha);
    const vehiculo = await this.buscarVehiculo(req.vehiculoId);

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

    const litrosAntes = gasto.litros ?? 0;
    // null explícito quita el vehículo; si no viene, se conserva.
    if (req.vehiculoId === null) {
      gasto.vehiculo = null;
    } else if (req.vehiculoId != null) {
      gasto.vehiculo = await this.buscarVehiculo(req.vehiculoId);
    }
    gasto.fecha = new Date(dateOnlyToMillis(req.fecha));
    this.aplicar(gasto, req, false);
    await this.validarStockEdicion(gasto.litros ?? 0, litrosAntes);
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

  /** Vehículo opcional: sin id devuelve null; con id inexistente, 404. */
  private async buscarVehiculo(id?: number | null): Promise<Vehiculo | null> {
    if (id == null) return null;
    const vehiculo = await this.vehiculos.findById(id);
    if (!vehiculo) throw new ApiException(404, 'Vehículo no encontrado');
    return vehiculo;
  }

  /**
   * La edición no puede dejar el stock GLOBAL en negativo: el nuevo stock
   * = disponible actual − litros previos + litros nuevos.
   */
  private async validarStockEdicion(litrosNuevos: number, litrosAntes: number) {
    const stock = await this.stockGasoil.global(null);
    const stockTras = round2(stock.disponible - litrosAntes + litrosNuevos);
    if (stockTras < 0) {
      throw new ApiValidationException({
        litros: 'La edición dejaría el stock de gasoil en negativo',
      });
    }
  }
}
