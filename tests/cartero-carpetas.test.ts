// =============================================================================
// El Runner por CARPETA de config (cartero 1.4.0, 16/10/2026): lo que, roto, no da error
// =============================================================================
// Martín: «habiamos dicho de no usar más a Claude desde la app de desktop, sino desde powershell». Cada cuenta corre
// en su terminal con su CLAUDE_CONFIG_DIR, y SendMessage sólo llega a las sesiones de la carpeta del que manda
// (medido: «ENOINBOX: no-key»). La PC tiene un Runner por carpeta y un buzón compartido; lo que se fija acá es lo que,
// mal hecho, entrega dos veces, pierde algo sin decirlo o lo deja trabado para siempre. Cada caso corre el cartero de
// verdad (un proceso aparte) contra un servidor falso, con sesiones «vivas» que son procesos de este test.
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), una rotura por vez contra la base en verde de 6 pases:
//   · `pendientes` sin filtrar por carpeta → 1 fallo («reparte»: el de A también lista B y C);
//   · sin la marca de quién lo tiene → 2 fallos («reparte»: el gemelo de A lo vuelve a listar; y «el Runner caído»);
//   · `entregables` con todos los vivos → 2 fallos («reparte»: B, sin Runner, se reclamaría; y «un Runner que no da vueltas»);
//   · la carpeta subiendo a MaKo → 1 fallo («reparte»);
//   · el acuse sin cuenta sin buscar en los buzones → 1 fallo («reparte»);
//   · sin `exigirRunner` → 1 fallo («un chat que no es el Runner»);
//   · `tomar` volviendo a listar lo de un Runner caído → 1 fallo («el Runner caído»);
//   · el vencimiento sólo en el buzón de la vuelta → 1 fallo («se vence en cualquier vuelta»);
//   · borrar los cierres sin mirar `cierresIds` → 1 fallo («un cierre que no entró»);
//   · contar un Runner sólo por su nombre, sin el latido → 1 fallo («un Runner que no da vueltas»).
//   Restaurado de memoria (no con git checkout): 6 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { armarFirmable, nuevoPayload } from '../lib/operaciones-reglas';

const RAIZ = join(import.meta.dirname, '..');
const CARTERO = join(RAIZ, 'scripts/operaciones/cartero.mjs');
const local = (n: number) => `cli_${n}1111111-2222-4333-8444-555555555555`;
const id = (n: number) => `cccccccc-0000-4000-8000-00000000000${n}`;
const leerJson = (f: string) => JSON.parse(readFileSync(f, 'utf8'));

/** Procesos que duran lo que el test: sus pids son las sesiones «vivas». */
function vivos(n: number): { pids: number[]; matar: () => void } {
  const ps: ChildProcess[] = Array.from({ length: n }, () => spawn(process.execPath, ['-e', 'setInterval(() => {}, 1e6)'], { stdio: 'ignore' }));
  return { pids: ps.map((p) => p.pid!), matar: () => { for (const p of ps) p.kill(); } };
}

/** Una PC de prueba: el directorio del cartero, sus carpetas de config y un servidor falso. */
async function armarPC(responder: (cuerpo: Record<string, unknown>, n: number) => Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-carpetas-'));
  const recibido: Array<Record<string, unknown>> = [];
  const srv = createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d; }).on('end', () => {
      const cuerpo = JSON.parse(b) as Record<string, unknown>;
      recibido.push(cuerpo);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ pedidos: [], avisos: [], vencidos: 0, acuses: 0, cierres: 0, ...responder(cuerpo, recibido.length) }));
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  const carpeta = (x: string) => join(dir, `cfg-${x}`);
  const sesion = (cfg: string, pid: number, nombre: string, n: number | null = null) => {
    mkdirSync(join(cfg, 'sessions'), { recursive: true });
    writeFileSync(join(cfg, 'sessions', `${pid}.json`), JSON.stringify({
      pid, sessionId: n == null ? `0000000${pid % 10}-2222-4333-8444-555555555555` : local(n).slice(4), cwd: 'C:\\dev\\x',
      entrypoint: 'cli', kind: 'interactive', status: 'idle', name: nombre, messagingSocketPath: `\\\\.\\pipe\\LOCAL\\cc-msg-${nombre}`,
    }));
  };
  // El latido que deja cada vuelta de un Runner: así lo cuentan los otros (cartero.mjs → latidoDe).
  const latido = (cfg: string, hace = 0) => {
    mkdirSync(join(dir, 'latidos'), { recursive: true });
    const h = createHash('sha256').update(resolve(cfg).toLowerCase()).digest('hex').slice(0, 16);
    writeFileSync(join(dir, 'latidos', `${h}.json`), JSON.stringify({ dir: cfg, at: new Date(Date.now() - hace).toISOString(), pid: 'x' }));
  };
  const config = (carteros: Record<string, unknown>) => writeFileSync(join(dir, 'config.json'), JSON.stringify({
    url, token: 'mkop_' + 'x'.repeat(30), cwds: ['C:\\dev\\'], carpetas: {}, carteros,
  }));
  const correr = (args: string[], cfg: string, dueno: number) => new Promise<{ ok: boolean; out: string; err: string }>((ok) => execFile(process.execPath,
    [CARTERO, ...args],
    { env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfg, CLAUDE_PID: String(dueno) } },
    (e, out, err) => ok({ ok: !e, out, err })));
  const json = async (args: string[], cfg: string, dueno: number) => {
    const r = await correr(args, cfg, dueno);
    if (!r.ok) throw new Error(r.err);
    return JSON.parse(r.out);
  };
  return { dir, recibido, carpeta, sesion, latido, config, correr, json, cerrar: () => srv.close() };
}

