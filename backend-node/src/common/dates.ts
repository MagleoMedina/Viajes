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

/** Formato de numeros aleman (1.234,56), igual que String.format(Locale.GERMANY). */
export function money(value: number): string {
  return (Number(value) || 0).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
