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
exports.GasoilEstacionarioService = void 0;
exports.htmlGasoilEstacionario = htmlGasoilEstacionario;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const chromium_1 = require("../common/chromium");
const dates_1 = require("../common/dates");
const serialize_1 = require("../common/serialize");
const gasoil_estacionario_repository_1 = require("../repo/gasoil-estacionario.repository");
const vehiculo_repository_1 = require("../repo/vehiculo.repository");
const gastos_seccion_builder_1 = require("./gastos-seccion.builder");
const litros = (valor) => Number(valor || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
function htmlGasoilEstacionario(params) {
    const { rango, filas, totalLitros, cantidad, vehiculoPlaca, logoUri } = params;
    const cuerpo = filas.length
        ? filas
            .map((f, i) => `
            <tr class="${i % 2 ? 'par' : ''}">
              <td>${(0, gastos_seccion_builder_1.fechaCorta)(f.fecha)}</td>
              <td>${(0, gastos_seccion_builder_1.escapar)(f.vehiculo?.placa ?? 'SIN VEHÍCULO')}</td>
              <td class="num">${litros(f.litros)}</td>
              <td>${(0, gastos_seccion_builder_1.escapar)(f.referencia ?? '')}</td>
              <td>${(0, gastos_seccion_builder_1.escapar)(f.motivo ?? '')}</td>
            </tr>`)
            .join('')
        : `<tr><td colspan="5" class="vacio">Sin consumos en este intervalo.</td></tr>`;
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
            color: #26324a;
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
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #c9d2e0; padding: 4px 6px; }
          th {
            background: #26324a;
            color: #ffffff;
            font-size: 9px;
            text-align: left;
          }
          td { font-size: 10pt; }
          td.num, th.num { text-align: right; }
          tbody tr.par td { background: #f4f6fa; }
          td.vacio { text-align: center; color: #6b7280; }
          tr.total td {
            background: #dde6f5;
            font-weight: bold;
            border-top: 2px solid #26324a;
          }
        </style>
      </head>
      <body>
        <div class="cab">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <h1>Gasoil estacionario</h1>
          <div class="rango">${(0, gastos_seccion_builder_1.escapar)(rango)}</div>
        </div>

        <div class="resumen">
          <span class="dato"><span class="k">PERIODO</span>${(0, gastos_seccion_builder_1.escapar)(rango)}</span>
          <span class="dato"><span class="k">REGISTROS</span>${cantidad}</span>
          ${vehiculoPlaca
        ? `<span class="dato"><span class="k">VEHÍCULO</span>${(0, gastos_seccion_builder_1.escapar)(vehiculoPlaca)}</span>`
        : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>FECHA</th>
              <th>VEHÍCULO</th>
              <th class="num">LITROS</th>
              <th>N° REF</th>
              <th>MOTIVO</th>
            </tr>
          </thead>
          <tbody>
            ${cuerpo}
            <tr class="total">
              <td colspan="2">TOTAL</td>
              <td class="num">${litros(totalLitros)}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
}
let GasoilEstacionarioService = class GasoilEstacionarioService {
    repo;
    vehiculos;
    constructor(repo, vehiculos) {
        this.repo = repo;
        this.vehiculos = vehiculos;
    }
    async crearPdf(desde, hasta, vehiculoId) {
        const registros = await this.repo.buscar(vehiculoId, desde, hasta);
        const vehiculo = vehiculoId != null && vehiculoId > 0
            ? await this.vehiculos.findById(vehiculoId)
            : null;
        const filas = registros.map(serialize_1.gasoilEstacionarioJson);
        const totalLitros = (0, dates_1.round2)(filas.reduce((s, f) => s + Number(f.litros || 0), 0));
        const html = htmlGasoilEstacionario({
            rango: (0, gastos_seccion_builder_1.rangoFechas)(desde, hasta),
            filas,
            totalLitros,
            cantidad: filas.length,
            vehiculoPlaca: vehiculo?.placa ?? null,
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
exports.GasoilEstacionarioService = GasoilEstacionarioService;
exports.GasoilEstacionarioService = GasoilEstacionarioService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gasoil_estacionario_repository_1.GasoilEstacionarioRepository,
        vehiculo_repository_1.VehiculoRepository])
], GasoilEstacionarioService);
//# sourceMappingURL=gasoil-estacionario.service.js.map