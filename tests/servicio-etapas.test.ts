// =============================================================================
// La clave de una etapa de entrega es la que apunta una secuencia
// =============================================================================
// `lib/servicio-etapas.ts` es el catálogo de las columnas del kanban de Customer
// Success. Tres cosas distintas van a guardar la CLAVE de una etapa: la fila de
// `cliente_entrega` (en qué columna está cada cliente), el disparador de una
// secuencia de mensajes (la sesión Chatbot engancha ahí) y el historial.
//
// Por eso la clave no es decoración:
//  · si se REUSA una clave borrada, los clientes que estaban en la etapa vieja
//    reaparecen dentro de la nueva, en una columna a la que nadie los movió;
//  · si `normalizarEtapas` devuelve una lista A MEDIAS con un jsonb roto, el
//    kanban dibuja menos columnas y los clientes de las que faltan no se ven —
//    y eso se lee como «no tengo clientes ahí», que es una afirmación falsa.
//
// Estos tests son la segunda capa de esas dos reglas. La primera es el comentario
// del módulo; sin esto, es una expresión de deseo.
//
// PROBADOS ROMPIÉNDOLOS (05/10/2026), con el bug real y no un typo:
//   · `nuevaClaveEtapa` devolviendo la raíz sin mirar `existentes` → 15 pass / 2 fail
//     («NUNCA devuelve una clave que ya existe» y «una clave borrada… tampoco se reusa»).
//   · `normalizarEtapas` haciendo `continue` en vez de `return null` ante una etapa
//     inválida → 15 pass / 2 fail («tira TODA la lista» y «claves repetidas»).
//   · `PREFIJO_CAMPO_ENTREGA` en vacío → 16 pass / 1 fail («ningún campo del CRM pasa
//     por entrega»): con el prefijo vacío, `startsWith('')` es true para TODO y la ficha
//     de Customer Success mostraría las líneas del CRM como movimientos de entrega.
//   · `campoEntrega` sin el respaldo `|| 'servicio'` → 16 pass / 1 fail.
//   · `fraseEntregaAlBorrar` tratando `null` como cero -> 19 pass / 1 fail («no pude
//     contar NO se dice como ninguno»): es el caso que hace apretar el boton.
//   · la misma frase sin el NUMERO -> 19 pass / 1 fail.
//   · `<= 0` cambiado por `=== 0`, o sea un negativo que se escribe -> 19 pass / 1 fail.
//   · `fraseSecuenciasHuerfanas` con el verbo cableado en plural -> 22 pass / 1 fail.
//     Es el bug REAL que se vio en pantalla: «1 secuencia... al guardar DEJAN».
//   · el plural sacado de la primera entrada en vez del total -> 22 pass / 1 fail.
//   · las etapas con 0 secuencias entrando a la frase -> 22 pass / 1 fail.
//   Restaurado: 23 pass / 0 fail.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ETAPAS_ENTREGA_DEFAULT, entregaPorDefecto, etapaInicial, etapaValida, etapaDe,
  nuevaClaveEtapa, colorNuevaEtapa, normalizarEtapas,
  campoEntrega, esCampoEntrega, PREFIJO_CAMPO_ENTREGA, fraseEntregaAlBorrar,
  fraseSecuenciasHuerfanas,
} from '../lib/servicio-etapas';

// ── El default existe y se declara como default ──────────────────────────────

test('un producto sin configurar igual tiene columnas, y dice que son el default', () => {
  const e = entregaPorDefecto(7);
  assert.equal(e.productoId, 7);
  assert.equal(e.origen, 'default');
  assert.ok(e.etapas.length >= 2, 'un tablero de una sola columna no es un tablero');
});

// ⚠️ Si esto se rompe, la pantalla no puede distinguir «no configuró» de
// «configuró algo igual al default», que es el síntoma que ya se pagó una vez con
// los funnels (tres productos nuevos indistinguibles del funnel del negocio).
test('el origen NO se deduce de que haya etapas', () => {
  const declarado = normalizarEtapas([{ key: 'onboarding', label: 'Onboarding' }]);
  assert.ok(declarado, 'una etapa válida tiene que normalizar');
  // `normalizarEtapas` devuelve etapas, nunca un origen: quien la llama decide.
  assert.ok(!('origen' in (declarado as object)));
});

test('las claves del default son únicas y usables', () => {
  const keys = ETAPAS_ENTREGA_DEFAULT.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length, 'hay claves repetidas en el default');
  for (const k of keys) assert.match(k, /^[a-z0-9_]+$/, `«${k}» no es una clave usable`);
});

