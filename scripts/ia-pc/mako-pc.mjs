#!/usr/bin/env node
// =============================================================================
// mako-pc — «MaKo en tu computadora» (docs/ia-del-cliente.md §2, olas 1 y 2, 21/10/2026)
// =============================================================================
// Lo instala el CLIENTE en su computadora. Espera los turnos de SU Ops Center, los piensa con SU Claude Code (el programa
// oficial, con su login) y devuelve la respuesta. Las herramientas de MaKo corren en el servidor, con las reglas del chat.
//
// LA PC ES SÓLO EL CEREBRO, NUNCA LAS MANOS:
//   · Claude Code corre con `--tools ""` (sin terminal, archivos ni web) y SÓLO el MCP de MaKo del turno;
//   · el comando es FIJO (ARGS_CLAUDE, copia de lib/ia-pc-reglas.ts: tests/ia-pc.test.ts compara las dos); lo único que
//     viene del servidor es el modelo, y pasa por la lista MODELOS_PC; el texto de la persona va por stdin;
//   · nunca lee ni manda el token de la suscripción: no toca ~/.claude ni el Keychain. Sólo corre `claude`;
//   · sin ANTHROPIC_API_KEY en el entorno de Claude: con ella, `-p` usaría la key y no la suscripción;
//   · ⚠️ nunca `--bare`: apaga el login de la suscripción.
// Sin dependencias: Node 18+, o el ejecutable de un archivo (Bun) que arma scripts/ia-pc/publicar-binarios.mts.
//
// ⚠️ NUNCA SE CAE SOLO (revisión del Cerebro, 21/10/2026): en Windows nadie lo vuelve a abrir hasta el próximo inicio
// de sesión, así que un error de la red o de la base NO lo apaga. Sale sólo cuando MaKo dice que la PC fue DESCONECTADA
// (un 401 con `revocado`), y ahí se saca a sí mismo del arranque. En Windows es un ejecutable «de ventana» (sin consola,
// publicar-binarios.mts): cada `spawn` va con `windowsHide`, o cada Claude abriría una ventana (medido el 21/10/2026).
//
// Uso (el instalador corre los cuatro primeros; la persona no escribe nada):
//   mako-pc emparejar <CÓDIGO> [--servidor https://hola-mako.com] [--nombre "PC de Ana"]   (queda PENDIENTE)
//   mako-pc confirmar | mako-pc cancelar      (la persona dijo que sí, o que no, a «¿es tu negocio?»)
//   mako-pc sesion                            (sale 0 con un Claude con sesión, 2 sin sesión, 3 sin Claude)
//   mako-pc                                   (espera turnos; lo arranca el sistema al prender la computadora)
//   mako-pc agregar-cuenta                    (otra cuenta de Claude: la PC usa la de más cupo)
//   mako-pc estado
//   mako-pc mako://conectar?codigo=ABCD2345   (el ENLACE de «Conectar mi computadora», sin terminal: pregunta en una ventana)
//   mako-pc mako://iniciar-sesion             (la sesión de Claude sin terminal: una página LOCAL para pegar el código, 0.4.0)
//   mako-pc app                               (MaKo.app en la Mac, 0.4.2: sin Terminal; el código, del portapapeles)
// =============================================================================

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { homedir, hostname } from 'node:os';
import { dirname, join } from 'node:path';

export const VERSION = '0.4.2';
const CARPETA = process.env.MAKO_PC_DIR || join(homedir(), '.mako-pc');
const CONFIG = join(CARPETA, 'config.json');
const REGISTRO = join(CARPETA, 'registro.txt');
const SERVIDOR_DEFAULT = 'https://hola-mako.com';
const LATIDO_MS = 30_000;
const TURNO_TOPE_MS = 4 * 60_000;
/** Cada cuánto se vuelve a mirar la sesión de las cuentas que la tienen (se puede cerrar o vencer). */
const REVISAR_SESION_MS = 10 * 60_000;

/** COPIA de ARGS_CLAUDE (lib/ia-pc-reglas.ts). tests/ia-pc.test.ts frena si difieren. */
export const ARGS_CLAUDE = [
  '-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
  '--tools', '', '--strict-mcp-config', '--allowedTools', 'mcp__mako', '--max-turns', '12',
];
/** COPIA de MODELOS_PC (lib/ia-pc-reglas.ts): lo único del comando que viene del servidor pasa por acá. */
export const MODELOS_PC = ['sonnet', 'opus', 'haiku'];
export const modeloPc = (x) => (MODELOS_PC.includes(x) ? x : 'sonnet');

/** Lo que se le saca al entorno de Claude: con cualquiera de éstas, no usaría la suscripción del cliente. */
export const SIN_ESTAS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX'];

/**
 * Dónde está `claude`. El instalador oficial lo deja en ~/.local/bin, y una ventana abierta ANTES de instalarlo (o el
 * arranque al prender la PC) puede no tener ese PATH: se prueba primero la ruta conocida.
 * @param {Record<string, string | undefined>} [env]
 * @param {(ruta: string) => boolean} [existe]
 */
