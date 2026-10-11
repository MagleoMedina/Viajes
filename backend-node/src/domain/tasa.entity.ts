import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { epochMs } from '../common/epoch.transformer';

@Entity('tasas')
export class Tasa {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'float' })
  valor: number;

  @Column({ type: 'integer', transformer: epochMs })
  fecha: Date;

  @Column({ length: 40, nullable: true })
  origen: string;
}
