// =============================================================================
// Las preguntas de fase no suponen Meta Ads (18/10/2026)
// =============================================================================
// Martín: «el onboarding sólo tiene presente el tema de META ADS... Cuando hoy en día ya extendimos a prospección, funnel
// orgánico, lead magnets, YouTube, etc.». «¿Cuánto inviertes por día en Meta Ads?» y «¿Cuántos creativos lanzas?» pasan a
// valer para cualquier canal. El paso chico: mismos ids y mismos 5 cortes (de por día a por mes), así el voto de cada
// opción a su fase no cambia y un negocio orgánico contesta algo que le corresponde.
//
// ROTURAS (18/10/2026, arnés romper-fase.js del scratchpad; base 3/0): vuelve «Meta Ads» en la pregunta → 2/1 · una
// opción de menos → 2/1 · un id cambiado (rompe las respuestas guardadas) → 2/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREGUNTAS } from '../lib/fase-diagnostico';

test('ninguna pregunta de fase nombra Meta, anuncios como único canal ni «creativos»', () => {
  for (const q of PREGUNTAS) {
    assert.doesNotMatch(q.texto, /Meta|creativos \(anuncios\)|por d[ií]a/i, `«${q.texto}» supone que el negocio vende con anuncios de Meta`);
  }
});

test('las dos preguntas del canal nombran varios canales, con sus 5 cortes', () => {
  const inv = PREGUNTAS.find((q) => q.id === 'inversion');
  const pie = PREGUNTAS.find((q) => q.id === 'creativos');
  assert.ok(inv && pie, 'cambió un id: las respuestas guardadas por índice dejan de leerse');
  assert.match(inv.texto, /conseguir clientes \(anuncios, prospección, contenido\)/);
  assert.match(pie.texto, /anuncios, videos, posts, lead magnets/);
  assert.equal(inv.opciones.length, 5);
  assert.equal(pie.opciones.length, 5);
  assert.deepEqual(inv.opciones, ['Nada o menos de $600', '$600 – $3.000', '$3.000 – $9.000', '$9.000 – $30.000', 'Más de $30.000']);
});

test('ninguna RESPUESTA rápida del diagnóstico supone VSL, creativos o anuncios como único canal', () => {
  // 18/10/2026, Martín, punto 8: «las respuestas rápidas siguen siendo las viejas cuando hoy tenemos más funnels... revisalo
  // bien todas». Roturas (romper-fase.js): vuelve «VSL» al funnel → 3/1 · vuelve el «CPA» al cuello → 3/1.
  for (const q of PREGUNTAS) {
    assert.equal(q.opciones.length, 5, `«${q.id}»: el voto a la fase va por índice, son 5`);
    for (const o of q.opciones) assert.doesNotMatch(o, /\bVSL\b|creativo|\bCPA\b|desde el anuncio|Meta/i, `«${q.id}»: «${o}» supone un solo canal`);
  }
});

test('siguen siendo seis preguntas, en el mismo orden (el cálculo de la fase las lee por índice)', () => {
  assert.deepEqual(PREGUNTAS.map((q) => q.id), ['facturacion', 'inversion', 'creativos', 'volumen', 'funnel', 'cuello']);
});
