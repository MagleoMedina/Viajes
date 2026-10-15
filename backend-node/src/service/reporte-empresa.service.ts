import { Injectable } from '@nestjs/common';
import { lanzarChrome } from '../common/chromium';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EmpresaRepository } from '../repo/empresa.repository';
import { ViajeRepository } from '../repo/viaje.repository';
import { Viaje } from '../domain/viaje.entity';

export interface ParametrosReporte {
  empresaId: number;
  desde?: string; // Formato YYYY-MM-DD
  hasta?: string; // Formato YYYY-MM-DD
  direccion?: string; // Dirección opcional si no existe en la base de datos
  conMonto?: boolean; // Segundo formato: sin la columna MONTO ni el TOTAL
  sinChofer?: boolean; // Tercer formato: sin la columna CHOFER
  color?: string; // Color (#rrggbb) del nombre de la empresa en el encabezado
}

/** Cantidad de columnas del cuerpo: 8 con MONTO, 7 sin él. */
const COLS_CON_MONTO = 8;

/** Datos ya resueltos para armar el HTML del reporte (función pura). */
export interface ReporteHtmlParams {
  nombreEmpresa: string;
  direccionEmpresa: string;
  rangoFechas: string;
  columnas: string[];
  filas: string[][];
  conMonto: boolean;
  /** Recuento de viajes del intervalo (chip superior, igual que el reporte detallado). */
  cantidadViajes?: number;
  total?: number;
  color?: string;
  logoUri?: string;
}

