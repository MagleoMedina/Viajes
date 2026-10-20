import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { GastoGasoil } from '../domain/gasto-gasoil.entity';
import { GasoilEstacionario } from '../domain/gasoil-estacionario.entity';
import { Viaje } from '../domain/viaje.entity';
import { Vehiculo } from '../domain/vehiculo.entity';
import { round2 } from '../common/dates';

export interface StockGasoil {
  /** Litros totales comprados (gastos_gasoil), todos los vehículos. */
  comprado: number;
  /** Litros totales consumidos en viajes, todos los vehículos. */
  usado: number;
  /** Litros consumidos por vehículos estacionarios (gasoil_estacionario). */
  estacionario: number;
  /** comprado - usado - estacionario (puede ser negativo si los viajes
   * históricos exceden las compras). */
  disponible: number;
}

export interface FilaGasoilVehiculo extends StockGasoil {
  vehiculoId: number | null;
  placa: string;
  /** Montos de compra ($ y Bs) del vehículo. */
  compradoUsd: number;
  compradoBs: number;
  /** Monto de combustible del viaje (Bs) del vehículo. */
  usadoBs: number;
}

export interface ResumenGasoil {
  filas: FilaGasoilVehiculo[];
  total: Omit<FilaGasoilVehiculo, 'vehiculoId' | 'placa'>;
}

/**
 * Stock de gasoil GLOBAL (una sola bolsa para todos los vehículos),
 * calculado al vuelo: lo comprado (gastos_gasoil) menos lo consumido en
 * viajes y por vehículos estacionarios. No hay estado guardado: editar o
 * borrar registros lo mantiene consistente sin triggers ni migraciones.
 */
@Injectable()
export class StockGasoilService {
  constructor(
    @InjectRepository(GastoGasoil) private readonly gastos: Repository<GastoGasoil>,
    @InjectRepository(Viaje) private readonly viajes: Repository<Viaje>,
    @InjectRepository(GasoilEstacionario)
    private readonly estacionarios: Repository<GasoilEstacionario>,
  ) {}

  /**
   * @param excluirViajeId al editar un viaje, sus propios litros no cuentan
   * como usados para poder validar el nuevo valor contra el stock real.
   */
  async global(excluirViajeId?: number | null): Promise<StockGasoil> {
    const comprado = await this.suma(
      this.gastos.createQueryBuilder('g').select('COALESCE(SUM(g.litros), 0)', 'suma'),
    );
    let qb: SelectQueryBuilder<Viaje> = this.viajes
      .createQueryBuilder('v')
      .select('COALESCE(SUM(v.litros), 0)', 'suma');
    if (excluirViajeId != null) {
      qb = qb.andWhere('v.id != :excluido', { excluido: excluirViajeId });
    }
    const usado = await this.suma(qb);
    const estacionario = await this.suma(
      this.estacionarios
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.litros), 0)', 'suma'),
    );
    return this.armar(comprado, usado, estacionario);
  }

  /** Desglose por vehículo (comprado y usado) más los totales globales. */
  async resumen(): Promise<ResumenGasoil> {
    const vehiculos = await this.gastos.manager.find(Vehiculo);
    const placaDe = new Map<number, string>(vehiculos.map((v) => [v.id, v.placa]));

    const comprados = await this.gastos
      .createQueryBuilder('g')
      .select('g.vehiculo_id', 'vehiculoId')
      .addSelect('COALESCE(SUM(g.litros), 0)', 'litros')
      .addSelect('COALESCE(SUM(g.monto_usd), 0)', 'montoUsd')
      .addSelect('COALESCE(SUM(g.monto_bs), 0)', 'montoBs')
      .groupBy('g.vehiculo_id')
      .getRawMany<{ vehiculoId: string | null; litros: string; montoUsd: string; montoBs: string }>();

    const usados = await this.viajes
      .createQueryBuilder('v')
      .select('v.vehiculo_id', 'vehiculoId')
      .addSelect('COALESCE(SUM(v.litros), 0)', 'litros')
      .addSelect('COALESCE(SUM(v.combustible), 0)', 'combustible')
      .groupBy('v.vehiculo_id')
      .getRawMany<{ vehiculoId: string | null; litros: string; combustible: string }>();

    const claves = new Set<number | null>();
    for (const f of comprados) claves.add(f.vehiculoId == null ? null : Number(f.vehiculoId));
    for (const f of usados) claves.add(f.vehiculoId == null ? null : Number(f.vehiculoId));

    const compradoPorId = new Map<number | null, (typeof comprados)[number]>();
    for (const f of comprados) {
      compradoPorId.set(f.vehiculoId == null ? null : Number(f.vehiculoId), f);
    }
    const usadoPorId = new Map<number | null, (typeof usados)[number]>();
    for (const f of usados) {
      usadoPorId.set(f.vehiculoId == null ? null : Number(f.vehiculoId), f);
    }

    const filas: FilaGasoilVehiculo[] = [];
    const total = {
      comprado: 0,
      usado: 0,
      estacionario: 0,
      disponible: 0,
      compradoUsd: 0,
      compradoBs: 0,
      usadoBs: 0,
    };
    for (const id of [...claves].sort((a, b) => (a ?? -1) - (b ?? -1))) {
      const c = compradoPorId.get(id);
      const u = usadoPorId.get(id);
      const fila: FilaGasoilVehiculo = {
        vehiculoId: id,
        placa: id == null ? 'Sin vehículo' : (placaDe.get(id) ?? `Vehículo #${id}`),
        comprado: round2(Number(c?.litros ?? 0)),
        compradoUsd: round2(Number(c?.montoUsd ?? 0)),
        compradoBs: round2(Number(c?.montoBs ?? 0)),
        usado: round2(Number(u?.litros ?? 0)),
        usadoBs: round2(Number(u?.combustible ?? 0)),
        estacionario: 0,
        disponible: 0,
      };
      fila.disponible = round2(fila.comprado - fila.usado);
      filas.push(fila);
      total.comprado += fila.comprado;
      total.compradoUsd += fila.compradoUsd;
      total.compradoBs += fila.compradoBs;
      total.usado += fila.usado;
      total.usadoBs += fila.usadoBs;
    }
    total.comprado = round2(total.comprado);
    total.compradoUsd = round2(total.compradoUsd);
    total.compradoBs = round2(total.compradoBs);
    total.usado = round2(total.usado);
    total.usadoBs = round2(total.usadoBs);
    total.disponible = round2(total.comprado - total.usado);
    return { filas, total };
  }

  private armar(comprado: number, usado: number, estacionario: number): StockGasoil {
    return {
      comprado: round2(comprado),
      usado: round2(usado),
      estacionario: round2(estacionario),
      disponible: round2(comprado - usado - estacionario),
    };
  }

  private async suma<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>): Promise<number> {
    const fila = await qb.getRawOne<{ suma: string | number | null }>();
    const valor = Number(fila?.suma ?? 0);
    return Number.isFinite(valor) ? valor : 0;
  }
}
