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
    'VIATICOS', 'PEAJES', 'PAGO CHOFER', 'GASTOS VARIOS',
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
describe('paridad con backend Java', () => {
    let app;
    let java;
    let nodeDb;
    let javaDb;
    beforeAll(async () => {
        nodeDb = (0, harness_1.tmpDb)('node');
        javaDb = (0, harness_1.tmpDb)('java');
        await (0, harness_1.wipeTasas)(nodeDb);
        java = await (0, harness_1.startJava)(javaDb);
        await (0, harness_1.javaSinTasas)(javaDb);
        app = await (0, harness_1.crearNest)(nodeDb);
    }, 240000);
    afterAll(async () => {
        await app?.close();
        await (0, harness_1.matarJava)(java);
        if (nodeDb)
            (0, harness_1.limpiarTmp)(nodeDb);
        if (javaDb)
            (0, harness_1.limpiarTmp)(javaDb);
    });
    for (const [grupo, pasos] of GRUPOS) {
        describe(grupo, () => {
            for (const paso of pasos) {
                it(paso.name ?? paso.path, async () => {
                    const [deNest, deJava] = await Promise.all([
                        (0, harness_1.pasoNest)(app, paso),
                        (0, harness_1.pasoJava)(paso),
                    ]);
                    const a = (0, harness_1.normalizar)(deNest, paso);
                    const b = (0, harness_1.normalizar)(deJava, paso);
                    if (paso.ignoreBody) {
                        expect(a.status).toBe(b.status);
                    }
                    else {
                        expect(a).toEqual(b);
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
                const esPdf = caso.path.includes('/pdf');
                const [deNest, deJava] = await Promise.all([
                    traerBinario(app, caso.path),
                    fetch('http://127.0.0.1:8099' + caso.path).then(async (r) => Buffer.from(await r.arrayBuffer())),
                ]);
                if (esPdf) {
                    await compararPdf(deNest, deJava);
                }
                else {
                    await compararXlsx(deNest, deJava);
                }
            });
        }
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
async function compararXlsx(a, b) {
    const [ma, mb] = await Promise.all([matrizXlsx(a), matrizXlsx(b)]);
    expect(JSON.stringify(ma)).toBe(JSON.stringify(mb));
}
async function matrizXlsx(buf) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    const matriz = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
        const fila = [];
        for (let c = 1; c <= 16; c++) {
            const v = row.getCell(c).value;
            fila.push(v && typeof v === 'object' ? v?.text ?? v?.result ?? null : v);
        }
        matriz.push(fila);
    });
    return matriz;
}
async function compararPdf(a, b) {
    const pdfParse = require('pdf-parse');
    const [rawA, rawB] = await Promise.all([
        pdfParse(a).then((r) => r.text),
        pdfParse(b).then((r) => r.text),
    ]);
    const textoA = rawA.replace(/\s+/g, ' ');
    const textoB = rawB.replace(/\s+/g, ' ');
    for (const header of HEADERS_PDF) {
        expect(textoA).toContain(header);
        expect(textoB).toContain(header);
    }
    expect(tokensPdf(textoA)).toEqual(tokensPdf(textoB));
}
function tokensPdf(texto) {
    const compacto = texto.replace(/\s+/g, ' ');
    const sinPie = compacto.replace(/Generado el\s*\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}(?:\s*-\s*\d+\s*viajes?\s*)?/g, '');
    return (sinPie.match(/\d+(?:[.,]\d+)*/g) ?? []).sort();
}
//# sourceMappingURL=paridad.spec.js.map