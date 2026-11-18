// Que dos partes del mismo contenido no ocupen dos lugares de la grilla (lib/carruseles/duplicados.ts), y que lo que SÓLO
// comparte el pie de fábrica del creador siga entero. Corre el código; nada de leer el fuente.
//
// Los pies son de la forma real de los que hay en la biblioteca (medidos el 6/11/2026): la serie de «part 2 / part 3» con
// pies que no se parecen, el pitch fijo que un creador pega en todos sus carruseles, el CTA de siempre, la firma de entrada,
// y el plan «Days 1-3 / Week 2» adentro del texto, que NO es una serie.
//
// Probado rompiéndolo (6/11/2026), base 7/0:
//   · la marca de parte sin el guard de rango (`part 1-3` pasa a contar) → 1 rojo;
//   · la marca medida sobre el pie SIN puntuación → 1 rojo;
//   · la clave de la serie con el texto adentro (y no sólo el creador) → 4 rojos;
//   · sin la regla «el mismo número de parte es otra serie» → 1 rojo;
//   · la clave del pie sin las láminas ni el día → 2 rojos;
//   · el pie mínimo bajado de 4 palabras a 1 → 1 rojo;
//   · `sinRepetidos` que no saca nada → 3 rojos;
//   · en `filtrarCarruseles`: sin el corte por cuenta elegida → 1 rojo; juntando también en «Guardados» → 1 rojo;
//   · y el cambio SIN efecto (renombrar `partes` a `yaOcupadas` en sus tres usos) → 0 rojos, 7 verdes.
//
// Las dos series del mismo creador (18/11/2026, F130), base 9/0, cada rotura sola y restaurada desde una copia:
//   · `cabeEnLaSerie` sin el orden en el tiempo                                 → 8/1;
//   · `cabeEnLaSerie` sin el total (ni distinto, ni la parte por encima)          → 8/1;
//   · la parte escondida sin anotarse en su serie (`suya.push(p)` fuera)           → 8/1;
//   · `cabeEnLaSerie` que contesta siempre `true` (la clave vuelve a ser sólo el creador) → 6/3.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firmaDeContenido, repetidosDe, sinRepetidos } from '../lib/carruseles/duplicados';
import { FILTROS_INICIALES, filtrarCarruseles, type Carrusel } from '../lib/carruseles/explorar';

const AHORA = Date.parse('2026-11-06T12:00:00Z');
let n = 0;
const c = (o: Partial<Carrusel>): Carrusel => ({
  id: ++n, competidorId: 1, origen: 'biblioteca', creador: { nombre: 'Seven Seeds', usuario: 'sevenseeds', foto: null },
  url: null, miniatura: null, texto: null, gancho: null, tipoGancho: null, cierre: null, formato: '', medio: 'carrusel',
  laminas: 8, megusta: 100, comentarios: 10, publicada: '2026-11-01', traida: '2026-11-02', outlier: 2, clase: 'carrusel', ...o,
});

test('una serie numerada del mismo creador es UN contenido, aunque los pies no se parezcan', () => {
  const p2 = c({ texto: 'Part 1 broke the internet (okay…our little corner of it.) So here’s Part 2 — the coffee menu, explained.' });
  const p3 = c({ texto: 'You thought you understood the coffee menu. Then part 3 happened. #coffeeguide' });
  const f2 = firmaDeContenido(p2);
  const f3 = firmaDeContenido(p3);
  assert.equal(f2?.por, 'serie');
  assert.equal(f2?.clave, f3?.clave, 'la serie es del creador: los pies de dos partes no comparten ni una frase');
  // Las formas que se ven de verdad en los pies.
  for (const texto of ['cool websites pt2 bye', 'part 3 for my friends', 'parts 1 + 2 + 3 are on my page', 'llega a la parte 2 del ebook', 'Teil 2: so geht es weiter']) {
    assert.equal(firmaDeContenido(c({ texto }))?.por, 'serie', texto);
  }
  // Otro creador con su propia parte 2 no es el mismo contenido.
  const otro = c({ competidorId: 9, texto: 'pt 2 because networking is usually defined as intentional schmoozing' });
  assert.notEqual(firmaDeContenido(otro)?.clave, f2?.clave);
});

