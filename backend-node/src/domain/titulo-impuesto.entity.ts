import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Tipo de impuesto (ej.: IVSS, SENIAT, Alcaldía): se registra antes que los gastos. */
@Entity('titulo_impuesto')
export class TituloImpuesto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;
}
