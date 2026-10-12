/**
 * Shell Electron de Viajes.
 *
 * Levanta el backend Nest (dist/src/main.js) como proceso hijo y abre la UI en
 * una ventana. El paquete (build_lista/electron-dist) incluye la estructura
 * completa del backend en resources/app (electron-packager --no-asar).
 *
 * Limites conocidos:
 * - Requiere Node.js en la maquina destino: usa el binario `node` como hijo.
 * - PDF (puppeteer) depende del cache de Chrome; si la maquina destino no lo
 *   tiene (~/.cache/puppeteer), esa parte falla. Embeber Chrome = tarea aparte.
 */
const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT ?? '18234';
const URL = `http://localhost:${PORT}`;
const APP_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : __dirname;

let backend = null;
let cerrando = false;

function arrancarBackend() {
  backend = spawn('node', ['dist/src/main.js'], {
    cwd: APP_DIR,
    env: { ...process.env, PORT },
    stdio: 'inherit',
  });
  backend.on('exit', (code) => {
    if (!cerrando) {
      dialog.showErrorBox('Viajes', `El backend termino inesperadamente (exit ${code}).`);
      app.quit();
    }
  });
}

function esperarBackend() {
  return new Promise((ok, no) => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${URL}/api/empresas`);
        if (r.ok) {
          clearInterval(t);
          ok();
        }
      } catch {
        /* aun no escucha */
      }
    }, 500);
    setTimeout(() => {
      clearInterval(t);
      no(new Error('el backend no respondio en 20s'));
    }, 20000);
  });
}

app.whenReady().then(async () => {
  arrancarBackend();
  try {
    await esperarBackend();
  } catch (e) {
    dialog.showErrorBox('Viajes', e.message);
    app.quit();
    return;
  }
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadURL(URL);
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  cerrando = true;
  backend?.kill();
});