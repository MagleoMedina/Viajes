import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { lanzarChrome } from '../common/chromium';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Viaje } from '../domain/viaje.entity';
import { ViajeRepository } from '../repo/viaje.repository';
import { EmpresaRepository } from '../repo/empresa.repository';
import { TituloViajeRepository } from '../repo/titulo-viaje.repository';
import { VehiculoRepository } from '../repo/vehiculo.repository';
import { ResumenGasoil, StockGasoilService } from './stock-gasoil.service';
import { formatearRangoFechas, money, ordenarPorFechaAscendente, round2 } from '../common/dates';
import { ApiException } from '../web/api-exception';

// Se reexporta para los tests del orden del PDF.
export { ordenarPorFechaAscendente };

const COLUMNAS = [
  'FECHA INICIO',
  'FECHA FIN',
  'EMPRESA',
  'CHOFER',
  'CARGA',
  'PUNTO SALIDA',
  'PUNTO LLEGADA',
  'MONTO VIAJE $',
  'COMBUSTIBLE',
  'VIATICOS',
  'PEAJES',
  'PAGO CHOFER',
  'LITROS',
  'GASTOS VARIOS',
  'TOTAL BS',
  'TASA',
  'TOTAL $',
];

const ASSETS = join(process.cwd(), 'assets');
const LOGO_PATH = join(ASSETS, 'logo.jpg');
const LOGO_BUFFER = existsSync(LOGO_PATH) ? readFileSync(LOGO_PATH) : Buffer.from([]);
const LOGO_URI = LOGO_BUFFER.length > 0 ? `data:image/jpeg;base64,${LOGO_BUFFER.toString('base64')}` : '';

// Fuentes DejaVu para mantener tipografía idéntica a Java
const FUENTE_PATH = join(ASSETS, 'fonts', 'DejaVuSans.ttf');
const FUENTE_BOLD_PATH = join(ASSETS, 'fonts', 'DejaVuSans-Bold.ttf');
const FUENTE_BASE64 = existsSync(FUENTE_PATH) ? readFileSync(FUENTE_PATH).toString('base64') : null;
const FUENTE_BOLD_BASE64 = existsSync(FUENTE_BOLD_PATH) ? readFileSync(FUENTE_BOLD_PATH).toString('base64') : null;

