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
const punto_entity_1 = require("./domain/punto.entity");
const recorrido_entity_1 = require("./domain/recorrido.entity");
const tasa_entity_1 = require("./domain/tasa.entity");
const vehiculo_entity_1 = require("./domain/vehiculo.entity");
const viaje_entity_1 = require("./domain/viaje.entity");
const chofer_repository_1 = require("./repo/chofer.repository");
const empresa_repository_1 = require("./repo/empresa.repository");
const punto_repository_1 = require("./repo/punto.repository");
const recorrido_repository_1 = require("./repo/recorrido.repository");
const tasa_repository_1 = require("./repo/tasa.repository");
const vehiculo_repository_1 = require("./repo/vehiculo.repository");
const viaje_repository_1 = require("./repo/viaje.repository");
const tasa_service_1 = require("./service/tasa.service");
const export_service_1 = require("./service/export.service");
const choferes_controller_1 = require("./web/choferes.controller");
const empresas_controller_1 = require("./web/empresas.controller");
const puntos_controller_1 = require("./web/puntos.controller");
const recorridos_controller_1 = require("./web/recorridos.controller");
const vehiculos_controller_1 = require("./web/vehiculos.controller");
const viajes_controller_1 = require("./web/viajes.controller");
const tasa_controller_1 = require("./web/tasa.controller");
const export_controller_1 = require("./web/export.controller");
const api_exception_filter_1 = require("./web/api-exception.filter");
const json_nonnull_interceptor_1 = require("./common/json-nonnull.interceptor");
const api_exception_1 = require("./web/api-exception");
const ENTIDADES = [
    chofer_entity_1.Chofer,
    empresa_entity_1.Empresa,
    gasto_entity_1.Gasto,
    punto_entity_1.Punto,
    recorrido_entity_1.Recorrido,
    tasa_entity_1.Tasa,
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
                    autoSave: true,
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
            puntos_controller_1.PuntoController,
            recorridos_controller_1.RecorridoController,
            vehiculos_controller_1.VehiculoController,
            viajes_controller_1.ViajeController,
            tasa_controller_1.TasaController,
            export_controller_1.ExportController,
        ],
        providers: [
            chofer_repository_1.ChoferRepository,
            empresa_repository_1.EmpresaRepository,
            punto_repository_1.PuntoRepository,
            recorrido_repository_1.RecorridoRepository,
            tasa_repository_1.TasaRepository,
            vehiculo_repository_1.VehiculoRepository,
            viaje_repository_1.ViajeRepository,
            tasa_service_1.TasaService,
            export_service_1.ExportService,
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