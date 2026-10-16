import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Título (rubro) de un gasto vario: se registra antes que los gastos. */
@Entity('titulo_gasto')
export class TituloGasto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;
}
