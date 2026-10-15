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
var TotalReparacionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TotalReparacionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const db_saver_service_1 = require("../common/db-saver.service");
let TotalReparacionService = TotalReparacionService_1 = class TotalReparacionService {
    dataSource;
    dbSaver;
    logger = new common_1.Logger(TotalReparacionService_1.name);
    constructor(dataSource, dbSaver) {
        this.dataSource = dataSource;
        this.dbSaver = dbSaver;
    }
    async reparar() {
        const bruto = `ROUND(COALESCE(viajes.monto_viaje, 0) * COALESCE(viajes.tasa, 0))`;
        const gastos = `(
      COALESCE(viajes.combustible, 0) +
      COALESCE(viajes.viaticos, 0) +
      COALESCE(viajes.peajes, 0) +
      COALESCE(viajes.pago_chofer, 0) +
      COALESCE((SELECT SUM(g.monto) FROM gastos g WHERE g.viaje_id = viajes.id), 0)
    )`;
        const total = `(${bruto} - ${gastos})`;
        await this.dataSource.query(`
      UPDATE viajes SET
        total_bs = ${total},
        total_usd = CASE
          WHEN ${total} = 0 OR COALESCE(viajes.tasa, 0) = 0 THEN 0
          ELSE ROUND(${total} / viajes.tasa, 2)
        END
    `);
        this.dbSaver.marcarSucia();
        const filas = await this.dataSource.query('SELECT COUNT(*) AS n FROM viajes');
        const cantidad = Number(filas?.[0]?.n ?? 0);
        this.logger.log(`Totales recalculados con la formula vigente sobre ${cantidad} viajes`);
        return cantidad;
    }
};
exports.TotalReparacionService = TotalReparacionService;
exports.TotalReparacionService = TotalReparacionService = TotalReparacionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        db_saver_service_1.DbSaverService])
], TotalReparacionService);
//# sourceMappingURL=total-reparacion.service.js.map