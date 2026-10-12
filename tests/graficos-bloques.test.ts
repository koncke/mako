// Tests de los bloques de Comercial del Dashboard (punto 5 del feedback de Martín del 11/10/2026: «En
// Comercial está diferente la parte de "A quién cobrarle", antes era un desplegable... Y con las
// opciones de "Marcar como cobrada"»). Lo que se prueba es lo PURO (app/dashboard/bloques/datos-comercial.ts):
// cómo se arma «A quién cobrarle» (el orden por vencimiento, el URGENTE, el total), la ventana del
// Outstanding, qué cohortes entran en el período, y que un bloque que no es de Comercial se DELEGA
// entero a lib/graficos-bloques-extra.ts (datos) y a ./extra/CuerpoBloqueExtra.tsx (dibujo).
//
// lib/graficos-bloques.ts lleva `server-only` y ningún test lo puede importar: su reparto se prueba con
// `repartirPedidos` (la función que llama) y su cableado, leyendo el FUENTE sin comentarios.
//
// Correr: npx tsx --test tests/graficos-bloques.test.ts
//
// PROBADO ROMPIÉNDOLO (11/10/2026), cada rotura sola, restaurada a mano y con la base en verde
// (13 de 13) antes de cada una. Cada rotura dio 1 fallo y 12 pases, en el test que la nombra:
//   1. El orden de armarCobranza dado vuelta (`fa < fb ? 1 : -1`).
//   2. La urgencia con `dias <= 0` como vencida (lo que vence HOY salía URGENTE).
//   3. El total sumando lo COBRADO en vez de lo pendiente.
//   4. repartirPedidos mandando todo a «propios» (ningún bloque extra delegado).
//   5. CuerpoBloque sin la rama de CuerpoBloqueExtra.
//   6. lib/graficos-bloques.ts llamando a datosDeBloquesExtra(pedidos) en vez de (extra).
//   7. ventanaOutstanding sin el fin de mes (hasta = el último día del período).
//   8. cohorteEnRango con el piso de la vieja para las semanas (el día 1 del mes). ⚠️ La primera versión
//      del test dio 13 de 13 EN VERDE con esta rotura: sus casos no caían entre el día 1 y el lunes del
//      inicio. Se sumaron los dos que sí (una semana del mismo mes ya terminada, y la que arrancó el mes
//      anterior y toca el período) y recién ahí cayó.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OutstandingLead } from '../lib/pagos';
import type { CohorteMes, CohorteSemana, FunnelLeadItem } from '../lib/queries';
import { BLOQUES, rangoDe } from '../lib/graficos-catalogo';
import { BLOQUES_EXTRA } from '../lib/graficos-bloques-extra-catalogo';
import {
  BLOQUES_COMERCIAL, DESDE_TODO, agruparLeadsPorCohorte, armarCobranza, cohorteEnRango, cohortesDelPeriodo,
  diasHasta, esBloqueComercial, hastaHoy, nodosDeTramos, partesBarra, payloadDe, repartirPedidos, textoVentana,
  urgenciaDe, ventanaOutstanding,
} from '../app/dashboard/bloques/datos-comercial';

const HOY = '2026-10-11';

const lead = (id: number, nombre: string, pendiente: number, vence: string | null, extra: Partial<OutstandingLead> = {}): OutstandingLead => ({
  lead_id: id,
  lead_nombre: nombre,
  vendido_usd: 3000,
  cobrado_usd: 1000,
  pendiente_usd: pendiente,
  proxima_cuota: { pago_id: id * 10, numero: 2, monto_usd: pendiente, fecha_esperada: vence },
  dias_desde_cierre: 40,
  fecha_cierre: '2026-09-01',
  ...extra,
});

// ── «A quién cobrarle» ────────────────────────────────────────────────────────────────────────

test('A quién cobrarle: ordena por el vencimiento más cercano, lo vencido hace más tiempo arriba y lo sin fecha al final', () => {
  // La lectura llega ordenada por lo que más se debe (getOutstandingDetalle): el orden de la tabla es otro.
  const items = [
    lead(1, 'Ana', 9000, '2026-11-20'),
    lead(2, 'Beto', 5000, null),
    lead(3, 'Caro', 4000, '2026-10-01'),
    lead(4, 'Dani', 3000, '2026-10-13'),
    lead(5, 'Eli', 2000, '2026-09-15'),
  ];
  const { filas } = armarCobranza(items, HOY);
  assert.deepEqual(filas.map((f) => f.nombre), ['Eli', 'Caro', 'Dani', 'Ana', 'Beto']);
  // Y la fila trae lo que dibuja la tabla vieja: lo vendido, lo cobrado TOTAL y la cuota a marcar.
  assert.deepEqual(filas[0].cuota, { pagoId: 50, numero: 2, monto: 2000, vence: '2026-09-15' });
  assert.equal(filas[0].cobrado, 1000);
  assert.equal(filas[0].vendido, 3000);
});

