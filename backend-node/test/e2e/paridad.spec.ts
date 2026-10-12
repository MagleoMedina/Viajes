import { INestApplication } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  crearNest,
  limpiarTmp,
  normalizar,
  pasoNest,
  Politica,
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

describe('backend Node', () => {
  let app: INestApplication;
  let nodeDb: string;

  beforeAll(async () => {
    nodeDb = tmpDb('node');
    await wipeTasas(nodeDb);
    app = await crearNest(nodeDb);
  }, 120000);

  afterAll(async () => {
    await app?.close();
    if (nodeDb) limpiarTmp(nodeDb);
  });

  // Las secuencias mutan el estado en orden; los snapshots fijan el contrato
  // actual para detectar regresiones sin depender de un backend de referencia.
  for (const [grupo, pasos] of GRUPOS) {
    describe(grupo, () => {
      for (const paso of pasos) {
        it(paso.name ?? paso.path, async () => {
          const res = normalizar(await pasoNest(app, paso), paso);
          if (paso.ignoreBody) {
            expect({ status: res.status }).toMatchSnapshot();
          } else {
            expect(res).toMatchSnapshot();
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
        const buf = await traerBinario(app, caso.path);
        if (caso.path.includes('/pdf')) {
          await verificarPdf(buf);
        } else {
          expect(await matrizXlsx(buf)).toMatchSnapshot();
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

/** El PDF lo genera Puppeteer: debe ser valido, con las 16 columnas. */
async function verificarPdf(buf: Buffer) {
  expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse');
  const texto = (await pdfParse(buf)).text.replace(/\s+/g, ' ');
  for (const header of HEADERS_PDF) {
    expect(texto).toContain(header);
  }
  expect(tokensPdf(texto)).toMatchSnapshot();
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

/**
 * Tokens numericos ordenados; la linea "Generado el ..." se ignora (cambia
 * cada corrida). Compacta espacios por si un numero quedo partido.
 */
function tokensPdf(texto: string): string[] {
  const compacto = texto.replace(/\s+/g, ' ');
  const sinPie = compacto.replace(/Generado el\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}(?:\s*-\s*\d+\s*viajes?\s*)?/g, '');
  return (sinPie.match(/\d+(?:[.,]\d+)*/g) ?? []).sort();
}
