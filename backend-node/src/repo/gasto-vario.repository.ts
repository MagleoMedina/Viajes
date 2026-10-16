import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { GastoVario } from '../domain/gasto-vario.entity';
import { dateOnlyToMillis } from '../common/dates';

@Injectable()
export class GastoVarioRepository {
  constructor(
    @InjectRepository(GastoVario) private readonly repo: Repository<GastoVario>,
  ) {}

  /** Filtros combinables: título y/o intervalo de fechas (YYYY-MM-DD). */
  buscar(tituloId?: number | null, desde?: string, hasta?: string): Promise<GastoVario[]> {
    const where: Record<string, unknown> = {};
    if (tituloId != null && Number.isFinite(tituloId) && tituloId > 0) {
      where.tituloGasto = { id: tituloId };
    }
    if (desde && hasta) {
      where.fecha = Between(
        new Date(dateOnlyToMillis(desde)),
        new Date(dateOnlyToMillis(hasta)),
      );
    }
    return this.repo.find({
      where,
      relations: { tituloGasto: true },
      order: { fecha: 'DESC', id: 'DESC' },
    });
  }

  findById(id: number): Promise<GastoVario | null> {
    return this.repo.findOne({ where: { id }, relations: { tituloGasto: true } });
  }

  save(gasto: GastoVario): Promise<GastoVario> {
    return this.repo.save(gasto);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }

  existsByTituloGastoId(tituloId: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('g')
      .where('g.titulo_gasto_id = :id', { id: tituloId })
      .getExists();
  }
}
