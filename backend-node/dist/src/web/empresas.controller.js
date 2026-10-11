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
exports.EmpresaController = exports.EmpresaRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const empresa_entity_1 = require("../domain/empresa.entity");
const empresa_repository_1 = require("../repo/empresa.repository");
const viaje_repository_1 = require("../repo/viaje.repository");
const serialize_1 = require("../common/serialize");
const api_exception_1 = require("./api-exception");
class EmpresaRequest {
    nombre;
}
exports.EmpresaRequest = EmpresaRequest;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre es obligatorio' }),
    __metadata("design:type", String)
], EmpresaRequest.prototype, "nombre", void 0);
let EmpresaController = class EmpresaController {
    repo;
    viajes;
    constructor(repo, viajes) {
        this.repo = repo;
        this.viajes = viajes;
    }
    listar() {
        return this.repo.findAllByOrderByNombreAsc().then((lista) => lista.map(serialize_1.empresaJson));
    }
    crear(req) {
        const nombre = req.nombre.trim();
        return this.validarDuplicado(nombre).then(() => {
            const empresa = new empresa_entity_1.Empresa();
            empresa.nombre = nombre;
            return this.repo.save(empresa).then(serialize_1.empresaJson);
        });
    }
    actualizar(id, req) {
        return this.repo.findById(id).then((empresa) => {
            if (!empresa)
                throw new api_exception_1.ApiException(404, 'Empresa no encontrada');
            const nombre = req.nombre.trim();
            return this.validarDuplicado(nombre, nombre.toLowerCase() === empresa.nombre?.toLowerCase()).then(() => {
                empresa.nombre = nombre;
                return this.repo.save(empresa).then(serialize_1.empresaJson);
            });
        });
    }
    async eliminar(id) {
        if (!(await this.repo.existsById(id))) {
            throw new api_exception_1.ApiException(404, 'Empresa no encontrada');
        }
        if (await this.viajes.existsByEmpresaId(id)) {
            throw new api_exception_1.ApiException(409, 'No se puede eliminar: la empresa se usa en viajes registrados');
        }
        await this.repo.deleteById(id);
    }
    validarDuplicado(nombre, esLaMisma = false) {
        return this.repo.existsByNombreIgnoreCase(nombre).then((existe) => {
            if (existe && !esLaMisma) {
                throw new api_exception_1.ApiException(409, 'Ya existe la empresa ' + nombre);
            }
        });
    }
};
exports.EmpresaController = EmpresaController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EmpresaController.prototype, "listar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [EmpresaRequest]),
    __metadata("design:returntype", void 0)
], EmpresaController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, EmpresaRequest]),
    __metadata("design:returntype", void 0)
], EmpresaController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EmpresaController.prototype, "eliminar", null);
exports.EmpresaController = EmpresaController = __decorate([
    (0, common_1.Controller)('api/empresas'),
    __metadata("design:paramtypes", [empresa_repository_1.EmpresaRepository,
        viaje_repository_1.ViajeRepository])
], EmpresaController);
//# sourceMappingURL=empresas.controller.js.map