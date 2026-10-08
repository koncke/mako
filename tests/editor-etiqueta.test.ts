// =============================================================================
// La tarjeta 🏷️: una frase «[Poner ▾] [etiqueta ▾]» sobre la ⚡ Acción de siempre
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 6): «Falta la tarjeta de etiqueta, para poder
// colocar una etiqueta al lead.» Decisión 8 del diseño: una PRESENTACIÓN sobre `poner_etiqueta_lead` /
// `sacar_etiqueta_lead`; el motor no cambia. `app/chatbot/EditorEtiqueta.tsx`.
//
// Lo que fija este test: la frase (sin rótulos), que la etiqueta se elija con el SelectorEtiqueta
// EXPORTADO (el de «＋ Nueva» con creación en el lugar) y no con una copia, que las dos operaciones
// existan en el registro con los parámetros que el lienzo arma, y que el selector llene el ancho que
// le dan (el envoltorio medía lo que su texto).
//
// ── Roturas (08/10/2026) ── al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorEtiqueta } from '../app/chatbot/EditorEtiqueta';
import { SelectorEtiqueta } from '../app/_components/etiquetas-cliente';
import { OPS_ETIQUETA, esOperacionEtiqueta } from '../lib/editor-acciones';
import { porId } from '../lib/api-mako/registro';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const ETIQUETA = sinComentarios(leer('app/chatbot/EditorEtiqueta.tsx'));

test('la frase: «Poner» o «Sacar», y la etiqueta al lado, sin rótulos', () => {
  const poner = renderToStaticMarkup(createElement(EditorEtiqueta, { operacion: 'poner_etiqueta_lead', etiquetaId: null, onChange: () => {} }));
  assert.ok(poner.includes('>Poner<') && !poner.includes('>Sacar<'), 'el botón dice la operación elegida');
  assert.ok(poner.includes('Elige una etiqueta'));
  const sacar = renderToStaticMarkup(createElement(EditorEtiqueta, { operacion: 'sacar_etiqueta_lead', etiquetaId: 7, onChange: () => {} }));
  assert.ok(sacar.includes('>Sacar<'));
  assert.doesNotMatch(ETIQUETA, /<label|<Field\b|hint=/, 'la frase se lee sola (punto 5 del primer pedido)');
});

test('la etiqueta se elige con el SelectorEtiqueta EXPORTADO, no con una copia', () => {
  assert.match(ETIQUETA, /import \{ SelectorEtiqueta \} from '@\/app\/_components\/etiquetas-cliente';/);
  assert.doesNotMatch(ETIQUETA, /function SelectorEtiqueta|fetch\(|\/api\/crm\/etiquetas/, 'un segundo selector es un segundo «＋ Nueva» que crea distinto');
  assert.match(ETIQUETA, /onElegir=\{\(e\) => onChange\(operacion, e\.id\)\}/, 'se guarda el ID: renombrar la etiqueta no rompe la tarjeta');
  assert.match(ETIQUETA, /if \(v === 'poner_etiqueta_lead' \|\| v === 'sacar_etiqueta_lead'\) onChange\(v, etiquetaId\)/, 'cambiar de verbo conserva la etiqueta');
});

test('las dos operaciones existen con lead y etiqueta: el motor corre la ⚡ Acción de siempre', () => {
  for (const op of OPS_ETIQUETA) {
    const d = porId(op);
    assert.ok(d && d.tipo === 'accion', op);
    assert.deepEqual(d!.parametros.map((p) => p.nombre).sort(), ['etiquetaId', 'leadId'], op);
  }
  assert.equal(esOperacionEtiqueta('poner_etiqueta_lead'), true);
  assert.equal(esOperacionEtiqueta('avisar_al_equipo'), false);
  assert.equal(esOperacionEtiqueta(null), false);
});

test('el SelectorEtiqueta llena el ancho que le dan (con un porcentaje, el envoltorio también)', () => {
  const html = renderToStaticMarkup(createElement(SelectorEtiqueta, { value: null, onElegir: () => {}, width: '100%' }));
  assert.match(html, /^<span style="[^"]*width:100%/, 'el botón quedaba del largo de su texto');
  const fijo = renderToStaticMarkup(createElement(SelectorEtiqueta, { value: null, onElegir: () => {}, width: 150 }));
  assert.doesNotMatch(fijo.slice(0, fijo.indexOf('>')), /[;"]width:/, 'con un número, el desplegable se dimensiona solo');
});

// ── Roturas (08/10/2026) ─────────────────────────────────────────────────────────────────────
// Arnés en el scratchpad (E-v2-romper.mjs): UNA rotura por vez, restaurada de memoria. Base: 4 / 4.
// 4 roturas, 4 cazadas (fallos de 4):
//   C1. el envoltorio del selector sin el ancho                      → 1
//   C2. la tarjeta guarda otra cosa que el id                        → 1
//   C3. el verbo con otro texto («Agregar»)                          → 1
//   C4. cambiar de verbo pierde la etiqueta                          → 1
