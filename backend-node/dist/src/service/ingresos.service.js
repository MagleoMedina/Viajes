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
exports.IngresosService = void 0;
exports.resumirPorEmpresa = resumirPorEmpresa;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const chromium_1 = require("../common/chromium");
const dates_1 = require("../common/dates");
const serialize_1 = require("../common/serialize");
const ingreso_repository_1 = require("../repo/ingreso.repository");
const gastos_seccion_builder_1 = require("./gastos-seccion.builder");
const numero = (valor) => Number(valor || 0).toLocaleString('es-VE', { maximumFractionDigits: 2 });
const tasaTexto = (valor) => Number(valor || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
});
function resumirPorEmpresa(filas) {
    return (0, gastos_seccion_builder_1.agruparPor)(filas, (f) => f.empresa?.nombre ?? 'SIN EMPRESA');
}
let IngresosService = class IngresosService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async crearPdf(desde, hasta, empresaId) {
        const registros = await this.repo.buscar(empresaId, desde, hasta);
        const filas = registros.map((r) => {
            const json = (0, serialize_1.ingresoJson)(r);
            return { ...json, montoUsd: json.montoDivisa ?? 0 };
        });
        const bloques = resumirPorEmpresa(filas);
        const totalUsd = (0, dates_1.round2)(bloques.reduce((s, b) => s + b.sumaUsd, 0));
        const totalBs = (0, dates_1.round2)(bloques.reduce((s, b) => s + b.sumaBs, 0));
        const html = (0, gastos_seccion_builder_1.htmlGastosSeccion)({
            titulo: 'Ingresos',
            rango: (0, gastos_seccion_builder_1.rangoFechas)(desde, hasta),
            columnas: [
                {
                    clave: 'fecha',
                    encabezado: 'FECHA',
                    celda: (f) => (0, gastos_seccion_builder_1.fechaCorta)(f.fecha),
                },
                {
                    clave: 'facturaNum',
                    encabezado: 'FACTURA No.',
                    num: true,
                    celda: (f) => (f.facturaNum == null ? '—' : String(f.facturaNum)),
                },
                {
                    clave: 'condiciones',
                    encabezado: 'CONDICIONES DE PAGO',
                    celda: (f) => (0, gastos_seccion_builder_1.escapar)(f.condicionesPago ?? '') || '—',
                },
                {
                    clave: 'descripcion',
                    encabezado: 'DESCRIPCIÓN',
                    celda: (f) => (0, gastos_seccion_builder_1.escapar)(f.descripcion ?? ''),
                },
                {
                    clave: 'cantidad',
                    encabezado: 'CANTIDAD',
                    num: true,
                    celda: (f) => numero(f.cantidad),
                },
                {
                    clave: 'tasa',
                    encabezado: 'TASA',
                    num: true,
                    celda: (f) => tasaTexto(f.tasa),
                },
                {
                    clave: 'iva',
                    encabezado: 'IVA',
                    num: true,
                    celda: (f) => (0, gastos_seccion_builder_1.formatearDinero)(f.iva),
                },
                {
                    clave: 'usd',
                    encabezado: 'MONTO $',
                    num: true,
                    celda: (f) => (0, gastos_seccion_builder_1.formatearDinero)(f.montoUsd),
                },
                {
                    clave: 'bs',
                    encabezado: 'MONTO BS',
                    num: true,
                    celda: (f) => (0, gastos_seccion_builder_1.formatearDinero)(f.montoBs),
                },
            ],
            bloques,
            totalUsd,
            totalBs,
            cantidad: filas.length,
            color: '#26324a',
            logoUri: this.logoDataUri(),
            mensajeVacio: 'Sin ingresos en este intervalo.',
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
exports.IngresosService = IngresosService;
exports.IngresosService = IngresosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ingreso_repository_1.IngresoRepository])
], IngresosService);
//# sourceMappingURL=ingresos.service.js.map