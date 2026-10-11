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
var TasaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasaService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const tasa_entity_1 = require("../domain/tasa.entity");
const tasa_repository_1 = require("../repo/tasa.repository");
const api_exception_1 = require("../web/api-exception");
const dates_1 = require("../common/dates");
let TasaService = TasaService_1 = class TasaService {
    repo;
    log = new common_1.Logger(TasaService_1.name);
    constructor(repo) {
        this.repo = repo;
    }
    async refrescar() {
        const precio = await this.consultarApi();
        const tasa = new tasa_entity_1.Tasa();
        tasa.valor = precio;
        tasa.fecha = new Date();
        tasa.origen = 'GoCambio (BCV)';
        return this.repo.save(tasa);
    }
    async programada() {
        try {
            const tasa = await this.refrescar();
            this.log.log(`Tasa automatica actualizada: ${tasa.valor}`);
        }
        catch (e) {
            this.log.warn(`No se pudo actualizar la tasa programada: ${e.message}`);
        }
    }
    async onApplicationBootstrap() {
        if (process.env.TASA_AUTO === 'false')
            return;
        try {
            const tasa = await this.refrescar();
            this.log.log(`Tasa inicial desde GoCambio: ${tasa.valor}`);
        }
        catch (e) {
            this.log.warn(`No se pudo obtener la tasa al arrancar: ${e.message}`);
        }
    }
    async consultarApi() {
        const url = `https://api.gocambio.app/api/v1/prices?date=${utcAhora()}&bases=all`;
        let respuesta;
        try {
            respuesta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        }
        catch (e) {
            throw new api_exception_1.ApiException(502, `No se pudo consultar GoCambio: ${e.message}`);
        }
        if (respuesta.status !== 200) {
            throw new api_exception_1.ApiException(502, `GoCambio respondio HTTP ${respuesta.status}`);
        }
        return this.extraerUsdVes(await respuesta.text());
    }
    extraerUsdVes(cuerpo) {
        let datos;
        try {
            datos = JSON.parse(cuerpo).data;
        }
        catch {
            throw new api_exception_1.ApiException(502, 'Respuesta inesperada de GoCambio');
        }
        if (!Array.isArray(datos)) {
            throw new api_exception_1.ApiException(502, 'Respuesta inesperada de GoCambio');
        }
        for (const fila of datos) {
            if (fila?.code === 'USD' && fila?.base === 'VES') {
                const precio = Number(fila.price);
                if (precio > 0) {
                    return (0, dates_1.round2)(precio);
                }
            }
        }
        throw new api_exception_1.ApiException(502, 'GoCambio no devolvio precio USD/VES');
    }
};
exports.TasaService = TasaService;
__decorate([
    (0, schedule_1.Cron)('5 9,13 * * *', { timeZone: 'America/Caracas' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasaService.prototype, "programada", null);
exports.TasaService = TasaService = TasaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tasa_repository_1.TasaRepository])
], TasaService);
function utcAhora() {
    const ahora = new Date();
    const iso = nowIso(ahora);
    return encodeURIComponent(iso);
}
function nowIso(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return (`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`);
}
//# sourceMappingURL=tasa.service.js.map