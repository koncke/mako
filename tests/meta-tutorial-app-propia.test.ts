// =============================================================================
// «Conectar con tu propia app de Meta»: el tutorial del modal de Meta (23/10/2026)
// =============================================================================
// Mientras la app de MaKo espera la revisión de Meta, cada negocio conecta con SU
// app. Medido el 23/10 en los 10 negocios conectados así: métricas y leads andan;
// publicar anuncios anduvo SÓLO con una app ACTIVA (ws1, 5 de 5) y la de ws13, en
// desarrollo, rebotó 14 de 14 con el 1885183. El tutorial viejo no decía nada de
// eso ni de los casos de uso al crear la app.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Se lee como TEXTO: lib/metodo-catalogo.ts es server-only (mismo criterio que tests/tutoriales-legibles.test.ts).
const FUENTE = readFileSync(new URL('../lib/metodo-catalogo.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const pasos = (): string[] => {
  const meta = FUENTE.slice(FUENTE.indexOf("key: 'meta',"));
  const bloque = /\btutorial: \{[\s\S]*?\bpasos: \[\n([\s\S]*?)\n\s*\],/.exec(meta)?.[1] ?? '';
  return [...bloque.matchAll(/^\s*'((?:[^'\\]|\\.)*)',?$/gm)].map((m) => m[1]);
};

test('crear la app con los casos de uso de anuncios y de leads, de tipo Negocio', () => {
  const p = pasos();
  assert.ok(p.length >= 3 && p.length <= 5, `${p.length} pasos`);
  assert.match(p[0], /developers\.facebook\.com\/apps/);
  assert.match(p[0], /"Negocio"/);
  assert.match(p[0], /anuncios/);
  assert.match(p[0], /leads|clientes potenciales/);
});

test('pasar la app a ACTIVA va ANTES del token, con el porqué', () => {
  const p = pasos();
  const activa = p.findIndex((x) => /"Publicar"/.test(x) && /activa/.test(x));
  const token = p.findIndex((x) => /Generar nuevo token/.test(x));
  assert.ok(activa >= 0, 'falta el paso de pasar la app a activa');
  assert.ok(activa < token, 'pasarla a activa va antes de generar el token');
  // La trampa va DENTRO del paso (AGENTS.md, tutoriales): sin esto se lee como un trámite opcional.
  assert.match(p[activa], /rechaza/);
  assert.match(p[activa], /privacidad/);
});

test('el token sigue pidiendo vencimiento «Nunca» y los permisos de anuncios y de leads', () => {
  const t = pasos().find((x) => /Generar nuevo token/.test(x)) ?? '';
  assert.match(t, /"Nunca"/);
  for (const perm of ['ads_read', 'ads_management', 'business_management', 'leads_retrieval']) assert.ok(t.includes(perm), perm);
});