const escapar = (str: string): string =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatearDinero = (valor: number): string =>
  Number(valor || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Construye el HTML del reporte por empresa (función pura, testeable). */
export function htmlReporte(params: ReporteHtmlParams): string {
  const {
    nombreEmpresa,
    direccionEmpresa,
    rangoFechas,
    columnas,
    filas,
    conMonto,
    cantidadViajes = filas.length,
    total = 0,
    color,
    logoUri,
  } = params;

  // Sin ancho fijo por columna: cada th toma el ancho de su texto (table-layout auto).
  const ths = columnas
    .map(
      (c, i) =>
        `<th class="${
          i === columnas.length - 1 && conMonto ? 'num' : ''
        }">${c}</th>`,
    )
    .join('');

  const cuerpo = filas.length
    ? filas
        .map(
          (celdas, i) => `
            <tr class="${i % 2 ? 'par' : ''}">
              ${celdas.map((c, j) => `<td${j === celdas.length - 1 && conMonto ? ' class="num"' : ''}>${escapar(c)}</td>`).join('')}
            </tr>`,
        )
        .join('')
    : `<tr><td colspan="${columnas.length}" class="vacio">Sin viajes en este intervalo.</td></tr>`;

  const pie =
    conMonto && filas.length
      ? `<tr class="total">
             <td colspan="${COLS_CON_MONTO - 1}">TOTAL</td>
             <td class="num">$ ${formatearDinero(total)}</td>
           </tr>`
      : '';

  return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <style>
          @page {
            size: letter landscape;
            margin: 12mm 10mm 12mm 10mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
          }

          /* Contenedor central de la cabecera */
          .header-container {
            text-align: center;
            margin-bottom: 16px;
          }
          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 6px;
          }
          .slogan {
            font-size: 10px;
            color: #111827;
            font-weight: 500;
            margin-bottom: 7px;
          }
          .titulo-reporte {
            font-size: 13px;
            font-weight: 800;
            color: #111827;
            letter-spacing: 0.5px;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }
          .nombre-empresa {
            font-size: 15px;
            font-weight: 900;
            color: ${color ?? '#8c3b87'};
            letter-spacing: 0.8px;
            margin: 0 0 4px 0;
            text-transform: uppercase;
          }
          .direccion-empresa {
            font-size: 9.5px;
            color: #4b5563;
            margin: 0;
          }

          /* Recuento de viajes del intervalo (mismo chip que el reporte detallado) */
          .resumen {
            margin: 8px 0 0;
            text-align: center;
          }
          .dato {
            display: inline-block;
            border: 1px solid #2f6fed;
            background: #eef3fb;
            color: #26324a;
            font-size: 9px;
            font-weight: bold;
            padding: 3px 8px;
            margin: 0 3px;
          }
          .dato .k {
            color: #2f6fed;
            font-size: 7.5px;
            margin-right: 5px;
          }

          table {
            width: auto;
            border-collapse: collapse;
            margin-top: 6px;
            table-layout: auto;
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
            font-size: 10pt;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
          }
          th.num, td.num {
            text-align: right;
            white-space: nowrap;
          }
          thead { display: table-header-group; }
          tbody tr { page-break-inside: avoid; }
          tbody tr.par td { background-color: #f4f6fa; }
          tbody td.vacio {
            text-align: center;
            color: #6b7280;
            font-style: italic;
            padding: 14px;
          }
          tr.total td {
            background-color: #26324a;
            color: #ffffff;
            font-weight: bold;
            font-size: 10pt;
          }
        </style>
      </head>
      <body>

        <!-- Cabecera en el medio de la hoja -->
        <div class="header-container">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <div class="slogan">Sin pausa, sin excusas, sin limites</div>
          <div class="titulo-reporte">REPORTE VIAJES DESDE EL ${rangoFechas}</div>
          <div class="nombre-empresa">${escapar(nombreEmpresa)}</div>
          <div class="direccion-empresa">${escapar(direccionEmpresa)}</div>
        </div>

        <div class="resumen">
          <span class="dato"><span class="k">VIAJES</span>${cantidadViajes}</span>
        </div>

        <table>
          <thead>
            <tr>${ths}</tr>
          </thead>
          <tbody>
            ${cuerpo}
            ${pie}
          </tbody>
        </table>

      </body>
      </html>
    `;
}

@Injectable()
export class ReporteEmpresaService {
  constructor(
    private readonly empresaRepo: EmpresaRepository,
    private readonly viajeRepo: ViajeRepository,
  ) {}

  async generarPdf(params: ParametrosReporte): Promise<Buffer> {
    const { empresaId, desde, hasta, direccion: direccionParam, conMonto = true, sinChofer = false, color } = params;

    // 1. Obtener la información de la empresa
    const empresa = Number.isFinite(empresaId) && empresaId > 0
      ? await this.empresaRepo.findById(empresaId)
      : null;
    const nombreEmpresa = empresa?.nombre ?? 'TODAS LAS EMPRESAS';
    const direccionEmpresa =
      empresa?.direccion?.trim() ||
      direccionParam ||
      'Zona Industrial Matanzas, Ciudad Guayana, Estado Bolívar';

    // 2. Intervalo dinámico de fechas
    const rangoFechas = this.formatearRangoFechas(desde, hasta);

    // 3. Viajes del intervalo/empresa (mismo filtro que el listado de la app)
    const viajes = await this.consultar(empresaId, desde, hasta);

    // 4. Logo en Base64
    const logoUri = this.obtenerLogoDataUri();

    const filas = viajes.map((v) => {
      const celdas = [
        this.fechaCorta(v.fechaInicio),
        this.vehiculo(v),
        this.chofer(v),
        v.recorrido?.trim() || '—',
        v.puntoSalida?.nombre?.trim() || '—',
        v.puntoLlegada?.nombre?.trim() || '—',
        v.carga?.trim() || '—',
      ];
      if (conMonto) celdas.push(this.dinero(v.montoViaje ?? 0));
      return celdas;
    });

    const total = viajes.reduce((suma, v) => suma + (v.montoViaje ?? 0), 0);
    let columnas = conMonto
      ? ['FECHA', 'VEHICULO', 'CHOFER', 'RECORRIDO', 'DESDE', 'HASTA', 'CARGA', 'MONTO ($)']
      : ['FECHA', 'VEHICULO', 'CHOFER', 'RECORRIDO', 'DESDE', 'HASTA', 'CARGA'];

    // "Sin chofer": quita la columna CHOFER (indice 2) del encabezado y de cada fila.
    if (sinChofer) {
      columnas = columnas.filter((_, i) => i !== 2);
      filas.forEach((celdas, i) => {
        filas[i] = celdas.filter((_, j) => j !== 2);
      });
    }

    const html = htmlReporte({
      nombreEmpresa,
      direccionEmpresa,
      rangoFechas,
      columnas,
      filas,
      conMonto,
      cantidadViajes: viajes.length,
      total,
      color,
      logoUri,
    });

    // 5. Generación con Puppeteer
    const browser = await lanzarChrome();

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });

      const pdfUint8 = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
      });

      return Buffer.from(pdfUint8);
    } finally {
      await browser.close();
    }
  }

  /** Mismo criterio de filtrado que GET /api/viajes. */
  private consultar(empresaId: number, desde?: string, hasta?: string): Promise<Viaje[]> {
    const conEmpresa = Number.isFinite(empresaId) && empresaId > 0;
    const conFechas = Boolean(desde && hasta);
    if (conEmpresa && conFechas) {
      return this.viajeRepo.findByEmpresaIdAndFechaInicioBetweenOrderByFechaInicioDesc(
        empresaId,
        desde!,
        hasta!,
      );
    }
    if (conEmpresa) return this.viajeRepo.findByEmpresaIdOrderByFechaInicioDesc(empresaId);
    if (conFechas) return this.viajeRepo.findByFechaInicioBetweenOrderByFechaInicioDesc(desde!, hasta!);
    return this.viajeRepo.findAllByOrderByFechaInicioDesc();
  }

  private fechaCorta(fecha: Date): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    // LocalDate vive en UTC: usar getters UTC, igual que toIsoDate.
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }

  private vehiculo(v: Viaje): string {
    const veh = v.vehiculo;
    if (!veh) return '—';
    const partes = [veh.marca, veh.modelo].filter((x) => x && x.trim()).join(' ').trim();
    const placa = veh.placa?.trim();
    if (partes && placa) return `${partes} (${placa})`;
    return partes || placa || '—';
  }

  private chofer(v: Viaje): string {
    const c = v.chofer;
    if (!c) return '—';
    return [c.nombre, c.apellido].filter((x) => x && x.trim()).join(' ').trim() || '—';
  }

  private dinero(valor: number): string {
    return formatearDinero(valor);
  }

  /**
   * Formatea el rango de fechas dinámico (ej: "22/09 AL 30/09/26")
   */
  private formatearRangoFechas(desde?: string, hasta?: string): string {
    if (!desde && !hasta) return 'HISTÓRICO GENERAL';

    const parsear = (fechaIso: string) => {
      const [y, m, d] = fechaIso.split('-');
      return {
        diaMes: `${d}/${m}`,
        anioCorto: y ? y.slice(-2) : '',
      };
    };

    if (desde && hasta) {
      const d = parsear(desde);
      const h = parsear(hasta);
      return `${d.diaMes} AL ${h.diaMes}/${h.anioCorto}`;
    }

    if (desde) {
      const d = parsear(desde);
      return `${d.diaMes}/${d.anioCorto} EN ADELANTE`;
    }

    const h = parsear(hasta!);
    return `HASTA EL ${h.diaMes}/${h.anioCorto}`;
  }

  private obtenerLogoDataUri(): string {
    const logoPath = join(process.cwd(), 'assets', 'logo.jpg');
    if (existsSync(logoPath)) {
      const buffer = readFileSync(logoPath);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }
    return '';
  }
}
