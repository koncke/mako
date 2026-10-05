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
//   Y las FASES, cada una cazada por exactamente un test (30 pass / 1 fail las cinco):
//   · el color PROPIO ganando sobre el de la fase -> «el color de la FASE gana sobre el
//     propio». Es la rotura que hace que agrupar no se vea.
//   · la clave de fase sin su prefijo `f_` -> «la clave de una fase no puede chocar con la
//     de una etapa»: sin el prefijo, una etapa apunta a una fase por accidente.
//   · `normalizarFases` devolviendo media lista (un `continue` en vez del `return []`) ->
//     «vacio es LEGITIMO, roto se tira entero»: media lista deja etapas apuntando a una
//     fase que no se dibuja, o sea columnas con el color equivocado.
//   · el saneo de etapas comiendose el campo `fase` -> «`fase` sobrevive al saneo»: es el
//     mapper que borra un campo en el proximo guardado de cualquier otro.
//   · el huerfano repartido en la PRIMERA columna -> «el que apunta a una etapa borrada
//     sale APARTE».
//   Y el CONTEO, probado con las dos roturas que lo producen:
//   · `conteoDeEtapas` con su propio bucle en vez de delegar en `repartirEnEtapas` (o sea
//     sin la regla «sin fila, primera etapa») -> 32 pass / 1 fail.
//   · devolviendo solo las etapas que encontro, con las vacias AUSENTES en vez de en cero
//     -> 31 pass / 2 fail: `undefined` tiene que significar «no se pudo leer» y nada mas.
//   Restaurado: 33 pass / 0 fail.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ETAPAS_ENTREGA_DEFAULT, entregaPorDefecto, etapaInicial, etapaValida, etapaDe,
  nuevaClaveEtapa, colorNuevaEtapa, normalizarEtapas,
  campoEntrega, esCampoEntrega, PREFIJO_CAMPO_ENTREGA, fraseEntregaAlBorrar,
  fraseSecuenciasHuerfanas,
  colorDeEtapa, faseDe, etapasDeFase, nuevaClaveFase, normalizarFases, repartirEnEtapas,
  conteoDeEtapas,
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

// ── Las FASES ────────────────────────────────────────────────────────────────

const F = [{ key: 'f_cimientos', label: 'Cimientos', tone: 'info', dot: '#2F6DDB' }] as const;

// La fase existe para que varias columnas compartan color, que es lo que el CRM hace con
// Activo / Nutricion / Descartado. Si el color propio ganara, agrupar no se veria.
test('el color de la FASE gana sobre el propio', () => {
  const e = { key: 'a', label: 'A', tone: 'good', dot: '#AAAAAA', fase: 'f_cimientos' } as const;
  assert.equal(colorDeEtapa(e, F), '#2F6DDB');
});

// ⚠️ EL CASO QUE IMPORTA: el propio NO se pisa al asignar la fase, asi que sacarla de la
// fase le devuelve el suyo. Si se hubiera pisado, habria que inventarle un color.
test('sin fase, o con una que ya no existe, manda el color propio', () => {
  const sinFase = { key: 'a', label: 'A', tone: 'good', dot: '#AAAAAA' } as const;
  assert.equal(colorDeEtapa(sinFase, F), '#AAAAAA');
  const huerfana = { ...sinFase, fase: 'f_borrada' } as const;
  assert.equal(colorDeEtapa(huerfana, F), '#AAAAAA', 'una fase borrada no puede dejar la columna sin color');
  assert.equal(faseDe(F, 'f_borrada'), null);
  assert.equal(faseDe(F, null), null);
});

test('etapasDeFase: null es TODAS, y no un caso especial', () => {
  const es = [
    { key: 'a', label: 'A', tone: 'good', dot: '#1', fase: 'f_cimientos' },
    { key: 'b', label: 'B', tone: 'good', dot: '#2' },
  ] as const;
  assert.equal(etapasDeFase(es, null).length, 2);
  assert.deepEqual(etapasDeFase(es, 'f_cimientos').map((e) => e.key), ['a']);
  assert.deepEqual(etapasDeFase(es, 'f_nada').map((e) => e.key), []);
});

// Una fase y una etapa pueden llamarse igual. Sin prefijo compartirian clave, y una etapa
// terminaria apuntando a una fase por accidente.
test('la clave de una fase no puede chocar con la de una etapa', () => {
  const k = nuevaClaveFase('Cimientos', []);
  assert.match(k, /^f_/);
  assert.notEqual(k, nuevaClaveEtapa('Cimientos', []));
  // Y no se reusa, igual que la de etapa: la fase borrada se sigue pasando.
  assert.notEqual(nuevaClaveFase('Cimientos', [k]), k);
});

