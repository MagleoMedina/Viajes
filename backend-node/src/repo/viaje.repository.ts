import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
import { Viaje } from '../domain/viaje.entity';
import { dateOnlyToMillis } from '../common/dates';

const RELATIONS: FindOptionsRelations<Viaje> = {
  chofer: true,
  empresa: true,
  vehiculo: true,
  tituloViaje: true,
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
   *
   * Por defecto SOLO viajes normales (titulo_viaje_id vacio); los viajes
   * personalizados se piden con un tituloViajeId concreto.
   */
  buscar(
    empresaId?: number | null,
    vehiculoId?: number | null,
    desde?: string,
    hasta?: string,
    tituloViajeId?: number | null,
  ): Promise<Viaje[]> {
    const qb = this.repo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.chofer', 'chofer')
      .leftJoinAndSelect('v.empresa', 'empresa')
      .leftJoinAndSelect('v.vehiculo', 'vehiculo')
      .leftJoinAndSelect('v.tituloViaje', 'tituloViaje')
      .leftJoinAndSelect('v.puntoSalida', 'puntoSalida')
      .leftJoinAndSelect('v.puntoLlegada', 'puntoLlegada')
      .leftJoinAndSelect('v.gastos', 'gastos')
      .orderBy('v.fechaInicio', 'DESC');

    if (tituloViajeId != null && Number.isFinite(tituloViajeId) && tituloViajeId > 0) {
      qb.andWhere('v.titulo_viaje_id = :tituloId', { tituloId: tituloViajeId });
    } else {
      qb.andWhere('v.titulo_viaje_id IS NULL');
    }
    if (empresaId != null && Number.isFinite(empresaId) && empresaId > 0) {
      qb.andWhere('empresa.id = :empresaId', { empresaId });
    }
    if (vehiculoId != null && Number.isFinite(vehiculoId) && vehiculoId > 0) {
      qb.andWhere('vehiculo.id = :vehiculoId', { vehiculoId });
    }
    if (desde && hasta) {
      // epoch ms numerico: el QueryBuilder no aplica el transformer de la
      // columna, y SQLite no compara bigint contra datetime.
      qb.andWhere('v.fechaInicio BETWEEN :desde AND :hasta', {
        desde: dateOnlyToMillis(desde),
        hasta: dateOnlyToMillis(hasta),
      });
    }
    return qb.getMany();
  }

  /**
   * Viajes NORMALES de una lista de vehículos (reporte de privados). Con la
   * lista vacía no hay nada que buscar.
   */
  buscarPorVehiculos(
    vehiculoIds: number[],
    empresaId?: number | null,
    desde?: string,
    hasta?: string,
  ): Promise<Viaje[]> {
    if (vehiculoIds.length === 0) return Promise.resolve([]);
    const qb = this.repo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.chofer', 'chofer')
      .leftJoinAndSelect('v.empresa', 'empresa')
      .leftJoinAndSelect('v.vehiculo', 'vehiculo')
      .leftJoinAndSelect('v.tituloViaje', 'tituloViaje')
      .leftJoinAndSelect('v.puntoSalida', 'puntoSalida')
      .leftJoinAndSelect('v.puntoLlegada', 'puntoLlegada')
      .leftJoinAndSelect('v.gastos', 'gastos')
      .where('v.titulo_viaje_id IS NULL')
      .andWhere('v.vehiculo_id IN (:...vehiculoIds)', { vehiculoIds })
      .orderBy('v.fechaInicio', 'DESC');

    if (empresaId != null && Number.isFinite(empresaId) && empresaId > 0) {
      qb.andWhere('empresa.id = :empresaId', { empresaId });
    }
    if (desde && hasta) {
      qb.andWhere('v.fechaInicio BETWEEN :desde AND :hasta', {
        desde: dateOnlyToMillis(desde),
        hasta: dateOnlyToMillis(hasta),
      });
    }
    return qb.getMany();
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