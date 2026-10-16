import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { lanzarChrome } from '../common/chromium';
import { round2 } from '../common/dates';
import { gastoImpuestoJson } from '../common/serialize';
import { GastoImpuestoRepository } from '../repo/gasto-impuesto.repository';
import {
  BloqueGasto,
  ColumnaGasto,
  FilaGasto,
  agruparPor,
  escapar,
  fechaCorta,
  formatearDinero,
  htmlGastosSeccion,
  rangoFechas,
} from './gastos-seccion.builder';

/** Gasto de impuesto serializado que consume el HTML (función pura). */
export type GastoImpuestoFila = FilaGasto & {
  tituloImpuesto?: { id?: number; nombre?: string };
};

/**
 * Agrupa por tipo de impuesto (orden alfabético) y suma montos $ y Bs.
 * %DB es informativo: no entra en las sumas.
 */
export function resumirPorTipo(gastos: GastoImpuestoFila[]): BloqueGasto[] {
  return agruparPor(gastos, (g) => g.tituloImpuesto?.nombre ?? '');
}

const COLUMNAS: ColumnaGasto[] = [
  { clave: 'fecha', encabezado: 'Fecha', celda: (f) => fechaCorta(f.fecha) },
  {
    clave: 'tipo',
    encabezado: 'Tipo',
    celda: (f) => escapar(f.tituloImpuesto?.nombre ?? ''),
  },
  { clave: 'numero', encabezado: 'N°', celda: (f) => escapar(f.numero ?? '') },
  { clave: 'motivo', encabezado: 'Motivo', celda: (f) => escapar(f.motivo ?? '') },
  {
    clave: 'usd',
    encabezado: 'Monto $',
    num: true,
    celda: (f) => `$ ${formatearDinero(f.montoUsd)}`,
  },
  {
    clave: 'bs',
    encabezado: 'Monto Bs',
    num: true,
    celda: (f) => `Bs ${formatearDinero(f.montoBs)}`,
  },
  {
    clave: 'tasa',
    encabezado: 'Tasa',
    num: true,
    celda: (f) => formatearDinero(f.tasa),
  },
  {
    clave: 'pdb',
    encabezado: '%DB',
    num: true,
    celda: (f) => formatearDinero(f.porcentajeDb),
  },
  { clave: 'ref', encabezado: 'N° REF', celda: (f) => escapar(f.referencia ?? '') },
];

@Injectable()
export class GastosImpuestosService {
  constructor(private readonly repo: GastoImpuestoRepository) {}

  async crearPdf(desde?: string, hasta?: string, tituloId?: number | null): Promise<Buffer> {
    const gastos = await this.repo.buscar(tituloId, desde, hasta);
    const bloques = resumirPorTipo(gastos.map(gastoImpuestoJson));
    const totalUsd = round2(bloques.reduce((s, b) => s + b.sumaUsd, 0));
    const totalBs = round2(bloques.reduce((s, b) => s + b.sumaBs, 0));

    const html = htmlGastosSeccion({
      titulo: 'Gastos de impuestos',
      rango: rangoFechas(desde, hasta),
      columnas: COLUMNAS,
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
