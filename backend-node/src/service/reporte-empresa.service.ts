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
  color?: string; // Color (#rrggbb) del nombre de la empresa en el encabezado
}

/** Cantidad de columnas del cuerpo: 8 con MONTO, 7 sin él. */
const COLS_CON_MONTO = 8;

@Injectable()
export class ReporteEmpresaService {
  constructor(
    private readonly empresaRepo: EmpresaRepository,
    private readonly viajeRepo: ViajeRepository,
  ) {}

  async generarPdf(params: ParametrosReporte): Promise<Buffer> {
    const { empresaId, desde, hasta, direccion: direccionParam, conMonto = true, color } = params;

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

    const filas = viajes.map((v) => ({
      fecha: this.fechaCorta(v.fechaInicio),
      vehiculo: this.vehiculo(v),
      chofer: this.chofer(v),
      recorrido: v.recorrido?.trim() || '—',
      desde: v.puntoSalida?.nombre?.trim() || '—',
      hasta: v.puntoLlegada?.nombre?.trim() || '—',
      carga: v.carga?.trim() || '—',
      monto: this.dinero(v.montoViaje ?? 0),
    }));

    const total = viajes.reduce((suma, v) => suma + (v.montoViaje ?? 0), 0);
    const columnas = conMonto
      ? ['FECHA', 'VEHICULO', 'CHOFER', 'RECORRIDO', 'DESDE', 'HASTA', 'CARGA', 'MONTO ($)']
      : ['FECHA', 'VEHICULO', 'CHOFER', 'RECORRIDO', 'DESDE', 'HASTA', 'CARGA'];
    // Anchos en % del ancho de pagina: suman 100.
    const anchos = conMonto ? [10, 17, 15, 17, 11, 11, 12, 7] : [11, 18, 16, 18, 12, 12, 13];

    const ths = columnas
      .map(
        (c, i) =>
          `<th style="width: ${anchos[i]}%;" class="${i === columnas.length - 1 && conMonto ? 'num' : ''}">${c}</th>`,
      )
      .join('');

    const cuerpo = filas.length
      ? filas
          .map(
            (f, i) => `
            <tr class="${i % 2 ? 'par' : ''}">
              <td>${f.fecha}</td>
              <td>${this.esc(f.vehiculo)}</td>
              <td>${this.esc(f.chofer)}</td>
              <td>${this.esc(f.recorrido)}</td>
              <td>${this.esc(f.desde)}</td>
              <td>${this.esc(f.hasta)}</td>
              <td>${this.esc(f.carga)}</td>
              ${conMonto ? `<td class="num">${f.monto}</td>` : ''}
            </tr>`,
          )
          .join('')
      : `<tr><td colspan="${columnas.length}" class="vacio">Sin viajes en este intervalo.</td></tr>`;

    const pie =
      conMonto && filas.length
        ? `<tr class="total">
             <td colspan="${COLS_CON_MONTO - 1}">TOTAL</td>
             <td class="num">$ ${this.dinero(total)}</td>
           </tr>`
        : '';

    // 5. Plantilla HTML con estilos idénticos al formato solicitado
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 landscape;
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

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            table-layout: fixed;
          }
          th, td {
            border: 1px solid #c9d2e0;
            padding: 5px 6px;
            font-size: 8px;
            overflow-wrap: break-word;
          }
          th {
            background-color: #26324a;
            color: #ffffff;
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
            font-size: 9px;
          }
        </style>
      </head>
      <body>

        <!-- Cabecera en el medio de la hoja -->
        <div class="header-container">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <div class="slogan">Sin pausa, sin excusas, sin limites</div>
          <div class="titulo-reporte">REPORTE VIAJES DESDE EL ${rangoFechas}</div>
          <div class="nombre-empresa">${this.esc(nombreEmpresa)}</div>
          <div class="direccion-empresa">${this.esc(direccionEmpresa)}</div>
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

    // 6. Generación con Puppeteer
    const browser = await lanzarChrome();

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });

      const pdfUint8 = await page.pdf({
        format: 'A4',
        landscape: true,
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
    return Number(valor || 0).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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

  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
