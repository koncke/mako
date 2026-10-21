// =============================================================================
// Lo de WhatsApp en el Ops Center y los cuatro pedidos de Martín del 17/10/2026 (14:44), fijados en el código
// =============================================================================
// Martín, desde el Centro: (1) «Pon la funcionalidad de "Responder" que tiene WhatsApp al desplazar un mensaje hacia la
// derecha... Y agrega todas las funcionalidades de Whatsapp al mantener click en un mensaje»; (2) «"Chats" - "Cerebro" y
// "Nuevo chat" no deben estar separados... solo que cerebro tiene la criatura de MaKo estrella, solo ese... Y siempre
// "Nuevo Chat" arriba de todo»; (3) «Cuando estoy en un chat y le doy para atrás en mobile, tarda bastante en
// reaccionar»; (4) «El botón de USO en mobile debe ir arriba de los chats junto a Second Brain».
// Las reglas: lib/centro-mensajes.ts. La pantalla: app/admin/operaciones/MensajeWA.tsx, Hilo.tsx, Conversacion.tsx y
// app/m/operaciones/ChatsMovil.tsx. La medición del «atrás», en docs/hallazgos-operaciones.md.
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos de 10; scratchpad/ops4/romper.py):
//   · `armarConCita` devolviendo sólo el texto (sin la cita) → 2 fallos (la cita y la burbuja que la lee);
//   · `buscarCitado` buscando desde el principio (el primero que empieza igual, no el último) → 1 fallo;
//   · `aplicarMarca` sin el tope de 3 fijados → 1 fallo;
//   · «Info» también en lo que dijo el chat → 1 fallo;
//   · el Cerebro sin la estrella forzada (gana la criatura elegida antes) → 1 fallo;
//   · «Uso y Runners» fuera de la fila de arriba (renombrado, como si se hubiera ido) → 1 fallo;
//   · la fila del teléfono sin `memo` → 1 fallo; el hilo sin `memo` → 1 fallo (el test del «atrás»);
//   · el motor mandando sin la cita (`textoParaMandar` solo) → 1 fallo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SIN_MARCAS, TOPE_FIJADOS, aplicarMarca, armarConCita, armarReenvio, buscarCitado, esReaccion, idDeLinea, leerCita, leerReenvio,
  opcionesDelMensaje, renglonDeCita, sanearCambio, sanearMarcas, sinOcultos, type MarcasChat,
} from '../lib/centro-mensajes';
import type { LineaChat } from '../lib/centro-chats';
import { ASPECTO_MAKO, FORMAS, aspectoDe, sanearAspecto } from '../lib/centro-munecos';
import { Muneco } from '../app/admin/operaciones/Muneco';
import { Hilo } from '../app/admin/operaciones/Hilo';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
/** El código sin comentarios: lo que se nombra para decir que se fue no cuenta. */
const codigo = (r: string) => leer(r).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const turno = (uuid: string, rol: 'yo' | 'el', texto: string, min: number): LineaChat => ({
  tipo: 'turno', instante: Date.UTC(2026, 9, 17, 15, min),
  turno: { local: 'local_aaaaaaaa-1111-2222-3333-444444444444', uuid, rol, de: null, texto, at: new Date(Date.UTC(2026, 9, 17, 15, min)).toISOString(), trabajo: null },
});

test('responder cita el mensaje en el TEXTO FIRMADO, y la burbuja la vuelve a leer', () => {
  const sale = armarConCita({ de: 'CRM', texto: '**Ya está:** la ficha del lead\n- con su etapa' }, 'Pruébalo en el ws3');
  assert.equal(sale, '> ↩ «CRM»: Ya está: la ficha del lead con su etapa\n\nPruébalo en el ws3');
  const l = leerCita(sale);
  assert.deepEqual(l, { cita: { de: 'CRM', texto: 'Ya está: la ficha del lead con su etapa' }, resto: 'Pruébalo en el ws3' });
  // Sin texto no sale una cita sola; sin cita, el texto tal cual.
  assert.equal(armarConCita({ de: 'CRM', texto: 'x' }, '   '), '');
  assert.equal(armarConCita(null, 'hola'), 'hola');
  assert.equal(leerCita('hola'), null);
  // Un renglón: largo, se corta con «…».
  const largo = renglonDeCita('a'.repeat(400));
  assert.ok(largo.length <= 140 && largo.endsWith('…'));
});

test('la cita lleva al mensaje citado: el ÚLTIMO que empieza así', () => {
  const lineas = [turno('u1', 'el', 'Voy a trabajar en la ficha', 1), turno('u2', 'yo', 'dale', 2), turno('u3', 'el', 'Voy a trabajar en la ficha del lead', 3)];
  assert.equal(buscarCitado(lineas, { texto: 'Voy a trabajar en la ficha del…' }), 't:u3');
  assert.equal(buscarCitado(lineas, { texto: 'Voy a trabajar en la ficha' }), 't:u3', 'el más nuevo gana');
  assert.equal(buscarCitado(lineas, { texto: 'algo que ya no está' }), null);
  assert.equal(idDeLinea(lineas[1]), 't:u2');
});

