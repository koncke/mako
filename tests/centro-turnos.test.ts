// =============================================================================
// La conversación de un chat, como un chat de verdad (17/10/2026)
// =============================================================================
// Martín, mirando el Centro en producción: «los chats no se entienden... No se entiende la conversación que se tiene».
// La conversación es lo que se le dijo al chat y lo que CONTESTÓ al terminar cada turno, sacado de su transcript por la
// PC (cartero.mjs → turnosDeLineas); los hitos van a la barra del Plan. Lo que se fija acá es lo que, roto, NO da error:
//   1. Lo que el sistema le escribe al chat (recordatorios, avisos de tareas, el «límite de sesión») colado como si lo
//      hubiera dicho alguien.
//   2. La respuesta de un turno tomada del PRIMER texto («Ahora miro…») y no del último, o perdida entre dos vueltas.
//   3. Un trabajo del Centro dibujado dos veces (el trabajo con sus ticks, y su turno).
//   4. Los hitos de la bitácora otra vez en la conversación.
//   5. La PC subiendo lo mismo en cada vuelta, o perdiendo lo que no entró.
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 4 pases (cada rotura → 1 fallo):
//   · turnosDeLineas sin sacar los <system-reminder> → 1 fallo;
//   · la respuesta con el PRIMER texto del turno (sin pisar `p`) → 1 fallo;
//   · sin cerrar el turno con `stop_hook_summary` → 1 fallo;
//   · lineasDeConversacion dejando los pedidos de la bitácora → 1 fallo;
//   · unirTurnos sin sacar los repetidos → 1 fallo;
//   · la marca de la PC sin avanzar (guardarMarcas sin llamar) → 1 fallo.
//   Restaurado de memoria (no con git checkout): 4 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanearTurnos, unirTurnos, type TurnoChat } from '../lib/operaciones-reglas';
import { historialDelChat, lineasDeConversacion, type ChatCentro } from '../lib/centro-chats';

const RAIZ = join(import.meta.dirname, '..');
const CARTERO = join(RAIZ, 'scripts/operaciones/cartero.mjs');

// ── Las líneas de un transcript, como las escribe Claude Code ──
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const at = (min: number) => new Date(Date.UTC(2026, 9, 17, 6, min)).toISOString();
const yo = (texto: string | object[], min: number, extra: object = {}) => JSON.stringify({ type: 'user', uuid: uuid(), timestamp: at(min), message: { role: 'user', content: texto }, ...extra });
const el = (texto: string, min: number, extra: object = {}) => JSON.stringify({ type: 'assistant', uuid: uuid(), timestamp: at(min), message: { role: 'assistant', content: [{ type: 'text', text: texto }] }, ...extra });
const herramienta = (min: number) => JSON.stringify({ type: 'assistant', uuid: uuid(), timestamp: at(min), message: { content: [{ type: 'tool_use', id: 't', name: 'Bash', input: {} }] } });
const resultado = (min: number) => yo([{ type: 'tool_result', tool_use_id: 't', content: 'ok' }], min);
const fin = () => JSON.stringify({ type: 'system', subtype: 'stop_hook_summary' });
const RECORDATORIO = '<system-reminder>\nLinked sessions now: crm = local_x (working)\n</system-reminder>\n';
const TRABAJO = '6b2b7d32-9a51-4e43-9a43-2f3a4b5c6d7e';

