// «Tu versión» de @jasonrewired_ (11/11/2026): las letras no se pisan y la composición del original se copia ENTERA.
//
// Martín, 11/11/2026: «No sólo se superponen las letras, lo cual ya es preocupante… Sino que no siguió para nada la estética del
// carrusel original. La idea era ponerme a mí en el lugar del influencer, o de última en un paisaje parecido, y con la división de
// pantalla como lo tiene». El original: dos cuadros apilados de la misma playa, con un subtítulo blanco chico abajo de cada uno.
// MaKo hizo UNA foto de fondo (la foto de la cara de marca del negocio, en un balcón de noche) y un titular grande al centro, y en
// la lámina 1 «¿Te preocupa lo que» (Montserrat 800, 97 px, 864 px de ancho, top 513) se partía en dos renglones y se montaba
// sobre «piensan de tu oferta?» (top 648).
//
// Esto fija:
//   1. el medidor del servidor NUNCA da menos que el ancho real (medido en el navegador con la fuente del editor: 10.682 a 1000 px);
//   2. ESE caso exacto a 1080 × 1350: el de arriba ocupa dos renglones y 226 px (el alto de fabric), y el de abajo arranca después;
//   3. lo mismo armando el documento: ninguna capa de texto se pisa con otra, y cada una guarda el alto que le da el editor;
//   4. una pantalla dividida: dos cuadros, cada uno con la ESCENA PARECIDA, y la foto del negocio NUNCA pegada como si fuera el lugar;
//      en un retrato sí va la foto del negocio;
//   5. lo que la IA leyó de la composición (`lectura`) y sus cuadros se leen; una respuesta vieja con una foto que ocupa casi toda
//      la lámina es una escena.
//
// Verificado rompiéndolo (11/11/2026, base 5/0): `acomodarTextos` sin `sinSuperponer` (los textos donde los puso la IA) → cae 2 y 3;
// el alto del editor sin el 1,13 de fabric → cae 2 y 3; pegar la foto del negocio en una escena con persona → cae 4; `cuadrosDe` tomando
// toda foto como retrato → cae 5.
//
// Correr: node --import tsx --test tests/carruseles-letras-y-cuadros.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { altoEnElEditor, medidorReal } from '../lib/carruseles/medir-letra';
import { acomodarTextos, cuadrosDe, documentoDeReplica, leerReplica, type Replica, type TextoReplica } from '../lib/carruseles/replica';
import { sePisan } from '../lib/carruseles/tipografia-medida';

const MONTSERRAT_800 = { familia: '"Montserrat", sans-serif', peso: 800, italica: false };
const titulo = (texto: string, y: number): TextoReplica => ({
  rol: 'titulo', texto, x: 0.1, y, ancho: 0.8, tamano: 97 / 1080, color: '#FFFFFF', negrita: true, alinear: 'center', mayus: false, letra: 'sans',
});

test('1 · el medidor del servidor nunca da MENOS que el ancho real de la fuente', () => {
  // Medido en el navegador el 11/11/2026 con la woff2 del editor: «¿Te preocupa lo que» = 10.682 a 1000 px.
  const ancho = medidorReal('¿Te preocupa lo que', { ...MONTSERRAT_800, tam: 1000 });
  assert.ok(ancho >= 10_682, `medido ${ancho}: si da menos, el servidor cree que entra y el editor lo parte`);
  assert.ok(ancho <= 10_682 * 1.05, `medido ${ancho}: sobra de más (más de 5 %)`);
  // A 97 px NO entra en 864: se parte, que es lo que pasó en producción.
  assert.ok(medidorReal('¿Te preocupa lo que', { ...MONTSERRAT_800, tam: 97 }) > 864);
});

