#!/usr/bin/env node
// =============================================================================
// vercel-funciones-grandes.mjs — prender VERCEL_SUPPORT_LARGE_FUNCTIONS (3/11/2026)
// =============================================================================
// Martín dijo «sí, solucionalo ya» después de que el deploy fallara cinco veces con:
//
//     The Vercel Function "admin/docs" is 274.32mb uncompressed which exceeds the
//     maximum uncompressed size limit of 250mb. Your project is eligible for the
//     large functions beta... set VERCEL_SUPPORT_LARGE_FUNCTIONS=1
//
// POR QUÉ ESTA Y NO RECORTAR: `/admin/docs` empaqueta los `.md` del repo
// (`outputFileTracingIncludes`, next.config.ts) para renderizar la documentación sin copiarla.
// Son 19,6 MB en 314 archivos, y **medido**: sacando todos los `hallazgos-*.md` la función
// quedaría en ~264 MB, igual por encima del tope. Recortar no alcanza.
//
// ⚠️ NO FUERZA UN REDEPLOY: no hace falta. Hay un run de Actions en vuelo; cuando salga verde,
// `main` avanza y Vercel construye **ya con la variable puesta**. Forzar uno sería gastar un build
// y pisar el que viene.
//
// ⚠️ NUNCA IMPRIME EL TOKEN ni el valor de ninguna variable.
//
// Uso:  node --env-file=C:/dev/mako-api/.env.local scripts/vercel-funciones-grandes.mjs
// =============================================================================
const token = process.env.VERCEL_API_TOKEN;
const slug = process.env.VERCEL_TEAM_SLUG || '';
if (!token) { console.log('No hay VERCEL_API_TOKEN en el env.'); process.exit(1); }
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const con = (p) => `${p}${p.includes('?') ? '&' : '?'}${slug ? `slug=${encodeURIComponent(slug)}` : ''}`;

// El proyecto sale del último deploy: así no hay que escribir su id a mano.
const { deployments = [] } = await (await fetch(con('https://api.vercel.com/v6/deployments?limit=1'), { headers: H })).json();
const projectId = deployments[0]?.projectId;
if (!projectId) { console.log('No pude leer el proyecto del último deploy.'); process.exit(1); }
console.log('proyecto: %s (%s)', deployments[0]?.name ?? '?', projectId);

const CLAVE = 'VERCEL_SUPPORT_LARGE_FUNCTIONS';

// ¿Ya está? Entonces no se toca: escribir de nuevo crearía un duplicado.
const { envs = [] } = await (await fetch(con(`https://api.vercel.com/v9/projects/${projectId}/env`), { headers: H })).json();
const ya = envs.find((e) => e.key === CLAVE);
if (ya) { console.log('%s YA estaba puesta (targets: %s). No se toca.', CLAVE, (ya.target || []).join(', ')); process.exit(0); }

const r = await fetch(con(`https://api.vercel.com/v10/projects/${projectId}/env`), {
  method: 'POST',
  headers: H,
  body: JSON.stringify({ key: CLAVE, value: '1', type: 'plain', target: ['production', 'preview', 'development'] }),
});
const cuerpo = await r.json().catch(() => null);
if (!r.ok) { console.log('NO se pudo: HTTP %d · %s', r.status, JSON.stringify(cuerpo)?.slice(0, 400)); process.exit(1); }
console.log('✓ %s = 1 creada en production, preview y development.', CLAVE);
console.log('  El próximo build la toma. No se fuerza un redeploy: ya hay un run en vuelo.');