test('del transcript sale lo que se le dijo y lo que contestó; lo del sistema, no', async () => {
  const { turnosDeLineas } = await import('../scripts/operaciones/cartero.mjs');
  const lineas = [
    yo(`${RECORDATORIO}Arregla el login, por favor`, 0),
    el('Ahora miro el código del login.', 1), herramienta(1), resultado(2),
    el('Listo: el login ya anda. Lo subí en abc123.', 3), fin(),
    // Un trabajo firmado del Centro, entregado por el Runner: ya se ve como trabajo (lleva su id).
    yo(`<cross-session-message from="local_r" name="Runner">Pedido de Martín desde el Centro de Operaciones (firmado en su dispositivo, 17/10 06:10).\n\nSuma el botón\n\n— Al terminar: node "x" cierre ${TRABAJO} --decidido "…"</cross-session-message>`, 10),
    el('Sumé el botón.', 11), fin(),
    // Otra sesión le escribe.
    yo(`Another Claude session sent a message:\n<cross-session-message from="local_c" name="Cerebro">Punta recibida, sigue con lo del clic.</cross-session-message>\n\nThis came from another Claude session.`, 20),
    el('Sigo con el clic.', 21),
    // Lo del sistema y la app, que no dijo nadie.
    yo('<task-notification>\n<task-id>x</task-id>\n</task-notification>', 22),
    yo(`<cross-session-message from="local_r" name="Runner">Martín contestó tu tarjeta «a-b» en la Ticketera (te avisa el Centro de Operaciones).</cross-session-message>`, 23),
    el("You've hit your session limit · resets 4:50am", 24, { isApiErrorMessage: true }),
    yo('[Image #1]', 25, { isMeta: true }),
  ];
  const r = turnosDeLineas(lineas);
  const ver = r.turnos.map((t: { rol: string; de: string | null; texto: string; trabajo: string | null }) => [t.rol, t.de, t.texto.split('\n')[0], t.trabajo]);
  assert.deepEqual(ver, [
    ['yo', null, 'Arregla el login, por favor', null],
    ['el', null, 'Listo: el login ya anda. Lo subí en abc123.', null],
    ['yo', null, 'Pedido de Martín desde el Centro de Operaciones (firmado en su dispositivo, 17/10 06:10).', TRABAJO],
    ['el', null, 'Sumé el botón.', null],
    ['otro', 'Cerebro', 'Punta recibida, sigue con lo del clic.', null],
    // Un mensaje nuevo cierra el turno de antes, aunque no se muestre (el aviso de la Ticketera).
    ['el', null, 'Sigo con el clic.', null],
  ]);
  assert.equal(r.pendiente, null);
  // Un turno que todavía no terminó (ni fin, ni otro mensaje) queda pendiente para la vuelta que sigue.
  const abierta = turnosDeLineas([yo('Hola', 30), el('Sigo con el clic.', 31)]);
  assert.equal((abierta.pendiente as { texto: string } | null)?.texto, 'Sigo con el clic.', 'el .mjs no tipa la respuesta pendiente');
  assert.deepEqual(abierta.turnos.map((t: { rol: string }) => t.rol), ['yo']);
  const siguiente = turnosDeLineas([fin()], abierta.pendiente);
  assert.deepEqual(siguiente.turnos.map((t: { rol: string; texto: string }) => [t.rol, t.texto]), [['el', 'Sigo con el clic.']]);
  assert.equal(siguiente.pendiente, null);
});

test('lo que llega de la PC se sanea, y unir dos vueltas no repite ni se pasa del tope', () => {
  const t = (i: number, cambio: Partial<TurnoChat> = {}): TurnoChat => ({
    local: 'local_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601', uuid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, rol: 'el', de: null,
    texto: `t${i}`, at: at(i % 60), trabajo: null, ...cambio,
  });
  const sucios = [t(1), { ...t(2), local: 'CRM' }, { ...t(3), rol: 'sistema' }, { ...t(4), texto: '  ' }, { ...t(5), at: 'ayer' }, { ...t(6), texto: 'x'.repeat(5000) }, { ...t(7), de: 'Cerebro' }];
  const limpios = sanearTurnos(sucios);
  assert.deepEqual(limpios.map((x) => x.uuid.slice(-1)), ['1', '6', '7']);
  assert.equal(limpios[1].texto.length, 4000);
  assert.equal(limpios[2].de, null, 'sólo un turno de «otro» lleva quién');
  const unidos = unirTurnos([t(1), t(2)], [t(2), t(3)]);
  assert.deepEqual(unidos.map((x) => x.texto), ['t1', 't2', 't3'], 'el mismo turno subido por dos Runners queda una vez');
  assert.equal(unirTurnos([], Array.from({ length: 80 }, (_, i) => t(i + 1))).length, 60, 'los últimos 60');
});