const fmtFecha = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dateObj.getUTCDate())}/${pad(dateObj.getUTCMonth() + 1)}/${dateObj.getUTCFullYear()}`;
};

const enUsd = (valor: number | null | undefined, tasa?: number): number => {
  const bs = valor ?? 0;
  if (!tasa || tasa === 0) return 0;
  return round2(bs / tasa);
};

const nulo = (v: number | null | undefined) => v ?? 0;

const dualValores = (valor: number, usd: number) =>
  `Bs ${money(valor)} / $ ${money(usd)}`;

const dual = (valor?: number | null, tasa?: number) =>
  dualValores(nulo(valor), enUsd(valor, tasa));

const dolar = (valor: number | null | undefined) => `$ ${money(nulo(valor))}`;

/** Formato dual con <br/> para las celdas compactas del PDF */
const dualPdf = (valor?: number | null, tasa?: number) =>
  dualValoresPdf(nulo(valor), enUsd(valor, tasa));

const dualValoresPdf = (valor: number, usd: number) =>
  `Bs ${money(valor)}<br/>$ ${money(usd)}`;

const esc = (valor: string | null | undefined): string => {
  if (!valor) return '';
  return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const nombreChofer = (v: Viaje) => `${v.chofer?.nombre ?? ''} ${v.chofer?.apellido ?? ''}`.trim();
const nombreEmpresa = (v: Viaje) => (v.empresa ? v.empresa.nombre : 'Sin empresa');
const sumaGastos = (v: Viaje) => (v.gastos ?? []).reduce((acc, g) => acc + nulo(g.monto), 0);

const marca = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

const sumarViajes = (viajes: Viaje[]): Sumas => {
  const sumas = new Sumas();
  for (const v of viajes) sumas.sumar(v);
  return sumas;
};

export interface OpcionesViajes {
  empresaId?: number | null;
  empresaNombre?: string | null;
  /** Vehículo filtrado: se muestra como chip junto al de la empresa. */
  vehiculoNombre?: string | null;
  /** Viaje personalizado: el título se muestra como H1 del documento. */
  tituloPersonalizado?: string | null;
  /** Viajes personalizados: se omite la columna VIATICOS (no se registra). */
  sinViaticos?: boolean;
  /** Cabecera centrada estilo «reporte con monto» (logo, rango y nombre grande). */
  cabeceraReporte?: boolean;
  /** Dirección de la empresa filtrada; vacío = no se imprime la línea. */
  empresaDireccion?: string | null;
  desde?: string;
  hasta?: string;
  color?: string;
  /** Resumen de gasoil (comprado vs usado) por vehículo y total. */
  resumen?: ResumenGasoil;
}

/** Fila del cuadro por tipo de vehículo. */
export interface FilaTipoVehiculo {
  tipo: string;
  cantidad: number;
  monto: number;
}

/**
 * Agrupa viajes por TIPO de vehículo: cantidad de viajes y suma de MONTO
 * VIAJE $ (bruto, sin descontar gastos). Sin vehículo -> «Sin vehículo»;
 * vehículo sin tipo -> «Sin tipo».
 */
export function resumirTipos(viajes: Viaje[]): FilaTipoVehiculo[] {
  const grupos = new Map<string, FilaTipoVehiculo>();
  for (const v of viajes) {
    const tipo = v.vehiculo
      ? (v.vehiculo.tipo?.trim() || 'Sin tipo')
      : 'Sin vehículo';
    const fila = grupos.get(tipo) ?? { tipo, cantidad: 0, monto: 0 };
    fila.cantidad += 1;
    fila.monto += nulo(v.montoViaje);
    grupos.set(tipo, fila);
  }
  const especiales = new Set(['Sin tipo', 'Sin vehículo']);
  return [...grupos.values()].sort((a, b) => {
    const ea = especiales.has(a.tipo) ? 1 : 0;
    const eb = especiales.has(b.tipo) ? 1 : 0;
    if (ea !== eb) return ea - eb;
    return a.tipo.localeCompare(b.tipo, 'es');
  });
}

/**
 * Página aparte al final de todos los PDF del módulo: resumen por tipo de
 * vehículo (viajes y $) con fila TOTAL. `conMonto: false` omite la columna
 * de dinero: sirve al reporte «sin montos», que no debe mostrar importes.
 */
export function htmlResumenTipos(
  viajes: Viaje[],
  color = '#26324a',
  conMonto = true,
  cabeceraHtml = '',
): string {
  const filas = resumirTipos(viajes);
  const totalCantidad = filas.reduce((s, f) => s + f.cantidad, 0);
  const totalMonto = filas.reduce((s, f) => s + f.monto, 0);
  const celdaMonto = (valor: string) => (conMonto ? `<td class="num">${valor}</td>` : '');
  const cuerpo = filas
    .map(
      (f, i) => `
        <tr${i % 2 === 0 ? '' : ' class="par"'}>
          <td>${esc(f.tipo)}</td>
          <td class="num">${f.cantidad}</td>${celdaMonto(dolar(f.monto))}
        </tr>`,
    )
    .join('');
  const columnas = conMonto ? 3 : 2;
  return `
      <div class="pagina-tipos">
      ${cabeceraHtml}
      <div class="tipos-titulo">Resumen por tipo de vehículo</div>
      <table class="tabla-tipos">
        <thead>
          <tr>
            <th>TIPO DE VEHÍCULO</th>
            <th class="num">VIAJES</th>${conMonto ? '<th class="num">MONTO VIAJE $</th>' : ''}
          </tr>
        </thead>
        <tbody>${cuerpo || `<tr><td colspan="${columnas}" class="vacio">Sin viajes.</td></tr>`}</tbody>
        <tfoot>
          <tr class="totales">
            <td>TOTAL</td>
            <td class="num">${totalCantidad}</td>${celdaMonto(dolar(totalMonto))}
          </tr>
        </tfoot>
      </table>
      </div>`;
}

/** Bloque «Resumen de gasoil» del PDF: por vehículo + fila TOTAL. */
export function htmlResumenGasoil(
  resumen: ResumenGasoil,
  cabeceraHtml = '',
  etiqueta = 'todos los vehículos',
): string {
  const bs = (valor: number) => `Bs ${money(valor)}`;
  const filas = resumen.filas
    .map(
      (f, i) => `
        <tr${i % 2 === 0 ? '' : ' class="par"'}>
          <td>${esc(f.placa)}</td>
          <td class="num">${money(f.comprado)}</td>
          <td class="num">${dolar(f.compradoUsd)}</td>
          <td class="num">${bs(f.compradoBs)}</td>
          <td class="num">${money(f.usado)}</td>
          <td class="num">${bs(f.usadoBs)}</td>
        </tr>`,
    )
    .join('');
  const t = resumen.total;
  return `
      <div class="pagina-gasoil">
      ${cabeceraHtml}
      <div class="gas-titulo">Resumen de gasoil — ${esc(etiqueta)}</div>
      <table class="tabla-gasoil">
        <thead>
          <tr>
            <th>VEHÍCULO</th>
            <th>GASOIL COMPRADO (L)</th>
            <th>COMPRADO $</th>
            <th>COMPRADO Bs</th>
            <th>GASOIL USADO (L)</th>
            <th>USADO Bs (combustible)</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr class="totales">
            <td>TOTAL</td>
            <td class="num">${money(t.comprado)}</td>
            <td class="num">${dolar(t.compradoUsd)}</td>
            <td class="num">${bs(t.compradoBs)}</td>
            <td class="num">${money(t.usado)}</td>
            <td class="num">${bs(t.usadoBs)}</td>
          </tr>
        </tfoot>
      </table>
      </div>`;
}

/** Construye el HTML del listado de viajes (función pura, testeable). */
export function htmlViajes(viajes: Viaje[], opts: OpcionesViajes = {}): string {
  const {
    empresaNombre = null,
    vehiculoNombre = null,
    tituloPersonalizado = null,
    sinViaticos = false,
    cabeceraReporte = false,
    empresaDireccion = null,
    desde,
    hasta,
    color = '#26324a',
  } = opts;
  const sumas = sumarViajes(viajes);
  const columnas = sinViaticos ? COLUMNAS.filter((c) => c !== 'VIATICOS') : COLUMNAS;
  const titulo =
    tituloPersonalizado != null
      ? esc(tituloPersonalizado)
      : empresaNombre == null
        ? 'TODAS LAS EMPRESAS'
        : esc(empresaNombre);
  const empresaBox =
    empresaNombre == null || cabeceraReporte
      ? ''
      : `<span class="dato"><span class="k">EMPRESA</span>${esc(empresaNombre)}</span>`;
  const vehiculoBox =
    vehiculoNombre == null
      ? ''
      : `<span class="dato"><span class="k">VEHÍCULO</span>${esc(vehiculoNombre)}</span>`;
  const cantidad = viajes.length;
  // Cabecera común: se repite en la página del listado y en las páginas de
  // gasoil y resumen por tipo.
  const cabeceraHtml = cabeceraReporte
    ? `<div class="cab-reporte">
          ${LOGO_URI ? `<img class="logo-centrado" src="${LOGO_URI}" alt="Logo" />` : ''}
          <div class="slogan">Sin pausa, sin excusas, sin limites</div>
          <div class="titulo-reporte">REPORTE VIAJES DESDE EL ${formatearRangoFechas(desde, hasta)}</div>
          <div class="nombre-empresa">${titulo}</div>
          ${empresaDireccion ? `<div class="direccion-empresa">${esc(empresaDireccion)}</div>` : ''}
        </div>`
    : `<div class="cab">
          ${LOGO_URI ? `<img class="logo" src="${LOGO_URI}" alt="Logo" />` : ''}
          <div class="cab-texto">
            <h1>${titulo}</h1>
            <div class="rango">Histórico de viajes</div>
          </div>
        </div>`;

  let cuerpoHtml = '';
  viajes.forEach((v, indice) => {
    const claseTr = indice % 2 === 0 ? '' : ' class="par"';
    const celdaViaticos = sinViaticos
      ? ''
      : `
          <td class="num">${dualPdf(v.viaticos, v.tasa)}</td>`;
    cuerpoHtml += `
        <tr${claseTr}>
          <td>${fmtFecha(v.fechaInicio)}</td>
          <td>${fmtFecha(v.fechaFin)}</td>
          <td>${esc(nombreEmpresa(v))}</td>
          <td>${esc(nombreChofer(v))}</td>
          <td>${esc(v.carga ?? '')}</td>
          <td>${esc(v.puntoSalida?.nombre ?? '')}</td>
          <td>${esc(v.puntoLlegada?.nombre ?? '')}</td>
          <td class="num">${dolar(v.montoViaje)}</td>
          <td class="num">${dualPdf(v.combustible, v.tasa)}</td>${celdaViaticos}
          <td class="num">${dualPdf(v.peajes, v.tasa)}</td>
          <td class="num">${dualPdf(v.pagoChofer, v.tasa)}</td>
          <td class="num">${money(nulo(v.litros))}</td>
          <td class="num">${dualPdf(sumaGastos(v), v.tasa)}</td>
          <td class="num">${dualPdf(v.totalBs, v.tasa)}</td>
          <td class="num">${money(nulo(v.tasa))}</td>
          <td class="num">${dolar(v.totalUsd)}</td>
        </tr>`;
  });

  // Fila de totales acumulados
  const celdaViaticosTotales = sinViaticos
    ? ''
    : `
        <td class="num">${dualValoresPdf(sumas.viaticos, sumas.viaticosUsd)}</td>`;
  cuerpoHtml += `
      <tr class="totales">
        <td colspan="7"></td>
        <td class="num">${dolar(sumas.monto)}</td>
        <td class="num">${dualValoresPdf(sumas.combustible, sumas.combustibleUsd)}</td>${celdaViaticosTotales}
        <td class="num">${dualValoresPdf(sumas.peajes, sumas.peajesUsd)}</td>
        <td class="num">${dualValoresPdf(sumas.pagoChofer, sumas.pagoChoferUsd)}</td>
        <td class="num">${money(sumas.litros)}</td>
        <td class="num">${dualValoresPdf(sumas.gastos, sumas.gastosUsd)}</td>
        <td class="num">${dualValoresPdf(sumas.totalBs, sumas.totalBsUsd)}</td>
        <td class="num"></td>
        <td class="num"></td>
      </tr>`;

  // Fila final de SUMA TOTAL $
  cuerpoHtml += `
      <tr class="suma">
        <td colspan="${columnas.length - 1}" class="etiqueta">SUMA TOTAL $</td>
        <td class="num">${dolar(sumas.totalUsd)}</td>
      </tr>`;

  // Sin ancho fijo por columna: table-layout auto (ver CSS) reparte el ancho
  // segun el contenido de cada celda.
  const thsHtml = columnas.map((col) => `<th>${col}</th>`).join('');
  const pieTexto = `Generado el ${marca()} - ${cantidad} ${cantidad === 1 ? 'viaje' : 'viajes'}`;

  const fontStyles = `
      ${FUENTE_BASE64 ? `
        @font-face {
          font-family: 'DejaVu Sans';
          font-weight: 400;
          font-style: normal;
          src: url(data:font/truetype;charset=utf-8;base64,${FUENTE_BASE64}) format('truetype');
        }
      ` : ''}
      ${FUENTE_BOLD_BASE64 ? `
        @font-face {
          font-family: 'DejaVu Sans';
          font-weight: 700;
          font-style: normal;
          src: url(data:font/truetype;charset=utf-8;base64,${FUENTE_BOLD_BASE64}) format('truetype');
        }
      ` : ''}
    `;

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          ${fontStyles}
          @page { size: letter landscape; margin: 8mm; }
          /* Tabla con sus tamaños originales; el bloque de filtros
             (chips .dato) crece 4pt en cada página del documento. */
          body { font-family: 'DejaVu Sans', sans-serif; font-size: 7px; color: #1f2937; margin: 0; padding: 0; }
          .cab { margin-bottom: 6px; }
          .logo { height: 48px; vertical-align: middle; }
          .cab-texto { display: inline-block; vertical-align: middle; margin-left: 8px; }
          h1 { font-size: 15px; margin: 0 0 2px; color: ${color}; font-family: 'DejaVu Sans', sans-serif; }
          .rango { color: #6b7280; font-size: 8.5px; }
          /* Cabecera centrada, igual que el reporte por empresa. */
          .cab-reporte { text-align: center; margin-bottom: 10px; }
          .cab-reporte .logo-centrado { display: block; margin: 0 auto; height: 56px; }
          .cab-reporte .slogan { font-size: 8.5px; color: #111827; font-weight: 500; margin-bottom: 4px; }
          .cab-reporte .titulo-reporte { font-size: 12px; font-weight: 800; color: #111827;
                  letter-spacing: 0.5px; margin: 0 0 3px; text-transform: uppercase; }
          .cab-reporte .nombre-empresa { font-size: 13px; font-weight: 900; color: ${color};
                  letter-spacing: 0.8px; margin: 0 0 3px; text-transform: uppercase; }
          .cab-reporte .direccion-empresa { font-size: 7.5px; color: #4b5563; margin: 0; }
          .resumen { margin: 0 0 8px; }
          /* Fila de filtros dentro del thead: sin bordes, solo espaciado. */
          thead tr:first-child td { border: none; background: transparent; padding: 0; font-size: 7px; }
          .dato { display: inline-block; border: 1px solid #2f6fed; background: #eef3fb;
                  color: #26324a; font-size: 16.5px; font-weight: bold; padding: 4px 10px; margin-right: 6px; }
          .dato .k { color: #2f6fed; font-size: 14px; margin-right: 5px; }
          table { width: auto; border-collapse: collapse; table-layout: auto; }
          th, td { border: 1px solid #c9d2e0; padding: 2px 3px; overflow-wrap: break-word; }
          th { background: #26324a; color: #ffffff; font-size: 6.5px; text-align: left; }
          thead { display: table-header-group; }
          tbody tr { page-break-inside: avoid; }
          td { font-size: 7px; }
          td.num { text-align: right; white-space: nowrap; }
          tbody tr.par td { background: #f4f6fa; }
          tr.totales td { background: #dde6f5; font-weight: bold; border-top: 2px solid #26324a; }
          tr.suma td { background: #2f6fed; color: #ffffff; font-weight: bold; }
          tr.suma td.etiqueta { text-align: right; }
          /* Resumen de gasoil: ocupa una página propia, en grande. */
          .pagina-gasoil { page-break-before: always; break-before: page; }
          .gas-titulo { margin: 0 0 8px; font-size: 16px; font-weight: bold; color: ${color}; }
          .tabla-gasoil { width: 100%; margin-bottom: 6px; }
          .tabla-gasoil th, .tabla-gasoil td { font-size: 12px; padding: 6px 8px; }
          .tabla-gasoil th { font-size: 11px; }
          .tabla-gasoil tr.totales td { font-size: 12px; }
          /* Resumen por tipo de vehículo: página propia al final del documento. */
          .pagina-tipos { page-break-before: always; break-before: page; }
          .tipos-titulo { margin: 0 0 8px; font-size: 16px; font-weight: bold; color: ${color}; }
          .tabla-tipos { width: 55%; margin-bottom: 6px; }
          .tabla-tipos th, .tabla-tipos td { font-size: 12px; padding: 6px 8px; }
          .tabla-tipos th { font-size: 11px; }
          .tabla-tipos td.vacio { text-align: center; color: #6b7280; font-style: italic; padding: 14px; }
          .tabla-tipos tr.totales td { font-size: 12px; }
          .pie { margin-top: 8px; color: #6b7280; font-size: 7.5px; }
        </style>
      </head>
      <body>
        ${cabeceraHtml}
        <table>
          <thead>
            <!-- Filtros arriba de la tabla: se repite en cada página. -->
            <tr><td colspan="${columnas.length}"><div class="resumen">
              <span class="dato"><span class="k">VIAJES</span>${cantidad}</span>
              ${empresaBox}
              ${vehiculoBox}
            </div></td></tr>
            <tr>${thsHtml}</tr>
          </thead>
          <tbody>${cuerpoHtml}</tbody>
        </table>
        ${opts.resumen ? htmlResumenGasoil(opts.resumen, cabeceraHtml, tituloPersonalizado ?? 'todos los vehículos') : ''}
        ${htmlResumenTipos(viajes, color, true, cabeceraHtml)}
        <div class="pie">${pieTexto}</div>
      </body>
      </html>
    `;
}