// ── La clave nueva nunca pisa una existente ──────────────────────────────────

test('nuevaClaveEtapa deriva del rótulo y saca los acentos', () => {
  assert.equal(nuevaClaveEtapa('Diseño final', []), 'diseno_final');
  assert.equal(nuevaClaveEtapa('  Hito 3  ', []), 'hito_3');
});

test('nuevaClaveEtapa NUNCA devuelve una clave que ya existe', () => {
  assert.equal(nuevaClaveEtapa('Onboarding', ['onboarding']), 'onboarding_2');
  assert.equal(nuevaClaveEtapa('Onboarding', ['onboarding', 'onboarding_2']), 'onboarding_3');
});

// Una etapa BORRADA se sigue pasando en `existentes` justamente para que su clave
// no vuelva: las filas viejas de `cliente_entrega` todavía la nombran.
test('una clave borrada que se pasa como existente tampoco se reusa', () => {
  assert.notEqual(nuevaClaveEtapa('Hito 1', ['hito_1']), 'hito_1');
});

test('un rótulo sin letras ni números no produce una clave vacía', () => {
  const k = nuevaClaveEtapa('※ ※ ※', []);
  assert.match(k, /^[a-z0-9_]+$/);
  assert.ok(k.length > 0);
});

// ── normalizarEtapas falla CERRADO ───────────────────────────────────────────

test('lo que no es una lista con contenido es «no declarado»', () => {
  for (const raw of [null, undefined, {}, [], 'onboarding', 3]) {
    assert.equal(normalizarEtapas(raw), null, `${JSON.stringify(raw)} tendría que ser null`);
  }
});

test('una etapa sin clave usable tira TODA la lista, no sólo esa etapa', () => {
  assert.equal(normalizarEtapas([{ key: 'ok', label: 'A' }, { key: '', label: 'B' }]), null);
  assert.equal(normalizarEtapas([{ key: 'ok', label: 'A' }, { key: 'Con Mayúsculas', label: 'B' }]), null);
  assert.equal(normalizarEtapas([{ key: 'ok', label: 'A' }, { label: 'sin key' }]), null);
});

test('claves repetidas tiran la lista', () => {
  assert.equal(normalizarEtapas([{ key: 'a', label: 'A' }, { key: 'a', label: 'otra A' }]), null);
});

test('una etapa sin rótulo cae a su clave, no a vacío', () => {
  const e = normalizarEtapas([{ key: 'hito_1' }]);
  assert.equal(e?.[0]?.label, 'hito_1');
});

test('una etapa sin color igual sale con uno, y dos seguidas no salen iguales', () => {
  const e = normalizarEtapas([{ key: 'a' }, { key: 'b' }]);
  assert.ok(e?.[0]?.dot && e?.[1]?.dot);
  assert.notEqual(e?.[0]?.dot, e?.[1]?.dot);
});

test('colorNuevaEtapa nunca devuelve vacío, ni pasada la paleta', () => {
  for (const n of [0, 5, 9, 10, 37, 1000]) {
    const c = colorNuevaEtapa(n);
    assert.ok(c.tone && c.dot, `se quedó sin color en ${n}`);
  }
});

// ── Los buscadores ───────────────────────────────────────────────────────────

test('etapaInicial, etapaValida y etapaDe', () => {
  const e = [...ETAPAS_ENTREGA_DEFAULT];
  assert.equal(etapaInicial(e), e[0].key);
  assert.equal(etapaInicial([]), null);
  assert.equal(etapaValida(e, e[2].key), true);
  assert.equal(etapaValida(e, 'no_existe'), false);
  assert.equal(etapaValida(e, null), false);
  assert.equal(etapaDe(e, e[1].key)?.label, e[1].label);
  assert.equal(etapaDe(e, 'no_existe'), null);
});

// ── El rotulo del historial ───────────────────────────────────────────────────

// `lead_audit` solo tiene dos columnas de valor, asi que el producto viaja en el
// `campo`. Si el prefijo dejara de distinguir, la ficha de Customer Success
// mostraria TODAS las lineas del CRM como movimientos de entrega.
test('el campo del historial nombra el producto y se reconoce por su prefijo', () => {
  assert.equal(campoEntrega('Mentoria 90 dias'), `${PREFIJO_CAMPO_ENTREGA}Mentoria 90 dias`);
  assert.ok(esCampoEntrega(campoEntrega('Mentoria 90 dias')));
});

