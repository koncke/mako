// =============================================================================
// La aritmética del análisis de negocio, con los casos REALES del 31/07/2026
// =============================================================================
// Cada test de acá abajo es un momento de esa reunión donde el número salió mal,
// o casi. No son casos inventados: son la cuenta que se hizo con la calculadora
// del celular, con sus errores.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  costoPor, tasa, cuadratura, planDesdeMeta, ordenarCreativos, creativosEscondidos,
  medianaCosto, type Creativo,
} from '../lib/analisis-modelo';

// ── El chequeo que salvó la reunión ──────────────────────────────────────────

test('CUADRATURA: caza el «histórico» que arrastraba meses de otro rango', () => {
  // El caso literal: el dashboard declaraba 76 agendas para el período que
  // estaban mirando, pero mes a mes daban 57 — el resto venía de noviembre del
  // año anterior. Con 76 el costo por agenda daba 99,53; con 57 daba 132.
  const c = cuadratura(76, [12, 16, 14, 12, 3], 0);
  assert.equal(c.cuadra, false);
  assert.equal(c.suma_partes, 57);
  assert.equal(c.diferencia, 19);
  assert.match(c.nota, /No uses el total: usá la suma/);
});

test('CUADRATURA: cuando cuadra, no dice nada', () => {
  const c = cuadratura(57, [12, 16, 14, 12, 3], 0);
  assert.equal(c.cuadra, true);
  assert.equal(c.nota, '');
});

test('CUADRATURA: la tolerancia es para el redondeo del gasto, no para tapar', () => {
  // Centavos de diferencia sobre miles: eso es redondeo.
  assert.equal(cuadratura(1000.4, [500.1, 500.0], 1).cuadra, true);
  // 19 agendas de diferencia NO es redondeo, y con tolerancia 1 tampoco pasa.
  assert.equal(cuadratura(76, [57], 1).cuadra, false);
});

// ── Los costos por escalón ───────────────────────────────────────────────────

test('el costo por escalón reproduce los cuatro números de la reunión', () => {
  const inv = 7565;
  assert.equal(costoPor(inv, 57), 132.72);   // por agenda, ya corregido
  assert.equal(costoPor(inv, 41), 184.51);   // por asistencia — el «CAC total»
  assert.equal(costoPor(inv, 20), 378.25);   // por calificado
  assert.equal(costoPor(inv, 9), 840.56);    // por cliente
});

test('SIN DENOMINADOR NO HAY COSTO: cero devuelve null, nunca Infinity ni 0', () => {
  // «¿Cuánto me costó una agenda?» en un mes sin agendas no es infinito ni cero:
  // es una pregunta sin respuesta. Un número ahí se lee como una medición.
  assert.equal(costoPor(7565, 0), null);
  assert.equal(costoPor(null, 41), null);
  assert.equal(tasa(0, 5), null);
});

test('las tasas del negocio salen de dividir escalones consecutivos', () => {
  assert.equal(tasa(57, 41), 0.7193);  // show rate
  assert.equal(tasa(41, 9), 0.2195);   // cierre sobre asistencias
});

// ── La calculadora inversa ───────────────────────────────────────────────────

test('EL PLAN QUE SE CONTRADECÍA: 1.500 de presupuesto contra 27 agendas', () => {
  // Lo que se acordó en la reunión: 3 cierres/mes. Con las tasas medidas eso da
  // ~27 agendas, y a ~100 USD cada una son 2.700 — pero fijaron 1.500 (que venía
  // de «3 cierres × 500 de CAC objetivo»). Las dos mitades del MISMO plan no
  // podían ser ciertas a la vez, y nadie lo marcó.
  const p = planDesdeMeta({
    cierresObjetivo: 3, showRate: 0.5, tasaCierre: 0.25,
    costoPorAgenda: 100, presupuestoPropuesto: 1500,
  });
  assert.equal(p.asistencias_necesarias, 12);
  assert.equal(p.agendas_necesarias, 24);
  assert.equal(p.inversion_necesaria, 2400);
  assert.match(p.contradiccion, /se contradice/);
  assert.match(p.contradiccion, /2400/);
  assert.match(p.contradiccion, /1500/);
  // Y ofrece las tres salidas, que son decisiones distintas del dueño.
  // `[\s\S]` y no el flag /s: el target de tsconfig es anterior a es2018.
  assert.match(p.contradiccion, /sube el presupuesto[\s\S]*baja la meta[\s\S]*abaratar/);
});

test('si el presupuesto alcanza, no inventa una contradicción', () => {
  const p = planDesdeMeta({
    cierresObjetivo: 3, showRate: 0.5, tasaCierre: 0.25,
    costoPorAgenda: 100, presupuestoPropuesto: 3000,
  });
  assert.equal(p.contradiccion, '');
});

test('sin tasas medidas no se inventa un plan', () => {
  // Derivar con la tasa que uno quisiera tener es planificar sobre un negocio
  // que no existe. Sin dato, null.
  const p = planDesdeMeta({ cierresObjetivo: 3, showRate: null, tasaCierre: null, costoPorAgenda: null });
  assert.equal(p.asistencias_necesarias, null);
  assert.equal(p.agendas_necesarias, null);
  assert.equal(p.inversion_necesaria, null);
  assert.equal(p.contradiccion, '');
});

