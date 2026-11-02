import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TituloViaje } from '../domain/titulo-viaje.entity';

@Injectable()
export class TituloViajeRepository {
  constructor(
    @InjectRepository(TituloViaje) private readonly repo: Repository<TituloViaje>,
  ) {}

  /** Solo los activos: los ocultos siguen ligados a viajes historicos. */
  findAll(): Promise<TituloViaje[]> {
    return this.repo.find({
      where: { eliminado: false },
      order: { nombre: 'ASC' },
    });
  }

  findById(id: number): Promise<TituloViaje | null> {
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

  save(titulo: TituloViaje): Promise<TituloViaje> {
    return this.repo.save(titulo);
  }

  /** Oculta el título del frontend sin borrarlo de la base. */
  ocultar(id: number): Promise<void> {
    return this.repo.update(id, { eliminado: true }).then(() => undefined);
  }
}
