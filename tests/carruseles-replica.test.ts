// «Editar» un carrusel de ejemplo (lib/carruseles/replica.ts, 6/11/2026): el pedido a la IA del negocio, lo que se lee de lo
// que devuelve (nunca se le cree: se acota todo) y el diseño editable que se arma. Corre el código con lo que devolvería un
// modelo (bien, roto y con basura), no busca texto en el fuente.
//
// Probado rompiéndolo (6/11/2026), base 10/0:
//   · `leerReplica` sin acotar x/ancho a la lámina → 1 rojo (un texto salía de la lámina);
//   · sin reparar el JSON roto (`parseJsonObject`) → 1 rojo;
//   · aceptar una lámina sin textos como réplica → 1 rojo;
//   · la foto del cliente sin mirar `persona` (va también donde había un paisaje) → 1 rojo;
//   · `documentoDeReplica` con el alto de 4:5 en un anuncio 1:1 → 1 rojo;
//   · `medidasDeImagen` con ancho y alto al revés en JPEG → 1 rojo;
//   · `avisoSinIA` que no manda a conectar la IA cuando no hay ninguna → 1 rojo;
//   · el prompt sin pedir la palabra del CTA cuando el original la pide → 1 rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marcasDeVoseo } from '../lib/voseo';
import { altoEstimado, documentoDeCarrusel } from '../lib/carruseles/documento';
import { estiloSinSerif } from '../lib/carruseles/marca-kit';
import { fuenteDelEditorDeImagen } from '../lib/image-editor/fuente-del-editor';
import {
  CONECTAR_IA, FAMILIAS_DE_LA_REPLICA, LAMINAS_MAX, ajustarTextos, avisoSinIA, documentoDeReplica, eventosDe, leerReplica, lineaDeEvento, medidasDeImagen, notasDeReplica,
  promptDeReplica, type Replica,
} from '../lib/carruseles/replica';
import { tipoCarrusel } from '../lib/carruseles/tipos';

const estilo = tipoCarrusel('lista')!.estilo;
let n = 0;
const nuevoId = () => `o${++n}`;

const base = { laminas: 5, vistas: 5, negocio: 'Vende asesorías de marketing para dentistas. Oferta: 3 meses, US$900.', voz: '', nombreNegocio: 'Sonrisa Llena', cta: null, conAvatar: false };

test('el prompt: copia el diseño y el patrón, nunca sus frases, y dice cuántas láminas ve', () => {
  const p = promptDeReplica(base);
  assert.match(p, /sus 5 láminas/);
  assert.match(p, /NUNCA sus frases/);
  assert.match(p, /No pongas el nombre, el @ ni la marca del creador/);
  assert.match(p, /Sonrisa Llena/);
  assert.match(p, /<<<NEGOCIO[\s\S]*dentistas[\s\S]*NEGOCIO>>>/, 'los datos del negocio van marcados como datos');
  assert.match(p, /Exactamente 5 elementos/);
  assert.match(promptDeReplica({ ...base, vistas: 1 }), /sólo su portada/, 'con sólo la portada, lo dice');
  assert.match(promptDeReplica({ ...base, laminas: 40 }), new RegExp(`Exactamente ${LAMINAS_MAX} elementos`), 'con un tope');
  assert.deepEqual(marcasDeVoseo(p), [], 'el prompt pide español neutro y está escrito en español neutro');
});

test('el prompt: con un original que pide comentar una palabra, la versión pide la suya; con avatar, marca dónde va la persona', () => {
  const p = promptDeReplica({ ...base, cta: 'GUÍA', conAvatar: true });
  assert.match(p, /pide comentar «GUÍA»/);
  assert.match(p, /UNA palabra que tenga sentido para este negocio/);
  assert.match(p, /persona: true/);
  assert.match(promptDeReplica({ ...base, anuncio: true, laminas: 1, vistas: 1 }), /un anuncio de imagen/);
});

