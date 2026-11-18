// =============================================================================
// «Automático» por fase y el consumo medido (cartero 1.28.0, 18/11/2026)
// =============================================================================
// Pedido de Aaron por Martín (ticket 876825880-11): «Sonnet para explorar, Opus para ejecutar, midiendo el consumo antes y
// después». Lo que, roto, no da error:
//   · la caja firmando «por fase» a un chat que no lo puede cumplir (terminal, el Cerebro, un Runner de antes): el selector
//     diría «Sonnet → Opus» y no pasaría nada;
//   · la PC entregando con el modelo de siempre, o el aviso de ejecutar saliendo sin Opus o hacia otro chat;
//   · un número de consumo inventado: un 0 cuando nadie midió en el medio, o una resta a través de un reinicio de la ventana.
// El último caso corre el cartero de verdad (procesos aparte) contra un servidor falso, con un chat de la APP armado en disco.
//
// ⚠️ Probado ROMPIÉNDOLO (18/11/2026), una rotura por vez contra la base en verde de 5 pases (6 desde «de la caja a la PC»):
//   · mandar.ts copiando el `como` campo por campo (sin `porFase`) → 1 fallo («de la caja a la PC»): así estaba al escribirlo;
//   · `vaPorFase` sin mirar el Cerebro → 1 fallo («la caja firma por fase sólo…»);
//   · `comoCorre` sin la rama por fase (entrega con el modelo del chat) → 2 fallos («la PC entrega…» y el de punta a punta);
//   · `diferencia` sin mirar si alguien midió en el medio → 1 fallo («lo que gastó cada fase…»: un 0 inventado);
//   · `pasarAEjecutar` sin mirar qué sesión lo corre → 1 fallo (el de punta a punta: otro chat pasaba a éste a Opus);
//   · `cierre` sin el consumo → 1 fallo (el de punta a punta).
//   Restaurado de memoria (no con git checkout): 6 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { armarFirmable, nuevoPayload, sanearCierres, sanearConsumo } from '../lib/operaciones-reglas';
import { comoCorreDelEnvio, rotuloAutomaticoModelo, runnerEntiendePorFase, vaPorFase } from '../lib/centro-cuentas';
import { compararConsumo, gastoPorFase, type Consumo, type Cuota } from '../lib/centro-uso';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const CARTERO = join(RAIZ, 'scripts/operaciones/cartero.mjs');
const APP = 'local_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601';
const OTRO_APP = 'local_9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CLI = 'cli_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601';
const ID = 'dddddddd-0000-4000-8000-000000000001';

test('la caja firma «por fase» sólo con «Automático», a un chat de la app que no es el Cerebro, con un Runner que lo entiende', () => {
  assert.equal(vaPorFase(APP, 'CRM', null, true), true);
  assert.equal(vaPorFase(APP, 'CRM', 'haiku', true), false, 'el modelo que elige Martín manda');
  assert.equal(vaPorFase(CLI, 'CRM', null, true), false, 'a un chat de terminal no se le cambia el modelo desde afuera');
  assert.equal(vaPorFase(APP, 'Cerebro', null, true), false, 'el Cerebro reparte y juzga: elige él');
  assert.equal(vaPorFase(APP, 'CRM', null, false), false, 'un Runner de antes lo ignoraría');
  // Lo que se firma: el esfuerzo elegido viaja igual; con un modelo, no hay fases; a terminal, nada.
  assert.deepEqual(comoCorreDelEnvio(APP, 'CRM', null, 'high', true), { modelo: null, esfuerzo: 'high', porFase: true });
  assert.deepEqual(comoCorreDelEnvio(APP, 'CRM', 'opus', null, true), { modelo: 'opus', esfuerzo: null });
  assert.deepEqual(comoCorreDelEnvio(CLI, 'CRM', null, null, true), {});
  // El Runner de ESA cuenta, de la 1.28.0 en adelante.
  const carteros = [{ cuenta: 'claude2', version: '1.27.0' }, { cuenta: 'claude4', version: '1.28.0' }];
  assert.equal(runnerEntiendePorFase(carteros, 'claude4'), true);
  assert.equal(runnerEntiendePorFase(carteros, 'claude2'), false);
  assert.equal(runnerEntiendePorFase([{ cuenta: 'claude4', version: null }], 'claude4'), false, 'sin versión, no');
  assert.equal(rotuloAutomaticoModelo(true), 'Automático · Sonnet → Opus');
  assert.equal(rotuloAutomaticoModelo(false), 'Automático');
});

