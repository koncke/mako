// =============================================================================
// «El mes» de General sigue el PERÍODO que elige la hoja (18/11/2026)
// =============================================================================
// Pendiente O10 (3) de docs/pendientes-verificados-17-11.md: «que los bloques de General acepten el período y los
// filtros». El funnel ya llegaba (tests/general-funnels-de-la-hoja.test.ts); el período de la hoja movía sus gráficos y
// ningún bloque: con la hoja en «Últimos 30 días», «El mes» seguía diciendo el mes a la fecha al lado de números que decían
// otra cosa. app/general/periodo-de-la-hoja.ts explica qué bloque lo sigue («El mes») y por qué los demás no.
//
// Lo que fija, EJECUTANDO el código:
//   · qué período eligió la hoja (su control, con lo elegido mirando; uno fijo vale lo guardado; sin control, ninguno);
//   · qué rango se lee (cortado en hoy, contra el anterior del mismo largo; «Todo» no se compara);
//   · que dos períodos dan NÚMEROS distintos (`armarMesDelPeriodo` con lecturas de prueba sobre filas con fecha);
//   · y el bloque DIBUJADO de verdad en una hoja (tests/_general-periodo-hijo.ts: ElementoGeneral → dibujarBloque →
//     MesDelPeriodo → BloqueMes), con período, sin él, con otro elegido mirando y sin el «hoy» del editor.
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026; base en verde: 7 pasan, 0 fallan). Una rotura por vez, restaurando de memoria;
//    pasan / fallan:
//   1. `periodoDeLosBloques` sin `conVista` (ignora lo elegido mirando) ..... 5 / 2 «el período…» y «el bloque dibujado…»
//   2. `rangoDelResumen` sin cortar en hoy (`actual = pedido`) .............. 5 / 2 «el rango…» y «dos períodos…»
//   3. `armarMesDelPeriodo` leyendo el anterior con el rango ACTUAL ......... 6 / 1 «dos períodos…»
//   4. `dibujarBloque` con «El mes» sin mirar `hoja.periodo` ................ 6 / 1 «el bloque dibujado…»
//   5. `ElementoGeneral` sin pasarle el período al dibujo ................... 6 / 1 «el bloque dibujado…»
//   6. `ProveedorMesDelPeriodo` sin sembrar lo que trajo la página .......... 6 / 1 «el bloque dibujado…»
// Correr: node --import tsx --test tests/general-periodo-de-la-hoja.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hojaLeePeriodo, periodoDeLosBloques, rangoDelResumen, tituloDelPeriodo } from '../app/general/periodo-de-la-hoja';
import { armarMesDelPeriodo, type LecturasDelMes } from '../app/general/mes-del-periodo';
import type { Hoja } from '../lib/graficos-catalogo';

const HOY = '2026-11-18';
const hoja = (controles: unknown[], componentes: unknown[] = []) => ({ controles, componentes }) as unknown as Hoja;
const periodo = (preset: string, extra: Record<string, unknown> = {}) => ({ id: 'p', tipo: 'periodo', preset, desde: null, hasta: null, ...extra });

test('el período de los bloques es el del control de la hoja, con lo elegido mirando', () => {
  assert.equal(periodoDeLosBloques(hoja([]), {}, HOY), null, 'sin control: cada bloque mira su tiempo de siempre');
  assert.equal(periodoDeLosBloques(null, {}, HOY), null);
  assert.deepEqual(periodoDeLosBloques(hoja([periodo('ult30')]), {}, HOY), { desde: '2026-10-20', hasta: HOY, preset: 'ult30' });
  // Lo elegido mirando gana sobre lo guardado…
  assert.deepEqual(periodoDeLosBloques(hoja([periodo('ult30')]), { p: { preset: 'mes_pasado' } }, HOY), { desde: '2026-10-01', hasta: '2026-10-31', preset: 'mes_pasado' });
  // …salvo en un control FIJO, que vale lo guardado (`conVista`).
  assert.deepEqual(periodoDeLosBloques(hoja([periodo('ult7', { fijo: true })]), { p: { preset: 'mes_pasado' } }, HOY), { desde: '2026-11-12', hasta: HOY, preset: 'ult7' });
  assert.deepEqual(periodoDeLosBloques(hoja([periodo('personalizado', { desde: '2026-09-01', hasta: '2026-09-15' })]), {}, HOY), { desde: '2026-09-01', hasta: '2026-09-15', preset: 'personalizado' });
  assert.equal(periodoDeLosBloques(hoja([periodo('ult30')]), {}, 'no-es-una-fecha'), null, 'sin un hoy válido no se adivina');
});

