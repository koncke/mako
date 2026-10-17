// =============================================================================
// El Runner y los chats de la nube, en la lista del Ops Center (17/10/2026)
// =============================================================================
// Martín, mirando producción: «todo chat abierto se ve» — faltaban el Runner (cartero.mjs lo sacaba a propósito) y uno de
// la nube (no queda en ningún archivo de la PC). Ahora:
//   · el Runner sube marcado (`esRunner`): está en la lista, sin caja, y nunca se le reclama ni entrega un trabajo;
//   · los de la nube los anota el Runner de la app con list_sessions (`cartero.mjs nube <id> <título> …`): suben con
//     `nube`, nunca vivos para la PC, y se dibujan con la marca «Nube», sin caja y SIN unirse al de la PC que se llama
//     igual (sería elegible como destino y no tiene canal).
// Lo que se fija acá es lo que, roto, NO da error: un trabajo que sale hacia el Runner, uno de la nube elegido como
// destino, la marca que se pierde entre la PC y MaKo, y el Runner que vuelve a desaparecer de la lista.
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 5 pases:
//   · el cartero sacando otra vez al Runner de la lista (`|| esElCartero(o.title)`) → 1 fallo;
//   · `entregables` sin excluir al Runner → 1 fallo;
//   · sanearChats sin forzar `vivo: false` en uno de la nube → 1 fallo;
//   · sanearEntregables sin excluir al Runner → 1 fallo;
//   · unirPorNombre juntando el de la nube con el de la PC → 1 fallo;
//   · comoSale sin mirar al Runner → 1 fallo.
//   Restaurado de memoria (no con git checkout): 5 pases.
// Lo que el test NO ve: la forma real de una fila de list_sessions para un chat de la nube (el 17/10 no había ninguno en
// la cuenta 4 para medirlo). Por eso el id se acepta amplio (`NUBE_RE`: lo que no es `local_`/`cli_`).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { NUBE_RE, sanearChats, sanearEntregables } from '../lib/operaciones-reglas';
import { comoSale, completarChats, textoDeEnvio, type CarteroP } from '../lib/centro-chats';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const CARTERO = join(RAIZ, 'scripts/operaciones/cartero.mjs');

const correr = (dir: string, cfgDir: string, args: string[]) => new Promise<string>((ok, mal) => execFile(process.execPath, [CARTERO, ...args],
  { env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfgDir } },
  (e, so, se) => (e ? mal(new Error(se || e.message)) : ok(so))));

test('la PC sube al Runner marcado y los de la nube que anotó, y no le entrega nada a ninguno', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-runner-'));
  const cfgDir = join(dir, 'cfg');
  mkdirSync(join(cfgDir, 'sessions'), { recursive: true });
  const CHAT = '11111111-2222-4333-8444-555555555555';
  const RUNNER = '99999999-2222-4333-8444-555555555555';
  // Un chat de terminal y el Runner de esa carpeta, los dos vivos (este proceso y su padre).
  writeFileSync(join(cfgDir, 'sessions', `${process.pid}.json`), JSON.stringify({
    pid: process.pid, sessionId: CHAT, name: 'CRM', cwd: 'C:\\dev\\x', entrypoint: 'cli', status: 'idle', messagingSocketPath: '\\\\.\\pipe\\LOCAL\\cc-msg-crm',
  }));
  writeFileSync(join(cfgDir, 'sessions', `${process.ppid}.json`), JSON.stringify({
    pid: process.ppid, sessionId: RUNNER, name: 'Runner', cwd: 'C:\\dev\\x', entrypoint: 'cli', status: 'busy', messagingSocketPath: '\\\\.\\pipe\\LOCAL\\cc-msg-runner',
  }));
  const recibido: Array<{ chats: Array<Record<string, unknown>>; entregables: string[]; turnos: unknown[] }> = [];
  const srv = createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d; }).on('end', () => {
      recibido.push(JSON.parse(b));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ pedidos: [], vencidos: 0, acuses: 0, cierres: 0 }));
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  try {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, token: `mkop_${'x'.repeat(30)}`, cwds: ['C:\\dev\\'],
      carteros: { claude2: { fuente: 'cli', configDir: cfgDir } }, carpetas: {},
    }));
    // El Runner de la app anota los de la nube; uno de esta PC no se acepta como «de la nube».
    await assert.rejects(correr(dir, cfgDir, ['nube', '--cuenta', 'claude2', `local_${CHAT}`, 'CRM']), /no es un chat de la nube/);
    await correr(dir, cfgDir, ['nube', '--cuenta', 'claude2', 'session_01ABCdef234', 'Web Generator']);
    await correr(dir, cfgDir, ['ciclo', '--cuenta', 'claude2']);
    const { chats, entregables } = recibido[0];
    const runner = chats.find((c) => c.local === `cli_${RUNNER}`);
    assert.ok(runner, 'el Runner está en la lista');
    assert.equal(runner.esRunner, true);
    assert.ok(!entregables.includes(`cli_${RUNNER}`), 'al Runner no se le reclama nada');
    assert.ok(entregables.includes(`cli_${CHAT}`), 'al chat sí');
    const nube = chats.find((c) => c.local === 'session_01ABCdef234');
    assert.deepEqual({ titulo: nube?.titulo, nube: nube?.nube, vivo: nube?.vivo }, { titulo: 'Web Generator', nube: true, vivo: false });
  } finally {
    srv.close();
  }
});

