"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const harness_1 = require("../harness");
const ingresos_service_1 = require("../../src/service/ingresos.service");
const request = require('supertest');
const pdfParse = require('pdf-parse');
async function descargar(app, ruta) {
    const res = await request(app.getHttpServer())
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
describe('Ingresos (tabla ingresos)', () => {
    let app;
    let db;
    let empresaId;
    let primerId;
    let ultimaFactura = 1000;
    const server = () => app.getHttpServer();
    const base = (extra = {}) => ({
        empresaId,
        fecha: '2026-03-05',
        condicionesPago: 'Contado',
        descripcion: 'Abono de prueba',
        cantidad: 2,
        tasa: 36.54321,
        facturaNum: ++ultimaFactura,
        iva: 0,
        montoDivisa: 100,
        montoBs: 5000,
        ...extra,
    });
    beforeAll(async () => {
        db = (0, harness_1.tmpDb)('ingresos');
        app = await (0, harness_1.crearNest)(db);
        const empresa = await request(server())
            .post('/api/empresas')
            .send({ nombre: 'INGRESOS TEST SA' })
            .expect(200);
        empresaId = empresa.body.id;
    });
    afterAll(async () => {
        await app?.close();
        (0, harness_1.limpiarTmp)(db);
    });
    it('crea un ingreso y guarda el monto final en Bs por separado', async () => {
        const res = await request(server())
            .post('/api/ingresos')
            .send(base({ facturaNum: 77, iva: 12.5 }))
            .expect(200);
        expect(res.body.id).toBeGreaterThan(0);
        primerId = res.body.id;
        expect(res.body.fecha).toBe('2026-03-05');
        expect(res.body.empresa).toMatchObject({ id: empresaId, nombre: 'INGRESOS TEST SA' });
        expect(res.body.descripcion).toBe('Abono de prueba');
        expect(res.body.montoDivisa).toBe(100);
        expect(res.body.tasa).toBe(36.54321);
        expect(res.body.facturaNum).toBe(77);
        expect(res.body.iva).toBe(12.5);
        expect(res.body.montoBs).toBe(5000);
    });
    it('exige una factura entera, positiva y única', async () => {
        const sinFactura = await request(server())
            .post('/api/ingresos')
            .send(base({ facturaNum: undefined }));
        expect(sinFactura.status).toBe(400);
        expect(sinFactura.body.fields.facturaNum).toContain('obligatoria');
        const cero = await request(server()).post('/api/ingresos').send(base({ facturaNum: 0 }));
        expect(cero.status).toBe(400);
        expect(cero.body.fields.facturaNum).toBeDefined();
        const decimal = await request(server()).post('/api/ingresos').send(base({ facturaNum: 10.5 }));
        expect(decimal.status).toBe(400);
        expect(decimal.body.fields.facturaNum).toBeDefined();
        const repetida = await request(server()).post('/api/ingresos').send(base({ facturaNum: 77 }));
        expect(repetida.status).toBe(400);
        expect(repetida.body.fields.facturaNum).toContain('Ya existe');
        const propio = await request(server())
            .put(`/api/ingresos/${primerId}`)
            .send(base({ facturaNum: 77, descripcion: 'MISMA FACTURA' }))
            .expect(200);
        expect(propio.body.facturaNum).toBe(77);
    });
    it('exige empresa y fecha válidas, y rechaza montos negativos', async () => {
        const sinEmpresa = await request(server()).post('/api/ingresos').send(base({ empresaId: undefined }));
        expect(sinEmpresa.status).toBe(400);
        expect(sinEmpresa.body.fields.empresaId).toBe('La empresa es obligatoria');
        const fechaMala = await request(server()).post('/api/ingresos').send(base({ fecha: '05/03/2026' }));
        expect(fechaMala.status).toBe(400);
        expect(fechaMala.body.fields.fecha).toContain('AAAA-MM-DD');
        const negativa = await request(server())
            .post('/api/ingresos')
            .send(base({ cantidad: -1 }));
        expect(negativa.status).toBe(400);
        expect(negativa.body.fields.cantidad).toBeDefined();
    });
    it('404 con empresa inexistente y con id inexistente al editar/borrar', async () => {
        await request(server())
            .post('/api/ingresos')
            .send(base({ empresaId: 999999 }))
            .expect(404);
        await request(server()).put('/api/ingresos/999999').send(base()).expect(404);
        await request(server()).delete('/api/ingresos/999999').expect(404);
    });
    it('lista con filtros de rango y empresa', async () => {
        await request(server())
            .post('/api/ingresos')
            .send(base({ fecha: '2026-01-10', descripcion: 'ENERO' }))
            .expect(200);
        await request(server())
            .post('/api/ingresos')
            .send(base({ fecha: '2026-02-15', descripcion: 'FEBRERO' }))
            .expect(200);
        const rango = await request(server())
            .get('/api/ingresos?desde=2026-02-01&hasta=2026-02-28')
            .expect(200);
        expect(rango.body.map((i) => i.descripcion)).toEqual(['FEBRERO']);
        const otra = await request(server())
            .post('/api/empresas')
            .send({ nombre: 'OTRA EMPRESA SA' })
            .expect(200);
        const filtrada = await request(server())
            .get(`/api/ingresos?empresaId=${otra.body.id}`)
            .expect(200);
        expect(filtrada.body).toEqual([]);
        await request(server()).get('/api/ingresos?desde=2026-03-10&hasta=2026-03-01').expect(400);
    });
    it('edita y guarda el monto Bs independiente; luego elimina', async () => {
        const creado = await request(server()).post('/api/ingresos').send(base()).expect(200);
        const res = await request(server())
            .put(`/api/ingresos/${creado.body.id}`)
            .send(base({
            descripcion: 'CORREGIDO',
            tasa: 40,
            montoDivisa: 10,
            montoBs: 900,
        }))
            .expect(200);
        expect(res.body.descripcion).toBe('CORREGIDO');
        expect(res.body.montoBs).toBe(900);
        await request(server()).delete(`/api/ingresos/${creado.body.id}`).expect(200);
        await request(server()).delete(`/api/ingresos/${creado.body.id}`).expect(404);
    });
    it('exporta el PDF por empresa con subtotales y total', async () => {
        const pdf = await descargar(app, '/api/export/ingresos?desde=2026-01-01&hasta=2026-12-31');
        expect(pdf.status).toBe(200);
        expect(pdf.headers['content-type']).toContain('application/pdf');
        const texto = (await pdfParse(pdf.buffer)).text.replace(/\s+/g, ' ');
        expect(texto).toContain('INGRESOS');
        expect(texto).toContain('INGRESOS TEST SA');
        expect(texto).toContain('SUBTOTAL INGRESOS TEST SA');
        expect(texto).toContain('FACTURA');
        expect(texto).toContain('TOTAL GENERAL');
    });
    it('agrupa por empresa y suma montos (función pura)', () => {
        const bloques = (0, ingresos_service_1.resumirPorEmpresa)([
            { fecha: '2026-02-01', empresa: { nombre: 'B' }, montoUsd: 10, montoBs: 500 },
            { fecha: '2026-01-01', empresa: { nombre: 'A' }, montoUsd: 5.5, montoBs: 200 },
            { fecha: '2026-03-01', empresa: { nombre: 'B' }, montoUsd: 2.25, montoBs: 100 },
        ]);
        expect(bloques.map((b) => b.clave)).toEqual(['A', 'B']);
        expect(bloques[0].sumaUsd).toBe(5.5);
        expect(bloques[0].sumaBs).toBe(200);
        expect(bloques[1].sumaUsd).toBe(12.25);
        expect(bloques[1].sumaBs).toBe(600);
    });
});
//# sourceMappingURL=ingresos.spec.js.map