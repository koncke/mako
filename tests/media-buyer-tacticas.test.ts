// Las tácticas del Media Buyer como automatizaciones, una por una (las «Automation Tactics» de Madgicx): cada una se
// apaga, propone o es automática, tiene sus umbrales con el recomendado al lado, y puede cubrir sólo algunas campañas.
// Lo que fija: sin configurar, el motor hace lo de siempre; apagada no propone; un umbral más alto frena; una campaña
// afuera no se toca; el plan sin piloto baja «automática» a «propone»; y lo que llega se valida y se recorta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proponer, STOP_GASTO_MIN, SURF_SALTO_MAX_PCT, type EntradaMotor, type NodoMB, type SenalMB } from '../lib/media-buyer/motor';
import { CONFIG_POR_DEFECTO } from '../lib/media-buyer/tipos';
import { ORDEN_TACTICAS, TACTICAS, pideAutomatica, resolverTacticas, validarTacticas } from '../lib/media-buyer/tacticas';

const AHORA = Date.parse('2026-10-25T15:00:00Z');
const HOY = '2026-10-25';
const VIEJA = '2026-09-01T00:00:00Z';
const nodo = (id: string, nivel: NodoMB['nivel'], parentId: string | null, x: Partial<NodoMB> = {}): NodoMB => ({
  id, nombre: id, nivel, parentId, configurado: 'ACTIVE', entrega: 'ACTIVE', presupuestoDia: null, nivelPresupuesto: null, creada: VIEJA, ...x,
});
const senal = (adId: string, x: Partial<SenalMB> = {}): SenalMB => ({
  adId, gasto: 0, leadsMeta: 0, leadsCrm: 0, agendasMeta: 0, agendasCrm: 0, cierres: 0, caja: 0, impresiones: 1000, frecuencia: 1.2, diasCorriendo: 7, esVideo: false, miniatura: null, ...x,
});
// Dos campañas: c1 con un anuncio que gastó sin resultados (Stop Loss) y c2 con un conjunto que rinde (Surf).
const arbol = (): NodoMB[] => [
  nodo('c1', 'campaign', null, { nivelPresupuesto: 'adset' }),
  nodo('s1', 'adset', 'c1', { presupuestoDia: 50, nivelPresupuesto: 'adset' }),
  nodo('a1', 'ad', 's1'),
  nodo('c2', 'campaign', null, { nivelPresupuesto: 'adset' }),
  nodo('s2', 'adset', 'c2', { presupuestoDia: 50, nivelPresupuesto: 'adset' }),
  nodo('a2', 'ad', 's2'),
];
const entrada = (tacticas?: EntradaMotor['tacticas']): EntradaMotor => ({
  ahora: AHORA, config: { ...CONFIG_POR_DEFECTO, encendido: true }, objetivo: 10, arbol: arbol(), tacticas,
  corta: [senal('a2', { gasto: 150, leadsMeta: 20 })],
  larga: [senal('a1', { gasto: 30, diasCorriendo: 5 }), senal('a2', { gasto: 350, leadsMeta: 45 })],
  crm: [], historial: [], aUnidad: (m) => m, fmt: (u) => `US$ ${u}`, presupuestoMinimo: 5,
});
const tacticasDe = (ps: ReturnType<typeof proponer>) => ps.map((p) => `${p.tactica}:${p.entidadId}`).sort();
// Para medir UNA táctica, las que esta cuenta también dispara (Ganador sobre a2, Sunsetting sobre s1) quedan apagadas.
const SOLO = { ganador: { estado: 'apagada' as const }, sunsetting: { estado: 'apagada' as const } };
const con = (c: Parameters<typeof resolverTacticas>[0]) => resolverTacticas({ ...SOLO, ...c }, { piloto: false, pilotoPermitido: true });

test('sin configurar, lo recomendado es lo que el motor usó siempre, y el motor propone igual', () => {
  const t = resolverTacticas({}, { piloto: false, pilotoPermitido: true });
  assert.equal(t.stop_loss.p.gastoVeces, STOP_GASTO_MIN);
  assert.equal(t.surf.p.subidaPct, SURF_SALTO_MAX_PCT);
  for (const k of ORDEN_TACTICAS) assert.equal(t[k].estado, 'propone');
  const sin = tacticasDe(proponer(entrada(), HOY));
  assert.deepEqual(tacticasDe(proponer(entrada(t), HOY)), sin);
  assert.ok(sin.includes('stop_loss:a1') && sin.includes('surf:s2'));
  assert.deepEqual(tacticasDe(proponer(entrada(con({})), HOY)), ['stop_loss:a1', 'surf:s2']);
});

test('una táctica apagada no propone nada; las demás siguen', () => {
  assert.deepEqual(tacticasDe(proponer(entrada(con({ stop_loss: { estado: 'apagada' } })), HOY)), ['surf:s2']);
});

test('un umbral más exigente frena la táctica (Stop Loss pidiendo 5 veces el objetivo)', () => {
  assert.deepEqual(tacticasDe(proponer(entrada(con({ stop_loss: { parametros: { gastoVeces: 5 } } })), HOY)), ['surf:s2']);
});

test('Surf sube lo que diga su táctica, sin pasar el tope de subida del negocio', () => {
  const t = resolverTacticas({ surf: { parametros: { subidaPct: 10 } } }, { piloto: false, pilotoPermitido: true });
  assert.deepEqual(proponer(entrada(t), HOY).find((p) => p.tactica === 'surf')?.despues, { presupuesto: 55 });
});

test('una táctica que cubre sólo algunas campañas no toca las otras', () => {
  assert.deepEqual(tacticasDe(proponer(entrada(con({ surf: { campanas: ['c1'] }, stop_loss: { campanas: ['c2'] } })), HOY)), []);
  assert.deepEqual(tacticasDe(proponer(entrada(con({ surf: { campanas: ['c2'] }, stop_loss: { campanas: ['c1'] } })), HOY)), ['stop_loss:a1', 'surf:s2']);
});

test('el piloto general vuelve automáticas a las que no eligieron otra cosa; sin piloto en el plan, ninguna lo es', () => {
  const con = resolverTacticas({ revive: { estado: 'propone' } }, { piloto: true, pilotoPermitido: true });
  assert.equal(con.surf.estado, 'automatica');
  assert.equal(con.revive.estado, 'propone');
  const sinPlan = resolverTacticas({ surf: { estado: 'automatica' } }, { piloto: true, pilotoPermitido: false });
  for (const k of ORDEN_TACTICAS) assert.notEqual(sinPlan[k].estado, 'automatica');
});

test('lo que llega se valida: táctica, estado y campañas; los números se recortan a su mínimo y su máximo', () => {
  assert.equal(validarTacticas({ inventada: {} }).ok, false);
  assert.equal(validarTacticas({ surf: { estado: 'siempre' } }).ok, false);
  assert.equal(validarTacticas({ surf: { campanas: ['act_1'] } }).ok, false);
  assert.equal(validarTacticas({ surf: { parametros: { otro: 1 } } }).ok, false);
  const v = validarTacticas({ surf: { estado: 'automatica', parametros: { subidaPct: 500 }, campanas: ['12', '12'] } });
  assert.ok(v.ok);
  if (v.ok) {
    assert.equal(v.valor.surf?.parametros?.subidaPct, TACTICAS.surf.parametros.find((p) => p.id === 'subidaPct')!.max);
    assert.deepEqual(v.valor.surf?.campanas, ['12']);
    assert.equal(pideAutomatica(v.valor), true);
  }
});
