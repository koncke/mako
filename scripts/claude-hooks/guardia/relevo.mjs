#!/usr/bin/env node
// =============================================================================
// relevo.mjs — si la app de Claude se cayó, que los chats cortados se retomen
// =============================================================================
// POR QUE EXISTE: el 11/10/2026 la app murió a las 05:07 con 7 chats trabajando
// (4 con workflows). Al reabrirla, NINGUNO siguió solo: Martín tuvo que entrar a
// cada uno y escribir «Continua». Lo que se pidió: que si vuelve a pasar, la
// instrucción les llegue a todos sin tener que hacerlo a mano.
//
// COMO:
//  1. Del log de la app (main.log) saca la ÚLTIMA caída: el instante en que la
//     instancia anterior dejó de escribir y el arranque nuevo. Un cierre limpio
//     deja marca (`Windows session ending`, `beforeQuitForUpdate`); el crash no
//     deja nada — el log se corta en seco. El apagado de Windows NO dispara
//     relevo; la actualización y el crash sí.
//  2. Recorre las sesiones del escritorio (claude-code-sessions/*/local_*.json,
//     que traen el cliSessionId) y lee cada transcript HASTA la caída: ¿quedó a
//     mitad de turno, o con un workflow/agente en segundo plano sin terminar?
//     ¿Y alguien ya la retomó después del arranque?
//  3. El primero que llega (un hook de cualquier chat) se vuelve LÍDER: reclama
//     las cortadas con un archivo atómico por sesión y le pide a su modelo que
//     les mande «retomá» con SendMessage. Las que se despiertan por ese mensaje
//     ven su reclamo y no se auto-despiertan de nuevo (sin dobles).
//
// MODOS:
//   inicio      hook SessionStart con asyncRewake: si hay algo, sale con 2 y el
//               texto en stderr DESPIERTA al modelo sin que nadie escriba. La app
//               levanta sola un par de chats al reabrir (WarmLifecycle), así que
//               alcanza con que uno sea líder.
//   turno       hook UserPromptSubmit: lo mismo como additionalContext, para
//               cuando Martín escribe en cualquier chat después de la caída.
//   diagnostico imprime qué haría, sin reclamar nada. `--hasta <ISO>` simula
//               mirar el estado en ese instante (para probar contra una caída
//               vieja: `--hasta 2026-10-11T08:11:00Z`).
//
// Un error de este script NUNCA bloquea nada: ante cualquier excepción, exit 0.
// =============================================================================

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const HOME = os.homedir();
const DIR = path.join(HOME, '.claude', 'guardia');
const LOG = path.join(DIR, 'guardia.log');
const RELEVO = process.env.GUARDIA_RELEVO_DIR || path.join(DIR, 'relevo');   // override sólo para pruebas
const PROYECTOS = path.join(HOME, '.claude', 'projects');
const SESIONES = path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'Claude', 'claude-code-sessions');
const LOGS_APP = [
  path.join(process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local'), 'Claude', 'Logs'),
  path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'Claude', 'logs'),
];

const VENTANA_RELEVO_MS = 3 * 60 * 60 * 1000;   // después de 3 h de reabierta, no se resucita nada
const ACTIVA_ANTES_MS = 45 * 60 * 1000;         // la sesión tiene que haber trabajado en los 45 min previos
const BG_VIGENTE_MS = 12 * 60 * 60 * 1000;      // un workflow lanzado hace más de 12 h no cuenta
const RECLAMO_VENCE_MS = 4 * 60 * 1000;         // si el líder no la despertó en 4 min, otro puede volver a intentar
const ESPERAN_RESPUESTA = new Set(['AskUserQuestion', 'ExitPlanMode']);

const modo = process.argv[2] || 'diagnostico';
const hastaArg = (() => { const i = process.argv.indexOf('--hasta'); return i > 0 ? new Date(process.argv[i + 1]) : null; })();
const AHORA = hastaArg && !Number.isNaN(+hastaArg) ? hastaArg : new Date();

function log(linea) {
  const prueba = hastaArg || process.env.GUARDIA_RELEVO_DIR ? ' (PRUEBA, no real)' : '';
  try { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(LOG, `${new Date().toISOString()} [relevo]${prueba} ${linea}\n`); } catch {}
}
const hhmm = (d) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

// ---------------------------------------------------------------------------
// 1. La última caída, según el log de la app
// ---------------------------------------------------------------------------
const RE_LINEA = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) \[\w+\] (.*)$/;

