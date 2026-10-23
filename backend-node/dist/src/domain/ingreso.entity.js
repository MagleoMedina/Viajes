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
exports.Ingreso = void 0;
const typeorm_1 = require("typeorm");
const empresa_entity_1 = require("./empresa.entity");
const epoch_transformer_1 = require("../common/epoch.transformer");
let Ingreso = class Ingreso {
    id;
    empresa;
    fecha;
    condicionesPago;
    descripcion;
    cantidad;
    tasa;
    facturaNum;
    iva;
    montoDivisa;
    montoBs;
};
exports.Ingreso = Ingreso;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Ingreso.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => empresa_entity_1.Empresa, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'empresa_id' }),
    __metadata("design:type", Object)
], Ingreso.prototype, "empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', transformer: epoch_transformer_1.epochMs }),
    __metadata("design:type", Date)
], Ingreso.prototype, "fecha", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'condiciones_pago', type: 'varchar', length: 100, default: '' }),
    __metadata("design:type", String)
], Ingreso.prototype, "condicionesPago", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, default: '' }),
    __metadata("design:type", String)
], Ingreso.prototype, "descripcion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], Ingreso.prototype, "cantidad", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], Ingreso.prototype, "tasa", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'factura_num', type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], Ingreso.prototype, "facturaNum", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], Ingreso.prototype, "iva", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monto_divisa', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], Ingreso.prototype, "montoDivisa", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monto_bs', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], Ingreso.prototype, "montoBs", void 0);
exports.Ingreso = Ingreso = __decorate([
    (0, typeorm_1.Entity)('ingresos')
], Ingreso);
//# sourceMappingURL=ingreso.entity.js.map