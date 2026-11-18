// =============================================================================
// Image en el teléfono: «Tus plantillas» y «De la comunidad» en «Nuevo diseño», como en la computadora (18/11/2026)
// =============================================================================
// O35 (la parte 2) de docs/pendientes-verificados-17-11.md. La computadora suma las plantillas que guardó el negocio y las de la
// comunidad arriba de las de MaKo desde el 6/11/2026 (app/image-editor/ImageEditorCliente.tsx, `usePlantillasPropias`); el
// teléfono (app/m/image-editor/InicioImagenM.tsx) dibujaba sólo las de MaKo, y una plantilla guardada no se podía usar desde el
// celular. Esto MONTA la pantalla real del teléfono con el hook real (tests/_image-movil-propias-hijo.ts, en su propio proceso:
// mockea módulos) y mira:
//   1. que pide las plantillas de Image (`formato_imagen`) y las dibuja en su grupo, primero las del negocio, después las de la
//      comunidad y recién ahí las de MaKo, cada una con su rótulo (🔒 o las estrellas);
//   2. que tocar una propia la usa por la acción de las creaciones (no crea un diseño de MaKo) y navega a lo que esa acción dice.
//
// PROBADO ROMPIÉNDOLO (18/11/2026, base 2/0), de a una y restaurado:
//   · sin las secciones de las propias en la hoja (lo de antes)                       → 0 / 2 (no están, y no hay qué tocar)
//   · la tarjeta propia por `crear` (la acción de MaKo) en vez de `usarPropia`       → 1 / 1 (2)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');

type Resultado = {
  abrio: boolean;
  hayHoja: boolean;
  secciones: Array<{ titulo: string | null; tarjetas: string[]; rotulos: string[] }>;
  usoMia: boolean;
  llamadas: { tipos: string[]; usadas: number[]; creadas: string[]; push: string[] };
};

let cache: Resultado | null = null;
function correr(): Resultado {
  if (cache) return cache;
  const out = execFileSync(process.execPath, ['--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_image-movil-propias-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
  const i = out.lastIndexOf('@@R@@');
  assert.ok(i >= 0, `el hijo no devolvió nada:\n${out.slice(-2000)}`);
  cache = JSON.parse(out.slice(i + 5)) as Resultado;
  return cache;
}

test('1. «Nuevo diseño» trae las del negocio y las de la comunidad, en su grupo, arriba de las de MaKo', () => {
  const r = correr();
  assert.ok(r.abrio && r.hayHoja, 'el «+» abre «¿Qué vas a crear hoy?»');
  assert.deepEqual(r.llamadas.tipos, ['formato_imagen'], 'pide las plantillas de Image, no las de otra tab');
  assert.deepEqual(r.secciones.map((s) => s.titulo), ['Tus plantillas', 'De la comunidad', 'Plantillas'], 'el orden de la computadora');
  assert.deepEqual(r.secciones[0].tarjetas, ['Mi anuncio de oferta']);
  assert.deepEqual(r.secciones[0].rotulos, ['🔒 Sólo tu negocio']);
  assert.deepEqual(r.secciones[1].tarjetas, ['Carrusel de testimonios']);
  assert.deepEqual(r.secciones[1].rotulos, ['★ 12 · Agencia Ejemplo']);
  assert.ok(r.secciones[2].tarjetas.length > 0, 'las de MaKo siguen ahí');
});

test('2. tocar una propia la usa por la acción de las creaciones y abre lo que crea', () => {
  const r = correr();
  assert.ok(r.usoMia, 'la tarjeta propia está para tocarla');
  assert.deepEqual(r.llamadas.usadas, [41], 'usa ESA creación');
  assert.deepEqual(r.llamadas.creadas, [], 'no crea un diseño de MaKo en su lugar');
  assert.deepEqual(r.llamadas.push, ['/image-editor/nuevo-41'], 'abre el diseño que se creó (en el teléfono, el mismo editor)');
});
