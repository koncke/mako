// =============================================================================
// La sesión de Claude sin terminal: la página LOCAL para pegar el código (0.4.0, 23/10/2026)
// =============================================================================
// Martín: «el proceso de instalación jamás sea por Powershell, ni siquiera que se tenga que abrir». Sin consola, `claude auth
// login` muestra la URL y espera que le peguen el código por stdin (medido el 23/10/2026). El programa (scripts/ia-pc/mako-pc.mjs
// → `iniciarSesionDeClaude`) lo corre sin ventana y sirve una página en 127.0.0.1 para pegarlo. Lo que fija este test, con
// el programa REAL y un `claude` de mentira (tests/_claude-de-mentira.mjs):
//   1. la página: el botón a la URL de Claude y el campo; sólo con su dirección y su secreto; mandar, sólo desde ella;
//   2. el código pegado llega TAL CUAL al stdin de `claude` (con su carpeta, sin ANTHROPIC_API_KEY), y la página dice si quedó;
//   3. el código nunca sale de la computadora: el bloque no llama a MaKo, ni lo anota;
//   4. sin Claude Code, 3 (y el enlace lo dice en una ventana); al conectar sin sesión, se ofrece iniciarla.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FALSO = fileURLToPath(new URL('./_claude-de-mentira.mjs', import.meta.url));
const programa = () => readFileSync(new URL('../scripts/ia-pc/mako-pc.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const esperar = async (cond: () => unknown, ms = 15_000) => { const fin = Date.now() + ms; while (!cond()) { if (Date.now() > fin) throw new Error('no llegó'); await new Promise((r) => setTimeout(r, 50)); } };
type Resp = { status: number; cuerpo: string; politica?: string };
function pedir(url: string, o: { metodo?: string; cuerpo?: string; headers?: Record<string, string> } = {}): Promise<Resp> {
  const u = new URL(url);
  return new Promise((ok, mal) => {
    const r = request({ host: u.hostname, port: u.port, path: u.pathname, method: o.metodo ?? 'GET', headers: { ...(o.cuerpo ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...(o.headers ?? {}) } }, (res) => {
      let cuerpo = ''; res.on('data', (b) => { cuerpo += b; }); res.on('end', () => ok({ status: res.statusCode ?? 0, cuerpo, politica: String(res.headers['referrer-policy'] ?? '') }));
    });
    r.on('error', mal);
    if (o.cuerpo) r.write(o.cuerpo);
    r.end();
  });
}

async function unaSesion(codigos: string[], extra: { origen?: string } = {}) {
  const pc = await import('../scripts/ia-pc/mako-pc.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'mako-login-'));
  const anota = join(dir, 'anota.json');
  process.env.CLAUDE_FALSO_ANOTA = anota;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-no-tiene-que-llegar';
  let local = '';
  const abiertas: string[] = [];
  const fin = pc.iniciarSesionDeClaude({
    correr: (_c: string, args: string[], o: object) => spawn(process.execPath, [FALSO, ...args], o),
    abrir: (u: string) => { abiertas.push(u); return true; }, alAbrir: (u: string) => { local = u; },
    plazoMs: 20_000, configDir: join(dir, 'cuenta'),
  });
  await esperar(() => local);
  const paginas: Resp[] = [await pedir(local)];
  // El Origin que manda un NAVEGADOR en el POST del formulario de esta página, por su Referrer-Policy (la especificación Fetch:
  // con `no-referrer`, `Origin: null`). Antes el test lo ponía a mano y no vio el 403 (revisión de la 0.4.0, 23/10/2026).
  const origen = extra.origen ?? (paginas[0].politica === 'no-referrer' ? 'null' : new URL(local).origin);
  for (const c of codigos) paginas.push(await pedir(local, { metodo: 'POST', cuerpo: `codigo=${encodeURIComponent(c)}`, headers: { origin: origen } }));
  const salida = extra.origen ? null : await fin;
  let recibido: Record<string, unknown> | null = null;
  try { recibido = JSON.parse(readFileSync(anota, 'utf8')); } catch { /* no le llegó nada */ }
  return { pc, local, abiertas, paginas, salida, recibido, fin, cerrar: () => rmSync(dir, { recursive: true, force: true }) };
}

test('1. la página: el botón a Claude y el campo; sólo con su dirección y su secreto; mandar, sólo desde ella', async () => {
  const s = await unaSesion([], { origen: 'https://malo.example' });
  try {
    assert.match(s.local, /^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{32}$/);
    assert.deepEqual(s.abiertas, [s.local], 'se abre la página local en el navegador');
    assert.equal(s.paginas[0].status, 200);
    assert.match(s.paginas[0].cuerpo, /<a class="boton" href="https:\/\/claude\.com\/cai\/oauth\/authorize\?code=true&amp;client_id=prueba&amp;state=abc" target="_blank" rel="noopener noreferrer">Entrar a Claude<\/a>/);
    assert.match(s.paginas[0].cuerpo, /<form method="post"><input name="codigo"/);
    assert.match(s.paginas[0].cuerpo, /MaKo nunca lo ve/);
    // Con `no-referrer` el navegador manda su propio formulario con `Origin: null` y la página lo rechaza (403 en blanco).
    assert.equal(s.paginas[0].politica, 'same-origin', 'con esta política el navegador rechaza su propio formulario');
    const u = new URL(s.local);
    assert.equal((await pedir(`${u.origin}/otro-secreto`)).status, 404, 'sin el secreto contesta');
    assert.equal((await pedir(s.local, { headers: { host: `localhost:${u.port}` } })).status, 404, 'con otro nombre (un DNS que apunta acá) contesta');
    // Desde otra página no se manda nada.
    const ajena = await pedir(s.local, { metodo: 'POST', cuerpo: 'codigo=BUENO1234%23estado', headers: { origin: 'https://malo.example' } });
    assert.equal(ajena.status, 403);
    assert.equal(s.recibido, null, 'el código de otra página le llegó a Claude');
  } finally {
    // Se cierra con el código bueno, desde ella.
    await pedir(s.local, { metodo: 'POST', cuerpo: 'codigo=BUENO1234%23estado', headers: { origin: new URL(s.local).origin } });
    await s.fin;
    s.cerrar();
  }
});

test('2. el código llega TAL CUAL al stdin de Claude (su carpeta, sin la API key), y la página dice si quedó', async () => {
  const bien = await unaSesion(['<script>', ' BUENO1234#estado ']);
  try {
    assert.match(bien.paginas[1].cuerpo, /Eso no parece el código de Claude/, 'lo que no es un código no se le pasa');
    assert.match(bien.paginas[2].cuerpo, /<h1>¡Listo!<\/h1>/);
    assert.equal(bien.salida, 0);
    assert.deepEqual(bien.recibido, { codigo: 'BUENO1234#estado', configDir: bien.recibido?.configDir, args: ['auth', 'login'], apiKey: null });
    assert.match(String(bien.recibido?.configDir), /cuenta$/, 'el login fue a otra carpeta de Claude');
  } finally { bien.cerrar(); }
  const mal = await unaSesion(['MALO12345678']);
  try {
    assert.match(mal.paginas[1].cuerpo, /<h1>No pude iniciar la sesión<\/h1><p>Claude no aceptó el código: puede haber vencido\.<\/p>/);
    assert.equal(mal.salida, 1);
  } finally { mal.cerrar(); }
});

test('3. el código nunca sale de la computadora: el bloque no llama a MaKo ni lo anota', () => {
  const src = programa();
  const bloque = src.slice(src.indexOf('// ── Iniciar sesión en Claude sin terminal (0.4.0)'), src.indexOf('/** ¿El Claude de esta PC tiene la sesión?'));
  assert.ok(bloque.length > 2000);
  assert.doesNotMatch(bloque, /\bapi\(|\bfetch\(|decir\(/, 'el login le habla a MaKo o a la consola');
  assert.doesNotMatch(bloque, /log\([^)]*codigo/, 'el código va al registro');
  assert.match(bloque, /servidor\.listen\(0, '127\.0\.0\.1', ok\)/, 'la página escucha fuera de esta computadora');
  // En Windows se abre sin consola.
  assert.match(bloque, /spawn\('rundll32\.exe', \['url\.dll,FileProtocolHandler', url\], \{ detached: true, stdio: 'ignore', windowsHide: true \}\)/);
});

test('4. sin Claude Code, 3 (el enlace lo dice); el enlace mako://iniciar-sesion; al conectar sin sesión, se ofrece', async () => {
  const pc = await import('../scripts/ia-pc/mako-pc.mjs');
  assert.equal(await pc.iniciarSesionDeClaude({ correr: spawn, claude: join(tmpdir(), 'no-existe-claude', 'claude.exe'), abrir: () => true, plazoMs: 5_000, configDir: null }), 3);
  const ventanas: string[] = [];
  assert.equal(await pc.iniciarSesionDesdeEnlace({ ventana: async (_t: string, texto: string) => { ventanas.push(texto); return true; }, iniciar: async () => 3 }), 1);
  assert.deepEqual(ventanas, [pc.FALTA_CLAUDE]);
  assert.equal(pc.accionDelEnlace('mako://iniciar-sesion'), 'iniciar-sesion');
  assert.equal(pc.accionDelEnlace('mako://conectar?codigo=ABCD2345'), 'conectar');
  assert.equal(pc.accionDelEnlace('mako://borrar-todo'), null);
  assert.match(programa(), /else if \(\/\^mako:\/i\.test\(cmd\)\) \(accionDelEnlace\(cmd\) === 'iniciar-sesion' \? iniciarSesionDesdeEnlace\(\) : conectarDesdeEnlace\(cmd\)\)\.then\(salir, fallar\);/);
});
