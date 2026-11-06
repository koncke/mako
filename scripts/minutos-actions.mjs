#!/usr/bin/env node
// =============================================================================
// minutos-actions — cuántos minutos de GitHub Actions se van, por workflow y por día, y cuánto falta para el tope (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «Cuanto vamos a gastar en github? No quiero que pase lo de Vercel y terminemos gastando un montón». El tope
// de gasto de Actions (US$30) se agotó una vez, y con el tope agotado NINGUNA punta llega a main. Esto da el desglose que se midió
// ese día a mano, y lo corre el vigía de .github/workflows/despues-del-deploy.yml con `--alarma 80` (rojo al 80 % del tope).
//
// ⚠️ ES UNA ESTIMACIÓN, por la duración de cada corrida (`run_started_at` → `updated_at`). El dato real es el panel de facturación
// de GitHub (Settings → Billing), que el GITHUB_TOKEN de Actions no puede leer. Dos números:
//   · «reloj»: la suma de las duraciones, como se midió el 6/11 (4.495 min del 1 al 6/11).
//   · «facturable»: cada corrida redondeada al minuto (GitHub factura cada JOB redondeado), 0 si se salteó o duró menos de
//     10 s (ningún job llegó a correr: una corrida cancelada en la cola, o con todos sus jobs salteados por su `if`). Un workflow
//     con varios jobs en paralelo factura más que esto: los de este repo corren un job por corrida.
// El costo es `max(0, facturable − incluidos) × precio`: US$0,006 el minuto del runner Linux de 2 núcleos (AGENTS.md), y los
// minutos incluidos del plan en 0 a propósito (si hay, la estimación avisa antes de tiempo, nunca tarde).
//
// Uso:
//   GH_TOKEN=… node scripts/minutos-actions.mjs                     # el mes en curso (UTC), koncke/mako
//   node scripts/minutos-actions.mjs --desde 2026-11-01 --hasta 2026-11-06
//   node scripts/minutos-actions.mjs --alarma 80 --resumen "$GITHUB_STEP_SUMMARY"   # el vigía: rojo (exit 1) al 80 % del tope
// Opciones: --repo dueño/nombre · --tope 30 · --precio 0.006 · --incluidos 0 · --json. También por entorno: ACTIONS_TOPE_USD,
// ACTIONS_PRECIO_MIN, ACTIONS_INCLUIDOS. El token: GH_TOKEN, GITHUB_TOKEN o `gh auth token`.
//
// ⚠️ La API de corridas devuelve como mucho 1.000 resultados por búsqueda: se pide DÍA por DÍA, y un día con más se vuelve a pedir
// workflow por workflow. «No pude leer» sale como aviso y exit 0: no es un rojo (la palabra rojo es para algo confirmado).
// =============================================================================

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DIA_MS = 86_400_000;
/** Menos que esto, ningún job llegó a correr (la corrida se canceló en la cola, o todos sus jobs se saltearon). */
export const SIN_JOB_MS = 10_000;

/** Los minutos de UNA corrida: { reloj, facturable }. Una corrida sin terminar no cuenta (todavía no se sabe). */
export function minutosDeCorrida(run) {
  if (run?.status !== 'completed') return { reloj: 0, facturable: 0, enCurso: true };
  const ini = Date.parse(run.run_started_at || run.created_at || '');
  const fin = Date.parse(run.updated_at || '');
  const ms = Number.isFinite(ini) && Number.isFinite(fin) ? Math.max(0, fin - ini) : 0;
  const reloj = ms / 60_000;
  const facturable = run.conclusion === 'skipped' || ms < SIN_JOB_MS ? 0 : Math.ceil(ms / 60_000);
  return { reloj, facturable, enCurso: false };
}

const diaUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Los días entre dos fechas YYYY-MM-DD, las dos incluidas. */
export function diasEntre(desde, hasta) {
  const out = [];
  for (let t = Date.parse(`${desde}T00:00:00Z`); t <= Date.parse(`${hasta}T00:00:00Z`); t += DIA_MS) out.push(diaUTC(t));
  return out;
}

/**
 * Junta las corridas: por workflow, por día, el total, el costo y la proyección al fin del mes de `hoy`.
 * La proyección usa el promedio de los últimos 3 días COMPLETOS antes de `hoy` (o los que haya).
 */
