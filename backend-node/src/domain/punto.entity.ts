import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('puntos')
export class Punto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;
}
