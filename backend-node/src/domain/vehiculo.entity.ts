import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('vehiculos')
export class Vehiculo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  marca: string;

  @Column({ nullable: true })
  modelo: string;

  @Column({ nullable: true })
  tipo: string;

  @Column({ unique: true })
  placa: string;

  /** true = oculto del frontend, conservado para los viajes historicos. */
  @Column({ type: 'boolean', default: false })
  eliminado: boolean;
}
