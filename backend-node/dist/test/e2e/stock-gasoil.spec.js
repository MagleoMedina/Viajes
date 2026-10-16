"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const harness_1 = require("../harness");
const request = require('supertest');
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
    tasa: 10,
    ...extra,
});
describe('Stock de gasoil por vehículo', () => {
    let app;
    let db;
    const server = () => app.getHttpServer();
    const crearVehiculo = async (placa) => (await request(server()).post('/api/vehiculos').send(vehiculoReq(placa)).expect(200)).body;
    const stock = async (vehiculoId, excluirViajeId) => {
        const q = excluirViajeId
            ? `vehiculoId=${vehiculoId}&excluirViajeId=${excluirViajeId}`
            : `vehiculoId=${vehiculoId}`;
        return (await request(server()).get(`/api/gastos-gasoil/stock?${q}`).expect(200)).body;
    };
    beforeAll(async () => {
        db = (0, harness_1.tmpDb)('stock-gasoil');
        app = await (0, harness_1.crearNest)(db);
    });
    afterAll(async () => {
        await app?.close();
        (0, harness_1.limpiarTmp)(db);
    });
    describe('T1: stock inicial', () => {
        it('vehículo sin compras ni viajes tiene disponible 0', async () => {
            const veh = await crearVehiculo('STOCK01');
            const s = await stock(veh.id);
            expect(s.vehiculoId).toBe(veh.id);
            expect(s.comprado).toBe(0);
            expect(s.usado).toBe(0);
            expect(s.disponible).toBe(0);
        });
        it('sin vehiculoId devuelve el stock de todos los vehículos con placa', async () => {
            const lista = (await request(server()).get('/api/gastos-gasoil/stock').expect(200)).body;
            expect(Array.isArray(lista)).toBe(true);
            const propio = lista.find((s) => s.placa === 'STOCK01');
            expect(propio).toBeDefined();
            expect(propio.disponible).toBe(0);
        });
    });
    describe('T2: compra suma y viaje resta', () => {
        it('registrar compra sube el disponible', async () => {
            const veh = await crearVehiculo('STOCK02');
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 40)).expect(200);
            const s = await stock(veh.id);
            expect(s.comprado).toBe(40);
            expect(s.usado).toBe(0);
            expect(s.disponible).toBe(40);
        });
        it('viaje con litros dentro del stock guarda y baja el disponible', async () => {
            const veh = await crearVehiculo('STOCK03');
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 40)).expect(200);
            await request(server()).post('/api/viajes').send(viajeReq(veh.id, 30)).expect(200);
            const s = await stock(veh.id);
            expect(s.comprado).toBe(40);
            expect(s.usado).toBe(30);
            expect(s.disponible).toBe(10);
        });
        it('viaje con litros mayores al disponible responde 400 y no guarda', async () => {
            const veh = await crearVehiculo('STOCK04');
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 40)).expect(200);
            const res = await request(server())
                .post('/api/viajes')
                .send(viajeReq(veh.id, 41))
                .expect(400);
            expect(res.body.message).toContain('gasoil disponible');
            const s = await stock(veh.id);
            expect(s.usado).toBe(0);
        });
        it('viaje con litros exactamente iguales al disponible pasa', async () => {
            const veh = await crearVehiculo('STOCK05');
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 25.5)).expect(200);
            await request(server()).post('/api/viajes').send(viajeReq(veh.id, 25.5)).expect(200);
            const s = await stock(veh.id);
            expect(s.disponible).toBe(0);
        });
        it('viaje sin vehículo o sin litros no valida stock', async () => {
            const veh = await crearVehiculo('STOCK06');
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 10)).expect(200);
            await request(server())
                .post('/api/viajes')
                .send({ ...viajeReq(veh.id, 0), vehiculoId: null })
                .expect(200);
            await request(server()).post('/api/viajes').send(viajeReq(veh.id, 0)).expect(200);
            const s = await stock(veh.id);
            expect(s.usado).toBe(0);
            expect(s.disponible).toBe(10);
        });
    });
    describe('T3: edición de viaje excluye sus propios litros', () => {
        it('PUT que sube litros hasta el máximo permitido pasa; por encima falla', async () => {
            const veh = await crearVehiculo('STOCK07');
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 50)).expect(200);
            const viaje = (await request(server()).post('/api/viajes').send(viajeReq(veh.id, 20)).expect(200)).body;
            const s = await stock(veh.id, viaje.id);
            expect(s.usado).toBe(0);
            expect(s.disponible).toBe(50);
            await request(server())
                .put(`/api/viajes/${viaje.id}`)
                .send(viajeReq(veh.id, 50))
                .expect(200);
            const tras = await stock(veh.id);
            expect(tras.usado).toBe(50);
            expect(tras.disponible).toBe(0);
            const res = await request(server())
                .put(`/api/viajes/${viaje.id}`)
                .send(viajeReq(veh.id, 51))
                .expect(400);
            expect(res.body.message).toContain('gasoil disponible');
        });
    });
    describe('T4: edición de compra no deja stock negativo', () => {
        it('PUT que reduciría litros por debajo del consumo responde 400', async () => {
            const veh = await crearVehiculo('STOCK08');
            const gasto = (await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 40)).expect(200)).body;
            await request(server()).post('/api/viajes').send(viajeReq(veh.id, 30)).expect(200);
            const res = await request(server())
                .put(`/api/gastos-gasoil/${gasto.id}`)
                .send(gastoReq(veh.id, 25))
                .expect(400);
            expect(res.body.fields.litros).toContain('negativo');
            const s = await stock(veh.id);
            expect(s.comprado).toBe(40);
        });
        it('PUT que mantiene el stock en positivo pasa', async () => {
            const veh = await crearVehiculo('STOCK09');
            const gasto = (await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 40)).expect(200)).body;
            await request(server()).post('/api/viajes').send(viajeReq(veh.id, 30)).expect(200);
            await request(server())
                .put(`/api/gastos-gasoil/${gasto.id}`)
                .send(gastoReq(veh.id, 35))
                .expect(200);
            const s = await stock(veh.id);
            expect(s.comprado).toBe(35);
            expect(s.disponible).toBe(5);
        });
    });
    describe('T5: borrar registro refleja el stock', () => {
        it('DELETE de viaje devuelve litros al disponible', async () => {
            const veh = await crearVehiculo('STOCK10');
            await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 40)).expect(200);
            const viaje = (await request(server()).post('/api/viajes').send(viajeReq(veh.id, 35)).expect(200)).body;
            expect((await stock(veh.id)).disponible).toBe(5);
            await request(server()).delete(`/api/viajes/${viaje.id}`).expect(200);
            const s = await stock(veh.id);
            expect(s.usado).toBe(0);
            expect(s.disponible).toBe(40);
        });
        it('DELETE de compra baja el disponible', async () => {
            const veh = await crearVehiculo('STOCK11');
            const gasto = (await request(server()).post('/api/gastos-gasoil').send(gastoReq(veh.id, 40)).expect(200)).body;
            await request(server()).delete(`/api/gastos-gasoil/${gasto.id}`).expect(200);
            const s = await stock(veh.id);
            expect(s.comprado).toBe(0);
            expect(s.disponible).toBe(0);
        });
    });
});
//# sourceMappingURL=stock-gasoil.spec.js.map