export function rutaDeClaude(env = process.env, existe = existsSync) {
  if (env.MAKO_PC_CLAUDE) return env.MAKO_PC_CLAUDE;
  const conocida = join(homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
  return existe(conocida) ? conocida : 'claude';
}

/** Sin red, el bucle espera esto (y no gira: sin espera eran ~1000 pedidos por segundo, medido el 21/10/2026). */
export const ESPERAS_SIN_RED_MS = [5_000, 10_000, 30_000, 60_000];
export const esperaSinRed = (fallas) => ESPERAS_SIN_RED_MS[Math.min(Math.max(0, fallas), ESPERAS_SIN_RED_MS.length - 1)];
/** Lo ÚNICO que apaga el programa: MaKo dijo que esta PC fue desconectada. Un 401 sin eso, o un 503, se reintenta. */
export const esRevocado = (r) => r?.status === 401 && r?.datos?.revocado === true;

const leerConfig = () => { try { return JSON.parse(readFileSync(CONFIG, 'utf8')); } catch { return null; } };
function guardarConfig(c) {
  mkdirSync(CARPETA, { recursive: true });
  writeFileSync(CONFIG, JSON.stringify(c, null, 2));
  try { chmodSync(CONFIG, 0o600); } catch { /* Windows: la carpeta ya es del usuario */ }
}
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** El registro, con tope: en segundo plano no hay consola (Windows) y en la Mac crecía sin fin. */
function log(...x) {
  const linea = `${new Date().toISOString()} ${x.join(' ')}\n`;
  try {
    mkdirSync(CARPETA, { recursive: true });
    if (existsSync(REGISTRO) && statSync(REGISTRO).size > 1_000_000) writeFileSync(REGISTRO, readFileSync(REGISTRO, 'utf8').slice(-200_000));
    appendFileSync(REGISTRO, linea);
  } catch { /* sin disco, sin registro: no se cae por eso */ }
}
/** Lo que lee la persona en la ventana del instalador (los comandos de una vez, no el de fondo). */
/** Lo que se dijo, para quien lo quiera mostrar en una ventana (el modo enlace: `conectarDesdeEnlace`). */
let oyente = null;
const decir = (t) => { if (oyente) oyente.push(String(t)); try { console.log(t); } catch { /* sin consola */ } };

async function api(c, metodo, ruta, cuerpo) {
  const res = await fetch(`${c.servidor}${ruta}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(c.token ? { authorization: `Bearer ${c.token}` } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status === 204) return { status: 204, datos: null };
  const datos = await res.json().catch(() => null);
  return { status: res.status, datos };
}

/** COPIA de `limitesDelEvento` (lib/ia-pc-reglas.ts): el % usado del `rate_limit_event` del stream. */
export function limitesDelEvento(e) {
  const o = e && typeof e === 'object' ? e : {};
  const info = o.rate_limit_info && typeof o.rate_limit_info === 'object' ? o.rate_limit_info : o;
  const w = info.unifiedWindows && typeof info.unifiedWindows === 'object' ? info.unifiedWindows : {};
  const pct = (u) => (typeof u === 'number' && Number.isFinite(u) && u >= 0 && u <= 1.5 ? Math.min(100, Math.round(u * 100)) : undefined);
  const iso = (r) => (typeof r === 'number' && Number.isFinite(r) ? new Date(r * 1000).toISOString() : undefined);
  const repone = iso(w.five_hour?.resetsAt);
  const reponeSemana = iso(w.seven_day?.resetsAt);
  return {
    ...(pct(w.five_hour?.utilization) != null ? { usado5h: pct(w.five_hour?.utilization) } : {}),
    ...(pct(w.seven_day?.utilization) != null ? { usadoSemana: pct(w.seven_day?.utilization) } : {}),
    ...(repone ? { repone } : {}),
    ...(reponeSemana ? { reponeSemana } : {}),
  };
}

/** COPIA de `reponeDelTope` (lib/ia-pc-reglas.ts): con la semana agotada, la hora de la semana; si no, la de las 5 horas. */
export const reponeDelTope = (l) => ((l.usadoSemana ?? 0) >= 100 && l.reponeSemana ? l.reponeSemana : l.repone);

/** COPIA de TOPE_CUPO (lib/ia-pc-reglas.ts). */
export const TOPE_CUPO = 95;
/**
 * COPIA de `cuentaConCupo` (lib/ia-pc-reglas.ts): la de menos uso de las 5 horas. Una cuenta cuya ventana ya se repuso
 * (`repone` pasó, o `reponeSemana` para la semana) cuenta como libre: antes quedaba descartada para siempre, porque nada
 * la volvía a medir. Si todas están al tope se usa igual la de menos uso: que Claude conteste su propio límite (con la
 * hora en que se repone).
 * @template {{ usado5h?: number, usadoSemana?: number, repone?: string, reponeSemana?: string }} T
 * @param {T[]} cuentas
 * @param {number} [ahora]
 * @returns {T | null}
 */
export function cuentaConCupo(cuentas, ahora = Date.now()) {
  if (!cuentas.length) return null;
  const uso = (c) => (c.repone && Date.parse(c.repone) <= ahora ? 0 : (c.usado5h ?? 0));
  const semana = (c) => (c.reponeSemana && Date.parse(c.reponeSemana) <= ahora ? 0 : (c.usadoSemana ?? 0));
  const libres = cuentas.filter((c) => uso(c) < TOPE_CUPO && semana(c) < 100);
  return (libres.length ? libres : cuentas).reduce((a, b) => (uso(b) < uso(a) ? b : a));
}

/**
 * COPIA de `falloDeClaude` (lib/ia-pc-reglas.ts): qué fue lo que no salió, para que el chat diga lo cierto.
 * @param {unknown} error
 * @param {{ usado5h?: number, usadoSemana?: number }} [limites]
 */
export function falloDeClaude(error, limites = {}) {
  const e = String(error ?? '');
  if ((limites.usado5h ?? 0) >= 100 || (limites.usadoSemana ?? 0) >= 100 || /usage limit|rate.?limit|hit your limit|limit reached|l[ií]mite/i.test(e)) return 'tope';
  if (/\/login|not logged|log ?in|logged out|authenticat|oauth|credential|invalid api key/i.test(e)) return 'sesion';
  return null;
}

/** Lee el stream de Claude: el `result` final y el último `rate_limit_event`. */
export function leerStream(salida) {
  let resultado = null;
  let limites = {};
  for (const l of String(salida).split('\n')) {
    if (!l.trim()) continue;
    let o;
    try { o = JSON.parse(l); } catch { continue; }
    if (o.type === 'result') resultado = o;
    else if (o.type === 'rate_limit_event') limites = limitesDelEvento(o);
  }
  return { resultado, limites };
}

/**
 * Corre Claude Code oficial con el pedido del turno. NUNCA tira: devuelve la respuesta o el error.
 * @param {{ dir: string, system: string, prompt: string, mcp: unknown, configDir?: string | null, modelo?: unknown }} pedido
 * @param {typeof spawn} [correr]
 * @param {string} [claude]
 * @returns {Promise<{ texto?: string, uso?: { entrada: number, salida: number }, error?: string, limites?: Record<string, unknown> }>}
 */
export function pensar({ dir, system, prompt, mcp, configDir, modelo }, correr = spawn, claude = rutaDeClaude()) {
  return new Promise((resolver) => {
    let listo = false;
    const fin = (r) => { if (!listo) { listo = true; resolver(r); } };
    try {
      mkdirSync(dir, { recursive: true });
      const sistema = join(dir, 'system.txt');
      const mcpJson = join(dir, 'mcp.json');
      writeFileSync(sistema, system);
      writeFileSync(mcpJson, JSON.stringify(mcp));
      try { chmodSync(mcpJson, 0o600); } catch { /* Windows */ }
      const env = { ...process.env };
      for (const k of SIN_ESTAS) delete env[k];
      if (configDir) env.CLAUDE_CONFIG_DIR = configDir;
      let salida = '';
      let error = '';
      const args = [...ARGS_CLAUDE, '--model', modeloPc(modelo), '--system-prompt-file', sistema, '--mcp-config', mcpJson];
      const p = correr(claude, args, { cwd: dir, env, shell: false, windowsHide: true });
      const corte = setTimeout(() => { p.kill(); }, TURNO_TOPE_MS);
      p.stdout.on('data', (b) => { salida += b; });
      p.stderr.on('data', (b) => { error += b; });
      p.on('error', (e) => { clearTimeout(corte); fin({ error: e.code === 'ENOENT' ? 'Claude Code no está instalado en esta computadora' : String(e.message) }); });
      p.on('close', () => {
        clearTimeout(corte);
        const { resultado: r, limites } = leerStream(salida);
        if (!r) return fin({ error: (error || 'Claude no devolvió nada').trim().slice(0, 300), limites });
        if (r.is_error) return fin({ error: String(r.result ?? r.subtype ?? 'error').slice(0, 300), limites });
        fin({ texto: String(r.result ?? ''), uso: { entrada: r.usage?.input_tokens ?? 0, salida: r.usage?.output_tokens ?? 0 }, limites });
      });
      // Si Claude sale sin leer un pedido grande (un Claude viejo que no conoce un argumento), escribir le da EPIPE: sin
      // esto se caía el programa entero, no sólo el turno (revisión del 21/10/2026). Lo cierra 'close'.
      p.stdin.on('error', () => {});
      p.stdin.end(prompt);
    } catch (e) {
      fin({ error: `no pude correr Claude: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) });
    }
  });
}

/** El email y el plan de una cuenta, sin secretos (`claude auth status`), con SU carpeta. `falta` = no hay Claude. */
function estadoDeCuenta(configDir) {
  return new Promise((resolver) => {
    let out = '';
    const env = { ...process.env };
    for (const k of SIN_ESTAS) delete env[k];
    if (configDir) env.CLAUDE_CONFIG_DIR = configDir;
    let p;
    try { p = spawn(rutaDeClaude(), ['auth', 'status'], { shell: false, env, windowsHide: true }); } catch { return resolver({ conSesion: false, falta: true }); }
    p.stdout.on('data', (b) => { out += b; });
    p.on('error', (e) => resolver({ conSesion: false, ...(e.code === 'ENOENT' ? { falta: true } : {}) }));
    p.on('close', () => {
      try {
        const o = JSON.parse(out);
        resolver({ conSesion: !!o.loggedIn, ...(o.email ? { email: String(o.email) } : {}), ...(o.subscriptionType ? { plan: String(o.subscriptionType) } : {}) });
      } catch { resolver({ conSesion: false }); }
    });
  });
}

/** Las cuentas de esta PC (una carpeta de Claude por cuenta). Sin ninguna anotada, la de siempre. */
const cuentasDe = (c) => (Array.isArray(c.cuentas) && c.cuentas.length ? c.cuentas : [{ dir: c.configDir ?? null }]);
/**
 * Lo que se le cuenta a MaKo de cada cuenta CON SESIÓN: nunca un secreto (lo vuelve a sanear el servidor). Sin ninguna,
 * la lista va vacía y MaKo la muestra «Sin sesión de Claude» y no le manda turnos. Un % de una ventana que ya se repuso
 * no se cuenta: no se sabe hasta el próximo turno («Sin medir»).
 */