test('A quién cobrarle: un empate de vencimiento va por lo que más se debe, y después por nombre', () => {
  const { filas } = armarCobranza([
    lead(1, 'Zoe', 100, '2026-10-20'),
    lead(2, 'Ana', 900, '2026-10-20'),
    lead(3, 'Bruno', 100, '2026-10-20'),
  ], HOY);
  assert.deepEqual(filas.map((f) => f.nombre), ['Ana', 'Bruno', 'Zoe']);
});

test('A quién cobrarle: URGENTE es lo ya vencido; lo que vence hoy o en 5 días es «pronto»; lo demás, nada', () => {
  const { filas } = armarCobranza([
    lead(1, 'Ayer', 100, '2026-10-10'),
    lead(2, 'Hoy', 100, '2026-10-11'),
    lead(3, 'Cinco', 100, '2026-10-16'),
    lead(4, 'Seis', 100, '2026-10-17'),
    lead(5, 'Sin fecha', 100, null),
  ], HOY);
  const por = Object.fromEntries(filas.map((f) => [f.nombre, { dias: f.dias, urgencia: f.urgencia }]));
  assert.deepEqual(por['Ayer'], { dias: -1, urgencia: 'vencida' });
  assert.deepEqual(por['Hoy'], { dias: 0, urgencia: 'pronto' });
  assert.deepEqual(por['Cinco'], { dias: 5, urgencia: 'pronto' });
  assert.deepEqual(por['Seis'], { dias: 6, urgencia: null });
  assert.deepEqual(por['Sin fecha'], { dias: null, urgencia: null });
  // Un cambio de mes y de año no se come un día (UTC, no la hora local).
  assert.equal(diasHasta('2027-01-01', '2026-12-31'), 1);
  assert.equal(urgenciaDe(-30), 'vencida');
});

test('A quién cobrarle: el total es la suma de lo PENDIENTE de las filas que se dibujan', () => {
  const { filas, total } = armarCobranza([lead(1, 'A', 1500, '2026-10-01'), lead(2, 'B', 250.5, null), lead(3, 'C', 0, '2026-10-30')], HOY);
  assert.equal(total, 1750.5);
  assert.equal(total, filas.reduce((s, f) => s + f.pendiente, 0));
  // Sin cuota no hay «Marcar cobrado» (la fila se dibuja igual).
  const sin = armarCobranza([lead(9, 'Sin cuota', 300, null, { proxima_cuota: null })], HOY).filas[0];
  assert.equal(sin.cuota, null);
  assert.equal(armarCobranza([], HOY).total, 0);
});

// ── La ventana y el período ───────────────────────────────────────────────────────────────────

test('la ventana del Outstanding mira hasta el FIN DE MES del período; con «Todo», el pipeline entero', () => {
  const ult30 = rangoDe('ult30', HOY);
  assert.deepEqual(ventanaOutstanding(ult30.desde, ult30.hasta), { desde: ult30.desde, hasta: '2026-10-31' });
  const todo = rangoDe('todo', HOY);
  assert.equal(todo.desde, DESDE_TODO);
  assert.deepEqual(ventanaOutstanding(todo.desde, todo.hasta), { desde: null, hasta: null });
  // «Últimos 12 meses» arranca el 1/11/2025: con la vara de la vieja (<= 2025-11-01) era «todo el pipeline».
  const doce = rangoDe('ult12m', HOY);
  assert.equal(doce.desde, '2025-11-01');
  assert.deepEqual(ventanaOutstanding(doce.desde, doce.hasta), { desde: '2025-11-01', hasta: '2026-10-31' });
  assert.equal(textoVentana({ desde: '2026-09-12', hasta: '2026-10-31' }), '12/09/2026 → 31/10/2026');
  assert.equal(textoVentana({ desde: null, hasta: null }), 'todo el pipeline');
});

test('Sold y Cash se miden hasta hoy; un período que termina después se acota, y uno futuro no se da vuelta', () => {
  assert.equal(hastaHoy('2026-10-01', '2026-10-31', HOY), HOY);
  assert.equal(hastaHoy('2026-09-01', '2026-09-30', HOY), '2026-09-30');
  assert.equal(hastaHoy('2026-11-01', '2026-11-30', HOY), '2026-11-01');
});

