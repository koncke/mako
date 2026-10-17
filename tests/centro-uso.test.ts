// =============================================================================
// El Uso de cada cuenta, siempre a la vista (16/10/2026): lo que, roto, no da error
// =============================================================================
// Martín: «El "Uso" debe ser visible siempre... donde hoy está "Cartero"» y «Falta el poder visualizar el USO». Lo que
// se fija: que un número viejo no se muestra como de ahora (pasado el reinicio no vale), qué número va en el botón, que
// la PC y MaKo leen IGUAL la barra de estado de Claude Code (test diferencial), y que la vuelta del Runner sube la cuota
// de su cuenta, con la semanal de la app cuando es más nueva.
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), contra la base en verde de 7 pases (los primeros):
//   · `usoDeCuenta` sin mirar el reinicio → 2 fallos («un número viejo» y «el botón»: un 99% ya reiniciado ganaba);
//   · `usoPrincipal` quedándose con la primera cuenta y no con la más usada → 1 fallo («el botón»);
//   · la PC leyendo `resets_at` como milisegundos → 1 fallo (el diferencial);
//   · la vuelta sin subir \`uso\` → 1 fallo («la vuelta sube la cuota»).
//   · MaKo guardando la cuota aunque la vuelta no traiga medición → 1 fallo («MaKo guarda la cuota»).
// Y lo que encontró la revisión adversarial, contra la base de 10:
//   · la barra sellando siempre la hora de la corrida → 1 fallo; sin comparar el reinicio de la semanal de la app → 1;
//   · la 5 horas de la terminal viajando siempre con la de la app → 1; el botón sin mirar la edad → 1;
//   · «Runner activo» con sólo visto_at → 1. Restaurado de memoria: 10 pases.
//
// 17/10/2026 (Martín: «Tampoco sale el uso de las otras 2 cuentas, y no sale qué plan tiene, o el uso de 5 horas»): se
// suman 3 tests (el plan, las cuatro cuentas, el desplegable dibujado con renderToStaticMarkup). Contra la base en verde
// de 15 pases (este archivo + tests/runner-cuenta-app.test.ts), una rotura por vez:
//   · `Barra` devolviendo null sin ventana (como antes: la de 5 horas desaparecía) → 1 fallo (el desplegable);
//   · «Medido hace X» sólo si la medición es vieja, sin mirar si el Runner mide en vivo → 1 fallo (el desplegable);
//   · sin el chip del plan → 1 fallo (el desplegable); un punto menos en el botón (`slice(0, 3)`) → 1 (el desplegable);
//   · `cuentasDeUso` devolviendo sólo los carteros → 2 fallos (las cuatro cuentas + el desplegable);
//   · extras ordenadas por texto en vez de por número (claude10 antes que claude5) → 1 fallo (las cuatro cuentas);
//   · `sanearCuota` soltando el plan → 1 fallo (el plan); `sanearPlan` sin limpiar los raros → 1 fallo (el plan);
//   · «Pega su comando en PowerShell» de vuelta en Uso.tsx → 2 fallos (el desplegable + runner-cuenta-app).
//   Restaurado byte a byte (el script lo comprueba en un finally): 15 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cuentasDeUso, cuotaDeBarraDeEstado, estadoRunnerUso, PLAN_MAX, sanearCuota, sanearPlan, textoReinicio, usoDeCuenta, usoPrincipal, type Cuota } from '../lib/centro-uso';
import { BotonUso, ListaUso } from '../app/admin/operaciones/Uso';

const RAIZ = join(import.meta.dirname, '..');
const CARTERO = join(RAIZ, 'scripts/operaciones/cartero.mjs');
// 16/10/2026 a las 10:00 de Argentina.
const AHORA = Date.parse('2026-10-16T13:00:00Z');
const cuota = (p: Partial<Cuota> = {}): Cuota => ({
  cinco: { pct: 12, reinicia: '2026-10-16T17:00:00Z' }, semana: { pct: 47, reinicia: '2026-10-21T09:00:00Z' }, medido: '2026-10-16T12:55:00Z', ...p,
});

