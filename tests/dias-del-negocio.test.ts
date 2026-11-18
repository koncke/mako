// =============================================================================
// «Hoy», «ayer», «el lunes» y «el primero del mes» son los del NEGOCIO (F125, 18/11/2026)
// =============================================================================
// Las primitivas de fecha (`hoyEnTijuana`, `ayerEnTijuana`, `lunesActualEnTijuana`, `primerDiaDelMesEnTijuana`) tenían la
// zona clavada en Tijuana, y ~85 llamadas las usaban para TODOS los negocios. Acá se prueba, corriendo el código:
//   1. las versiones puras por zona (lib/date-utils.ts) y que las de Tijuana son ésas con la zona puesta;
//   2. las versiones por negocio de lib/timezone.ts (`diasDelNegocio(ws)`, `diasDelNegocioEstricto(ws)`,
//      `diasEnWorkspace()`, `ayer/lunes/primerDiaDelMesEnWorkspaceEstricto()`), con una base de mentira;
//   3. que «A revisar», la ficha y el worklist (`faltantesDeLead`) cuentan con el día que les PASA quien llama;
//   4. que el reporte del día y el semanal de un negocio en Madrid cortan con SUS días, no con los de Tijuana.
//
// El borde que importa es el de la tarde/noche en América: a las 19:30 de Tijuana ya es el día siguiente en Madrid (y
// cerca de la medianoche, en Buenos Aires). Es justo la franja en que «hoy» de Tijuana es AYER para otro negocio.
//
// Correr: node --import tsx --test tests/dias-del-negocio.test.ts
//
// Probado rompiéndolo (18/11/2026, un arnés que restaura de memoria), una rotura por vez; base 5 pasan / 0 fallan:
//   R1. `diasEnTz` con `ayer: hoy` (sin restar el día)                         → 2 / 3 («las cuatro fechas…», «las de Tijuana…», «por negocio…»)
//   R2. `diasDelNegocioEstricto` con `zonaDelNegocio` (la tolerante)           → 4 / 1 («por negocio…»: la estricta no tiró)
//   R3. `diasEnWorkspaceEstricto` con `ws ?? 1` en vez de tirar sin negocio     → 4 / 1 («por negocio…»)
//   R4. `requisitosDeLead` con el «hoy» de Tijuana adentro otra vez            → 4 / 1 («A revisar cuenta…»)
//   R5. `buildReporteSemanal` con `lunesActualEnTijuana()` otra vez            → 4 / 1 («el reporte…»)
//   R6. `buildReporteDiario` con `hoyEnTijuana()` otra vez                     → 4 / 1 («el reporte…»)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import Module from 'node:module';
import {
  ayerEnTijuana, ayerEnTz, diasEnTz, hoyEnTijuana, hoyEnTz, lunesActualEnTijuana, lunesEnTz,
  primerDiaDelMesEnTijuana, primerDiaDelMesEnTz,
} from '../lib/date-utils';
import { DEFAULT_PIPELINE, generateFunnel } from '../lib/pipeline';
import type { Lead } from '../lib/leads';

const raiz = join(__dirname, '..');

// 2026-11-18 03:30 UTC: martes 17 a las 19:30 en Tijuana (PST), miércoles 18 a las 04:30 en Madrid, 00:30 en Buenos Aires.
const NOCHE_TJ = new Date('2026-11-18T03:30:00Z');
// 2026-12-01 05:00 UTC: lunes 30/11 21:00 en Tijuana, martes 1/12 en Madrid y Buenos Aires (otro MES).
const FIN_DE_MES = new Date('2026-12-01T05:00:00Z');

