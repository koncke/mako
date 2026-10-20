// =============================================================================
// Un mensaje escrito más largo que el chat va como documento de la conversación, sin 413 (20/10/2026)
// =============================================================================
// Florencia (ws21, llamada del 18/10, Fathom 864249059): pegó el texto que había armado con ChatGPT, 21.629 caracteres,
// y rebotó con «Súbelo como documento»; tardó 12 minutos en armar un .docx. Martín [00:18:00]: «que no tenga límite de
// largo el mensaje». El audio largo ya iba a documento (`repartirTranscripcion`); el texto, no. docs/hallazgos-onboarding.md.
//
// ROTURAS (20/10/2026, arnés romper.js + roturas-largo.json del scratchpad; base 3/0): la ruta vuelve a rebotar → 2/1 ·
// la pantalla vuelve a cortar → 2/1 · el reparto corta el texto en vez de guardarlo entero → 2/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NOMBRE_DOC_TEXTO_LARGO, repartirTextoLargo } from '../lib/offer-reglas';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const OPTS = { tope: 12_000, topeDoc: 300_000, docsLibres: 3 };

test('21.629 caracteres: el mensaje lleva el principio y el documento, el texto ENTERO', () => {
  const texto = `Mi oferta: ${'acompañamiento de tesis por Meet, '.repeat(700)}`.slice(0, 21_629);
  const r = repartirTextoLargo(texto, OPTS);
  assert.ok(r?.doc, 'no rebota: va como documento');
  assert.equal(r.doc.texto, texto, 'el documento es el texto entero');
  assert.equal(r.doc.chars, 21_629);
  assert.ok(r.cuerpo.length < 12_000);
  assert.match(r.cuerpo, new RegExp(`sigue entero en el documento «${NOMBRE_DOC_TEXTO_LARGO}»`));
  assert.deepEqual(repartirTextoLargo('corto', OPTS), { cuerpo: 'corto', doc: null });
  assert.equal(repartirTextoLargo(texto, { ...OPTS, docsLibres: 0 }), null, 'sin lugar para otro documento se dice, no se corta callado');
});

test('la ruta ya no rebota un texto largo: lo guarda como documento y lo lee por partes si hace falta', () => {
  const ruta = sinComentarios(leer('app/api/offer/route.ts'));
  assert.doesNotMatch(ruta, /if \(texto\.length > TOPE_MENSAJE\) return no\(413/);
  assert.match(ruta, /: repartirTextoLargo\(texto, \{ tope: TOPE_MENSAJE, topeDoc: TOPE_TEXTO_DOC, docsLibres: MAX_DOCS_SESION - f\.documentos\.length \}\);/);
  assert.match(ruta, /await leerPorPartes\(texto, NOMBRE_DOC_TEXTO_LARGO, inicio\)/);
});

test('la pantalla (escritorio y teléfono) ya no lo corta antes de mandarlo', () => {
  for (const f of ['app/offer/OfferApp.tsx', 'app/m/offer/OfferM.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /texto\.length > TOPE_MENSAJE/, `${f} sigue cortando el mensaje largo`);
  }
});
