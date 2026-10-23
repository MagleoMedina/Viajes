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
exports.ReporteEmpresaService = void 0;
exports.htmlReporte = htmlReporte;
const common_1 = require("@nestjs/common");
const chromium_1 = require("../common/chromium");
const fs_1 = require("fs");
const path_1 = require("path");
const empresa_repository_1 = require("../repo/empresa.repository");
const viaje_repository_1 = require("../repo/viaje.repository");
const dates_1 = require("../common/dates");
const COLS_CON_MONTO = 8;
const escapar = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const formatearDinero = (valor) => Number(valor || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
function htmlReporte(params) {
    const { nombreEmpresa, direccionEmpresa, rangoFechas, columnas, filas, conMonto, cantidadViajes = filas.length, total = 0, color, logoUri, } = params;
    const ths = columnas
        .map((c, i) => `<th class="${i === columnas.length - 1 && conMonto ? 'num' : ''}">${c}</th>`)
        .join('');
    const cuerpo = filas.length
        ? filas
            .map((celdas, i) => `
            <tr class="${i % 2 ? 'par' : ''}">
              ${celdas.map((c, j) => `<td${j === celdas.length - 1 && conMonto ? ' class="num"' : ''}>${escapar(c)}</td>`).join('')}
            </tr>`)
            .join('')
        : `<tr><td colspan="${columnas.length}" class="vacio">Sin viajes en este intervalo.</td></tr>`;
    const pie = conMonto && filas.length
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
            max-width: 200px;
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
let ReporteEmpresaService = class ReporteEmpresaService {
    empresaRepo;
    viajeRepo;
    constructor(empresaRepo, viajeRepo) {
        this.empresaRepo = empresaRepo;
        this.viajeRepo = viajeRepo;
    }
    async generarPdf(params) {
        const { empresaId, desde, hasta, direccion: direccionParam, conMonto = true, sinChofer = false, color } = params;
        const empresa = Number.isFinite(empresaId) && empresaId > 0
            ? await this.empresaRepo.findById(empresaId)
            : null;
        const nombreEmpresa = empresa?.nombre ?? 'TODAS LAS EMPRESAS';
        const direccionEmpresa = empresa?.direccion?.trim() ||
            direccionParam ||
            'Zona Industrial Matanzas, Ciudad Guayana, Estado Bolívar';
        const rangoFechas = this.formatearRangoFechas(desde, hasta);
        const viajes = (0, dates_1.ordenarPorFechaAscendente)(await this.consultar(empresaId, desde, hasta));
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
            if (conMonto)
                celdas.push(this.dinero(v.montoViaje ?? 0));
            return celdas;
        });
        const total = viajes.reduce((suma, v) => suma + (v.montoViaje ?? 0), 0);
        let columnas = conMonto
            ? ['FECHA', 'VEHICULO', 'CHOFER', 'RECORRIDO', 'DESDE', 'HASTA', 'CARGA', 'MONTO ($)']
            : ['FECHA', 'VEHICULO', 'CHOFER', 'RECORRIDO', 'DESDE', 'HASTA', 'CARGA'];
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
        const browser = await (0, chromium_1.lanzarChrome)();
        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'load' });
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
    consultar(empresaId, desde, hasta) {
        const conEmpresa = Number.isFinite(empresaId) && empresaId > 0;
        const conFechas = Boolean(desde && hasta);
        if (conEmpresa && conFechas) {
            return this.viajeRepo.findByEmpresaIdAndFechaInicioBetweenOrderByFechaInicioDesc(empresaId, desde, hasta);
        }
        if (conEmpresa)
            return this.viajeRepo.findByEmpresaIdOrderByFechaInicioDesc(empresaId);
        if (conFechas)
            return this.viajeRepo.findByFechaInicioBetweenOrderByFechaInicioDesc(desde, hasta);
        return this.viajeRepo.findAllByOrderByFechaInicioDesc();
    }
    fechaCorta(fecha) {
        if (!fecha)
            return '—';
        const d = new Date(fecha);
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getUTCFullYear()}`;
    }
    vehiculo(v) {
        const veh = v.vehiculo;
        if (!veh)
            return '—';
        const partes = [veh.marca, veh.modelo].filter((x) => x && x.trim()).join(' ').trim();
        const placa = veh.placa?.trim();
        if (partes && placa)
            return `${partes} (${placa})`;
        return partes || placa || '—';
    }
    chofer(v) {
        const c = v.chofer;
        if (!c)
            return '—';
        return [c.nombre, c.apellido].filter((x) => x && x.trim()).join(' ').trim() || '—';
    }
    dinero(valor) {
        return formatearDinero(valor);
    }
    formatearRangoFechas(desde, hasta) {
        if (!desde && !hasta)
            return 'HISTÓRICO GENERAL';
        const parsear = (fechaIso) => {
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
        const h = parsear(hasta);
        return `HASTA EL ${h.diaMes}/${h.anioCorto}`;
    }
    obtenerLogoDataUri() {
        const logoPath = (0, path_1.join)(process.cwd(), 'assets', 'logo.jpg');
        if ((0, fs_1.existsSync)(logoPath)) {
            const buffer = (0, fs_1.readFileSync)(logoPath);
            return `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }
        return '';
    }
};
exports.ReporteEmpresaService = ReporteEmpresaService;
exports.ReporteEmpresaService = ReporteEmpresaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [empresa_repository_1.EmpresaRepository,
        viaje_repository_1.ViajeRepository])
], ReporteEmpresaService);
//# sourceMappingURL=reporte-empresa.service.js.map