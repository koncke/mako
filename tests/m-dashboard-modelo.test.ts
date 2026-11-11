// =============================================================================
// MaKo Mobile — Dashboard en el teléfono: lo puro de app/m/dashboard/modelo.ts
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · la variación contra el período anterior: dirección, tono (Ad Spend que sube es malo), sin
//     porcentaje cuando el anterior es 0 y nada si falta un número;
//   · las etiquetas de una barra (día, semana, mes) y «vence …» de «A quién cobrarle»;
//   · la geometría del gráfico (techo redondo, ticks, ancho tope, sin NaN en el camino);
//   · el período de `?periodo=`: sólo los que la pantalla ofrece, y el propio de una hoja.
//
// Nació en el scratchpad del agente del Dashboard (11/10/2026, 4/4) y se sumó al repo en la
// integración. Verificado ROMPIÉNDOLO (base 4 / 0), de a una y restaurando
// (scratchpad/integ/romper.py):
//   · `deltaDe` con porcentaje sobre un anterior en 0                 → 3 / 1
//   · `textoVence` sin «venció hace N días» (todo «vence hoy»)        → 3 / 1
//   · `periodoDeParam` aceptando cualquier preset del pedido          → 3 / 1
// Y 10/11/2026: `faltaConectar` (la hoja Closing sin grabador decía «No es nada tuyo»). Rompiéndolo: devolver
// el texto aunque haya una lectura buena → 4 / 1; no mirar `sinConexion` (cualquier error) → 4 / 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deltaDe, etiquetaBarra, textoVence, geometria, pasoLindo, indiceEn, ejeCompacto, periodoDeParam, PERIODOS_MOVIL, periodosParaHoja, caminoBarra, conUnidad, esCostoSobreGasto, faltaConectar, noSeLeyo } from '../app/m/dashboard/modelo';

