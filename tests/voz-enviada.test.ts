// =============================================================================
// La nota de voz de Martín se dibuja como AUDIO (26/10/2026)
// =============================================================================
// Martín, desde el Centro, con captura de su nota de voz dibujada como texto en el chat «Cerebro»: «Y esto fue un audio, se
// deberia mandar el audio directamente... Y de ultima en los 3 puntitos ver la transcripción». Esto fija:
//   1. lo firmado dice que fue una nota (`voz: { segundos }`) y sin ella es el de siempre; los DOS validadores (el del
//      servidor y el del cartero) lo dejan pasar, y la PC entrega el texto como siempre: el audio no viaja;
//   2. el servidor guarda sólo el MP3 de un trabajo que firmó ser una nota, y la ruta mira el tamaño antes de leer;
//   3. la caja le da la nota a la pantalla, y sale como nota sólo si lo que se manda es ESA transcripción;
//   4. la burbuja dibuja el reproductor y no la transcripción; la transcripción va primero en el menú del mensaje;
//   5. la API dice que es un audio, con su transcripción aparte.
//
// PROBADO ROMPIÉNDOLO (26/10/2026): ver el registro al final del archivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { armarFirmable, esMp3, leerFirmable, nuevoPayload, problemaDeVoz, vozDeFirmado, MAX_BYTES_VOZ } from '../lib/operaciones-reglas';
import { agruparAvances, lineasDeConversacion, lineasParaLaApi, piezaParaLaApi, type LineaChat, type TrabajoP } from '../lib/centro-chats';
import { opcionesDelMensaje, SIN_MARCAS } from '../lib/centro-mensajes';
import { notaQueSale } from '../lib/centro-caja';
import { Hilo } from '../app/admin/operaciones/Hilo';
import type { TurnoChat } from '../lib/operaciones-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const cartero = () => import('../scripts/operaciones/cartero.mjs');
const LOCAL = 'local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8';
const ID = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
const AHORA = Date.parse('2026-10-26T03:41:00.000Z');
const TRANSCRIPCION = 'Para todas las tareas que estoy ejecutando hoy en día, dime qué desventajas voy a tener.';

const payload = (voz?: { segundos: number } | null) => nuevoPayload({
  id: ID, texto: TRANSCRIPCION, destino: LOCAL, cuenta: 'claude5', titulo: 'Cerebro', alcance: 'solo_esto', voz,
}, AHORA);

test('1. lo firmado dice que fue una nota; los dos validadores la dejan pasar y la PC entrega el texto, como siempre', async () => {
  const conVoz = armarFirmable(payload({ segundos: 42 }));
  const sinVoz = armarFirmable(payload());
  assert.ok(conVoz.endsWith(',"voz":{"segundos":42}}'), conVoz);
  assert.doesNotMatch(sinVoz, /voz/, 'sin nota, el texto firmado es el de siempre');
  assert.deepEqual(vozDeFirmado(conVoz), { segundos: 42 });
  assert.equal(vozDeFirmado(sinVoz), null);
  assert.equal(vozDeFirmado('{"voz":{"segundos":0}}'), null, 'cero segundos no es una nota');
  assert.equal(vozDeFirmado('no es json'), null);
  assert.ok(leerFirmable(conVoz, AHORA).ok, 'el servidor la rechaza');
  const c = await cartero();
  const leida = c.leerFirmable(conVoz, AHORA);
  assert.ok(leida.ok, 'el cartero la rechaza: el mensaje nunca llegaría');
  // Lo que recibe el chat: el texto, sin nada del audio (el audio nunca va a la PC).
  const recibe = c.mensaje(leida.p);
  assert.ok(recibe.includes(TRANSCRIPCION));
  assert.doesNotMatch(recibe, /voz|audio|segundos/i);
  assert.doesNotMatch(sinComentarios(leer('scripts/operaciones/cartero.mjs')), /\.voz\b/, 'el cartero usa la nota para algo');
});

