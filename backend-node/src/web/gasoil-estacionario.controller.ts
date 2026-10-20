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
import { GasoilEstacionario } from '../domain/gasoil-estacionario.entity';
import { Vehiculo } from '../domain/vehiculo.entity';
import { GasoilEstacionarioRepository } from '../repo/gasoil-estacionario.repository';
import { VehiculoRepository } from '../repo/vehiculo.repository';
import { StockGasoilService } from '../service/stock-gasoil.service';
import { gasoilEstacionarioJson } from '../common/serialize';
import { dateOnlyToMillis, round2 } from '../common/dates';
import { ApiException, ApiValidationException } from './api-exception';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class GasoilEstacionarioRequest {
  @IsInt({ message: 'El vehículo es obligatorio' })
  vehiculoId: number;

  @IsString({ message: 'La fecha es obligatoria' })
  fecha: string;

  @IsNumber({}, { message: 'Los litros deben ser numéricos' })
  litros: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}

/**
 * Consumo de gasoil de vehículos estacionarios: descuenta del stock GLOBAL
 * de gasoil (no del resumen por vehículo).
 */
@Controller('api/gasoil-estacionario')
export class GasoilEstacionarioController {
  constructor(
    private readonly repo: GasoilEstacionarioRepository,
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
    return this.repo
      .buscar(id, desde, hasta)
      .then((lista) => lista.map(gasoilEstacionarioJson));
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async crear(@Body() req: GasoilEstacionarioRequest) {
    this.validarFecha(req.fecha);
    const litros = this.validarLitros(req.litros);
    const vehiculo = await this.buscarVehiculo(req.vehiculoId);

    const stock = await this.stockGasoil.global();
    if (litros > stock.disponible) {
      throw new ApiException(
        400,
        `Los litros exceden el gasoil disponible (disponible: ${Math.max(
          0,
          stock.disponible,
        )} L)`,
      );
    }

    const consumo = new GasoilEstacionario();
    consumo.vehiculo = vehiculo;
    consumo.fecha = new Date(dateOnlyToMillis(req.fecha));
    consumo.litros = litros;
    consumo.referencia = (req.referencia ?? '').trim() || '0';
    consumo.motivo = (req.motivo ?? '').trim();
    return this.repo.save(consumo).then(gasoilEstacionarioJson);
  }

  @Put(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() req: GasoilEstacionarioRequest,
  ) {
    const consumo = await this.repo.findById(id);
    if (!consumo) throw new ApiException(404, 'Consumo estacionario no encontrado');
    this.validarFecha(req.fecha);
    const litros = this.validarLitros(req.litros);
    const vehiculo = await this.buscarVehiculo(req.vehiculoId);

    // El stock actual ya descuenta los litros de este registro, así que al
    // editar se devuelven antes de comparar.
    const litrosAntes = Number(consumo.litros) || 0;
    const stock = await this.stockGasoil.global();
    const disponible = round2(stock.disponible + litrosAntes);
    if (litros > disponible) {
      throw new ApiException(
        400,
        `Los litros exceden el gasoil disponible (disponible: ${Math.max(
          0,
          disponible,
        )} L)`,
      );
    }

    consumo.vehiculo = vehiculo;
    consumo.fecha = new Date(dateOnlyToMillis(req.fecha));
    consumo.litros = litros;
    consumo.referencia = (req.referencia ?? '').trim() || '0';
    consumo.motivo = (req.motivo ?? '').trim();
    return this.repo.save(consumo).then(gasoilEstacionarioJson);
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.findById(id))) {
      throw new ApiException(404, 'Consumo estacionario no encontrado');
    }
    await this.repo.deleteById(id);
  }

  private validarFecha(fecha: string) {
    if (!fecha || !FECHA_ISO.test(fecha)) {
      throw new ApiValidationException({ fecha: 'Formato de fecha inválido (AAAA-MM-DD)' });
    }
  }

  private validarLitros(valor: number): number {
    const litros = round2(Number(valor));
    if (!Number.isFinite(litros) || litros <= 0) {
      throw new ApiValidationException({ litros: 'Los litros deben ser mayores a 0' });
    }
    return litros;
  }

  private async buscarVehiculo(id?: number | null): Promise<Vehiculo> {
    if (id == null || !Number.isFinite(Number(id))) {
      throw new ApiValidationException({ vehiculoId: 'El vehículo es obligatorio' });
    }
    const vehiculo = await this.vehiculos.findById(Number(id));
    if (!vehiculo) throw new ApiException(404, 'Vehículo no encontrado');
    return vehiculo;
  }
}
