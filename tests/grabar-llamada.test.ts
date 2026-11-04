// =============================================================================
// Grabar una llamada desde MaKo (04/11/2026): las reglas que deciden SIN la base (lib/grabar-llamada-reglas.ts)
// =============================================================================
// Pedido de Martín: «quiero que implementes el botón de "grabar" en el detail de un lead y en un dashboard template que sea
// "Call Calling"». Lo que fija este archivo, corriendo las funciones:
//   1. lo que la pantalla dice que NO se puede grabar, por aparato (`queSeGraba`): el teléfono, la pestaña, el navegador viejo;
//   2. el tipo de un archivo por sus primeros bytes (un audio de verdad grabado en Chromium, no un texto que «dice» ser audio);
//   3. la ruta en el bucket: sólo con un negocio, un uuid y un número de parte válidos (nada de `..`);
//   4. la transcripción de la llamada con su minuto, en orden, sin las partes vacías;
//   5. CUÁNDO se analiza: con TODAS las partes transcritas, nunca antes; una parte trabada traba la llamada con su porqué;
//   6. la llamada como reunión para el Closing: grabador `grabadora`, su clave negativa y estable, quien grabó de anfitrión.
//
// PROBADO ROMPIÉNDOLO (04/11/2026; base 8 / 0, de a una y restaurando):
//   · `queSigue` sin esperar las partes que faltan (analizar con 2 de 3)         → 7 / 1 (el 5)
//   · `turnosDePartes` sin ordenar por número                                       → 6 / 2 (el 4 y el 6)
//   · `rutaDeParte` sin validar el uuid (deja pasar «../x»)                        → 7 / 1 (el 3)
//   · `queSeGraba` sin la línea del teléfono (le ofrece la pestaña)                → 7 / 1 (el 1)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_PARTES, SEGUNDOS_POR_PARTE, SIN_IA_PARA_TRANSCRIBIR, TOPE_BYTES_PARTE, claveDeGrabacion, contesto, duracionTexto, elegirMime,
  esIdGrabacion, extDeMime, mimeDeBytes, queSeGraba, queSigue, reunionDeGrabacion, rutaDeParte, turnosDePartes, type ParteGuardada,
} from '../lib/grabar-llamada-reglas';
import { leerRef, refDeReunion } from '../lib/grabadores/reunion';

const ID = '3f2b8c1e-9a4d-4c6b-8e2f-0a1b2c3d4e5f';

test('1. lo que NO se puede grabar se dice, por aparato, en una línea', () => {
  const tel = queSeGraba({ graba: true, telefono: true, pestana: true });
  assert.equal(tel.puede, true);
  assert.equal(tel.ofrecePestana, false, 'en el teléfono no hay pestaña que compartir');
  assert.match(tel.linea, /no se graba/i, 'una llamada del MISMO teléfono no se graba (Android da silencio, iOS corta el micrófono)');
  const chrome = queSeGraba({ graba: true, telefono: false, pestana: true });
  assert.equal(chrome.ofrecePestana, true);
  assert.match(chrome.linea, /pestaña/);
  const safari = queSeGraba({ graba: true, telefono: false, pestana: false });
  assert.equal(safari.ofrecePestana, false);
  assert.match(safari.linea, /altavoz/, 'sin el audio de la pestaña, el otro lado sólo se oye en altavoz');
  const viejo = queSeGraba({ graba: false, telefono: false, pestana: false });
  assert.equal(viejo.puede, false);
  for (const q of [tel, chrome, safari, viejo]) {
    assert.ok(!q.linea.includes('\n') && q.linea.length <= 120, `una línea corta: «${q.linea}»`);
    // El voseo lo barre tests/puente-panel-copy.test.ts sobre todo el repo.
  }
});

