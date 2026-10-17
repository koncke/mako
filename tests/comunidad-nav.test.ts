// =============================================================================
// comunidad-nav — el ítem «Comunidad» de la barra, su página y su onboarding
// =============================================================================
// La página pide `requireCapa('customer-success')` (no tiene capa propia) y la barra filtra por la key
// del ítem (`cs-comunidad`): si alguna capa las separa, el destino se esconde donde la página abre (o
// al revés). Es el mismo test que fija el Curso (tests/curso-admin.test.ts), para el ítem nuevo.
// Y el onboarding de la tab: sus pasos en el orden del catálogo (el orden es una guarda de
// `marcarPasoTab`) y qué dato cierra cada uno.
//
// Verificado ROMPIÉNDOLO: ver el bloque «ROTURAS» al final (números medidos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIAS, TODOS_LOS_ITEMS, itemsDe } from '../app/_components/nav';
import { NOMBRES_ICONO } from '../app/_components/icons';
import { CAPAS, tabEnCapa, type CapaId } from '../lib/capas';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { PASOS_COMUNIDAD, TAB_COMUNIDAD, cambiosDeOnboarding, lineaOnboarding, pasosDeLosDatos } from '../app/customer-success/comunidad/onboarding-comunidad';

// Desde el 17/10/2026 Community es una sub-tab de Clients (/clients/community): no es fila de la barra, pero su key sigue
// en nav.ts (SIN_FILA) porque la pantalla del teléfono la pide. Se busca entre TODOS los ítems.
const todos = TODOS_LOS_ITEMS;
const item = todos.find((i) => i.key === 'cs-comunidad');

// Desde el 17/10/2026 Customer Success dejó de ser familia: «Clients» es UNA tab de Operate (/clients) con sus sub-tabs
// adentro de la pantalla (docs/diseno-clients.md), y Community es una de ellas.
test('«Community» (key cs-comunidad) es una sub-tab de Clients, y Clients es la fila de Operate', () => {
  assert.ok(item, 'falta el ítem cs-comunidad');
  assert.equal(item.label, 'Community');
  assert.equal(item.href, '/clients/community');
  assert.ok(NOMBRES_ICONO.includes(item.icon), `el ícono «${item.icon}» no existe: dibujaría un punto`);
  assert.ok(!FAMILIAS.flatMap(itemsDe).some((i) => i.key === 'cs-comunidad'), 'Community volvió a ser una fila de la barra');
  const clients = FAMILIAS.find((f) => f.key === 'operate')?.bloques.flat().find((i) => i.key === 'customer-success');
  assert.equal(clients?.href, '/clients', 'Clients no está en Operate');
});

test('se enciende sólo en su ruta: ni Clientes ni Curso se encienden ahí, ni ella en las de ellos', () => {
  const clientes = todos.find((i) => i.key === 'customer-success')!;
  const curso = todos.find((i) => i.key === 'cs-curso')!;
  assert.equal(item!.match('/clients/community'), true);
  assert.equal(item!.match('/customer-success/comunidad'), true, 'la ruta vieja (redirige) no se reconoce');
  assert.equal(item!.match('/clients'), false);
  assert.equal(item!.match('/clients/classroom'), false);
  // La fila de la barra es Clients: se enciende en todas sus sub-tabs.
  assert.equal(clientes.match('/clients/community'), true, 'en Community la barra no marca Clients');
  assert.equal(curso.match('/clients/community'), false);
  const keys = todos.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length, 'hay keys de ítem repetidas en la barra');
});

test('se ve en la barra en cada capa donde la página deja entrar', () => {
  for (const capa of Object.keys(CAPAS) as CapaId[]) {
    assert.equal(tabEnCapa('cs-comunidad', capa), tabEnCapa('customer-success', capa), `capa ${capa}`);
  }
});

test('la página pide la capa de Customer Success', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'app', 'customer-success', 'comunidad', 'pantalla.tsx'), 'utf8')
    .replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(src, /await requireCapa\('customer-success'\);/);
});

// ── El onboarding de la tab ──────────────────────────────────────────────────────

test('el catálogo tiene la tab con los pasos EN EL MISMO ORDEN que la regla', () => {
  const def = TAB_ONBOARDINGS[TAB_COMUNIDAD];
  assert.ok(def, 'falta cs-comunidad en el catálogo de onboardings');
  assert.equal(def.key, TAB_COMUNIDAD);
  assert.equal(def.href, '/clients/community');
  assert.deepEqual(def.pasos.map((p) => p.key), [...PASOS_COMUNIDAD]);
  assert.deepEqual(def.pasos.filter((p) => !p.opcional).map((p) => p.key), ['comunidad_post'], 'el único obligatorio es el primer post');
});

test('qué dato cierra cada paso; «no pude leer» no es «no hay»', () => {
  assert.deepEqual(pasosDeLosDatos({ categorias: 2, posts: 0, participacion: null }),
    { comunidad_categorias: true, comunidad_post: false, comunidad_alumnos: null });
});

test('lo anotado se pone al día con los datos: sólo marca, nunca desmarca', () => {
  assert.deepEqual(cambiosDeOnboarding({}, { categorias: 1, posts: 3, participacion: 1 }).map((c) => c.paso),
    ['comunidad_categorias', 'comunidad_post', 'comunidad_alumnos']);
  assert.deepEqual(cambiosDeOnboarding({ comunidad_post: { done: true } }, { categorias: 0, posts: 0, participacion: null }), [],
    'borrar el último post no le devuelve la lista a quien ya la usa');
  assert.deepEqual(cambiosDeOnboarding({}, { categorias: null, posts: null, participacion: null }), []);
});

test('la línea del onboarding se va con el primer post (los opcionales no la sostienen)', () => {
  assert.equal(lineaOnboarding(null), null, 'sin lo anotado no se dibuja');
  assert.equal(lineaOnboarding({ comunidad_post: { done: true } }), null);
  assert.deepEqual(lineaOnboarding({ comunidad_categorias: { done: true } }),
    { comunidad_categorias: true, comunidad_post: false, comunidad_alumnos: false });
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (arnés del scratchpad, restaura de memoria), contra este archivo de 8 tests:
//   · PASOS_COMUNIDAD desordenado                          → 2 fallos, 6 pases.
//   · cambiosDeOnboarding marcando lo que el dato niega     → 1 fallo, 7 pases.
//   · la línea del onboarding que no se va con el post      → 1 fallo, 7 pases.
//   · la página pidiendo otra capa                          → 1 fallo, 7 pases.
// ⚠️ NO se rompieron app/_components/nav.ts ni lib/tab-onboarding-catalogo.ts: los comparten otras
//    sesiones sobre el mismo clon, y escribirles encima aunque sea dos segundos puede pisar una edición
//    ajena. Lo que fija el ítem lo cubren los asserts de arriba sobre los valores reales.
