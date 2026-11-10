// =============================================================================
// Palabras clave en un DM y la mención en una historia, como ManyChat (10/11/2026)
// =============================================================================
// Martín, 9/11/2026: «que revises que todo lo que se hace en ManyChat se pueda hacer y que nosotros tengamos todo eso». Dos
// disparadores de ManyChat que MaKo no tenía (docs/relevo/nube-automations-manychat.md):
//   · «DM keyword»: el CRON «El usuario envía un mensaje» (y «Responde a tu historia») con palabras clave. Hasta acá las
//     palabras eran sólo del comentario: un DM arrancaba con CUALQUIER texto.
//   · «Story mention»: la mención en una historia llegaba por el webhook (`mencion_historia`) y no la escuchaba nadie.
// Por la ENTRADA REAL: la ruta del webhook de Zernio y el motor de verdad, contra dobles (tests/_boton-vuelve-hijo.ts
// 'dm_y_mencion'). Lo puro (`conPalabras`, `disparaPorEvento`) lo cuida tests/palabras-clave-comentario.test.ts.
//
// Probado rompiéndolo (10/11/2026, base 3/0):
//   · `conPalabras` sin 'dm' → 1 rojo (el DM sin la palabra crea el lead y le escribe).
//   · el `return` de antes para `mencion_historia` en procesarEventoSocial → 1 rojo (la mención no inscribe a nadie).
//   · sin `mencion_historia: 'mencion'` en SUBTIPO_DEL_WEBHOOK → 1 rojo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
type Paso = { leads?: number; secuencias?: number[]; llego: string[]; insc: string[] };
let cache: Record<string, Paso> | null = null;
function pasos(): Record<string, Paso> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx',
    join(RAIZ, 'tests/_boton-vuelve-hijo.ts'), 'dm_y_mencion'], { cwd: RAIZ, encoding: 'utf8', timeout: 150_000, maxBuffer: 64 * 1024 * 1024 });
  const linea = r.stdout.split('\n').find((l) => l.startsWith('@@R@@'));
  if (!linea) throw new Error(`el hijo no devolvió nada (salió con ${r.status}): ${r.stderr.slice(-2000)}`);
  cache = (JSON.parse(linea.slice(5)) as { pasos: Record<string, Paso> }).pasos;
  return cache;
}

test('un DM sin la palabra clave no crea el lead ni le escribe', () => {
  const p = pasos()['1_dm_sin_palabra'];
  assert.equal(p.leads, 0, 'no nace el lead de quien escribió otra cosa');
  assert.deepEqual(p.insc, []);
  assert.deepEqual(p.llego, [], 'no sale nada');
});

test('un DM con la palabra (en mayúsculas y con tilde) arranca la automatización y le llega el mensaje', () => {
  const p = pasos()['2_dm_con_palabra'];
  assert.equal(p.leads, 1);
  assert.deepEqual(p.secuencias, [680]);
  assert.ok(p.llego.some((t) => t.startsWith('Te dejo el recurso')), `le llegó: ${JSON.stringify(p.llego)}`);
});

test('la mención en una historia arranca la automatización que la escucha, y le contesta por DM', () => {
  const p = pasos()['3_mencion'];
  assert.equal(p.leads, 2, 'nace el lead de quien mencionó');
  assert.deepEqual(p.secuencias, [680, 681], 'la 681 escucha la mención; la 680 (DM con palabra) no');
  assert.ok(p.llego.some((t) => t.startsWith('¡Gracias por mencionarnos')), `le llegó: ${JSON.stringify(p.llego)}`);
});
