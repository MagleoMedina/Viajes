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
exports.TituloImpuestoController = exports.TituloImpuestoRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const titulo_impuesto_entity_1 = require("../domain/titulo-impuesto.entity");
const titulo_impuesto_repository_1 = require("../repo/titulo-impuesto.repository");
const gasto_impuesto_repository_1 = require("../repo/gasto-impuesto.repository");
const serialize_1 = require("../common/serialize");
const api_exception_1 = require("./api-exception");
class TituloImpuestoRequest {
    nombre;
}
exports.TituloImpuestoRequest = TituloImpuestoRequest;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre del tipo de impuesto es obligatorio' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], TituloImpuestoRequest.prototype, "nombre", void 0);
let TituloImpuestoController = class TituloImpuestoController {
    repo;
    gastos;
    constructor(repo, gastos) {
        this.repo = repo;
        this.gastos = gastos;
    }
    listar() {
        return this.repo
            .findAllByOrderByNombreAsc()
            .then((lista) => lista.map(serialize_1.tituloImpuestoJson));
    }
    crear(req) {
        const nombre = req.nombre.trim();
        return this.validarDuplicado(nombre).then(() => {
            const titulo = new titulo_impuesto_entity_1.TituloImpuesto();
            titulo.nombre = nombre;
            return this.repo.save(titulo).then(serialize_1.tituloImpuestoJson);
        });
    }
    actualizar(id, req) {
        return this.repo.findById(id).then((titulo) => {
            if (!titulo)
                throw new api_exception_1.ApiException(404, 'Tipo de impuesto no encontrado');
            const nombre = req.nombre.trim();
            return this.validarDuplicado(nombre, nombre.toLowerCase() === titulo.nombre.toLowerCase()).then(() => {
                titulo.nombre = nombre;
                return this.repo.save(titulo).then(serialize_1.tituloImpuestoJson);
            });
        });
    }
    async eliminar(id) {
        if (!(await this.repo.existsById(id))) {
            throw new api_exception_1.ApiException(404, 'Tipo de impuesto no encontrado');
        }
        if (await this.gastos.existsByTituloImpuestoId(id)) {
            throw new api_exception_1.ApiException(409, 'El tipo de impuesto está en uso por gastos registrados');
        }
        await this.repo.deleteById(id);
    }
    validarDuplicado(nombre, esLaMisma = false) {
        return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
            if (existe && !esLaMisma) {
                throw new api_exception_1.ApiException(409, 'Ya existe el tipo de impuesto ' + nombre);
            }
        });
    }
};
exports.TituloImpuestoController = TituloImpuestoController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TituloImpuestoController.prototype, "listar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TituloImpuestoRequest]),
    __metadata("design:returntype", void 0)
], TituloImpuestoController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, TituloImpuestoRequest]),
    __metadata("design:returntype", void 0)
], TituloImpuestoController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], TituloImpuestoController.prototype, "eliminar", null);
exports.TituloImpuestoController = TituloImpuestoController = __decorate([
    (0, common_1.Controller)('api/titulos-impuesto'),
    __metadata("design:paramtypes", [titulo_impuesto_repository_1.TituloImpuestoRepository,
        gasto_impuesto_repository_1.GastoImpuestoRepository])
], TituloImpuestoController);
//# sourceMappingURL=titulos-impuesto.controller.js.map