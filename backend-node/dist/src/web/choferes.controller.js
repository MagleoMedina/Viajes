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
exports.ChoferController = exports.ChoferRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const chofer_entity_1 = require("../domain/chofer.entity");
const chofer_repository_1 = require("../repo/chofer.repository");
const viaje_repository_1 = require("../repo/viaje.repository");
const serialize_1 = require("../common/serialize");
const api_exception_1 = require("./api-exception");
class ChoferRequest {
    nombre;
    apellido;
    cedula;
}
exports.ChoferRequest = ChoferRequest;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre es obligatorio' }),
    __metadata("design:type", String)
], ChoferRequest.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El apellido es obligatorio' }),
    __metadata("design:type", String)
], ChoferRequest.prototype, "apellido", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'La cedula es obligatoria' }),
    __metadata("design:type", String)
], ChoferRequest.prototype, "cedula", void 0);
let ChoferController = class ChoferController {
    repo;
    viajes;
    constructor(repo, viajes) {
        this.repo = repo;
        this.viajes = viajes;
    }
    listar() {
        return this.repo.findAll().then((lista) => lista.map(serialize_1.choferJson));
    }
    crear(req) {
        const cedula = req.cedula.trim();
        return this.validarDuplicado(cedula).then(() => {
            const chofer = new chofer_entity_1.Chofer();
            this.aplicar(chofer, req, cedula);
            return this.repo.save(chofer).then(serialize_1.choferJson);
        });
    }
    actualizar(id, req) {
        return this.repo.findById(id).then((chofer) => {
            if (!chofer)
                throw new api_exception_1.ApiException(404, 'Chofer no encontrado');
            const cedula = req.cedula.trim();
            return this.validarDuplicado(cedula, cedula === chofer.cedula).then(() => {
                this.aplicar(chofer, req, cedula);
                return this.repo.save(chofer).then(serialize_1.choferJson);
            });
        });
    }
    async eliminar(id) {
        if (!(await this.repo.existsById(id))) {
            throw new api_exception_1.ApiException(404, 'Chofer no encontrado');
        }
        if (await this.viajes.existsByChoferId(id)) {
            throw new api_exception_1.ApiException(409, 'No se puede eliminar: el chofer tiene viajes registrados');
        }
        await this.repo.deleteById(id);
    }
    validarDuplicado(cedula, esElMismo = false) {
        return this.repo.existsByCedula(cedula).then((existe) => {
            if (existe && !esElMismo) {
                throw new api_exception_1.ApiException(409, 'Ya existe un chofer con cedula ' + cedula);
            }
        });
    }
    aplicar(chofer, req, cedula) {
        chofer.nombre = req.nombre.trim();
        chofer.apellido = req.apellido.trim();
        chofer.cedula = cedula;
    }
};
exports.ChoferController = ChoferController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ChoferController.prototype, "listar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ChoferRequest]),
    __metadata("design:returntype", void 0)
], ChoferController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, ChoferRequest]),
    __metadata("design:returntype", void 0)
], ChoferController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ChoferController.prototype, "eliminar", null);
exports.ChoferController = ChoferController = __decorate([
    (0, common_1.Controller)('api/choferes'),
    __metadata("design:paramtypes", [chofer_repository_1.ChoferRepository,
        viaje_repository_1.ViajeRepository])
], ChoferController);
//# sourceMappingURL=choferes.controller.js.map