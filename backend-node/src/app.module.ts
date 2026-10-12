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
import { Punto } from './domain/punto.entity';
import { Recorrido } from './domain/recorrido.entity';
import { Tasa } from './domain/tasa.entity';
import { Vehiculo } from './domain/vehiculo.entity';
import { Viaje } from './domain/viaje.entity';
import { ChoferRepository } from './repo/chofer.repository';
import { EmpresaRepository } from './repo/empresa.repository';
import { PuntoRepository } from './repo/punto.repository';
import { RecorridoRepository } from './repo/recorrido.repository';
import { TasaRepository } from './repo/tasa.repository';
import { VehiculoRepository } from './repo/vehiculo.repository';
import { ViajeRepository } from './repo/viaje.repository';
import { TasaService } from './service/tasa.service';
import { ExportService } from './service/export.service';
import { ReporteEmpresaService } from './service/reporte-empresa.service';
import { ChoferController } from './web/choferes.controller';
import { EmpresaController } from './web/empresas.controller';
import { PuntoController } from './web/puntos.controller';
import { RecorridoController } from './web/recorridos.controller';
import { VehiculoController } from './web/vehiculos.controller';
import { ViajeController } from './web/viajes.controller';
import { TasaController } from './web/tasa.controller';
import { ExportController } from './web/export.controller';
import { ApiExceptionFilter } from './web/api-exception.filter';
import { JsonNonNullInterceptor } from './common/json-nonnull.interceptor';
import { ApiValidationException } from './web/api-exception';

const ENTIDADES = [
  Chofer,
  Empresa,
  Gasto,
  Punto,
  Recorrido,
  Tasa,
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
        autoSave: true,
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
    PuntoController,
    RecorridoController,
    VehiculoController,
    ViajeController,
    TasaController,
    ExportController,
  ],
  providers: [
    ChoferRepository,
    EmpresaRepository,
    PuntoRepository,
    RecorridoRepository,
    TasaRepository,
    VehiculoRepository,
    ViajeRepository,
    TasaService,
    ExportService,
    ReporteEmpresaService,
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