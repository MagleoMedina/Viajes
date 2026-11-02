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
} from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TituloViaje } from '../domain/titulo-viaje.entity';
import { TituloViajeRepository } from '../repo/titulo-viaje.repository';
import { tituloViajeJson } from '../common/serialize';
import { ApiException } from './api-exception';

export class TituloViajeRequest {
  @IsNotEmpty({ message: 'El nombre del título es obligatorio' })
  @IsString()
  @MaxLength(100)
  nombre: string;
}

@Controller('api/titulos-viaje')
export class TituloViajeController {
  constructor(private readonly repo: TituloViajeRepository) {}

  @Get()
  listar() {
    return this.repo.findAll().then((lista) => lista.map(tituloViajeJson));
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  crear(@Body() req: TituloViajeRequest) {
    const nombre = req.nombre.trim();
    if (!nombre) {
      throw new ApiException(400, 'El nombre del título es obligatorio');
    }
    return this.validarDuplicado(nombre).then(() => {
      const titulo = new TituloViaje();
      titulo.nombre = nombre;
      return this.repo.save(titulo).then(tituloViajeJson);
    });
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: TituloViajeRequest) {
    return this.repo.findById(id).then((titulo) => {
      if (!titulo) throw new ApiException(404, 'Título de viaje no encontrado');
      const nombre = req.nombre.trim();
      if (!nombre) {
        throw new ApiException(400, 'El nombre del título es obligatorio');
      }
      return this.validarDuplicado(nombre, nombre.toLowerCase() === titulo.nombre.toLowerCase()).then(
        () => {
          titulo.nombre = nombre;
          return this.repo.save(titulo).then(tituloViajeJson);
        },
      );
    });
  }

  /** Soft delete: el título se oculta; los viajes históricos lo conservan. */
  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.existsById(id))) {
      throw new ApiException(404, 'Título de viaje no encontrado');
    }
    await this.repo.ocultar(id);
  }

  private validarDuplicado(nombre: string, esLaMisma = false) {
    return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
      if (existe && !esLaMisma) {
        throw new ApiException(409, 'Ya existe el título ' + nombre);
      }
    });
  }
}
