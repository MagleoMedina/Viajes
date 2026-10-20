import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  RelacionReportesService,
  TIPOS_RELACION,
  TipoRelacion,
} from '../service/relacion-reportes.service';
import { ApiException } from './api-exception';

/** Reportes de relación: JSON para previsualizar y validar el rango. */
@Controller('api/relacion')
export class RelacionController {
  constructor(private readonly servicio: RelacionReportesService) {}

  @Get(':tipo')
  async resumen(
    @Param('tipo') tipo: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    this.servicio.validarRango(desde, hasta);
    return this.servicio.resumenPorTipo(this.tipoValido(tipo), desde!, hasta!);
  }

  private tipoValido(tipo: string): TipoRelacion {
    if (!TIPOS_RELACION.includes(tipo as TipoRelacion)) {
      throw new ApiException(404, `Reporte desconocido: ${tipo}`);
    }
    return tipo as TipoRelacion;
  }
}
