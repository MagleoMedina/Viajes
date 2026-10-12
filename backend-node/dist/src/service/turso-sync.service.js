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
var TursoSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TursoSyncService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const node_path_1 = require("node:path");
const ejecutar = (0, node_util_1.promisify)(node_child_process_1.execFile);
let TursoSyncService = TursoSyncService_1 = class TursoSyncService {
    logger = new common_1.Logger(TursoSyncService_1.name);
    async sincronizar() {
        if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
            this.logger.warn('Turso sin configurar: se omite el respaldo diario.');
            return;
        }
        const script = (0, node_path_1.join)(process.cwd(), 'scripts', 'sync-turso.js');
        try {
            const { stdout } = await ejecutar('node', [script], { env: process.env });
            this.logger.log(stdout.trim());
        }
        catch (e) {
            this.logger.error(`Fallo el respaldo a Turso: ${e.message}`);
        }
    }
};
exports.TursoSyncService = TursoSyncService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_3AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TursoSyncService.prototype, "sincronizar", null);
exports.TursoSyncService = TursoSyncService = TursoSyncService_1 = __decorate([
    (0, common_1.Injectable)()
], TursoSyncService);
//# sourceMappingURL=turso-sync.service.js.map