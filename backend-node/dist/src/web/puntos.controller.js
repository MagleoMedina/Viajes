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
exports.PuntoController = exports.PuntoRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const punto_entity_1 = require("../domain/punto.entity");
const punto_repository_1 = require("../repo/punto.repository");
const viaje_repository_1 = require("../repo/viaje.repository");
const serialize_1 = require("../common/serialize");
const api_exception_1 = require("./api-exception");
class PuntoRequest {
    nombre;
}
exports.PuntoRequest = PuntoRequest;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre del punto es obligatorio' }),
    __metadata("design:type", String)
], PuntoRequest.prototype, "nombre", void 0);
let PuntoController = class PuntoController {
    repo;
    viajes;
    constructor(repo, viajes) {
        this.repo = repo;
        this.viajes = viajes;
    }
    listar() {
        return this.repo.findAllByOrderByNombreAsc().then((lista) => lista.map(serialize_1.puntoJson));
    }
    crear(req) {
        const nombre = req.nombre.trim();
        return this.validarDuplicado(nombre).then(() => {
            const punto = new punto_entity_1.Punto();
            punto.nombre = nombre;
            return this.repo.save(punto).then(serialize_1.puntoJson);
        });
    }
    actualizar(id, req) {
        return this.repo.findById(id).then((punto) => {
            if (!punto)
                throw new api_exception_1.ApiException(404, 'Punto no encontrado');
            const nombre = req.nombre.trim();
            return this.validarDuplicado(nombre, nombre.toLowerCase() === punto.nombre?.toLowerCase()).then(() => {
                punto.nombre = nombre;
                return this.repo.save(punto).then(serialize_1.puntoJson);
            });
        });
    }
    async eliminar(id) {
        if (!(await this.repo.existsById(id))) {
            throw new api_exception_1.ApiException(404, 'Punto no encontrado');
        }
        if ((await this.viajes.existsByPuntoSalidaId(id)) ||
            (await this.viajes.existsByPuntoLlegadaId(id))) {
            throw new api_exception_1.ApiException(409, 'No se puede eliminar: el punto se usa en viajes registrados');
        }
        await this.repo.deleteById(id);
    }
    validarDuplicado(nombre, esElMismo = false) {
        return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
            if (existe && !esElMismo) {
                throw new api_exception_1.ApiException(409, 'Ya existe el punto ' + nombre);
            }
        });
    }
};
exports.PuntoController = PuntoController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PuntoController.prototype, "listar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PuntoRequest]),
    __metadata("design:returntype", void 0)
], PuntoController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, PuntoRequest]),
    __metadata("design:returntype", void 0)
], PuntoController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PuntoController.prototype, "eliminar", null);
exports.PuntoController = PuntoController = __decorate([
    (0, common_1.Controller)('api/puntos'),
    __metadata("design:paramtypes", [punto_repository_1.PuntoRepository,
        viaje_repository_1.ViajeRepository])
], PuntoController);
//# sourceMappingURL=puntos.controller.js.map