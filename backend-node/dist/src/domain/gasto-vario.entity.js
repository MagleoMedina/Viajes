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
exports.GastoVario = void 0;
const typeorm_1 = require("typeorm");
const titulo_gasto_entity_1 = require("./titulo-gasto.entity");
const epoch_transformer_1 = require("../common/epoch.transformer");
let GastoVario = class GastoVario {
    id;
    tituloGasto;
    fecha;
    numero;
    motivo;
    montoUsd;
    montoBs;
    tasa;
    porcentajeDb;
    referencia;
};
exports.GastoVario = GastoVario;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], GastoVario.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => titulo_gasto_entity_1.TituloGasto, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'titulo_gasto_id' }),
    __metadata("design:type", titulo_gasto_entity_1.TituloGasto)
], GastoVario.prototype, "tituloGasto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', transformer: epoch_transformer_1.epochMs }),
    __metadata("design:type", Date)
], GastoVario.prototype, "fecha", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: '0' }),
    __metadata("design:type", String)
], GastoVario.prototype, "numero", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, default: '' }),
    __metadata("design:type", String)
], GastoVario.prototype, "motivo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monto_usd', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoVario.prototype, "montoUsd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monto_bs', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoVario.prototype, "montoBs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoVario.prototype, "tasa", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'porcentaje_db', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoVario.prototype, "porcentajeDb", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, default: '0' }),
    __metadata("design:type", String)
], GastoVario.prototype, "referencia", void 0);
exports.GastoVario = GastoVario = __decorate([
    (0, typeorm_1.Entity)('gastos_varios')
], GastoVario);
//# sourceMappingURL=gasto-vario.entity.js.map