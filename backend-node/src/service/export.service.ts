import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Viaje } from '../domain/viaje.entity';
import { ViajeRepository } from '../repo/viaje.repository';
import { EmpresaRepository } from '../repo/empresa.repository';
import { money, toIsoDate, round2 } from '../common/dates';

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
  'GASTOS VARIOS',
  'TOTAL BS',
  'TASA',
  'TOTAL $',
];

/** Indices de las columnas en Bs que se muestran tambien convertidas a $. */
const COL_MONTO = 7;
const COL_GASTOS = 12;
const COL_TOTAL_BS = 13;
const COL_TASA = 14;
const COL_TOTAL_USD = 15;

const ASSETS = join(process.cwd(), 'assets');
const LOGO = readFileSync(join(ASSETS, 'logo.jpg'));
const FUENTE = join(ASSETS, 'fonts', 'DejaVuSans.ttf');
const FUENTE_BOLD = join(ASSETS, 'fonts', 'DejaVuSans-Bold.ttf');

const fmtFecha = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};

const enUsd = (valor: number | null | undefined, tasa?: number): number => {
  const bs = valor ?? 0;
  if (!tasa) return 0;
  return round2(bs / tasa);
};

const nulo = (v: number | null | undefined) => v ?? 0;

const dualValores = (valor: number, usd: number) =>
  `Bs ${money(valor)} / $ ${money(usd)}`;
const dual = (valor?: number | null, tasa?: number) =>
  dualValores(nulo(valor), enUsd(valor, tasa));
const dolar = (valor: number) => `$ ${money(valor)}`;

@Injectable()
export class ExportService {
  constructor(
    private readonly repo: ViajeRepository,
    private readonly empresas: EmpresaRepository,
  ) {}

