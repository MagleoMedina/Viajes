import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { lanzarChrome } from '../common/chromium';
import { round2 } from '../common/dates';
import { GastoGasoilRepository } from '../repo/gasto-gasoil.repository';
import { GastoImpuestoRepository } from '../repo/gasto-impuesto.repository';
import { GastoVarioRepository } from '../repo/gasto-vario.repository';
import { IngresoRepository } from '../repo/ingreso.repository';
import { TasaRepository } from '../repo/tasa.repository';
import { ViajeRepository } from '../repo/viaje.repository';
import { ApiException, ApiValidationException } from '../web/api-exception';
import { escapar, formatearDinero, rangoFechas } from './gastos-seccion.builder';

/**
 * Reportes de relación (ingresos, gastos y relación general).
 * Los ingresos salen del módulo Ingresos; los gastos, de viajes y de los
 * 3 módulos de gastos; el Bs usa la última tasa registrada.
 */

export const TIPOS_RELACION = ['ingresos', 'gastos', 'general'] as const;
export type TipoRelacion = (typeof TIPOS_RELACION)[number];

/** Los 7 tipos del reporte de gastos, siempre presentes (aunque sumen 0). */
export const TIPOS_GASTO = [
  'GASTOS VARIOS',
  'IMPUESTOS',
  'GASOIL',
  'COMBUSTIBLE',
  'PAGO A CHOFERES',
  'PEAJES',
  'VIÁTICOS',
] as const;

export interface FilaRelacion {
  etiqueta: string;
  montoUsd: number;
  montoBs: number;
}

export interface RelacionResumen {
  tipo: TipoRelacion;
  tasa: number;
  filas: FilaRelacion[];
  totalUsd: number;
  totalBs: number;
  cantidad: number;
}

/** Viaje reducido a lo que necesita el cálculo (función pura testeable). */
export interface ViajeRelacion {
  tasa?: number;
  combustible?: number;
  pagoChofer?: number;
  peajes?: number;
  viaticos?: number;
}

/** Ingreso reducido a lo que necesita el cálculo (función pura testeable). */
export interface IngresoRelacion {
  empresa?: string | null;
  /** Monto recibido en divisas ($). */
  montoDivisa?: number;
  /** Monto final en Bs: valor independiente guardado en el ingreso. */
  montoBs?: number;
}

/** Registro de un módulo de gastos (monto $ y Bs ya guardados). */
export interface GastoModuloRelacion {
  montoUsd?: number;
  montoBs?: number;
  /** Título del gasto: en varios e impuestos el reporte se abre por título. */
  titulo?: string;
}

export interface GastosFuentes {
  varios: GastoModuloRelacion[];
  impuestos: GastoModuloRelacion[];
  gasoil: GastoModuloRelacion[];
  viajes: ViajeRelacion[];
}

const num = (v: number | undefined): number => Number(v || 0);

const sumar = (filas: GastoModuloRelacion[]): { usd: number; bs: number } => ({
  usd: round2(filas.reduce((s, f) => s + num(f.montoUsd), 0)),
  bs: round2(filas.reduce((s, f) => s + num(f.montoBs), 0)),
});

/**
 * Ingresos agrupados por empresa (orden alfabético): suma del monto en divisas
 * ($) y del monto final en Bs ya guardado en cada ingreso. El IVA es
 * informativo y no entra en estos totales.
 * Los ingresos sin empresa caen en «SIN EMPRESA».
 */
export function resumirIngresos(ingresos: IngresoRelacion[]): FilaRelacion[] {
  const mapa = new Map<string, { usd: number; bs: number }>();
  for (const i of ingresos) {
    const clave = (i.empresa ?? '').trim() || 'SIN EMPRESA';
    const suma = mapa.get(clave) ?? { usd: 0, bs: 0 };
    suma.usd += num(i.montoDivisa);
    suma.bs += num(i.montoBs);
    mapa.set(clave, suma);
  }
  return [...mapa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([etiqueta, suma]) => ({
      etiqueta,
      montoUsd: round2(suma.usd),
      montoBs: round2(suma.bs),
    }));
}

/**
 * Gastos del reporte. Varios e impuestos se abren por título (una fila por
 * título, sumada); si una categoría no tiene registros deja su fila en 0.
 * Gasoil, combustible, pago a choferes, peajes y viáticos quedan fijos: los
 * viajes traen sus montos en Bs, así que el $ se deriva con la tasa de cada
 * viaje (tasa 0 -> 0).
 */
