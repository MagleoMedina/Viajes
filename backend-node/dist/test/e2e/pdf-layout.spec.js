"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chromium_1 = require("../../src/common/chromium");
const PULGADA_PX = 96;
const ANCHO_PAGINA_PX = Math.round(((279.4 - 16) / 25.4) * PULGADA_PX);
const ALTO_PAGINA_PX = Math.round(((215.9 - 16) / 25.4) * PULGADA_PX);
const viajeFalso = () => ({
    id: 1,
    fechaInicio: new Date(Date.UTC(2026, 0, 1)),
    fechaFin: new Date(Date.UTC(2026, 0, 2)),
    chofer: { nombre: 'Juan', apellido: 'Perez' },
    empresa: { nombre: 'CABELUM' },
    carga: 'Hortalizas',
    puntoSalida: { nombre: 'Matanzas' },
    puntoLlegada: { nombre: 'Puerto Ordaz' },
    montoViaje: 1234.56,
    combustible: 300,
    viaticos: 150,
    peajes: 40,
    pagoChofer: 500,
    litros: 42.5,
    gastos: [{ monto: 25 }],
    tasa: 36.5,
    totalBs: 100000,
    totalUsd: 2739.72,
});
describe('Layout PDF: listado visible con referencia del reporte con montos', () => {
    let browser;
    beforeAll(async () => {
        browser = await (0, chromium_1.lanzarChrome)();
    }, 60000);
    afterAll(async () => {
        if (browser)
            await browser.close();
    });
    it('celdas del listado no desbordan y usan fuente comparable al reporte', async () => {
        const { htmlViajes } = require('../../src/service/export.service');
        const { htmlReporte } = require('../../src/service/reporte-empresa.service');
        const htmlListado = htmlViajes([viajeFalso()], {
            empresaNombre: 'CABELUM',
            color: '#26324a',
        });
        const htmlReferencia = htmlReporte({
            nombreEmpresa: 'CABELUM',
            direccionEmpresa: 'Zona Industrial',
            rangoFechas: 'HISTORICO GENERAL',
            columnas: [
                'FECHA',
                'VEHICULO',
                'CHOFER',
                'RECORRIDO',
                'SALIDA',
                'LLEGADA',
                'CARGA',
                'MONTO ($)',
            ],
            filas: [
                [
                    '01/01/2026',
                    'Toyota',
                    'Juan Perez',
                    'Ruta 1',
                    'Matanzas',
                    'Puerto Ordaz',
                    'Hortalizas',
                    '1.234,56',
                ],
            ],
            conMonto: true,
            anchos: [10, 17, 15, 17, 11, 11, 12, 7],
            color: '#8c3b87',
        });
        const page = await browser.newPage();
        await page.setViewport({ width: ANCHO_PAGINA_PX, height: ALTO_PAGINA_PX });
        const medir = async (html) => {
            await page.setContent(html, { waitUntil: 'load' });
            return page.evaluate(() => {
                const th = document.querySelector('th');
                const tds = Array.from(document.querySelectorAll('tbody td'));
                const tabla = document.querySelector('table');
                const primeraFila = document.querySelector('tbody tr');
                const celdas = primeraFila ? primeraFila.querySelectorAll('td').length : 0;
                const desbordan = tds.filter((td) => td.scrollWidth > td.clientWidth + 1).length;
                return {
                    fuenteTh: th ? parseFloat(getComputedStyle(th).fontSize) : 0,
                    fuenteTd: tds[0] ? parseFloat(getComputedStyle(tds[0]).fontSize) : 0,
                    anchoTabla: tabla ? tabla.getBoundingClientRect().width : 0,
                    anchoPagina: document.documentElement.clientWidth,
                    celdas,
                    desbordan,
                };
            });
        };
        const listado = await medir(htmlListado);
        const referencia = await medir(htmlReferencia);
        await page.close();
        expect(listado.celdas).toBe(17);
        expect(listado.fuenteTh).toBeLessThanOrEqual(referencia.fuenteTh + 0.01);
        expect(listado.fuenteTd).toBeLessThanOrEqual(referencia.fuenteTd + 0.01);
        expect(listado.anchoTabla).toBeLessThanOrEqual(listado.anchoPagina + 1);
        expect(listado.anchoTabla).toBeGreaterThan(listado.anchoPagina * 0.6);
        expect(listado.desbordan).toBe(0);
    }, 60000);
});
//# sourceMappingURL=pdf-layout.spec.js.map