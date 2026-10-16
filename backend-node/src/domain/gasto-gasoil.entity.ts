import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Vehiculo } from './vehiculo.entity';
import { epochMs } from '../common/epoch.transformer';

/**
 * Gasto de gasoil: independiente de los viajes, ligado al vehículo.
 * fecha vive en epoch ms, igual que viaje.entity.ts.
 */
@Entity('gastos_gasoil')
export class GastoGasoil {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Vehiculo, { nullable: false })
  @JoinColumn({ name: 'vehiculo_id' })
  vehiculo: Vehiculo;

  @Column({ type: 'integer', transformer: epochMs })
  fecha: Date;

  @Column({ type: 'varchar', length: 100, default: '' })
  estacion: string;

  @Column({ type: 'float', default: 0 })
  litros: number;

  /** Precio por litro en $. */
  @Column({ name: 'precio_litro', type: 'float', default: 0 })
  precioLitro: number;

  @Column({ name: 'monto_usd', type: 'float', default: 0 })
  montoUsd: number;

  /** Calculado = montoUsd × tasa, pero editable a mano. */
  @Column({ name: 'monto_bs', type: 'float', default: 0 })
  montoBs: number;

  @Column({ type: 'float', default: 0 })
  tasa: number;

  /** N° de referencia. */
  @Column({ type: 'varchar', length: 100, default: '0' })
  referencia: string;
}
