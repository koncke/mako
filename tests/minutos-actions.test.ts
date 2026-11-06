// =============================================================================
// scripts/minutos-actions.mjs: el desglose de minutos de Actions y la alarma del vigía al 80 % del tope (6/11/2026)
// =============================================================================
// Corre el CÓDIGO: las funciones puras con corridas armadas, y el script entero contra una API de GitHub de mentira (un servidor
// http local en GITHUB_API_URL), con un día de más de 1.000 corridas que se tiene que volver a pedir workflow por workflow.
// PROBADO ROMPIÉNDOLO (6/11/2026; base 4 / 0). Pasan / fallan:
//   · sin el `ms < SIN_JOB_MS` (una corrida salteada cuenta 1 min)              → 2 / 2
//   · `r.pct >= alarma` cambiado por `r.pct > 100` (la alarma recién al tope)    → 3 / 1
//   · sin el pedido workflow por workflow (`continue` siempre)                   → 3 / 1
//   · un error de la API sale con exit 1 (rojo por «no sé»)                      → 3 / 1
// Correr: node --import tsx --test tests/minutos-actions.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { minutosDeCorrida, resumir } from '../scripts/minutos-actions.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(RAIZ, 'scripts', 'minutos-actions.mjs');

/** Una corrida terminada que empezó en `dia` a las 10:00 y duró `seg` segundos. */
const corrida = (name: string, dia: string, seg: number, conclusion = 'success') => {
  const ini = Date.parse(`${dia}T10:00:00Z`);
  return { name, status: 'completed', conclusion, created_at: new Date(ini).toISOString(), run_started_at: new Date(ini).toISOString(), updated_at: new Date(ini + seg * 1000).toISOString() };
};

test('una corrida: reloj y facturable redondeado; salteada, en la cola o sin terminar, 0', () => {
  assert.deepEqual(minutosDeCorrida(corrida('a', '2026-11-01', 125)), { reloj: 125 / 60, facturable: 3, enCurso: false });
  assert.equal(minutosDeCorrida(corrida('a', '2026-11-01', 4)).facturable, 0, 'un job no arranca y termina en 4 s: todos salteados');
  assert.equal(minutosDeCorrida(corrida('a', '2026-11-01', 90, 'skipped')).facturable, 0);
  assert.equal(minutosDeCorrida({ ...corrida('a', '2026-11-01', 90), status: 'in_progress' }).enCurso, true);
});

test('resumir: por workflow, por día, el costo contra el tope y la proyección con el ritmo de los últimos días', () => {
  const runs = [
    corrida('punta → main', '2026-11-04', 600), corrida('punta → main', '2026-11-04', 600), corrida('chequeo sobre main', '2026-11-04', 660),
    corrida('punta → main', '2026-11-05', 600), corrida('después del deploy', '2026-11-05', 3),
    corrida('punta → main', '2026-11-06', 300),
  ];
  const r = resumir(runs, { precio: 0.006, incluidos: 0, tope: 30, hoy: '2026-11-06' });
  assert.deepEqual(r.porWorkflow.map(([w, x]) => [w, x.corridas, x.facturable]), [['punta → main', 4, 35], ['chequeo sobre main', 1, 11], ['después del deploy', 1, 0]]);
  assert.deepEqual(r.porDia.map(([d, x]) => [d, x.facturable]), [['2026-11-04', 31], ['2026-11-05', 10], ['2026-11-06', 5]]);
  assert.equal(r.facturable, 46);
  assert.ok(Math.abs(r.costo - 46 * 0.006) < 1e-9);
  assert.equal(r.ritmoDiario, (31 + 10) / 2, 'los días completos antes de hoy que tienen corridas');
  // Lo hecho antes de hoy (41) + hoy al ritmo (20,5 > 5) + 24 días más al ritmo = 553.
  assert.equal(r.proyeccion.facturable, 41 + 20.5 + 20.5 * 24);
  assert.equal(resumir(runs, { precio: 0.006, incluidos: 100, tope: 30, hoy: '2026-11-06' }).costo, 0, 'con minutos incluidos de sobra, no cuesta');
});