test('reenviar: «Reenviado de» arriba, y la burbuja lo lee', () => {
  const r = armarReenvio('Offer', 'El PDF quedó listo');
  assert.equal(r, '↪ Reenviado de «Offer»\n\nEl PDF quedó listo');
  assert.deepEqual(leerReenvio(r), { de: 'Offer', resto: 'El PDF quedó listo' });
  // Y la caja con su cita adentro, lo mismo (el reenvío de algo que respondía).
  const conCita = armarReenvio('Offer', armarConCita({ de: 'Tú', texto: 'el PDF' }, '¿y esto?'));
  assert.equal(leerCita(leerReenvio(conCita)!.resto)?.resto, '¿y esto?');
});

test('las marcas: reaccionar alterna, Fijar tiene tope de 3, y Eliminar para mí saca todo lo demás', () => {
  let m: MarcasChat = SIN_MARCAS;
  m = aplicarMarca(m, { tipo: 'reaccion', id: 't:u1', emoji: '👍' });
  assert.equal(m.reacciones['t:u1'], '👍');
  m = aplicarMarca(m, { tipo: 'reaccion', id: 't:u1', emoji: '👍' });
  assert.equal(m.reacciones['t:u1'], undefined, 'la misma reacción otra vez la saca (WhatsApp)');
  for (const id of ['t:a', 't:b', 't:c', 't:d']) m = aplicarMarca(m, { tipo: 'fijar', id, si: true });
  assert.equal(m.fijados.length, TOPE_FIJADOS);
  assert.deepEqual(m.fijados, ['t:b', 't:c', 't:d'], 'el cuarto reemplaza al más viejo');
  m = aplicarMarca(m, { tipo: 'destacar', id: 't:c', si: true });
  m = aplicarMarca(m, { tipo: 'reaccion', id: 't:c', emoji: '❤️' });
  m = aplicarMarca(m, { tipo: 'ocultar', id: 't:c' });
  assert.ok(!m.fijados.includes('t:c') && !m.destacados.includes('t:c') && !m.reacciones['t:c'] && m.ocultos.includes('t:c'));
  // Lo que eliminó para él no se dibuja.
  const lineas = [turno('a', 'el', 'uno', 1), turno('c', 'el', 'dos', 2)];
  assert.deepEqual(sinOcultos(lineas, m).map(idDeLinea), ['t:a']);
});

test('lo que llega del navegador se sanea: ids, emojis y topes', () => {
  assert.equal(sanearCambio({ tipo: 'reaccion', id: 't:u1', emoji: 'hola' }), null, 'una reacción no es texto');
  assert.equal(sanearCambio({ tipo: 'fijar', id: 'x:u1', si: true }), null);
  assert.equal(sanearCambio({ tipo: 'borrar', id: 't:u1' }), null);
  assert.deepEqual(sanearCambio({ tipo: 'reaccion', id: 'w:abc', emoji: null }), { tipo: 'reaccion', id: 'w:abc', emoji: null });
  assert.ok(esReaccion('🙏') && esReaccion('❤️') && !esReaccion('<b>') && !esReaccion(''));
  const s = sanearMarcas({ reacciones: { 't:a': '👍', 'mal': '👍', 't:b': 'texto' }, fijados: ['t:a', 't:b', 't:c', 't:d', 7], destacados: 'x' });
  assert.deepEqual(s, { reacciones: { 't:a': '👍' }, destacados: [], fijados: ['t:b', 't:c', 't:d'], ocultos: [] });
});

test('el menú en el orden de WhatsApp, con «Info» sólo en lo propio', () => {
  const propio = opcionesDelMensaje({ id: 'w:1', propio: true }, SIN_MARCAS).map((o) => o.id);
  assert.deepEqual(propio, ['responder', 'reenviar', 'copiar', 'info', 'destacar', 'fijar', 'eliminar']);
  const suyo = opcionesDelMensaje({ id: 't:1', propio: false }, { ...SIN_MARCAS, fijados: ['t:1'] });
  assert.ok(!suyo.some((o) => o.id === 'info'));
  assert.equal(suyo.find((o) => o.id === 'fijar')?.label, 'No fijar');
});

