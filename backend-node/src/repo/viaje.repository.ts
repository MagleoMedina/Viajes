import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsRelations, Repository } from 'typeorm';
import { Viaje } from '../domain/viaje.entity';
import { dateOnlyToMillis } from '../common/dates';

const RELATIONS: FindOptionsRelations<Viaje> = {
  chofer: true,
  empresa: true,
  puntoSalida: true,
  puntoLlegada: true,
  gastos: true,
};

@Injectable()
export class ViajeRepository {
  constructor(
    @InjectRepository(Viaje) private readonly repo: Repository<Viaje>,
  ) {}

  findByFechaInicioBetweenOrderByFechaInicioDesc(
    desde: string,
    hasta: string,
  ): Promise<Viaje[]> {
    return this.repo.find({
      where: { fechaInicio: this.entre(desde, hasta) },
      relations: RELATIONS,
      order: { fechaInicio: 'DESC' },
    });
  }

  findByEmpresaIdOrderByFechaInicioDesc(empresaId: number): Promise<Viaje[]> {
    return this.repo.find({
      where: { empresa: { id: empresaId } },
      relations: RELATIONS,
      order: { fechaInicio: 'DESC' },
    });
  }

  findByEmpresaIdAndFechaInicioBetweenOrderByFechaInicioDesc(
    empresaId: number,
    desde: string,
    hasta: string,
  ): Promise<Viaje[]> {
    return this.repo.find({
      where: { empresa: { id: empresaId }, fechaInicio: this.entre(desde, hasta) },
      relations: RELATIONS,
      order: { fechaInicio: 'DESC' },
    });
  }

  findAllByOrderByFechaInicioDesc(): Promise<Viaje[]> {
    return this.repo.find({
      relations: RELATIONS,
      order: { fechaInicio: 'DESC' },
    });
  }

  findById(id: number): Promise<Viaje | null> {
    return this.repo.findOne({ where: { id }, relations: RELATIONS });
  }

  existsById(id: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('v')
      .where('id = :id', { id })
      .getExists();
  }

  existsByChoferId(choferId: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('v')
      .where('chofer_id = :id', { id: choferId })
      .getExists();
  }

  existsByEmpresaId(empresaId: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('v')
      .where('empresa_id = :id', { id: empresaId })
      .getExists();
  }

  existsByPuntoSalidaId(puntoId: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('v')
      .where('punto_salida_id = :id', { id: puntoId })
      .getExists();
  }

  existsByPuntoLlegadaId(puntoId: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('v')
      .where('punto_llegada_id = :id', { id: puntoId })
      .getExists();
  }

  async save(viaje: Viaje): Promise<Viaje> {
    await this.repo.save(viaje);
    return (await this.findById(viaje.id))!;
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }

  private entre(desde: string, hasta: string) {
    return Between(
      new Date(dateOnlyToMillis(desde)),
      new Date(dateOnlyToMillis(hasta)),
    );
  }
}