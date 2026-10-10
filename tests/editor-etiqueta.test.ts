// =============================================================================
// La tarjeta 🏷️: una frase «[Poner ▾] [etiqueta ▾]» sobre la ⚡ Acción de siempre
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 6): «Falta la tarjeta de etiqueta, para poder
// colocar una etiqueta al lead.» Decisión 8 del diseño: una PRESENTACIÓN sobre `poner_etiqueta_lead` /
// `sacar_etiqueta_lead`; el motor no cambia. `app/automations/EditorEtiqueta.tsx`.
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
import { EditorEtiqueta } from '../app/automations/EditorEtiqueta';
import { SelectorEtiqueta } from '../app/_components/etiquetas-cliente';
import {
  OPS_ETIQUETA, esOperacionEtiqueta, VERBO_ETIQUETA, PARAM_ETIQUETAS, etiquetasDelPaso, paramsConEtiquetas, unaPorEtiqueta,
  juntarPorEtiqueta, textoDeEtiquetas,
} from '../lib/editor-acciones';
import { porId } from '../lib/api-mako/registro';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const ETIQUETA = sinComentarios(leer('app/automations/EditorEtiqueta.tsx'));

test('la frase: «Agregar» o «Eliminar» (nunca «Poner» / «Sacar»), y las etiquetas al lado, sin rótulos', () => {
  // Sexta tanda, TAG 1: «En lugar de "Poner" y "Sacar", se formal escribiendo siempre... "Agregar" y "Eliminar"».
  const poner = renderToStaticMarkup(createElement(EditorEtiqueta, { operacion: 'poner_etiqueta_lead', etiquetaIds: [], onChange: () => {} }));
  assert.ok(poner.includes('>Agregar<') && !poner.includes('>Eliminar<'), 'el botón dice la operación elegida');
  assert.ok(poner.includes('Elige una etiqueta'), 'sin ninguna, el campo entero es el selector');
  const sacar = renderToStaticMarkup(createElement(EditorEtiqueta, { operacion: 'sacar_etiqueta_lead', etiquetaIds: [7], onChange: () => {} }));
  assert.ok(sacar.includes('>Eliminar<'));
  // Lo que se LEE (el texto, sin los atributos): el `title`/`aria-label` del ✕ del chip es de
  // app/_components/etiquetas-cliente.tsx y lo mira el test `todo` de abajo.
  const texto = (h: string) => h.replace(/<[^>]+>/g, ' ');
  for (const html of [poner, sacar]) assert.doesNotMatch(texto(html), /Poner|Sacar/, 'volvió «Poner» o «Sacar» a la frase');
  // (`onSacar` es el nombre de la prop del chip, no un texto: por eso la palabra va con borde de letra.)
  assert.doesNotMatch(ETIQUETA, /(?<!\p{L})(Poner|Sacar)(?!\p{L})/u, 'el editor escribe «Poner» o «Sacar»');
  assert.equal(VERBO_ETIQUETA.poner_etiqueta_lead, 'Agregar');
  assert.equal(VERBO_ETIQUETA.sacar_etiqueta_lead, 'Eliminar');
  assert.match(ETIQUETA, /label: VERBO_ETIQUETA\.poner_etiqueta_lead/, 'el verbo sale de UN lugar');
  assert.doesNotMatch(ETIQUETA, /<label|<Field\b|hint=/, 'la frase se lee sola (punto 5 del primer pedido)');
  // La forma de antes (una sola, `etiquetaId`) se sigue aceptando.
  const vieja = renderToStaticMarkup(createElement(EditorEtiqueta, { operacion: 'poner_etiqueta_lead', etiquetaId: 7, onChange: () => {} }));
  assert.ok(vieja.includes('＋ Otra'), 'con una puesta (de antes), el campo ofrece otra');
});

