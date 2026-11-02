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
const textoPdf = async (buffer) => {
    const r = await pdfParse(buffer);
    return r.text;
};
const viajeBase = (extra) => ({
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
    let app;
    let db;
    const server = () => app.getHttpServer();
    let idObra = 0;
    let idEncargo = 0;
    beforeAll(async () => {
        db = (0, harness_1.tmpDb)('viajes-personalizados');
        app = await (0, harness_1.crearNest)(db);
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
        await request(server())
            .post('/api/viajes')
            .send(viajeBase({ tituloViajeId: idObra, vehiculoId: 1, montoViaje: 100 }))
            .expect(200);
        await request(server())
            .post('/api/viajes')
            .send(viajeBase({ tituloViajeId: idObra, vehiculoId: 2, montoViaje: 50 }))
            .expect(200);
        await request(server())
            .post('/api/viajes')
            .send(viajeBase({ tituloViajeId: idEncargo, montoViaje: 30 }))
            .expect(200);
        await request(server()).post('/api/viajes').send(viajeBase({ vehiculoId: 1 })).expect(200);
    });
    afterAll(async () => {
        await app?.close();
        (0, harness_1.limpiarTmp)(db);
    });
    describe('T1: el listado general excluye los personalizados', () => {
        it('GET /api/viajes sin tituloViajeId no trae los personalizados', async () => {
            const r = await request(server()).get('/api/viajes').expect(200);
            const cargas = r.body.map((v) => v.carga);
            expect(cargas).toContain('CARGA-PERS');
            expect(r.body.filter((v) => v.tituloViaje != null)).toHaveLength(0);
        });
        it('GET /api/viajes?tituloViajeId= trae solo los del título', async () => {
            const r = await request(server())
                .get(`/api/viajes?tituloViajeId=${idObra}`)
                .expect(200);
            expect(r.body).toHaveLength(2);
            expect(r.body.every((v) => v.tituloViaje?.id === idObra)).toBe(true);
        });
        it('el título inexistente responde 404', async () => {
            await request(server()).post('/api/viajes').send(viajeBase({ tituloViajeId: 99999 })).expect(404);
        });
    });
    describe('T2: PDF con el título como H1 y sin columna VIATICOS', () => {
        it('el PDF del título usa su nombre como encabezado y oculta VIATICOS', async () => {
            const r = await descargar(app, `/api/export/personalizados/pdf?tituloViajeId=${idObra}`);
            expect(r.status).toBe(200);
            expect(r.buffer.subarray(0, 5).toString()).toBe('%PDF-');
            expect(r.headers['content-disposition']).toContain('obra_maroa');
            const texto = await textoPdf(r.buffer);
            expect(texto).toMatch(/obra maroa/i);
            expect(texto).not.toContain('VIATICOS');
            expect(texto).toContain('Resumen por tipo de vehículo');
        });
        it('sin título responde 400 y con título inexistente 404', async () => {
            const sin = await descargar(app, '/api/export/personalizados/pdf');
            expect(sin.status).toBe(400);
            const malo = await descargar(app, '/api/export/personalizados/pdf?tituloViajeId=99999');
            expect(malo.status).toBe(404);
        });
    });
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
            const filas = resumirTipos(viajes);
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
            expect(texto).toContain('Gandola');
            expect(texto).toContain('Sin vehículo');
        });
        it('el reporte por empresa incluye la página del resumen', async () => {
            const r = await descargar(app, '/api/export/reporte?empresaId=1&conMonto=true');
            expect(r.status).toBe(200);
            const texto = await textoPdf(r.buffer);
            expect(texto).toMatch(/resumen por tipo de vehículo/i);
            expect(texto).toContain('TOTAL');
        });
    });
    describe('T4: gasoil del título y reportes personalizados', () => {
        it('el gasoil del PDF personalizado solo muestra los vehículos del título', async () => {
            const r = await descargar(app, `/api/export/personalizados/pdf?tituloViajeId=${idObra}`);
            const texto = await textoPdf(r.buffer);
            expect(texto).toContain('A73AA5M');
            expect(texto).toContain('A97CT2A');
            expect(texto).not.toContain('Sin vehículo');
        });
        it('el listado normal usa la cabecera del reporte (todas las empresas)', async () => {
            const r = await descargar(app, '/api/export/pdf');
            const texto = await textoPdf(r.buffer);
            expect(texto).toContain('REPORTE VIAJES DESDE EL');
            expect(texto).toContain('Sin pausa, sin excusas, sin limites');
            expect(texto).toContain('TODAS LAS EMPRESAS');
            expect(texto).not.toContain('Zona Industrial Matanzas');
        });
        it('el reporte personalizado responde 200 y usa el título', async () => {
            const r = await descargar(app, `/api/export/personalizados/reporte?tituloViajeId=${idObra}&conMonto=true`);
            expect(r.status).toBe(200);
            expect(r.headers['content-disposition']).toContain('obra_maroa');
            const texto = await textoPdf(r.buffer);
            expect(texto).toMatch(/obra maroa/i);
            expect(texto).toContain('MONTO ($)');
        });
        it('el reporte personalizado sin monto y sin chofer omite ambas columnas', async () => {
            const r = await descargar(app, `/api/export/personalizados/reporte?tituloViajeId=${idObra}&conMonto=false&sinChofer=true`);
            expect(r.status).toBe(200);
            const texto = await textoPdf(r.buffer);
            expect(texto).not.toContain('MONTO ($)');
            expect(texto).not.toContain('CHOFER');
        });
        it('el reporte personalizado exige título', async () => {
            expect((await descargar(app, '/api/export/personalizados/reporte')).status).toBe(400);
            expect((await descargar(app, '/api/export/personalizados/reporte?tituloViajeId=99999')).status).toBe(404);
        });
        it('el reporte personalizado incluye el gasoil del título', async () => {
            const r = await descargar(app, `/api/export/personalizados/reporte?tituloViajeId=${idObra}&conMonto=true`);
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
            expect(cabeceras.length).toBeGreaterThanOrEqual(3);
            expect(texto).not.toContain('PERIODO');
        });
    });
});
//# sourceMappingURL=viajes-personalizados.spec.js.map