// =============================================================================
// La E del 17/10/2026: mientras un chat trabaja, sus pasos en vivo, como Claude (cartero 1.15.3)
// =============================================================================
// Martín (feedback del 17/10, su punto 1): «mientras un chat trabaja, una animación con los pasos de su turno en vivo, como
// Claude». La PC lee la cola del transcript de cada chat OCUPADO y sube sus últimos pasos (cartero.mjs → pasoDe,
// pasosDeLineas, subirPasos); MaKo guarda una foto por cuenta (lib/centro-pasos-db.ts) y el «Trabajando…» del hilo los
// muestra. Lo que se fija acá es lo que roto NO da error:
//   · un paso NUNCA lleva el contenido: ni el comando, ni lo que leyó o escribió, ni una ruta entera;
//   · los pasos son los del turno ABIERTO (un mensaje nuevo o el fin del turno los vacía);
//   · `vigilar` los sube mientras espera, con el token, y la vuelta completa también;
//   · MaKo da por viejo lo que no se subió hace 90 s.
//
// Probado ROMPIÉNDOLO (17/10/2026, base en 5 pases): `pasoDe` del Bash con el comando en vez de la descripción → 2 fallos (el
// suyo y el de punta a punta, que ve viajar el comando);
// `pasosDeLineas` sin vaciar con un mensaje nuevo → 1 fallo; `vigilar` sin subir los pasos → 1 fallo; `pasosVigentes`
// sin mirar la edad → 1 fallo; el «Trabajando…» sin los pasos → 1 fallo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pasosDelChat, pasosVigentes, sanearPasos } from '../lib/centro-pasos';
import { Hilo } from '../app/admin/operaciones/Hilo';

const RAIZ = join(import.meta.dirname, '..');
const CARTERO = join(RAIZ, 'scripts/operaciones/cartero.mjs');
const SESION = '22222222-3333-4444-8555-666666666666';
const LOCAL = `cli_${SESION}`;
const linea = (o: Record<string, unknown>) => JSON.stringify(o);
const usa = (name: string, input: Record<string, unknown>, at: string) => linea({ type: 'assistant', uuid: `a${at}`, timestamp: at, message: { content: [{ type: 'tool_use', id: `t${at}`, name, input }] } });
const T = (s: number) => new Date(Date.UTC(2026, 9, 17, 15, 0, s)).toISOString();

test('un paso dice lo que HACE, nunca con qué: ni el comando, ni el contenido, ni la ruta entera', async () => {
  const { pasoDe } = await import('../scripts/operaciones/cartero.mjs');
  assert.equal(pasoDe({ type: 'tool_use', name: 'Bash', input: { command: 'rm -rf /secreto && cat .env', description: 'Corre los tests del Centro' } }), 'Corre los tests del Centro');
  assert.equal(pasoDe({ type: 'tool_use', name: 'Bash', input: { command: 'cat .env' } }), 'Corre un comando');
  assert.equal(pasoDe({ type: 'tool_use', name: 'Read', input: { file_path: 'C:\\Users\\marti\\secreto\\lib\\centro-chats.ts' } }), 'Lee centro-chats.ts');
  assert.equal(pasoDe({ type: 'tool_use', name: 'Write', input: { file_path: '/tmp/a/b.md', content: 'la clave es 1234' } }), 'Escribe b.md');
  assert.equal(pasoDe({ type: 'tool_use', name: 'Grep', input: { pattern: 'password' } }), 'Busca en el código');
  assert.equal(pasoDe({ type: 'tool_use', name: 'mcp__ccd_session__mark_chapter', input: { title: 'x' } }), 'Usa mark chapter');
  assert.equal(pasoDe({ type: 'text', text: 'hola' }), null);
});

