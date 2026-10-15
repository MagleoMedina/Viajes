import { Controller, Get } from '@nestjs/common';
import { infoServidor } from '../common/sistema';

/** Direccion IP + puerto del servidor, para mostrarla en el sidebar. */
@Controller('api/sistema')
export class SistemaController {
  @Get()
  info() {
    return infoServidor();
  }
}
