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
import { TituloImpuesto } from '../domain/titulo-impuesto.entity';
import { TituloImpuestoRepository } from '../repo/titulo-impuesto.repository';
import { GastoImpuestoRepository } from '../repo/gasto-impuesto.repository';
import { tituloImpuestoJson } from '../common/serialize';
import { ApiException } from './api-exception';

export class TituloImpuestoRequest {
  @IsNotEmpty({ message: 'El nombre del tipo de impuesto es obligatorio' })
  @IsString()
  @MaxLength(100)
  nombre: string;
}

@Controller('api/titulos-impuesto')
export class TituloImpuestoController {
  constructor(
    private readonly repo: TituloImpuestoRepository,
    private readonly gastos: GastoImpuestoRepository,
  ) {}

  @Get()
  listar() {
    return this.repo
      .findAllByOrderByNombreAsc()
      .then((lista) => lista.map(tituloImpuestoJson));
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  crear(@Body() req: TituloImpuestoRequest) {
    const nombre = req.nombre.trim();
    return this.validarDuplicado(nombre).then(() => {
      const titulo = new TituloImpuesto();
      titulo.nombre = nombre;
      return this.repo.save(titulo).then(tituloImpuestoJson);
    });
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: TituloImpuestoRequest) {
    return this.repo.findById(id).then((titulo) => {
      if (!titulo) throw new ApiException(404, 'Tipo de impuesto no encontrado');
      const nombre = req.nombre.trim();
      return this.validarDuplicado(
        nombre,
        nombre.toLowerCase() === titulo.nombre.toLowerCase(),
      ).then(() => {
        titulo.nombre = nombre;
        return this.repo.save(titulo).then(tituloImpuestoJson);
      });
    });
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.existsById(id))) {
      throw new ApiException(404, 'Tipo de impuesto no encontrado');
    }
    if (await this.gastos.existsByTituloImpuestoId(id)) {
      throw new ApiException(409, 'El tipo de impuesto está en uso por gastos registrados');
    }
    await this.repo.deleteById(id);
  }

  private validarDuplicado(nombre: string, esLaMisma = false) {
    return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
      if (existe && !esLaMisma) {
        throw new ApiException(409, 'Ya existe el tipo de impuesto ' + nombre);
      }
    });
  }
}
