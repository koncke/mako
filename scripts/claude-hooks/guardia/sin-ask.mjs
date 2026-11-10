#!/usr/bin/env node
// =============================================================================
// sin-ask.mjs — un AskUserQuestion se vuelve una pregunta del Ops Center
// =============================================================================
// Martín (22/10/2026): «las preguntas tipo bloque de Claude... siempre deben aparecer en la app de Ops Center». Y el 24/10,
// frente a una de «Ventas de MaKo» trabada desde el 23/10 a las 19:20: «¿Por qué no puedo contestar desde la app?».
// La regla de AGENTS.md (preguntar con `cartero preguntar`) no alcanzó: el Cerebro preguntó 8 veces con AskUserQuestion en dos
// días, y un chat que pregunta así queda TRABADO hasta que Martín conteste en la app de Claude de la computadora (en la cuenta de
// ese chat): mientras espera no le entra ningún mensaje, y desde el teléfono no hay respuesta posible. Esto es la red: la
// herramienta no corre, la pregunta se guarda con `cartero preguntar` (sale a la conversación del chat en el Ops Center en la
// próxima vuelta del Runner) y el chat lee que tiene que terminar el turno.
//
// PreToolUse, matcher `AskUserQuestion`. Cada pregunta del tool_use se arma con las MISMAS reglas que usa el cartero para
// mostrar las de la app (`preguntasDeAsk`: recomendada por «(Recommended)/(Recomendada)», varias = multiSelect, topes) y se
// guarda con `cartero.mjs preguntar <archivo>`, que la valida otra vez.
//
// Sólo en los chats que el Ops Center ve: se decide por la carpeta del PROYECTO del chat (CLAUDE_PROJECT_DIR), no por la
// carpeta actual (un chat que hizo `cd` afuera seguía siendo de MaKo y quedaba trabado). En otra carpeta la pregunta no
// tendría dónde aparecer, y la herramienta sigue como siempre.
// Regla de la casa (como chrome-turno.mjs y memoria.mjs): un error de este script NUNCA bloquea; ante cualquier excepción,
// exit 0 y la herramienta corre como antes. Pero deja una línea en guardia.log (antes abría el paso sin rastro).
//
// ⚠️ TRAMPAS MEDIDAS EN LA REVISIÓN DEL 24/10 (4 revisores + un refutador por hallazgo):
//   · `cartero preguntar` imprime JSON con SANGRÍA (varias líneas): se parsea la salida entera. La primera versión leía la
//     última línea («}») y con el cartero real decía SIEMPRE «no salió»; la prueba no lo vio porque su cartero falso imprimía
//     en una línea. Por eso la prueba ahora corre el cartero REAL con CARTERO_DIR en una carpeta temporal.
//   · El tool_use ya está escrito en el transcript cuando corre este hook (medido: 3 ms): el Runner sube también la copia
//     'ask'. MaKo descartaba la de `preguntar` por igual a la 'ask' abierta y la pregunta se perdía (2-5% de las veces). Lo
//     arregla MaKo (unirPreguntas: la de `preguntar` reemplaza a la 'ask' igual); sin eso, este hook no se instala.
//
// UNA PREGUNTA TÉCNICA NO SE GUARDA (10/11/2026, cartero 1.27.0; Martín: «Que solamente me llegan las preguntas de decisiones
// importantes. Y nunca tiene que ser con lenguaje técnico»). `cartero preguntar` la rechaza (sale con 3 y `{ rechazada, motivo }`) y
// este hook le pasa ESE motivo al chat al negarle la herramienta: la decide él con la opción recomendada y sigue, en el mismo turno.
// No es un error del cartero: no se le dice que la mande a mano.
//
// Para probar sin subir nada: CARTERO_DIR=<carpeta temporal> (el cartero real escribe ahí), o MAKO_SIN_ASK_CARTERO=<un .mjs
// falso>; MAKO_SIN_ASK_LIB (el cartero del que salen las reglas), MAKO_SIN_ASK_CONFIG, MAKO_SIN_ASK_SESIONES y
// MAKO_SIN_ASK_LOG y MAKO_SIN_ASK_DUP (la memoria de repetidas), para no leer ni escribir los de la PC.
// =============================================================================
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const HOME = os.homedir();
const CARTERO_REAL = path.join(HOME, '.claude', 'operaciones', 'cartero.mjs');
// Las reglas de la pregunta salen del cartero (preguntasDeAsk); el que la guarda es el mismo, salvo en las pruebas.
const LIB = process.env.MAKO_SIN_ASK_LIB || CARTERO_REAL;
const CARTERO = process.env.MAKO_SIN_ASK_CARTERO || CARTERO_REAL;
const CONFIG = process.env.MAKO_SIN_ASK_CONFIG || path.join(HOME, '.claude', 'operaciones', 'config.json');
const SESIONES = process.env.MAKO_SIN_ASK_SESIONES
  || path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'Claude', 'claude-code-sessions');
