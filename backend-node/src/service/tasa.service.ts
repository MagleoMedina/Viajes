import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Tasa } from '../domain/tasa.entity';
import { TasaRepository } from '../repo/tasa.repository';
import { ApiException } from '../web/api-exception';
import { round2 } from '../common/dates';

/**
 * Tasa automatica desde GoCambio (https://api.gocambio.app): se refresca a las
 * 9:05 y a las 13:05 de cada dia y al arrancar la aplicacion. El usuario puede
 * sobreescribirla a mano desde el modulo de Tasa.
 */
@Injectable()
export class TasaService implements OnApplicationBootstrap {
  private readonly log = new Logger(TasaService.name);

  constructor(private readonly repo: TasaRepository) {}

  /** Actualiza desde la API. Lanza 502 si GoCambio no responde o no trae USD/VES. */
  async refrescar(): Promise<Tasa> {
    const precio = await this.consultarApi();
    const tasa = new Tasa();
    tasa.valor = precio;
    tasa.fecha = new Date();
    tasa.origen = 'GoCambio (BCV)';
    return this.repo.save(tasa);
  }

  @Cron('5 9,13 * * *', { timeZone: 'America/Caracas' })
  async programada() {
    try {
      const tasa = await this.refrescar();
      this.log.log(`Tasa automatica actualizada: ${tasa.valor}`);
    } catch (e) {
      this.log.warn(`No se pudo actualizar la tasa programada: ${(e as Error).message}`);
    }
  }

  /** Al arrancar queda cargada aunque nadie abra el modulo. */
  async onApplicationBootstrap() {
    if (process.env.TASA_AUTO === 'false') return;
    try {
      const tasa = await this.refrescar();
      this.log.log(`Tasa inicial desde GoCambio: ${tasa.valor}`);
    } catch (e) {
      this.log.warn(`No se pudo obtener la tasa al arrancar: ${(e as Error).message}`);
    }
  }

  private async consultarApi(): Promise<number> {
    const url = `https://api.gocambio.app/api/v1/prices?date=${utcAhora()}&bases=all`;
    let respuesta: Response;
    try {
      respuesta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      throw new ApiException(502, `No se pudo consultar GoCambio: ${(e as Error).message}`);
    }
    if (respuesta.status !== 200) {
      throw new ApiException(502, `GoCambio respondio HTTP ${respuesta.status}`);
    }
    return this.extraerUsdVes(await respuesta.text());
  }

  /** Precio USD en bolivares (base VES). Se redondea a 2 decimales: el input admite 0.01. */
  private extraerUsdVes(cuerpo: string): number {
    let datos: any;
    try {
      datos = JSON.parse(cuerpo).data;
    } catch {
      throw new ApiException(502, 'Respuesta inesperada de GoCambio');
    }
    if (!Array.isArray(datos)) {
      throw new ApiException(502, 'Respuesta inesperada de GoCambio');
    }
    for (const fila of datos) {
      if (fila?.code === 'USD' && fila?.base === 'VES') {
        const precio = Number(fila.price);
        if (precio > 0) {
          return round2(precio);
        }
      }
    }
    throw new ApiException(502, 'GoCambio no devolvio precio USD/VES');
  }
}

function utcAhora(): string {
  const ahora = new Date();
  const iso = nowIso(ahora);
  return encodeURIComponent(iso);
}

function nowIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
  );
}