export const paraElLatido = (cuentas, ahora = Date.now()) => cuentas.filter((x) => x.conSesion === true).map((x) => {
  const vieja = !!x.repone && Date.parse(x.repone) <= ahora;
  const semanaVieja = !!x.reponeSemana && Date.parse(x.reponeSemana) <= ahora;
  return {
    proveedor: 'claude', ...(x.email ? { email: x.email } : {}), ...(x.plan ? { plan: x.plan } : {}),
    ...(x.usado5h != null && !vieja ? { usado5h: x.usado5h } : {}),
    ...(x.usadoSemana != null && !semanaVieja ? { usadoSemana: x.usadoSemana } : {}),
    ...(x.repone && !vieja ? { repone: x.repone } : {}),
    ...(x.reponeSemana && !semanaVieja ? { reponeSemana: x.reponeSemana } : {}),
  };
});
/** Lo que se le suma al latido: sin Claude instalado (MaKo manda al paso 2, no al 3). Nunca con una cuenta con sesión. */
export const extrasDelLatido = (cuentas) => (cuentas.length && cuentas.every((x) => x.falta === true) ? { sinClaude: true } : {});

// ── Conectar: emparejar → «¿es tu negocio?» → confirmar o cancelar ─────────────
// La persona ve A QUÉ NEGOCIO y COMO QUIÉN se conecta antes de que quede (revisión del 21/10/2026: un código de otro
// negocio, pegado con la línea oficial, se llevaba la suscripción de la víctima sin decir nada). Lo pregunta el script del
// instalador, no este programa: en Windows es «de ventana» y no lee la consola.

async function emparejar(p = { codigo: process.argv[3], servidor: arg('--servidor') ?? SERVIDOR_DEFAULT, nombre: arg('--nombre') ?? hostname() }) {
  const codigo = p.codigo;
  const servidor = String(p.servidor ?? SERVIDOR_DEFAULT).replace(/\/+$/, '');
  const nombre = p.nombre ?? hostname();
  if (!codigo) { decir('Falta el código: mako-pc emparejar <CÓDIGO>'); return 1; }
  const r = await api({ servidor }, 'POST', '/api/ia-pc/emparejar', { codigo, nombre }).catch(() => null);
  if (!r) { decir('No pude llegar a MaKo: revisa tu conexión a internet.'); return 1; }
  if (r.status !== 200 || !r.datos?.token) { decir(r.datos?.error ?? `No pude conectar esta computadora (HTTP ${r.status}).`); return 1; }
  const antes = leerConfig() ?? {};
  // Si quedó otro pendiente sin contestar, se suelta: nunca dos.
  if (antes.pendiente?.token) await api({ servidor: antes.pendiente.servidor, token: antes.pendiente.token }, 'POST', '/api/ia-pc/soltar').catch(() => null);
  const negocio = String(r.datos.negocio ?? 'tu negocio');
  const persona = String(r.datos.persona ?? '');
  guardarConfig({ ...antes, pendiente: { servidor, token: r.datos.token, nombre, negocio, persona } });
  decir(`Esta computadora se va a conectar a «${negocio}»${persona ? ` como ${persona}` : ''}.`);
  if (antes.token && antes.negocio) decir(`Hoy está conectada a «${antes.negocio}»${antes.persona ? ` como ${antes.persona}` : ''}: esa conexión se reemplaza.`);
  return 0;
}

/** Un pedido de una vez (confirmar, soltar) con reintentos: sólo lo reintenta si no llegó o MaKo contestó 5xx. */
async function conReintentos(c, ruta, cuerpo) {
  let r = null;
  for (const espera of [0, 2_000, 5_000]) {
    if (espera) await dormir(espera);
    r = await api(c, 'POST', ruta, cuerpo).catch(() => null);
    if (r && r.status < 500) return r;
  }
  return r;
}

/**
 * La persona dijo que sí: MaKo confirma la PC (hasta acá estaba PENDIENTE y no contaba como «su IA», mig 0322) y recién
 * entonces se suelta la conexión de antes y se guarda la nueva. Si MaKo no la confirmó, nada cambia y sale con 1: el
 * instalador vuelve a dejar corriendo lo de antes (segunda revisión del Cerebro, 21/10/2026).
 */
async function confirmar() {
  const c = leerConfig() ?? {};
  const p = c.pendiente;
  if (!p?.token) { decir('No hay ninguna conexión esperando. Pide otro código en MaKo.'); return 1; }
  // La de antes, si era del mismo MaKo: con su token, MaKo le pasa la activación a la nueva al confirmarla, ANTES de que
  // se suelte (si no, entre soltar y el primer latido de la nueva el negocio salía de «sólo su IA»: tercera revisión).
  const anterior = c.token && c.token !== p.token && (c.servidor ?? p.servidor) === p.servidor ? c.token : null;
  const r = await conReintentos({ servidor: p.servidor, token: p.token }, '/api/ia-pc/confirmar', anterior ? { anterior } : undefined);
  if (!r) { decir('No pude llegar a MaKo: revisa tu conexión a internet.'); return 1; }
  if (r.status !== 200) {
    decir(esRevocado(r) ? 'Ese código ya no sirve.' : (r.datos?.error ?? `MaKo no confirmó la conexión (HTTP ${r.status}).`));
    return 1;
  }
  // Primero se guarda la nueva y DESPUÉS se suelta la de antes: el programa viejo, si sigue corriendo, recibe el 401 y
  // sale sin borrar nada (`desconectada` sólo borra su propio token). Al revés, borraba la nueva.
  const resto = { ...c };
  delete resto.pendiente;
  guardarConfig({ ...resto, servidor: p.servidor, token: p.token, nombre: p.nombre, negocio: p.negocio, persona: p.persona });
  // La conexión de antes se suelta en MaKo (si no, quedaba una tarjeta «Sin conexión» para siempre).
  if (c.token && c.token !== p.token) await conReintentos({ servidor: c.servidor ?? p.servidor, token: c.token }, '/api/ia-pc/soltar');
  decir(`Esta computadora quedó conectada a «${p.negocio}».`);
  return 0;
}

/** La persona dijo que no (o el instalador no siguió): se suelta lo pendiente y lo de antes queda como estaba. */
async function cancelar() {
  const c = leerConfig() ?? {};
  if (c.pendiente?.token) await conReintentos({ servidor: c.pendiente.servidor, token: c.pendiente.token }, '/api/ia-pc/soltar');
  const resto = { ...c };
  delete resto.pendiente;
  guardarConfig(resto);
  return 0;
}

// ── Conectar desde un ENLACE, sin terminal (22/10/2026) ─────────────────────────
// Martín: «el proceso de instalación jamás sea por Powershell, ni siquiera que se tenga que abrir» (docs/plan-instalador-
// escritorio.md). «Conectar mi computadora» abre `mako://conectar?codigo=…`; el sistema le pasa el enlace a este programa
// (lo registra el instalador), que empareja, PREGUNTA EN UNA VENTANA del sistema y queda conectado y arrancando.
// ⚠️ EL SERVIDOR NUNCA SALE DEL ENLACE: cualquier página puede abrir un `mako://`, y con su servidor se llevaría la computadora
// (y la suscripción de Claude de la persona) a su MaKo. Del enlace sale sólo el código; la ventana dice a qué negocio y como
// quién se conecta, como el «¿Es tu negocio?» del instalador de consola.

/**
 * La versión con el sistema, para el latido: `0.4.0+windows` o `0.4.0+mac` (varias computadoras, 22/10/2026: la tarjeta dice
 * cuál es cuál; lib/ia-pc-reglas.ts → `sistemaDeLaVersion`). Sin migración: el servidor ya acepta el `+`.
 */
export const versionConSistema = (plataforma = process.platform) =>
  `${VERSION}${plataforma === 'win32' ? '+windows' : plataforma === 'darwin' ? '+mac' : ''}`;

/** Las mismas reglas del código que lib/ia-pc-reglas.ts (`normalizarCodigo`; tests/ia-pc-enlace.test.ts compara las dos). */
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LARGO_CODIGO = 8;

/** El código de un enlace `mako://conectar?codigo=ABCD-2345`, normalizado. null si el enlace no es eso (otro esquema, otra
 *  acción, sin código o con uno que no puede ser). */
