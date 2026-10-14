import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';

/**
 * Chrome embebido para generar PDFs sin depender del cache de puppeteer
 * (~/.cache/puppeteer) en la maquina destino.
 *
 * La version debe coincidir con la que resuelve puppeteer en package.json
 * (22.15 -> Chrome 127.0.6533.88) y con CHROMIUM_VERSION de scripts/build-all.mjs.
 *
 * La app empaquetada corre este backend como hijo de Electron con CWD
 * resources/app; electron-packager copia bin/chromium a resources/chromium
 * (--extra-resource). El padre ademas puede indicar la ruta via CHROMIUM_DIR.
 */
export const CHROMIUM_VERSION = '127.0.6533.88';

const EXE_REL = path.join('chrome', `win64-${CHROMIUM_VERSION}`, 'chrome-win64', 'chrome.exe');

function candidatosExecutable(): string[] {
  const rutas: string[] = [];
  const exeEnv = process.env.CHROMIUM_EXECUTABLE;
  const dirEnv = process.env.CHROMIUM_DIR;
  if (exeEnv) rutas.push(exeEnv);
  if (dirEnv) rutas.push(path.join(dirEnv, EXE_REL));
  // Empaquetado: CWD = resources/app y chromium vive un nivel arriba.
  rutas.push(path.join(process.cwd(), '..', 'chromium', EXE_REL));
  // Desarrollo: CWD = backend-node y bin/chromium esta en la raiz del repo.
  rutas.push(path.join(process.cwd(), '..', 'bin', 'chromium', EXE_REL));
  // Por si acaso el backend corre dentro de un proceso Electron.
  const resourcesPath = (process as { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) rutas.push(path.join(resourcesPath, 'chromium', EXE_REL));
  return rutas;
}

/** Ruta absoluta del chrome.exe embebido, o undefined si no esta en el paquete. */
export function getChromiumExecutablePath(): string | undefined {
  return candidatosExecutable().find((ruta) => fs.existsSync(ruta));
}

/** puppeteer.launch usando el Chrome embebido si existe; si no, su cache normal. */
export async function lanzarChrome(): Promise<puppeteer.Browser> {
  const executablePath = getChromiumExecutablePath();
  if (executablePath) {
    console.log(`[chromium] usando el binario embebido: ${executablePath}`);
  } else {
    console.warn('[chromium] sin binario embebido; puppeteer usara su cache (~/.cache/puppeteer)');
  }
  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
}
