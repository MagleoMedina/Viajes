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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const initSqlJs = require('sql.js');
const merge = require('../../scripts/pull-merge-turso.js');
const ESQUEMA_LOCAL = `
  CREATE TABLE padres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre text NOT NULL,
    eliminado integer NOT NULL DEFAULT 0
  );
  CREATE TABLE hijos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    padre_id bigint REFERENCES padres(id),
    dato text NOT NULL DEFAULT '',
    litros real NOT NULL DEFAULT 0
  );
  CREATE TABLE solo_local (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x text
  );
`;
const ESQUEMA_REMOTO = `
  CREATE TABLE padres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre text NOT NULL
  );
  CREATE TABLE hijos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    padre_id bigint REFERENCES padres(id),
    dato text NOT NULL DEFAULT '',
    litros real NOT NULL DEFAULT 0
  );
`;
function cargar(SQL, esquema, filas) {
    const db = new SQL.Database();
    db.run(esquema);
    for (const [tabla, lista] of Object.entries(filas)) {
        for (const fila of lista) {
            const columnas = Object.keys(fila);
            db.run(`INSERT INTO ${tabla} (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`, columnas.map((c) => fila[c]));
        }
    }
    return db;
}
function valor(db, sql, params = []) {
    const r = db.exec(sql, params);
    return r.length ? r[0].values[0]?.[0] : undefined;
}
function fila(db, sql, params = []) {
    const r = db.exec(sql, params);
    if (!r.length || !r[0].values.length)
        return undefined;
    return Object.fromEntries(r[0].columns.map((c, i) => [c, r[0].values[0][i]]));
}
function remotoFalso(db) {
    return {
        async execute(sql) {
            const r = db.exec(sql);
            if (!r.length)
                return { columns: [], rows: [] };
            const { columns, values } = r[0];
            return {
                columns,
                rows: values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]]))),
            };
        },
        async batch(sentencias) {
            for (const s of sentencias)
                db.run(s.sql, s.args);
        },
        close() { },
    };
}
const DATOS_LOCAL = {
    padres: [
        { id: 1, nombre: 'A', eliminado: 0 },
        { id: 2, nombre: 'B-local', eliminado: 0 },
        { id: 3, nombre: 'C-solo-local', eliminado: 1 },
    ],
    hijos: [
        { id: 1, padre_id: 1, dato: 'x', litros: 0 },
        { id: 2, padre_id: 1, dato: 'y', litros: 5 },
        { id: 3, padre_id: 1, dato: 'z', litros: 7 },
        { id: 4, padre_id: 1, dato: 'w', litros: 9 },
        { id: 6, padre_id: 3, dato: 'local-only', litros: 3 },
    ],
    solo_local: [
        { id: 1, x: 'extra-1' },
        { id: 2, x: 'extra-2' },
    ],
};
const DATOS_REMOTO = {
    padres: [
        { id: 1, nombre: 'A' },
        { id: 2, nombre: 'B' },
        { id: 4, nombre: 'D-remoto' },
    ],
    hijos: [
        { id: 1, padre_id: 1, dato: 'x', litros: 60 },
        { id: 2, padre_id: 1, dato: 'y', litros: 5 },
        { id: 3, padre_id: 1, dato: 'z', litros: 5 },
        { id: 4, padre_id: 1, dato: 'w', litros: 11 },
        { id: 5, padre_id: 4, dato: 'remoto-only', litros: 20 },
    ],
};
const DATOS_BASE = {
    padres: [
        { id: 1, nombre: 'A', eliminado: 0 },
        { id: 2, nombre: 'B', eliminado: 0 },
        { id: 3, nombre: 'C-solo-local', eliminado: 1 },
    ],
    hijos: [
        { id: 1, padre_id: 1, dato: 'x', litros: 0 },
        { id: 2, padre_id: 1, dato: 'y', litros: 5 },
        { id: 3, padre_id: 1, dato: 'z', litros: 5 },
        { id: 4, padre_id: 1, dato: 'w', litros: 5 },
        { id: 6, padre_id: 3, dato: 'local-only', litros: 3 },
    ],
    solo_local: [
        { id: 1, x: 'extra-1' },
        { id: 2, x: 'extra-2' },
    ],
};
const DDL_SOLO_LOCAL = 'CREATE TABLE solo_local (id INTEGER PRIMARY KEY AUTOINCREMENT, x text)';
describe('Pull + fusión Turso (pull-merge-turso.js)', () => {
    let SQL;
    let tmp;
    let localDb;
    let remotoDb;
    beforeAll(async () => {
        SQL = await initSqlJs();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'viajes-merge-'));
    });
    afterAll(() => {
        try {
            localDb?.close();
            remotoDb?.close();
        }
        catch {
        }
        fs.rmSync(tmp, { recursive: true, force: true });
    });
    function entradas() {
        return [
            {
                nombre: 'padres',
                locales: DATOS_LOCAL.padres,
                remotas: DATOS_REMOTO.padres,
                base: DATOS_BASE.padres,
                columnas: ['id', 'nombre'],
                ddlLocal: null,
                remotaFaltante: false,
            },
            {
                nombre: 'hijos',
                locales: DATOS_LOCAL.hijos,
                remotas: DATOS_REMOTO.hijos,
                base: DATOS_BASE.hijos,
                columnas: ['id', 'padre_id', 'dato', 'litros'],
                ddlLocal: null,
                remotaFaltante: false,
            },
            {
                nombre: 'solo_local',
                locales: DATOS_LOCAL.solo_local,
                remotas: [],
                base: DATOS_BASE.solo_local,
                columnas: ['id', 'x'],
                ddlLocal: DDL_SOLO_LOCAL,
                remotaFaltante: true,
            },
        ];
    }
    it('planifica en tres vías: remoto aplica, local conserva, ambos = conflicto', () => {
        const planes = merge.planearMerge(entradas(), 'local');
        const padres = planes.find((p) => p.nombre === 'padres');
        const hijos = planes.find((p) => p.nombre === 'hijos');
        const soloLocal = planes.find((p) => p.nombre === 'solo_local');
        expect(padres.insertar.map((f) => f.id)).toEqual([4]);
        expect(padres.actualizar).toHaveLength(0);
        expect(padres.empujar.map((f) => f.id)).toEqual([2]);
        expect(padres.localesSolo.map((f) => f.id)).toEqual([3]);
        expect(hijos.insertar.map((f) => f.id)).toEqual([5]);
        expect(hijos.actualizar.map((f) => f.id)).toEqual([1]);
        expect(hijos.empujar.map((f) => f.id)).toEqual([3]);
        expect(hijos.conflictos).toHaveLength(1);
        expect(hijos.conflictos[0].id).toBe('4');
        expect(hijos.conflictos[0].campos).toEqual(['litros']);
        expect(hijos.localesSolo.map((f) => f.id)).toEqual([6]);
        expect(soloLocal.localesSolo).toHaveLength(2);
    });
    it('aplica en local: inserta remoto, actualiza solo lo que cambió Turso y no borra nada', () => {
        localDb = cargar(SQL, ESQUEMA_LOCAL, DATOS_LOCAL);
        const planes = merge.planearMerge(entradas(), 'local');
        merge.aplicarLocal(localDb, planes);
        expect(valor(localDb, 'SELECT litros FROM hijos WHERE id = 1')).toBe(60);
        expect(valor(localDb, 'SELECT litros FROM hijos WHERE id = 3')).toBe(7);
        expect(valor(localDb, 'SELECT litros FROM hijos WHERE id = 4')).toBe(9);
        expect(valor(localDb, 'SELECT litros FROM hijos WHERE id = 5')).toBe(20);
        expect(valor(localDb, 'SELECT litros FROM hijos WHERE id = 6')).toBe(3);
        expect(valor(localDb, 'SELECT count(*) FROM hijos')).toBe(6);
        expect(valor(localDb, 'SELECT count(*) FROM padres')).toBe(4);
        expect(fila(localDb, 'SELECT nombre, eliminado FROM padres WHERE id = 4')).toEqual({
            nombre: 'D-remoto',
            eliminado: 0,
        });
    });
    it('sube a Turso solo las filas locales: inserta faltantes y actualiza cambios locales', async () => {
        remotoDb = cargar(SQL, ESQUEMA_REMOTO, DATOS_REMOTO);
        const planes = merge.planearMerge(entradas(), 'local');
        const conteos = await merge.aplicarRemoto(remotoFalso(remotoDb), planes, {
            crearTablas: false,
        });
        expect(valor(remotoDb, 'SELECT nombre FROM padres WHERE id = 2')).toBe('B-local');
        expect(valor(remotoDb, 'SELECT litros FROM hijos WHERE id = 3')).toBe(7);
        expect(valor(remotoDb, 'SELECT nombre FROM padres WHERE id = 3')).toBe('C-solo-local');
        expect(valor(remotoDb, 'SELECT litros FROM hijos WHERE id = 6')).toBe(3);
        expect(valor(remotoDb, 'SELECT litros FROM hijos WHERE id = 4')).toBe(11);
        expect(conteos.tablasCreadas).toEqual([]);
        expect(conteos.insertadas).toBe(2);
        expect(conteos.actualizadas).toBe(2);
        expect(conteos.omitidas).toBe(2);
    });
    it('con --crear-tablas crea la tabla faltante en Turso y sube sus filas', async () => {
        const db = cargar(SQL, ESQUEMA_REMOTO, DATOS_REMOTO);
        const planes = merge.planearMerge(entradas(), 'local');
        const conteos = await merge.aplicarRemoto(remotoFalso(db), planes, { crearTablas: true });
        expect(conteos.tablasCreadas).toEqual(['solo_local']);
        expect(conteos.omitidas).toBe(0);
        expect(valor(db, 'SELECT count(*) FROM solo_local')).toBe(2);
        expect(valor(db, 'SELECT x FROM solo_local WHERE id = 2')).toBe('extra-2');
        db.close();
    });
    it('--conflictos=remoto resuelve el conflicto con Turso', () => {
        const db = cargar(SQL, ESQUEMA_LOCAL, DATOS_LOCAL);
        const planes = merge.planearMerge(entradas(), 'remoto');
        const hijos = planes.find((p) => p.nombre === 'hijos');
        expect(hijos.conflictos).toHaveLength(0);
        expect(hijos.resueltosRemoto.map((c) => c.id)).toEqual(['4']);
        merge.aplicarLocal(db, planes);
        expect(valor(db, 'SELECT litros FROM hijos WHERE id = 4')).toBe(11);
        db.close();
    });
    it('lee las tablas de Turso con columnas y filas', async () => {
        const db = cargar(SQL, ESQUEMA_REMOTO, DATOS_REMOTO);
        const tablas = await merge.leerRemoto(remotoFalso(db));
        expect([...tablas.keys()].sort()).toEqual(['hijos', 'padres']);
        expect(tablas.get('hijos').columnas).toEqual(['id', 'padre_id', 'dato', 'litros']);
        expect(tablas.get('hijos').filas).toHaveLength(5);
        expect(tablas.get('padres').filas.find((f) => f.id === 4).nombre).toBe('D-remoto');
        db.close();
    });
    it('parsea las opciones de la CLI y rechaza valores inválidos', () => {
        const opciones = merge.parseArgs([
            '--dry-run',
            '--conflictos=remoto',
            '--crear-tablas',
            '--sin-subir',
            '--db=temporal.db',
        ]);
        expect(opciones).toMatchObject({
            dryRun: true,
            conflictos: 'remoto',
            crearTablas: true,
            subir: false,
            db: 'temporal.db',
        });
        expect(() => merge.parseArgs(['--conflictos=otro'])).toThrow();
        expect(() => merge.parseArgs(['--no-existe'])).toThrow();
    });
    it('escribe la base con respaldo previo y deja el archivo legible', () => {
        const SQLite = SQL;
        const db = cargar(SQLite, ESQUEMA_LOCAL, DATOS_LOCAL);
        const archivo = path.join(tmp, 'viajes.db');
        fs.writeFileSync(archivo, Buffer.from(db.export()));
        db.close();
        const otro = cargar(SQLite, ESQUEMA_LOCAL, DATOS_LOCAL);
        otro.run("UPDATE hijos SET litros = 42 WHERE id = 2");
        const respaldo = merge.escribirAtomico(archivo, otro.export());
        otro.close();
        expect(fs.existsSync(respaldo)).toBe(true);
        expect(path.basename(respaldo)).toContain('viajes.db.bak-pre-pull-');
        const leida = new SQLite.Database(new Uint8Array(fs.readFileSync(archivo)));
        expect(valor(leida, 'SELECT litros FROM hijos WHERE id = 2')).toBe(42);
        leida.close();
        const anterior = new SQLite.Database(new Uint8Array(fs.readFileSync(respaldo)));
        expect(valor(anterior, 'SELECT litros FROM hijos WHERE id = 2')).toBe(5);
        anterior.close();
    });
});
//# sourceMappingURL=pull-merge.spec.js.map