const BUENO = JSON.stringify({
  proporcion: '4:5',
  titulo: '5 errores al cobrar',
  laminas: [
    { fondo: '#111111', foto: { x: 0.5, y: 0.4, ancho: 0.5, alto: 0.6, persona: true, descripcion: 'la dueña sonriendo' }, textos: [
      { rol: 'titulo', texto: '5 errores que te hacen perder pacientes', x: 0.08, y: 0.1, ancho: 0.84, tamano: 0.08, color: '#FFFFFF', negrita: true, alinear: 'left', mayus: false },
      { rol: 'firma', texto: 'Sonrisa Llena', x: 0.08, y: 0.92, ancho: 0.5, tamano: 0.025, color: '#bbb', negrita: false, alinear: 'left' },
    ] },
    { fondo: '#F5F1E8', foto: null, textos: [{ rol: 'cuerpo', texto: 'Cobrar al final', x: 0.1, y: 0.4, ancho: 0.8, tamano: 0.05, color: '#111', negrita: false, alinear: 'center' }] },
  ],
});

test('leer lo que devuelve la IA: lo bueno pasa, acotado a la lámina', () => {
  const r = leerReplica(BUENO, { laminas: 2 }) as Replica;
  assert.ok(!('error' in r));
  assert.equal(r.laminas.length, 2);
  assert.equal(r.titulo, '5 errores al cobrar');
  assert.equal(r.laminas[0].textos[1].color, '#BBBBBB', 'un color corto se lee completo');
  assert.equal(r.laminas[1].textos[0].alinear, 'center');
  assert.equal(r.laminas[0].foto?.persona, true);
});

test('leer lo que devuelve la IA: nada sale de la lámina ni es enorme; un rol inventado es «cuerpo»', () => {
  const r = leerReplica(JSON.stringify({ laminas: [{ fondo: 'rojo', textos: [
    { rol: 'banner', texto: 'Hola', x: 1.4, y: -2, ancho: 3, tamano: 0.9, color: 'blue' },
    { rol: 'titulo', texto: '   ', x: 0, y: 0 },
  ] }] }), { laminas: 1 }) as Replica;
  const t = r.laminas[0].textos;
  assert.equal(t.length, 1, 'un texto vacío no es una capa');
  assert.equal(t[0].rol, 'cuerpo');
  assert.ok(t[0].x <= 0.95 && t[0].y >= 0 && t[0].x + t[0].ancho <= 1.0001, `fuera de la lámina: ${JSON.stringify(t[0])}`);
  assert.ok(t[0].tamano <= 0.16);
  assert.equal(r.laminas[0].fondo, '#FFFFFF', 'un color que no es #RRGGBB cae al blanco');
  assert.equal(t[0].color, '#111111', 'y la tinta, a la que se lee sobre ese fondo');
});

test('leer lo que devuelve la IA: el JSON roto se repara; sin textos, un error que se entiende', () => {
  const roto = '```json\n{"laminas":[{"fondo":"#000000","textos":[{"rol":"titulo","texto":"Hola","x":0.1,"y":0.1,"ancho":0.8,"tamano":0.06,"color":"#FFFFFF",}]}],}\n```';
  const r = leerReplica(roto, { laminas: 1 });
  assert.ok(!('error' in r), 'una coma de más no tira el trabajo');
  const vacio = leerReplica('{"laminas":[{"fondo":"#000000","textos":[]}]}', { laminas: 1 });
  assert.ok('error' in vacio);
  assert.ok('error' in leerReplica('no es un json', { laminas: 1 }));
  const muchas = leerReplica(JSON.stringify({ laminas: Array.from({ length: 30 }, () => ({ fondo: '#000000', textos: [{ texto: 'x' }] })) }), { laminas: 30 }) as Replica;
  assert.equal(muchas.laminas.length, LAMINAS_MAX, 'nunca más de las que se pueden armar');
});

