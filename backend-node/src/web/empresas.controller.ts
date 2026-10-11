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
import { Empresa } from '../domain/empresa.entity';
import { EmpresaRepository } from '../repo/empresa.repository';
import { ViajeRepository } from '../repo/viaje.repository';
import { empresaJson } from '../common/serialize';
import { ApiException } from './api-exception';

export class EmpresaRequest {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;
}

@Controller('api/empresas')
export class EmpresaController {
  constructor(
    private readonly repo: EmpresaRepository,
    private readonly viajes: ViajeRepository,
  ) {}

  @Get()
  listar() {
    return this.repo.findAllByOrderByNombreAsc().then((lista) => lista.map(empresaJson));
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  crear(@Body() req: EmpresaRequest) {
    const nombre = req.nombre.trim();
    return this.validarDuplicado(nombre).then(() => {
      const empresa = new Empresa();
      empresa.nombre = nombre;
      return this.repo.save(empresa).then(empresaJson);
    });
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: EmpresaRequest) {
    return this.repo.findById(id).then((empresa) => {
      if (!empresa) throw new ApiException(404, 'Empresa no encontrada');
      const nombre = req.nombre.trim();
      return this.validarDuplicado(nombre, nombre.toLowerCase() === empresa.nombre?.toLowerCase()).then(
        () => {
          empresa.nombre = nombre;
          return this.repo.save(empresa).then(empresaJson);
        },
      );
    });
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.existsById(id))) {
      throw new ApiException(404, 'Empresa no encontrada');
    }
    if (await this.viajes.existsByEmpresaId(id)) {
      throw new ApiException(
        409,
        'No se puede eliminar: la empresa se usa en viajes registrados',
      );
    }
    await this.repo.deleteById(id);
  }

  private validarDuplicado(nombre: string, esLaMisma = false) {
    return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
      if (existe && !esLaMisma) {
        throw new ApiException(409, 'Ya existe la empresa ' + nombre);
      }
    });
  }
}