test('2. el servidor guarda sólo el MP3 de un trabajo que firmó ser una nota, y la ruta mira el tamaño antes de leer', () => {
  const id3 = Uint8Array.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0]);
  const cuadro = Uint8Array.from([0xff, 0xfb, 0x90, 0x64, 0, 0]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(esMp3(id3) && esMp3(cuadro));
  assert.ok(!esMp3(png));
  assert.equal(problemaDeVoz(cuadro, { segundos: 3 }), null);
  assert.equal(problemaDeVoz(cuadro, null), 'Ese mensaje no es una nota de voz.');
  assert.equal(problemaDeVoz(png, { segundos: 3 }), 'Solo una nota de voz.');
  assert.equal(problemaDeVoz(new Uint8Array(MAX_BYTES_VOZ + 1).fill(0xff), { segundos: 3 }), 'La nota pesa demasiado.');
  const adj = sinComentarios(leer('lib/operaciones-adjuntos.ts'));
  assert.match(adj, /problemaDeVoz\(bytes, vozDeFirmado\(data\.firmado as string \| null\)\)/, 'guarda sin mirar lo firmado');
  assert.match(adj, /for \(const carpeta of \[CARPETA_ENVIADAS, CARPETA_VOCES\]\)/, 'las notas no se barren a los 14 días');
  const ruta = sinComentarios(leer('app/api/operaciones/adjuntos/route.ts'));
  const post = ruta.slice(ruta.indexOf('export async function POST'));
  assert.ok(post.indexOf('puedeOperar') < post.indexOf("busca.has('voz')"), 'la guarda del Centro va antes');
  assert.match(post, /busca\.has\('voz'\)\) \{[\s\S]*?largo <= MAX_BYTES_VOZ[\s\S]*?await req\.arrayBuffer\(\)/, 'lee antes de mirar el tamaño');
});

test('3. la nota sale como nota sólo si lo que se manda es ESA transcripción', () => {
  const nota = { audio: new Blob([new Uint8Array([0xff, 0xfb])]), segundos: 12, texto: TRANSCRIPCION };
  assert.equal(notaQueSale(nota, `${TRANSCRIPCION}\n`), nota);
  assert.equal(notaQueSale(nota, 'Otra cosa'), null, 'lo escrito salió como nota');
  assert.equal(notaQueSale(undefined, TRANSCRIPCION), null);
  const caja = sinComentarios(leer('app/_chat/nota-que-se-manda.ts'));
  assert.ok(caja.indexOf('onNota?.(') > -1 && caja.indexOf('onNota?.(') < caja.indexOf('onTexto(r.texto)'), 'la nota llega después que el texto');
  const motor = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  assert.match(motor, /const nota = notaQueSale\(notas\.current\[c\.clave\], borradorDe\(c\.clave\)\);/);
  assert.match(motor, /firma\.mandar\([^;]*subidos, voz\);/, 'la nota no va firmada');
  assert.match(motor, /if \(nota\) recordarVozEnviada\(r\.id, nota\.audio\);/, 'el audio no sube');
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    // Las props llevan `=>`: se mira el renglón de la caja, no hasta el primer «>».
    assert.match(sinComentarios(leer(f)), /<CajaChat [^\n]*onNota=\{/, `${f}: la caja no le da la nota`);
  }
});

const trabajo = (extra: Partial<TrabajoP> = {}): TrabajoP => ({
  id: ID, destino: LOCAL, destino_titulo: 'Cerebro', destino_cuenta: 'claude5', created_at: '2026-10-26T03:41:00.000Z',
  texto: TRANSCRIPCION, estado: 'entregado', motivo: null, cierre: null, ...extra,
});
const hilo = (w: TrabajoP) => renderToStaticMarkup(createElement(Hilo, {
  lineas: [{ tipo: 'trabajo', instante: Date.parse(w.created_at), trabajo: w }], pushes: [], ahora: AHORA + 60_000, vacio: '',
  quien: { titulo: 'Cerebro', animo: 'despierto' },
}));