test('el diseño: una página por lámina, cada texto una capa de texto en su lugar, en píxeles', () => {
  n = 0;
  const r = leerReplica(BUENO, { laminas: 2 }) as Replica;
  const doc = documentoDeReplica({ replica: r, estilo, marca: { nombre: 'Sonrisa Llena', usuario: null }, foto: null, nuevoId, notas: 'de @alguien' });
  assert.equal(doc.width, 1080);
  assert.equal(doc.height, 1350);
  const paginas = doc.pages as Array<Record<string, unknown>>;
  assert.equal(paginas.length, 2);
  assert.equal(paginas[0].name, 'Portada');
  assert.equal(paginas[1].name, 'Cierre');
  assert.equal(paginas[0].notes, 'de @alguien', 'las notas, sólo en la primera');
  assert.equal(paginas[1].notes, undefined);
  assert.deepEqual(paginas[0].background, { type: 'solid', color: '#111111' });
  const objs = paginas[0].objects as Array<Record<string, unknown>>;
  const titular = objs.find((o) => o.name === 'Titular')!;
  assert.equal(titular.type, 'textbox');
  assert.equal(titular.text, '5 errores que te hacen perder pacientes');
  assert.equal(titular.left, Math.round(0.08 * 1080));
  assert.ok((titular.fontSize as number) >= Math.round(0.08 * 1080), 'el titular llena: nunca más chico que lo pedido');
  assert.equal(titular.fontWeight, 800);
  assert.match(String(titular.fontFamily), /Montserrat/, 'una letra REAL del editor, no la serif de un tipo de MaKo');
  assert.ok((titular.top as number) >= 0 && (titular.top as number) + (titular.height as number) <= 1350, 'entra en la lámina');
  // Sin foto del cliente NO hay recuadro gris ni «Tu foto»: la lámina es tipografía y color.
  assert.ok(!objs.some((o) => o.type === 'rect'), 'sin recuadros');
  assert.ok(!objs.some((o) => /Tu foto|Foto:/.test(String(o.text ?? o.name))), 'sin «Tu foto»');
});

test('el diseño: la foto del cliente va donde había una PERSONA, cubriendo su lugar sin deformarse; un anuncio cuadrado es 1:1', () => {
  const r = leerReplica(BUENO, { laminas: 2 }) as Replica;
  const foto = { id: 'f1', url: 'https://x.supabase.co/storage/v1/object/public/image-editor/9/f1.jpg', ancho: 1000, alto: 2000 };
  const doc = documentoDeReplica({ replica: r, estilo, marca: { nombre: 'X', usuario: null }, foto, nuevoId });
  const img = ((doc.pages as Array<Record<string, unknown>>)[0].objects as Array<Record<string, unknown>>).find((o) => o.type === 'image')!;
  assert.equal(img.src, foto.url);
  assert.equal(img.assetId, 'f1');
  const lugarW = Math.round(0.5 * 1080); const lugarH = Math.round(0.6 * 1350);
  assert.ok(Math.abs((img.width as number) * (img.scaleX as number) - lugarW) < 1, 'cubre el ancho');
  assert.ok(Math.abs((img.height as number) * (img.scaleY as number) - lugarH) < 1, 'cubre el alto');
  assert.equal(img.scaleX, img.scaleY, 'sin deformarse');
  // Donde NO había una persona (un paisaje), no va su cara.
  const paisaje = { ...r, laminas: [{ ...r.laminas[0], foto: { ...r.laminas[0].foto!, persona: false } }] };
  const sinCara = documentoDeReplica({ replica: paisaje, estilo, marca: { nombre: 'X', usuario: null }, foto, nuevoId });
  assert.ok(!((sinCara.pages as Array<Record<string, unknown>>)[0].objects as Array<Record<string, unknown>>).some((o) => o.type === 'image'));
  const cuadrado = documentoDeReplica({ replica: { ...r, proporcion: '1:1' }, estilo, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId });
  assert.equal(cuadrado.height, 1080);
  const t = ((cuadrado.pages as Array<Record<string, unknown>>)[0].objects as Array<Record<string, unknown>>).find((o) => o.name === 'Titular')!;
  assert.ok((t.top as number) + (t.height as number) <= 1080, 'se mide contra SU alto: en 1:1 entra en 1080');
});

test('el armado en vivo: una línea por evento, y una línea a medias no rompe nada', () => {
  const a = lineaDeEvento({ fase: 'leer', laminas: 5, vistas: 1 });
  const b = lineaDeEvento({ fase: 'fin', ok: true, id: 'abc', titulo: 'Carrusel · X' });
  assert.ok(a.endsWith('\n'));
  assert.deepEqual(eventosDe(a + b + '{"fase":"lam'), [{ fase: 'leer', laminas: 5, vistas: 1 }, { fase: 'fin', ok: true, id: 'abc', titulo: 'Carrusel · X' }]);
  assert.match(notasDeReplica({ creador: { nombre: 'Ana', usuario: 'ana.ventas' }, url: 'https://www.instagram.com/p/XYZ/' }), /@ana\.ventas[\s\S]*instagram\.com\/p\/XYZ/);
});