test('los pasos son los del turno ABIERTO: un mensaje nuevo o el fin del turno los vacían', async () => {
  const { pasosDeLineas } = await import('../scripts/operaciones/cartero.mjs');
  const viejo = usa('Read', { file_path: '/a/viejo.ts' }, T(1));
  const nuevo = linea({ type: 'user', uuid: 'u1', timestamp: T(2), message: { content: 'Arreglá la lista' } });
  const resultado = linea({ type: 'user', uuid: 'u2', timestamp: T(4), message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } });
  const pasos = pasosDeLineas([viejo, nuevo, usa('Read', { file_path: '/a/lista.ts' }, T(3)), resultado, usa('Edit', { file_path: '/a/lista.ts' }, T(5))]);
  assert.deepEqual(pasos.map((p: { texto: string }) => p.texto), ['Lee lista.ts', 'Edita lista.ts'], 'lo de antes del mensaje nuevo no; un tool_result no corta');
  assert.deepEqual(pasosDeLineas([usa('Read', { file_path: '/a/x.ts' }, T(1)), linea({ type: 'system', subtype: 'stop_hook_summary' })]), [], 'el turno terminó');
  const muchos = Array.from({ length: 10 }, (_, i) => usa('Grep', { pattern: 'x' }, T(10 + i)));
  assert.equal(pasosDeLineas(muchos).length, 6, 'los últimos seis');
});

test('MaKo: se sanea lo que sube la PC, lo viejo (90 s) no es «ahora», y cada chat junta los de sus cuentas', () => {
  const ahora = Date.UTC(2026, 9, 17, 15, 2);
  const limpio = sanearPasos({ [LOCAL]: [{ at: T(1), texto: 'Lee\u0000 a.ts' }, { at: 'no', texto: 'x' }], 'malo': [{ at: T(1), texto: 'y' }] });
  assert.deepEqual(limpio, { [LOCAL]: [{ at: T(1), texto: 'Lee a.ts' }] });
  assert.deepEqual(pasosVigentes([{ at: new Date(ahora - 30_000).toISOString(), pasos: limpio }, { at: new Date(ahora - 200_000).toISOString(), pasos: { local_x: [{ at: T(1), texto: 'viejo' }] } }], ahora), limpio);
  assert.deepEqual(pasosDelChat({ miembros: [LOCAL, 'nombre:crm'] }, limpio).map((p) => p.texto), ['Lee a.ts']);
});

test('`vigilar` sube los pasos del chat ocupado mientras espera (con el token), y la vuelta completa también', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-pasos-'));
  const cfgDir = join(dir, 'cfg');
  mkdirSync(join(cfgDir, 'sessions'), { recursive: true });
  const cwd = 'C:\\dev\\x';
  writeFileSync(join(cfgDir, 'sessions', `${process.pid}.json`), JSON.stringify({
    pid: process.pid, sessionId: SESION, name: 'CRM', cwd, entrypoint: 'cli', status: 'busy', messagingSocketPath: '\\\\.\\pipe\\LOCAL\\cc-msg-crm',
  }));
  const proj = join(cfgDir, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
  mkdirSync(proj, { recursive: true });
  writeFileSync(join(proj, `${SESION}.jsonl`), [
    linea({ type: 'user', uuid: 'u1', timestamp: T(1), message: { content: 'Arreglá la lista' } }),
    usa('Bash', { command: 'npm test -- secreto', description: 'Corre los tests del Centro' }, T(2)),
  ].join('\n') + '\n');
  const recibido: Array<{ url: string; cuerpo: Record<string, unknown>; auth: string | undefined }> = [];
  const srv = createServer((req, res) => {
    if (req.method === 'GET') { res.setHeader('content-type', 'application/json'); res.end('{"hay":0}'); return; }
    let b = '';
    req.on('data', (c) => { b += c; }).on('end', () => {
      recibido.push({ url: req.url ?? '', cuerpo: JSON.parse(b || '{}'), auth: req.headers.authorization });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(req.url?.includes('pasos=1') ? { ok: true } : { pedidos: [], vencidos: 0 }));
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  try {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, token: `mkop_${'x'.repeat(30)}`, cwds: ['C:\\dev\\'],
      carteros: { claude2: { fuente: 'cli', configDir: cfgDir } }, carpetas: {},
    }));
    await new Promise<void>((ok, mal) => execFile(process.execPath, [CARTERO, 'vigilar', '--cuenta', 'claude2', '--max-seg', '3'], {
      env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfgDir, CARTERO_VIGILAR_MS: '150', CARTERO_PASOS_MS: '300' },
    }, (e, _so, se) => (e ? mal(new Error(se || e.message)) : ok())));
    const livianos = recibido.filter((r) => r.url.includes('pasos=1'));
    assert.ok(livianos.length >= 1, 'subió los pasos mientras esperaba');
    const p = (livianos[0].cuerpo.pasos as Record<string, Array<{ texto: string }>>)[LOCAL];
    assert.deepEqual(p.map((x) => x.texto), ['Corre los tests del Centro']);
    assert.equal(livianos[0].auth, `Bearer mkop_${'x'.repeat(30)}`);
    assert.ok(!JSON.stringify(recibido).includes('secreto'), 'el comando no viaja');
    const vuelta = recibido.find((r) => !r.url.includes('pasos=1'));
    assert.ok(vuelta && (vuelta.cuerpo.pasos as Record<string, unknown>)[LOCAL], 'la vuelta completa también los lleva');
  } finally {
    srv.close();
  }
});

