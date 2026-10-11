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
exports.RecorridoController = exports.RecorridoRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const recorrido_entity_1 = require("../domain/recorrido.entity");
const recorrido_repository_1 = require("../repo/recorrido.repository");
const serialize_1 = require("../common/serialize");
const api_exception_1 = require("./api-exception");
class RecorridoRequest {
    nombre;
}
exports.RecorridoRequest = RecorridoRequest;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El recorrido es obligatorio' }),
    __metadata("design:type", String)
], RecorridoRequest.prototype, "nombre", void 0);
let RecorridoController = class RecorridoController {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    listar() {
        return this.repo.findAllByOrderByNombreAsc().then((lista) => lista.map(serialize_1.recorridoJson));
    }
    crear(req) {
        const nombre = req.nombre.trim();
        return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
            if (existe)
                throw new api_exception_1.ApiException(409, 'Ya existe el recorrido ' + nombre);
            const recorrido = new recorrido_entity_1.Recorrido();
            recorrido.nombre = nombre;
            return this.repo.save(recorrido).then(serialize_1.recorridoJson);
        });
    }
    async eliminar(id) {
        if (!(await this.repo.existsById(id))) {
            throw new api_exception_1.ApiException(404, 'Recorrido no encontrado');
        }
        await this.repo.deleteById(id);
    }
};
exports.RecorridoController = RecorridoController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RecorridoController.prototype, "listar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RecorridoRequest]),
    __metadata("design:returntype", void 0)
], RecorridoController.prototype, "crear", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], RecorridoController.prototype, "eliminar", null);
exports.RecorridoController = RecorridoController = __decorate([
    (0, common_1.Controller)('api/recorridos'),
    __metadata("design:paramtypes", [recorrido_repository_1.RecorridoRepository])
], RecorridoController);
//# sourceMappingURL=recorridos.controller.js.map