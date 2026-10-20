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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportController = void 0;
const common_1 = require("@nestjs/common");
const export_service_1 = require("../service/export.service");
const reporte_empresa_service_1 = require("../service/reporte-empresa.service");
const gastos_varios_service_1 = require("../service/gastos-varios.service");
const gastos_impuestos_service_1 = require("../service/gastos-impuestos.service");
const gastos_gasoil_service_1 = require("../service/gastos-gasoil.service");
const gasoil_estacionario_service_1 = require("../service/gasoil-estacionario.service");
const relacion_reportes_service_1 = require("../service/relacion-reportes.service");
const empresa_repository_1 = require("../repo/empresa.repository");
const api_exception_1 = require("./api-exception");
const COLOR_SEGURO = /^#[0-9a-fA-F]{6}$/;
function colorDe(color, porDefecto) {
    return color && COLOR_SEGURO.test(color) ? color.toLowerCase() : porDefecto;
}
function slug(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'documento';
}
function fechaArchivo(valor, porDefecto) {
    return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : porDefecto;
}
let ExportController = class ExportController {
    servicio;
    reporteServicio;
    empresaRepo;
    gastosServicio;
    impuestosServicio;
    gasoilServicio;
    estacionarioServicio;
    relacionServicio;
    constructor(servicio, reporteServicio, empresaRepo, gastosServicio, impuestosServicio, gasoilServicio, estacionarioServicio, relacionServicio) {
        this.servicio = servicio;
        this.reporteServicio = reporteServicio;
        this.empresaRepo = empresaRepo;
        this.gastosServicio = gastosServicio;
        this.impuestosServicio = impuestosServicio;
        this.gasoilServicio = gasoilServicio;
        this.estacionarioServicio = estacionarioServicio;
        this.relacionServicio = relacionServicio;
    }
    async nombre(empresaId, prefijo, desde, hasta) {
        const empresa = empresaId != null ? await this.empresaRepo.findById(empresaId) : null;
        const empresaSlug = slug(empresa?.nombre ?? 'todas');
        const d = fechaArchivo(desde, 'inicio');
        const h = fechaArchivo(hasta, 'hoy');
        return `${prefijo}_${empresaSlug}_${d}_${h}`;
    }
    async xlsx(res, empresaId, desde, hasta) {
        const idEmpresa = empresaId ? Number(empresaId) : null;
        const buffer = await this.servicio.crearXlsx(idEmpresa, desde, hasta);
        const nombre = await this.nombre(idEmpresa, 'viajes', desde, hasta);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}.xlsx"`);
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
    }
    async pdf(res, empresaId, desde, hasta, color) {
        const idEmpresa = empresaId ? Number(empresaId) : null;
        const buffer = await this.servicio.crearPdf(idEmpresa, desde, hasta, colorDe(color, '#26324a'));
        const nombre = await this.nombre(idEmpresa, 'viajes', desde, hasta);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
    }
    async reporte(res, empresaId, desde, hasta, direccion, conMonto, sinChofer, color) {
        const idEmpresa = empresaId ? Number(empresaId) : 0;
        const buffer = await this.reporteServicio.generarPdf({
            empresaId: idEmpresa,
            desde,
            hasta,
            direccion,
            conMonto: conMonto !== 'false',
            sinChofer: sinChofer === 'true',
            color: colorDe(color, '#8c3b87'),
        });
        const nombre = await this.nombre(idEmpresa > 0 ? idEmpresa : null, 'reporte', desde, hasta);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
    }
    async gastosVarios(res, desde, hasta, tituloId) {
        const idTitulo = tituloId ? Number(tituloId) : null;
        const buffer = await this.gastosServicio.crearPdf(desde, hasta, idTitulo);
        const d = fechaArchivo(desde, 'inicio');
        const h = fechaArchivo(hasta, 'hoy');
        const nombre = `gastos_varios_${d}_${h}`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
    }
    async gastosImpuestos(res, desde, hasta, tituloId) {
        const idTitulo = tituloId ? Number(tituloId) : null;
        const buffer = await this.impuestosServicio.crearPdf(desde, hasta, idTitulo);
        const d = fechaArchivo(desde, 'inicio');
        const h = fechaArchivo(hasta, 'hoy');
        const nombre = `gastos_impuestos_${d}_${h}`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
    }
    async gastosGasoil(res, desde, hasta, vehiculoId) {
        const idVehiculo = vehiculoId ? Number(vehiculoId) : null;
        const buffer = await this.gasoilServicio.crearPdf(desde, hasta, idVehiculo);
        const d = fechaArchivo(desde, 'inicio');
        const h = fechaArchivo(hasta, 'hoy');
        const nombre = `gastos_gasoil_${d}_${h}`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
    }
    async gasoilEstacionario(res, desde, hasta, vehiculoId) {
        const idVehiculo = vehiculoId ? Number(vehiculoId) : null;
        const buffer = await this.estacionarioServicio.crearPdf(desde, hasta, idVehiculo);
        const d = fechaArchivo(desde, 'inicio');
        const h = fechaArchivo(hasta, 'hoy');
        const nombre = `gasoil_estacionario_${d}_${h}`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
    }
    async relacion(res, tipo, desde, hasta) {
        const valido = relacion_reportes_service_1.TIPOS_RELACION.includes(tipo)
            ? tipo
            : null;
        if (!valido)
            throw new api_exception_1.ApiException(404, `Reporte desconocido: ${tipo}`);
        this.relacionServicio.validarRango(desde, hasta);
        const buffer = await this.relacionServicio.crearPdf(valido, desde, hasta);
        const d = fechaArchivo(desde, 'inicio');
        const h = fechaArchivo(hasta, 'hoy');
        const nombre = `relacion_${valido}_${d}_${h}`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
    }
};
exports.ExportController = ExportController;
__decorate([
    (0, common_1.Get)('xlsx'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('empresaId')),
    __param(2, (0, common_1.Query)('desde')),
    __param(3, (0, common_1.Query)('hasta')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "xlsx", null);
__decorate([
    (0, common_1.Get)('pdf'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('empresaId')),
    __param(2, (0, common_1.Query)('desde')),
    __param(3, (0, common_1.Query)('hasta')),
    __param(4, (0, common_1.Query)('color')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "pdf", null);
__decorate([
    (0, common_1.Get)('reporte'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('empresaId')),
    __param(2, (0, common_1.Query)('desde')),
    __param(3, (0, common_1.Query)('hasta')),
    __param(4, (0, common_1.Query)('direccion')),
    __param(5, (0, common_1.Query)('conMonto')),
    __param(6, (0, common_1.Query)('sinChofer')),
    __param(7, (0, common_1.Query)('color')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "reporte", null);
__decorate([
    (0, common_1.Get)('gastos-varios'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('desde')),
    __param(2, (0, common_1.Query)('hasta')),
    __param(3, (0, common_1.Query)('tituloId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "gastosVarios", null);
__decorate([
    (0, common_1.Get)('gastos-impuestos'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('desde')),
    __param(2, (0, common_1.Query)('hasta')),
    __param(3, (0, common_1.Query)('tituloId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "gastosImpuestos", null);
__decorate([
    (0, common_1.Get)('gastos-gasoil'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('desde')),
    __param(2, (0, common_1.Query)('hasta')),
    __param(3, (0, common_1.Query)('vehiculoId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "gastosGasoil", null);
__decorate([
    (0, common_1.Get)('gasoil-estacionario'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('desde')),
    __param(2, (0, common_1.Query)('hasta')),
    __param(3, (0, common_1.Query)('vehiculoId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "gasoilEstacionario", null);
__decorate([
    (0, common_1.Get)('relacion/:tipo'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Param)('tipo')),
    __param(2, (0, common_1.Query)('desde')),
    __param(3, (0, common_1.Query)('hasta')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "relacion", null);
exports.ExportController = ExportController = __decorate([
    (0, common_1.Controller)('api/export'),
    __metadata("design:paramtypes", [export_service_1.ExportService,
        reporte_empresa_service_1.ReporteEmpresaService,
        empresa_repository_1.EmpresaRepository,
        gastos_varios_service_1.GastosVariosService,
        gastos_impuestos_service_1.GastosImpuestosService,
        gastos_gasoil_service_1.GastosGasoilService,
        gasoil_estacionario_service_1.GasoilEstacionarioService,
        relacion_reportes_service_1.RelacionReportesService])
], ExportController);
//# sourceMappingURL=export.controller.js.map