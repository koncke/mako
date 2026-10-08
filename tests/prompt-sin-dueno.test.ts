// =============================================================================
// Los encuadres de MaKo no le ponen dueño al negocio de un cliente.
// =============================================================================
// EL CASO (08/10/2026). El system del doer de TODO cliente llevaba «chat general del
// dashboard del negocio de Martín» (MAKO_CTX_GENERAL_DEFAULT), y MaKo le contestó «Mira,
// Martín…» a un cliente inmobiliario en su propio grupo de WhatsApp. No es una fuga de
// datos: es otro dueño para el negocio del cliente, dicho por la herramienta que paga.
// Nadie tenía el prompt editado (medido en producción ese día), así que el default del
// código era el que leían todos.
//
// Probado rompiéndolo (08/10/2026): devolverle «de Martín» al encuadre general tumba este
// test (1 fallo, 0 pases).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAKO_CTX_GENERAL_DEFAULT, MAKO_CTX_CHART_DEFAULT, MAKO_CTX_WHATSAPP_DEFAULT } from '../lib/prompt-defaults';

test('los encuadres que lee el MaKo de todo cliente no nombran a ninguna persona', () => {
  const encuadres = { MAKO_CTX_GENERAL_DEFAULT, MAKO_CTX_CHART_DEFAULT, MAKO_CTX_WHATSAPP_DEFAULT };
  for (const [nombre, texto] of Object.entries(encuadres)) {
    assert.doesNotMatch(texto, /mart[ií]n|mauricio|leila|joan/i, `${nombre} le pone dueño al negocio de un cliente`);
  }
});
