import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsNotEmpty } from 'class-validator';
import { Recorrido } from '../domain/recorrido.entity';
import { RecorridoRepository } from '../repo/recorrido.repository';
import { recorridoJson } from '../common/serialize';
import { ApiException } from './api-exception';

export class RecorridoRequest {
  @IsNotEmpty({ message: 'El recorrido es obligatorio' })
  nombre: string;
}

@Controller('api/recorridos')
export class RecorridoController {
  constructor(private readonly repo: RecorridoRepository) {}

  @Get()
  listar() {
    return this.repo.findAllByOrderByNombreAsc().then((lista) => lista.map(recorridoJson));
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  crear(@Body() req: RecorridoRequest) {
    const nombre = req.nombre.trim();
    return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
      if (existe) throw new ApiException(409, 'Ya existe el recorrido ' + nombre);
      const recorrido = new Recorrido();
      recorrido.nombre = nombre;
      return this.repo.save(recorrido).then(recorridoJson);
    });
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.existsById(id))) {
      throw new ApiException(404, 'Recorrido no encontrado');
    }
    await this.repo.deleteById(id);
  }
}