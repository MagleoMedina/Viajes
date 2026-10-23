import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Not, Repository } from 'typeorm';
import { Ingreso } from '../domain/ingreso.entity';
import { dateOnlyToMillis } from '../common/dates';

@Injectable()
export class IngresoRepository {
  constructor(
    @InjectRepository(Ingreso) private readonly repo: Repository<Ingreso>,
  ) {}

  /** Filtros combinables: empresa y/o intervalo de fechas (YYYY-MM-DD). */
  buscar(empresaId?: number | null, desde?: string, hasta?: string): Promise<Ingreso[]> {
    const where: Record<string, unknown> = {};
    if (empresaId != null && Number.isFinite(empresaId) && empresaId > 0) {
      where.empresa = { id: empresaId };
    }
    if (desde && hasta) {
      where.fecha = Between(
        new Date(dateOnlyToMillis(desde)),
        new Date(dateOnlyToMillis(hasta)),
      );
    }
    return this.repo.find({
      where,
      relations: { empresa: true },
      order: { fecha: 'DESC', id: 'DESC' },
    });
  }

  findById(id: number): Promise<Ingreso | null> {
    return this.repo.findOne({ where: { id }, relations: { empresa: true } });
  }

  /** Busca por numero de factura; excluye una fila al modificar la propia. */
  findByFacturaNum(numero: number, excluirId?: number): Promise<Ingreso | null> {
    return this.repo.findOne({
      where: {
        facturaNum: numero,
        ...(excluirId != null ? { id: Not(excluirId) } : {}),
      },
    });
  }

  save(ingreso: Ingreso): Promise<Ingreso> {
    return this.repo.save(ingreso);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}
