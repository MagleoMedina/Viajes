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
exports.TasaController = exports.TasaRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const tasa_entity_1 = require("../domain/tasa.entity");
const tasa_repository_1 = require("../repo/tasa.repository");
const tasa_service_1 = require("../service/tasa.service");
const serialize_1 = require("../common/serialize");
const dates_1 = require("../common/dates");
const api_exception_1 = require("./api-exception");
class TasaRequest {
    valor;
}
exports.TasaRequest = TasaRequest;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'La tasa es obligatoria' }),
    __metadata("design:type", Number)
], TasaRequest.prototype, "valor", void 0);
let TasaController = class TasaController {
    repo;
    servicio;
    constructor(repo, servicio) {
        this.repo = repo;
        this.servicio = servicio;
    }
    async actual() {
        const tasa = await this.repo.findTopByOrderByIdDesc();
        if (!tasa)
            return {};
        return {
            valor: Number(tasa.valor),
            fecha: (0, dates_1.toIsoDateTime)(tasa.fecha),
            origen: tasa.origen ?? undefined,
        };
    }
    actualizar(req) {
        if (req.valor == null) {
            throw new api_exception_1.ApiException(400, 'La tasa es obligatoria');
        }
        if (req.valor <= 0) {
            throw new api_exception_1.ApiValidationException({ valor: 'La tasa debe ser mayor que 0' });
        }
        const tasa = new tasa_entity_1.Tasa();
        tasa.valor = req.valor;
        tasa.fecha = new Date();
        tasa.origen = 'Manual';
        return this.repo.save(tasa).then(serialize_1.tasaJson);
    }
    refrescar() {
        return this.servicio.refrescar().then(serialize_1.tasaJson);
    }
};
exports.TasaController = TasaController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasaController.prototype, "actual", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TasaRequest]),
    __metadata("design:returntype", void 0)
], TasaController.prototype, "actualizar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('refrescar'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TasaController.prototype, "refrescar", null);
exports.TasaController = TasaController = __decorate([
    (0, common_1.Controller)('api/tasa'),
    __metadata("design:paramtypes", [tasa_repository_1.TasaRepository,
        tasa_service_1.TasaService])
], TasaController);
//# sourceMappingURL=tasa.controller.js.map