test('MaKo guarda las marcas y nunca reclama un trabajo para el Runner ni para uno de la nube', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  assert.equal(String(cartero.NUBE_RE), String(NUBE_RE), 'la PC y MaKo aceptan el mismo id de la nube');
  const chats = sanearChats([
    { local: 'cli_99999999-2222-4333-8444-555555555555', titulo: 'Runner', vivo: true, estado: 'busy', esRunner: true, runner: true },
    { local: 'session_01ABCdef234', titulo: 'Web Generator', vivo: true, nube: true },
    { local: 'session_01ABCdef234', titulo: 'sin la marca de la nube no entra', vivo: true },
    { local: 'local_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601', titulo: 'CRM', vivo: true, nube: true },
  ]);
  assert.deepEqual(chats.map((c) => c.local), ['cli_99999999-2222-4333-8444-555555555555', 'session_01ABCdef234']);
  assert.equal(chats[0].esRunner, true);
  assert.equal(chats[1].vivo, false, 'uno de la nube nunca está vivo para la PC');
  assert.deepEqual(sanearEntregables(chats.map((c) => c.local), chats), [], 'ni el Runner ni la nube');
});

const AHORA = Date.parse('2026-10-17T12:00:00Z');
const carteros: CarteroP[] = [{
  cuenta: 'claude4', vistoAt: new Date(AHORA - 30_000).toISOString(), claves: ['0123456789abcdef'], chats: [
    { local: 'local_aaaaaaaa-0000-4000-8000-000000000001', titulo: 'Runner', cuenta: 'claude4', vivo: true, estado: 'busy', actividad: null, runner: true, esRunner: true },
    { local: 'local_aaaaaaaa-0000-4000-8000-000000000002', titulo: 'Web Generator', cuenta: 'claude4', vivo: true, estado: 'idle', actividad: null, runner: true },
    { local: 'session_01ABCdef234', titulo: 'Web Generator', cuenta: 'claude4', vivo: false, estado: null, actividad: null, nube: true },
  ],
}];

test('en la lista: el Runner sin caja, y el de la nube aparte del de la PC, con su marca y sin caja', () => {
  const lista = completarChats([], { carteros, trabajos: [], ahora: AHORA });
  const runner = lista.find((c) => c.esRunner);
  assert.ok(runner, 'el Runner se ve');
  const envioRunner = comoSale(runner, carteros, '0123456789abcdef', AHORA);
  assert.deepEqual(envioRunner, { puede: false, por: 'runner' });
  assert.equal(textoDeEnvio(envioRunner), 'El Runner entrega lo que escribes: no se le escribe.');

  const web = lista.filter((c) => c.titulo === 'Web Generator');
  assert.equal(web.length, 2, 'el de la nube y el de la PC son dos filas: no se unen por el nombre');
  const nube = web.find((c) => c.nube);
  const pc = web.find((c) => !c.nube);
  assert.equal(nube?.sesion, 'session_01ABCdef234');
  assert.equal(nube?.estado, 'abierto');
  assert.deepEqual(comoSale(nube!, carteros, '0123456789abcdef', AHORA), { puede: false, por: 'nube' });
  assert.equal(pc?.sesion, 'local_aaaaaaaa-0000-4000-8000-000000000002', 'el de la PC sigue recibiendo en su sesión');
  assert.equal(comoSale(pc!, carteros, '0123456789abcdef', AHORA).puede, true);
});

test('la fila dibuja la marca «Nube», y el Runner de la app sabe anotar la nube', async () => {
  for (const f of ['app/admin/operaciones/PiezasCentro.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    assert.match(sinComentarios(leer(f)), /c\.nube && .*<span className="co-chip-cuenta">Nube<\/span>/, `${f}: la marca`);
  }
  const { INSTRUCCIONES_RUNNER, COMANDO_RUNNER } = await import('../lib/runner');
  assert.ok(INSTRUCCIONES_RUNNER.includes('list_sessions') && INSTRUCCIONES_RUNNER.includes(`${COMANDO_RUNNER} nube`), 'el paso de la nube');
});

test('lo que dice el Runner no se sube como conversación', () => {
  const s = sinComentarios(leer('scripts/operaciones/cartero.mjs'));
  assert.match(s, /turnosDeLaVuelta\(\[\.\.\.chats\.values\(\)\]\.filter\(\(c\) => !c\.esRunner\)\)/);
  assert.match(s, /if \(chat\.esRunner\) \{ rechazar\('Al Runner no se le escribe/, 'un trabajo firmado para el Runner se rechaza en la PC');
});