test('la PC entrega un trabajo por fase con Sonnet y le dice al chat cómo pasar a ejecutar; sin fases, como siempre', async () => {
  const c = await import('../scripts/operaciones/cartero.mjs');
  assert.deepEqual(c.comoCorre({ destino: APP, porFase: true, esfuerzo: 'high' }), { sesion: APP, modelo: 'sonnet', esfuerzo: 'high' });
  assert.deepEqual(c.comoCorre({ destino: CLI, porFase: true }), {}, 'a uno de terminal, nada');
  assert.deepEqual(c.comoCorre({ destino: APP, modelo: 'haiku' }), { sesion: APP, modelo: 'haiku', esfuerzo: null });
  const base = { id: ID, texto: 'Arregla el CRM', destino: APP, creado: new Date().toISOString(), alcance: 'solo_esto' };
  const conFase = c.mensaje({ ...base, porFase: true });
  assert.ok(conFase.includes(`fase ${ID} ejecutar`), 'el chat sabe qué correr para pasar a ejecutar');
  assert.match(conFase, /EXPLORAR/);
  assert.ok(!c.mensaje(base).includes(' fase '), 'sin fases, el mensaje de siempre');
  assert.ok(!c.mensaje({ ...base, destino: CLI, porFase: true }).includes(' fase '), 'a terminal no se le pide');
  // El aviso de ejecutar: un texto fijo, con su propio id (nunca el del pedido), que no se sube como conversación.
  const aviso = c.mensajeFase(ID);
  assert.equal(c.esAvisoDeFase(aviso), true);
  assert.notEqual(c.idDelAvisoDeFase(ID), ID);
  assert.match(c.idDelAvisoDeFase(ID), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.throws(() => c.mensajeFase('no-es-un-id'));
});

test('de la caja a la PC: lo que decide la caja llega firmado y la PC lo lee igual', async () => {
  const c = await import('../scripts/operaciones/cartero.mjs');
  const como = comoCorreDelEnvio(APP, 'CRM', null, 'high', true);
  // Como lo arma app/admin/operaciones/mandar.ts (useFirma → mandar): el `como` entero adentro del payload.
  const firmado = armarFirmable(nuevoPayload({ id: ID, texto: 'Arregla el CRM', destino: APP, cuenta: 'claude4', titulo: 'CRM', alcance: 'solo_esto', ...como }, Date.now()));
  const l = c.leerFirmable(firmado, Date.now()) as { ok: true; p: Record<string, unknown> };
  assert.equal(l.ok, true);
  assert.deepEqual(c.comoCorre(l.p), { sesion: APP, modelo: 'sonnet', esfuerzo: 'high' });
  // mandar.ts no puede importarse en node (trae la acción del servidor): se mira que pase el `como` ENTERO. Copiado campo por
  // campo, el `porFase` se perdía sin un error (pasó al escribir esto, 18/11/2026).
  const mandar = readFileSync(join(RAIZ, 'app/admin/operaciones/mandar.ts'), 'utf8').replace(/\r\n/g, '\n').replace(/^\s*\/\/.*$/gm, '');
  assert.match(mandar, /nuevoPayload\(\{[^}]*\.\.\.como,[^}]*\}, Date\.now\(\)\)/, 'el payload lleva lo que decidió la caja');
});

const cuota = (cinco: number, semana: number, medido: string, reinicia5 = '2026-11-18T15:00:00.000Z'): Cuota => ({
  cinco: { pct: cinco, reinicia: reinicia5 }, semana: { pct: semana, reinicia: '2026-11-21T12:00:00.000Z' }, medido,
});

