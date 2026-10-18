// =============================================================================
// El webhook del WhatsApp no oficial: una firma POR LÍNEA, no un secreto para todos (17/10/2026)
// =============================================================================
// Con el `?secret=` de plataforma —uno solo, en claro en la URL de cada línea— se inyectaban
// mensajes en la bandeja de cualquier negocio o se le pausaba la nutrición a un lead ajeno. Ahora
// cada URL lleva HMAC(secreto, instancia) y el webhook lo verifica contra el `instance` del CUERPO
// (lib/evolution-firma.ts). La URL vieja vale hasta CORTE_LEGADO y la línea se re-registra sola.
//
// Probado rompiéndolo (17/10/2026), sobre los 5 de este archivo (base 5 / 0): con `verificarFirma`
// firmando contra la `i` de la QUERY en vez del cuerpo → 4 / 1; aceptando el legado sin mirar el
// corte → 4 / 1;
// con `webhookUrl()` de lib/evolution.ts volviendo a `?secret=` → 4 / 1; con el webhook que
// compara `searchParams.get('secret')` antes de leer el cuerpo → 4 / 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CORTE_LEGADO, firmaDeInstancia, queryDeWebhook, verificarFirma } from '../lib/evolution-firma';

const SECRETO = 's3cr3t-de-plataforma';
const ANTES = CORTE_LEGADO - 1;
const DESPUES = CORTE_LEGADO + 1;
const q = (s: string) => new URLSearchParams(s);
const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

test('la URL de una línea sólo firma eventos de ESA línea', () => {
  const urlDe1 = q(queryDeWebhook(SECRETO, 'mako_ws1'));
  assert.equal(verificarFirma({ secreto: SECRETO, query: urlDe1, instancia: 'mako_ws1', ahora: ANTES }), 'ok');
  // Con la URL de la línea del ws1, un evento que dice venir de la línea del ws3: afuera.
  assert.equal(verificarFirma({ secreto: SECRETO, query: urlDe1, instancia: 'mako_ws3', ahora: ANTES }), 'rechazado');
  // Ni sacándole la `i` a la query: la firma es de otra instancia.
  const soloFirma = q(`firma=${firmaDeInstancia(SECRETO, 'mako_ws1')}`);
  assert.equal(verificarFirma({ secreto: SECRETO, query: soloFirma, instancia: 'mako_ws3', ahora: ANTES }), 'rechazado');
});

test('fail-closed: sin secreto en el servidor, sin instancia o con una firma inventada', () => {
  const buena = q(queryDeWebhook(SECRETO, 'mako_ws1'));
  assert.equal(verificarFirma({ secreto: '', query: buena, instancia: 'mako_ws1', ahora: ANTES }), 'rechazado');
  assert.equal(verificarFirma({ secreto: undefined, query: buena, instancia: 'mako_ws1', ahora: ANTES }), 'rechazado');
  assert.equal(verificarFirma({ secreto: SECRETO, query: buena, instancia: '', ahora: ANTES }), 'rechazado');
  assert.equal(verificarFirma({ secreto: SECRETO, query: q('i=mako_ws1&firma=' + 'a'.repeat(64)), instancia: 'mako_ws1', ahora: ANTES }), 'rechazado');
  assert.equal(verificarFirma({ secreto: SECRETO, query: q(''), instancia: 'mako_ws1', ahora: ANTES }), 'rechazado');
});

test('la URL vieja (?secret= de plataforma) vale hasta el corte, y después no', () => {
  const vieja = q(`secret=${encodeURIComponent(SECRETO)}`);
  assert.equal(verificarFirma({ secreto: SECRETO, query: vieja, instancia: 'mako_ws1', ahora: ANTES }), 'legado');
  assert.equal(verificarFirma({ secreto: SECRETO, query: vieja, instancia: 'mako_ws1', ahora: DESPUES }), 'rechazado');
  assert.equal(verificarFirma({ secreto: SECRETO, query: q('secret=otro'), instancia: 'mako_ws1', ahora: ANTES }), 'rechazado');
});

test('lib/evolution.ts registra cada línea con SU firma y el diagnóstico pide la URL entera', () => {
  const src = leer('lib/evolution.ts');
  assert.doesNotMatch(src, /\?secret=\$\{/, 'volvió el secreto de plataforma a la URL');
  assert.match(src, /function webhookUrl\(instance: string\): string \{\n\s*const qs = WEBHOOK_SECRET \? `\?\$\{queryDeWebhook\(WEBHOOK_SECRET, instance\)\}` : '';/);
  assert.match(src, /url: webhookUrl\(instance\)/);
  assert.match(src, /if \(cfg\.url !== esperada\) return \{ estado: 'no_registrado'/);
});

test('el webhook verifica la firma contra el cuerpo y re-registra la línea vieja', () => {
  const src = leer('app/api/webhooks/evolution/route.ts');
  const post = src.slice(src.indexOf('export async function POST'));
  assert.doesNotMatch(post, /searchParams\.get\('secret'\)/, 'el webhook volvió a comparar el secreto de plataforma');
  const lee = post.indexOf('await req.json()');
  const verifica = post.indexOf('verificarFirma({');
  assert.ok(lee > 0 && verifica > lee, 'la firma se verifica contra el instance del CUERPO');
  assert.match(post, /if \(veredicto === 'rechazado'\) return Response\.json\(\{ ok: false, error: 'unauthorized' \}, \{ status: 401 \}\);/);
  assert.match(post, /registrarWebhookInstancia\(instance\)/);
});
