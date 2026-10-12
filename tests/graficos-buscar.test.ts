// =============================================================================
// graficos-buscar — la búsqueda del Dashboard (tanda v5, punto 4 y 14): lo puro de lib/graficos-buscar.ts
// =============================================================================
// Qué fija, y por qué cada cosa no da un error si se rompe:
//   1. La comparación SIN ACENTOS con el mapa al texto ORIGINAL: si el mapa se corre una letra, el resalte
//      pinta la palabra de al lado (se ve «bien» de lejos) y el contador sigue diciendo lo correcto.
//   2. La búsqueda sobre los pedazos de la página: dos nodos del mismo grupo se leen juntos («12» y « leads»
//      de `{n} leads`), dos grupos nunca (el fin de una celda y el principio de la otra no son una palabra), sin
//      solaparse, con su tope, y una consulta vacía no encuentra «todo».
//   3. La tecla: Ctrl/Cmd+F enfoca la barra SÓLO con el foco en el Dashboard; con la barra ya enfocada es el del
//      navegador (decisión del contrato v5) y afuera no se le roba a nadie.
//   4. La barra de una tabla: su control es un `texto` propio sobre el campo de SU dimensión, y prenderla o
//      apagarla manda la lista ENTERA (un fijo que se pierda cambia el número de la tarjeta).
// Correr: npx tsx --test tests/graficos-buscar.test.ts
//
// Probado ROMPIÉNDOLO (12/10/2026, scratchpad/p4v5-romper.mjs: una rotura por vez sobre la base en verde,
// restaurada de MEMORIA y comparada byte a byte, nunca con git). Base: 9 pasan / 0 fallan. Cada rotura (pasan / fallan):
//   · `comparable` sin sacar las marcas (los acentos cuentan)          → 7 / 2
//   · una racha de espacios sin colapsar                                → 8 / 1
//   · `fin` sin el largo del punto de código (corta un emoji)           → 8 / 1
//   · los pedazos del mismo grupo SEPARADOS (como si fueran dos grupos) → 8 / 1
//   · sin el separador entre grupos                                     → 8 / 1
//   · la búsqueda SOLAPANDO (desde = a + 1)                             → 8 / 1
//   · sin el tope                                                       → 8 / 1
//   · la consulta sin normalizar (sin `consultaPlana`)                  → 8 / 1
//   · `vecina` sin dar la vuelta                                       → 8 / 1
//   · `atajoBuscar` sin mirar el foco                                  → 8 / 1
//   · `atajoBuscar` aceptando Shift                                    → 8 / 1
//   · `parcheBuscarEnTabla` sin la marca                               → 8 / 1
//   · `parcheBuscarEnTabla` borrando lo demás de `tabla`               → 8 / 1
//   · `parcheBuscarEnTabla` sin la lista de controles entera           → 8 / 1
//   · `motivoSinBusqueda` sin mirar el id de la barra                  → 8 / 1
//   · `campoDeBusqueda` sin mirar si es una tabla                      → 7 / 2
// ⚠️ La guarda `if (!q)` de una consulta vacía NO se puede probar rompiéndola: sin ella, `indexOf('')` encuentra
//    la coincidencia vacía en el mismo lugar para siempre y el test se cuelga en vez de fallar. Por eso está.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aPlano, atajoBuscar, buscarEnSegmentos, campoDeBusqueda, consultaPlana, motivoSinBusqueda, parcheBuscarEnTabla, textoContador, vecina, type Segmento } from '../lib/graficos-buscar';
import { sanearControles, sanearGrafico, type ControlVista } from '../lib/graficos-catalogo';

/** El pedazo ORIGINAL que cubre cada coincidencia (lo que el resalte pintaría). */
const pintado = (segs: Segmento[], q: string) => buscarEnSegmentos(segs, q).resultados.map((m) => {
  if (m.desde.seg === m.hasta.seg) return segs[m.desde.seg].texto.slice(m.desde.off, m.hasta.off);
  let s = segs[m.desde.seg].texto.slice(m.desde.off);
  for (let k = m.desde.seg + 1; k < m.hasta.seg; k++) s += segs[k].texto;
  return s + segs[m.hasta.seg].texto.slice(0, m.hasta.off);
});

