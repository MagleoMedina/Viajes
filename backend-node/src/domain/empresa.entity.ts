import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('empresas')
export class Empresa {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  direccion: string | null;

  /** true = oculta del frontend, conservada para los viajes historicos. */
  @Column({ type: 'boolean', default: false })
  eliminado: boolean;
}