function leerLogApp() {
  for (const dir of LOGS_APP) {
    const main = path.join(dir, 'main.log');
    if (!fs.existsSync(main)) continue;
    // main1.log es el anterior: el log ROTA a veces en el mismo segundo de la
    // caída, y entonces el final de la instancia muerta vive en main1.
    const partes = [path.join(dir, 'main1.log'), main].filter((f) => fs.existsSync(f));
    const lineas = [];
    for (const f of partes) {
      for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
        const m = RE_LINEA.exec(l);
        if (m) lineas.push({ t: new Date(`${m[1]}T${m[2]}`), msg: m[3] });   // hora LOCAL, como la escribe la app
      }
    }
    return lineas;
  }
  return [];
}

function ultimaCaida() {
  const lineas = leerLogApp().filter((l) => l.t <= AHORA);
  if (!lineas.length) return null;
  // Un arranque es "de segunda instancia" si dice `Not main instance` antes del
  // próximo arranque: esos no cuentan ni como arranque ni como vida de la app.
  const arranques = [];
  const ruido = new Set();
  for (let i = 0; i < lineas.length; i++) {
    if (!lineas[i].msg.startsWith('Starting app')) continue;
    let secundaria = false;
    for (let j = i + 1; j < Math.min(lineas.length, i + 60); j++) {
      if (lineas[j].msg.startsWith('Starting app')) break;
      if (lineas[j].msg.startsWith('Not main instance')) { secundaria = true; ruido.add(j); break; }
    }
    if (secundaria) ruido.add(i); else arranques.push(i);
  }
  // ⚠️ Y desde la 2.4x la segunda instancia YA NO DICE `Not main instance`.
  // Medido el 15/10/2026: «Starting app» a las 13:12 y a las 19:09 (la vuelta de un
  // login, un clic en un link claude://) con el proceso principal VIVO — el mismo
  // `electron_main:<pid>` antes y después. El relevo lo tomó por caída y le mandó
  // «retomá» a un chat que no se había cortado. Lo que no miente es el PID: un
  // arranque de verdad cambia el proceso principal.
  const pidDe = (l) => /electron_main:(\d+)/.exec(l.msg)?.[1] || null;
  const reales = arranques.filter((i, k) => {
    let antes = null;
    for (let j = i - 1; j >= 0 && !antes; j--) antes = pidDe(lineas[j]);
    let despues = null;
    const tope = k + 1 < arranques.length ? arranques[k + 1] : lineas.length;
    for (let j = i + 1; j < tope && !despues; j++) despues = pidDe(lineas[j]);
    return !(antes && despues && antes === despues);   // sin PID para comparar, se cree el arranque
  });
  let reinicio = null;
  if (reales.length >= 2) {
    const iNuevo = reales[reales.length - 1];
    const iViejo = reales[reales.length - 2];
    let ultima = null;
    let tipo = 'crash';
    for (let j = iViejo; j < iNuevo; j++) {
      if (ruido.has(j)) continue;
      ultima = lineas[j];
      const m = lineas[j].msg;
      if (m.includes('beforeQuitForUpdate')) tipo = 'actualizacion';
      else if (m.includes('Windows session ending') && tipo !== 'actualizacion') tipo = 'apagado';
    }
    if (ultima) reinicio = { fin: ultima.t, arranque: lineas[iNuevo].t, tipo };
  }
  // El CAMBIO DE CUENTA corta las sesiones sin reiniciar la app (medido 15/10 19:09:
  // `Login-state transition (loggedOut: false → true`, y 11 de 13 procesos de chat
  // arrancaron de nuevo). Es un corte propio: los chats de la cuenta que VUELVE se
  // pueden retomar; los de la que se fue los descarta el filtro de cuenta de abajo.
  let cuenta = null;
  for (let i = lineas.length - 1; i >= 0 && !cuenta; i--) {
    if (!/Login-state transition \(loggedOut: false/.test(lineas[i].msg)) continue;
    const login = lineas.slice(i + 1).find((l) => /Login-state transition \(loggedOut: true/.test(l.msg));
    cuenta = { fin: lineas[i].t, arranque: login ? login.t : lineas[i].t, tipo: 'cuenta' };
  }
  if (!reinicio) return cuenta;
  if (!cuenta) return reinicio;
  // A veces el cambio de cuenta además reinicia la app (14/10 15:29: logout y, 12 s
  // después, otro proceso principal). Es el mismo corte: se nombra por su causa.
  const seg = (reinicio.fin - cuenta.fin) / 1000;
  if (seg >= 0 && seg <= 120) return { ...reinicio, tipo: 'cuenta' };
  return cuenta.fin > reinicio.fin ? cuenta : reinicio;
}

// ---------------------------------------------------------------------------
// 2. Qué sesiones quedaron cortadas
// ---------------------------------------------------------------------------
function sesionesEscritorio() {
  const out = [];
  const recorrer = (dir, prof) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && prof < 3) recorrer(p, prof + 1);
      else if (e.isFile() && /^local_.*\.json$/.test(e.name)) {
        try {
          const d = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (!d.isArchived && d.cliSessionId) out.push({ local: d.sessionId, cli: d.cliSessionId, titulo: d.title || '(sin título)' });
        } catch {}
      }
    }
  };
  recorrer(SESIONES, 0);
  return out;
}

