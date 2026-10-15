// =============================================================================
// El prompt que le pedía al modelo inventar tareas
// =============================================================================
// 12/8/2026, medido contra la transcripción real de «Mau <> Martin: CUSTOMER SUCCESS»
// (2h35, 28 compromisos reales, leídos a mano). MaKo devolvió 37 tarjetas: 17 aciertos,
// 8 repeticiones y **12 invenciones**, diez de ellas concentradas en la primera hora —
// el tramo donde repasan un CRM en vivo y casi todo lo que «hay que arreglar» se arregla
// mientras hablan.
//
// El prompt no las toleraba: las PEDÍA. Dos frases, en dos lugares distintos:
//   · «Si de una reunión larga te salen menos de 15, es que te quedaste corto.»
//   · «Si te sale la lista vacía, releé: seguro te comiste alguno.»
// Con la transcripción troceada en siete partes, eso son SIETE órdenes de llegar a un
// número. Y la lista de «qué NO es una tarea» tenía tres viñetas y ninguna cubría los
// casos que inventó: lo ya hecho en la reunión, la demo, el estado, la meta sin paso.
//
// ⚠️ Estos tests leen el ARCHIVO como texto porque `lib/plan-fathom.ts` es `server-only`
// y no se puede importar desde acá. Es el mismo camino que usa
// `scripts/sync-contrato-detalle.mjs`. No prueban que el modelo acierte —eso necesita
// red y plata— sino que las instrucciones que lo empujaban a inventar no vuelvan.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOLDE_DETALLE, PARTES_DETALLE } from '../lib/detalle-contrato';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(RAIZ, 'lib', 'plan-fathom.ts'), 'utf8');

test('EL PEDIDO DE INVENTAR: no vuelve ningún piso de cantidad de tareas', () => {
  // Cualquier forma de «tienen que salirte al menos N». Con siete tramos, un piso por
  // tramo multiplica la presión por siete y el modelo la cumple: 19 tarjetas sobre un
  // tramo con 11 compromisos reales.
  for (const rx of [
    /menos de \d+, es que te quedaste corto/i,
    /si te sale la lista vacía, releé/i,
    /seguro te comiste alguno/i,
  ]) {
    assert.doesNotMatch(SRC, rx, `volvió una orden de llegar a un número: ${rx}`);
  }
});

test('…y se dice explícitamente que la lista vacía es una respuesta válida', () => {
  // No alcanza con sacar la presión: hay que autorizar el cero, porque un tramo de
  // demo o de diagnóstico legítimamente no deja ningún próximo paso.
  assert.match(SRC, /NO hay un número que tengas que alcanzar/);
  assert.match(SRC, /lista vacía sin culpa/);
});

test('«qué NO es una tarea» cubre los cuatro casos que se inventaron de verdad', () => {
  // Cada uno sale de una invención real de esa reunión. Sin el caso escrito, el modelo
  // no tiene con qué descartarlo: la lista de exclusiones pesa tanto como la de inclusión.
  for (const [caso, rx] of [
    ['ya se hizo en la misma reunión', /YA HECHO EN LA REUNIÓN/],
    ['le está mostrando cómo se usa', /LO QUE SE ESTÁ MOSTRANDO/],
    ['es el estado de algo, no una acción', /ESTADO, no acción/],
    ['una meta sin paso ejecutable', /METAS Y DIRECCIONES sin paso ejecutable/],
  ] as const) {
    assert.match(SRC, rx, `falta el caso: ${caso}`);
  }
});

test('EL MOLDE DEL DETALLE SE INYECTA, no se copia: había DOS y se contradecían', () => {
  // El prompt inyectaba `MOLDE_DETALLE` («Qué hay que hacer») en el JSON shape y además
  // escribía a mano otro molde («Qué pidió») en el bloque del detalle, en el MISMO
  // archivo. Resultado medido: ws1 salió 100% «Qué pidió» y ws9 30 de 37 «Qué hay que
  // hacer», o sea el formato del detalle era una moneda al aire. Es «Una cosa, un lugar»
  // roto adentro de un solo archivo.
  assert.match(SRC, /\{\{molde\}\}/, 'el bloque del detalle tiene que inyectar el molde');
  assert.match(SRC, /molde: MOLDE_DETALLE/, 'y el render tiene que pasarlo');
  assert.doesNotMatch(SRC, /^\*\*Qué pidió\*\*/m, 'volvió la copia a mano del molde');
  // Y los títulos del ejemplo son los del contrato, no otros.
  for (const p of PARTES_DETALLE) assert.ok(MOLDE_DETALLE.includes(p), `el molde perdió «${p}»`);
});

