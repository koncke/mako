// =============================================================================
// «WhatsApp» en el CRM abre el chat ADENTRO de MaKo, no WhatsApp Web (25/10/2026, f15)
// =============================================================================
// Martín en la llamada con Leandro (Fathom, 24/10, 26:25), textual: «Eso es un error, ahí si apretás el botón de WhatsApp
// debería llevarte al chat dentro de Maco.» Hoy abría wa.me (WhatsApp Web) desde cuatro lugares: el clic derecho de una
// tarjeta, el botón de la fila de la lista, la vista rápida de la tarjeta y el «⋯» de la ficha. Van a la conversación del
// lead en Chats (`rutaChatsDeLead`, la misma de la ficha del teléfono), con el router de la casa, que lleva el `?ws=`.
// PROBADO ROMPIÉNDOLO: ver el pie.
// Correr: node --import tsx --test tests/crm-whatsapp-en-mako.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rutaChatsDeLead } from '../lib/chats-links';

const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la conversación del lead en Chats', () => {
  assert.equal(rutaChatsDeLead(3445), '/chats?lead=3445');
});

test('el tablero: el clic derecho, la fila y la vista rápida van a Chats', () => {
  const b = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.doesNotMatch(b, /wa\.me|waDe\(/, 'el tablero vuelve a abrir WhatsApp Web');
  assert.match(b, /case 'whatsapp': if \(l\) router\.push\(rutaChatsDeLead\(l\.id\)\); return;/, 'el clic derecho');
  assert.match(b, /<Link href=\{rutaChatsDeLead\(l\.id\)\}\s+onClick=\{\(ev\) => ev\.stopPropagation\(\)\}/, 'el botón de la fila (sin abrir la ficha)');
  assert.match(b, /\{ texto: 'WhatsApp', onClick: \(\) => \{ cerrar\(\); router\.push\(rutaChatsDeLead\(l\.id\)\); \} \}/, 'la vista rápida');
  assert.match(b, /import Link, \{ useRouter, useWs \} from '@\/app\/_ui\/Link';/, 'el Link de la casa (lleva el ?ws=)');
});

test('la ficha: el «⋯» también', () => {
  const f = sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'));
  assert.doesNotMatch(f, /wa\.me/);
  assert.match(f, /case 'whatsapp': router\.push\(rutaChatsDeLead\(lead\.id\)\); return;/);
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 3 / 0, de a una y restaurando de una copia:
//   · el botón de la fila de vuelta a `<a href="https://wa.me/…" target="_blank">`              → 2 / 1
//   · el «⋯» de la ficha de vuelta a `window.open('https://wa.me/…')`                           → 2 / 1
