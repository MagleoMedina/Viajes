import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DbSaverService } from './db-saver.service';

/**
 * Replica spring.jackson.default-property-inclusion=non_null: los campos con
 * valor null se omiten del JSON de respuesta.
 *
 * Tambien marca la base como sucia en cada escritura: DbSaverService volcarla
 * a disco agrupada (sin autoSave, que exporta la base completa por operacion).
 */
@Injectable()
export class JsonNonNullInterceptor implements NestInterceptor {
  constructor(private readonly dbSaver: DbSaverService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metodo: string = context.switchToHttp().getRequest().method;
    if (metodo !== 'GET') {
      this.dbSaver.marcarSucia();
    }
    return next.handle().pipe(map((data) => stripNulls(data)));
  }
}

function stripNulls(data: any) {
  if (data == null || Buffer.isBuffer(data)) {
    return data;
  }
  return JSON.parse(
    JSON.stringify(data, (_key, value) => (value === null ? undefined : value)),
  );
}
