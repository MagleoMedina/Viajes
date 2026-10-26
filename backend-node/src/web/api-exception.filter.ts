import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiException, ApiValidationException } from './api-exception';

const INTEGRIDAD =
  'Registro en uso: otro registro lo referencia o ya existe un valor duplicado.';

const logger = new Logger('ApiExceptionFilter');

/** Extrae el detalle del fallo de SQLite para poder responder algo util. */
function detalleSql(error: QueryFailedError): string {
  return (error.driverError as Error | undefined)?.message ?? error.message;
}

/**
 * Traduce un QueryFailedError de SQLite a una respuesta HTTP.
 *
 * El texto generico de "registro en uso" solo vale para claves ajenas: los
 * errores de esquema (columna inexistente) u otros problemas de SQL se
 * responden como 500 con el mensaje real, no como un 409 confuso.
 */
function responder(res: Response, error: QueryFailedError): Response {
  const detalle = detalleSql(error);

  if (/UNIQUE constraint failed:\s*ingresos\.factura_num/i.test(detalle)) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      status: 400,
      message: 'Ya existe una factura con ese número',
      fields: { facturaNum: 'Ya existe una factura con ese número' },
    });
  }

  if (/UNIQUE constraint failed:\s*([^\s]+)/i.test(detalle)) {
    const [, tabla, columna] = /UNIQUE constraint failed:\s*([^\s]+?)\.([^\s]+)/i.exec(detalle) ?? [];
    return res.status(HttpStatus.CONFLICT).json({
      status: 409,
      message: `Valor duplicado en ${tabla}.${columna}`,
      fields: { [columna]: 'Ya existe un registro con ese valor' },
    });
  }

  if (/FOREIGN KEY constraint failed/i.test(detalle)) {
    return res.status(HttpStatus.CONFLICT).json({
      status: 409,
      message: INTEGRIDAD,
    });
  }

  logger.error(`Fallo de base de datos: ${detalle}`);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    status: 500,
    message: `Error de base de datos: ${detalle}`,
  });
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiValidationException) {
      const message = Object.values(exception.fields)[0] ?? 'Datos invalidos';
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ status: 400, message, fields: exception.fields });
    }

    if (exception instanceof ApiException) {
      const status = exception.getStatus();
      return res.status(status).json({ status, message: exception.message });
    }

    if (exception instanceof QueryFailedError) {
      return responder(res, exception);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const raw =
        typeof response === 'string'
          ? response
          : ((response as any).message ?? exception.message);
      const message = Array.isArray(raw) ? raw[0] : raw;
      return res.status(status).json({ status, message });
    }

    const message =
      exception instanceof Error ? exception.message : 'Error interno';
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ status: 500, message });
  }
}
