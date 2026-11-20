// La cola de salida (20/11/2026; la auditoría de los chats, onboarding-3 y 4): los mensajes de MaKo salen de a uno, con puntitos según su
// largo y contando lo que ya se esperó, y su tarjeta, recuadro o botón después de una pausa. El historial, de una. El núcleo de
// app/_chat/useColaDeSalida.ts, paso a paso con un reloj a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MS_ESCRIBE_TOPE, MS_PAUSA_PIEZA, filasVisibles, msEscribiendo, pasoDeLaCola, type EstadoCola, type FilaDeCola } from '../app/_chat/useColaDeSalida';

const nada = (ids: string[] = []): EstadoCola => ({ mostrados: new Set(ids), piezas: new Set(ids), ultimo: null, desde: null });
const mako = (id: string, texto: string, pieza = false): FilaDeCola => ({ id, de: 'mako', texto, pieza });
const yo = (id: string, texto: string): FilaDeCola => ({ id, de: 'yo', texto });
const nunca = () => false;

test('1. los puntitos: 600 ms + 20 ms por letra, con tope de 2.200 ms', () => {
  assert.equal(msEscribiendo(''), 600);
  assert.equal(msEscribiendo('¿Cómo te llamas?'), 600 + 20 * '¿Cómo te llamas?'.length);
  assert.equal(msEscribiendo('x'.repeat(500)), MS_ESCRIBE_TOPE);
});

test('2. el historial se dibuja de una; lo de la persona sale ya; el mensaje nuevo de MaKo, con sus puntitos', () => {
  const filas = [mako('a', 'Hola'), yo('a-r', 'Vale'), mako('b', '¿A qué WhatsApp te escribo?', true)];
  // Al abrir con todo en el historial: nada que hacer.
  assert.deepEqual(pasoDeLaCola(filas, nada(['a', 'a-r', 'b']), nunca, 0), { tipo: 'nada' });
  // La persona contestó (su respuesta sale ya) y llega la pregunta nueva.
  assert.deepEqual(pasoDeLaCola(filas, nada(['a']), nunca, 1000), { tipo: 'mostrar', id: 'a-r', conPieza: true });
  const p = pasoDeLaCola(filas, nada(['a', 'a-r']), nunca, 1000);
  assert.equal(p.tipo, 'esperar');
  assert.equal((p as { escribiendo: boolean }).escribiendo, true, 'con puntitos');
  assert.equal((p as { ms: number }).ms, msEscribiendo('¿A qué WhatsApp te escribo?'));
  // Lo visible incluye ya lo de la persona (no espera un render).
  assert.deepEqual(filasVisibles(filas, new Set(['a'])).map((f) => f.id), ['a', 'a-r']);
});

test('3. lo que tardó el servidor CUENTA: max(lo ya esperado, los puntitos)', () => {
  const filas = [mako('b', 'Un gusto, Valentina. ¿A qué WhatsApp te escribo?')];
  const ms = msEscribiendo(filas[0].texto);
  // Mandó en t=0; el servidor contestó en t=300: faltan ms - 300.
  const e = { ...nada(), desde: 0 };
  assert.deepEqual(pasoDeLaCola(filas, e, nunca, 300), { tipo: 'esperar', ms: ms - 300, escribiendo: true });
  // El servidor tardó más que los puntitos: sale ya.
  assert.deepEqual(pasoDeLaCola(filas, e, nunca, ms + 500), { tipo: 'mostrar', id: 'b', conPieza: true });
});

