"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aplicarMigraciones = aplicarMigraciones;
const common_1 = require("@nestjs/common");
const logger = new common_1.Logger('Migraciones');
const COLUMNAS = [
    {
        tabla: 'ingresos',
        columna: 'factura_num',
        ddl: 'ALTER TABLE ingresos ADD COLUMN factura_num integer NULL',
    },
    {
        tabla: 'ingresos',
        columna: 'iva',
        ddl: 'ALTER TABLE ingresos ADD COLUMN iva real NOT NULL DEFAULT 0',
    },
];
async function aplicarMigraciones(dataSource) {
    const driver = dataSource.driver;
    const db = driver.databaseConnection;
    if (!db)
        return;
    const aplicadas = [];
    for (const m of COLUMNAS) {
        if (!existeTabla(db, m.tabla))
            continue;
        if (columnasDe(db, m.tabla).includes(m.columna))
            continue;
        try {
            db.run(m.ddl);
            aplicadas.push(`${m.tabla}.${m.columna}`);
        }
        catch (e) {
            logger.error(`No se pudo migrar ${m.tabla}.${m.columna}: ${e.message}`);
        }
    }
    if (crearIndiceFacturaUnica(db)) {
        aplicadas.push('ingresos.factura_num (unico)');
    }
    if (!aplicadas.length)
        return;
    await driver.save();
    logger.log(`Migrado: + ${aplicadas.join(', ')}`);
}
function existeTabla(db, tabla) {
    const res = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tabla.replace(/'/g, "''")}'`);
    return Boolean(res.length && res[0].values.length);
}
function columnasDe(db, tabla) {
    const info = db.exec(`PRAGMA table_info("${tabla.replace(/"/g, '""')}")`);
    return info.length ? info[0].values.map((fila) => fila[1]) : [];
}
function crearIndiceFacturaUnica(db) {
    if (!existeTabla(db, 'ingresos'))
        return false;
    if (!columnasDe(db, 'ingresos').includes('factura_num'))
        return false;
    const yaExiste = db.exec("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_ingresos_factura_num'");
    if (yaExiste.length && yaExiste[0].values.length)
        return false;
    try {
        db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_ingresos_factura_num ON ingresos(factura_num)');
    }
    catch (e) {
        logger.error(`No se pudo crear el indice unico de facturas: ${e.message}`);
        return false;
    }
    return true;
}
//# sourceMappingURL=migraciones.js.map