test('reparte: MaKo reclama sólo lo que un Runner alcanza, y cada Runner entrega lo de SU carpeta, una vez', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const ahora = Date.now();
  // Un servidor de antes de la 1.4.0 reclama para TODOS los vivos: se le devuelve uno por carpeta.
  const pedidos = [1, 2, 3].map((n) => {
    const firmado = armarFirmable(nuevoPayload({ id: id(n), texto: `para ${n}`, destino: local(n), cuenta: 'claude2', titulo: 'x', alcance: 'solo_esto' }, ahora));
    return { id: id(n), firmado, firma: sign('sha256', Buffer.from(firmado, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64') };
  });
  const pc = await armarPC((_, n) => ({ pedidos: n === 1 ? pedidos : [] }));
  const v = vivos(5);
  const [runnerA, gemeloA, runnerC] = [v.pids[0], v.pids[1], v.pids[2]];
  const [cfgA, cfgB, cfgC] = ['a', 'b', 'c'].map(pc.carpeta);
  try {
    // A: este Runner, su gemelo (la app y claude1 comparten ~/.claude) y un chat. B: un chat sin Runner. C: un chat y su
    // Runner, que da vueltas (su latido).
    pc.sesion(cfgA, runnerA, 'Runner'); pc.sesion(cfgA, gemeloA, 'Runner'); pc.sesion(cfgA, v.pids[3], 'CRM', 1);
    pc.sesion(cfgB, v.pids[4], 'Pagos', 2);
    pc.sesion(cfgC, runnerC, 'Runner'); pc.sesion(cfgC, v.pids[3], 'Onboarding', 3);
    pc.latido(cfgC);
    pc.config({ claude2: { fuentes: [cfgA, cfgB, cfgC].map((configDir) => ({ fuente: 'cli', configDir })) } });
    writeFileSync(join(pc.dir, 'claves.txt'), `${spki}\n`);
    // (1) Sin --cuenta: da la vuelta por las cuentas de su carpeta.
    const o = await pc.json(['ciclo'], cfgA, runnerA) as { cuentas: Record<string, unknown>; entregar: Array<{ id: string; to: string }> };
    assert.deepEqual(Object.keys(o.cuentas), ['claude2']);
    const subido = pc.recibido[0] as { entregables: string[]; chats: Array<Record<string, unknown>> };
    assert.deepEqual([...subido.entregables].sort(), [local(1), local(3)], 'B no tiene Runner: MaKo no reclama lo suyo');
    assert.equal(subido.chats.find((c) => c.local === local(2))?.runner, false);
    assert.equal(subido.chats.find((c) => c.local === local(3))?.runner, true);
    assert.equal(subido.chats.some((c) => /Runner/.test(String(c.titulo))), false, 'el Runner no es un chat');
    assert.equal(subido.chats.some((c) => 'dir' in c || 'pipe' in c), false, 'ni la carpeta ni el canal salen de la PC');
    // (2) Éste entrega sólo lo de su carpeta; lo de C lo lleva el Runner de C.
    assert.deepEqual(o.entregar.map((e) => e.id), [id(1)]);
    assert.equal(o.entregar[0].to, 'uds:\\\\.\\pipe\\LOCAL\\cc-msg-CRM');
    assert.deepEqual((await pc.json(['pendientes'], cfgC, runnerC) as Array<{ id: string }>).map((e) => e.id), [id(3)]);
    // (3) El gemelo de la carpeta A no lo vuelve a listar mientras lo tiene el primero.
    assert.deepEqual(await pc.json(['pendientes'], cfgA, gemeloA), [], 'no lo manda dos veces');
    assert.deepEqual((await pc.json(['pendientes'], cfgA, runnerA) as Array<{ id: string }>).map((e) => e.id), [id(1)], 'el que lo tiene lo sigue viendo');
    // (4) El acuse sin --cuenta lo encuentra, y queda anotado como entregado.
    await pc.json(['acuse', id(1), 'ok'], cfgA, runnerA);
    assert.equal(existsSync(join(pc.dir, 'claude2', 'buzon', `${id(1)}.json`)), false);
    assert.equal(existsSync(join(pc.dir, 'claude2', 'buzon', `${id(1)}.mano`)), false);
    assert.equal(existsSync(join(pc.dir, 'entregados', id(1))), true, 'un archivo por id: dos Runners acusando a la vez no se pisan');
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('un chat que no es el Runner no se queda con lo del buzón', async () => {
  const pc = await armarPC(() => ({}));
  const v = vivos(1);
  const cfg = pc.carpeta('a');
  try {
    pc.sesion(cfg, v.pids[0], 'CRM', 1);
    pc.config({ claude2: { fuentes: [{ fuente: 'cli', configDir: cfg }] } });
    mkdirSync(join(pc.dir, 'claude2', 'buzon'), { recursive: true });
    writeFileSync(join(pc.dir, 'claude2', 'buzon', `${id(1)}.json`), JSON.stringify({ id: id(1), reclamado: new Date().toISOString(), dir: cfg, to: 'uds:x', titulo: 'CRM', mensaje: 'm' }));
    for (const cmd of [['pendientes'], ['ciclo']]) {
      const r = await pc.correr(cmd, cfg, v.pids[0]);
      assert.equal(r.ok, false, `${cmd[0]} corre desde un chat que no es el Runner`);
      assert.match(r.err, /no es el Runner/);
    }
    assert.equal(existsSync(join(pc.dir, 'claude2', 'buzon', `${id(1)}.mano`)), false, 'no lo marcó como suyo');
    assert.equal(pc.recibido.length, 0, 'ni le pidió trabajos a MaKo');
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('el Runner caído: lo que tenía en la mano no se vuelve a mandar, se dice «no sé si llegó»', async () => {
  const pc = await armarPC(() => ({}));
  const v = vivos(1);
  const cfg = pc.carpeta('a');
  try {
    pc.sesion(cfg, v.pids[0], 'Runner');
    pc.config({ claude2: { fuentes: [{ fuente: 'cli', configDir: cfg }] } });
    const buzon = join(pc.dir, 'claude2', 'buzon');
    mkdirSync(buzon, { recursive: true });
    writeFileSync(join(buzon, `${id(1)}.json`), JSON.stringify({ id: id(1), reclamado: new Date().toISOString(), dir: cfg, to: 'uds:x', titulo: 'CRM', mensaje: 'm' }));
    // Lo tenía un Runner cuyo proceso ya no existe (un pid que no corre).
    writeFileSync(join(buzon, `${id(1)}.mano`), '999999');
    assert.deepEqual(await pc.json(['pendientes'], cfg, v.pids[0]), [], 'no sale dos veces');
    const acuse = leerJson(join(pc.dir, 'claude2', 'acuses', `${id(1)}.json`));
    assert.equal(acuse.estado, 'incierto');
    assert.match(acuse.motivo, /se cerró a mitad de la entrega/);
    assert.equal(existsSync(join(buzon, `${id(1)}.json`)), false);
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('se vence en cualquier vuelta: lo de una cuenta cuyo Runner se cerró no queda «entregando» para siempre', async () => {
  const pc = await armarPC(() => ({}));
  const v = vivos(1);
  const [cfgA, cfgB] = ['a', 'b'].map(pc.carpeta);
  try {
    // La cuenta 1 sólo tiene fuente en A (cuyo Runner se cerró); éste es el Runner de B, que da la vuelta por la 2.
    pc.sesion(cfgB, v.pids[0], 'Runner');
    pc.config({ claude1: { fuentes: [{ fuente: 'cli', configDir: cfgA }] }, claude2: { fuentes: [{ fuente: 'cli', configDir: cfgB }] } });
    mkdirSync(join(pc.dir, 'claude1', 'buzon'), { recursive: true });
    writeFileSync(join(pc.dir, 'claude1', 'buzon', `${id(1)}.json`), JSON.stringify({
      id: id(1), reclamado: new Date(Date.now() - 31 * 60_000).toISOString(), dir: cfgA, to: 'uds:x', titulo: 'CRM', mensaje: 'm',
    }));
    const o = await pc.json(['ciclo'], cfgB, v.pids[0]) as { cuentas: Record<string, unknown> };
    assert.deepEqual(Object.keys(o.cuentas), ['claude2']);
    const acuses = (pc.recibido[0] as { acuses: Array<{ id: string; estado: string; motivo: string }> }).acuses;
    assert.deepEqual(acuses.map((a) => [a.id, a.estado]), [[id(1), 'incierto']], 'el acuse de la cuenta 1 sube en la vuelta de la 2');
    assert.match(acuses[0].motivo, /Se cerró el Runner de esa terminal/);
    assert.equal(existsSync(join(pc.dir, 'claude1', 'buzon', `${id(1)}.json`)), false);
    assert.equal(readdirSync(join(pc.dir, 'claude1', 'acuses')).length, 0, 'lo subido se borra');
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('un cierre que no entró se vuelve a subir, y uno de hace más de un día se descarta', async () => {
  const pc = await armarPC((cuerpo, n) => ({ cierresIds: n === 2 ? (cuerpo.cierres as Array<{ id: string }>).map((c) => c.id) : [] }));
  const v = vivos(1);
  const cfg = pc.carpeta('a');
  try {
    pc.sesion(cfg, v.pids[0], 'Runner');
    pc.config({ claude2: { fuentes: [{ fuente: 'cli', configDir: cfg }] } });
    const cierres = join(pc.dir, 'cierres');
    mkdirSync(cierres, { recursive: true });
    const nuevo = join(cierres, `${id(1)}.json`);
    const viejo = join(cierres, `${id(2)}.json`);
    for (const f of [nuevo, viejo]) writeFileSync(f, JSON.stringify({ id: f.includes(id(1)) ? id(1) : id(2), cierre: { hecho: 'listo', decidido: '', comprobado: '', sigue: '', prueba: null } }));
    const hace2Dias = (Date.now() - 2 * 86_400_000) / 1000;
    utimesSync(viejo, hace2Dias, hace2Dias);
    // 1ª vuelta: MaKo no aplica ninguno (el acuse de su pedido todavía no llegó).
    await pc.json(['ciclo'], cfg, v.pids[0]);
    assert.equal(existsSync(nuevo), true, 'el que no entró queda para la próxima');
    assert.equal(existsSync(viejo), false, 'uno de hace dos días no se sube para siempre');
    // 2ª vuelta: lo aplica, y recién ahí se borra.
    await pc.json(['ciclo'], cfg, v.pids[0]);
    assert.deepEqual((pc.recibido[1] as { cierres: Array<{ id: string }> }).cierres.map((c) => c.id), [id(1)]);
    assert.equal(existsSync(nuevo), false);
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('un Runner que no da vueltas no cuenta: el nombre solo no alcanza', async () => {
  const pc = await armarPC(() => ({}));
  const v = vivos(3);
  const [cfgA, cfgB] = ['a', 'b'].map(pc.carpeta);
  try {
    // En B hay un chat «Runner» al que nadie le pegó las instrucciones (no late) y un chat abierto.
    pc.sesion(cfgA, v.pids[0], 'Runner');
    pc.sesion(cfgB, v.pids[1], 'Runner'); pc.sesion(cfgB, v.pids[2], 'Pagos', 2);
    pc.config({ claude2: { fuentes: [cfgA, cfgB].map((configDir) => ({ fuente: 'cli', configDir })) } });
    await pc.json(['ciclo'], cfgA, v.pids[0]);
    const subido = pc.recibido[0] as { entregables: string[]; chats: Array<Record<string, unknown>> };
    assert.equal(subido.chats.find((c) => c.local === local(2))?.runner, false, 'sin latido, no hay Runner en B');
    assert.deepEqual(subido.entregables, []);
    // Con un latido de hace un minuto, sí; con uno de hace diez, no.
    pc.latido(cfgB, 60_000);
    await pc.json(['ciclo'], cfgA, v.pids[0]);
    assert.deepEqual((pc.recibido[1] as { entregables: string[] }).entregables, [local(2)]);
    pc.latido(cfgB, 10 * 60_000);
    await pc.json(['ciclo'], cfgA, v.pids[0]);
    assert.deepEqual((pc.recibido[2] as { entregables: string[] }).entregables, []);
  } finally {
    v.matar(); pc.cerrar();
  }
});
