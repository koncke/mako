#!/usr/bin/env node
// =============================================================================
// vigia-ci.mjs — ninguna corrida roja de GitHub pasa sin que un chat se entere
// =============================================================================
// Martín, 03/11/2026: «Siempre tienes que revisar cuando un action falló... Siempre, crea un proceso donde te avise, que
// funcione en todas las cuentas». Ese día hubo ocho rojos seguidos, y yo los miraba sólo cuando se me ocurría.
//
// `leer`: pregunta a GitHub y deja ci-estado.json, con la credencial de git de esta PC, no la de una cuenta de Claude.
// `aviso` (hook de Claude, en cada turno y al arrancar, en todas las cuentas): lo que esté rojo y sin resolver, a ese chat. Si lo
//         leído tiene más de 2 minutos, lanza un `leer` aparte, sin hacer esperar el turno.
// `esperar` (el Cerebro, en segundo plano): lee cada 2 minutos y termina cuando aparece un rojo nuevo: eso lo despierta aunque esté
//         callado. Sin ningún chat abierto nadie lee: un rojo se ve al abrir el próximo.
// `visto <corrida>`: ya lo está resolviendo alguien; no se vuelve a avisar.
//
// ⚠️ «NO PUDE LEER» NO ES «ESTÁ TODO VERDE»: con la API caída o sin credencial, el aviso lo dice.
// ⚠️ Un rojo queda hasta que una corrida posterior de la MISMA rama y el mismo flujo dé verde, o hasta `visto`.
// =============================================================================

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'koncke/mako';
const DIR = path.join(homedir(), '.claude', 'guardia');
const ESTADO = path.join(DIR, 'ci-estado.json');
const VISTOS = path.join(DIR, 'ci-vistos.json');
const AVISADOS = path.join(DIR, 'ci-avisados');
const VIEJO_MS = 24 * 3600_000; // Lo de hace más de un día no se avisa la primera vez: no es noticia.
const REAVISO_MS = 30 * 60_000;
const CADA_MS = 2 * 60_000;
const LOCK = path.join(DIR, 'ci-leyendo');

const leerJson = (p, def) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return def; } };
const guardarJson = (p, v) => { const t = `${p}.${process.pid}.tmp`; writeFileSync(t, JSON.stringify(v, null, 1)); renameSync(t, p); };

function token() {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', timeout: 20_000,
    env: { ...process.env, GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0' }, windowsHide: true,
  });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error('sin credencial de GitHub');
  return m[1].trim();
}

async function api(ruta, t, texto = false) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${ruta}`, {
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} en ${ruta.slice(0, 60)}`);
  return texto ? r.text() : r.json();
}

/** Por qué falló, sin pegar el log: el paso, los tests y los errores de tipos. Sin leerlo, igual se avisa. */
async function detalle(run, t) {
  const d = { paso: null, tests: [], tipos: 0, url: run.html_url };
  try {
    const { jobs } = await api(`/actions/runs/${run.id}/jobs`, t);
    const j = (jobs ?? []).find((x) => x.conclusion === 'failure') ?? jobs?.[0];
    d.paso = j?.steps?.find((s) => s.conclusion === 'failure')?.name ?? null;
    if (!j) return d;
    // ⚠️ UN JOB QUE NO ARRANCA NO TIENE PASOS NI REGISTRO (7/11/2026). Con el tope de gasto agotado o un pago
    // rechazado, GitHub falla el job SIN ejecutar nada: el log da `BlobNotFound` y este aviso salía «sin detalle».
    // El motivo real SÍ existe, en las ANOTACIONES del check («The job was not started because recent account
    // payments have failed or your spending limit needs to be increased»). Sin esto, cada chat sale a buscar en su
    // propio código un error que no está — esa noche pasó con seis ramas, y una se reintentó tres veces.
    // La señal para mirar acá es que NINGÚN paso figure como fallado.
    if (!d.paso && !(j.steps ?? []).length) {
      const an = await api(`/check-runs/${j.id}/annotations`, t).catch(() => null);
      const mala = (Array.isArray(an) ? an : []).find((a) => a?.annotation_level === 'failure' && a?.message);
      if (mala) { d.motivo = String(mala.message).replace(/\s+/g, ' ').trim().slice(0, 240); return d; }
    }
    const log = await api(`/actions/jobs/${j.id}/logs`, t, true);
    d.tipos = (log.match(/error TS\d+/g) ?? []).length;
    const rep = log.match(/Repetilos solos: node --import tsx --test ([^\r\n]+)/);
    if (rep) d.tests = rep[1].trim().split(/\s+/).slice(0, 8);
    d.fallas = [...new Set([...log.matchAll(/✖ ([^\r\n]{5,110})/g)].map((m) => m[1]).filter((x) => !/failing tests|ROJO/.test(x)))].slice(0, 5);
  } catch (e) { d.sinDetalle = e instanceof Error ? e.message : String(e); }
  return d;
}

