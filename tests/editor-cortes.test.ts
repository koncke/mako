// Las operaciones del editor de cortes.
//
// Lo que se prueba acá es la INVARIANTE que hace al editor: ninguna operación
// puede producir un plan que el server rechace. Por eso cada caso termina
// pasándole el resultado a `porQueNoSirveElPlan`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moverBorde, quitarTramo, partirTramo, inicios, enSegundo, MINIMO_SEG } from '../app/video-generator/editor-cortes';
import { porQueNoSirveElPlan, type Plan } from '../app/video-generator/plan-montaje';

const DUR = 10;

function plan(): Plan {
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

/** La invariante del módulo: lo que sale de acá lo acepta el server. */
function sirve(p: Plan) {
  assert.equal(porQueNoSirveElPlan(p, 4, DUR), null);
}

test('moverBorde · mueve el final', () => {
  const p = moverBorde(plan(), 0, 'fin', 8, DUR);
  assert.equal(p.segs[0].fin, 8);
  assert.equal(p.total, 25.6);   // el tramo pasó de 6 s a 7,6
  sirve(p);
});

test('moverBorde · mueve el inicio', () => {
  const p = moverBorde(plan(), 0, 'ini', 2, DUR);
  assert.equal(p.segs[0].ini, 2);
  sirve(p);
});

test('moverBorde · ACOTA en vez de invertir el tramo', () => {
  // Arrastrar el final por detrás del inicio no es un error del usuario: es
  // cómo se siente un editor. Se frena contra el tope y se ve.
  const p = moverBorde(plan(), 0, 'fin', 0, DUR);
  assert.ok(Math.abs((p.segs[0].fin) - (0.4 + MINIMO_SEG)) < 1e-6);
  sirve(p);
});

test('moverBorde · ACOTA el inicio contra el final', () => {
  const p = moverBorde(plan(), 0, 'ini', 99, DUR);
  assert.ok(Math.abs((p.segs[0].ini) - (6.4 - MINIMO_SEG)) < 1e-6);
  sirve(p);
});

test('moverBorde · ACOTA contra el largo del clip', () => {
  // ⚠️ Pasarse del final no falla en ffmpeg: devuelve lo que hay y calla.
  const p = moverBorde(plan(), 0, 'fin', 40, DUR);
  assert.equal(p.segs[0].fin, DUR);
  sirve(p);
});

test('moverBorde · ACOTA contra cero', () => {
  const p = moverBorde(plan(), 0, 'ini', -5, DUR);
  assert.equal(p.segs[0].ini, 0);
  sirve(p);
});

test('moverBorde · ⚠️ ACOTA contra el OTRO TRAMO DE LA MISMA TOMA', () => {
  // El caso que produce un anuncio bien formado que DICE OTRA COSA: dos
  // tramos de la misma toma que se pisan repiten media frase.
  const p = partirTramo(plan(), 0, 3);
  const q = moverBorde(p, 0, 'fin', DUR, DUR);
  assert.equal(q.segs[0].fin, 3);          // se frena contra el tramo de al lado
  assert.equal(q.segs[1].ini, 3);
  sirve(q);
});

test('moverBorde · el tramo de OTRA toma no acota', () => {
  // Dos tramos de tomas distintas nunca se pisan: son archivos distintos.
  const p = moverBorde(plan(), 1, 'fin', DUR, DUR);
  assert.equal(p.segs[1].fin, DUR);
  sirve(p);
});

test('moverBorde · recalcula el total', () => {
  const p = moverBorde(plan(), 3, 'fin', 9.3, DUR);
  assert.equal(p.total, 27);
});

test('moverBorde · un índice que no existe no rompe nada', () => {
  assert.deepEqual(moverBorde(plan(), 9, 'fin', 5, DUR), plan());
});

test('quitarTramo · saca el tramo y recalcula', () => {
  const p = quitarTramo(plan(), 1);
  assert.equal((p.segs).length, 3);
  assert.equal(p.total, 18);
  sirve(p);
});

test('quitarTramo · ⚠️ NO deja la línea vacía', () => {
  // Un plan sin tramos no es un anuncio corto: es un render que falla, o un
  // mp4 de cero segundos que se sube igual.
  let p: Plan = { total: 6, segs: [{ toma: 1, ini: 0, fin: 6 }] };
  p = quitarTramo(p, 0);
  assert.equal((p.segs).length, 1);
});

test('partirTramo · parte en dos SIN cambiar la duración', () => {
  // Partir no cambia lo que se ve: agrega dos bordes para mover.
  const p = partirTramo(plan(), 0, 3);
  assert.equal((p.segs).length, 5);
  assert.equal(p.total, 24);
  assert.deepEqual(p.segs[0], { toma: 1, ini: 0.4, fin: 3 });
  assert.deepEqual(p.segs[1], { toma: 1, ini: 3, fin: 6.4 });
  sirve(p);
});

test('partirTramo · no parte si dejaría un parpadeo', () => {
  assert.equal((partirTramo(plan(), 0, 0.5).segs).length, 4);
  assert.equal((partirTramo(plan(), 0, 6.3).segs).length, 4);
});

test('partirTramo · partir y quitar una mitad saca un bache del medio', () => {
  // El uso real: la toma tiene un tropiezo a los 3 s y se lo saca sin perder
  // las dos puntas.
  let p = partirTramo(plan(), 0, 3);
  p = moverBorde(p, 1, 'ini', 4, DUR);
  assert.deepEqual(p.segs[0], { toma: 1, ini: 0.4, fin: 3 });
  assert.deepEqual(p.segs[1], { toma: 1, ini: 4, fin: 6.4 });
  assert.equal(p.total, 23);     // el bache de 1 s salió del anuncio entero
  sirve(p);
});

test('la línea de tiempo · inicios corre el reloj', () => {
  assert.deepEqual(inicios(plan()), [0, 6, 12, 18]);
});

test('la línea de tiempo · enSegundo dice qué clip suena', () => {
  assert.deepEqual(enSegundo(plan(), 0), { i: 0, toma: 1, dentro: 0.4 });
  assert.deepEqual(enSegundo(plan(), 7), { i: 1, toma: 2, dentro: 1.2 });
  assert.deepEqual(enSegundo(plan(), 13.5), { i: 2, toma: 3, dentro: 2 });
});

test('la línea de tiempo · el borde de un corte cae en el tramo SIGUIENTE', () => {
  // Si cayera en el anterior, el cabezal se quedaría clavado en el último
  // fotograma de cada corte en vez de saltar.
  assert.equal(enSegundo(plan(), 6)?.i, 1);
});

test('la línea de tiempo · pasado el final se queda en el último tramo', () => {
  // Nunca `null`: un cabezal sin tramo deja la previsión en negro al llegar al
  // final, que se lee como que el anuncio se rompió.
  assert.deepEqual(enSegundo(plan(), 99), { i: 3, toma: 4, dentro: 6.3 });
});
