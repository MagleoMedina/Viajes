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
exports.ViajeRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const viaje_entity_1 = require("../domain/viaje.entity");
const dates_1 = require("../common/dates");
const RELATIONS = {
    chofer: true,
    empresa: true,
    vehiculo: true,
    puntoSalida: true,
    puntoLlegada: true,
    gastos: true,
};
let ViajeRepository = class ViajeRepository {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    findByFechaInicioBetweenOrderByFechaInicioDesc(desde, hasta) {
        return this.repo.find({
            where: { fechaInicio: this.entre(desde, hasta) },
            relations: RELATIONS,
            order: { fechaInicio: 'DESC' },
        });
    }
    findByEmpresaIdOrderByFechaInicioDesc(empresaId) {
        return this.repo.find({
            where: { empresa: { id: empresaId } },
            relations: RELATIONS,
            order: { fechaInicio: 'DESC' },
        });
    }
    findByEmpresaIdAndFechaInicioBetweenOrderByFechaInicioDesc(empresaId, desde, hasta) {
        return this.repo.find({
            where: { empresa: { id: empresaId }, fechaInicio: this.entre(desde, hasta) },
            relations: RELATIONS,
            order: { fechaInicio: 'DESC' },
        });
    }
    findAllByOrderByFechaInicioDesc() {
        return this.repo.find({
            relations: RELATIONS,
            order: { fechaInicio: 'DESC' },
        });
    }
    findById(id) {
        return this.repo.findOne({ where: { id }, relations: RELATIONS });
    }
    existsById(id) {
        return this.repo
            .createQueryBuilder('v')
            .where('id = :id', { id })
            .getExists();
    }
    existsByChoferId(choferId) {
        return this.repo
            .createQueryBuilder('v')
            .where('chofer_id = :id', { id: choferId })
            .getExists();
    }
    existsByEmpresaId(empresaId) {
        return this.repo
            .createQueryBuilder('v')
            .where('empresa_id = :id', { id: empresaId })
            .getExists();
    }
    existsByPuntoSalidaId(puntoId) {
        return this.repo
            .createQueryBuilder('v')
            .where('punto_salida_id = :id', { id: puntoId })
            .getExists();
    }
    existsByPuntoLlegadaId(puntoId) {
        return this.repo
            .createQueryBuilder('v')
            .where('punto_llegada_id = :id', { id: puntoId })
            .getExists();
    }
    async save(viaje) {
        await this.repo.save(viaje);
        return (await this.findById(viaje.id));
    }
    deleteById(id) {
        return this.repo.delete(id).then(() => undefined);
    }
    entre(desde, hasta) {
        return (0, typeorm_2.Between)(new Date((0, dates_1.dateOnlyToMillis)(desde)), new Date((0, dates_1.dateOnlyToMillis)(hasta)));
    }
};
exports.ViajeRepository = ViajeRepository;
exports.ViajeRepository = ViajeRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(viaje_entity_1.Viaje)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ViajeRepository);
//# sourceMappingURL=viaje.repository.js.map