export function codigoDelEnlace(enlace) {
  let u;
  try { u = new URL(String(enlace ?? '').trim()); } catch { return null; }
  if (u.protocol !== 'mako:') return null;
  const accion = (u.hostname || u.pathname.replace(/^\/+/, '').split('/')[0] || '').toLowerCase();
  if (accion !== 'conectar') return null;
  const c = String(u.searchParams.get('codigo') ?? '').toUpperCase().replace(/[\s-]/g, '');
  return c.length === LARGO_CODIGO && [...c].every((ch) => ALFABETO_CODIGO.includes(ch)) ? c : null;
}

/**
 * Lo que pregunta la ventana: a qué negocio y como quién, y si reemplaza una conexión de antes. `conectada`: hoy tiene una
 * conexión (`antes` es su negocio, si lo guardó: la 0.2.0 no lo guardaba).
 * ⚠️ CAMBIAR DE NEGOCIO VA PRIMERO (revisión del enlace, 22/10/2026): es el caso del phishing —otro cliente de MaKo manda su
 * enlace—, y la ventana decía «Tu Ops Center va a contestar con tu Claude» (falso: es el de OTRO) y el reemplazo, al final.
 */
export function preguntaDeConexion(p) {
  const como = p.persona ? ` como ${p.persona}` : '';
  const pregunta = `¿Conectar esta computadora a «${p.negocio}»${como}?`;
  const usa = `El Ops Center de «${p.negocio}» va a usar tu suscripción de Claude, en esta computadora.`;
  if (p.conectada && p.antes !== p.negocio) {
    const deAntes = p.antes ? `«${p.antes}»` : 'otro negocio';
    return `Esta computadora hoy usa tu Claude para ${deAntes}. Si sigues, lo va a usar «${p.negocio}»${como}, y ${deAntes} se queda sin él.\n\n${pregunta}\n\n${usa}`;
  }
  const otraVez = p.conectada ? `\n\nHoy ya está conectada a «${p.negocio}»: esa conexión se reemplaza.` : '';
  return `${pregunta}\n\n${usa}${otraVez}`;
}

/** Dos enlaces a la vez: el de esta ventana ya no es el pendiente (lo soltó el otro). */
export const OTRO_ENLACE = 'Se abrió otro enlace de MaKo mientras esta ventana esperaba: desde acá no conecté nada. Contesta la otra ventana.';

const aUtf16 = (s) => Buffer.from(`${s}\0`, 'utf16le');
const comillasAs = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Una ventana del SISTEMA, sin consola. `botones`: 'si-no' devuelve true con «Sí»; 'ok' sólo avisa. En Windows, `MessageBoxW`
 * de user32 (con `bun:ffi`, dentro del ejecutable); en la Mac, `osascript`. Sin poder mostrarla, false: nunca se conecta sin
 * que la persona diga que sí. `MAKO_PC_SI=1` contesta «sí» sin ventana: sólo para la prueba de punta a punta.
 */
export async function ventana(titulo, texto, botones = 'si-no') {
  if (botones === 'si-no' && process.env.MAKO_PC_SI === '1') return true;
  try {
    if (process.platform === 'win32' && typeof globalThis.Bun !== 'undefined') {
      const { dlopen, FFIType } = await import('bun:ffi');
      const user32 = dlopen('user32.dll', { MessageBoxW: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u32], returns: FFIType.i32 } });
      // MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2, o MB_OK | MB_ICONINFORMATION; siempre MB_TOPMOST | MB_SETFOREGROUND (sale
      // adelante). ⚠️ «No» es el botón por defecto (revisión del enlace, 22/10/2026): la ventana se lleva el foco, y una página
      // que abre el enlace mientras la persona escribe se llevaba el «Sí» con un Enter.
      const estilo = (botones === 'si-no' ? 0x4 | 0x20 | 0x100 : 0x0 | 0x40) | 0x40000 | 0x10000;
      const r = user32.symbols.MessageBoxW(null, aUtf16(texto), aUtf16(titulo), estilo);
      user32.close();
      return r === 6; // IDYES
    }
    if (process.platform === 'darwin') {
      const b = botones === 'si-no' ? '{"No", "Sí, conectar"} default button 1 cancel button 1' : '{"Listo"} default button 1';
      const r = spawnSync('osascript', ['-e', `display dialog ${comillasAs(texto)} with title ${comillasAs(titulo)} buttons ${b} with icon note`], { encoding: 'utf8' });
      return botones === 'si-no' ? r.status === 0 && /Sí, conectar/.test(r.stdout ?? '') : r.status === 0;
    }
  } catch (e) {
    log(`No pude mostrar la ventana: ${e instanceof Error ? e.message : String(e)}`);
  }
  return false;
}

/**
 * Deja corriendo el programa con la conexión nueva: los de antes se cierran (el de antes, con su token ya soltado, igual
 * saldría con el 401), y arranca uno nuevo, sin consola. En la Mac, el LaunchAgent lo relanza.
 */
