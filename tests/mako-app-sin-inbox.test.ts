// =============================================================================
// Lo que dice MaKo al dejar algo para revisar no nombra Inbox: sale también en escritorio
// =============================================================================
// Estaba en docs/relevo/crm.md («Lo que quedó sin hacer», 12/10/2026): MENSAJE_BORRADOR_APP y
// mensajeLeadApp (lib/mako-turno-app-reglas.ts) decían «confírmalo en Inbox», y el mismo turno
// corre en la ficha de escritorio (MaKo Analyst, lib/mako-analyst-lead.ts), donde Inbox no
// existe: ahí lo que se revisa es el botón «Abrir para revisar», debajo del mensaje.
//
// Correr: npx tsx --test tests/mako-app-sin-inbox.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026): volver a «en Inbox» en el borrador → 1 pase / 1 fallo;
// en la ficha del lead → 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENSAJE_BORRADOR_APP, mensajeLeadApp } from '../lib/mako-turno-app-reglas';

test('el borrador no manda a Inbox', () => {
  assert.doesNotMatch(MENSAJE_BORRADOR_APP, /Inbox/);
  assert.match(MENSAJE_BORRADOR_APP, /Todavía no está cargado/, 'tiene que seguir diciendo que no está cargado');
});

test('la ficha del lead tampoco', () => {
  const m = mensajeLeadApp('Ana');
  assert.doesNotMatch(m, /Inbox/);
  assert.match(m, /Todavía no está cargada/);
});
