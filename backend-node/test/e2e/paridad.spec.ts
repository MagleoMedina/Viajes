import { INestApplication } from '@nestjs/common';
import { ChildProcess } from 'child_process';
import * as ExcelJS from 'exceljs';
import {
  crearNest,
  javaSinTasas,
  limpiarTmp,
  matarJava,
  normalizar,
  pasoJava,
  pasoNest,
  Politica,
  startJava,
  tmpDb,
  wipeTasas,
} from '../harness';
import * as escenarios from '../scenarios';

const HEADERS_PDF = [
  'FECHA INICIO', 'FECHA FIN', 'EMPRESA', 'CHOFER', 'CARGA',
  'PUNTO SALIDA', 'PUNTO LLEGADA', 'MONTO VIAJE $', 'COMBUSTIBLE',
  'VIATICOS', 'PEAJES', 'PAGO CHOFER', 'GASTOS VARIOS',
  'TOTAL BS', 'TASA', 'TOTAL $',
];

const GRUPOS: [string, Politica[]][] = [
  ['choferes', escenarios.choferes],
  ['empresas', escenarios.empresas],
  ['puntos', escenarios.puntos],
  ['vehiculos', escenarios.vehiculos],
  ['recorridos', escenarios.recorridos],
  ['viajes', escenarios.viajes],
  ['tasa', escenarios.tasa],
];

describe('paridad con backend Java', () => {
  let app: INestApplication;
  let java: ChildProcess;
  let nodeDb: string;
  let javaDb: string;

  beforeAll(
    async () => {
      nodeDb = tmpDb('node');
      javaDb = tmpDb('java');
      await wipeTasas(nodeDb);
      java = await startJava(javaDb);
      // Java inserta una tasa de GoCambio al arrancar; se limpia para partir iguales.
      await javaSinTasas(javaDb);
      app = await crearNest(nodeDb);
    },
    240000,
  );

  afterAll(async () => {
    await app?.close();
    await matarJava(java);
    if (nodeDb) limpiarTmp(nodeDb);
    if (javaDb) limpiarTmp(javaDb);
  });

  for (const [grupo, pasos] of GRUPOS) {
    describe(grupo, () => {
      for (const paso of pasos) {
        it(paso.name ?? paso.path, async () => {
          const [deNest, deJava] = await Promise.all([
            pasoNest(app, paso),
            pasoJava(paso),
          ]);
          const a = normalizar(deNest, paso);
          const b = normalizar(deJava, paso);
          if (paso.ignoreBody) {
            expect(a.status).toBe(b.status);
          } else {
            expect(a).toEqual(b);
          }
        });
      }
    });
  }

  describe('export', () => {
    const casos = [
      { name: 'xlsx-todo', path: '/api/export/xlsx' },
      { name: 'xlsx-filtrado', path: '/api/export/xlsx?empresaId=2' },
      { name: 'pdf-todo', path: '/api/export/pdf' },
      { name: 'pdf-filtrado', path: '/api/export/pdf?empresaId=2' },
    ];

    for (const caso of casos) {
      it(caso.name, async () => {
        const esPdf = caso.path.includes('/pdf');
        const [deNest, deJava] = await Promise.all([
          traerBinario(app, caso.path),
          fetch('http://127.0.0.1:8099' + caso.path).then(async (r) => Buffer.from(await r.arrayBuffer())),
        ]);
        if (esPdf) {
          await compararPdf(deNest, deJava);
        } else {
          await compararXlsx(deNest, deJava);
        }
      });
    }
  });
});

async function traerBinario(app: INestApplication, path: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const request = require('supertest');
  const res = await request(app.getHttpServer())
    .get(path)
    .buffer(true)
    .parse((resp: any, cb: any) => {
      const chunks: Buffer[] = [];
      resp.on('data', (c: Buffer) => chunks.push(c));
      resp.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  if (res.status >= 400) {
    throw new Error(`export ${path} fallo: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function compararXlsx(a: Buffer, b: Buffer) {
  const [ma, mb] = await Promise.all([matrizXlsx(a), matrizXlsx(b)]);
  expect(JSON.stringify(ma)).toBe(JSON.stringify(mb));
}

async function matrizXlsx(buf: Buffer): Promise<any[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  const matriz: any[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const fila: any[] = [];
    for (let c = 1; c <= 16; c++) {
      const v = row.getCell(c).value;
      fila.push(v && typeof v === 'object' ? (v as any)?.text ?? (v as any)?.result ?? null : v);
    }
    matriz.push(fila);
  });
  return matriz;
}

async function compararPdf(a: Buffer, b: Buffer) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse');
  const [rawA, rawB] = await Promise.all([
    pdfParse(a).then((r: any) => r.text),
    pdfParse(b).then((r: any) => r.text),
  ]);
  // pdfkit corta palabras en saltos de linea; colapsar espacios equipara el texto.
  const textoA = rawA.replace(/\s+/g, ' ');
  const textoB = rawB.replace(/\s+/g, ' ');
  for (const header of HEADERS_PDF) {
    expect(textoA).toContain(header);
    expect(textoB).toContain(header);
  }
  expect(tokensPdf(textoA)).toEqual(tokensPdf(textoB));
}

/**
 * Tokens numericos ordenados; la linea "Generado el ..." se ignora (cambia
 * cada corrida). Compacta espacios por si un numero quedo partido.
 */
function tokensPdf(texto: string): string[] {
  const compacto = texto.replace(/\s+/g, ' ');
  const sinPie = compacto.replace(/Generado el\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}(?:\s*-\s*\d+\s*viajes?\s*)?/g, '');
  return (sinPie.match(/\d+(?:[.,]\d+)*/g) ?? []).sort();
}