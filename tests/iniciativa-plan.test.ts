// =============================================================================
// MaKo toma la iniciativa en el Plan: el borrador del onboarding sin revisar (5/11/2026, T17 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «que MaKo te vaya guiando… dependiendo de la situación de la persona». Lo que se fija:
//   1. la apertura (lib/aperturas/plan.ts): con el borrador del plan pendiente pregunta un HECHO, «¿Tu equipo ya sabe qué hacer
//      esta semana?»; con «Todavía no», el link al borrador (/plan/revisar: nunca escribe tareas); con «Sí», sin borrador o a un
//      closer, calla. La clave es la del NEGOCIO (`negocio:plan`), la misma del paso 7 de la escalera del Ops Center;
//   2. useApertura suma las respuestas de `negocio:` a las de la superficie: contestado en el Ops Center, el Plan no repregunta;
//   3. el montaje: la página lee el borrador y mira que siga PENDIENTE (cualquier falla es null: calla); TodoBoard arma la apertura
//      (embebido no habla, y calla con la guía hablando) y BoardShell sólo la reenvía a la estrella.
//
// Correr: node --import tsx --test tests/iniciativa-plan.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ID_BORRADOR, ID_PLAN, TODAVIA_NO, YA_SABE, aperturaPlan } from '../lib/aperturas/plan';
import { PREFIJO_NEGOCIO, PREGUNTA_DE_ACCION, problemasDeApertura, respuestasDeMemoria } from '../lib/aperturas/reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const BORRADOR = { id: 'propq7wz2kx9m3a1c', n: 6 };

test('1. la apertura: pregunta un hecho, «Todavía no» lleva al borrador, y con «Sí», sin borrador o a un closer, calla', () => {
  const a = aperturaPlan({ borrador: BORRADOR, esAdmin: true }, {})!;
  assert.equal(a.id, ID_PLAN);
  assert.equal(ID_PLAN, 'negocio:plan', 'la MISMA clave del paso 7 de la escalera (plan.md §4)');
  assert.equal(a.texto, '¿Tu equipo ya sabe qué hacer esta semana?');
  assert.doesNotMatch(a.texto, PREGUNTA_DE_ACCION);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), []);
  assert.deepEqual(a.botones.map((b) => b.rotulo), ['Todavía no', 'Sí', 'Ahora no']);
  const b = aperturaPlan({ borrador: BORRADOR, esAdmin: true }, { [ID_PLAN]: TODAVIA_NO })!;
  assert.equal(b.id, ID_BORRADOR);
  assert.equal(b.texto, 'Te dejé un borrador con 6 tareas.');
  assert.deepEqual(problemasDeApertura(b, { primerPaso: false }), []);
  assert.deepEqual(b.botones[0], { tipo: 'ir', rotulo: 'Ver el borrador', href: `/plan/revisar/${BORRADOR.id}` }, 'se confirma en /plan/revisar (pasa por el Perro)');
  assert.ok(!b.botones.some((x) => x.tipo === 'hacer' || x.tipo === 'pedir'), 'MaKo no escribe tareas desde acá');
  assert.equal(aperturaPlan({ borrador: { ...BORRADOR, n: 1 }, esAdmin: true }, { [ID_PLAN]: TODAVIA_NO })!.texto, 'Te dejé un borrador con 1 tarea.');
  assert.equal(aperturaPlan({ borrador: BORRADOR, esAdmin: true }, { [ID_PLAN]: YA_SABE }), null, 'ya sabe');
  assert.equal(aperturaPlan({ borrador: null, esAdmin: true }, {}), null, 'sin borrador pendiente (o ya revisado)');
  assert.equal(aperturaPlan({ borrador: BORRADOR, esAdmin: false }, {}), null, 'un closer no confirma el plan del negocio');
  assert.equal(aperturaPlan({ borrador: { id: '../x?y', n: 6 }, esAdmin: true }, {}), null, 'un id raro no arma un link');
});

test('2. contestado en el Ops Center, el Plan no repregunta: useApertura suma las respuestas del negocio', () => {
  const memoria = { [ID_PLAN]: { d: 'respondida' as const, at: '2026-11-05T12:00:00.000Z', valor: TODAVIA_NO } };
  const r = { ...respuestasDeMemoria(memoria, PREFIJO_NEGOCIO), ...respuestasDeMemoria(memoria, 'plan') };
  assert.equal(aperturaPlan({ borrador: BORRADOR, esAdmin: true }, r)!.id, ID_BORRADOR, 'sigue desde el «Todavía no» de la escalera');
  const hook = sinComentarios(leer('app/_chat/AperturaMako.tsx'));
  assert.match(hook, /\{ \.\.\.respuestasDeMemoria\(memoria, PREFIJO_NEGOCIO\), \.\.\.respuestasDeMemoria\(memoria, superficie\.id\) \}/);
});

test('3. el montaje: la página mira que siga pendiente, TodoBoard arma la apertura y BoardShell la reenvía a la estrella', () => {
  const page = sinComentarios(leer('app/plan/page.tsx'));
  assert.match(page, /const b = \(await leerEstadoArranque\(\)\)\.planBorrador;/);
  assert.match(page, /return p\?\.estado === 'pendiente' \? \{ id: b\.id, n: b\.n \} : null;/, 'un borrador ya revisado no se ofrece');
  assert.match(page, /\} catch \{\n\s*return null;/, 'una lectura caída calla');
  assert.match(page, /apertura=\{demo \? null : \{ borrador, esAdmin: rol === 'admin' \}\}/);
  const board = sinComentarios(leer('app/plan/TodoBoard.tsx'));
  assert.match(board, /useApertura\(\{ superficie: SUPERFICIE_PLAN, hechos: embebido \? null : apertura, libre: !guiaChat\.pregunta && !guiaChat\.senalando && !guiaChat\.esperando \}\)/);
  assert.match(board, /<BoardShell board=\{board\} scope=\{scope\} aperturaMako=\{aperturaMako\}/);
  const shell = sinComentarios(leer('app/plan/board/BoardShell.tsx'));
  assert.match(shell, /\{!embebido && <MakoEnLaTab tab="Plan" apertura=\{aperturaMako\} entidad=\{entidadMako\} encimaDeModales \/>\}/);
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 3/0):
//   · «Todavía no» vuelve a preguntar en vez de dar el link              → 1/2 (1, 2)
//   · useApertura sin las respuestas de `negocio:` (sólo la superficie)  → 2/1 (2)
//   · la página ofrece el borrador sin mirar que siga pendiente          → 2/1 (3)
