// =============================================================================
// Las fuentes que avisan (Hotmart, Skool): el ruteo por hash y la puerta única al CRM
// =============================================================================
// Leads Scraper, 14/10/2026 (docs/diseno-leads-scraper.md). Tres cosas que no se ven y se fijan acá:
//   1. Un SECRETO que rutea va a `webhook_routing` como su HASH, nunca en claro (lib/ruteo-hash.ts),
//      y el webhook lo PRUEBA contra la credencial del workspace en tiempo constante.
//   2. No hay una segunda puerta de leads: las dos rutas entran por `ingresarDeFuente`
//      (lib/fuentes-leads.ts), que usa `findLeadByContacto` / `createLead` / `enriquecerLead`.
//   3. La puerta no decide nada por detrás: no mueve de etapa, no inscribe, no manda mensajes.
//
// Probado rompiéndolo (14/10/2026), una rotura por vez y restaurando desde memoria:
//   · `identificadorDeRuteo` sacado de lib/credenciales.ts → 10 pasan / 1 falla (el secreto en claro);
//   · `igualesSeguro(` cambiado por `!==` en la ruta de Hotmart → 10 / 1;
//   · un `setPipelineStage(` en lib/fuentes-leads.ts → 10 / 1;
//   · el `runWithWorkspace(` de la ruta de Skool quitado → 10 / 1.
// Restaurado: 11 / 0. (El arnés restaura desde memoria, nunca con `git checkout --`.)
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hashDeRuteo, identificadorDeRuteo, igualesSeguro, secretoDelHeader, RUTEO_POR_HASH } from '../lib/ruteo-hash';
import { esFuenteQueAvisa } from '../lib/fuentes-leads-catalogo';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const HOTMART = sinComentarios(leer('../app/api/webhooks/hotmart/route.ts'));
const SKOOL = sinComentarios(leer('../app/api/webhooks/skool/route.ts'));
const PUERTA = sinComentarios(leer('../lib/fuentes-leads.ts'));

// ── El hash ──────────────────────────────────────────────────────────────────

test('un secreto que rutea va como hash; un identificador público, tal cual', () => {
  const h = identificadorDeRuteo('HOTMART_HOTTOK', '  mi-hottok-secreto ');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashDeRuteo('mi-hottok-secreto'), 'los espacios de los lados no cambian el hash');
  assert.ok(!h.includes('mi-hottok'), 'el secreto no puede quedar en claro');
  assert.equal(identificadorDeRuteo('SKOOL_WEBHOOK_CLAVE', 'clave'), hashDeRuteo('clave'));
  assert.equal(identificadorDeRuteo('META_PAGE_ID', '1234567890'), '1234567890');
});

test('la comparación: igual es igual, y vacío o null nunca es igual', () => {
  assert.equal(igualesSeguro('abc123', ' abc123 '), true);
  assert.equal(igualesSeguro('abc123', 'abc124'), false);
  assert.equal(igualesSeguro('abc123', 'abc1234'), false, 'largos distintos tampoco');
  assert.equal(igualesSeguro(null, 'x'), false);
  assert.equal(igualesSeguro('', ''), false);
});

test('el header se lee con tope: uno gigante no se hashea', () => {
  assert.equal(secretoDelHeader(' x '), 'x');
  assert.equal(secretoDelHeader('x'.repeat(201)), null);
  assert.equal(secretoDelHeader(null), null);
});

test('cada secreto que va por hash es una clave de ruteo, y el guardado lo hashea', () => {
  const ruteo = leer('../lib/webhook-routing.ts');
  for (const clave of RUTEO_POR_HASH) assert.match(ruteo, new RegExp(`\\b${clave}: '[a-z]+'`), `${clave} no está en ROUTING_CREDS`);
  const cred = sinComentarios(leer('../lib/credenciales.ts'));
  assert.match(cred, /upsertRouting\(ROUTING_CREDS\[clave\], identificadorDeRuteo\(clave, valor\), ws\)/,
    'el guardado de una credencial tiene que mandar el HASH del secreto a webhook_routing, no el valor');
});

