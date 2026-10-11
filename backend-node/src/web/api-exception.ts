import { HttpException } from '@nestjs/common';

/** Error de negocio con estado HTTP explicito (404, 409, 400...). */
export class ApiException extends HttpException {
  constructor(status: number, message: string) {
    super(message, status);
  }
}

/** Error de validacion con el mapa de campos, igual que MethodArgumentNotValidException. */
export class ApiValidationException extends HttpException {
  constructor(public readonly fields: Record<string, string>) {
    super(Object.values(fields)[0] ?? 'Datos invalidos', 400);
  }
}