test('lo que sube un Runner se sanea: porcentajes acotados, fechas que son fechas, y nada si no midió', () => {
  assert.deepEqual(sanearCuota({ cinco: { pct: 12.4, reinicia: '2026-10-16T17:00:00Z' }, semana: { pct: 130 }, medido: '2026-10-16T12:55:00Z' }), {
    cinco: { pct: 12, reinicia: '2026-10-16T17:00:00.000Z' }, semana: { pct: 100, reinicia: null }, medido: '2026-10-16T12:55:00.000Z',
  });
  assert.equal(sanearCuota({ cinco: null, semana: null, medido: '2026-10-16T12:55:00Z' }), null, 'sin ventanas no hay cuota');
  assert.equal(sanearCuota({ semana: { pct: 10 }, medido: 'ayer' }), null, 'sin fecha de medición, no');
  assert.equal(sanearCuota('47%'), null);
});

test('un número viejo no se muestra como de ahora: pasado el reinicio no vale, y la medición vieja lleva su edad', () => {
  const u = usoDeCuenta(cuota(), AHORA);
  assert.equal(u.cinco?.pct, 12);
  assert.equal(u.semana?.pct, 47);
  assert.equal(u.viejo, false);
  const despues = usoDeCuenta(cuota(), Date.parse('2026-10-16T17:30:00Z'));
  assert.equal(despues.cinco?.pct, null, 'la ventana de 5 horas ya se reinició');
  assert.equal(despues.cinco?.reinicio, true);
  assert.equal(despues.semana?.pct, 47);
  assert.equal(despues.viejo, true, 'medido hace más de 30 minutos');
  assert.deepEqual(usoDeCuenta(null, AHORA), { cinco: null, semana: null, medido: null, viejo: true });
});

test('el botón muestra la semana MÁS usada entre las cuentas con un dato vigente', () => {
  const cuentas = [
    { cuenta: 'claude1', cuota: cuota({ semana: { pct: 30, reinicia: '2026-10-21T09:00:00Z' } }) },
    { cuenta: 'claude2', cuota: null },
    { cuenta: 'claude3', cuota: cuota({ semana: { pct: 71, reinicia: '2026-10-21T09:00:00Z' } }) },
    { cuenta: 'claude4', cuota: cuota({ semana: { pct: 99, reinicia: '2026-10-15T09:00:00Z' } }) },
  ];
  assert.deepEqual(usoPrincipal(cuentas, AHORA), { cuenta: 'claude3', pct: 71, viejo: false, medido: Date.parse('2026-10-16T12:55:00Z') }, 'la de 99% ya se reinició: no cuenta');
  assert.equal(usoPrincipal([{ cuenta: 'claude2', cuota: null }], AHORA), null);
  // Una medida hace tres días no le gana a una de recién, aunque diga más (revisión adversarial, 16/10/2026).
  const vieja = { cuenta: 'claude1', cuota: cuota({ semana: { pct: 85, reinicia: '2026-10-21T09:00:00Z' }, medido: '2026-10-13T12:00:00Z' }) };
  assert.equal(usoPrincipal([vieja, cuentas[2]], AHORA)?.cuenta, 'claude3');
  // Y si sólo hay viejas, sale con su edad.
  const sola = usoPrincipal([vieja], AHORA);
  assert.equal(sola?.viejo, true);
  assert.equal(sola?.medido, Date.parse('2026-10-13T12:00:00Z'));
});

test('el Runner del Uso: activo sólo si su terminal mide; si otro Runner recorre la cuenta, se dice', () => {
  // El Runner de ~/.claude pasa por las tres cuentas y les refresca visto_at: con sólo eso, la cuenta 2 salía «activa»
  // aunque su terminal no tuviera Runner, y su Uso no se medía nunca (revisión adversarial, 16/10/2026).
  assert.equal(estadoRunnerUso(true, cuota(), AHORA), 'mide');
  assert.equal(estadoRunnerUso(true, null, AHORA), 'sin_terminal');
  assert.equal(estadoRunnerUso(true, cuota({ cinco: null }), AHORA), 'sin_terminal', 'la de la app sola sólo trae la semanal');
  assert.equal(estadoRunnerUso(true, cuota({ medido: '2026-10-16T10:00:00Z' }), AHORA), 'sin_terminal', 'medido hace tres horas: no está midiendo');
  assert.equal(estadoRunnerUso(false, cuota(), AHORA), 'apagado');
});

