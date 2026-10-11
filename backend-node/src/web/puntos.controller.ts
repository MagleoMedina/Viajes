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
import { Punto } from '../domain/punto.entity';
import { PuntoRepository } from '../repo/punto.repository';
import { ViajeRepository } from '../repo/viaje.repository';
import { puntoJson } from '../common/serialize';
import { ApiException } from './api-exception';

export class PuntoRequest {
  @IsNotEmpty({ message: 'El nombre del punto es obligatorio' })
  nombre: string;
}

@Controller('api/puntos')
export class PuntoController {
  constructor(
    private readonly repo: PuntoRepository,
    private readonly viajes: ViajeRepository,
  ) {}

  @Get()
  listar() {
    return this.repo.findAllByOrderByNombreAsc().then((lista) => lista.map(puntoJson));
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  crear(@Body() req: PuntoRequest) {
    const nombre = req.nombre.trim();
    return this.validarDuplicado(nombre).then(() => {
      const punto = new Punto();
      punto.nombre = nombre;
      return this.repo.save(punto).then(puntoJson);
    });
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: PuntoRequest) {
    return this.repo.findById(id).then((punto) => {
      if (!punto) throw new ApiException(404, 'Punto no encontrado');
      const nombre = req.nombre.trim();
      return this.validarDuplicado(nombre, nombre.toLowerCase() === punto.nombre?.toLowerCase()).then(
        () => {
          punto.nombre = nombre;
          return this.repo.save(punto).then(puntoJson);
        },
      );
    });
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.existsById(id))) {
      throw new ApiException(404, 'Punto no encontrado');
    }
    if (
      (await this.viajes.existsByPuntoSalidaId(id)) ||
      (await this.viajes.existsByPuntoLlegadaId(id))
    ) {
      throw new ApiException(
        409,
        'No se puede eliminar: el punto se usa en viajes registrados',
      );
    }
    await this.repo.deleteById(id);
  }

  private validarDuplicado(nombre: string, esElMismo = false) {
    return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
      if (existe && !esElMismo) {
        throw new ApiException(409, 'Ya existe el punto ' + nombre);
      }
    });
  }
}