test('⚠️ VARIAS etiquetas: un chip por cada una y «＋ Otra» que no vuelve a ofrecer las elegidas', () => {
  // Sexta tanda, TAG 2: «Se debería poder seleccionar multiple, si quiero sacar o agragar varias etiquetas».
  const html = renderToStaticMarkup(createElement(EditorEtiqueta, { operacion: 'poner_etiqueta_lead', etiquetaIds: [7, 8, 9], onChange: () => {} }));
  // En el server las etiquetas no se leen: cada chip sale con su nombre neutro mientras carga.
  assert.equal((html.match(/title="…"/g) ?? []).length, 3, 'un chip por etiqueta elegida');
  assert.ok(html.includes('＋ Otra'), 'falta la salida para sumar otra');
  assert.match(ETIQUETA, /excluir=\{new Set\(ids\)\}/, 'el selector volvería a ofrecer las que ya están');
  assert.match(ETIQUETA, /const elegir = \(id: number\) => onChange\(operacion, ids\.includes\(id\) \? ids : \[\.\.\.ids, id\]\);/, 'elegir pisa en vez de sumar');
  assert.match(ETIQUETA, /const quitar = \(id: number\) => onChange\(operacion, ids\.filter\(\(x\) => x !== id\)\);/);
  assert.match(ETIQUETA, /onSacar=\{deshabilitado \? undefined : \(\) => quitar\(id\)\}/, 'el chip sin su ✕');
});