test('lo que gastó cada fase: la diferencia de la ventana, sin inventar un 0 ni restar a través de un reinicio', () => {
  const c: Consumo = {
    modo: 'por_fase',
    fases: [
      { fase: 'explorar', modelo: 'sonnet', desde: '2026-11-18T10:00:00.000Z', cuota: cuota(20, 40, '2026-11-18T09:59:00.000Z') },
      { fase: 'ejecutar', modelo: 'opus', desde: '2026-11-18T10:30:00.000Z', cuota: cuota(26, 41, '2026-11-18T10:29:00.000Z') },
    ],
    fin: { at: '2026-11-18T11:15:00.000Z', cuota: cuota(41, 43, '2026-11-18T11:14:00.000Z') },
  };
  assert.deepEqual(gastoPorFase(c), [
    { fase: 'explorar', modelo: 'sonnet', minutos: 30, cinco: 6, semana: 1, motivo: null },
    { fase: 'ejecutar', modelo: 'opus', minutos: 45, cinco: 15, semana: 2, motivo: null },
  ]);
  // Nadie midió entre el principio y el final: la foto es la misma, y un 0 sería inventado.
  const quieta: Consumo = { ...c, fases: [c.fases[0]], fin: { at: '2026-11-18T10:10:00.000Z', cuota: c.fases[0].cuota } };
  assert.equal(gastoPorFase(quieta)[0].cinco, null);
  assert.equal(gastoPorFase(quieta)[0].motivo, 'nadie midió en el medio');
  // La ventana de 5 horas se reinició en el medio: la resta no dice nada.
  const reinicio: Consumo = { ...c, fases: [c.fases[0]], fin: { at: '2026-11-18T16:00:00.000Z', cuota: cuota(3, 44, '2026-11-18T15:59:00.000Z', '2026-11-18T20:00:00.000Z') } };
  assert.equal(gastoPorFase(reinicio)[0].cinco, null);
  assert.equal(gastoPorFase(reinicio)[0].motivo, 'se reinició la ventana');
  // Sin cuota en una punta.
  assert.equal(gastoPorFase({ ...c, fin: { ...c.fin, cuota: null } })[1].motivo, 'sin medir');
  // La comparación: el promedio entra sólo con número, y lo que no tiene se cuenta aparte.
  const filas = compararConsumo([c, quieta]);
  const explorar = filas.find((f) => f.modo === 'por_fase' && f.fase === 'explorar');
  assert.deepEqual(explorar, { modo: 'por_fase', fase: 'explorar', modelo: 'sonnet', trabajos: 1, sinNumero: 1, promedioCinco: 6 });
});

test('el consumo que sube la PC se sanea entero: lo que no vale no entra, y el cierre entra igual', () => {
  const bueno = {
    modo: 'por_fase', fin: { at: '2026-11-18T11:00:00Z', cuota: cuota(30, 41, '2026-11-18T10:59:00Z') },
    fases: [{ fase: 'explorar', modelo: 'sonnet', desde: '2026-11-18T10:00:00Z', cuota: cuota(20, 40, '2026-11-18T09:59:00Z') }],
  };
  assert.equal(sanearConsumo(bueno)?.fases.length, 1);
  assert.equal(sanearConsumo({ ...bueno, modo: 'turbo' }), null);
  assert.equal(sanearConsumo({ ...bueno, fases: [{ ...bueno.fases[0], fase: 'ejecutar' }] }), null, 'por fase arranca explorando');
  assert.equal(sanearConsumo({ ...bueno, fases: [bueno.fases[0], bueno.fases[0], bueno.fases[0]] }), null, 'tres fases no');
  assert.equal(sanearConsumo({ ...bueno, fases: [{ ...bueno.fases[0], modelo: 'gpt-5' }] }), null);
  assert.equal(sanearConsumo({ ...bueno, modo: 'sin_tocar' }), null, 'sin fases es una sola, «todo»');
  // Una cuota que no vale queda null: el resto sigue.
  assert.equal(sanearConsumo({ ...bueno, fin: { ...bueno.fin, cuota: { roto: 1 } } })?.fin.cuota, null);
  const [conConsumo] = sanearCierres([{ id: ID, cierre: { hecho: 'Listo', consumo: bueno } }]);
  assert.equal(conConsumo.cierre.consumo?.modo, 'por_fase');
  const [sinConsumo] = sanearCierres([{ id: ID, cierre: { hecho: 'Listo', consumo: { modo: 'raro' } } }]);
  assert.ok(sinConsumo && !('consumo' in sinConsumo.cierre), 'un consumo roto no tira el cierre');
});

