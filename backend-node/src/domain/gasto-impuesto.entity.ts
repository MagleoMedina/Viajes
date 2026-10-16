import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TituloImpuesto } from './titulo-impuesto.entity';
import { epochMs } from '../common/epoch.transformer';

/**
 * Gasto de impuesto: independiente de los viajes.
 * fecha vive en epoch ms, igual que viaje.entity.ts.
 */
@Entity('gastos_impuestos')
export class GastoImpuesto {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TituloImpuesto, { nullable: false })
  @JoinColumn({ name: 'titulo_impuesto_id' })
  tituloImpuesto: TituloImpuesto;

  @Column({ type: 'integer', transformer: epochMs })
  fecha: Date;

  /** N° de comprobante / planilla. */
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
