import { Injectable } from '@nestjs/common';
import { lanzarChrome } from '../common/chromium';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EmpresaRepository } from '../repo/empresa.repository';
import { TituloViajeRepository } from '../repo/titulo-viaje.repository';
import { ViajeRepository } from '../repo/viaje.repository';
import { VehiculoRepository } from '../repo/vehiculo.repository';
import { Viaje } from '../domain/viaje.entity';
import { formatearRangoFechas, ordenarPorFechaAscendente } from '../common/dates';
import { htmlResumenGasoil, htmlResumenTipos } from './export.service';
import { StockGasoilService } from './stock-gasoil.service';

export interface ParametrosReporte {
  empresaId: number;
  vehiculoId?: number | null; // Vehículo opcional: sin él se listan todos
  desde?: string; // Formato YYYY-MM-DD
  hasta?: string; // Formato YYYY-MM-DD
  direccion?: string; // Dirección opcional si no existe en la base de datos
  conMonto?: boolean; // Segundo formato: sin la columna MONTO
  sinChofer?: boolean; // Tercer formato: sin la columna CHOFER
  color?: string; // Color (#rrggbb) del nombre de la empresa en el encabezado
  /** Viajes personalizados: filtra por título y usa el título como nombre. */
  tituloViajeId?: number | null;
  /** Reporte de vehículos cuya marca contiene «PRIVADO». */
  soloPrivados?: boolean;
}

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
  color?: string;
  logoUri?: string;
  /** Cabecera ya armada; si falta, se construye con los datos. */
  cabeceraHtml?: string;
  /** Página de gasoil (solo viajes personalizados). */
  gasoilHtml?: string;
  /** HTML de la página final: resumen por tipo de vehículo. */
  resumenTiposHtml?: string;
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
    color,
    logoUri,
    cabeceraHtml = '',
    gasoilHtml = '',
    resumenTiposHtml = '',
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

  const pie = '';

  // Cabecera repetida en la página de gasoil y en la del resumen por tipo.
  const cabecera = cabeceraHtml || `
        <div class="header-container">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <div class="slogan">Sin pausa, sin excusas, sin limites</div>
          <div class="titulo-reporte">REPORTE VIAJES DESDE EL ${rangoFechas}</div>
          <div class="nombre-empresa">${escapar(nombreEmpresa)}</div>
          ${direccionEmpresa ? `<div class="direccion-empresa">${escapar(direccionEmpresa)}</div>` : ''}
        </div>`;

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
            max-width: 200px;
            height: auto;
            margin-bottom: 0;
          }
          .slogan {
            font-size: 10px;
            color: #111827;
            font-weight: 500;
            margin-bottom: 7px;
          }
          .titulo-reporte {
            font-size: 15px;
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
            font-size: 18px;
            font-weight: bold;
            padding: 8px 18px;
            margin: 0 3px;
          }
          .dato .k {
            color: #2f6fed;
            font-size: 11px;
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
            font-size: 7pt;
            overflow-wrap: break-word;
          }
          th {
            background-color: #26324a;
            color: #ffffff;
            font-size: 7pt;
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

          /* Página de gasoil (viajes personalizados) */
          .pagina-gasoil { page-break-before: always; break-before: page; }
          .gas-titulo {
            margin: 0 0 8px;
            font-size: 15px;
            font-weight: 800;
            color: #111827;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .tabla-gasoil { width: 100%; margin-top: 0; }
          .tabla-gasoil th, .tabla-gasoil td { font-size: 10pt; padding: 5px 6px; }
          .tabla-gasoil tr.totales td {
            background-color: #26324a;
            color: #ffffff;
            font-weight: bold;
            font-size: 10pt;
          }

          /* Página final: resumen por tipo de vehículo */
          .pagina-tipos { page-break-before: always; break-before: page; }
          .tipos-titulo {
            margin: 0 0 8px;
            font-size: 15px;
            font-weight: 800;
            color: #111827;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .tabla-tipos { width: 55%; margin-top: 0; }
          .tabla-tipos th, .tabla-tipos td { font-size: 10pt; padding: 5px 6px; }
          .tabla-tipos td.vacio {
            text-align: center;
            color: #6b7280;
            font-style: italic;
            padding: 14px;
          }
          .tabla-tipos tr.totales td {
            background-color: #26324a;
            color: #ffffff;
            font-weight: bold;
            font-size: 10pt;
          }
        </style>
      </head>
      <body>

        <!-- Cabecera en el medio de la hoja -->
        ${cabecera}

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

        ${gasoilHtml}
        ${resumenTiposHtml}

      </body>
      </html>
    `;
}

@Injectable()
export class ReporteEmpresaService {
  constructor(
    private readonly empresaRepo: EmpresaRepository,
    private readonly viajeRepo: ViajeRepository,
    private readonly tituloRepo: TituloViajeRepository,
    private readonly vehiculoRepo: VehiculoRepository,
    private readonly stockGasoil: StockGasoilService,
  ) {}

  async generarPdf(params: ParametrosReporte): Promise<Buffer> {
    const { empresaId, vehiculoId = null, desde, hasta, direccion: direccionParam, conMonto = true, sinChofer = false, color, tituloViajeId = null, soloPrivados = false } = params;

    // 1. Obtener la información de la empresa y, si es un viaje personalizado,
    //    el título que reemplaza al nombre de la empresa.
    const empresa = Number.isFinite(empresaId) && empresaId > 0
      ? await this.empresaRepo.findById(empresaId)
      : null;
    const titulo = tituloViajeId != null ? await this.tituloRepo.findById(tituloViajeId) : null;
    const nombreEmpresa = titulo?.nombre ?? empresa?.nombre ?? 'TODAS LAS EMPRESAS';
    // Personalizado sin empresa filtrada: no se imprime dirección.
    const direccionEmpresa = titulo
      ? (empresa?.direccion?.trim() || direccionParam || '')
      : (empresa?.direccion?.trim() ||
        direccionParam ||
        'Zona Industrial Matanzas, Ciudad Guayana, Estado Bolívar');

    // 2. Intervalo dinámico de fechas
    const rangoFechas = formatearRangoFechas(desde, hasta);

    // 3. Viajes del intervalo/empresa/vehículo (mismo filtro que el listado de la
    //    app), siempre de la fecha más antigua a la más reciente.
    //    En el reporte de privados se buscan los vehículos en cada pedido para
    //    incluir los recién registrados.
    let vehiculosPrivados: number[] = [];
    let viajes: Viaje[];
    if (soloPrivados) {
      vehiculosPrivados = (await this.vehiculoRepo.vehiculosPrivados()).map((v) => v.id);
      viajes = ordenarPorFechaAscendente(
        await this.viajeRepo.buscarPorVehiculos(vehiculosPrivados, empresaId, desde, hasta),
      );
    } else {
      viajes = ordenarPorFechaAscendente(
        await this.consultar(empresaId, vehiculoId, desde, hasta, tituloViajeId),
      );
    }

    // 4. Logo en Base64
    const logoUri = this.obtenerLogoDataUri();

    // Cabecera reutilizada en la página de gasoil y en el resumen por tipo.
    const cabeceraHtml = `
        <div class="header-container">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <div class="slogan">Sin pausa, sin excusas, sin limites</div>
          <div class="titulo-reporte">REPORTE VIAJES ${soloPrivados ? 'PRIVADOS ' : ''}DESDE EL ${rangoFechas}</div>
          <div class="nombre-empresa">${escapar(nombreEmpresa)}</div>
          ${direccionEmpresa ? `<div class="direccion-empresa">${escapar(direccionEmpresa)}</div>` : ''}
        </div>`;

    // Solo los viajes personalizados y los de privados llevan página de gasoil.
    let gasoilHtml = '';
    if (soloPrivados) {
      const resumenGasoil = await this.stockGasoil.resumenPorVehiculos(
        vehiculosPrivados,
        empresaId,
        desde,
        hasta,
      );
      gasoilHtml = htmlResumenGasoil(resumenGasoil, cabeceraHtml, 'vehículos privados');
    } else if (titulo != null && tituloViajeId != null) {
      const resumenGasoil = await this.stockGasoil.resumenPorTitulo(tituloViajeId);
      gasoilHtml = htmlResumenGasoil(resumenGasoil, cabeceraHtml, titulo.nombre);
    }

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
      color,
      logoUri,
      cabeceraHtml,
      gasoilHtml,
      resumenTiposHtml: htmlResumenTipos(viajes, color ?? '#8c3b87', conMonto, cabeceraHtml),
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
  private consultar(
    empresaId: number,
    vehiculoId?: number | null,
    desde?: string,
    hasta?: string,
    tituloViajeId?: number | null,
  ): Promise<Viaje[]> {
    const conEmpresa = Number.isFinite(empresaId) && empresaId > 0;
    return this.viajeRepo.buscar(
      conEmpresa ? empresaId : null,
      vehiculoId ?? null,
      desde,
      hasta,
      tituloViajeId ?? null,
    );
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

  private obtenerLogoDataUri(): string {
    const logoPath = join(process.cwd(), 'assets', 'logo.jpg');
    if (existsSync(logoPath)) {
      const buffer = readFileSync(logoPath);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }
    return '';
  }
}