let indiceTranscripts = null;
function transcriptDe(cli) {
  if (!indiceTranscripts) {
    indiceTranscripts = new Map();
    let ps = [];
    try { ps = fs.readdirSync(PROYECTOS); } catch {}
    for (const p of ps) {
      let fs2 = [];
      try { fs2 = fs.readdirSync(path.join(PROYECTOS, p)); } catch { continue; }
      for (const f of fs2) if (f.endsWith('.jsonl')) indiceTranscripts.set(f.slice(0, -6), path.join(PROYECTOS, p, f));
    }
  }
  return indiceTranscripts.get(cli) || null;
}

const textoDe = (msg) => {
  const c = msg?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((x) => (typeof x?.text === 'string' ? x.text : typeof x?.content === 'string' ? x.content : Array.isArray(x?.content) ? x.content.map((y) => y?.text || '').join(' ') : '')).join(' ');
  return '';
};
const esNotificacion = (r) => r.type === 'user' && /^\s*<task-notification>/.test(textoDe(r.message));

function estadoDe(archivo, caida) {
  let st;
  try { st = fs.statSync(archivo); } catch { return null; }
  if (st.mtimeMs < caida.fin.getTime() - ACTIVA_ANTES_MS) return null;   // no estaba trabajando
  const finMs = caida.fin.getTime() + 5000;
  const arranqueMs = caida.arranque.getTime();
  let ultimo = null;            // última entrada user/assistant de la cadena principal antes de la caída
  let retomada = false;
  const lanzados = new Map();   // tool_use_id -> ms de lanzamiento (workflow/agente en segundo plano)
  const cerrados = new Set();
  const herramientas = new Map();
  for (const l of fs.readFileSync(archivo, 'utf8').split('\n')) {
    if (!l) continue;
    let r;
    try { r = JSON.parse(l); } catch { continue; }
    if (r.isSidechain || (r.type !== 'user' && r.type !== 'assistant')) continue;
    const ms = Date.parse(r.timestamp || '');
    if (Number.isNaN(ms) || ms > AHORA.getTime()) continue;   // --hasta: lo posterior todavía no pasó
    if (ms > arranqueMs) {
      // Retomada = alguien le habló o el modelo volvió a escribir. Las
      // notificaciones de tareas "stopped" que el CLI vuelca al reabrir no cuentan.
      if (r.type === 'assistant' || (!r.isMeta && !esNotificacion(r))) retomada = true;
      continue;
    }
    if (ms > finMs) continue;
    if (r.isMeta) continue;
    ultimo = r;
    const c = r.message?.content;
    if (Array.isArray(c)) {
      for (const b of c) {
        if (b?.type === 'tool_use') herramientas.set(b.id, b.name);
        if (b?.type === 'tool_result') {
          const t = typeof b.content === 'string' ? b.content : Array.isArray(b.content) ? b.content.map((y) => y?.text || '').join(' ') : '';
          if (/^(Workflow launched in background|Async agent launched)/.test(t)) lanzados.set(b.tool_use_id, ms);
        }
      }
    }
    if (esNotificacion(r)) {
      const t = textoDe(r.message);
      const id = /<tool-use-id>([^<]+)<\/tool-use-id>/.exec(t)?.[1];
      const estado = /<status>([a-z_]+)<\/status>/.exec(t)?.[1];
      if (id && estado && estado !== 'running') cerrados.add(id);
    }
  }
  if (!ultimo) return null;
  const msg = ultimo.message || {};
  let mitadDeTurno = false;
  if (ultimo.type === 'assistant') {
    const pendiente = (Array.isArray(msg.content) ? msg.content : []).filter((b) => b?.type === 'tool_use').map((b) => b.name);
    mitadDeTurno = msg.stop_reason !== 'end_turn' && msg.stop_reason !== 'stop_sequence' && !pendiente.some((n) => ESPERAN_RESPUESTA.has(n));
  } else {
    mitadDeTurno = !/\[Request interrupted by user/.test(textoDe(msg));
  }
  if (Date.parse(ultimo.timestamp) < caida.fin.getTime() - ACTIVA_ANTES_MS) mitadDeTurno = false;
  const enFondo = [...lanzados].filter(([id, ms]) => !cerrados.has(id) && caida.fin.getTime() - ms < BG_VIGENTE_MS).length;
  return { mitadDeTurno, enFondo, retomada };
}

/**
 * De qué cuenta es cada sesión, según la bitácora, y cuál está activa ahora.
 *
 * ⚠️ Esto existe porque CAMBIAR DE CUENTA se ve exactamente igual que una caída.
 * Martín se desloguea y entra con la otra cuenta: la app se reinicia, el log dice
 * «Starting app» dos veces, y todas las sesiones de la cuenta que se va terminan
 * en el mismo segundo. Igualito a un crash.
 *
 * La diferencia es que esas sesiones son de la OTRA cuenta, y desde ésta no
 * existen: `get_session` sobre ellas da «not found» y SendMessage no las alcanza.
 * Pedir que se las despierte es mandar a alguien a hacer algo imposible.
 *
 * Medido el 14/10/2026: a las 15:30:10 terminaron cinco sesiones de claude2 y el
 * marcador pasó a claude1 a las 15:31:37. El aviso de «relevo tras la caída»
 * estuvo toda la tarde pidiendo despertar cinco chats inalcanzables, y dos
 * sesiones distintas lo intentaron y fallaron antes de que alguien lo mirara.
 */
function cuentaActiva() {
  try {
    return fs.readFileSync(path.join(HOME, '.claude', 'cuenta-activa.txt'), 'utf8').trim().split(/\s+/)[0] || null;
  } catch { return null; }
}

function cuentaPorSesion() {
  const mapa = new Map();
  try {
    const tsv = fs.readFileSync(path.join(HOME, '.claude', 'bitacora-sesiones.tsv'), 'utf8');
    for (const linea of tsv.split('\n')) {
      const [, , cuenta, sid] = linea.split('\t');
      if (cuenta && sid) mapa.set(sid.trim(), cuenta.trim());   // gana la última
    }
  } catch { /* sin bitácora, no se filtra nada */ }
  return mapa;
}

function cortadas(caida) {
  const out = [];
  const activa = cuentaActiva();
  const deQuien = cuentaPorSesion();
  for (const s of sesionesEscritorio()) {
    const archivo = transcriptDe(s.cli);
    if (!archivo) continue;
    // Una sesión de otra cuenta no se puede despertar desde ésta: no se lista.
    const suya = deQuien.get(s.cli);
    if (activa && suya && suya !== activa) continue;
    const e = estadoDe(archivo, caida);
    if (!e || (!e.mitadDeTurno && !e.enFondo)) continue;
    out.push({ ...s, ...e });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Reclamos: quién despierta a quién, sin dobles
// ---------------------------------------------------------------------------
function dirCaida(caida) {
  const d = path.join(RELEVO, caida.arranque.toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(d, { recursive: true });
  return d;
}
/** Reclamo atómico ('wx'). Uno vencido (el líder no cumplió) se puede retomar. */
function reclamar(dir, cli, quien) {
  const f = path.join(dir, `${cli}.json`);
  const dato = JSON.stringify({ quien, en: new Date().toISOString() });
  try { fs.writeFileSync(f, dato, { flag: 'wx' }); return true; } catch {}
  try {
    if (Date.now() - fs.statSync(f).mtimeMs > RECLAMO_VENCE_MS) { fs.writeFileSync(f, dato); return true; }
  } catch {}
  return false;
}

function mensajeParaElModelo(caida, propia, otras) {
  const que = caida.tipo === 'actualizacion' ? 'se reinició para actualizarse'
    : caida.tipo === 'cuenta' ? 'cortó los chats por un cambio de cuenta' : 'se cayó';
  const partes = [`La app de Claude ${que} a las ${hhmm(caida.fin)} y se reabrió a las ${hhmm(caida.arranque)}.`];
  if (propia) partes.push('TU trabajo quedó cortado a mitad: retomalo exactamente donde quedó (si tenías un workflow o agentes corriendo, relanzalos; la guardia de RAM te hace esperar si no hay memoria).');
  if (otras.length) {
    const lista = otras.map((o) => `«${o.titulo}» (${o.local})`).join(', ');
    partes.push(`${propia ? 'ANTES de eso' : 'Ahora'}: estos chats también quedaron cortados y nadie los retomó: ${lista}. ` +
      'Mandale a CADA uno, en una sola tanda, con la herramienta SendMessage (to = su id local_…; si no la tenés cargada, ToolSearch "select:SendMessage" o usá mcp__ccd_session_mgmt__send_message), este texto: ' +
      `«La app de Claude ${que} a las ${hhmm(caida.fin)} en medio de tu trabajo. Retomá exactamente donde quedaste; si tenías un workflow o agentes corriendo, relanzalos (la guardia de RAM te hace esperar si no hay memoria).»`);
  }
  if (!propia) partes.push('Después de mandarlos, no hace falta que hagas nada más por esto.');
  return partes.join(' ');
}

function relevar(cliPropio) {
  const caida = ultimaCaida();
  if (!caida || caida.tipo === 'apagado') return null;
  if (AHORA.getTime() - caida.arranque.getTime() > VENTANA_RELEVO_MS) return null;
  const dir = dirCaida(caida);
  // Caché por caída: leer los transcripts cuesta ~1,5 s (decenas de MB) y este
  // hook corre en cada mensaje. Se escanea una vez; después sólo se vuelve a
  // mirar si alguna cortada no está resuelta (.hecho) ni reclamada hace poco.
  const cache = path.join(dir, 'analizado.json');
  const hay = (f) => fs.existsSync(path.join(dir, f));
  const vencido = (f) => { try { return Date.now() - fs.statSync(path.join(dir, f)).mtimeMs > RECLAMO_VENCE_MS; } catch { return true; } };
  let previo = null;
  try { previo = JSON.parse(fs.readFileSync(cache, 'utf8')); } catch {}
  if (previo && !previo.some((cli) => !hay(`${cli}.hecho`) && vencido(`${cli}.json`))) return null;
  const lista = cortadas(caida);
  for (const s of lista) if (s.retomada) { try { fs.writeFileSync(path.join(dir, `${s.cli}.hecho`), ''); } catch {} }
  try { fs.writeFileSync(cache, JSON.stringify(lista.filter((s) => !s.retomada).map((s) => s.cli))); } catch {}
  if (!lista.length) return null;
  const propia = lista.find((s) => s.cli === cliPropio && !s.retomada && reclamar(dir, s.cli, cliPropio));
  const otras = lista.filter((s) => s.cli !== cliPropio && !s.retomada && reclamar(dir, s.cli, cliPropio));
  if (!propia && !otras.length) return null;
  log(`caida ${caida.tipo} fin=${caida.fin.toISOString()} arranque=${caida.arranque.toISOString()} lider=${String(cliPropio).slice(0, 8)} propia=${!!propia} otras=${otras.map((o) => o.titulo).join(' | ')}`);
  return mensajeParaElModelo(caida, !!propia, otras);
}

// ---------------------------------------------------------------------------
function leerEntrada() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

try {
  if (modo === 'diagnostico') {
    const caida = ultimaCaida();
    console.log('mirando el estado al', AHORA.toISOString());
    console.log('ultima caida:', caida ? { tipo: caida.tipo, fin: caida.fin.toString(), arranque: caida.arranque.toString() } : 'ninguna');
    if (caida) for (const s of cortadas(caida)) console.log(`  ${s.retomada ? 'ya retomada' : 'CORTADA    '}  mitadDeTurno=${s.mitadDeTurno} enFondo=${s.enFondo}  «${s.titulo}» ${s.local}`);
  } else if (modo === 'inicio') {
    const ent = leerEntrada();
    if (ent.source === 'clear' || ent.source === 'compact') process.exit(0);
    const texto = relevar(ent.session_id);
    if (texto) { process.stderr.write(texto); process.exit(2); }   // asyncRewake: el 2 despierta al modelo
  } else if (modo === 'turno') {
    const ent = leerEntrada();
    const texto = relevar(ent.session_id);
    if (texto) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: `[Relevo tras la caída] ${texto}` } }));
  }
} catch (e) {
  log(`error interno (no hago nada): ${e?.message || e}`);
}
process.exit(0);
