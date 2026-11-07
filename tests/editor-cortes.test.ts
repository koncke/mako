// Las operaciones del editor de cortes.
//
// Lo que se prueba acá es la INVARIANTE que hace al editor: ninguna operación
// puede producir un plan que el server rechace. Por eso cada caso termina
// pasándole el resultado a `porQueNoSirveElPlan`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  moverBorde, moverTramo, quitarTramo, partirTramo, destinoDeMover, inicios, enSegundo, mismoPlan, MINIMO_SEG,
} from '../app/video-generator/editor-cortes';
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
  assert.equal(porQueNoSirveElPlan(p, 4, [DUR, DUR, DUR, DUR]), null);
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

test('mismoPlan · dos planes iguales lo son, y uno movido un milisegundo tambien', () => {
  // La tolerancia no es laxitud: los bordes se guardan redondeados a milésimas y
  // un arrastre que vuelve al mismo pixel puede dar 3.0000001. Sin tolerancia,
  // la pila de deshacer se llenaría de entradas que no cambian nada.
  const a = plan();
  assert.equal(mismoPlan(a, plan()), true);
  const b = plan();
  b.segs[0] = { ...b.segs[0], fin: b.segs[0].fin + 0.0004 };
  assert.equal(mismoPlan(a, b), true);
});

test('mismoPlan · un corte movido de verdad NO es el mismo', () => {
  const a = plan();
  const b = moverBorde(plan(), 0, 'fin', 7, DUR);
  assert.equal(mismoPlan(a, b), false);
});

test('mismoPlan · partir cambia el plan aunque no cambie la duracion', () => {
  // Es el caso que una comparacion por TOTAL no ve: partir deja el mismo largo y
  // dos tramos donde habia uno.
  const a = plan();
  const b = partirTramo(plan(), 0, 3);
  assert.equal(a.total, b.total);
  assert.equal(mismoPlan(a, b), false);
});

test('mismoPlan · una operacion que se ABSTUVO devuelve el mismo plan', () => {
  // Es lo que le permite a la pila de deshacer no guardar entradas mudas.
  const a = plan();
  assert.equal(mismoPlan(a, partirTramo(a, 0, 0.5)), true);
  assert.equal(mismoPlan(a, moverBorde(a, 99, 'fin', 5, DUR)), true);
});

// ── Reordenar tomas: mover un TRAMO de lugar (item 555, 6/11/2026) ──────────
//
// Lo que faltaba del pendiente. El Deshacer y la música ya estaban (`Ctrl+Z` en
// EditorAnuncio.tsx; `lib/musica-catalogo.ts` espera el alta de Epidemic, no código).
//
// ⚠️ Y EL PENDIENTE DABA POR HECHO ALGO FALSO: «el plan lo soporta (es un array
// ordenado)». El array está ordenado y NO es libremente reordenable —
// `porQueNoSirveElPlan` exige que los tramos de una misma toma aparezcan en orden
// cronológico— así que el caso central del editor (partir una toma y sacarle un bache)
// es exactamente el que un reorden ingenuo rompe. Eso es lo que fija el segundo test.
//
// PROBADO ROMPIÉNDOLO (6/11/2026): base 32 de 32, catorce roturas, CAYERON LAS CATORCE,
// cada una restaurada y verificada por md5. La rotura va arriba de su test con cuántos
// rojos dio. Dos vueltas: la primera dejó pasar tres, y las tres eran del TEST —un
// `splice` que ya acota solo, un ancla de fuente que medía al lado del cuerpo que quería
// mirar, y un mutante equivalente (dicho donde toca).

// rotura (`cruzaUnaToma` devolviendo siempre `false`): 1 fallo, 31 pases.
// rotura (`moverTramo` devolviendo `con(segs)` igual al cruzar): 1 fallo, 31 pases.
test('moverTramo · lleva un tramo a otra posición, y el total NO se mueve', () => {
  // Reordenar cambia en qué orden se dicen las cosas. No cambia ninguna duración.
  const p = moverTramo(plan(), 0, 2);
  assert.deepEqual(p.segs.map((s) => s.toma), [2, 3, 1, 4]);
  assert.equal(p.total, 24);
  assert.deepEqual(p.segs[2], { toma: 1, ini: 0.4, fin: 6.4 }, 'el tramo viaja entero');
  sirve(p);
  // Y al revés: traer el último al principio.
  const q = moverTramo(plan(), 3, 0);
  assert.deepEqual(q.segs.map((s) => s.toma), [4, 1, 2, 3]);
  assert.equal(q.total, 24);
  sirve(q);
});

