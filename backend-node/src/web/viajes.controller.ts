import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsNotEmpty } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gasto } from '../domain/gasto.entity';
import { Recorrido } from '../domain/recorrido.entity';
import { Viaje } from '../domain/viaje.entity';
import { ChoferRepository } from '../repo/chofer.repository';
import { EmpresaRepository } from '../repo/empresa.repository';
import { PuntoRepository } from '../repo/punto.repository';
import { RecorridoRepository } from '../repo/recorrido.repository';
import { TasaRepository } from '../repo/tasa.repository';
import { VehiculoRepository } from '../repo/vehiculo.repository';
import { ViajeRepository } from '../repo/viaje.repository';
import { StockGasoilService } from '../service/stock-gasoil.service';
import { viajeJson } from '../common/serialize';
import { dateOnlyToMillis, round2 } from '../common/dates';
import { ApiException } from './api-exception';

export class GastoRequest {
  monto?: number;
  descripcion?: string;
}

export class ViajeRequest {
  @IsNotEmpty({ message: 'La fecha de inicio es obligatoria' })
  fechaInicio: string;

  @IsNotEmpty({ message: 'La fecha de finalizacion es obligatoria' })
  fechaFin: string;

  @IsNotEmpty({ message: 'El chofer es obligatorio' })
  choferId: number;

  @IsNotEmpty({ message: 'La empresa es obligatoria' })
  empresaId: number;

  @IsNotEmpty({ message: 'La carga es obligatoria' })
  carga: string;

  puntoSalidaId?: number;
  puntoLlegadaId?: number;
  vehiculoId?: number;
  montoViaje?: number;
  combustible?: number;
  viaticos?: number;
  peajes?: number;
  pagoChofer?: number;
  litros?: number;
  refCombustible?: string;
  refViaticos?: string;
  refPeajes?: string;
  refPagoChofer?: string;
  gastos?: GastoRequest[];
  tasa?: number;
  recorrido?: string;
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

@Controller('api/viajes')
export class ViajeController {
  constructor(
    private readonly repo: ViajeRepository,
    private readonly choferRepo: ChoferRepository,
    private readonly empresaRepo: EmpresaRepository,
    private readonly puntoRepo: PuntoRepository,
    private readonly tasaRepo: TasaRepository,
    private readonly recorridoRepo: RecorridoRepository,
    private readonly vehiculoRepo: VehiculoRepository,
    private readonly stockGasoil: StockGasoilService,
    @InjectRepository(Gasto) private readonly gastoRepo: Repository<Gasto>,
  ) {}

  @Get()
  listar(
    @Query('empresaId') empresaId?: string,
    @Query('vehiculoId') vehiculoId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    this.validarFechas(desde, hasta);
    return this.repo
      .buscar(
        empresaId ? Number(empresaId) : null,
        vehiculoId ? Number(vehiculoId) : null,
        desde,
        hasta,
      )
      .then((lista) => lista.map(viajeJson));
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  crear(@Body() req: ViajeRequest) {
    const viaje = new Viaje();
    return this.guardar(viaje, req).then(viajeJson);
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: ViajeRequest) {
    return this.repo.findById(id).then((viaje) => {
      if (!viaje) throw new ApiException(404, 'Viaje no encontrado');
      return this.guardar(viaje, req).then(viajeJson);
    });
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.existsById(id))) {
      throw new ApiException(404, 'Viaje no encontrado');
    }
    // Los gastos dependen del viaje: se borran primero para no dejar filas huerfanas.
    await this.gastoRepo
      .createQueryBuilder()
      .delete()
      .where('viaje_id = :id', { id })
      .execute();
    await this.repo.deleteById(id);
  }

  private validarFechas(desde?: string, hasta?: string) {
    for (const f of [desde, hasta]) {
      if (f && !ISO_DIA.test(f)) {
        throw new ApiException(400, 'Fecha invalida: se espera YYYY-MM-DD');
      }
    }
  }

  /** Guarda automaticamente el recorrido tecleado para alimentar el autocompletado. */
  private guardarRecorrido(recorrido: string) {
    if (!recorrido || !recorrido.trim()) return;
    const nombre = recorrido.trim();
    return this.recorridoRepo.existsByNombreIgnoreCase(nombre).then((existe) => {
      if (existe) return;
      const nuevo = new Recorrido();
      nuevo.nombre = nombre;
      return this.recorridoRepo.save(nuevo);
    });
  }