test('2 · el caso exacto a 1080 × 1350: el titular de dos renglones mide 226 px y el de abajo arranca después', () => {
  const items = [titulo('¿Te preocupa lo que', 513 / 1350), titulo('piensan de tu oferta?', 648 / 1350)]
    .map((t) => ({ t, fuente: { ...MONTSERRAT_800, tam: 97 }, interlineado: 1.06 }));
  const [a, b] = acomodarTextos(items, { ancho: 1080, alto: 1350 });
  assert.equal(a.renglones.length, 2, `«${a.renglones.join(' / ')}»`);
  assert.equal(a.alto, Math.ceil(altoEnElEditor(2, 97, 1.06)));
  assert.ok(Math.abs(a.alto - 226) <= 1, `el alto de fabric: 97 × 1,13 × (1,06 + 1) = 226 (dio ${a.alto})`);
  assert.ok(b.top >= a.top + a.alto, `el de abajo (top ${b.top}) arranca debajo del de arriba (termina en ${a.top + a.alto})`);
  assert.ok(b.top + b.alto <= 1350, 'y entra en la lámina');
});

const BASE = { fondo: '#1A1A1A', foto: null };
const sub = (texto: string, y: number): TextoReplica => ({
  rol: 'cuerpo', texto, x: 0.15, y, ancho: 0.7, tamano: 0.042, color: '#FFFFFF', negrita: true, alinear: 'center', mayus: false, letra: 'sans',
});
const escena = (y: number) => ({ x: 0, y, ancho: 1, alto: 0.5, tipo: 'escena' as const, persona: true, descripcion: 'un hombre sentado en una roca en la playa', busqueda: 'rocky beach at sunset' });
const nuevoId = (() => { let n = 0; return () => `id${++n}`; })();
const estilo = { titular: { familia: 'Montserrat', respaldo: 'sans-serif' as const, peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif' as const, peso: 400 } } as never;
const fotoDelNegocio = { id: 'f1', url: 'https://x.supabase.co/storage/v1/object/public/image-editor/9/cara.jpg', ancho: 1080, alto: 1440 };
const playa = { id: 'p1', url: 'https://x.supabase.co/storage/v1/object/public/landing-imagenes/9/playa.jpg', ancho: 1600, alto: 1067 };

test('3 · armando el documento: ninguna capa de texto se pisa, y cada una guarda el alto del editor', () => {
  const r: Replica = { proporcion: '4:5', titulo: 'X', laminas: [{ ...BASE, cuadros: [], textos: [titulo('¿Te preocupa lo que', 513 / 1350), titulo('piensan de tu oferta?', 648 / 1350)] }] };
  // Con una foto, los textos se quedan donde los puso la IA (la composición) y sólo se separan si se pisan. (12/11/2026: cuenta la
  // foto PUESTA; un cuadro que se quedó sin foto ya no deja los textos al lado de un hueco: tests/carruseles-replica-se-lee.test.ts.)
  r.laminas[0].cuadros = [{ ...escena(0), alto: 1 }];
  const doc = documentoDeReplica({ replica: r, estilo, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId, escenas: new Map([['rocky beach at sunset', playa]]) });
  const textos = ((doc.pages as Array<Record<string, unknown>>)[0].objects as Array<Record<string, unknown>>).filter((o) => o.type === 'textbox');
  assert.equal(textos.length, 2);
  const cajas = textos.map((t) => ({ x: t.left as number, y: t.top as number, ancho: t.width as number, alto: t.height as number }));
  assert.ok(!sePisan(cajas[0], cajas[1], 0), `se pisan: ${JSON.stringify(cajas)}`);
  assert.ok(Math.abs((textos[0].height as number) - 226) <= 1, `guarda el alto del editor (226), no el estimado (${textos[0].height})`);
});

test('4 · pantalla dividida: dos cuadros con la escena PARECIDA; la foto del negocio nunca pegada como si fuera el lugar', () => {
  const r: Replica = { proporcion: '4:5', titulo: 'X', laminas: [{ ...BASE, cuadros: [escena(0), escena(0.5)], textos: [sub('Dentro de 100 años', 0.4), sub('nadie recordará tus dudas.', 0.9)] }] };
  const escenas = new Map([['rocky beach at sunset', playa]]);
  const doc = documentoDeReplica({ replica: r, estilo, marca: { nombre: 'X', usuario: null }, foto: fotoDelNegocio, nuevoId, escenas });
  const objetos = (doc.pages as Array<Record<string, unknown>>)[0].objects as Array<Record<string, unknown>>;
  const lugares = objetos.filter((o) => o.type === 'image' && o.src !== fotoDelNegocio.url);
  assert.equal(lugares.length, 2, 'una imagen por cuadro: la pantalla dividida');
  assert.ok(lugares.every((i) => i.src === playa.url), 'cada cuadro lleva la escena parecida');
  assert.deepEqual(lugares.map((i) => i.top), [0, 675], 'arriba y abajo, como el original');
  // 12/11/2026: con su cara elegida y una persona en el original, la cara ENTRA, pero aparte: un retrato redondo sobre la esquina de
  // la escena, más chico que ella. La foto del negocio sigue sin ser el lugar (tests/carruseles-replica-se-lee.test.ts, 8).
  const suya = objetos.filter((o) => o.type === 'image' && o.src === fotoDelNegocio.url);
  assert.equal(suya.length, 1, 'la cara elegida no entró, o se pegó en lugar de una escena');
  assert.equal((suya[0].slot as { mask?: string } | undefined)?.mask, 'circle', 'la cara va redonda, no como el lugar');
  assert.ok((suya[0].width as number) * (suya[0].scaleX as number) < 540, 'la cara es más chica que la escena');
  // En un RETRATO (la persona sola, como elemento del diseño) sí va la foto del negocio.
  const retrato: Replica = { ...r, laminas: [{ ...r.laminas[0], cuadros: [{ ...escena(0.2), tipo: 'retrato', ancho: 0.4, alto: 0.4 }] }] };
  const conRetrato = documentoDeReplica({ replica: retrato, estilo, marca: { nombre: 'X', usuario: null }, foto: fotoDelNegocio, nuevoId, escenas });
  const img = ((conRetrato.pages as Array<Record<string, unknown>>)[0].objects as Array<Record<string, unknown>>).find((o) => o.type === 'image');
  assert.equal(img?.src, fotoDelNegocio.url);
});

test('5 · lo que la IA leyó y sus cuadros se leen; una foto vieja que ocupa casi toda la lámina es una escena', () => {
  const crudo = JSON.stringify({
    lectura: 'Pantalla dividida: dos cuadros apilados de la misma playa; un subtítulo blanco chico abajo de cada uno.',
    proporcion: '4:5', titulo: 'Playa',
    laminas: [{ fondo: '#000000', cuadros: [escena(0), escena(0.5), { x: 2, y: -1 }], textos: [{ rol: 'cuerpo', texto: 'Hola', x: 0.1, y: 0.4, ancho: 0.8, tamano: 0.04 }] }],
  });
  const r = leerReplica(crudo, { laminas: 1 }) as Replica;
  assert.match(String(r.lectura), /Pantalla dividida/);
  assert.equal(r.laminas[0].cuadros.length, 3, 'los tres, acotados');
  assert.equal(r.laminas[0].cuadros[0].busqueda, 'rocky beach at sunset');
  assert.ok(r.laminas[0].cuadros[2].x <= 0.95 && r.laminas[0].cuadros[2].y >= 0, 'un cuadro fuera de la lámina se acota');
  const llena = cuadrosDe(undefined, { x: 0, y: 0, ancho: 1, alto: 1, persona: true, descripcion: 'él en la playa' });
  assert.equal(llena[0].tipo, 'escena', 'una foto que ocupa toda la lámina es un lugar, no un retrato');
  const chica = cuadrosDe(undefined, { x: 0.5, y: 0.2, ancho: 0.4, alto: 0.5, persona: true, descripcion: 'su cara' });
  assert.equal(chica[0].tipo, 'retrato');
});
