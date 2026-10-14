/**
 * Shell Electron de Viajes.
 *
 * Levanta el backend Nest (dist/src/main.js) como proceso hijo y abre la UI en
 * una ventana. El paquete (build_lista/electron-dist) incluye la estructura
 * completa del backend en resources/app (electron-packager --no-asar).
 *
 * El hijo se spawnea SIN consola (windowsHide + stdio a archivo de log): en la
 * build final no debe abrirse ninguna terminal. El log queda en
 * userData/backend.log y los errores lo citan.
 *
 * Limites conocidos:
 * - Requiere Node.js en la maquina destino: usa el binario `node` como hijo.
 * - PDF (puppeteer) usa el Chrome embebido: bin/chromium se copia a
 *   resources/chromium en el empaquetado (--extra-resource en build-all.mjs) y
 *   la ruta se le pasa al hijo via CHROMIUM_DIR. Sin binario, el backend cae al
 *   cache ~/.cache/puppeteer del usuario.
 */
const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ?? '18234';
const URL = `http://localhost:${PORT}`;
const APP_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : __dirname;
// Chrome embebido para los PDF del backend: build-all.mjs copia bin/chromium
// a resources/chromium (--extra-resource). En dev apunta a bin/chromium.
const CHROMIUM_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'chromium')
  : path.join(APP_DIR, '..', 'bin', 'chromium');
// Icono de la ventana (Windows usa .ico; en dev y en el paquete --no-asar
// el archivo vive junto a main.js).
const ICONO = path.join(APP_DIR, 'icono.ico');
const LOG = path.join(app.getPath('userData'), 'backend.log');
const TIMEOUT_MS = 60000;

let backend = null;
let lanceBackend = false;
let cerrando = false;

// Instancia unica: dos exe abiertos peleian por el puerto 18234.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  main();
}

function probar(ms) {
  return new Promise((ok) => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${URL}/api/empresas`);
        if (r.ok) {
          clearInterval(t);
          ok(true);
        }
      } catch {
        /* aun no escucha */
      }
    }, 500);
    setTimeout(() => {
      clearInterval(t);
      ok(false);
    }, ms);
  });
}

function ultimasLineas(n = 15) {
  try {
    return fs.readFileSync(LOG, 'utf8').split(/\r?\n/).slice(-n).join('\n');
  } catch {
    return '(sin log)';
  }
}

function arrancarBackend() {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const log = fs.openSync(LOG, 'a');
  backend = spawn('node', ['dist/src/main.js'], {
    cwd: APP_DIR,
    env: { ...process.env, PORT, CHROMIUM_DIR },
    // Sin terminal: log a archivo y ventana de consola oculta en Windows.
    stdio: ['ignore', log, log],
    windowsHide: true,
  });
  backend.on('error', (e) => {
    if (cerrando) return;
    dialog.showErrorBox(
      'Viajes',
      `No se pudo lanzar Node.js (${e.message}).\n` +
        'Instala Node.js en la maquina y vuelve a abrir la aplicacion.',
    );
    app.quit();
  });
  backend.on('exit', (code) => {
    if (cerrando) return;
    dialog.showErrorBox(
      'Viajes',
      `El backend termino inesperadamente (exit ${code}).\n\n` +
        `Log (${LOG}):\n${ultimasLineas()}`,
    );
    app.quit();
  });
}

async function main() {
  await app.whenReady();
  // Reutiliza un backend huerfano (ej.: cierre bruto de la app anterior).
  if (!(await probar(2000))) {
    lanceBackend = true;
    arrancarBackend();
    if (!(await probar(TIMEOUT_MS))) {
      dialog.showErrorBox(
        'Viajes',
        `El backend no respondio en ${TIMEOUT_MS / 1000}s.\n\n` +
          `Log (${LOG}):\n${ultimasLineas()}`,
      );
      app.quit();
      return;
    }
  }
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: ICONO,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadURL(URL);
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  cerrando = true;
  // Solo mata el hijo propio: un backend reutilizado no es nuestro.
  if (lanceBackend && backend && !backend.killed) backend.kill();
});