test('el rango que lee «El mes»: cortado en hoy y contra el anterior del mismo largo', () => {
  // «Este mes completo» termina después de hoy: se lee hasta hoy (18 días) contra los 18 días de antes.
  assert.deepEqual(rangoDelResumen({ desde: '2026-11-01', hasta: '2026-11-30' }, HOY), {
    actual: { desde: '2026-11-01', hasta: HOY }, anterior: { desde: '2026-10-14', hasta: '2026-10-31' }, etiqueta: '14/10 – 31/10',
  });
  assert.deepEqual(rangoDelResumen({ desde: '2026-10-01', hasta: '2026-10-31' }, HOY).anterior, { desde: '2026-08-31', hasta: '2026-09-30' });
  // Un día: contra el día anterior.
  assert.deepEqual(rangoDelResumen({ desde: HOY, hasta: HOY }, HOY), { actual: { desde: HOY, hasta: HOY }, anterior: { desde: '2026-11-17', hasta: '2026-11-17' }, etiqueta: '17/11' });
  // El anterior que cruza de año lleva el año; el que no, no.
  assert.equal(rangoDelResumen({ desde: '2027-01-05', hasta: '2027-01-20' }, '2027-01-25').etiqueta, '20/12/2026 – 04/01/2027');
  assert.equal(rangoDelResumen({ desde: '2027-01-01', hasta: '2027-01-10' }, '2027-01-20').etiqueta, '22/12 – 31/12');
  // «Todo» no se compara: el período anterior a 2020 no existe.
  assert.deepEqual(rangoDelResumen({ desde: '2020-01-01', hasta: HOY }, HOY), { actual: { desde: '2020-01-01', hasta: HOY }, anterior: null, etiqueta: '' });
  // Un período que empieza después de hoy queda en su primer día (nunca se invierte).
  assert.deepEqual(rangoDelResumen({ desde: '2026-12-01', hasta: '2026-12-31' }, HOY).actual, { desde: '2026-12-01', hasta: '2026-12-01' });
});

test('el título dice el período: «El mes» si mira el mes, su nombre si no', () => {
  assert.equal(tituloDelPeriodo(null), 'El mes');
  assert.equal(tituloDelPeriodo({ desde: '2026-11-01', hasta: HOY, preset: 'este_mes' }), 'El mes');
  assert.equal(tituloDelPeriodo({ desde: '2026-11-01', hasta: '2026-11-30', preset: 'este_mes_completo' }), 'El mes');
  assert.equal(tituloDelPeriodo({ desde: '2026-10-20', hasta: HOY, preset: 'ult30' }), 'Últimos 30 días');
  assert.equal(tituloDelPeriodo({ desde: '2026-10-01', hasta: '2026-10-31', preset: 'mes_pasado' }), 'El mes pasado');
  assert.equal(tituloDelPeriodo({ desde: '2026-09-01', hasta: '2026-09-15', preset: 'personalizado' }), '01/09 – 15/09');
});

// ── Las lecturas de prueba: filas con fecha, sumadas por rango (como las de verdad, sin la base) ──────────────────────

