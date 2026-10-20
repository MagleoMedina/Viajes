import { INestApplication } from '@nestjs/common';
import { crearNest, tmpDb, limpiarTmp } from '../harness';
import {
  resumirGastos,
  resumirGeneral,
  resumirIngresos,
} from '../../src/service/relacion-reportes.service';

const request = require('supertest');
const pdfParse = require('pdf-parse');

/** Descarga binaria cruda (PDF) con cabeceras, sin parseo JSON. */
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

/** La siembra trae 2 viajes: CABELUM 09/10 ($280) y FERROMINERA 20/10 ($100). */
const RANGO = 'desde=2026-10-01&hasta=2026-10-31';
const TASA = 875.65;

describe('Relación: ingresos, gastos y general', () => {
  let app: INestApplication;
  let db: string;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    db = tmpDb('relacion');
    app = await crearNest(db);

    // Gastos de los 3 módulos dentro del rango (para el reporte de gastos).
    const tituloGasto = (
      await request(server())
        .post('/api/titulos-gasto')
        .send({ nombre: 'PRUEBA RELACION Varios' })
        .expect(200)
    ).body;
    await request(server())
      .post('/api/gastos-varios')
      .send({
        tituloGastoId: tituloGasto.id,
        fecha: '2026-10-06',
        numero: '1',
        motivo: 'prueba',
        montoUsd: 100,
        montoBs: 87565,
        tasa: TASA,
        referencia: '1',
      })
      .expect(200);

    const tituloImpuesto = (
      await request(server())
        .post('/api/titulos-impuesto')
        .send({ nombre: 'PRUEBA RELACION Impuesto' })
        .expect(200)
    ).body;
    await request(server())
      .post('/api/gastos-impuestos')
      .send({
        tituloImpuestoId: tituloImpuesto.id,
        fecha: '2026-10-07',
        numero: '2',
        motivo: 'prueba',
        montoUsd: 50,
        montoBs: 43782.5,
        tasa: TASA,
        referencia: '2',
      })
      .expect(200);

    await request(server())
      .post('/api/gastos-gasoil')
      .send({ fecha: '2026-10-08', estacion: 'PDV', litros: 10, precioLitro: 2, tasa: TASA })
      .expect(200);
  });

  afterAll(async () => {
    await app?.close();
    limpiarTmp(db);
  });

  // ------------------------------------------------------------------ T1
  describe('T1: cálculo puro', () => {
    it('resumirIngresos agrupa por empresa (alfabético) y deja SIN EMPRESA', () => {
      const filas = resumirIngresos(
        [
          { empresa: 'B', montoViaje: 100 },
          { empresa: null, montoViaje: 50 },
          { empresa: 'A', montoViaje: 10 },
          { empresa: 'A', montoViaje: 5 },
        ],
        2,
      );
      expect(filas.map((f) => f.etiqueta)).toEqual(['A', 'B', 'SIN EMPRESA']);
      expect(filas[0]).toEqual({ etiqueta: 'A', montoUsd: 15, montoBs: 30 });
      expect(filas[2]).toEqual({ etiqueta: 'SIN EMPRESA', montoUsd: 50, montoBs: 100 });
    });

    it('resumirGastos abre varios e impuestos por título y suma combustible del viaje', () => {
      const filas = resumirGastos({
        varios: [
          { titulo: 'Alcaldía', montoUsd: 10, montoBs: 100 },
          { titulo: 'Alcaldía', montoUsd: 5, montoBs: 50 },
        ],
        impuestos: [
          { titulo: 'IVSS', montoUsd: 20, montoBs: 200 },
          { titulo: 'ISLR', montoUsd: 7, montoBs: 70 },
        ],
        gasoil: [{ montoUsd: 30, montoBs: 300 }],
        viajes: [
          { tasa: 10, combustible: 20, pagoChofer: 50, peajes: 0, viaticos: 0 },
          { tasa: 0, combustible: 30, pagoChofer: 99, peajes: 0, viaticos: 0 },
        ],
      });
      expect(filas.map((f) => f.etiqueta)).toEqual([
        'Alcaldía',
        'ISLR',
        'IVSS',
        'GASOIL',
        'COMBUSTIBLE',
        'PAGO A CHOFERES',
        'PEAJES',
        'VIÁTICOS',
      ]);
      // Dos registros del mismo título se muestran una vez, sumados.
      expect(filas[0]).toEqual({ etiqueta: 'Alcaldía', montoUsd: 15, montoBs: 150 });
      expect(filas[2]).toEqual({ etiqueta: 'IVSS', montoUsd: 20, montoBs: 200 });
      // Tasa 0 no aporta $ pero sí Bs.
      expect(filas[4]).toEqual({ etiqueta: 'COMBUSTIBLE', montoUsd: 2, montoBs: 50 });
      expect(filas[5]).toEqual({ etiqueta: 'PAGO A CHOFERES', montoUsd: 5, montoBs: 149 });
      expect(filas[6].montoUsd).toBe(0);
    });

    it('resumirGastos deja las 7 categorías en 0 cuando no hay registros', () => {
      const filas = resumirGastos({ varios: [], impuestos: [], gasoil: [], viajes: [] });
      expect(filas.map((f) => f.etiqueta)).toEqual([
        'GASTOS VARIOS',
        'IMPUESTOS',
        'GASOIL',
        'COMBUSTIBLE',
        'PAGO A CHOFERES',
        'PEAJES',
        'VIÁTICOS',
      ]);
      expect(filas.every((f) => f.montoUsd === 0 && f.montoBs === 0)).toBe(true);
    });

    it('resumirGeneral resta egresos de ingresos y admite negativos', () => {
      const filas = resumirGeneral(
        [{ etiqueta: 'A', montoUsd: 100, montoBs: 1000 }],
        [{ etiqueta: 'X', montoUsd: 40, montoBs: 400 }],
      );
      expect(filas).toEqual([
        { etiqueta: 'INGRESOS', montoUsd: 100, montoBs: 1000 },
        { etiqueta: 'EGRESOS', montoUsd: 40, montoBs: 400 },
        { etiqueta: 'RELACIÓN', montoUsd: 60, montoBs: 600 },
      ]);
    });
  });

  // ------------------------------------------------------------------ T2
  describe('T2: GET /api/relacion/:tipo', () => {
    it('ingresos suma los viajes por empresa con la tasa vigente', async () => {
      const res = await request(server()).get(`/api/relacion/ingresos?${RANGO}`).expect(200);
      expect(res.body.tasa).toBe(TASA);
      expect(res.body.cantidad).toBe(2);
      expect(res.body.filas).toEqual([
        { etiqueta: 'CABELUM', montoUsd: 280, montoBs: 245182 },
        { etiqueta: 'FERROMINERA', montoUsd: 100, montoBs: 87565 },
      ]);
      expect(res.body.totalUsd).toBe(380);
      expect(res.body.totalBs).toBe(332747);
    });

    it('gastos abre varios e impuestos por título y deja el resto fijo', async () => {
      const res = await request(server()).get(`/api/relacion/gastos?${RANGO}`).expect(200);
      const porTipo = Object.fromEntries(
        res.body.filas.map((f: any) => [f.etiqueta, f]),
      );
      // Los 2 módulos se muestran por su título, una fila cada uno.
      expect(porTipo['PRUEBA RELACION Varios']).toEqual({
        etiqueta: 'PRUEBA RELACION Varios',
        montoUsd: 100,
        montoBs: 87565,
      });
      expect(porTipo['PRUEBA RELACION Impuesto']).toEqual({
        etiqueta: 'PRUEBA RELACION Impuesto',
        montoUsd: 50,
        montoBs: 43782.5,
      });
      expect(porTipo['GASTOS VARIOS']).toBeUndefined();
      expect(porTipo['IMPUESTOS']).toBeUndefined();
      expect(porTipo['GASOIL'].montoUsd).toBe(20);
      // 15000/850.12 + 200/850 = 17.88
      expect(porTipo['COMBUSTIBLE'].montoUsd).toBe(17.88);
      expect(porTipo['COMBUSTIBLE'].montoBs).toBe(15200);
      // 5000/850.12 + 100/850 = 6.00
      expect(porTipo['PAGO A CHOFERES'].montoUsd).toBe(6);
      expect(porTipo['PAGO A CHOFERES'].montoBs).toBe(5100);
      expect(porTipo['PEAJES'].montoUsd).toBe(11.8);
      expect(porTipo['PEAJES'].montoBs).toBe(10030);
      expect(porTipo['VIÁTICOS'].montoUsd).toBe(18.29);
      expect(porTipo['VIÁTICOS'].montoBs).toBe(15550);
      expect(res.body.totalUsd).toBe(223.97);
      expect(res.body.totalBs).toBe(194740.5);
      expect(res.body.cantidad).toBe(5); // 3 módulos + 2 viajes con gastos
    });

    it('general muestra ingresos, egresos y la relación', async () => {
      const res = await request(server()).get(`/api/relacion/general?${RANGO}`).expect(200);
      expect(res.body.filas).toEqual([
        { etiqueta: 'INGRESOS', montoUsd: 380, montoBs: 332747 },
        { etiqueta: 'EGRESOS', montoUsd: 223.97, montoBs: 194740.5 },
        { etiqueta: 'RELACIÓN', montoUsd: 156.03, montoBs: 138006.5 },
      ]);
      expect(res.body.cantidad).toBe(7);
    });

    it('un rango sin registros devuelve cantidad 0', async () => {
      const res = await request(server())
        .get('/api/relacion/ingresos?desde=2026-01-01&hasta=2026-01-31')
        .expect(200);
      expect(res.body.cantidad).toBe(0);
      expect(res.body.filas).toEqual([]);
    });

    it('sin gastos deja las 7 categorías visibles en 0', async () => {
      const res = await request(server())
        .get('/api/relacion/gastos?desde=2026-01-01&hasta=2026-01-31')
        .expect(200);
      expect(res.body.cantidad).toBe(0);
      expect(res.body.filas.map((f: any) => f.etiqueta)).toEqual([
        'GASTOS VARIOS',
        'IMPUESTOS',
        'GASOIL',
        'COMBUSTIBLE',
        'PAGO A CHOFERES',
        'PEAJES',
        'VIÁTICOS',
      ]);
      expect(res.body.totalUsd).toBe(0);
      expect(res.body.totalBs).toBe(0);
    });

    it('exige ambas fechas y el orden correcto', async () => {
      const sinFechas = await request(server()).get('/api/relacion/ingresos').expect(400);
      expect(sinFechas.body.fields.desde).toBeDefined();
      expect(sinFechas.body.fields.hasta).toBeDefined();

      const invertidas = await request(server())
        .get('/api/relacion/gastos?desde=2026-10-31&hasta=2026-10-01')
        .expect(400);
      expect(invertidas.body.fields.hasta).toBeDefined();
    });

    it('un tipo desconocido responde 404', async () => {
      await request(server()).get(`/api/relacion/otro?${RANGO}`).expect(404);
    });
  });

  // ------------------------------------------------------------------ T3
  describe('T3: PDFs', () => {
    it('el PDF de ingresos muestra las empresas y el total', async () => {
      const r = await descargar(app, `/api/export/relacion/ingresos?${RANGO}`);
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('application/pdf');
      const { text } = await pdfParse(r.buffer);
      const plano = text.replace(/\s+/g, '');
      expect(plano.toUpperCase()).toContain('CABELUM');
      expect(plano.toUpperCase()).toContain('FERROMINERA');
      expect(plano).toContain('332.747,00');
    });

    it('el PDF de gastos lista los títulos y el resto de categorías', async () => {
      const r = await descargar(app, `/api/export/relacion/gastos?${RANGO}`);
      expect(r.status).toBe(200);
      const { text } = await pdfParse(r.buffer);
      const plano = text.replace(/\s+/g, '').toUpperCase();
      // Varios e impuestos salen por título, sin fila agregada de categoría.
      expect(plano).toContain('PRUEBARELACIONVARIOS');
      expect(plano).toContain('PRUEBARELACIONIMPUESTO');
      expect(plano).not.toContain('GASTOSVARIOS');
      expect(plano).not.toContain('IMPUESTOS');
      expect(plano).toContain('GASOIL');
      expect(plano).toContain('COMBUSTIBLE');
      expect(plano).toContain('PAGOACHOFERES');
      expect(plano).toContain('PEAJES');
      expect(plano).toContain('VIÁTICOS');
      expect(plano).toContain('194.740,50');
    });

    it('el PDF general muestra la relación ingresos − egresos', async () => {
      const r = await descargar(app, `/api/export/relacion/general?${RANGO}`);
      expect(r.status).toBe(200);
      const { text } = await pdfParse(r.buffer);
      const plano = text.replace(/\s+/g, '').toUpperCase();
      expect(plano).toContain('INGRESOS');
      expect(plano).toContain('EGRESOS');
      expect(plano).toContain('RELACIÓN');
      expect(plano).toContain('138.006,50');
    });

    it('el PDF de relación exige el rango de fechas', async () => {
      await request(server()).get('/api/export/relacion/ingresos').expect(400);
    });
  });
});
