// =============================================================================
// Un link que no abre se le dice a MaKo: nunca «vi tu Instagram» sin haberlo leído (20/10/2026)
// =============================================================================
// Florencia (ws21, sesión 14, 18/10): mandó el link de su Instagram, no se pudo leer (pide iniciar sesión) y el turno
// siguió igual; MaKo contestó «Perfecto, vi tu Instagram: ayudas a estudiantes con sus tesis», inferido del nombre de
// usuario. La guardia contó 2 lecturas pedidas y hay 1 documento. docs/hallazgos-onboarding.md, «Florencia (ws21, 18/10)».
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-link.json del scratchpad; base 4/0): la base pierde el campo → 3/1 · el
// prompt no lo marca → 3/1 · la ruta no lo guarda → 3/1 · la pantalla no lo manda → 3/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conversacionParaPrompt, sanearLinksSinLeer, sanearMensajes } from '../lib/offer-reglas';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const IG = 'https://www.instagram.com/una.cuenta/';

test('el mensaje del dueño guarda los links que no abrieron; sólo http(s) y sólo del dueño', () => {
  const [yo, mako] = sanearMensajes([
    { id: '1', de: 'yo', texto: `Mi Instagram: ${IG}`, at: '', linksSinLeer: [IG, 'javascript:alert(1)', 42] },
    { id: '2', de: 'mako', texto: 'Hola', at: '', linksSinLeer: [IG] },
  ]);
  assert.deepEqual(yo.linksSinLeer, [IG]);
  assert.equal('linksSinLeer' in mako, false);
  assert.deepEqual(sanearLinksSinLeer('no es una lista'), []);
});

test('el modelo lo lee marcado: no lo viste', () => {
  const texto = conversacionParaPrompt([{ de: 'yo', texto: `Mi Instagram: ${IG}`, linksSinLeer: [IG] }]);
  assert.match(texto, /NO se pudo abrir: https:\/\/www\.instagram\.com\/una\.cuenta\/; no lo viste/);
  assert.doesNotMatch(conversacionParaPrompt([{ de: 'yo', texto: 'Hola' }]), /NO se pudo abrir/);
});

test('la ruta guarda en el mensaje los que están en su texto', () => {
  const ruta = leer('app/api/offer/route.ts');
  assert.match(ruta, /const linksSinLeer = sanearLinksSinLeer\(body\.linksSinLeer\)\.filter\(\(u\) => texto\.includes\(u\)\);/);
  assert.match(ruta, /\.\.\.\(linksSinLeer\.length \? \{ linksSinLeer \} : \{\}\),/);
});

test('la pantalla manda los que fallaron al leerlos', () => {
  const app = leer('app/offer/OfferApp.tsx');
  assert.match(app, /avisoLink = mensajeDeError\(err\);\n\s*sinLeer\.push\(url\);/);
  assert.match(app, /\.\.\.\(sinLeer\.length \? \{ linksSinLeer: sinLeer \} : \{\}\),/);
});
