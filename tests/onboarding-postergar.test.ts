// Dejar un paso PENDIENTE tiene que liberar el dashboard de verdad.
//
// EL CASO REAL: un cliente contestó nueve pantallas y quedó trabado en el paso de
// Meta, que se resuelve en la consola de Meta y no en MaKo. El wizard es bloqueante,
// así que esos NUEVE DÍAS tampoco pudo entrar a usar el resto de la app, que no
// dependía de Meta para nada. De los cuatro clientes reales, los dos que no terminaron
// el wizard murieron en un paso de conexión; ninguno en uno de contenido.
//
// Y lo que había no servía: el estado 'skipped' existía en el endpoint, la UI nunca lo
// mandaba, y aunque lo hubiera mandado `onboardingPendiente()` rebotaba igual. Tres
// piezas que por separado se leen completas y juntas no hacen nada — por eso los tests
// de acá cruzan las tres, y no cada una sola.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASOS_POSTERGABLES, esPostergable, POSTERGABLE_TXT, CAPAS } from '../lib/capas';
// Del CONTRATO, no de `onboarding-state`: aquél arrastra 'server-only' y no se puede
// importar desde un test. Es la razón por la que las reglas puras viven separadas.
import { estadoInicial, onboardingCompleto, pendientesDeOnboarding } from '../lib/onboarding-contrato';
import type { PasoOnboarding } from '../lib/capas';

const conPasos = (hechos: PasoOnboarding[] = [], postergados: PasoOnboarding[] = []) => {
  const s = estadoInicial('in_progress');
  for (const p of hechos) s.steps[p].done = true;
  for (const p of postergados) s.steps[p].postergado = true;
  return s;
};

test('la lista de postergables está clavada: agrandarla es una decisión, no un descuido', () => {
  // Si este test falla, no lo "arregles" sumando el paso acá. El criterio es que el
  // paso se cierre en un sistema de AFUERA y que nada río abajo lo consuma.
  assert.deepEqual([...PASOS_POSTERGABLES], ['integraciones', 'tabs']);
});

test('`gemini` NO es postergable: seis pasos posteriores lo consumen', () => {
  // Postergarlo no deja seguir: deja llegar a la próxima pantalla y romper ahí, con
  // "no hay IA", que es peor que frenar en el paso con el motivo escrito.
  assert.equal(esPostergable('gemini'), false);
  // Y los de contenido tampoco: el cliente los puede contestar ahora mismo.
  for (const p of ['archivero', 'avatares', 'entregable', 'angulos', 'fase', 'negocio']) {
    assert.equal(esPostergable(p), false, `${p} no debería ser postergable`);
  }
});

test('esPostergable rechaza cualquier cosa que no esté en el catálogo', () => {
  for (const v of ['', 'inventado', null, undefined, 42, {}]) {
    assert.equal(esPostergable(v), false);
  }
});

test('todo paso postergable sabe decir qué le falta y dónde se resuelve', () => {
  // El compilador ya lo exige (POSTERGABLE_TXT es un Record del union), pero un texto
  // vacío pasaría el tipo y dejaría el recordatorio de /general en blanco.
  for (const p of PASOS_POSTERGABLES) {
    const t = POSTERGABLE_TXT[p];
    assert.ok(t.que.trim().length > 3, `${p}: sin frase`);
    assert.ok(t.ruta.startsWith('/'), `${p}: la ruta tiene que ser absoluta`);
  }
});

// ── Cerrar el wizard ────────────────────────────────────────────────────────────

test('postergar el ÚLTIMO paso de la capa CIERRA el onboarding', () => {
  // Ésta es la regresión que traía el `paso === ultimo` viejo: preguntaba "¿cerraste el
  // último?" en vez de "¿están todos cerrados?". Mientras el único camino fue avanzar
  // hasta el final las dos coincidían; con una salida en el medio dejan de coincidir, y
  // quien postergara el último se quedaba `in_progress` para siempre — o sea, la salida
  // lo dejaba encerrado igual, que es exactamente el bug que vino a arreglar.
  const pasos: PasoOnboarding[] = ['fase', 'gemini', 'integraciones'];
  const s = conPasos(['fase', 'gemini'], ['integraciones']);
  assert.equal(onboardingCompleto(s, pasos), true);
});

test('un paso NO postergado y NO hecho deja el onboarding abierto', () => {
  const pasos: PasoOnboarding[] = ['fase', 'gemini', 'integraciones'];
  assert.equal(onboardingCompleto(conPasos(['fase'], ['integraciones']), pasos), false);
});

test('postergar uno del MEDIO no cierra nada por sí solo', () => {
  const pasos: PasoOnboarding[] = ['fase', 'tabs', 'integraciones', 'retro'];
  const s = conPasos(['fase'], ['tabs']);
  assert.equal(onboardingCompleto(s, pasos), false);
  s.steps.integraciones.postergado = true;
  s.steps.retro.done = true;
  assert.equal(onboardingCompleto(s, pasos), true);
});

test('una capa sin pasos nunca cuenta como completa por vacuidad', () => {
  // `[].every(...)` es true, y sin el guard de largo un workspace sin wizard entraría
  // acá como "terminado". No rompe hoy porque `onboardingPendiente` corta antes, pero
  // es la clase de verdad-por-vacío que se vuelve un bug cuando cambia el que llama.
  assert.equal(onboardingCompleto(conPasos(), []), false);
});

test('las capas reales cierran cuando se completan todos sus pasos', () => {
  for (const capa of Object.values(CAPAS)) {
    if (capa.onboarding.length === 0) continue;
    assert.equal(onboardingCompleto(conPasos(capa.onboarding), capa.onboarding), true, capa.id);
  }
});

// ── El recordatorio ─────────────────────────────────────────────────────────────

test('el recordatorio se apaga solo cuando el cliente lo resuelve por su cuenta', () => {
  // LO IMPORTANTE DE TODO ESTO. Conectar Meta desde /integraciones tres días después
  // tiene que apagar el aviso sin que nadie vuelva a marcar nada: el flag `postergado`
  // sigue puesto y el pendiente ya no aparece. Un flag que hay que acordarse de bajar a
  // mano es el que dentro de un mes le pide a alguien algo que ya hizo.
  const pasos: PasoOnboarding[] = ['fase', 'integraciones'];
  const s = conPasos(['fase'], ['integraciones']);
  assert.deepEqual(pendientesDeOnboarding(s, pasos, () => true), ['integraciones']);
  assert.deepEqual(pendientesDeOnboarding(s, pasos, () => false), []);
});

test('no se le recuerda nada a quien todavía no postergó', () => {
  // Sin mirar el flag, esto le pintaría el aviso a cualquiera que aún no llegó al paso
  // — incluido el que está a mitad del wizard.
  const pasos: PasoOnboarding[] = ['fase', 'integraciones'];
  assert.deepEqual(pendientesDeOnboarding(conPasos(['fase']), pasos, () => true), []);
});

test('resolverlo de verdad (done) gana sobre el flag de postergado', () => {
  const pasos: PasoOnboarding[] = ['integraciones'];
  const s = conPasos(['integraciones'], ['integraciones']);
  assert.deepEqual(pendientesDeOnboarding(s, pasos, () => true), []);
});