export function resumir(runs, o) {
  const { precio, incluidos, tope, hoy } = o;
  const porWorkflow = new Map();
  const porDia = new Map();
  let reloj = 0;
  let facturable = 0;
  let enCurso = 0;
  for (const run of runs) {
    const m = minutosDeCorrida(run);
    if (m.enCurso) { enCurso++; continue; }
    const nombre = run.name || run.path || '?';
    const w = porWorkflow.get(nombre) ?? { corridas: 0, reloj: 0, facturable: 0 };
    w.corridas++; w.reloj += m.reloj; w.facturable += m.facturable;
    porWorkflow.set(nombre, w);
    const d = String(run.created_at || '').slice(0, 10);
    const x = porDia.get(d) ?? { corridas: 0, reloj: 0, facturable: 0 };
    x.corridas++; x.reloj += m.reloj; x.facturable += m.facturable;
    porDia.set(d, x);
    reloj += m.reloj;
    facturable += m.facturable;
  }
  const costo = Math.max(0, facturable - incluidos) * precio;
  const hoyMs = Date.parse(`${hoy}T00:00:00Z`);
  const previos = [1, 2, 3].map((k) => diaUTC(hoyMs - k * DIA_MS)).filter((d) => porDia.has(d));
  const ritmo = previos.length ? previos.reduce((s, d) => s + porDia.get(d).facturable, 0) / previos.length : 0;
  const f = new Date(hoyMs);
  const finDeMes = Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 1);
  const quedan = Math.round((finDeMes - hoyMs) / DIA_MS); // hoy incluido
  const hoyHecho = porDia.get(hoy)?.facturable ?? 0;
  const proyFacturable = facturable - hoyHecho + Math.max(hoyHecho, ritmo) + ritmo * (quedan - 1);
  const proyCosto = Math.max(0, proyFacturable - incluidos) * precio;
  return {
    porWorkflow: [...porWorkflow.entries()].sort((a, b) => b[1].facturable - a[1].facturable),
    porDia: [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    reloj, facturable, enCurso, costo, tope, pct: tope > 0 ? (costo / tope) * 100 : 0,
    ritmoDiario: ritmo, proyeccion: { facturable: proyFacturable, costo: proyCosto },
  };
}

const num = (n) => Math.round(n).toLocaleString('es-AR');
const usd = (n) => `US$${n.toFixed(2).replace('.', ',')}`;

export function texto(r, o) {
  const l = [];
  l.push(`### Minutos de GitHub Actions · ${o.repo} · ${o.desde} a ${o.hasta} (UTC)`);
  l.push('');
  l.push('| Workflow | Corridas | Min. reloj | Min. facturables (est.) |');
  l.push('|---|---:|---:|---:|');
  for (const [w, x] of r.porWorkflow) l.push(`| ${w} | ${x.corridas} | ${num(x.reloj)} | ${num(x.facturable)} |`);
  l.push(`| **Total** | **${r.porWorkflow.reduce((s, [, x]) => s + x.corridas, 0)}** | **${num(r.reloj)}** | **${num(r.facturable)}** |`);
  l.push('');
  l.push('| Día | Corridas | Min. reloj | Min. facturables (est.) |');
  l.push('|---|---:|---:|---:|');
  for (const [d, x] of r.porDia) l.push(`| ${d} | ${x.corridas} | ${num(x.reloj)} | ${num(x.facturable)} |`);
  l.push('');
  l.push(`- Costo estimado: **${usd(r.costo)}** de un tope de ${usd(r.tope)} (${Math.round(r.pct)} %), a ${usd(o.precio)} el minuto y con ${num(o.incluidos)} minutos incluidos.`);
  l.push(`- Ritmo de los últimos días: ${num(r.ritmoDiario)} min/día → el mes cerraría en ~${num(r.proyeccion.facturable)} min (${usd(r.proyeccion.costo)}).`);
  if (r.enCurso) l.push(`- ${r.enCurso} corrida(s) en curso no cuentan todavía.`);
  if (o.incompletos?.length) l.push(`- ⚠️ Días con más corridas de las que la API devuelve (cuentan de menos): ${o.incompletos.join(', ')}.`);
  l.push('- Es una estimación por la duración de cada corrida: el dato real es el panel de facturación de GitHub.');
  return l.join('\n');
}