test('las cuatro fechas de una zona salen de UNA lectura del reloj y no se contradicen', () => {
  assert.deepEqual(diasEnTz('America/Tijuana', NOCHE_TJ), {
    tz: 'America/Tijuana', hoy: '2026-11-17', ayer: '2026-11-16', lunes: '2026-11-16', primerDiaDelMes: '2026-11-01',
  });
  assert.deepEqual(diasEnTz('Europe/Madrid', NOCHE_TJ), {
    tz: 'Europe/Madrid', hoy: '2026-11-18', ayer: '2026-11-17', lunes: '2026-11-16', primerDiaDelMes: '2026-11-01',
  });
  assert.equal(hoyEnTz('America/Argentina/Buenos_Aires', NOCHE_TJ), '2026-11-18', 'en Buenos Aires ya es miércoles');
  // El borde de mes: en Tijuana todavía es noviembre, en Buenos Aires ya diciembre.
  assert.deepEqual(diasEnTz('America/Tijuana', FIN_DE_MES), {
    tz: 'America/Tijuana', hoy: '2026-11-30', ayer: '2026-11-29', lunes: '2026-11-30', primerDiaDelMes: '2026-11-01',
  });
  assert.deepEqual(diasEnTz('America/Argentina/Buenos_Aires', FIN_DE_MES), {
    tz: 'America/Argentina/Buenos_Aires', hoy: '2026-12-01', ayer: '2026-11-30', lunes: '2026-11-30', primerDiaDelMes: '2026-12-01',
  });
  // Los sueltos dan lo mismo que el registro.
  assert.equal(ayerEnTz('Europe/Madrid', NOCHE_TJ), '2026-11-17');
  assert.equal(lunesEnTz('Europe/Madrid', FIN_DE_MES), '2026-11-30');
  assert.equal(primerDiaDelMesEnTz('America/Argentina/Buenos_Aires', FIN_DE_MES), '2026-12-01');
});

test('las de Tijuana son las por zona con Tijuana puesta (no una segunda cuenta)', () => {
  for (const d of [NOCHE_TJ, FIN_DE_MES, new Date('2026-03-08T10:30:00Z'), new Date('2026-11-01T09:30:00Z')]) {
    const tj = diasEnTz('America/Tijuana', d);
    assert.equal(hoyEnTijuana(d), tj.hoy);
    assert.equal(ayerEnTijuana(d), tj.ayer);
    assert.equal(lunesActualEnTijuana(d), tj.lunes);
    assert.equal(primerDiaDelMesEnTijuana(d), tj.primerDiaDelMes);
  }
});

// ── lib/timezone.ts de VERDAD (server-only), en un node aparte con la base de mentira ─────────────────────────────
// ws 1: sin zona guardada (el default, Tijuana) · ws 2: Europe/Madrid · ws 3: la lectura de app_settings FALLA.

/** Corre `cuerpo` en un node aparte con lib/supabase.ts devolviendo la base de mentira, y devuelve lo que imprime. */
function enNodeAparte(cuerpo: string, ahora?: Date): unknown {
  const url = (rel: string): string => JSON.stringify(pathToFileURL(join(raiz, rel)).href);
  const codigo = `
import { mock } from 'node:test';
${ahora ? `mock.timers.enable({ apis: ['Date'], now: ${ahora.getTime()} });` : ''}
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const ZONAS = { 1: null, 2: 'Europe/Madrid' };
const db = { from: () => ({ select: () => ({ eq: (_c, ws) => ({ in: async () => (
  ws === 3 ? { data: null, error: { message: 'la base no contesta' } }
    : { data: ZONAS[ws] ? [{ key: 'mako.timezone', value: ZONAS[ws], updated_at: '2026-11-01T00:00:00Z' }] : [], error: null }
) }) }) }) };
const sb = await import(${url('lib/supabase.ts')});
mock.module(${url('lib/supabase.ts')}, { exports: { ...real(sb), getSupabaseServer: () => db } });
const tz = await import(${url('lib/timezone.ts')});
const { runWithWorkspace } = await import(${url('lib/workspace.ts')});
const tira = async (f) => { try { await f(); return 'no tiró'; } catch (e) { return 'tiró'; } };
const out = await (async () => { ${cuerpo} })();
console.log('@@' + JSON.stringify(out));
`;
  const salida = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
  const linea = salida.split('\n').reverse().find((l) => l.startsWith('@@'));
  assert.ok(linea, `el node aparte no devolvió nada:\n${salida.slice(-2000)}`);
  return JSON.parse(linea.slice(2));
}

