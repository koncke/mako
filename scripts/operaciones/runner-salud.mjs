#!/usr/bin/env node
// =============================================================================
// runner-salud.mjs — qué cuenta es ésta y si hay Runner, sin gastar cuota (4/11/2026)
// =============================================================================
// Martín, 4/11: «Te lo tengo que pedir cada que entro en una cuenta y eso debería ser automático. Y supongo que si no está
// el runner tampoco recibe mensajes, eso no debe pasar...».
//
// LA CUENTA. La app le pone a cada chat CLAUDE_CODE_ACCOUNT_UUID, y ese uuid es la carpeta de claude-code-sessions que
// config.json → `carpetas` ya traduce a claudeN. El marcador deja de ser algo que alguien declara: lo corrige cada chat que
// abre. Un uuid que no está en la tabla no se adivina: se dice.
// ⚠️ SÓLO UN CHAT QUE ARRANCA (`source: startup`). SessionStart también corre al compactar y al retomar, y un proceso guarda
// el uuid del día que arrancó: uno abierto antes de cambiar de cuenta, al compactar, devolvería el marcador a la anterior y
// todos firmarían mal. Lo vio el Cerebro leyendo el código (4/11); pasó algo parecido el 27/09.
//
// EL RUNNER. Vivo es DOS cosas juntas, porque cada una sola ya mintió:
//   · un chat llamado Runner, abierto y de ESTA cuenta (al cambiar de cuenta, el de la otra sigue vivo y no le llega a nadie);
//   · `continuo.latido` fresco: un chat que se llama Runner sin su cron ni su Monitor no entrega nada (3/11-4/11: 30 horas así).
//
// QUIÉN LO LEVANTA. Un script no puede: SendMessage, get_usage y CronCreate sólo los llama un chat. Lo levanta la tarea
// programada `runner-guardia-<cuenta>`, que vive fuera de todo chat y es por cuenta (scheduled-tasks.json). Su corrida se
// convierte en el Runner si no hay uno: guardia-runner.md. Este archivo sólo mide y avisa: nunca reclama ni entrega.
//
// Uso:  runner-salud.mjs al-abrir <source>   lo corre el hook SessionStart: corrige el marcador e imprime UNA línea para el chat, o nada
//       runner-salud.mjs estado     el JSON que lee la guardia
//       runner-salud.mjs tomar      la guardia reclama el puesto: TOMADO u OCUPADO (dos corridas a la vez no levantan dos Runners)
//       runner-salud.mjs corridas   las corridas de la guardia ya terminadas: cada una deja un chat en la lista y un proceso de ~270 MB. Sólo lista: archivar sesiones pide el sí de Martín
//
// Un hook no frena a nadie: `al-abrir` ante cualquier error no imprime nada y sale con 0.
// =============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HOME = os.homedir();
const DIR = process.env.CARTERO_DIR || path.join(HOME, '.claude', 'operaciones');
const APP = process.env.CARTERO_APP_DIR || path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'Claude', 'claude-code-sessions');
const SESIONES = process.env.RUNNER_SESIONES_DIR || path.join(HOME, '.claude', 'sessions');
const MARCADOR = process.env.CUENTA_MARCADOR || path.join(HOME, '.claude', 'cuenta-activa.txt');
const LOG = path.join(DIR, 'runner-salud.log');

/** Más que los 4 min de CARTERO_VIVO_MS: entre que el Monitor vence y se re-arma pasan ~2 min, y eso no es un Runner muerto. */
export const LATIDO_VIVO_MS = 6 * 60 * 1000;
/** La vuelta del Runner mide cada 10 min: pasado esto, nadie está midiendo. */
export const MEDIDO_VIEJO_MS = 30 * 60 * 1000;
/** De los chats que abren juntos, sólo el primero recibe el aviso o el encargo. */
const PEDIDA_VENCE_MS = 10 * 60 * 1000;
/** Una corrida sin actividad en este rato ya terminó: las medidas duran menos de un minuto. */
const CORRIDA_TERMINADA_MS = 5 * 60 * 1000;
/** Lo que tarda una corrida en armar el cron y el Monitor: pasado esto, otra puede intentarlo. */
const TOMA_VENCE_MS = 10 * 60 * 1000;

