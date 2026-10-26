// =============================================================================
// Clasificar reunión por email (punto 10): ventas / entrega / equipo / otra
// =============================================================================
// La regla que pidió Martín: cada reunión se clasifica por el email del invitado
// externo contra el CRM y el equipo. Sirve para 3 cosas — traer pocas, auto-cargar
// al plan, y que el Perro FRENE cargar una llamada de ventas como tareas.
//
// El lead MANDA sobre el usuario: si el contraparte está en el CRM es una llamada
// de negocio (venta/entrega) aunque además sea del equipo; solo si NO es lead pero
// SÍ usuario del workspace es 'equipo'.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clasificarReunion } from '../lib/reunion-clasificar';
import type { FathomMeeting } from '../lib/fathom-api';
import { deFathom } from '../lib/grabadores/reunion';

// Una reunión de Fathom de verdad, por el traductor a la forma común (lib/grabadores/reunion.ts): el clasificador lee ésa.
const meet = (emails: string[]) =>
  deFathom({ recording_id: 1, calendar_invitees: emails.map((email) => ({ email, is_external: true })) } as FathomMeeting);

const leads = (m: Record<string, string | null>) =>
  new Map(Object.entries(m).map(([e, estado]) => [e, { estado_lead: estado }]));

test('lead ganado → entrega (customer success)', () => {
  assert.equal(clasificarReunion(meet(['cliente@x.com']), leads({ 'cliente@x.com': 'ganado' }), new Set()), 'entrega');
});

test('lead abierto (en pipeline R1/R2) → ventas', () => {
  assert.equal(clasificarReunion(meet(['prospecto@x.com']), leads({ 'prospecto@x.com': 'abierto' }), new Set()), 'ventas');
});

test('usuario del workspace, no lead → equipo', () => {
  assert.equal(clasificarReunion(meet(['mentor@equipo.com']), leads({}), new Set(['mentor@equipo.com'])), 'equipo');
});

test('sin match → otra', () => {
  assert.equal(clasificarReunion(meet(['random@nadie.com']), leads({}), new Set()), 'otra');
});

test('el lead manda sobre el equipo (contraparte de negocio que además es del equipo)', () => {
  const r = clasificarReunion(meet(['doble@x.com']), leads({ 'doble@x.com': 'ganado' }), new Set(['doble@x.com']));
  assert.equal(r, 'entrega', 'si está en el CRM es negocio, aunque también sea del equipo');
});

test('varios invitados: gana el primer lead que matchea', () => {
  const r = clasificarReunion(
    meet(['mentor@equipo.com', 'prospecto@x.com']),
    leads({ 'prospecto@x.com': 'perdido' }),
    new Set(['mentor@equipo.com']),
  );
  assert.equal(r, 'ventas', 'aunque haya un email de equipo, el lead lo hace de negocio');
});

test('emails se comparan en minúscula (los invitados vienen normalizados)', () => {
  // externalInviteeEmails ya baja a minúscula; el mapa de leads también.
  assert.equal(clasificarReunion(meet(['Cliente@X.com']), leads({ 'cliente@x.com': 'ganado' }), new Set()), 'entrega');
});

test('sin invitados externos → otra', () => {
  assert.equal(clasificarReunion(deFathom({ recording_id: 1, calendar_invitees: [] } as FathomMeeting), leads({}), new Set()), 'otra');
});
