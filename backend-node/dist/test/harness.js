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
exports.JAVA_BASE = void 0;
exports.tmpDb = tmpDb;
exports.limpiarTmp = limpiarTmp;
exports.wipeTasas = wipeTasas;
exports.javaSinTasas = javaSinTasas;
exports.startJava = startJava;
exports.crearNest = crearNest;
exports.pasoNest = pasoNest;
exports.pasoJava = pasoJava;
exports.matarJava = matarJava;
exports.normalizar = normalizar;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const testing_1 = require("@nestjs/testing");
const app_module_1 = require("../src/app.module");
const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'test', 'seed.db');
const JAR = path.resolve(ROOT, '..', 'backend', 'target', 'viajes-0.0.1-SNAPSHOT.jar');
exports.JAVA_BASE = 'http://127.0.0.1:8099';
function tmpDb(nombre) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'viajes-paridad-'));
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
async function javaSinTasas(javaDb) {
    const limite = Date.now() + 50000;
    let limpias = 0;
    while (Date.now() < limite) {
        await wipeTasas(javaDb);
        try {
            const r = await fetch(exports.JAVA_BASE + '/api/tasa', { signal: AbortSignal.timeout(2000) });
            const body = await r.json();
            if (Object.keys(body).length === 0) {
                limpias += 1;
                if (limpias >= 3)
                    return;
            }
            else {
                limpias = 0;
            }
        }
        catch {
        }
        await new Promise((r) => setTimeout(r, 2500));
    }
    throw new Error('Java no deja la tabla de tasas vacia');
}
async function startJava(dbPath) {
    try {
        (0, child_process_1.execSync)("pkill -f '[v]iajes-0.0.1-SNAPSHOT.jar'");
    }
    catch {
    }
    const child = (0, child_process_1.spawn)('java', ['-jar', JAR, `--server.port=8099`, `--spring.datasource.url=jdbc:sqlite:${dbPath}`], { stdio: 'ignore' });
    const limite = Date.now() + 120000;
    while (Date.now() < limite) {
        try {
            const r = await fetch(exports.JAVA_BASE + '/api/choferes', { signal: AbortSignal.timeout(2000) });
            if (r.ok)
                return child;
        }
        catch {
        }
        await new Promise((r) => setTimeout(r, 1500));
    }
    child.kill();
    throw new Error('El backend Java no arranco en 120s');
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
async function pasoJava(p) {
    const res = await fetch(exports.JAVA_BASE + p.path, {
        method: p.method,
        headers: { 'Content-Type': 'application/json' },
        body: p.body != null ? JSON.stringify(p.body) : undefined,
    });
    const text = await res.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        }
        catch {
            body = text;
        }
    }
    return { status: res.status, body };
}
async function matarJava(java) {
    if (!java || java.exitCode != null)
        return;
    java.kill('SIGTERM');
    await new Promise((r) => {
        const t = setTimeout(() => {
            java.kill('SIGKILL');
            r(undefined);
        }, 5000);
        java.once('exit', () => {
            clearTimeout(t);
            r(undefined);
        });
    });
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