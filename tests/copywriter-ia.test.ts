// =============================================================================
// El Copywriter, tanda 2: MaKo escribiendo EN el guion — lo que se rompe sin un error
// =============================================================================
// Fija:
//   · los PROMPTS editables: cada clave de PROMPTS_COPY y PROMPTS_EDITAR está en lib/prompt-registry.ts con TODAS sus
//     ranuras (una ranura que el registro no declara se borra al editar el prompt desde /configuraciones-prompts, y el
//     modelo deja de recibir ese dato sin un error); y la salida de «Editar» lleva su {{formato}};
//   · las DOS validaciones de lo que vuelve: el server sanea contra el guion que mandó la pantalla y la pantalla vuelve a
//     sanear contra el de AHORA (la persona pudo escribir mientras MaKo pensaba);
//   · PROPONER, NO APLICAR: la pantalla pausa el guion ANTES de construir, construye fuera del historial, y aceptar es UN
//     paso de deshacer; al soltar la pausa, se guarda sólo si quedó distinto (descartar no escribe);
//   · la API: las 8 operaciones del Copywriter van al FINAL del área `contenido`, con sus palabras («documento»,
//     «copywriter») y sin las del Ads Writer («guion de anuncio»), y su runner pregunta la puerta en cada una.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROMPTS_COPY } from '../lib/copywriter/ia-reglas';
import { PROMPTS_EDITAR, FORMATO_EDITAR } from '../lib/copywriter/ia-editar';
import { OPERACIONES_IA } from '../lib/copywriter/operaciones';
import { slotsDe } from '../lib/editor-landing/ia-reglas';
import { REGISTRO } from '../lib/api-mako/registro';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

test('los prompts del Copywriter están en el registro editable, cada uno con TODAS sus ranuras', () => {
  const reg = leer('lib/prompt-registry.ts');
  for (const p of [...Object.values(PROMPTS_COPY), ...Object.values(PROMPTS_EDITAR)]) {
    const i = reg.indexOf(`key: '${p.key}'`);
    assert.ok(i >= 0, `${p.key} no está en lib/prompt-registry.ts`);
    const bloque = reg.slice(i, reg.indexOf('context:', i));
    for (const s of slotsDe(p.tpl)) assert.ok(bloque.includes(`v('${s}'`), `${p.key}: la ranura {{${s}}} no está declarada en el registro`);
  }
});

test('«Editar» le pasa al modelo las herramientas (el {{formato}}) y el catálogo entero está en el formato', () => {
  assert.ok(slotsDe(PROMPTS_EDITAR.editarSystem.tpl).includes('formato'));
  for (const op of OPERACIONES_IA) assert.ok(FORMATO_EDITAR.includes(op), `el formato no nombra ${op}`);
  const ia = leer('lib/copywriter/ia.ts');
  assert.match(ia, /formato: FORMATO_EDITAR/);
  assert.match(ia, /REGLA_NO_EXISTE/);
  assert.match(ia, /const s = sanearOperaciones\(raw\.operaciones, g\.doc, catalogo\)/, 'el server sanea contra el guion que mandó la pantalla');
  assert.match(ia, /marcasDeVoseo\(escrito\)/, 'la segunda capa de la voz del negocio');
});

test('la pantalla vuelve a sanear contra lo de AHORA, pausa antes de construir y acepta en un paso', () => {
  const panel = leer('app/copywriter/PanelMaKo.tsx');
  const iAhora = panel.indexOf('const antes = ed.getJSON() as JsonNodo;');
  const iSanear = panel.indexOf('sanearOperaciones(r.operaciones, antes,');
  const iPausa = panel.indexOf('onPausa(true);');
  const iConstruir = panel.indexOf('await construir(ed, cuadrosDeConstruccion(antes, s.ops)');
  assert.ok(iAhora > 0 && iSanear > iAhora, 'se sanea contra el documento de AHORA');
  assert.ok(iPausa > 0 && iConstruir > iPausa, 'la pausa va ANTES de construir (si no, el autoguardado escribe la propuesta)');
  assert.match(panel, /aceptarEnDoc\(ed, m\.propuesta\.antes, m\.propuesta\.final\)/);
  assert.match(panel, /!appEscritorio\.bloqueada/);
  const prop = leer('app/copywriter/editor/propuesta.ts');
  assert.match(prop, /if \(!op\.historial\) tr\.setMeta\('addToHistory', false\);/, 'construir va fuera del historial');
  assert.match(prop, /return ponerDoc\(editor, antes\) && ponerDoc\(editor, final, \{ historial: true \}\);/, 'aceptar: la foto de antes y el resultado en UN paso');
  const editor = leer('app/copywriter/editor/EditorGuion.tsx');
  assert.match(editor, /if \(foto != null && JSON\.stringify\(editor\.getJSON\(\)\) !== foto\) \{ marcar\(/, 'al soltar la pausa se guarda sólo si cambió');
  assert.match(editor, /if \(!transaction\.docChanged \|\| pausaRef\.current\) return;/, 'en pausa no se marca para guardar');
});

test('la API: las del Copywriter al FINAL de `contenido`, con sus palabras, y la puerta en cada runner', () => {
  const contenido = REGISTRO.filter((d) => d.area === 'contenido').map((d) => d.id);
  const copy = contenido.filter((id) => id.endsWith('_copywriter'));
  assert.equal(copy.length, 8);
  assert.deepEqual(contenido.slice(-8), copy, 'van al final del área');
  for (const d of REGISTRO.filter((x) => x.id.endsWith('_copywriter'))) {
    assert.ok(!/guion de anuncio/i.test(`${d.titulo} ${d.descripcion}`), `${d.id} usa las palabras del Ads Writer`);
    assert.equal(d.gating?.tab, 'copywriter');
  }
  const run = leer('lib/api-mako/areas/copywriter.run.ts');
  const runners = [...run.matchAll(/^ {2}([a-z_]+_copywriter): \{/gm)].map((m) => m[1]);
  assert.equal(runners.length, 8);
  // Cada runner pregunta la puerta: 2 lecturas (leer) y 6 acciones (preparar).
  assert.equal((run.match(/if \(await cerrada\(ctx\)\) return/g) ?? []).length, 8);
});
