import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recorrido } from '../domain/recorrido.entity';

@Injectable()
export class RecorridoRepository {
  constructor(
    @InjectRepository(Recorrido)
    private readonly repo: Repository<Recorrido>,
  ) {}

  findAllByOrderByNombreAsc(): Promise<Recorrido[]> {
    return this.repo.find({ order: { nombre: 'ASC' } });
  }

  findById(id: number): Promise<Recorrido | null> {
    return this.repo.findOneBy({ id });
  }

  existsByNombreIgnoreCase(nombre: string): Promise<boolean> {
    return this.repo
      .createQueryBuilder('r')
      .where('LOWER(r.nombre) = LOWER(:nombre)', { nombre })
      .getExists();
  }

  existsById(id: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('r')
      .where('id = :id', { id })
      .getExists();
  }

  save(recorrido: Recorrido): Promise<Recorrido> {
    return this.repo.save(recorrido);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}