// =============================================================================
// Mientras graba, se tiene que ver sin duda (22/10/2026, la llamada con Mauricio, O10, min 56:01-56:27)
// =============================================================================
// Mauricio grabó una nota de voz en Offer: «¿está grabando? No», y borró y repitió dos veces. La barra decía lo mismo
// grabando que sin grabar: mientras el navegador abría el micrófono, un punto gris, 0:00 y la onda quieta; ya grabando,
// una onda que se movía SOLA, hablara o no. La barra es UNA (app/whatsapp/_shared/VoiceRecorder.tsx → BarraGrabacion) y
// la montan los tres lugares: WhatsApp, Automations y Offer.
//   1. el nivel del micrófono (`nivelDeMuestras`): el silencio no mueve la onda y una voz sí;
//   2. la barra mientras abre el micrófono LO DICE; grabando, el punto rojo late y la onda sigue la voz;
//   3. la sesión entrega el micrófono que se graba (`flujo`) sólo mientras graba de verdad;
//   4. los tres lugares montan esa barra, y nadie más dibuja su punto;
//   5. el ✓ del onboarding de Offer se ve en oscuro (`--sobre-good`).
//
// Correr: node --import tsx --test tests/mic-grabando.test.ts
// PROBADO ROMPIÉNDOLO (base 5/0), ver el pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarraGrabacion, ESTADO_VOZ_INICIAL, crearSesionVoz, nivelDeMuestras, type EstadoVoz, type GrabacionVoz } from '../app/whatsapp/_shared/VoiceRecorder';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el nivel del micrófono: el silencio y el ruido casi no mueven la onda, una voz sí, y nunca pasa de 1', () => {
  const de = (amp: number) => Array.from({ length: 512 }, (_, i) => 128 + Math.round(amp * Math.sin(i / 3)));
  assert.equal(nivelDeMuestras(de(0)), 0, 'silencio');
  assert.equal(nivelDeMuestras([]), 0);
  assert.ok(nivelDeMuestras(de(1)) < 0.25, `el ruido de fondo llena la barra: ${nivelDeMuestras(de(1))}`);
  const voz = nivelDeMuestras(de(20));
  assert.ok(voz > 0.45 && voz < 0.9, `una voz normal tiene que llenar media barra: ${voz}`);
  assert.equal(nivelDeMuestras(de(127)), 1, 'un grito, la barra entera');
});

const voz = (e: Partial<EstadoVoz>, flujo?: () => MediaStream | null): GrabacionVoz => ({
  ...ESTADO_VOZ_INICIAL, ...e, flujo,
  start: async () => {}, revisarExistente: async () => {}, terminar: () => {}, seguir: async () => {}, enviar: async () => {}, descartar: () => {}, pause: () => {}, resume: () => {},
});

test('2. la barra: mientras abre el micrófono LO DICE; grabando, el punto rojo late y la onda sigue la voz', () => {
  const abriendo = renderToStaticMarkup(createElement(BarraGrabacion, { voz: voz({ fase: 'grabando', pidiendoMic: true }) }));
  assert.match(abriendo, /data-abriendo-mic[^>]*>Abriendo el micrófono…</, 'mientras abre, con palabras');
  assert.doesNotMatch(abriendo, /<span data-punto-rec|>0:00<|<div[^>]*data-onda/, 'el punto gris, el 0:00 y la onda quieta se leían «no está grabando»');
  assert.match(abriendo, /aria-label="Abriendo el micrófono"/);

  const grabando = renderToStaticMarkup(createElement(BarraGrabacion, { voz: voz({ fase: 'grabando', secs: 4 }, () => null) }));
  assert.match(grabando, /<span data-punto-rec="true" style="[^"]*animation:mako-latido/, 'el punto rojo LATE');
  assert.match(grabando, /0:04/, 'el tiempo corriendo');
  assert.match(grabando, /aria-label="Grabando"/);
  // Con el micrófono a mano, las barras las mueve la voz (no la animación que se movía sola).
  assert.match(grabando, /data-barra="true" style="[^"]*transform:scaleY\(0\.12\)/);
  assert.doesNotMatch(grabando, /animation:mako-wave/, 'con micrófono, la onda no se mueve sola');
  // Sin micrófono que escuchar (una barra armada a mano), la de siempre.
  assert.match(renderToStaticMarkup(createElement(BarraGrabacion, { voz: voz({ fase: 'grabando' }) })), /animation:mako-wave/);

  const pausa = renderToStaticMarkup(createElement(BarraGrabacion, { voz: voz({ fase: 'grabando', paused: true }, () => null) }));
  assert.match(pausa, /<span data-punto-rec="true" style="[^"]*animation:none/, 'en pausa el punto no late');
  assert.match(pausa, /aria-label="Grabación en pausa"/);
  assert.match(leer('app/whatsapp/_shared/composer-icons.tsx'), /@keyframes mako-latido\{/);
});

class RecFalso {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() { this.state = 'recording'; }
  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    setTimeout(() => { this.ondataavailable?.({ data: new Blob(['x']) }); this.onstop?.(); }, 5);
  }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
}

