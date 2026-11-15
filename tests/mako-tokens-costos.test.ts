// =============================================================================
// La tabla de costos de IA: que cada acción cueste lo medido, y que nada quede gratis sin querer (15/11/2026)
// =============================================================================
// Martín, 15/11/2026: «todo debería consumir MaKo Tokens».
//
// Esto fija las CUATRO cosas que, si se rompen, cuestan plata y no dan error:
//   1. que el MT salga del costo real y no de la columna `mt` de la tarifa vieja, que trae 2,4× de markup adentro;
//   2. que una feature SIN fila propia cobre algo (lo que no cobra no se mide, y lo que no se mide se paga igual);
//   3. que ninguna feature del catálogo de IA quede sin costo;
//   4. que los medios salgan de la medición del 07/11 y no del tarifario viejo.
//
// Correr: node --import tsx --test tests/mako-tokens-costos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COSTO_POR_DEFECTO, MEDIOS, costoDeFeature, costosFueraDelCatalogo, esAutomatica,
  featuresSinCosto, mtReservaDeFeature, vitrinaDeCostos,
} from '../lib/mako-tokens-costos';
import { MT_POR_USD, USD_POR_IMAGEN, USD_POR_SEGUNDO, mtDeUsd } from '../lib/mako-tokens-reglas';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';
import { MARKUP_MT, TARIFA } from '../app/admin/dev/pricing/modelo';

test('1. el MT sale del COSTO REAL, no de la columna con markup de la tarifa de agosto', () => {
  // ⚠️ LA TRAMPA QUE MÁS CARO SALE. La `TARIFA` (09/08/2026) tiene el markup de 2,4× adentro del token; la regla vigente
  // (07/11/2026) es 1 MT = US$0,001 de costo REAL, y el margen vive en el cupo (el 25 % del precio del plan). Copiar la
  // columna `mt` cobra el markup dos veces y agota un cupo de 11.750 MT con US$4,90 gastados: al 40 % del mes.
  for (const op of TARIFA) {
    // ⚠️ Debajo de 1 MT la comparación deja de significar algo, y el motivo es sano: `mtDeUsd` redondea HACIA ARRIBA y
    // tiene piso 1 («un medio token no existe: cobrar de menos regala margen en CADA llamada»), así que una operación de
    // US$0,00009 vale 1 MT sin markup y 0 con markup redondeado. El markup no la abarata: la desaparece.
    if (op.costoUsd * MT_POR_USD < 1) continue;
    const conMarkup = Math.round(op.costoUsd * MARKUP_MT * MT_POR_USD);
    const sinMarkup = mtDeUsd(op.costoUsd);
    assert.ok(sinMarkup <= conMarkup, `${op.id}: el costo sin markup (${sinMarkup}) no puede ser mayor que con markup (${conMarkup})`);
    assert.ok(conMarkup / Math.max(1, sinMarkup) <= 3, `${op.id}: el markup de la tarifa vieja es ~2,4×, no ${conMarkup / sinMarkup}×`);
  }
  // Y el caso concreto, con el número a la vista: analizar una llamada cuesta US$0,00712 medido.
  assert.equal(mtReservaDeFeature('closing'), mtDeUsd(0.00712));
  assert.ok(mtReservaDeFeature('closing') < 15, 'la tarifa vieja cobraba 15 MT por esto: son 8, porque 15 trae el markup adentro');
});

test('2. una feature SIN fila propia cobra algo: falla CERRADA', () => {
  assert.ok(COSTO_POR_DEFECTO.costoUsd > 0, 'el default no puede ser cero: una feature nueva correría gratis');
  for (const f of ['', '   ', null, undefined, 'una-feature-que-nadie-escribio-todavia']) {
    assert.equal(costoDeFeature(f), COSTO_POR_DEFECTO, `«${String(f)}» tenía que caer al default`);
    assert.ok(mtReservaDeFeature(f) > 0, `«${String(f)}» reservó cero`);
  }
});

test('3. ninguna feature del catálogo de IA quedó sin costo', () => {
  const sin = featuresSinCosto();
  assert.deepEqual(sin, [], `estas features del catálogo no tienen costo y caen al default sin que nada avise: ${sin.join(', ')}`);
});

test('3b. y el catálogo está CORTO: hay features en la tabla que él no declara (queda medido, no es un error)', () => {
  // ⚠️ No es un fallo de la tabla de costos: es `CATALOGO_MODELOS` que no declara todas las features que el código usa.
  // El test lo fija como MEDICIÓN para que el día que el catálogo se complete, se note.
  const fuera = costosFueraDelCatalogo();
  assert.ok(fuera.length > 0, 'si esto se vació, el catálogo se completó: actualizá docs/hallazgos-mako-tokens.md');
  assert.ok(CATALOGO_MODELOS.length < 100, `el catálogo declara ${CATALOGO_MODELOS.length} features`);
});

