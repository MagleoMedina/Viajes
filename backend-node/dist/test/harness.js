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
exports.tmpDb = tmpDb;
exports.limpiarTmp = limpiarTmp;
exports.wipeTasas = wipeTasas;
exports.crearNest = crearNest;
exports.pasoNest = pasoNest;
exports.normalizar = normalizar;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const testing_1 = require("@nestjs/testing");
const app_module_1 = require("../src/app.module");
const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'test', 'seed.db');
function tmpDb(nombre) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'viajes-test-'));
    const p = path.join(dir, `${nombre}.db`);
    fs.copyFileSync(SEED, p);
    return p;
}
function limpiarTmp(dbPath) {
    try {
        fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
    }
    catch {
    }
}
async function wipeTasas(dbPath) {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)));
    db.run('DELETE FROM tasas');
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
    db.close();
}
async function crearNest(dbPath) {
    process.env.DB_PATH = dbPath;
    process.env.TASA_AUTO = 'false';
    const moduleRef = await testing_1.Test.createTestingModule({ imports: [app_module_1.AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return app;
}
async function pasoNest(app, p) {
    const request = require('supertest');
    const server = app.getHttpServer();
    let req;
    if (p.method === 'GET')
        req = request(server).get(p.path);
    else if (p.method === 'POST')
        req = request(server).post(p.path).send(p.body ?? {});
    else if (p.method === 'PUT')
        req = request(server).put(p.path).send(p.body ?? {});
    else
        req = request(server).delete(p.path);
    const res = await req;
    return { status: res.status, body: res.body };
}
function normalizar(resp, p) {
    if (resp.body && typeof resp.body === 'object') {
        let body = resp.body;
        if (p.path.startsWith('/api/tasa')) {
            const { fecha, id, ...resto } = body;
            body = resto;
        }
        if (body && typeof body === 'object' &&
            body.fields &&
            Object.keys(body.fields).length > 1) {
            body = { ...body, message: undefined };
        }
        return { ...resp, body };
    }
    return resp;
}
//# sourceMappingURL=harness.js.map