// rotura (`cruzaUnaToma` devolviendo siempre `false`): 1 fallo, 31 pases.
// ⚠️ `cruzaUnaToma` con `s.fin < previo` en vez de `s.ini < previo` da VERDE, y no es un
// hueco del test: sobre una PERMUTACIÓN los dos son equivalentes, porque los tramos de
// una toma son disjuntos y ninguna operación de este módulo los superpone. Se escribe
// `ini` igual, porque es literalmente el control del server (`porQueNoSirveElPlan`), y
// el día que algo sí produzca un solape los dos dejan de dar lo mismo.
test('moverTramo · ⚠️ RECHAZA cruzar los dos pedazos de una toma partida (el server lo rechazaría)', () => {
  const partido = partirTramo(plan(), 0, 3);
  // Los dos pedazos de la toma 1 son CONTIGUOS: no se pisan, están uno después del otro.
  assert.equal(partido.segs[0].fin, 3);
  assert.equal(partido.segs[1].ini, 3);

  // ⚠️ Y aun así, cruzarlos en el array produce un plan que el server rechaza — con un
  // mensaje que miente, porque dice que «se pisan» y lo que están es al revés. Es la
  // razón de ser del rechazo: `porQueNoSirveElPlan` mira los tramos de cada toma EN EL
  // ORDEN DEL ARRAY (`tramos[i].ini < tramos[i - 1].fin`).
  const cruzado: Plan = {
    total: partido.total,
    segs: [partido.segs[1], partido.segs[0], ...partido.segs.slice(2)],
  };
  const motivo = porQueNoSirveElPlan(cruzado, 4, [DUR, DUR, DUR, DUR]);
  assert.match(motivo ?? '', /se pisan/);

  // Así que `moverTramo` no lo produce: devuelve EL MISMO plan, que es la señal que la
  // pantalla compara con `===` para frenar el tramo contra su hermano.
  assert.equal(moverTramo(partido, 1, 0), partido);
  assert.equal(moverTramo(partido, 0, 1), partido);
});

// rotura (`cruzaUnaToma` devolviendo siempre `true`): 5 fallos, 27 pases.
test('moverTramo · el pedazo de una toma partida SÍ viaja lejos, mientras no pase a su hermano', () => {
  // El rechazo es del CRUCE, no del movimiento: si no, partir una toma dejaría sus dos
  // pedazos clavados y el reorden no serviría justo en el anuncio que más se edita.
  const partido = partirTramo(plan(), 0, 3);   // [t1a, t1b, t2, t3, t4]
  const p = moverTramo(partido, 1, 4);         // t1b al final: sigue DESPUÉS de t1a
  assert.deepEqual(p.segs.map((s) => s.toma), [1, 2, 3, 4, 1]);
  assert.deepEqual(p.segs[4], { toma: 1, ini: 3, fin: 6.4 });
  assert.equal(p.total, partido.total);
  sirve(p);
});

// rotura (`if (destino === desde) return plan;` sacado): 1 fallo, 31 pases.
// rotura (`moverTramo` sin el `Math.min/Math.max` de `hasta`): 1 fallo, 31 pases.
test('moverTramo · acota el destino y se ABSTIENE cuando no hay nada que mover', () => {
  const a = plan();
  // Fuera de rango se acota a las puntas, que es lo que hace un arrastre que se pasa.
  assert.deepEqual(moverTramo(a, 0, 99).segs.map((s) => s.toma), [2, 3, 4, 1]);
  assert.deepEqual(moverTramo(a, 3, -9).segs.map((s) => s.toma), [4, 1, 2, 3]);
  // ⚠️ Y LO QUE NO MUEVE NADA DEVUELVE EL MISMO OBJETO. No es cosmético: el arrastre
  // lee el rechazo por IDENTIDAD (`nuevo === p`), así que un plan nuevo con el mismo
  // contenido se toma como un paso válido y le corre el índice del tramo agarrado.
  // `splice` acota solo (99 = al final, −9 = al principio), así que esto es lo ÚNICO
  // que distingue al acotado de no tenerlo.
  assert.equal(moverTramo(a, 3, 99), a, 'el último ya está a la derecha: no hay a dónde ir');
  assert.equal(moverTramo(a, 0, -5), a, 'y el primero no tiene a dónde ir a la izquierda');
  assert.equal(moverTramo(a, 1, 1), a);
  assert.equal(moverTramo(a, 9, 0), a);
  assert.equal(moverTramo(a, -1, 0), a);
  assert.equal(moverTramo(a, 0, Number.NaN), a);
});