test('la etiqueta se elige con el SelectorEtiqueta EXPORTADO, no con una copia', () => {
  assert.match(ETIQUETA, /import \{ SelectorEtiqueta, ChipEtiqueta, useEtiquetasTodas \} from '@\/app\/_components\/etiquetas-cliente';/);
  assert.doesNotMatch(ETIQUETA, /function SelectorEtiqueta|fetch\(|\/api\/crm\/etiquetas/, 'un segundo selector es un segundo «＋ Nueva» que crea distinto');
  assert.match(ETIQUETA, /onElegir=\{\(e\) => elegir\(e\.id\)\}/, 'se guarda el ID: renombrar la etiqueta no rompe la tarjeta');
  assert.match(ETIQUETA, /if \(v === 'poner_etiqueta_lead' \|\| v === 'sacar_etiqueta_lead'\) onChange\(v, ids\)/, 'cambiar de verbo conserva las etiquetas');
});

test('⚠️ el dato de una tarjeta con varias: la primera en `etiquetaId`, todas en `etiquetaIds`, y se corre UNA POR ETIQUETA', () => {
  // Medido el 09/10/2026: la acción del registro declara UN `etiquetaId`, y el validador tira lo que no declara.
  assert.deepEqual(porId('poner_etiqueta_lead')!.parametros.map((p) => p.nombre).sort(), ['etiquetaId', 'leadId']);
  // Con una, el paso queda EXACTO como antes de la sexta tanda.
  assert.deepEqual(paramsConEtiquetas([7], { leadId: 'evento' }), { leadId: 'evento', etiquetaId: 7 });
  assert.deepEqual(paramsConEtiquetas([7, 8], { leadId: 'evento' }), { leadId: 'evento', etiquetaId: 7, [PARAM_ETIQUETAS]: [7, 8] });
  assert.deepEqual(paramsConEtiquetas([], { leadId: 'evento', etiquetaId: 3, [PARAM_ETIQUETAS]: [3, 4] }), { leadId: 'evento' }, 'sin ninguna, sin las dos');
  assert.deepEqual(paramsConEtiquetas([8, 8, 0, -1, 9]), { etiquetaId: 8, [PARAM_ETIQUETAS]: [8, 9] }, 'sin repetidas ni ids que no son ids');
  // Leer: la lista manda, y la de antes (sólo `etiquetaId`) se lee igual.
  assert.deepEqual(etiquetasDelPaso({ etiquetaId: 7 }), [7]);
  assert.deepEqual(etiquetasDelPaso({ etiquetaId: 7, [PARAM_ETIQUETAS]: [7, 8, '9'] }), [7, 8, 9]);
  assert.deepEqual(etiquetasDelPaso(null), []);
  // Correr: una tanda por etiqueta, cada una con su `etiquetaId` y sin la lista; lo demás, intacto.
  assert.deepEqual(unaPorEtiqueta('poner_etiqueta_lead', { leadId: 5, etiquetaId: 7, [PARAM_ETIQUETAS]: [7, 8] }), [{ leadId: 5, etiquetaId: 7 }, { leadId: 5, etiquetaId: 8 }]);
  assert.deepEqual(unaPorEtiqueta('sacar_etiqueta_lead', { leadId: 5, etiquetaId: 7 }), [{ leadId: 5, etiquetaId: 7 }], 'una sola: tal cual');
  const otra = { leadId: 5, texto: 'x', [PARAM_ETIQUETAS]: [1, 2] };
  assert.deepEqual(unaPorEtiqueta('agregar_nota_lead', otra), [otra], 'una acción que no es de etiqueta no se toca');
  // Juntar: bien sólo si salieron todas; el resumen nombra cada una.
  const ok = { ok: true, resumen: 'Cualificado', via: 'pendiente' as string };
  const mal = { ok: false, resumen: 'Seguimiento: no existe', via: 'ninguna' as string };
  assert.deepEqual(juntarPorEtiqueta([ok, mal]), { ok: false, resumen: 'Cualificado · Seguimiento: no existe', via: 'pendiente' });
  assert.equal(juntarPorEtiqueta([ok]), ok);
  // Lo que dice la tarjeta.
  assert.equal(textoDeEtiquetas('poner_etiqueta_lead', ['Cualificado']), 'Agregar Cualificado');
  assert.equal(textoDeEtiquetas('sacar_etiqueta_lead', ['A', 'B']), 'Eliminar A y B');
  assert.equal(textoDeEtiquetas('poner_etiqueta_lead', ['A', 'B', 'C', 'D']), 'Agregar A, B y 2 más');
});

test('⚠️ el lienzo arma el paso con `paramsConEtiquetas` y le pasa al editor TODAS las etiquetas', () => {
  const flujo = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  const ed = flujo.slice(flujo.indexOf('function EditorEtiquetaLienzo('), flujo.indexOf('type Cambiar = '));
  assert.ok(ed.length > 100 && ed.length < 1200, `el recorte mide ${ed.length}`);
  assert.match(ed, /etiquetaIds=\{etiquetasDelPaso\(p\.paso\.accion\?\.params\)\}/, 'el editor recibiría sólo la primera');
  assert.match(ed, /params: paramsConEtiquetas\(ids, \{ leadId: LEAD_DEL_EVENTO \}\)/, 'el paso no guarda las demás');
});

// ENCHUFADO (sexta tanda, segunda pasada, parte «motor», 09/10/2026): el que corre la acción vive en
// lib/api-mako/flujo.ts. Sin esto, una tarjeta con tres etiquetas corre SÓLO la primera, en silencio (el
// validador del registro tira `etiquetaIds`). Queda como guard.
// Probado rompiéndolo (09/10/2026, este archivo con el `todo` ya sacado, base 9 / 0): sin la vuelta por
// tanda → 8 / 1; usando `params` en vez de `tandas[0]` para la tanda única → 8 / 1. Restaurado: 9 / 0.
test('ENCHUFE: `ejecutarDesdeFlujo` corre una vez por etiqueta (`unaPorEtiqueta` + `juntarPorEtiqueta`)', () => {
  const flujo = sinComentarios(leer('lib/api-mako/flujo.ts'));
  const ej = flujo.slice(flujo.indexOf('export async function ejecutarDesdeFlujo('), flujo.indexOf('export async function aplicarEnElActo('));
  assert.ok(ej.length > 0 && ej.length < 2000, `el recorte mide ${ej.length}: está mirando otra cosa`);
  assert.match(ej, /const tandas = unaPorEtiqueta\(operacion, params\);/);
  assert.match(ej, /if \(tandas\.length > 1\) \{\n\s+const rs: ResultadoFlujo\[\] = \[\];\n\s+for \(const p of tandas\) rs\.push\(await ejecutarDesdeFlujo\(operacion, p, opts\)\);\n\s+return juntarPorEtiqueta\(rs\);/);
  // La tanda única (una etiqueta EN LA LISTA) corre con su `etiquetaId`, no con los parámetros crudos.
  assert.match(ej, /paramsDelPaso\(def\.parametros, tandas\[0\],/);
  // Y la vuelta por tanda va ANTES de proponer: si no, la primera ya corrió con las demás tiradas.
  assert.ok(ej.indexOf('const tandas = unaPorEtiqueta(') < ej.indexOf('aplicarEnElActo('));
});

// ⚠️ ENCHUFE PENDIENTE (09/10/2026): el ✕ del chip de una etiqueta (app/_components/etiquetas-cliente.tsx,
// `ChipEtiqueta`, que no es de la parte «editores») dice «Sacar» en su `title` y su `aria-label`, y es lo
// que se lee al pasar el cursor en la tarjeta TAG, en la ficha del lead y en el CRUD (TAG 1: «Revisa que
// no esté ese error en otro lado»).
// ENCHUFADO en la segunda pasada (09/10/2026, parte «datos»). PROBADO ROMPIÉNDOLO: devolverle «Sacar» al
// `title` del ✕ de `ChipEtiqueta` → 1 fallo acá (y 1 en tests/barrido-sexta-datos). Restaurado → verde.
test('ENCHUFE: el ✕ del chip de una etiqueta dice «Eliminar», no «Sacar»', () => {
  const html = renderToStaticMarkup(createElement(EditorEtiqueta, { operacion: 'poner_etiqueta_lead', etiquetaIds: [7], onChange: () => {} }));
  assert.doesNotMatch(html, /Sacar/);
  assert.match(html, /<button type="button" aria-label="Eliminar [^"]*" title="Eliminar"/, 'el ✕ dejó de decir qué hace');
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

test('la lista para NOMBRAR (con archivadas) se vuelve a pedir cuando alguien crea una', () => {
  const src = sinComentarios(leer('app/_components/etiquetas-cliente.tsx'));
  const hook = src.slice(src.indexOf('export function useEtiquetasTodas('), src.indexOf('export function ChipEtiqueta('));
  assert.ok(hook.length > 200 && hook.length < 1500, `no encontré useEtiquetasTodas (${hook.length})`);
  assert.match(hook, /pedirTodas\(\)/, 'con las archivadas: una tarjeta que apunta a una archivada se sigue leyendo');
  assert.match(hook, /window\.addEventListener\(EVENTO, otra\)/, 'una etiqueta creada desde el selector quedaría sin nombre en su tarjeta');
  const crear = src.slice(src.indexOf('export const crearEtiquetaCliente'), src.indexOf('export function useEtiquetas('));
  assert.match(crear, /avisarCambioEtiquetas\(\);/, 'crear avisa: es lo que hace que las listas abiertas se vuelvan a pedir');
});

// ── Roturas (08/10/2026) ─────────────────────────────────────────────────────────────────────
// Arnés en el scratchpad (E-v2-romper.mjs): UNA rotura por vez, restaurada de memoria. Base: 4 / 4
// (5 / 5 con el test de `useEtiquetasTodas`, que se sumó después). 5 roturas, 5 cazadas:
//   C1. el envoltorio del selector sin el ancho                      → 1
//   C2. la tarjeta guarda otra cosa que el id                        → 1
//   C3. el verbo con otro texto («Agregar»)                          → 1
//   C4. cambiar de verbo pierde la etiqueta                          → 1
//   C5. `useEtiquetasTodas` sin escuchar el aviso de cambio          → 1 (de 5)
//
// SEXTA TANDA (09/10/2026, parte «editores»). Arnés scratchpad/editores-v6/romper.mjs, corriendo este
// archivo junto con dropdown-reglas, editor-acciones, editores-control y flujo-lienzo-paralelos.
// Base: 51 / 0 (más los dos `todo` de los enchufes). Restaurado: 51 / 0. Pasan / fallan con cada una:
//   B17. elegir una etiqueta PISA las elegidas en vez de sumarla              → 50 / 1
//   B18. el selector vuelve a ofrecer las ya elegidas (sin `excluir`)         → 50 / 1
//   B19. vuelve «Poner» a la frase                                            → 50 / 1
//   B20. con UNA etiqueta el paso cambia de forma (lleva `etiquetaIds`)        → 50 / 1
//   B21. el ejecutor corre una sola tanda con varias                          → 50 / 1
//   B22. una tanda que falla queda tapada (`some` en vez de `every`)          → 50 / 1
//   B23. el lienzo le pasa al editor sólo la primera                          → 50 / 1
// (La C3 de arriba —«el verbo con otro texto ("Agregar")»— es hoy lo pedido: el test lo exige.)
