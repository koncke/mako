// =============================================================================
// Un chat maneja el Plan de SU jefe a pedido de Martín, por la PC (cartero 1.15.4, 17/10/2026)
// =============================================================================
// Lo que quedó sin hacer de la D: «tráeme las más prioritarias» o «bórralas» desde un chat, sin que Martín abra el Plan.
// `cartero.mjs plan prioridades` / `plan cerrar #870` → la ruta del cartero (`?plan=1`) → lib/centro-plan-chat.ts. Es una
// puerta NUEVA de la PC a MaKo, así que lo que se fija es lo que la achica:
//   · sólo dos operaciones (leer y cerrar), con una sesión de verdad y un número entero;
//   · la tarea se busca SÓLO entre las abiertas del proyecto del jefe;
//   · el token antes de todo; ni crear, ni borrar, ni escribir el tablero a mano;
//   · la PC manda la sesión del chat que lo corre, con el token, y nada más.
//
// Probado ROMPIÉNDOLO (17/10/2026, base en 4 pases): `sanearPedidoDePlan` aceptando cualquier `op` → 1 fallo; la ruta
// sin mirar el token en `?plan=` → 1 fallo; `planDesdeElChat` sin buscar la sesión en lo que subieron los Runners → 1
// fallo; la PC sin mandar la sesión → 1 fallo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { sanearPedidoDePlan, tareaDelPedido } from '../lib/centro-plan-chat-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const SESION = 'local_33333333-4444-4555-8666-777777777777';

test('sólo «prioridades» o «cerrar #N», con la sesión del chat', () => {
  assert.deepEqual(sanearPedidoDePlan({ op: 'prioridades', sesion: SESION, n: 500 }), { ok: true, op: 'prioridades', sesion: SESION, n: 20 });
  assert.deepEqual(sanearPedidoDePlan({ op: 'cerrar', sesion: SESION, num: '#870', evidencia: ' lo   pidió Martín ' }), { ok: true, op: 'cerrar', sesion: SESION, num: 870, evidencia: 'lo pidió Martín' });
  for (const malo of [{ op: 'borrar', sesion: SESION, num: 1 }, { op: 'crear', sesion: SESION }, { op: 'cerrar', sesion: SESION, num: 'x' }, { op: 'prioridades', sesion: 'cualquiera' }]) {
    assert.equal(sanearPedidoDePlan(malo).ok, false, JSON.stringify(malo));
  }
});

test('la tarea a cerrar se busca SÓLO en el proyecto del jefe', () => {
  const tareas = [{ id: 'a', num: 870, titulo: 'El filtro', proyecto: 'Feature: CRM', prioridad: 'alta', deadline: null, avance: 0 }];
  assert.equal(tareaDelPedido(tareas, 870)?.id, 'a');
  assert.equal(tareaDelPedido(tareas, 871), null, 'un número de otro proyecto no existe para este chat');
});

test('MaKo: el token antes de todo, la sesión tiene que estar en lo que subieron los Runners, y sólo leer o cerrar', () => {
  const ruta = leer('app/api/operaciones/cartero/route.ts');
  const plan = ruta.slice(ruta.indexOf("searchParams.has('plan')"));
  const iToken = plan.indexOf('tokenDelCarteroValido(token)');
  assert.ok(iToken >= 0 && iToken < plan.indexOf('planDesdeElChat('), 'el token primero');
  const lib = leer('lib/centro-plan-chat.ts');
  assert.match(lib, /carteros\.flatMap\(\(k\) => k\.chats\)\.find\(\(c\) => c\.local === p\.sesion\)/);
  assert.match(lib, /proyectoDelChat\(chat\.titulo\)/);
  assert.match(lib, /tareaDelPedido\(plan\.tareas, p\.num\)/);
  assert.doesNotMatch(lib, /proponer_tareas_plan|descartar_borrador|from\('plan_tareas'\)|sumarTareaAlPlan/, 'ni crear ni escribir el tablero a mano');
});

test('la PC manda la sesión del chat que lo corre, con el token del Runner', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-plan-'));
  const recibido: Array<{ url: string; auth: string | undefined; cuerpo: Record<string, unknown> }> = [];
  const srv = createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; }).on('end', () => {
      recibido.push({ url: req.url ?? '', auth: req.headers.authorization, cuerpo: JSON.parse(b || '{}') });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, cerrada: { num: 870, titulo: 'El filtro' } }));
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  try {
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, token: `mkop_${'y'.repeat(30)}`, carteros: {} }));
    const salida = await new Promise<string>((ok, mal) => execFile(process.execPath, [join(RAIZ, 'scripts/operaciones/cartero.mjs'), 'plan', 'cerrar', '#870', '--evidencia', 'lo pidió Martín'], {
      env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CLAUDE_CODE_HOST_SESSION_ID: SESION },
    }, (e, so, se) => (e ? mal(new Error(se || e.message)) : ok(so))));
    assert.equal(JSON.parse(salida).cerrada.num, 870);
    assert.equal(recibido.length, 1);
    assert.match(recibido[0].url, /\?plan=1$/);
    assert.equal(recibido[0].auth, `Bearer mkop_${'y'.repeat(30)}`);
    assert.deepEqual(recibido[0].cuerpo, { op: 'cerrar', sesion: SESION, num: 870, evidencia: 'lo pidió Martín' });
  } finally {
    srv.close();
  }
});
