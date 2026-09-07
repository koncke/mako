// =============================================================================
// La aritmética de Objectives y KPIs — la segunda capa, la determinista
// =============================================================================
// `estadoKpi` decide de qué color se pinta algo en la PANTALLA DE ENTRADA del
// negocio, y ese color decide cuál es la acción prioritaria del día. O sea que un
// error acá no se ve como un bug: se ve como una orden de trabajo equivocada, con
// cara de dato.
//
// Los dos casos que más importan y que ningún prompt puede garantizar:
//   · `valor === null` (no pude leer) NO es rojo — es «sin datos».
//   · `compromiso === 0` (sin configurar) NO es verde — también es «sin datos».
//
// El segundo es literalmente la tarea #165 en chiquito: un verde sobre un negocio
// del que no se sabe nada es peor que un rojo, porque cierra la pregunta.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quarterDe, quarterKey, parseQuarterKey, rangoQuarter, siguienteQuarter, diasEntre,
  progresoQuarter, periodoDe, periodoAnterior, estadoKpi, pctKpi, ritmoObjetivo,
  proponerCandidatos, capacidadDe, CANDIDATOS_KPI, FUENTES_KPI, fuenteKpi,
} from '../lib/objectives-modelo';

// ── Quarters ────────────────────────────────────────────────────────────────

test('quarterDe: los bordes de cada trimestre', () => {
  assert.deepEqual(quarterDe('2026-01-01'), { anio: 2026, q: 1 });
  assert.deepEqual(quarterDe('2026-03-31'), { anio: 2026, q: 1 });
  assert.deepEqual(quarterDe('2026-04-01'), { anio: 2026, q: 2 });
  assert.deepEqual(quarterDe('2026-06-30'), { anio: 2026, q: 2 });
  assert.deepEqual(quarterDe('2026-07-01'), { anio: 2026, q: 3 });
  assert.deepEqual(quarterDe('2026-09-30'), { anio: 2026, q: 3 });
  assert.deepEqual(quarterDe('2026-10-01'), { anio: 2026, q: 4 });
  assert.deepEqual(quarterDe('2026-12-31'), { anio: 2026, q: 4 });
});

test('rangoQuarter cierra en el último día real del mes, febrero bisiesto incluido', () => {
  assert.deepEqual(rangoQuarter({ anio: 2026, q: 1 }), { desde: '2026-01-01', hasta: '2026-03-31' });
  assert.deepEqual(rangoQuarter({ anio: 2026, q: 2 }), { desde: '2026-04-01', hasta: '2026-06-30' });
  assert.deepEqual(rangoQuarter({ anio: 2026, q: 4 }), { desde: '2026-10-01', hasta: '2026-12-31' });
  // 2028 es bisiesto: el Q1 tiene 91 días, no 90.
  assert.equal(diasEntre('2028-01-01', '2028-03-31'), 91);
  assert.equal(diasEntre('2026-01-01', '2026-03-31'), 90);
});

test('la clave del Q lleva el año, y el año cruza en Q4→Q1', () => {
  assert.equal(quarterKey({ anio: 2026, q: 3 }), '2026-Q3');
  assert.deepEqual(siguienteQuarter({ anio: 2026, q: 4 }), { anio: 2027, q: 1 });
  assert.deepEqual(siguienteQuarter({ anio: 2026, q: 1 }), { anio: 2026, q: 2 });
  assert.deepEqual(parseQuarterKey('2026-Q3'), { anio: 2026, q: 3 });
});

test('parseQuarterKey rechaza todo lo que no sea exactamente la clave', () => {
  for (const malo of ['', 'Q3', '2026-Q5', '2026-Q0', '26-Q3', '2026Q3', 'x2026-Q3', null, undefined]) {
    assert.equal(parseQuarterKey(malo as string | null), null, `debería rechazar: ${String(malo)}`);
  }
});

test('progresoQuarter no se pasa de los bordes ni cuenta días negativos', () => {
  const q3 = { anio: 2026, q: 3 };
  const antes = progresoQuarter(q3, '2026-05-01');
  assert.equal(antes.diasTranscurridos, 0);
  assert.equal(antes.fraccion, 0);

  const primerDia = progresoQuarter(q3, '2026-07-01');
  assert.equal(primerDia.diasTranscurridos, 1, 'el primer día del Q ya cuenta como transcurrido');

  const despues = progresoQuarter(q3, '2027-01-15');
  assert.equal(despues.diasTranscurridos, despues.diasTotales);
  assert.equal(despues.diasRestantes, 0);
  assert.equal(despues.fraccion, 1);
});

// ── Períodos de un KPI ──────────────────────────────────────────────────────

test('periodoDe: el diario es el día; el semanal arranca el LUNES', () => {
  assert.deepEqual(periodoDe('diaria', '2026-09-06'), { clave: '2026-09-06', desde: '2026-09-06', hasta: '2026-09-06' });
  // 2026-09-06 es domingo → su semana arranca el lunes 31/08 y termina ese domingo.
  assert.deepEqual(periodoDe('semanal', '2026-09-06'), { clave: '2026-08-31', desde: '2026-08-31', hasta: '2026-09-06' });
  // Un lunes se devuelve a sí mismo.
  assert.deepEqual(periodoDe('semanal', '2026-08-31'), { clave: '2026-08-31', desde: '2026-08-31', hasta: '2026-09-06' });
});

