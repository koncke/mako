// =============================================================================
// La guía de cada pestaña: lo que decide sin IA y lo que hace con cada toque (29/10/2026, G1 de docs/mako-iniciativa/guia.md)
// =============================================================================
// Martín (29/10): «cada vez que un usuario entra por primera vez a una tab, Mako le puede preguntar, hey, ¿quieres que te ayude a
// aprender a utilizar esta pestaña?… que no sea un tutorial predefinido con pasos». Lo que se fija:
//   1. la pregunta es la frase de Martín, con [Sí, enséñame ★], los objetivos y [Ya sé usarla]; cumple los topes de una apertura
//      (lib/aperturas/reglas.ts) y la excepción de la pregunta de acción es por su id;
//   2. lo «personalizado» sin IA: los hechos suben el objetivo que los resuelve, lo que no está en pantalla no se ofrece (salvo
//      con su `antes`);
//   3. cuándo pregunta: nunca sin saber si ya la vio, nunca antes de 1,2 s, nunca con un modal u otra cosa hablando;
//   4. el toque: en el ancla avanza, en el chat nada, en la tab pausa; y el estado (store.ts) recorre la pregunta, el objetivo,
//      «Listo. ¿Algo más?» y «Ya sé usarla».
//
// Correr: node --import tsx --test tests/guia-reglas.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver la cosecha (docs/hallazgos-ui.md).
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { problemasDeApertura } from '../lib/aperturas/reglas';
import { marcasDeVoseo } from '../lib/puestas-data';
import {
  ESPERA_PREGUNTA_MS, PREGUNTA_PRIMERA_VEZ, SI_ENSENAME, anclaASenalar, debePreguntar, listoAlgoMas, objetivosOfrecidos,
  preguntaDeLaGuia, preguntaDonde, preguntaQueHacer, queHacerConElToque,
} from '../lib/guia/reglas';
import { GUIA_OPS_CENTER } from '../app/second-brain/guia-ops-center';
import type { GuiaDeTab } from '../lib/guia/tipos';

const G = GUIA_OPS_CENTER as GuiaDeTab;
const todas = () => true;
const sin = (...faltan: string[]) => (id: string) => !faltan.includes(id);

test('1. la pregunta de la primera vez: la frase de Martín, sus botones, y los topes de una apertura', () => {
  const os = objetivosOfrecidos(G, { sinApp: true, sinIA: true }, todas);
  const a = preguntaDeLaGuia(G, os);
  assert.equal(a.texto, PREGUNTA_PRIMERA_VEZ);
  assert.equal(a.texto, '¿Quieres que te ayude a aprender a usar esta pestaña?', 'textual de Martín (29/10/2026)');
  assert.equal(a.id, 'guia:mako');
  assert.deepEqual(a.botones.map((b) => b.rotulo), [SI_ENSENAME, 'Empezar otro tema', 'Ver tus reportes', 'Ya sé usarla']);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), [], 'excepción por su id (guia:*), con su porqué en reglas.ts');
  for (const x of [a, preguntaQueHacer(G, os, true), preguntaDonde(G, todas), listoAlgoMas(G, os, 'conectar')]) {
    assert.deepEqual(problemasDeApertura(x, { primerPaso: false }), [], x.id);
    assert.deepEqual(marcasDeVoseo([x.texto, ...x.botones.map((b) => b.rotulo)].join(' ')), [], x.id);
  }
  // «Dónde está…»: de a 3, con «Otras» cuando hay más.
  const donde = preguntaDonde(G, todas);
  assert.ok(donde.botones.length <= 4);
  assert.ok(donde.botones.some((b) => b.rotulo === 'Otras'), 'hay más de 3 preguntas en el Ops Center');
});

test('2. lo personalizado sin IA: los hechos suben su objetivo, y lo que no está en pantalla no se ofrece', () => {
  // Sin la app: «Conectar tu IA» va primero, y «Pedirle algo» no se ofrece (la caja no escribe).
  assert.deepEqual(objetivosOfrecidos(G, { sinApp: true, sinIA: false }, todas).map((o) => o.id), ['conectar', 'otro-tema', 'reportes']);
  // Con la app y su IA: pedirle algo primero; conectar, no.
  assert.deepEqual(objetivosOfrecidos(G, { sinApp: false, sinIA: false }, todas).map((o) => o.id), ['pedir', 'otro-tema', 'reportes']);
  // Sin la Ticketera en pantalla (fuera del plan), «Ver tus reportes» no se ofrece.
  assert.ok(!objetivosOfrecidos(G, {}, sin('sb-ticketera')).some((o) => o.id === 'reportes'));
  // «Conectar» no está hasta tocar «Instalar MaKo» (su `antes`): se ofrece igual, y se señala primero el antes.
  const conectar = G.objetivos.find((o) => o.id === 'conectar')!;
  assert.ok(objetivosOfrecidos(G, { sinApp: true }, sin('mk-conectar')).some((o) => o.id === 'conectar'));
  assert.deepEqual(anclaASenalar(G, conectar.pasos[0], sin('mk-conectar')), { ancla: 'mk-instalar', antes: true });
  assert.deepEqual(anclaASenalar(G, conectar.pasos[0], todas), { ancla: 'mk-conectar', antes: false });
  assert.equal(anclaASenalar(G, conectar.pasos[0], sin('mk-conectar', 'mk-instalar')), null, 'ninguno: «No lo veo»');
});