test('el plano: sin acentos, en minúsculas, cada racha de espacios es UNO, y el mapa vuelve al original', () => {
  const p = aPlano('Promoción  ÑANDÚ \n 🎯x');
  assert.equal(p.plano, 'promocion nandu 🎯x'.replace('🎯', '🎯'));
  assert.equal(p.plano.length, p.ini.length);
  assert.equal(p.ini.length, p.fin.length);
  // La «o» de «ción» es la letra 7 del original; el espacio colapsado cubre los dos del original.
  assert.deepEqual([p.ini[7], p.fin[7]], [7, 8]);
  assert.deepEqual([p.ini[9], p.fin[9]], [9, 11], 'la racha de dos espacios es UN espacio que cubre los dos');
  // Un emoji (dos unidades UTF-16) no se parte: sus dos letras del plano cubren el punto de código entero.
  const iEmoji = p.plano.indexOf('\ud83c');
  assert.deepEqual([p.ini[iEmoji], p.fin[iEmoji], p.ini[iEmoji + 1], p.fin[iEmoji + 1]], [19, 21, 19, 21]);
  // Escrito descompuesto (la «U» y la tilde por separado), igual da «u».
  assert.equal(aPlano('Últimos').plano, 'ultimos');
  assert.equal(consultaPlana('  Prómo\u0000ción  '), 'promo cion', 'la consulta sin puntas ni caracteres de control');
});

test('buscar: sin acentos, y lo pintado es el texto ORIGINAL de la coincidencia', () => {
  const segs: Segmento[] = [{ texto: 'Campaña de PROMOCIÓN de octubre', grupo: 0 }, { texto: 'promocion vieja', grupo: 1 }];
  assert.deepEqual(pintado(segs, 'promocion'), ['PROMOCIÓN', 'promocion']);
  assert.deepEqual(pintado(segs, 'campana'), ['Campaña']);
  // La consulta pasa por la MISMA comparación: con mayúsculas, tildes y espacios en las puntas, encuentra lo mismo.
  assert.deepEqual(pintado(segs, '  Promoción '), ['PROMOCIÓN', 'promocion']);
  assert.deepEqual(pintado([{ texto: 'Últimos 30 días', grupo: 0 }], 'ultimos 30'), ['Últimos 30'], 'una letra descompuesta se pinta entera');
});

test('buscar: los pedazos del MISMO grupo se leen juntos y dos grupos nunca', () => {
  // `{n} leads` son dos nodos de texto del mismo elemento.
  assert.deepEqual(pintado([{ texto: '12', grupo: 0 }, { texto: ' leads', grupo: 0 }], '12 leads'), ['12 leads']);
  // Con los espacios de las dos puntas (« 12 » y « leads») también: quedan UNO.
  assert.deepEqual(pintado([{ texto: '12 ', grupo: 0 }, { texto: ' leads', grupo: 0 }], '12 leads'), ['12  leads']);
  // El fin de una celda y el principio de la siguiente no forman una palabra.
  assert.deepEqual(pintado([{ texto: 'Mar', grupo: 0 }, { texto: 'keting', grupo: 1 }], 'marketing'), []);
  assert.deepEqual(pintado([{ texto: 'Mar', grupo: 0 }, { texto: 'keting', grupo: 1 }], 'r k'), []);
});

test('buscar: sin solaparse, con su tope, y una consulta vacía no encuentra «todo»', () => {
  assert.equal(buscarEnSegmentos([{ texto: 'aaaa', grupo: 0 }], 'aa').resultados.length, 2, 'como el Ctrl+F: «aa» en «aaaa» son dos');
  const muchas = buscarEnSegmentos([{ texto: 'x'.repeat(30), grupo: 0 }], 'x', 10);
  assert.equal(muchas.resultados.length, 10);
  assert.equal(muchas.cortado, true);
  assert.equal(buscarEnSegmentos([{ texto: 'x'.repeat(3), grupo: 0 }], 'x', 10).cortado, false);
  for (const q of ['', '   ', '\u0000']) assert.deepEqual(buscarEnSegmentos([{ texto: 'algo', grupo: 0 }], q), { resultados: [], cortado: false });
});

