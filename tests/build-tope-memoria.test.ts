// El build de Vercel corre con NODE_OPTIONS=--max-old-space-size=4096, y esa variable vive en el
// PROYECTO de Vercel, no en el repo (15/10/2026: sin ella el build moría por `out_of_memory` y tres
// pushes salieron verdes sin llegar a producción). next.config.ts avisa en el log si falta.
//
// Se prueba EJECUTANDO la configuración, no leyendo su texto: un guard que busca la cadena da verde
// sobre una condición invertida. Cada caso corre en su propio proceso porque el aviso sale al cargar
// el módulo, y un import se carga una sola vez.
//
// Verificado rompiéndolo: invertir la condición de VERCEL da 2 fallos; sacar el `!` del chequeo de
// NODE_OPTIONS da 2 fallos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const AVISO = /SIN NODE_OPTIONS=--max-old-space-size/;

/** Carga next.config.ts en un node aparte con estas variables y devuelve lo que imprimió. */
function cargar(env: Record<string, string>): string {
  const vars: NodeJS.ProcessEnv = { ...process.env };
  delete vars.VERCEL;
  delete vars.NODE_OPTIONS;
  Object.assign(vars, env);
  const r = spawnSync(process.execPath, ['--import', 'tsx', '-e', "await import('./next.config.ts')"], {
    cwd: RAIZ, env: vars, encoding: 'utf8',
  });
  assert.equal(r.status, 0, `next.config.ts no cargó: ${r.stderr}`);
  return `${r.stdout}${r.stderr}`;
}

test('en Vercel SIN el tope de heap, la configuración lo avisa en el log', () => {
  assert.match(cargar({ VERCEL: '1' }), AVISO, 'sin NODE_OPTIONS el build de Vercel muere por memoria: el log tiene que decirlo');
});

test('en Vercel CON el tope, no avisa nada', () => {
  assert.doesNotMatch(cargar({ VERCEL: '1', NODE_OPTIONS: '--max-old-space-size=4096' }), AVISO);
});

test('en local (sin VERCEL) no avisa: el tope es del proyecto de Vercel', () => {
  assert.doesNotMatch(cargar({}), AVISO);
});