const LOG = process.env.MAKO_SIN_ASK_LOG || path.join(HOME, '.claude', 'guardia', 'guardia.log');
const DUPLICADOS = process.env.MAKO_SIN_ASK_DUP || path.join(os.tmpdir(), 'mako-sin-ask');
const DESTINO_RE = /^(local|cli)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Todo el hook (hasta 4 preguntas) termina antes de esto; settings.json le da 30 s. */
const PRESUPUESTO_MS = 15_000;
const POR_PREGUNTA_MS = 8_000;
/** La misma pregunta del mismo chat, repetida en este rato, no se vuelve a guardar: se le devuelve el id de la primera. */
const REPETIDA_MS = 30 * 60_000;
// Con barras normales y entre comillas: anda igual en Git Bash y en PowerShell (con `~` no corre en PowerShell 5.1).
const COMANDO = `node "${CARTERO_REAL.replace(/\\/g, '/')}"`;

const inicio = Date.now();
const leerStdin = () => { try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; } };
const norm = (p) => path.resolve(String(p ?? '')).toLowerCase().replace(/[\\/]+$/, '') + path.sep;
const textoNorm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function anotar(linea) {
  try { fs.appendFileSync(LOG, `${new Date().toISOString()} [sin-ask] ${linea}\n`); } catch { /* sin log no se corta nada */ }
}

/** Las carpetas cuyos chats ve el Ops Center: las del config del cartero, o las de siempre. */
function carpetasVistas() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    if (Array.isArray(cfg.cwds) && cfg.cwds.length) return cfg.cwds.map(norm);
  } catch { /* sin config: las de siempre */ }
  return [path.join(HOME, 'OneDrive', 'Escritorio', 'dashboard-marketing-main'), 'C:\\dev\\'].map(norm);
}

/** Las carpetas de un nivel (un archivo suelto no corta la búsqueda). */
const subcarpetas = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(dir, d.name)); } catch { return []; } };

/** ¿Este archivo de sesión de la app es el del chat? Lee el comienzo, no el archivo entero (algunos pesan varios MB). */
function esDelChat(archivo, cliId) {
  let fd;
  try {
    fd = fs.openSync(archivo, 'r');
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.toString('utf8', 0, n).includes(`"cliSessionId":"${cliId}"`);
  } catch { return false; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* nada */ } }
}

/** La sesión del chat: la de la app (`local_…`) por el entorno, o buscando su `cliSessionId` entre las sesiones de la app. */
function sesionDelChat(cliId) {
  const app = String(process.env.CLAUDE_CODE_HOST_SESSION_ID ?? '');
  if (DESTINO_RE.test(app)) return app;
  if (!UUID_RE.test(String(cliId ?? ''))) return null;
  for (const cuenta of subcarpetas(SESIONES)) {
    for (const dir of subcarpetas(cuenta)) {
      let archivos = [];
      try { archivos = fs.readdirSync(dir).filter((f) => /^local_.*\.json$/.test(f)); } catch { continue; }
      for (const f of archivos) if (esDelChat(path.join(dir, f), cliId)) return f.slice(0, -5);
    }
  }
  anotar(`sin local_ para ${cliId.slice(0, 8)}: pregunta como cli_`);
  return `cli_${cliId}`;
}