test('cuándo se reinicia, con el reloj de Martín: hoy, mañana o el día', () => {
  assert.equal(textoReinicio(Date.parse('2026-10-16T17:00:00Z'), AHORA), 'a las 14:00');
  assert.equal(textoReinicio(Date.parse('2026-10-17T09:00:00Z'), AHORA), 'mañana a las 06:00');
  assert.match(textoReinicio(Date.parse('2026-10-21T09:00:00Z'), AHORA), /^el mié 21 a las 06:00$/);
  assert.equal(textoReinicio(null, AHORA), '');
});

test('la PC y MaKo leen IGUAL la barra de estado de Claude Code (resets_at en segundos)', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs') as { cuotaDeBarraDeEstado: (x: unknown, ahora: number) => unknown };
  const casos: unknown[] = [
    { rate_limits: { five_hour: { used_percentage: 12.6, resets_at: 1760634000 }, seven_day: { used_percentage: 47, resets_at: 1761037200 } } },
    { rate_limits: { seven_day: { used_percentage: 101 } } },
    { rate_limits: { five_hour: { used_percentage: 'mucho' } } },
    { rate_limits: null },
    { model: { id: 'x' } },
    null,
  ];
  for (const c of casos) assert.deepEqual(cartero.cuotaDeBarraDeEstado(c, AHORA), cuotaDeBarraDeEstado(c, AHORA), JSON.stringify(c));
  assert.deepEqual(cuotaDeBarraDeEstado(casos[0], AHORA), {
    cinco: { pct: 13, reinicia: new Date(1760634000 * 1000).toISOString() },
    semana: { pct: 47, reinicia: new Date(1761037200 * 1000).toISOString() },
    medido: new Date(AHORA).toISOString(),
  });
});

test('la vuelta sube la cuota: la barra de estado anota la de su terminal, y la semanal de la app gana si es más nueva', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-uso-'));
  const cfg = join(dir, 'cfg-b');
  const vivo: ChildProcess = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1e6)'], { stdio: 'ignore' });
  const recibido: Array<Record<string, unknown>> = [];
  const srv = createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d; }).on('end', () => {
      recibido.push(JSON.parse(b));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ pedidos: [], avisos: [], vencidos: 0, acuses: 0, cierres: 0, cierresIds: [] }));
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  const env = { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfg, CLAUDE_PID: String(vivo.pid), CARTERO_HOME: dir };
  try {
    mkdirSync(join(cfg, 'sessions'), { recursive: true });
    writeFileSync(join(cfg, 'sessions', `${vivo.pid}.json`), JSON.stringify({ pid: vivo.pid, sessionId: '00000000-2222-4333-8444-555555555555', cwd: 'C:\\dev\\x', entrypoint: 'cli', kind: 'interactive', name: 'Runner', messagingSocketPath: 'x' }));
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, token: 'mkop_' + 'x'.repeat(30), cwds: ['C:\\dev\\'], carpetas: {},
      carteros: { claude2: { fuentes: [{ fuente: 'cli', configDir: cfg }] } },
    }));
    // La barra de estado del Runner: Claude Code le pasa la cuota por stdin y ella devuelve su línea.
    const linea = await new Promise<string>((ok, mal) => {
      const p = execFile(process.execPath, [CARTERO, 'uso'], { env }, (e, so, se) => (e ? mal(new Error(se || e.message)) : ok(so)));
      p.stdin!.end(JSON.stringify({ rate_limits: { five_hour: { used_percentage: 12, resets_at: 1760634000 }, seven_day: { used_percentage: 47, resets_at: 1761037200 } } }));
    });
    assert.match(linea, /Runner de la cuenta 2 · 5 h 12% · semana 47%/);
    assert.equal(leerJson(join(dir, 'uso', 'claude2.json')).semana.pct, 47);
    // La semanal de la app (get_usage, ~/.claude/uso-semanal.txt), más nueva y de esta cuenta: gana.
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'uso-semanal.txt'), `52 2026-10-21T09:00:00Z ${new Date(Date.now() + 60_000).toISOString()} claude2\n`);
    await new Promise<void>((ok, mal) => execFile(process.execPath, [CARTERO, 'ciclo'], { env }, (e, _so, se) => (e ? mal(new Error(se || e.message)) : ok())));
    const uso = recibido[0].uso as Cuota;
    assert.equal(uso.cinco?.pct, 12, 'la de 5 horas, de la barra de estado');
    assert.equal(uso.semana?.pct, 52, 'la semanal, de la app (más nueva)');
  } finally {
    vivo.kill(); srv.close();
  }
});

