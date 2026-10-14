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
import { Chofer } from '../domain/chofer.entity';
import { ChoferRepository } from '../repo/chofer.repository';
import { ViajeRepository } from '../repo/viaje.repository';
import { choferJson } from '../common/serialize';
import { ApiException } from './api-exception';

export class ChoferRequest {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  apellido: string;

  @IsNotEmpty({ message: 'La cedula es obligatoria' })
  cedula: string;
}

@Controller('api/choferes')
export class ChoferController {
  constructor(
    private readonly repo: ChoferRepository,
    private readonly viajes: ViajeRepository,
  ) {}

  @Get()
  listar() {
    return this.repo.findAll().then((lista) => lista.map(choferJson));
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  crear(@Body() req: ChoferRequest) {
    const cedula = req.cedula.trim();
    return this.validarDuplicado(cedula).then(() => {
      const chofer = new Chofer();
      this.aplicar(chofer, req, cedula);
      return this.repo.save(chofer).then(choferJson);
    });
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: ChoferRequest) {
    return this.repo.findById(id).then((chofer) => {
      if (!chofer) throw new ApiException(404, 'Chofer no encontrado');
      const cedula = req.cedula.trim();
      return this.validarDuplicado(cedula, cedula === chofer.cedula).then(() => {
        this.aplicar(chofer, req, cedula);
        return this.repo.save(chofer).then(choferJson);
      });
    });
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.existsById(id))) {
      throw new ApiException(404, 'Chofer no encontrado');
    }
    if (await this.viajes.existsByChoferId(id)) {
      // Esta en uso: se oculta del frontend y se conserva para los viajes historicos.
      await this.repo.ocultar(id);
      return;
    }
    await this.repo.deleteById(id);
  }

  private validarDuplicado(cedula: string, esElMismo = false) {
    return this.repo.existsByCedula(cedula).then((existe) => {
      if (existe && !esElMismo) {
        throw new ApiException(409, 'Ya existe un chofer con cedula ' + cedula);
      }
    });
  }

  private aplicar(chofer: Chofer, req: ChoferRequest, cedula: string) {
    chofer.nombre = req.nombre.trim();
    chofer.apellido = req.apellido.trim();
    chofer.cedula = cedula;
  }
}