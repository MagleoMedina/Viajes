import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chofer } from '../domain/chofer.entity';

@Injectable()
export class ChoferRepository {
  constructor(
    @InjectRepository(Chofer) private readonly repo: Repository<Chofer>,
  ) {}

  findAll(): Promise<Chofer[]> {
    return this.repo.find({ where: { eliminado: false } });
  }

  findById(id: number): Promise<Chofer | null> {
    return this.repo.findOneBy({ id });
  }

  findByCedula(cedula: string): Promise<Chofer | null> {
    return this.repo.findOneBy({ cedula });
  }

  existsByCedula(cedula: string): Promise<boolean> {
    return this.existsWhere('cedula = :cedula', { cedula });
  }

  existsById(id: number): Promise<boolean> {
    return this.existsWhere('id = :id AND eliminado = 0', { id });
  }

  /** Oculta el chofer del frontend sin borrarlo de la base. */
  ocultar(id: number): Promise<void> {
    return this.repo.update(id, { eliminado: true }).then(() => undefined);
  }

  save(chofer: Chofer): Promise<Chofer> {
    return this.repo.save(chofer);
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }

  private existsWhere(cond: string, params: Record<string, any>): Promise<boolean> {
    return this.repo
      .createQueryBuilder('c')
      .where(cond, params)
      .getExists();
  }
}