test('4. los medios salen de la medición del 07/11, no del tarifario viejo', () => {
  const m = MEDIOS('normal');
  const seg = m.find((x) => x.id === 'video-segundo')!;
  assert.equal(seg.costoUsd, USD_POR_SEGUNDO.normal, 'el segundo de video no sale de `USD_POR_SEGUNDO`');
  // ⚠️ La tarifa de agosto decía US$0,05 el segundo («publicado»). La medición contra ApiMart da US$0,0384.
  assert.ok(seg.costoUsd < 0.05, `el segundo de video quedó en ${seg.costoUsd}: ése es el número viejo del tarifario`);
  const img = m.find((x) => x.id === 'imagen')!;
  assert.equal(img.costoUsd, USD_POR_IMAGEN.normal);
  const car = m.find((x) => x.id === 'carrusel')!;
  assert.equal(car.costoUsd, USD_POR_IMAGEN.normal * 7, 'el carrusel tiene que ser siete veces una imagen, al precio medido');
  // La calidad premium cuesta más que la normal en los dos.
  const p = MEDIOS('premium');
  assert.ok(p.find((x) => x.id === 'imagen')!.costoUsd > img.costoUsd);
});

test('5. las que están MEDIDAS traen cuántas llamadas las respaldan', () => {
  for (const f of ['closing', 'experimentos', 'plan-fathom', 'mako-doer-in', 'campaign-suggest', 'marca-leer']) {
    const c = costoDeFeature(f);
    assert.equal(c.origen, 'medido', `${f} tenía que estar medida`);
    assert.ok(c.n > 0, `${f} dice «medido» con n=0: o se midió o no`);
  }
  // Y la más cara medida es la Retro, que es la que empuja el mes malo del Growth.
  const retro = costoDeFeature('experimentos').costoUsd;
  for (const f of ['closing', 'plan-fathom', 'campaign-suggest', 'marca-leer']) {
    assert.ok(retro > costoDeFeature(f).costoUsd, `la Retro tenía que ser más cara que ${f}`);
  }
});

test('6. cada fila dice de dónde salió el número', () => {
  for (const fila of vitrinaDeCostos()) {
    assert.ok(fila.porque.trim().length > 20, `«${fila.label}» no explica de dónde salió su número`);
    assert.ok(['medido', 'publicado', 'estimado'].includes(fila.origen), `«${fila.label}»: origen ${fila.origen}`);
    assert.ok(fila.unidad.trim().length > 0, `«${fila.label}» no dice su unidad`);
  }
});

test('7. la vitrina viene ordenada de más caro a más barato, y los medios arriba', () => {
  const v = vitrinaDeCostos();
  for (let i = 1; i < v.length; i++) assert.ok(v[i - 1].mt >= v[i].mt, `la fila ${i} (${v[i].label}) es más cara que la de arriba`);
  // Lo más caro del producto es un medio, no un texto: es el hallazgo que ordena los planes.
  assert.equal(v[0].grupo, 'Medios', `lo más caro quedó en «${v[0].grupo}» (${v[0].label}): con el producto completo el costo es el video, no el texto`);
});

test('8. lo AUTOMÁTICO está marcado, y no por eso cuesta cero', () => {
  // ⚠️ La regla de agosto le ponía 0 MT a lo automático. Se dio vuelta: descuenta igual (si no, el que más gasta queda
  // sin medidor), y lo que cambia es que al no alcanzar se saltea en silencio en vez de mostrarle un error a nadie.
  assert.ok(esAutomatica('plan-fathom'), 'una reunión de Fathom la dispara un webhook, no la persona');
  assert.ok(esAutomatica('dashboard-analista'), 'el AI Analyst corre por cron');
  assert.ok(!esAutomatica('spy'), 'espiar a un competidor lo dispara la persona');
  assert.ok(!esAutomatica('closing'), 'analizar una llamada lo dispara la persona');
  assert.ok(mtReservaDeFeature('plan-fathom') > 0, 'lo automático tiene que descontar: es lo que más gasta');
});

test('9. las transcripciones y el análisis de competencia cuestan (lo que Martín nombró el 15/11)', () => {
  // Martín, textual: «Lo mismo con la generación de transcripciones, la generación de análisis de la competencia, que eso
  // también gasta dinero». Si alguna vuelve a cero, vuelve a ser gratis sin que nadie lo decida.
  for (const f of ['stt-nota-voz', 'MaKo · nota de voz', 'Llamada grabada · transcribir', 'spy', 'video-desarmar', 'imagen-desarmar']) {
    assert.ok(mtReservaDeFeature(f) > 0, `«${f}» quedó en cero MaKo Tokens`);
  }
  // Y transcribir una llamada de venta (~30 min) cuesta más que una nota de voz (~7 s).
  assert.ok(
    mtReservaDeFeature('Llamada grabada · transcribir') > mtReservaDeFeature('stt-nota-voz'),
    'una llamada de 30 minutos tiene que costar más que una nota de voz',
  );
});
