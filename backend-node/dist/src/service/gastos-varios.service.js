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
const gastos_seccion_builder_1 = require("./gastos-seccion.builder");
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
    return (0, gastos_seccion_builder_1.htmlResumenTitulos)({
        titulo: 'Gastos varios',
        encabezado: 'TÍTULO',
        rango,
        filas: bloques.map((b) => ({
            etiqueta: b.titulo,
            montoUsd: b.sumaUsd,
            montoBs: b.sumaBs,
        })),
        totalUsd,
        totalBs,
        cantidad,
        color,
        logoUri,
    });
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
            rango: (0, gastos_seccion_builder_1.rangoFechas)(desde, hasta),
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