test('las fuentes que avisan son opcionales en el tablero, y «toString» no es una fuente', () => {
  assert.equal(esFuenteQueAvisa('hotmart'), true);
  assert.equal(esFuenteQueAvisa('skool'), true);
  assert.equal(esFuenteQueAvisa('toString'), false);
  assert.equal(esFuenteQueAvisa('stripe'), false);
  assert.match(leer('../app/integraciones/IntegracionesBoard.tsx'), /esPasarela\(i\.key\) \|\| esFuenteQueAvisa\(i\.key\)/);
});

// ── Las dos rutas ────────────────────────────────────────────────────────────

for (const [nombre, src, servicio, clave, header] of [
  ['Hotmart', HOTMART, 'hotmart', 'HOTMART_HOTTOK', 'x-hotmart-hottok'],
  ['Skool', SKOOL, 'skool', 'SKOOL_WEBHOOK_CLAVE', 'x-mako-clave'],
] as const) {
  test(`${nombre}: ruteo por el hash del header, credencial estricta y prueba en tiempo constante`, () => {
    assert.match(src, new RegExp(`secretoDelHeader\\(req\\.headers\\.get\\('${header}'\\)\\)`));
    assert.match(src, new RegExp(`wsPorIdentificadorEstricto\\('${servicio}', hashDeRuteo\\(`));
    assert.match(src, new RegExp(`credWsEstricta\\('${clave}', ws\\)`));
    assert.match(src, /igualesSeguro\(guardad[oa], (hottok|clave)\)/, 'el header se compara contra la credencial con igualesSeguro');
    assert.equal((src.match(new RegExp(`responderFalloDeRuteo\\('${servicio}'`, 'g')) ?? []).length, 1);
    // El mismo 401 para «no te conozco» y «no coincide»: una sola condición los junta.
    assert.match(src, /if \(ws == null \|\| !igualesSeguro\(/);
  });

  test(`${nombre}: entra por la puerta única, adentro de su workspace, y el error no viaja en el cuerpo`, () => {
    assert.match(src, /runWithWorkspace\(wsFinal, \(\) => ingresarDeFuente\(/);
    assert.ok(!/\.from\(['"]leads['"]\)/.test(src), 'la ruta escribe leads por su cuenta');
    assert.ok(!/createLead\(|updateLead\(/.test(src), 'la ruta da de alta por fuera de la puerta');
    assert.ok(!/reintentar: false, motivo/.test(src), 'el motivo de un error de base puede traer el email: va al log, no al cuerpo');
    assert.ok(!/searchParams\.get\(/.test(src), 'el secreto va en un header, nunca en la URL');
  });
}

// ── La puerta ────────────────────────────────────────────────────────────────

test('la puerta busca por contacto, completa lo vacío y sólo crea si el evento crea', () => {
  assert.match(PUERTA, /findLeadByContacto\(email, telefono\)/);
  assert.match(PUERTA, /enriquecerLead\(existente\.id/);
  assert.match(PUERTA, /if \(!e\.creaLead\) return \{ estado: 'ignorado'/);
  assert.match(PUERTA, /createLead\(\{[\s\S]*?origen_lead: ORIGEN_LEAD\[e\.fuente\]\.id/);
  assert.ok(!/\.from\(['"]leads['"]\)/.test(PUERTA), 'la puerta no escribe `leads` con un .from propio');
});

test('la puerta NO decide nada por detrás: ni etapa, ni automatizaciones, ni mensajes', () => {
  for (const prohibido of ['setPipelineStage(', 'enrolarPorEvento(', 'enrolarPorPago(', 'dispararEvento(', 'emitirDelCatalogo(', 'agregarAProducto(', 'sendText', 'sendEmail(']) {
    assert.ok(!PUERTA.includes(prohibido), `lib/fuentes-leads.ts llama a ${prohibido}: eso lo decide el negocio en Automations, a la vista`);
  }
});