/** Procesos que duran lo que el test: sus pids son las sesiones «vivas». */
function vivos(n: number): { pids: number[]; matar: () => void } {
  const ps: ChildProcess[] = Array.from({ length: n }, () => spawn(process.execPath, ['-e', 'setInterval(() => {}, 1e6)'], { stdio: 'ignore' }));
  return { pids: ps.map((p) => p.pid!), matar: () => { for (const p of ps) p.kill(); } };
}

test('de punta a punta en la PC: entrega con Sonnet, `fase` deja a Opus para el Runner, y el cierre sube el consumo', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const dir = mkdtempSync(join(tmpdir(), 'cartero-por-fase-'));
  const cfg = join(dir, 'cfg');
  const recibido: Array<Record<string, unknown>> = [];
  const firmado = armarFirmable(nuevoPayload({ id: ID, texto: 'Arregla el CRM', destino: APP, cuenta: 'claude4', titulo: 'CRM', alcance: 'solo_esto', porFase: true, esfuerzo: 'high' }, Date.now()));
  const firma = sign('sha256', Buffer.from(firmado, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
  const srv = createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d; }).on('end', () => {
      recibido.push(JSON.parse(b));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ pedidos: recibido.length === 1 ? [{ id: ID, firmado, firma }] : [], avisos: [], vencidos: 0, acuses: 0, cierres: 0 }));
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  const v = vivos(2);
  const [runner, chat] = v.pids;
  const env = (extra: Record<string, string> = {}) => ({
    ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_HOME: dir, CARTERO_CONFIG_DIR: cfg,
    CLAUDE_PID: String(runner), CLAUDE_CODE_HOST_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: '', ...extra,
  });
  const correr = (args: string[], extra: Record<string, string> = {}) => new Promise<{ ok: boolean; out: string; err: string }>((ok) =>
    execFile(process.execPath, [CARTERO, ...args], { env: env(extra), maxBuffer: 64 * 1024 * 1024 }, (e, out, err) => ok({ ok: !e, out, err })));
  const json = async (args: string[], extra: Record<string, string> = {}) => {
    const r = await correr(args, extra);
    if (!r.ok) throw new Error(r.err);
    return JSON.parse(r.out);
  };
  const medir = (cinco: number, semana: number, medido: number) =>
    writeFileSync(join(dir, 'uso', 'claude4.json'), JSON.stringify(cuota(cinco, semana, new Date(medido).toISOString(), new Date(Date.now() + 3 * 3_600_000).toISOString())));
  try {
    // Un chat de la APP (su archivo en claude-code-sessions y su sesión viva en la carpeta) y el Runner de esa carpeta.
    mkdirSync(join(dir, 'app', 'c4c4c4c4-aaaa-4bbb-8ccc-dddddddddddd'), { recursive: true });
    writeFileSync(join(dir, 'app', 'c4c4c4c4-aaaa-4bbb-8ccc-dddddddddddd', `${APP}.json`), JSON.stringify({ sessionId: APP, title: 'CRM', cwd: 'C:\\dev\\x', lastActivityAt: Date.now() }));
    mkdirSync(join(cfg, 'sessions'), { recursive: true });
    const sesion = (pid: number, nombre: string, host: string) => writeFileSync(join(cfg, 'sessions', `${pid}.json`), JSON.stringify({
      pid, sessionId: `0000000${pid % 10}-2222-4333-8444-555555555555`, hostSessionId: host, cwd: 'C:\\dev\\x', entrypoint: 'claude-desktop',
      kind: 'interactive', status: 'idle', name: nombre, messagingSocketPath: `\\\\.\\pipe\\LOCAL\\cc-msg-${nombre}`,
    }));
    sesion(runner, 'Runner', OTRO_APP); sesion(chat, 'CRM', APP);
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, token: 'mkop_' + 'x'.repeat(30), cwds: ['C:\\dev\\'],
      carpetas: { 'c4c4c4c4-aaaa-4bbb-8ccc-dddddddddddd': 'claude4' }, carteros: { claude4: { fuentes: [{ fuente: 'app', configDir: cfg }] } },
    }));
    writeFileSync(join(dir, 'claves.txt'), `${spki}\n`);
    mkdirSync(join(dir, 'uso'), { recursive: true });
    const t0 = Date.now();
    medir(20, 40, t0 - 60_000);
    // (1) La vuelta: el trabajo sale con Sonnet y el esfuerzo elegido, y queda anotada la cuota de la cuenta.
    const o = await json(['ciclo', '--cuenta', 'claude4']) as { entregar: Array<Record<string, unknown>> };
    const trabajo = o.entregar.find((e) => e.id === ID);
    assert.ok(trabajo, 'el trabajo se entrega');
    assert.equal(trabajo.sesion, APP);
    assert.equal(trabajo.modelo, 'sonnet', 'explora con Sonnet');
    assert.equal(trabajo.esfuerzo, 'high');
    assert.ok(String(trabajo.mensaje).includes(`fase ${ID} ejecutar`));
    const anotado = JSON.parse(readFileSync(join(dir, 'consumo', `${ID}.json`), 'utf8'));
    assert.equal(anotado.modo, 'por_fase');
    assert.equal(anotado.fases[0].cuota.cinco.pct, 20);
    await json(['acuse', ID, 'ok']);
    // (2) Otro chat no lo pasa a ejecutar; el que lo recibió, sí, una vez.
    const ajeno = await correr(['fase', ID, 'ejecutar'], { CLAUDE_CODE_HOST_SESSION_ID: OTRO_APP });
    assert.equal(ajeno.ok, false, 'un chat no le cambia el modelo a otro');
    medir(26, 41, t0 + 60_000);
    const paso = await json(['fase', ID, 'ejecutar'], { CLAUDE_CODE_HOST_SESSION_ID: APP }) as { ok: boolean; aviso: string };
    assert.equal(paso.ok, true);
    assert.deepEqual(await json(['fase', ID, 'ejecutar'], { CLAUDE_CODE_HOST_SESSION_ID: APP }), { ok: true, yaEstaba: true });
    // (3) El Runner lo ve como cualquier entrega: con Opus, a ese chat, y con el texto fijo.
    const pendientes = await json(['pendientes', '--cuenta', 'claude4']) as Array<Record<string, unknown>>;
    assert.equal(pendientes.length, 1);
    assert.equal(pendientes[0].id, paso.aviso);
    assert.equal(pendientes[0].sesion, APP);
    assert.equal(pendientes[0].modelo, 'opus', 'ejecuta con Opus');
    assert.equal(pendientes[0].esfuerzo, 'high', 'el esfuerzo elegido vale para las dos fases');
    assert.match(String(pendientes[0].mensaje), /^Fase de ejecutar del trabajo /);
    await json(['acuse', paso.aviso, 'ok']);
    // (4) El cierre lleva las dos fases y la cuota del final; la vuelta siguiente lo sube, y MaKo saca lo que gastó cada una.
    medir(41, 43, t0 + 120_000);
    await json(['cierre', ID, '--hecho', 'Quedó el CRM']);
    const cierre = JSON.parse(readFileSync(join(dir, 'cierres', `${ID}.json`), 'utf8'));
    assert.deepEqual(cierre.cierre.consumo.fases.map((f: { fase: string; modelo: string }) => `${f.fase}:${f.modelo}`), ['explorar:sonnet', 'ejecutar:opus']);
    await json(['ciclo', '--cuenta', 'claude4']);
    const subido = recibido[1].cierres as Array<{ id: string; cierre: unknown }>;
    const [entro] = sanearCierres(subido);
    assert.ok(entro?.cierre.consumo, 'el consumo sube con el cierre y pasa el saneo');
    assert.deepEqual(gastoPorFase(entro.cierre.consumo).map((g) => [g.fase, g.cinco]), [['explorar', 6], ['ejecutar', 15]]);
    assert.equal(existsSync(join(dir, 'claude4', 'buzon', `${paso.aviso}.json`)), false, 'el aviso salió una vez');
  } finally {
    v.matar();
    srv.close();
  }
});
