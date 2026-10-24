// =============================================================================
// «Conectar con tu propia app de Meta»: el tutorial del modal de Meta (23/10/2026)
// =============================================================================
// Mientras la app de MaKo espera la revisión de Meta, cada negocio conecta con SU
// app. Medido el 23/10 en los 10 negocios conectados así: métricas y leads andan.
// El tutorial viejo no decía con qué casos de uso crear la app.
//
// ⚠️ Y NO PIDE PUBLICAR LA APP. Publicar con creativo nuevo sólo anduvo con una app
// activa, pero Martín lo prohibió el 16/09: «no me menciones más que el cliente tenga
// que publicar su app, esa no es opción». Un paso así entró y salió el mismo 23/10.
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

test('ningún paso le pide al cliente publicar ni activar su app (regla de Martín, 16/09)', () => {
  const malos = pasos().filter((x) => /"Publicar"|\bpublica(r|la)?\b.*\bapp\b|\bactiva\b|modo (público|activo|en vivo)|\bLive\b/i.test(x));
  assert.deepEqual(malos, []);
});

test('el token sigue pidiendo vencimiento «Nunca» y los permisos de anuncios y de leads', () => {
  const t = pasos().find((x) => /Generar nuevo token/.test(x)) ?? '';
  assert.match(t, /"Nunca"/);
  for (const perm of ['ads_read', 'ads_management', 'business_management', 'leads_retrieval']) assert.ok(t.includes(perm), perm);
});