  /**
   * Valida y aplica los campos al viaje; los gastos se reemplazan completos:
   * primero se guarda el viaje (obtiene el id) y luego se reinsertan los gastos.
   */
  private async guardar(viaje: Viaje, req: ViajeRequest) {
    if (req.fechaFin < req.fechaInicio) {
      throw new ApiException(
        400,
        'La fecha de finalizacion no puede ser anterior a la de inicio',
      );
    }
    const chofer = await this.choferRepo.findById(req.choferId);
    if (!chofer) throw new ApiException(404, 'Chofer no encontrado');

    viaje.fechaInicio = new Date(dateOnlyToMillis(req.fechaInicio));
    viaje.fechaFin = new Date(dateOnlyToMillis(req.fechaFin));
    viaje.chofer = chofer;
    viaje.empresa = await this.empresa(req.empresaId);
    viaje.carga = req.carga.trim();
    viaje.recorrido = req.recorrido ? req.recorrido.trim() : null;
    await this.guardarRecorrido(viaje.recorrido ?? '');
    viaje.puntoSalida = await this.punto(req.puntoSalidaId);
    viaje.puntoLlegada = await this.punto(req.puntoLlegadaId);
    viaje.vehiculo = await this.vehiculo(req.vehiculoId);
    viaje.montoViaje = cero(req.montoViaje);
    viaje.combustible = cero(req.combustible);
    viaje.viaticos = cero(req.viaticos);
    viaje.peajes = cero(req.peajes);
    viaje.pagoChofer = cero(req.pagoChofer);
    viaje.litros = cero(req.litros);
    viaje.refCombustible = referencia(req.refCombustible);
    viaje.refViaticos = referencia(req.refViaticos);
    viaje.refPeajes = referencia(req.refPeajes);
    viaje.refPagoChofer = referencia(req.refPagoChofer);
    viaje.tasa = cero(req.tasa);

    // El viaje descuenta gasoil del stock GLOBAL (todos los vehículos).
    // Al editar se excluyen los litros actuales del viaje.
    if ((viaje.litros ?? 0) > 0) {
      const stock = await this.stockGasoil.global(viaje.id ?? null);
      if ((viaje.litros ?? 0) > stock.disponible) {
        throw new ApiException(
          400,
          `Litros exceden el gasoil disponible (disponible: ${Math.max(0, stock.disponible)} L)`,
        );
      }
    }

    // Se validan los gastos antes de tocar la base; el monto va en $.
    const plan: Array<{ monto: number; descripcion: string }> = [];
    let gastosVarios = 0;
    if (req.gastos) {
      for (const g of req.gastos) {
        if (!g || g.monto == null || g.monto <= 0) continue;
        if (g.descripcion == null || !g.descripcion.trim()) {
          throw new ApiException(400, 'Cada gasto varios necesita una descripcion');
        }
        plan.push({ monto: g.monto, descripcion: g.descripcion.trim() });
        gastosVarios += g.monto;
      }
    }

    // El monto del viaje se digita en $: se multiplica por la tasa para pasarlo a Bs.
    // Total = (monto del viaje $ x tasa) - (combustible + viaticos + peajes +
    // pago a chofer + gastos varios).
    const tasa = viaje.tasa ?? 0;
    const montoBs = tasa === 0 ? 0 : Math.round((viaje.montoViaje ?? 0) * tasa);
    const gastos =
      (viaje.combustible ?? 0) +
      (viaje.viaticos ?? 0) +
      (viaje.peajes ?? 0) +
      (viaje.pagoChofer ?? 0) +
      gastosVarios;

    const totalBs = montoBs - gastos;

    viaje.totalBs = totalBs;
    viaje.totalUsd = totalBs === 0 || tasa === 0 ? 0 : round2(totalBs / tasa);

    const guardado = await this.repo.save(viaje);
    await this.gastoRepo
      .createQueryBuilder()
      .delete()
      .where('viaje_id = :id', { id: guardado.id })
      .execute();
    for (const g of plan) {
      const gasto = new Gasto();
      gasto.viaje = guardado;
      gasto.monto = g.monto;
      gasto.descripcion = g.descripcion;
      await this.gastoRepo.insert(gasto);
    }
    guardado.gastos = await this.gastoRepo.find({
      where: { viaje: { id: guardado.id } },
      order: { id: 'ASC' },
    });
    return guardado;
  }

  private async punto(id?: number) {
    if (id == null) return null;
    const punto = await this.puntoRepo.findById(id);
    if (!punto) throw new ApiException(404, 'Punto no encontrado');
    return punto;
  }

  private async vehiculo(id?: number) {
    if (id == null) return null;
    const vehiculo = await this.vehiculoRepo.findById(id);
    if (!vehiculo) throw new ApiException(404, 'Vehiculo no encontrado');
    return vehiculo;
  }

  private async empresa(id: number) {
    const empresa = await this.empresaRepo.findById(id);
    if (!empresa) throw new ApiException(404, 'Empresa no encontrada');
    return empresa;
  }
}

const cero = (valor: number | null | undefined): number => (valor == null ? 0 : valor);

/** Referencia bancaria de texto libre: recorta y usa "0" por defecto. */
const referencia = (valor: string | null | undefined): string => {
  const texto = valor == null ? '' : String(valor).trim();
  return texto === '' ? '0' : texto;
};