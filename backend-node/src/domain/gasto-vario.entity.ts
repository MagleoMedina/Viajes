import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TituloGasto } from './titulo-gasto.entity';
import { epochMs } from '../common/epoch.transformer';

/**
 * Gasto vario: independiente de los viajes (sin FK a viajes).
 * fecha vive en epoch ms, igual que viaje.entity.ts.
 */
@Entity('gastos_varios')
export class GastoVario {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TituloGasto, { nullable: false })
  @JoinColumn({ name: 'titulo_gasto_id' })
  tituloGasto: TituloGasto;

  @Column({ type: 'integer', transformer: epochMs })
  fecha: Date;

  /** N° de comprobante. */
  @Column({ type: 'varchar', length: 50, default: '0' })
  numero: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  motivo: string;

  @Column({ name: 'monto_usd', type: 'float', default: 0 })
  montoUsd: number;

  /** Calculado = montoUsd × tasa, pero editable a mano. */
  @Column({ name: 'monto_bs', type: 'float', default: 0 })
  montoBs: number;

  @Column({ type: 'float', default: 0 })
  tasa: number;

  /** % de descuento/comisión bancaria: informativo, no entra en las sumas. */
  @Column({ name: 'porcentaje_db', type: 'float', default: 0 })
  porcentajeDb: number;

  /** N° de referencia. */
  @Column({ type: 'varchar', length: 100, default: '0' })
  referencia: string;
}
