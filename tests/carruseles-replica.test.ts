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
import {
  CONECTAR_IA, LAMINAS_MAX, avisoSinIA, documentoDeReplica, eventosDe, leerReplica, lineaDeEvento, medidasDeImagen, notasDeReplica,
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
  assert.equal(titular.top, Math.round(0.1 * 1350));
  assert.equal(titular.fontSize, Math.round(0.08 * 1080));
  assert.equal(titular.fontWeight, 800);
  // Sin foto del cliente, el lugar de la foto queda marcado (y se dice qué va).
  assert.ok(objs.some((o) => o.name === 'Foto: lugar' && o.type === 'rect'));
  assert.ok(objs.some((o) => o.name === 'Foto: qué va' && String(o.text).includes('la dueña sonriendo')));
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
  assert.equal(t.top, Math.round(0.1 * 1080), 'la posición se mide contra SU alto');
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
