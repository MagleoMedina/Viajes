import { INestApplication } from '@nestjs/common';
import { crearNest, tmpDb, limpiarTmp } from '../harness';

// Estas pruebas definen el comportamiento esperado de las 6 tareas nuevas del
// plan (ver el plan de acción). Estaran en ROJO hasta implementar cada tarea.
// No usan snapshots: son aserciones directas sobre API, PDF (bytes/pdf-parse),
// XLSX (exceljs) y el HTML de las plantillas (builders a exponer).

const request = require('supertest');
const pdfParse = require('pdf-parse');

/** Descarga binaria cruda (PDF/XLSX) con cabeceras, sin parseo JSON. */
async function descargar(app: INestApplication, ruta: string) {
  const server = app.getHttpServer();
  const res = await request(server)
    .get(ruta)
    .buffer(true)
    .parse((r: any, cb: any) => {
      const trozos: Buffer[] = [];
      r.on('data', (d: Buffer) => trozos.push(d));
      r.on('end', () => cb(null, Buffer.concat(trozos)));
    });
  return {
    status: res.status,
    headers: res.headers as Record<string, string>,
    buffer: res.body as Buffer,
  };
}

/** Carta (letter) apaisada = 792 x 612 pt dentro del MediaBox del PDF. */
const LETTER_LANDSCAPE = /\/MediaBox\s*\[\s*0\s+0\s+792(?:\.\d+)?\s+612(?:\.\d+)?\s*\]/;

const extraerPt = (html: string, re: RegExp): number => {
  const m = html.match(re);
  if (!m) throw new Error(`No se encontro font-size en pt (${re})`);
  return Number(m[1]);
};

const extraerPx = (html: string, re: RegExp): number => {
  const m = html.match(re);
  if (!m) throw new Error(`No se encontro font-size en px (${re})`);
  return Number(m[1]);
};

const viajeBase = (extra: Record<string, unknown>) => ({
  fechaInicio: '2026-01-01',
  fechaFin: '2026-01-02',
  choferId: 1,
  empresaId: 1,
  carga: 'CARGA-NUEVA',
  montoViaje: 1,
  combustible: 10,
  viaticos: 5,
  peajes: 3,
  pagoChofer: 2,
  tasa: 100,
  ...extra,
});

