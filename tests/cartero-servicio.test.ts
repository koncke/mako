// =============================================================================
// El servicio de la PC (cartero 1.25.0, 30/10/2026): medir y subir sin un chat abierto
// =============================================================================
// El Runner estuvo parado del 24/10 al 30/10: lo disparaba un chat, y sin ese chat no se midió ni se subió nada. El servicio
// sube lo que puede y hace visible la ausencia (docs/diseno-cartero-servicio.md). Lo que se fija acá es lo que, roto, no da
// error: un servicio que late como Runner hace pasar por vivo a un chat sin cron, uno que reclama deja pedidos donde nadie los
// manda, y dos vueltas a la vez se pisan las marcas. Cada caso corre el cartero de verdad contra un MaKo de mentira, en una PC
// de mentira (CARTERO_DIR). Con sesiones «vivas» que son procesos de este test. El registro de Windows es un programa falso
// (CARTERO_REG): este archivo jamás escribe el de verdad.
//
// ⚠️ Probado ROMPIÉNDOLO (30/10/2026), una rotura por vez contra la base en verde de 12 pases. Todas dieron rojo:
//   · el servicio late como Runner, o cuenta su carpeta como una con Runner → «no late como Runner»;
//   · entregables calculados en el servicio → «no late como Runner» (con un Runner vivo reclamaría); sin mandar la lista → «mide»;
//   · el servicio declara `abre`, o no manda `servicio` → «mide y sube»;
//   · lo que MaKo le da va al buzón → «si MaKo igual le da trabajo»;
//   · el servicio o el Runner sin lock, o el Runner sin latir → «dos vueltas a la vez»;
//   · el lock ignora el pid, nunca vence o no se suelta → «el lock»;
//   · `vigilar` no reintenta la salteada → «un Runner que salteó»;
//   · el bucle sale por un error, sin latido aparte, sin mirar si ya corre, o sin apagarse → «el bucle nunca se cae»;
//   · un chat corre el servicio, o `exigirRunner` aflojado → «un chat no corre el servicio»;
//   · sin la doble llave → «la doble llave»; sin la guarda del registro → «una PC de prueba»;
//   · el valor de mako-pc, el lanzador con ventana, o un lanzador que queda si `reg` falla → «instalar y quitar».
//   Restaurado del original en memoria, y comparado byte a byte.
// La revisión adversarial del servicio (1.26.1), con la misma mecánica; roturas al pie.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { armarFirmable, nuevoPayload, sanearEntregables, type ChatCartero } from '../lib/operaciones-reglas';

const RAIZ = join(import.meta.dirname, '..');
const CARTERO = join(RAIZ, 'scripts/operaciones/cartero.mjs');
const TOKEN = `mkop_${'x'.repeat(30)}`;
const local = (n: number) => `cli_${n}1111111-2222-4333-8444-555555555555`;
const id = (n: number) => `dddddddd-0000-4000-8000-00000000000${n}`;
const leerJson = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
async function hasta(cond: () => boolean, ms: number, que: string) {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error(`no pasó a tiempo: ${que}`);
    await dormir(50);
  }
}

/** El entorno de un proceso que NO es un chat: esta misma suite puede correr desde uno. */
const sinChat = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^CLAUDE/.test(k))) as unknown as NodeJS.ProcessEnv;

function vivos(n: number): { pids: number[]; matar: () => void } {
  const ps: ChildProcess[] = Array.from({ length: n }, () => spawn(process.execPath, ['-e', 'setInterval(() => {}, 1e6)'], { stdio: 'ignore' }));
  return { pids: ps.map((p) => p.pid!), matar: () => { for (const p of ps) p.kill(); } };
}

type Cuerpo = { cuenta: string; entregables: string[]; abre: string[]; servicio?: { version: string; desde: string }; chats: Array<Record<string, unknown>>; acuses: Array<{ id: string; estado: string; motivo: string | null }>; cierres: Array<{ id: string }> };

const REG_FALSO = `
const fs = require('fs');
const a = process.argv.slice(2);
const f = process.env.FAKE_REG;
const s = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { llamadas: [], valores: {} };
s.llamadas.push(a);
let c = 0;
if (process.env.FAKE_REG_FALLA) c = 5;
else if (a[0] === 'add') s.valores[a[3]] = a[7];
else if (a[0] === 'query') c = s.valores[a[3]] ? 0 : 1;
else if (a[0] === 'delete') { c = s.valores[a[3]] ? 0 : 1; delete s.valores[a[3]]; }
fs.writeFileSync(f, JSON.stringify(s));
process.exit(c);
`;