// Estos cuatro son campos REALES de lib/leads.ts (AUDIT_FIELDS). Ninguno puede
// contar como entrega: el sub-tab de la ficha filtra por esto.
test('ningun campo del CRM pasa por entrega', () => {
  for (const c of ['Etapa', 'Estado', 'Monto de cierre', 'Nutricion manual']) {
    assert.equal(esCampoEntrega(c), false, `${c} no es una entrega`);
  }
});

test('un producto sin nombre igual produce un campo legible', () => {
  assert.equal(campoEntrega('   '), `${PREFIJO_CAMPO_ENTREGA}servicio`);
  assert.ok(esCampoEntrega(campoEntrega('')));
});

// ── Lo que se pierde al borrar un producto ───────────────────────────────────

// Desde la mig 0188, borrar un producto se lleva por cascada su tablero de entrega y
// la etapa de cada cliente. La frase va adentro del `resumen` de `borrar_producto`
// (lib/api-mako/areas/negocio.run.ts), o sea el texto que alguien lee ANTES de
// confirmar algo irreversible.
test('la frase dice el NUMERO, que es lo que la vuelve una decision', () => {
  const una = fraseEntregaAlBorrar(1);
  assert.match(una, /\b1 cliente pierde su etapa\b/);
  const varias = fraseEntregaAlBorrar(14);
  assert.match(varias, /\b14 clientes pierden su etapa\b/);
  // La mitad que NO se pierde se nombra: sin eso el aviso suena a que se borra todo
  // rastro del cliente, y eso frenaria un borrado legitimo.
  for (const f of [una, varias]) assert.match(f, /historial/);
});

// ⚠️ EL CASO QUE IMPORTA. Un «0 clientes» sobre una consulta caida es la afirmacion
// que hace que se apriete el boton: `null` tiene que decir que no se pudo revisar.
test('«no pude contar» NO se dice como «ninguno»', () => {
  const f = fraseEntregaAlBorrar(null);
  assert.ok(f.trim().length > 0, 'un fallo de lectura no puede quedar mudo');
  assert.doesNotMatch(f, /\b0\b|ninguno|ningun/i, 'no puede afirmar que no hay nadie');
  assert.match(f, /no pude/i);
});

test('sin nadie en la entrega no se agrega un renglon', () => {
  assert.equal(fraseEntregaAlBorrar(0), '');
  // Un negativo no deberia llegar, y si llega no se escribe «-3 clientes pierden».
  assert.equal(fraseEntregaAlBorrar(-3), '');
});

// ── Las secuencias que quedan sin etapa ──────────────────────────────────────

// Es el aviso mas caro del editor: un cliente sin columna se puede volver a mover y el
// tablero lo muestra; una secuencia sin etapa deja de dispararse y no se ve en ningun lado.
test('con UNA secuencia el verbo concuerda', () => {
  const f = fraseSecuenciasHuerfanas([{ label: 'Hito 1', n: 1 }]);
  assert.match(f, /1 secuencia en Hito 1/);
  assert.match(f, /deja de dispararse/);
  assert.doesNotMatch(f, /dejan de dispararse/, 'un aviso que no concuerda se lee como texto automatico');
  assert.match(f, /Reapuntala|Reap\u00fantala/);
});

test('con VARIAS, el plural sale del TOTAL y no de cada entrada', () => {
  // Dos etapas con UNA cada una: cada entrada va en singular y el verbo en plural.
  const f = fraseSecuenciasHuerfanas([{ label: 'Hito 1', n: 1 }, { label: 'Hito 2', n: 1 }]);
  assert.match(f, /1 secuencia en Hito 1/);
  assert.match(f, /1 secuencia en Hito 2/);
  assert.match(f, /dejan de dispararse/);
  const g = fraseSecuenciasHuerfanas([{ label: 'Hito 1', n: 3 }]);
  assert.match(g, /3 secuencias en Hito 1/);
  assert.match(g, /dejan de dispararse/);
});

test('las etapas sin secuencias no entran a la frase', () => {
  assert.equal(fraseSecuenciasHuerfanas([]), '');
  assert.equal(fraseSecuenciasHuerfanas([{ label: 'Arranque', n: 0 }]), '');
  // Y una con 0 al lado de una con 2 no se nombra: decir «0 secuencias en Arranque»
  // es ruido adentro del unico renglon que tiene que frenar a alguien.
  const f = fraseSecuenciasHuerfanas([{ label: 'Arranque', n: 0 }, { label: 'Hito 1', n: 2 }]);
  assert.doesNotMatch(f, /Arranque/);
  assert.match(f, /2 secuencias en Hito 1/);
});

