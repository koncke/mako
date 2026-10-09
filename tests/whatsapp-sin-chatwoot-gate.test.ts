// =============================================================================
// /whatsapp no puede volver a pedirle credenciales de Chatwoot a nadie
// =============================================================================
// Medido el 09/10/2026 en el ws11: con su número desvinculado, la tab entera era el
// formulario «WhatsApp se prende con esto — Conecta tu cuenta por Chatwoot…», sin
// ningún camino al QR. Chatwoot está apagado desde ese mismo día (lib/chatwoot.ts) y
// Martín: «los clientes lo necesitan usar y eso lo bloquea». La causa era doble: la
// page caía al PanelActivacion cuando no había canal vivo, y la activación de la tab
// declaraba `servicio: 'whatsapp'`, que son las credenciales de Chatwoot.
//
// Probado ROMPIÉNDOLO (sobre c09e16ad): devolviendo el `return <PanelActivacion tab={tabWa} />`
// a la page, 1 fallo y 2 pases; devolviendo `servicio: 'whatsapp'` a la activación, 1 fallo y
// 2 pases.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TABS_ACTIVACION } from '../lib/tab-activacion';

const leer = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario primero y los bloques después: el comentario de la page
// nombra el PanelActivacion para explicar por qué se fue.
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('la page de /whatsapp no dibuja el PanelActivacion (es el formulario de Chatwoot)', () => {
  const page = sinComentarios(leer('app/whatsapp/page.tsx'));
  assert.doesNotMatch(page, /PanelActivacion/, 'sin canal vivo se sirve la bandeja (con su QR), nunca el formulario de credenciales');
});

// El borrado de Chatwoot (tanda 1, 09/10/2026) sacó la entrada de WhatsApp de la activación
// —y de la API de MaKo—; el arreglo de urgencia de ese mismo día la había dejado sin
// `servicio`. Las dos formas son correctas: lo que no puede volver es una entrada que pida
// una credencial.
test('la activación de la tab WhatsApp no depende de ninguna credencial', () => {
  const wa = (TABS_ACTIVACION as Record<string, (typeof TABS_ACTIVACION)[string] | undefined>).whatsapp;
  if (!wa) return;
  assert.equal(wa.servicio, undefined, 'servicio "whatsapp" son las credenciales de Chatwoot, que se borró');
});

test('ningún texto de la activación de WhatsApp nombra Chatwoot', () => {
  const wa = (TABS_ACTIVACION as Record<string, (typeof TABS_ACTIVACION)[string] | undefined>).whatsapp;
  if (!wa) return;
  const textos = [wa.queFalta, wa.ademas ?? '', wa.eyebrow, ...wa.slides.flatMap((s) => [s.t, s.d])].join(' ');
  assert.doesNotMatch(textos, /chatwoot/i);
});
