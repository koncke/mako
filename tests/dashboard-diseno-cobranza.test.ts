// La hoja Cobranza con su DISEÑO PROPIO (la copia de Coffer): lo que se guarda, lo que dibuja cada bloque y lo que no se
// inventa. Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco». Ver
// docs/relevo/nube-dashboards.md («Cobranza») y lib/cobranza-diseno.ts.
//
// Probado rompiéndolo (4/11/2026, contra una base de 7 verdes): sacar `diseno` de la plantilla → 2 rojos (1 y 5); dibujar sólo
// los tramos con cuotas → 1 rojo (3); ordenar lo que entró por la etiqueta «dd/mm» como texto → 1 rojo (4); no reconocer
// «Este mes completo» → 2 rojos (5 y 6); ordenar «A quién perseguir» por monto en vez de por atraso → 1 rojo (4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearHoja } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, esPlantillaOfrecida, instanciarPlantilla } from '../lib/graficos-plantillas';
import { diasConSigno, tramoDeAtraso, TRAMOS_ATRASO } from '../lib/graficos-datos-puro';
import {
  debenDe, escalaFlujo, funnelDe, mesesDe, nombresDelPeriodo, notaAnterior, notaDemora, perseguirDe, plata, plataCorta, rotuloDia,
  textoDeDias, textoDemora, ultimosDe, vistaCobranza, type DatosPieza,
} from '../lib/cobranza-diseno';
import type { Resultado } from '../lib/graficos-agregar';

const plantilla = () => PLANTILLAS_HOJA.find((p) => p.id === 'cobranza')!;
const res = (columnas: string[], totales: Array<number | null>, filas: Resultado['filas'] = [], anterior?: Array<number | null>): Resultado =>
  ({ columnas: columnas.map((id) => ({ id, nombre: id, formato: 'numero' })), filas, totales, fuera: 0, clase: null, ...(anterior ? { anterior } : {}) }) as unknown as Resultado;
const fila = (clave: string, valores: number[], extra?: Record<string, string>) => ({ clave, etiqueta: clave, valores, ...(extra ? { extra } : {}) });
const pieza = (r: Resultado): DatosPieza => ({ cargando: false, resultado: r });

test('1 · la plantilla Cobranza nace con su diseño, cada pieza apunta a un componente y «Nueva hoja» la ofrece', () => {
  const h = instanciarPlantilla(plantilla());
  assert.equal(h.diseno?.id, 'cobranza');
  const ids = new Set(h.componentes.map((c) => c.id));
  for (const p of ['atraso', 'cobrado', 'vence', 'falta', 'demora', 'meses', 'perseguir', 'ultimos', 'pagaron', 'funnel']) {
    assert.ok(h.diseno?.piezas[p], `falta la pieza ${p}`);
    assert.ok(ids.has(h.diseno!.piezas[p]), `la pieza ${p} no apunta a un componente`);
  }
  assert.deepEqual(sanearHoja(h, 0)?.diseno, h.diseno, 'el diseño se pierde al guardar');
  assert.ok(esPlantillaOfrecida(plantilla()), 'con su diseño copiado, «Nueva hoja» la tiene que ofrecer');
});

test('2 · los tramos de atraso: al día hasta el vencimiento, después por días, y el atraso al pagar con signo', () => {
  assert.equal(tramoDeAtraso('2026-11-04', '2026-11-04'), 'Al día');
  assert.equal(tramoDeAtraso('2026-11-10', '2026-11-04'), 'Al día');
  assert.equal(tramoDeAtraso('2026-11-03', '2026-11-04'), '1-30 días');
  assert.equal(tramoDeAtraso('2026-10-05', '2026-11-04'), '1-30 días');
  assert.equal(tramoDeAtraso('2026-10-04', '2026-11-04'), '31-60 días');
  assert.equal(tramoDeAtraso('2026-08-01', '2026-11-04'), '60+ días');
  assert.equal(tramoDeAtraso(null, '2026-11-04'), 'Al día');
  assert.equal(diasConSigno('2026-11-04', '2026-11-01'), -3, 'pagar antes de vencer es negativo, no un dato roto');
});

test('3 · «Te deben»: los cuatro tramos siempre, en su orden, y lo vencido es lo que no está al día', () => {
  const r = res(['pendiente', 'pagos', 'clientes'], [9664 + 31516, 18, 9], [
    fila('60+ días', [2475, 1, 1]), fila('Al día', [31516, 15, 7]), fila('1-30 días', [7189, 2, 2]),
  ]);
  const d = debenDe(r)!;
  assert.deepEqual(d.tramos.map((t) => t.nombre), [...TRAMOS_ATRASO]);
  assert.equal(d.tramos[2].monto, 0, 'un tramo sin cuotas dice 0, no desaparece');
  assert.equal(d.total, 41180);
  assert.equal(d.vencido, 9664);
  assert.equal(d.vencidas, 3);
  assert.equal(d.clientes, 9);
  assert.equal(debenDe(null), null, 'sin la pieza no hay número');
});