export function resumirGastos(fuentes: GastosFuentes): FilaRelacion[] {
  const delViaje = (
    campo: 'combustible' | 'pagoChofer' | 'peajes' | 'viaticos',
  ): { usd: number; bs: number } => {
    let usd = 0;
    let bs = 0;
    for (const v of fuentes.viajes) {
      const montoBs = num(v[campo]);
      bs += montoBs;
      const tasa = num(v.tasa);
      if (tasa > 0) usd += montoBs / tasa;
    }
    return { usd: round2(usd), bs: round2(bs) };
  };

  const porTitulo = (filas: GastoModuloRelacion[]): FilaRelacion[] => {
    if (!filas.length) return [];
    const mapa = new Map<string, { usd: number; bs: number }>();
    for (const f of filas) {
      const clave = (f.titulo ?? '').trim() || 'SIN TÍTULO';
      const suma = mapa.get(clave) ?? { usd: 0, bs: 0 };
      suma.usd += num(f.montoUsd);
      suma.bs += num(f.montoBs);
      mapa.set(clave, suma);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([etiqueta, suma]) => ({
        etiqueta,
        montoUsd: round2(suma.usd),
        montoBs: round2(suma.bs),
      }));
  };

  const filas: FilaRelacion[] = [];
  for (const [categoria, registros] of [
    [TIPOS_GASTO[0], fuentes.varios],
    [TIPOS_GASTO[1], fuentes.impuestos],
  ] as const) {
    const titulos = porTitulo(registros);
    if (titulos.length) filas.push(...titulos);
    else filas.push({ etiqueta: categoria, montoUsd: 0, montoBs: 0 });
  }

  const gasoil = sumar(fuentes.gasoil);
  const combustible = delViaje('combustible');
  const choferes = delViaje('pagoChofer');
  const peajes = delViaje('peajes');
  const viaticos = delViaje('viaticos');

  filas.push(
    { etiqueta: TIPOS_GASTO[2], montoUsd: gasoil.usd, montoBs: gasoil.bs },
    { etiqueta: TIPOS_GASTO[3], montoUsd: combustible.usd, montoBs: combustible.bs },
    { etiqueta: TIPOS_GASTO[4], montoUsd: choferes.usd, montoBs: choferes.bs },
    { etiqueta: TIPOS_GASTO[5], montoUsd: peajes.usd, montoBs: peajes.bs },
    { etiqueta: TIPOS_GASTO[6], montoUsd: viaticos.usd, montoBs: viaticos.bs },
  );

  return filas;
}

/** Ingresos − egresos: tres filas (INGRESOS, EGRESOS, RELACIÓN). Negativo permitido. */
export function resumirGeneral(ingresos: FilaRelacion[], gastos: FilaRelacion[]): FilaRelacion[] {
  const ingresosUsd = round2(ingresos.reduce((s, f) => s + f.montoUsd, 0));
  const ingresosBs = round2(ingresos.reduce((s, f) => s + f.montoBs, 0));
  const egresosUsd = round2(gastos.reduce((s, f) => s + f.montoUsd, 0));
  const egresosBs = round2(gastos.reduce((s, f) => s + f.montoBs, 0));
  return [
    { etiqueta: 'INGRESOS', montoUsd: ingresosUsd, montoBs: ingresosBs },
    { etiqueta: 'EGRESOS', montoUsd: egresosUsd, montoBs: egresosBs },
    {
      etiqueta: 'RELACIÓN',
      montoUsd: round2(ingresosUsd - egresosUsd),
      montoBs: round2(ingresosBs - egresosBs),
    },
  ];
}

export interface RelacionHtmlParams {
  titulo: string;
  rango: string;
  /** Encabezado de la primera columna: EMPRESA, CONCEPTO o RELACIÓN. */
  encabezadoEtiqueta: string;
  filas: FilaRelacion[];
  tasa: number;
  totalUsd: number;
  totalBs: number;
  cantidad: number;
  /** El reporte general ya muestra sus totales en las filas: sin fila TOTAL. */
  mostrarTotal?: boolean;
  color?: string;
  logoUri?: string;
}

