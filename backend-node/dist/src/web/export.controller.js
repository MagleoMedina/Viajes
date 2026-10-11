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
exports.ExportController = void 0;
const common_1 = require("@nestjs/common");
const export_service_1 = require("../service/export.service");
let ExportController = class ExportController {
    servicio;
    constructor(servicio) {
        this.servicio = servicio;
    }
    xlsx(res, empresaId, desde, hasta) {
        return this.servicio.crearXlsx(empresaId ? Number(empresaId) : null, desde, hasta).then((buffer) => {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="viajes.xlsx"');
            res.setHeader('Content-Length', String(buffer.length));
            res.end(buffer);
        });
    }
    pdf(res, empresaId, desde, hasta) {
        return this.servicio.crearPdf(empresaId ? Number(empresaId) : null, desde, hasta).then((buffer) => {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="viajes.pdf"');
            res.setHeader('Content-Length', String(buffer.length));
            res.end(buffer);
        });
    }
};
exports.ExportController = ExportController;
__decorate([
    (0, common_1.Get)('xlsx'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('empresaId')),
    __param(2, (0, common_1.Query)('desde')),
    __param(3, (0, common_1.Query)('hasta')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], ExportController.prototype, "xlsx", null);
__decorate([
    (0, common_1.Get)('pdf'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)('empresaId')),
    __param(2, (0, common_1.Query)('desde')),
    __param(3, (0, common_1.Query)('hasta')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], ExportController.prototype, "pdf", null);
exports.ExportController = ExportController = __decorate([
    (0, common_1.Controller)('api/export'),
    __metadata("design:paramtypes", [export_service_1.ExportService])
], ExportController);
//# sourceMappingURL=export.controller.js.map