test('por negocio: ws EXPLÍCITO para un cron, el del contexto para un request; la estricta TIRA y la tolerante cae al default', () => {
  const r = enNodeAparte(`
    const d = new Date(${NOCHE_TJ.getTime()});
    const fm = new Date(${FIN_DE_MES.getTime()});
    return {
      madrid: await tz.diasDelNegocio(2, d),
      sinZona: await tz.diasDelNegocio(1, d),
      caidaTolerante: await tz.diasDelNegocio(3, d),
      caidaEstricta: await tira(() => tz.diasDelNegocioEstricto(3, d)),
      madridEstricto: await tz.diasDelNegocioEstricto(2, d),
      ctxAyer: await runWithWorkspace(2, () => tz.ayerEnWorkspaceEstricto(d)),
      ctxLunes: await runWithWorkspace(2, () => tz.lunesEnWorkspaceEstricto(fm)),
      ctxPrimero: await runWithWorkspace(2, () => tz.primerDiaDelMesEnWorkspaceEstricto(fm)),
      ctxPrimeroTj: await runWithWorkspace(1, () => tz.primerDiaDelMesEnWorkspaceEstricto(fm)),
      ctxTolerante: await runWithWorkspace(2, () => tz.diasEnWorkspace(d)),
      sinNegocioEstricto: await runWithWorkspace(null, () => tira(() => tz.diasEnWorkspaceEstricto(d))),
      sinNegocioTolerante: await runWithWorkspace(null, () => tz.diasEnWorkspace(d)),
      ctxCaidoEstricto: await runWithWorkspace(3, () => tira(() => tz.ayerEnWorkspaceEstricto(d))),
    };
  `) as Record<string, unknown>;
  assert.deepEqual(r.madrid, diasEnTz('Europe/Madrid', NOCHE_TJ), 'un negocio en Madrid cuenta SUS días');
  assert.deepEqual(r.sinZona, diasEnTz('America/Tijuana', NOCHE_TJ), 'sin zona guardada, el default de siempre');
  assert.deepEqual(r.caidaTolerante, diasEnTz('America/Tijuana', NOCHE_TJ), 'la tolerante, con la base caída, cae al default');
  assert.equal(r.caidaEstricta, 'tiró', 'la estricta TIRA con la base caída: no decide con el día de otro negocio');
  assert.deepEqual(r.madridEstricto, diasEnTz('Europe/Madrid', NOCHE_TJ));
  assert.equal(r.ctxAyer, '2026-11-17', 'el ayer del negocio del contexto (en Tijuana todavía sería el 16)');
  assert.equal(r.ctxLunes, '2026-11-30');
  assert.equal(r.ctxPrimero, '2026-12-01', 'en Madrid ya es diciembre');
  assert.equal(r.ctxPrimeroTj, '2026-11-01', 'en Tijuana todavía es noviembre');
  assert.deepEqual(r.ctxTolerante, diasEnTz('Europe/Madrid', NOCHE_TJ));
  assert.equal(r.sinNegocioEstricto, 'tiró', 'sin negocio en contexto, la estricta no adivina de quién es el día');
  assert.deepEqual(r.sinNegocioTolerante, diasEnTz('America/Tijuana', NOCHE_TJ), 'la tolerante sin negocio, el default (como hoyEnWorkspace)');
  assert.equal(r.ctxCaidoEstricto, 'tiró');
});

// ── «A revisar», la ficha y el worklist cuentan con el día que les pasan ─────────────────────────────────────────────
// lib/leads.ts es `server-only`: se neutraliza el marcador (como tests/mover-etapa-validacion.test.ts). La función que se
// prueba es pura.
type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;

