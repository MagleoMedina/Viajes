#!/usr/bin/env node
/**
 * Build unificado de Viajes -> build_lista/ (frontend + backend listos para producción).
 * Uso: node scripts/build-all.mjs  (o ./scripts/build-all.mjs)
 *
 * Desviaciones del plan original (este repo):
 * - Usa pnpm, no npm: no hay package-lock.json (solo pnpm-lock.yaml).
 * - El backend vive en backend-node/, no backend/.
 * - La entrada es dist/src/main.js, no dist/main.js (script "start").
 * - El frontend lo sirve Nest (ServeStatic) desde <cwd>/../frontend/dist; como el
 *   backend arranca en build_lista/backend, el dist va a build_lista/frontend/dist.
 * - En runtime el backend lee del CWD: assets/, data/viajes.db (base real, ignorada
 *   en git), scripts/sync-turso.js (cron Turso) y .env. Todo se copia junto a dist.
 * - puppeteer necesita su postinstall (descarga Chrome): NO usar --ignore-scripts.
 *   Chrome queda en ~/.cache/puppeteer del usuario (no dentro de build_lista).
 * - Paso final: empaquetar la app de escritorio con Electron (electron/main.js),
 *   shell que levanta el backend y abre la UI. Requiere Node en la maquina
 *   destino y electron + electron-packager en electron/ (se instalan solos).
 */
import { execSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TARGET = join(ROOT, 'build_lista');
const FRONTEND = join(ROOT, 'frontend');
const BACKEND = join(ROOT, 'backend-node');
const TARGET_FRONT = join(TARGET, 'frontend', 'dist');
const TARGET_BACK = join(TARGET, 'backend');

function run(cmd, cwd, env = {}) {
  console.log(`\n> [${cmd}] (cwd: ${cwd})`);
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
}

function copiar(src, dst, esArchivo = false) {
  if (!existsSync(src)) {
    console.log(`  (skip: no existe ${src})`);
    return;
  }
  cpSync(src, dst, { recursive: true });
  console.log(`  copiado: ${src} -> ${dst}`);
}

function smokeTest() {
  return new Promise((resolve, reject) => {
    console.log('\n--- SMOKE TEST (backend en :8099) ---');
    const child = spawn('node', ['dist/src/main.js'], {
      cwd: TARGET_BACK,
      env: { ...process.env, PORT: '8099' },
      stdio: 'inherit',
    });
    const inicio = Date.now();
    let hecho = false;
    const finOk = () => {
      if (!hecho) {
        hecho = true;
        resolve(true);
      }
    };
    const finErr = (msg) => {
      if (!hecho) {
        hecho = true;
        reject(new Error(msg));
      }
    };
    child.on('exit', (code) =>
      finErr(`el backend salio antes de responder (exit code ${code})`),
    );
    const poll = async () => {
      try {
        const api = await fetch('http://localhost:8099/api/empresas');
        const spa = await fetch('http://localhost:8099/');
        const html = await spa.text();
        if (api.ok && spa.ok && html.includes('id="root"')) {
          console.log('  OK: /api/empresas -> 200 y / -> index.html del SPA');
          child.kill('SIGTERM');
          finOk();
          return;
        }
      } catch {
        /* aun no escucha */
      }
      if (Date.now() - inicio > 30000) {
        console.error('  timeout: el backend no respondio en 30s');
        child.kill('SIGKILL');
        finErr('smoke test: timeout en :8099');
        return;
      }
      setTimeout(poll, 700);
    };
    poll();
  });
}

try {
  console.log('=== INICIANDO BUILD UNIFICADO ===');

  // 1. Limpieza de build_lista
  rmSync(TARGET, { recursive: true, force: true });
  mkdirSync(TARGET_FRONT, { recursive: true });
  mkdirSync(TARGET_BACK, { recursive: true });
  console.log('build_lista/ purgado y recreado');

  // 2. Frontend
  console.log('\n--- COMPILANDO FRONTEND ---');
  run('pnpm install --frozen-lockfile', FRONTEND);
  run('pnpm build', FRONTEND);
  copiar(join(FRONTEND, 'dist'), TARGET_FRONT);

  // 3. Backend
  console.log('\n--- COMPILANDO BACKEND ---');
  run('pnpm install --frozen-lockfile', BACKEND);
  run('pnpm build', BACKEND);
  copiar(join(BACKEND, 'dist'), join(TARGET_BACK, 'dist'));
  copiar(join(BACKEND, 'package.json'), join(TARGET_BACK, 'package.json'), true);
  copiar(join(BACKEND, 'pnpm-lock.yaml'), join(TARGET_BACK, 'pnpm-lock.yaml'), true);
  copiar(join(BACKEND, 'pnpm-workspace.yaml'), join(TARGET_BACK, 'pnpm-workspace.yaml'), true);

  // 4. Runtime: lo que el backend lee desde el CWD
  console.log('\n--- COPIANDO RUNTIME DEL BACKEND ---');
  copiar(join(BACKEND, 'assets'), join(TARGET_BACK, 'assets'));
  copiar(join(BACKEND, 'scripts'), join(TARGET_BACK, 'scripts'));
  copiar(join(BACKEND, 'data'), join(TARGET_BACK, 'data'));
  const envOrigen = join(BACKEND, '.env');
  if (existsSync(envOrigen)) {
    copiar(envOrigen, join(TARGET_BACK, '.env'), true);
  } else {
    console.log('  WARN: sin .env -> el cron de Turso quedara desactivado');
  }

  // 5. Dependencias de producción en el destino
  //    puppeteer postinstall descarga Chrome (allowBuilds en pnpm-workspace.yaml).
  //    node-linker=hoisted: layout plano sin symlinks — electron-packager
  //    desreferencia symlinks y el layout pnpm clasico (.pnpm/) rompe requires
  //    (p.ej. tslib) dentro de la app empaquetada. pnpm 11.20 NO lee esto de
  //    .npmrc: va en pnpm-workspace.yaml (nodeLinker, camelCase).
  console.log('\n--- INSTALANDO DEPENDENCIAS DE PRODUCCION ---');
  appendFileSync(join(TARGET_BACK, 'pnpm-workspace.yaml'), 'nodeLinker: hoisted\n');
  run('pnpm install --prod', TARGET_BACK);

  // 6. Smoke test
  await smokeTest();

  // 7. Empaquetado de escritorio (Electron): app = backend + main.js + package.json
  console.log('\n--- EMPAQUETANDO APP DE ESCRITORIO (Electron) ---');
  const ELECTRON_SRC = join(ROOT, 'electron');
  const APP_DST = join(TARGET, 'electron', 'app');
  mkdirSync(APP_DST, { recursive: true });
  copiar(TARGET_BACK, APP_DST);
  copiar(join(ELECTRON_SRC, 'main.js'), join(APP_DST, 'main.js'), true);
  copiar(join(ELECTRON_SRC, 'package.json'), join(APP_DST, 'package.json'), true);
  // Icono de la app y de la ventana: va junto a main.js (lo lee ICONO en
  // main.js) y electron-packager lo incrusta en el .exe con --icon.
  copiar(join(ELECTRON_SRC, 'icono.ico'), join(APP_DST, 'icono.ico'), true);
  // electron-packager resuelve el modulo electron desde el dir de la app (para
  // conocer la version y el binario). Enlace a la instalacion local de electron/
  // para que no tenga que hallarlo dentro de la app empaquetada.
  const nmApp = join(APP_DST, 'node_modules');
  const enlaceElectron = join(nmApp, 'electron');
  if (!existsSync(enlaceElectron)) {
    mkdirSync(nmApp, { recursive: true });
    symlinkSync(join(ELECTRON_SRC, 'node_modules', 'electron'), enlaceElectron, 'dir');
    console.log(`  enlace: ${enlaceElectron} -> electron/node_modules/electron`);
  }
  run('pnpm install', ELECTRON_SRC);
  const SALIDA_ELECTRON = join(TARGET, 'electron-dist');
  const PLAT = process.platform;
  const ARCH = process.arch;
  // --icon: electron-packager incrusta el .ico en el .exe (solo win32/macOS;
  // en Linux se ignora). --no-prune: el package.json de la app solo declara
  // main/name; el node_modules copiado ya es solo produccion y debe conservarse
  // tal cual. --ignore: el symlink temporal de electron no puede colarse.
  // Las rutas van entre comillas: execSync usa el shell y "Viajes Cabelum"
  // tiene un espacio que parte los argumentos.
  const argIcono = PLAT === 'win32' ? ` --icon="${join(ELECTRON_SRC, 'icono.ico')}"` : '';
  run(
    `pnpm exec electron-packager "${APP_DST}" viajes --out="${SALIDA_ELECTRON}" --platform=${PLAT} --arch=${ARCH} --no-asar --no-prune --ignore=node_modules/electron --overwrite${argIcono}`,
    ELECTRON_SRC,
  );
  // ServeStatic del backend resuelve <__dirname>/../../../../frontend/dist: en
  // el paquete (resources/app/dist/src) eso cae en resources/frontend/dist, que
  // es HERMANO de resources/app, no parte de el. El SPA debe vivir ahi.
  const SALIDA_APP = join(SALIDA_ELECTRON, `viajes-${PLAT}-${ARCH}`);
  copiar(TARGET_FRONT, join(SALIDA_APP, 'resources', 'frontend', 'dist'));

  // 8. Criterios de aceptación
  console.log('\n=== BUILD COMPLETADO CON EXITO EN build_lista ===');
  const nombreExe = PLAT === 'win32' ? 'viajes.exe' : 'viajes';
  const checks = [
    ['frontend', join(TARGET_FRONT, 'index.html')],
    ['frontend bundles', join(TARGET_FRONT, 'assets')],
    ['backend entrada', join(TARGET_BACK, 'dist', 'src', 'main.js')],
    ['backend node_modules', join(TARGET_BACK, 'node_modules')],
    ['electron app', join(SALIDA_ELECTRON, `viajes-${PLAT}-${ARCH}`, nombreExe)],
  ];
  for (const [nombre, p] of checks) {
    const ok = existsSync(p);
    console.log(`  [${ok ? 'OK' : 'FALTA'}] build_lista/backend: ${nombre} -> ${p}`);
    if (!ok) process.exitCode = 1;
  }
} catch (err) {
  console.error('\nError en el proceso de build:', err);
  process.exit(1);
}