// rotura (el umbral `dura(v) / 2` cambiado por el BORDE del vecino, a cada lado): 2 fallos, 30 pases.
// rotura (`destinoDeMover` saltando al tramo que está bajo el dedo, sin el paso de a uno): 2 fallos, 30 pases.
test('destinoDeMover · un paso por vez, y recién cuando el dedo pasó la MITAD del vecino', () => {
  const a = plan();                       // cuatro tramos de 6 s: inicios 0, 6, 12, 18
  assert.equal(destinoDeMover(a, 0, 3), 0, 'el dedo sigue sobre su propio tramo');
  assert.equal(destinoDeMover(a, 0, 6.5), 0, 'entró al vecino pero no pasó su mitad');
  assert.equal(destinoDeMover(a, 0, 9.5), 1, 'pasó la mitad del vecino: un paso');
  assert.equal(destinoDeMover(a, 0, 23), 1, '⚠️ UN paso, no un salto al tramo del dedo');
  assert.equal(destinoDeMover(a, 3, 16), 3);
  assert.equal(destinoDeMover(a, 3, 14), 2);
  // Las puntas no tienen a dónde ir.
  assert.equal(destinoDeMover(a, 0, -40), 0);
  assert.equal(destinoDeMover(a, 3, 99), 3);
  assert.equal(destinoDeMover(a, 9, 3), 9, 'un índice que no existe no rompe nada');
});

// rotura (el umbral `dura(v) / 2` cambiado por `dura(i) / 2`, el del tramo agarrado): 1 fallo, 31 pases.
test('destinoDeMover · ⚠️ NO OSCILA con un tramo angosto al lado de uno ancho', () => {
  // El caso que tiembla: medio segundo al lado de ocho. Si el umbral fuera el borde del
  // vecino, después del paso el dedo quedaría otra vez sobre él y el `pointermove`
  // siguiente lo mandaría de vuelta — un bloque vibrando debajo del dedo, sin un error
  // en ningún lado.
  const angosto: Plan = { total: 8.5, segs: [{ toma: 1, ini: 0, fin: 0.5 }, { toma: 2, ini: 0, fin: 8 }] };
  assert.equal(destinoDeMover(angosto, 0, 3), 0, 'todavía no: 3 s no llega a la mitad de los 8');
  assert.equal(destinoDeMover(angosto, 0, 5), 1);
  const movido = moverTramo(angosto, 0, 1);
  assert.deepEqual(movido.segs.map((s) => s.toma), [2, 1]);
  // Y con el dedo EN EL MISMO LUGAR, el paso de vuelta no se pide.
  assert.equal(destinoDeMover(movido, 1, 5), 1);
});

/**
 * El gesto completo, como lo hace la pantalla: `apilar()` al agarrar el bloque, un paso
 * por `pointermove` (`destinoDeMover` + `moverTramo`), y al soltar se TIRA la entrada si
 * el plan quedó igual. Son las funciones de verdad; lo único simulado es la secuencia.
 */
function gesto(inicial: Plan, i: number, segundos: number[]): { plan: Plan; pila: Plan[] } {
  const pila: Plan[] = [inicial];          // apilar(), en el pointerdown
  let p = inicial;
  let vivo = i;
  for (const seg of segundos) {            // pointermove
    const destino = destinoDeMover(p, vivo, seg);
    if (destino === vivo) continue;
    const nuevo = moverTramo(p, vivo, destino);
    if (nuevo === p) continue;             // rechazado: el tramo se frena y se ve
    vivo = destino;
    p = nuevo;
  }
  // soltar(): la entrada muda se saca, igual que en un arrastre de borde que volvió.
  if (pila.length && mismoPlan(pila[pila.length - 1], p)) pila.pop();
  return { plan: p, pila };
}

// ⚠️ Las roturas de ESTE test viven en EditorAnuncio.tsx y las caza el cableado de abajo:
// `apilar()` sacado del `pointerdown` del bloque → 1 fallo; movido al `pointermove` → 1;
// el `soltar` sin la limpieza por `mismoPlan` → 1; el rechazo leído con `mismoPlan` en vez
// de la identidad → 1. Lo de acá es la SECUENCIA, con las funciones puras de verdad.
test('el gesto · un arrastre es UNA entrada de deshacer, y Ctrl+Z lo deshace en un paso', () => {
  const inicial = plan();
  // El dedo arrastra el primer tramo hasta el final, pasando por los tres vecinos.
  const { plan: p, pila } = gesto(inicial, 0, [7, 10, 14, 16, 20, 23]);
  assert.deepEqual(p.segs.map((s) => s.toma), [2, 3, 4, 1], 'el orden nuevo se refleja en el plan');
  assert.equal(pila.length, 1, 'UNA entrada por gesto, no una por paso');
  assert.equal(mismoPlan(pila[0], inicial), true, 'y Ctrl+Z vuelve al orden de antes, de una');
});

