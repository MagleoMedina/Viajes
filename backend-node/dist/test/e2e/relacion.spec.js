"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const harness_1 = require("../harness");
const relacion_reportes_service_1 = require("../../src/service/relacion-reportes.service");
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
const RANGO = 'desde=2026-10-01&hasta=2026-10-31';
const TASA = 875.65;
describe('Relación: ingresos, gastos y general', () => {
    let app;
    let db;
    const server = () => app.getHttpServer();
    beforeAll(async () => {
        db = (0, harness_1.tmpDb)('relacion');
        app = await (0, harness_1.crearNest)(db);
        const tituloGasto = (await request(server())
            .post('/api/titulos-gasto')
            .send({ nombre: 'PRUEBA RELACION Varios' })
            .expect(200)).body;
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
        const tituloImpuesto = (await request(server())
            .post('/api/titulos-impuesto')
            .send({ nombre: 'PRUEBA RELACION Impuesto' })
            .expect(200)).body;
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
        const empresas = (await request(server()).get('/api/empresas').expect(200)).body;
        const idDe = (nombre) => empresas.find((e) => e.nombre === nombre).id;
        await request(server())
            .post('/api/ingresos')
            .send({
            empresaId: idDe('CABELUM'),
            fecha: '2026-10-09',
            condicionesPago: 'Contado',
            descripcion: 'Cobro CABELUM',
            cantidad: 1,
            tasa: TASA,
            facturaNum: 501,
            iva: 0,
            montoDivisa: 300,
            montoBs: 262695,
        })
            .expect(200);
        await request(server())
            .post('/api/ingresos')
            .send({
            empresaId: idDe('FERROMINERA'),
            fecha: '2026-10-20',
            condicionesPago: 'Crédito 15 días',
            descripcion: 'Cobro FERROMINERA',
            cantidad: 1,
            tasa: TASA,
            facturaNum: 502,
            iva: 0,
            montoDivisa: 100,
            montoBs: 87565,
        })
            .expect(200);
    });
    afterAll(async () => {
        await app?.close();
        (0, harness_1.limpiarTmp)(db);
    });
    describe('T1: cálculo puro', () => {
        it('resumirIngresos agrupa por empresa (alfabético) y deja SIN EMPRESA', () => {
            const filas = (0, relacion_reportes_service_1.resumirIngresos)([
                { empresa: 'B', montoDivisa: 100, montoBs: 200 },
                { empresa: null, montoDivisa: 50, montoBs: 100 },
                { empresa: 'A', montoDivisa: 10, montoBs: 20 },
                { empresa: 'A', montoDivisa: 5, montoBs: 10 },
            ]);
            expect(filas.map((f) => f.etiqueta)).toEqual(['A', 'B', 'SIN EMPRESA']);
            expect(filas[0]).toEqual({ etiqueta: 'A', montoUsd: 15, montoBs: 30 });
            expect(filas[2]).toEqual({ etiqueta: 'SIN EMPRESA', montoUsd: 50, montoBs: 100 });
        });
        it('resumirGastos abre varios e impuestos por título y suma combustible del viaje', () => {
            const filas = (0, relacion_reportes_service_1.resumirGastos)({
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
            expect(filas[0]).toEqual({ etiqueta: 'Alcaldía', montoUsd: 15, montoBs: 150 });
            expect(filas[2]).toEqual({ etiqueta: 'IVSS', montoUsd: 20, montoBs: 200 });
            expect(filas[4]).toEqual({ etiqueta: 'COMBUSTIBLE', montoUsd: 2, montoBs: 50 });
            expect(filas[5]).toEqual({ etiqueta: 'PAGO A CHOFERES', montoUsd: 5, montoBs: 149 });
            expect(filas[6].montoUsd).toBe(0);
        });
        it('resumirGastos deja las 7 categorías en 0 cuando no hay registros', () => {
            const filas = (0, relacion_reportes_service_1.resumirGastos)({ varios: [], impuestos: [], gasoil: [], viajes: [] });
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
            const filas = (0, relacion_reportes_service_1.resumirGeneral)([{ etiqueta: 'A', montoUsd: 100, montoBs: 1000 }], [{ etiqueta: 'X', montoUsd: 40, montoBs: 400 }]);
            expect(filas).toEqual([
                { etiqueta: 'INGRESOS', montoUsd: 100, montoBs: 1000 },
                { etiqueta: 'EGRESOS', montoUsd: 40, montoBs: 400 },
                { etiqueta: 'RELACIÓN', montoUsd: 60, montoBs: 600 },
            ]);
        });
    });
    describe('T2: GET /api/relacion/:tipo', () => {
        it('ingresos suma los registros del módulo Ingresos por empresa', async () => {
            const res = await request(server()).get(`/api/relacion/ingresos?${RANGO}`).expect(200);
            expect(res.body.tasa).toBe(TASA);
            expect(res.body.cantidad).toBe(2);
            expect(res.body.filas).toEqual([
                { etiqueta: 'CABELUM', montoUsd: 300, montoBs: 262695 },
                { etiqueta: 'FERROMINERA', montoUsd: 100, montoBs: 87565 },
            ]);
            expect(res.body.totalUsd).toBe(400);
            expect(res.body.totalBs).toBe(350260);
        });
        it('gastos abre varios e impuestos por título y deja el resto fijo', async () => {
            const res = await request(server()).get(`/api/relacion/gastos?${RANGO}`).expect(200);
            const porTipo = Object.fromEntries(res.body.filas.map((f) => [f.etiqueta, f]));
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
            expect(porTipo['COMBUSTIBLE'].montoUsd).toBe(17.88);
            expect(porTipo['COMBUSTIBLE'].montoBs).toBe(15200);
            expect(porTipo['PAGO A CHOFERES'].montoUsd).toBe(6);
            expect(porTipo['PAGO A CHOFERES'].montoBs).toBe(5100);
            expect(porTipo['PEAJES'].montoUsd).toBe(11.8);
            expect(porTipo['PEAJES'].montoBs).toBe(10030);
            expect(porTipo['VIÁTICOS'].montoUsd).toBe(18.29);
            expect(porTipo['VIÁTICOS'].montoBs).toBe(15550);
            expect(res.body.totalUsd).toBe(223.97);
            expect(res.body.totalBs).toBe(194740.5);
            expect(res.body.cantidad).toBe(5);
        });
        it('general muestra ingresos, egresos y la relación', async () => {
            const res = await request(server()).get(`/api/relacion/general?${RANGO}`).expect(200);
            expect(res.body.filas).toEqual([
                { etiqueta: 'INGRESOS', montoUsd: 400, montoBs: 350260 },
                { etiqueta: 'EGRESOS', montoUsd: 223.97, montoBs: 194740.5 },
                { etiqueta: 'RELACIÓN', montoUsd: 176.03, montoBs: 155519.5 },
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
            expect(res.body.filas.map((f) => f.etiqueta)).toEqual([
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
    describe('T3: PDFs', () => {
        it('el PDF de ingresos muestra las empresas y el total', async () => {
            const r = await descargar(app, `/api/export/relacion/ingresos?${RANGO}`);
            expect(r.status).toBe(200);
            expect(r.headers['content-type']).toContain('application/pdf');
            const { text } = await pdfParse(r.buffer);
            const plano = text.replace(/\s+/g, '');
            expect(plano.toUpperCase()).toContain('CABELUM');
            expect(plano.toUpperCase()).toContain('FERROMINERA');
            expect(plano).toContain('350.260,00');
        });
        it('el PDF de gastos lista los títulos y el resto de categorías', async () => {
            const r = await descargar(app, `/api/export/relacion/gastos?${RANGO}`);
            expect(r.status).toBe(200);
            const { text } = await pdfParse(r.buffer);
            const plano = text.replace(/\s+/g, '').toUpperCase();
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
            expect(plano).toContain('155.519,50');
        });
        it('el PDF de relación exige el rango de fechas', async () => {
            await request(server()).get('/api/export/relacion/ingresos').expect(400);
        });
    });
});
//# sourceMappingURL=relacion.spec.js.map