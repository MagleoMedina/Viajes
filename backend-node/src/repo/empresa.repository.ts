import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from '../domain/empresa.entity';

@Injectable()
export class EmpresaRepository {
  constructor(
    @InjectRepository(Empresa) private readonly repo: Repository<Empresa>,
  ) {}

  findAllByOrderByNombreAsc(): Promise<Empresa[]> {
    return this.repo.find({ order: { nombre: 'ASC' } });
  }

  findById(id: number): Promise<Empresa | null> {
    return this.repo.findOneBy({ id });
  }

  existsByNombreIgnoreCase(nombre: string): Promise<boolean> {
    return this.repo
      .createQueryBuilder('e')
      .where('LOWER(e.nombre) = LOWER(:nombre)', { nombre })
      .getExists();
  }

  existsById(id: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('e')
      .where('id = :id', { id })
      .getExists();
  }

  save(empresa: Empresa): Promise<Empresa> {
    return this.repo.save(empresa);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}