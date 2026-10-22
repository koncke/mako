// =============================================================================
// medir-codex-mcp — ¿`codex exec` carga un MCP por HTTP y llama sus herramientas? (IA11, ola 3 de docs/ia-del-cliente.md)
// =============================================================================
// Uso, en una PC con Codex instalado y la sesión de ChatGPT iniciada (`codex login`):
//   node scripts/ia-pc/medir-codex-mcp.mjs
//
// Lo que NO está documentado (docs/ia-del-cliente.md §9) y hay que medir antes de prometer GPT por la computadora: que
// `codex exec` (el modo sin pantalla, el que correría «MaKo en tu computadora») cargue un servidor MCP por HTTP con un token
// de portador, como hace `claude -p` con el MCP de MaKo (/api/ia-pc/mcp, token por turno). Este script:
//   1. levanta un MCP de mentira en 127.0.0.1 (JSON-RPC por HTTP: initialize, tools/list y tools/call) con UNA herramienta,
//      `eco`, que contesta una palabra al azar; exige el token del turno en `Authorization`;
//   2. corre `codex exec` con ese MCP en la línea (`-c mcp_servers.mako.url=…`, `bearer_token_env_var`), sin sandbox de
//      escritura y sin pedir aprobaciones (nadie mira la pantalla);
//   3. dice si el MCP recibió tools/list y tools/call, si llegó con el token, y si la respuesta de Codex trae la palabra.
// No usa ninguna clave de API ni toca MaKo: gasta un turno de la cuenta de ChatGPT de quien lo corre.
// =============================================================================

import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const PALABRA = `MAKO-${randomBytes(4).toString('hex').toUpperCase()}`;
const TOKEN = randomBytes(24).toString('hex');
const recibido = { metodos: [], conToken: 0, sinToken: 0 };

/** El MCP de mentira: JSON-RPC sobre POST, una respuesta JSON por pedido (sin SSE, que el estándar permite). */
const servidor = createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    if (req.headers.authorization === `Bearer ${TOKEN}`) recibido.conToken++; else recibido.sinToken++;
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    let msg;
    try { msg = JSON.parse(cuerpo || '{}'); } catch { res.writeHead(400).end(); return; }
    const lista = Array.isArray(msg) ? msg : [msg];
    const respuestas = [];
    for (const m of lista) {
      recibido.metodos.push(m.method);
      if (m.id === undefined) continue; // una notificación (notifications/initialized): sin respuesta
      if (req.headers.authorization !== `Bearer ${TOKEN}`) { respuestas.push({ jsonrpc: '2.0', id: m.id, error: { code: -32001, message: 'sin token del turno' } }); continue; }
      if (m.method === 'initialize') {
        respuestas.push({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'mako-medicion', version: '1.0.0' } } });
      } else if (m.method === 'tools/list') {
        respuestas.push({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'eco', description: 'Devuelve la palabra del turno de MaKo. Llámala cuando te la pidan.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }] } });
      } else if (m.method === 'tools/call') {
        respuestas.push({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: PALABRA }] } });
      } else {
        respuestas.push({ jsonrpc: '2.0', id: m.id, result: {} });
      }
    }
    if (!respuestas.length) { res.writeHead(202).end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(Array.isArray(msg) ? respuestas : respuestas[0]));
  });
});

function terminar(codigo) {
  servidor.close();
  process.exitCode = codigo;
}

/**
 * Correr `codex` sin que `cmd` rompa los argumentos. Instalado con npm, en Windows es un `codex.cmd`, que sólo corre por
 * `cmd`; y `shell: true` concatena sin entrecomillar: el prompt con espacios y las comillas TOML de `-c` llegaban partidos.
 * Acá cada argumento va entre comillas, con las de adentro dobladas (las reglas de la línea de comandos de Windows).
 */
