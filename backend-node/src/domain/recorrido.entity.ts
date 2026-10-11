import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('recorridos')
export class Recorrido {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150, unique: true })
  nombre: string;
}
