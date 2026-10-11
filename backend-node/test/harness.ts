import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'test', 'seed.db');
const JAR = path.resolve(ROOT, '..', 'backend', 'target', 'viajes-0.0.1-SNAPSHOT.jar');

export const JAVA_BASE = 'http://127.0.0.1:8099';

export type Politica = {
  name?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  ignoreBody?: boolean;
};

export type Respuesta = { status: number; body: any };

export function tmpDb(nombre: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'viajes-paridad-'));
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

/** Borra las tasas del archivo para que el GET vacio y el historial partan iguales. */
export async function wipeTasas(dbPath: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)));
  db.run('DELETE FROM tasas');
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  db.close();
}

/**
 * Deja la tabla de tasas de Java vacia. Java puede insertar una tasa de
 * GoCambio DESPUES de responder "listo"; se borra en bucle hasta que el GET
 * quede realmente vacio.
 */
export async function javaSinTasas(javaDb: string): Promise<void> {
  const limite = Date.now() + 50000;
  let limpias = 0;
  while (Date.now() < limite) {
    await wipeTasas(javaDb);
    try {
      const r = await fetch(JAVA_BASE + '/api/tasa', { signal: AbortSignal.timeout(2000) });
      const body = await r.json();
      // La insercion de GoCambio puede llegar despues del boot; exige
      // confirmaciones seguidas para no arrancar los tests con una tasa viva.
      if (Object.keys(body).length === 0) {
        limpias += 1;
        if (limpias >= 3) return;
      } else {
        limpias = 0;
      }
    } catch {
      /* sigue esperando */
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error('Java no deja la tabla de tasas vacia');
}

/** Arranca el jar de Java con una copia de la base; espera a que responda. */
export async function startJava(dbPath: string): Promise<ChildProcess> {
  // Un java huerfano de una corrida previa puede conservar el puerto y servir
  // una base vieja; se elimina antes de levantar el nuestro.
  try {
    execSync("pkill -f '[v]iajes-0.0.1-SNAPSHOT.jar'");
  } catch {
    /* no habia ninguno */
  }
  const child = spawn(
    'java',
    ['-jar', JAR, `--server.port=8099`, `--spring.datasource.url=jdbc:sqlite:${dbPath}`],
    { stdio: 'ignore' },
  );
  const limite = Date.now() + 120000;
  while (Date.now() < limite) {
    try {
      const r = await fetch(JAVA_BASE + '/api/choferes', { signal: AbortSignal.timeout(2000) });
      if (r.ok) return child;
    } catch {
      /* sigue esperando */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  child.kill();
  throw new Error('El backend Java no arranco en 120s');
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

export async function pasoJava(p: Politica): Promise<Respuesta> {
  const res = await fetch(JAVA_BASE + p.path, {
    method: p.method,
    headers: { 'Content-Type': 'application/json' },
    body: p.body != null ? JSON.stringify(p.body) : undefined,
  });
  const text = await res.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

/** Termina Java y espera a que el proceso muera, para no dejar huerfanos en el puerto. */
export async function matarJava(java: ChildProcess): Promise<void> {
  if (!java || java.exitCode != null) return;
  java.kill('SIGTERM');
  await new Promise((r) => {
    const t = setTimeout(() => {
      java.kill('SIGKILL');
      r(undefined);
    }, 5000);
    java.once('exit', () => {
      clearTimeout(t);
      r(undefined);
    });
  });
}

/**
 * Normaliza respuestas antes de comparar:
 * - tasa: quita fecha/id (Java y Node generan "ahora" distinto).
 * - validacion con varios campos: quita message (Java elige el primero en su
 *   orden interno de Bean Validation, no replicable con class-validator;
 *   el frontend solo muestra el message, cualquier campo vale).
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