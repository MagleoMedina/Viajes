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
exports.RelacionController = void 0;
const common_1 = require("@nestjs/common");
const relacion_reportes_service_1 = require("../service/relacion-reportes.service");
const api_exception_1 = require("./api-exception");
let RelacionController = class RelacionController {
    servicio;
    constructor(servicio) {
        this.servicio = servicio;
    }
    async resumen(tipo, desde, hasta) {
        this.servicio.validarRango(desde, hasta);
        return this.servicio.resumenPorTipo(this.tipoValido(tipo), desde, hasta);
    }
    tipoValido(tipo) {
        if (!relacion_reportes_service_1.TIPOS_RELACION.includes(tipo)) {
            throw new api_exception_1.ApiException(404, `Reporte desconocido: ${tipo}`);
        }
        return tipo;
    }
};
exports.RelacionController = RelacionController;
__decorate([
    (0, common_1.Get)(':tipo'),
    __param(0, (0, common_1.Param)('tipo')),
    __param(1, (0, common_1.Query)('desde')),
    __param(2, (0, common_1.Query)('hasta')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], RelacionController.prototype, "resumen", null);
exports.RelacionController = RelacionController = __decorate([
    (0, common_1.Controller)('api/relacion'),
    __metadata("design:paramtypes", [relacion_reportes_service_1.RelacionReportesService])
], RelacionController);
//# sourceMappingURL=relacion.controller.js.map