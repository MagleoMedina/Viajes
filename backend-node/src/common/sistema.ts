import { networkInterfaces } from 'os';

/** IPv4 de red local (192.168.x.x, 10.x.x.x...): sin loopback ni link-local. */
export function ipsLocales(): string[] {
  const ips: string[] = [];
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const dir of interfaces ?? []) {
      if (dir.family !== 'IPv4' || dir.internal) continue;
      if (dir.address.startsWith('169.254.')) continue;
      ips.push(dir.address);
    }
  }
  return ips;
}

export interface InfoServidor {
  /** Direccion principal para entrar desde otro equipo; 127.0.0.1 si no hay red. */
  ip: string;
  /** Todas las IPv4 de red local por las que responde el backend. */
  ips: string[];
  /** Puerto en el que escucha (PORT, o 8080 si no vino definido). */
  puerto: number;
}

/**
 * Direccion del servidor web: la comparte el sidebar del frontend para que se
 * sepa desde que IP/puerto entra la interfaz (el backend escucha en 0.0.0.0).
 */
export function infoServidor(): InfoServidor {
  const ips = ipsLocales();
  return {
    ip: ips[0] ?? '127.0.0.1',
    ips,
    puerto: Number(process.env.PORT ?? 8080),
  };
}
