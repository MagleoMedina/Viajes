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
    return r.text.replace(/\s+/g, ' ');
};
const RANGO = 'desde=2026-10-01&hasta=2026-10-31';
const viaje = (extra) => ({
    fechaInicio: '2026-10-05',
    fechaFin: '2026-10-05',
    choferId: 1,
    empresaId: 1,
    carga: 'CARGA-PRIV',
    montoViaje: 80,
    combustible: 6,
    peajes: 1,
    pagoChofer: 2,
    viaticos: 3,
    litros: 0,
    tasa: 100,
    ...extra,
});
describe('Reportes de vehículos privados', () => {
    let app;
    let db;
    const server = () => app.getHttpServer();
    let idPriv1 = 0;
    let idPriv2 = 0;
    let idTitulo = 0;
    beforeAll(async () => {
        db = (0, harness_1.tmpDb)('vehiculos-privados');
        app = await (0, harness_1.crearNest)(db);
        const crear = async (marca, placa, privado) => {
            const r = await request(server())
                .post('/api/vehiculos')
                .send({ marca, modelo: 'Modelo', tipo: 'Camion', placa, privado })
                .expect(200);
            return r.body.id;
        };
        idPriv1 = await crear('PRIVADO CAMION', 'PRV001', true);
        idPriv2 = await crear('privado sedan', 'PRV002', true);
        const noPrivado = await crear('Toyota', 'NO1', false);
        await crear('PRIVADO FALSO', 'PRV999', false);
        await request(server()).post('/api/viajes').send(viaje({ vehiculoId: idPriv1 })).expect(200);
        await request(server()).post('/api/viajes').send(viaje({ vehiculoId: idPriv2 })).expect(200);
        await request(server()).post('/api/viajes').send(viaje({ vehiculoId: noPrivado })).expect(200);
        const titulo = await request(server())
            .post('/api/titulos-viaje')
            .send({ nombre: 'Titulo privado' })
            .expect(200);
        idTitulo = titulo.body.id;
        await request(server())
            .post('/api/viajes')
            .send(viaje({ vehiculoId: idPriv1, tituloViajeId: idTitulo, carga: 'PERS-PRIV' }))
            .expect(200);
        await request(server())
            .post('/api/gastos-gasoil')
            .send({
            vehiculoId: idPriv1,
            fecha: '2026-10-10',
            litros: 20,
            precioLitro: 1,
            montoUsd: 20,
            montoBs: 2000,
            tasa: 100,
        })
            .expect(200);
        await request(server())
            .post('/api/gastos-gasoil')
            .send({
            vehiculoId: idPriv1,
            fecha: '2026-12-10',
            litros: 99,
            precioLitro: 1,
            montoUsd: 99,
            montoBs: 9900,
            tasa: 100,
        })
            .expect(200);
    });
    afterAll(async () => {
        await app?.close();
        (0, harness_1.limpiarTmp)(db);
    });
    describe('T1: solo vehículos marcados como privados', () => {
        it('incluye privados y excluye los demás (aunque la marca diga PRIVADO)', async () => {
            const r = await descargar(app, `/api/export/privados/reporte?${RANGO}&conMonto=true`);
            expect(r.status).toBe(200);
            expect(r.headers['content-disposition']).toContain('reporte_privados');
            const texto = await textoPdf(r.buffer);
            expect(texto).toContain('PRIVADOS');
            expect(texto).toContain('PRV001');
            expect(texto).toContain('PRV002');
            expect(texto).not.toContain('NO1');
            expect(texto).not.toContain('PRV999');
            expect(texto).not.toContain('PERS-PRIV');
        });
        it('busca los vehículos en cada pedido: un vehículo nuevo aparece', async () => {
            const nuevo = await request(server())
                .post('/api/vehiculos')
                .send({ marca: 'Nuevo privado', modelo: 'X', tipo: 'Camion', placa: 'PRV003', privado: true })
                .expect(200);
            await request(server())
                .post('/api/viajes')
                .send(viaje({ vehiculoId: nuevo.body.id }))
                .expect(200);
            const r = await descargar(app, `/api/export/privados/reporte?${RANGO}&conMonto=true`);
            expect(await textoPdf(r.buffer)).toContain('PRV003');
        });
    });
    describe('T2: cuadros de gasoil y por tipo', () => {
        it('el gasoil solo lista vehículos privados y usa el intervalo', async () => {
            const r = await descargar(app, `/api/export/privados/reporte?${RANGO}&conMonto=true`);
            const texto = await textoPdf(r.buffer);
            expect(texto).toMatch(/resumen de gasoil/i);
            expect(texto).toContain('PRIVADO CAMION Modelo (PRV001)');
            expect(texto).toMatch(/Bs [\d.]+,\d{2}/);
            expect(texto).not.toContain('$ 2.000,00');
            expect(texto).not.toContain('99,00');
            expect(texto).toMatch(/resumen por tipo de vehículo/i);
        });
    });
    describe('T3: formatos con/sin montos y sin chofer', () => {
        it('con montos incluye MONTO ($) y CHOFER', async () => {
            const r = await descargar(app, `/api/export/privados/reporte?${RANGO}&conMonto=true`);
            const texto = await textoPdf(r.buffer);
            expect(texto).toContain('MONTO ($)');
            expect(texto).toContain('CHOFER');
        });
        it('sin montos omite MONTO ($)', async () => {
            const r = await descargar(app, `/api/export/privados/reporte?${RANGO}&conMonto=false`);
            const texto = await textoPdf(r.buffer);
            expect(texto).not.toContain('MONTO ($)');
            expect(texto).toContain('CHOFER');
        });
        it('sin monto y sin chofer omite ambas columnas', async () => {
            const r = await descargar(app, `/api/export/privados/reporte?${RANGO}&conMonto=false&sinChofer=true`);
            const texto = await textoPdf(r.buffer);
            expect(texto).not.toContain('MONTO ($)');
            expect(texto).not.toContain('CHOFER');
        });
    });
});
//# sourceMappingURL=vehiculos-privados.spec.js.map