test('3. cuándo pregunta: con lo visto sabido, la tab lista hace 1,2 s, y nada encima', () => {
  const base = { yaLaVio: false, listoHaceMs: ESPERA_PREGUNTA_MS, modalAbierto: false, otraHablando: false };
  assert.equal(debePreguntar(base), true);
  assert.equal(debePreguntar({ ...base, yaLaVio: null }), false, 'sin saber si ya la vio: aparecería un instante');
  assert.equal(debePreguntar({ ...base, yaLaVio: true }), false);
  assert.equal(debePreguntar({ ...base, listoHaceMs: ESPERA_PREGUNTA_MS - 1 }), false, 'que mire primero');
  assert.equal(debePreguntar({ ...base, listoHaceMs: null }), false);
  assert.equal(debePreguntar({ ...base, modalAbierto: true }), false);
  assert.equal(debePreguntar({ ...base, otraHablando: true }), false);
  assert.equal(debePreguntar({ ...base, onboardingPendiente: true }), false, 'su onboarding primero');
  assert.equal(debePreguntar({ ...base, soloComputadora: true, angosta: true }), false);
});

test('4. el toque, y el estado: pregunta → objetivo → «Listo. ¿Algo más?»; «Ya sé usarla» marca que sabe', async () => {
  assert.equal(queHacerConElToque({ enAncla: true, enChat: true, enGlobo: false }), 'avanza', 'el ancla adentro del chat también');
  assert.equal(queHacerConElToque({ enAncla: false, enChat: true, enGlobo: false }), 'nada', 'escribirle a MaKo no apaga la guía');
  assert.equal(queHacerConElToque({ enAncla: false, enChat: false, enGlobo: true }), 'nada');
  assert.equal(queHacerConElToque({ enAncla: false, enChat: false, enGlobo: false }), 'pausa', 'tocar la tab pausa (no termina)');

  const s = await import('../app/_ui/guia/store');
  s.fijarPresenciaParaPruebas(sin('mk-conectar'));
  s.registrarGuia(G, { sinApp: true, sinIA: true });
  assert.equal(s.guiaAhora().esperando, true, 'mientras decide, la escalera espera');
  const contestado: boolean[] = [];
  s.preguntarPrimeraVez((yaSabe) => contestado.push(yaSabe));
  const p = () => s.guiaAhora().dice!;
  assert.equal(p().id, 'guia:mako');
  // «Sí, enséñame»: el recomendado (Conectar tu IA), marcado como contestado, y el chat lo dice.
  // Como la pieza: el botón de lo que dice ahora.
  const elegir = (rotulo: string) => s.elegirEnLaGuia(p().botones.find((x) => x.rotulo === rotulo)!);
  elegir(SI_ENSENAME);
  assert.deepEqual(contestado, [false]);
  assert.equal(s.guiaAhora().objetivo?.o.id, 'conectar');
  assert.equal(s.guiaAhora().dice?.botones[0].rotulo, 'Salir', 'señalando, en el chat sólo «Salir»');
  s.avanzar();
  assert.equal(s.guiaAhora().objetivo, null);
  assert.equal(p().texto, 'Listo. ¿Algo más?');
  // Pausa y «Seguir».
  s.ofrecer('reportes');
  s.pausar();
  assert.equal(s.guiaAhora().pausado?.id, 'reportes');
  elegir('Seguir');
  assert.equal(s.guiaAhora().objetivo?.o.id, 'reportes');
  // La primera vez otra vez (otra tab): «Ya sé usarla» cierra y dice que sabe.
  s.cerrarGuia();
  s.preguntarPrimeraVez((yaSabe) => contestado.push(yaSabe));
  elegir('Ya sé usarla');
  assert.deepEqual(contestado, [false, true]);
  assert.equal(s.guiaAhora().dice, null);
  s.soltarGuia('mako');
  s.fijarPresenciaParaPruebas(null);
});

// PROBADO ROMPIÉNDOLO (29/10/2026, base 4/0):
//   · otra pregunta que la de Martín                → 3/1 (1)
//   · lo que aparece con su «antes» no se ofrece    → 2/2 (2, 4)
//   · pregunta sin saber si ya la vio               → 3/1 (3)
//   · escribirle a MaKo pausa la guía               → 3/1 (4)
