import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { lanzarChrome } from '../common/chromium';
import { round2 } from '../common/dates';
import { gastoGasoilJson } from '../common/serialize';
import { GastoGasoilRepository } from '../repo/gasto-gasoil.repository';
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

/** Gasto de gasoil serializado que consume el HTML (función pura). */
export type GastoGasoilFila = FilaGasto & {
  vehiculo?: { id?: number; placa?: string; marca?: string; modelo?: string };
};

/**
 * Agrupa por placa del vehículo (orden alfabético) y suma montos $ y Bs.
 * Los gastos sin vehículo caen en el bloque «SIN VEHÍCULO».
 */
export function resumirPorVehiculo(gastos: GastoGasoilFila[]): BloqueGasto[] {
  return agruparPor(gastos, (g) => g.vehiculo?.placa || 'SIN VEHÍCULO');
}

const litros = (v: number | undefined): string =>
  Number(v || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const COLUMNAS: ColumnaGasto[] = [
  { clave: 'fecha', encabezado: 'Fecha', celda: (f) => fechaCorta(f.fecha) },
  {
    clave: 'vehiculo',
    encabezado: 'Vehículo',
    celda: (f) => escapar(f.vehiculo?.placa ?? ''),
  },
  { clave: 'estacion', encabezado: 'Estación', celda: (f) => escapar(f.estacion ?? '') },
  { clave: 'litros', encabezado: 'Litros', num: true, celda: (f) => litros(f.litros) },
  {
    clave: 'precio',
    encabezado: 'Precio $/L',
    num: true,
    celda: (f) => `$ ${formatearDinero(f.precioLitro)}`,
  },
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
  { clave: 'ref', encabezado: 'N° REF', celda: (f) => escapar(f.referencia ?? '') },
];

@Injectable()
export class GastosGasoilService {
  constructor(private readonly repo: GastoGasoilRepository) {}

  async crearPdf(desde?: string, hasta?: string, vehiculoId?: number | null): Promise<Buffer> {
    const gastos = await this.repo.buscar(vehiculoId, desde, hasta);
    const bloques = resumirPorVehiculo(gastos.map(gastoGasoilJson));
    const totalUsd = round2(bloques.reduce((s, b) => s + b.sumaUsd, 0));
    const totalBs = round2(bloques.reduce((s, b) => s + b.sumaBs, 0));

    const html = htmlGastosSeccion({
      titulo: 'Gastos de gasoil',
      rango: rangoFechas(desde, hasta),
      columnas: COLUMNAS,
      bloques,
      totalUsd,
      totalBs,
      cantidad: gastos.length,
      color: '#26324a',
      logoUri: this.logoDataUri(),
      // La placa ya encabeza su bloque: el subtotal solo dice "SUBTOTAL".
      etiquetaSubtotal: () => 'SUBTOTAL',
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
