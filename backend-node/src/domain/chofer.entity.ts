import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('choferes')
export class Chofer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  nombre: string;

  @Column({ nullable: true })
  apellido: string;

  @Column({ unique: true })
  cedula: string;
}
