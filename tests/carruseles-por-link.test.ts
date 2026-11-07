// Sumar carruseles a la biblioteca pasando su LINK (lib/carruseles/biblioteca.ts: `linkDeInstagram`, `planDeLinks`).
// Corre el código y mira el resultado; nada de leer el fuente.
//
// Por qué existe: si Martín manda el link de un carrusel que quiere en la biblioteca, hasta el 6/11/2026 no había con qué
// cargarlo — el comando vivió en una copia temporal del script, ya borrada. Y la receta está MEDIDA (5/11/2026): por link
// salieron 244 de 245 a unos US$0,0025 cada uno; leyendo a sus creadores por perfil, US$4,71 y 1 solo de los 245.
//
// Probado rompiéndolo (6/11/2026), base 7 verdes / 0 rojos:
//   · `linkDeInstagram` que acepta cualquier dominio → 1 rojo (un link de otro sitio se pediría igual);
//   · `linkDeInstagram` que acepta un shortcode suelto → 1 rojo (una palabra cualquiera se volvería un link);
//   · `linkDeInstagram` que se queda con el `?igsh=…` pegado al ref → 1 rojo (no sería el ref de `piezasDeApify`);
//   · `linkDeInstagram` sin `/reel/` ni `/tv/` → 2 rojos;
//   · `planDeLinks` que descarta en silencio lo que no es un link → 1 rojo (un error de tipeo se tiene que ver);
//   · `planDeLinks` sin sacar los repetidos → 1 rojo (se pagarían dos veces);
//   · `planDeLinks` que ignora lo ya guardado → 2 rojos (se pagaría de nuevo);
//   · `planDeLinks` que no respeta el techo → 1 rojo;
//   · `filasDeLectura` que deja pasar un reel pedido por su link → 1 rojo;
//   · `filasDeLectura` que guarda una pieza de la que el actor no dijo el creador → 1 rojo (quedaría sin `cuenta_id`).
//   · Y el cambio SIN efecto (renombrar la variable local `repetidos`) lo deja verde: 0 rojos.
//
// ⚠️ La trampa del caso del `?igsh`: con la barra antes del `?` (`…/p/XXX/?igsh=1`) un ref mal recortado se corta igual en la
// barra, así que el caso que de verdad lo prueba es el link SIN barra (`…/p/XXX?igsh=1`). El primero daba 0 rojos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINKS_POR_TANDA, USD_POR_LINK_MEDIDO, creadorDelItem, filasDeLectura, linkDeInstagram, planDeLinks } from '../lib/carruseles/biblioteca';
import { piezasDeApify, refDePermalink } from '../lib/instagram-perfil';

test('un link de Instagram se reduce a su shortcode, venga como venga', () => {
  // Las formas que manda una persona: con y sin www, con el ?igsh del botón «Copiar enlace», un reel, un tv, la forma vieja
  // con el @usuario adelante, y sin el https:// porque lo pegó a mano.
  for (const [texto, ref] of [
    ['https://www.instagram.com/p/DAbC_1-xyz/', 'DAbC_1-xyz'],
    ['https://instagram.com/p/DAbC_1-xyz', 'DAbC_1-xyz'],
    ['https://www.instagram.com/p/DAbC_1-xyz/?igsh=MTIzNDU2&img_index=3', 'DAbC_1-xyz'],
    // ⚠️ Sin la barra antes del `?`, que es como lo manda Instagram a veces: la cola NO puede quedar pegada al ref.
    ['https://www.instagram.com/p/DAbC_1-xyz?igsh=MTIzNDU2', 'DAbC_1-xyz'],
    ['https://www.instagram.com/p/DAbC_1-xyz#algo', 'DAbC_1-xyz'],
    ['https://www.instagram.com/reel/DAbC_1-xyz/', 'DAbC_1-xyz'],
    ['https://www.instagram.com/reels/DAbC_1-xyz/', 'DAbC_1-xyz'],
    ['https://www.instagram.com/tv/DAbC_1-xyz/', 'DAbC_1-xyz'],
    ['https://www.instagram.com/leilahormozi/p/DAbC_1-xyz/', 'DAbC_1-xyz'],
    ['instagram.com/p/DAbC_1-xyz/', 'DAbC_1-xyz'],
    ['  https://www.instagram.com/p/DAbC_1-xyz/  ', 'DAbC_1-xyz'],
  ] as const) {
    const l = linkDeInstagram(texto);
    assert.equal(l?.ref, ref, `«${texto}»`);
    assert.equal(l?.url, 'https://www.instagram.com/p/DAbC_1-xyz/', 'y la dirección con que se le pide al actor es la canónica');
  }
  // El ref es EL MISMO que el que saca el lector de Apify de un permalink: si no, la pieza se guardaría dos veces.
  assert.equal(linkDeInstagram('https://www.instagram.com/p/DAbC_1-xyz/?igsh=1')?.ref, refDePermalink('https://www.instagram.com/p/DAbC_1-xyz/'));
});

