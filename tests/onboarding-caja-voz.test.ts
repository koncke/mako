// =============================================================================
// El micrófono del onboarding graba una nota de voz que se escucha antes de mandarla (20/10 → 21/10/2026)
// =============================================================================
// El Cerebro (feedback del 20/10): «antes de integrar el dictado en lugar de las notas de voz (6b0154a1d), probar que
// aguanta 2 minutos seguidos». No se pudo medir: Chrome con un micrófono falso (un WAV de 124 s) detecta la voz y no
// devuelve texto (cuatro intentos), y el dictado en vivo no se reanuda cuando Chrome cierra su sesión. El otro camino del
// mismo botón (/api/plan-dictado) usa las keys del negocio, que un cliente nuevo no tiene. Sin poder probarlo, se queda
// la nota de voz, que va por la ruta de Offer con la red de la plataforma (Florencia mandó 6 de 1 a 2 minutos): con la
// sesión de voz de la casa (se termina, se escucha, se manda; Martín, 09/10) y sin el verde de WhatsApp.
// Desde el 21/10 la graba la caja ÚNICA (app/_chat/CajaChat.tsx → `voz`; su test es tests/chat-unico.test.ts, 5): acá se
// fija que el onboarding se la pase.
//
// ROTURAS (21/10/2026, romper.js + roturas-caja-unica.json, con onboarding-caja-centro; base 7/0): OfferApp no le pasa la
// voz → 6/1 · la barra con el verde → 5/2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('OfferApp le pasa a la caja la nota de voz de Offer (con la que no salió), salvo con sólo texto', () => {
  // Desde el 22/10/2026 (OF4) la caja es la misma para la tab y el onboarding: OfferApp arma sus props y ChatOffer la dibuja.
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(app, /const sinAdjuntos = !!arranque\?\.manda;/);
  assert.match(app, /voz: sinAdjuntos \? undefined : \{\s*onAudio: mandarAudio, onError: setErrorChat, rotuloEnviar: 'Enviar audio',/);
  assert.match(app, /pendiente: audioEnEspera \? \{ url: audioEnEspera\.url, secs: audioEnEspera\.secs, onBorrar: descartarAudio, onDejar: reenviarAudio \} : null,/);
});

test('la barra de grabar va sin el verde de WhatsApp', () => {
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  // Y el ícono del ✓ y la ➤ con el color que se lee encima de la tinta (22/10/2026: en oscuro iba blanco sobre casi blanco).
  assert.match(chat, /const SIN_VERDE = \{ '--good': 'var\(--ink\)', '--sobre-good': 'var\(--surface\)' \} as CSSProperties;/);
  assert.match(chat, /className="co-caja-wrap" style=\{SIN_VERDE\}/);
});
