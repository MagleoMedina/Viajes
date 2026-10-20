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
exports.GasoilEstacionario = void 0;
const typeorm_1 = require("typeorm");
const vehiculo_entity_1 = require("./vehiculo.entity");
const epoch_transformer_1 = require("../common/epoch.transformer");
let GasoilEstacionario = class GasoilEstacionario {
    id;
    vehiculo;
    fecha;
    litros;
    referencia;
    motivo;
};
exports.GasoilEstacionario = GasoilEstacionario;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], GasoilEstacionario.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => vehiculo_entity_1.Vehiculo, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'vehiculo_id' }),
    __metadata("design:type", vehiculo_entity_1.Vehiculo)
], GasoilEstacionario.prototype, "vehiculo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', transformer: epoch_transformer_1.epochMs }),
    __metadata("design:type", Date)
], GasoilEstacionario.prototype, "fecha", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], GasoilEstacionario.prototype, "litros", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, default: '0' }),
    __metadata("design:type", String)
], GasoilEstacionario.prototype, "referencia", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, default: '' }),
    __metadata("design:type", String)
], GasoilEstacionario.prototype, "motivo", void 0);
exports.GasoilEstacionario = GasoilEstacionario = __decorate([
    (0, typeorm_1.Entity)('gasoil_estacionario')
], GasoilEstacionario);
//# sourceMappingURL=gasoil-estacionario.entity.js.map