test('el gesto · uno que vuelve al mismo lugar —o un clic que sólo selecciona— NO deja entrada', () => {
  const inicial = plan();
  const ida = gesto(inicial, 0, [10, 23, 14, 7, 2]);
  assert.deepEqual(ida.plan.segs.map((s) => s.toma), [1, 2, 3, 4], 'volvió a donde estaba');
  assert.equal(ida.pila.length, 0, 'una entrada muda hace que Deshacer parezca roto');
  // Un clic sin arrastrar: apiló al agarrar y no movió nada.
  assert.equal(gesto(inicial, 2, []).pila.length, 0);
});

// ── El cableado de la pantalla ──────────────────────────────────────────────
// ⚠️ UN GESTO NO SE VERIFICA LEYENDO EL HANDLER (regla de la casa): se arrastra en un
// navegador. Esto no lo reemplaza — fija que la pantalla use las piezas de arriba y la
// MISMA disciplina de deshacer, que es lo que los tests sí pueden ejecutar.
// rotura (el bloque sin `apilar()` en su `pointerdown`): 1 fallo, 31 pases.
// rotura (`apilar()` movido adentro del `pointermove`): 1 fallo, 31 pases.
// rotura (el `soltar` sin la limpieza de la entrada muda): 1 fallo, 31 pases.
// rotura (el rechazo leído con `mismoPlan` en vez de la identidad): 1 fallo, 31 pases.
// rotura (los dos botones de mover sacados): 1 fallo, 31 pases.
test('el cableado · el bloque se agarra, apila una vez, y usa las operaciones puras', () => {
  const src = readFileSync(resolve(import.meta.dirname, '..', 'app', 'video-generator', 'EditorAnuncio.tsx'), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.match(src, /moverTramo/, 'la pantalla no reimplementa el reorden');
  assert.match(src, /destinoDeMover/, 'ni la decisión de a qué posición va');
  // El pointerdown del bloque: selecciona, apila UNA vez y arranca el gesto de tramo.
  assert.match(
    src,
    /onPointerDown=\{\(e\) => \{[\s\S]{0,400}?apilar\(\);[\s\S]{0,200}?movidoRef\.current = i;[\s\S]{0,120}?setArrastre\(\{ modo: 'tramo' \}\);/,
    'apila al EMPEZAR el gesto, no en cada pointermove',
  );
  // ⚠️ SOBRE EL CUERPO DEL HANDLER, no sobre «la palabra pointermove y 400 caracteres
  // más»: el `addEventListener('pointermove', …)` va DESPUÉS del cuerpo, así que un
  // `apilar()` metido adentro quedaba antes del ancla y la rotura pasaba verde.
  const cuerpoMover = src.slice(src.indexOf('const mover = (e: PointerEvent)'), src.indexOf('const soltar = ()'));
  assert.ok(cuerpoMover.length > 200, 'el cuerpo del pointermove tiene que estar acá');
  assert.doesNotMatch(cuerpoMover, /apilar\(/, 'apilar() en el pointermove = una entrada de deshacer por PASO');
  // El rechazo se lee por IDENTIDAD, que es la señal que da `moverTramo`.
  assert.match(src, /const nuevo = moverTramo\(p, i, destino\);[\s\S]{0,80}?if \(nuevo === p\) return;/);
  // Y la limpieza de la entrada muda es la MISMA para los dos gestos.
  assert.match(src, /const soltar = \(\) => \{[\s\S]{0,400}?mismoPlan\(pila\[pila\.length - 1\], planRef\.current\)/);
  // Ctrl+Z sigue ahí, y el botón también.
  assert.match(src, /e\.key\.toLowerCase\(\) !== 'z'/);
  assert.match(src, /title="Deshacer \(Ctrl\+Z\)"/);
  // Y el reorden tiene un camino que se VE: un gesto no se anuncia solo.
  assert.match(src, /onClick=\{\(\) => moverSel\(-1\)\}/);
  assert.match(src, /onClick=\{\(\) => moverSel\(1\)\}/);
});