export function arrancarConLaNueva() {
  if (process.env.MAKO_PC_SIN_ARRANQUE === '1') return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/F', '/FI', `PID ne ${process.pid}`, '/IM', 'mako-pc.exe'], { windowsHide: true, stdio: 'ignore' });
      spawn(process.execPath, [], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else if (process.platform === 'darwin') {
      spawnSync('launchctl', ['kickstart', '-k', `gui/${process.getuid?.() ?? ''}/com.hola-mako.pc`], { stdio: 'ignore' });
    }
  } catch (e) {
    log(`No pude arrancar con la conexión nueva: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * El enlace de «Conectar mi computadora»: empareja con SU servidor, pregunta en una ventana y confirma (o cancela). Lo que
 * falla se dice en una ventana. `p` es para los tests (la ventana y el arranque de mentira).
 */
export async function conectarDesdeEnlace(enlace, p = { ventana, arrancar: arrancarConLaNueva }) {
  const codigo = codigoDelEnlace(enlace);
  if (!codigo) { await p.ventana('MaKo', 'Ese enlace no sirve: pide otro en MaKo (Tus cuentas de IA).', 'ok'); return 1; }
  oyente = [];
  try {
    const antes = leerConfig() ?? {};
    if (await emparejar({ codigo, servidor: SERVIDOR_DEFAULT, nombre: nombreDeLaComputadora() }) !== 0) {
      await p.ventana('MaKo', oyente.at(-1) ?? 'No pude conectar esta computadora. Pide otro código en MaKo.', 'ok');
      return 1;
    }
    const pend = (leerConfig() ?? {}).pendiente ?? {};
    const si = await p.ventana('Conectar MaKo', preguntaDeConexion({ negocio: pend.negocio ?? 'tu negocio', persona: pend.persona, antes: antes.negocio ?? null, conectada: !!antes.token }));
    // Dos enlaces a la vez (revisión del enlace): el segundo suelta el pendiente de éste y guarda el suyo, y `confirmar` /
    // `cancelar` leen el que haya: el «Sí» de esta ventana confirmaba el de la otra, con el cartel de ésta. Sólo se
    // contesta si lo pendiente sigue siendo ESTE.
    if (!pend.token || (leerConfig() ?? {}).pendiente?.token !== pend.token) {
      await p.ventana('MaKo', OTRO_ENLACE, 'ok');
      return 1;
    }
    if (!si) {
      await cancelar();
      await p.ventana('MaKo', 'No la conecté: tu computadora sigue como estaba.', 'ok');
      return 1;
    }
    if (await confirmar() !== 0) {
      // Lo pendiente se suelta (como con el «no»): lo de antes sigue como estaba.
      const dijo = oyente.at(-1);
      await cancelar();
      await p.ventana('MaKo', dijo ?? 'No pude confirmar la conexión: tu computadora sigue como estaba. Pide otro código en MaKo.', 'ok');
      return 1;
    }
    p.arrancar();
    const neg = pend.negocio ?? 'tu negocio';
    // Sin la sesión de Claude, la PC queda conectada pero no contesta nada: se ofrece iniciarla acá, sin terminal (0.4.0).
    const claude = await (p.sesionDeClaude ?? sesionDeClaude)().catch(() => 'con-sesion');
    if (claude === 'falta') {
      await p.ventana('MaKo', `Esta computadora quedó conectada a «${neg}». ${FALTA_CLAUDE}`, 'ok');
      return 0;
    }
    if (claude === 'sin-sesion') {
      if (await p.ventana('MaKo', `¡Listo! Esta computadora quedó conectada a «${neg}».\n\nFalta iniciar sesión en tu Claude para que conteste. ¿Te abro el navegador para iniciarla?`)) {
        await (p.iniciarSesion ?? iniciarSesionDeClaude)();
      } else {
        await p.ventana('MaKo', 'Cuando quieras, inícialo desde MaKo: Tus cuentas de IA › Iniciar sesión en Claude.', 'ok');
      }
      return 0;
    }
    await p.ventana('MaKo', `¡Listo! Esta computadora quedó conectada a «${neg}». Déjala prendida.`, 'ok');
    return 0;
  } finally {
    oyente = null;
  }
}

// ── Iniciar sesión en Claude sin terminal (0.4.0) ─────────────────────────────
// Martín (22/10/2026): «el proceso de instalación jamás sea por Powershell, ni siquiera que se tenga que abrir». Sin consola,
// `claude auth login` no termina solo: muestra la URL y espera que le PEGUEN el código («Paste code here if prompted»), que lee
// por stdin (medido el 23/10/2026 con una carpeta de Claude de prueba: un código falso da «Login failed … 400» y sale con 1).
// Acá se lo corre sin ventana y se sirve una página LOCAL —127.0.0.1, con un secreto en la ruta— con el botón para entrar a
// Claude y el lugar para pegar el código, que va directo al stdin de `claude`.
// ⚠️ EL CÓDIGO NUNCA SALE DE ESTA COMPUTADORA: ni a MaKo, ni al registro, ni a la consola. Y la página sólo contesta con su
// dirección (127.0.0.1:puerto, no un nombre que otro resuelva acá), su secreto y, al mandar, su mismo origen.

/** La URL de autorización que imprime `claude auth login`, o null. */
export function urlDeLoginDeClaude(texto) {
  const m = /https:\/\/[^\s"'<>]+\/oauth\/authorize\?[^\s"'<>]+/.exec(String(texto ?? ''));
  return m ? m[0] : null;
}

/** El código que pega la persona: sin espacios, de lo que puede tener (letras, números, `-_.~#`), de 8 a 512. */
export function codigoDeLogin(crudo) {
  const c = String(crudo ?? '').replace(/\s+/g, '');
  return /^[A-Za-z0-9._~#-]{8,512}$/.test(c) ? c : null;
}

const escHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/** La página local. `estado`: 'pedir' (el botón y el campo, con `aviso` si lo pegado no sirve), 'listo' o 'error'. */
export function paginaDeLogin({ estado, urlClaude = '', aviso = '', error = '' }) {
  const cuerpo = estado === 'listo'
    ? '<h1>¡Listo!</h1><p>Tu Claude ya tiene la sesión iniciada. Puedes cerrar esta pestaña y volver a MaKo.</p>'
    : estado === 'error'
      ? `<h1>No pude iniciar la sesión</h1><p>${escHtml(error || 'Claude no aceptó el código.')}</p><p>Vuelve a MaKo (Tus cuentas de IA) y toca «Iniciar sesión en Claude» otra vez.</p>`
      : `<h1>Inicia sesión en tu Claude</h1>
<ol><li><a class="boton" href="${escHtml(urlClaude)}" target="_blank" rel="noopener noreferrer">Entrar a Claude</a> con tu cuenta de siempre (Pro o Max). Si ya se abrió en otra pestaña, usa ésa.</li>
<li>Claude te muestra un código: cópialo y pégalo acá.</li></ol>
${aviso ? `<p class="aviso">${escHtml(aviso)}</p>` : ''}<form method="post"><input name="codigo" autocomplete="off" autofocus required placeholder="Pega el código de Claude"><button type="submit">Listo</button></form>
<p class="nota">Esta página es de tu computadora: el código va directo a tu Claude. MaKo nunca lo ve.</p>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MaKo · Iniciar sesión en Claude</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#2e3440;background:#eceff4}h1{font-size:22px}.boton,button{display:inline-block;background:#1877f2;color:#fff;border:0;border-radius:8px;padding:8px 14px;text-decoration:none;font:inherit;cursor:pointer}input{font:inherit;padding:8px;width:100%;box-sizing:border-box;margin:8px 0;border:1px solid #c8ccd4;border-radius:8px}.nota{color:#5e6779;font-size:14px}.aviso{color:#bf616a}li{margin:8px 0}</style></head><body>${cuerpo}</body></html>`;
}

/** Abre una URL en el navegador de la persona, sin consola. */
export function abrirEnElNavegador(url) {
  try {
    if (process.platform === 'win32') spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch (e) {
    log(`No pude abrir el navegador: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

/**
 * Corre `claude auth login` sin ventana y la página local para pegar el código. 0 = quedó con sesión; 1 = no; 3 = no hay
 * Claude Code. `p` es para los tests: cómo se corre `claude` (uno de mentira), cómo se abre el navegador, el plazo y a quién
 * avisarle la dirección de la página.
 */
export async function iniciarSesionDeClaude(p = {}) {
  const { correr = spawn, claude = rutaDeClaude(), abrir = abrirEnElNavegador, plazoMs = 15 * 60_000, alAbrir } = p;
  const configDir = 'configDir' in p ? p.configDir : (cuentasDe(leerConfig() ?? {})[0]?.dir ?? null);
  const env = { ...process.env };
  for (const k of SIN_ESTAS) delete env[k];
  if (configDir) env.CLAUDE_CONFIG_DIR = configDir;
  let proc;
  try { proc = correr(claude, ['auth', 'login'], { shell: false, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); } catch { return 3; }
  const termino = new Promise((ok) => {
    proc.on('close', (n) => ok(n ?? 1));
    proc.on('error', (e) => ok(e?.code === 'ENOENT' ? 3 : 1));
  });
  let salida = '';
  const urlClaude = await new Promise((ok) => {
    const mirar = (b) => { salida += b; const u = urlDeLoginDeClaude(salida); if (u) ok(u); };
    proc.stdout?.on('data', mirar);
    proc.stderr?.on('data', mirar);
    termino.then(() => ok(null));
    setTimeout(() => ok(null), 30_000).unref?.();
  });
  if (!urlClaude) {
    try { proc.kill(); } catch { /* ya salió */ }
    return (await termino) === 3 ? 3 : 1;
  }
  const secreto = randomBytes(16).toString('hex');
  let estado = 'pedir';
  let error = '';
  const servidor = createServer((req, res) => {
    const direccion = `127.0.0.1:${servidor.address().port}`;
    const responder = (http, html) => {
      // ⚠️ `same-origin`, NUNCA `no-referrer` (revisión de la 0.4.0, 23/10/2026): con `no-referrer` el navegador manda el POST
      // de esta misma página con `Origin: null`, el chequeo de abajo lo rechaza y al pegar el código salía un 403 en blanco.
      // Con `same-origin` el POST lleva su origen, y a Claude no le llega ningún Referer (el enlace ya va con `noreferrer`).
      res.writeHead(http, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'same-origin', 'x-frame-options': 'DENY' });
      res.end(html);
    };
    if (req.headers.host !== direccion || (req.url ?? '').split('?')[0] !== `/${secreto}`) return responder(404, '');
    if (req.method === 'GET') return responder(200, paginaDeLogin({ estado, urlClaude, error }));
    if (req.method !== 'POST' || (req.headers.origin && req.headers.origin !== `http://${direccion}`)) return responder(403, '');
    let cuerpo = '';
    req.on('data', (b) => { cuerpo += b; if (cuerpo.length > 4096) req.destroy(); });
    req.on('end', async () => {
      if (estado !== 'pedir') return responder(200, paginaDeLogin({ estado, urlClaude, error }));
      const codigo = codigoDeLogin(new URLSearchParams(cuerpo).get('codigo'));
      if (!codigo) return responder(200, paginaDeLogin({ estado, urlClaude, aviso: 'Eso no parece el código de Claude: cópialo entero y pégalo otra vez.' }));
      estado = 'esperando';
      proc.stdin?.write(`${codigo}\n`);
      const n = await Promise.race([termino, dormir(60_000).then(() => null)]);
      if (n === 0) estado = 'listo';
      else { estado = 'error'; error = n == null ? 'Claude tardó demasiado en contestar.' : 'Claude no aceptó el código: puede haber vencido.'; }
      responder(200, paginaDeLogin({ estado, urlClaude, error }));
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const local = `http://127.0.0.1:${servidor.address().port}/${secreto}`;
  alAbrir?.(local);
  abrir(local);
  const n = await Promise.race([termino, dormir(plazoMs).then(() => null)]);
  if (n == null) { try { proc.kill(); } catch { /* ya salió */ } }
  // La última respuesta tiene que salir antes de cerrar.
  await dormir(500);
  servidor.close();
  servidor.closeAllConnections?.();
  log(n === 0 ? 'La sesión de Claude quedó iniciada.' : 'La sesión de Claude no quedó iniciada.');
  return n === 0 ? 0 : n === 3 ? 3 : 1;
}

/** ¿El Claude de esta PC tiene la sesión? 'con-sesion', 'sin-sesion' o 'falta' (no hay Claude Code). */
export async function sesionDeClaude() {
  let falta = false;
  for (const x of cuentasDe(leerConfig() ?? {})) {
    const e = await estadoDeCuenta(x.dir);
    if (e.conSesion) return 'con-sesion';
    if (e.falta) falta = true;
  }
  return falta ? 'falta' : 'sin-sesion';
}

export const FALTA_CLAUDE = 'Esta computadora no tiene Claude Code. Vuelve a abrir el instalador de MaKo: lo instala.';

/** El enlace `mako://iniciar-sesion` (el botón de MaKo cuando la PC quedó sin la sesión de Claude). */
export async function iniciarSesionDesdeEnlace(p = { ventana, iniciar: iniciarSesionDeClaude }) {
  const n = await p.iniciar();
  if (n === 3) await p.ventana('MaKo', FALTA_CLAUDE, 'ok');
  return n === 0 ? 0 : 1;
}

/** Qué pide un enlace `mako:`: 'conectar', 'iniciar-sesion', o null. */
export function accionDelEnlace(enlace) {
  let u;
  try { u = new URL(String(enlace ?? '').trim()); } catch { return null; }
  if (u.protocol !== 'mako:') return null;
  const accion = (u.hostname || u.pathname.replace(/^\/+/, '').split('/')[0] || '').toLowerCase();
  return accion === 'conectar' || accion === 'iniciar-sesion' ? accion : null;
}

// ── La app de la Mac (0.4.2): sin Terminal ─────────────────────────────────────
// Martín (22/10/2026): «jamás por Powershell, ni siquiera que se tenga que abrir». Y en la llamada del 23/10 (Fathom 195591907),
// Mauricio conectó su MacBook por la Terminal y le costó («No abrió nada», «escribí S y apretá Enter»). MaKo.app (la arma
// scripts/ia-pc/publicar-binarios.mts) copia este programa a ~/.mako-pc/bin, le pone la firma local que pide el chip de
// Apple y lo abre con `app`. ⚠️ En la Mac un enlace mako:// llega como un EVENTO de macOS (Apple Event), no como argumento,
// y este programa no los recibe: el código lo toma del PORTAPAPELES (la persona tocó «Copiar código» en MaKo) o lo pide en
// una ventana. El arranque es el MISMO LaunchAgent que deja la línea de la Terminal: una Mac ya conectada así no cambia.

/** El código de MaKo en lo que se copió o se escribió: SÓLO el código («ABCD-2345»), normalizado; cualquier otro texto, null. */
export function codigoDelTexto(texto) {
  const t = String(texto ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
  return t.length === LARGO_CODIGO && [...t].every((ch) => ALFABETO_CODIGO.includes(ch)) ? t : null;
}

/** Lo que hay en el portapapeles (en la Mac, `pbpaste`); '' si no se puede. */
export function portapapeles() {
  if (process.platform !== 'darwin') return '';
  try { return spawnSync('pbpaste', [], { encoding: 'utf8', timeout: 5000 }).stdout ?? ''; } catch { return ''; }
}

/** Una ventana del sistema que pide un texto (en la Mac, `osascript`). null si cancela o no se puede mostrar. */
export async function pedirTexto(titulo, texto, inicial = '') {
  if (process.platform !== 'darwin') return null;
  try {
    const r = spawnSync('osascript', ['-e', `display dialog ${comillasAs(texto)} default answer ${comillasAs(inicial)} with title ${comillasAs(titulo)} buttons {"Cancelar", "Conectar"} default button 2 cancel button 1 with icon note`], { encoding: 'utf8' });
    if (r.status !== 0) return null;
    const m = /text returned:(.*)$/m.exec(r.stdout ?? '');
    return m ? m[1].trim() : null;
  } catch { return null; }
}

/** Un aviso que no espera (en la Mac, una notificación): mientras se instala algo, la persona sabe qué pasa. */
export function avisar(texto) {
  if (process.platform !== 'darwin') return;
  try { spawn('osascript', ['-e', `display notification ${comillasAs(texto)} with title "MaKo"`], { detached: true, stdio: 'ignore' }).unref(); } catch { /* sin aviso */ }
}

/** El nombre de esta computadora como lo ve la persona («MacBook Pro de Mauricio»), no el de la red. */
export function nombreDeLaComputadora() {
  if (process.platform === 'darwin') {
    try { const n = spawnSync('scutil', ['--get', 'ComputerName'], { encoding: 'utf8', timeout: 5000 }).stdout?.trim(); if (n) return n; } catch { /* */ }
  }
  return hostname();
}

const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const ARRANQUE_MAC = 'com.hola-mako.pc';

/** El LaunchAgent de la Mac: el MISMO que deja la línea de la Terminal (lib/ia-pc-reglas.ts → scriptDeInstalacion). */
export function plistDelArranque(binario = join(homedir(), '.mako-pc', 'bin', 'mako-pc'), home = homedir()) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    `<key>Label</key><string>${ARRANQUE_MAC}</string>`,
    `<key>ProgramArguments</key><array><string>${escXml(binario)}</string></array>`,
    // Relanza sólo si se CAYÓ: al desconectarla sale con 0 y se queda quieto.
    '<key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>',
    `<key>EnvironmentVariables</key><dict><key>PATH</key><string>${escXml(home)}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>`,
    '</dict></plist>',
    '',
  ].join('\n');
}

/** Deja el arranque de la Mac puesto y lo (re)carga: así corre YA, con el programa recién copiado. */
export function instalarArranqueMac() {
  if (process.platform !== 'darwin' || process.env.MAKO_PC_SIN_ARRANQUE === '1') return;
  try {
    const dir = join(homedir(), 'Library', 'LaunchAgents');
    mkdirSync(dir, { recursive: true });
    const plist = join(dir, `${ARRANQUE_MAC}.plist`);
    writeFileSync(plist, plistDelArranque());
    spawnSync('launchctl', ['unload', plist], { stdio: 'ignore' });
    spawnSync('launchctl', ['load', plist], { stdio: 'ignore' });
  } catch (e) {
    log(`No pude dejar el arranque de la Mac: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * ¿Lo abrieron como MaKo.app FIRMADA? Firmada, el ejecutable de la app es este programa (un universal, scripts/ia-pc/
 * firmar-mac.mjs): la firma de un guion vive en atributos que el .zip no guarda. Sin firmar, el ejecutable es un guion
 * (lib/ia-pc-reglas.ts → lanzadorDeLaAppMac) que corre la copia de ~/.mako-pc/bin con `app`, y esto da false.
 */
export function esLaAppDeMac(ejecutable = process.execPath) {
  return /\.app\/Contents\/MacOS\/[^/]+$/.test(ejecutable);
}

/**
 * Lo que hace el guion de la app sin firmar, para la firmada: se copia a ~/.mako-pc/bin, donde lo busca el arranque (el
 * mismo de la Terminal), y le saca la cuarentena. SIN la firma local del guion: la de Apple ya vale, y pisarla la perdería.
 */
export function copiarLaAppAlArranque(p = {}) {
  const {
    origen = process.execPath, destino = join(homedir(), '.mako-pc', 'bin', 'mako-pc'),
    quitarCuarentena = (f) => spawnSync('xattr', ['-d', 'com.apple.quarantine', f], { stdio: 'ignore' }),
  } = p;
  mkdirSync(dirname(destino), { recursive: true });
  const nuevo = `${destino}.nuevo`;
  copyFileSync(origen, nuevo);
  chmodSync(nuevo, 0o755);
  quitarCuarentena(nuevo);
  renameSync(nuevo, destino);
  return destino;
}

/** Claude Code con su instalador OFICIAL (code.claude.com/docs/en/setup), sin Terminal: lo corre la app, oculto. 0 si quedó. */
export function instalarClaudeCode(p = {}) {
  const { correr = spawn, plazoMs = 10 * 60_000 } = p;
  return new Promise((ok) => {
    let proc;
    try {
      proc = correr('/bin/bash', ['-c', 'curl -fsSL https://claude.ai/install.sh | bash'], {
        stdio: 'ignore', env: { ...process.env, PATH: `${join(homedir(), '.local', 'bin')}:/usr/bin:/bin:/usr/sbin:/sbin` },
      });
    } catch { return ok(1); }
    const reloj = setTimeout(() => { try { proc.kill(); } catch { /* ya salió */ } ok(1); }, plazoMs);
    reloj.unref?.();
    proc.on('close', (n) => { clearTimeout(reloj); ok(n ?? 1); });
    proc.on('error', () => { clearTimeout(reloj); ok(1); });
  });
}

/**
 * MaKo.app en la Mac (0.4.2): Claude Code si falta; si ya está conectada (y no copió un código nuevo), que siga andando con el
 * programa recién copiado, y si a su Claude le falta la sesión, ofrecerla; si no, el código —del portapapeles o escrito— y la
 * misma conexión que el enlace de Windows (`conectarDesdeEnlace`: a qué negocio, el «sí», el arranque y la sesión).
 * 0 = quedó conectada (o ya lo estaba). `p` es para los tests.
 */
export async function abrirLaApp(p = {}) {
  const {
    ventana: v = ventana, pedir = pedirTexto, copiado: leerCopiado = portapapeles, sesion = sesionDeClaude,
    instalarClaude = instalarClaudeCode, iniciarSesion = iniciarSesionDeClaude, arrancar = instalarArranqueMac,
    conectar = conectarDesdeEnlace, aviso = avisar,
  } = p;
  // Claude Code primero: sin él, la Mac se conecta y no contesta nada.
  if ((await sesion().catch(() => 'con-sesion')) === 'falta') {
    aviso('Instalo Claude Code en esta Mac: tarda un minuto.');
    if ((await instalarClaude()) !== 0) {
      await v('MaKo', 'No pude instalar Claude Code. Revisa la conexión a internet y vuelve a abrir MaKo.', 'ok');
      return 1;
    }
  }
  const c = leerConfig() ?? {};
  const delCopiado = codigoDelTexto(leerCopiado());
  if (c.token && !delCopiado) {
    // Ya conectada: que siga andando, con el programa recién copiado.
    arrancar();
    const neg = c.negocio ?? 'tu negocio';
    if ((await sesion().catch(() => 'con-sesion')) === 'sin-sesion') {
      if (await v('MaKo', `Esta Mac está conectada a «${neg}», pero tu Claude no tiene la sesión iniciada: no contesta. ¿Te abro el navegador para iniciarla?`)) await iniciarSesion();
      return 0;
    }
    await v('MaKo', `Esta Mac está conectada a «${neg}» y andando. Para conectarla a otro negocio, copia un código nuevo en MaKo y vuelve a abrir MaKo.`, 'ok');
    return 0;
  }
  const codigo = delCopiado ?? codigoDelTexto(await pedir('MaKo', 'Copia el código de «Tus cuentas de IA» en MaKo y pégalo acá:', ''));
  if (!codigo) {
    await v('MaKo', 'No encontré el código. Cópialo en MaKo (Tus cuentas de IA › Conectar) y vuelve a abrir MaKo.', 'ok');
    return 1;
  }
  return conectar(`mako://conectar?codigo=${codigo}`, { ventana: v, arrancar, sesionDeClaude: sesion, iniciarSesion });
}

/** ¿Hay un Claude con sesión? 0 sí, 2 sin sesión, 3 sin Claude instalado (el instalador decide qué hacer). */
async function sesion() {
  const c = leerConfig() ?? {};
  let falta = false;
  for (const x of cuentasDe(c)) {
    const e = await estadoDeCuenta(x.dir);
    if (e.conSesion) { decir(`Tu Claude tiene la sesión iniciada${e.email ? ` (${e.email})` : ''}.`); return 0; }
    if (e.falta) falta = true;
  }
  decir(falta ? 'No encuentro Claude en esta computadora.' : 'Tu Claude todavía no tiene la sesión iniciada.');
  return falta ? 3 : 2;
}

async function agregarCuenta() {
  const c = leerConfig() ?? {};
  const cuentas = cuentasDe(c).filter((x) => x.dir);
  const dir = join(CARPETA, 'cuentas', String(cuentas.length + 1));
  mkdirSync(dir, { recursive: true });
  decir('Se abre Claude para iniciar sesión con la OTRA cuenta en el navegador.');
  await new Promise((ok) => {
    const p = spawn(rutaDeClaude(), ['auth', 'login'], { stdio: 'inherit', shell: false, env: { ...process.env, CLAUDE_CONFIG_DIR: dir } });
    p.on('close', ok);
    p.on('error', ok);
  });
  const e = await estadoDeCuenta(dir);
  if (!e.conSesion) { decir('Esa cuenta no quedó con la sesión iniciada. Vuelve a intentarlo.'); return 1; }
  const base = cuentasDe(c);
  guardarConfig({ ...c, cuentas: [...base, { dir, email: e.email, plan: e.plan }] });
  decir(`¡Listo! Ahora esta computadora tiene ${base.length + 1} cuentas de Claude, y usa la que tenga más cupo.`);
  return 0;
}

// ── Desconectada: se saca del arranque y sale ─────────────────────────────────

/**
 * MaKo desconectó esta PC: se borra el token y el arranque automático. Quien llama sale con 0 (en la Mac, launchd sólo
 * relanza una salida que NO es 0: antes salía con 1 y la relanzaba cada 10 s para siempre).
 * ⚠️ Sólo si lo desconectado es SU token: si mientras tanto se guardó otra conexión (reinstalar suelta la de antes), el
 * programa viejo que recibe el 401 no borra la nueva ni saca el arranque, que ya es del nuevo (segunda revisión).
 */
async function desconectada(miToken) {
  log('MaKo desconectó esta computadora. Para volver a usarla, conéctala de nuevo desde MaKo.');
  const c = { ...(leerConfig() ?? {}) };
  if (c.token && c.token !== miToken) return;
  const negocio = c.negocio;
  delete c.token;
  try { guardarConfig(c); } catch { /* */ }
  // `MAKO_PC_SIN_ARRANQUE=1`: los tests (tests/ia-pc-revision.test.ts) no tocan el arranque de la PC donde corren.
  if (process.env.MAKO_PC_SIN_ARRANQUE === '1') return;
  try {
    if (process.platform === 'win32') {
      await new Promise((ok) => {
        const p = spawn('reg', ['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'MaKo', '/f'], { shell: false, windowsHide: true, stdio: 'ignore' });
        p.on('close', ok);
        p.on('error', ok);
      });
    } else if (process.platform === 'darwin') {
      rmSync(join(homedir(), 'Library', 'LaunchAgents', 'com.hola-mako.pc.plist'), { force: true });
    }
  } catch { /* lo intenta y sale igual */ }
  // Lo DICE (varias computadoras, 22/10/2026: «Desconectar» desde MaKo o desde SuperAdmin): sin consola, nadie leía el
  // registro. Sólo cuando la desconectaron a ELLA (al reemplazarla por otra conexión, arriba ya salió sin decir nada), y al
  // FINAL, esperándola: quien llama sale apenas esto vuelve, y la ventana no llegaba a salir.
  await ventana('MaKo', `MaKo desconectó esta computadora${negocio ? ` de «${negocio}»` : ''}. Para volver a usarla, conéctala de nuevo desde MaKo (Tus cuentas de IA).`, 'ok');
}

// ── Esperar turnos ────────────────────────────────────────────────────────────

/**
 * Vuelve a mirar la sesión: las que no la tienen, siempre; las que sí, cada REVISAR_SESION_MS. Antes suma las cuentas
 * que se agregaron con `agregar-cuenta` mientras corría (si no, la nueva no se usaba hasta reiniciar la PC).
 */
export function sumarCuentasNuevas(cuentas, config = leerConfig()) {
  if (!config) return 0;
  let n = 0;
  for (const y of cuentasDe(config)) if (!cuentas.some((x) => (x.dir ?? null) === (y.dir ?? null))) { cuentas.push({ ...y }); n++; }
  return n;
}
async function revisarSesiones(cuentas, todas = false) {
  if (sumarCuentasNuevas(cuentas)) todas = true;
  const ahora = Date.now();
  for (const x of cuentas) {
    if (!todas && x.conSesion === true && ahora - (x.revisada ?? 0) < REVISAR_SESION_MS) continue;
    const e = await estadoDeCuenta(x.dir);
    if (e.conSesion !== x.conSesion) log(e.conSesion ? `Claude con sesión${e.email ? ` (${e.email})` : ''}.` : 'Claude SIN sesión: inicia sesión en tu Claude para que MaKo lo use.');
    Object.assign(x, e, { revisada: ahora });
  }
}

/** Manda la respuesta de un turno, con reintentos: si se pierde en la red, la persona esperaba los 4 minutos. */
async function contestar(c, id, cuerpo) {
  for (const espera of [0, 2_000, 5_000]) {
    if (espera) await dormir(espera);
    const r = await api(c, 'POST', `/api/ia-pc/turno/${Number(id)}`, cuerpo).catch(() => null);
    if (r && r.status < 500) return r;
  }
  return null;
}

async function correr() {
  const c = leerConfig();
  if (!c?.token) { log('Esta computadora no está conectada a MaKo.'); return; }
  const cuentas = cuentasDe(c);
  await revisarSesiones(cuentas, true);
  let fuera = false;
  const latir = async () => {
    if (fuera) return;
    await revisarSesiones(cuentas).catch(() => {});
    const r = await api(c, 'POST', '/api/ia-pc/latido', { version: versionConSistema(), cuentas: paraElLatido(cuentas), ...extrasDelLatido(cuentas) }).catch(() => null);
    if (esRevocado(r)) { fuera = true; await desconectada(c.token); process.exit(0); }
  };
  await latir();
  const latido = setInterval(() => { void latir(); }, LATIDO_MS);
  log(`En línea con ${c.servidor}, con ${cuentas.filter((x) => x.conSesion).length} cuenta(s) con sesión. Esperando turnos.`);
  let fallas = 0;
  while (!fuera) {
    const r = await api(c, 'GET', '/api/ia-pc/turno').catch(() => null);
    if (!r) {
      if (!fallas) log('Sin conexión con MaKo: reintento solo.');
      await dormir(esperaSinRed(fallas++));
      continue;
    }
    if (fallas) { log('Volvió la conexión con MaKo.'); fallas = 0; }
    if (r.status === 204) continue;
    if (esRevocado(r)) { fuera = true; clearInterval(latido); await desconectada(c.token); return; }
    if (r.status !== 200 || !r.datos?.id) { await dormir(5000); continue; }
    const t = r.datos;
    if (!cuentas.some((x) => x.conSesion)) await revisarSesiones(cuentas, true);
    const cuenta = cuentaConCupo(cuentas.filter((x) => x.conSesion));
    if (!cuenta) {
      const falta = cuentas.some((x) => x.falta);
      await contestar(c, t.id, { error: falta ? 'Claude no está instalado en esta computadora' : 'Claude no tiene la sesión iniciada en esta computadora', tipo: 'sesion' });
      continue;
    }
    log(`Turno ${t.id}: pensando con ${cuenta.email ?? 'tu cuenta'}…`);
    const dir = join(CARPETA, 'turnos', String(Number(t.id)));
    const mcp = { mcpServers: { mako: { type: 'http', url: `${c.servidor}/api/ia-pc/mcp`, headers: { Authorization: `Bearer ${t.token}` } } } };
    const res = await pensar({ dir, system: String(t.system ?? ''), prompt: String(t.prompt ?? ''), mcp, configDir: cuenta.dir, modelo: t.modelo });
    // El token del turno no queda en el disco.
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
    Object.assign(cuenta, res.limites ?? {});
    let cuerpo;
    if (res.error) {
      const tipo = falloDeClaude(res.error, res.limites);
      if (tipo === 'sesion') cuenta.conSesion = false;
      const repone = tipo === 'tope' ? reponeDelTope(cuenta) : undefined;
      cuerpo = { error: res.error, ...(tipo ? { tipo } : {}), ...(repone ? { repone } : {}) };
    } else cuerpo = { texto: res.texto, uso: res.uso, cuenta: cuenta.email ?? null };
    const ok = await contestar(c, t.id, cuerpo);
    log(`Turno ${t.id}: ${res.error ? `no pudo (${res.error})` : 'contestado'}${ok?.status === 200 ? '' : ' (MaKo no lo aceptó: venció)'}`);
    await latir();
  }
}

/** El de fondo no se cae: si algo tira, lo anota y vuelve a empezar. Sale sólo desconectado o sin conexión guardada. */
async function correrSiempre() {
  for (;;) {
    try { await correr(); return; } catch (e) { log(`Algo falló (${e instanceof Error ? e.message : String(e)}): vuelvo a empezar en 10 s.`); }
    await dormir(10_000);
  }
}

function estado() {
  const c = leerConfig();
  decir(c?.token ? `Conectada a «${c.negocio ?? c.servidor}» como «${c.nombre}», con ${cuentasDe(c).length} cuenta(s). Versión ${VERSION}.` : 'Esta computadora no está conectada a MaKo.');
  return 0;
}

// Sólo cuando se lo corre directo: el test lo importa para probar `pensar` sin arrancar el bucle. Dentro del ejecutable
// de Bun la ruta del programa es virtual (`B:/~BUN/…`): ahí manda `import.meta.main`.
const esPrincipal = import.meta.main === true || (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (esPrincipal) {
  // Abierta como MaKo.app firmada (desde Finder llega sin nada, o con un `-psn_…` en macOS viejos): `app-firmada`. El
  // arranque corre la copia de ~/.mako-pc/bin, que no está en una .app: ésa sigue con `correr`.
  const primero = process.argv[2];
  const cmd = esLaAppDeMac() && (primero == null || primero.startsWith('-psn_')) ? 'app-firmada' : primero ?? 'correr';
  // ⚠️ Los comandos de una vez NO salen con `process.exit()`: en Windows, con un pedido recién cerrado (confirmar hace
  // dos), Node revienta con «Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c» y sale con
  // 0xC0000409: corrido con Node (el test, el e2e), «no se confirmó» con la conexión ya guardada (medido el 21/10/2026,
  // Node 24; el ejecutable de Bun no revienta). Se deja el código y que termine solo; si algo lo retiene, el reloj (que
  // no lo retiene) lo cierra.
  const salir = (n) => {
    process.exitCode = typeof n === 'number' ? n : 0;
    setTimeout(() => process.exit(process.exitCode), 10_000).unref();
  };
  const fallar = (e) => { decir(e instanceof Error ? e.message : String(e)); salir(1); };
  if (cmd === '--version') decir(VERSION);
  else if (/^mako:/i.test(cmd)) (accionDelEnlace(cmd) === 'iniciar-sesion' ? iniciarSesionDesdeEnlace() : conectarDesdeEnlace(cmd)).then(salir, fallar);
  else if (cmd === 'app') abrirLaApp().then(salir, fallar);
  else if (cmd === 'app-firmada') Promise.resolve().then(() => { copiarLaAppAlArranque(); return abrirLaApp(); }).then(salir, fallar);
  else if (cmd === 'emparejar') emparejar().then(salir, fallar);
  else if (cmd === 'confirmar') confirmar().then(salir, fallar);
  else if (cmd === 'cancelar') cancelar().then(salir, fallar);
  else if (cmd === 'sesion') sesion().then(salir, fallar);
  else if (cmd === 'agregar-cuenta') agregarCuenta().then(salir, fallar);
  else if (cmd === 'estado') salir(estado());
  else {
    process.on('uncaughtException', (e) => log(`Error suelto: ${e instanceof Error ? e.message : String(e)}`));
    process.on('unhandledRejection', (e) => log(`Error suelto: ${e instanceof Error ? e.message : String(e)}`));
    correrSiempre().then(() => process.exit(0));
  }
}