const DEFAULT_STAGES = generateFunnel(DEFAULT_PIPELINE, []).stages;
const L = (p: Partial<Lead>): Lead => ({
  id: 1, nombre: 'Lead', email: null, telefono: null, empresa: null,
  fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null, junta_1_at: null, junta_2_at: null,
  asistio_j1: null, asistio_j2: null, calificado: null, cerro: null,
  estado_lead: 'abierto', motivo_perdida: null,
  monto_cierre_usd: null, fecha_cierre: null,
  pipeline_stage: 'agenda', nutricion_realizada: false, fathom_links: [],
  setter: null, closer: null,
  ...p,
} as Lead);

test('A revisar cuenta con el día del NEGOCIO que le pasa quien llama, no con el de Tijuana', async () => {
  const { faltantesDeLead } = await import('../lib/leads');
  // Una R1 cargada a mano para el martes 17, sin hora (sin `junta_1_at`). A las 19:30 de Tijuana del martes, un negocio
  // de Tijuana todavía tiene la reunión «hoy» (no se pide la asistencia); uno de Madrid ya está en el miércoles (sí).
  const lead = L({ fecha_junta_1: '2026-11-17' });
  const etiquetas = (hoyISO: string) => faltantesDeLead(lead, undefined, { pipeline: DEFAULT_STAGES, hoyISO }).map((s) => s.label);
  const deTijuana = etiquetas(hoyEnTz('America/Tijuana', NOCHE_TJ));
  const deMadrid = etiquetas(hoyEnTz('Europe/Madrid', NOCHE_TJ));
  assert.ok(!deTijuana.includes('Asistencia a la Reunión 1'), `el mismo día de la reunión no se pide la asistencia: ${deTijuana.join(' · ')}`);
  assert.ok(deMadrid.includes('Asistencia a la Reunión 1'), `al día siguiente del negocio sí: ${deMadrid.join(' · ')}`);
});

// ── Los reportes: el día y la semana del negocio del contexto ────────────────────────────────────────────────────────

test('el reporte del día y el semanal de un negocio en Madrid cortan con SUS días', () => {
  const PREFS = '{ secciones: { semaforo: false, ads: false, wins: false, pendientes: false } }';
  // Lunes 16/11 a las 06:00 en Madrid (05:00 UTC): en Tijuana todavía es el domingo 15 a las 21:00.
  const lunesMadrid = new Date('2026-11-16T05:00:00Z');
  const sem = enNodeAparte(`
    const { buildReporteSemanal } = await import(${JSON.stringify(pathToFileURL(join(raiz, 'lib/reportes.ts')).href)});
    return {
      madrid: (await runWithWorkspace(2, () => buildReporteSemanal(${PREFS}))).titulo,
      tijuana: (await runWithWorkspace(1, () => buildReporteSemanal(${PREFS}))).titulo,
    };
  `, lunesMadrid) as { madrid: string; tijuana: string };
  assert.equal(sem.madrid, 'Reporte semanal · 09/11/2026–15/11/2026', 'el lunes de Madrid reporta la semana que acaba de cerrar');
  assert.equal(sem.tijuana, 'Reporte semanal · 02/11/2026–08/11/2026', 'en Tijuana todavía es domingo: la semana de antes');
  const dia = enNodeAparte(`
    const { buildReporteDiario } = await import(${JSON.stringify(pathToFileURL(join(raiz, 'lib/reportes.ts')).href)});
    return {
      madrid: (await runWithWorkspace(2, () => buildReporteDiario(${PREFS}))).titulo,
      tijuana: (await runWithWorkspace(1, () => buildReporteDiario(${PREFS}))).titulo,
    };
  `, NOCHE_TJ) as { madrid: string; tijuana: string };
  assert.equal(dia.madrid, 'Reporte del día · 18/11/2026');
  assert.equal(dia.tijuana, 'Reporte del día · 17/11/2026');
});