/** Construye el HTML del PDF de relación (función pura, testeable). */
export function htmlRelacion(params: RelacionHtmlParams): string {
  const {
    titulo,
    rango,
    encabezadoEtiqueta,
    filas,
    tasa,
    totalUsd,
    totalBs,
    cantidad,
    mostrarTotal = true,
    color,
    logoUri,
  } = params;

  const cuerpo = filas
    .map(
      (f, i) => `
        <tr class="${i % 2 ? 'par' : ''}">
          <td>${escapar(f.etiqueta)}</td>
          <td class="num">$ ${formatearDinero(f.montoUsd)}</td>
          <td class="num">Bs ${formatearDinero(f.montoBs)}</td>
          <td class="num">${formatearDinero(tasa)}</td>
        </tr>`,
    )
    .join('');

  const total =
    mostrarTotal && filas.length
      ? `
        <tr class="total">
          <td>TOTAL</td>
          <td class="num">$ ${formatearDinero(totalUsd)}</td>
          <td class="num">Bs ${formatearDinero(totalBs)}</td>
          <td class="num">${formatearDinero(tasa)}</td>
        </tr>`
      : '';

  const vacio = filas.length
    ? ''
    : `<tr><td colspan="4" class="vacio">Sin registros en este intervalo.</td></tr>`;

  return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: letter landscape; margin: 12mm 10mm; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
          }
          .cab { text-align: center; margin-bottom: 10px; }
          .logo { max-width: 200px; height: auto; margin-bottom: 6px; }
          h1 {
            font-size: 15px;
            font-weight: 800;
            color: ${color ?? '#26324a'};
            letter-spacing: 0.5px;
            margin: 0 0 4px;
            text-transform: uppercase;
          }
          .rango { font-size: 16px; line-height: 1.2; color: #4b5563; margin: 0; }
          .resumen { margin: 8px 0 10px; text-align: center; }
          .dato {
            display: inline-block;
            border: 1px solid #2f6fed;
            background: #eef3fb;
            color: #26324a;
            font-size: 11px;
            font-weight: bold;
            padding: 3px 8px;
            margin: 0 3px;
          }
          .dato .k { color: #2f6fed; font-size: 9px; margin-right: 5px; }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto;
            margin-bottom: 4px;
          }
          th, td {
            border: 1px solid #c9d2e0;
            padding: 5px 6px;
            font-size: 10pt;
            overflow-wrap: break-word;
          }
          th {
            background-color: #26324a;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
          }
          th.num, td.num { text-align: right; white-space: nowrap; }
          thead { display: table-header-group; }
          tbody tr { page-break-inside: avoid; }
          tbody tr.par td { background-color: #f4f6fa; }
          tr.total td {
            background-color: #26324a;
            color: #ffffff;
            font-weight: bold;
            font-size: 10pt;
          }
          td.vacio { text-align: center; color: #6b7280; font-style: italic; padding: 14px; }
          .total-general {
            margin-top: 12px;
            text-align: right;
            font-size: 12pt;
            font-weight: bold;
          }
          .total-general .caja {
            display: inline-block;
            background: #2f6fed;
            color: #ffffff;
            padding: 6px 14px;
            margin-left: 6px;
            border-radius: 6px;
          }
        </style>
      </head>
      <body>
        <div class="cab">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <h1>${escapar(titulo)}</h1>
          <p class="rango">${escapar(rango)}</p>
        </div>

        <div class="resumen">
          <span class="dato"><span class="k">PERIODO</span>${escapar(rango)}</span>
          <span class="dato"><span class="k">REGISTROS</span>${cantidad}</span>
          <span class="dato"><span class="k">TASA</span>${formatearDinero(tasa)}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>${escapar(encabezadoEtiqueta)}</th>
              <th class="num">MONTO $</th>
              <th class="num">MONTO BS</th>
              <th class="num">TASA</th>
            </tr>
          </thead>
          <tbody>
            ${cuerpo}
            ${vacio}
            ${total}
          </tbody>
        </table>

        ${
          mostrarTotal && filas.length
            ? `
        <div class="total-general">
          TOTAL GENERAL
          <span class="caja">$ ${formatearDinero(totalUsd)}</span>
          <span class="caja">Bs ${formatearDinero(totalBs)}</span>
        </div>`
            : ''
        }
      </body>
      </html>
    `;
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class RelacionReportesService {
  constructor(
    private readonly viajeRepo: ViajeRepository,
    private readonly ingresoRepo: IngresoRepository,
    private readonly variosRepo: GastoVarioRepository,
    private readonly impuestosRepo: GastoImpuestoRepository,
    private readonly gasoilRepo: GastoGasoilRepository,
    private readonly tasaRepo: TasaRepository,
  ) {}

  /** Fechas obligatorias, formato ISO y en orden. */
  validarRango(desde?: string, hasta?: string): void {
    const campos: Record<string, string> = {};
    if (!desde || !FECHA_ISO.test(desde)) campos.desde = 'La fecha de inicio es obligatoria';
    if (!hasta || !FECHA_ISO.test(hasta)) campos.hasta = 'La fecha de fin es obligatoria';
    if (Object.keys(campos).length) throw new ApiValidationException(campos);
    if (desde! > hasta!) {
      throw new ApiValidationException({
        hasta: 'La fecha de fin no puede ser anterior a la de inicio',
      });
    }
  }

  async ingresos(desde: string, hasta: string): Promise<RelacionResumen> {
    const tasa = await this.tasaVigente();
    const registros = await this.ingresoRepo.buscar(null, desde, hasta);
    const filas = resumirIngresos(
      registros.map((i) => ({
        empresa: i.empresa?.nombre ?? null,
        montoDivisa: i.montoDivisa,
        montoBs: i.montoBs,
      })),
    );
    return this.resumen('ingresos', tasa, filas, registros.length);
  }

  async gastos(desde: string, hasta: string): Promise<RelacionResumen> {
    const tasa = await this.tasaVigente();
    const [viajes, varios, impuestos, gasoil] = await Promise.all([
      this.viajeRepo.findByFechaInicioBetweenOrderByFechaInicioDesc(desde, hasta),
      this.variosRepo.buscar(null, desde, hasta),
      this.impuestosRepo.buscar(null, desde, hasta),
      this.gasoilRepo.buscar(null, desde, hasta),
    ]);

    const filas = resumirGastos({
      varios: varios.map((g) => ({
        montoUsd: g.montoUsd,
        montoBs: g.montoBs,
        titulo: g.tituloGasto?.nombre,
      })),
      impuestos: impuestos.map((g) => ({
        montoUsd: g.montoUsd,
        montoBs: g.montoBs,
        titulo: g.tituloImpuesto?.nombre,
      })),
      gasoil,
      viajes: viajes.map((v) => ({
        tasa: v.tasa,
        combustible: v.combustible,
        pagoChofer: v.pagoChofer,
        peajes: v.peajes,
        viaticos: v.viaticos,
      })),
    });

    const cantidad =
      varios.length +
      impuestos.length +
      gasoil.length +
      viajes.filter(
        (v) =>
          num(v.combustible) + num(v.pagoChofer) + num(v.peajes) + num(v.viaticos) > 0,
      ).length;

    return this.resumen('gastos', tasa, filas, cantidad);
  }

  async general(desde: string, hasta: string): Promise<RelacionResumen> {
    const [ingresos, gastos] = await Promise.all([
      this.ingresos(desde, hasta),
      this.gastos(desde, hasta),
    ]);
    const filas = resumirGeneral(ingresos.filas, gastos.filas);
    const resumen = this.resumen(
      'general',
      ingresos.tasa,
      filas,
      ingresos.cantidad + gastos.cantidad,
    );
    return resumen;
  }

  async resumenPorTipo(tipo: TipoRelacion, desde: string, hasta: string): Promise<RelacionResumen> {
    if (tipo === 'ingresos') return this.ingresos(desde, hasta);
    if (tipo === 'gastos') return this.gastos(desde, hasta);
    return this.general(desde, hasta);
  }

  async crearPdf(tipo: TipoRelacion, desde: string, hasta: string): Promise<Buffer> {
    const resumen = await this.resumenPorTipo(tipo, desde, hasta);
    const html = htmlRelacion({
      titulo: TITULOS[tipo],
      rango: rangoFechas(desde, hasta),
      encabezadoEtiqueta: ENCABEZADOS[tipo],
      filas: resumen.filas,
      tasa: resumen.tasa,
      totalUsd: resumen.totalUsd,
      totalBs: resumen.totalBs,
      cantidad: resumen.cantidad,
      mostrarTotal: tipo !== 'general',
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

  /** Última tasa registrada; sin tasa no hay Bs posible. */
  private async tasaVigente(): Promise<number> {
    const tasa = await this.tasaRepo.findTopByOrderByIdDesc();
    if (!tasa || !(Number(tasa.valor) > 0)) {
      throw new ApiException(400, 'No hay tasa registrada para convertir a Bs');
    }
    return Number(tasa.valor);
  }

  private resumen(
    tipo: TipoRelacion,
    tasa: number,
    filas: FilaRelacion[],
    cantidad: number,
  ): RelacionResumen {
    return {
      tipo,
      tasa,
      filas,
      totalUsd: round2(filas.reduce((s, f) => s + f.montoUsd, 0)),
      totalBs: round2(filas.reduce((s, f) => s + f.montoBs, 0)),
      cantidad,
    };
  }

  private logoDataUri(): string {
    const logoPath = join(process.cwd(), 'assets', 'logo.jpg');
    if (existsSync(logoPath)) {
      return `data:image/jpeg;base64,${readFileSync(logoPath).toString('base64')}`;
    }
    return '';
  }
}

const TITULOS: Record<TipoRelacion, string> = {
  ingresos: 'Reporte de ingresos por empresa',
  gastos: 'Reporte de gastos por concepto',
  general: 'Relación ingresos − egresos',
};

const ENCABEZADOS: Record<TipoRelacion, string> = {
  ingresos: 'EMPRESA',
  gastos: 'CONCEPTO',
  general: 'RELACIÓN',
};