test('2. el tipo del archivo sale de sus primeros bytes (y el navegador elige el primero que sabe grabar)', () => {
  const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81]);
  const ogg = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0, 0, 0, 0, 0]);
  const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
  assert.equal(mimeDeBytes(webm), 'audio/webm');
  assert.equal(mimeDeBytes(ogg), 'audio/ogg');
  assert.equal(mimeDeBytes(mp4), 'audio/mp4');
  assert.equal(mimeDeBytes(new TextEncoder().encode('<html>audio/webm</html>')), null, 'un texto que dice ser audio no es audio');
  assert.equal(mimeDeBytes(new Uint8Array([0x1a, 0x45])), null, 'demasiado corto');
  assert.equal(extDeMime('audio/mp4'), 'm4a');
  assert.equal(extDeMime('audio/webm;codecs=opus'), 'webm');
  // Chrome: webm/opus; Safari: mp4.
  assert.equal(elegirMime((m) => m.startsWith('audio/webm')), 'audio/webm;codecs=opus');
  assert.equal(elegirMime((m) => m === 'audio/mp4'), 'audio/mp4');
  assert.equal(elegirMime(() => false), null);
  assert.equal(elegirMime(() => { throw new Error('viejo'); }), null, 'un navegador que tira no rompe');
  // El tope por parte entra en un pedido a Vercel (~4,5 MB), y 3 minutos de AAC a 128 kbps (Safari) entran en el tope.
  assert.ok(TOPE_BYTES_PARTE < 4_500_000);
  assert.ok((128_000 / 8) * SEGUNDOS_POR_PARTE < TOPE_BYTES_PARTE);
});

test('3. la ruta en el bucket: negocio, uuid y número válidos, y nada más', () => {
  assert.equal(rutaDeParte(13, ID, 0, 'audio/webm'), `13/${ID}/0.webm`);
  assert.equal(rutaDeParte(13, ID.toUpperCase(), 2, 'audio/mp4'), `13/${ID}/2.m4a`, 'el id va en minúscula: la misma ruta siempre');
  assert.equal(rutaDeParte(13, '../7/x', 0, 'audio/webm'), null);
  assert.equal(rutaDeParte(13, `${ID}/../x`, 0, 'audio/webm'), null);
  assert.equal(rutaDeParte(0, ID, 0, 'audio/webm'), null);
  assert.equal(rutaDeParte(13, ID, -1, 'audio/webm'), null);
  assert.equal(rutaDeParte(13, ID, MAX_PARTES, 'audio/webm'), null, 'más de 2 horas no');
  assert.equal(esIdGrabacion(ID), true);
  assert.equal(esIdGrabacion('1; drop table'), false);
});

const parte = (n: number, texto: string | null, estado: ParteGuardada['estado'] = 'lista'): ParteGuardada =>
  ({ n, inicio_seg: n * SEGUNDOS_POR_PARTE, segundos: SEGUNDOS_POR_PARTE, estado, texto });

test('4. la transcripción sale con su minuto, en orden, sin las partes vacías', () => {
  const t = turnosDePartes([parte(2, 'tres'), parte(0, 'uno'), parte(1, '   '), parte(3, 'cuatro', 'error')]);
  assert.deepEqual(t.map((x) => [x.segundo, x.texto]), [[0, 'uno'], [2 * SEGUNDOS_POR_PARTE, 'tres']]);
  assert.ok(t.every((x) => x.hablante === null && x.email === null), 'sin diarizar: no se inventa quién habló');
});