test('LA CLAVE ES EL PERÍODO, NO EL DÍA DEL CLICK: todos los días de una semana dan la misma', () => {
  // Es lo que hace idempotente al registro. Sin esto, marcar el mismo compromiso
  // el martes y el jueves crearía DOS filas para la misma semana y el tablero
  // contaría el doble.
  const claves = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']
    .map((d) => periodoDe('semanal', d).clave);
  assert.deepEqual([...new Set(claves)], ['2026-08-31']);
});

test('periodoAnterior retrocede un período entero, no un día', () => {
  assert.equal(periodoAnterior('semanal', '2026-09-03').clave, '2026-08-24');
  assert.equal(periodoAnterior('diaria', '2026-09-03').clave, '2026-09-02');
});

// ── El color de un KPI ──────────────────────────────────────────────────────

test('EL PEDIDO: no poder leer la fuente NO es rojo, es «sin datos»', () => {
  assert.equal(estadoKpi(null, 7), 'sin-datos');
  assert.equal(estadoKpi(Number.NaN, 7), 'sin-datos');
  assert.notEqual(estadoKpi(null, 7), 'rojo');
});

test('EL PEDIDO: un KPI sin compromiso NO es verde — está sin configurar', () => {
  // Es la #165 en chiquito: un verde sobre algo que no se sabe cierra la pregunta,
  // y eso se lleva puesta la credibilidad del resto del tablero.
  assert.equal(estadoKpi(0, 0), 'sin-datos');
  assert.equal(estadoKpi(10, 0), 'sin-datos');
  assert.equal(estadoKpi(10, -1), 'sin-datos');
});

test('estadoKpi con los umbrales por defecto (100 / 70)', () => {
  assert.equal(estadoKpi(7, 7), 'verde');
  assert.equal(estadoKpi(9, 7), 'verde', 'pasarse del compromiso sigue siendo verde');
  assert.equal(estadoKpi(5, 7), 'ambar', '5/7 = 71% → ámbar');
  assert.equal(estadoKpi(4, 7), 'rojo', '4/7 = 57% → rojo');
  assert.equal(estadoKpi(0, 7), 'rojo', 'la fuente dijo cero: eso SÍ es rojo');
});

test('los umbrales son PORCENTAJE, así que sobreviven a un cambio de compromiso', () => {
  // El mismo 80% da lo mismo con compromiso 5 o 50: si fueran absolutos, cambiar
  // el compromiso de 5 a 50 dejaría el KPI en verde para siempre.
  assert.equal(estadoKpi(4, 5, 100, 70), estadoKpi(40, 50, 100, 70));
  assert.equal(estadoKpi(4, 5, 100, 70), 'ambar');
});

test('pctKpi topea en 100 y devuelve null cuando no hay nada que medir', () => {
  assert.equal(pctKpi(14, 7), 100);
  assert.equal(pctKpi(3.5, 7), 50);
  assert.equal(pctKpi(null, 7), null);
  assert.equal(pctKpi(3, 0), null);
});

// ── Ritmo ───────────────────────────────────────────────────────────────────

test('ritmoObjetivo prorratea lineal y sabe si vas adelantado', () => {
  const p = progresoQuarter({ anio: 2026, q: 3 }, '2026-08-15');  // 46 de 92 días
  const r = ritmoObjetivo(10_000, 20_000, p, '2026-08-15');
  assert.equal(Math.round(r.esperado), 10_000, 'a mitad del Q se espera la mitad de la meta');
  assert.equal(Math.round(r.desvio), 0);
  assert.equal(r.alDia, true);

  const atrasado = ritmoObjetivo(4_000, 20_000, p, '2026-08-15');
  assert.equal(atrasado.alDia, false);
  assert.ok(atrasado.desvio < 0);
  assert.ok(atrasado.desvioPct !== null && atrasado.desvioPct < -50);
});

test('un objetivo YA CUMPLIDO llega hoy, no «nunca»', () => {
  // Sin este caso, cumplido y sin-movimiento caen los dos en `llegadaEstimada:
  // null` y la pantalla dice lo mismo para el mejor y el peor escenario.
  const p = progresoQuarter({ anio: 2026, q: 3 }, '2026-08-15');
  const cumplido = ritmoObjetivo(25_000, 20_000, p, '2026-08-15');
  assert.equal(cumplido.llegadaEstimada, '2026-08-15');

  const quieto = ritmoObjetivo(0, 20_000, p, '2026-08-15');
  assert.equal(quieto.llegadaEstimada, null, 'sin ritmo no se puede estimar nada');
});

// ── El seed ─────────────────────────────────────────────────────────────────