test('4. la pieza (tarjeta, recuadro, botón) sale después de su texto, a la pausa; y si llegan dos, el segundo trae sus puntitos', () => {
  const filas = [mako('b', 'Elige tu WhatsApp', true), mako('c', 'Y otra cosa')];
  const salio = pasoDeLaCola(filas, { ...nada(), desde: 0 }, nunca, 5000);
  assert.deepEqual(salio, { tipo: 'mostrar', id: 'b', conPieza: false }, 'el texto, sin su pieza todavía');
  const e: EstadoCola = { mostrados: new Set(['b']), piezas: new Set(), ultimo: { id: 'b', en: 5000 }, desde: null };
  assert.deepEqual(pasoDeLaCola(filas, e, nunca, 5100), { tipo: 'esperar', ms: MS_PAUSA_PIEZA - 100, escribiendo: false }, 'la pausa, sin puntitos');
  assert.deepEqual(pasoDeLaCola(filas, e, nunca, 5000 + MS_PAUSA_PIEZA), { tipo: 'pieza', id: 'b' });
  // El segundo: sus puntitos desde que salió la pieza.
  const e2: EstadoCola = { mostrados: new Set(['b']), piezas: new Set(['b']), ultimo: { id: 'b', en: 5000 }, desde: 5500 };
  assert.deepEqual(pasoDeLaCola(filas, e2, nunca, 5600), { tipo: 'esperar', ms: msEscribiendo('Y otra cosa') - 100, escribiendo: true });
});

test('5. un mensaje RETENIDO (espera su momento del video) no tiene puntitos hasta que se suelta; después, trae los suyos', () => {
  const filas = [mako('arr-video-whatsapp', ''), mako('arr-codigo', 'Para confirmar tu WhatsApp, toca «Abrir WhatsApp»…', true)];
  const e: EstadoCola = { mostrados: new Set(['arr-video-whatsapp']), piezas: new Set(['arr-video-whatsapp']), ultimo: { id: 'arr-video-whatsapp', en: 0 }, desde: 0 };
  assert.deepEqual(pasoDeLaCola(filas, e, (id) => id === 'arr-codigo', 3000), { tipo: 'retenido', id: 'arr-codigo' });
  // Suelto a los 4 s, con `desde` ya limpio (lo limpia el hook al estar retenido): los puntitos empiezan ahora.
  const p = pasoDeLaCola(filas, { ...e, desde: null }, nunca, 4000);
  assert.equal(p.tipo, 'esperar');
  assert.equal((p as { empieza?: number }).empieza, 4000);
  assert.equal((p as { escribiendo: boolean }).escribiendo, true);
});

test('6. las piezas sueltas de un turno (un bloque, una tarjeta) salen de a una, en la pausa, sin puntitos; lo que no es del turno, ya', () => {
  const filas: FilaDeCola[] = [{ id: 'h', de: 'ya', texto: 'del historial' }, mako('m', 'Te armé dos opciones'), { id: 'b', de: 'pieza', texto: '' }, { id: 't', de: 'pieza', texto: '' }];
  assert.deepEqual(filasVisibles(filas, new Set()).map((f) => f.id), ['h'], 'el historial, ya; lo del turno espera');
  const e: EstadoCola = { mostrados: new Set(['h', 'm']), piezas: new Set(['h', 'm']), ultimo: { id: 'm', en: 1000 }, desde: 1000 };
  assert.deepEqual(pasoDeLaCola(filas, e, nunca, 1200), { tipo: 'esperar', ms: MS_PAUSA_PIEZA - 200, escribiendo: false }, 'el bloque, en la pausa');
  assert.deepEqual(pasoDeLaCola(filas, e, nunca, 1000 + MS_PAUSA_PIEZA), { tipo: 'mostrar', id: 'b', conPieza: true });
  const e2: EstadoCola = { mostrados: new Set(['h', 'm', 'b']), piezas: new Set(['h', 'm', 'b']), ultimo: { id: 'b', en: 1500 }, desde: 1500 };
  assert.deepEqual(pasoDeLaCola(filas, e2, nunca, 1600), { tipo: 'esperar', ms: MS_PAUSA_PIEZA - 100, escribiendo: false }, 'la tarjeta, otra pausa después');
  assert.deepEqual(filasVisibles(filas, new Set(['h', 'm'])).map((f) => f.id), ['h', 'm']);
});