test('«Days 1-3» y «Week 2» NO son una serie: son un plan adentro del texto', () => {
  const plan = c({ texto: 'First marathon done. Days 1-3: no running, no lifting. Days 4-7: walk easy. Week 2: two easy runs.' });
  const repaso = c({ texto: 'quick recap: week 1: greet people + ask simple questions. week 2: fully introduce yourself' });
  const episodio = c({ texto: 'Mes chiffres ne sont pas enormes. Episode 1 du podcast en ligne.' });
  for (const x of [plan, repaso, episodio]) assert.notEqual(firmaDeContenido(x)?.por, 'serie', String(x.texto).slice(0, 40));
  // Y la marca de parte con un rango atrás tampoco («part 1-3 están en el perfil» no dice de qué parte es ésta).
  assert.notEqual(firmaDeContenido(c({ texto: 'part 1-3 are up on my profile now, go watch them' }))?.por, 'serie');
  // La puntuación importa: sin ella, «la parte. 2 cosas» sería «la parte 2».
  assert.notEqual(firmaDeContenido(c({ texto: 'Lo más difícil no es la propuesta. 2 cosas que aprendí testeando.' }))?.por, 'serie');
});

test('el mismo pie entero + las mismas láminas + el mismo día es la misma publicación dos veces', () => {
  const pie = 'Phil Knight empezó con 50 dólares prestados y un maletero lleno de zapatillas. Comenta PACK y te lo mando.';
  const a = c({ texto: pie, laminas: 10, publicada: '2026-11-04T10:00:00Z' });
  const b = c({ texto: `${pie} 👟 #nike`, laminas: 10, publicada: '2026-11-04T18:00:00Z' });
  assert.equal(firmaDeContenido(a)?.por, 'pie');
  assert.equal(firmaDeContenido(a)?.clave, firmaDeContenido(b)?.clave, 'los emojis y los hashtags no identifican el contenido');
  // Cualquiera de las tres condiciones que falte y no se afirma nada.
  assert.notEqual(firmaDeContenido(c({ texto: pie, laminas: 9, publicada: '2026-11-04' }))?.clave, firmaDeContenido(a)?.clave);
  assert.notEqual(firmaDeContenido(c({ texto: pie, laminas: 10, publicada: '2026-11-05' }))?.clave, firmaDeContenido(a)?.clave);
  assert.equal(firmaDeContenido(c({ texto: pie, laminas: null, publicada: '2026-11-04' })), null, 'sin la cantidad de láminas no se afirma');
  assert.equal(firmaDeContenido(c({ texto: pie, laminas: 10, publicada: null })), null, 'sin fecha tampoco');
  assert.equal(firmaDeContenido(c({ texto: 'Guárdalo 📌' })), null, 'un pie de tres palabras no identifica nada');
  assert.equal(firmaDeContenido(c({ texto: null })), null, 'sin pie (Spy lo borra a los 30 días) no se toca');
  assert.equal(firmaDeContenido(c({ texto: '#marketing #socialmedia #reels #growth' })), null, 'un pie de puros hashtags no es un pie');
});

test('el pie de fábrica del creador NO junta dos carruseles distintos', () => {
  // Lo medido el 6/11/2026: estos cuatro casos reales eran los falsos positivos de comparar el arranque del pie.
  const pitch = 'Business owners and online coaches who join my full coaching program build an Instagram system that attracts the right people.';
  const cta = 'Comment “WIN” to get a free scaling roadmap.';
  const firma = 'Sígueme @vilmanunez y haz clic en el link de la bio para ver el episodio completo.';
  const xs = [
    c({ texto: pitch, laminas: 6, publicada: '2026-10-29' }), c({ texto: pitch, laminas: 9, publicada: '2026-11-03' }),
    c({ texto: cta, laminas: 13, publicada: '2026-10-30' }), c({ texto: cta, laminas: 9, publicada: '2026-11-03' }),
    c({ texto: `${firma} Tres predicciones para 2027, y lo que ya estoy construyendo.`, laminas: 5, publicada: '2026-11-04' }),
    c({ texto: `${firma} La mayoría desperdicia los últimos 60 días del año; yo los uso para cerrar en alto.`, laminas: 7, publicada: '2026-11-03' }),
    c({ texto: 'Save this! #marketing #instagramgrowth', laminas: 5, publicada: '2026-11-01' }),
    c({ texto: 'Save this! #marketing #instagramgrowth', laminas: 5, publicada: '2026-11-02' }),
  ];
  assert.deepEqual(repetidosDe(xs), [], 'ninguno es el mismo contenido: cambian las láminas, el día o el cuerpo del pie');
  assert.equal(sinRepetidos(xs).length, xs.length);
});

