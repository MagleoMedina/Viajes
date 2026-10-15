"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ExcelJS = __importStar(require("exceljs"));
const harness_1 = require("../harness");
const escenarios = __importStar(require("../scenarios"));
const HEADERS_PDF = [
    'FECHA INICIO', 'FECHA FIN', 'EMPRESA', 'CHOFER', 'CARGA',
    'PUNTO SALIDA', 'PUNTO LLEGADA', 'MONTO VIAJE $', 'COMBUSTIBLE',
    'VIATICOS', 'PEAJES', 'PAGO CHOFER', 'LITROS', 'GASTOS VARIOS',
    'TOTAL BS', 'TASA', 'TOTAL $',
];
const GRUPOS = [
    ['choferes', escenarios.choferes],
    ['empresas', escenarios.empresas],
    ['puntos', escenarios.puntos],
    ['vehiculos', escenarios.vehiculos],
    ['recorridos', escenarios.recorridos],
    ['viajes', escenarios.viajes],
    ['tasa', escenarios.tasa],
];
describe('backend Node', () => {
    let app;
    let nodeDb;
    beforeAll(async () => {
        nodeDb = (0, harness_1.tmpDb)('node');
        await (0, harness_1.wipeTasas)(nodeDb);
        app = await (0, harness_1.crearNest)(nodeDb);
    }, 120000);
    afterAll(async () => {
        await app?.close();
        if (nodeDb)
            (0, harness_1.limpiarTmp)(nodeDb);
    });
    for (const [grupo, pasos] of GRUPOS) {
        describe(grupo, () => {
            for (const paso of pasos) {
                it(paso.name ?? paso.path, async () => {
                    const res = (0, harness_1.normalizar)(await (0, harness_1.pasoNest)(app, paso), paso);
                    if (paso.ignoreBody) {
                        expect({ status: res.status }).toMatchSnapshot();
                    }
                    else {
                        expect(res).toMatchSnapshot();
                    }
                });
            }
        });
    }
    describe('export', () => {
        const casos = [
            { name: 'xlsx-todo', path: '/api/export/xlsx' },
            { name: 'xlsx-filtrado', path: '/api/export/xlsx?empresaId=2' },
            { name: 'pdf-todo', path: '/api/export/pdf' },
            { name: 'pdf-filtrado', path: '/api/export/pdf?empresaId=2' },
        ];
        for (const caso of casos) {
            it(caso.name, async () => {
                const buf = await traerBinario(app, caso.path);
                if (caso.path.includes('/pdf')) {
                    await verificarPdf(buf);
                }
                else {
                    expect(await matrizXlsx(buf)).toMatchSnapshot();
                }
            });
        }
        it('reporte-empresa', async () => {
            const buf = await traerBinario(app, '/api/export/reporte?empresaId=2&desde=2026-10-01&hasta=2026-10-31');
            expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
            const pdfParse = require('pdf-parse');
            const texto = (await pdfParse(buf)).text.replace(/\s+/g, ' ');
            expect(texto).toContain('REPORTE VIAJES DESDE EL');
            for (const header of ['FECHA', 'VEHICULO', 'CHOFER', 'RECORRIDO', 'DESDE', 'HASTA', 'CARGA']) {
                expect(texto).toContain(header);
            }
            expect(texto).toContain('MONTO ($)');
            expect(texto).toContain('Neveras');
            expect(texto).toContain('TOTAL');
        });
        it('reporte-empresa-sin-monto', async () => {
            const buf = await traerBinario(app, '/api/export/reporte?empresaId=2&desde=2026-10-01&hasta=2026-10-31&conMonto=false');
            expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
            const pdfParse = require('pdf-parse');
            const texto = (await pdfParse(buf)).text.replace(/\s+/g, ' ');
            expect(texto).toContain('REPORTE VIAJES DESDE EL');
            for (const header of ['FECHA', 'VEHICULO', 'CHOFER', 'RECORRIDO', 'DESDE', 'HASTA', 'CARGA']) {
                expect(texto).toContain(header);
            }
            expect(texto).not.toContain('MONTO ($)');
            expect(texto).not.toContain('TOTAL');
        });
    });
});
async function traerBinario(app, path) {
    const request = require('supertest');
    const res = await request(app.getHttpServer())
        .get(path)
        .buffer(true)
        .parse((resp, cb) => {
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    if (res.status >= 400) {
        throw new Error(`export ${path} fallo: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body;
}
async function verificarPdf(buf) {
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const pdfParse = require('pdf-parse');
    const texto = (await pdfParse(buf)).text.replace(/\s+/g, ' ');
    const compacto = texto.replace(/\s+/g, '');
    for (const header of HEADERS_PDF) {
        expect(compacto.toUpperCase()).toContain(header.replace(/\s+/g, '').toUpperCase());
    }
    expect(tokensPdf(texto)).toMatchSnapshot();
}
async function matrizXlsx(buf) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    const matriz = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
        const fila = [];
        for (let c = 1; c <= 17; c++) {
            const v = row.getCell(c).value;
            fila.push(v && typeof v === 'object' ? v?.text ?? v?.result ?? null : v);
        }
        matriz.push(fila);
    });
    return matriz;
}
function tokensPdf(texto) {
    const compacto = texto.replace(/\s+/g, ' ');
    const sinPie = compacto.replace(/Generado el\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}(?:\s*-\s*\d+\s*viajes?\s*)?/g, '');
    return (sinPie.match(/\d+(?:[.,]\d+)*/g) ?? []).sort();
}
//# sourceMappingURL=paridad.spec.js.map