test('MaKo guarda la cuota que sube el Runner, y una vuelta sin medición no borra la anterior', () => {
  const src = readFileSync(join(RAIZ, 'lib/operaciones.ts'), 'utf8');
  assert.ok(src.includes('const cuota = sanearCuota(e.uso);'), 'lo que sube se sanea');
  assert.ok(src.includes('...(cuota ? { cuota } : {})'), 'sin medición, la columna no se toca');
  assert.ok(src.includes("select('cuenta, visto_at, version, chats, claves, cuota')"), 'se lee');
  assert.ok(src.includes('cuota: sanearCuota(f.cuota)'), 'lo que se lee también se sanea');
});

/** Una PC de prueba con la cuenta 2 en su terminal, su Runner «vivo» y un servidor que anota lo que sube. */
async function pcDeUso() {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-uso2-'));
  const cfg = join(dir, 'cfg-b');
  const vivo: ChildProcess = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1e6)'], { stdio: 'ignore' });
  const recibido: Array<Record<string, unknown>> = [];
  const srv = createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d; }).on('end', () => {
      recibido.push(JSON.parse(b));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ pedidos: [], avisos: [], vencidos: 0, acuses: 0, cierres: 0, cierresIds: [] }));
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  mkdirSync(join(cfg, 'sessions'), { recursive: true });
  writeFileSync(join(cfg, 'sessions', `${vivo.pid}.json`), JSON.stringify({ pid: vivo.pid, sessionId: '00000000-2222-4333-8444-555555555555', cwd: 'C:\\dev\\x', entrypoint: 'cli', kind: 'interactive', name: 'Runner', messagingSocketPath: 'x' }));
  writeFileSync(join(dir, 'config.json'), JSON.stringify({
    url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, token: 'mkop_' + 'x'.repeat(30), cwds: ['C:\\dev\\'], carpetas: {},
    carteros: { claude2: { fuentes: [{ fuente: 'cli', configDir: cfg }] } },
  }));
  const env = { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfg, CLAUDE_PID: String(vivo.pid), CARTERO_HOME: dir };
  const correr = (args: string[], entrada?: string) => new Promise<string>((ok, mal) => {
    const p = execFile(process.execPath, [CARTERO, ...args], { env }, (e, so, se) => (e ? mal(new Error(se || e.message)) : ok(so)));
    p.stdin!.end(entrada ?? '');
  });
  return { dir, recibido, correr, cerrar: () => { vivo.kill(); srv.close(); } };
}

test('la barra no re-sella un número que no cambió: la edad de la cuota es la de la última observación', async () => {
  // Revisión adversarial (16/10/2026): la barra corre cada minuto aunque no llegue ninguna respuesta de la API; con la hora
  // de cada corrida, un Runner que dejó de dar vueltas seguía mostrando su número como de ahora.
  // Probado rompiéndolo: guardando siempre la hora de la corrida, falla «el mismo número y la misma charla».
  const pc = await pcDeUso();
  try {
    const barra = (api: number) => JSON.stringify({ cost: { total_api_duration_ms: api }, rate_limits: { five_hour: { used_percentage: 12, resets_at: 1792000000 }, seven_day: { used_percentage: 47, resets_at: 1792400000 } } });
    await pc.correr(['uso'], barra(5000));
    const primero = leerJson(join(pc.dir, 'uso', 'claude2.json')).medido;
    await new Promise((r) => setTimeout(r, 25));
    await pc.correr(['uso'], barra(5000));
    assert.equal(leerJson(join(pc.dir, 'uso', 'claude2.json')).medido, primero, 'el mismo número y la misma charla: la misma edad');
    await new Promise((r) => setTimeout(r, 25));
    await pc.correr(['uso'], barra(6200));
    assert.notEqual(leerJson(join(pc.dir, 'uso', 'claude2.json')).medido, primero, 'habló con la API: es una observación nueva');
  } finally {
    pc.cerrar();
  }
});

