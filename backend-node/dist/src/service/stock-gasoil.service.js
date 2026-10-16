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
exports.StockGasoilService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const gasto_gasoil_entity_1 = require("../domain/gasto-gasoil.entity");
const viaje_entity_1 = require("../domain/viaje.entity");
const dates_1 = require("../common/dates");
let StockGasoilService = class StockGasoilService {
    gastos;
    viajes;
    constructor(gastos, viajes) {
        this.gastos = gastos;
        this.viajes = viajes;
    }
    async disponible(vehiculoId, excluirViajeId) {
        const comprado = await this.suma(this.gastos
            .createQueryBuilder('g')
            .select('COALESCE(SUM(g.litros), 0)', 'suma')
            .where('g.vehiculo_id = :id', { id: vehiculoId }));
        let qb = this.viajes
            .createQueryBuilder('v')
            .select('COALESCE(SUM(v.litros), 0)', 'suma')
            .where('v.vehiculo_id = :id', { id: vehiculoId });
        if (excluirViajeId != null) {
            qb = qb.andWhere('v.id != :excluido', { excluido: excluirViajeId });
        }
        const usado = await this.suma(qb);
        return {
            vehiculoId,
            comprado: (0, dates_1.round2)(comprado),
            usado: (0, dates_1.round2)(usado),
            disponible: (0, dates_1.round2)(comprado - usado),
        };
    }
    async suma(qb) {
        const fila = await qb.getRawOne();
        const valor = Number(fila?.suma ?? 0);
        return Number.isFinite(valor) ? valor : 0;
    }
};
exports.StockGasoilService = StockGasoilService;
exports.StockGasoilService = StockGasoilService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(gasto_gasoil_entity_1.GastoGasoil)),
    __param(1, (0, typeorm_1.InjectRepository)(viaje_entity_1.Viaje)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], StockGasoilService);
//# sourceMappingURL=stock-gasoil.service.js.map