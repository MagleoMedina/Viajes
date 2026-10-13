/* Verifica que los datos existan realmente en Turso (solo lectura). */
const { createClient } = require('@libsql/client');

(async () => {
  const r = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const t = await r.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  console.log('tablas remotas:', t.rows.map((x) => x.name).join(', '));
  for (const tabla of ['viajes', 'choferes', 'empresas', 'vehiculos', 'recorridos']) {
    const c = await r.execute(`SELECT count(*) n FROM ${tabla}`);
    console.log(` ${tabla}: ${Number(c.rows[0].n)}`);
  }
  r.close();
})().catch((e) => {
  console.error('ERR:', e.message);
  process.exit(1);
});