test('dos «pt 2» del mismo creador son series DISTINTAS: una serie no tiene dos veces la misma parte', () => {
  // @heygurlceo, medido el 6/11/2026: «pt 2 because these apps might really be MAXXING my life» y «pt 2 because networking
  // is usually defined as intentional schmoozing» son dos series suyas al mismo tiempo. Era 1 de los 6 duplicados de serie.
  const apps = c({ texto: 'pt 2 because these apps might really be MAXXING my life 💌', outlier: 9 });
  const red = c({ texto: '💌 pt 2 because networking is usually defined as intentional schmoozing', outlier: 5 });
  const sigue = c({ texto: 'pt 3 de la de apps, más herramientas que uso todos los días', outlier: 1 });
  assert.deepEqual(sinRepetidos([apps, red]).map((x) => x.id), [apps.id, red.id], 'el mismo número: las dos quedan');
  assert.deepEqual(sinRepetidos([apps, red, sigue]).map((x) => x.id), [apps.id, red.id], 'y la parte 3 sí se va: su número no estaba');
  assert.deepEqual(repetidosDe([apps, red, sigue]).map((x) => x.x.id), [sigue.id]);
});

test('dos series DISTINTAS del mismo creador no se toman como una: el orden en el tiempo y el total las separan (18/11/2026)', () => {
  // El pendiente F130: con la clave de serie = el creador, la «part 2» de una serie de noviembre se escondía porque el mismo
  // creador tenía la «part 3» de OTRA en octubre. Lo que las separa son hechos de una serie, no el texto (ver la cabecera).
  // 1. EL ORDEN: la parte 2 de una serie no sale DESPUÉS que su parte 3.
  const octubre = c({ texto: 'part 3: los precios que nadie te dice', outlier: 9, publicada: '2026-10-01' });
  const noviembre = c({ texto: 'pt 2 because networking matters', outlier: 7, publicada: '2026-11-02' });
  assert.deepEqual(sinRepetidos([octubre, noviembre]).map((x) => x.id), [octubre.id, noviembre.id], 'la parte 2 posterior a la 3 es otra serie');
  // La misma serie, en orden, sigue juntándose (la parte 2 anterior a la 3).
  const antes = c({ texto: 'part 2 de los precios', outlier: 5, publicada: '2026-09-25' });
  assert.deepEqual(sinRepetidos([octubre, antes]).map((x) => x.id), [octubre.id], 'la 2 publicada antes que la 3 es la misma serie');
  // El mismo día no contradice nada (dos partes subidas juntas).
  const mismoDia = c({ texto: 'part 4 y cerramos', outlier: 4, publicada: '2026-10-01T23:00:00Z' });
  assert.deepEqual(repetidosDe([octubre, mismoDia]).map((r) => r.x.id), [mismoDia.id]);
  // 2. EL TOTAL: «2/5» y «3/10» no son la misma serie; «part 5» no entra en una de «2/3».
  const de5 = c({ texto: 'parte 2 de 5: el guion', outlier: 9 });
  const de10 = c({ texto: 'part 3/10 of my offer series', outlier: 8 });
  assert.deepEqual(firmaDeContenido(de5)?.total, 5);
  assert.deepEqual(firmaDeContenido(de10)?.total, 10);
  assert.equal(firmaDeContenido(c({ texto: 'llega a la parte 2 del ebook' }))?.total, undefined, '«del ebook» no declara un total');
  assert.deepEqual(sinRepetidos([de5, de10]).map((x) => x.id), [de5.id, de10.id]);
  const de3 = c({ texto: 'part 2/3 del método', outlier: 9 });
  const cinco = c({ texto: 'part 5 y la última', outlier: 3 });
  assert.deepEqual(sinRepetidos([de3, cinco]).map((x) => x.id), [de3.id, cinco.id], 'la parte 5 no es de una serie de 3');
  // Sin día ni total no hay hecho que mirar: lo de antes (el mismo creador es la misma serie).
  const sinDia1 = c({ texto: 'part 2 del menú', outlier: 9, publicada: null });
  const sinDia2 = c({ texto: 'part 3 del menú', outlier: 2, publicada: null });
  assert.deepEqual(sinRepetidos([sinDia1, sinDia2]).map((x) => x.id), [sinDia1.id]);
});

