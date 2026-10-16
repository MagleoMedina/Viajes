"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const harness_1 = require("../harness");
const request = require('supertest');
const pdfParse = require('pdf-parse');
const vehiculoReq = (placa) => ({
    marca: 'Toyota',
    modelo: 'Hilux',
    tipo: 'Camioneta',
    placa,
});
const gastoReq = (vehiculoId, litros, extra = {}) => ({
    vehiculoId,
    fecha: '2026-05-01',
    estacion: 'PDV-STOCK',
    litros,
    precioLitro: 2,
    tasa: 10,
    ...extra,
});
const viajeReq = (vehiculoId, litros, extra = {}) => ({
    fechaInicio: '2026-05-02',
    fechaFin: '2026-05-03',
    choferId: 1,
    empresaId: 1,
    carga: 'CARGA-STOCK',
    vehiculoId,
    litros,
    combustible: 100,
    tasa: 10,
    ...extra,
});
describe('Stock de gasoil global', () => {
    let app;
    let db;
    const server = () => app.getHttpServer();
    const crearVehiculo = async (placa) => (await request(server()).post('/api/vehiculos').send(vehiculoReq(placa)).expect(200)).body;
    const stock = async (excluirViajeId) => {
        const q = excluirViajeId ? `?excluirViajeId=${excluirViajeId}` : '';
        return (await request(server()).get(`/api/gastos-gasoil/stock${q}`).expect(200)).body;
    };
    beforeAll(async () => {
        db = (0, harness_1.tmpDb)('stock-gasoil');
        app = await (0, harness_1.crearNest)(db);
    });
    afterAll(async () => {
        await app?.close();
        (0, harness_1.limpiarTmp)(db);
    });
    describe('T1: stock inicial y forma de la respuesta', () => {
        it('parte en 0 y responde el objeto global (sin vehiculoId)', async () => {
            const s = await stock();
            expect(s.vehiculoId).toBeUndefined();
            expect(s.comprado).toBe(0);
            expect(s.usado).toBe(0);
            expect(s.disponible).toBe(0);
        });
    });
    describe('T2: compras de cualquier vehículo suman al mismo stock', () => {
        it('dos compras en vehículos distintos suman 40 + 10 = 50', async () => {
            const vehA = await crearVehiculo('STOCK02A');
            const vehB = await crearVehiculo('STOCK02B');
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(vehA.id, 40)).expect(200);
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(vehB.id, 10)).expect(200);
            const s = await stock();
            expect(s.comprado).toBe(50);
            expect(s.usado).toBe(0);
            expect(s.disponible).toBe(50);
        });
    });
    describe('T3: los viajes descuentan del stock global', () => {
        it('viaje de cualquier vehículo resta del mismo pool; exceso bloquea 400', async () => {
            const antes = await stock();
            const vehC = await crearVehiculo('STOCK03');
            await request(server()).post('/api/viajes').send(viajeReq(vehC.id, 30)).expect(200);
            let s = await stock();
            expect(s.usado).toBe(antes.usado + 30);
            expect(s.disponible).toBe(antes.disponible - 30);
            const res = await request(server())
                .post('/api/viajes')
                .send(viajeReq(vehC.id, s.disponible + 1))
                .expect(400);
            expect(res.body.message).toContain('gasoil disponible');
            expect((await stock()).usado).toBe(s.usado);
            await request(server()).post('/api/viajes').send(viajeReq(vehC.id, s.disponible)).expect(200);
            expect((await stock()).disponible).toBe(0);
        });
        it('viaje sin vehículo también consume el stock global', async () => {
            const vehD = await crearVehiculo('STOCK04');
            const antes = await stock();
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(vehD.id, 10)).expect(200);
            await request(server()).post('/api/viajes').send(viajeReq(null, 6)).expect(200);
            const s = await stock();
            expect(s.comprado).toBe(antes.comprado + 10);
            expect(s.usado).toBe(antes.usado + 6);
            expect(s.disponible).toBe(antes.disponible + 10 - 6);
        });
    });
    describe('T4: edición de viaje excluye sus propios litros', () => {
        it('PUT hasta el máximo disponible pasa; un litro más responde 400', async () => {
            const veh = await crearVehiculo('STOCK05');
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 50)).expect(200);
            const viaje = (await request(server()).post('/api/viajes').send(viajeReq(veh.id, 20)).expect(200)).body;
            const poolSinViaje = await stock(viaje.id);
            const maximo = poolSinViaje.disponible;
            await request(server())
                .put(`/api/viajes/${viaje.id}`)
                .send(viajeReq(veh.id, maximo))
                .expect(200);
            expect((await stock()).disponible).toBe(0);
            const res = await request(server())
                .put(`/api/viajes/${viaje.id}`)
                .send(viajeReq(veh.id, maximo + 1))
                .expect(400);
            expect(res.body.message).toContain('gasoil disponible');
        });
    });
    describe('T5: edición de compra no deja el stock global negativo', () => {
        it('PUT que reduciría litros por debajo del consumo responde 400', async () => {
            const veh = await crearVehiculo('STOCK06');
            const gasto = (await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 40)).expect(200)).body;
            await request(server()).post('/api/viajes').send(viajeReq(veh.id, 30)).expect(200);
            const antes = await stock();
            const res = await request(server())
                .put(`/api/gastos-gasoil/${gasto.id}`)
                .send(gastoReq(veh.id, 25))
                .expect(400);
            expect(res.body.fields.litros).toContain('negativo');
            expect((await stock()).comprado).toBe(antes.comprado);
        });
        it('PUT que mantiene el stock en positivo pasa', async () => {
            const veh = await crearVehiculo('STOCK07');
            const gasto = (await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 40)).expect(200)).body;
            await request(server()).post('/api/viajes').send(viajeReq(veh.id, 30)).expect(200);
            const antes = await stock();
            await request(server())
                .put(`/api/gastos-gasoil/${gasto.id}`)
                .send(gastoReq(veh.id, 35))
                .expect(200);
            const s = await stock();
            expect(s.comprado).toBe(antes.comprado - 5);
            expect(s.disponible).toBe(antes.disponible - 5);
        });
    });
    describe('T6: borrar registro refleja el stock', () => {
        it('DELETE de viaje devuelve litros al disponible', async () => {
            const veh = await crearVehiculo('STOCK08');
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 40)).expect(200);
            const viaje = (await request(server()).post('/api/viajes').send(viajeReq(veh.id, 35)).expect(200)).body;
            const antes = await stock();
            await request(server()).delete(`/api/viajes/${viaje.id}`).expect(200);
            const s = await stock();
            expect(s.usado).toBe(antes.usado - 35);
            expect(s.disponible).toBe(antes.disponible + 35);
        });
        it('DELETE de compra baja el disponible', async () => {
            const gastos = (await request(server()).get('/api/gastos-gasoil').expect(200)).body;
            const ultimo = gastos[0];
            const antes = await stock();
            await request(server()).delete(`/api/gastos-gasoil/${ultimo.id}`).expect(200);
            const s = await stock();
            expect(s.comprado).toBe(antes.comprado - ultimo.litros);
            expect(s.disponible).toBe(antes.disponible - ultimo.litros);
        });
    });
    describe('T7: el PDF de viajes refleja el resumen de gasoil', () => {
        it('incluye «Resumen de gasoil», columnas de comprado y usado con totales', async () => {
            const r = await request(server()).get('/api/export/pdf').expect(200);
            const { text } = await pdfParse(r.body);
            const plano = text.replace(/\s+/g, '').toUpperCase();
            expect(plano).toContain('RESUMENDEGASOIL');
            expect(plano).toContain('GASOILCOMPRADO(L)');
            expect(plano).toContain('COMPRADO$');
            expect(plano).toContain('COMPRADOBS');
            expect(plano).toContain('GASOILUSADO(L)');
            expect(plano).toContain('USADOBS(COMBUSTIBLE)');
            expect(plano).toContain('TOTAL');
        }, 60000);
    });
});
//# sourceMappingURL=stock-gasoil.spec.js.map