// ── La API ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function tokenDeGithub() {
  const t = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (t) return t;
  try { return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch { return null; }
}

async function pedir(base, ruta, tk) {
  const r = await fetch(`${base}${ruta}`, {
    headers: { Authorization: `Bearer ${tk}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} en ${ruta}`);
  return r.json();
}

/** Todas las corridas de una búsqueda (hasta 1.000, el techo de la API). Devuelve { runs, total }. */
async function paginar(base, ruta, tk) {
  const runs = [];
  let total = 0;
  for (let p = 1; p <= 10; p++) {
    const j = await pedir(base, `${ruta}${ruta.includes('?') ? '&' : '?'}per_page=100&page=${p}`, tk);
    total = j.total_count ?? 0;
    const lista = j.workflow_runs ?? [];
    runs.push(...lista);
    if (lista.length < 100 || runs.length >= total) break;
  }
  return { runs, total };
}

export async function leerCorridas({ base, repo, desde, hasta, tk }) {
  const runs = [];
  const incompletos = [];
  let workflows = null;
  for (const dia of diasEntre(desde, hasta)) {
    const r = await paginar(base, `/repos/${repo}/actions/runs?created=${dia}`, tk);
    if (r.runs.length >= r.total) { runs.push(...r.runs); continue; }
    // Más de 1.000 en un día: workflow por workflow.
    workflows ??= ((await pedir(base, `/repos/${repo}/actions/workflows?per_page=100`, tk)).workflows ?? []);
    for (const w of workflows) {
      const x = await paginar(base, `/repos/${repo}/actions/workflows/${w.id}/runs?created=${dia}`, tk);
      runs.push(...x.runs);
      if (x.total > x.runs.length) incompletos.push(`${dia} (${w.name})`);
    }
  }
  return { runs, incompletos };
}

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    if (k === 'json') { o.json = true; continue; }
    o[k] = argv[++i];
  }
  return o;
}

async function main() {
  const a = args(process.argv.slice(2));
  const hoy = a.hasta || diaUTC(Date.now());
  const o = {
    repo: a.repo || process.env.GITHUB_REPOSITORY || 'koncke/mako',
    desde: a.desde || `${hoy.slice(0, 7)}-01`,
    hasta: hoy,
    tope: Number(a.tope ?? process.env.ACTIONS_TOPE_USD ?? 30),
    precio: Number(a.precio ?? process.env.ACTIONS_PRECIO_MIN ?? 0.006),
    incluidos: Number(a.incluidos ?? process.env.ACTIONS_INCLUIDOS ?? 0),
    hoy,
  };
  const alarma = a.alarma != null ? Number(a.alarma) : null;
  const tk = tokenDeGithub();
  if (!tk) { console.log('::warning::Sin GH_TOKEN ni GITHUB_TOKEN: no pude leer los minutos de Actions.'); return 0; }
  let leido;
  try {
    leido = await leerCorridas({ base: process.env.GITHUB_API_URL || 'https://api.github.com', repo: o.repo, desde: o.desde, hasta: o.hasta, tk });
  } catch (e) {
    console.log(`::warning::No pude leer las corridas de Actions (${e instanceof Error ? e.message : e}): esto NO es un rojo, es «no sé».`);
    return 0;
  }
  const r = resumir(leido.runs, o);
  const t = texto(r, { ...o, incompletos: leido.incompletos });
  if (a.json) console.log(JSON.stringify({ ...o, ...r, incompletos: leido.incompletos }, null, 2));
  else console.log(t);
  if (a.resumen) { try { appendFileSync(a.resumen, `${t}\n`); } catch { /* el resumen es un favor */ } }
  if (alarma != null && r.pct >= alarma) {
    console.log(`::error::Actions va en ${usd(r.costo)} de ${usd(r.tope)} este mes (${Math.round(r.pct)} %, estimado). Al llegar al tope, ninguna punta llega a main: subí el tope en Settings → Billing o juntá las puntas.`);
    return 1;
  }
  if (r.proyeccion.costo >= r.tope) {
    console.log(`::warning::Al ritmo de los últimos días el mes cierra en ~${usd(r.proyeccion.costo)}, arriba del tope de ${usd(r.tope)} (estimado).`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c), (e) => { console.log(`::warning::minutos-actions falló: ${e instanceof Error ? e.message : e}`); process.exit(0); });
}
