"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { ordenarPorDependencias, leerDependencias, construirSentencias, } = require('../../scripts/sync-turso');
const initSqlJs = require('sql.js');
function ejecutarLote(db, sentencias) {
    db.run('BEGIN');
    try {
        for (const sentencia of sentencias) {
            if (typeof sentencia === 'string')
                db.run(sentencia);
            else
                db.run(sentencia.sql, sentencia.args);
        }
        db.run('COMMIT');
    }
    catch (e) {
        db.run('ROLLBACK');
        throw e;
    }
}
function nombreDeTablas(db) {
    return db
        .exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0]
        .values.map((fila) => fila[0]);
}
function ddlsDe(db) {
    const filas = db.exec("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0].values;
    return new Map(filas.map(([nombre, ddl]) => [nombre, ddl]));
}
async function baseConPadreEHijo() {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    db.run('CREATE TABLE padre (id INTEGER PRIMARY KEY, nombre TEXT)');
    db.run('CREATE TABLE hijo (id INTEGER PRIMARY KEY, padre_id INTEGER NOT NULL REFERENCES padre(id))');
    db.run("INSERT INTO padre VALUES (1, 'A'), (2, 'B')");
    db.run('INSERT INTO hijo VALUES (1, 1), (2, 1), (3, 2)');
    return db;
}
describe('Espejo local -> Turso: orden por claves foraneas', () => {
    it('pone los padres antes que los hijos', () => {
        const nombres = ['gastos_varios', 'titulo_gasto', 'vehiculos', 'gastos_gasoil', 'viajes'];
        const fks = new Map([
            ['gastos_varios', ['titulo_gasto']],
            ['titulo_gasto', []],
            ['vehiculos', []],
            ['gastos_gasoil', ['vehiculos']],
            ['viajes', []],
        ]);
        const orden = ordenarPorDependencias(nombres, fks);
        expect(orden).toHaveLength(nombres.length);
        expect(orden.indexOf('titulo_gasto')).toBeLessThan(orden.indexOf('gastos_varios'));
        expect(orden.indexOf('vehiculos')).toBeLessThan(orden.indexOf('gastos_gasoil'));
    });
    it('rompe ciclos sin perder tablas', () => {
        const nombres = ['a', 'b', 'c'];
        const fks = new Map([
            ['a', ['b']],
            ['b', ['a']],
            ['c', []],
        ]);
        const orden = ordenarPorDependencias(nombres, fks);
        expect([...orden].sort()).toEqual(['a', 'b', 'c']);
    });
    it('lee las dependencias reales de sqlite', async () => {
        const db = await baseConPadreEHijo();
        const fks = leerDependencias(db, nombreDeTablas(db));
        expect(fks.get('hijo')).toEqual(['padre']);
        expect(fks.get('padre')).toEqual([]);
        db.close();
    });
    it('el lote recrea padre e hijo con FK activas sin violarlas', async () => {
        const origen = await baseConPadreEHijo();
        const nombres = nombreDeTablas(origen);
        const tablas = ordenarPorDependencias(nombres, leerDependencias(origen, nombres));
        const sentencias = construirSentencias(origen, tablas, ddlsDe(origen));
        const destino = await baseConPadreEHijo();
        destino.run("UPDATE padre SET nombre = 'VIEJO' WHERE id = 1");
        expect(() => ejecutarLote(destino, sentencias)).not.toThrow();
        const padres = destino.exec('SELECT id, nombre FROM padre ORDER BY id')[0].values;
        const hijos = destino.exec('SELECT id, padre_id FROM hijo ORDER BY id')[0].values;
        expect(padres).toEqual([
            [1, 'A'],
            [2, 'B'],
        ]);
        expect(hijos).toEqual([
            [1, 1],
            [2, 1],
            [3, 2],
        ]);
        expect(destino.exec('PRAGMA foreign_key_check').length).toBe(0);
        origen.close();
        destino.close();
    });
    it('el orden ingenuo (padre primero) si viola la FK', async () => {
        const db = await baseConPadreEHijo();
        expect(() => {
            db.run('BEGIN');
            db.run('DROP TABLE padre');
        }).toThrow(/FOREIGN KEY/i);
        db.close();
    });
});
//# sourceMappingURL=sync-turso.spec.js.map