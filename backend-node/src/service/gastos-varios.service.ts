import { Injectable } from '@nestjs/common';
import { lanzarChrome } from '../common/chromium';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { GastoVarioRepository } from '../repo/gasto-vario.repository';
import { gastoVarioJson } from '../common/serialize';
import { round2 } from '../common/dates';
import { htmlResumenTitulos, rangoFechas } from './gastos-seccion.builder';

/** Gasto serializado que consume el HTML (función pura testeable). */
export interface GastoVarioFila {
  fecha?: string; // YYYY-MM-DD
  numero?: string;
  motivo?: string;
  montoUsd?: number;
  montoBs?: number;
  tasa?: number;
  porcentajeDb?: number;
  referencia?: string;
  tituloGasto?: { id?: number; nombre?: string };
}

/** Un título con sus registros y sus sumas ($ y Bs). */
export interface BloqueTitulo {
  titulo: string;
  filas: GastoVarioFila[];
  sumaUsd: number;
  sumaBs: number;
}

export interface GastosHtmlParams {
  rango: string;
  bloques: BloqueTitulo[];
  totalUsd: number;
  totalBs: number;
  cantidad: number;
  color?: string;
  logoUri?: string;
}

const num = (v: number | undefined): number => Number(v || 0);

/**
 * Agrupa por título (orden alfabético) y suma montos $ y Bs por título.
 * %DB es informativo: no entra en las sumas.
 */
export function resumirPorTitulo(gastos: GastoVarioFila[]): BloqueTitulo[] {
  const mapa = new Map<string, BloqueTitulo>();
  for (const g of gastos) {
    const nombre = (g.tituloGasto?.nombre ?? '').trim() || 'SIN TÍTULO';
    let bloque = mapa.get(nombre);
    if (!bloque) {
      bloque = { titulo: nombre, filas: [], sumaUsd: 0, sumaBs: 0 };
      mapa.set(nombre, bloque);
    }
    bloque.filas.push(g);
    bloque.sumaUsd += num(g.montoUsd);
    bloque.sumaBs += num(g.montoBs);
  }
  const bloques = [...mapa.values()].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, 'es'),
  );
  for (const b of bloques) {
    b.sumaUsd = round2(b.sumaUsd);
    b.sumaBs = round2(b.sumaBs);
    b.filas.sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)));
  }
  return bloques;
}

/**
 * PDF de gastos varios: una fila por título con los valores sumados.
 * El detalle de cada registro queda en pantalla, no en el PDF.
 */
export function htmlGastosVarios(params: GastosHtmlParams): string {
  const { rango, bloques, totalUsd, totalBs, cantidad, color, logoUri } = params;

  return htmlResumenTitulos({
    titulo: 'Gastos varios',
    encabezado: 'TÍTULO',
    rango,
    filas: bloques.map((b) => ({
      etiqueta: b.titulo,
      montoUsd: b.sumaUsd,
      montoBs: b.sumaBs,
    })),
    totalUsd,
    totalBs,
    cantidad,
    color,
    logoUri,
  });
}

@Injectable()
export class GastosVariosService {
  constructor(private readonly repo: GastoVarioRepository) {}

  async crearPdf(desde?: string, hasta?: string, tituloId?: number | null): Promise<Buffer> {
    const gastos = await this.repo.buscar(tituloId, desde, hasta);
    const bloques = resumirPorTitulo(gastos.map(gastoVarioJson));
    const totalUsd = round2(bloques.reduce((s, b) => s + b.sumaUsd, 0));
    const totalBs = round2(bloques.reduce((s, b) => s + b.sumaBs, 0));

    const html = htmlGastosVarios({
      rango: rangoFechas(desde, hasta),
      bloques,
      totalUsd,
      totalBs,
      cantidad: gastos.length,
      color: '#26324a',
      logoUri: this.logoDataUri(),
    });

    const browser = await lanzarChrome();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfUint8 = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdfUint8);
    } finally {
      await browser.close();
    }
  }

  private logoDataUri(): string {
    const logoPath = join(process.cwd(), 'assets', 'logo.jpg');
    if (existsSync(logoPath)) {
      return `data:image/jpeg;base64,${readFileSync(logoPath).toString('base64')}`;
    }
    return '';
  }
}
