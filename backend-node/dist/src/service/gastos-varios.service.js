"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GastosVariosService = void 0;
exports.resumirPorTitulo = resumirPorTitulo;
exports.htmlGastosVarios = htmlGastosVarios;
const common_1 = require("@nestjs/common");
const chromium_1 = require("../common/chromium");
const fs_1 = require("fs");
const path_1 = require("path");
const gasto_vario_repository_1 = require("../repo/gasto-vario.repository");
const serialize_1 = require("../common/serialize");
const dates_1 = require("../common/dates");
const escapar = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const formatearDinero = (valor) => Number(valor || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const fechaCorta = (iso) => {
    if (!iso)
        return '—';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : '—';
};
const num = (v) => Number(v || 0);
function resumirPorTitulo(gastos) {
    const mapa = new Map();
    for (const g of gastos) {
        const nombre = (g.tituloGasto?.nombre ?? '').trim() || 'SIN TÍTULO';
        let bloque = mapa.get(nombre);
        if (!bloque) {
            bloque = { titulo: nombre, filas: [], sumaUsd: 0, sumaBs: 0 };
            mapa.set(nombre, bloque);
        }
        bloque.filas.push(g);
        bloque.sumaUsd += num(g.montoUsd);
        bloque.sumaBs += num(g.montoBs);
    }
    const bloques = [...mapa.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
    for (const b of bloques) {
        b.sumaUsd = (0, dates_1.round2)(b.sumaUsd);
        b.sumaBs = (0, dates_1.round2)(b.sumaBs);
        b.filas.sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)));
    }
    return bloques;
}
function htmlGastosVarios(params) {
    const { rango, bloques, totalUsd, totalBs, cantidad, color, logoUri } = params;
    const COLUMNAS = ['FECHA', 'N°', 'MOTIVO', 'MONTO $', 'MONTO BS', 'TASA', '%DB', 'N° REF'];
    const ths = COLUMNAS.map((c, i) => `<th class="${i >= 3 && i <= 6 ? 'num' : ''}">${c}</th>`).join('');
    const secciones = bloques
        .map((b) => {
        const filas = b.filas
            .map((g, i) => `
            <tr class="${i % 2 ? 'par' : ''}">
              <td>${fechaCorta(g.fecha)}</td>
              <td>${escapar(g.numero ?? '')}</td>
              <td>${escapar(g.motivo ?? '')}</td>
              <td class="num">$ ${formatearDinero(g.montoUsd)}</td>
              <td class="num">Bs ${formatearDinero(g.montoBs)}</td>
              <td class="num">${formatearDinero(g.tasa)}</td>
              <td class="num">${formatearDinero(g.porcentajeDb)}</td>
              <td>${escapar(g.referencia ?? '')}</td>
            </tr>`)
            .join('');
        return `
        <div class="bloque-titulo">${escapar(b.titulo)}</div>
        <table>
          <thead><tr>${ths}</tr></thead>
          <tbody>
            ${filas}
            <tr class="subtotal">
              <td colspan="3">SUBTOTAL</td>
              <td class="num">$ ${formatearDinero(b.sumaUsd)}</td>
              <td class="num">Bs ${formatearDinero(b.sumaBs)}</td>
              <td colspan="3"></td>
            </tr>
          </tbody>
        </table>`;
    })
        .join('');
    const vacio = !bloques.length
        ? '<p class="vacio">Sin gastos en este intervalo.</p>'
        : '';
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
          .logo { max-width: 150px; height: auto; margin-bottom: 6px; }
          h1 {
            font-size: 15px;
            font-weight: 800;
            color: ${color ?? '#26324a'};
            letter-spacing: 0.5px;
            margin: 0 0 4px;
            text-transform: uppercase;
          }
          .rango { font-size: 10px; color: #4b5563; margin: 0; }
          .resumen { margin: 8px 0 10px; text-align: center; }
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
          .dato .k { color: #2f6fed; font-size: 7.5px; margin-right: 5px; }
          .bloque-titulo {
            background: #26324a;
            color: #ffffff;
            font-size: 10pt;
            font-weight: bold;
            text-transform: uppercase;
            padding: 4px 8px;
            margin: 10px 0 0;
            page-break-after: avoid;
          }
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
          tr.subtotal td {
            background-color: #dde6f5;
            font-weight: bold;
            font-size: 10pt;
          }
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
          .vacio { text-align: center; color: #6b7280; font-style: italic; padding: 14px; }
        </style>
      </head>
      <body>
        <div class="cab">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <h1>Gastos varios</h1>
          <p class="rango">${escapar(rango)}</p>
        </div>

        <div class="resumen">
          <span class="dato"><span class="k">PERIODO</span>${escapar(rango)}</span>
          <span class="dato"><span class="k">REGISTROS</span>${cantidad}</span>
        </div>

        ${secciones}
        ${vacio}

        ${bloques.length ? `
        <div class="total-general">
          TOTAL GENERAL
          <span class="caja">$ ${formatearDinero(totalUsd)}</span>
          <span class="caja">Bs ${formatearDinero(totalBs)}</span>
        </div>` : ''}
      </body>
      </html>
    `;
}
function rangoFechas(desde, hasta) {
    const corta = (iso) => {
        const [a, m, d] = iso.split('-');
        return `${d}/${m}/${a ? a.slice(-2) : ''}`;
    };
    if (desde && hasta)
        return `${corta(desde)} AL ${corta(hasta)}`;
    if (desde)
        return `DESDE ${corta(desde)}`;
    if (hasta)
        return `HASTA ${corta(hasta)}`;
    return 'HISTÓRICO GENERAL';
}
let GastosVariosService = class GastosVariosService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async crearPdf(desde, hasta, tituloId) {
        const gastos = await this.repo.buscar(tituloId, desde, hasta);
        const bloques = resumirPorTitulo(gastos.map(serialize_1.gastoVarioJson));
        const totalUsd = (0, dates_1.round2)(bloques.reduce((s, b) => s + b.sumaUsd, 0));
        const totalBs = (0, dates_1.round2)(bloques.reduce((s, b) => s + b.sumaBs, 0));
        const html = htmlGastosVarios({
            rango: rangoFechas(desde, hasta),
            bloques,
            totalUsd,
            totalBs,
            cantidad: gastos.length,
            color: '#26324a',
            logoUri: this.logoDataUri(),
        });
        const browser = await (0, chromium_1.lanzarChrome)();
        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'load' });
            const pdfUint8 = await page.pdf({ printBackground: true, preferCSSPageSize: true });
            return Buffer.from(pdfUint8);
        }
        finally {
            await browser.close();
        }
    }
    logoDataUri() {
        const logoPath = (0, path_1.join)(process.cwd(), 'assets', 'logo.jpg');
        if ((0, fs_1.existsSync)(logoPath)) {
            return `data:image/jpeg;base64,${(0, fs_1.readFileSync)(logoPath).toString('base64')}`;
        }
        return '';
    }
};
exports.GastosVariosService = GastosVariosService;
exports.GastosVariosService = GastosVariosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gasto_vario_repository_1.GastoVarioRepository])
], GastosVariosService);
//# sourceMappingURL=gastos-varios.service.js.map