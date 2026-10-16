import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { GastoImpuesto } from '../domain/gasto-impuesto.entity';
import { dateOnlyToMillis } from '../common/dates';

@Injectable()
export class GastoImpuestoRepository {
  constructor(
    @InjectRepository(GastoImpuesto) private readonly repo: Repository<GastoImpuesto>,
  ) {}

  /** Filtros combinables: tipo y/o intervalo de fechas (YYYY-MM-DD). */
  buscar(tituloId?: number | null, desde?: string, hasta?: string): Promise<GastoImpuesto[]> {
    const where: Record<string, unknown> = {};
    if (tituloId != null && Number.isFinite(tituloId) && tituloId > 0) {
      where.tituloImpuesto = { id: tituloId };
    }
    if (desde && hasta) {
      where.fecha = Between(
        new Date(dateOnlyToMillis(desde)),
        new Date(dateOnlyToMillis(hasta)),
      );
    }
    return this.repo.find({
      where,
      relations: { tituloImpuesto: true },
      order: { fecha: 'DESC', id: 'DESC' },
    });
  }

  findById(id: number): Promise<GastoImpuesto | null> {
    return this.repo.findOne({ where: { id }, relations: { tituloImpuesto: true } });
  }

  save(gasto: GastoImpuesto): Promise<GastoImpuesto> {
    return this.repo.save(gasto);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }

  existsByTituloImpuestoId(tituloId: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('g')
      .where('g.titulo_impuesto_id = :id', { id: tituloId })
      .getExists();
  }
}