test('LA ATRIBUCIÓN: están las tres pruebas que faltaban', () => {
  // Las tres salen del mismo caso: «si no TE responde, cancelá la llamada con Yolanda»,
  // que MaKo le puso al dueño porque él la pronunció. En una consultoría el que habla
  // casi nunca es el que hace.
  assert.match(SRC, /LA PRUEBA DEL PRONOMBRE/, 'falta la prueba del pronombre');
  assert.match(SRC, /GANA EL PRONOMBRE/, 'la prueba tiene que decir qué gana ante la duda');
  assert.match(SRC, /LA PROMESA GANA/, 'falta la regla del pedido + promesa');
  assert.match(SRC, /SU ROL EN ESTA REUNIÓN/, 'falta declararle el rol del dueño');
});

test('el rol se declara con los TRES valores, y el default es «no lo sé»', () => {
  // Inventar una etiqueta es peor que no darla: el prompt asumía «asesorado» siempre, y
  // esa es su regla más fuerte empujando para el lado equivocado media reunión.
  for (const v of ['consultor / proveedor', 'cliente / asesorado', 'no lo sé']) {
    assert.ok(SRC.includes(v), `el prompt no explica el valor «${v}»`);
  }
  assert.match(SRC, /rol: opts\.rolDelDueno \|\| ROL_DESCONOCIDO/, 'el default tiene que ser «no lo sé»');
});

test('«dichoPor» deja de ser una regla sin consecuencia: el parser lo lee', () => {
  // El prompt lo pedía desde siempre y `coerceCandidatas` lo tiraba, así que el campo que
  // existe para OBLIGAR a separar «quién habló» de «quién ejecuta» no obligaba a nada.
  // Desde el 15/10/2026 pasa por `rotuloDePersona` (un rol inventado no queda): sigue LEÍDO.
  assert.match(SRC, /dichoPor: rotuloDePersona\(String\(o\.dichoPor/, 'el parser sigue descartando dichoPor');
  assert.match(SRC, /dichoPor\?: string;/, 'dichoPor no está en el tipo');
});

test('la fusión ya no tiene PROHIBIDO juntar dos versiones con dueños distintos', () => {
  // Había un `continue` mudo: cuando dos tramos sacaban la misma acción con dueños
  // distintos, el sistema GARANTIZABA que sobrevivieran las dos. Caso real: la
  // cancelación de la llamada con Yolanda salió dos veces, una a nombre de cada uno, y
  // el Perro terminó pidiéndole al dueño un deadline sobre la que no era suya.
  assert.doesNotMatch(SRC, /continue; \/\/ nunca mezclar dueños/, 'volvió el continue mudo');
  assert.match(SRC, /dueñosDistintos/, 'la discrepancia tiene que quedar declarada');
  assert.match(SRC, /atribucionDudosa: f\.dueñosDistintos/, 'y tiene que viajar a la tarjeta');
});

test('el dedup ve el DUEÑO y suficiente detalle para decidir', () => {
  // Se le pedía agrupar repetidas con 140 caracteres y sin el dueño — o sea sin el
  // contexto para distinguir «actualizar el plan del curso» de «…con el feedback de
  // Mauricio», y sin el campo que después bloqueaba la fusión río abajo.
  assert.match(SRC, /\[\$\{t\.dueño \|\| 'sin dueño'\}\]/, 'el dedup no ve el dueño');
  assert.doesNotMatch(SRC, /t\.detalle\.slice\(0, 140\)/, 'volvió el recorte de 140 caracteres');
});

test('una lectura PARCIAL no se cachea, no se cierra y no se anuncia como entera', () => {
  const auto = readFileSync(resolve(RAIZ, 'lib', 'reunion-auto.ts'), 'utf8');
  // Los tres candados eran incondicionales, con un `console.warn` al lado. Con 2 de 7
  // tramos caídos: el resultado mutilado quedaba en el caché para siempre, la reunión
  // se marcaba como vista y nunca se reintentaba, y el WhatsApp decía «saqué N tareas»
  // con el mismo tono que si la hubiera leído entera.
  assert.match(auto, /if \(tareas\.length && !parcial\)/, 'el caché vuelve a guardar lecturas parciales');
  assert.match(auto, /if \(!parcial\) \{\s*\n\s*await setSetting\(KEY_VISTA/, 'la reunión vuelve a cerrarse leída a medias');
  assert.match(auto, /const cojas = hechas\.filter/, 'el aviso no distingue una lectura parcial de una entera');
});
