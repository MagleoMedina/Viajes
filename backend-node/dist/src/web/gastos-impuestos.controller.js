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
exports.GastoImpuestoController = exports.GastoImpuestoRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const gasto_impuesto_entity_1 = require("../domain/gasto-impuesto.entity");
const gasto_impuesto_repository_1 = require("../repo/gasto-impuesto.repository");
const titulo_impuesto_repository_1 = require("../repo/titulo-impuesto.repository");
const serialize_1 = require("../common/serialize");
const dates_1 = require("../common/dates");
const api_exception_1 = require("./api-exception");
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
class GastoImpuestoRequest {
    tituloImpuestoId;
    fecha;
    numero;
    motivo;
    montoUsd;
    montoBs;
    tasa;
    porcentajeDb;
    referencia;
}
exports.GastoImpuestoRequest = GastoImpuestoRequest;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)({ message: 'El tipo de impuesto es obligatorio' }),
    __metadata("design:type", Number)
], GastoImpuestoRequest.prototype, "tituloImpuestoId", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'La fecha es obligatoria' }),
    __metadata("design:type", String)
], GastoImpuestoRequest.prototype, "fecha", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], GastoImpuestoRequest.prototype, "numero", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GastoImpuestoRequest.prototype, "motivo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El monto en dólares debe ser numérico' }),
    __metadata("design:type", Number)
], GastoImpuestoRequest.prototype, "montoUsd", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El monto en bolívares debe ser numérico' }),
    __metadata("design:type", Number)
], GastoImpuestoRequest.prototype, "montoBs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'La tasa debe ser numérica' }),
    __metadata("design:type", Number)
], GastoImpuestoRequest.prototype, "tasa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El %DB debe ser numérico' }),
    __metadata("design:type", Number)
], GastoImpuestoRequest.prototype, "porcentajeDb", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], GastoImpuestoRequest.prototype, "referencia", void 0);
let GastoImpuestoController = class GastoImpuestoController {
    repo;
    titulos;
    constructor(repo, titulos) {
        this.repo = repo;
        this.titulos = titulos;
    }
    buscar(desde, hasta, tituloId) {
        const id = tituloId ? Number(tituloId) : null;
        return this.repo
            .buscar(id, desde, hasta)
            .then((lista) => lista.map(serialize_1.gastoImpuestoJson));
    }
    async crear(req) {
        if (req.tituloImpuestoId == null) {
            throw new api_exception_1.ApiValidationException({
                tituloImpuestoId: 'El tipo de impuesto es obligatorio',
            });
        }
        this.validarFecha(req.fecha);
        const titulo = await this.titulos.findById(req.tituloImpuestoId);
        if (!titulo)
            throw new api_exception_1.ApiException(404, 'Tipo de impuesto no encontrado');
        const gasto = new gasto_impuesto_entity_1.GastoImpuesto();
        gasto.tituloImpuesto = titulo;
        gasto.fecha = new Date((0, dates_1.dateOnlyToMillis)(req.fecha));
        this.aplicar(gasto, req, true);
        return this.repo.save(gasto).then(serialize_1.gastoImpuestoJson);
    }
    async actualizar(id, req) {
        const gasto = await this.repo.findById(id);
        if (!gasto)
            throw new api_exception_1.ApiException(404, 'Gasto no encontrado');
        this.validarFecha(req.fecha);
        if (req.tituloImpuestoId != null) {
            const titulo = await this.titulos.findById(req.tituloImpuestoId);
            if (!titulo)
                throw new api_exception_1.ApiException(404, 'Tipo de impuesto no encontrado');
            gasto.tituloImpuesto = titulo;
        }
        gasto.fecha = new Date((0, dates_1.dateOnlyToMillis)(req.fecha));
        this.aplicar(gasto, req, false);
        return this.repo.save(gasto).then(serialize_1.gastoImpuestoJson);
    }
    async eliminar(id) {
        if (!(await this.repo.findById(id))) {
            throw new api_exception_1.ApiException(404, 'Gasto no encontrado');
        }
        await this.repo.deleteById(id);
    }
    aplicar(gasto, req, esAlta) {
        if (req.numero !== undefined)
            gasto.numero = req.numero.trim() || '0';
        if (req.motivo !== undefined)
            gasto.motivo = req.motivo.trim();
        if (req.referencia !== undefined)
            gasto.referencia = req.referencia.trim() || '0';
        if (req.tasa !== undefined)
            gasto.tasa = Number(req.tasa) || 0;
        if (req.porcentajeDb !== undefined)
            gasto.porcentajeDb = Number(req.porcentajeDb) || 0;
        if (req.montoUsd !== undefined)
            gasto.montoUsd = Number(req.montoUsd) || 0;
        if (req.montoBs != null && Number.isFinite(Number(req.montoBs))) {
            gasto.montoBs = (0, dates_1.round2)(Number(req.montoBs));
            if (req.montoUsd === undefined)
                gasto.montoUsd = (0, dates_1.usdDesdeBs)(gasto.montoBs, gasto.tasa);
        }
        else if (esAlta || req.montoUsd !== undefined || req.tasa !== undefined) {
            gasto.montoBs = (0, dates_1.round2)((gasto.montoUsd ?? 0) * (gasto.tasa ?? 0));
        }
        if (req.porcentajeDb != null && Number.isFinite(Number(req.porcentajeDb))) {
            gasto.porcentajeDb = Number(req.porcentajeDb);
        }
        else {
            gasto.porcentajeDb = (0, dates_1.round2)((gasto.montoBs ?? 0) * 0.3);
        }
    }
    validarFecha(fecha) {
        if (!fecha || !FECHA_ISO.test(fecha)) {
            throw new api_exception_1.ApiValidationException({ fecha: 'Formato de fecha inválido (AAAA-MM-DD)' });
        }
    }
};
exports.GastoImpuestoController = GastoImpuestoController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('desde')),
    __param(1, (0, common_1.Query)('hasta')),
    __param(2, (0, common_1.Query)('tituloId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], GastoImpuestoController.prototype, "buscar", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GastoImpuestoRequest]),
    __metadata("design:returntype", Promise)
], GastoImpuestoController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, GastoImpuestoRequest]),
    __metadata("design:returntype", Promise)
], GastoImpuestoController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], GastoImpuestoController.prototype, "eliminar", null);
exports.GastoImpuestoController = GastoImpuestoController = __decorate([
    (0, common_1.Controller)('api/gastos-impuestos'),
    __metadata("design:paramtypes", [gasto_impuesto_repository_1.GastoImpuestoRepository,
        titulo_impuesto_repository_1.TituloImpuestoRepository])
], GastoImpuestoController);
//# sourceMappingURL=gastos-impuestos.controller.js.map