test('4 · el flujo, a quién perseguir, lo último que entró y el anillo', () => {
  const m = mesesDe(res(['cobrado', 'pendiente'], [null, null], [fila('2026-10-01', [18385, 3015]), fila('2026-11-01', [4570, 2250])]))!;
  assert.deepEqual(m.map((x) => [x.clave, x.entro, x.sinPagar]), [['2026-10-01', 18385, 3015], ['2026-11-01', 4570, 2250]]);

  const per = perseguirDe(res(['pendiente', 'proxima_monto', 'dias'], [null, null, null], [
    fila('Diego Fuentes', [2007.5, 2007.5, -2], { proxima: 'Cuota 4' }), fila('Carlos Méndez', [2475, 2475, -67], { proxima: 'Cuota 3' }),
    fila('(sin dato)', [1, 1, -99]), fila('Lucía Ramos', [5181, 5181, -5], { proxima: 'Cuota 2' }), fila('Ana Paz', [100, 100, 9]),
  ]));
  assert.deepEqual(per.map((f) => f.nombre), ['Carlos Méndez', 'Lucía Ramos', 'Diego Fuentes'], 'el más atrasado arriba, sin «(sin dato)», tres');
  assert.equal(per[0].cuota, 'Cuota 3');

  // Las etiquetas «dd/mm» se ordenan como fechas (como las de Closing), no como texto.
  const ult = ultimosDe(res(['cobrado'], [null], [
    fila('Ana Ruiz · Cuota 2', [600], { dia: '28/10' }), fila('Sofía Herrera · Cuota 1', [1200], { dia: '04/11' }), fila('Pablo Ortiz · Cuota 5', [0], { dia: '04/11' }),
  ]), '2026-11-04');
  assert.deepEqual(ult.map((f) => [f.nombre, f.cuota, f.dia]), [['Sofía Herrera', 'Cuota 1', '2026-11-04'], ['Ana Ruiz', 'Cuota 2', '2026-10-28']]);

  const f = funnelDe(res(['pendiente'], [null], ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => fila(n, [700 - i * 100]))))!;
  assert.equal(f.filas.length, 5);
  assert.equal(f.filas[4].nombre, 'Otros');
  assert.equal(f.filas[4].monto, 300 + 200 + 100);
  assert.equal(f.total, 700 + 600 + 500 + 400 + 300 + 200 + 100);
});

test('5 · la vista entera sale de las piezas de la hoja, y lo que no llegó es null', () => {
  const h = instanciarPlantilla(plantilla());
  const p = h.diseno!.piezas;
  const v = vistaCobranza(h, {
    [p.cobrado]: pieza(res(['cobrado'], [4570], [], [18385])),
    [p.demora]: pieza(res(['atraso_pago'], [6], [], [4])),
  }, '2026-11-04');
  assert.deepEqual(v.cobrado, { valor: 4570, anterior: 18385 });
  assert.deepEqual(v.vence, { valor: null, anterior: null }, 'una pieza sin datos no inventa un cero');
  assert.equal(v.deben, null);
  assert.equal(v.meses, null);
  assert.deepEqual(v.perseguir, []);
  assert.equal(notaDemora(v.demora, 'Este mes completo')?.texto, '2 días más que el mes pasado');
  assert.equal(notaDemora(v.demora, 'Este mes completo')?.peor, true);
});

test('6 · lo que se escribe: la plata, los días, el período y su anterior', () => {
  assert.equal(plata(41179), 'US$41,179');
  assert.equal(plata(2007.5, true), 'US$2,007.50');
  assert.equal(plataCorta(41179), 'US$41.2K');
  assert.equal(plataCorta(41000), 'US$41K');
  assert.deepEqual(textoDeDias(-67), { texto: '67 días tarde', tarde: true });
  assert.deepEqual(textoDeDias(0), { texto: 'Vence hoy', tarde: false });
  assert.equal(textoDemora(6), '6 días');
  assert.equal(textoDemora(-2), '2 días antes');
  assert.equal(rotuloDia('2026-11-04', '2026-11-04'), 'Hoy');
  assert.equal(rotuloDia('2026-11-03', '2026-11-04'), 'Ayer');
  assert.equal(rotuloDia('2026-11-02', '2026-11-04'), 'Lun 2');
  assert.deepEqual(nombresDelPeriodo('Este mes completo'), { en: 'este mes', anterior: 'Mes pasado', queAnterior: 'que el mes pasado' });
  assert.equal(nombresDelPeriodo('Últimos 30 días').anterior, 'Los 30 días anteriores');
  assert.equal(nombresDelPeriodo('Personalizado').anterior, 'Período anterior', 'uno que no se conoce dice lo que siempre es verdad');
  assert.equal(notaAnterior({ valor: 1, anterior: 18385 }, plata, 'Este mes'), 'Mes pasado: US$18,385');
  assert.equal(notaAnterior({ valor: 1, anterior: null }, plata, 'Este mes'), null);
});

test('7 · la escala del flujo: redonda, con lo de abajo de la línea, y sin datos no dibuja nada', () => {
  const e = escalaFlujo([{ clave: 'a', etiqueta: 'a', entro: 51200, sinPagar: 3015 }]);
  assert.ok(e.max >= 51200 && e.min <= -3015 && e.min < 0, JSON.stringify(e));
  assert.equal((e.max - e.min) % e.paso, 0);
  assert.deepEqual(escalaFlujo([]), { min: 0, max: 1, paso: 1 });
});