test('lo que no es un link de una publicación de Instagram no se convierte en uno', () => {
  for (const texto of [
    'https://www.instagram.com/leilahormozi/',            // un perfil: no es una publicación
    'https://www.instagram.com/explore/tags/marketing/',  // un tema
    'https://www.instagram.com/stories/alguien/123/',     // una historia
    'https://notinstagram.com/p/DAbC_1-xyz/',             // otro dominio que TERMINA en el nombre
    'https://www.tiktok.com/@alguien/video/123',
    'DAbC_1-xyz',                                         // un shortcode suelto: sin dominio no se sabe qué es
    '@leilahormozi',
    'carrusel de Leila',
    '',
    null,
    undefined,
  ]) assert.equal(linkDeInstagram(texto), null, `«${texto}»`);
});

test('el plan DICE lo que no entendió, en vez de descartarlo en silencio', () => {
  const p = planDeLinks(['https://www.instagram.com/p/AAA1/', 'ponele esto', 'https://www.instagram.com/leila/'], { techoUsd: 1 });
  assert.deepEqual(p.links.map((l) => l.ref), ['AAA1']);
  assert.equal(p.noSonLinks.length, 2, 'los dos que no son links se nombran');
  assert.ok(p.noSonLinks.includes('ponele esto'), 'y tal como se escribieron, para que se vea el error de tipeo');
  // Un renglón vacío (un archivo con una línea en blanco al final) no es un error que valga decir.
  assert.deepEqual(planDeLinks(['https://www.instagram.com/p/AAA1/', '', '   '], { techoUsd: 1 }).noSonLinks, []);
});

test('nada se paga dos veces: ni los repetidos del pedido ni lo que ya está en la biblioteca', () => {
  const pedido = [
    'https://www.instagram.com/p/AAA1/',
    'https://www.instagram.com/p/AAA1/?igsh=otro',   // el MISMO, con la cola del botón «Copiar enlace»
    'https://www.instagram.com/reel/AAA1/',          // y el mismo otra vez, como reel
    'https://www.instagram.com/p/BBB2/',
    'https://www.instagram.com/p/CCC3/',
  ];
  const p = planDeLinks(pedido, { techoUsd: 1, yaGuardados: new Set(['CCC3']) });
  assert.deepEqual(p.links.map((l) => l.ref), ['AAA1', 'BBB2'], 'queda uno de cada publicación, en el orden del pedido');
  assert.equal(p.repetidos, 2);
  assert.equal(p.yaEstaban, 1);
  assert.equal(p.probableUsd, Math.round(2 * USD_POR_LINK_MEDIDO * 100) / 100, 'y sólo se presupuestan los que se van a pedir');

  // Con --de-nuevo (sin pasar lo guardado) sí se vuelve a pedir el que ya estaba.
  const otra = planDeLinks(pedido, { techoUsd: 1 });
  assert.deepEqual(otra.links.map((l) => l.ref), ['AAA1', 'BBB2', 'CCC3']);
  assert.equal(otra.yaEstaban, 0);
});

test('el plan de links respeta el techo y se parte en tandas de 40, como la receta medida', () => {
  // Los 245 links del 5/11, con shortcodes del largo que usa Instagram.
  const muchos = Array.from({ length: 245 }, (_, i) => `https://www.instagram.com/p/DAbC_${String(i).padStart(3, '0')}/`);
  const holgado = planDeLinks(muchos, { techoUsd: 1 });
  assert.equal(holgado.links.length, 245);
  assert.equal(holgado.tandas.length, Math.ceil(245 / LINKS_POR_TANDA), 'de a 40, que es lo que medimos el 5/11');
  assert.equal(holgado.quedanFuera, 0);
  assert.equal(holgado.corte, 'todo');
  // Los 245 links medidos costaron ~US$0,61: el presupuesto tiene que quedar en ese orden, no en el de los US$4,71 del perfil.
  assert.ok(holgado.probableUsd > 0.5 && holgado.probableUsd < 1, `lo probable fue ${holgado.probableUsd}`);

  // Con poco techo entra lo que paga y el resto queda dicho, nunca gastando más.
  const justo = planDeLinks(muchos, { techoUsd: 0.2 });
  assert.ok(justo.probableUsd <= 0.2 + 1e-9, `probable ${justo.probableUsd} dentro del techo`);
  assert.ok(justo.quedanFuera > 0 && justo.quedanFuera < 245);
  assert.equal(justo.corte, 'techo');
  assert.equal(justo.links.length, 245, 'los links siguen siendo los 245: el techo decide cuántos se piden ahora');

  // Sin crédito (el caso del 6/11: techo 0) no se pide ni uno, y el corte lo dice.
  const sinTecho = planDeLinks(muchos, { techoUsd: 0 });
  assert.deepEqual(sinTecho.tandas, []);
  assert.equal(sinTecho.corte, 'sin-techo');
  assert.equal(sinTecho.quedanFuera, 245);
});

