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
exports.TituloViajeController = exports.TituloViajeRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const titulo_viaje_entity_1 = require("../domain/titulo-viaje.entity");
const titulo_viaje_repository_1 = require("../repo/titulo-viaje.repository");
const serialize_1 = require("../common/serialize");
const api_exception_1 = require("./api-exception");
class TituloViajeRequest {
    nombre;
}
exports.TituloViajeRequest = TituloViajeRequest;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre del título es obligatorio' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], TituloViajeRequest.prototype, "nombre", void 0);
let TituloViajeController = class TituloViajeController {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    listar() {
        return this.repo.findAll().then((lista) => lista.map(serialize_1.tituloViajeJson));
    }
    crear(req) {
        const nombre = req.nombre.trim();
        if (!nombre) {
            throw new api_exception_1.ApiException(400, 'El nombre del título es obligatorio');
        }
        return this.validarDuplicado(nombre).then(() => {
            const titulo = new titulo_viaje_entity_1.TituloViaje();
            titulo.nombre = nombre;
            return this.repo.save(titulo).then(serialize_1.tituloViajeJson);
        });
    }
    actualizar(id, req) {
        return this.repo.findById(id).then((titulo) => {
            if (!titulo)
                throw new api_exception_1.ApiException(404, 'Título de viaje no encontrado');
            const nombre = req.nombre.trim();
            if (!nombre) {
                throw new api_exception_1.ApiException(400, 'El nombre del título es obligatorio');
            }
            return this.validarDuplicado(nombre, nombre.toLowerCase() === titulo.nombre.toLowerCase()).then(() => {
                titulo.nombre = nombre;
                return this.repo.save(titulo).then(serialize_1.tituloViajeJson);
            });
        });
    }
    async eliminar(id) {
        if (!(await this.repo.existsById(id))) {
            throw new api_exception_1.ApiException(404, 'Título de viaje no encontrado');
        }
        await this.repo.ocultar(id);
    }
    validarDuplicado(nombre, esLaMisma = false) {
        return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
            if (existe && !esLaMisma) {
                throw new api_exception_1.ApiException(409, 'Ya existe el título ' + nombre);
            }
        });
    }
};
exports.TituloViajeController = TituloViajeController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TituloViajeController.prototype, "listar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TituloViajeRequest]),
    __metadata("design:returntype", void 0)
], TituloViajeController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, TituloViajeRequest]),
    __metadata("design:returntype", void 0)
], TituloViajeController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], TituloViajeController.prototype, "eliminar", null);
exports.TituloViajeController = TituloViajeController = __decorate([
    (0, common_1.Controller)('api/titulos-viaje'),
    __metadata("design:paramtypes", [titulo_viaje_repository_1.TituloViajeRepository])
], TituloViajeController);
//# sourceMappingURL=titulos-viaje.controller.js.map