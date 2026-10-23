import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { lanzarChrome } from '../common/chromium';
import { round2 } from '../common/dates';
import { ingresoJson } from '../common/serialize';
import { IngresoRepository } from '../repo/ingreso.repository';
import {
  BloqueGasto,
  FilaGasto,
  agruparPor,
  escapar,
  fechaCorta,
  formatearDinero,
  htmlGastosSeccion,
  rangoFechas,
} from './gastos-seccion.builder';

/** Fila serializada que consume el HTML (función pura, testeable). */
export interface FilaIngreso extends FilaGasto {
  condicionesPago?: string;
  descripcion?: string;
  cantidad?: number;
  tasa?: number;
  facturaNum?: number | null;
  iva?: number;
  empresa?: { id?: number; nombre?: string };
}

const numero = (valor: number | undefined): string =>
  Number(valor || 0).toLocaleString('es-VE', { maximumFractionDigits: 2 });

/** La tasa admite 6 decimales; los montos muestran 2. */
const tasaTexto = (valor: number | undefined): string =>
  Number(valor || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

/** Agrupa por empresa (orden alfabético) y suma los montos por bloque. */
export function resumirPorEmpresa(filas: FilaIngreso[]): BloqueGasto[] {
  return agruparPor(filas, (f) => f.empresa?.nombre ?? 'SIN EMPRESA');
}

@Injectable()
export class IngresosService {
  constructor(private readonly repo: IngresoRepository) {}

  async crearPdf(
    desde?: string,
    hasta?: string,
    empresaId?: number | null,
  ): Promise<Buffer> {
    const registros = await this.repo.buscar(empresaId, desde, hasta);
    const filas: FilaIngreso[] = registros.map((r) => {
      const json = ingresoJson(r);
      // agruparPor suma `montoUsd`: el monto en divisas es el $ del PDF.
      return { ...json, montoUsd: json.montoDivisa ?? 0 };
    });
    const bloques = resumirPorEmpresa(filas);
    const totalUsd = round2(bloques.reduce((s, b) => s + b.sumaUsd, 0));
    const totalBs = round2(bloques.reduce((s, b) => s + b.sumaBs, 0));

    const html = htmlGastosSeccion({
      titulo: 'Ingresos',
      rango: rangoFechas(desde, hasta),
      columnas: [
        {
          clave: 'fecha',
          encabezado: 'FECHA',
          celda: (f) => fechaCorta(f.fecha),
        },
        {
          clave: 'facturaNum',
          encabezado: 'FACTURA No.',
          num: true,
          celda: (f) => (f.facturaNum == null ? '—' : String(f.facturaNum)),
        },
        {
          clave: 'condiciones',
          encabezado: 'CONDICIONES DE PAGO',
          celda: (f) => escapar(f.condicionesPago ?? '') || '—',
        },
        {
          clave: 'descripcion',
          encabezado: 'DESCRIPCIÓN',
          celda: (f) => escapar(f.descripcion ?? ''),
        },
        {
          clave: 'cantidad',
          encabezado: 'CANTIDAD',
          num: true,
          celda: (f) => numero(f.cantidad),
        },
        {
          clave: 'tasa',
          encabezado: 'TASA',
          num: true,
          celda: (f) => tasaTexto(f.tasa),
        },
        {
          clave: 'iva',
          encabezado: 'IVA',
          num: true,
          celda: (f) => formatearDinero(f.iva),
        },
        {
          clave: 'usd',
          encabezado: 'MONTO $',
          num: true,
          celda: (f) => formatearDinero(f.montoUsd),
        },
        {
          clave: 'bs',
          encabezado: 'MONTO BS',
          num: true,
          celda: (f) => formatearDinero(f.montoBs),
        },
      ],
      bloques,
      totalUsd,
      totalBs,
      cantidad: filas.length,
      color: '#26324a',
      logoUri: this.logoDataUri(),
      mensajeVacio: 'Sin ingresos en este intervalo.',
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