test('la conversación dibuja los turnos, los trabajos y las respuestas; los hitos de la bitácora no', () => {
  const local = 'local_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601';
  const chat = { clave: 'nombre:crm', miembros: [local], pedidos: ['p1'], trabajos: ['w1'], titulo: 'CRM' } as unknown as ChatCentro;
  const pedido = { id: 'p1', instante: Date.parse(at(1)), texto: 'Algo de la bitácora', titulo: 'Algo', estado: 'hecho', pasos: [], commits: [], pidioEn: { chat: 'CRM' } };
  const trabajo = { id: 'w1', destino: local, destino_titulo: 'CRM', destino_cuenta: 'claude4', created_at: at(2), texto: 'Suma el botón', estado: 'hecho' as const };
  const turnos: TurnoChat[] = [
    { local, uuid: 'u1-00000000', rol: 'yo', de: null, texto: 'Suma el botón', at: at(2), trabajo: 'w1' },
    { local, uuid: 'u2-00000000', rol: 'el', de: null, texto: 'Sumé el botón.', at: at(3), trabajo: null },
    { local: 'local_otro-0000-4000-8000-000000000000', uuid: 'u3-00000000', rol: 'el', de: null, texto: 'De otro chat', at: at(4), trabajo: null },
  ];
  const todas = historialDelChat(chat, new Map([['p1', pedido as never]]), [trabajo], [], turnos);
  assert.ok(todas.some((l) => l.tipo === 'pedido'), 'el Plan sigue leyendo los pedidos');
  const dibuja = lineasDeConversacion(todas);
  assert.deepEqual(dibuja.map((l) => (l.tipo === 'turno' ? `turno:${l.turno.texto}` : l.tipo)), ['trabajo', 'turno:Sumé el botón.'],
    'sin la bitácora, sin el turno del trabajo (ya está con sus ticks) y sin lo de otro chat');
});

test('la PC sube lo nuevo de cada transcript una vez, y lo que sigue en la vuelta siguiente', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'turnos-'));
  const recibido: Array<{ turnos?: Array<{ texto: string; local: string }> }> = [];
  const srv = createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => { recibido.push(JSON.parse(b || '{}')); res.setHeader('content-type', 'application/json'); res.end('{"pedidos":[],"turnosOk":true}'); });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  const cfg = join(dir, 'cfg');
  const sid = '11111111-2222-4333-8444-555555555555';
  mkdirSync(join(cfg, 'sessions'), { recursive: true });
  // El chat y el Runner son de terminal: el proceso de este test hace de los dos (un pid vivo).
  writeFileSync(join(cfg, 'sessions', `${process.pid}.json`), JSON.stringify({ pid: process.pid, sessionId: sid, cwd: 'C:\\dev\\x', entrypoint: 'cli', kind: 'interactive', status: 'idle', name: 'CRM', messagingSocketPath: '\\\\.\\pipe\\x' }));
  const transcript = join(cfg, 'projects', 'C--dev-x', `${sid}.jsonl`);
  mkdirSync(join(cfg, 'projects', 'C--dev-x'), { recursive: true });
  writeFileSync(transcript, [yo('Hola', 0), el('Hola, ¿qué hago?', 1), fin()].join('\n') + '\n');
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ url, token: 'mkop_' + 'x'.repeat(30), cwds: ['C:\\dev\\'], carpetas: {}, carteros: { claude2: { fuentes: [{ fuente: 'cli', configDir: cfg }] } } }));
  const ciclo = () => new Promise<void>((ok, mal) => execFile(process.execPath, [CARTERO, 'ciclo', '--cuenta', 'claude2'],
    { env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfg, CLAUDE_PID: '' } },
    (e, _o, err) => (e ? mal(new Error(err)) : ok())));
  try {
    await ciclo();
    assert.deepEqual(recibido.at(-1)?.turnos?.map((t) => t.texto), ['Hola', 'Hola, ¿qué hago?']);
    assert.equal(recibido.at(-1)?.turnos?.[0].local, `cli_${sid}`);
    await ciclo();
    assert.deepEqual(recibido.at(-1)?.turnos, [], 'nada nuevo: no se vuelve a subir');
    appendFileSync(transcript, [yo('Suma el botón', 5), el('Listo, sumado.', 6), fin()].join('\n') + '\n');
    await ciclo();
    assert.deepEqual(recibido.at(-1)?.turnos?.map((t) => t.texto), ['Suma el botón', 'Listo, sumado.']);
    assert.ok(existsSync(join(dir, 'turnos', `cli_${sid}.json`)), 'la marca de la PC');
    assert.equal(JSON.parse(readFileSync(join(dir, 'turnos', `cli_${sid}.json`), 'utf8')).offset, Buffer.byteLength(readFileSync(transcript)));
  } finally {
    srv.close();
  }
});
