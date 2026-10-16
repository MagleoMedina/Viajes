import {
  Body,
  Controller,
  Delete,
  Get,
Param,
  ParseIntPipe,
  Post,
  Put,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsNotEmpty } from 'class-validator';
import { Vehiculo } from '../domain/vehiculo.entity';
import { VehiculoRepository } from '../repo/vehiculo.repository';
import { ViajeRepository } from '../repo/viaje.repository';
import { GastoGasoilRepository } from '../repo/gasto-gasoil.repository';
import { vehiculoJson } from '../common/serialize';
import { ApiException } from './api-exception';

export class VehiculoRequest {
  @IsNotEmpty({ message: 'La marca es obligatoria' })
  marca: string;

  @IsNotEmpty({ message: 'El modelo es obligatorio' })
  modelo: string;

  @IsNotEmpty({ message: 'El tipo es obligatorio' })
  tipo: string;

  @IsNotEmpty({ message: 'La placa es obligatoria' })
  placa: string;
}

@Controller('api/vehiculos')
export class VehiculoController {
  constructor(
    private readonly repo: VehiculoRepository,
    private readonly viajes: ViajeRepository,
    private readonly gasoil: GastoGasoilRepository,
  ) {}

  @Get()
  listar() {
    return this.repo.findAll().then((lista) => lista.map(vehiculoJson));
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  crear(@Body() req: VehiculoRequest) {
    const placa = req.placa.trim().toUpperCase();
    return this.validarDuplicado(placa).then(() => {
      const vehiculo = new Vehiculo();
      this.aplicar(vehiculo, req, placa);
      return this.repo.save(vehiculo).then(vehiculoJson);
    });
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: VehiculoRequest) {
    return this.repo.findById(id).then((vehiculo) => {
      if (!vehiculo) throw new ApiException(404, 'Vehiculo no encontrado');
      const placa = req.placa.trim().toUpperCase();
      return this.validarDuplicado(placa, placa === vehiculo.placa).then(() => {
        this.aplicar(vehiculo, req, placa);
        return this.repo.save(vehiculo).then(vehiculoJson);
      });
    });
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.existsById(id))) {
      throw new ApiException(404, 'Vehiculo no encontrado');
    }
    const enUso =
      (await this.viajes.existsByVehiculoId(id)) || (await this.gasoil.existsByVehiculoId(id));
    if (enUso) {
      // Esta en uso: se oculta del frontend y se conserva para los registros historicos.
      await this.repo.ocultar(id);
      return;
    }
    await this.repo.deleteById(id);
  }

  private validarDuplicado(placa: string, esElMismo = false) {
    return this.repo.existsByPlaca(placa).then((existe) => {
      if (existe && !esElMismo) {
        throw new ApiException(409, 'Ya existe un vehiculo con placa ' + placa);
      }
    });
  }

  private aplicar(vehiculo: Vehiculo, req: VehiculoRequest, placa: string) {
    vehiculo.marca = req.marca.trim();
    vehiculo.modelo = req.modelo.trim();
    vehiculo.tipo = req.tipo.trim();
    vehiculo.placa = placa;
  }
}