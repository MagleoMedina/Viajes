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

const gastoBase = (extra: Record<string, unknown>) => ({
  tituloGastoId: 1,
  fecha: '2026-03-05',
  numero: 'N-1',
  motivo: 'MOTIVO-TEST',
  montoUsd: 10,
  tasa: 10,
  porcentajeDb: 0,
  referencia: 'REF-1',
  ...extra,
});

describe('Gastos varios (titulo_gasto + gastos_varios)', () => {
  let app: INestApplication;
  let db: string;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    db = tmpDb('gastos-varios');
    app = await crearNest(db);
  });

  afterAll(async () => {
    await app?.close();
    limpiarTmp(db);
  });

  // ------------------------------------------------------------------ T1
  describe('T1: CRUD de títulos de gasto', () => {
    it('crea, rechaza duplicado (409), lista y renombra', async () => {
      await request(server())
        .post('/api/titulos-gasto')
        .send({ nombre: 'Alcaldía' })
        .expect(200);
      await request(server())
        .post('/api/titulos-gasto')
        .send({ nombre: 'Alcaldía' })
        .expect(409);
      await request(server())
        .post('/api/titulos-gasto')
        .send({ nombre: 'Mantenimiento' })
        .expect(200);

      const lista = await request(server()).get('/api/titulos-gasto').expect(200);
      expect(lista.body.map((t: any) => t.nombre)).toEqual(['Alcaldía', 'Mantenimiento']);

      // Renombrar a un nombre libre pasa; a uno duplicado, 409.
      const id = lista.body.find((t: any) => t.nombre === 'Mantenimiento').id;
      await request(server())
        .put(`/api/titulos-gasto/${id}`)
        .send({ nombre: 'Papelería' })
        .expect(200);
      await request(server())
        .put(`/api/titulos-gasto/${id}`)
        .send({ nombre: 'ALCALDÍA' })
        .expect(409);
    });

    it('404 al renombrar o eliminar un id inexistente', async () => {
      await request(server())
        .put('/api/titulos-gasto/99999')
        .send({ nombre: 'X' })
        .expect(404);
      await request(server()).delete('/api/titulos-gasto/99999').expect(404);
    });

    it('no elimina un título en uso (409) y sí uno libre (200)', async () => {
      // Papelería queda libre (nunca se usó) y Alcaldía se usa en T2/T3.
      // En uso: se crea un gasto apuntando a Papelería.
      await request(server()).post('/api/titulos-gasto').send({ nombre: 'Impuestos' }).expect(200);
      const titulos = await request(server()).get('/api/titulos-gasto').expect(200);
      const impuestos = titulos.body.find((t: any) => t.nombre === 'Impuestos');
      const papeleria = titulos.body.find((t: any) => t.nombre === 'Papelería');
      await request(server())
        .post('/api/gastos-varios')
        .send(gastoBase({ tituloGastoId: impuestos.id }))
        .expect(200);

      await request(server()).delete(`/api/titulos-gasto/${impuestos.id}`).expect(409);
      await request(server()).delete(`/api/titulos-gasto/${papeleria.id}`).expect(200);
    });
  });

  // ------------------------------------------------------------------ T2
  describe('T2: altas, filtros y borrado de gastos', () => {
    it('POST calcula Monto Bs = Monto $ × tasa cuando no viene', async () => {
      const res = await request(server())
        .post('/api/gastos-varios')
        .send(gastoBase({ montoUsd: 15, tasa: 10 }))
        .expect(200);
      expect(res.body.montoBs).toBe(150);
      expect(res.body.tituloGasto.nombre).toBe('Alcaldía');
    });

    it('POST respeta el Monto Bs digitado a mano', async () => {
      const res = await request(server())
        .post('/api/gastos-varios')
        .send(gastoBase({ montoUsd: 15, tasa: 10, montoBs: 123 }))
        .expect(200);
      expect(res.body.montoBs).toBe(123);
    });

    it('POST deriva el Monto $ del Monto Bs cuando solo viene el de Bs', async () => {
      const res = await request(server())
        .post('/api/gastos-varios')
        .send(
          gastoBase({
            montoUsd: undefined,
            tasa: 12.5,
            montoBs: 250,
            fecha: '2026-06-15',
          }),
        )
        .expect(200);
      expect(res.body.montoBs).toBe(250);
      expect(res.body.montoUsd).toBe(20);
    });

    it('POST con título inexistente responde 404', async () => {
      await request(server())
        .post('/api/gastos-varios')
        .send(gastoBase({ tituloGastoId: 99999 }))
        .expect(404);
    });

    it('GET filtra por intervalo de fechas y por título', async () => {
      const titulos = await request(server()).get('/api/titulos-gasto').expect(200);
      const alcaldia = titulos.body.find((t: any) => t.nombre === 'Alcaldía');

      await request(server())
        .post('/api/gastos-varios')
        .send(gastoBase({ tituloGastoId: alcaldia.id, fecha: '2026-03-10', montoUsd: 20, tasa: 10 }))
        .expect(200);
      await request(server())
        .post('/api/gastos-varios')
        .send(
          gastoBase({
            tituloGastoId: alcaldia.id,
            fecha: '2026-04-20',
            montoUsd: 5,
            tasa: 10,
            motivo: 'FUERA-DE-RANGO',
          }),
        )
        .expect(200);

      const todo = await request(server()).get('/api/gastos-varios').expect(200);
      expect(todo.body.length).toBeGreaterThanOrEqual(4);

      const rango = await request(server())
        .get('/api/gastos-varios?desde=2026-03-01&hasta=2026-03-31')
        .expect(200);
      expect(rango.body.length).toBeGreaterThanOrEqual(3);
      expect(rango.body.every((g: any) => g.fecha.startsWith('2026-03'))).toBe(true);
      expect(rango.body.some((g: any) => g.motivo === 'FUERA-DE-RANGO')).toBe(false);

      const porTitulo = await request(server())
        .get(`/api/gastos-varios?tituloId=${alcaldia.id}`)
        .expect(200);
      expect(porTitulo.body.every((g: any) => g.tituloGasto.id === alcaldia.id)).toBe(true);
    });

    it('PUT actualiza y DELETE borra', async () => {
      const lista = await request(server()).get('/api/gastos-varios').expect(200);
      const id = lista.body[0].id;
      await request(server())
        .put(`/api/gastos-varios/${id}`)
        .send(gastoBase({ motivo: 'MOTIVO-EDITADO', montoUsd: 7, tasa: 10 }))
        .expect(200);
      const tras = await request(server()).get('/api/gastos-varios').expect(200);
      const editado = tras.body.find((g: any) => g.id === id);
      expect(editado.motivo).toBe('MOTIVO-EDITADO');
      expect(editado.montoBs).toBe(70);

      await request(server()).delete(`/api/gastos-varios/${id}`).expect(200);
      await request(server()).delete(`/api/gastos-varios/${id}`).expect(404);
      const final = await request(server()).get('/api/gastos-varios').expect(200);
      expect(final.body.some((g: any) => g.id === id)).toBe(false);
    });
  });

  // ------------------------------------------------------------------ T3
  describe('T3: sumas por título ($ y Bs)', () => {
    it('resumirPorTitulo agrupa y suma 10 + 20 = 30', () => {
      const { resumirPorTitulo } = require('../../src/service/gastos-varios.service');
      const bloques = resumirPorTitulo([
        { tituloGasto: { nombre: 'Alcaldía' }, montoUsd: 10, montoBs: 100 },
        { tituloGasto: { nombre: 'Alcaldía' }, montoUsd: 20, montoBs: 200 },
        { tituloGasto: { nombre: 'Otro' }, montoUsd: 1, montoBs: 10 },
      ]);
      expect(bloques).toHaveLength(2);
      const alcaldia = bloques.find((b: any) => b.titulo === 'Alcaldía');
      expect(alcaldia.sumaUsd).toBe(30);
      expect(alcaldia.sumaBs).toBe(300);
    });

    it('el PDF del intervalo muestra una fila por título con la suma', async () => {
      // Alcaldía en marzo: $15 + $15 + $20 = $50 y Bs 150 + 123 + 200 = 473.
      const r = await descargar(
        app,
        '/api/export/gastos-varios?desde=2026-03-01&hasta=2026-03-31',
      );
      expect(r.status).toBe(200);
      const { text } = await pdfParse(r.buffer);
      const plano = text.replace(/\s+/g, '');
      expect(plano.toUpperCase()).toContain('ALCALDÍA');
      expect(plano).toContain('473,00'); // suma Bs del título
      expect(plano).toContain('573,00'); // total general Bs (473 + 100)
      // El título aparece una sola vez: no se repite por cada registro.
      expect(plano.toUpperCase().split('ALCALDÍA').length - 1).toBe(1);
      // Sin detalle de cada gasto.
      expect(plano).not.toContain('MOTIVO-TEST');
      expect(plano.toUpperCase()).not.toContain('%DB');
    });
  });

  // ------------------------------------------------------------------ T4
  describe('T4: PDF de gastos varios', () => {
    it('devuelve application/pdf con títulos, subtotales y total general', async () => {
      const r = await descargar(app, '/api/export/gastos-varios?desde=2026-03-01&hasta=2026-03-31');
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('application/pdf');
      expect(r.buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(r.headers['content-disposition'].toLowerCase()).toContain('gastos_varios');

      const { text } = await pdfParse(r.buffer);
      const plano = text.replace(/\s+/g, '').toUpperCase();
      expect(plano).toContain('GASTOSVARIOS');
      expect(plano).not.toContain('SUBTOTAL');
      expect(plano).toContain('TOTALGENERAL');
      expect(plano).toContain('ALCALDÍA');
    });
  });
});
