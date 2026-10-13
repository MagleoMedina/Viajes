import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { EstadoSync, TursoSyncService } from '../service/turso-sync.service';

@Controller('api/sync')
export class SyncController {
  constructor(private readonly servicio: TursoSyncService) {}

  /** Ultima sincronizacion con Turso (fecha + exito) para el sidebar. */
  @Get()
  estado(): EstadoSync {
    return this.servicio.estado();
  }

  /** Respaldo a demanda; el sidebar muestra el resultado al terminar. */
  @HttpCode(HttpStatus.OK)
  @Post()
  sincronizar(): Promise<EstadoSync> {
    return this.servicio.sincronizarManual();
  }
}
