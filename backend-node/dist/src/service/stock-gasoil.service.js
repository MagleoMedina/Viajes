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
const gasoil_estacionario_entity_1 = require("../domain/gasoil-estacionario.entity");
const viaje_entity_1 = require("../domain/viaje.entity");
const vehiculo_entity_1 = require("../domain/vehiculo.entity");
const dates_1 = require("../common/dates");
let StockGasoilService = class StockGasoilService {
    gastos;
    viajes;
    estacionarios;
    constructor(gastos, viajes, estacionarios) {
        this.gastos = gastos;
        this.viajes = viajes;
        this.estacionarios = estacionarios;
    }
    async global(excluirViajeId) {
        const comprado = await this.suma(this.gastos.createQueryBuilder('g').select('COALESCE(SUM(g.litros), 0)', 'suma'));
        let qb = this.viajes
            .createQueryBuilder('v')
            .select('COALESCE(SUM(v.litros), 0)', 'suma');
        if (excluirViajeId != null) {
            qb = qb.andWhere('v.id != :excluido', { excluido: excluirViajeId });
        }
        const usado = await this.suma(qb);
        const estacionario = await this.suma(this.estacionarios
            .createQueryBuilder('e')
            .select('COALESCE(SUM(e.litros), 0)', 'suma'));
        return this.armar(comprado, usado, estacionario);
    }
    async resumen() {
        const comprados = await this.gastos
            .createQueryBuilder('g')
            .select('g.vehiculo_id', 'vehiculoId')
            .addSelect('COALESCE(SUM(g.litros), 0)', 'litros')
            .addSelect('COALESCE(SUM(g.monto_usd), 0)', 'montoUsd')
            .addSelect('COALESCE(SUM(g.monto_bs), 0)', 'montoBs')
            .groupBy('g.vehiculo_id')
            .getRawMany();
        const usados = await this.viajes
            .createQueryBuilder('v')
            .select('v.vehiculo_id', 'vehiculoId')
            .addSelect('COALESCE(SUM(v.litros), 0)', 'litros')
            .addSelect('COALESCE(SUM(v.combustible), 0)', 'combustible')
            .groupBy('v.vehiculo_id')
            .getRawMany();
        return this.armarResumen(comprados, usados);
    }
    async resumenPorTitulo(tituloId) {
        const usados = await this.viajes
            .createQueryBuilder('v')
            .select('v.vehiculo_id', 'vehiculoId')
            .addSelect('COALESCE(SUM(v.litros), 0)', 'litros')
            .addSelect('COALESCE(SUM(v.combustible), 0)', 'combustible')
            .where('v.titulo_viaje_id = :tituloId', { tituloId })
            .groupBy('v.vehiculo_id')
            .getRawMany();
        const ids = usados.map((f) => (f.vehiculoId == null ? null : Number(f.vehiculoId)));
        const idsNumericos = ids.filter((id) => id != null);
        let comprados = [];
        if (ids.length > 0) {
            const qb = this.gastos
                .createQueryBuilder('g')
                .select('g.vehiculo_id', 'vehiculoId')
                .addSelect('COALESCE(SUM(g.litros), 0)', 'litros')
                .addSelect('COALESCE(SUM(g.monto_usd), 0)', 'montoUsd')
                .addSelect('COALESCE(SUM(g.monto_bs), 0)', 'montoBs');
            if (idsNumericos.length > 0 && ids.some((id) => id == null)) {
                qb.where('(g.vehiculo_id IN (:...ids) OR g.vehiculo_id IS NULL)', { ids: idsNumericos });
            }
            else if (idsNumericos.length > 0) {
                qb.where('g.vehiculo_id IN (:...ids)', { ids: idsNumericos });
            }
            else {
                qb.where('g.vehiculo_id IS NULL');
            }
            comprados = await qb.groupBy('g.vehiculo_id').getRawMany();
        }
        return this.armarResumen(comprados, usados);
    }
    async resumenPorVehiculos(vehiculoIds, empresaId, desde, hasta) {
        if (vehiculoIds.length === 0)
            return this.armarResumen([], []);
        const usadosQb = this.viajes
            .createQueryBuilder('v')
            .select('v.vehiculo_id', 'vehiculoId')
            .addSelect('COALESCE(SUM(v.litros), 0)', 'litros')
            .addSelect('COALESCE(SUM(v.combustible), 0)', 'combustible')
            .where('v.vehiculo_id IN (:...vehiculoIds)', { vehiculoIds })
            .andWhere('v.titulo_viaje_id IS NULL');
        if (empresaId != null && Number.isFinite(empresaId) && empresaId > 0) {
            usadosQb.andWhere('v.empresa_id = :empresaId', { empresaId });
        }
        if (desde && hasta) {
            usadosQb.andWhere('v.fechaInicio BETWEEN :desde AND :hasta', {
                desde: (0, dates_1.dateOnlyToMillis)(desde),
                hasta: (0, dates_1.dateOnlyToMillis)(hasta),
            });
        }
        const usados = await usadosQb
            .groupBy('v.vehiculo_id')
            .getRawMany();
        const compradosQb = this.gastos
            .createQueryBuilder('g')
            .select('g.vehiculo_id', 'vehiculoId')
            .addSelect('COALESCE(SUM(g.litros), 0)', 'litros')
            .addSelect('COALESCE(SUM(g.monto_usd), 0)', 'montoUsd')
            .addSelect('COALESCE(SUM(g.monto_bs), 0)', 'montoBs')
            .where('g.vehiculo_id IN (:...vehiculoIds)', { vehiculoIds });
        if (desde && hasta) {
            compradosQb.andWhere('g.fecha BETWEEN :desde AND :hasta', {
                desde: (0, dates_1.dateOnlyToMillis)(desde),
                hasta: (0, dates_1.dateOnlyToMillis)(hasta),
            });
        }
        const comprados = await compradosQb
            .groupBy('g.vehiculo_id')
            .getRawMany();
        return this.armarResumen(comprados, usados, vehiculoIds);
    }
    async armarResumen(comprados, usados, vehiculosExtra = []) {
        const vehiculos = await this.gastos.manager.find(vehiculo_entity_1.Vehiculo);
        const etiquetaDe = new Map(vehiculos.map((v) => {
            const partes = [v.marca, v.modelo].filter((x) => x && x.trim()).join(' ').trim();
            const placa = v.placa?.trim();
            const etiqueta = partes && placa ? `${partes} (${placa})` : partes || placa || `Vehículo #${v.id}`;
            return [v.id, etiqueta];
        }));
        const claves = new Set();
        for (const f of comprados)
            claves.add(f.vehiculoId == null ? null : Number(f.vehiculoId));
        for (const f of usados)
            claves.add(f.vehiculoId == null ? null : Number(f.vehiculoId));
        for (const id of vehiculosExtra)
            claves.add(id);
        const compradoPorId = new Map();
        for (const f of comprados) {
            compradoPorId.set(f.vehiculoId == null ? null : Number(f.vehiculoId), f);
        }
        const usadoPorId = new Map();
        for (const f of usados) {
            usadoPorId.set(f.vehiculoId == null ? null : Number(f.vehiculoId), f);
        }
        const filas = [];
        const total = {
            comprado: 0,
            usado: 0,
            estacionario: 0,
            disponible: 0,
            compradoUsd: 0,
            compradoBs: 0,
            usadoBs: 0,
        };
        for (const id of [...claves].sort((a, b) => (a ?? -1) - (b ?? -1))) {
            const c = compradoPorId.get(id);
            const u = usadoPorId.get(id);
            const fila = {
                vehiculoId: id,
                placa: id == null ? 'Sin vehículo' : (etiquetaDe.get(id) ?? `Vehículo #${id}`),
                comprado: (0, dates_1.round2)(Number(c?.litros ?? 0)),
                compradoUsd: (0, dates_1.round2)(Number(c?.montoUsd ?? 0)),
                compradoBs: (0, dates_1.round2)(Number(c?.montoBs ?? 0)),
                usado: (0, dates_1.round2)(Number(u?.litros ?? 0)),
                usadoBs: (0, dates_1.round2)(Number(u?.combustible ?? 0)),
                estacionario: 0,
                disponible: 0,
            };
            fila.disponible = (0, dates_1.round2)(fila.comprado - fila.usado);
            filas.push(fila);
            total.comprado += fila.comprado;
            total.compradoUsd += fila.compradoUsd;
            total.compradoBs += fila.compradoBs;
            total.usado += fila.usado;
            total.usadoBs += fila.usadoBs;
        }
        total.comprado = (0, dates_1.round2)(total.comprado);
        total.compradoUsd = (0, dates_1.round2)(total.compradoUsd);
        total.compradoBs = (0, dates_1.round2)(total.compradoBs);
        total.usado = (0, dates_1.round2)(total.usado);
        total.usadoBs = (0, dates_1.round2)(total.usadoBs);
        total.disponible = (0, dates_1.round2)(total.comprado - total.usado);
        return { filas, total };
    }
    armar(comprado, usado, estacionario) {
        return {
            comprado: (0, dates_1.round2)(comprado),
            usado: (0, dates_1.round2)(usado),
            estacionario: (0, dates_1.round2)(estacionario),
            disponible: (0, dates_1.round2)(comprado - usado - estacionario),
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
    __param(2, (0, typeorm_1.InjectRepository)(gasoil_estacionario_entity_1.GasoilEstacionario)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], StockGasoilService);
//# sourceMappingURL=stock-gasoil.service.js.map