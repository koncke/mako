// =============================================================================
// MaKo toma la iniciativa en el Calendario: la apertura de la estrella y la guía (5/11/2026, T9 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «que MaKo te vaya guiando… dependiendo de la situación de la persona» y «cada vez que un usuario entra por
// primera vez a una tab… ¿quieres que te ayude a aprender a utilizar esta pestaña?». Lo que se fija:
//   1. la apertura (lib/aperturas/calendario.ts): con Google conectado y la primera semana sin estrenar pregunta un HECHO, «¿Tienes
//      alguna llamada esta semana?»; sin Google NO suma nada (ya salta el modal de conectar) y con el estado sin leer, calla;
//   2. el montaje: «Sí, tengo una» abre el alta de una llamada (la misma del «+» de Ventas), la apertura va a la estrella y calla
//      con algo abierto; la página le pasa el estado de la tab, o null si no se pudo leer;
//   3. la guía (app/calendario/guia-calendario.ts): sus anclas en la barra y en la leyenda, y espera al onboarding de la tab.
//
// Correr: node --import tsx --test tests/iniciativa-calendario.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aperturaCalendario } from '../lib/aperturas/calendario';
import { PREGUNTA_DE_ACCION, problemasDeApertura } from '../lib/aperturas/reglas';
import { GUIA_CALENDARIO } from '../app/calendario/guia-calendario';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la apertura: con Google y la semana sin estrenar; sin Google no suma nada; sin saber, calla', () => {
  const a = aperturaCalendario({ google: true, semanaPendiente: true }, {})!;
  assert.equal(a.id, 'calendario:semana');
  assert.match(a.texto, /¿Tienes alguna llamada esta semana\?$/);
  assert.doesNotMatch(a.texto, PREGUNTA_DE_ACCION);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), []);
  assert.deepEqual(a.botones[0], { tipo: 'hacer', rotulo: 'Sí, tengo una', accion: 'agendar' });
  assert.equal(aperturaCalendario({ google: false, semanaPendiente: true }, {}), null, 'sin Google ya salta el modal: dos guías al entrar no');
  assert.equal(aperturaCalendario({ google: null, semanaPendiente: true }, {}), null);
  assert.equal(aperturaCalendario({ google: true, semanaPendiente: false }, {}), null, 'ya estrenó la semana');
  assert.equal(aperturaCalendario({ google: true, semanaPendiente: null }, {}), null, 'el estado no se pudo leer');
});

test('2. el montaje: «Sí» abre el alta de una llamada, va a la estrella y calla con algo abierto; la página pasa el estado', () => {
  const app = sinComentarios(leer('app/calendario/CalendarioApp.tsx'));
  assert.match(app, /acciones=\{\{ agendar: \(\) => crear\('llamada'\) \}\}/, 'la misma alta que el «+» de Ventas');
  assert.match(app, /libre: abierto == null && !integracion\.abierto && !guiaChat\.pregunta && !guiaChat\.senalando && !guiaChat\.esperando,/);
  assert.match(app, /hechos: inicio \? \{ google: google != null, semanaPendiente: inicio\.semanaPendiente \} : null,/);
  assert.match(app, /<MakoEnLaTab tab="Calendario" apertura=\{aperturaTab\} entidad=/);
  const page = sinComentarios(leer('app/calendario/page.tsx'));
  assert.match(page, /inicio=\{estado \? \{ semanaPendiente: !estado\.steps\.cal_semana\?\.done, onboardingPendiente: estado\.status !== 'done' \} : null\}/,
    'con el estado sin leer, null: MaKo calla y la guía espera');
});

test('3. la guía: sus anclas marcadas, y espera al onboarding de la tab', () => {
  const app = sinComentarios(leer('app/calendario/CalendarioApp.tsx'));
  for (const a of GUIA_CALENDARIO.anclas) assert.match(app, new RegExp(`ancla\\('${a.id}'\\)`), a.id);
  assert.match(app, /useGuiaDeLaTab\('calendario', \{ listo: true, onboardingPendiente: inicio == null \|\| inicio\.onboardingPendiente \}\);/);
  assert.deepEqual(GUIA_CALENDARIO.objetivos.map((o) => o.id), ['llamada', 'filtrar', 'moverse']);
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 3/0):
//   · la apertura también sin Google                         → 2/1 (1)
//   · «Sí, tengo una» abre una publicación                   → 2/1 (2)
//   · la guía no espera al onboarding (onboardingPendiente)  → 2/1 (3)
