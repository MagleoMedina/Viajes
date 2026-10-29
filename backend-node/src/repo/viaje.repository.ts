import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsRelations, FindOptionsWhere, Repository } from 'typeorm';
import { Viaje } from '../domain/viaje.entity';
import { dateOnlyToMillis } from '../common/dates';

const RELATIONS: FindOptionsRelations<Viaje> = {
  chofer: true,
  empresa: true,
  vehiculo: true,
  puntoSalida: true,
  puntoLlegada: true,
  gastos: true,
};

@Injectable()
export class ViajeRepository {
  constructor(
    @InjectRepository(Viaje) private readonly repo: Repository<Viaje>,
  ) {}

  /**
   * Filtros combinables: empresa, vehiculo y/o intervalo de fechas
   * (YYYY-MM-DD, solo si vienen las dos). Sin filtros devuelve el historico.
   */
  buscar(
    empresaId?: number | null,
    vehiculoId?: number | null,
    desde?: string,
    hasta?: string,
  ): Promise<Viaje[]> {
    const where: FindOptionsWhere<Viaje> = {};
    if (empresaId != null && Number.isFinite(empresaId) && empresaId > 0) {
      where.empresa = { id: empresaId };
    }
    if (vehiculoId != null && Number.isFinite(vehiculoId) && vehiculoId > 0) {
      where.vehiculo = { id: vehiculoId };
    }
    if (desde && hasta) {
      where.fechaInicio = Between(
        new Date(dateOnlyToMillis(desde)),
        new Date(dateOnlyToMillis(hasta)),
      );
    }
    return this.repo.find({
      where,
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

  existsByVehiculoId(vehiculoId: number): Promise<boolean> {
    return this.repo
      .createQueryBuilder('v')
      .where('vehiculo_id = :id', { id: vehiculoId })
      .getExists();
  }

  async save(viaje: Viaje): Promise<Viaje> {
    await this.repo.save(viaje);
    return (await this.findById(viaje.id))!;
  }

  deleteById(id: number): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }
}