test('la barra cobrado/pendiente suma 100, y sin nada de los dos lados no inventa una deuda', () => {
  assert.deepEqual(partesBarra(750, 250), { cash: 75, out: 25 });
  assert.deepEqual(partesBarra(1, 2), { cash: 33, out: 67 });
  assert.equal(partesBarra(0, 0), null);
  assert.deepEqual(partesBarra(0, 500), { cash: 0, out: 100 });
});

// ── Cohortes ──────────────────────────────────────────────────────────────────────────────────

const semana = (inicio: string, estado: CohorteSemana['estado_madurez'] = 'madura'): CohorteSemana => ({
  semana_inicio: inicio, total_j1: 4, asistencias: 3, limpias: 2, cierres: 1, ingreso_total_usd: 3000,
  ultima_j1_cohorte: inicio, dias_desde_ultima_j1: 20, estado_madurez: estado, dias_promedio_ciclo: null,
});
const mes = (inicio: string): CohorteMes => ({
  mes_inicio: inicio, total_j1: 10, asistencias: 7, limpias: 5, cierres: 2, ingreso_total_usd: 6000,
  ultima_j1_cohorte: inicio, dias_desde_ultima_j1: 20, dias_promedio_ciclo: 8.5, estado_madurez: 'madura',
});
const j1 = (leadId: number, fechaJ1: string): FunnelLeadItem => ({
  leadId, nombre: `Lead ${leadId}`, empresa: null, fechaJ1, asistioJ1: true, calificado: true, cerro: false, monto: null, estado: 'abierto' as FunnelLeadItem['estado'],
});

test('una semana entra si toca el período (su lunes desde el lunes del inicio); un mes, desde el día 1', () => {
  // Período 07/10 → 11/10/2026 (miércoles a domingo). El lunes de esa semana es el 05/10.
  assert.equal(cohorteEnRango('2026-10-05', 'semana', '2026-10-07', '2026-10-11'), true);
  assert.equal(cohorteEnRango('2026-09-28', 'semana', '2026-10-07', '2026-10-11'), false);
  assert.equal(cohorteEnRango('2026-10-12', 'semana', '2026-10-07', '2026-10-11'), false);
  // Donde la vara de la vieja (el día 1 del mes del inicio) se equivoca, en las dos direcciones:
  // una semana del mismo mes que ya terminó antes del período, y la que arrancó el mes anterior y lo toca.
  assert.equal(cohorteEnRango('2026-10-05', 'semana', '2026-10-14', '2026-10-18'), false);
  assert.equal(cohorteEnRango('2026-09-28', 'semana', '2026-10-01', '2026-10-31'), true);
  assert.equal(cohorteEnRango('2026-10-01', 'mes', '2026-10-07', '2026-10-11'), true);
  assert.equal(cohorteEnRango('2026-09-01', 'mes', '2026-10-07', '2026-10-11'), false);
});

test('se dibujan las cohortes MÁS RECIENTES del período (8 semanas, 6 meses), aunque el período sea pasado', () => {
  const semanas = Array.from({ length: 20 }, (_, i) => semana(new Date(Date.UTC(2026, 5, 1 + i * 7)).toISOString().slice(0, 10)));
  const elegidas = cohortesDelPeriodo(semanas, 'semana', '2026-06-01', '2026-12-31');
  assert.equal(elegidas.length, 8);
  assert.equal(elegidas[0].semana_inicio, '2026-10-12');
  // «El año pasado» con meses de 2025 en la lectura: salen ESOS, no un vacío (la vieja recortaba antes).
  const meses = ['2026-10-01', '2026-09-01', '2025-12-01', '2025-11-01'].map(mes);
  assert.deepEqual(cohortesDelPeriodo(meses, 'mes', '2025-01-01', '2025-12-31').map((m) => m.mes_inicio), ['2025-12-01', '2025-11-01']);
});

test('los leads de cada cohorte: el lunes de la semana o el mes de su reunión 1, y sólo de las que se dibujan', () => {
  const leads = [j1(1, '2026-10-07'), j1(2, '2026-10-11'), j1(3, '2026-10-12'), j1(4, '2026-08-03')];
  const porSemana = agruparLeadsPorCohorte(leads, [semana('2026-10-05'), semana('2026-10-12')], 'semana');
  assert.deepEqual(Object.keys(porSemana).sort(), ['2026-10-05', '2026-10-12']);
  assert.deepEqual(porSemana['2026-10-05'].map((l) => l.leadId), [1, 2]);
  const porMes = agruparLeadsPorCohorte(leads, [mes('2026-10-01')], 'mes');
  assert.deepEqual(Object.keys(porMes), ['2026-10']);
  assert.equal(porMes['2026-10'].length, 3);
});

