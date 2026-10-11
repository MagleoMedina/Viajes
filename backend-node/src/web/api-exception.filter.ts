import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiException, ApiValidationException } from './api-exception';

const INTEGRIDAD =
  'Registro en uso: otro registro lo referencia o ya existe un valor duplicado.';

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
      return res
        .status(HttpStatus.CONFLICT)
        .json({ status: 409, message: INTEGRIDAD });
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
