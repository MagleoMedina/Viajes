"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const harness_1 = require("../harness");
const request = require('supertest');
const pdfParse = require('pdf-parse');
async function descargar(app, ruta) {
    const server = app.getHttpServer();
    const res = await request(server)
        .get(ruta)
        .buffer(true)
        .parse((r, cb) => {
        const trozos = [];
        r.on('data', (d) => trozos.push(d));
        r.on('end', () => cb(null, Buffer.concat(trozos)));
    });
    return {
        status: res.status,
        headers: res.headers,
        buffer: res.body,
    };
}
const gastoBase = (extra) => ({
    tituloImpuestoId: 1,
    fecha: '2026-03-05',
    numero: 'N-1',
    motivo: 'MOTIVO-TEST',
    montoUsd: 10,
    tasa: 10,
    referencia: 'REF-1',
    ...extra,
});
describe('Gastos de impuestos (titulo_impuesto + gastos_impuestos)', () => {
    let app;
    let db;
    const server = () => app.getHttpServer();
    beforeAll(async () => {
        db = (0, harness_1.tmpDb)('gastos-impuestos');
        app = await (0, harness_1.crearNest)(db);
    });
    afterAll(async () => {
        await app?.close();
        (0, harness_1.limpiarTmp)(db);
    });
    describe('T1: CRUD de tipos de impuesto', () => {
        it('crea, rechaza duplicado (409), lista y renombra', async () => {
            await request(server()).post('/api/titulos-impuesto').send({ nombre: 'IVSS' }).expect(200);
            await request(server()).post('/api/titulos-impuesto').send({ nombre: 'IVSS' }).expect(409);
            await request(server())
                .post('/api/titulos-impuesto')
                .send({ nombre: 'Alcaldía' })
                .expect(200);
            await request(server()).post('/api/titulos-impuesto').send({ nombre: 'Libre' }).expect(200);
            const lista = await request(server()).get('/api/titulos-impuesto').expect(200);
            expect(lista.body.map((t) => t.nombre)).toEqual(['Alcaldía', 'IVSS', 'Libre']);
            const id = lista.body.find((t) => t.nombre === 'Libre').id;
            await request(server())
                .put(`/api/titulos-impuesto/${id}`)
                .send({ nombre: 'Papelería' })
                .expect(200);
            await request(server())
                .put(`/api/titulos-impuesto/${id}`)
                .send({ nombre: 'ALCALDÍA' })
                .expect(409);
        });
        it('404 al renombrar o eliminar un id inexistente', async () => {
            await request(server())
                .put('/api/titulos-impuesto/99999')
                .send({ nombre: 'X' })
                .expect(404);
            await request(server()).delete('/api/titulos-impuesto/99999').expect(404);
        });
        it('no elimina un tipo en uso (409) y sí uno libre (200)', async () => {
            await request(server())
                .post('/api/gastos-impuestos')
                .send(gastoBase({ tituloImpuestoId: 1 }))
                .expect(200);
            await request(server()).delete('/api/titulos-impuesto/1').expect(409);
            const lista = await request(server()).get('/api/titulos-impuesto').expect(200);
            const libre = lista.body.find((t) => t.nombre === 'Papelería');
            await request(server()).delete(`/api/titulos-impuesto/${libre.id}`).expect(200);
        });
    });
    describe('T2: altas, filtros y borrado de gastos', () => {
        it('POST calcula Monto Bs = Monto $ × tasa y %DB = Bs × 0.3', async () => {
            const res = await request(server())
                .post('/api/gastos-impuestos')
                .send(gastoBase({ tituloImpuestoId: 1, montoUsd: 15, tasa: 10 }))
                .expect(200);
            expect(res.body.montoBs).toBe(150);
            expect(res.body.porcentajeDb).toBe(45);
            expect(res.body.tituloImpuesto.nombre).toBe('IVSS');
        });
        it('POST respeta el Monto Bs digitado a mano', async () => {
            const res = await request(server())
                .post('/api/gastos-impuestos')
                .send(gastoBase({ tituloImpuestoId: 1, montoUsd: 15, tasa: 10, montoBs: 123 }))
                .expect(200);
            expect(res.body.montoBs).toBe(123);
        });
        it('POST con tipo inexistente responde 404', async () => {
            await request(server())
                .post('/api/gastos-impuestos')
                .send(gastoBase({ tituloImpuestoId: 99999 }))
                .expect(404);
        });
        it('GET filtra por intervalo de fechas y por tipo', async () => {
            const tipos = await request(server()).get('/api/titulos-impuesto').expect(200);
            const alcaldia = tipos.body.find((t) => t.nombre === 'Alcaldía');
            await request(server())
                .post('/api/gastos-impuestos')
                .send(gastoBase({ tituloImpuestoId: alcaldia.id, fecha: '2026-03-10', montoUsd: 20, tasa: 10 }))
                .expect(200);
            await request(server())
                .post('/api/gastos-impuestos')
                .send(gastoBase({
                tituloImpuestoId: alcaldia.id,
                fecha: '2026-04-20',
                montoUsd: 5,
                tasa: 10,
                motivo: 'FUERA-DE-RANGO',
            }))
                .expect(200);
            const todo = await request(server()).get('/api/gastos-impuestos').expect(200);
            expect(todo.body.length).toBeGreaterThanOrEqual(4);
            const rango = await request(server())
                .get('/api/gastos-impuestos?desde=2026-03-01&hasta=2026-03-31')
                .expect(200);
            expect(rango.body.length).toBeGreaterThanOrEqual(3);
            expect(rango.body.every((g) => g.fecha.startsWith('2026-03'))).toBe(true);
            expect(rango.body.some((g) => g.motivo === 'FUERA-DE-RANGO')).toBe(false);
            const porTipo = await request(server())
                .get('/api/gastos-impuestos?tituloId=1')
                .expect(200);
            expect(porTipo.body.length).toBeGreaterThan(0);
            expect(porTipo.body.every((g) => g.tituloImpuesto.id === 1)).toBe(true);
        });
        it('PUT actualiza y DELETE borra', async () => {
            const lista = await request(server()).get('/api/gastos-impuestos').expect(200);
            const id = lista.body[0].id;
            await request(server())
                .put(`/api/gastos-impuestos/${id}`)
                .send(gastoBase({ motivo: 'MOTIVO-EDITADO', montoUsd: 7, tasa: 10 }))
                .expect(200);
            const tras = await request(server()).get('/api/gastos-impuestos').expect(200);
            const editado = tras.body.find((g) => g.id === id);
            expect(editado.motivo).toBe('MOTIVO-EDITADO');
            expect(editado.montoBs).toBe(70);
            await request(server()).delete(`/api/gastos-impuestos/${id}`).expect(200);
            await request(server()).delete(`/api/gastos-impuestos/${id}`).expect(404);
            const final = await request(server()).get('/api/gastos-impuestos').expect(200);
            expect(final.body.some((g) => g.id === id)).toBe(false);
        });
    });
    describe('T3: sumas por tipo de impuesto ($ y Bs)', () => {
        it('resumirPorTipo agrupa y suma 10 + 20 = 30', () => {
            const { resumirPorTipo } = require('../../src/service/gastos-impuestos.service');
            const bloques = resumirPorTipo([
                { tituloImpuesto: { nombre: 'Alcaldía' }, montoUsd: 10, montoBs: 100 },
                { tituloImpuesto: { nombre: 'Alcaldía' }, montoUsd: 20, montoBs: 200 },
                { tituloImpuesto: { nombre: 'Otro' }, montoUsd: 1, montoBs: 10 },
            ]);
            expect(bloques).toHaveLength(2);
            const alcaldia = bloques.find((b) => b.clave === 'Alcaldía');
            expect(alcaldia.sumaUsd).toBe(30);
            expect(alcaldia.sumaBs).toBe(300);
        });
        it('el PDF del intervalo muestra una fila por tipo con la suma', async () => {
            const r = await descargar(app, '/api/export/gastos-impuestos?desde=2026-03-01&hasta=2026-03-31');
            expect(r.status).toBe(200);
            const { text } = await pdfParse(r.buffer);
            const plano = text.replace(/\s+/g, '');
            expect(plano.toUpperCase()).toContain('IVSS');
            expect(plano).toContain('373,00');
            expect(plano).toContain('573,00');
            expect(plano.toUpperCase().split('IVSS').length - 1).toBe(1);
            expect(plano).not.toContain('MOTIVO-TEST');
            expect(plano.toUpperCase()).not.toContain('%DB');
        });
    });
    describe('T4: PDF de gastos de impuestos', () => {
        it('devuelve application/pdf con tipos, subtotales y total general', async () => {
            const r = await descargar(app, '/api/export/gastos-impuestos?desde=2026-03-01&hasta=2026-03-31');
            expect(r.status).toBe(200);
            expect(r.headers['content-type']).toContain('application/pdf');
            expect(r.buffer.subarray(0, 5).toString()).toBe('%PDF-');
            expect(r.headers['content-disposition'].toLowerCase()).toContain('gastos_impuestos');
            const { text } = await pdfParse(r.buffer);
            const plano = text.replace(/\s+/g, '').toUpperCase();
            expect(plano).toContain('GASTOSDEIMPUESTOS');
            expect(plano).not.toContain('SUBTOTAL');
            expect(plano).toContain('TOTALGENERAL');
            expect(plano).toContain('IVSS');
            expect(plano).toContain('ALCALDÍA');
        });
    });
});
//# sourceMappingURL=gastos-impuestos.spec.js.map