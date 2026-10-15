"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportService = void 0;
exports.htmlViajes = htmlViajes;
const common_1 = require("@nestjs/common");
const ExcelJS = __importStar(require("exceljs"));
const chromium_1 = require("../common/chromium");
const fs_1 = require("fs");
const path_1 = require("path");
const viaje_repository_1 = require("../repo/viaje.repository");
const empresa_repository_1 = require("../repo/empresa.repository");
const dates_1 = require("../common/dates");
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
const ASSETS = (0, path_1.join)(process.cwd(), 'assets');
const LOGO_PATH = (0, path_1.join)(ASSETS, 'logo.jpg');
const LOGO_BUFFER = (0, fs_1.existsSync)(LOGO_PATH) ? (0, fs_1.readFileSync)(LOGO_PATH) : Buffer.from([]);
const LOGO_URI = LOGO_BUFFER.length > 0 ? `data:image/jpeg;base64,${LOGO_BUFFER.toString('base64')}` : '';
const FUENTE_PATH = (0, path_1.join)(ASSETS, 'fonts', 'DejaVuSans.ttf');
const FUENTE_BOLD_PATH = (0, path_1.join)(ASSETS, 'fonts', 'DejaVuSans-Bold.ttf');
const FUENTE_BASE64 = (0, fs_1.existsSync)(FUENTE_PATH) ? (0, fs_1.readFileSync)(FUENTE_PATH).toString('base64') : null;
const FUENTE_BOLD_BASE64 = (0, fs_1.existsSync)(FUENTE_BOLD_PATH) ? (0, fs_1.readFileSync)(FUENTE_BOLD_PATH).toString('base64') : null;
const fmtFecha = (d) => {
    if (!d)
        return '';
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(dateObj.getUTCDate())}/${pad(dateObj.getUTCMonth() + 1)}/${dateObj.getUTCFullYear()}`;
};
const enUsd = (valor, tasa) => {
    const bs = valor ?? 0;
    if (!tasa || tasa === 0)
        return 0;
    return (0, dates_1.round2)(bs / tasa);
};
const nulo = (v) => v ?? 0;
const dualValores = (valor, usd) => `Bs ${(0, dates_1.money)(valor)} / $ ${(0, dates_1.money)(usd)}`;
const dual = (valor, tasa) => dualValores(nulo(valor), enUsd(valor, tasa));
const dolar = (valor) => `$ ${(0, dates_1.money)(nulo(valor))}`;
const dualPdf = (valor, tasa) => dualValoresPdf(nulo(valor), enUsd(valor, tasa));
const dualValoresPdf = (valor, usd) => `Bs ${(0, dates_1.money)(valor)}<br/>$ ${(0, dates_1.money)(usd)}`;
const esc = (valor) => {
    if (!valor)
        return '';
    return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};
const nombreChofer = (v) => `${v.chofer?.nombre ?? ''} ${v.chofer?.apellido ?? ''}`.trim();
const nombreEmpresa = (v) => (v.empresa ? v.empresa.nombre : 'Sin empresa');
const sumaGastos = (v) => (v.gastos ?? []).reduce((acc, g) => acc + nulo(g.monto), 0);
const marca = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const sumarViajes = (viajes) => {
    const sumas = new Sumas();
    for (const v of viajes)
        sumas.sumar(v);
    return sumas;
};
const periodoViajes = (viajes, desde, hasta) => {
    if (viajes.length > 0) {
        const min = viajes.reduce((a, b) => (new Date(b.fechaInicio) < new Date(a) ? b.fechaInicio : a), viajes[0].fechaInicio);
        const max = viajes.reduce((a, b) => (new Date(b.fechaFin) > new Date(a) ? b.fechaFin : a), viajes[0].fechaFin);
        return `${fmtFecha(min)} al ${fmtFecha(max)}`;
    }
    if (desde != null || hasta != null) {
        return `${desde == null ? 'inicio' : fmtFecha(desde)} al ${hasta == null ? 'hoy' : fmtFecha(hasta)}`;
    }
    return 'sin viajes';
};
function htmlViajes(viajes, opts = {}) {
    const { empresaNombre = null, desde, hasta, color = '#26324a' } = opts;
    const sumas = sumarViajes(viajes);
    const titulo = empresaNombre == null ? 'Viajes realizados' : `Viajes ${esc(empresaNombre)}`;
    const empresaBox = empresaNombre == null
        ? ''
        : `<span class="dato"><span class="k">EMPRESA</span>${esc(empresaNombre)}</span>`;
    const periodo = periodoViajes(viajes, desde, hasta);
    const cantidad = viajes.length;
    let cuerpoHtml = '';
    viajes.forEach((v, indice) => {
        const claseTr = indice % 2 === 0 ? '' : ' class="par"';
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
          <td class="num">${dualPdf(v.combustible, v.tasa)}</td>
          <td class="num">${dualPdf(v.viaticos, v.tasa)}</td>
          <td class="num">${dualPdf(v.peajes, v.tasa)}</td>
          <td class="num">${dualPdf(v.pagoChofer, v.tasa)}</td>
          <td class="num">${(0, dates_1.money)(nulo(v.litros))}</td>
          <td class="num">${dualPdf(sumaGastos(v), v.tasa)}</td>
          <td class="num">${dualPdf(v.totalBs, v.tasa)}</td>
          <td class="num">${(0, dates_1.money)(nulo(v.tasa))}</td>
          <td class="num">${dolar(v.totalUsd)}</td>
        </tr>`;
    });
    cuerpoHtml += `
      <tr class="totales">
        <td colspan="7"></td>
        <td class="num">${dolar(sumas.monto)}</td>
        <td class="num">${dualValoresPdf(sumas.combustible, sumas.combustibleUsd)}</td>
        <td class="num">${dualValoresPdf(sumas.viaticos, sumas.viaticosUsd)}</td>
        <td class="num">${dualValoresPdf(sumas.peajes, sumas.peajesUsd)}</td>
        <td class="num">${dualValoresPdf(sumas.pagoChofer, sumas.pagoChoferUsd)}</td>
        <td class="num">${(0, dates_1.money)(sumas.litros)}</td>
        <td class="num">${dualValoresPdf(sumas.gastos, sumas.gastosUsd)}</td>
        <td class="num">${dualValoresPdf(sumas.totalBs, sumas.totalBsUsd)}</td>
        <td class="num"></td>
        <td class="num"></td>
      </tr>`;
    cuerpoHtml += `
      <tr class="suma">
        <td colspan="16" class="etiqueta">SUMA TOTAL $</td>
        <td class="num">${dolar(sumas.totalUsd)}</td>
      </tr>`;
    const thsHtml = COLUMNAS.map((col) => `<th>${col}</th>`).join('');
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
          body { font-family: 'DejaVu Sans', sans-serif; font-size: 7px; color: #1f2937; margin: 0; padding: 0; }
          .cab { margin-bottom: 6px; }
          .logo { height: 32px; vertical-align: middle; }
          .cab-texto { display: inline-block; vertical-align: middle; margin-left: 8px; }
          h1 { font-size: 15px; margin: 0 0 2px; color: ${color}; font-family: 'DejaVu Sans', sans-serif; }
          .rango { color: #6b7280; font-size: 8.5px; }
          .resumen { margin: 0 0 8px; }
          .dato { display: inline-block; border: 1px solid #2f6fed; background: #eef3fb;
                  color: #26324a; font-size: 9px; font-weight: bold; padding: 3px 8px; margin-right: 6px; }
          .dato .k { color: #2f6fed; font-size: 7.5px; margin-right: 5px; }
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
          .pie { margin-top: 8px; color: #6b7280; font-size: 7.5px; }
        </style>
      </head>
      <body>
        <div class="cab">
          ${LOGO_URI ? `<img class="logo" src="${LOGO_URI}" alt="Logo" />` : ''}
          <div class="cab-texto">
            <h1>${titulo}</h1>
            <div class="rango">Histórico de viajes</div>
          </div>
        </div>
        <div class="resumen">
          <span class="dato"><span class="k">PERIODO</span>${periodo}</span>
          <span class="dato"><span class="k">VIAJES</span>${cantidad}</span>
          ${empresaBox}
        </div>
        <table>
          <thead><tr>${thsHtml}</tr></thead>
          <tbody>${cuerpoHtml}</tbody>
        </table>
        <div class="pie">${pieTexto}</div>
      </body>
      </html>
    `;
}
let ExportService = class ExportService {
    repo;
    empresas;
    constructor(repo, empresas) {
        this.repo = repo;
        this.empresas = empresas;
    }
    crearXlsx(empresaId, desde, hasta) {
        return this.buscar(empresaId, desde, hasta).then((viajes) => {
            const sumas = sumarViajes(viajes);
            const wb = new ExcelJS.Workbook();
            const hoja = wb.addWorksheet('Viajes');
            if (LOGO_BUFFER.length > 0) {
                const imageId = wb.addImage({ buffer: LOGO_BUFFER, extension: 'jpeg' });
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
            for (let i = 1; i <= 17; i++)
                this.relleno(totales.getCell(i), 'FFDDE6F5');
            this.texto(totales.getCell(8), dolar(sumas.monto));
            this.texto(totales.getCell(9), dualValores(sumas.combustible, sumas.combustibleUsd));
            this.texto(totales.getCell(10), dualValores(sumas.viaticos, sumas.viaticosUsd));
            this.texto(totales.getCell(11), dualValores(sumas.peajes, sumas.peajesUsd));
            this.texto(totales.getCell(12), dualValores(sumas.pagoChofer, sumas.pagoChoferUsd));
            this.numero(totales.getCell(13), sumas.litros);
            this.texto(totales.getCell(14), dualValores(sumas.gastos, sumas.gastosUsd));
            this.texto(totales.getCell(15), dualValores(sumas.totalBs, sumas.totalBsUsd));
            const suma = hoja.getRow(numeroFila);
            for (let i = 1; i <= 17; i++)
                this.relleno(suma.getCell(i), 'FF2F6FED');
            this.texto(suma.getCell(16), 'SUMA TOTAL $');
            this.numero(suma.getCell(17), sumas.totalUsd);
            const anchos = [13, 13, 22, 22, 24, 18, 18, 14, 20, 20, 20, 22, 10, 22, 26, 11, 13];
            hoja.columns.forEach((col, i) => {
                if (col)
                    col.width = anchos[i];
            });
            return wb.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
        });
    }
    async crearPdf(empresaId, desde, hasta, colorTitulo = '#26324a') {
        const viajes = await this.buscar(empresaId, desde, hasta);
        const empresaNombre = empresaId != null ? (await this.empresas.findById(empresaId))?.nombre ?? '¿?' : null;
        const htmlContent = htmlViajes(viajes, {
            empresaId,
            empresaNombre,
            desde,
            hasta,
            color: colorTitulo,
        });
        const browser = await (0, chromium_1.lanzarChrome)();
        try {
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'load' });
            const pdfUint8 = await page.pdf({
                printBackground: true,
                preferCSSPageSize: true,
            });
            return Buffer.from(pdfUint8);
        }
        finally {
            await browser.close();
        }
    }
    buscar(empresaId, desde, hasta) {
        const conFechas = Boolean(desde && hasta);
        if (empresaId != null && conFechas) {
            return this.repo.findByEmpresaIdAndFechaInicioBetweenOrderByFechaInicioDesc(empresaId, desde, hasta);
        }
        if (empresaId != null) {
            return this.repo.findByEmpresaIdOrderByFechaInicioDesc(empresaId);
        }
        if (conFechas) {
            return this.repo.findByFechaInicioBetweenOrderByFechaInicioDesc(desde, hasta);
        }
        return this.repo.findAllByOrderByFechaInicioDesc();
    }
    numero(celda, valor) {
        celda.value = nulo(valor);
        celda.alignment = { horizontal: 'right' };
    }
    texto(celda, valor) {
        celda.value = valor;
    }
    bordes(celda) {
        celda.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
        };
    }
    relleno(celda, color) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        celda.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
        };
    }
};
exports.ExportService = ExportService;
exports.ExportService = ExportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [viaje_repository_1.ViajeRepository,
        empresa_repository_1.EmpresaRepository])
], ExportService);
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
    sumar(v) {
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
//# sourceMappingURL=export.service.js.map