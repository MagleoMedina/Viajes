import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TituloGasto } from '../domain/titulo-gasto.entity';

@Injectable()
export class TituloGastoRepository {
  constructor(
    @InjectRepository(TituloGasto) private readonly repo: Repository<TituloGasto>,
  ) {}

  findAllByOrderByNombreAsc(): Promise<TituloGasto[]> {
    return this.repo.find({ order: { nombre: 'ASC' } });
  }

  findById(id: number): Promise<TituloGasto | null> {
    return this.repo.findOneBy({ id });
  }

  /**
   * SQLite no pliega mayúsculas con acentos (LOWER es solo ASCII):
   * se compara en JS para que "ALCALDÍA" choca con "Alcaldía".
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

  save(titulo: TituloGasto): Promise<TituloGasto> {
    return this.repo.save(titulo);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}
