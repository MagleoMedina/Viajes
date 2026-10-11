import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Viaje } from './viaje.entity';

@Entity('gastos')
export class Gasto {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Viaje, (viaje) => viaje.gastos, { nullable: false })
  @JoinColumn({ name: 'viaje_id' })
  viaje: Viaje;

  @Column({ type: 'float' })
  monto: number;

  @Column({ length: 200, nullable: true })
  descripcion: string;
}
