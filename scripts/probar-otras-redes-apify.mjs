#!/usr/bin/env node
// =============================================================================
// probar-otras-redes-apify.mjs — ¿la búsqueda de sus OTRAS redes trae candidatos, y cuánto cuesta? (3/11/2026)
// =============================================================================
// Ítems 10/11 de Spy: con UN dato (su @ o su canal), traer sus otras redes. El actor elegido es
// `apify~google-search-scraper`: UNA página de Google con `site:` trae YouTube, TikTok e Instagram
// juntos, por una sola corrida. Esto es lo único que puede MEDIR el costo de verdad: lee
// `usageTotalUsd` de la corrida, no la tienda.
//
// ⚠️ GASTA PLATA DE VERDAD, poca (una página de Google), y es de la clave de Spy del negocio.
// ⚠️ NUNCA IMPRIME EL TOKEN.
//
// Uso:  node --env-file=C:/dev/mako-api/.env.local scripts/probar-otras-redes-apify.mjs [ws] [nombre]
// =============================================================================
import postgres from 'postgres';
import { urlDeLaBase } from './url-de-la-base.mjs';

const M = await import('../lib/cripto-credenciales.ts');

const ws = Number(process.argv[2] || 9);
const nombre = process.argv.slice(3).join(' ') || 'Leila Hormozi';
const CLAVE = 'APIFY_INSTAGRAM_TOKEN';
const ACTOR = 'apify~google-search-scraper';

const sql = postgres(await urlDeLaBase(), { ssl: 'require', max: 1 });
let token = '';
try {
  const [f] = await sql`select valor_enc from credenciales where workspace_id = ${ws} and clave = ${CLAVE}`;
  if (!f) { console.log(`ws${ws} NO tiene ${CLAVE} cargada. Nada que probar.`); process.exit(0); }
  token = M.descifrar(f.valor_enc, ws, CLAVE);
  console.log(`clave de ws${ws}: encontrada (${token.length} caracteres)`);
} finally {
  await sql.end();
}

const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const q = `"${nombre}" (site:youtube.com OR site:tiktok.com OR site:instagram.com)`;
const t0 = Date.now();
const r = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?waitForFinish=120&maxTotalChargeUsd=0.5`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ queries: q, resultsPerPage: 10, maxPagesPerQuery: 1, mobileResults: false, saveHtml: false }),
  signal: AbortSignal.timeout(150_000),
});
const cuerpo = await r.json().catch(() => null);
const corrida = cuerpo?.data;
if (!corrida) console.log("error:", JSON.stringify(cuerpo?.error ?? cuerpo)?.slice(0, 500));
console.log('HTTP %d en %d s · estado %s', r.status, Math.round((Date.now() - t0) / 1000), corrida?.status);
if (!corrida?.id) { console.log('sin corrida:', JSON.stringify(corrida)?.slice(0, 400)); process.exit(1); }

const items = await fetch(`https://api.apify.com/v2/datasets/${corrida.defaultDatasetId}/items?clean=1`, { headers: H }).then((x) => x.json()).catch(() => []);
const organicos = (Array.isArray(items) ? items : []).flatMap((p) => p?.organicResults ?? []);
console.log('páginas: %d · resultados orgánicos: %d', Array.isArray(items) ? items.length : 0, organicos.length);
for (const o of organicos) console.log('  %s · %s', o.url, (o.title ?? '').slice(0, 70));

// El costo: se relee la corrida 15 s después: a los 4 s el evento de la página TODAVÍA NO figura y el
// costo sale 100 veces más bajo (medido el 3/11/2026: US$0,00005 a los 4 s, US$0,00455 asentado).
await new Promise((ok) => setTimeout(ok, 15000));
const fin = (await fetch(`https://api.apify.com/v2/actor-runs/${corrida.id}`, { headers: H }).then((x) => x.json()).catch(() => null))?.data;
console.log('\n--- COSTO MEDIDO ---');
console.log('usageTotalUsd: %s', fin?.usageTotalUsd);
console.log('chargedEventCounts: %s', JSON.stringify(fin?.chargedEventCounts ?? null));
// ⚠️ `usageTotalUsd` NO es lo que se paga en un actor PAY_PER_EVENT: es el cómputo de la plataforma.
// Lo cobrado es la suma de cada evento por su precio, y eso se arma acá.
const precios = fin?.pricingInfo?.pricingPerEvent?.actorChargeEvents ?? {};
let total = 0;
for (const [ev, n] of Object.entries(fin?.chargedEventCounts ?? {})) {
  if (!n) continue;
  const p = precios[ev]?.eventPriceUsd ?? precios[ev]?.eventTieredPricingUsd?.FREE?.tieredEventPriceUsd ?? null;
  console.log('  %s × %d a US$%s', ev, n, JSON.stringify(p ?? precios[ev]?.eventTieredPricingUsd ?? null));
  if (typeof p === 'number') total += p * n;
}
console.log('COBRADO por esta búsqueda: US$%s', total.toFixed(5));
