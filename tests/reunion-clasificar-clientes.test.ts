// =============================================================================
// Una llamada con alguien que tiene su propia cuenta de MaKo es de ENTREGA, no de ventas (20/10/2026)
// =============================================================================
// Las llamadas de feedback con Florencia (18/10, Fathom 864249059) y con Leila (19/10, 864249064) no dejaron ni una
// tarea en el Plan: el cron las descartó como «ventas» porque sus leads del CRM del ws9 decían prospecto («abierto»), y
// TIPOS_AL_PLAN (lib/reunion-auto.ts) sólo deja pasar 'equipo' y 'entrega'. Las dos tienen su cuenta:
//   · Leila: es usuaria del ws11 y su lead apunta a esa cuenta (`leads.cliente_ws`).
//   · Florencia: su cuenta (ws21, «mi marca personal: Florencia Ayelen Carballo») se abrió con OTRO correo, y su lead no
//     apuntaba a ella. Sólo el nombre completo la une.
// Los casos de abajo copian esas dos formas con correos de mentira.
//
// ⚠️ PROBADO ROMPIÉNDOLO (20/10/2026), una rotura por vez y vuelta atrás:
//   1. `clasificarReunion` sin mirar `esClienteMako` antes del lead ...................... 2 fallos
//   2. `esClienteMako` sin el correo de un usuario de otro workspace ...................... 1 fallo
//   3. `esClienteMako` sin `cliente_ws` ................................................... 1 fallo
//   4. `esClienteMako` sin el nombre completo dentro del nombre de un workspace ........... 1 fallo
//   5. `esClienteMako` aceptando un nombre de pila solo ................................... 1 fallo
//   6. `clientesMako` armándose también en el tablero de un cliente ....................... 1 fallo
//   7. `motivoDelTipo` sin la línea de la cuenta en MaKo ................................... 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clasificarReunion, motivoDelTipo, esClienteMako, type ClientesMako, type LeadDeReunion } from '../lib/reunion-clasificar';
import type { FathomMeeting } from '../lib/fathom-api';

const reunion = (invitado: string): FathomMeeting => ({
  recording_id: 1,
  calendar_invitees: [
    { name: 'Martin Carballo', email: 'dueno@mako.test', is_external: false },
    { name: invitado, email: invitado, is_external: true },
  ],
  recorded_by: { name: 'Martin Carballo', email: 'dueno@mako.test' },
} as unknown as FathomMeeting);

// El CRM del dueño: las dos clientas siguen como prospecto, igual que el 20/10.
const LEADS = new Map<string, LeadDeReunion>([
  ['flor.personal@mail.test', { estado_lead: 'abierto', nombre: 'Florencia Ayelen Carballo', cliente_ws: null }],
  ['hola@leila.test', { estado_lead: 'abierto', nombre: 'Leila Ejemplo', cliente_ws: 11 }],
  ['prospecto@mail.test', { estado_lead: 'abierto', nombre: 'Juan Pérez', cliente_ws: null }],
  ['solo.nombre@mail.test', { estado_lead: 'abierto', nombre: 'Florencia', cliente_ws: null }],
]);
const EQUIPO = new Set(['dueno@mako.test']);
// Quién tiene cuenta: los usuarios y los nombres de los OTROS workspaces (como los arma `clientesMako`).
const CLIENTES: ClientesMako = {
  emails: new Set(['hola@leila.test', 'cuenta.consultesis@mail.test']),
  nombres: ['mi marca personal florencia ayelen carballo', 'Leila Ejemplo'],
};

test('la clienta con cuenta abierta con OTRO correo: su llamada es de entrega, por el nombre completo', () => {
  assert.equal(clasificarReunion(reunion('flor.personal@mail.test'), LEADS, EQUIPO, CLIENTES), 'entrega');
  assert.match(motivoDelTipo(reunion('flor.personal@mail.test'), LEADS, EQUIPO, CLIENTES), /tiene su cuenta en MaKo: es una reunión de entrega/);
});

test('la clienta que es usuaria de su workspace, aunque el CRM diga prospecto: entrega', () => {
  assert.equal(clasificarReunion(reunion('hola@leila.test'), LEADS, EQUIPO, CLIENTES), 'entrega');
  // Por cada vía sola.
  assert.equal(esClienteMako('hola@leila.test', undefined, CLIENTES), true, 'el correo de un usuario de otro workspace');
  assert.equal(esClienteMako('otro@mail.test', { estado_lead: 'abierto', cliente_ws: 21 }, { emails: new Set(), nombres: [] }), true, 'el lead apunta a una cuenta');
});

test('un prospecto sin cuenta sigue siendo ventas, y un nombre de pila no alcanza', () => {
  assert.equal(clasificarReunion(reunion('prospecto@mail.test'), LEADS, EQUIPO, CLIENTES), 'ventas');
  assert.equal(clasificarReunion(reunion('solo.nombre@mail.test'), LEADS, EQUIPO, CLIENTES), 'ventas', '«Florencia» sola no es Florencia Ayelen Carballo');
  assert.match(motivoDelTipo(reunion('prospecto@mail.test'), LEADS, EQUIPO, CLIENTES), /prospecto/);
});

test('en el tablero de un cliente no hay lista de cuentas: un usuario de MaKo no es cliente suyo', () => {
  assert.equal(clasificarReunion(reunion('hola@leila.test'), LEADS, EQUIPO, null), 'ventas');
  const src = readFileSync(join(__dirname, '..', 'lib', 'plan-fathom.ts'), 'utf8');
  const fn = src.slice(src.indexOf('async function clientesMako'), src.indexOf('export async function listReunionesRecientes'));
  assert.match(fn, /if \(ws == null \|\| \(await getWorkspace\(ws\)\)\?\.capa !== 'superadmin'\) return null;/, 'la lista se arma sólo en el tablero del dueño');
  assert.match(src, /tipo: clasificarReunion\(m, leadsByEmail, equipoEmails, clientes\)/, 'el listado no le pasa la lista al clasificador');
  // Y el final de la cadena: lo que es 'entrega' entra al Plan.
  assert.match(readFileSync(join(__dirname, '..', 'lib', 'reunion-auto.ts'), 'utf8'), /TIPOS_AL_PLAN[^\n]*'entrega'/);
});