test('lo que se esconde también cuenta para su serie: una «pt 2» que llega después es de otra serie', () => {
  // La serie A: su parte 1 (quedó) y su parte 2 (se escondió). La «pt 2» de B no puede ser de A, que ya tiene su parte 2.
  const a1 = c({ texto: 'part 1 de la serie de ventas', outlier: 9, publicada: '2026-10-01' });
  const a2 = c({ texto: 'part 2 y seguimos con ventas', outlier: 8, publicada: '2026-10-03' });
  const b2 = c({ texto: 'pt 2 de la otra serie, la de contenido', outlier: 7, publicada: '2026-10-02' });
  assert.deepEqual(sinRepetidos([a1, a2, b2]).map((x) => x.id), [a1.id, b2.id]);
});

test('sinRepetidos deja el primero de cada contenido, en el mismo orden, y no toca lo que no tiene firma', () => {
  const a = c({ texto: 'Part 2 de la serie de ganchos', outlier: 9 });
  const b = c({ texto: 'otro carrusel cualquiera con su propio pie largo y distinto', laminas: 4, publicada: '2026-11-02' });
  const d = c({ texto: 'part 3 de la misma serie', outlier: 1 });
  const e = c({ texto: null });
  const f = c({ texto: null });
  const out = sinRepetidos([a, b, d, e, f]);
  assert.deepEqual(out.map((x) => x.id), [a.id, b.id, e.id, f.id], 'se va la parte 3 (la que menos rindió: va después en la lista ya ordenada)');
  assert.deepEqual(repetidosDe([a, b, d, e, f]).map((x) => [x.x.id, x.por]), [[d.id, 'serie']]);
  assert.deepEqual(sinRepetidos([]), []);
});

test('en la grilla: las dos partes ocupan UN lugar; con la cuenta elegida y en Guardados, los dos', () => {
  const p2 = c({ texto: 'Part 2: lo que nadie te dice del menú', outlier: 9 });
  const p3 = c({ texto: 'part 3 y seguimos con el menú', outlier: 8 });
  const otra = c({ competidorId: 2, creador: { nombre: 'Café Brasa', usuario: 'cafebrasa', foto: null }, texto: 'cinco errores al cobrar tu consulta', outlier: 7, publicada: '2026-11-03' });
  const todos = [p2, p3, otra];
  const ids = (f: Partial<typeof FILTROS_INICIALES>, g: number[] = []) =>
    filtrarCarruseles(todos, { ...FILTROS_INICIALES, ...f }, new Set(g), AHORA).map((x) => x.id);
  assert.deepEqual(ids({}), [p2.id, otra.id], 'la parte 3 no ocupa un lugar de la grilla');
  assert.deepEqual(ids({ creadores: [1] }), [p2.id, p3.id], 'se pidió ver esa cuenta: van las dos partes');
  assert.deepEqual(ids({ q: '@sevenseeds' }), [p2.id, p3.id], 'y por @ también');
  assert.deepEqual(ids({ vista: 'guardados' }, [p2.id, p3.id]), [p2.id, p3.id], 'lo que el negocio guardó se ve entero');
});