test('el «Trabajando…» muestra los pasos: el de ahora y los dos de antes', () => {
  const lineas = [{ tipo: 'turno' as const, instante: Date.UTC(2026, 9, 17, 15), turno: { local: LOCAL, uuid: 'u00000001', rol: 'yo' as const, de: null, texto: 'Arreglá la lista', at: T(0), trabajo: null } }];
  const html = renderToStaticMarkup(createElement(Hilo, {
    lineas, pushes: [], ahora: Date.UTC(2026, 9, 17, 15, 1), vacio: '', quien: { titulo: 'CRM', animo: 'trabajando' },
    vivo: { chat: { estado: 'trabajando', viejo: false, sinRunner: false, clave: 'nombre:crm', sesion: LOCAL, titulo: 'CRM' }, carteros: [] },
    pasos: [{ at: T(1), texto: 'Lee lista.ts' }, { at: T(2), texto: 'Edita lista.ts' }, { at: T(3), texto: 'Corre los tests' }, { at: T(4), texto: 'Busca en el código' }],
  }));
  assert.match(html, /Edita lista\.ts[\s\S]*Corre los tests[\s\S]*Busca en el código/);
  assert.doesNotMatch(html, /Lee lista\.ts/, 'los últimos tres');
});

// La revisión del Cerebro (17/10/2026, cartero 1.15.5): `subirPasos` corría DESPUÉS de mirar el reloj, con un POST de hasta
// 8 s por cuenta, y la consulta liviana después: con MaKo colgado `vigilar` pasaba los 120 s del Bash del Runner. Ahora cada
// POST corta en `fin` y la consulta no arranca pasado `fin`.
// Probado ROMPIÉNDOLO (base en 6 pases): `subirPasos` sin `hasta` (los 8 s de siempre) → 1 fallo (tardó ~11 s con un tope
// de 3 s).
test('con MaKo colgado en los pasos, `vigilar` igual termina a tiempo (corta en su `fin`)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-pasos-fin-'));
  const cfgDir = join(dir, 'cfg');
  mkdirSync(join(cfgDir, 'sessions'), { recursive: true });
  const srv = createServer((req, res) => {
    if (req.method === 'GET') { res.setHeader('content-type', 'application/json'); res.end('{"hay":0}'); return; }
    if (req.url?.includes('pasos=1')) { req.resume(); return; } // colgado: nunca contesta
    req.resume().on('end', () => { res.setHeader('content-type', 'application/json'); res.end('{"pedidos":[],"vencidos":0}'); });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  try {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, token: `mkop_${'z'.repeat(30)}`, cwds: ['C:\\dev\\'],
      carteros: { claude2: { fuente: 'cli', configDir: cfgDir } }, carpetas: {},
    }));
    const t0 = Date.now();
    await new Promise<void>((ok, mal) => execFile(process.execPath, [CARTERO, 'vigilar', '--cuenta', 'claude2', '--max-seg', '3'], {
      env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfgDir, CARTERO_VIGILAR_MS: '150', CARTERO_PASOS_MS: '200' },
    }, (e, _so, se) => (e ? mal(new Error(se || e.message)) : ok())));
    const ms = Date.now() - t0;
    assert.ok(ms < 6000, `terminó en ${ms} ms con un tope de 3 s`);
  } finally {
    srv.closeAllConnections?.();
    srv.close();
  }
});