  crearXlsx(empresaId: number | null, desde?: string, hasta?: string): Promise<Buffer> {
    return this.buscar(empresaId, desde, hasta).then((viajes) => {
      const sumas = this.sumar(viajes);
      const wb = new ExcelJS.Workbook();
      const hoja = wb.addWorksheet('Viajes');

      const imageId = wb.addImage({ buffer: LOGO as any, extension: 'jpeg' });
      hoja.addImage(imageId, { tl: { col: 0, row: 0.3 }, ext: { width: 150, height: 40 } });
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
        bordes(celda);
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
        numero(fila.getCell(8), v.montoViaje);
        fila.getCell(9).value = dual(v.combustible, v.tasa);
        fila.getCell(10).value = dual(v.viaticos, v.tasa);
        fila.getCell(11).value = dual(v.peajes, v.tasa);
        fila.getCell(12).value = dual(v.pagoChofer, v.tasa);
        fila.getCell(13).value = dual(sumaGastos(v), v.tasa);
        fila.getCell(14).value = dual(v.totalBs, v.tasa);
        numero(fila.getCell(15), v.tasa);
        numero(fila.getCell(16), v.totalUsd);
      }

      const totales = hoja.getRow(numeroFila++);
      for (let i = 1; i <= 16; i++) relleno(totales.getCell(i), 'FFDDE6F5');
      texto(totales.getCell(8), dolar(sumas.monto));
      texto(totales.getCell(9), dualValores(sumas.combustible, sumas.combustibleUsd));
      texto(totales.getCell(10), dualValores(sumas.viaticos, sumas.viaticosUsd));
      texto(totales.getCell(11), dualValores(sumas.peajes, sumas.peajesUsd));
      texto(totales.getCell(12), dualValores(sumas.pagoChofer, sumas.pagoChoferUsd));
      texto(totales.getCell(13), dualValores(sumas.gastos, sumas.gastosUsd));
      texto(totales.getCell(14), dualValores(sumas.totalBs, sumas.totalBsUsd));

      const suma = hoja.getRow(numeroFila);
      for (let i = 1; i <= 14; i++) relleno(suma.getCell(i), 'FF2F6FED');
      relleno(suma.getCell(15), 'FF2F6FED');
      relleno(suma.getCell(16), 'FF2F6FED');
      texto(suma.getCell(15), 'SUMA TOTAL $');
      numero(suma.getCell(16), sumas.totalUsd);

      const anchos = [13, 13, 22, 22, 24, 18, 18, 14, 26, 26, 25, 25, 26, 26, 11, 13];
      hoja.columns.forEach((col, i) => {
        if (col) col.width = anchos[i];
      });

      return wb.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
    });
  }

  async crearPdf(empresaId: number | null, desde?: string, hasta?: string): Promise<Buffer> {
    const viajes = await this.buscar(empresaId, desde, hasta);
    const sumas = this.sumar(viajes);

    const empresaNombre = empresaId != null
      ? (await this.empresas.findById(empresaId))?.nombre ?? '¿?'
      : null;
    const titulo = empresaId == null ? 'Viajes realizados' : `Viajes ${empresaNombre}`;
    const periodo = this.periodo(viajes, desde, hasta);
    const cantidad = viajes.length;

    return this.renderPdf({
      titulo,
      periodo,
      cantidad,
      empresaBox: empresaId != null ? empresaNombre! : null,
      viajes,
      sumas,
      pie: `Generado el ${marca()} - ${cantidad} ${cantidad === 1 ? 'viaje' : 'viajes'}`,
    });
  }

  /* ----------------------------- PDF ----------------------------- */

  private renderPdf(datos: {
    titulo: string;
    periodo: string;
    cantidad: number;
    empresaBox: string | null;
    viajes: Viaje[];
    sumas: Sumas;
    pie: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const {
        titulo,
        periodo,
        cantidad,
        empresaBox,
        viajes,
        sumas,
        pie,
      } = datos;
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 40,
        bufferPages: true,
      });
      doc.registerFont('DejaVu Sans', FUENTE);
      doc.registerFont('DejaVu Sans-Bold', FUENTE_BOLD);

      const chunks: Uint8Array[] = [];
      doc.on('data', (c: Uint8Array) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.image(LOGO, 40, 34, { height: 30 });
      doc.font('DejaVu Sans-Bold');
      doc.fillColor('#26324a').fontSize(15)
        .text(titulo, 40, 34);
      doc.font('DejaVu Sans').fillColor('#6b7280').fontSize(8.5)
        .text('Histórico de viajes', 40, doc.y + 2);

      let y = doc.y + 12;
      this.caja(doc, `PERIODO ${periodo}`, y);
      this.caja(doc, `VIAJES ${cantidad}`, y, 150);
      if (empresaBox) this.caja(doc, `EMPRESA ${empresaBox}`, y, 260);
      y += 26;

      const cols = [46, 46, 78, 80, 88, 52, 52, 54, 54, 50, 46, 54, 54, 52, 40, 46];
      const colX: number[] = [];
      let x = 40;
      for (const w of cols) {
        colX.push(x);
        x += w;
      }
      const totalAncho = x - 40;

      // Cabecera
      doc.font('DejaVu Sans-Bold').fontSize(6.2).fillColor('#ffffff');
      doc.rect(40, y, totalAncho, 12).fill('#26324a');
      COLUMNAS.forEach((nombre, i) => {
        doc.fillColor('#ffffff').text(nombre, colX[i] + 2, y + 2.5, {
          width: cols[i] - 2,
          lineBreak: false,
        });
      });
      y += 12;

      // Filas
      let indice = 0;
      for (const v of viajes) {
        const altoFila = 16;
        if (indice % 2 === 1) {
          doc.rect(40, y, totalAncho, altoFila).fill('#f4f6fa');
        }
        const celdas = [
          fmtFecha(v.fechaInicio),
          fmtFecha(v.fechaFin),
          nombreEmpresa(v),
          nombreChofer(v),
          v.carga ?? '',
          v.puntoSalida?.nombre ?? '',
          v.puntoLlegada?.nombre ?? '',
          dolar(nulo(v.montoViaje)),
          dualPdf(v.combustible, v.tasa),
          dualPdf(v.viaticos, v.tasa),
          dualPdf(v.peajes, v.tasa),
          dualPdf(v.pagoChofer, v.tasa),
          dualPdf(sumaGastos(v), v.tasa),
          dualPdf(v.totalBs, v.tasa),
          money(nulo(v.tasa)),
          dolar(nulo(v.totalUsd)),
        ];
        this.filaPdf(doc, celdas, colX, cols, y, false);
        y += altoFila;
        indice++;
      }

      // Totales
      const celdasTotales = [
        '', '', '', '', '', '', '',
        dolar(sumas.monto),
        dualValoresPdf(sumas.combustible, sumas.combustibleUsd),
        dualValoresPdf(sumas.viaticos, sumas.viaticosUsd),
        dualValoresPdf(sumas.peajes, sumas.peajesUsd),
        dualValoresPdf(sumas.pagoChofer, sumas.pagoChoferUsd),
        dualValoresPdf(sumas.gastos, sumas.gastosUsd),
        dualValoresPdf(sumas.totalBs, sumas.totalBsUsd),
        '', '',
      ];
      this.filaPdf(doc, celdasTotales, colX, cols, y, true, '#dde6f5');
      y += 16;

      // SUMA TOTAL $
      doc.rect(40, y, totalAncho, 16).fill('#2f6fed');
      doc.font('DejaVu Sans-Bold').fontSize(7).fillColor('#ffffff');
      doc.text('SUMA TOTAL $', 40 + totalAncho - cols[14] - cols[15] - 60, y + 4.5, {
        width: 60,
        lineBreak: false,
      });
      doc.text(dolar(sumas.totalUsd), 40 + totalAncho - cols[15] + 2, y + 4.5, {
        width: cols[15] - 2,
        lineBreak: false,
      });

      doc.font('DejaVu Sans').fontSize(7.5).fillColor('#6b7280')
        .text(pie, 40, Math.min(y + 30, doc.page.height - 60));

      doc.end();
    });
  }

  private caja(doc: PDFKit.PDFDocument, texto: string, y: number, x = 40) {
    doc.font('DejaVu Sans-Bold').fontSize(9).fillColor('#26324a');
    const ancho = doc.widthOfString(texto) + 16;
    doc.rect(x, y, ancho, 18).fillAndStroke('#eef3fb', '#2f6fed');
    doc.fillColor('#26324a').text(texto, x + 8, y + 4, { width: ancho - 10 });
  }

  /**
   * Variante del PDF en dos lineas ("Bs 40.000,00" sobre "$ 47,06") para que
   * la columna quede angosta y las 15 columnas entren en el ancho de la pagina.
   */
  private filaPdf(
    doc: PDFKit.PDFDocument,
    celdas: string[],
    colX: number[],
    cols: number[],
    y: number,
    fondo: boolean,
    colorFondo?: string,
  ) {
    if (fondo) {
      doc.rect(40, y, colX[colX.length - 1] + cols[cols.length - 1] - 40, 16).fill(colorFondo ?? '#ffffff');
    }
    doc.font('DejaVu Sans').fontSize(7).fillColor('#1f2937');
    celdas.forEach((valor, i) => {
      if (i === COL_MONTO || i === COL_TASA || i === COL_TOTAL_USD) {
        doc.text(valor, colX[i] + 2, y + 2, {
          width: cols[i] - 2,
          lineBreak: false,
          align: 'right',
        });
      } else {
        doc.text(valor, colX[i] + 2, y + 2, { width: cols[i] - 2, lineBreak: false });
      }
    });
  }

  /* ----------------------------- Helpers ----------------------------- */

  private buscar(empresaId: number | null, desde?: string, hasta?: string): Promise<Viaje[]> {
    const conFechas = Boolean(desde && hasta);
    if (empresaId != null && conFechas) {
      return this.repo.findByEmpresaIdAndFechaInicioBetweenOrderByFechaInicioDesc(
        empresaId, desde!, hasta!);
    }
    if (empresaId != null) {
      return this.repo.findByEmpresaIdOrderByFechaInicioDesc(empresaId);
    }
    if (conFechas) {
      return this.repo.findByFechaInicioBetweenOrderByFechaInicioDesc(desde!, hasta!);
    }
    return this.repo.findAllByOrderByFechaInicioDesc();
  }

  private sumar(viajes: Viaje[]): Sumas {
    const sumas = new Sumas();
    for (const v of viajes) sumas.sumar(v);
    return sumas;
  }

  /** Intervalo real en que se hicieron los viajes exportados. */
  private periodo(viajes: Viaje[], desde?: string, hasta?: string): string {
    if (viajes.length > 0) {
      const min = viajes.reduce((a, b) => (b.fechaInicio < a ? b.fechaInicio : a), viajes[0].fechaInicio);
      const max = viajes.reduce((a, b) => (b.fechaFin > a ? b.fechaFin : a), viajes[0].fechaFin);
      return `${fmtFecha(min)} al ${fmtFecha(max)}`;
    }
    if (desde != null || hasta != null) {
      return `${desde == null ? 'inicio' : fmtFecha(new Date(dateUtc(desde)))} al ${
        hasta == null ? 'hoy' : fmtFecha(new Date(dateUtc(hasta)))
      }`;
    }
    return 'sin viajes';
  }
}

function dateUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

const dualPdf = (valor?: number | null, tasa?: number) =>
  dualValoresPdf(nulo(valor), enUsd(valor, tasa));
const dualValoresPdf = (valor: number, usd: number) => `Bs ${money(valor)}\n$ ${money(usd)}`;

const marca = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}`;
};

const nombreChofer = (v: Viaje) => `${v.chofer?.nombre ?? ''} ${v.chofer?.apellido ?? ''}`.trim();
const nombreEmpresa = (v: Viaje) =>
  v.empresa ? v.empresa.nombre : 'Sin empresa';

const sumaGastos = (v: Viaje) =>
  (v.gastos ?? []).reduce((acc, g) => acc + nulo(g.monto), 0);

const numero = (celda: ExcelJS.Cell, valor?: number | null) => {
  celda.value = nulo(valor);
  celda.alignment = { horizontal: 'right' };
};

const texto = (celda: ExcelJS.Cell, valor: string) => {
  celda.value = valor;
};

const bordes = (celda: ExcelJS.Cell) => {
  celda.border = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' },
  };
};

const relleno = (celda: ExcelJS.Cell, color: string) => {
  celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  celda.border = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' },
  };
};

/** Sumatoria vertical: valores en Bs y su equivalente en $ fila a fila. */
class Sumas {
  monto = 0;
  combustible = 0;
  viaticos = 0;
  peajes = 0;
  pagoChofer = 0;
  gastos = 0;
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