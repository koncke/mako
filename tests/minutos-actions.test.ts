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
import { minutosDeCorrida, resumir, veredicto } from '../scripts/minutos-actions.mjs';

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

test('el veredicto: rojo SÓLO sobre el facturable real de GitHub; sobre la estimación, nunca', () => {
  const base = { estimado: 8678, incluidos: 2000, precio: 0.006, tope: 30, alarma: 80, proyeccion: 0 };
  // El real del 6/11 (US$15,94 del panel ⇒ ~2.657 min pagos + 2.000 incluidos): el 53 % del tope, verde.
  const verde = veredicto({ ...base, real: { ok: true, porWorkflow: [], totalMin: 4657 } });
  assert.equal(verde.codigo, 0);
  assert.ok(verde.lineas.some((l: string) => l.includes('US$15,94')), verde.lineas.join('\n'));
  // Con el real arriba del 80 % del tope sí es rojo: la alarma sirve cuando el gasto es de verdad.
  const rojo = veredicto({ ...base, real: { ok: true, porWorkflow: [], totalMin: 6500 } });
  assert.equal(rojo.codigo, 1);
  assert.ok(rojo.lineas.some((l: string) => l.startsWith('::error::')));
  // Sin el número de GitHub, la estimación de 8.678 min daría US$40 (133 % del tope) y NO da rojo: avisa.
  const sinReal = veredicto({ ...base, real: { ok: false, motivo: 'GitHub 403' } });
  assert.equal(sinReal.codigo, 0, 'una estimación que sobre-cuenta no puede dar rojo');
  assert.ok(sinReal.lineas.some((l: string) => l.startsWith('::warning::') && l.includes('GitHub 403')));
  assert.ok(!sinReal.lineas.some((l: string) => l.startsWith('::error::')));
  // Los minutos incluidos se descuentan: con 2.000 de sobra no cuesta nada.
  assert.equal(veredicto({ ...base, real: { ok: true, porWorkflow: [], totalMin: 1500 } }).codigo, 0);
});

/** Una API de GitHub de mentira: `porDia` corridas por día; un día de más de 1.000 sólo se lee workflow por workflow. */
async function conApi(o: { porDia: Record<string, ReturnType<typeof corrida>[]>; enorme?: string; falla?: boolean; billableMin?: Record<string, number>; timingFalla?: boolean }, fn: (base: string) => Promise<void>) {
  const srv = createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    const dia = u.searchParams.get('created') ?? '';
    const page = Number(u.searchParams.get('page') ?? 1);
    const json = (x: unknown) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(x)); };
    if (o.falla) { res.statusCode = 502; return res.end('mal'); }
    // El facturable REAL que publica GitHub, por workflow (el ciclo en curso).
    const t = /\/actions\/workflows\/(\d+)\/timing$/.exec(u.pathname);
    if (t) {
      if (o.timingFalla) { res.statusCode = 403; return res.end('nada'); }
      const nombre = t[1] === '1' ? 'punta → main' : 'otro';
      return json({ billable: { UBUNTU: { total_ms: (o.billableMin?.[nombre] ?? 0) * 60_000 } } });
    }
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

test('el script contra la API: tabla, un día de más de 1.000 leído workflow por workflow, y el rojo sobre el número de GitHub', async () => {
  const dia1 = Array.from({ length: 1200 }, (_, i) => corrida(i % 2 ? 'otro' : 'punta → main', '2026-11-01', 600));
  const dia2 = [corrida('punta → main', '2026-11-02', 600)];
  const dir = mkdtempSync(join(tmpdir(), 'minutos-'));
  try {
    // La estimación son 12.010 min (US$72,06 sin incluidos): el caso que daba rojo todos los días. El real de GitHub son 2.400.
    await conApi({ porDia: { '2026-11-01': dia1, '2026-11-02': dia2 }, enorme: '2026-11-01', billableMin: { 'punta → main': 2000, otro: 400 } }, async (base) => {
      const resumen = join(dir, 'resumen.md');
      writeFileSync(resumen, '');
      // 2.400 reales − 2.000 incluidos = 400 min × US$0,006 = US$2,40: el 8 % de US$30. VERDE, aunque la estimación diga US$72.
      const verde = await correr(base, ['--alarma', '80', '--resumen', resumen]);
      assert.equal(verde.codigo, 0, verde.salida);
      assert.doesNotMatch(verde.salida, /::error::/);
      assert.match(verde.salida, /Facturable REAL de GitHub \(ciclo en curso\): \*\*2\.400 min\*\* → US\$2,40 de un tope de US\$30,00/);
      assert.match(verde.salida, /\| punta → main \| 601 \|/, 'el día enorme se leyó entero, workflow por workflow');
      assert.match(readFileSync(resumen, 'utf8'), /\| \*\*Total\*\* \| \*\*1201\*\*/);
      assert.match(readFileSync(resumen, 'utf8'), /Min\. facturables REALES/, 'el resumen del vigía trae el número bueno');
      // Con un tope de US$2, los US$2,40 reales son el 120 %: ahí sí es rojo, y lo dice como el número de GitHub.
      const rojo = await correr(base, ['--alarma', '80', '--tope', '2']);
      assert.equal(rojo.codigo, 1, rojo.salida);
      assert.match(rojo.salida, /::error::Actions va en US\$2,40 de US\$2,00 en este ciclo \(120 %, el número de GitHub\)/);
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('sin el facturable real de GitHub, la estimación NO da rojo: avisa', async () => {
  // La estimación son US$72,06 (240 % de US$30) y el /timing da 403: antes del 6/11/2026 esto era el rojo de todos los días.
  await conApi({ porDia: { '2026-11-01': [corrida('punta → main', '2026-11-01', 600)] }, timingFalla: true }, async (base) => {
    const r = await correr(base, ['--alarma', '80', '--incluidos', '0', '--tope', '0.01']);
    assert.equal(r.codigo, 0, r.salida);
    assert.doesNotMatch(r.salida, /::error::/);
    assert.match(r.salida, /::warning::Sólo tengo la ESTIMACIÓN/);
    assert.match(r.salida, /no pude leer el facturable de «punta → main» \(GitHub 403/);
  });
});

test('si la API falla, avisa «no sé» y no da rojo', async () => {
  await conApi({ porDia: {}, falla: true }, async (base) => {
    const r = await correr(base, ['--alarma', '80']);
    assert.equal(r.codigo, 0, r.salida);
    assert.match(r.salida, /::warning::No pude leer las corridas de Actions \(GitHub 502/);
  });
});
