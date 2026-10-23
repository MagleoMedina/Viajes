import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Empresa } from './empresa.entity';
import { epochMs } from '../common/epoch.transformer';

/**
 * Ingreso cobrado a una empresa (independiente de los viajes).
 * La empresa es opcional a nivel de base para no romper filas historicas,
 * pero la API la exige al registrar.
 * fecha vive en epoch ms, igual que viaje.entity.ts.
 */
@Entity('ingresos')
export class Ingreso {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa | null;

  @Column({ type: 'integer', transformer: epochMs })
  fecha: Date;

  /** Texto libre: "Contado", "Credito 30 dias", etc. */
  @Column({ name: 'condiciones_pago', type: 'varchar', length: 100, default: '' })
  condicionesPago: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  descripcion: string;

  /** Informativa: no multiplica los montos. */
  @Column({ type: 'float', default: 0 })
  cantidad: number;

  /** Tasa aplicada (admite hasta 6 decimales). */
  @Column({ type: 'float', default: 0 })
  tasa: number;

  /**
   * Numero de factura: entero positivo y unico en toda la tabla (indice
   * idx_ingresos_factura_num). Las filas historicas pueden quedar en null.
   */
  @Column({ name: 'factura_num', type: 'integer', nullable: true })
  facturaNum: number | null;

  /** IVA cobrado: informativo, no entra en los totales de la relacion. */
  @Column({ type: 'float', default: 0 })
  iva: number;

  /** Monto recibido en divisas ($). */
  @Column({ name: 'monto_divisa', type: 'float', default: 0 })
  montoDivisa: number;

  /** Monto final en Bs: valor independiente, digitado a mano. */
  @Column({ name: 'monto_bs', type: 'float', default: 0 })
  montoBs: number;
}
