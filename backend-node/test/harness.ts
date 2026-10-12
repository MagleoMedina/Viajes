import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'test', 'seed.db');

export type Politica = {
  name?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  ignoreBody?: boolean;
};

export type Respuesta = { status: number; body: any };

/** Copia la siembra a un archivo temporal para no tocar la base real. */
export function tmpDb(nombre: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'viajes-test-'));
  const p = path.join(dir, `${nombre}.db`);
  fs.copyFileSync(SEED, p);
  return p;
}

export function limpiarTmp(dbPath: string) {
  try {
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  } catch {
    /* noop */
  }
}

/** Borra las tasas del archivo para partir de un estado vacio conocido. */
export async function wipeTasas(dbPath: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)));
  db.run('DELETE FROM tasas');
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  db.close();
}

/** Levanta la app Nest apuntando a la copia de base indicada. */
export async function crearNest(dbPath: string): Promise<INestApplication> {
  process.env.DB_PATH = dbPath;
  process.env.TASA_AUTO = 'false';
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export async function pasoNest(app: INestApplication, p: Politica): Promise<Respuesta> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const request = require('supertest');
  const server = app.getHttpServer();
  let req: any;
  if (p.method === 'GET') req = request(server).get(p.path);
  else if (p.method === 'POST') req = request(server).post(p.path).send(p.body ?? {});
  else if (p.method === 'PUT') req = request(server).put(p.path).send(p.body ?? {});
  else req = request(server).delete(p.path);
  const res = await req;
  return { status: res.status, body: res.body };
}

/**
 * Normaliza antes de comparar con el snapshot:
 * - tasa: quita fecha/id (se generan en cada corrida).
 * - validacion con varios campos: quita message (el orden interno no aporta).
 */
export function normalizar(resp: Respuesta, p: Politica): Respuesta {
  if (resp.body && typeof resp.body === 'object') {
    let body = resp.body;
    if (p.path.startsWith('/api/tasa')) {
      const { fecha, id, ...resto } = body;
      body = resto;
    }
    if (
      body && typeof body === 'object' &&
      body.fields &&
      Object.keys(body.fields).length > 1
    ) {
      body = { ...body, message: undefined };
    }
    return { ...resp, body };
  }
  return resp;
}
