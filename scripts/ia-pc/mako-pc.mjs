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
// Uso:
//   mako-pc emparejar <CÓDIGO> [--servidor https://hola-mako.com] [--nombre "PC de Ana"]
//   mako-pc                    (espera turnos; lo arranca solo el instalador)
//   mako-pc agregar-cuenta     (otra cuenta de Claude: se inicia sesión y la PC usa la de más cupo)
//   mako-pc estado
// =============================================================================

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';

export const VERSION = '0.2.0';
const CARPETA = process.env.MAKO_PC_DIR || join(homedir(), '.mako-pc');
const CONFIG = join(CARPETA, 'config.json');
const SERVIDOR_DEFAULT = 'https://hola-mako.com';
const LATIDO_MS = 30_000;
const TURNO_TOPE_MS = 4 * 60_000;

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
 */
export function rutaDeClaude(env = process.env, existe = existsSync) {
  if (env.MAKO_PC_CLAUDE) return env.MAKO_PC_CLAUDE;
  const conocida = join(homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
  return existe(conocida) ? conocida : 'claude';
}

const leerConfig = () => { try { return JSON.parse(readFileSync(CONFIG, 'utf8')); } catch { return null; } };
function guardarConfig(c) {
  mkdirSync(CARPETA, { recursive: true });
  writeFileSync(CONFIG, JSON.stringify(c, null, 2));
  try { chmodSync(CONFIG, 0o600); } catch { /* Windows: la carpeta ya es del usuario */ }
}
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const log = (...x) => console.log(new Date().toLocaleTimeString(), ...x);

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
  const r = w.five_hour?.resetsAt;
  return {
    ...(pct(w.five_hour?.utilization) != null ? { usado5h: pct(w.five_hour?.utilization) } : {}),
    ...(pct(w.seven_day?.utilization) != null ? { usadoSemana: pct(w.seven_day?.utilization) } : {}),
    ...(typeof r === 'number' && Number.isFinite(r) ? { repone: new Date(r * 1000).toISOString() } : {}),
  };
}

