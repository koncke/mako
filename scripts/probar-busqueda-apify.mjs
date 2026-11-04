#!/usr/bin/env node
// =============================================================================
// probar-busqueda-apify.mjs — ¿la búsqueda por NOMBRE trae resultados de verdad? (3/11/2026)
// =============================================================================
// Martín pidió buscar sin arroba, elegimos el actor `apify~instagram-scraper` y él lo habilitó en
// su cuenta de Apify. Esto es lo único que puede CONFIRMAR que funciona: el código compila y los
// tipos cierran, pero eso no dice nada sobre si el actor devuelve perfiles.
//
// ⚠️ GASTA PLATA DE VERDAD, poca: US$1,50 por 1.000 resultados, y acá se piden 8 → **US$0,012**.
// Y gasta del tope diario del negocio. Por eso es un script a mano y no un test.
//
// ⚠️ NUNCA IMPRIME EL TOKEN. Sólo si lo encontró y cuántos caracteres tiene.
//
// Uso:  node --env-file=C:/dev/mako-api/.env.local scripts/probar-busqueda-apify.mjs [ws] [texto]
// =============================================================================
import postgres from 'postgres';
import { urlDeLaBase } from './url-de-la-base.mjs';

const M = await import('../lib/cripto-credenciales.ts');

const ws = Number(process.argv[2] || 9);
const texto = process.argv.slice(3).join(' ') || 'leila hormozi';
const CLAVE = 'APIFY_INSTAGRAM_TOKEN';
const ACTOR = 'apify~instagram-scraper';
const CUANTOS = 8;

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

const params = new URLSearchParams({ maxItems: String(CUANTOS), maxTotalChargeUsd: '0.02' });
const t0 = Date.now();
const r = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?${params}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ search: texto, searchType: 'user', searchLimit: CUANTOS, resultsLimit: CUANTOS }),
  signal: AbortSignal.timeout(90_000),
});
console.log('HTTP %d en %d s', r.status, Math.round((Date.now() - t0) / 1000));
const cuerpo = await r.json().catch(() => null);
if (!Array.isArray(cuerpo)) {
  console.log('la respuesta NO es una lista:', JSON.stringify(cuerpo)?.slice(0, 400));
  process.exit(1);
}
console.log('items: %d', cuerpo.length);
for (const it of cuerpo.slice(0, CUANTOS)) {
  const o = it ?? {};
  console.log('  @%s · %s · foto:%s', o.username ?? '(sin username)', o.fullName ?? o.name ?? '(sin nombre)', o.profilePicUrl ? 'sí' : 'no');
}
if (!cuerpo.some((o) => o?.username)) {
  console.log('\n⚠️ Ningún ítem trae `username`: el mapeo de lib/instagram-buscar-apify.ts los descartaría TODOS.');
  console.log('   Las claves del primer ítem son:', Object.keys(cuerpo[0] ?? {}).slice(0, 25).join(', '));
}

// Lo que de verdad devuelve: las claves del primer ítem y un recorte del segundo.
console.log('\n--- FORMA REAL ---');
console.log('claves[0]:', Object.keys(cuerpo[0] ?? {}).join(', '));
console.log('muestra[0]:', JSON.stringify(cuerpo[0] ?? {}).slice(0, 700));