/* ----------------------------- PDF ----------------------------- */

@Injectable()
export class ExportService {
  constructor(
    private readonly repo: ViajeRepository,
    private readonly empresas: EmpresaRepository,
    private readonly vehiculos: VehiculoRepository,
    private readonly titulos: TituloViajeRepository,
    private readonly stockGasoil: StockGasoilService,
  ) {}

  /* ----------------------------- EXCEL ----------------------------- */

  crearXlsx(
    empresaId: number | null,
    vehiculoId: number | null,
    desde?: string,
    hasta?: string,
  ): Promise<Buffer> {
    return this.repo.buscar(empresaId, vehiculoId, desde, hasta).then((viajes) => {
      const sumas = sumarViajes(viajes);
      const wb = new ExcelJS.Workbook();
      const hoja = wb.addWorksheet('Viajes');

      if (LOGO_BUFFER.length > 0) {
        const imageId = wb.addImage({ buffer: LOGO_BUFFER as any, extension: 'jpeg' });
        hoja.addImage(imageId, { tl: { col: 0, row: 0.3 }, ext: { width: 150, height: 40 } });
      }

      for (let i = 1; i <= 3; i++) {
        hoja.getRow(i).height = 18;
      }

      const cabecera = hoja.getRow(4);
      COLUMNAS.forEach((nombre, i) => {
        const celda = cabecera.getCell(i + 1);
        celda.value = nombre;
        celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4169E1' } };
        celda.alignment = { horizontal: 'center' };
        this.bordes(celda);
      });

      let numeroFila = 5;
      for (const v of viajes) {
        const fila = hoja.getRow(numeroFila++);
        fila.getCell(1).value = fmtFecha(v.fechaInicio);
        fila.getCell(2).value = fmtFecha(v.fechaFin);
        fila.getCell(3).value = nombreEmpresa(v);
        fila.getCell(4).value = nombreChofer(v);
        fila.getCell(5).value = v.carga ?? '';
        fila.getCell(6).value = v.puntoSalida?.nombre ?? '';
        fila.getCell(7).value = v.puntoLlegada?.nombre ?? '';
        this.numero(fila.getCell(8), v.montoViaje);
        fila.getCell(9).value = dual(v.combustible, v.tasa);
        fila.getCell(10).value = dual(v.viaticos, v.tasa);
        fila.getCell(11).value = dual(v.peajes, v.tasa);
        fila.getCell(12).value = dual(v.pagoChofer, v.tasa);
        this.numero(fila.getCell(13), v.litros);
        fila.getCell(14).value = dual(sumaGastos(v), v.tasa);
        fila.getCell(15).value = dual(v.totalBs, v.tasa);
        this.numero(fila.getCell(16), v.tasa);
        this.numero(fila.getCell(17), v.totalUsd);
      }

      const totales = hoja.getRow(numeroFila++);
      for (let i = 1; i <= 17; i++) this.relleno(totales.getCell(i), 'FFDDE6F5');
      this.texto(totales.getCell(8), dolar(sumas.monto));
      this.texto(totales.getCell(9), dualValores(sumas.combustible, sumas.combustibleUsd));
      this.texto(totales.getCell(10), dualValores(sumas.viaticos, sumas.viaticosUsd));
      this.texto(totales.getCell(11), dualValores(sumas.peajes, sumas.peajesUsd));
      this.texto(totales.getCell(12), dualValores(sumas.pagoChofer, sumas.pagoChoferUsd));
      this.numero(totales.getCell(13), sumas.litros);
      this.texto(totales.getCell(14), dualValores(sumas.gastos, sumas.gastosUsd));
      this.texto(totales.getCell(15), dualValores(sumas.totalBs, sumas.totalBsUsd));

      const suma = hoja.getRow(numeroFila);
      for (let i = 1; i <= 17; i++) this.relleno(suma.getCell(i), 'FF2F6FED');
      this.texto(suma.getCell(16), 'SUMA TOTAL $');
      this.numero(suma.getCell(17), sumas.totalUsd);

      const anchos = [13, 13, 22, 22, 24, 18, 18, 14, 20, 20, 20, 22, 10, 22, 26, 11, 13];
      hoja.columns.forEach((col, i) => {
        if (col) col.width = anchos[i];
      });

      return wb.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
    });
  }