test('las medidas de una imagen por sus bytes (la foto del cliente se coloca con ellas)', () => {
  const png = new Uint8Array(24); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); png.set([0, 0, 4, 56], 16); png.set([0, 0, 5, 70], 20);
  assert.deepEqual(medidasDeImagen(png), { ancho: 1080, alto: 1350 });
  const gif = new Uint8Array(10); gif.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xf0, 0x00]);
  assert.deepEqual(medidasDeImagen(gif), { ancho: 320, alto: 240 });
  // JPEG: SOI, un APP0 de 16 bytes y un SOF0 con alto 600 y ancho 800.
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0, 0, 0, 0]);
  assert.deepEqual(medidasDeImagen(jpg), { ancho: 800, alto: 600 });
  assert.equal(medidasDeImagen(new Uint8Array([1, 2, 3])), null);
});

test('sin la IA: dice qué hacer, y sólo manda a conectar cuando lo que falta es la IA', () => {
  const sin = avisoSinIA('No hay ninguna IA que pueda mirar esto. Conecta tu Claude, tu GPT o tu Gemini en Integraciones.');
  assert.equal(sin.conectar, CONECTAR_IA);
  assert.match(sin.aviso, /Conecta tu Claude/);
  const caida = avisoSinIA('No se pudo leer el documento con ninguna IA. gemini: HTTP 503 high demand');
  assert.equal(caida.conectar, null);
  assert.match(caida.aviso, /no es tu configuración de MaKo/);
  assert.deepEqual(marcasDeVoseo(sin.aviso + caida.aviso), []);
});

const T = (rol: string, texto: string, o: Record<string, unknown> = {}) => ({ rol, texto, x: 0.1, y: 0.3, ancho: 0.5, tamano: 0.03, color: '#111111', negrita: false, alinear: 'left', mayus: false, letra: 'sans', ...o }) as never;

test('el diseño llena la lámina: texto chiquito crece, conserva la jerarquía y nada se pisa', () => {
  const textos = ajustarTextos([
    T('titulo', 'Cómo cobrar más sin perder clientes', { tamano: 0.03, y: 0.1 }),
    T('cuerpo', 'Tres cambios simples que puedes hacer hoy mismo en tu consulta', { tamano: 0.02, y: 0.4 }),
  ], { ancho: 1080, alto: 1350, libre: true });
  const [t, c] = textos;
  assert.ok(t.tamano * 1080 >= 81, 'el titular es grande (antes 32 px)');
  assert.ok(c.tamano * 1080 >= 45, 'el cuerpo se lee (antes 22 px)');
  assert.ok(t.tamano > c.tamano, 'el titular sigue siendo el más grande');
  assert.ok(t.ancho >= 0.84, 'sin foto, usa el ancho de la lámina');
  const alturaT = altoEstimado(t.texto, t.tamano * 1080, t.ancho * 1080, 1.06);
  assert.ok(t.y * 1350 + alturaT <= c.y * 1350, 'el cuerpo va debajo del titular, sin pisarlo');
  const fin = c.y * 1350 + altoEstimado(c.texto, c.tamano * 1080, c.ancho * 1080, 1.3);
  assert.ok(fin <= 1350 * 0.93, 'no se sale de la lámina');
  assert.ok(fin - t.y * 1350 >= 1350 * 0.45, 'ocupa buena parte de la lámina, no un renglón perdido');
});

test('el diseño: un texto enorme se achica para entrar, y con foto del cliente sólo se acotan los tamaños', () => {
  const largo = 'palabra '.repeat(60).trim();
  const [g] = ajustarTextos([T('cuerpo', largo, { tamano: 0.12, ancho: 0.84, x: 0.08, y: 0.1 })], { ancho: 1080, alto: 1350, libre: true });
  assert.ok(g.tamano <= 0.07, 'el cuerpo tiene tope');
  assert.ok(g.y * 1350 + altoEstimado(g.texto, g.tamano * 1080, g.ancho * 1080, 1.3) <= 1350, 'entra');
  const [f] = ajustarTextos([T('titulo', 'Hola', { tamano: 0.01, x: 0.05, ancho: 0.4, y: 0.2 })], { ancho: 1080, alto: 1350, libre: false });
  assert.equal(f.x, 0.05, 'con foto, el lugar es el que vio la IA');
  assert.equal(f.ancho, 0.4);
  assert.ok(f.tamano >= 0.075, 'pero el tamaño no queda chiquito');
});