test('la línea del SCL: el origen del primer tramo y el destino de cada uno', () => {
  const tramos = ['Formulario → Agenda', 'Agenda → Reunión 1', 'Reunión 1 → Reunión 2'].map((label) => ({ label, dias_promedio: 1, n: 3 }));
  assert.deepEqual(nodosDeTramos({ tramos, tramo_mas_lento: null, total_dias: 3 }), ['Formulario', 'Agenda', 'Reunión 1', 'Reunión 2']);
  assert.deepEqual(nodosDeTramos({ tramos: [], tramo_mas_lento: null, total_dias: null }), []);
});

// ── Lo que no es de Comercial se delega ───────────────────────────────────────────────────────

// El cableado: el server y la pantalla se leen del FUENTE (el server es `server-only`).
const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (ruta: string) => sinComentarios(readFileSync(resolve(__dirname, '..', ruta), 'utf8'));

test('datosDeBloques reparte y le pasa a datosDeBloquesExtra SÓLO los extra; CuerpoBloque le pasa los mismos props a CuerpoBloqueExtra', () => {
  const srv = leer('lib/graficos-bloques.ts');
  const ini = srv.indexOf('export async function datosDeBloques(');
  assert.ok(ini > 0, 'falta datosDeBloques');
  const cuerpo = srv.slice(ini);
  assert.match(cuerpo, /const \{ propios, extra \} = repartirPedidos\(pedidos\);/);
  assert.match(cuerpo, /datosDeBloquesExtra\(extra\)/);
  assert.doesNotMatch(cuerpo, /datosDeBloquesExtra\(pedidos\)/);
  // Lo que devuelve el extra llega tal cual a la respuesta.
  assert.match(cuerpo, /out\[p\.id\] = r\[p\.id\]/);

  const ui = leer('app/dashboard/bloques/CuerpoBloque.tsx');
  const f = ui.slice(ui.indexOf('export function CuerpoBloque('));
  const primero = f.slice(f.indexOf('{', f.indexOf(') {')), f.indexOf('const d = payloadDe('));
  assert.match(primero, /if \(!esBloqueComercial\(b\.bloque\)\) \{\s*return <CuerpoBloqueExtra b=\{b\} estado=\{estado\} estilo=\{estilo\} desde=\{desde\} hasta=\{hasta\} onRefrescar=\{onRefrescar\} \/>;/);
});

// Martín, 11/10/2026: «Que muestre todas y para eso tenemos filtros dentro de un elemento». Con el filtro de
// fecha de la hoja en 30 días, el funnel maduro y las cohortes quedaban con 1-2 cohortes. Su período propio
// le gana al control de la hoja (efectivoDe) y se acota con el control del bloque.
// Probado rompiéndolo (base 14 / 0): sin `periodo: 'todo'` en las cohortes semanales -> 13 / 1.
// Martín, 11/10/2026, sobre «Marcar cobrada»: «Cualquiera con acceso a esa tab». La action no tenía guarda
// (la llamaba cualquiera con su id) ni miraba que la cuota fuera del lead que recibe.
// Probado rompiéndolo (base 15 / 0): sin la llamada a la guarda -> 14 / 1; sin el chequeo del lead -> 14 / 1.
test('«Marcar cobrada»: sesión, acceso a la tab (CRM o Dashboard) y la cuota tiene que ser de ese lead', () => {
  const src = readFileSync(resolve(__dirname, '../app/crm/actions.ts'), 'utf8').replace(/\r\n/g, '\n');
  const ini = src.indexOf('export async function marcarPagoAction(');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.match(cuerpo, /\): Promise<void> \{\n  await exigirAccesoAMarcarPago\(pagoId, leadId\);\n  await marcarPago\(/, 'la guarda va ANTES de escribir');
  const g = src.slice(src.indexOf('async function exigirAccesoAMarcarPago('), src.indexOf('\n}\n', src.indexOf('async function exigirAccesoAMarcarPago(')));
  assert.match(g, /if \(rol == null\) throw/);
  assert.match(g, /tabEnCapa\('crm', capa\)/);
  assert.match(g, /rol === 'admin' && tabEnCapa\('graphics', capa\)/);
  assert.match(g, /\.eq\('id', pagoId\)\.eq\('workspace_id', ws \?\? -1\)/);
  assert.match(g, /!== Number\(leadId\)\) throw/);
  assert.doesNotMatch(src, /export async function exigirAccesoAMarcarPago/, 'un archivo use server sólo exporta las actions');
});
