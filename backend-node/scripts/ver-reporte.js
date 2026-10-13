/* Genera los dos formatos del reporte historico y muestra el texto extraido. */
const fs = require('fs');
const pdfParse = require('pdf-parse');
const API = process.env.API || 'http://localhost:8080/api';

async function texto(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return (await pdfParse(buf)).text.replace(/\s+/g, ' ').trim();
}

(async () => {
  const conMonto = await texto(`${API}/export/reporte?empresaId=2&desde=2026-10-01&hasta=2026-10-31&conMonto=true`);
  const sinMonto = await texto(`${API}/export/reporte?empresaId=2&desde=2026-10-01&hasta=2026-10-31&conMonto=false`);
  const general = await texto(`${API}/export/reporte?conMonto=true`);
  console.log('=== CON MONTO (empresa 1, oct-2026) ===\n' + conMonto + '\n');
  console.log('=== SIN MONTO (empresa 1, oct-2026) ===\n' + sinMonto + '\n');
  console.log('=== HISTORICO GENERAL (todas, todas las fechas) ===\n' + general + '\n');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
