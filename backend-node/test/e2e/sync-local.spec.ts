const {
  parseArgs,
  planearMerge,
  aplicarLocal,
  alinearEsquema,
  ddlColumna,
  defaultSeguro,
  tipoSeguro,
} = require('../../scripts/sync-local-desde-turso');

const initSqlJs = require('sql.js');

// Modulo TS: evita que las constantes de este archivo choquen con las de
// otros specs al compilar todo el proyecto con nest build.
export {};

type InfoCol = {
  name: string;
  type?: string;
  notnull?: number;
  dflt_value?: string | null;
  pk?: number;
};

function tablaRemota(extra: {
  ddl: string;
  columnas: string[];
  filas?: Record<string, unknown>[];
  info: InfoCol[];
}) {
  return { filas: [], ...extra };
}

describe('Sincronización local <- Turso (solo bajada)', () => {
  describe('argumentos y DDL de columnas', () => {
    it('usa valores conservadores por defecto', () => {
      const opciones = parseArgs([]);
      expect(opciones).toMatchObject({
        dryRun: false,
        conflictos: 'local',
        esquema: true,
        baseline: true,
        db: null,
      });
    });

    it('acepta --db, --dry-run y --sin-esquema', () => {
      const opciones = parseArgs([
        '--dry-run',
        '--db',
        'C:\\otra\\viajes.db',
        '--sin-esquema',
        '--conflictos=remoto',
      ]);
      expect(opciones.dryRun).toBe(true);
      expect(opciones.db).toBe('C:\\otra\\viajes.db');
      expect(opciones.esquema).toBe(false);
      expect(opciones.conflictos).toBe('remoto');
    });

    it('rechaza políticas desconocidas', () => {
      expect(() => parseArgs(['--conflictos=otro'])).toThrow('local');
    });

    it('arma el ALTER TABLE con tipo y DEFAULT seguro', () => {
      expect(
        ddlColumna({ name: 'monto', type: 'real', dflt_value: '0', pk: 0 }),
      ).toBe('"monto" real DEFAULT 0');
      expect(
        ddlColumna({ name: 'nota', type: 'varchar(100)', dflt_value: "'0'", pk: 0 }),
      ).toBe('"nota" varchar(100) DEFAULT \'0\'');
      expect(ddlColumna({ name: 'raro', type: 'x; DROP TABLE t', dflt_value: '1; DROP' })).toBe(
        '"raro"',
      );
    });

    it('solo acepta tipos y defaults simples', () => {
      expect(tipoSeguro('varchar(200) NOT NULL')).toBe('varchar(200) NOT NULL');
      expect(tipoSeguro('real); DROP TABLE t')).toBe('');
      expect(defaultSeguro('CURRENT_TIMESTAMP')).toBe('CURRENT_TIMESTAMP');
      expect(defaultSeguro("'texto'")).toBe("'texto'");
      expect(defaultSeguro('1; DROP TABLE t')).toBeNull();
    });
  });

  describe('alinearEsquema', () => {
    it('crea tablas y columnas faltantes sin tocar los datos locales', async () => {
      const SQL = await initSqlJs();
      const db = new SQL.Database();
      db.run('CREATE TABLE choferes (id INTEGER PRIMARY KEY, nombre varchar(100))');
      db.run("INSERT INTO choferes (id, nombre) VALUES (1, 'LOCAL')");

      const remotas = new Map([
        [
          'choferes',
          tablaRemota({
            ddl: 'CREATE TABLE choferes (id INTEGER PRIMARY KEY, nombre varchar(100), apellido varchar(100))',
            columnas: ['id', 'nombre', 'apellido'],
            info: [
              { name: 'id', type: 'INTEGER', pk: 1, dflt_value: null },
              { name: 'nombre', type: 'varchar(100)', pk: 0, dflt_value: null },
              { name: 'apellido', type: 'varchar(100)', pk: 0, dflt_value: "'X'" },
            ],
          }),
        ],
        [
          'ingresos',
          tablaRemota({
            ddl: 'CREATE TABLE ingresos (id INTEGER PRIMARY KEY, monto_bs real NOT NULL DEFAULT 0)',
            columnas: ['id', 'monto_bs'],
            info: [
              { name: 'id', type: 'INTEGER', pk: 1, dflt_value: null },
              { name: 'monto_bs', type: 'real', pk: 0, dflt_value: '0' },
            ],
          }),
        ],
      ]);

      const locales = new Map([
        [
          'choferes',
          {
            ddl: 'CREATE TABLE choferes (id INTEGER PRIMARY KEY, nombre varchar(100))',
            columnas: ['id', 'nombre'],
            filas: [{ id: 1, nombre: 'LOCAL' }],
          },
        ],
      ]);

      const cambios = alinearEsquema(db, locales, remotas);

      expect(cambios).toEqual([
        { tipo: 'columna', tabla: 'choferes', columna: 'apellido' },
        { tipo: 'tabla', tabla: 'ingresos' },
      ]);

      const chofer = db.exec('SELECT * FROM choferes')[0];
      expect(chofer.columns).toEqual(['id', 'nombre', 'apellido']);
      expect(chofer.values[0]).toEqual([1, 'LOCAL', 'X']);

      const ingresos = db.exec("SELECT name FROM sqlite_master WHERE name='ingresos'");
      expect(ingresos.length).toBe(1);
      db.close();
    });
  });

  describe('planearMerge y aplicarLocal', () => {
    const entrada = (extra: Record<string, unknown> = {}) => ({
      nombre: 'gastos_varios',
      columnas: ['id', 'monto', 'motivo'],
      locales: [
        { id: 1, monto: 10, motivo: 'LOCAL-EDITADO' },
        { id: 2, monto: 20, motivo: 'SOLO-LOCAL' },
      ],
      remotas: [
        { id: 1, monto: 99, motivo: 'REMOTO' },
        { id: 3, monto: 30, motivo: 'SOLO-REMOTO' },
      ],
      base: [{ id: 1, monto: 10, motivo: 'BASE' }],
      ...extra,
    });

    it('aplica solo los cambios que vinieron únicamente de Turso', () => {
      const [plan] = planearMerge([
        entrada({ base: [{ id: 1, monto: 10, motivo: 'LOCAL-EDITADO' }] }),
      ]);
      expect(plan.actualizar.map((f: any) => f.id)).toEqual([1]);
      expect(plan.insertar.map((f: any) => f.id)).toEqual([3]);
      expect(plan.localesSolo.map((f: any) => f.id)).toEqual([2]);
      expect(plan.conflictos).toEqual([]);
    });

    it('conserva local cuando ambos lados cambiaron la misma fila', () => {
      const [plan] = planearMerge([
        entrada({ base: [{ id: 1, monto: 5, motivo: 'BASE' }] }),
      ]);
      expect(plan.actualizar).toEqual([]);
      expect(plan.conflictos).toEqual([{ id: '1', campos: ['monto', 'motivo'] }]);
    });

    it('--conflictos=remoto aplica la versión de Turso', () => {
      const [plan] = planearMerge(
        [entrada({ base: [{ id: 1, monto: 5, motivo: 'BASE' }] })],
        'remoto',
      );
      expect(plan.actualizar.map((f: any) => f.id)).toEqual([1]);
      expect(plan.resueltosRemoto).toHaveLength(1);
    });

    it('no resucita una fila borrada en local', () => {
      const [plan] = planearMerge([
        entrada({
          locales: [{ id: 1, monto: 10, motivo: 'LOCAL-EDITADO' }],
          remotas: [
            { id: 1, monto: 10, motivo: 'LOCAL-EDITADO' },
            { id: 3, monto: 30, motivo: 'SOLO-REMOTO' },
          ],
          base: [
            { id: 1, monto: 10, motivo: 'LOCAL-EDITADO' },
            { id: 3, monto: 30, motivo: 'SOLO-REMOTO' },
          ],
        }),
      ]);
      expect(plan.insertar).toEqual([]);
      expect(plan.borradasLocal).toEqual([{ id: '3' }]);
    });

    it('inserta filas remotas y nunca borra las solo locales', async () => {
      const SQL = await initSqlJs();
      const db = new SQL.Database();
      db.run(
        'CREATE TABLE gastos_varios (id INTEGER PRIMARY KEY, monto real, motivo varchar(200), extra varchar(50))',
      );
      db.run("INSERT INTO gastos_varios VALUES (1, 10, 'LOCAL-EDITADO', 'x')");
      db.run("INSERT INTO gastos_varios VALUES (2, 20, 'SOLO-LOCAL', 'y')");

      const [plan] = planearMerge([
        entrada({ base: [{ id: 1, monto: 10, motivo: 'LOCAL-EDITADO' }] }),
      ]);
      aplicarLocal(db, [plan]);

      const filas = db.exec('SELECT id, monto, motivo, extra FROM gastos_varios ORDER BY id')[0];
      expect(filas.values).toEqual([
        [1, 99, 'REMOTO', 'x'], // la columna local extra se conserva
        [2, 20, 'SOLO-LOCAL', 'y'],
        [3, 30, 'SOLO-REMOTO', null],
      ]);
      db.close();
    });
  });
});