function lanzar(args, opts) {
  if (process.platform !== 'win32') return spawn('codex', args, opts);
  const donde = spawnSync('where', ['codex'], { encoding: 'utf8' }).stdout.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const exe = donde.find((x) => /\.exe$/i.test(x));
  if (exe) return spawn(exe, args, opts);
  const cmd = donde.find((x) => /\.(cmd|bat)$/i.test(x)) ?? 'codex';
  const q = (a) => `"${String(a).replace(/"/g, '""')}"`;
  return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${[cmd, ...args].map(q).join(' ')}"`], { ...opts, windowsVerbatimArguments: true });
}

const version = await new Promise((r) => { const h = lanzar(['--version'], { stdio: ['ignore', 'pipe', 'pipe'] }); let o = ''; h.stdout.on('data', (c) => { o += c; }); h.on('error', () => r({ status: 1, stdout: '' })); h.on('close', (s) => r({ status: s, stdout: o })); });
if (version.status !== 0) {
  console.error('✗ No encuentro `codex` (instálalo: npm i -g @openai/codex, o irm https://chatgpt.com/codex/install.ps1 | iex) y corre `codex login`.');
  process.exit(1);
}
console.log(`codex ${version.stdout.trim()}`);

servidor.listen(0, '127.0.0.1', () => {
  const { port } = servidor.address();
  const url = `http://127.0.0.1:${port}/mcp`;
  const carpeta = mkdtempSync(join(tmpdir(), 'medir-codex-'));
  const args = [
    'exec', '--json', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only',
    '-c', 'approval_policy="never"',
    '-c', `mcp_servers.mako.url="${url}"`,
    '-c', 'mcp_servers.mako.bearer_token_env_var="MAKO_TURNO"',
    'Usa la herramienta `eco` del servidor `mako` y contéstame SOLO con el texto exacto que te devuelva.',
  ];
  console.log(`MCP de mentira en ${url} · corriendo codex exec…`);
  const hijo = lanzar(args, { cwd: carpeta, env: { ...process.env, MAKO_TURNO: TOKEN }, stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = '';
  let errores = '';
  hijo.stdout.on('data', (c) => { salida += c; });
  hijo.stderr.on('data', (c) => { errores += c; });
  const reloj = setTimeout(() => { hijo.kill(); }, 180_000);
  hijo.on('close', (codigo) => {
    clearTimeout(reloj);
    const eventos = salida.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const tipos = [...new Set(eventos.map((e) => e.type ?? e.msg?.type ?? '?'))];
    const llamoMcp = eventos.some((e) => JSON.stringify(e).includes('mcp_tool_call') || JSON.stringify(e).includes('"eco"'));
    const trajoLaPalabra = salida.includes(PALABRA);
    console.log(`codex salió con ${codigo} · eventos: ${tipos.join(', ') || '(ninguno)'}`);
    console.log(`MCP recibió: ${recibido.metodos.join(', ') || '(nada)'} · con token ${recibido.conToken}, sin token ${recibido.sinToken}`);
    const ok = recibido.metodos.includes('tools/list') && recibido.metodos.includes('tools/call') && recibido.sinToken === 0 && trajoLaPalabra;
    if (ok) {
      console.log('✓ codex exec cargó el MCP por HTTP con el token del turno, llamó la herramienta y devolvió lo que contestó. La ola 3 es posible.');
    } else {
      console.log('✗ No alcanzó:');
      if (!recibido.metodos.includes('tools/list')) console.log('  · el MCP nunca recibió tools/list: codex exec no cargó el servidor por HTTP (o no con esta config).');
      if (!recibido.metodos.includes('tools/call')) console.log(`  · nunca llamó la herramienta${llamoMcp ? ' (aunque la nombró)' : ''}.`);
      if (recibido.sinToken) console.log('  · llegaron pedidos SIN el token del turno: bearer_token_env_var no se aplicó.');
      if (!trajoLaPalabra) console.log('  · la respuesta no trae la palabra del MCP.');
      if (errores.trim()) console.log(`  stderr: ${errores.trim().split('\n').slice(-5).join(' | ').slice(0, 600)}`);
    }
    terminar(ok ? 0 : 1);
  });
});