/** Lo que imprime `cartero preguntar`: un JSON (con sangría, en varias líneas), quizás con un log antes. */
function salidaDelCartero(stdout) {
  const crudo = String(stdout ?? '').trim();
  try { return JSON.parse(crudo); } catch { /* sigue */ }
  const desde = crudo.lastIndexOf('\n{');
  try { return JSON.parse(desde >= 0 ? crudo.slice(desde + 1) : crudo.slice(crudo.indexOf('{'))); } catch { return null; }
}

/** La misma pregunta del mismo chat en los últimos REPETIDA_MS: su id. */
function repetida(local, pregunta) {
  try {
    const x = JSON.parse(fs.readFileSync(path.join(DUPLICADOS, `${local}.json`), 'utf8'));
    const v = x?.[textoNorm(pregunta)];
    return v && Date.now() - v.at < REPETIDA_MS ? v.id : null;
  } catch { return null; }
}
function recordar(local, pregunta, id) {
  try {
    fs.mkdirSync(DUPLICADOS, { recursive: true });
    const f = path.join(DUPLICADOS, `${local}.json`);
    let x = {};
    try { x = JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch { /* nuevo */ }
    for (const [k, v] of Object.entries(x)) if (!v || Date.now() - v.at >= REPETIDA_MS) delete x[k];
    x[textoNorm(pregunta)] = { id, at: Date.now() };
    fs.writeFileSync(f, JSON.stringify(x));
  } catch { /* sin memoria de repetidas: a lo sumo sale dos veces */ }
}

function negar(motivo) {
  const salida = JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo },
  });
  // Que el JSON termine de salir antes de cerrar (un exit pegado al write puede cortarlo en un pipe).
  process.stdout.write(salida, () => process.exit(0));
}

const APAGADO = 'AskUserQuestion está apagado en esta PC: te deja trabado hasta que Martín conteste en la app de Claude de la computadora, y desde el Ops Center o el teléfono no se puede contestar.';
const MANUAL = `Preguntá con \`${COMANDO} preguntar <archivo.json>\` (el formato está en AGENTS.md, «NO LE PREGUNTES A MARTÍN CON AskUserQuestion») y terminá el turno; si es algo que podés decidir vos, decidilo.`;

