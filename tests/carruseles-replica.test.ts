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
// Y la miniatura de YouTube (6/11/2026), base 20/0, restaurando desde memoria:
//   · `leerReplica` sin forzar 16:9 y una lámina → 1 rojo;
//   · `promptDeReplica` sin el prompt de miniatura → 1 rojo;
//   · `esCdnPermitido` sin mirar https, usuario ni puerto → 1 rojo; con `includes` en vez del host exacto → 1 rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { marcasDeVoseo } from '../lib/voseo';
import { altoEstimado, documentoDeCarrusel } from '../lib/carruseles/documento';
import { estiloSinSerif } from '../lib/carruseles/marca-kit';
import { fuenteDelEditorDeImagen } from '../lib/image-editor/fuente-del-editor';
import {
  ALTO_MINIATURA, ANCHO_MINIATURA, CONECTAR_IA, FAMILIAS_DE_LA_REPLICA, LAMINAS_MAX, ajustarTextos, avisoSinIA, documentoDeReplica, documentoGuiaMiniatura,
  conElArrobaDelNegocio, esCdnPermitido, eventosDe, fasesSegunLaIA, leerReplica, lineaDeEvento, medidasDe, medidasDeImagen, notasDeReplica, promptDeReplica, proveedorDelError,
  vuelveASinVer, type Replica,
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
  // 6/11/2026: Martín leyó «Tu IA no contestó ahora» sin saber por qué. El aviso nombra la IA y dice de quién es lo que pasó.
  const caida = avisoSinIA('No se pudo leer el documento con ninguna IA. gemini: HTTP 503 high demand');
  assert.equal(caida.conectar, null);
  assert.match(caida.aviso, /^Tu Gemini tiene demasiada demanda/);
  assert.match(caida.aviso, /no de tu configuración/);
  const cuota = avisoSinIA('anthropic: HTTP 429 rate_limit_error');
  assert.match(cuota.aviso, /^Tu Claude no tiene cuota/);
  assert.equal(cuota.conectar, CONECTAR_IA, 'sin cuota, se arregla en Integraciones');
  const clave = avisoSinIA('openai: HTTP 401 Incorrect API key provided');
  assert.match(clave.aviso, /^Tu GPT rechazó la clave/);
  const lento = avisoSinIA('gemini: timeout after 120000ms');
  assert.match(lento.aviso, /tardó más de 2 minutos/);
  const otro = avisoSinIA('algo raro que nadie clasificó');
  assert.match(otro.aviso, /^Tu IA contestó con un error/);
  for (const a of [sin, caida, cuota, clave, lento, otro]) assert.match(a.aviso, /cada lámina trae una guía/, 'siempre dice qué quedó');
  assert.deepEqual(marcasDeVoseo([sin, caida, cuota, clave, lento, otro].map((a) => a.aviso).join(' ')), []);
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

// ── «Editar» una miniatura de YouTube (6/11/2026: la tab Thumbnails) ────────────────────────────────────────────────────────

test('miniatura: el prompt pide UNA lámina 16:9 con un gancho corto, y sin la imagen arma una igual', () => {
  const p = promptDeReplica({ ...base, laminas: 1, vistas: 1, miniatura: true, tituloOriginal: 'Cómo cerrar 10 ventas por WhatsApp' } as never);
  assert.match(p, /MINIATURA de un video de YouTube/);
  assert.match(p, /UNA sola lámina, apaisada \(16:9, 1280 × 720\)/);
  assert.match(p, /de 2 a 6 palabras/);
  assert.match(p, /nunca el título entero/);
  assert.match(p, /No pongas el nombre, el @ ni la marca del canal/);
  assert.match(p, /Sonrisa Llena/);
  const sinVer = promptDeReplica({ ...base, laminas: 1, vistas: 0, miniatura: true } as never);
  assert.match(sinVer, /No tienes la imagen/);
  assert.deepEqual(marcasDeVoseo(p + sinVer), []);
});

test('miniatura: lo que devuelve la IA se lee como UNA lámina 16:9 aunque traiga más, y el diseño es de 1280 × 720 sin reacomodar', () => {
  const crudo = JSON.stringify({ titulo: 'Más ventas', proporcion: '4:5', laminas: [
    { fondo: '#101010', textos: [{ rol: 'titulo', texto: 'VENDE MÁS HOY', x: 0.05, y: 0.3, ancho: 0.55, tamano: 0.11, color: '#FFE600', negrita: true, alinear: 'left', mayus: true, letra: 'gruesa' }], foto: { x: 0.6, y: 0, ancho: 0.4, alto: 1, persona: true, descripcion: 'cara' } },
    { fondo: '#FFFFFF', textos: [{ rol: 'cuerpo', texto: 'otra', x: 0.1, y: 0.1, ancho: 0.5, tamano: 0.03 }] },
  ] });
  const r = leerReplica(crudo, { laminas: 1, miniatura: true });
  assert.ok(!('error' in r), JSON.stringify(r));
  const rep = r as Replica;
  assert.equal(rep.proporcion, '16:9', 'una miniatura siempre es 16:9, diga lo que diga la IA');
  assert.equal(rep.laminas.length, 1);
  const doc = documentoDeReplica({ replica: rep, estilo, marca: { nombre: 'Sonrisa Llena', usuario: null }, foto: null, nuevoId });
  assert.equal(doc.width, ANCHO_MINIATURA);
  assert.equal(doc.height, ALTO_MINIATURA);
  const pag = (doc.pages as Array<Record<string, unknown>>)[0];
  assert.equal(pag.name, 'Miniatura');
  const tit = (pag.objects as Array<Record<string, unknown>>).find((o) => o.type === 'textbox')!;
  assert.equal(tit.text, 'VENDE MÁS HOY');
  assert.ok((tit.left as number) + (tit.width as number) <= ANCHO_MINIATURA && (tit.top as number) + (tit.height as number) <= ALTO_MINIATURA, 'dentro de la miniatura');
  assert.deepEqual(medidasDe('16:9'), { ancho: 1280, alto: 720 });
});

test('miniatura sin la IA: igual sale editable, con un titular grande y el nombre del negocio, nunca un recuadro de «Tu foto»', () => {
  const doc = documentoGuiaMiniatura({ marca: { nombre: 'Sonrisa Llena', usuario: null }, nuevoId, notas: 'Ejemplo de @canal' });
  assert.equal(doc.width, 1280);
  assert.equal(doc.height, 720);
  const objs = ((doc.pages as Array<Record<string, unknown>>)[0].objects as Array<Record<string, unknown>>);
  assert.ok(objs.every((o) => o.type === 'textbox'), 'sólo textos: nada de un recuadro para la foto');
  assert.ok(objs.some((o) => o.text === 'Sonrisa Llena'));
  for (const o of objs) assert.ok((o.left as number) + (o.width as number) <= 1280 && (o.top as number) + (o.height as number) <= 720, String(o.name));
  assert.deepEqual(marcasDeVoseo(objs.map((o) => String(o.text)).join(' ')), []);
});

test('las imágenes de afuera que «Editar» puede mirar: sólo los CDN de YouTube, Instagram y Meta, por https y sin trampas', () => {
  for (const ok of ['https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', 'https://scontent-gru1-1.cdninstagram.com/v/t51/x.jpg', 'https://scontent.xx.fbcdn.net/v/t39/x.jpg']) assert.equal(esCdnPermitido(ok), true, ok);
  for (const no of ['http://i.ytimg.com/vi/x/hq.jpg', 'https://i.ytimg.com.evil.tld/x.jpg', 'https://user:pass@i.ytimg.com/x.jpg', 'https://i.ytimg.com:8443/x.jpg',
    'https://evilcdninstagram.com/x.jpg', 'https://169.254.169.254/latest', 'no es una url']) assert.equal(esCdnPermitido(no), false, no);
});

test('de qué IA es el error: se nombra la marca comercial, o ninguna', () => {
  assert.equal(proveedorDelError('chatCheapTools(gemini · cuenta 2): HTTP 503'), 'Gemini');
  assert.equal(proveedorDelError('anthropic/claude-haiku: overloaded'), 'Claude');
  assert.equal(proveedorDelError('openai: 429'), 'GPT');
  assert.equal(proveedorDelError('se cortó'), null);
});

test('si la IA que mira falla, se prueba UNA vez sin mirar; salvo que sea la cuenta, la demora o que no haya IA', () => {
  for (const si of ['No se pudo leer el documento con ninguna IA. openai/OPENAI_API_KEY: respuesta vacía', 'gemini: HTTP 400 Unsupported MIME type', 'anthropic: image exceeds 5 MB maximum'])
    assert.equal(vuelveASinVer(si), true, si);
  for (const no of ['gemini: HTTP 429 RESOURCE_EXHAUSTED', 'anthropic: Your credit balance is too low', 'openai: HTTP 401 Incorrect API key provided',
    'gemini: The operation was aborted due to timeout', 'gemini: HTTP 503 high demand', 'No hay ninguna IA que pueda mirar esto. Conecta tu Claude, tu GPT o tu Gemini en Integraciones.'])
    assert.equal(vuelveASinVer(no), false, no);
});

test('el @ del negocio se queda y el que inventó el modelo se va; un mail no es un @', () => {
  // La segunda capa de «una regla en un prompt no es una regla»: el prompt pide no poner un @ y el modelo pone el del cliente.
  // Medido el 6/11/2026 con la IA real (ws9): las 10 láminas firmadas «@martinkoncke», un usuario que nadie cargó nunca.
  assert.equal(conElArrobaDelNegocio('Sonrisa Llena @sonrisallena', null), 'Sonrisa Llena');
  assert.equal(conElArrobaDelNegocio('Sígueme en @otrocreador hoy', null), 'Sígueme en hoy');
  // Con el @ del negocio cargado (hoy `marcaDelNegocio` devuelve siempre null, pero el día que se llene esta rama manda).
  assert.equal(conElArrobaDelNegocio('Sonrisa Llena @sonrisallena', 'sonrisallena'), 'Sonrisa Llena @sonrisallena');
  assert.equal(conElArrobaDelNegocio('Escríbeme a @SonrisaLlena', '@sonrisallena'), 'Escríbeme a @SonrisaLlena');
  assert.equal(conElArrobaDelNegocio('Nos ve @ajeno, no @sonrisallena', 'sonrisallena'), 'Nos ve, no @sonrisallena');
  // Un mail no se toca: ahí el `@` viene pegado a una letra.
  assert.equal(conElArrobaDelNegocio('hola@sonrisallena.com', null), 'hola@sonrisallena.com');
  assert.equal(conElArrobaDelNegocio('Escribe a hola@mako.com o a @nadie', null), 'Escribe a hola@mako.com o a');
  // Un texto que era SÓLO el @ queda vacío, y `leerReplica` descarta un texto vacío (no deja una capa fantasma).
  assert.equal(conElArrobaDelNegocio('@sonrisallena', null), '');
  const r = leerReplica(JSON.stringify({ proporcion: '4:5', titulo: 'x', laminas: [{ fondo: '#000000', textos: [
    { rol: 'titulo', texto: 'TU TITULAR', x: 0.1, y: 0.2, ancho: 0.8, tamano: 0.1, color: '#FFFFFF' },
    { rol: 'firma', texto: '@sonrisallena', x: 0.1, y: 0.9, ancho: 0.8, tamano: 0.03, color: '#FFFFFF' },
  ], foto: null }] }), { laminas: 1 });
  assert.ok(!('error' in r));
  assert.deepEqual((r as Replica).laminas[0].textos.map((t) => t.texto), ['TU TITULAR']);
});

// =============================================================================
// El tilde verde que decía «con tu IA» sin IA (7/11/2026, medido en producción)
// =============================================================================
// Se replicó un carrusel en un workspace sin IA conectada. Las tres fases quedaron en verde —incluida
// «Escribo tu versión con tu IA»— y en el MISMO cuadro, debajo, el aviso decía «Conecta tu Claude, tu GPT o
// tu Gemini… Por ahora, cada lámina trae una guía». El servidor ya mandaba `sinIA: true`: el dato estaba y la
// pantalla no lo usaba.

const FASES_REALES = [
  { id: 'leer', texto: 'Leo sus láminas' },
  { id: 'escribir', texto: 'Escribo tu versión con tu IA' },
  { id: 'armar', texto: 'Armo el diseño editable' },
] as const;

test('sin IA conectada, ninguna fase afirma haber escrito con la IA', () => {
  const fases = fasesSegunLaIA(FASES_REALES, true);
  for (const f of fases) {
    assert.ok(!/con tu IA/i.test(f.texto),
      `la fase «${f.texto}» dice que escribió con la IA y no hay IA conectada`);
  }
});

test('sin IA, la fase dice lo que SÍ pasó: una guía en cada lámina', () => {
  // No alcanza con borrar la mentira: si el texto queda vago, la persona igual va a buscar en el diseño unos
  // textos suyos que nadie escribió. Tiene que decir qué hay y por qué.
  const escribir = fasesSegunLaIA(FASES_REALES, true).find((f) => f.id === 'escribir');
  assert.ok(escribir, 'desapareció la fase de escribir');
  assert.match(escribir.texto, /guía/i, `la fase no dice qué quedó en las láminas: «${escribir.texto}»`);
  assert.match(escribir.texto, /IA/, `la fase no dice que falta conectar la IA: «${escribir.texto}»`);
});

test('CON IA, los textos quedan tal cual: esto no cambia el camino bueno', () => {
  assert.deepEqual(
    fasesSegunLaIA(FASES_REALES, false),
    FASES_REALES.map((f) => ({ id: f.id, texto: f.texto })),
  );
});

test('las otras fases no se tocan: ésas SÍ pasaron', () => {
  // Leer las láminas y armar el diseño ocurren con IA o sin ella. Cambiarles el texto seria la mentira
  // opuesta: decir que no se hizo algo que sí se hizo.
  const fases = fasesSegunLaIA(FASES_REALES, true);
  assert.equal(fases.find((f) => f.id === 'leer')?.texto, 'Leo sus láminas');
  assert.equal(fases.find((f) => f.id === 'armar')?.texto, 'Armo el diseño editable');
});

test('la pantalla usa `sinIA` del servidor, no lo adivina', () => {
  // El bug no era que faltara el dato: era que la pantalla no lo leía. Si alguien saca ese `fin?.sinIA` del
  // call-site, el tilde verde vuelve y ningún otro test lo nota.
  const src = readFileSync(join(import.meta.dirname, '..', 'app/image-editor/carruseles/EditarCarrusel.tsx'), 'utf8');
  assert.match(src, /fasesSegunLaIA\(ej\.fases,\s*!!fin\?\.sinIA\)/,
    'el diálogo dejó de pasarle `sinIA` a las fases: vuelve el tilde que dice «con tu IA» sin IA');
});
