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
// QUIÉN ENTREGA SIN RUNNER. Un script no puede: SendMessage, send_message y get_usage sólo los llama un chat. Entrega la tarea
// programada `runner-guardia-<cuenta>`, que vive fuera de todo chat y es por cuenta (scheduled-tasks.json), con una vuelta por
// corrida: guardia-runner.md. ⚠️ NO PUEDE SER EL RUNNER (4/11): una corrida no tiene canal de mensajes (sin `messagingSocketPath`
// en su sessions/<pid>.json), y su SendMessage a `uds:` contesta «Cross-session messaging is not available in this session». Sí
// anda send_message, que va por la app y pide el id del chat: `destino` lo saca del pipe. Este archivo nunca reclama ni entrega.
//
// Uso:  runner-salud.mjs al-abrir <source>   lo corre el hook SessionStart: corrige el marcador e imprime UNA línea para el chat, o nada
//       runner-salud.mjs estado     el JSON que lee la guardia (con `cron`: si la vuelta del cron del Runner sigue corriendo)
//       runner-salud.mjs latido-del-cron   lo corre la vuelta del CRON del Runner, primero (LEEME-cartero.md): deja la marca con hora
//       runner-salud.mjs tomar      la corrida reclama la vuelta: TOMADO u OCUPADO (dos a la vez no entregan lo mismo)
//       runner-salud.mjs destino <to>   el id del chat de un `uds:`, para send_message; SIN_DESTINO si ese chat no está abierto
//       runner-salud.mjs avisar     AVISAR una vez cada 2 horas por cuenta, YA el resto: lo que se le dice al Cerebro sin gastarle cuota
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
/**
 * La vuelta del CRON del Runner corre cada 10 min y deja su marca (`latido-del-cron`): sin una en este rato, el cron no corre.
 * Una hora y no 30 min: con el Runner ocupado (las caricaturas de Spy) la vuelta se corre, y una alarma que salta con el cron
 * sano le hace rearmar algo que anda.
 */
export const CRON_VIVO_MS = 60 * 60 * 1000;
export const marcaDelCron = (cuenta) => path.join(DIR, `runner-cron.${cuenta}`);
/** La palabra que el LEEME del cartero tiene que nombrar para que la falta de marca cuente: la del comando de la vuelta. */
export const COMANDO_LATIDO_CRON = 'latido-del-cron';
const LEEME_CARTERO = () => path.join(DIR, 'LEEME-cartero.md');
/** De los chats que abren juntos, sólo el primero recibe el aviso o el encargo. */
const PEDIDA_VENCE_MS = 10 * 60 * 1000;
/** Una corrida sin actividad en este rato ya terminó: las medidas duran menos de dos minutos. */
const CORRIDA_TERMINADA_MS = 5 * 60 * 1000;
/** Mientras no haya Runner, el Cerebro lo sabe una vez cada este rato: cada aviso le gasta un turno. */
const AVISO_VENCE_MS = 2 * 60 * 60 * 1000;
/** Lo que dura una corrida entregando: pasado esto, otra puede intentarlo. */
const TOMA_VENCE_MS = 10 * 60 * 1000;