test('los supuestos viajan con el plan, para poder auditarlo', () => {
  const p = planDesdeMeta({ cierresObjetivo: 4, showRate: 0.5, tasaCierre: 0.25, costoPorAgenda: 132 });
  assert.deepEqual(p.supuestos, { show_rate: 0.5, tasa_cierre: 0.25, costo_por_agenda: 132 });
});

// ── El ranking de creativos ──────────────────────────────────────────────────

const ad = (id: string, nombre: string, agendas: number, inversion: number): Creativo => ({
  ad_id: id, nombre, agendas, inversion,
  costo_por_agenda: costoPor(inversion, agendas),
  impresiones: 0, dias_al_aire: 1, primera_fecha: '2026-04-01', ultima_fecha: '2026-04-30',
});

test('EL HALLAZGO DE ABRIL: mismo volumen, 4,5x de diferencia en costo', () => {
  // Dos creativos trajeron 3 agendas cada uno: uno a 22 USD y otro a 100.
  // Por CANTIDAD empatan; por COSTO son otra cosa. El ranking que ordena por
  // volumen y solo desempata por costo esconde al ganador real — y el ganador
  // real de esa tanda nunca se replicó.
  const creativos = [
    ad('a', 'barato de abril', 3, 66),
    ad('b', 'caro de abril', 3, 300),
    ad('c', 'el de mayo', 9, 900),
  ];
  const porVolumen = ordenarCreativos(creativos, 'volumen');
  const porCosto = ordenarCreativos(creativos, 'costo');

  assert.equal(porVolumen[0].ad_id, 'c', 'por volumen gana el de 9 agendas');
  assert.equal(porCosto[0].ad_id, 'a', 'por costo gana el de 22 USD/agenda');
  assert.notEqual(porVolumen[0].ad_id, porCosto[0].ad_id, 'los dos rankings dan ganadores DISTINTOS');
  assert.equal(porCosto[0].costo_por_agenda, 22);
  assert.equal(porCosto[1].costo_por_agenda, 100);
});

test('el desempate por volumen es el costo, y al revés', () => {
  const creativos = [ad('a', 'barato', 3, 66), ad('b', 'caro', 3, 300)];
  // Empatados en 3 agendas: primero el más barato.
  assert.equal(ordenarCreativos(creativos, 'volumen')[0].ad_id, 'a');
  // Empatados en costo: primero el de más volumen.
  const mismos = [ad('x', 'poco', 2, 200), ad('y', 'mucho', 8, 800)];
  assert.equal(ordenarCreativos(mismos, 'costo')[0].ad_id, 'y');
});

test('un creativo sin agendas no entra al ranking: no tiene costo por agenda', () => {
  const creativos = [ad('a', 'trajo', 3, 66), ad('z', 'no trajo nada', 0, 500)];
  assert.equal(ordenarCreativos(creativos, 'costo').length, 1);
  assert.equal(ordenarCreativos(creativos, 'volumen').length, 1);
});

test('ESCONDIDOS: los baratos con poco volumen que el ranking por cantidad tapa', () => {
  // El caso de la reunión: el ganador real se encontró de casualidad, recorriendo
  // anuncios uno por uno durante 20 minutos.
  const creativos = [
    ad('big1', 'mucho volumen caro', 20, 6000),   // 300/ag
    ad('big2', 'mucho volumen caro 2', 18, 5400), // 300/ag
    ad('big3', 'volumen medio', 12, 3600),        // 300/ag
    ad('big4', 'volumen medio 2', 10, 3000),      // 300/ag
    ad('big5', 'volumen medio 3', 9, 2700),       // 300/ag
    ad('joya', 'la joya escondida', 3, 66),       // 22/ag  ← ésta
  ];
  const esc = creativosEscondidos(creativos, 2);
  assert.ok(esc.some((c) => c.ad_id === 'joya'), 'la joya tiene que aparecer');
  assert.ok(!esc.some((c) => c.ad_id === 'big1'), 'los del top de volumen NO son «escondidos»');
});

test('ESCONDIDOS: con menos de 3 creativos no hay mediana que valga', () => {
  assert.deepEqual(creativosEscondidos([ad('a', 'uno', 3, 66)], 2), []);
});

test('la mediana da contra qué decir «caro» o «barato»', () => {
  const creativos = [ad('a', '', 1, 100), ad('b', '', 1, 200), ad('c', '', 1, 300)];
  assert.equal(medianaCosto(creativos), 200);
  // Se usa mediana y no promedio: un solo anuncio carísimo arrastra el promedio
  // y deja de separar.
  const conOutlier = [...creativos, ad('d', '', 1, 10000)];
  assert.equal(medianaCosto(conOutlier), 300, 'la mediana aguanta el outlier');
});

test('sin creativos con costo, la mediana es null y no 0', () => {
  assert.equal(medianaCosto([ad('a', 'sin agendas', 0, 500)]), null);
  assert.equal(medianaCosto([]), null);
});