test('proponerCandidatos nunca devuelve vacío, ni sin funnel ni sin fase', () => {
  // Una pantalla en blanco es donde muere toda feature de objetivos. No saber
  // nada del negocio es razón para proponer lo común, no para no proponer nada.
  assert.ok(proponerCandidatos(null, null).length > 0);
  assert.ok(proponerCandidatos([], null).length > 0);
  assert.ok(proponerCandidatos(['lead'], 'foco').length > 0);
});

test('proponerCandidatos topea en 8: un tablero que no se lee de un vistazo no sirve', () => {
  assert.ok(proponerCandidatos(null, null).length <= 8);
  assert.equal(proponerCandidatos(null, null, 3).length, 3);
});

test('con funnel declarado se descartan los KPIs de etapas que ese negocio no tiene', () => {
  const soloLead = proponerCandidatos(['lead'], null).map((c) => c.nombre);
  assert.ok(!soloLead.includes('Reuniones agendadas'), 'un funnel sin reunión no propone agendas');
  const conAgenda = proponerCandidatos(['lead', 'agenda'], null).map((c) => c.nombre);
  assert.ok(conAgenda.includes('Reuniones agendadas'));
});

test('el cuello de la fase manda: lo que le pega va primero', () => {
  const conFoco = proponerCandidatos(null, 'foco');
  assert.ok(
    conFoco.slice(0, 2).some((c) => c.paraCuello?.includes('foco')),
    'con cuello «foco», arriba tiene que haber un KPI que le pegue a foco',
  );
});

test('se prefiere lo que MaKo puede medir solo: los automáticos van antes que los manuales', () => {
  // Es la regla que sostiene el registro mixto: la mitad automática es la única
  // que sobrevive a la segunda semana.
  const props = proponerCandidatos(null, null);
  const primerManual = props.findIndex((c) => c.fuente === 'manual');
  const ultimoAuto = props.map((c) => c.fuente).lastIndexOf('auto');
  if (primerManual !== -1) assert.ok(primerManual > ultimoAuto, 'ningún manual puede quedar arriba de un automático');
});

// ── Catálogo ↔ lectores ─────────────────────────────────────────────────────

// ⚠️ La paridad catálogo↔lector NO se testea acá: la garantiza el COMPILADOR.
// `lib/objectives-fuentes.ts` declara `Record<FuenteId, Lector>` con el `FuenteId`
// derivado de este mismo catálogo, así que las dos direcciones fallan el build.
// No se puede testear porque ese módulo tiene `server-only` y ningún test lo puede
// importar — y un guard que no se puede correr no es un guard, así que va donde sí
// corre. Lo que SÍ se puede comprobar acá es el catálogo consigo mismo.

test('los ids del catálogo de fuentes son únicos', () => {
  // Un id repetido no rompe el build: gana el último del objeto de lectores y el
  // otro queda muerto, con su ficha visible en el selector.
  const ids = FUENTES_KPI.map((f) => f.id);
  assert.deepEqual(ids.length, new Set(ids).size, `hay fuentes con id repetido: ${ids.join(', ')}`);
});

test('toda fuente del catálogo declara qué mide y en qué unidad', () => {
  for (const f of FUENTES_KPI) {
    assert.ok(f.label.trim(), `${f.id}: sin label`);
    assert.ok(f.que.trim(), `${f.id}: sin la línea de qué mide, que es lo que lee la persona al elegirla`);
    assert.ok(['usd', 'cantidad'].includes(f.unidad), `${f.id}: unidad inválida`);
  }
});

test('todo candidato automático apunta a una fuente que existe', () => {
  const rotos = CANDIDATOS_KPI
    .filter((c) => c.fuente === 'auto')
    .filter((c) => !fuenteKpi(c.fuenteId))
    .map((c) => `${c.nombre} → ${c.fuenteId}`);
  assert.deepEqual(rotos, [], 'un candidato apuntando a una fuente inexistente se siembra y nace roto');
});

test('todo candidato automático declara fuenteId, y ningún manual lo declara', () => {
  for (const c of CANDIDATOS_KPI) {
    if (c.fuente === 'auto') assert.ok(c.fuenteId, `${c.nombre}: es automático y no dice de dónde sale`);
    else assert.equal(c.fuenteId, undefined, `${c.nombre}: es manual y arrastra una fuente`);
  }
});

// ── Capacidad ───────────────────────────────────────────────────────────────

test('sin cupo cargado, capacidad no afirma nada', () => {
  const c = capacidadDe(null, 6);
  assert.equal(c.cupo, null);
  assert.equal(c.libres, null);
  assert.equal(c.ocupacionPct, null);
  assert.equal(c.activos, 6, 'los activos se saben igual: eso sale del CRM');
});

test('capacidad con cupo: libres nunca es negativo y la ocupación topea en 100', () => {
  assert.deepEqual(capacidadDe(8, 6), { cupo: 8, activos: 6, libres: 2, ocupacionPct: 75 });
  const excedido = capacidadDe(8, 11);
  assert.equal(excedido.libres, 0, 'sobrevendido no es «lugar negativo»');
  assert.equal(excedido.ocupacionPct, 100);
});

test('un cupo de cero se trata como no declarado, no como «no hay lugar»', () => {
  assert.equal(capacidadDe(0, 3).cupo, null);
});
