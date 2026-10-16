import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { Chofer } from './domain/chofer.entity';
import { Empresa } from './domain/empresa.entity';
import { Gasto } from './domain/gasto.entity';
import { GastoGasoil } from './domain/gasto-gasoil.entity';
import { GastoImpuesto } from './domain/gasto-impuesto.entity';
import { GastoVario } from './domain/gasto-vario.entity';
import { Punto } from './domain/punto.entity';
import { Recorrido } from './domain/recorrido.entity';
import { Tasa } from './domain/tasa.entity';
import { TituloGasto } from './domain/titulo-gasto.entity';
import { TituloImpuesto } from './domain/titulo-impuesto.entity';
import { Vehiculo } from './domain/vehiculo.entity';
import { Viaje } from './domain/viaje.entity';
import { ChoferRepository } from './repo/chofer.repository';
import { EmpresaRepository } from './repo/empresa.repository';
import { GastoGasoilRepository } from './repo/gasto-gasoil.repository';
import { GastoImpuestoRepository } from './repo/gasto-impuesto.repository';
import { GastoVarioRepository } from './repo/gasto-vario.repository';
import { PuntoRepository } from './repo/punto.repository';
import { RecorridoRepository } from './repo/recorrido.repository';
import { TasaRepository } from './repo/tasa.repository';
import { TituloGastoRepository } from './repo/titulo-gasto.repository';
import { TituloImpuestoRepository } from './repo/titulo-impuesto.repository';
import { VehiculoRepository } from './repo/vehiculo.repository';
import { ViajeRepository } from './repo/viaje.repository';
import { TasaService } from './service/tasa.service';
import { ExportService } from './service/export.service';
import { GastosGasoilService } from './service/gastos-gasoil.service';
import { GastosImpuestosService } from './service/gastos-impuestos.service';
import { GastosVariosService } from './service/gastos-varios.service';
import { ReporteEmpresaService } from './service/reporte-empresa.service';
import { TursoSyncService } from './service/turso-sync.service';
import { TotalReparacionService } from './service/total-reparacion.service';
import { ChoferController } from './web/choferes.controller';
import { EmpresaController } from './web/empresas.controller';
import { GastoGasoilController } from './web/gastos-gasoil.controller';
import { GastoImpuestoController } from './web/gastos-impuestos.controller';
import { GastoVarioController } from './web/gastos-varios.controller';
import { PuntoController } from './web/puntos.controller';
import { RecorridoController } from './web/recorridos.controller';
import { TituloGastoController } from './web/titulos-gasto.controller';
import { TituloImpuestoController } from './web/titulos-impuesto.controller';
import { VehiculoController } from './web/vehiculos.controller';
import { ViajeController } from './web/viajes.controller';
import { TasaController } from './web/tasa.controller';
import { ExportController } from './web/export.controller';
import { SyncController } from './web/sync.controller';
import { SistemaController } from './web/sistema.controller';
import { ApiExceptionFilter } from './web/api-exception.filter';
import { JsonNonNullInterceptor } from './common/json-nonnull.interceptor';
import { DbSaverService } from './common/db-saver.service';
import { ApiValidationException } from './web/api-exception';

const ENTIDADES = [
  Chofer,
  Empresa,
  Gasto,
  GastoGasoil,
  GastoImpuesto,
  GastoVario,
  Punto,
  Recorrido,
  Tasa,
  TituloGasto,
  TituloImpuesto,
  Vehiculo,
  Viaje,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'sqljs',
        location: config.get<string>('DB_PATH') ?? 'data/viajes.db',
        // Sin autoSave: exporta la base COMPLETA y la escribe de forma sincrona
        // tras CADA operacion, lo que satura el backend con bases grandes.
        // El volcado agrupado lo hace DbSaverService (ver tambien pull de Turso).
        autoSave: false,
        entities: ENTIDADES,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature(ENTIDADES),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', 'frontend', 'dist'),
      exclude: ['/api/{*path}'],
    }),
  ],
  controllers: [
    ChoferController,
    EmpresaController,
    GastoGasoilController,
    GastoImpuestoController,
    GastoVarioController,
    PuntoController,
    RecorridoController,
    TituloGastoController,
    TituloImpuestoController,
    VehiculoController,
    ViajeController,
    TasaController,
    ExportController,
    SyncController,
    SistemaController,
  ],
  providers: [
    ChoferRepository,
    EmpresaRepository,
    GastoGasoilRepository,
    GastoImpuestoRepository,
    GastoVarioRepository,
    PuntoRepository,
    RecorridoRepository,
    TasaRepository,
    TituloGastoRepository,
    TituloImpuestoRepository,
    VehiculoRepository,
    ViajeRepository,
    TasaService,
    ExportService,
    GastosGasoilService,
    GastosImpuestosService,
    GastosVariosService,
    ReporteEmpresaService,
    TursoSyncService,
    TotalReparacionService,
    DbSaverService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        exceptionFactory: (errors) => {
          const fields: Record<string, string> = {};
          for (const error of errors) {
            if (!(error.property in fields)) {
              fields[error.property] =
                Object.values(error.constraints ?? {})[0] ?? 'Datos invalidos';
            }
          }
          return new ApiValidationException(fields);
        },
      }),
    },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: JsonNonNullInterceptor },
  ],
})
export class AppModule {}