/** Lo que pasó cada día: lo cobrado, lo gastado en anuncios, las agendas y los cierres. Inventado. */
const DIAS: Record<string, { cobrado: number; gasto: number; agendas: number; cierres: number }> = {
  '2026-09-20': { cobrado: 400, gasto: 50, agendas: 1, cierres: 0 },
  '2026-10-05': { cobrado: 1000, gasto: 120, agendas: 3, cierres: 1 },
  '2026-10-25': { cobrado: 2500, gasto: 200, agendas: 4, cierres: 2 },
  '2026-11-10': { cobrado: 600, gasto: 80, agendas: 2, cierres: 1 },
  '2026-11-16': { cobrado: 300, gasto: 30, agendas: 1, cierres: 0 },
  '2026-11-25': { cobrado: 9999, gasto: 999, agendas: 9, cierres: 9 }, // después de hoy: nunca se cuenta
};
type Pedido = { que: string; desde: string; hasta: string };
function lecturas(pedidos: Pedido[], rotas: { resumen?: boolean; desgloses?: boolean } = {}): LecturasDelMes {
  const dias = (d: string, h: string) => Object.entries(DIAS).filter(([f]) => f >= d && f <= h).map(([f, v]) => ({ f, ...v }));
  const sumar = (d: string, h: string, k: 'cobrado' | 'gasto' | 'agendas' | 'cierres') => dias(d, h).reduce((s, x) => s + x[k], 0);
  const anotar = (que: string, desde: string, hasta: string) => { pedidos.push({ que, desde, hasta }); };
  return {
    marketing: async (d, h) => { anotar('marketing', d, h); if (rotas.resumen) throw new Error('caída'); return { spend_usd: sumar(d, h, 'gasto'), reuniones_en_ventana: sumar(d, h, 'agendas') }; },
    revenue: async (d, h) => { anotar('revenue', d, h); return { cash_collected_usd: sumar(d, h, 'cobrado'), cierres_en_periodo: sumar(d, h, 'cierres') }; },
    desglose: async (d, h) => {
      anotar('desglose', d, h);
      if (rotas.desgloses) throw new Error('caída');
      const cash = dias(d, h).map((x, i) => ({ nombre: `Cliente ${i + 1}`, monto: x.cobrado, fecha: x.f, detalle: null, leadId: i + 1 }));
      return { sold: [], cash, outstanding: [] } as unknown as Awaited<ReturnType<LecturasDelMes['desglose']>>;
    },
    agendas: async (d, h) => { anotar('agendas', d, h); return []; },
    senales: async (d, h) => { anotar('senales', d, h); return []; },
  };
}

test('dos períodos distintos dan números distintos, cada uno contra SU anterior', async () => {
  const pedidos: Pedido[] = [];
  // «Últimos 30 días» (20/10 – 18/11) y «El mes pasado» (1/10 – 31/10).
  const ult30 = await armarMesDelPeriodo(lecturas(pedidos), { desde: '2026-10-20', hasta: HOY }, HOY);
  const mesPasado = await armarMesDelPeriodo(lecturas([]), { desde: '2026-10-01', hasta: '2026-10-31' }, HOY);
  assert.ok(ult30.comparativo && mesPasado.comparativo);
  assert.deepEqual(ult30.comparativo.cash_usd, { actual: 2500 + 600 + 300, anterior: 1000 + 400, proyeccion: 0 }, 'los 30 días, contra los 30 de antes (20/09 – 19/10)');
  assert.deepEqual(mesPasado.comparativo.cash_usd, { actual: 1000 + 2500, anterior: 400, proyeccion: 0 }, 'octubre, contra los 31 días de antes');
  assert.notEqual(ult30.comparativo.cash_usd.actual, mesPasado.comparativo.cash_usd.actual);
  assert.deepEqual(ult30.comparativo.inversion_usd, { actual: 310, anterior: 170, proyeccion: 0 });
  assert.deepEqual(ult30.comparativo.agendas, { actual: 7, anterior: 4, proyeccion: 0 });
  assert.deepEqual(ult30.comparativo.cierres, { actual: 3, anterior: 1, proyeccion: 0 });
  assert.equal(ult30.comparativo.etiqueta_anterior, '20/09 – 19/10');
  // El desglose de lo cobrado es del período, no del mes a la fecha, y lo dice.
  assert.equal(ult30.desgloses['Cash Collected']?.items.length, 3);
  assert.equal(ult30.desgloses['Cash Collected']?.label, 'Cash Collected del período');
  // Lo que se pidió a la base: el período (cortado en hoy) y su anterior.
  assert.deepEqual(pedidos.filter((p) => p.que === 'revenue').map((p) => `${p.desde}…${p.hasta}`), ['2026-10-20…2026-11-18', '2026-09-20…2026-10-19']);
  // «Este mes completo»: lo de después de hoy no entra.
  const esteMes = await armarMesDelPeriodo(lecturas([]), { desde: '2026-11-01', hasta: '2026-11-30' }, HOY);
  assert.equal(esteMes.comparativo?.cash_usd.actual, 900);
});