test('normalizarFases: vacio es LEGITIMO, roto se tira entero', () => {
  // No tener fases es el estado normal de un servicio.
  assert.deepEqual(normalizarFases(undefined), []);
  assert.deepEqual(normalizarFases([]), []);
  // Media lista dejaria etapas apuntando a una fase que no se dibuja.
  assert.deepEqual(normalizarFases([{ key: 'f_a', label: 'A' }, { key: 'sin-prefijo', label: 'B' }]), []);
  assert.deepEqual(normalizarFases([{ key: 'f_a', label: 'A' }, { key: 'f_a', label: 'otra' }]), []);
  const ok = normalizarFases([{ key: 'f_a', label: 'Cimientos' }]);
  assert.equal(ok.length, 1);
  assert.equal(ok[0].label, 'Cimientos');
  assert.ok(ok[0].dot, 'una fase sin color igual sale con uno');
});

// ⚠️ Un mapper que reconstruye campo por campo y se olvida uno lo BORRA en el proximo
// guardado de cualquier otro campo. Aca lo que se borraria es el color de la columna.
test('`fase` sobrevive al saneo de etapas', () => {
  const e = normalizarEtapas([{ key: 'a', label: 'A', fase: 'f_cimientos' }]);
  assert.equal(e?.[0]?.fase, 'f_cimientos');
  // Y una fase con una clave que no es de fase no entra: seria apuntar a cualquier cosa.
  const mala = normalizarEtapas([{ key: 'a', label: 'A', fase: 'cimientos' }]);
  assert.equal(mala?.[0]?.fase, undefined);
});

// ── El reparto, que es lo que hace que la tabla y el tablero cuenten lo mismo ─

test('un cliente sin etapa va a la PRIMERA columna', () => {
  const es = [...ETAPAS_ENTREGA_DEFAULT];
  const { porEtapa, huerfanos } = repartirEnEtapas(es, ['x', 'y', 'z'], () => null);
  assert.equal(porEtapa[es[0].key].length, 3);
  assert.equal(huerfanos.length, 0);
  for (const e of es.slice(1)) assert.deepEqual(porEtapa[e.key], [], 'las demas existen y estan vacias');
});

// Una etapa guardada que ya no esta en el catalogo NO se reparte: inventarle una columna
// seria afirmar algo que nadie decidio, y ademas la esconderia.
test('el que apunta a una etapa borrada sale APARTE, no en la primera', () => {
  const es = [...ETAPAS_ENTREGA_DEFAULT];
  const { porEtapa, huerfanos } = repartirEnEtapas(es, ['a'], () => 'etapa_que_no_existe');
  assert.deepEqual(huerfanos, ['a']);
  for (const e of es) assert.deepEqual(porEtapa[e.key], []);
});

// ── El conteo, que es lo que hace que sacar una columna sea una DECISION ─────

// ⚠️ EL CASO MEDIDO EN EL NAVEGADOR el 05/10/2026, con 8 clientes y 3 filas: el tablero
// dibujaba 5 tarjetas en la primera columna y el editor decia 0. La funcion estaba bien;
// lo que se le pasaba eran las FILAS de `cliente_entrega` y no los CLIENTES, y «un cliente
// sin fila esta en la primera etapa» es una regla derivada: a quien no aparece en la lista
// no hay de donde derivarsela. No es cosmetico — ese numero es lo que dispara el «¿seguro?»
// al sacar la columna, asi que con el 0 puesto se iba con cinco clientes adentro.
test('el conteo cuenta CLIENTES, no filas: el que no tiene fila esta en la primera', () => {
  const es = [...ETAPAS_ENTREGA_DEFAULT];
  const ultima = es[es.length - 1].key;
  // Ocho clientes; tres con fila (dos en la ultima etapa, uno en la segunda).
  const porCliente = [undefined, undefined, undefined, undefined, undefined,
    ultima, ultima, es[1].key];
  const bien = conteoDeEtapas(es, porCliente);
  assert.equal(bien[es[0].key], 5, 'los cinco sin fila van a la primera');
  assert.equal(bien[es[1].key], 1);
  assert.equal(bien[ultima], 2);
  assert.equal(Object.values(bien).reduce((a, b) => a + b, 0), 8, 'no se pierde ni se duplica nadie');

  // Y asi se veia el bug: pasando SOLO las filas, la primera columna da 0.
  const soloFilas = porCliente.filter((k) => k !== undefined);
  const mal = conteoDeEtapas(es, soloFilas);
  assert.equal(mal[es[0].key], 0, 'con las filas sueltas la primera da CERO: el bug medido');
});

// Una etapa sin nadie tiene que estar en el mapa Y en cero: `undefined` queda reservado
// para «no se pudo leer», que es la unica forma de distinguirlo de un cero de verdad.
test('todas las etapas entran al conteo, aunque esten vacias', () => {
  const es = [...ETAPAS_ENTREGA_DEFAULT];
  const c = conteoDeEtapas(es, []);
  for (const e of es) assert.equal(c[e.key], 0, e.key + ' tiene que estar en cero, no ausente');
  assert.equal(Object.keys(c).length, es.length);
  // Y una etapa que ya no esta en el catalogo NO suma a ninguna columna.
  const conHuerfano = conteoDeEtapas(es, ['etapa_que_no_existe']);
  assert.equal(Object.values(conHuerfano).reduce((a, b) => a + b, 0), 0);
});

