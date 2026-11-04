#!/usr/bin/env node
// =============================================================================
// probar-anuncios-apify.mjs — ¿el actor de la Biblioteca de Anuncios trae sus anuncios, y cuánto cuesta? (4/11/2026)
// =============================================================================
// Punto 10 del 4/11 («todos los anuncios de la biblioteca de anuncios... Que los traiga para analizarlos»). La nube no
// llega a apify.com, así que la forma de lo que devuelve `apify~facebook-ads-scraper` no se pudo leer:
// `anuncioDeApify` (lib/spy-todo-reglas.ts) acepta los nombres que se vieron en sus ejemplos públicos. Esto corre UNA
// corrida chica y dice cuántos ítems vinieron, qué campos traen, cuántos entiende `anuncioDeApify` y cuánto costó.
//
// Si «entendidos» es la mayoría de los ítems y el costo está cerca del techo de `USD_POR_ANUNCIO`, se prende
// `ANUNCIOS_POR_APIFY` en lib/spy-todo-reglas.ts. Si no, se ajusta `anuncioDeApify` con el primer ítem que imprime.
//
// ⚠️ GASTA PLATA DE VERDAD, poca (hasta 10 anuncios, techo US$0,20), y es de la clave de Spy del negocio.
// ⚠️ NUNCA IMPRIME EL TOKEN.
//
// Uso:  node --env-file=C:/dev/mako-api/.env.local scripts/probar-anuncios-apify.mjs [ws] [id de la Página o nombre]
// =============================================================================
import postgres from 'postgres';
import { urlDeLaBase } from './url-de-la-base.mjs';

const M = await import('../lib/cripto-credenciales.ts');
const R = await import('../lib/spy-todo-reglas.ts');

const ws = Number(process.argv[2] || 3);
const quien = process.argv.slice(3).join(' ') || 'Víctor Heras';
const CLAVE = 'APIFY_INSTAGRAM_TOKEN';

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

// La misma búsqueda que arma «Ver sus anuncios» (lib/spy-funnel.ts, `enlaceSusAnuncios`), con activos y viejos.
const p = new URLSearchParams({ active_status: 'all', ad_type: 'all', country: 'ALL', media_type: 'all' });
if (/^\d{5,25}$/.test(quien)) { p.set('search_type', 'page'); p.set('view_all_page_id', quien); }
else { p.set('search_type', 'keyword_exact_phrase'); p.set('q', `"${quien}"`); }
const entrada = R.entradaDeAnuncios(`https://www.facebook.com/ads/library/?${p}`, 10);

const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const t0 = Date.now();
const r = await fetch(`https://api.apify.com/v2/acts/${R.APIFY_ACTOR_ANUNCIOS}/runs?waitForFinish=180&maxItems=10&maxTotalChargeUsd=0.2`, {
  method: 'POST', headers: H, body: JSON.stringify(entrada), signal: AbortSignal.timeout(200_000),
});
const cuerpo = await r.json().catch(() => null);
const corrida = cuerpo?.data;
console.log('HTTP %d en %d s · estado %s', r.status, Math.round((Date.now() - t0) / 1000), corrida?.status);
if (!corrida?.id) { console.log('sin corrida:', JSON.stringify(cuerpo)?.slice(0, 500)); process.exit(1); }

const items = await fetch(`https://api.apify.com/v2/datasets/${corrida.defaultDatasetId}/items?clean=1`, { headers: H }).then((x) => x.json()).catch(() => []);
const lista = Array.isArray(items) ? items : [];
const entendidos = lista.map(R.anuncioDeApify).filter(Boolean);
console.log('ítems: %d · entendidos por anuncioDeApify: %d', lista.length, entendidos.length);
if (lista[0]) {
  console.log('\nlos campos del primer ítem:', Object.keys(lista[0]).join(', '));
  console.log('los del snapshot:', Object.keys(lista[0].snapshot ?? {}).join(', '));
  console.log('\nel primero, leído:', JSON.stringify(entendidos[0] ?? null, null, 2));
}

await new Promise((ok) => setTimeout(ok, 15000));
const fin = (await fetch(`https://api.apify.com/v2/actor-runs/${corrida.id}`, { headers: H }).then((x) => x.json()).catch(() => null))?.data;
console.log('\n--- COSTO MEDIDO ---');
console.log('usageTotalUsd: %s · chargedEventCounts: %s', fin?.usageTotalUsd, JSON.stringify(fin?.chargedEventCounts ?? null));
console.log('techo por anuncio que usa el código: US$%s', R.USD_POR_ANUNCIO);
