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
exports.ChoferRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const chofer_entity_1 = require("../domain/chofer.entity");
let ChoferRepository = class ChoferRepository {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    findAll() {
        return this.repo.find({ where: { eliminado: false } });
    }
    findById(id) {
        return this.repo.findOneBy({ id });
    }
    findByCedula(cedula) {
        return this.repo.findOneBy({ cedula });
    }
    existsByCedula(cedula) {
        return this.existsWhere('cedula = :cedula', { cedula });
    }
    existsById(id) {
        return this.existsWhere('id = :id AND eliminado = 0', { id });
    }
    ocultar(id) {
        return this.repo.update(id, { eliminado: true }).then(() => undefined);
    }
    save(chofer) {
        return this.repo.save(chofer);
    }
    deleteById(id) {
        return this.repo.delete(id).then(() => undefined);
    }
    existsWhere(cond, params) {
        return this.repo
            .createQueryBuilder('c')
            .where(cond, params)
            .getExists();
    }
};
exports.ChoferRepository = ChoferRepository;
exports.ChoferRepository = ChoferRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(chofer_entity_1.Chofer)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ChoferRepository);
//# sourceMappingURL=chofer.repository.js.map