  /* ----------------------------- PDF ----------------------------- */

  async crearPdf(
    empresaId: number | null,
    vehiculoId: number | null,
    desde?: string,
    hasta?: string,
    colorTitulo = '#26324a',
  ): Promise<Buffer> {
    const viajes = ordenarPorFechaAscendente(
      await this.repo.buscar(empresaId, vehiculoId, desde, hasta),
    );
    const empresa = empresaId != null ? await this.empresas.findById(empresaId) : null;
    const empresaNombre = empresaId != null ? (empresa?.nombre ?? '¿?') : null;
    const empresaDireccion = empresa?.direccion?.trim() || null;
    const vehiculoNombre = vehiculoId != null ? await this.nombreVehiculo(vehiculoId) : null;
    const resumen = await this.stockGasoil.resumen();
    const htmlContent = htmlViajes(viajes, {
      empresaId,
      empresaNombre,
      empresaDireccion,
      cabeceraReporte: true,
      vehiculoNombre,
      desde,
      hasta,
      color: colorTitulo,
      resumen,
    });

    const browser = await lanzarChrome();

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'load' });
      const pdfUint8 = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
      });
      return Buffer.from(pdfUint8);
    } finally {
      await browser.close();
    }
  }

  /**
   * PDF de viajes personalizados: el título elegido es el H1 del documento y
   * no se muestra la columna VIATICOS (el formulario no la registra).
   */
  async crearPdfPersonalizado(
    tituloId: number,
    empresaId: number | null,
    vehiculoId: number | null,
    desde?: string,
    hasta?: string,
    colorTitulo = '#26324a',
  ): Promise<Buffer> {
    const titulo = await this.titulos.findById(tituloId);
    if (!titulo) throw new ApiException(404, 'Título de viaje no encontrado');
    const viajes = ordenarPorFechaAscendente(
      await this.repo.buscar(empresaId, vehiculoId, desde, hasta, tituloId),
    );
    const empresa = empresaId != null ? await this.empresas.findById(empresaId) : null;
    const empresaNombre = empresaId != null ? (empresa?.nombre ?? '¿?') : null;
    const empresaDireccion = empresa?.direccion?.trim() || null;
    const vehiculoNombre = vehiculoId != null ? await this.nombreVehiculo(vehiculoId) : null;
    // Gasoil del título: solo los viajes de este viaje personalizado.
    const resumen = await this.stockGasoil.resumenPorTitulo(tituloId);
    const htmlContent = htmlViajes(viajes, {
      empresaId,
      empresaNombre,
      empresaDireccion,
      cabeceraReporte: true,
      vehiculoNombre,
      tituloPersonalizado: titulo.nombre,
      sinViaticos: true,
      desde,
      hasta,
      color: colorTitulo,
      resumen,
    });

    const browser = await lanzarChrome();

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'load' });
      const pdfUint8 = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
      });
      return Buffer.from(pdfUint8);
    } finally {
      await browser.close();
    }
  }

  /* ----------------------------- HELPERS DE EXCEL ----------------------------- */

  /** "Toyota Hilux (AB123)" para el chip del vehículo filtrado. */
  private async nombreVehiculo(vehiculoId: number): Promise<string | null> {
    const v = await this.vehiculos.findById(vehiculoId);
    if (!v) return null;
    const partes = [v.marca, v.modelo].filter((x) => x && x.trim()).join(' ').trim();
    const placa = v.placa?.trim();
    if (partes && placa) return `${partes} (${placa})`;
    return partes || placa || null;
  }

  private numero(celda: ExcelJS.Cell, valor?: number | null) {
    celda.value = nulo(valor);
    celda.alignment = { horizontal: 'right' };
  }

  private texto(celda: ExcelJS.Cell, valor: string) {
    celda.value = valor;
  }

  private bordes(celda: ExcelJS.Cell) {
    celda.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  private relleno(celda: ExcelJS.Cell, color: string) {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    celda.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  }
}

