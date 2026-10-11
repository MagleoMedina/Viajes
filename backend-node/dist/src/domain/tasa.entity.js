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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tasa = void 0;
const typeorm_1 = require("typeorm");
const epoch_transformer_1 = require("../common/epoch.transformer");
let Tasa = class Tasa {
    id;
    valor;
    fecha;
    origen;
};
exports.Tasa = Tasa;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Tasa.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float' }),
    __metadata("design:type", Number)
], Tasa.prototype, "valor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', transformer: epoch_transformer_1.epochMs }),
    __metadata("design:type", Date)
], Tasa.prototype, "fecha", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 40, nullable: true }),
    __metadata("design:type", String)
], Tasa.prototype, "origen", void 0);
exports.Tasa = Tasa = __decorate([
    (0, typeorm_1.Entity)('tasas')
], Tasa);
//# sourceMappingURL=tasa.entity.js.map