describe('Nuevas funcionalidades (plan de accion)', () => {
  let app: INestApplication;
  let db: string;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    db = tmpDb('nuevas');
    app = await crearNest(db);
  });

  afterAll(async () => {
    await app?.close();
    limpiarTmp(db);
  });

  // ---------------------------------------------------------------- T1
  describe('T1: tamaño de fuente de las celdas', () => {
    it('listado: fuentes ajustadas (px) para 17 columnas', () => {
      const { htmlViajes } = require('../../src/service/export.service');
      const html = htmlViajes([], { empresaNombre: null, color: '#26324a' });
      const th = extraerPx(html, /th\s*\{[^}]*font-size:\s*([\d.]+)px/);
      const td = extraerPx(html, /(?:^|[^-])td\s*\{[^}]*font-size:\s*([\d.]+)px/);
      expect(th).toBeGreaterThanOrEqual(6);
      expect(th).toBeLessThanOrEqual(9);
      expect(td).toBeGreaterThanOrEqual(6);
      expect(td).toBeLessThanOrEqual(9);
    });

    it('reporte (referencia): th y td 10pt', () => {
      const { htmlReporte } = require('../../src/service/reporte-empresa.service');
      const html = htmlReporte({
        empresaId: 1,
        nombreEmpresa: 'TEST',
        direccionEmpresa: 'X',
        rangoFechas: 'HISTORICO GENERAL',
        columnas: ['FECHA'],
        filas: [],
        conMonto: true,
        color: '#8c3b87',
      });
      const th = extraerPt(html, /th\s*\{[^}]*font-size:\s*([\d.]+)pt/);
      const td = extraerPt(html, /th\s*,\s*td\s*\{[^}]*font-size:\s*([\d.]+)pt/);
      expect(th).toBeGreaterThanOrEqual(10 - 0.01);
      expect(td).toBeGreaterThanOrEqual(10 - 0.01);
    });
  });

  // ---------------------------------------------------------------- T2
  describe('T2: PDF en hoja carta (letter) con margenes', () => {
    it('/api/export/pdf usa MediaBox letter apaisada', async () => {
      const r = await descargar(app, '/api/export/pdf');
      expect(r.status).toBe(200);
      expect(r.buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(r.buffer.toString('latin1')).toMatch(LETTER_LANDSCAPE);
    });

    it('/api/export/reporte usa MediaBox letter apaisada', async () => {
      const r = await descargar(app, '/api/export/reporte?empresaId=1');
      expect(r.status).toBe(200);
      expect(r.buffer.toString('latin1')).toMatch(LETTER_LANDSCAPE);
    });
  });

  // ---------------------------------------------------------------- T3
  describe('T3: campo litros (input, columna y sumatoria)', () => {
    // Los viajes con litros descuentan del stock global: se carga gasoil
    // suficiente antes de validar el campo.
    beforeAll(async () => {
      const veh = (
        await request(server())
          .post('/api/vehiculos')
          .send({ marca: 'Toyota', modelo: 'Hilux', tipo: 'Camioneta', placa: 'LITROS1' })
          .expect(200)
      ).body;
      await request(server())
        .post('/api/gastos-gasoil')
        .send({
          vehiculoId: veh.id,
          fecha: '2026-01-01',
          estacion: 'PDV',
          litros: 9000,
          precioLitro: 2,
          tasa: 10,
        })
        .expect(200);
    });

    it('POST /api/viajes guarda y devuelve litros', async () => {
      const res = await request(server())
        .post('/api/viajes')
        .send(viajeBase({ litros: 4242 }))
        .expect(200);
      expect(res.body.litros).toBe(4242);
    });

    it('filas sin litros valen 0 (default de la migracion)', async () => {
      const lista = await request(server()).get('/api/viajes').expect(200);
      expect(lista.body.length).toBeGreaterThan(0);
      expect(lista.body.every((v: any) => typeof v.litros === 'number')).toBe(true);
    });

    it('el PDF incluye columna LITROS y su sumatoria', async () => {
      await request(server()).post('/api/viajes').send(viajeBase({ litros: 4242 })).expect(200);
      const r = await descargar(app, '/api/export/pdf');
      const { text } = await pdfParse(r.buffer);
      const plano = text.replace(/\s+/g, '');
      expect(plano.toUpperCase()).toContain('LITROS');
      expect(plano).toContain('4.242,00');
    });

    it('el XLSX incluye la columna LITROS', async () => {
      const ExcelJS = require('exceljs');
      const r = await descargar(app, '/api/export/xlsx');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(r.buffer);
      const hoja = wb.worksheets[0];
      const textos: string[] = [];
      hoja.eachRow((fila: any) => fila.eachCell((c: any) => textos.push(String(c.value))));
      expect(textos.join(' ').toUpperCase()).toContain('LITROS');
    });
  });

  // ---------------------------------------------------------------- T4
  describe('T4: campos Ref. (combustible, viaticos, peajes, pago chofer)', () => {
    const refs = {
      refCombustible: 'REF-C-1',
      refViaticos: 'REF-V-1',
      refPeajes: 'REF-P-1',
      refPagoChofer: 'REF-PC-1',
    };

    it('POST guarda y GET devuelve las 4 referencias', async () => {
      const res = await request(server())
        .post('/api/viajes')
        .send(viajeBase(refs))
        .expect(200);
      expect(res.body.refCombustible).toBe(refs.refCombustible);
      expect(res.body.refViaticos).toBe(refs.refViaticos);
      expect(res.body.refPeajes).toBe(refs.refPeajes);
      expect(res.body.refPagoChofer).toBe(refs.refPagoChofer);
    });

    it('la data existente queda con Ref por defecto "0"', async () => {
      const lista = await request(server()).get('/api/viajes').expect(200);
      const antiguos = lista.body.filter((v: any) => v.carga !== 'CARGA-NUEVA');
      expect(antiguos.length).toBeGreaterThan(0);
      for (const v of antiguos) {
        expect(v.refCombustible).toBe('0');
        expect(v.refViaticos).toBe('0');
        expect(v.refPeajes).toBe('0');
        expect(v.refPagoChofer).toBe('0');
      }
    });

    it('la exportación (PDF y Excel) NO incluye columnas Ref', async () => {
      const pdf = await descargar(app, '/api/export/pdf');
      const { text } = await pdfParse(pdf.buffer);
      expect(text.replace(/\s+/g, '').toUpperCase()).not.toMatch(/REF\./);

      const ExcelJS = require('exceljs');
      const xlsx = await descargar(app, '/api/export/xlsx');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(xlsx.buffer);
      const textos: string[] = [];
      wb.worksheets[0].eachRow((fila: any) => fila.eachCell((c: any) => textos.push(String(c.value))));
      expect(textos.join(' ').toUpperCase()).not.toMatch(/REF\./);
    });
  });

  // ---------------------------------------------------------------- T5
  describe('T5: tabla por contenido, celdas sin desbordar el margen', () => {
    it('ancho auto, layout por contenido y sin anchos fijos por columna', () => {
      const { htmlViajes } = require('../../src/service/export.service');
      const html = htmlViajes([], { empresaNombre: null, color: '#26324a' });
      expect(html).toMatch(/table\s*\{[^}]*width:\s*auto/);
      expect(html).toMatch(/table-layout:\s*auto/);
      // Sin anchos fijos: cada celda toma el ancho de su texto.
      expect(html).not.toMatch(/<th style="width: \d+%;">/);
    });

    it('el PDF no excede el ancho de carta apaisada', async () => {
      const r = await descargar(app, '/api/export/pdf');
      const medias = [...r.buffer.toString('latin1').matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
      expect(medias.length).toBeGreaterThan(0);
      for (const m of medias) {
        expect(Number(m[3])).toBeLessThanOrEqual(792 + 0.5); // ancho <= carta apaisada
      }
    });
  });

  // ---------------------------------------------------------------- T6
  describe('T6: nombre de archivo segun el documento', () => {
    it('PDF del listado nombra viajes + empresa + periodo', async () => {
      const r = await descargar(
        app,
        '/api/export/pdf?empresaId=1&desde=2026-01-01&hasta=2026-01-31',
      );
      const cd = r.headers['content-disposition'] ?? '';
      expect(cd).toMatch(/filename="?/i);
      expect(cd).toMatch(/viajes/i);
      expect(cd).toContain('2026-01-01');
      expect(cd).toContain('2026-01-31');
      expect(cd.toLowerCase()).toContain('.pdf');
    });

    it('XLSX nombra viajes + periodo + .xlsx', async () => {
      const r = await descargar(app, '/api/export/xlsx?empresaId=1&desde=2026-01-01&hasta=2026-01-31');
      const cd = r.headers['content-disposition'] ?? '';
      expect(cd).toMatch(/viajes/i);
      expect(cd).toContain('2026-01-01');
      expect(cd.toLowerCase()).toContain('.xlsx');
    });

    it('reporte por empresa nombra reporte + empresa', async () => {
      const r = await descargar(app, '/api/export/reporte?empresaId=1');
      const cd = r.headers['content-disposition'] ?? '';
      expect(cd).toMatch(/reporte/i);
      expect(cd.toLowerCase()).toContain('.pdf');
      expect(cd).toMatch(/cabelum/i);
      expect(cd).not.toMatch(/filename="viajes\.pdf"/i);
    });
  });

  // ---------------------------------------------------------------- T7
  describe('T7: reporte con montos, sin montos y sin chofer ordena por fecha ascendente', () => {
    let empresaId: number;

    beforeAll(async () => {
      empresaId = (
        await request(server())
          .post('/api/empresas')
          .send({ nombre: 'ORDEN-FECHAS' })
          .expect(200)
      ).body.id;

      for (const fecha of ['2026-03-15', '2026-02-10', '2026-04-20']) {
        await request(server())
          .post('/api/viajes')
          .send(viajeBase({ empresaId, fechaInicio: fecha, fechaFin: fecha }))
          .expect(200);
      }
    });

    /** Fechas completas del cuerpo del PDF, en el orden en que salen. */
    const fechasDelPdf = (texto: string) =>
      [...texto.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map(
        (m) => `${m[3]}-${m[2]}-${m[1]}`,
      );

    for (const [nombre, extra] of [
      ['con montos', ''],
      ['sin montos', '&conMonto=false'],
      ['sin monto y sin chofer', '&conMonto=false&sinChofer=true'],
    ] as const) {
      it(nombre, async () => {
        const r = await descargar(
          app,
          `/api/export/reporte?empresaId=${empresaId}&desde=2026-02-01&hasta=2026-04-30${extra}`,
        );
        const { text } = await pdfParse(r.buffer);
        expect(fechasDelPdf(text)).toEqual(['2026-02-10', '2026-03-15', '2026-04-20']);
      });
    }
  });
});
