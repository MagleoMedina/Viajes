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
exports.VehiculoController = exports.VehiculoRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const vehiculo_entity_1 = require("../domain/vehiculo.entity");
const vehiculo_repository_1 = require("../repo/vehiculo.repository");
const viaje_repository_1 = require("../repo/viaje.repository");
const serialize_1 = require("../common/serialize");
const api_exception_1 = require("./api-exception");
class VehiculoRequest {
    marca;
    modelo;
    tipo;
    placa;
}
exports.VehiculoRequest = VehiculoRequest;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'La marca es obligatoria' }),
    __metadata("design:type", String)
], VehiculoRequest.prototype, "marca", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El modelo es obligatorio' }),
    __metadata("design:type", String)
], VehiculoRequest.prototype, "modelo", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El tipo es obligatorio' }),
    __metadata("design:type", String)
], VehiculoRequest.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'La placa es obligatoria' }),
    __metadata("design:type", String)
], VehiculoRequest.prototype, "placa", void 0);
let VehiculoController = class VehiculoController {
    repo;
    viajes;
    constructor(repo, viajes) {
        this.repo = repo;
        this.viajes = viajes;
    }
    listar() {
        return this.repo.findAll().then((lista) => lista.map(serialize_1.vehiculoJson));
    }
    crear(req) {
        const placa = req.placa.trim().toUpperCase();
        return this.validarDuplicado(placa).then(() => {
            const vehiculo = new vehiculo_entity_1.Vehiculo();
            this.aplicar(vehiculo, req, placa);
            return this.repo.save(vehiculo).then(serialize_1.vehiculoJson);
        });
    }
    actualizar(id, req) {
        return this.repo.findById(id).then((vehiculo) => {
            if (!vehiculo)
                throw new api_exception_1.ApiException(404, 'Vehiculo no encontrado');
            const placa = req.placa.trim().toUpperCase();
            return this.validarDuplicado(placa, placa === vehiculo.placa).then(() => {
                this.aplicar(vehiculo, req, placa);
                return this.repo.save(vehiculo).then(serialize_1.vehiculoJson);
            });
        });
    }
    async eliminar(id) {
        if (!(await this.repo.existsById(id))) {
            throw new api_exception_1.ApiException(404, 'Vehiculo no encontrado');
        }
        if (await this.viajes.existsByVehiculoId(id)) {
            await this.repo.ocultar(id);
            return;
        }
        await this.repo.deleteById(id);
    }
    validarDuplicado(placa, esElMismo = false) {
        return this.repo.existsByPlaca(placa).then((existe) => {
            if (existe && !esElMismo) {
                throw new api_exception_1.ApiException(409, 'Ya existe un vehiculo con placa ' + placa);
            }
        });
    }
    aplicar(vehiculo, req, placa) {
        vehiculo.marca = req.marca.trim();
        vehiculo.modelo = req.modelo.trim();
        vehiculo.tipo = req.tipo.trim();
        vehiculo.placa = placa;
    }
};
exports.VehiculoController = VehiculoController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VehiculoController.prototype, "listar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VehiculoRequest]),
    __metadata("design:returntype", void 0)
], VehiculoController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, VehiculoRequest]),
    __metadata("design:returntype", void 0)
], VehiculoController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VehiculoController.prototype, "eliminar", null);
exports.VehiculoController = VehiculoController = __decorate([
    (0, common_1.Controller)('api/vehiculos'),
    __metadata("design:paramtypes", [vehiculo_repository_1.VehiculoRepository,
        viaje_repository_1.ViajeRepository])
], VehiculoController);
//# sourceMappingURL=vehiculos.controller.js.map