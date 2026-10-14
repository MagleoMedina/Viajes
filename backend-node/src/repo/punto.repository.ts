import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Punto } from '../domain/punto.entity';

@Injectable()
export class PuntoRepository {
  constructor(
    @InjectRepository(Punto) private readonly repo: Repository<Punto>,
  ) {}

  findAllByOrderByNombreAsc(): Promise<Punto[]> {
    return this.repo.find({ where: { eliminado: false }, order: { nombre: 'ASC' } });
  }

  findById(id: number): Promise<Punto | null> {
    return this.repo.findOneBy({ id });
  }

  existsByNombreIgnoreCase(nombre: string): Promise<boolean> {
    return this.repo
      .createQueryBuilder('p')
      .where('LOWER(p.nombre) = LOWER(:nombre)', { nombre })
      .getExists();
  }

  existsById(id: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('p')
      .where('id = :id', { id })
      .andWhere('eliminado = 0')
      .getExists();
  }

  /** Oculta el punto del frontend sin borrarlo de la base. */
  ocultar(id: number): Promise<void> {
    return this.repo.update(id, { eliminado: true }).then(() => undefined);
  }

  save(punto: Punto): Promise<Punto> {
    return this.repo.save(punto);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}