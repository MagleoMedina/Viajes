const pad = (n: number) => String(n).padStart(2, '0');

/** Date -> "YYYY-MM-DD" (LocalDate de Java, en UTC). */
export function toIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Date -> ISO-8601 sin zona, con milisegundos solo si son distintos de cero. */
export function toIsoDateTime(date: Date): string {
  const base =
    `${toIsoDate(date)}T${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  const ms = date.getUTCMilliseconds();
  return ms === 0 ? base : `${base}.${String(ms).padStart(3, '0')}`;
}

/** "YYYY-MM-DD" -> epoch ms a medianoche UTC. */
export function dateOnlyToMillis(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Redondeo HALF_UP a 2 decimales, igual que BigDecimal.setScale(2, HALF_UP). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Monto en $ derivado del monto en Bs: Bs ÷ tasa (tasa 0 -> 0). */
export function usdDesdeBs(montoBs: number, tasa: number): number {
  const t = Number(tasa) || 0;
  return t ? round2((Number(montoBs) || 0) / t) : 0;
}

/**
 * Ordena los registros por fecha de inicio ascendente; con la misma fecha
 * desempata por id. Lo usan los PDF que listan viajes.
 */
export function ordenarPorFechaAscendente<T extends { id: number; fechaInicio: Date | string }>(
  registros: T[],
): T[] {
  return [...registros].sort(
    (a, b) =>
      new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime() || a.id - b.id,
  );
}

/** Formato de numeros aleman (1.234,56), igual que String.format(Locale.GERMANY). */
export function money(value: number): string {
  return (Number(value) || 0).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
