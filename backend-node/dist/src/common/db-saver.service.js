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
var DbSaverService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbSaverService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const ESPERA_MS = 900;
let DbSaverService = DbSaverService_1 = class DbSaverService {
    dataSource;
    logger = new common_1.Logger(DbSaverService_1.name);
    timer = null;
    sucia = false;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    marcarSucia() {
        this.sucia = true;
        if (this.timer)
            return;
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.volcar();
        }, ESPERA_MS);
    }
    cancelar() {
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = null;
        this.sucia = false;
    }
    async volcar() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (!this.sucia)
            return;
        this.sucia = false;
        try {
            await this.dataSource.driver.save();
        }
        catch (e) {
            this.sucia = true;
            this.logger.error(`No se pudo guardar la base local: ${e.message}`);
        }
    }
    onModuleDestroy() {
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = null;
    }
    async onApplicationShutdown() {
        await this.volcar();
    }
};
exports.DbSaverService = DbSaverService;
exports.DbSaverService = DbSaverService = DbSaverService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], DbSaverService);
//# sourceMappingURL=db-saver.service.js.map