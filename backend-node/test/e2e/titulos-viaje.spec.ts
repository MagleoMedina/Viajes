import { INestApplication } from '@nestjs/common';
import { crearNest, tmpDb, limpiarTmp } from '../harness';

const request = require('supertest');

const viajeBase = (tituloViajeId: number | null, extra: Record<string, unknown> = {}) => ({
  fechaInicio: '2026-04-01',
  fechaFin: '2026-04-01',
  choferId: 1,
  empresaId: 1,
  carga: 'CARGA-PERSONALIZADA',
  montoViaje: 50,
  combustible: 10,
  viaticos: 5,
  peajes: 3,
  pagoChofer: 2,
  tasa: 100,
  ...(tituloViajeId != null ? { tituloViajeId } : {}),
  ...extra,
});

describe('Títulos de viaje personalizado', () => {
  let app: INestApplication;
  let db: string;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    db = tmpDb('titulos-viaje');
    app = await crearNest(db);
  });

  afterAll(async () => {
    await app?.close();
    limpiarTmp(db);
  });

  // ------------------------------------------------------------------ T1
  describe('T1: CRUD de títulos', () => {
    it('crea, rechaza duplicado (409), lista, renombra y valida 404', async () => {
      await request(server())
        .post('/api/titulos-viaje')
        .send({ nombre: 'Obra Puerto Ordaz' })
        .expect(200);
      await request(server())
        .post('/api/titulos-viaje')
        .send({ nombre: 'Obra Puerto Ordaz' })
        .expect(409);
      // El duplicado choca aunque cambie mayúsculas.
      await request(server())
        .post('/api/titulos-viaje')
        .send({ nombre: 'OBRA PUERTO ORDAZ' })
        .expect(409);
      await request(server())
        .post('/api/titulos-viaje')
        .send({ nombre: 'Encargo Cabelum' })
        .expect(200);

      const lista = await request(server()).get('/api/titulos-viaje').expect(200);
      expect(lista.body.map((t: any) => t.nombre)).toEqual([
        'Encargo Cabelum',
        'Obra Puerto Ordaz',
      ]);

      const id = lista.body.find((t: any) => t.nombre === 'Encargo Cabelum').id;
      await request(server())
        .put(`/api/titulos-viaje/${id}`)
        .send({ nombre: 'Encargo CABELUM 2' })
        .expect(200);
      await request(server())
        .put(`/api/titulos-viaje/${id}`)
        .send({ nombre: 'OBRA PUERTO ORDAZ' })
        .expect(409);
      await request(server())
        .put('/api/titulos-viaje/99999')
        .send({ nombre: 'Fantasma' })
        .expect(404);
      await request(server()).delete('/api/titulos-viaje/99999').expect(404);

      // Nombre vacío: validación 400.
      await request(server()).post('/api/titulos-viaje').send({ nombre: '  ' }).expect(400);
    });
  });

  // ------------------------------------------------------------------ T2
  describe('T2: soft delete conserva los viajes históricos', () => {
    it('oculta el título de la lista pero el viaje conserva su relación', async () => {
      const creados = await request(server())
        .post('/api/titulos-viaje')
        .send({ nombre: 'Título efímero' })
        .expect(200);
      const idTitulo = creados.body.id;

      await request(server()).post('/api/viajes').send(viajeBase(idTitulo)).expect(200);

      await request(server()).delete(`/api/titulos-viaje/${idTitulo}`).expect(200);

      // La lista de activos ya no lo trae...
      const lista = await request(server()).get('/api/titulos-viaje').expect(200);
      expect(lista.body.some((t: any) => t.id === idTitulo)).toBe(false);

      // ...pero el viaje histórico conserva el título en su JSON.
      const viajes = await request(server())
        .get(`/api/viajes?tituloViajeId=${idTitulo}`)
        .expect(200);
      expect(viajes.body).toHaveLength(1);
      expect(viajes.body[0].tituloViaje).toEqual({ id: idTitulo, nombre: 'Título efímero' });

      // No se pueden crear viajes nuevos con un título eliminado.
      await request(server()).post('/api/viajes').send(viajeBase(idTitulo)).expect(404);
    });
  });
});
