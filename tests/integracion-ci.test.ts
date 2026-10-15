// El chequeo completo corre en GitHub Actions sobre la rama `integracion`, y `main` avanza por
// fast-forward sólo con el verde (15/10/2026: el tsc de 3-5 GB ya no entraba en la notebook
// compartida por 10-20 chats). Ver AGENTS.md → «El typecheck NO corre en el build».
//
// Lo que se fija acá son las tres cosas que, rotas, dejan pasar código sin chequear o gastan plata
// sin que nada falle: que `main` siga recibiendo el tsc local si se pushea directo, que Actions no
// fuerce nunca el avance de `main`, y que la rama de integración no dispare deploys en Vercel.
//
// Verificado rompiéndolo: sacar la detección de `refs/heads/main` del hook da 1 fallo; un
// `--force` en el push del workflow da 1 fallo; sacar `integracion: false` de vercel.json da 1 fallo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

test('el workflow corre tipos, guardas y tests sobre integracion, y avanza main SIN forzar', () => {
  const wf = sinComentarios(leer('.github/workflows/integracion.yml'));
  assert.match(wf, /branches:\s*\[integracion\]/, 'corre en la rama integracion');
  assert.match(wf, /typescript\/bin\/tsc --noEmit/, 'corre el tsc completo');
  assert.match(wf, /sh scripts\/guardas-push\.sh/, 'corre la MISMA lista de guardas que el pre-push local');
  assert.match(wf, /npm test/, 'corre los tests');
  assert.match(wf, /git push origin "HEAD:refs\/heads\/main"/, 'avanza main con el commit chequeado');
  assert.doesNotMatch(wf, /--force|-f\b|\+HEAD:/, 'main avanza sólo por fast-forward: un push forzado pisaría lo que llegó por otro lado');
  assert.match(wf, /cancel-in-progress:\s*true/, 'se chequea sólo la punta: no se gastan minutos en commits que quedaron atrás');
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
function prePush(stdin: string): string {
  const fuente = leer('scripts/claude-hooks/pre-push')
    .replace('node "$LOCK_TSC"', 'echo TSC-LOCAL')
    .replace('sh "$GUARDAS" "$REMOTO" || exit 1', 'echo GUARDAS');
  const dir = mkdtempSync(join(tmpdir(), 'prepush-'));
  const hook = join(dir, 'pre-push');
  writeFileSync(hook, fuente);
  const r = spawnSync('sh', [hook, 'origin', 'url'], { cwd: RAIZ, input: stdin, encoding: 'utf8' });
  if (r.error) throw r.error;
  return `${r.stdout}${r.stderr}`;
}

const Z = '0'.repeat(40);
const haySh = !spawnSync('sh', ['-c', 'exit 0']).error;

test('el pre-push corre el tsc local SÓLO si el push va a main, y las guardas siempre', { skip: !haySh && 'sin sh' }, () => {
  const aIntegracion = prePush(`refs/heads/integracion abc refs/heads/integracion ${Z}\n`);
  assert.doesNotMatch(aIntegracion, /TSC-LOCAL/, 'a integracion el tsc lo corre Actions');
  assert.match(aIntegracion, /GUARDAS/);
  const aMain = prePush(`HEAD abc refs/heads/main ${Z}\n`);
  assert.match(aMain, /TSC-LOCAL/, 'directo a main (la emergencia) el tsc local tiene que correr: main no recibe código sin chequear');
  assert.match(aMain, /GUARDAS/);
  const aLasDos = prePush(`refs/heads/x abc refs/heads/integracion ${Z}\nrefs/heads/y abc refs/heads/main ${Z}\n`);
  assert.match(aLasDos, /TSC-LOCAL/, 'un push que incluye main también corre el tsc');
});
