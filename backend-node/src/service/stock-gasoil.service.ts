import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { GastoGasoil } from '../domain/gasto-gasoil.entity';
import { Viaje } from '../domain/viaje.entity';
import { round2 } from '../common/dates';

export interface StockGasoil {
  vehiculoId: number;
  /** Litros totales comprados (gastos_gasoil). */
  comprado: number;
  /** Litros totales consumidos en viajes. */
  usado: number;
  /** comprado - usado (puede ser negativo si los viajes históricos exceden las compras). */
  disponible: number;
}

/**
 * Stock de gasoil por vehículo, calculado al vuelo: lo comprado menos lo
 * consumido en viajes. No hay estado guardado: editar o borrar viajes o
 * compras mantiene el stock consistente sin triggers ni migraciones.
 */
@Injectable()
export class StockGasoilService {
  constructor(
    @InjectRepository(GastoGasoil) private readonly gastos: Repository<GastoGasoil>,
    @InjectRepository(Viaje) private readonly viajes: Repository<Viaje>,
  ) {}

  /**
   * @param excluirViajeId al editar un viaje, sus propios litros no cuentan
   * como usados para poder validar el nuevo valor contra el stock real.
   */
  async disponible(vehiculoId: number, excluirViajeId?: number | null): Promise<StockGasoil> {
    const comprado = await this.suma(
      this.gastos
        .createQueryBuilder('g')
        .select('COALESCE(SUM(g.litros), 0)', 'suma')
        .where('g.vehiculo_id = :id', { id: vehiculoId }),
    );
    let qb: SelectQueryBuilder<Viaje> = this.viajes
      .createQueryBuilder('v')
      .select('COALESCE(SUM(v.litros), 0)', 'suma')
      .where('v.vehiculo_id = :id', { id: vehiculoId });
    if (excluirViajeId != null) {
      qb = qb.andWhere('v.id != :excluido', { excluido: excluirViajeId });
    }
    const usado = await this.suma(qb);
    return {
      vehiculoId,
      comprado: round2(comprado),
      usado: round2(usado),
      disponible: round2(comprado - usado),
    };
  }

  private async suma<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>): Promise<number> {
    const fila = await qb.getRawOne<{ suma: string | number | null }>();
    const valor = Number(fila?.suma ?? 0);
    return Number.isFinite(valor) ? valor : 0;
  }
}