export function rojosSinResolver(runs, vistos, ahora = Date.now()) {
  const ordenadas = [...runs].sort((a, b) => Date.parse(b.run_started_at ?? b.created_at) - Date.parse(a.run_started_at ?? a.created_at));
  const verdeDespues = new Set();
  const salida = [];
  for (const r of ordenadas) {
    const clave = `${r.workflow_id}|${r.head_branch}`;
    if (r.status === 'completed' && r.conclusion === 'success') { verdeDespues.add(clave); continue; }
    if (r.status !== 'completed' || r.conclusion !== 'failure') continue;
    if (verdeDespues.has(clave)) continue;
    // ⚠️ Marcar visto el último rojo tapa también los anteriores de esa rama: si no, al hacer `visto` aparecía el de antes.
    if (vistos.includes(r.id)) { verdeDespues.add(clave); continue; }
    // De cada rama, sólo el último rojo: los anteriores ya los tapa ése.
    if (salida.some((x) => x.clave === clave)) continue;
    if (ahora - Date.parse(r.updated_at) > VIEJO_MS) continue;
    salida.push({ clave, id: r.id, numero: r.run_number, flujo: r.name, rama: r.head_branch, sha: r.head_sha.slice(0, 9), cuando: r.updated_at, url: r.html_url });
  }
  return salida;
}

async function leer() {
  mkdirSync(DIR, { recursive: true });
  const previo = leerJson(ESTADO, { rojos: [] });
  try {
    const t = token();
    const { workflow_runs: runs } = await api('/actions/runs?per_page=60', t);
    const vistos = leerJson(VISTOS, []);
    const rojos = rojosSinResolver(runs ?? [], vistos);
    for (const r of rojos) {
      const ya = (previo.rojos ?? []).find((x) => x.id === r.id);
      r.detalle = ya?.detalle ?? (await detalle({ id: r.id, html_url: r.url }, t));
    }
    guardarJson(ESTADO, { leidoAt: new Date().toISOString(), rojos, enCurso: (runs ?? []).filter((x) => x.status !== 'completed').length });
  } catch (e) {
    guardarJson(ESTADO, { ...previo, errorAt: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) });
    process.exitCode = 1;
  }
}

function lineaDe(r) {
  const d = r.detalle ?? {};
  // `motivo` va PRIMERO y solo: cuando el job no arrancó, no hay paso ni tests que contar, y lo único que importa
  // es que quien lea esto NO salga a buscar el error en su código.
  const por = d.motivo
    ? `el trabajo NO ARRANCÓ (no es tu código) — ${d.motivo}`
    : [d.paso && `paso «${d.paso}»`, d.tipos ? `${d.tipos} errores de tipos` : null, d.fallas?.length ? d.fallas.join(' · ') : null, d.tests?.length ? `repetir: ${d.tests.join(' ')}` : null].filter(Boolean).join(' — ');
  return `corrida ${r.numero} de «${r.flujo}», rama ${r.rama}, ${r.sha}: ${por || 'sin detalle'} (${r.url})`;
}

/** ¿Lo leído ya venció, y nadie lo está leyendo? (el lock vence solo: un `leer` que murió no traba a los demás). */
function tocaLeer(e) {
  const hace = e?.leidoAt ? Date.now() - Date.parse(e.leidoAt) : Infinity;
  const intento = e?.errorAt ? Date.now() - Date.parse(e.errorAt) : Infinity;
  if (Math.min(hace, intento) < CADA_MS) return false;
  try { if (Date.now() - statSync(LOCK).mtimeMs < 3 * 60_000) return false; } catch { /* sin lock */ }
  writeFileSync(LOCK, String(process.pid));
  return true;
}

