// =============================================================================
// El micrófono del onboarding graba una nota de voz que se escucha antes de mandarla (20/10/2026)
// =============================================================================
// El Cerebro (feedback del 20/10): «antes de integrar el dictado en lugar de las notas de voz (6b0154a1d), probar que
// aguanta 2 minutos seguidos». No se pudo medir: Chrome con un micrófono falso (un WAV de 124 s) detecta la voz y no
// devuelve texto (cuatro intentos), y el dictado en vivo no se reanuda cuando Chrome cierra su sesión. El otro camino del
// mismo botón (/api/plan-dictado) usa las keys del negocio, que un cliente nuevo no tiene. Sin poder probarlo, se queda
// la nota de voz, que va por la ruta de Offer con la red de la plataforma (Florencia mandó 6 de 1 a 2 minutos): con la
// sesión de voz de la casa (se termina, se escucha, se manda; Martín, 09/10) y sin el verde de WhatsApp.
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-voz.json del scratchpad; base 3/0): OfferApp no le pasa la voz → 2/1 · el
// micrófono vuelve a dictar → 2/1 · la barra con el verde → 2/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('OfferApp le pasa al onboarding la nota de voz de Offer (con la que no salió), salvo con sólo texto', () => {
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(app, /voz=\{arranque\.manda \? null : \{\s*onAudio: mandarAudio, onError: setErrorChat,/);
  assert.match(app, /pendiente: audioEnEspera \? \{ url: audioEnEspera\.url, secs: audioEnEspera\.secs, onReenviar: reenviarAudio, onDescartar: descartarAudio \} : null,/);
});

test('con la voz, el micrófono GRABA con la sesión de la casa; sin ella, dicta como el Ops Center', () => {
  const caja = sinComentarios(leer('app/offer/CajaDelCentro.tsx'));
  assert.match(caja, /import \{ BarraGrabacion, useGrabacionVoz \} from '@\/app\/whatsapp\/_shared\/VoiceRecorder';/);
  assert.match(caja, /\{voz && !hayQueMandar \? \(\s*<button type="button" className="co-enviar co-enviar--mic" onClick=\{\(\) => void sesion\.start\(\)\}/);
  assert.match(caja, /<BotonMandar valor=\{texto\}/, 'sin la voz, el botón del Ops Center');
});

test('la barra de grabar va sin el verde de WhatsApp', () => {
  const caja = sinComentarios(leer('app/offer/CajaDelCentro.tsx'));
  assert.match(caja, /const SIN_VERDE = \{ '--good': 'var\(--ink\)' \} as CSSProperties;/);
  assert.match(caja, /<div className="co-caja__voz" style=\{SIN_VERDE\}>\s*<BarraGrabacion voz=\{sesion\}/);
});
