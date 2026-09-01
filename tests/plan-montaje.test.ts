// Los cortes que el editor manda de vuelta al worker.
//
// Cada caso de acá es un modo de falla SILENCIOSO de ffmpeg: ninguno da error al
// renderizar, todos dejan el archivo mal después de gastar el render entero.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerPlan, duracionDe, porQueNoSirveElPlan, type Plan } from '../app/video-generator/plan-montaje';

/** Un plan sano de 4 tomas de 10 s: 24 s de anuncio. */
function planSano(): Plan {
  return {
  total: 24,
  segs: [
    { toma: 1, ini: 0.4, fin: 6.4 },
    { toma: 2, ini: 0.2, fin: 6.2 },
    { toma: 3, ini: 0.5, fin: 6.5 },
    { toma: 4, ini: 0.3, fin: 6.3 },
  ],
  };
}

test('leerPlan · lee un plan del worker', () => {
  const p = leerPlan({ total: 999, segs: [{ toma: 1, ini: 0, fin: 3 }] });
  assert.equal(p?.segs.length, 1);
});

test('leerPlan · RECALCULA el total en vez de creerle', () => {
  // Un total que llega mintiendo haría que la pantalla muestre una duración y
  // el video tenga otra. Es un dato derivado: se deriva.
  const p = leerPlan({ total: 999, segs: [{ toma: 1, ini: 0, fin: 3 }, { toma: 2, ini: 1, fin: 2 }] });
  assert.equal(p?.total, 4);
});

test('leerPlan · devuelve null ante cualquier cosa que no sea un plan', () => {
  // Un plan a medias es PEOR que ninguno: el montaje lo tomaría como bueno y
  // no recalcularía, así que el anuncio saldría cortado por un dato roto.
  assert.equal(leerPlan(null), null);
  assert.equal(leerPlan({}), null);
  assert.equal(leerPlan({ segs: [] }), null);
  assert.equal(leerPlan({ segs: 'no' }), null);
  assert.equal(leerPlan({ segs: [{ toma: 1, ini: 0 }] }), null);
  assert.equal(leerPlan({ segs: [{ toma: 1, ini: 0, fin: 'tres' }] }), null);
  assert.equal(leerPlan({ segs: [null] }), null);
});

test('duracionDe · suma los tramos', () => {
  assert.equal(duracionDe(planSano().segs), 24);
});
test('duracionDe · un tramo invertido no RESTA', () => {
  // Si restara, dos tramos mal podrían cancelarse y dar un total plausible.
  assert.equal(duracionDe([{ toma: 1, ini: 5, fin: 1 }, { toma: 2, ini: 0, fin: 8 }]), 8);
});

test('porQueNoSirveElPlan · acepta un plan sano', () => {
  assert.equal(porQueNoSirveElPlan(planSano(), 4, 10), null);
});

test('porQueNoSirveElPlan · rechaza un tramo invertido', () => {
  // ⚠️ `trim=3:1` NO falla: produce un segmento vacío y el anuncio sale más
  // corto, sin un error en ningún log.
  const p = planSano();
  p.segs[1] = { toma: 2, ini: 6.2, fin: 0.2 };
  assert.match(String(porQueNoSirveElPlan(p, 4, 10)), /termina antes de empezar/);
});

test('porQueNoSirveElPlan · rechaza un tramo de duración cero', () => {
  const p = planSano();
  p.segs[1] = { toma: 2, ini: 3, fin: 3 };
  assert.match(String(porQueNoSirveElPlan(p, 4, 10)), /termina antes de empezar/);
});

test('porQueNoSirveElPlan · rechaza un parpadeo', () => {
  const p = planSano();
  p.segs[1] = { toma: 2, ini: 3, fin: 3.1 };
  assert.match(String(porQueNoSirveElPlan(p, 4, 10)), /parpadeo/);
});

test('porQueNoSirveElPlan · rechaza una toma que no existe', () => {
  const p = planSano();
  p.segs[1] = { toma: 9, ini: 1, fin: 5 };
  assert.match(String(porQueNoSirveElPlan(p, 4, 10)), /toma 9.*tiene 4/);
});

test('porQueNoSirveElPlan · rechaza un tramo que se pasa del final del clip', () => {
  // ⚠️ Tampoco falla: ffmpeg devuelve lo que hay y calla.
  const p = planSano();
  p.segs[1] = { toma: 2, ini: 8, fin: 14 };
  assert.match(String(porQueNoSirveElPlan(p, 4, 10)), /cada toma dura 10/);
});

test('porQueNoSirveElPlan · tolera el redondeo del final exacto', () => {
  // La duración de un clip de Flow se redondea, así que un tramo que llega
  // hasta el final mide 10,05 y no 10. Rechazarlo dejaría sin poder usar el
  // último cuarto de segundo de cada toma.
  const p = planSano();
  p.segs[1] = { toma: 2, ini: 4, fin: 10.1 };
  assert.equal(porQueNoSirveElPlan(p, 4, 10), null);
});

test('porQueNoSirveElPlan · rechaza dos tramos de la misma toma que se pisan', () => {
  // ⚠️ EL PEOR de todos: el video sale bien formado y DICE OTRA COSA — repite
  // medio segundo de la frase. Es lo que más fácil se rompe arrastrando.
  const p = planSano();
  p.segs = [
    { toma: 1, ini: 0.4, fin: 6 },
    { toma: 1, ini: 4, fin: 9 },
    { toma: 2, ini: 0.2, fin: 8 },
    { toma: 3, ini: 0.5, fin: 8 },
  ];
  assert.match(String(porQueNoSirveElPlan(p, 4, 10)), /se pisan/);
});

test('porQueNoSirveElPlan · acepta dos tramos de la misma toma que NO se pisan', () => {
  // Sacarle un bache del medio a una toma es el uso normal del editor: el
  // control mira el orden, no la cantidad de tramos por toma.
  const p = planSano();
  p.segs = [
    { toma: 1, ini: 0.4, fin: 4 },
    { toma: 1, ini: 5, fin: 9 },
    { toma: 2, ini: 0.2, fin: 8 },
    { toma: 3, ini: 0.5, fin: 8 },
  ];
  assert.equal(porQueNoSirveElPlan(p, 4, 10), null);
});

test('porQueNoSirveElPlan · rechaza un anuncio que quedó demasiado corto', () => {
  assert.match(String(porQueNoSirveElPlan({ total: 4, segs: [{ toma: 1, ini: 0, fin: 4 }] }, 4, 10)), /demasiado corto/);
});

test('porQueNoSirveElPlan · rechaza un plan sin tramos', () => {
  assert.match(String(porQueNoSirveElPlan({ total: 0, segs: [] }, 4, 10)), /sin ningún tramo/);
});

test('porQueNoSirveElPlan · el motivo NOMBRA el tramo, para poder ir a arreglarlo', () => {
  // Un «hay un tramo mal» sobre una línea de tiempo de 20 tramos manda a
  // buscarlo a ojo. El número es la mitad del mensaje.
  const p = planSano();
  p.segs[2] = { toma: 3, ini: 6, fin: 1 };
  assert.match(String(porQueNoSirveElPlan(p, 4, 10)), /tramo 3/);
});
