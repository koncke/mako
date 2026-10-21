#!/usr/bin/env node
// =============================================================================
// mako-pc — «MaKo en tu computadora» (docs/ia-del-cliente.md §2, ola 1, 21/10/2026)
// =============================================================================
// Lo instala el CLIENTE en su computadora. Espera los turnos de SU Ops Center, los piensa con SU Claude Code (el programa
// oficial, con su login) y devuelve la respuesta. Las herramientas de MaKo corren en el servidor, con las reglas del chat.
//
// LA PC ES SÓLO EL CEREBRO, NUNCA LAS MANOS:
//   · Claude Code corre con `--tools ""` (sin terminal, archivos ni web) y SÓLO el MCP de MaKo del turno;
//   · el comando es FIJO (ARGS_CLAUDE, copia de lib/ia-pc-reglas.ts: tests/ia-pc.test.ts compara las dos); el servidor
//     no puede pedir otro, y el texto de la persona va por stdin, nunca en la línea de comandos;
//   · nunca lee ni manda el token de la suscripción: no toca ~/.claude ni el Keychain. Sólo corre `claude`;
//   · sin ANTHROPIC_API_KEY en el entorno de Claude: con ella, `-p` usaría la key y no la suscripción;
//   · ⚠️ nunca `--bare`: apaga el login de la suscripción.
// Sin dependencias: Node 18+ y nada más.
//
// Uso:
//   node mako-pc.mjs emparejar <CÓDIGO> [--servidor https://hola-mako.com] [--nombre "PC de Ana"]
//   node mako-pc.mjs            (espera turnos; dejarlo corriendo)
//   node mako-pc.mjs estado
// =============================================================================

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';

export const VERSION = '0.1.0';
const CARPETA = process.env.MAKO_PC_DIR || join(homedir(), '.mako-pc');
const CONFIG = join(CARPETA, 'config.json');
const SERVIDOR_DEFAULT = 'https://hola-mako.com';
const LATIDO_MS = 30_000;
const TURNO_TOPE_MS = 4 * 60_000;

/** COPIA de ARGS_CLAUDE (lib/ia-pc-reglas.ts). tests/ia-pc.test.ts frena si difieren. */
export const ARGS_CLAUDE = [
  '-p', '--output-format', 'json', '--no-session-persistence',
  '--tools', '', '--strict-mcp-config', '--allowedTools', 'mcp__mako', '--max-turns', '12',
  '--model', 'sonnet',
];

/** Lo que se le saca al entorno de Claude: con cualquiera de éstas, no usaría la suscripción del cliente. */
export const SIN_ESTAS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX'];

const leerConfig = () => { try { return JSON.parse(readFileSync(CONFIG, 'utf8')); } catch { return null; } };
function guardarConfig(c) {
  mkdirSync(CARPETA, { recursive: true });
  writeFileSync(CONFIG, JSON.stringify(c, null, 2));
  try { chmodSync(CONFIG, 0o600); } catch { /* Windows: la carpeta ya es del usuario */ }
}
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const log = (...x) => console.log(new Date().toLocaleTimeString(), ...x);

