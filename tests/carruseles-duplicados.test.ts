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