test('las letras: sólo del editor (si no, caen a la del sistema en silencio) y la serif sólo si el original es serif', () => {
  for (const familia of FAMILIAS_DE_LA_REPLICA) assert.ok(fuenteDelEditorDeImagen(familia), `el editor no tiene «${familia}»`);
  const r = leerReplica(JSON.stringify({ laminas: [{ fondo: '#fff', textos: [T('titulo', 'A'), T('cuerpo', 'B', { letra: 'inventada' }), T('titulo', 'C', { letra: 'serif' })] }] }), { laminas: 1 }) as Replica;
  assert.deepEqual(r.laminas[0].textos.map((t) => t.letra), ['sans', 'sans', 'serif'], 'una letra inventada es sans');
  const doc = documentoDeReplica({ replica: r, estilo, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId });
  const fam = ((doc.pages as Array<Record<string, unknown>>)[0].objects as Array<Record<string, unknown>>).map((o) => String(o.fontFamily));
  assert.match(fam[0], /Montserrat/);
  assert.match(fam[1], /Inter/);
  assert.match(fam[2], /Playfair/);
  const conMarca = documentoDeReplica({ replica: r, estilo, marca: { nombre: 'X', usuario: null }, foto: null, nuevoId, conFuentesDeMarca: true });
  assert.match(String((((conMarca.pages as Array<Record<string, unknown>>)[0].objects as Array<Record<string, unknown>>)[0]).fontFamily), new RegExp(estilo.titular.familia), 'con kit, la letra de la marca');
});

test('el prompt: sin avatar no se piden fotos; el texto llena; con el pie, sólo para entender el tema', () => {
  const sin = promptDeReplica(base);
  assert.match(sin, /No pongas fotos ni personas/);
  assert.match(sin, /LLENA la lámina/);
  assert.doesNotMatch(sin, /espacio para su foto/);
  const con = promptDeReplica({ ...base, vistas: 1, pie: 'Mi primer cliente de 1000 dólares. Comenta GUÍA' });
  assert.match(con, /<<<PIE[\s\S]*primer cliente[\s\S]*PIE>>>/);
  assert.match(con, /NO copies sus frases/);
});

test('«Editar» sin láminas (con guías): letra de palo seco, texto grande y dentro de la lámina; con letras de la marca, se respetan', () => {
  const lista = tipoCarrusel('lista')!;
  assert.equal(lista.estilo.titular.respaldo, 'serif', 'el tipo «lista» es serif: lo que se veía en editar-aviso.png');
  const e = estiloSinSerif(lista.estilo, null);
  assert.equal(e.titular.familia, 'Montserrat');
  assert.equal(e.titular.respaldo, 'sans-serif');
  const conMarca = estiloSinSerif(lista.estilo, { fuentes: { titulos: 'Fraunces', texto: null } } as never);
  assert.equal(conMarca.titular.familia, lista.estilo.titular.familia, 'con letras de la marca, no se toca');
  const doc = documentoDeCarrusel({ laminas: lista.estructura(5), estilo: e, marca: { nombre: 'Sonrisa Llena', usuario: 'sonrisa' }, nuevoId });
  for (const pg of doc.pages as Array<{ objects: Array<Record<string, unknown>> }>) {
    const titular = pg.objects.find((o) => o.name === 'Titular')!;
    assert.ok((titular.fontSize as number) >= 64, 'el titular se lee de un vistazo (antes 72 fijo, y el cuerpo de 42)');
    for (const o of pg.objects.filter((x) => x.type === 'textbox')) assert.ok((o.top as number) + (o.height as number) <= 1350, `${String(o.name)} entra en la lámina`);
    const texto = pg.objects.find((o) => o.name === 'Texto' || o.name === 'Bajada');
    if (texto) assert.ok((texto.top as number) >= (titular.top as number) + (titular.height as number), 'el texto va debajo del titular');
  }
});