/** Una PC de prueba: el directorio del cartero, sus carpetas de config, un servidor falso y un registro falso. */
async function armarPC(responder: (cuerpo: Cuerpo, n: number) => Record<string, unknown> | Promise<Record<string, unknown>> = () => ({})) {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-servicio-'));
  const recibido: Cuerpo[] = [];
  /** `listo`: lo que dice MaKo de sí misma a `instalar-servicio`. null = un servidor de antes, que no conoce la pregunta. */
  const servidor: { listo: boolean | null } = { listo: true };
  const srv: Server = createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d; }).on('end', async () => {
      res.setHeader('content-type', 'application/json');
      if (req.method === 'GET' && req.url?.includes('servicio-listo')) {
        if (servidor.listo === null) res.statusCode = 404;
        res.end(JSON.stringify(servidor.listo === null ? { error: 'no hay ese adjunto para entregar' } : { servicio: servidor.listo }));
        return;
      }
      if (req.method === 'GET') { res.end(JSON.stringify({ hay: 0 })); return; }
      const cuerpo = JSON.parse(b) as Cuerpo;
      recibido.push(cuerpo);
      const extra = await responder(cuerpo, recibido.length);
      if (typeof extra.__status === 'number') { res.statusCode = extra.__status; res.end(JSON.stringify({ error: 'token del cartero inválido' })); return; }
      res.end(JSON.stringify({ pedidos: [], avisos: [], vencidos: 0, acuses: 0, cierres: 0, ...extra }));
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  const puerto = (srv.address() as { port: number }).port;
  const url = `http://127.0.0.1:${puerto}`;
  const carpeta = (x: string) => join(dir, `cfg-${x}`);
  const sesion = (cfg: string, pid: number, nombre: string, n: number | null = null) => {
    mkdirSync(join(cfg, 'sessions'), { recursive: true });
    writeFileSync(join(cfg, 'sessions', `${pid}.json`), JSON.stringify({
      pid, sessionId: n == null ? `0000000${pid % 10}-2222-4333-8444-555555555555` : local(n).slice(4), cwd: 'C:\\dev\\x',
      entrypoint: 'cli', kind: 'interactive', status: 'idle', name: nombre, messagingSocketPath: `\\\\.\\pipe\\LOCAL\\cc-msg-${nombre}`,
    }));
  };
  const latidoDe = (cfg: string) => join(dir, 'latidos', `${createHash('sha256').update(resolve(cfg).toLowerCase()).digest('hex').slice(0, 16)}.json`);
  const latido = (cfg: string, hace = 0) => {
    mkdirSync(join(dir, 'latidos'), { recursive: true });
    writeFileSync(latidoDe(cfg), JSON.stringify({ dir: cfg, at: new Date(Date.now() - hace).toISOString(), pid: 'x' }));
  };
  const config = (carteros: Record<string, unknown>, extra: Record<string, unknown> = {}) => writeFileSync(join(dir, 'config.json'), JSON.stringify({
    url, token: TOKEN, cwds: ['C:\\dev\\'], carpetas: {}, carteros, ...extra,
  }));
  const claves = (spki = 'QUJDRA==') => writeFileSync(join(dir, 'claves.txt'), `${spki}\n`);
  const regJs = join(dir, 'reg-falso.cjs');
  writeFileSync(regJs, REG_FALSO);
  const regEstado = join(dir, 'reg-estado.json');
  const env = (extra: Record<string, string> = {}) => ({
    ...sinChat, CARTERO_DIR: dir, CARTERO_HOME: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_REG: JSON.stringify([process.execPath, regJs]), FAKE_REG: regEstado, ...extra,
  });
  const correr = (args: string[], extra: Record<string, string> = {}) => new Promise<{ ok: boolean; out: string; err: string }>((ok) => execFile(process.execPath,
    // Con tope: si una rotura deja el bucle corriendo, el test da rojo y no queda un proceso suelto.
    [CARTERO, ...args], { env: env(extra), timeout: 80_000 }, (e, out, err) => ok({ ok: !e, out, err })));
  const json = async (args: string[], extra: Record<string, string> = {}) => {
    const r = await correr(args, extra);
    if (!r.ok) throw new Error(r.err);
    return JSON.parse(r.out);
  };
  const comoRunner = (cfg: string, pid: number) => ({ CARTERO_CONFIG_DIR: cfg, CLAUDE_PID: String(pid) });
  const cerrar = () => { srv.closeAllConnections(); srv.close(); };
  const abrir = () => new Promise<void>((ok) => srv.listen(puerto, '127.0.0.1', () => ok()));
  return { servidor, dir, recibido, carpeta, sesion, latido, latidoDe, config, claves, correr, json, comoRunner, env, cerrar, abrir, regEstado, lockDe: join(dir, 'vuelta.lock') };
}

const fuentes = (...cfgs: string[]) => ({ fuentes: cfgs.map((configDir) => ({ fuente: 'cli', configDir })) });

test('mide y sube sin reclamar: entregables y abre vacíos, por todas las cuentas, y lo que dejaron los chats sube igual', async () => {
  const pc = await armarPC();
  const v = vivos(2);
  const [a, b] = ['a', 'b'].map(pc.carpeta);
  try {
    pc.sesion(a, v.pids[0], 'CRM', 1); pc.sesion(b, v.pids[1], 'Pagos', 2);
    // Con el permiso de abrir chats PRENDIDO: `abre` reclama aparte de `entregables`.
    pc.config({ claude1: fuentes(a), claude2: fuentes(b) }, { abrir: true });
    pc.claves();
    mkdirSync(join(pc.dir, 'claude1', 'acuses'), { recursive: true });
    writeFileSync(join(pc.dir, 'claude1', 'acuses', `${id(1)}.json`), JSON.stringify({ id: id(1), estado: 'entregado', motivo: null }));
    mkdirSync(join(pc.dir, 'cierres'), { recursive: true });
    writeFileSync(join(pc.dir, 'cierres', `${id(2)}.json`), JSON.stringify({ id: id(2), cierre: { hecho: 'listo' } }));

    const o = await pc.json(['servicio', '--una-vez', '--desde', '2026-10-30T10:00:00.000Z']);
    assert.deepEqual(Object.keys(o.cuentas).sort(), ['claude1', 'claude2'], 'el servicio no tiene carpeta: da la vuelta por todas');
    assert.equal(pc.recibido.length, 2);
    for (const c of pc.recibido) {
      assert.deepEqual(c.entregables, [], `${c.cuenta}: la lista VACÍA, no sin mandarla (sin ella, MaKo reclama todos los vivos)`);
      assert.deepEqual(c.abre, [], `${c.cuenta}: no declara que abre chats`);
      assert.equal(c.servicio?.desde, '2026-10-30T10:00:00.000Z');
      assert.match(String(c.servicio?.version), /^\d+\.\d+\.\d+$/);
    }
    assert.equal(pc.recibido.find((c) => c.cuenta === 'claude1')?.chats.some((c) => c.local === local(1)), true, 'los chats suben');
    const todos = pc.recibido.flatMap((c) => c.acuses.map((x) => x.id));
    assert.deepEqual(todos, [id(1)], 'el acuse que dejó un Runner sube');
    assert.deepEqual(pc.recibido.flatMap((c) => c.cierres.map((x) => x.id)).slice(0, 1), [id(2)], 'el cierre que dejó un chat sube');
    assert.equal(existsSync(join(pc.dir, 'claude1', 'acuses', `${id(1)}.json`)), false, 'lo subido se borra');
    assert.equal(existsSync(pc.lockDe), false, 'suelta la vuelta al terminar');
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('no late como Runner: un chat con nombre y sin latido no cuenta, ni antes ni después de una vuelta del servicio', async () => {
  const pc = await armarPC();
  const v = vivos(2);
  const cfg = pc.carpeta('a');
  const crm = () => pc.recibido.at(-1)!.chats.find((c) => c.local === local(1))!;
  const runnerSubido = () => pc.recibido.at(-1)!.chats.find((c) => c.esRunner === true)!;
  try {
    // Lo que deja un `/clear`: el chat «Runner» abierto, con su nombre, y sin cron.
    pc.sesion(cfg, v.pids[0], 'Runner'); pc.sesion(cfg, v.pids[1], 'CRM', 1);
    pc.config({ claude1: fuentes(cfg) }); pc.claves();

    await pc.json(['servicio', '--una-vez']);
    assert.equal(crm().runner, false, 'sin latido, el chat «Runner» no cuenta');
    assert.equal(runnerSubido().runner, false);
    assert.equal(existsSync(pc.latidoDe(cfg)), false, 'el servicio no dejó latido de Runner');
    assert.equal(existsSync(join(pc.dir, 'latidos')), false, 'ni de nadie');

    await pc.json(['servicio', '--una-vez']);
    assert.equal(crm().runner, false, 'la vuelta anterior del servicio no lo hizo contar');

    pc.latido(cfg, 7 * 60_000);
    await pc.json(['servicio', '--una-vez']);
    assert.equal(crm().runner, false, 'un latido de hace 7 minutos ya venció');

    // Un Runner de verdad (su latido fresco): el servicio lo ve y lo dice, y no le saca nada.
    pc.latido(cfg);
    await pc.json(['servicio', '--una-vez']);
    assert.equal(crm().runner, true, 'con un Runner vivo, `hay` de MaKo sigue contando sus pedidos');
    assert.deepEqual(pc.recibido.at(-1)!.entregables, [], 'y el servicio igual no reclama');
    // Y el Runner, en su vuelta, sigue reclamando lo suyo.
    await pc.json(['ciclo'], pc.comoRunner(cfg, v.pids[0]));
    assert.deepEqual(pc.recibido.at(-1)!.entregables, [local(1)], 'el Runner reclama lo que alcanza');
    assert.equal(pc.recibido.at(-1)!.servicio, undefined, 'y no se presenta como servicio');
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('si MaKo igual le da trabajo, no toca el buzón: lo devuelve con su motivo', async () => {
  const pc = await armarPC((_, n) => (n === 1 ? {
    pedidos: [{ id: id(1), firmado: 'x', firma: 'x' }],
    avisos: [{ id: id(2), ref: 'una-tarjeta', destino: local(1) }],
    tickets: [{ id: id(3), numero: 7, destino: local(1) }],
    ticketsNuevos: [{ id: id(4), numero: 8, destino: local(1) }],
    // Lo que espera un chat cerrado (1.26.0): trae ids de PEDIDOS que no están tomados. No es trabajo del servicio ni se acusa.
    limbo: [{ id: id(5), cuenta: 'claude2', fecha: '2026-10-24T08:00:00.000Z', etapa: 'espera', destino: local(1) }],
  } : {}));
  const v = vivos(1);
  const cfg = pc.carpeta('a');
  try {
    pc.sesion(cfg, v.pids[0], 'CRM', 1);
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    const o = await pc.json(['servicio', '--una-vez']);
    assert.equal(o.cuentas.claude1.devueltos, 4);
    assert.deepEqual(existsSync(join(pc.dir, 'claude1', 'buzon')) ? readdirSync(join(pc.dir, 'claude1', 'buzon')) : [], [], 'el buzón no se llena de trabajos que nadie va a mandar');
    await pc.json(['servicio', '--una-vez']);
    const acuses = pc.recibido[1].acuses;
    assert.deepEqual(acuses.map((a) => a.id).sort(), [id(1), id(2), id(3), id(4)]);
    for (const a of acuses) {
      assert.equal(a.estado, 'no_entregado');
      assert.match(String(a.motivo), /abre el Runner/);
    }
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('dos vueltas a la vez: la segunda saltea, sea el servicio o un Runner, y el Runner saltea sin dejar de latir', async () => {
  let soltar = () => {};
  const compuerta = new Promise<void>((ok) => { soltar = ok; });
  const pc = await armarPC(async () => { await compuerta; return {}; });
  const v = vivos(2);
  const cfg = pc.carpeta('a');
  try {
    pc.sesion(cfg, v.pids[0], 'Runner'); pc.sesion(cfg, v.pids[1], 'CRM', 1);
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    const primera = pc.json(['servicio', '--una-vez']);
    await hasta(() => pc.recibido.length === 1, 15_000, 'la primera vuelta llega a MaKo');
    const lock = leerJson(pc.lockDe) as { pid: number; quien: string };
    assert.equal(lock.quien, 'servicio');
    assert.ok(Number.isInteger(lock.pid));

    assert.deepEqual(await pc.json(['servicio', '--una-vez']), { salteada: true }, 'otro servicio saltea');
    const delRunner = await pc.json(['ciclo'], pc.comoRunner(cfg, v.pids[0]));
    assert.equal(delRunner.salteada, true, 'el Runner saltea');
    assert.deepEqual(delRunner.entregar, []);
    assert.equal(existsSync(pc.latidoDe(cfg)), true, 'pero late: sigue vivo');
    assert.equal(pc.recibido.length, 1, 'sólo una vuelta llegó a MaKo');

    soltar();
    await primera;
    assert.equal(existsSync(pc.lockDe), false);
    const segunda = await pc.json(['ciclo'], pc.comoRunner(cfg, v.pids[0]));
    assert.equal(segunda.salteada, undefined, 'suelto, el Runner da su vuelta');
    assert.equal(pc.recibido.length, 2);
  } finally {
    soltar(); v.matar(); pc.cerrar();
  }
});

test('el lock: vale con su pid vivo y 3 minutos; un pid muerto o uno vencido no retienen, y la vuelta del servicio lo retoma', async () => {
  const pc = await armarPC();
  const cfg = pc.carpeta('a');
  const v = vivos(2);
  try {
    pc.sesion(cfg, v.pids[0], 'CRM', 1);
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    const poner = (pid: number, haceMs: number) => {
      writeFileSync(pc.lockDe, JSON.stringify({ pid, quien: 'runner', at: new Date().toISOString() }));
      const t = new Date(Date.now() - haceMs);
      utimesSync(pc.lockDe, t, t);
    };
    poner(v.pids[1], 2 * 60_000);
    assert.deepEqual(await pc.json(['servicio', '--una-vez']), { salteada: true }, 'vivo y de hace 2 minutos: vigente');
    assert.equal(pc.recibido.length, 0);

    poner(v.pids[1], 4 * 60_000);
    assert.notEqual((await pc.json(['servicio', '--una-vez'])).salteada, true, 'vivo pero de hace 4 minutos: vencido');
    assert.equal(pc.recibido.length, 1);

    const muerto = vivos(1);
    muerto.matar();
    await dormir(300);
    poner(muerto.pids[0], 1000);
    assert.notEqual((await pc.json(['servicio', '--una-vez'])).salteada, true, 'un pid muerto no retiene');
    assert.equal(pc.recibido.length, 2);
    assert.equal(existsSync(pc.lockDe), false);
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('un Runner que salteó vuelve a intentar dentro de `vigilar`: si no, el que llega segundo nunca sube su cuenta', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const firmado = armarFirmable(nuevoPayload({ id: id(1), texto: 'un pedido', destino: local(1), cuenta: 'claude1', titulo: 'CRM', alcance: 'solo_esto' }, Date.now()));
  const firma = sign('sha256', Buffer.from(firmado, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
  const pc = await armarPC((_, n) => (n === 1 ? { pedidos: [{ id: id(1), firmado, firma }] } : {}));
  const v = vivos(3);
  const cfg = pc.carpeta('a');
  try {
    pc.sesion(cfg, v.pids[0], 'Runner'); pc.sesion(cfg, v.pids[1], 'CRM', 1);
    pc.config({ claude1: fuentes(cfg) }); pc.claves(spki);
    writeFileSync(pc.lockDe, JSON.stringify({ pid: v.pids[2], quien: 'servicio', at: new Date().toISOString() }));
    const vigilando = pc.json(['vigilar', '--max-seg', '100'], { ...pc.comoRunner(cfg, v.pids[0]), CARTERO_VIGILAR_MS: '150' });
    await dormir(1200);
    assert.equal(pc.recibido.length, 0, 'con la vuelta tomada no sube');
    rmSync(pc.lockDe, { force: true });
    const o = await vigilando as { entregar: Array<{ id: string }>; salteada?: boolean };
    assert.deepEqual(o.entregar.map((e) => e.id), [id(1)], 'en cuanto se suelta, da su vuelta y entrega');
    assert.equal(o.salteada, undefined);
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('un servidor de antes: no conoce `servicio` ni contesta nada nuevo, y la vuelta anda igual', async () => {
  const pc = await armarPC();
  const v = vivos(1);
  const cfg = pc.carpeta('a');
  try {
    pc.sesion(cfg, v.pids[0], 'CRM', 1);
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    const o = await pc.json(['servicio', '--una-vez']);
    assert.equal(o.cuentas.claude1.error, undefined);
    assert.equal(o.fallaron, undefined);
  } finally {
    v.matar(); pc.cerrar();
  }
  // Lo que hace válido mandar la lista vacía: MaKo distingue [] (nada) de «sin la lista» (todos los vivos, un cartero de antes).
  const chats: ChatCartero[] = [{ local: local(1), titulo: 'CRM', cuenta: 'claude1', vivo: true, estado: 'idle', actividad: null }];
  assert.deepEqual(sanearEntregables([], chats), []);
  assert.deepEqual(sanearEntregables(undefined, chats), [local(1)]);
});

test('el bucle nunca se cae solo: sin red reintenta, vuelve solo, deja su latido aparte, no se duplica y se apaga cuando se le pide', async () => {
  const pc = await armarPC();
  const v = vivos(1);
  const cfg = pc.carpeta('a');
  let bucle: ChildProcess | null = null;
  try {
    pc.sesion(cfg, v.pids[0], 'CRM', 1);
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    pc.cerrar(); // MaKo caído
    let termino: number | null | 'no' = 'no';
    bucle = spawn(process.execPath, [CARTERO, 'servicio'], { env: pc.env({ CARTERO_SERVICIO_MS: '200' }), stdio: 'ignore' });
    bucle.on('exit', (c) => { termino = c; });
    const log = join(pc.dir, 'cartero.log');
    await hasta(() => existsSync(log) && /sin poder subir/.test(readFileSync(log, 'utf8')), 30_000, 'anota que no pudo subir');
    await dormir(800);
    assert.equal(termino, 'no', 'un error de red no lo tumba');

    await pc.abrir(); // MaKo vuelve
    await hasta(() => pc.recibido.length > 0, 30_000, 'la vuelta llega cuando vuelve la red');
    await hasta(() => /volvió la conexión/.test(readFileSync(log, 'utf8')), 15_000, 'lo anota');
    assert.deepEqual(pc.recibido[0].entregables, []);

    const lat = leerJson(join(pc.dir, 'servicio.json')) as { pid: number; desde: string; version: string; at: string };
    assert.equal(lat.pid, bucle.pid, 'su latido, aparte');
    assert.equal(pc.recibido[0].servicio?.desde, lat.desde, 'el POST dice desde cuándo corre el proceso, no la vuelta');
    assert.equal(existsSync(join(pc.dir, 'latidos')), false, 'y ninguno de Runner');

    const otro = await pc.json(['servicio']);
    assert.equal(otro.yaCorre, true, 'uno solo por PC');
    assert.equal(otro.pid, bucle.pid);

    const q = await pc.json(['quitar-servicio']);
    assert.equal(q.seApaga, true);
    await hasta(() => termino !== 'no', 30_000, 'se apaga cuando se le pide');
    assert.equal(termino, 0);
    assert.equal(existsSync(join(pc.dir, 'servicio.json')), false);
  } finally {
    bucle?.kill(); v.matar(); pc.cerrar();
  }
});

test('un chat no corre el servicio, y `exigirRunner` sigue frenando a quien no se llama Runner', async () => {
  const pc = await armarPC();
  const v = vivos(1);
  const cfg = pc.carpeta('a');
  try {
    pc.sesion(cfg, v.pids[0], 'CRM', 1);
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    // Primero la de una vez: con esta guarda rota, el bucle no terminaría nunca.
    for (const args of [['servicio', '--una-vez'], ['servicio']]) {
      const r = await pc.correr(args, pc.comoRunner(cfg, v.pids[0]));
      assert.equal(r.ok, false);
      assert.match(r.err, /no corre desde un chat/);
    }
    const c = await pc.correr(['ciclo'], pc.comoRunner(cfg, v.pids[0]));
    assert.equal(c.ok, false, 'la vuelta de un chat sigue exigiendo el nombre');
    assert.match(c.err, /no es el Runner/);
    assert.equal(pc.recibido.length, 0);
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('la doble llave: sin token o sin clave no instala ni arranca, y no toca el registro', async () => {
  const pc = await armarPC();
  const cfg = pc.carpeta('a');
  try {
    const llamadas = () => (existsSync(pc.regEstado) ? (leerJson(pc.regEstado).llamadas as string[][]) : []);
    // Sin token.
    pc.config({ claude1: fuentes(cfg) }, { token: '' }); pc.claves();
    for (const cmd of ['instalar-servicio', 'servicio']) {
      const r = await pc.correr([cmd]);
      assert.equal(r.ok, false, `${cmd} sin token`);
      assert.match(r.err, /Falta el token/);
    }
    assert.equal((await pc.correr(['servicio', '--una-vez'])).ok, false);
    // Un token que no es de los carteros.
    pc.config({ claude1: fuentes(cfg) }, { token: 'otra-cosa-que-no-sirve-para-nada-aca' });
    assert.match((await pc.correr(['instalar-servicio'])).err, /Falta el token/);
    // Sin claves.txt.
    pc.config({ claude1: fuentes(cfg) });
    rmSync(join(pc.dir, 'claves.txt'), { force: true });
    for (const cmd of ['instalar-servicio', 'servicio']) {
      const r = await pc.correr([cmd]);
      assert.equal(r.ok, false, `${cmd} sin claves`);
      assert.match(r.err, /Falta una clave/);
    }
    assert.deepEqual(llamadas(), [], 'el registro ni se tocó');
    assert.equal(existsSync(join(pc.dir, 'mako-cartero.vbs')), false);
    assert.equal(existsSync(join(pc.dir, 'cartero.mjs')), false, 'tampoco se copió');
    assert.equal(pc.recibido.length, 0);
    // Una PC sin cuentas tampoco.
    pc.claves(); pc.config({});
    assert.match((await pc.correr(['instalar-servicio'])).err, /no tiene cuentas/);
    assert.deepEqual(llamadas(), []);
  } finally {
    pc.cerrar();
  }
});

test('instalar y quitar: la clave Run con su nombre propio, un lanzador sin ventana, y quitar deja todo como estaba', async () => {
  const pc = await armarPC();
  const cfg = pc.carpeta('a');
  const RUN = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  try {
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    const vbs = join(pc.dir, 'mako-cartero.vbs');
    const este = join(pc.dir, 'cartero.mjs');

    // Si Windows no deja, no queda nada a medias.
    const mal = await pc.correr(['instalar-servicio'], { FAKE_REG_FALLA: '1' });
    assert.equal(mal.ok, false);
    assert.match(mal.err, /no dejó escribir/);
    assert.equal(existsSync(vbs), false);
    rmSync(pc.regEstado, { force: true });

    const o = await pc.json(['instalar-servicio']);
    assert.equal(o.ok, true);
    const reg = leerJson(pc.regEstado) as { llamadas: string[][]; valores: Record<string, string> };
    assert.equal(reg.llamadas.length, 1);
    assert.deepEqual(reg.llamadas[0].slice(0, 7), ['add', RUN, '/v', 'MaKo Cartero', '/t', 'REG_SZ', '/d']);
    assert.equal(reg.llamadas[0][8], '/f');
    assert.equal(reg.valores['MaKo Cartero'], `wscript.exe //B //Nologo "${vbs}"`, 'las comillas llegan enteras a reg.exe');
    assert.equal(reg.valores.MaKo, undefined, 'no pisa el valor de mako-pc');
    assert.equal(existsSync(este), true, 'el servicio corre la copia de la PC, no la del clon');
    const crudo = readFileSync(vbs);
    assert.deepEqual([crudo[0], crudo[1]], [0xff, 0xfe], 'UTF-16 con BOM: Windows Script Host lee bien una ruta con tildes');
    const texto = crudo.toString('utf16le');
    assert.ok(texto.includes(`""${process.execPath}"" ""${este}"" servicio", 0, False`), 'sin ventana (0) y sin esperar');

    const q = await pc.json(['quitar-servicio']);
    assert.deepEqual(q, { ok: true, estaba: true, seApaga: false });
    const r2 = leerJson(pc.regEstado) as { llamadas: string[][]; valores: Record<string, string> };
    assert.deepEqual(r2.llamadas.at(-1), ['delete', RUN, '/v', 'MaKo Cartero', '/f']);
    assert.equal(r2.valores['MaKo Cartero'], undefined);
    assert.equal(existsSync(vbs), false);

    const otra = await pc.json(['quitar-servicio']);
    assert.equal(otra.estaba, false, 'quitarlo dos veces no es un error');
  } finally {
    pc.cerrar();
  }
});

test('una vuelta salteada supone una larga: la que arranca con el reintento termina antes de que el Bash la corte', async () => {
  const { duraDeVuelta, entraOtraVuelta, TOPE_VIGILAR_SEG } = await import('../scripts/operaciones/cartero.mjs');
  const VUELTA_REAL_PEOR = 80; // la punta de lo medido
  const BASH = 120;
  for (const maxSeg of [60, 100, TOPE_VIGILAR_SEG]) {
    let ultima = -1;
    for (let t = 0; t <= maxSeg; t++) if (entraOtraVuelta(t * 1000, maxSeg * 1000, duraDeVuelta(true, 0))) ultima = t;
    assert.ok(ultima + VUELTA_REAL_PEOR < BASH, `--max-seg ${maxSeg}: arranca en el segundo ${ultima} y el Bash la corta a la mitad`);
  }
  assert.ok(entraOtraVuelta(4000, 100_000, duraDeVuelta(true, 0)), 'en los primeros segundos sigue reintentando');
  assert.equal(duraDeVuelta(false, 500), 2000, 'una medida vale lo medido');
});

test('la vuelta no pasa de su presupuesto y sigue por la que faltó: ninguna cuenta queda siempre última, y eso no es una falla', async () => {
  const pc = await armarPC();
  const cfgs = ['a', 'b', 'c'].map(pc.carpeta);
  try {
    pc.config({ claude1: fuentes(cfgs[0]), claude2: fuentes(cfgs[1]), claude3: fuentes(cfgs[2]) }); pc.claves();
    const presupuesto = { CARTERO_SERVICIO_PRESUPUESTO_MS: '1' };
    const primera = await pc.json(['servicio', '--una-vez'], presupuesto);
    assert.deepEqual(primera.faltaron, ['claude2', 'claude3']);
    assert.equal(primera.fallaron, undefined, 'las que no entraron no son una falla');
    assert.equal(existsSync(pc.lockDe), false, 'suelta la vuelta para que entre el Runner');
    await pc.json(['servicio', '--una-vez'], presupuesto);
    await pc.json(['servicio', '--una-vez'], presupuesto);
    await pc.json(['servicio', '--una-vez'], presupuesto);
    assert.deepEqual(pc.recibido.map((c) => c.cuenta), ['claude1', 'claude2', 'claude3', 'claude1'], 'cada vuelta empieza por la que quedó');
    // Y una cuenta que el tope corta no traba a las demás: el turno ya apunta a la siguiente.
    const { ordenDelServicio } = await import('../scripts/operaciones/cartero.mjs');
    assert.deepEqual(ordenDelServicio(['a', 'b', 'c'], 'b'), ['b', 'c', 'a']);
    assert.deepEqual(ordenDelServicio(['a', 'b'], 'otra'), ['a', 'b'], 'una cuenta que ya no está no cuenta');
    assert.deepEqual(ordenDelServicio(['a', 'b'], undefined), ['a', 'b']);
  } finally {
    pc.cerrar();
  }
});

test('un corte por tope no es una falla de red: lo anota aparte, y el bucle sigue', async () => {
  let soltar = () => {};
  const compuerta = new Promise<void>((ok) => { soltar = ok; });
  const pc = await armarPC(async () => { await compuerta; return {}; });
  const cfg = pc.carpeta('a');
  let bucle: ChildProcess | null = null;
  try {
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    let termino = false;
    bucle = spawn(process.execPath, [CARTERO, 'servicio'], { env: pc.env({ CARTERO_SERVICIO_MS: '200', CARTERO_SERVICIO_TOPE_MS: '2500' }), stdio: 'ignore' });
    bucle.on('exit', () => { termino = true; });
    const log = join(pc.dir, 'cartero.log');
    await hasta(() => existsSync(log) && /no entró en/.test(readFileSync(log, 'utf8')), 30_000, 'anota que la vuelta no entró');
    assert.doesNotMatch(readFileSync(log, 'utf8'), /sin poder subir/, 'un corte por tope contó como falla de red');
    assert.equal(termino, false);
    soltar();
    await hasta(() => existsSync(pc.lockDe) === false && pc.recibido.length >= 2, 30_000, 'la vuelta siguiente sale, con el lock de la cortada vencido');
  } finally {
    soltar(); bucle?.kill(); pc.cerrar();
  }
});

test('con error nunca insiste más que sano; con el token rechazado espera, no mide las otras cuentas, y un token nuevo lo despierta', async () => {
  const { esperaDelServicio, ESPERA_TOKEN_MS } = await import('../scripts/operaciones/cartero.mjs');
  const CADA = 120_000;
  const serie = [1, 2, 3, 4, 5, 6, 7, 8, 9, 50, 5000].map((f) => esperaDelServicio(f, CADA));
  assert.deepEqual(serie.slice(0, 4), [5000, 10_000, 30_000, 60_000], 'los primeros, rápidos: un corte de segundos');
  for (const e of serie.slice(4)) assert.ok(e >= CADA, `insiste cada ${e} ms, más que sano`);
  assert.equal(serie.at(-1), 600_000, 'con su techo, y sin desbordar');
  assert.equal(esperaDelServicio(0, CADA), CADA);
  const porDia = 86_400_000 / serie.at(-1)!;
  assert.ok(porDia < 86_400_000 / CADA, 'en un corte largo intenta menos que sano');
  assert.ok(ESPERA_TOKEN_MS >= 600_000);

  const pc = await armarPC((_, n) => (n === 1 ? { __status: 401 } : {}));
  const cfgs = ['a', 'b'].map(pc.carpeta);
  let bucle: ChildProcess | null = null;
  try {
    pc.config({ claude1: fuentes(cfgs[0]), claude2: fuentes(cfgs[1]) }); pc.claves();
    bucle = spawn(process.execPath, [CARTERO, 'servicio'], { env: pc.env({ CARTERO_SERVICIO_MS: '200' }), stdio: 'ignore' });
    await hasta(() => pc.recibido.length >= 1, 30_000, 'la primera vuelta');
    await dormir(2500);
    assert.equal(pc.recibido.length, 1, 'con un token que no vale no se insiste, ni con la otra cuenta');
    const log = readFileSync(join(pc.dir, 'cartero.log'), 'utf8');
    assert.match(log, /no acepta el token/);
    assert.doesNotMatch(log, /sin poder subir/);
    pc.config({ claude1: fuentes(cfgs[0]), claude2: fuentes(cfgs[1]) }, { token: `mkop_${'y'.repeat(30)}` });
    await hasta(() => pc.recibido.length >= 2, 15_000, 'el token nuevo vale sin reiniciar nada ni esperar los 10 minutos');
  } finally {
    bucle?.kill(); pc.cerrar();
  }
});

test('un latido de antes de prender la PC no vale: con el pid reusado, el servicio nuevo arranca igual', async () => {
  const { latidoVale } = await import('../scripts/operaciones/cartero.mjs');
  const AHORA = Date.parse('2026-10-30T18:00:00Z');
  const hace = (min: number) => ({ pid: 4242, at: new Date(AHORA - min * 60_000).toISOString() });
  const vivo = () => true;
  assert.equal(latidoVale(hace(1), AHORA, AHORA - 3600_000, vivo, 1), true, 'de esta sesión de Windows');
  assert.equal(latidoVale(hace(3), AHORA, AHORA - 60_000, vivo, 1), false, 'de antes de prender');
  assert.equal(latidoVale(hace(7), AHORA, AHORA - 3600_000, vivo, 1), false, 'vencido');
  assert.equal(latidoVale(hace(1), AHORA, AHORA - 3600_000, () => false, 1), false, 'pid muerto');
  assert.equal(latidoVale(hace(1), AHORA, AHORA - 3600_000, vivo, 4242), false, 'es éste');
  assert.equal(latidoVale(null, AHORA, AHORA - 3600_000, vivo, 1), false);

  const pc = await armarPC();
  const v = vivos(1);
  const cfg = pc.carpeta('a');
  let bucle: ChildProcess | null = null;
  try {
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    writeFileSync(join(pc.dir, 'servicio.json'), JSON.stringify({ pid: v.pids[0], at: new Date(Date.now() - 60_000).toISOString(), desde: 'x' }));
    assert.equal((await pc.json(['servicio'], { CARTERO_UPTIME_SEG: '100000' })).yaCorre, true, 'con Windows prendido hace rato, es el que corre');
    bucle = spawn(process.execPath, [CARTERO, 'servicio'], { env: pc.env({ CARTERO_UPTIME_SEG: '10', CARTERO_SERVICIO_MS: '200' }), stdio: 'ignore' });
    await hasta(() => pc.recibido.length > 0, 30_000, 'un Windows recién prendido no le cree al latido de antes');
  } finally {
    bucle?.kill(); v.matar(); pc.cerrar();
  }
});

test('un acuse que no se pudo leer no se borra: sube en la vuelta siguiente, y el roto de verdad se va al día', async () => {
  const pc = await armarPC();
  const cfg = pc.carpeta('a');
  try {
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    const dir = join(pc.dir, 'claude1', 'acuses');
    mkdirSync(dir, { recursive: true });
    const aMedias = join(dir, `${id(1)}.json`);
    const entero = join(dir, `${id(2)}.json`);
    const roto = join(dir, `${id(3)}.json`);
    writeFileSync(aMedias, ''); // writeFileSync ya creó el archivo y todavía no escribió
    writeFileSync(entero, JSON.stringify({ id: id(2), estado: 'entregado', motivo: null }));
    writeFileSync(roto, '{ "id":');
    const antes = new Date(Date.now() - 25 * 3_600_000);
    utimesSync(roto, antes, antes);
    await pc.json(['servicio', '--una-vez']);
    assert.deepEqual(pc.recibido[0].acuses.map((a) => a.id), [id(2)]);
    assert.equal(existsSync(entero), false, 'lo subido se borra');
    assert.equal(existsSync(aMedias), true, 'el pedido quedaría tomado y después incierto, con el chat ya entregado');
    assert.equal(existsSync(roto), false, 'uno que lleva un día sin poder leerse no se queda para siempre');
    writeFileSync(aMedias, JSON.stringify({ id: id(1), estado: 'entregado', motivo: null }));
    await pc.json(['servicio', '--una-vez']);
    assert.deepEqual(pc.recibido[1].acuses.map((a) => a.id), [id(1)], 'ya entero, sube');
  } finally {
    pc.cerrar();
  }
});

test('el inicio de Windows lo decide Martín: un chat no instala ni quita, y sin la migración y el deploy tampoco se instala', async () => {
  const pc = await armarPC();
  const v = vivos(1);
  const cfg = pc.carpeta('a');
  const llamadas = () => (existsSync(pc.regEstado) ? (leerJson(pc.regEstado).llamadas as string[][]) : []);
  try {
    pc.sesion(cfg, v.pids[0], 'Runner');
    pc.config({ claude1: fuentes(cfg) }); pc.claves();
    for (const cmd of ['instalar-servicio', 'quitar-servicio']) {
      const r = await pc.correr([cmd], pc.comoRunner(cfg, v.pids[0]));
      assert.equal(r.ok, false, `${cmd} desde un chat`);
      assert.match(r.err, /no lo corre un chat/);
    }
    assert.deepEqual(llamadas(), [], 'el registro ni se tocó');
    assert.equal(existsSync(join(pc.dir, 'mako-cartero.vbs')), false);
    assert.equal(existsSync(join(pc.dir, 'cartero.mjs')), false);

    for (const listo of [false, null]) {
      pc.servidor.listo = listo;
      const r = await pc.correr(['instalar-servicio']);
      assert.equal(r.ok, false, `con MaKo sin lista (${listo})`);
      assert.match(r.err, /primero la migración 0355 y el deploy/);
    }
    assert.deepEqual(llamadas(), [], 'el orden es migración, deploy e instalar');
    assert.equal(existsSync(join(pc.dir, 'cartero.mjs')), false);

    pc.cerrar();
    pc.servidor.listo = true;
    assert.match((await pc.correr(['instalar-servicio'])).err, /No pude preguntarle a MaKo/, 'sin saber, no se instala');
    assert.deepEqual(llamadas(), []);
    await pc.abrir();
    assert.equal((await pc.json(['instalar-servicio'])).ok, true, 'con MaKo lista, Martín instala');
  } finally {
    v.matar(); pc.cerrar();
  }
});

test('una PC de prueba jamás escribe el registro de verdad, y mako-pc no lleva este código', async () => {
  const { programaReg, faltaLlave, VALOR_RUN } = await import('../scripts/operaciones/cartero.mjs');
  const entorno = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
  assert.throws(() => programaReg(entorno({ CARTERO_DIR: 'C:\\prueba' })), /no escribe el registro/);
  assert.deepEqual(programaReg(entorno({})), ['reg.exe']);
  assert.deepEqual(programaReg(entorno({ CARTERO_DIR: 'x', CARTERO_REG: '["a","b"]' })), ['a', 'b']);
  assert.equal(faltaLlave({ token: TOKEN }, ['clave']), null);
  assert.notEqual(VALOR_RUN, 'MaKo');
  // La regla del diseño (§2.4): `mako-pc` es de los clientes y promete no tocar ~/.claude.
  const pc = readFileSync(join(RAIZ, 'scripts/ia-pc/mako-pc.mjs'), 'utf8');
  assert.doesNotMatch(pc, /MaKo Cartero|vuelta\.lock|mkop_|cartero\.mjs/);
});

// ── La revisión adversarial (1.26.1, 30/10/2026): cada rotura sola, restaurada; todas dieron rojo ──────────────────────────────────
//   S1  `VUELTA_SUPUESTA_MS` en 30 s · S2 sin presupuesto (todas las cuentas siempre) · S3 sin escribir el turno · S4 el corte por tope cuenta como falla
//   S5  la espera de antes (`Math.min(cada, esperaSinRed)`) · S6 sin la espera del token · S7 un token nuevo no lo despierta · S8 sigue con las otras cuentas tras un 401
//   S9  `latidoVale` sin mirar el arranque de la PC · S10 borra el acuse que no pudo leer · S11 el roto se queda para siempre
//   S12 `instalar-servicio` sin `soloMartin` · S13 `quitar-servicio` sin `soloMartin` · S14 instala sin preguntarle a MaKo
