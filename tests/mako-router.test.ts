// Tests del router del doer (lib/mako-router.ts): que clasifique bien barato vs
// Sonnet vs Opus. La regla dura: needs-tools ⇒ nunca barato. Correr: node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rutearDoer } from '../lib/mako-router';

const tier = (t: string, ctx?: { hayMedia?: boolean; hayPendientes?: boolean }) => rutearDoer(t, ctx).tier;

test('saludos / charla → barato (sin tools)', () => {
  for (const s of ['Hola MaKo', 'buenas!', 'gracias crack', 'dale', 'genial, gracias', 'todo bien?', '👍', 'jaja buenísimo']) {
    const r = rutearDoer(s);
    assert.equal(r.tier, 'cheap', `"${s}" debería ser cheap`);
    assert.equal(r.needsTools, false);
  }
});

test('capacidades → barato', () => {
  assert.equal(tier('MaKo, qué podés hacer?'), 'cheap');
  assert.equal(tier('en qué me podés ayudar'), 'cheap');
});

test('consulta de datos → Sonnet con tools (NUNCA barato)', () => {
  for (const s of ['cuántos leads entraron hoy', 'mostrame las reuniones de mañana', 'buscame a Juan Pérez', 'cuánto gasté este mes', 'tengo pagos pendientes?']) {
    const r = rutearDoer(s);
    assert.equal(r.tier, 'sonnet', `"${s}" debería ser sonnet`);
    assert.equal(r.needsTools, true);
  }
});

test('acción sobre la cuenta → Sonnet con tools', () => {
  for (const s of ['apagá la campaña 2', 'pausá el adset de retargeting', 'mové a Juan a agenda', 'marcá el pago de Pedro']) {
    assert.equal(tier(s), 'sonnet', `"${s}" debería ser sonnet`);
  }
});

test('razonamiento / análisis → Opus', () => {
  for (const s of ['por qué no cerró Jesús?', 'analizá el funnel de este mes', 'qué campaña conviene escalar y por qué', 'recomendame una estrategia']) {
    assert.equal(tier(s), 'opus', `"${s}" debería ser opus`);
  }
});

test('copywriting / voz de marca → Opus', () => {
  for (const s of ['escribime el mensaje para reactivar fríos', 'armá una campaña para el lanzamiento', 'redactá la secuencia de nutrición']) {
    assert.equal(tier(s), 'opus', `"${s}" debería ser opus`);
  }
});

test('media (imagen/PDF) → Opus con tools', () => {
  const r = rutearDoer('mirá esto', { hayMedia: true });
  assert.equal(r.tier, 'opus');
  assert.equal(r.needsTools, true);
});

test('acción pendiente de confirmar → Sonnet (aunque el texto sea "sí")', () => {
  assert.equal(tier('sí, dale', { hayPendientes: true }), 'sonnet');
  assert.equal(tier('dale confirmá', { hayPendientes: true }), 'sonnet');
});

test('ambiguo → Sonnet con tools (fail-safe, nunca barato)', () => {
  const r = rutearDoer('el asunto ese que hablamos recién con el equipo de ventas');
  assert.equal(r.tier, 'sonnet');
  assert.equal(r.needsTools, true);
});

test('regla dura: ningún tier cheap tiene needsTools', () => {
  for (const s of ['hola', 'cuántos leads', 'apagá la campaña', 'por qué', 'escribí el copy']) {
    const r = rutearDoer(s);
    if (r.tier === 'cheap') assert.equal(r.needsTools, false);
    else assert.equal(r.needsTools, true);
  }
});