/** Un ítem del actor de Instagram como vuelve de una lectura por `directUrls` (los campos que mira `piezasDeApify`). */
const itemDeApify = (p: Record<string, unknown> = {}) => ({
  shortCode: 'DAbC_1-xyz', url: 'https://www.instagram.com/p/DAbC_1-xyz/', type: 'Sidecar', timestamp: '2026-10-01T12:00:00.000Z',
  caption: 'Los 5 errores que te cuestan clientes. Comenta «GUÍA» y te la mando.', displayUrl: 'https://scontent.cdninstagram.com/portada.jpg',
  likesCount: 1200, commentsCount: 48, ownerUsername: 'leilahormozi', ownerFullName: 'Leila Hormozi',
  childPosts: [{ displayUrl: 'https://scontent.cdninstagram.com/1.jpg' }, { displayUrl: 'https://scontent.cdninstagram.com/2.jpg' }],
  ...p,
});

test('la cadena de un link suelto: de lo que devuelve el actor a la fila que se guarda', () => {
  // Es lo que hace el comando con lo que vuelve de Apify: `piezasDeApify` → el creador del ÍTEM (cada link es de alguien
  // distinto) → `filasDeLectura` con `tema: null`.
  const items = [itemDeApify()];
  const piezas = piezasDeApify(items).map((p) => ({ ...p, creador: creadorDelItem(items[0])?.instagram ?? '', alt: null }));
  const [fila] = filasDeLectura(piezas, { tema: null, fuera: new Set() });
  assert.equal(fila.ref, 'DAbC_1-xyz', 'el ref es el shortcode: el mismo que saca `linkDeInstagram` del link que mandó Martín');
  assert.equal(fila.ref, linkDeInstagram('https://www.instagram.com/p/DAbC_1-xyz/?igsh=1')?.ref);
  assert.equal(fila.creador, 'leilahormozi');
  assert.equal(fila.medio, 'carrusel');
  assert.equal(fila.tema_id, null, 'no vino por un tema: su creador no se lee entero y no lleva outlier');
  assert.equal(fila.cta, 'GUÍA', 'y se clasifica al guardarla, como cualquier lectura');
  assert.equal(fila.laminas, 2);
  assert.deepEqual(fila.laminas_imagenes, ['https://scontent.cdninstagram.com/1.jpg', 'https://scontent.cdninstagram.com/2.jpg']);

  // Un creador que pidió salir de la biblioteca no vuelve ni por un link suelto.
  assert.deepEqual(filasDeLectura(piezas, { tema: null, fuera: new Set(['leilahormozi']) }), []);

  // ⚠️ Y si el actor no dijo de quién es, la fila NO se puede guardar (sin creador no hay `cuenta_id`): el comando lo dice.
  const anonimo = [itemDeApify({ ownerUsername: undefined, ownerFullName: undefined })];
  assert.equal(creadorDelItem(anonimo[0]), null);
  assert.deepEqual(filasDeLectura(piezasDeApify(anonimo).map((p) => ({ ...p, creador: '', alt: null })), { tema: null, fuera: new Set() }), []);

  // Un reel o un video no entran en una biblioteca de carruseles, aunque Martín mande su link.
  const reel = [itemDeApify({ type: 'Video', productType: 'clips' })];
  assert.deepEqual(filasDeLectura(piezasDeApify(reel).map((p) => ({ ...p, creador: 'leilahormozi', alt: null })), { tema: null, fuera: new Set() }), []);
});

test('un pedido vacío no es un plan con tandas', () => {
  const p = planDeLinks([], { techoUsd: 1 });
  assert.deepEqual(p.links, []);
  assert.deepEqual(p.tandas, []);
  assert.equal(p.probableUsd, 0);
  assert.equal(p.corte, 'todo');
  // Y un pedido de puros links que ya están tampoco gasta nada.
  const todosGuardados = planDeLinks(['https://www.instagram.com/p/AAA1/'], { techoUsd: 1, yaGuardados: new Set(['AAA1']) });
  assert.deepEqual(todosGuardados.links, []);
  assert.equal(todosGuardados.yaEstaban, 1);
  assert.deepEqual(todosGuardados.tandas, []);
});
