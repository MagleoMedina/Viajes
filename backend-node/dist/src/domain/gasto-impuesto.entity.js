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
exports.GastoImpuesto = void 0;
const typeorm_1 = require("typeorm");
const titulo_impuesto_entity_1 = require("./titulo-impuesto.entity");
const epoch_transformer_1 = require("../common/epoch.transformer");
let GastoImpuesto = class GastoImpuesto {
    id;
    tituloImpuesto;
    fecha;
    numero;
    motivo;
    montoUsd;
    montoBs;
    tasa;
    porcentajeDb;
    referencia;
};
exports.GastoImpuesto = GastoImpuesto;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], GastoImpuesto.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => titulo_impuesto_entity_1.TituloImpuesto, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'titulo_impuesto_id' }),
    __metadata("design:type", titulo_impuesto_entity_1.TituloImpuesto)
], GastoImpuesto.prototype, "tituloImpuesto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', transformer: epoch_transformer_1.epochMs }),
    __metadata("design:type", Date)
], GastoImpuesto.prototype, "fecha", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: '0' }),
    __metadata("design:type", String)
], GastoImpuesto.prototype, "numero", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, default: '' }),
    __metadata("design:type", String)
], GastoImpuesto.prototype, "motivo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monto_usd', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoImpuesto.prototype, "montoUsd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monto_bs', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoImpuesto.prototype, "montoBs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoImpuesto.prototype, "tasa", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'porcentaje_db', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoImpuesto.prototype, "porcentajeDb", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, default: '0' }),
    __metadata("design:type", String)
], GastoImpuesto.prototype, "referencia", void 0);
exports.GastoImpuesto = GastoImpuesto = __decorate([
    (0, typeorm_1.Entity)('gastos_impuestos')
], GastoImpuesto);
//# sourceMappingURL=gasto-impuesto.entity.js.map