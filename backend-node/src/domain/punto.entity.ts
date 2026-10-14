import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('puntos')
export class Punto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  /** true = oculto del frontend, conservado para los viajes historicos. */
  @Column({ type: 'boolean', default: false })
  eliminado: boolean;
}
