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
    return this.repo.find();
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
      .getExists();
  }

  save(vehiculo: Vehiculo): Promise<Vehiculo> {
    return this.repo.save(vehiculo);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}