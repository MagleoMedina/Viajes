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
exports.GastosGasoilService = void 0;
exports.resumirPorVehiculo = resumirPorVehiculo;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const chromium_1 = require("../common/chromium");
const dates_1 = require("../common/dates");
const serialize_1 = require("../common/serialize");
const gasto_gasoil_repository_1 = require("../repo/gasto-gasoil.repository");
const gastos_seccion_builder_1 = require("./gastos-seccion.builder");
function resumirPorVehiculo(gastos) {
    return (0, gastos_seccion_builder_1.agruparPor)(gastos, (g) => g.vehiculo?.placa || 'SIN VEHÍCULO');
}
const litros = (v) => Number(v || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const COLUMNAS = [
    { clave: 'fecha', encabezado: 'Fecha', celda: (f) => (0, gastos_seccion_builder_1.fechaCorta)(f.fecha) },
    {
        clave: 'vehiculo',
        encabezado: 'Vehículo',
        celda: (f) => (0, gastos_seccion_builder_1.escapar)(f.vehiculo?.placa ?? ''),
    },
    { clave: 'estacion', encabezado: 'Estación', celda: (f) => (0, gastos_seccion_builder_1.escapar)(f.estacion ?? '') },
    { clave: 'litros', encabezado: 'Litros', num: true, celda: (f) => litros(f.litros) },
    {
        clave: 'precio',
        encabezado: 'Precio $/L',
        num: true,
        celda: (f) => `$ ${(0, gastos_seccion_builder_1.formatearDinero)(f.precioLitro)}`,
    },
    {
        clave: 'usd',
        encabezado: 'Monto $',
        num: true,
        celda: (f) => `$ ${(0, gastos_seccion_builder_1.formatearDinero)(f.montoUsd)}`,
    },
    {
        clave: 'bs',
        encabezado: 'Monto Bs',
        num: true,
        celda: (f) => `Bs ${(0, gastos_seccion_builder_1.formatearDinero)(f.montoBs)}`,
    },
    {
        clave: 'tasa',
        encabezado: 'Tasa',
        num: true,
        celda: (f) => (0, gastos_seccion_builder_1.formatearDinero)(f.tasa),
    },
    { clave: 'ref', encabezado: 'N° REF', celda: (f) => (0, gastos_seccion_builder_1.escapar)(f.referencia ?? '') },
];
let GastosGasoilService = class GastosGasoilService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async crearPdf(desde, hasta, vehiculoId) {
        const gastos = await this.repo.buscar(vehiculoId, desde, hasta);
        const bloques = resumirPorVehiculo(gastos.map(serialize_1.gastoGasoilJson));
        const totalUsd = (0, dates_1.round2)(bloques.reduce((s, b) => s + b.sumaUsd, 0));
        const totalBs = (0, dates_1.round2)(bloques.reduce((s, b) => s + b.sumaBs, 0));
        const html = (0, gastos_seccion_builder_1.htmlGastosSeccion)({
            titulo: 'Gastos de gasoil',
            rango: (0, gastos_seccion_builder_1.rangoFechas)(desde, hasta),
            columnas: COLUMNAS,
            bloques,
            totalUsd,
            totalBs,
            cantidad: gastos.length,
            color: '#26324a',
            logoUri: this.logoDataUri(),
            etiquetaSubtotal: () => 'SUBTOTAL',
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
exports.GastosGasoilService = GastosGasoilService;
exports.GastosGasoilService = GastosGasoilService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gasto_gasoil_repository_1.GastoGasoilRepository])
], GastosGasoilService);
//# sourceMappingURL=gastos-gasoil.service.js.map