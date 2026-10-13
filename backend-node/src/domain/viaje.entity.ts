import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Chofer } from './chofer.entity';
import { Empresa } from './empresa.entity';
import { Gasto } from './gasto.entity';
import { Punto } from './punto.entity';
import { Vehiculo } from './vehiculo.entity';
import { epochMs } from '../common/epoch.transformer';

@Entity('viajes')
export class Viaje {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'fecha_inicio', type: 'integer', transformer: epochMs })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'integer', transformer: epochMs })
  fechaFin: Date;

  @ManyToOne(() => Chofer, { nullable: false })
  @JoinColumn({ name: 'chofer_id' })
  chofer: Chofer;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa | null;

  @ManyToOne(() => Vehiculo, { nullable: true })
  @JoinColumn({ name: 'vehiculo_id' })
  vehiculo: Vehiculo | null;

  @Column()
  carga: string;

  @Column({ length: 150, nullable: true, type: 'varchar' })
  recorrido: string | null;

  @ManyToOne(() => Punto, { nullable: true })
  @JoinColumn({ name: 'punto_salida_id' })
  puntoSalida: Punto | null;

  @ManyToOne(() => Punto, { nullable: true })
  @JoinColumn({ name: 'punto_llegada_id' })
  puntoLlegada: Punto | null;

  @Column({ name: 'monto_viaje', type: 'float', nullable: true })
  montoViaje?: number;

  @Column({ type: 'float', nullable: true })
  combustible?: number;

  @Column({ type: 'float', nullable: true })
  viaticos?: number;

  @Column({ type: 'float', nullable: true })
  peajes?: number;

  @Column({ name: 'pago_chofer', type: 'float', nullable: true })
  pagoChofer?: number;

  @OneToMany(() => Gasto, (gasto) => gasto.viaje, { cascade: true })
  gastos: Gasto[];

  @Column({ name: 'total_bs', type: 'float', nullable: true })
  totalBs?: number;

  @Column({ type: 'float', nullable: true })
  tasa?: number;

  @Column({ name: 'total_usd', type: 'float', nullable: true })
  totalUsd?: number;
}