async function api(c, metodo, ruta, cuerpo, { token } = {}) {
  const res = await fetch(`${c.servidor}${ruta}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ?? c.token ? { authorization: `Bearer ${token ?? c.token}` } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status === 204) return { status: 204, datos: null };
  const datos = await res.json().catch(() => null);
  return { status: res.status, datos };
}

/** Corre Claude Code oficial con el pedido del turno. Nunca tira: devuelve la respuesta o el error. */
export function pensar({ dir, system, prompt, mcp, configDir }, correr = spawn) {
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
    const p = correr('claude', [...ARGS_CLAUDE, '--system-prompt-file', sistema, '--mcp-config', mcpJson], { cwd: dir, env, shell: false });
    const corte = setTimeout(() => { p.kill(); }, TURNO_TOPE_MS);
    p.stdout.on('data', (b) => { salida += b; });
    p.stderr.on('data', (b) => { error += b; });
    p.on('error', (e) => { clearTimeout(corte); resolver({ error: e.code === 'ENOENT' ? 'Claude Code no está instalado en esta computadora' : String(e.message) }); });
    p.on('close', () => {
      clearTimeout(corte);
      let r = null;
      try { r = JSON.parse(salida.trim().split('\n').pop()); } catch { /* abajo */ }
      if (!r) return resolver({ error: (error || 'Claude no devolvió nada').trim().slice(0, 300) });
      if (r.is_error) return resolver({ error: String(r.result ?? r.subtype ?? 'error').slice(0, 300) });
      resolver({ texto: String(r.result ?? ''), uso: { entrada: r.usage?.input_tokens ?? 0, salida: r.usage?.output_tokens ?? 0 } });
    });
    p.stdin.end(prompt);
  });
}

/** Lo que la PC cuenta de su cuenta de Claude, sin secretos (`claude auth status`), con la MISMA carpeta que piensa. */
function cuentas(configDir) {
  return new Promise((resolver) => {
    let out = '';
    const env = { ...process.env };
    if (configDir) env.CLAUDE_CONFIG_DIR = configDir;
    const p = spawn('claude', ['auth', 'status'], { shell: false, env });
    p.stdout.on('data', (b) => { out += b; });
    p.on('error', () => resolver([]));
    p.on('close', () => {
      try {
        const o = JSON.parse(out);
        resolver([{ proveedor: 'claude', ...(o.email ? { email: String(o.email) } : {}), ...(o.subscriptionType ? { plan: String(o.subscriptionType) } : {}) }]);
      } catch { resolver([{ proveedor: 'claude' }]); }
    });
  });
}

async function emparejar() {
  const codigo = process.argv[3];
  const servidor = (arg('--servidor') ?? SERVIDOR_DEFAULT).replace(/\/+$/, '');
  const nombre = arg('--nombre') ?? hostname();
  if (!codigo) { console.error('Falta el código: node mako-pc.mjs emparejar <CÓDIGO>'); process.exit(1); }
  const r = await api({ servidor }, 'POST', '/api/ia-pc/emparejar', { codigo, nombre });
  if (r.status !== 200 || !r.datos?.token) { console.error(r.datos?.error ?? `No pude emparejar (HTTP ${r.status}).`); process.exit(1); }
  guardarConfig({ servidor, token: r.datos.token, nombre });
  console.log('¡Listo! Esta computadora quedó conectada a MaKo. Ahora déjala corriendo: node mako-pc.mjs');
}

async function correr() {
  const c = leerConfig();
  if (!c?.token) { console.error('Esta computadora no está conectada. Primero: node mako-pc.mjs emparejar <CÓDIGO>'); process.exit(1); }
  let susCuentas = await cuentas(c.configDir);
  const latir = async () => {
    const r = await api(c, 'POST', '/api/ia-pc/latido', { version: VERSION, cuentas: susCuentas }).catch(() => null);
    if (r?.status === 401) { console.error('MaKo desconectó esta computadora. Vuelve a emparejarla.'); process.exit(1); }
  };
  await latir();
  setInterval(latir, LATIDO_MS);
  setInterval(async () => { susCuentas = await cuentas(c.configDir); }, 10 * 60_000);
  log(`En línea con ${c.servidor}. Esperando turnos (Ctrl+C para salir).`);
  for (;;) {
    const r = await api(c, 'GET', '/api/ia-pc/turno').catch(() => null);
    if (!r || r.status === 204) continue;
    if (r.status === 401) { console.error('MaKo desconectó esta computadora.'); process.exit(1); }
    if (r.status !== 200 || !r.datos?.id) { await new Promise((ok) => setTimeout(ok, 5000)); continue; }
    const t = r.datos;
    log(`Turno ${t.id}: pensando…`);
    const dir = join(CARPETA, 'turnos', String(Number(t.id)));
    const mcp = { mcpServers: { mako: { type: 'http', url: `${c.servidor}/api/ia-pc/mcp`, headers: { Authorization: `Bearer ${t.token}` } } } };
    const res = await pensar({ dir, system: String(t.system ?? ''), prompt: String(t.prompt ?? ''), mcp, configDir: c.configDir });
    // El token del turno no queda en el disco.
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
    const cuerpo = res.error ? { error: res.error } : { texto: res.texto, uso: res.uso, cuenta: susCuentas[0]?.email ?? null };
    const ok = await api(c, 'POST', `/api/ia-pc/turno/${Number(t.id)}`, cuerpo).catch(() => null);
    log(`Turno ${t.id}: ${res.error ? `no pudo (${res.error})` : 'contestado'}${ok?.status === 200 ? '' : ' (MaKo no lo aceptó: venció)'}`);
  }
}

function estado() {
  const c = leerConfig();
  console.log(c?.token ? `Conectada a ${c.servidor} como «${c.nombre}». Versión ${VERSION}.` : 'Esta computadora no está conectada a MaKo.');
}

// Sólo cuando se lo corre directo: el test lo importa para probar `pensar` sin arrancar el bucle.
const esPrincipal = !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (esPrincipal) {
  const cmd = process.argv[2] ?? 'correr';
  if (cmd === '--version') console.log(VERSION);
  else if (cmd === 'emparejar') emparejar().catch((e) => { console.error(e.message); process.exit(1); });
  else if (cmd === 'estado') estado();
  else correr().catch((e) => { console.error(e.message); process.exit(1); });
}
