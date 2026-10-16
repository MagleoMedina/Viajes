"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const serve_static_1 = require("@nestjs/serve-static");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const common_2 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const path_1 = require("path");
const chofer_entity_1 = require("./domain/chofer.entity");
const empresa_entity_1 = require("./domain/empresa.entity");
const gasto_entity_1 = require("./domain/gasto.entity");
const gasto_gasoil_entity_1 = require("./domain/gasto-gasoil.entity");
const gasto_impuesto_entity_1 = require("./domain/gasto-impuesto.entity");
const gasto_vario_entity_1 = require("./domain/gasto-vario.entity");
const punto_entity_1 = require("./domain/punto.entity");
const recorrido_entity_1 = require("./domain/recorrido.entity");
const tasa_entity_1 = require("./domain/tasa.entity");
const titulo_gasto_entity_1 = require("./domain/titulo-gasto.entity");
const titulo_impuesto_entity_1 = require("./domain/titulo-impuesto.entity");
const vehiculo_entity_1 = require("./domain/vehiculo.entity");
const viaje_entity_1 = require("./domain/viaje.entity");
const chofer_repository_1 = require("./repo/chofer.repository");
const empresa_repository_1 = require("./repo/empresa.repository");
const gasto_gasoil_repository_1 = require("./repo/gasto-gasoil.repository");
const gasto_impuesto_repository_1 = require("./repo/gasto-impuesto.repository");
const gasto_vario_repository_1 = require("./repo/gasto-vario.repository");
const punto_repository_1 = require("./repo/punto.repository");
const recorrido_repository_1 = require("./repo/recorrido.repository");
const tasa_repository_1 = require("./repo/tasa.repository");
const titulo_gasto_repository_1 = require("./repo/titulo-gasto.repository");
const titulo_impuesto_repository_1 = require("./repo/titulo-impuesto.repository");
const vehiculo_repository_1 = require("./repo/vehiculo.repository");
const viaje_repository_1 = require("./repo/viaje.repository");
const tasa_service_1 = require("./service/tasa.service");
const export_service_1 = require("./service/export.service");
const gastos_gasoil_service_1 = require("./service/gastos-gasoil.service");
const gastos_impuestos_service_1 = require("./service/gastos-impuestos.service");
const gastos_varios_service_1 = require("./service/gastos-varios.service");
const reporte_empresa_service_1 = require("./service/reporte-empresa.service");
const turso_sync_service_1 = require("./service/turso-sync.service");
const total_reparacion_service_1 = require("./service/total-reparacion.service");
const choferes_controller_1 = require("./web/choferes.controller");
const empresas_controller_1 = require("./web/empresas.controller");
const gastos_gasoil_controller_1 = require("./web/gastos-gasoil.controller");
const gastos_impuestos_controller_1 = require("./web/gastos-impuestos.controller");
const gastos_varios_controller_1 = require("./web/gastos-varios.controller");
const puntos_controller_1 = require("./web/puntos.controller");
const recorridos_controller_1 = require("./web/recorridos.controller");
const titulos_gasto_controller_1 = require("./web/titulos-gasto.controller");
const titulos_impuesto_controller_1 = require("./web/titulos-impuesto.controller");
const vehiculos_controller_1 = require("./web/vehiculos.controller");
const viajes_controller_1 = require("./web/viajes.controller");
const tasa_controller_1 = require("./web/tasa.controller");
const export_controller_1 = require("./web/export.controller");
const sync_controller_1 = require("./web/sync.controller");
const sistema_controller_1 = require("./web/sistema.controller");
const api_exception_filter_1 = require("./web/api-exception.filter");
const json_nonnull_interceptor_1 = require("./common/json-nonnull.interceptor");
const db_saver_service_1 = require("./common/db-saver.service");
const api_exception_1 = require("./web/api-exception");
const ENTIDADES = [
    chofer_entity_1.Chofer,
    empresa_entity_1.Empresa,
    gasto_entity_1.Gasto,
    gasto_gasoil_entity_1.GastoGasoil,
    gasto_impuesto_entity_1.GastoImpuesto,
    gasto_vario_entity_1.GastoVario,
    punto_entity_1.Punto,
    recorrido_entity_1.Recorrido,
    tasa_entity_1.Tasa,
    titulo_gasto_entity_1.TituloGasto,
    titulo_impuesto_entity_1.TituloImpuesto,
    vehiculo_entity_1.Vehiculo,
    viaje_entity_1.Viaje,
];
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    type: 'sqljs',
                    location: config.get('DB_PATH') ?? 'data/viajes.db',
                    autoSave: false,
                    entities: ENTIDADES,
                    synchronize: false,
                }),
            }),
            typeorm_1.TypeOrmModule.forFeature(ENTIDADES),
            schedule_1.ScheduleModule.forRoot(),
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(__dirname, '..', '..', '..', 'frontend', 'dist'),
                exclude: ['/api/{*path}'],
            }),
        ],
        controllers: [
            choferes_controller_1.ChoferController,
            empresas_controller_1.EmpresaController,
            gastos_gasoil_controller_1.GastoGasoilController,
            gastos_impuestos_controller_1.GastoImpuestoController,
            gastos_varios_controller_1.GastoVarioController,
            puntos_controller_1.PuntoController,
            recorridos_controller_1.RecorridoController,
            titulos_gasto_controller_1.TituloGastoController,
            titulos_impuesto_controller_1.TituloImpuestoController,
            vehiculos_controller_1.VehiculoController,
            viajes_controller_1.ViajeController,
            tasa_controller_1.TasaController,
            export_controller_1.ExportController,
            sync_controller_1.SyncController,
            sistema_controller_1.SistemaController,
        ],
        providers: [
            chofer_repository_1.ChoferRepository,
            empresa_repository_1.EmpresaRepository,
            gasto_gasoil_repository_1.GastoGasoilRepository,
            gasto_impuesto_repository_1.GastoImpuestoRepository,
            gasto_vario_repository_1.GastoVarioRepository,
            punto_repository_1.PuntoRepository,
            recorrido_repository_1.RecorridoRepository,
            tasa_repository_1.TasaRepository,
            titulo_gasto_repository_1.TituloGastoRepository,
            titulo_impuesto_repository_1.TituloImpuestoRepository,
            vehiculo_repository_1.VehiculoRepository,
            viaje_repository_1.ViajeRepository,
            tasa_service_1.TasaService,
            export_service_1.ExportService,
            gastos_gasoil_service_1.GastosGasoilService,
            gastos_impuestos_service_1.GastosImpuestosService,
            gastos_varios_service_1.GastosVariosService,
            reporte_empresa_service_1.ReporteEmpresaService,
            turso_sync_service_1.TursoSyncService,
            total_reparacion_service_1.TotalReparacionService,
            db_saver_service_1.DbSaverService,
            {
                provide: core_1.APP_PIPE,
                useValue: new common_2.ValidationPipe({
                    transform: true,
                    exceptionFactory: (errors) => {
                        const fields = {};
                        for (const error of errors) {
                            if (!(error.property in fields)) {
                                fields[error.property] =
                                    Object.values(error.constraints ?? {})[0] ?? 'Datos invalidos';
                            }
                        }
                        return new api_exception_1.ApiValidationException(fields);
                    },
                }),
            },
            { provide: core_1.APP_FILTER, useClass: api_exception_filter_1.ApiExceptionFilter },
            { provide: core_1.APP_INTERCEPTOR, useClass: json_nonnull_interceptor_1.JsonNonNullInterceptor },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map