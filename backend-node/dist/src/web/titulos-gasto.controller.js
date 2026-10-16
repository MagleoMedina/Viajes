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
exports.TituloGastoController = exports.TituloGastoRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const titulo_gasto_entity_1 = require("../domain/titulo-gasto.entity");
const titulo_gasto_repository_1 = require("../repo/titulo-gasto.repository");
const gasto_vario_repository_1 = require("../repo/gasto-vario.repository");
const serialize_1 = require("../common/serialize");
const api_exception_1 = require("./api-exception");
class TituloGastoRequest {
    nombre;
}
exports.TituloGastoRequest = TituloGastoRequest;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre del título es obligatorio' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], TituloGastoRequest.prototype, "nombre", void 0);
let TituloGastoController = class TituloGastoController {
    repo;
    gastos;
    constructor(repo, gastos) {
        this.repo = repo;
        this.gastos = gastos;
    }
    listar() {
        return this.repo.findAllByOrderByNombreAsc().then((lista) => lista.map(serialize_1.tituloGastoJson));
    }
    crear(req) {
        const nombre = req.nombre.trim();
        return this.validarDuplicado(nombre).then(() => {
            const titulo = new titulo_gasto_entity_1.TituloGasto();
            titulo.nombre = nombre;
            return this.repo.save(titulo).then(serialize_1.tituloGastoJson);
        });
    }
    actualizar(id, req) {
        return this.repo.findById(id).then((titulo) => {
            if (!titulo)
                throw new api_exception_1.ApiException(404, 'Título de gasto no encontrado');
            const nombre = req.nombre.trim();
            return this.validarDuplicado(nombre, nombre.toLowerCase() === titulo.nombre.toLowerCase()).then(() => {
                titulo.nombre = nombre;
                return this.repo.save(titulo).then(serialize_1.tituloGastoJson);
            });
        });
    }
    async eliminar(id) {
        if (!(await this.repo.existsById(id))) {
            throw new api_exception_1.ApiException(404, 'Título de gasto no encontrado');
        }
        if (await this.gastos.existsByTituloGastoId(id)) {
            throw new api_exception_1.ApiException(409, 'El título está en uso por gastos registrados');
        }
        await this.repo.deleteById(id);
    }
    validarDuplicado(nombre, esLaMisma = false) {
        return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
            if (existe && !esLaMisma) {
                throw new api_exception_1.ApiException(409, 'Ya existe el título ' + nombre);
            }
        });
    }
};
exports.TituloGastoController = TituloGastoController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TituloGastoController.prototype, "listar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TituloGastoRequest]),
    __metadata("design:returntype", void 0)
], TituloGastoController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, TituloGastoRequest]),
    __metadata("design:returntype", void 0)
], TituloGastoController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], TituloGastoController.prototype, "eliminar", null);
exports.TituloGastoController = TituloGastoController = __decorate([
    (0, common_1.Controller)('api/titulos-gasto'),
    __metadata("design:paramtypes", [titulo_gasto_repository_1.TituloGastoRepository,
        gasto_vario_repository_1.GastoVarioRepository])
], TituloGastoController);
//# sourceMappingURL=titulos-gasto.controller.js.map