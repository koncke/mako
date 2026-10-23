// =============================================================================
// ¿La página se deja mostrar ADENTRO de MaKo? (lib/landing-marco.ts, 23/10/2026)
// =============================================================================
// El recuadro del Diagnóstico cae a la página REAL cuando el documento aislado no pinta. Con
// `X-Frame-Options` o `frame-ancestors` eso se ve en blanco, y el aviso decía «se muestra la página
// real». Estos casos son las reglas del navegador: frame-ancestors manda sobre X-Frame-Options, cada
// política cuenta, `*.dominio` no incluye al dominio pelado, ALLOW-FROM no bloquea.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dejaEmbeberse } from '../lib/landing-marco';

const MAKO = 'https://hola-mako.com';
const deja = (xfo: string | null, csp: string | null) => dejaEmbeberse({ xfo, csp }, MAKO);

test('sin cabeceras de marco, la página se deja mostrar', () => {
  assert.equal(deja(null, null), true);
  assert.equal(deja('', ''), true);
  assert.equal(deja(null, "default-src 'self'; script-src 'unsafe-inline'"), true, 'una CSP sin frame-ancestors no toca el marco');
});

test('X-Frame-Options: DENY y SAMEORIGIN no dejan; ALLOW-FROM y lo inválido no bloquean', () => {
  assert.equal(deja('DENY', null), false);
  assert.equal(deja('sameorigin', null), false);
  assert.equal(deja(' SameOrigin ', null), false);
  assert.equal(deja('SAMEORIGIN, SAMEORIGIN', null), false, 'repetida, unida por coma');
  assert.equal(deja('ALLOW-FROM https://hola-mako.com', null), true, 'Chrome ignora ALLOW-FROM');
  assert.equal(deja('cualquier-cosa', null), true);
});

test('frame-ancestors manda sobre X-Frame-Options', () => {
  assert.equal(deja('DENY', 'frame-ancestors *'), true);
  assert.equal(deja(null, "frame-ancestors 'none'"), false);
  assert.equal(deja(null, "frame-ancestors 'self'"), false, "'self' es la landing, nunca MaKo");
  assert.equal(deja(null, "default-src *; frame-ancestors 'self' https://*.webflow.io"), false);
  assert.equal(deja('SAMEORIGIN', "frame-ancestors 'self' https://hola-mako.com"), true);
});

test('las fuentes de frame-ancestors: host, comodín, esquema y puerto', () => {
  assert.equal(deja(null, 'frame-ancestors hola-mako.com'), true);
  assert.equal(deja(null, 'frame-ancestors https://hola-mako.com/'), true);
  assert.equal(deja(null, 'frame-ancestors https:'), true);
  assert.equal(deja(null, 'frame-ancestors http:'), false);
  assert.equal(deja(null, 'frame-ancestors http://hola-mako.com'), false, 'otro esquema');
  assert.equal(deja(null, 'frame-ancestors *.hola-mako.com'), false, '*.dominio no incluye al dominio pelado');
  assert.equal(dejaEmbeberse({ xfo: null, csp: 'frame-ancestors *.hola-mako.com' }, 'https://app.hola-mako.com'), true);
  assert.equal(deja(null, 'frame-ancestors https://hola-mako.com:8443'), false, 'otro puerto');
  assert.equal(deja(null, 'frame-ancestors https://hola-mako.com:443'), true);
  assert.equal(deja(null, 'frame-ancestors hola-mako.com.evil.tld'), false);
});

test('cada política cuenta: alcanza con una que no nombre a MaKo', () => {
  assert.equal(deja(null, "frame-ancestors *, frame-ancestors 'self'"), false);
  assert.equal(deja(null, 'frame-ancestors *, script-src *'), true);
});

test('un origen que no es una URL no se embebe (no se afirma nada)', () => {
  assert.equal(dejaEmbeberse({ xfo: null, csp: null }, 'no es una url'), false);
});
