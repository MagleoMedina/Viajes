import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TituloImpuesto } from '../domain/titulo-impuesto.entity';

@Injectable()
export class TituloImpuestoRepository {
  constructor(
    @InjectRepository(TituloImpuesto) private readonly repo: Repository<TituloImpuesto>,
  ) {}

  findAllByOrderByNombreAsc(): Promise<TituloImpuesto[]> {
    return this.repo.find({ order: { nombre: 'ASC' } });
  }

  findById(id: number): Promise<TituloImpuesto | null> {
    return this.repo.findOneBy({ id });
  }

  /**
   * SQLite no pliega mayúsculas con acentos (LOWER es solo ASCII):
   * se compara en JS para que "IVSS" choca con "ivss".
   */
  async existsByNombreIgnoreCase(nombre: string): Promise<boolean> {
    const lista = await this.repo.find({ select: { nombre: true } });
    const objetivo = nombre.trim().toLocaleLowerCase('es');
    return lista.some((t) => (t.nombre ?? '').toLocaleLowerCase('es') === objetivo);
  }

  existsById(id: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('t')
      .where('id = :id', { id })
      .getExists();
  }

  save(titulo: TituloImpuesto): Promise<TituloImpuesto> {
    return this.repo.save(titulo);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}
