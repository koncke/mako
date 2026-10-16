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

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cuotaDeBarraDeEstado, estadoRunnerUso, sanearCuota, textoReinicio, usoDeCuenta, usoPrincipal, type Cuota } from '../lib/centro-uso';

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

const leerJson = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