/** Una API de GitHub de mentira: `porDia` corridas por día; un día de más de 1.000 sólo se lee workflow por workflow. */
async function conApi(o: { porDia: Record<string, ReturnType<typeof corrida>[]>; enorme?: string; falla?: boolean }, fn: (base: string) => Promise<void>) {
  const srv = createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    const dia = u.searchParams.get('created') ?? '';
    const page = Number(u.searchParams.get('page') ?? 1);
    const json = (x: unknown) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(x)); };
    if (o.falla) { res.statusCode = 502; return res.end('mal'); }
    if (u.pathname.endsWith('/actions/workflows')) return json({ workflows: [{ id: 1, name: 'punta → main' }, { id: 2, name: 'otro' }] });
    const todas = o.porDia[dia] ?? [];
    const m = /\/actions\/workflows\/(\d+)\/runs$/.exec(u.pathname);
    if (m) {
      const nombre = m[1] === '1' ? 'punta → main' : 'otro';
      const deEse = todas.filter((r) => r.name === nombre);
      return json({ total_count: deEse.length, workflow_runs: deEse.slice((page - 1) * 100, page * 100) });
    }
    // El techo de la API: más de 1.000 devuelve el total real pero sólo los primeros 1.000.
    const total = dia === o.enorme ? 1500 : todas.length;
    return json({ total_count: total, workflow_runs: page > 10 ? [] : todas.slice((page - 1) * 100, Math.min(page * 100, 1000)) });
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  try { await fn(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`); } finally { srv.close(); }
}

function correr(base: string, extra: string[]) {
  return new Promise<{ codigo: number | null; salida: string }>((res) => {
    const p = spawn(process.execPath, [SCRIPT, '--repo', 'koncke/mako', '--desde', '2026-11-01', '--hasta', '2026-11-02', ...extra], {
      env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', GH_TOKEN: 'x', GITHUB_API_URL: base },
    });
    let salida = '';
    p.stdout.on('data', (d) => { salida += d; });
    p.stderr.on('data', (d) => { salida += d; });
    p.on('close', (codigo) => res({ codigo, salida }));
  });
}

test('el script contra la API: tabla, alarma roja al 80 % del tope, y un día de más de 1.000 leído workflow por workflow', async () => {
  const dia1 = Array.from({ length: 1200 }, (_, i) => corrida(i % 2 ? 'otro' : 'punta → main', '2026-11-01', 600));
  const dia2 = [corrida('punta → main', '2026-11-02', 600)];
  const dir = mkdtempSync(join(tmpdir(), 'minutos-'));
  try {
    await conApi({ porDia: { '2026-11-01': dia1, '2026-11-02': dia2 }, enorme: '2026-11-01' }, async (base) => {
      const resumen = join(dir, 'resumen.md');
      writeFileSync(resumen, '');
      // 1.201 corridas × 10 min = 12.010 min × US$0,006 = US$72,06: arriba del 80 % de US$30.
      const rojo = await correr(base, ['--alarma', '80', '--resumen', resumen]);
      assert.equal(rojo.codigo, 1, rojo.salida);
      assert.match(rojo.salida, /::error::Actions va en US\$72,06 de US\$30,00/);
      assert.match(rojo.salida, /\| punta → main \| 601 \|/, 'el día enorme se leyó entero, workflow por workflow');
      assert.match(readFileSync(resumen, 'utf8'), /\| \*\*Total\*\* \| \*\*1201\*\*/);
      // Con un tope de US$85, US$72 es el 85 %: entre el 80 y el 100 también es rojo (la alarma es ANTES del tope).
      assert.equal((await correr(base, ['--alarma', '80', '--tope', '85'])).codigo, 1);
      // Con un tope de US$100, US$72 es el 72 %: sin alarma, pero con el aviso de que el mes cierra arriba del tope.
      const verde = await correr(base, ['--alarma', '80', '--tope', '100']);
      assert.equal(verde.codigo, 0, verde.salida);
      assert.doesNotMatch(verde.salida, /::error::/);
      assert.match(verde.salida, /::warning::Al ritmo de los últimos días/);
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('si la API falla, avisa «no sé» y no da rojo', async () => {
  await conApi({ porDia: {}, falla: true }, async (base) => {
    const r = await correr(base, ['--alarma', '80']);
    assert.equal(r.codigo, 0, r.salida);
    assert.match(r.salida, /::warning::No pude leer las corridas de Actions \(GitHub 502/);
  });
});
