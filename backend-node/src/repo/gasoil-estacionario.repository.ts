import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { GasoilEstacionario } from '../domain/gasoil-estacionario.entity';
import { dateOnlyToMillis } from '../common/dates';

@Injectable()
export class GasoilEstacionarioRepository {
  constructor(
    @InjectRepository(GasoilEstacionario)
    private readonly repo: Repository<GasoilEstacionario>,
  ) {}

  /** Filtros combinables: vehículo y/o intervalo de fechas (YYYY-MM-DD). */
  buscar(
    vehiculoId?: number | null,
    desde?: string,
    hasta?: string,
  ): Promise<GasoilEstacionario[]> {
    const where: Record<string, unknown> = {};
    if (vehiculoId != null && Number.isFinite(vehiculoId) && vehiculoId > 0) {
      where.vehiculo = { id: vehiculoId };
    }
    if (desde && hasta) {
      where.fecha = Between(
        new Date(dateOnlyToMillis(desde)),
        new Date(dateOnlyToMillis(hasta)),
      );
    }
    return this.repo.find({
      where,
      relations: { vehiculo: true },
      order: { fecha: 'DESC', id: 'DESC' },
    });
  }

  findById(id: number): Promise<GasoilEstacionario | null> {
    return this.repo.findOne({ where: { id }, relations: { vehiculo: true } });
  }

  save(gasto: GasoilEstacionario): Promise<GasoilEstacionario> {
    return this.repo.save(gasto);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}