test('la semanal de la app: una de otra cuenta no se usa, y con ella no viaja una 5 horas vieja', async () => {
  // Revisión adversarial (16/10/2026): el 4º campo de uso-semanal.txt lo pone el marcador de cuenta, que puede estar
  // atrasado; y al ganar la semanal de la app, la 5 horas de la terminal (vieja) salía con la fecha de la app.
  // Probado rompiéndolo: sin comparar el reinicio, sube el 5% de otra cuenta; conservando la 5 horas siempre, viaja la vieja.
  const pc = await pcDeUso();
  try {
    const ahora = Date.now();
    const terminal = { cinco: { pct: 40, reinicia: new Date(ahora + 2 * 3600_000).toISOString() }, semana: { pct: 88, reinicia: '2027-01-06T09:00:00.000Z' }, medido: new Date(ahora - 2 * 3600_000).toISOString() };
    mkdirSync(join(pc.dir, 'uso'), { recursive: true });
    writeFileSync(join(pc.dir, 'uso', 'claude2.json'), JSON.stringify(terminal));
    mkdirSync(join(pc.dir, '.claude'), { recursive: true });
    // Otra cuenta (se reinicia otro día) con el marcador atrasado: no se usa.
    writeFileSync(join(pc.dir, '.claude', 'uso-semanal.txt'), `5 2027-01-03T09:00:00Z ${new Date(ahora).toISOString()} claude2\n`);
    await pc.correr(['ciclo']);
    assert.equal((pc.recibido[0].uso as Cuota).semana?.pct, 88, 'el 5% es de otra cuenta');
    // La de esta cuenta, medida ahora: gana, y la 5 horas de hace dos horas no viaja con su fecha.
    writeFileSync(join(pc.dir, '.claude', 'uso-semanal.txt'), `90 2027-01-06T09:00:00Z ${new Date(ahora).toISOString()} claude2\n`);
    await pc.correr(['ciclo']);
    const uso = pc.recibido[1].uso as Cuota;
    assert.equal(uso.semana?.pct, 90);
    assert.equal(uso.cinco, null, 'la 5 horas era de hace dos horas');
  } finally {
    pc.cerrar();
  }
});

test('el plan de la cuenta se sanea: texto corto, sin caracteres raros; sin plan, la cuota no trae la clave', () => {
  assert.equal(sanearPlan('Max 5x'), 'Max 5x');
  assert.equal(sanearPlan('  max \n  20x\t'), 'max 20x', 'espacios y saltos, a uno');
  assert.equal(sanearPlan('Máx+'), 'Máx+', 'acentos, «+» y «-» pasan');
  assert.equal(sanearPlan('Pro\u0000​'), 'Pro', 'caracteres de control o invisibles, afuera');
  assert.doesNotMatch(sanearPlan('<img src=x onerror=1>') ?? '', /[<>=]/, 'ninguna etiqueta');
  assert.ok((sanearPlan('x'.repeat(100)) ?? '').length <= PLAN_MAX, 'corto');
  for (const nada of [5, null, undefined, {}, '', '   ', '***']) assert.equal(sanearPlan(nada), null, JSON.stringify(nada));
  // En la cuota: viaja saneado, y sin plan (o con uno que no vale) la clave no existe (la PC arma la suya sin ella).
  assert.equal(sanearCuota({ ...cuota(), plan: ' Max ' })?.plan, 'Max');
  assert.equal('plan' in (sanearCuota(cuota()) ?? {}), false);
  assert.equal('plan' in (sanearCuota({ ...cuota(), plan: 5 }) ?? {}), false);
});

test('las cuatro cuentas salen siempre y en orden, con o sin Runner', () => {
  // Martín (17/10/2026): «Tampoco sale el uso de las otras 2 cuentas». La lista salía de los carteros: sin Runner, la cuenta no existía.
  const vacia = cuentasDeUso([]);
  assert.deepEqual(vacia.map((c) => c.cuenta), ['claude1', 'claude2', 'claude3', 'claude4']);
  for (const c of vacia) assert.deepEqual({ v: c.vistoAt, q: c.cuota }, { v: null, q: null }, `${c.cuenta} sin Runner`);
  const visto = '2026-10-16T12:59:30Z';
  const hay = cuentasDeUso([{ cuenta: 'claude4', vistoAt: visto, cuota: cuota() }, { cuenta: 'claude2', vistoAt: visto }]);
  assert.deepEqual(hay.map((c) => c.cuenta), ['claude1', 'claude2', 'claude3', 'claude4'], 'en orden aunque lleguen desordenadas');
  assert.deepEqual(hay[1], { cuenta: 'claude2', vistoAt: visto, cuota: null }, 'sin `cuota` en el Runner: null, no undefined');
  assert.equal(hay[3].cuota?.semana?.pct, 47);
  assert.equal(hay[0].vistoAt, null);
  // Un Runner de una cuenta que el registro no conoce no se pierde: va al final, por número (no por texto).
  const raras = cuentasDeUso([{ cuenta: 'claude10', vistoAt: visto }, { cuenta: 'claude5', vistoAt: visto }]);
  assert.deepEqual(raras.map((c) => c.cuenta), ['claude1', 'claude2', 'claude3', 'claude4', 'claude5', 'claude10']);
  assert.deepEqual(cuentasDeUso([], ['claude9']).map((c) => c.cuenta), ['claude9'], 'la lista de cuentas se puede dar');
});

