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
exports.GastoGasoil = void 0;
const typeorm_1 = require("typeorm");
const vehiculo_entity_1 = require("./vehiculo.entity");
const epoch_transformer_1 = require("../common/epoch.transformer");
let GastoGasoil = class GastoGasoil {
    id;
    vehiculo;
    fecha;
    estacion;
    litros;
    precioLitro;
    montoUsd;
    montoBs;
    tasa;
    referencia;
};
exports.GastoGasoil = GastoGasoil;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], GastoGasoil.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => vehiculo_entity_1.Vehiculo, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'vehiculo_id' }),
    __metadata("design:type", Object)
], GastoGasoil.prototype, "vehiculo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', transformer: epoch_transformer_1.epochMs }),
    __metadata("design:type", Date)
], GastoGasoil.prototype, "fecha", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, default: '' }),
    __metadata("design:type", String)
], GastoGasoil.prototype, "estacion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoGasoil.prototype, "litros", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'precio_litro', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoGasoil.prototype, "precioLitro", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monto_usd', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoGasoil.prototype, "montoUsd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monto_bs', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoGasoil.prototype, "montoBs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GastoGasoil.prototype, "tasa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, default: '0' }),
    __metadata("design:type", String)
], GastoGasoil.prototype, "referencia", void 0);
exports.GastoGasoil = GastoGasoil = __decorate([
    (0, typeorm_1.Entity)('gastos_gasoil')
], GastoGasoil);
//# sourceMappingURL=gasto-gasoil.entity.js.map