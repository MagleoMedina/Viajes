import { ValueTransformer } from 'typeorm';

/**
 * Las columnas de fecha viven en SQLite como epoch en milisegundos (formato que
 * usa Hibernate en el backend Java que este servicio reemplaza). La entidad las
 * expone como Date y el transformer hace el ida y vuelta.
 */
export const epochMs: ValueTransformer = {
  to: (value: Date | number | null | undefined) =>
    value instanceof Date ? value.getTime() : value,
  from: (value: number | null | undefined) =>
    value == null ? null : new Date(value),
};