test('4. la burbuja dibuja el reproductor, no la transcripción; la transcripción va primero en el menú', () => {
  const html = hilo(trabajo({ voz: { segundos: 42 } }));
  assert.match(html, /class="co-burbuja co-burbuja--voz"/);
  assert.match(html, /class="co-voz"/, 'sin reproductor');
  assert.match(html, /aria-label="Nota de voz de 0:42"/, 'sin lo que dura');
  assert.ok(!html.includes(TRANSCRIPCION), 'la transcripción se ve en la burbuja');
  // Un mensaje escrito, como siempre.
  const escrito = hilo(trabajo());
  assert.ok(escrito.includes(TRANSCRIPCION));
  assert.doesNotMatch(escrito, /co-voz/);
  // El menú: «Ver transcripción» primero en una nota, y nada en un mensaje escrito.
  const m = { id: 'w:1', propio: true, trabajo: trabajo({ voz: { segundos: 42 } }) };
  assert.deepEqual(opcionesDelMensaje(m, SIN_MARCAS)[0], { id: 'transcripcion', label: 'Ver transcripción' });
  assert.deepEqual(opcionesDelMensaje(m, SIN_MARCAS, true)[0], { id: 'transcripcion', label: 'Ocultar transcripción' });
  assert.ok(!opcionesDelMensaje({ ...m, trabajo: trabajo() }, SIN_MARCAS).some((o) => o.id === 'transcripcion'));
  // Las dos pantallas la abren con lo MISMO (voces-enviadas.ts).
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    assert.match(sinComentarios(leer(f)), /if \(id === 'transcripcion'\) \{ if \(m\.trabajo\) alternarTranscripcion\(m\.trabajo\.id\); return; \}/, f);
  }
});

test('5. la API dice que es un audio, con su transcripción aparte, y no repite el turno que la PC guardó', () => {
  const t = (uuid: string, rol: TurnoChat['rol'], at: string, texto: string, trabajoDe: string | null = null): TurnoChat =>
    ({ local: LOCAL, uuid, rol, de: null, texto, at, trabajo: trabajoDe });
  const lineas: LineaChat[] = lineasParaLaApi(
    [t('u1', 'yo', '2026-10-26T03:41:05.000Z', TRANSCRIPCION, ID), t('u2', 'el', '2026-10-26T03:42:00.000Z', 'Te respondo en el Centro.')],
    [trabajo({ voz: { segundos: 42 } })],
  );
  const piezas = agruparAvances(lineasDeConversacion(lineas)).map((p) => piezaParaLaApi(p, 'Cerebro'));
  assert.deepEqual(piezas, [
    { tipo: 'audio', de: 'Martín', at: '2026-10-26T03:41:00.000Z', segundos: 42, transcripcion: TRANSCRIPCION },
    { tipo: 'mensaje', de: 'Cerebro', at: '2026-10-26T03:42:00.000Z', texto: 'Te respondo en el Centro.' },
  ]);
  const run = sinComentarios(leer('lib/api-mako/areas/operaciones.run.ts'));
  assert.match(run, /lineasParaLaApi\(turnos, pedidos\.filter\(\(p\) => c\.locales\.includes\(p\.destino\)\), preguntas\)/, 'sin lo que mandó Martín');
});

// PROBADO ROMPIÉNDOLO (26/10/2026, base 5/0): lo firmado sin la nota → 1 rojo (1); `esMp3` que acepta todo → 1 rojo (2);
// guardar sin mirar lo firmado → 1 rojo (2); la caja sin `onNota` → 1 rojo (3); mandar sin firmar la nota → 1 rojo (3); la
// burbuja con el texto en vez del reproductor → 1 rojo (4); el menú sin «Ver transcripción» → 1 rojo (4); la API sin `audio`
// → 1 rojo (5).