const leerJson = (f, si) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return si; } };
const haceMs = (f, ahora) => { try { return ahora - fs.statSync(f).mtimeMs; } catch { return Infinity; } };
const vive = (pid) => { try { process.kill(Number(pid), 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const anotar = (linea) => { try { fs.appendFileSync(LOG, `${new Date().toISOString()} ${linea}\n`); } catch { /* el log no frena */ } };

/** El mismo criterio de `esElCartero` en cartero.mjs: se mira el último tramo del título. */
export const esRunner = (nombre) => /^(runner|cartero)\b/i.test(String(nombre ?? '').split(/[›>]/).pop().trim());
/** La tarea se llama «Guardia > Runner»: cartero.mjs la deja entregar sin renombrarla, porque renombrar puede estar vedado en una corrida sin nadie. */
export const esGuardia = (nombre) => /^guardia\b/i.test(String(nombre ?? '').trim());
export const idDeLaGuardia = (cuenta) => `runner-guardia-${cuenta}`;

/** La cuenta de este chat, medida. `cuenta: null` con uuid es una cuenta que nadie declaró; sin uuid, un chat que no es de la app. */
export function cuentaDelEntorno(env, cfg) {
  const uuid = env.CLAUDE_CODE_ACCOUNT_UUID || null;
  if (!uuid) return { cuenta: null, uuid: null };
  const carpetas = cfg?.carpetas ?? {};
  return { cuenta: carpetas[uuid] ?? carpetas[uuid.slice(0, 8)] ?? null, uuid };
}

const leerMarcador = () => { try { return fs.readFileSync(MARCADOR, 'utf8').trim().split(/\s+/)[0] || null; } catch { return null; } };

/** Devuelve la cuenta anterior si la corrigió. El rename evita que `head -1` de otro hook lea un archivo a medio escribir. */
export function corregirMarcador(cuenta) {
  const antes = leerMarcador();
  if (!cuenta || antes === cuenta) return null;
  const t = `${MARCADOR}.${process.pid}.tmp`;
  fs.writeFileSync(t, `${cuenta}\n`);
  fs.renameSync(t, MARCADOR);
  anotar(`marcador ${antes ?? '(vacío)'} → ${cuenta}`);
  return antes ?? '(vacío)';
}

/** Los archivos local_*.json de una cuenta: el chat es de ella si su archivo vive en su carpeta. */
function chatsDeLaCuenta(uuid) {
  const out = new Map();
  const raiz = path.join(APP, uuid);
  let orgs = [];
  try { orgs = fs.readdirSync(raiz, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { return out; }
  for (const o of orgs) {
    let ents = [];
    try { ents = fs.readdirSync(path.join(raiz, o.name)); } catch { continue; }
    for (const e of ents) if (/^local_.*\.json$/.test(e)) out.set(e.slice(0, -5), path.join(raiz, o.name, e));
  }
  return out;
}

export function runnerDeLaCuenta({ uuid, ahora = Date.now() }) {
  let archivos = [];
  try { archivos = fs.readdirSync(SESIONES).filter((f) => /^\d+\.json$/.test(f)); } catch { /* sin registro: sin Runner */ }
  const deLaCuenta = uuid ? chatsDeLaCuenta(uuid) : null;
  const puesto = leerJson(path.join(DIR, 'guardia-puesto.json'), null)?.chat ?? null;
  const chats = [];
  for (const f of archivos) {
    const s = leerJson(path.join(SESIONES, f), null);
    if (!s || !esRunner(s.name) || !vive(s.pid)) continue;
    if (esGuardia(s.name) && s.hostSessionId !== puesto) continue; // una corrida de la guardia es el Runner sólo si tomó el puesto
    if (deLaCuenta && !deLaCuenta.has(s.hostSessionId)) continue;
    chats.push(s.hostSessionId ?? s.sessionId);
  }
  const ms = haceMs(path.join(DIR, 'continuo.latido'), ahora);
  const latidoMin = Number.isFinite(ms) ? Math.round(ms / 60000) : null;
  if (!chats.length) return { vivo: false, motivo: 'no hay un chat Runner abierto en esta cuenta', chats, latidoMin };
  if (ms >= LATIDO_VIVO_MS) return { vivo: false, motivo: latidoMin == null ? 'el chat Runner nunca dio una vuelta' : `el chat Runner esta abierto pero no da vueltas hace ${latidoMin} min`, chats, latidoMin };
  return { vivo: true, motivo: null, chats, latidoMin };
}

/** La tarea es por cuenta y por organización. Sin organización se mira cualquiera de la cuenta. */
export function tareaDeLaCuenta({ uuid, cuenta, org = null }) {
  const raiz = path.join(APP, uuid);
  let orgs = [];
  if (org) orgs = [org];
  else { try { orgs = fs.readdirSync(raiz); } catch { /* nada */ } }
  for (const o of orgs) {
    const t = (leerJson(path.join(raiz, o, 'scheduled-tasks.json'), null)?.scheduledTasks ?? []).find((x) => x.id === idDeLaGuardia(cuenta));
    if (t) return { existe: true, prendida: t.enabled !== false };
  }
  return { existe: false, prendida: false };
}

function medidoMin(cuenta, ahora) {
  const t = Date.parse(leerJson(path.join(DIR, 'uso', `${cuenta}.json`), null)?.medido ?? '');
  return Number.isFinite(t) ? Math.round((ahora - t) / 60000) : null;
}

export function estado(env = process.env, ahora = Date.now()) {
  const cfg = leerJson(path.join(DIR, 'config.json'), null);
  const { cuenta, uuid } = cuentaDelEntorno(env, cfg);
  const min = cuenta ? medidoMin(cuenta, ahora) : null;
  return {
    cuenta, uuid, marcador: leerMarcador(),
    runner: runnerDeLaCuenta({ uuid, ahora }),
    medidoMin: min,
    medirYa: min == null || min * 60000 >= MEDIDO_VIEJO_MS,
  };
}

/** `wx` es atómico. Un reclamo viejo es de una corrida que murió antes de armar nada. */
function tomarUnaVez(archivo, venceMs, ahora) {
  if (haceMs(archivo, ahora) >= venceMs) fs.rmSync(archivo, { force: true });
  try { fs.writeFileSync(archivo, String(process.pid), { flag: 'wx' }); return true; } catch { return false; }
}

export function tomarPuesto(env = process.env, ahora = Date.now()) {
  if (!tomarUnaVez(path.join(DIR, 'guardia-toma'), TOMA_VENCE_MS, ahora)) return false;
  fs.writeFileSync(path.join(DIR, 'guardia-puesto.json'), JSON.stringify({ chat: env.CLAUDE_CODE_HOST_SESSION_ID ?? null, at: new Date(ahora).toISOString() }));
  return true;
}

/** Las corridas de la guardia sin archivar que ya terminaron. La que tomó el puesto es el Runner, y la que sigue activa puede estar por tomarlo. */
export function corridasTerminadas(env = process.env, ahora = Date.now()) {
  const uuid = env.CLAUDE_CODE_ACCOUNT_UUID;
  if (!uuid) return [];
  const puesto = leerJson(path.join(DIR, 'guardia-puesto.json'), null)?.chat ?? null;
  const out = [];
  for (const [id, f] of chatsDeLaCuenta(uuid)) {
    const o = leerJson(f, null);
    if (!o || o.isArchived || id === puesto || !esGuardia(o.title)) continue;
    if (ahora - Number(o.lastActivityAt ?? 0) >= CORRIDA_TERMINADA_MS) out.push(id);
  }
  return out;
}

/** El nombre de este chat, si ya está registrado. Una corrida de la guardia y el Runner no reciben encargos sobre sí mismos. */
function nombrePropio(env) {
  const pid = Number(env.CLAUDE_PID);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  return leerJson(path.join(SESIONES, `${pid}.json`), null)?.name ?? null;
}

/** La línea para el chat que abre. Va adentro de un JSON armado a mano en bitacora-sesion.sh: sin comillas, sin barras y sin saltos. */
export function alAbrir(origen, env = process.env, ahora = Date.now()) {
  if (origen !== 'startup') return '';
  const cfg = leerJson(path.join(DIR, 'config.json'), null);
  const { cuenta, uuid } = cuentaDelEntorno(env, cfg);
  if (!uuid) return '';
  if (!cuenta) {
    return `CUENTA SIN DECLARAR: la app corre con la cuenta ${uuid}, que no esta en operaciones/config.json, y por eso el marcador no se toco. Antes de firmar un commit: get_usage, compara el reinicio semanal con operaciones/uso/claude*.json sumando de a 7 dias, y sumala con cartero.mjs carpeta ${uuid} claudeN. Si no cierra, preguntale a Martin.`;
  }
  const corregida = corregirMarcador(cuenta);
  const partes = corregida ? [`El marcador decia ${corregida} y la app corre con ${cuenta}: ya lo corregi.`] : [];
  const nombre = nombrePropio(env);
  if (esRunner(nombre) || esGuardia(nombre)) return partes.join(' ');
  const tarea = tareaDeLaCuenta({ uuid, cuenta, org: env.CLAUDE_CODE_ORGANIZATION_UUID ?? null });
  const runner = runnerDeLaCuenta({ uuid, ahora });
  if (runner.vivo && tarea.existe) return partes.join(' ');
  if (!tomarUnaVez(path.join(DIR, `guardia-pedida.${cuenta}`), PEDIDA_VENCE_MS, ahora)) return partes.join(' ');
  if (!tarea.existe) {
    partes.push(`ESTA CUENTA (${cuenta}) NO TIENE LA GUARDIA DEL RUNNER: antes de contestar, lee ~/.claude/operaciones/guardia-runner.md, seccion Crear la guardia, y hacelo. Sin eso lo que Martin escribe en el Ops Center no le llega a nadie. No hace falta comentarselo.`);
  } else if (!runner.vivo) {
    partes.push(`NO HAY RUNNER EN ${cuenta} (${runner.motivo}): lo que Martin escribe en el Ops Center sale recien cuando se levante. Lo levanta sola la tarea ${idDeLaGuardia(cuenta)} en su proxima corrida, en menos de 30 minutos, y Martin puede adelantarla con Run now en Scheduled. No tenes que hacer nada: si pregunta por un mensaje suyo, decile esto.`);
  }
  anotar(`al-abrir ${cuenta}: tarea=${tarea.existe} runner=${runner.vivo}`);
  return partes.join(' ');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const cmd = process.argv[2];
  if (cmd === 'al-abrir') {
    let linea = '';
    try { linea = alAbrir(process.argv[3]); } catch (e) { anotar(`al-abrir falló: ${e instanceof Error ? e.message : String(e)}`); }
    if (linea) process.stdout.write(`${linea}\n`);
  } else if (cmd === 'estado') {
    process.stdout.write(`${JSON.stringify(estado(), null, 1)}\n`);
  } else if (cmd === 'corridas') {
    process.stdout.write(`${JSON.stringify(corridasTerminadas())}\n`);
  } else if (cmd === 'tomar') {
    const si = tomarPuesto();
    if (si) anotar('la guardia tomó el puesto de Runner');
    process.stdout.write(si ? 'TOMADO\n' : 'OCUPADO\n');
  } else {
    process.stderr.write('uso: runner-salud.mjs al-abrir <source> | estado | tomar | corridas\n');
    process.exitCode = 2;
  }
}
