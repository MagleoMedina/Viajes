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
exports.GastoGasoilController = exports.GastoGasoilRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const gasto_gasoil_entity_1 = require("../domain/gasto-gasoil.entity");
const gasto_gasoil_repository_1 = require("../repo/gasto-gasoil.repository");
const vehiculo_repository_1 = require("../repo/vehiculo.repository");
const stock_gasoil_service_1 = require("../service/stock-gasoil.service");
const serialize_1 = require("../common/serialize");
const dates_1 = require("../common/dates");
const api_exception_1 = require("./api-exception");
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
class GastoGasoilRequest {
    vehiculoId;
    fecha;
    estacion;
    litros;
    precioLitro;
    montoUsd;
    montoBs;
    tasa;
    referencia;
}
exports.GastoGasoilRequest = GastoGasoilRequest;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)({ message: 'El vehículo debe ser un id válido' }),
    __metadata("design:type", Object)
], GastoGasoilRequest.prototype, "vehiculoId", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'La fecha es obligatoria' }),
    __metadata("design:type", String)
], GastoGasoilRequest.prototype, "fecha", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], GastoGasoilRequest.prototype, "estacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'Los litros deben ser numéricos' }),
    __metadata("design:type", Number)
], GastoGasoilRequest.prototype, "litros", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El precio por litro debe ser numérico' }),
    __metadata("design:type", Number)
], GastoGasoilRequest.prototype, "precioLitro", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El monto en dólares debe ser numérico' }),
    __metadata("design:type", Number)
], GastoGasoilRequest.prototype, "montoUsd", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El monto en bolívares debe ser numérico' }),
    __metadata("design:type", Number)
], GastoGasoilRequest.prototype, "montoBs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'La tasa debe ser numérica' }),
    __metadata("design:type", Number)
], GastoGasoilRequest.prototype, "tasa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], GastoGasoilRequest.prototype, "referencia", void 0);
let GastoGasoilController = class GastoGasoilController {
    repo;
    vehiculos;
    stockGasoil;
    constructor(repo, vehiculos, stockGasoil) {
        this.repo = repo;
        this.vehiculos = vehiculos;
        this.stockGasoil = stockGasoil;
    }
    buscar(desde, hasta, vehiculoId) {
        const id = vehiculoId ? Number(vehiculoId) : null;
        return this.repo.buscar(id, desde, hasta).then((lista) => lista.map(serialize_1.gastoGasoilJson));
    }
    stock(excluirViajeId) {
        const excluido = excluirViajeId ? Number(excluirViajeId) : null;
        return this.stockGasoil.global(excluido);
    }
    async crear(req) {
        this.validarFecha(req.fecha);
        const vehiculo = await this.buscarVehiculo(req.vehiculoId);
        const gasto = new gasto_gasoil_entity_1.GastoGasoil();
        gasto.vehiculo = vehiculo;
        gasto.fecha = new Date((0, dates_1.dateOnlyToMillis)(req.fecha));
        this.aplicar(gasto, req, true);
        return this.repo.save(gasto).then(serialize_1.gastoGasoilJson);
    }
    async actualizar(id, req) {
        const gasto = await this.repo.findById(id);
        if (!gasto)
            throw new api_exception_1.ApiException(404, 'Gasto de gasoil no encontrado');
        this.validarFecha(req.fecha);
        const litrosAntes = gasto.litros ?? 0;
        if (req.vehiculoId === null) {
            gasto.vehiculo = null;
        }
        else if (req.vehiculoId != null) {
            gasto.vehiculo = await this.buscarVehiculo(req.vehiculoId);
        }
        gasto.fecha = new Date((0, dates_1.dateOnlyToMillis)(req.fecha));
        this.aplicar(gasto, req, false);
        await this.validarStockEdicion(gasto.litros ?? 0, litrosAntes);
        return this.repo.save(gasto).then(serialize_1.gastoGasoilJson);
    }
    async eliminar(id) {
        if (!(await this.repo.findById(id))) {
            throw new api_exception_1.ApiException(404, 'Gasto de gasoil no encontrado');
        }
        await this.repo.deleteById(id);
    }
    aplicar(gasto, req, esAlta) {
        if (req.estacion !== undefined)
            gasto.estacion = req.estacion.trim();
        if (req.referencia !== undefined)
            gasto.referencia = req.referencia.trim() || '0';
        if (req.tasa !== undefined)
            gasto.tasa = Number(req.tasa) || 0;
        if (req.litros !== undefined)
            gasto.litros = Number(req.litros) || 0;
        if (req.precioLitro !== undefined)
            gasto.precioLitro = Number(req.precioLitro) || 0;
        if (req.montoUsd != null && Number.isFinite(Number(req.montoUsd))) {
            gasto.montoUsd = Number(req.montoUsd);
        }
        else if (req.litros !== undefined ||
            req.precioLitro !== undefined ||
            (esAlta && (gasto.litros ?? 0) > 0)) {
            gasto.montoUsd = (0, dates_1.round2)((gasto.litros ?? 0) * (gasto.precioLitro ?? 0));
        }
        if (req.montoBs != null && Number.isFinite(Number(req.montoBs))) {
            gasto.montoBs = (0, dates_1.round2)(Number(req.montoBs));
        }
        else if (esAlta || req.montoUsd !== undefined || req.tasa !== undefined) {
            gasto.montoBs = (0, dates_1.round2)((gasto.montoUsd ?? 0) * (gasto.tasa ?? 0));
        }
    }
    validarFecha(fecha) {
        if (!fecha || !FECHA_ISO.test(fecha)) {
            throw new api_exception_1.ApiValidationException({ fecha: 'Formato de fecha inválido (AAAA-MM-DD)' });
        }
    }
    async buscarVehiculo(id) {
        if (id == null)
            return null;
        const vehiculo = await this.vehiculos.findById(id);
        if (!vehiculo)
            throw new api_exception_1.ApiException(404, 'Vehículo no encontrado');
        return vehiculo;
    }
    async validarStockEdicion(litrosNuevos, litrosAntes) {
        const stock = await this.stockGasoil.global(null);
        const stockTras = (0, dates_1.round2)(stock.disponible - litrosAntes + litrosNuevos);
        if (stockTras < 0) {
            throw new api_exception_1.ApiValidationException({
                litros: 'La edición dejaría el stock de gasoil en negativo',
            });
        }
    }
};
exports.GastoGasoilController = GastoGasoilController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('desde')),
    __param(1, (0, common_1.Query)('hasta')),
    __param(2, (0, common_1.Query)('vehiculoId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], GastoGasoilController.prototype, "buscar", null);
__decorate([
    (0, common_1.Get)('stock'),
    __param(0, (0, common_1.Query)('excluirViajeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GastoGasoilController.prototype, "stock", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GastoGasoilRequest]),
    __metadata("design:returntype", Promise)
], GastoGasoilController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, GastoGasoilRequest]),
    __metadata("design:returntype", Promise)
], GastoGasoilController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], GastoGasoilController.prototype, "eliminar", null);
exports.GastoGasoilController = GastoGasoilController = __decorate([
    (0, common_1.Controller)('api/gastos-gasoil'),
    __metadata("design:paramtypes", [gasto_gasoil_repository_1.GastoGasoilRepository,
        vehiculo_repository_1.VehiculoRepository,
        stock_gasoil_service_1.StockGasoilService])
], GastoGasoilController);
//# sourceMappingURL=gastos-gasoil.controller.js.map