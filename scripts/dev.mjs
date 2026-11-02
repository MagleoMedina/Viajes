#!/usr/bin/env node
/**
 * Levanta backend y frontend en modo desarrollo.
 * Uso: node scripts/dev.mjs
 *
 * - Backend: `nest start --watch` (recompila y reinicia al guardar).
 * - Frontend: Vite con HMR, proxya /api al backend (8080).
 * Ctrl+C cierra ambos.
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const hijos = [];

function lanzar(nombre, cwd, comando) {
  const hijo = spawn(comando, {
    cwd,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prefijo = `[${nombre}] `;
  for (const flujo of [hijo.stdout, hijo.stderr]) {
    flujo.on('data', (datos) => process.stdout.write(prefijo + datos.toString()));
  }
  hijo.on('exit', (codigo) => {
    console.log(`${prefijo}termino (${codigo}). Cerrando el resto.`);
    cerrar();
  });
  hijos.push(hijo);
}

function cerrar() {
  for (const hijo of hijos) {
    if (!hijo.pid) continue;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      hijo.kill('SIGTERM');
    }
  }
  process.exit(0);
}

process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);

lanzar('back', resolve(ROOT, 'backend-node'), 'pnpm exec nest start --watch');
lanzar('front', resolve(ROOT, 'frontend'), 'pnpm exec vite');
