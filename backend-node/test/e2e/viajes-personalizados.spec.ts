import { INestApplication } from '@nestjs/common';
import { crearNest, tmpDb, limpiarTmp } from '../harness';

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

const textoPdf = async (buffer: Buffer): Promise<string> => {
  const r = await pdfParse(buffer);
  return r.text as string;
};

const viajeBase = (extra: Record<string, unknown>) => ({
  fechaInicio: '2026-05-01',
  fechaFin: '2026-05-01',
  choferId: 1,
  empresaId: 1,
  carga: 'CARGA-PERS',
  montoViaje: 40,
  combustible: 5,
  viaticos: 7,
  peajes: 1,
  pagoChofer: 2,
  tasa: 100,
  ...extra,
});

describe('Viajes personalizados', () => {
  let app: INestApplication;
  let db: string;
  const server = () => app.getHttpServer();
  let idObra = 0;
  let idEncargo = 0;

  beforeAll(async () => {
    db = tmpDb('viajes-personalizados');
    app = await crearNest(db);

    const obra = await request(server())
      .post('/api/titulos-viaje')
      .send({ nombre: 'Obra Maroa' })
      .expect(200);
    idObra = obra.body.id;
    const encargo = await request(server())
      .post('/api/titulos-viaje')
      .send({ nombre: 'Encargo Cabelum' })
      .expect(200);
    idEncargo = encargo.body.id;

    // 2 personalizados con título Obra Maroa (vehículos distintos)...
    await request(server())
      .post('/api/viajes')
      .send(viajeBase({ tituloViajeId: idObra, vehiculoId: 1, montoViaje: 100 }))
      .expect(200);
    await request(server())
      .post('/api/viajes')
      .send(viajeBase({ tituloViajeId: idObra, vehiculoId: 2, montoViaje: 50 }))
      .expect(200);
    // ...1 con otro título y 1 viaje normal (sin título).
    await request(server())
      .post('/api/viajes')
      .send(viajeBase({ tituloViajeId: idEncargo, montoViaje: 30 }))
      .expect(200);
    await request(server()).post('/api/viajes').send(viajeBase({ vehiculoId: 1 })).expect(200);
  });

  afterAll(async () => {
    await app?.close();
    limpiarTmp(db);
  });

  // ------------------------------------------------------------------ T1
  describe('T1: el listado general excluye los personalizados', () => {
    it('GET /api/viajes sin tituloViajeId no trae los personalizados', async () => {
      const r = await request(server()).get('/api/viajes').expect(200);
      const cargas = r.body.map((v: any) => v.carga);
      expect(cargas).toContain('CARGA-PERS'); // el viaje normal del beforeAll
      // Los 3 personalizados no aparecen.
      expect(r.body.filter((v: any) => v.tituloViaje != null)).toHaveLength(0);
    });

    it('GET /api/viajes?tituloViajeId= trae solo los del título', async () => {
      const r = await request(server())
        .get(`/api/viajes?tituloViajeId=${idObra}`)
        .expect(200);
      expect(r.body).toHaveLength(2);
      expect(r.body.every((v: any) => v.tituloViaje?.id === idObra)).toBe(true);
    });

    it('el título inexistente responde 404', async () => {
      await request(server()).post('/api/viajes').send(viajeBase({ tituloViajeId: 99999 })).expect(404);
    });
  });

  // ------------------------------------------------------------------ T2
  describe('T2: PDF con el título como H1 y sin columna VIATICOS', () => {
    it('el PDF del título usa su nombre como encabezado y oculta VIATICOS', async () => {
      const r = await descargar(app, `/api/export/personalizados/pdf?tituloViajeId=${idObra}`);
      expect(r.status).toBe(200);
      expect(r.buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(r.headers['content-disposition']).toContain('obra_maroa');

      const texto = await textoPdf(r.buffer);
      // La cabecera del reporte escribe el nombre en mayúsculas.
      expect(texto).toMatch(/obra maroa/i);
      expect(texto).not.toContain('VIATICOS');
      // El cuadro final por tipo de vehículo está en todos los PDF.
      expect(texto).toContain('Resumen por tipo de vehículo');
    });

    it('sin título responde 400 y con título inexistente 404', async () => {
      const sin = await descargar(app, '/api/export/personalizados/pdf');
      expect(sin.status).toBe(400);
      const malo = await descargar(app, '/api/export/personalizados/pdf?tituloViajeId=99999');
      expect(malo.status).toBe(404);
    });
  });

  // ------------------------------------------------------------------ T3
  describe('T3: cuadro por tipo de vehículo al final de todos los PDF', () => {
    it('el resumen por tipo suma viajes y MONTO VIAJE $ con fila TOTAL', () => {
      const { resumirTipos } = require('../../src/service/export.service');
      const viajes = [
        { vehiculo: { tipo: 'Gandola' }, montoViaje: 100 },
        { vehiculo: { tipo: 'Camion' }, montoViaje: 50 },
        { vehiculo: { tipo: 'Camion' }, montoViaje: 30 },
        { vehiculo: null, montoViaje: 10 },
        { vehiculo: { tipo: '' }, montoViaje: 5 },
      ];
      const filas = resumirTipos(viajes as any);
      expect(filas).toEqual([
        { tipo: 'Camion', cantidad: 2, monto: 80 },
        { tipo: 'Gandola', cantidad: 1, monto: 100 },
        { tipo: 'Sin tipo', cantidad: 1, monto: 5 },
        { tipo: 'Sin vehículo', cantidad: 1, monto: 10 },
      ]);
    });

    it('el PDF del listado incluye la página del resumen con TOTAL', async () => {
      const r = await descargar(app, '/api/export/pdf');
      expect(r.status).toBe(200);
      const texto = await textoPdf(r.buffer);
      expect(texto).toContain('Resumen por tipo de vehículo');
      expect(texto).toContain('TOTAL');
      // Solo viajes normales: el viaje normal tiene vehículo 1 (Gandola) y
      // los personalizados (con Camión) quedan fuera del listado.
      expect(texto).toContain('Gandola');
      expect(texto).toContain('Sin vehículo');
    });

    it('el reporte por empresa incluye la página del resumen', async () => {
      const r = await descargar(app, '/api/export/reporte?empresaId=1&conMonto=true');
      expect(r.status).toBe(200);
      const texto = await textoPdf(r.buffer);
      // El CSS del reporte escribe el título en mayúsculas.
      expect(texto).toMatch(/resumen por tipo de vehículo/i);
      expect(texto).toContain('TOTAL');
    });
  });

  // ------------------------------------------------------------------ T4
  describe('T4: gasoil del título y reportes personalizados', () => {
    it('el gasoil del PDF personalizado solo muestra los vehículos del título', async () => {
      const r = await descargar(app, `/api/export/personalizados/pdf?tituloViajeId=${idObra}`);
      const texto = await textoPdf(r.buffer);
      // Los dos viajes del título usan los vehículos 1 y 2.
      expect(texto).toContain('A73AA5M');
      expect(texto).toContain('A97CT2A');
      // El viaje del otro título no tiene vehículo: no debe colarse.
      expect(texto).not.toContain('Sin vehículo');
    });

    it('el listado normal usa la cabecera del reporte (todas las empresas)', async () => {
      const r = await descargar(app, '/api/export/pdf');
      const texto = await textoPdf(r.buffer);
      expect(texto).toContain('REPORTE VIAJES DESDE EL');
      expect(texto).toContain('Sin pausa, sin excusas, sin limites');
      expect(texto).toContain('TODAS LAS EMPRESAS');
      // Sin empresa filtrada no se imprime dirección.
      expect(texto).not.toContain('Zona Industrial Matanzas');
    });

    it('el reporte personalizado responde 200 y usa el título', async () => {
      const r = await descargar(
        app,
        `/api/export/personalizados/reporte?tituloViajeId=${idObra}&conMonto=true`,
      );
      expect(r.status).toBe(200);
      expect(r.headers['content-disposition']).toContain('obra_maroa');
      const texto = await textoPdf(r.buffer);
      expect(texto).toMatch(/obra maroa/i);
      expect(texto).toContain('MONTO ($)');
    });

    it('el reporte personalizado sin monto y sin chofer omite ambas columnas', async () => {
      const r = await descargar(
        app,
        `/api/export/personalizados/reporte?tituloViajeId=${idObra}&conMonto=false&sinChofer=true`,
      );
      expect(r.status).toBe(200);
      const texto = await textoPdf(r.buffer);
      expect(texto).not.toContain('MONTO ($)');
      expect(texto).not.toContain('CHOFER');
    });

    it('el reporte personalizado exige título', async () => {
      expect((await descargar(app, '/api/export/personalizados/reporte')).status).toBe(400);
      expect(
        (await descargar(app, '/api/export/personalizados/reporte?tituloViajeId=99999')).status,
      ).toBe(404);
    });

    it('el reporte personalizado incluye el gasoil del título', async () => {
      const r = await descargar(
        app,
        `/api/export/personalizados/reporte?tituloViajeId=${idObra}&conMonto=true`,
      );
      const texto = await textoPdf(r.buffer);
      expect(texto).toMatch(/resumen de gasoil/i);
      expect(texto).toContain('A73AA5M');
      expect(texto).toContain('A97CT2A');
      expect(texto).not.toContain('Sin vehículo');
    });

    it('los reportes normales no llevan cuadro de gasoil', async () => {
      const r = await descargar(app, '/api/export/reporte?empresaId=1&conMonto=true');
      const texto = await textoPdf(r.buffer);
      expect(texto).not.toMatch(/resumen de gasoil/i);
    });

    it('todas las páginas repiten la cabecera y ya no hay chip PERIODO', async () => {
      const r = await descargar(app, '/api/export/personalizados/pdf?tituloViajeId=' + idObra);
      const texto = await textoPdf(r.buffer);
      const cabeceras = texto.match(/REPORTE VIAJES DESDE EL/g) ?? [];
      // Listado + gasoil + resumen por tipo.
      expect(cabeceras.length).toBeGreaterThanOrEqual(3);
      expect(texto).not.toContain('PERIODO');
    });
  });
});
