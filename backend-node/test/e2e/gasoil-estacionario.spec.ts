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

const vehiculoReq = (placa: string) => ({
  marca: 'Toyota',
  modelo: 'Hilux',
  tipo: 'Camioneta',
  placa,
});

const compraReq = (vehiculoId: number, litros: number) => ({
  vehiculoId,
  fecha: '2026-06-01',
  estacion: 'PDV-ESTAC',
  litros,
  precioLitro: 2,
  tasa: 10,
});

const consumoReq = (vehiculoId: number, litros: number, extra: Record<string, unknown> = {}) => ({
  vehiculoId,
  fecha: '2026-06-01',
  litros,
  referencia: 'REF-ESTAC',
  motivo: 'Planta',
  ...extra,
});

/**
 * Gasoil estacionario: consumos que descuentan del stock GLOBAL (comprado −
 * viajes − estacionario), con validación de exceso y CRUD completo.
 */
describe('Gasoil estacionario', () => {
  let app: INestApplication;
  let db: string;
  let vehA: any;
  let vehB: any;
  let consumoA: any;
  const server = () => app.getHttpServer();

  const stock = async () =>
    (await request(server()).get('/api/gastos-gasoil/stock').expect(200)).body;

  beforeAll(async () => {
    db = tmpDb('gasoil-estacionario');
    app = await crearNest(db);
    vehA = (await request(server()).post('/api/vehiculos').send(vehiculoReq('ESTACA1')).expect(200))
      .body;
    vehB = (await request(server()).post('/api/vehiculos').send(vehiculoReq('ESTACB1')).expect(200))
      .body;
  });

  afterAll(async () => {
    await app?.close();
    limpiarTmp(db);
  });

  // ------------------------------------------------------------------ T1
  describe('T1: alta y descuento del stock global', () => {
    it('sin compras el consumo responde 400 y no crea registros', async () => {
      const res = await request(server())
        .post('/api/gasoil-estacionario')
        .send(consumoReq(vehA.id, 10))
        .expect(400);
      expect(res.body.message).toContain('gasoil disponible');
      expect((await request(server()).get('/api/gasoil-estacionario').expect(200)).body).toEqual(
        [],
      );
    });

    it('una compra de 100 L habilita un consumo de 20 L y baja el disponible', async () => {
      await request(server()).post('/api/gastos-gasoil').send(compraReq(vehA.id, 100)).expect(200);
      const res = await request(server())
        .post('/api/gasoil-estacionario')
        .send(consumoReq(vehA.id, 20))
        .expect(200);
      consumoA = res.body;
      expect(consumoA.litros).toBe(20);
      expect(consumoA.vehiculo.placa).toBe('ESTACA1');
      expect(consumoA.referencia).toBe('REF-ESTAC');
      expect(consumoA.motivo).toBe('Planta');

      const s = await stock();
      expect(s.comprado).toBe(100);
      expect(s.usado).toBe(0);
      expect(s.estacionario).toBe(20);
      expect(s.disponible).toBe(80);
    });

    it('rechaza el consumo que excede el disponible y acepta el máximo exacto', async () => {
      await request(server())
        .post('/api/gasoil-estacionario')
        .send(consumoReq(vehB.id, 81, { fecha: '2026-06-02' }))
        .expect(400);
      expect((await stock()).estacionario).toBe(20);

      await request(server())
        .post('/api/gasoil-estacionario')
        .send(consumoReq(vehB.id, 80, { fecha: '2026-06-02' }))
        .expect(200);
      const s = await stock();
      expect(s.estacionario).toBe(100);
      expect(s.disponible).toBe(0);
    });

    it('valida vehículo, litros y fecha', async () => {
      await request(server())
        .post('/api/gasoil-estacionario')
        .send(consumoReq(vehA.id, 0))
        .expect(400);
      await request(server())
        .post('/api/gasoil-estacionario')
        .send(consumoReq(99999, 1))
        .expect(404);
      const res = await request(server())
        .post('/api/gasoil-estacionario')
        .send(consumoReq(vehA.id, 1, { fecha: '2026/06/01' }))
        .expect(400);
      expect(res.body.fields.fecha).toContain('inválido');
    });
  });

  // ------------------------------------------------------------------ T2
  describe('T2: filtros', () => {
    it('GET filtra por rango de fechas y por vehículo', async () => {
      const dia1 = await request(server())
        .get('/api/gasoil-estacionario?desde=2026-06-01&hasta=2026-06-01')
        .expect(200);
      expect(dia1.body).toHaveLength(1);
      expect(dia1.body[0].vehiculo.placa).toBe('ESTACA1');

      const porVehiculo = await request(server())
        .get(`/api/gasoil-estacionario?vehiculoId=${vehB.id}`)
        .expect(200);
      expect(porVehiculo.body).toHaveLength(1);
      expect(porVehiculo.body.every((g: any) => g.vehiculo.placa === 'ESTACB1')).toBe(true);
    });
  });

  // ------------------------------------------------------------------ T3
  describe('T3: edición y borrado devuelven o consumen stock', () => {
    it('PUT que excede el disponible responde 400', async () => {
      const res = await request(server())
        .put(`/api/gasoil-estacionario/${consumoA.id}`)
        .send(consumoReq(vehA.id, 30))
        .expect(400);
      expect(res.body.message).toContain('gasoil disponible');
    });

    it('PUT que reduce litros libera stock', async () => {
      await request(server())
        .put(`/api/gasoil-estacionario/${consumoA.id}`)
        .send(consumoReq(vehA.id, 10, { motivo: 'Taller' }))
        .expect(200);
      const s = await stock();
      expect(s.estacionario).toBe(90);
      expect(s.disponible).toBe(10);
      const lista = (await request(server()).get('/api/gasoil-estacionario').expect(200)).body;
      expect(lista.find((g: any) => g.id === consumoA.id).motivo).toBe('Taller');
    });

    it('DELETE devuelve los litros y el segundo DELETE responde 404', async () => {
      await request(server()).delete(`/api/gasoil-estacionario/${consumoA.id}`).expect(200);
      const s = await stock();
      expect(s.estacionario).toBe(80);
      expect(s.disponible).toBe(20);
      await request(server()).delete(`/api/gasoil-estacionario/${consumoA.id}`).expect(404);
    });
  });

  // ------------------------------------------------------------------ T4
  describe('T4: PDF de consumos estacionarios', () => {
    it('devuelve application/pdf con rango, vehículo y total de litros', async () => {
      const r = await descargar(
        app,
        '/api/export/gasoil-estacionario?desde=2026-06-01&hasta=2026-06-30',
      );
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('application/pdf');
      expect(r.buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(r.headers['content-disposition'].toLowerCase()).toContain('gasoil_estacionario');

      const { text } = await pdfParse(r.buffer);
      const plano = text.replace(/\s+/g, '').toUpperCase();
      expect(plano).toContain('GASOILESTACIONARIO');
      expect(plano).toContain('ESTACB1');
      expect(plano).toContain('TOTAL');
      expect(plano).toContain('80,00');
      expect(plano).toContain('PLANTA');
    }, 60000);

    it('el PDF filtrado por vehículo muestra la placa en los chips', async () => {
      const r = await descargar(
        app,
        `/api/export/gasoil-estacionario?vehiculoId=${vehB.id}`,
      );
      const { text } = await pdfParse(r.buffer);
      const plano = text.replace(/\s+/g, '').toUpperCase();
      expect(plano).toContain('VEHÍCULO');
      expect(plano).toContain('ESTACB1');
    }, 60000);
  });
});
