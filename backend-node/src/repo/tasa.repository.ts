import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tasa } from '../domain/tasa.entity';

@Injectable()
export class TasaRepository {
  constructor(
    @InjectRepository(Tasa) private readonly repo: Repository<Tasa>,
  ) {}

  /** La mas reciente es la vigente; null si nunca se registro una. */
  async findTopByOrderByIdDesc(): Promise<Tasa | null> {
    const [top] = await this.repo.find({ order: { id: 'DESC' }, take: 1 });
    return top ?? null;
  }

  save(tasa: Tasa): Promise<Tasa> {
    return this.repo.save(tasa);
  }
}