/** COPIA de `cuentaConCupo` (lib/ia-pc-reglas.ts): la de menos uso de las 5 horas, salteando la que pasó el 95%. */
export function cuentaConCupo(cuentas) {
  const libres = cuentas.filter((c) => (c.usado5h ?? 0) < 95);
  if (!libres.length) return null;
  return libres.reduce((a, b) => ((b.usado5h ?? 0) < (a.usado5h ?? 0) ? b : a));
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

/** Corre Claude Code oficial con el pedido del turno. Nunca tira: devuelve la respuesta o el error. */
export function pensar({ dir, system, prompt, mcp, configDir, modelo }, correr = spawn, claude = rutaDeClaude()) {
  mkdirSync(dir, { recursive: true });
  const sistema = join(dir, 'system.txt');
  const mcpJson = join(dir, 'mcp.json');
  writeFileSync(sistema, system);
  writeFileSync(mcpJson, JSON.stringify(mcp));
  try { chmodSync(mcpJson, 0o600); } catch { /* Windows */ }
  const env = { ...process.env };
  for (const k of SIN_ESTAS) delete env[k];
  if (configDir) env.CLAUDE_CONFIG_DIR = configDir;
  return new Promise((resolver) => {
    let salida = '';
    let error = '';
    const args = [...ARGS_CLAUDE, '--model', modeloPc(modelo), '--system-prompt-file', sistema, '--mcp-config', mcpJson];
    const p = correr(claude, args, { cwd: dir, env, shell: false });
    const corte = setTimeout(() => { p.kill(); }, TURNO_TOPE_MS);
    p.stdout.on('data', (b) => { salida += b; });
    p.stderr.on('data', (b) => { error += b; });
    p.on('error', (e) => { clearTimeout(corte); resolver({ error: e.code === 'ENOENT' ? 'Claude Code no está instalado en esta computadora' : String(e.message) }); });
    p.on('close', () => {
      clearTimeout(corte);
      const { resultado: r, limites } = leerStream(salida);
      if (!r) return resolver({ error: (error || 'Claude no devolvió nada').trim().slice(0, 300), limites });
      if (r.is_error) return resolver({ error: String(r.result ?? r.subtype ?? 'error').slice(0, 300), limites });
      resolver({ texto: String(r.result ?? ''), uso: { entrada: r.usage?.input_tokens ?? 0, salida: r.usage?.output_tokens ?? 0 }, limites });
    });
    p.stdin.end(prompt);
  });
}

/** El email y el plan de una cuenta, sin secretos (`claude auth status`), con SU carpeta. */
function estadoDeCuenta(configDir) {
  return new Promise((resolver) => {
    let out = '';
    const env = { ...process.env };
    if (configDir) env.CLAUDE_CONFIG_DIR = configDir;
    const p = spawn(rutaDeClaude(), ['auth', 'status'], { shell: false, env });
    p.stdout.on('data', (b) => { out += b; });
    p.on('error', () => resolver({ conSesion: false }));
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
/** Lo que se le cuenta a MaKo de cada cuenta: nunca un secreto (lo vuelve a sanear el servidor). */
const paraElLatido = (cuentas) => cuentas.map((x) => ({
  proveedor: 'claude', ...(x.email ? { email: x.email } : {}), ...(x.plan ? { plan: x.plan } : {}),
  ...(x.usado5h != null ? { usado5h: x.usado5h } : {}), ...(x.usadoSemana != null ? { usadoSemana: x.usadoSemana } : {}),
  ...(x.repone ? { repone: x.repone } : {}),
}));

async function emparejar() {
  const codigo = process.argv[3];
  const servidor = (arg('--servidor') ?? SERVIDOR_DEFAULT).replace(/\/+$/, '');
  const nombre = arg('--nombre') ?? hostname();
  if (!codigo) { console.error('Falta el código: mako-pc emparejar <CÓDIGO>'); process.exit(1); }
  const r = await api({ servidor }, 'POST', '/api/ia-pc/emparejar', { codigo, nombre });
  if (r.status !== 200 || !r.datos?.token) { console.error(r.datos?.error ?? `No pude emparejar (HTTP ${r.status}).`); process.exit(1); }
  const antes = leerConfig() ?? {};
  guardarConfig({ ...antes, servidor, token: r.datos.token, nombre });
  console.log('¡Listo! Esta computadora quedó conectada a MaKo.');
}

async function agregarCuenta() {
  const c = leerConfig() ?? {};
  const cuentas = cuentasDe(c).filter((x) => x.dir);
  const dir = join(CARPETA, 'cuentas', String(cuentas.length + 1));
  mkdirSync(dir, { recursive: true });
  console.log('Se abre Claude: escribe /login, inicia sesión con la OTRA cuenta en el navegador, y después escribe /exit.');
  await new Promise((ok) => {
    const p = spawn(rutaDeClaude(), [], { stdio: 'inherit', shell: false, env: { ...process.env, CLAUDE_CONFIG_DIR: dir } });
    p.on('close', ok);
    p.on('error', ok);
  });
  const e = await estadoDeCuenta(dir);
  if (!e.conSesion) { console.error('Esa cuenta no quedó con la sesión iniciada. Vuelve a intentarlo.'); process.exit(1); }
  const base = cuentasDe(c);
  guardarConfig({ ...c, cuentas: [...base, { dir, email: e.email, plan: e.plan }] });
  console.log(`¡Listo! Ahora esta computadora tiene ${base.length + 1} cuentas de Claude, y usa la que tenga más cupo.`);
}

async function correr() {
  const c = leerConfig();
  if (!c?.token) { console.error('Esta computadora no está conectada. Primero: mako-pc emparejar <CÓDIGO>'); process.exit(1); }
  const cuentas = cuentasDe(c);
  for (const x of cuentas) Object.assign(x, await estadoDeCuenta(x.dir));
  const latir = async () => {
    const r = await api(c, 'POST', '/api/ia-pc/latido', { version: VERSION, cuentas: paraElLatido(cuentas.filter((x) => x.conSesion !== false)) }).catch(() => null);
    if (r?.status === 401) { console.error('MaKo desconectó esta computadora. Vuelve a conectarla desde MaKo.'); process.exit(1); }
  };
  await latir();
  setInterval(latir, LATIDO_MS);
  log(`En línea con ${c.servidor}, con ${cuentas.length} cuenta(s). Esperando turnos.`);
  for (;;) {
    const r = await api(c, 'GET', '/api/ia-pc/turno').catch(() => null);
    if (!r || r.status === 204) continue;
    if (r.status === 401) { console.error('MaKo desconectó esta computadora.'); process.exit(1); }
    if (r.status !== 200 || !r.datos?.id) { await new Promise((ok) => setTimeout(ok, 5000)); continue; }
    const t = r.datos;
    const cuenta = cuentaConCupo(cuentas.filter((x) => x.conSesion !== false));
    if (!cuenta) {
      await api(c, 'POST', `/api/ia-pc/turno/${Number(t.id)}`, { error: 'todas las cuentas de Claude de esta computadora están al tope' }).catch(() => null);
      continue;
    }
    log(`Turno ${t.id}: pensando con ${cuenta.email ?? 'tu cuenta'}…`);
    const dir = join(CARPETA, 'turnos', String(Number(t.id)));
    const mcp = { mcpServers: { mako: { type: 'http', url: `${c.servidor}/api/ia-pc/mcp`, headers: { Authorization: `Bearer ${t.token}` } } } };
    const res = await pensar({ dir, system: String(t.system ?? ''), prompt: String(t.prompt ?? ''), mcp, configDir: cuenta.dir, modelo: t.modelo });
    // El token del turno no queda en el disco.
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
    Object.assign(cuenta, res.limites ?? {});
    const cuerpo = res.error ? { error: res.error } : { texto: res.texto, uso: res.uso, cuenta: cuenta.email ?? null };
    const ok = await api(c, 'POST', `/api/ia-pc/turno/${Number(t.id)}`, cuerpo).catch(() => null);
    log(`Turno ${t.id}: ${res.error ? `no pudo (${res.error})` : 'contestado'}${ok?.status === 200 ? '' : ' (MaKo no lo aceptó: venció)'}`);
    await latir();
  }
}

function estado() {
  const c = leerConfig();
  console.log(c?.token ? `Conectada a ${c.servidor} como «${c.nombre}», con ${cuentasDe(c).length} cuenta(s). Versión ${VERSION}.` : 'Esta computadora no está conectada a MaKo.');
}

// Sólo cuando se lo corre directo: el test lo importa para probar `pensar` sin arrancar el bucle. Dentro del ejecutable
// de Bun la ruta del programa es virtual (`B:/~BUN/…`): ahí manda `import.meta.main`.
const esPrincipal = import.meta.main === true || (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (esPrincipal) {
  const cmd = process.argv[2] ?? 'correr';
  const fallar = (e) => { console.error(e.message); process.exit(1); };
  if (cmd === '--version') console.log(VERSION);
  else if (cmd === 'emparejar') emparejar().catch(fallar);
  else if (cmd === 'agregar-cuenta') agregarCuenta().catch(fallar);
  else if (cmd === 'estado') estado();
  else correr().catch(fallar);
}
