import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Replica spring.jackson.default-property-inclusion=non_null: los campos con
 * valor null se omiten del JSON de respuesta.
 */
@Injectable()
export class JsonNonNullInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
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
