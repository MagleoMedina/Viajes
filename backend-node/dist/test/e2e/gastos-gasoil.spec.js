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
const vehiculoReq = (placa) => ({
    marca: 'Toyota',
    modelo: 'Corolla',
    tipo: 'Auto',
    placa,
});
describe('Gastos de gasoil (gastos_gasoil)', () => {
    let app;
    let db;
    let vehA;
    let vehB;
    const server = () => app.getHttpServer();
    const gastoBase = (extra) => ({
        vehiculoId: vehA.id,
        fecha: '2026-03-05',
        estacion: 'PDV-1',
        litros: 40,
        precioLitro: 2.5,
        tasa: 10,
        referencia: 'REF-1',
        ...extra,
    });
    beforeAll(async () => {
        db = (0, harness_1.tmpDb)('gastos-gasoil');
        app = await (0, harness_1.crearNest)(db);
        vehA = (await request(server()).post('/api/vehiculos').send(vehiculoReq('PLACAGA1')).expect(200))
            .body;
        vehB = (await request(server()).post('/api/vehiculos').send(vehiculoReq('PLACAGA2')).expect(200))
            .body;
    });
    afterAll(async () => {
        await app?.close();
        (0, harness_1.limpiarTmp)(db);
    });
    describe('T1: altas de gastos de gasoil', () => {
        it('POST calcula Monto $ = litros × precio y Monto Bs = $ × tasa', async () => {
            const res = await request(server())
                .post('/api/gastos-gasoil')
                .send(gastoBase({}))
                .expect(200);
            expect(res.body.montoUsd).toBe(100);
            expect(res.body.montoBs).toBe(1000);
            expect(res.body.vehiculo.placa).toBe('PLACAGA1');
        });
        it('POST respeta Monto $ y Monto Bs digitados a mano', async () => {
            const res = await request(server())
                .post('/api/gastos-gasoil')
                .send(gastoBase({ montoUsd: 50, montoBs: 777 }))
                .expect(200);
            expect(res.body.montoUsd).toBe(50);
            expect(res.body.montoBs).toBe(777);
        });
        it('POST con vehículo inexistente responde 404', async () => {
            await request(server())
                .post('/api/gastos-gasoil')
                .send(gastoBase({ vehiculoId: 99999 }))
                .expect(404);
        });
        it('POST sin vehículo registra el gasto (vehículo opcional)', async () => {
            const res = await request(server())
                .post('/api/gastos-gasoil')
                .send({
                fecha: '2026-03-06',
                estacion: 'PDV-SIN',
                litros: 10,
                precioLitro: 2,
                tasa: 10,
            })
                .expect(200);
            expect(res.body.vehiculo).toBeUndefined();
            expect(res.body.montoUsd).toBe(20);
            expect(res.body.montoBs).toBe(200);
        });
    });
    describe('T2: filtros y borrado', () => {
        it('GET filtra por intervalo de fechas y por vehículo', async () => {
            await request(server())
                .post('/api/gastos-gasoil')
                .send(gastoBase({
                vehiculoId: vehB.id,
                fecha: '2026-03-10',
                estacion: 'PDV-2',
                litros: 10,
                precioLitro: 1,
            }))
                .expect(200);
            await request(server())
                .post('/api/gastos-gasoil')
                .send(gastoBase({
                fecha: '2026-04-20',
                estacion: 'PDV-FUERA',
                litros: 5,
                precioLitro: 3,
            }))
                .expect(200);
            const todo = await request(server()).get('/api/gastos-gasoil').expect(200);
            expect(todo.body.length).toBeGreaterThanOrEqual(4);
            const rango = await request(server())
                .get('/api/gastos-gasoil?desde=2026-03-01&hasta=2026-03-31')
                .expect(200);
            expect(rango.body.length).toBeGreaterThanOrEqual(3);
            expect(rango.body.every((g) => g.fecha.startsWith('2026-03'))).toBe(true);
            expect(rango.body.some((g) => g.estacion === 'PDV-FUERA')).toBe(false);
            const porVehiculo = await request(server())
                .get(`/api/gastos-gasoil?vehiculoId=${vehB.id}`)
                .expect(200);
            expect(porVehiculo.body.length).toBeGreaterThan(0);
            expect(porVehiculo.body.every((g) => g.vehiculo.id === vehB.id)).toBe(true);
        });
        it('PUT actualiza y DELETE borra', async () => {
            const lista = await request(server()).get('/api/gastos-gasoil').expect(200);
            const id = lista.body[0].id;
            await request(server())
                .put(`/api/gastos-gasoil/${id}`)
                .send(gastoBase({ estacion: 'PDV-EDITADA' }))
                .expect(200);
            const tras = await request(server()).get('/api/gastos-gasoil').expect(200);
            const editado = tras.body.find((g) => g.id === id);
            expect(editado.estacion).toBe('PDV-EDITADA');
            expect(editado.montoUsd).toBe(100);
            expect(editado.montoBs).toBe(1000);
            const sinVehiculo = await request(server())
                .put(`/api/gastos-gasoil/${id}`)
                .send(gastoBase({ vehiculoId: null }))
                .expect(200);
            expect(sinVehiculo.body.vehiculo).toBeUndefined();
            await request(server()).delete(`/api/gastos-gasoil/${id}`).expect(200);
            await request(server()).delete(`/api/gastos-gasoil/${id}`).expect(404);
            const final = await request(server()).get('/api/gastos-gasoil').expect(200);
            expect(final.body.some((g) => g.id === id)).toBe(false);
        });
    });
    describe('T3: sumas por vehículo ($ y Bs)', () => {
        it('resumirPorVehiculo agrupa por placa y suma 10 + 20 = 30', () => {
            const { resumirPorVehiculo } = require('../../src/service/gastos-gasoil.service');
            const bloques = resumirPorVehiculo([
                { vehiculo: { placa: 'AAA' }, montoUsd: 10, montoBs: 100 },
                { vehiculo: { placa: 'AAA' }, montoUsd: 20, montoBs: 200 },
                { vehiculo: { placa: 'BBB' }, montoUsd: 1, montoBs: 10 },
                { montoUsd: 5, montoBs: 50 },
            ]);
            expect(bloques).toHaveLength(3);
            const aaa = bloques.find((b) => b.clave === 'AAA');
            expect(aaa.sumaUsd).toBe(30);
            expect(aaa.sumaBs).toBe(300);
            expect(bloques.find((b) => b.clave === 'SIN VEHÍCULO').sumaUsd).toBe(5);
        });
        it('el PDF del intervalo muestra los subtotales por vehículo', async () => {
            const r = await descargar(app, '/api/export/gastos-gasoil?desde=2026-03-01&hasta=2026-03-31');
            expect(r.status).toBe(200);
            const { text } = await pdfParse(r.buffer);
            const plano = text.replace(/\s+/g, '');
            expect(plano.toUpperCase()).toContain('PLACAGA1');
            expect(plano).toContain('1.777,00');
            expect(plano).toContain('2.077,00');
            expect(plano.toUpperCase()).toContain('SINVEHÍCULO');
            expect(plano.toUpperCase()).not.toContain('SUBTOTALPLACAGA1');
            expect(plano.toUpperCase()).toContain('SUBTOTAL');
        });
    });
    describe('T4: PDF y borrado de vehículo en uso', () => {
        it('devuelve application/pdf con vehículos, subtotales y total general', async () => {
            const r = await descargar(app, '/api/export/gastos-gasoil?desde=2026-03-01&hasta=2026-03-31');
            expect(r.status).toBe(200);
            expect(r.headers['content-type']).toContain('application/pdf');
            expect(r.buffer.subarray(0, 5).toString()).toBe('%PDF-');
            expect(r.headers['content-disposition'].toLowerCase()).toContain('gastos_gasoil');
            const { text } = await pdfParse(r.buffer);
            const plano = text.replace(/\s+/g, '').toUpperCase();
            expect(plano).toContain('GASTOSDEGASOIL');
            expect(plano).toContain('SUBTOTAL');
            expect(plano).toContain('TOTALGENERAL');
            expect(plano).toContain('PLACAGA1');
            expect(plano).toContain('PLACAGA2');
            expect(plano).toContain('SINVEHÍCULO');
        });
        it('no borra un vehículo con gastos: se oculta y el gasto conserva la placa', async () => {
            await request(server()).delete(`/api/vehiculos/${vehA.id}`).expect(200);
            const vehiculos = await request(server()).get('/api/vehiculos').expect(200);
            expect(vehiculos.body.some((v) => v.id === vehA.id)).toBe(false);
            const gastos = await request(server()).get('/api/gastos-gasoil').expect(200);
            expect(gastos.body.some((g) => g.vehiculo?.placa === 'PLACAGA1')).toBe(true);
        });
    });
});
//# sourceMappingURL=gastos-gasoil.spec.js.map