/** Sumatoria vertical idéntica a Java */
class Sumas {
  monto = 0;
  combustible = 0;
  viaticos = 0;
  peajes = 0;
  pagoChofer = 0;
  gastos = 0;
  litros = 0;
  totalBs = 0;

  combustibleUsd = 0;
  viaticosUsd = 0;
  peajesUsd = 0;
  pagoChoferUsd = 0;
  gastosUsd = 0;
  totalBsUsd = 0;

  totalUsd = 0;

  sumar(v: Viaje) {
    const tasa = nulo(v.tasa);
    const gastosVarios = sumaGastos(v);
    this.monto += nulo(v.montoViaje);
    this.combustible += nulo(v.combustible);
    this.viaticos += nulo(v.viaticos);
    this.peajes += nulo(v.peajes);
    this.pagoChofer += nulo(v.pagoChofer);
    this.gastos += gastosVarios;
    this.litros += nulo(v.litros);
    this.totalBs += nulo(v.totalBs);

    this.combustibleUsd += enUsd(v.combustible, tasa);
    this.viaticosUsd += enUsd(v.viaticos, tasa);
    this.peajesUsd += enUsd(v.peajes, tasa);
    this.pagoChoferUsd += enUsd(v.pagoChofer, tasa);
    this.gastosUsd += enUsd(gastosVarios, tasa);
    this.totalBsUsd += enUsd(v.totalBs, tasa);

    this.totalUsd += nulo(v.totalUsd);
  }
}