test('5. se analiza con TODAS las partes transcritas, nunca antes', () => {
  // Sin «terminar» (la última parte se está grabando): esperar.
  assert.equal(queSigue([parte(0, 'a'), parte(1, 'b')], null).tipo, 'esperar');
  // Terminó con 3 partes y llegaron 2: esperar.
  assert.equal(queSigue([parte(0, 'a'), parte(1, 'b')], 3).tipo, 'esperar');
  // Llegaron las 3 pero una sigue pendiente: esperar.
  assert.equal(queSigue([parte(0, 'a'), parte(1, null, 'pendiente'), parte(2, 'c')], 3).tipo, 'esperar');
  // Todas: analizar.
  assert.deepEqual(queSigue([parte(0, 'a'), parte(1, 'b'), parte(2, 'c')], 3), { tipo: 'analizar', vacia: false });
  // No se oyó nada: se dice, no se paga un análisis.
  assert.deepEqual(queSigue([parte(0, ''), parte(1, null)], 2), { tipo: 'analizar', vacia: true });
  // Sin IA para transcribir: trabada, con el audio guardado y la frase de qué falta.
  const sin = queSigue([parte(0, null, 'sin_ia'), parte(1, null, 'sin_ia')], 2);
  assert.equal(sin.tipo, 'trabada');
  assert.ok(sin.tipo === 'trabada' && sin.sinIa && sin.motivo === SIN_IA_PARA_TRANSCRIBIR);
  // Una con error y otra sin IA: un error (se reintenta), no «sin IA».
  const mezcla = queSigue([parte(0, null, 'error'), parte(1, null, 'sin_ia')], 2);
  assert.ok(mezcla.tipo === 'trabada' && !mezcla.sinIa);
  // Cero partes (cortó en el acto): analizar vacía, no esperar para siempre.
  assert.deepEqual(queSigue([], 0), { tipo: 'analizar', vacia: true });
});

test('6. la llamada como reunión para el Closing: su grabador, su clave y quien grabó', () => {
  const fila = { id: ID, lead_id: 41, origen: 'cold-calling' as const, autor: 'Ana Closer', estado: 'transcribiendo' as const, duracion_seg: 365, created_at: '2026-11-04T15:00:00.000Z', terminada_at: null };
  const r = reunionDeGrabacion(fila, [parte(1, 'después'), parte(0, 'hola')]);
  assert.equal(r.grabador, 'grabadora');
  assert.equal(r.clave, claveDeGrabacion(ID));
  assert.ok(r.clave < 0 && Number.isSafeInteger(r.clave), 'negativa, como cualquier grabador que no es Fathom');
  assert.equal(claveDeGrabacion(ID.toUpperCase()), r.clave, 'estable: el mismo id da la misma clave');
  assert.deepEqual(leerRef(refDeReunion(r)), { grabador: 'grabadora', id: ID }, 'la ref vuelve a la grabación');
  assert.equal(r.anfitrion?.nombre, 'Ana Closer', 'quien grabó es el closer de la llamada');
  assert.equal(r.fin, '2026-11-04T15:06:05.000Z');
  assert.deepEqual(r.transcripcion?.map((x) => x.texto), ['hola', 'después']);
  assert.deepEqual(r.invitados, [], 'sin emails: el lead lo fija quien grabó');
  assert.doesNotMatch(r.titulo, /Ana|41/, 'el título no lleva nombres');
});

test('7. cómo terminó: «No contestó» es la única sin conversación', () => {
  assert.equal(contesto('no_contesto'), false);
  assert.equal(contesto('hablo'), true);
  assert.equal(contesto('agendo'), true);
  assert.equal(contesto('no_interesa'), true);
  assert.equal(contesto(null), false);
  assert.equal(duracionTexto(65), '1:05');
  assert.equal(duracionTexto(3725), '1:02:05');
  assert.equal(duracionTexto(null), '0:00');
});

test('8. las tablas nuevas están en las dos listas del inquilino (o se mezclan entre negocios)', () => {
  const leer = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');
  for (const t of ['llamadas_grabadas', 'llamadas_grabadas_partes']) {
    assert.match(leer('lib/workspace.ts'), new RegExp(`'${t}'`), `${t} falta en TENANT_TABLES: getTenantDb no filtraría por negocio`);
    assert.match(leer('lib/tablas-de-inquilino.ts'), new RegExp(`'${t}'`), `${t} falta en TABLAS_DE_INQUILINO: el reset no la vaciaría`);
  }
  const mig = leer('supabase/migrations/0390_llamadas_grabadas.sql');
  assert.match(mig, /revoke all on llamadas_grabadas from anon, authenticated/);
  assert.match(mig, /revoke all on llamadas_grabadas_partes from anon, authenticated/);
  assert.match(mig, /'llamadas-grabadas', 'llamadas-grabadas', false/, 'el bucket es PRIVADO');
});
