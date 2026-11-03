#!/usr/bin/env node
// =============================================================================
// ver-deploy-vercel.mjs — los últimos deploys y, si alguno falló, POR QUÉ (3/11/2026)
// =============================================================================
// ⚠️ EXISTE PORQUE ACTIONS EN VERDE NO SIGNIFICA QUE EL DEPLOY ANDE, y esa noche costó tres
// deploys rotos sin que ninguna señal lo dijera. CI corre `tsc` y la suite; **no corre
// `next build` ni el empaquetado de funciones**. El 3/11/2026 el deploy se rompió así:
//
//     The Vercel Function "admin/docs" is 281.43mb uncompressed which exceeds the
//     maximum uncompressed size limit of 250mb.
//
// ...mientras Actions seguía verde. La causa fue un import nuevo de `lib/` hacia
// `app/conocimientos/catalogo`, que arrastra los 100+ archivos de cursos.
//
// ⚠️ NUNCA IMPRIME EL TOKEN: sólo si lo encontró y cuántos caracteres tiene.
//
// Uso:  node --env-file=C:/dev/mako-api/.env.local scripts/ver-deploy-vercel.mjs
// =============================================================================
const token = process.env.VERCEL_API_TOKEN;
const slug = process.env.VERCEL_TEAM_SLUG || '';
if (!token) { console.log('No hay VERCEL_API_TOKEN en el env.'); process.exit(1); }
console.log('token: encontrado (%d caracteres) · equipo: %s\n', token.length, slug || '(sin slug)');

const H = { Authorization: `Bearer ${token}` };
const q = new URLSearchParams({ limit: '8' });
if (slug) q.set('slug', slug);

const r = await fetch(`https://api.vercel.com/v6/deployments?${q}`, { headers: H });
if (!r.ok) { console.log('deployments: HTTP %d · %s', r.status, (await r.text()).slice(0, 300)); process.exit(1); }
const { deployments = [] } = await r.json();

console.log('--- ÚLTIMOS DEPLOYS ---');
for (const d of deployments) {
  const cuando = new Date(d.createdAt).toISOString().slice(5, 16).replace('T', ' ');
  console.log(`${cuando}  ${String(d.state).padEnd(9)}  ${(d.meta?.githubCommitSha || '').slice(0, 9)}  ${(d.meta?.githubCommitMessage || '').split('\n')[0].slice(0, 56)}`);
}

const malo = deployments.find((d) => d.state === 'ERROR');
if (!malo) { console.log('\nNinguno de los últimos está en ERROR.'); process.exit(0); }

console.log('\n--- EL QUE FALLÓ: %s ---', malo.uid);
const qe = new URLSearchParams({ limit: '3000' });
if (slug) qe.set('slug', slug);
const txt = await (await fetch(`https://api.vercel.com/v2/deployments/${malo.uid}/events?${qe}`, { headers: H })).text();

const L = [];
for (const l of txt.split('\n')) {
  const s = l.trim(); if (!s) continue;
  try { const o = JSON.parse(s); const t = o.text ?? o.payload?.text ?? ''; if (t) L.push(String(t)); } catch { /* no es JSON */ }
}
if (!L.length) { try { for (const o of JSON.parse(txt)) { const t = o.text ?? o.payload?.text ?? ''; if (t) L.push(String(t)); } } catch { /* ni json */ } }

// El error de verdad suele estar al final; el listado de rutas lo tapa si se mira a ojo.
const i = L.findIndex((l) => /Failed to compile|Module not found|Type error|out of memory|JavaScript heap|exceeds the maximum|Build Failed|^Error:/i.test(l));
console.log(i >= 0 ? L.slice(Math.max(0, i - 3), i + 12).join('\n') : L.slice(-15).join('\n'));
