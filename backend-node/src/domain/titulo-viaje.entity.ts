import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Título de un viaje personalizado: se registra antes que los viajes. */
@Entity('titulo_viaje')
export class TituloViaje {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  /** true = oculto del frontend, conservado para los viajes historicos. */
  @Column({ type: 'boolean', default: false })
  eliminado: boolean;
}
