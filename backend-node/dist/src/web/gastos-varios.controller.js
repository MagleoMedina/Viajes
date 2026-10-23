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
exports.GastoVarioController = exports.GastoVarioRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const gasto_vario_entity_1 = require("../domain/gasto-vario.entity");
const gasto_vario_repository_1 = require("../repo/gasto-vario.repository");
const titulo_gasto_repository_1 = require("../repo/titulo-gasto.repository");
const serialize_1 = require("../common/serialize");
const dates_1 = require("../common/dates");
const api_exception_1 = require("./api-exception");
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
class GastoVarioRequest {
    tituloGastoId;
    fecha;
    numero;
    motivo;
    montoUsd;
    montoBs;
    tasa;
    porcentajeDb;
    referencia;
}
exports.GastoVarioRequest = GastoVarioRequest;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)({ message: 'El título del gasto es obligatorio' }),
    __metadata("design:type", Number)
], GastoVarioRequest.prototype, "tituloGastoId", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'La fecha es obligatoria' }),
    __metadata("design:type", String)
], GastoVarioRequest.prototype, "fecha", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], GastoVarioRequest.prototype, "numero", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GastoVarioRequest.prototype, "motivo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El monto en dólares debe ser numérico' }),
    __metadata("design:type", Number)
], GastoVarioRequest.prototype, "montoUsd", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El monto en bolívares debe ser numérico' }),
    __metadata("design:type", Number)
], GastoVarioRequest.prototype, "montoBs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'La tasa debe ser numérica' }),
    __metadata("design:type", Number)
], GastoVarioRequest.prototype, "tasa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El %DB debe ser numérico' }),
    __metadata("design:type", Number)
], GastoVarioRequest.prototype, "porcentajeDb", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], GastoVarioRequest.prototype, "referencia", void 0);
let GastoVarioController = class GastoVarioController {
    repo;
    titulos;
    constructor(repo, titulos) {
        this.repo = repo;
        this.titulos = titulos;
    }
    buscar(desde, hasta, tituloId) {
        const id = tituloId ? Number(tituloId) : null;
        return this.repo.buscar(id, desde, hasta).then((lista) => lista.map(serialize_1.gastoVarioJson));
    }
    async crear(req) {
        if (req.tituloGastoId == null) {
            throw new api_exception_1.ApiValidationException({ tituloGastoId: 'El título del gasto es obligatorio' });
        }
        this.validarFecha(req.fecha);
        const titulo = await this.titulos.findById(req.tituloGastoId);
        if (!titulo)
            throw new api_exception_1.ApiException(404, 'Título de gasto no encontrado');
        const gasto = new gasto_vario_entity_1.GastoVario();
        gasto.tituloGasto = titulo;
        this.aplicar(gasto, req, true);
        return this.repo.save(gasto).then(serialize_1.gastoVarioJson);
    }
    async actualizar(id, req) {
        const gasto = await this.repo.findById(id);
        if (!gasto)
            throw new api_exception_1.ApiException(404, 'Gasto no encontrado');
        this.validarFecha(req.fecha);
        if (req.tituloGastoId != null) {
            const titulo = await this.titulos.findById(req.tituloGastoId);
            if (!titulo)
                throw new api_exception_1.ApiException(404, 'Título de gasto no encontrado');
            gasto.tituloGasto = titulo;
        }
        this.aplicar(gasto, req, false);
        return this.repo.save(gasto).then(serialize_1.gastoVarioJson);
    }
    async eliminar(id) {
        if (!(await this.repo.findById(id))) {
            throw new api_exception_1.ApiException(404, 'Gasto no encontrado');
        }
        await this.repo.deleteById(id);
    }
    aplicar(gasto, req, esAlta) {
        if (!esAlta || req.fecha) {
            gasto.fecha = new Date((0, dates_1.dateOnlyToMillis)(req.fecha));
        }
        if (req.numero !== undefined)
            gasto.numero = req.numero.trim() || '0';
        if (req.motivo !== undefined)
            gasto.motivo = req.motivo.trim();
        if (req.referencia !== undefined)
            gasto.referencia = req.referencia.trim() || '0';
        if (req.tasa !== undefined)
            gasto.tasa = Number(req.tasa) || 0;
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
exports.GastoVarioController = GastoVarioController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('desde')),
    __param(1, (0, common_1.Query)('hasta')),
    __param(2, (0, common_1.Query)('tituloId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], GastoVarioController.prototype, "buscar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GastoVarioRequest]),
    __metadata("design:returntype", Promise)
], GastoVarioController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, GastoVarioRequest]),
    __metadata("design:returntype", Promise)
], GastoVarioController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], GastoVarioController.prototype, "eliminar", null);
exports.GastoVarioController = GastoVarioController = __decorate([
    (0, common_1.Controller)('api/gastos-varios'),
    __metadata("design:paramtypes", [gasto_vario_repository_1.GastoVarioRepository,
        titulo_gasto_repository_1.TituloGastoRepository])
], GastoVarioController);
//# sourceMappingURL=gastos-varios.controller.js.map