test('delta', () => {
  assert.deepEqual(deltaDe(112, 100, 'pct', true), { dir: 'up', tono: 'good', texto: '12%', etiqueta: 'Sube 12% contra el período anterior' });
  assert.equal(deltaDe(112, 100, 'pct', false)!.tono, 'bad');
  assert.equal(deltaDe(90, 100, 'pct', false)!.tono, 'good');
  assert.equal(deltaDe(5, 0, 'pct', true), null);
  assert.equal(deltaDe(null, 3, 'pct', true), null);
  assert.equal(deltaDe(3.04, 2.6, 'abs1', true)!.texto, '0,4');
  assert.equal(deltaDe(3.2, 3.6, 'abs1', true)!.dir, 'down');
  assert.equal(deltaDe(6, 4, 'abs', true)!.texto, '2');
  assert.equal(deltaDe(100.2, 100, 'pct', true)!.dir, 'igual');
  assert.equal(deltaDe(3, 3, 'abs', null)!.tono, 'neutro');
  assert.equal(deltaDe(25, 20, 'pts', null)!.texto, '5,0 pts');
});
test('etiquetas', () => {
  assert.deepEqual(etiquetaBarra('dia', '2026-10-11'), { eje: '11 oct', titulo: '11 oct' });
  assert.deepEqual(etiquetaBarra('semana', '2026-10-05'), { eje: '5 oct', titulo: 'Sem. del 5 oct' });
  assert.deepEqual(etiquetaBarra('mes', '2026-10-01'), { eje: 'oct 26', titulo: 'oct 2026' });
  assert.equal(textoVence('2026-10-11', 0), 'vence hoy');
  assert.equal(textoVence('2026-10-15', 4), 'vence el jue');
  assert.equal(textoVence('2026-10-25', 14), 'vence el 25 oct');
  assert.equal(textoVence('2026-10-08', -3), 'venció hace 3 días');
  assert.equal(textoVence(null, null), 'sin fecha');
});
test('geometria', () => {
  assert.equal(pasoLindo(12, true), 5);
  assert.equal(pasoLindo(1, true), 1);
  assert.equal(pasoLindo(6000, false), 2000);
  const g = geometria([5, 7, 0, 12], true);
  assert.equal(g.techo, 15);
  assert.deepEqual(g.ticks, [0, 5, 10, 15]);
  assert.ok(g.barras.every((b) => b.w <= 24));
  assert.equal(g.barras[2].h, 0);
  assert.deepEqual(g.marcas, [0, 1, 3]);
  const z = geometria([0, 0, 0], true);
  assert.equal(z.techo, 1);
  assert.deepEqual(geometria([4], true).marcas, [0]);
  assert.equal(indiceEn(30, 30), 0);
  assert.equal(indiceEn(329, 30), 29);
  assert.equal(indiceEn(-50, 30), 0);
  assert.equal(ejeCompacto(2000), '2k');
  assert.equal(ejeCompacto(1500), '1,5k');
  assert.ok(!caminoBarra(g.barras[0]).includes('NaN'));
});
test('periodo', () => {
  assert.equal(periodoDeParam('ult90', PERIODOS_MOVIL, 'ult30').id, 'ult90');
  assert.equal(periodoDeParam('todo', PERIODOS_MOVIL, 'ult30').id, 'ult30');
  assert.equal(periodoDeParam(undefined, periodosParaHoja('todo'), 'todo').id, 'todo');
  assert.equal(periodosParaHoja('ult30').length, 4);
  assert.equal(periodosParaHoja('todo').length, 5);
});
test('falta conectar: nada leído y lo que volvió es «falta conectar» → ese texto; si no, null', () => {
  const grabador = { ok: false as const, error: 'Conecta tu grabador de reuniones (Fathom, tl;dv, Fireflies, Zoom…) en Integraciones', sinConexion: true as const };
  assert.equal(faltaConectar([grabador, grabador, undefined]), grabador.error);
  assert.equal(faltaConectar([grabador, { ok: true }]), null, 'con una lectura buena la hoja tiene algo que mostrar');
  assert.equal(faltaConectar([{ ok: false, error: 'No pude leer los datos' }]), null, 'una falla de verdad sigue siendo una falla');
  assert.equal(faltaConectar([]), null);
});
test('«no pudimos leer» sólo si las lecturas fallaron: leídas y sin datos no es una falla (11/11/2026, ws 3)', () => {
  assert.equal(noSeLeyo([{ ok: true }, { ok: true }]), false, 'Anuncio ganador sin datos en el período: se leyó bien');
  assert.equal(noSeLeyo([{ ok: false }, undefined]), true);
  assert.equal(noSeLeyo([{ ok: false }, { ok: true }]), false, 'con una buena hay algo que mostrar');
  assert.equal(noSeLeyo([]), false, 'sin números no hay nada que decir');
});
test('sin gasto no hay costo: el costo por agenda va «—» y Marketing dice la frase de su diseño (11/11/2026, ws 3)', async () => {
  assert.equal(esCostoSobreGasto({ razon: { num: 'gasto' } }), true, 'costo por agenda = gasto ÷ agendas');
  assert.equal(esCostoSobreGasto({ razon: { num: 'cobrado' } }), false, 'el ROAS no es un costo');
  assert.equal(esCostoSobreGasto(undefined), false);
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const src = readFileSync(join(__dirname, '..', 'app', 'm', 'dashboard', 'datos.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /if \(gastoCero && esCostoSobreGasto\(fuente \? metricaDe\(fuente, g\.metricas\[0\]\) : undefined\)\) return \{ id: g\.id, k: tituloDe\(g\), v: '—', delta: null \};/, '«Costo por agenda US$0» volvió');
  assert.match(src, /if \(h\.diseno\?\.id === 'marketing'\) \{[\s\S]{0,400}fraseMarketing\(total\('gasto'\), total\('agendas'\), total\('cpa'\)\)/, 'el teléfono volvió a la frase de la plantilla');
});
test('la unidad del catálogo va con el valor si el título no la dice: «Tiempo de respuesta 10 min» (11/11/2026)', () => {
  assert.equal(conUnidad('10', 'Mediana de respuesta (min)', 'Tiempo de respuesta'), '10 min');
  assert.equal(conUnidad('3', 'Atraso al pagar (días)', 'Atraso al pagar'), '3 días');
  assert.equal(conUnidad('1', 'Atraso al pagar (días)', 'Atraso al pagar'), '1 día');
  assert.equal(conUnidad('10', 'Mediana de respuesta (min)', 'Respuesta (min)'), '10', 'el título ya la dice');
  assert.equal(conUnidad('—', 'Mediana de respuesta (min)', 'Tiempo de respuesta'), '—', 'sin valor, sin unidad');
  assert.equal(conUnidad('5', 'Leads', 'Leads'), '5');
});
