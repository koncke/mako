// En el teléfono, «Editar» de un ejemplo abre el MISMO guiado de la computadora: MaKo pregunta antes de armar (10/11/2026).
//
// Medido en producción a 375×812: el «Editar» del teléfono armaba la versión EN EL ACTO (leía las láminas, escribía con la IA del
// negocio y creaba el diseño) sin preguntar la oferta, porque app/m/image-editor/page.tsx montaba la grilla sin `onReplicar`, y
// sin eso ExplorarCarruseles cae en EditarCarrusel. Es lo que Martín no quería el 9/11 («me llevó directamente al editor»).
//
// Esto dibuja la pantalla REAL del teléfono y su envoltorio REAL (app/m/image-editor/EjemplosM.tsx) en un hijo con módulos de
// mentira (tests/_image-movil-guiado-hijo.ts) y fija:
//   1. la pantalla del teléfono le pasa `onReplicar` a la grilla (sin eso, «Editar» arma solo);
//   2. «Editar» deja la grilla y abre el guiado: el chat de MaKo (`ChatReplica`) ARRIBA y el original (`ReplicarGuiado`) debajo;
//   3. la «←» del chat vuelve a los ejemplos.
//
// Verificado rompiéndolo (10/11/2026, base 3/0): la pantalla con <ExplorarCarruseles> directo (como antes) → cae el 1;
// EjemplosM sin `onReplicar` → caen el 1, el 2 y el 3; el original arriba del chat → cae el 2.
//
// Correr: node --import tsx --test tests/image-movil-guiado.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
type Resultado = {
  pagina: { html: string; grilla: { telefono: boolean; conReplicar: boolean } | null };
  antes: { grilla: boolean; chat: boolean };
  conReplicar: boolean;
  tras: { grilla: boolean; chat: string | null; original: string | null; chatAntesQueOriginal: boolean; volver: boolean } | null;
  alVolver: { grilla: boolean; chat: boolean } | null;
};

let cache: Resultado | null = null;
function hijo(): Resultado {
  if (cache) return cache;
  // Sin NODE_TEST_CONTEXT: llamado desde un test, node toma al hijo por un test anidado.
  const out = execFileSync(process.execPath, ['--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_image-movil-guiado-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
  const i = out.lastIndexOf('@@R@@');
  assert.ok(i >= 0, `el hijo no terminó: ${out.slice(-800)}`);
  cache = JSON.parse(out.slice(i + 5)) as Resultado;
  return cache;
}

test('1 · la pantalla del teléfono le pasa `onReplicar` a la grilla: sin eso, «Editar» arma sin preguntar', () => {
  const { pagina } = hijo();
  assert.ok(pagina.grilla, `la pantalla no dibujó la grilla: ${pagina.html}`);
  assert.equal(pagina.grilla.telefono, true);
  assert.equal(pagina.grilla.conReplicar, true, 'la grilla del teléfono llegó sin `onReplicar`: su «Editar» cae en EditarCarrusel');
});

test('2 · «Editar» abre el guiado: el chat de MaKo arriba y el original debajo, sin la grilla', () => {
  const r = hijo();
  assert.deepEqual(r.antes, { grilla: true, chat: false }, 'al entrar, los ejemplos');
  assert.equal(r.conReplicar, true, 'EjemplosM no le pasó `onReplicar` a la grilla');
  assert.ok(r.tras);
  assert.equal(r.tras.grilla, false, 'con el guiado abierto, la grilla no se dibuja');
  assert.equal(r.tras.chat, '-42', 'el chat de MaKo (ChatReplica) pregunta por ESE carrusel');
  assert.equal(r.tras.original, '-42', 'y debajo, las láminas del original (ReplicarGuiado)');
  assert.equal(r.tras.chatAntesQueOriginal, true, 'apilado, primero MaKo: es donde se contesta');
});

test('3 · la «←» del chat vuelve a los ejemplos', () => {
  const r = hijo();
  assert.equal(r.tras?.volver, true, 'el chat no trae la «←»');
  assert.deepEqual(r.alVolver, { grilla: true, chat: false });
});
