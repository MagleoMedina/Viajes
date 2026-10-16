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
import { TituloGasto } from '../domain/titulo-gasto.entity';
import { TituloGastoRepository } from '../repo/titulo-gasto.repository';
import { GastoVarioRepository } from '../repo/gasto-vario.repository';
import { tituloGastoJson } from '../common/serialize';
import { ApiException } from './api-exception';

export class TituloGastoRequest {
  @IsNotEmpty({ message: 'El nombre del título es obligatorio' })
  @IsString()
  @MaxLength(100)
  nombre: string;
}

@Controller('api/titulos-gasto')
export class TituloGastoController {
  constructor(
    private readonly repo: TituloGastoRepository,
    private readonly gastos: GastoVarioRepository,
  ) {}

  @Get()
  listar() {
    return this.repo.findAllByOrderByNombreAsc().then((lista) => lista.map(tituloGastoJson));
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  crear(@Body() req: TituloGastoRequest) {
    const nombre = req.nombre.trim();
    return this.validarDuplicado(nombre).then(() => {
      const titulo = new TituloGasto();
      titulo.nombre = nombre;
      return this.repo.save(titulo).then(tituloGastoJson);
    });
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: TituloGastoRequest) {
    return this.repo.findById(id).then((titulo) => {
      if (!titulo) throw new ApiException(404, 'Título de gasto no encontrado');
      const nombre = req.nombre.trim();
      return this.validarDuplicado(nombre, nombre.toLowerCase() === titulo.nombre.toLowerCase()).then(
        () => {
          titulo.nombre = nombre;
          return this.repo.save(titulo).then(tituloGastoJson);
        },
      );
    });
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.existsById(id))) {
      throw new ApiException(404, 'Título de gasto no encontrado');
    }
    if (await this.gastos.existsByTituloGastoId(id)) {
      throw new ApiException(409, 'El título está en uso por gastos registrados');
    }
    await this.repo.deleteById(id);
  }

  private validarDuplicado(nombre: string, esLaMisma = false) {
    return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
      if (existe && !esLaMisma) {
        throw new ApiException(409, 'Ya existe el título ' + nombre);
      }
    });
  }
}
