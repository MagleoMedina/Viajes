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
exports.GasoilEstacionarioController = exports.GasoilEstacionarioRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const gasoil_estacionario_entity_1 = require("../domain/gasoil-estacionario.entity");
const gasoil_estacionario_repository_1 = require("../repo/gasoil-estacionario.repository");
const vehiculo_repository_1 = require("../repo/vehiculo.repository");
const stock_gasoil_service_1 = require("../service/stock-gasoil.service");
const serialize_1 = require("../common/serialize");
const dates_1 = require("../common/dates");
const api_exception_1 = require("./api-exception");
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
class GasoilEstacionarioRequest {
    vehiculoId;
    fecha;
    litros;
    referencia;
    motivo;
}
exports.GasoilEstacionarioRequest = GasoilEstacionarioRequest;
__decorate([
    (0, class_validator_1.IsInt)({ message: 'El vehículo es obligatorio' }),
    __metadata("design:type", Number)
], GasoilEstacionarioRequest.prototype, "vehiculoId", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'La fecha es obligatoria' }),
    __metadata("design:type", String)
], GasoilEstacionarioRequest.prototype, "fecha", void 0);
__decorate([
    (0, class_validator_1.IsNumber)({}, { message: 'Los litros deben ser numéricos' }),
    __metadata("design:type", Number)
], GasoilEstacionarioRequest.prototype, "litros", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], GasoilEstacionarioRequest.prototype, "referencia", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GasoilEstacionarioRequest.prototype, "motivo", void 0);
let GasoilEstacionarioController = class GasoilEstacionarioController {
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
        return this.repo
            .buscar(id, desde, hasta)
            .then((lista) => lista.map(serialize_1.gasoilEstacionarioJson));
    }
    async crear(req) {
        this.validarFecha(req.fecha);
        const litros = this.validarLitros(req.litros);
        const vehiculo = await this.buscarVehiculo(req.vehiculoId);
        const stock = await this.stockGasoil.global();
        if (litros > stock.disponible) {
            throw new api_exception_1.ApiException(400, `Los litros exceden el gasoil disponible (disponible: ${Math.max(0, stock.disponible)} L)`);
        }
        const consumo = new gasoil_estacionario_entity_1.GasoilEstacionario();
        consumo.vehiculo = vehiculo;
        consumo.fecha = new Date((0, dates_1.dateOnlyToMillis)(req.fecha));
        consumo.litros = litros;
        consumo.referencia = (req.referencia ?? '').trim() || '0';
        consumo.motivo = (req.motivo ?? '').trim();
        return this.repo.save(consumo).then(serialize_1.gasoilEstacionarioJson);
    }
    async actualizar(id, req) {
        const consumo = await this.repo.findById(id);
        if (!consumo)
            throw new api_exception_1.ApiException(404, 'Consumo estacionario no encontrado');
        this.validarFecha(req.fecha);
        const litros = this.validarLitros(req.litros);
        const vehiculo = await this.buscarVehiculo(req.vehiculoId);
        const litrosAntes = Number(consumo.litros) || 0;
        const stock = await this.stockGasoil.global();
        const disponible = (0, dates_1.round2)(stock.disponible + litrosAntes);
        if (litros > disponible) {
            throw new api_exception_1.ApiException(400, `Los litros exceden el gasoil disponible (disponible: ${Math.max(0, disponible)} L)`);
        }
        consumo.vehiculo = vehiculo;
        consumo.fecha = new Date((0, dates_1.dateOnlyToMillis)(req.fecha));
        consumo.litros = litros;
        consumo.referencia = (req.referencia ?? '').trim() || '0';
        consumo.motivo = (req.motivo ?? '').trim();
        return this.repo.save(consumo).then(serialize_1.gasoilEstacionarioJson);
    }
    async eliminar(id) {
        if (!(await this.repo.findById(id))) {
            throw new api_exception_1.ApiException(404, 'Consumo estacionario no encontrado');
        }
        await this.repo.deleteById(id);
    }
    validarFecha(fecha) {
        if (!fecha || !FECHA_ISO.test(fecha)) {
            throw new api_exception_1.ApiValidationException({ fecha: 'Formato de fecha inválido (AAAA-MM-DD)' });
        }
    }
    validarLitros(valor) {
        const litros = (0, dates_1.round2)(Number(valor));
        if (!Number.isFinite(litros) || litros <= 0) {
            throw new api_exception_1.ApiValidationException({ litros: 'Los litros deben ser mayores a 0' });
        }
        return litros;
    }
    async buscarVehiculo(id) {
        if (id == null || !Number.isFinite(Number(id))) {
            throw new api_exception_1.ApiValidationException({ vehiculoId: 'El vehículo es obligatorio' });
        }
        const vehiculo = await this.vehiculos.findById(Number(id));
        if (!vehiculo)
            throw new api_exception_1.ApiException(404, 'Vehículo no encontrado');
        return vehiculo;
    }
};
exports.GasoilEstacionarioController = GasoilEstacionarioController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('desde')),
    __param(1, (0, common_1.Query)('hasta')),
    __param(2, (0, common_1.Query)('vehiculoId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], GasoilEstacionarioController.prototype, "buscar", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GasoilEstacionarioRequest]),
    __metadata("design:returntype", Promise)
], GasoilEstacionarioController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, GasoilEstacionarioRequest]),
    __metadata("design:returntype", Promise)
], GasoilEstacionarioController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], GasoilEstacionarioController.prototype, "eliminar", null);
exports.GasoilEstacionarioController = GasoilEstacionarioController = __decorate([
    (0, common_1.Controller)('api/gasoil-estacionario'),
    __metadata("design:paramtypes", [gasoil_estacionario_repository_1.GasoilEstacionarioRepository,
        vehiculo_repository_1.VehiculoRepository,
        stock_gasoil_service_1.StockGasoilService])
], GasoilEstacionarioController);
//# sourceMappingURL=gasoil-estacionario.controller.js.map