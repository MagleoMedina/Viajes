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
exports.ReporteEmpresaService = void 0;
const common_1 = require("@nestjs/common");
const puppeteer = __importStar(require("puppeteer"));
const fs_1 = require("fs");
const path_1 = require("path");
const empresa_repository_1 = require("../repo/empresa.repository");
let ReporteEmpresaService = class ReporteEmpresaService {
    empresaRepo;
    constructor(empresaRepo) {
        this.empresaRepo = empresaRepo;
    }
    async generarPdf(params) {
        const { empresaId, desde, hasta, direccion: direccionParam } = params;
        const empresa = Number.isFinite(empresaId)
            ? await this.empresaRepo.findById(empresaId)
            : null;
        const nombreEmpresa = empresa?.nombre ?? 'EMPRESA NO ENCONTRADA';
        const direccionEmpresa = empresa?.direccion?.trim() ||
            direccionParam ||
            'Zona Industrial Matanzas, Ciudad Guayana, Estado Bolívar';
        const rangoFechas = this.formatearRangoFechas(desde, hasta);
        const logoUri = this.obtenerLogoDataUri();
        const cabeceras = ['FECHA', 'DESCRIPCIÓN / CONCEPTO', 'MONTO ($)'];
        const filasEjemplo = [
            { fecha: '22/09/2026', concepto: 'Transporte de bobinas de aluminio a planta', monto: '350,00' },
            { fecha: '26/09/2026', concepto: 'Flete de carga pesada y logística de retorno', monto: '520,00' },
            { fecha: '30/09/2026', concepto: 'Despacho de material y apoyo operativo', monto: '210,00' },
        ];
        const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
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
            margin-bottom: 24px;
          }
          .logo {
            max-width: 170px;
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
            color: #8c3b87; /* Tono magenta / púrpura corporativo */
            letter-spacing: 0.8px;
            margin: 0 0 4px 0;
            text-transform: uppercase;
          }
          .direccion-empresa {
            font-size: 9.5px;
            color: #4b5563;
            margin: 0;
          }

          /* Tabla con 3 columnas */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            border: 1px solid #c9d2e0;
            padding: 7px 10px;
            font-size: 8.5px;
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
          tbody tr:nth-child(even) {
            background-color: #f4f6fa;
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

        <!-- Tabla de 3 columnas -->
        <table>
          <thead>
            <tr>
              <th style="width: 20%;">${cabeceras[0]}</th>
              <th style="width: 55%;">${cabeceras[1]}</th>
              <th style="width: 25%;" class="num">${cabeceras[2]}</th>
            </tr>
          </thead>
          <tbody>
            ${filasEjemplo
            .map((f) => `
                <tr>
                  <td>${f.fecha}</td>
                  <td>${this.esc(f.concepto)}</td>
                  <td class="num">$ ${f.monto}</td>
                </tr>
              `)
            .join('')}
          </tbody>
        </table>

      </body>
      </html>
    `;
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'load' });
            const pdfUint8 = await page.pdf({
                format: 'A4',
                landscape: false,
                printBackground: true,
                preferCSSPageSize: true,
            });
            return Buffer.from(pdfUint8);
        }
        finally {
            await browser.close();
        }
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
    esc(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};
exports.ReporteEmpresaService = ReporteEmpresaService;
exports.ReporteEmpresaService = ReporteEmpresaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [empresa_repository_1.EmpresaRepository])
], ReporteEmpresaService);
//# sourceMappingURL=reporte-empresa.service.js.map