function aviso() {
  let entrada = {};
  try { entrada = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* sin entrada */ }
  const evento = entrada.hook_event_name ?? 'UserPromptSubmit';
  const sesion = String(entrada.session_id ?? 'sin-sesion').replace(/[^\w-]/g, '').slice(0, 60);
  const e = leerJson(ESTADO, null);
  const partes = [];
  if (tocaLeer(e)) spawn(process.execPath, [fileURLToPath(import.meta.url), 'leer'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  mkdirSync(AVISADOS, { recursive: true });
  const marca = path.join(AVISADOS, `${sesion}.json`);
  const ya = leerJson(marca, {});
  if (e?.error && Date.now() - (ya.sinLeer ?? 0) > REAVISO_MS) {
    partes.push(`⚠️ NO SÉ CÓMO ESTÁ GITHUB: la última lectura falló (${e.error}). No es «todo verde».`);
    ya.sinLeer = Date.now();
  }
  const nuevos = (e?.rojos ?? []).filter((r) => Date.now() - (ya[r.id] ?? 0) > REAVISO_MS);
  if (nuevos.length) {
    partes.push(`⛔ GITHUB EN ROJO. Regla de Martín: un action que falla se revisa SIEMPRE, antes de seguir. Si sos el Cerebro o es tu rama, léelo y arréglalo ahora; si no, sigue con lo tuyo y no lo toques. Al tomarlo: node "$HOME/.claude/guardia/vigia-ci.mjs" visto <id>.\n${nuevos.slice(0, 4).map((r) => `- id ${r.id}: ${lineaDe(r)}`).join('\n')}`);
    for (const r of nuevos) ya[r.id] = Date.now();
  }
  if (partes.length) guardarJson(marca, ya);
  if (evento === 'SessionStart') partes.push('Si sos el Cerebro, deja armado en segundo plano: node "$HOME/.claude/guardia/vigia-ci.mjs" esperar — termina al aparecer un rojo nuevo y te despierta; después se vuelve a armar.');
  if (partes.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: evento, additionalContext: partes.join('\n') } }) + '\n');
}

async function esperar() {
  const conocidos = new Set((leerJson(ESTADO, { rojos: [] }).rojos ?? []).map((r) => r.id));
  for (;;) {
    await new Promise((r) => setTimeout(r, 30_000));
    if (tocaLeer(leerJson(ESTADO, null))) await leer();
    const e = leerJson(ESTADO, { rojos: [] });
    const nuevos = (e.rojos ?? []).filter((r) => !conocidos.has(r.id));
    if (nuevos.length) {
      console.log(`⛔ ROJO NUEVO EN GITHUB. Léelo ahora y vuelve a armar este vigía.\n${nuevos.map((r) => `- id ${r.id}: ${lineaDe(r)}`).join('\n')}`);
      return;
    }
    // 10/11/2026: un corte suelto (git credential lento con la PC cargada, o el estado tomado por otro proceso) no corta el
    // vigía: el 10/11 se cayó cinco veces así con la lectura siguiente en verde. Sólo avisa si hace 15 min que no lee bien.
    const sinLeerBien = e.leidoAt ? Date.now() - Date.parse(e.leidoAt) : Infinity;
    if (e.error && sinLeerBien > 15 * 60_000) {
      console.log(`⚠️ El vigía de GitHub no pudo leer (${e.error}): no puedo saber si hay rojos. Míralo y vuelve a armar este vigía.`);
      return;
    }
  }
}

function visto(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) { console.error('uso: vigia-ci.mjs visto <id de la corrida>'); process.exitCode = 1; return; }
  const v = leerJson(VISTOS, []);
  if (!v.includes(n)) guardarJson(VISTOS, [...v, n].slice(-200));
  const e = leerJson(ESTADO, { rojos: [] });
  guardarJson(ESTADO, { ...e, rojos: (e.rojos ?? []).filter((r) => r.id !== n) });
  console.log(`visto: ${n}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'leer') await leer();
else if (cmd === 'aviso') { try { aviso(); } catch { /* un hook nunca frena un turno */ } }
else if (cmd === 'esperar') await esperar();
else if (cmd === 'visto') visto(arg);
else if (cmd === 'estado') console.log(existsSync(ESTADO) ? JSON.stringify({ ...leerJson(ESTADO, {}), edadSeg: Math.round((Date.now() - statSync(ESTADO).mtimeMs) / 1000) }, null, 1).slice(0, 2500) : 'sin estado');
else { console.error('uso: vigia-ci.mjs leer | aviso | esperar | visto <id> | estado'); process.exitCode = 1; }