/** Lo que se lee de cada cuenta del desplegable, en texto plano (una entrada por cuenta). */
const tarjetas = (h: string) => h.split('<section').slice(1).map((s) => `<section${s}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());

test('el desplegable: las cuatro cuentas, su plan, las dos ventanas, «Medido hace X» y ningún comando', () => {
  const visto = '2026-10-16T12:59:30Z';
  const cuentas = cuentasDeUso([
    // 1: Runner de su terminal midiendo, medición de hace 5 minutos, con plan.
    { cuenta: 'claude1', vistoAt: visto, cuota: cuota({ plan: 'Max' }) },
    // 2: Runner declarado pero apagado hace 4 horas; la medición, de hace 3 horas.
    { cuenta: 'claude2', vistoAt: '2026-10-16T09:00:00Z', cuota: cuota({ medido: '2026-10-16T10:00:00Z' }) },
    // 4: la de la app: otro Runner la recorre pero sólo trae la semanal (sin 5 horas), de hace 5 minutos.
    { cuenta: 'claude4', vistoAt: visto, cuota: cuota({ cinco: null, plan: 'Max 20x' }) },
  ]);
  const h = renderToStaticMarkup(createElement(ListaUso, { cuentas, ahora: AHORA }));
  const t = tarjetas(h);
  assert.equal(t.length, 4, 'las cuatro cuentas');
  assert.deepEqual(t.map((x) => x.slice(0, 8)), ['Cuenta 1', 'Cuenta 2', 'Cuenta 3', 'Cuenta 4'], 'en orden 1-4');
  // 1: vivo y al día: plan, las dos ventanas con su reinicio, y NADA de «Medido» (está midiendo en vivo).
  assert.match(t[0], /^Cuenta 1 Max Runner activo Sesión de 5 horas 12% usado Se reinicia a las 14:00 Semana 47% usado Se reinicia el mié 21 a las 06:00$/);
  // 2: Runner apagado: dice hace cuánto y cuándo se midió, con las dos ventanas.
  assert.match(t[1], /Runner sin conexión · hace 4 h/);
  assert.match(t[1], /Sesión de 5 horas 12% usado/);
  assert.match(t[1], /Semana 47% usado/);
  assert.match(t[1], /Medido hace 3 h$/);
  assert.doesNotMatch(t[1], /Max/, 'sin plan en la cuota, no se muestra ninguno');
  // 3: sin Runner ni cuota: lo dice en pocas palabras, sin botón.
  assert.equal(t[2], 'Cuenta 3 Sin Runner todavía Su uso aparece cuando su Runner esté conectado');
  // 4: la ventana de 5 horas NO desaparece: dice «Sin medir». Y como no mide en vivo, lleva «Medido hace 5 min» aunque sea de recién.
  assert.match(t[3], /^Cuenta 4 Max 20x Sin el Runner de su terminal/);
  assert.match(t[3], /Sesión de 5 horas Sin medir Semana 47% usado/);
  assert.match(t[3], /Medido hace 5 min$/);
  // Ningún comando ni botón de copiar (Martín: «no quiero copiar en PowerShell, que se instale todo solo»).
  assert.doesNotMatch(h, /PowerShell|<button|Copiar|comando/i);
  // El botón cerrado: un punto por cuenta (cuatro) y el conteo sobre las cuatro.
  const boton = renderToStaticMarkup(createElement(BotonUso, { cuentas, ahora: AHORA, onRunners: () => {}, onNuevo: () => {} }));
  assert.equal((boton.match(/co-punto /g) ?? []).length, 4);
  assert.match(boton, /title="1 de 4 Runners activos"/);
});

const leerJson = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