test('la pantalla: cada mensaje se desliza y tiene su menú; la cita viaja por el único camino firmado', () => {
  const hilo = codigo('app/admin/operaciones/Hilo.tsx');
  assert.ok((hilo.match(/<Deslizable /g) ?? []).length >= 4, 'turnos, trabajos y respuestas envueltos');
  assert.match(hilo, /<CitaEnBurbuja /);
  const wa = codigo('app/admin/operaciones/MensajeWA.tsx');
  assert.match(wa, /onPointerDown=\{alBajar\}/);
  assert.match(wa, /onContextMenu=/);
  assert.match(wa, /enLinea: REACCIONES/);
  // Mandar con la cita: el motor (useCentro.ts) la pone; el teléfono manda por el motor, sin un segundo camino.
  assert.match(codigo('app/admin/operaciones/useCentro.ts'), /armarConCita\(citas\[c\.clave\]/);
  const movil = codigo('app/m/operaciones/ChatsMovil.tsx');
  assert.match(movil, /centro\.mandar\(elegido\)/);
  assert.doesNotMatch(movil, /firma\.mandar\(\{ sesion: destino\.sesion/);
  // Las marcas pasan por `puedeOperar` antes de tocar nada.
  const acc = leer('app/admin/operaciones/acciones.ts');
  const cuerpo = acc.slice(acc.indexOf('export async function marcarMensajeAction'));
  assert.match(cuerpo.slice(0, 400), /getSesionAdmin\(\);[\s\S]{0,40}puedeOperar/);
  // Y un hilo con marcas dibuja la reacción y la estrella.
  const m = aplicarMarca(aplicarMarca(SIN_MARCAS, { tipo: 'reaccion', id: 't:u1', emoji: '😂' }), { tipo: 'destacar', id: 't:u1', si: true });
  const html = renderToStaticMarkup(createElement(Hilo, {
    lineas: [turno('u1', 'el', 'Ya lo subí', 1)], pushes: [], ahora: Date.UTC(2026, 9, 17, 16), vacio: '',
    quien: { titulo: 'CRM', animo: 'despierto' }, marcas: m,
  }));
  assert.match(html, /😂/);
  assert.match(html, /co-wa__marcas/);
  assert.match(html, /id="co-msg-t-u1"/);
});

test('(2) una sola lista: «Nuevo chat» arriba, el Cerebro con la estrella de MaKo y ningún otro', () => {
  assert.deepEqual(aspectoDe('Cerebro', { forma: 'circulo', color: '--grafo-voz', cara: 'risa' }), ASPECTO_MAKO, 'aunque se le haya elegido otra');
  assert.deepEqual(aspectoDe('Estrategia 3 cuentas'), ASPECTO_MAKO);
  assert.notEqual(aspectoDe('CRM').forma, 'estrella');
  assert.equal(sanearAspecto(ASPECTO_MAKO), null, 'nadie más la puede guardar');
  assert.ok(!(FORMAS as readonly string[]).includes('estrella'), 'no se elige en el selector');
  assert.match(renderToStaticMarkup(createElement(Muneco, { titulo: 'Cerebro', animo: 'despierto' })), /var\(--mako\)/);
  const movil = codigo('app/m/operaciones/ChatsMovil.tsx');
  assert.doesNotMatch(movil, /SECCION_CEREBRO \? CEREBRO/, 'sin la sección «Cerebro» aparte');
  const lista = movil.slice(movil.indexOf('{conLista && ('));
  assert.ok(lista.indexOf('titulo="Nuevo chat"') >= 0 && lista.indexOf('titulo="Nuevo chat"') < lista.indexOf('<FilaChatM'), '«Nuevo chat» primero, en la misma lista');
  assert.equal((lista.match(/<SeccionM /g) ?? []).length, 1);
});

test('(4) «Uso y Runners» va arriba de los chats, junto a Second Brain', () => {
  const app = codigo('app/m/operaciones/CentroAppMovil.tsx');
  const uso = app.indexOf('titulo="Uso y Runners"');
  assert.ok(uso > app.indexOf('titulo="Second Brain"') && uso < app.indexOf('<ChatsMDelCentro'));
});

test('(3) el «atrás» del teléfono no vuelve a dibujar la lista ni la conversación', () => {
  const movil = codigo('app/m/operaciones/ChatsMovil.tsx');
  assert.match(movil, /const FilaChatM = memo\(/);
  assert.doesNotMatch(movil.slice(movil.indexOf('const filas =')), /historialDelChat\(f?\.?c,/, 'una fila no calcula su historial');
  // Desde el 20/10/2026 la fila no muestra lo último que pasó (tests/centro-subtitulo.test.ts): toma del motor sólo si su
  // «Completado» espera el ✓, de un Set memorizado.
  assert.match(movil, /nuevo=\{centro\.yaSinVer\.has\(f\.c\.clave\)\}/);
  assert.match(movil, /centro\.lineasDe\.get\(elegido\.clave\)/);
  assert.match(codigo('app/admin/operaciones/Hilo.tsx'), /export const Hilo = memo\(HiloSinMemo\)/);
});
