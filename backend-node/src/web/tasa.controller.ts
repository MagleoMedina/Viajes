import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { IsNotEmpty } from 'class-validator';
import { Tasa } from '../domain/tasa.entity';
import { TasaRepository } from '../repo/tasa.repository';
import { TasaService } from '../service/tasa.service';
import { tasaJson } from '../common/serialize';
import { toIsoDateTime } from '../common/dates';
import { ApiException, ApiValidationException } from './api-exception';

export class TasaRequest {
  @IsNotEmpty({ message: 'La tasa es obligatoria' })
  valor?: number;
}

@Controller('api/tasa')
export class TasaController {
  constructor(
    private readonly repo: TasaRepository,
    private readonly servicio: TasaService,
  ) {}

  /** Devuelve la tasa vigente o un cuerpo vacio si nunca se registro una. */
  @Get()
  async actual() {
    const tasa = await this.repo.findTopByOrderByIdDesc();
    if (!tasa) return {};
    return {
      valor: Number(tasa.valor),
      fecha: toIsoDateTime(tasa.fecha),
      origen: tasa.origen ?? undefined,
    };
  }

  /** Edicion manual del usuario; queda marcada como "Manual". */
  @Put()
  actualizar(@Body() req: TasaRequest) {
    if (req.valor == null) {
      throw new ApiException(400, 'La tasa es obligatoria');
    }
    if (req.valor <= 0) {
      throw new ApiValidationException({ valor: 'La tasa debe ser mayor que 0' });
    }
    const tasa = new Tasa();
    tasa.valor = req.valor;
    tasa.fecha = new Date();
    tasa.origen = 'Manual';
    return this.repo.save(tasa).then(tasaJson);
  }

  /** Refresco a demanda desde GoCambio; el frontend muestra el modal de exito. */
  @HttpCode(HttpStatus.OK)
  @Post('refrescar')
  refrescar() {
    return this.servicio.refrescar().then(tasaJson);
  }
}