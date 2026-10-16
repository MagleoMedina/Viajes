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
exports.TituloGastoRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const titulo_gasto_entity_1 = require("../domain/titulo-gasto.entity");
let TituloGastoRepository = class TituloGastoRepository {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    findAllByOrderByNombreAsc() {
        return this.repo.find({ order: { nombre: 'ASC' } });
    }
    findById(id) {
        return this.repo.findOneBy({ id });
    }
    async existsByNombreIgnoreCase(nombre) {
        const lista = await this.repo.find({ select: { nombre: true } });
        const objetivo = nombre.trim().toLocaleLowerCase('es');
        return lista.some((t) => (t.nombre ?? '').toLocaleLowerCase('es') === objetivo);
    }
    existsById(id) {
        return this.repo
            .createQueryBuilder('t')
            .where('id = :id', { id })
            .getExists();
    }
    save(titulo) {
        return this.repo.save(titulo);
    }
    deleteById(id) {
        return this.repo.delete(id).then(() => undefined);
    }
};
exports.TituloGastoRepository = TituloGastoRepository;
exports.TituloGastoRepository = TituloGastoRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(titulo_gasto_entity_1.TituloGasto)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TituloGastoRepository);
//# sourceMappingURL=titulo-gasto.repository.js.map