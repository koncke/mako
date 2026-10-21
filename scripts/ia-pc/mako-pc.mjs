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
// =============================================================================

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';

export const VERSION = '0.3.1';
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
const decir = (t) => { try { console.log(t); } catch { /* sin consola */ } };

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

async function emparejar() {
  const codigo = process.argv[3];
  const servidor = (arg('--servidor') ?? SERVIDOR_DEFAULT).replace(/\/+$/, '');
  const nombre = arg('--nombre') ?? hostname();
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
async function conReintentos(c, ruta) {
  let r = null;
  for (const espera of [0, 2_000, 5_000]) {
    if (espera) await dormir(espera);
    r = await api(c, 'POST', ruta).catch(() => null);
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
  const r = await conReintentos({ servidor: p.servidor, token: p.token }, '/api/ia-pc/confirmar');
  if (!r) { decir('No pude llegar a MaKo: revisa tu conexión a internet.'); return 1; }
  if (r.status !== 200) {
    decir(esRevocado(r) ? 'Ese código ya no sirve.' : (r.datos?.error ?? `MaKo no confirmó la conexión (HTTP ${r.status}).`));
    return 1;
  }
  // La conexión de antes se suelta en MaKo (si no, quedaba una tarjeta «Sin conexión» para siempre).
  if (c.token && c.token !== p.token) await conReintentos({ servidor: c.servidor ?? p.servidor, token: c.token }, '/api/ia-pc/soltar');
  const resto = { ...c };
  delete resto.pendiente;
  guardarConfig({ ...resto, servidor: p.servidor, token: p.token, nombre: p.nombre, negocio: p.negocio, persona: p.persona });
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
    const r = await api(c, 'POST', '/api/ia-pc/latido', { version: VERSION, cuentas: paraElLatido(cuentas), ...extrasDelLatido(cuentas) }).catch(() => null);
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
  const cmd = process.argv[2] ?? 'correr';
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
