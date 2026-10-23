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
exports.IngresoRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ingreso_entity_1 = require("../domain/ingreso.entity");
const dates_1 = require("../common/dates");
let IngresoRepository = class IngresoRepository {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    buscar(empresaId, desde, hasta) {
        const where = {};
        if (empresaId != null && Number.isFinite(empresaId) && empresaId > 0) {
            where.empresa = { id: empresaId };
        }
        if (desde && hasta) {
            where.fecha = (0, typeorm_2.Between)(new Date((0, dates_1.dateOnlyToMillis)(desde)), new Date((0, dates_1.dateOnlyToMillis)(hasta)));
        }
        return this.repo.find({
            where,
            relations: { empresa: true },
            order: { fecha: 'DESC', id: 'DESC' },
        });
    }
    findById(id) {
        return this.repo.findOne({ where: { id }, relations: { empresa: true } });
    }
    findByFacturaNum(numero, excluirId) {
        return this.repo.findOne({
            where: {
                facturaNum: numero,
                ...(excluirId != null ? { id: (0, typeorm_2.Not)(excluirId) } : {}),
            },
        });
    }
    save(ingreso) {
        return this.repo.save(ingreso);
    }
    deleteById(id) {
        return this.repo.delete(id).then(() => undefined);
    }
};
exports.IngresoRepository = IngresoRepository;
exports.IngresoRepository = IngresoRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ingreso_entity_1.Ingreso)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], IngresoRepository);
//# sourceMappingURL=ingreso.repository.js.map