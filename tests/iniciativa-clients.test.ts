// =============================================================================
// MaKo toma la iniciativa en Clients: el primer cliente de la cartera (5/11/2026, T14 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «que MaKo te vaya guiando… dependiendo de la situación de la persona». Lo que se fija:
//   1. la apertura (lib/aperturas/clients.ts): con el servicio armado y la cartera vacía pregunta un HECHO, «¿Ya tienes clientes
//      en tu programa?»; «Todavía no» dice que el primero entra solo; sin servicio (lo pide el checklist) o con clientes, calla;
//   2. el montaje: «Sí, los cargo» abre la MISMA alta que el checklist (`setCreando('')`), la apertura va a la estrella y calla
//      con un cliente abierto, con el alta abierta o con la guía hablando; sin el estado de la tab, calla.
//
// Correr: node --import tsx --test tests/iniciativa-clients.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ID_CLIENTES, ID_PRIMERO, TODAVIA_NO, aperturaClients } from '../lib/aperturas/clients';
import { PREGUNTA_DE_ACCION, problemasDeApertura } from '../lib/aperturas/reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la apertura: con servicio y sin clientes pregunta un hecho; «Todavía no» dice que entra solo; si no, calla', () => {
  const a = aperturaClients({ servicio: true, clientes: false }, {})!;
  assert.equal(a.id, ID_CLIENTES);
  assert.equal(a.texto, '¿Ya tienes clientes en tu programa?');
  assert.doesNotMatch(a.texto, PREGUNTA_DE_ACCION);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), []);
  assert.deepEqual(a.botones[0], { tipo: 'hacer', rotulo: 'Sí, los cargo', accion: 'cargar' });
  const b = aperturaClients({ servicio: true, clientes: false }, { [ID_CLIENTES]: TODAVIA_NO })!;
  assert.equal(b.id, ID_PRIMERO);
  assert.equal(b.texto, 'Cuando cierres el primero, aparece aquí solo.');
  assert.deepEqual(problemasDeApertura(b, { primerPaso: false }), []);
  assert.equal(aperturaClients({ servicio: false, clientes: false }, {}), null, 'sin servicio: el checklist lo pide primero (el orden es una guarda)');
  assert.equal(aperturaClients({ servicio: true, clientes: true }, {}), null, 'ya tiene clientes');
});

test('2. el montaje: «Sí, los cargo» abre la misma alta, va a la estrella y calla con algo abierto; sin estado, calla', () => {
  const app = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));
  assert.match(app, /hechos: pasosOnb \? \{ servicio: pasosOnb\.cs_servicio, clientes: pasosOnb\.cs_clientes \} : null,/, 'sin el estado de la tab, null: calla');
  assert.match(app, /libre: abiertoId == null && creando == null && !guiaChat\.pregunta && !guiaChat\.senalando && !guiaChat\.esperando,/);
  assert.match(app, /acciones=\{\{ cargar: \(\) => setCreando\(''\) \}\}/, 'la misma alta que el checklist');
  assert.match(app, /onCargar=\{\(\) => setCreando\(''\)\}/, 'el checklist sigue abriendo la misma');
  assert.match(app, /<MakoEnLaTab tab="Clientes" apertura=\{aperturaTab\} entidad=/);
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 2/0):
//   · la apertura también sin servicio                         → 1/1 (1)
//   · la apertura no calla con un cliente abierto              → 1/1 (2)
