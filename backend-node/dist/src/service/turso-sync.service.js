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
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const api_exception_1 = require("../web/api-exception");
const ejecutar = (0, node_util_1.promisify)(node_child_process_1.execFile);
let TursoSyncService = TursoSyncService_1 = class TursoSyncService {
    logger = new common_1.Logger(TursoSyncService_1.name);
    get archivo() {
        const base = process.env.DB_PATH
            ? (0, node_path_1.dirname)(process.env.DB_PATH)
            : (0, node_path_1.join)(process.cwd(), 'data');
        return (0, node_path_1.join)(base, 'sync-estado.json');
    }
    estado() {
        const configurado = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
        if (!(0, node_fs_1.existsSync)(this.archivo)) {
            return { configurado, fecha: null, exito: null, mensaje: null };
        }
        try {
            const guardado = JSON.parse((0, node_fs_1.readFileSync)(this.archivo, 'utf8'));
            return { configurado, ...guardado };
        }
        catch {
            return { configurado, fecha: null, exito: null, mensaje: null };
        }
    }
    async sincronizar() {
        await this.ejecutarSync(false);
    }
    async sincronizarManual() {
        return this.ejecutarSync(true);
    }
    async ejecutarSync(manual) {
        if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
            this.logger.warn('Turso sin configurar: se omite el respaldo.');
            if (manual) {
                throw new api_exception_1.ApiException(400, 'Turso sin configurar: defina TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en .env');
            }
            return this.estado();
        }
        const script = (0, node_path_1.join)(process.cwd(), 'scripts', 'sync-turso.js');
        try {
            const { stdout } = await ejecutar('node', [script], { env: process.env });
            this.logger.log(stdout.trim());
            return this.registrar(true, stdout.trim());
        }
        catch (e) {
            const mensaje = e.message;
            this.logger.error(`Fallo el respaldo a Turso: ${mensaje}`);
            return this.registrar(false, mensaje);
        }
    }
    registrar(exito, mensaje) {
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(this.archivo), { recursive: true });
        const guardado = { fecha: new Date().toISOString(), exito, mensaje };
        (0, node_fs_1.writeFileSync)(this.archivo, JSON.stringify(guardado, null, 2));
        return { configurado: true, ...guardado };
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