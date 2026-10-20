import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Vehiculo } from './vehiculo.entity';
import { epochMs } from '../common/epoch.transformer';

/**
 * Consumo de gasoil de un vehículo estacionario (no asociado a un viaje).
 * Descuenta litros del stock GLOBAL de gasoil. fecha vive en epoch ms,
 * igual que viaje.entity.ts.
 */
@Entity('gasoil_estacionario')
export class GasoilEstacionario {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehiculo, { nullable: false })
  @JoinColumn({ name: 'vehiculo_id' })
  vehiculo: Vehiculo;

  @Column({ type: 'integer', transformer: epochMs })
  fecha: Date;

  /** Litros consumidos; se restan del disponible. */
  @Column({ type: 'float', default: 0 })
  litros: number;

  /** N° de referencia del vale o nota. */
  @Column({ type: 'varchar', length: 100, default: '0' })
  referencia: string;

  /** Motivo u observación del consumo. */
  @Column({ type: 'varchar', length: 200, default: '' })
  motivo: string;
}