try {
  const entrada = leerStdin();
  if (entrada.tool_name !== 'AskUserQuestion') process.exit(0);
  const proyecto = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd();
  if (!carpetasVistas().some((c) => norm(proyecto).startsWith(c))) {
    anotar(`fuera de las carpetas del Ops Center (${proyecto}): AskUserQuestion sigue`);
    process.exit(0);
  }

  const local = sesionDelChat(entrada.session_id);
  if (!local) {
    anotar(`sin sesión (session_id=${String(entrada.session_id).slice(0, 8)}): niego sin guardar`);
    negar(`${APAGADO} No supe qué chat sos, así que la pregunta NO se guardó. ${MANUAL}`);
  } else {
    const { preguntasDeAsk } = await import(pathToFileURL(LIB).href);
    const pedidas = Array.isArray(entrada.tool_input?.questions) ? entrada.tool_input.questions.length : 0;
    const qs = preguntasDeAsk([{ type: 'tool_use', name: 'AskUserQuestion', id: entrada.tool_use_id, input: entrada.tool_input }], new Date().toISOString());

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sin-ask-'));
    const salieron = [];
    const fallaron = [];
    const rechazadas = [];
    try {
      qs.forEach((q, i) => {
        const ya = repetida(local, q.pregunta);
        if (ya) { salieron.push({ id: ya, pregunta: q.pregunta, repetida: true }); return; }
        const resta = PRESUPUESTO_MS - (Date.now() - inicio);
        if (resta < 1_000) { fallaron.push({ pregunta: q.pregunta, por: 'no hubo tiempo' }); return; }
        const archivo = path.join(tmp, `p${i}.json`);
        const x = { pregunta: q.pregunta, opciones: q.opciones.map((o) => ({ titulo: o.titulo, ...(o.detalle ? { detalle: o.detalle } : {}) })) };
        if (q.contexto) x.contexto = q.contexto;
        if (q.recomendada != null) x.recomendada = q.recomendada;
        if (q.varias) x.varias = true;
        fs.writeFileSync(archivo, JSON.stringify(x));
        const r = spawnSync(process.execPath, [CARTERO, 'preguntar', archivo], {
          env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: local }, encoding: 'utf8',
          timeout: Math.min(POR_PREGUNTA_MS, resta), windowsHide: true,
        });
        const o = salidaDelCartero(r.stdout);
        if (r.status === 0 && o?.ok === true && typeof o.id === 'string') {
          salieron.push({ id: o.id, pregunta: q.pregunta });
          recordar(local, q.pregunta, o.id);
        } else if (o?.ok === false && o.rechazada === true && typeof o.motivo === 'string') {
          rechazadas.push({ pregunta: q.pregunta, motivo: o.motivo.slice(0, 600), deMartin: o.tema === true });
        } else {
          const por = r.error?.code || (r.status == null ? 'cortado' : `salió ${r.status}`);
          const err = String(r.stderr ?? '').trim().split('\n').find(Boolean)?.slice(0, 160) ?? '';
          fallaron.push({ pregunta: q.pregunta, por: err ? `${por}: ${err}` : por });
        }
      });
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* el temporal no importa */ }
    }

    const sinArmar = Math.max(0, pedidas - qs.length);
    anotar(`${local.slice(0, 14)}: ${salieron.length} guardada(s)${salieron.some((s) => s.repetida) ? ' (alguna repetida)' : ''}, ${rechazadas.length} técnica(s), ${fallaron.length} sin confirmar, ${sinArmar} fuera de las reglas`);
    // Las técnicas: el motivo de cada una. La que es de Martín (el cartero dice `tema`) se reescribe y se vuelve a preguntar con
    // `preguntar`; la otra se decide y no se vuelve a preguntar (la revisión del 10/11/2026: un precio con «deploy» adentro no se
    // decide por él).
    const tecnicas = rechazadas.map((x) => `«${x.pregunta.slice(0, 120)}»: ${x.motivo} ${x.deMartin
      ? `Reescríbela sin lenguaje técnico y mándala con \`${COMANDO} preguntar\` (no con AskUserQuestion).`
      : 'NO la vuelvas a preguntar, ni con AskUserQuestion ni con `preguntar`: decídela y sigue con tu turno.'} `).join('');
    if (!salieron.length && rechazadas.length && !fallaron.length) {
      negar(`No se la mandé a Martín. ${tecnicas}`.trim());
    } else if (!salieron.length) {
      const porque = fallaron.length
        ? `el cartero no confirmó (${fallaron[0].por}). Antes de mandarla a mano, mirá si quedó en ~/.claude/operaciones/preguntas/, para no duplicarla`
        : 'no pasó las reglas del Ops Center (de 2 a 6 opciones con título)';
      negar(`${APAGADO} ${tecnicas}Esta vez la pregunta NO se guardó: ${porque}. ${MANUAL}`);
    } else {
      const lista = salieron.map((s) => `«${s.pregunta.slice(0, 120)}» [pregunta ${s.id}]`).join('; ');
      const faltan = fallaron.length + sinArmar;
      negar(`${APAGADO} ${tecnicas}`
        + `Tu pregunta YA QUEDÓ GUARDADA como \`cartero preguntar\` y sale a tu conversación del Ops Center en la próxima vuelta del Runner (segundos): ${lista}. `
        + (faltan ? `${faltan} de las que hiciste NO se guardaron (no pasaron las reglas o el cartero no confirmó): si hacen falta, mandalas con \`${COMANDO} preguntar\`. ` : '')
        + 'NO la repitas ni vuelvas a llamar AskUserQuestion: terminá el turno ahora, con una línea que diga que preguntaste. Si cerrás con wrap_up, poné sólo el resumen, sin pregunta ni botones para esta decisión (ya está en el Ops Center). '
        + 'Cada respuesta te llega como un mensaje firmado «Respuesta a tu pregunta «…» [pregunta <id>]: …». '
        + `Si mientras tanto la resolvés por otro lado, retirala con \`${COMANDO} retirar <id>\`.`);
    }
  }
} catch (e) {
  anotar(`error, AskUserQuestion sigue: ${String(e?.message ?? e).slice(0, 200)}`);
  process.exit(0);
}