test('ir a la siguiente da la vuelta, y el contador dice «2 de 7»', () => {
  assert.equal(vecina(-1, 3, 1), 0);
  assert.equal(vecina(-1, 3, -1), 2);
  assert.equal(vecina(2, 3, 1), 0, 'después de la última, la primera');
  assert.equal(vecina(0, 3, -1), 2, 'antes de la primera, la última');
  assert.equal(vecina(0, 0, 1), -1);
  assert.equal(textoContador(1, 7), '2 de 7');
  assert.equal(textoContador(0, 500, true), '1 de 500+');
  assert.equal(textoContador(-1, 0), '0 de 0');
});

test('Ctrl/Cmd+F: enfoca la barra sólo con el foco en el Dashboard; con la barra ya enfocada, es el del navegador', () => {
  const t = (o: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }>) =>
    ({ key: 'f', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });
  assert.equal(atajoBuscar(t({ ctrlKey: true }), 'dashboard'), true);
  assert.equal(atajoBuscar(t({ metaKey: true, key: 'F' }), 'dashboard'), true, 'Cmd+F en la Mac');
  assert.equal(atajoBuscar(t({ ctrlKey: true }), 'barra'), false, 'el segundo Ctrl+F es el del navegador');
  assert.equal(atajoBuscar(t({ ctrlKey: true }), 'afuera'), false, 'afuera del Dashboard no se le roba a nadie');
  assert.equal(atajoBuscar(t({}), 'dashboard'), false, 'una «f» sola es una letra');
  assert.equal(atajoBuscar(t({ ctrlKey: true, altKey: true }), 'dashboard'), false);
  assert.equal(atajoBuscar(t({ ctrlKey: true, shiftKey: true }), 'dashboard'), false);
  assert.equal(atajoBuscar(t({ ctrlKey: true, key: 'g' }), 'dashboard'), false);
});

const tabla = (r: Record<string, unknown> = {}) => sanearGrafico({ id: 'tb', fuente: 'meta', tipo: 'tabla', dimension: 'campana', metricas: ['gasto'], ...r })!;

test('la barra de una tabla: sobre el campo de SU dimensión, y sólo en tablas por categoría', () => {
  assert.equal(campoDeBusqueda(tabla()), 'campana');
  assert.equal(campoDeBusqueda(tabla({ tipo: 'tabla_barras' })), 'campana');
  assert.equal(campoDeBusqueda(tabla({ tipo: 'barras' })), null, 'un gráfico de barras no tiene filas para buscar');
  assert.equal(campoDeBusqueda(tabla({ dimension: 'dia' })), null, 'una tabla por día no tiene un campo que buscar');
});

test('prender o apagar la barra toca SÓLO la marca, y manda la lista de controles ENTERA (con los fijos)', () => {
  const fijo = sanearControles([{ id: 'tb-fecha', tipo: 'periodo', preset: 'ult90', fijo: true }])[0];
  const g = { ...tabla({ tabla: { sinVacios: true } }), controles: [fijo] };
  const p = parcheBuscarEnTabla(g, true);
  assert.deepEqual(p.tabla, { sinVacios: true, buscar: true }, 'lo demás de `tabla` queda');
  assert.deepEqual(p.controles.map((c: ControlVista) => [c.id, !!c.fijo]), [['tb-fecha', true]], 'no se guarda un control: el fijo sigue, solo');
  const off = parcheBuscarEnTabla({ ...g, ...p }, false);
  assert.deepEqual(off.tabla, { sinVacios: true });
  assert.equal(parcheBuscarEnTabla({ ...tabla(), tabla: { buscar: true } }, false).tabla, undefined, 'sin nada más, `tabla` se va entera');
});

test('por qué no hay barra: no es una tabla por categoría, o ese campo ya tiene una lista o un fijo', () => {
  assert.equal(motivoSinBusqueda(tabla({ tipo: 'barras' }), 'x'), 'Sólo en una tabla por categoría');
  // `idBusquedaDe` (app/dashboard/exportar.ts) contesta null cuando el campo ya tiene una lista o un fijo.
  assert.equal(motivoSinBusqueda(tabla(), null), 'Ya hay un filtro de ese campo');
  assert.equal(motivoSinBusqueda(tabla(), 'tb-buscar'), null);
});