test('3. la sesión entrega el micrófono SÓLO mientras graba: ni pidiéndolo, ni escuchando, ni después de tirarlo', async () => {
  const pedidos: Array<() => void> = [];
  const mic = { getTracks: () => [{ stop: () => {} }] } as unknown as MediaStream;
  const s = crearSesionVoz(() => {}, {
    pedirMicrofono: () => new Promise<MediaStream>((res) => { pedidos.push(() => res(mic)); }),
    crearRecorder: () => new RecFalso() as unknown as MediaRecorder,
    unir: async (bs) => new Blob(bs), crearUrl: (b) => `blob:${b.size}`, soltarUrl: () => {},
  });
  try {
    const p = s.start(() => {});
    assert.equal(s.flujo(), null, 'mientras el navegador lo pide, no hay micrófono que escuchar');
    pedidos.shift()!(); await p;
    assert.equal(s.flujo(), mic, 'grabando, la onda escucha ESE micrófono');
    s.terminar(); await new Promise((r) => setTimeout(r, 25));
    assert.equal(s.flujo(), null, 'escuchando lo grabado, no hay micrófono');
    const p2 = s.seguir(); pedidos.shift()!(); await p2;
    assert.equal(s.flujo(), mic, 'otro tramo, otra vez');
    s.descartar();
    assert.equal(s.flujo(), null);
  } finally { s.soltar(); }
  // Y el hook se lo pasa a la barra.
  assert.match(sinComentarios(leer('app/whatsapp/_shared/VoiceRecorder.tsx')), /pause: sesion\.pause, resume: sesion\.resume, flujo: sesion\.flujo,/);
  assert.match(sinComentarios(leer('app/whatsapp/_shared/VoiceRecorder.tsx')), /<OndaGrabando paused=\{voz\.paused \|\| cerrando\} flujo=\{voz\.flujo\} \/>/);
});

test('4. WhatsApp, Automations y Offer graban con ESA barra, y ninguno dibuja su propio punto', () => {
  // La barra de WhatsApp (el composer) y la caja única montan la barra de la casa.
  assert.match(sinComentarios(leer('app/whatsapp/_shared/ComposerWhatsApp.tsx')), /<BarraGrabacion voz=\{voz\}/);
  assert.match(sinComentarios(leer('app/_chat/CajaChat.tsx')), /<BarraGrabacion voz=\{grabacion\}/);
  const lugares: Array<[string, RegExp]> = [
    ['app/whatsapp/_shared/ChatHilo.tsx', /<ComposerWhatsApp\b/],          // WhatsApp: el hilo de un chat
    ['app/whatsapp/EmpresaInbox.tsx', /<ComposerWhatsApp\b/],              // WhatsApp: la bandeja
    ['app/automations/EditorMensajeWhatsApp.tsx', /<ComposerWhatsApp\b/], // Automations: el mensaje del lienzo
    ['app/automations/GrabadorAudioPaso.tsx', /<BarraGrabacion voz=\{voz\}/],
    ['app/automations/PasoAudioControl.tsx', /<BarraGrabacion voz=\{voz\}/],
    // Offer, la tab y el onboarding (22/10/2026, OF4): la caja única, que dibuja ChatOffer con la nota de voz que arma OfferApp.
    ['app/offer/ChatOffer.tsx', /<CajaChat \{\.\.\.caja\} \/>/],
    ['app/offer/OfferApp.tsx', /const caja: PropsCajaChat = \{[\s\S]{0,700}voz: sinAdjuntos \? undefined : \{/],
    ['app/m/offer/ComposerOfferM.tsx', /<CajaChat [\s\S]{0,600}voz=\{\{/],   // Offer: el teléfono
  ];
  for (const [f, re] of lugares) assert.match(sinComentarios(leer(f)), re, f);
  for (const [f] of lugares) assert.doesNotMatch(leer(f), /#e53935|mako-blink|mako-latido/, `${f}: dibuja su propio punto de grabando`);
});

test('5. el ✓ y la ➤ de la barra se leen sobre el color que les toque (el onboarding de Offer en oscuro)', () => {
  assert.match(leer('app/whatsapp/_shared/VoiceRecorder.tsx'), /background: 'var\(--good\)', color: 'var\(--sobre-good, #fff\)'/);
  // Desde el 22/10/2026 (OF4) la caja de Offer la dibuja ChatOffer, para la tab y el onboarding.
  assert.match(leer('app/offer/ChatOffer.tsx'), /const SIN_VERDE = \{ '--good': 'var\(--ink\)', '--sobre-good': 'var\(--surface\)' \} as CSSProperties;/);
  assert.match(leer('app/offer/ChatOffer.tsx'), /<div key=\{sesion\.id\} className="co-caja-wrap" style=\{SIN_VERDE\}>/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 5/0):
//   · `nivelDeMuestras` sin la raíz (el RMS crudo: una voz normal no llega a un cuarto de barra)  → 4/1 (1)
//   · la barra pidiendo el micrófono con el punto gris y el 0:00 de antes                         → 4/1 (2)
//   · el punto con el parpadeo de antes en lugar del latido                                       → 4/1 (2)
//   · `flujo` de la sesión sin mirar `pidiendoMic`                                                 → 4/1 (3)
//   · OfferApp con un punto rojo propio                                                            → 4/1 (4)
//   · SIN_VERDE sin `--sobre-good`                                                                 → 4/1 (5)
