import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehiculo } from '../domain/vehiculo.entity';

@Injectable()
export class VehiculoRepository {
  constructor(
    @InjectRepository(Vehiculo) private readonly repo: Repository<Vehiculo>,
  ) {}

  findAll(): Promise<Vehiculo[]> {
    return this.repo.find({ where: { eliminado: false } });
  }

  findById(id: number): Promise<Vehiculo | null> {
    return this.repo.findOneBy({ id });
  }

  existsByPlaca(placa: string): Promise<boolean> {
    return this.repo
      .createQueryBuilder('v')
      .where('placa = :placa', { placa })
      .getExists();
  }

  existsById(id: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('v')
      .where('id = :id', { id })
      .andWhere('eliminado = 0')
      .getExists();
  }

  /** Oculta el vehiculo del frontend sin borrarlo de la base. */
  ocultar(id: number): Promise<void> {
    return this.repo.update(id, { eliminado: true }).then(() => undefined);
  }

  save(vehiculo: Vehiculo): Promise<Vehiculo> {
    return this.repo.save(vehiculo);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}