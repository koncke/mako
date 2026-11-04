// =============================================================================
// La rama `integracion` se RETIRÓ (4/11/2026): el hook la rechaza, GitHub da rojo si igual llega, y main sólo recibe código chequeado
// =============================================================================
// Hasta el 4/11 este archivo fijaba el tren: se pushaba a `integracion`, integracion.yml corría el chequeo y avanzaba main. Se
// reemplazó por las puntas (punta.yml: cada `punta/<nombre>` se chequea sola y llega a main sola). Lo que se fija ahora es lo que,
// roto, deja un push mudo o código sin chequear en main:
//   · el pre-push RECHAZA un push a `integracion` y dice a qué punta va (un push que nadie mira no puede salir callado);
//   · si igual llega (un clon sin el hook nuevo), integracion-retirada.yml da una corrida ROJA;
//   · directo a main (la emergencia) el tsc local sigue corriendo;
//   · `integracion` no construye en Vercel mientras la rama exista.
// Probado rompiéndolo (4/11/2026): sacando el `exit 1` del bloque de integracion del hook, cae «rechaza el push a integracion»;
// cambiando el `exit 1` del guardia por `exit 0`, cae «da rojo»; sacando la detección de main, cae «directo a main».
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corre, correrPaso } from './_workflow';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const haySh = !spawnSync('sh', ['-c', 'exit 0']).error;
const hayBash = !spawnSync('bash', ['-c', 'exit 0']).error;
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

test('si un push llega a integracion igual (un clon sin el hook nuevo), GitHub da una corrida ROJA y dice a dónde va', { skip: !hayBash && 'sin bash' }, () => {
  const yml = leer('.github/workflows/integracion-retirada.yml');
  assert.equal(corre(yml, 'retirada', { event_name: 'push', event: {} }), true);
  const r = correrPaso(yml, 'La rama integracion ya no lleva a main');
  assert.equal(r.codigo, 1, r.salida);
  assert.match(r.salida, /::error::La rama integracion se retiró.*punta\/<nombre>/);
});

test('la rama integracion no genera deploys en Vercel (cada build cuesta)', () => {
  const v = JSON.parse(leer('vercel.json'));
  assert.equal(v.git?.deploymentEnabled?.integracion, false);
});

test('las guardas del push nombran scripts que existen', () => {
  const g = leer('scripts/guardas-push.sh');
  const scripts = [...g.matchAll(/(?:node(?: --import tsx)?|sh) (scripts\/[\w.-]+)/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 12, `esperaba las 12 guardas y encontré ${scripts.length}`);
  for (const s of scripts) assert.ok(existsSync(join(RAIZ, s)), `guardas-push.sh llama a ${s}, que no existe`);
});

/** Corre el pre-push versionado con el tsc y las guardas reemplazados por un `echo`. */
function prePush(stdin: string): { codigo: number | null; salida: string } {
  const fuente = leer('scripts/claude-hooks/pre-push')
    .replace('node "$LOCK_TSC"', 'echo TSC-LOCAL')
    .replace('sh "$GUARDAS" "$REMOTO" || exit 1', 'echo GUARDAS');
  const dir = mkdtempSync(join(tmpdir(), 'prepush-'));
  const hook = join(dir, 'pre-push');
  writeFileSync(hook, fuente);
  const r = spawnSync('sh', [hook, 'origin', 'url'], { cwd: RAIZ, input: stdin, encoding: 'utf8' });
  if (r.error) throw r.error;
  return { codigo: r.status, salida: `${r.stdout}${r.stderr}` };
}

const Z = '0'.repeat(40);

test('el pre-push RECHAZA un push a integracion y dice a qué punta va; directo a main corre el tsc local; las guardas siempre', { skip: !haySh && 'sin sh' }, () => {
  const aIntegracion = prePush(`refs/heads/integracion abc refs/heads/integracion ${Z}\n`);
  assert.equal(aIntegracion.codigo, 1, aIntegracion.salida);
  assert.match(aIntegracion.salida, /PUSH BLOQUEADO: la rama integracion se retiró/);
  assert.match(aIntegracion.salida, /git push origin HEAD:punta\/<nombre>/);
  assert.doesNotMatch(aIntegracion.salida, /TSC-LOCAL|GUARDAS/, 'se frena antes de gastar nada');
  const aMain = prePush(`HEAD abc refs/heads/main ${Z}\n`);
  assert.equal(aMain.codigo, 0, aMain.salida);
  assert.match(aMain.salida, /TSC-LOCAL/, 'directo a main (la emergencia) el tsc local tiene que correr: main no recibe código sin chequear');
  assert.match(aMain.salida, /GUARDAS/);
  const aOtra = prePush(`refs/heads/x abc refs/heads/punta/x ${Z}\n`);
  assert.doesNotMatch(aOtra.salida, /TSC-LOCAL/, 'a una punta el tsc entero lo corre GitHub');
  assert.match(aOtra.salida, /GUARDAS/);
});