const leerJson = (f, si) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return si; } };
const haceMs = (f, ahora) => { try { return ahora - fs.statSync(f).mtimeMs; } catch { return Infinity; } };
const vive = (pid) => { try { process.kill(Number(pid), 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const anotar = (linea) => { try { fs.appendFileSync(LOG, `${new Date().toISOString()} ${linea}\n`); } catch { /* el log no frena */ } };

/** El mismo criterio de `esElCartero` en cartero.mjs: se mira el último tramo del título. */
export const esRunner = (nombre) => /^(runner|cartero)\b/i.test(String(nombre ?? '').split(/[›>]/).pop().trim());
/** La tarea se llama «Guardia > Runner»: cartero.mjs la deja dar una vuelta, y acá no cuenta como el Runner, que tiene que poder entregar en segundos. */
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
  const chats = [];
  for (const f of archivos) {
    const s = leerJson(path.join(SESIONES, f), null);
    if (!s || !esRunner(s.name) || !vive(s.pid)) continue;
    if (esGuardia(s.name)) continue;
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

/**
 * ¿La vuelta del CRON del Runner sigue corriendo? (pendiente T6, 18/11/2026). El cron de sesión vence a los 7 días (el del
 * 4/11 vencía el 11/11) y el Runner rearma su Monitor cada vez que vence, así que `continuo.latido` sigue fresco: «vivo» decía
 * que sí mientras el vigía (que corre sólo desde el cron) y la medición del Runner se habían apagado. La guardia medía por él
 * (`medirYa`) y eso lo tapaba. Un script no puede llamar a CronList: lo que cuenta es la marca que deja la vuelta del cron con
 * `latido-del-cron`, su primer paso (LEEME-cartero.md).
 * ⚠️ NO SE COLGÓ DE `medir` (la revisión adversarial del 18/11): `medir` falla con la huella de la semana y si `get_usage` falla
 *    (falsa alarma con el cron sano), y lo corre también cualquier chat al que el hook le pide medir, el Runner incluido (con el
 *    cron muerto, eso apagaba la alarma). Y la cuenta de la marca sale del ENTORNO del chat (`cuentaDelEntorno`), no del marcador.
 *   · `al_dia`: la marca tiene menos de `CRON_VIVO_MS`.
 *   · `vencido`: la marca existe y es más vieja; o no hubo nunca una, pero el LEEME ya pide el latido desde hace más de
 *     `CRON_VIVO_MS` (`nunca: true`): el cron murió antes de poder dejarla, que es justo el caso del título del pendiente.
 *   · `sin_dato`: nunca hubo marca y el LEEME no pide el latido (un cartero de antes): callarse es lo correcto, no alarmar.
 */
export function cronDelRunner({ cuenta, ahora = Date.now() }) {
  if (!cuenta) return { estado: 'sin_dato', min: null };
  let t = NaN;
  let hay = true;
  try { t = Date.parse(fs.readFileSync(marcaDelCron(cuenta), 'utf8').trim()); } catch { hay = false; }
  if (!hay) {
    let leeme = '';
    try { leeme = fs.readFileSync(LEEME_CARTERO(), 'utf8'); } catch { /* sin LEEME: un cartero de antes */ }
    const desde = haceMs(LEEME_CARTERO(), ahora);
    if (leeme.includes(COMANDO_LATIDO_CRON) && desde >= CRON_VIVO_MS) return { estado: 'vencido', min: null, nunca: true };
    return { estado: 'sin_dato', min: null };
  }
  if (!Number.isFinite(t)) { const ms = haceMs(marcaDelCron(cuenta), ahora); t = Number.isFinite(ms) ? ahora - ms : NaN; }
  if (!Number.isFinite(t)) return { estado: 'sin_dato', min: null };
  const min = Math.max(0, Math.round((ahora - t) / 60000));
  return { estado: ahora - t < CRON_VIVO_MS ? 'al_dia' : 'vencido', min };
}

/**
 * El primer paso de cada vuelta del cron del Runner. Escribe la marca de la cuenta de ESTE chat sólo si este chat es el Runner:
 * la guardia («Guardia > Runner») mide por él y otro chat puede correrlo por error, y cualquiera de los dos taparía un cron
 * muerto. Devuelve qué hizo, para la salida del comando.
 */
export function latidoDelCron(env = process.env, ahora = Date.now()) {
  const { cuenta } = cuentaDelEntorno(env, leerJson(path.join(DIR, 'config.json'), null));
  if (!cuenta) return 'SIN_CUENTA';
  const nombre = nombrePropio(env);
  if (!esRunner(nombre) || esGuardia(nombre)) return 'NO_ES_EL_RUNNER';
  fs.writeFileSync(marcaDelCron(cuenta), new Date(ahora).toISOString());
  return 'MARCADO';
}

function medidoMin(cuenta, ahora) {
  const t = Date.parse(leerJson(path.join(DIR, 'uso', `${cuenta}.json`), null)?.medido ?? '');
  return Number.isFinite(t) ? Math.round((ahora - t) / 60000) : null;
}

export function estado(env = process.env, ahora = Date.now()) {
  const cfg = leerJson(path.join(DIR, 'config.json'), null);
  const { cuenta, uuid } = cuentaDelEntorno(env, cfg);
  const min = cuenta ? medidoMin(cuenta, ahora) : null;
  // ⚠️ LA TAREA TAMBIÉN VA EN EL ESTADO (6/11/2026). `estado` es el JSON que lee la guardia, y no decía NADA de su propia
  // tarea: si el reloj del Runner vence sin rearmarse, la medición sigue por `medirYa` y el vigía se apaga **en silencio**.
  // `tareaDeLaCuenta` ya existía y ya devolvía `prendida`; nadie la miraba desde acá.
  // ⚠️ Y EL CRON DEL RUNNER (18/11/2026, pendiente T6): `cronVencido` es el único caso en que la guardia tiene que avisar con el
  // Runner «vivo». Sin esto, la guardia medía por él y el vigía quedaba apagado sin que nadie lo dijera.
  const runner = runnerDeLaCuenta({ uuid, ahora });
  const cron = cronDelRunner({ cuenta, ahora });
  return {
    cuenta, uuid, marcador: leerMarcador(),
    runner,
    cron,
    cronVencido: runner.vivo && cron.estado === 'vencido',
    tarea: cuenta ? tareaDeLaCuenta({ uuid, cuenta, org: env.CLAUDE_CODE_ORGANIZATION_UUID ?? null }) : { existe: false, prendida: false },
    medidoMin: min,
    medirYa: min == null || min * 60000 >= MEDIDO_VIEJO_MS,
  };
}

/** `wx` es atómico. Un reclamo viejo es de una corrida que murió antes de armar nada. */
function tomarUnaVez(archivo, venceMs, ahora) {
  if (haceMs(archivo, ahora) >= venceMs) fs.rmSync(archivo, { force: true });
  try { fs.writeFileSync(archivo, String(process.pid), { flag: 'wx' }); return true; } catch { return false; }
}

export const tomarVuelta = (ahora = Date.now()) => tomarUnaVez(path.join(DIR, 'guardia-toma'), TOMA_VENCE_MS, ahora);

export const avisarUnaVez = (cuenta, ahora = Date.now()) => tomarUnaVez(path.join(DIR, `guardia-avisada.${cuenta}`), AVISO_VENCE_MS, ahora);

/** El chat de un `uds:` que trae lo del buzón: send_message pide el id, y el pipe sólo está en el registro de sesiones. */
export function destinoDelPipe(to) {
  const pipe = String(to ?? '').replace(/^uds:/, '');
  if (!pipe) return null;
  let archivos = [];
  try { archivos = fs.readdirSync(SESIONES).filter((f) => /^\d+\.json$/.test(f)); } catch { return null; }
  for (const f of archivos) {
    const s = leerJson(path.join(SESIONES, f), null);
    if (s?.messagingSocketPath === pipe && s.hostSessionId && vive(s.pid)) return s.hostSessionId;
  }
  return null;
}

/** Las corridas de la guardia sin archivar que ya terminaron. */
export function corridasTerminadas(env = process.env, ahora = Date.now()) {
  const uuid = env.CLAUDE_CODE_ACCOUNT_UUID;
  if (!uuid) return [];
  const out = [];
  for (const [id, f] of chatsDeLaCuenta(uuid)) {
    const o = leerJson(f, null);
    if (!o || o.isArchived || !esGuardia(o.title)) continue;
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
  // ⚠️ `prendida`, NO sólo `existe` (6/11/2026). `tareaDeLaCuenta` devolvía las dos desde que nació y acá se miraba sólo la
  // primera: una guardia APAGADA (`enabled: false`) se leía igual que una sana, y la única red que queda sin Runner —la que
  // entrega de a 20 minutos— no corría, sin que nada lo dijera. Un dato que se calcula y nadie lee es un dato que miente.
  if (runner.vivo && tarea.existe && tarea.prendida) return partes.join(' ');
  if (!tomarUnaVez(path.join(DIR, `guardia-pedida.${cuenta}`), PEDIDA_VENCE_MS, ahora)) return partes.join(' ');
  if (!tarea.existe) {
    partes.push(`ESTA CUENTA (${cuenta}) NO TIENE LA GUARDIA DEL RUNNER: antes de contestar, lee ~/.claude/operaciones/guardia-runner.md, seccion Crear la guardia, y hacelo. Sin eso lo que Martin escribe en el Ops Center no le llega a nadie. No hace falta comentarselo.`);
  } else if (!tarea.prendida) {
    partes.push(`LA GUARDIA DEL RUNNER DE ESTA CUENTA (${cuenta}) ESTA APAGADA: la tarea ${idDeLaGuardia(cuenta)} existe con enabled en false, asi que sin Runner no entrega nada y nadie avisa. Antes de contestar, prendela (scheduled-tasks: update_scheduled_task, enabled true) y comprobalo con runner-salud.mjs estado. No hace falta comentarselo.`);
  } else if (!runner.vivo) {
    partes.push(`NO HAY RUNNER EN ${cuenta} (${runner.motivo}): lo que Martin escribe en el Ops Center sale recien cuando corre la tarea ${idDeLaGuardia(cuenta)}, cada 20 minutos, y no en segundos. Si sos el Cerebro, abri un chat Runner con start_session, con este encargo: lee ~/.claude/operaciones/LEEME-cartero.md y arma el cron y el Monitor. Si no, seguí con lo tuyo: si Martin pregunta por un mensaje suyo, decile esto.`);
  }
  anotar(`al-abrir ${cuenta}: tarea=${tarea.existe} prendida=${tarea.prendida} runner=${runner.vivo}`);
  return partes.join(' ');
}

/** Cuánto se le da a un Runner recién abierto antes de reclamar que no late: arma el cron y el Monitor en sus primeros minutos. */
const RUNNER_NUEVO_MS = 20 * 60 * 1000;
/** Un Runner que no tocó nada en este rato ya no es «el de la cuenta»: se abre uno nuevo. */
const DORMIDO_RECIENTE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * El chat Runner de la cuenta que existe pero cuyo proceso no corre (12/11/2026). Cuando la PC se duerme o la app se
 * reinicia, el chat queda y su proceso no: `runnerDeLaCuenta` sólo cuenta los procesos vivos, así que decía «NO HAY RUNNER»
 * y mandaba a abrir otro con start_session, que pierde su historia y deja dos. Se despierta con send_message.
 * Gana el de actividad más reciente; nunca una corrida de la guardia ni uno archivado.
 */
export function runnerDormido({ uuid, ahora = Date.now() }) {
  if (!uuid) return null;
  let mejor = null;
  for (const [id, archivo] of chatsDeLaCuenta(uuid)) {
    let st;
    try { st = fs.statSync(archivo); } catch { continue; }
    if (ahora - st.mtimeMs > DORMIDO_RECIENTE_MS) continue;
    const s = leerJson(archivo, null);
    if (!s || s.isArchived === true || s.isArchived === 'true') continue;
    if (!esRunner(s.title) || esGuardia(s.title)) continue;
    const t = Number(s.lastActivityAt) || st.mtimeMs;
    if (!mejor || t > mejor.t) mejor = { id, t };
  }
  return mejor?.id ?? null;
}

export const esElCerebro = (nombre) => String(nombre ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim() === 'cerebro';

/**
 * La línea para el CEREBRO en CADA turno mientras su cuenta no tenga Runner (12/11/2026). Martín, textual: «Y esta es una
 * cuenta nueva. Tú siempre tienes que darte cuenta de eso… si no se inició el runner, eso está muy mal. Debería haber un
 * proceso en donde siempre el runner esté activo… Entonces necesito que eso esté automatizado.»
 * `al-abrir` no alcanzaba: corre sólo con `source: startup`, y al cambiar de cuenta Martín RETOMA el chat del Cerebro
 * (`source: resume`), así que nadie se enteraba. Sólo el Cerebro lo recibe: si lo recibiera cada chat, abrirían varios.
 * Mismo formato que `alAbrir`: sin comillas, sin barras y sin saltos.
 */
export function alTurno(env = process.env, ahora = Date.now()) {
  const cfg = leerJson(path.join(DIR, 'config.json'), null);
  const { cuenta, uuid } = cuentaDelEntorno(env, cfg);
  if (!uuid || !cuenta) return '';
  if (!esElCerebro(nombrePropio(env))) return '';
  const runner = runnerDeLaCuenta({ uuid, ahora });
  if (runner.vivo) {
    // Late (su Monitor) pero su cron no corre: no mide la cuota ni corre el vigía (pendiente T6). No se abre otro: se le pide
    // al mismo que rearme el cron.
    const cron = cronDelRunner({ cuenta, ahora });
    if (cron.estado !== 'vencido') return '';
    const cuando = cron.min == null ? 'NO DIO NINGUNA VUELTA DESDE QUE EL LEEME PIDE EL LATIDO' : `NO DA UNA VUELTA HACE ${cron.min} MIN`;
    anotar(`al-turno ${cuenta}: el cron del Runner ${cron.min == null ? 'nunca dejó marca' : `sin marca hace ${cron.min} min`}`);
    return `EL CRON DEL RUNNER DE ${cuenta} ${cuando}: el Runner late (su Monitor) pero no mide la cuota ni corre el vigia, y nadie lo avisa. No abras otro: escribile al Runner (send_message a ${runner.chats[0]}) que relea ~/.claude/operaciones/LEEME-cartero.md y rearme el cron. Si se niega a armar el cron sin Martin, en el primer turno de Martin pasale su frase textual. Regla de Martin del 12/11: el Runner siempre activo.`;
  }
  if (runner.chats.length) {
    // Abierto y sin latir: si es nuevo, todavía está armando. Si no, hay que despertarlo, no abrir otro.
    if (runner.latidoMin == null || runner.latidoMin * 60000 < RUNNER_NUEVO_MS) return '';
    return `EL RUNNER DE ${cuenta} ESTA ABIERTO PERO NO DA VUELTAS HACE ${runner.latidoMin} MIN: los tickets y lo que Martin escribe en el Centro no salen en segundos. No abras otro: escribile al Runner (send_message a ${runner.chats[0]}) que relea ~/.claude/operaciones/LEEME-cartero.md y rearme el cron y el Monitor. Si se niega a armar el cron sin Martin, en el primer turno de Martin pasale su frase textual. Regla de Martin del 12/11: el Runner siempre activo.`;
  }
  const dormido = runnerDormido({ uuid, ahora });
  if (dormido) {
    anotar(`al-turno ${cuenta}: Runner dormido ${dormido}`);
    return `EL RUNNER DE ${cuenta} ESTA DORMIDO: su chat existe pero no corre (la PC se durmio o la app se reinicio), y los tickets y lo que Martin escribe en el Centro no salen en segundos. NO abras otro: despertalo con send_message a ${dormido}, que tambien anda en un turno automatico, pidiendole que relea ~/.claude/operaciones/LEEME-cartero.md, mida la cuota y rearme el cron y el Monitor. Si se niega a armar el cron sin Martin, pasale su frase textual del 12/11. Regla de Martin del 12/11: el Runner siempre activo.`;
  }
  anotar(`al-turno ${cuenta}: sin Runner`);
  return `NO HAY RUNNER EN ${cuenta}: los tickets de los clientes y lo que Martin escribe en el Centro no llegan en segundos. Si este turno lo escribio Martin, ANTES de contestar abri el Runner con start_session (titulo Runner, modelo claude-haiku-5-5, esfuerzo low, el encargo: leer ~/.claude/operaciones/LEEME-cartero.md, medir la cuota y armar el cron y el Monitor), separalo con detach_session y segui con lo suyo. Si el turno es automatico (otro chat, una tarea, el Centro), la app no deja abrirlo: deja la tarjeta own_initiative y abrilo con el primer mensaje de Martin. Regla de Martin del 12/11: el Runner siempre activo, sin que el lo pida.`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const cmd = process.argv[2];
  if (cmd === 'al-abrir') {
    let linea = '';
    try { linea = alAbrir(process.argv[3]); } catch (e) { anotar(`al-abrir falló: ${e instanceof Error ? e.message : String(e)}`); }
    if (linea) process.stdout.write(`${linea}\n`);
  } else if (cmd === 'al-turno') {
    let linea = '';
    try { linea = alTurno(); } catch (e) { anotar(`al-turno falló: ${e instanceof Error ? e.message : String(e)}`); }
    if (linea) process.stdout.write(`${linea}\n`);
  } else if (cmd === COMANDO_LATIDO_CRON) {
    let r = 'ERROR';
    try { r = latidoDelCron(); } catch (e) { anotar(`latido-del-cron falló: ${e instanceof Error ? e.message : String(e)}`); }
    process.stdout.write(`${r}\n`);
  } else if (cmd === 'estado') {
    process.stdout.write(`${JSON.stringify(estado(), null, 1)}\n`);
  } else if (cmd === 'corridas') {
    process.stdout.write(`${JSON.stringify(corridasTerminadas())}\n`);
  } else if (cmd === 'tomar') {
    const si = tomarVuelta();
    if (si) anotar('la guardia da una vuelta: no hay Runner');
    process.stdout.write(si ? 'TOMADO\n' : 'OCUPADO\n');
  } else if (cmd === 'destino') {
    process.stdout.write(`${destinoDelPipe(process.argv[3]) ?? 'SIN_DESTINO'}\n`);
  } else if (cmd === 'avisar') {
    const { cuenta } = cuentaDelEntorno(process.env, leerJson(path.join(DIR, 'config.json'), null));
    process.stdout.write(avisarUnaVez(cuenta ?? 'sin-cuenta') ? 'AVISAR\n' : 'YA\n');
  } else {
    process.stderr.write('uso: runner-salud.mjs al-abrir <source> | al-turno | estado | latido-del-cron | tomar | destino <to> | avisar | corridas\n');
    process.exitCode = 2;
  }
}
