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
exports.Viaje = void 0;
const typeorm_1 = require("typeorm");
const chofer_entity_1 = require("./chofer.entity");
const empresa_entity_1 = require("./empresa.entity");
const gasto_entity_1 = require("./gasto.entity");
const punto_entity_1 = require("./punto.entity");
const vehiculo_entity_1 = require("./vehiculo.entity");
const epoch_transformer_1 = require("../common/epoch.transformer");
let Viaje = class Viaje {
    id;
    fechaInicio;
    fechaFin;
    chofer;
    empresa;
    vehiculo;
    carga;
    recorrido;
    puntoSalida;
    puntoLlegada;
    montoViaje;
    combustible;
    viaticos;
    peajes;
    pagoChofer;
    gastos;
    totalBs;
    tasa;
    totalUsd;
};
exports.Viaje = Viaje;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Viaje.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fecha_inicio', type: 'integer', transformer: epoch_transformer_1.epochMs }),
    __metadata("design:type", Date)
], Viaje.prototype, "fechaInicio", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fecha_fin', type: 'integer', transformer: epoch_transformer_1.epochMs }),
    __metadata("design:type", Date)
], Viaje.prototype, "fechaFin", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => chofer_entity_1.Chofer, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'chofer_id' }),
    __metadata("design:type", chofer_entity_1.Chofer)
], Viaje.prototype, "chofer", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => empresa_entity_1.Empresa, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'empresa_id' }),
    __metadata("design:type", Object)
], Viaje.prototype, "empresa", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => vehiculo_entity_1.Vehiculo, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'vehiculo_id' }),
    __metadata("design:type", Object)
], Viaje.prototype, "vehiculo", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Viaje.prototype, "carga", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 150, nullable: true, type: 'varchar' }),
    __metadata("design:type", Object)
], Viaje.prototype, "recorrido", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => punto_entity_1.Punto, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'punto_salida_id' }),
    __metadata("design:type", Object)
], Viaje.prototype, "puntoSalida", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => punto_entity_1.Punto, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'punto_llegada_id' }),
    __metadata("design:type", Object)
], Viaje.prototype, "puntoLlegada", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monto_viaje', type: 'float', nullable: true }),
    __metadata("design:type", Number)
], Viaje.prototype, "montoViaje", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], Viaje.prototype, "combustible", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], Viaje.prototype, "viaticos", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], Viaje.prototype, "peajes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pago_chofer', type: 'float', nullable: true }),
    __metadata("design:type", Number)
], Viaje.prototype, "pagoChofer", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => gasto_entity_1.Gasto, (gasto) => gasto.viaje, { cascade: true }),
    __metadata("design:type", Array)
], Viaje.prototype, "gastos", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_bs', type: 'float', nullable: true }),
    __metadata("design:type", Number)
], Viaje.prototype, "totalBs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], Viaje.prototype, "tasa", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_usd', type: 'float', nullable: true }),
    __metadata("design:type", Number)
], Viaje.prototype, "totalUsd", void 0);
exports.Viaje = Viaje = __decorate([
    (0, typeorm_1.Entity)('viajes')
], Viaje);
//# sourceMappingURL=viaje.entity.js.map