test('«Todo» no compara, y cada parte falla sola', async () => {
  const todo = await armarMesDelPeriodo(lecturas([]), { desde: '2020-01-01', hasta: HOY }, HOY);
  assert.deepEqual(todo.comparativo?.cash_usd, { actual: 400 + 1000 + 2500 + 600 + 300, anterior: 0, proyeccion: 0 });
  assert.equal(todo.comparativo?.etiqueta_anterior, '', 'sin «vs.»');
  // Sin el resumen: el bloque dice que no pudo, y los desgloses siguen.
  const sinResumen = await armarMesDelPeriodo(lecturas([], { resumen: true }), { desde: '2026-10-20', hasta: HOY }, HOY);
  assert.equal(sinResumen.comparativo, null);
  assert.equal(sinResumen.desgloses['Cash Collected']?.items.length, 3);
  // Sin los desgloses: los números se ven igual y no se abren.
  const sinDesgloses = await armarMesDelPeriodo(lecturas([], { desgloses: true }), { desde: '2026-10-20', hasta: HOY }, HOY);
  assert.equal(sinDesgloses.comparativo?.cash_usd.actual, 3400);
  assert.deepEqual(sinDesgloses.desgloses, {});
});

test('la página lee el período de entrada sólo si la hoja tiene un bloque que lo sigue', () => {
  const mes = { id: 'm', clase: 'elemento', tipo: 'general', general: { pieza: 'mes' } };
  const cobranza = { id: 'c', clase: 'elemento', tipo: 'general', general: { pieza: 'cobranza' } };
  assert.equal(hojaLeePeriodo(hoja([], [mes])), true);
  assert.equal(hojaLeePeriodo(hoja([], [cobranza])), false, '«A quién cobrarle» es la lista operativa: no sigue el período');
  assert.equal(hojaLeePeriodo(hoja([], [])), false);
});

// ── El bloque DIBUJADO, en un node aparte (cambia `Module._load`: el `server-only` de los bloques) ────────────────────

type Dibujo = { escena: string; titulo: string | null; extra: string | null; numeros: string[]; cargando: boolean };
let dibujos: Dibujo[] | null = null;
function dibujar(): Dibujo[] {
  if (dibujos) return dibujos;
  const salida = execFileSync(process.execPath, ['--import', 'tsx', join(dirname(fileURLToPath(import.meta.url)), '_general-periodo-hijo.ts')], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000,
  });
  const i = salida.indexOf('@@RESULTADO@@');
  assert.ok(i >= 0, `el hijo no imprimió su resultado:\n${salida.slice(-2000)}`);
  dibujos = JSON.parse(salida.slice(i + '@@RESULTADO@@'.length).split('\n')[0]) as Dibujo[];
  return dibujos;
}
const escena = (nombre: string): Dibujo => {
  const d = dibujar().find((x) => x.escena === nombre);
  assert.ok(d, `falta la escena ${nombre}`);
  return d;
};

test('el bloque dibujado en una hoja: con período, sin él, con otro elegido mirando y sin el hoy del editor', () => {
  const conPeriodo = escena('periodo');
  assert.equal(conPeriodo.titulo, 'Últimos 30 días');
  assert.equal(conPeriodo.extra, 'vs. 20/09 – 19/10');
  assert.ok(conPeriodo.numeros.includes('$777'), `dibuja lo del PERÍODO, no el mes a la fecha: ${conPeriodo.numeros.join(' ')}`);
  assert.equal(conPeriodo.cargando, false, 'lo que trajo la página se dibuja sin volver a pedir');

  const sinPeriodo = escena('sin-periodo');
  assert.equal(sinPeriodo.titulo, 'El mes');
  assert.ok(sinPeriodo.numeros.includes('$111'), 'sin control de período: el mes a la fecha de siempre');

  const otra = escena('vista-otra');
  assert.equal(otra.titulo, 'El mes pasado');
  assert.equal(otra.cargando, true, 'otro período: espera el suyo');
  assert.deepEqual(otra.numeros, [], 'nunca dibuja el número de otro período con el título de éste');

  const sinHoy = escena('sin-hoy');
  assert.equal(sinHoy.titulo, 'El mes');
  assert.ok(sinHoy.numeros.includes('$111'), 'el teléfono (sin el hoy del editor) sigue con el mes a la fecha');
});
