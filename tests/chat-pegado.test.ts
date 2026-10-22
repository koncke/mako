// =============================================================================
// El texto pegado en el chat de MaKo (Second Brain, escritorio y teléfono) — tarjetas #848, #864 y #884 (17/10/2026)
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   #848 · una transcripción larga no vuelve a ser una burbuja de 24.000 px: el pegado es una tarjeta y lo escrito largo
//          se pliega (medido con 400 renglones en Chrome headless: de 24.474 px a 100 px);
//   #864 · un pegado de más de 1.000 caracteres no entra a la caja: es una ficha «Texto pegado» y sale como documento;
//   #884 · lo pegado se guarda solo en El Archivero, ENTERO, sólo del admin y sólo con `guardarAdjuntos`;
//   y el corte del turno (8.000 caracteres) ya no rompe las marcas: un pegado cortado lo dice.
//
// Verificado ROMPIÉNDOLO (17/10/2026), cada rotura contra la base en verde (8 / 0) y restaurando después:
//   · `partirPegados` tomando una marca sin cerrar como pegado: 7 / 1.
//   · el tope de 1.000 en 100 (`TOPE_PEGADO`): 7 / 1.
//   · `recortarMensaje` cortando el mensaje entero (sin respetar las marcas): 7 / 1.
//   · el hilo de escritorio sin `partirPegados` (el pegado crudo en la burbuja): 7 / 1.
//   · el teléfono sin la ficha al pegar (sin el `onPaste` del Composer): 7 / 1.
//   · el pegado archivado para cualquiera (sin `persona.rol === 'admin'`): 7 / 1.
//   · el pegado archivado ya cortado (con `textoPersona` en vez de `entrada.mensaje`): 7 / 1.
//   · El Archivero recibiendo el pegado como PDF (otro mime): 7 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AVISO_CORTE_PEGADO, TOPE_PEGADO, caracteres, conPegados, esBurbujaLarga, esPegadoLargo, nombrePegado, partirPegados,
  recortarMensaje, textoParaTitulo,
} from '../lib/chat-pegado';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('el pegado viaja marcado en el mensaje y se parte igual al volver', () => {
  const m = conPegados('Resume esta reunión', ['primera transcripción', 'segunda']);
  assert.deepEqual(partirPegados(m), { texto: 'Resume esta reunión', pegados: ['primera transcripción', 'segunda'] });
  assert.deepEqual(partirPegados('sin pegados'), { texto: 'sin pegados', pegados: [] });
  assert.deepEqual(partirPegados('hola [[texto pegado]] sin cerrar'), { texto: 'hola [[texto pegado]] sin cerrar', pegados: [] }, 'una marca sin cerrar es texto');
  assert.equal(textoParaTitulo(conPegados('', ['Bueno entonces el funnel'])), 'Texto pegado — Bueno entonces el funnel', 'sólo el pegado: su nombre');
  assert.equal(textoParaTitulo(conPegados('Resume', ['x'])), 'Resume');
});

test('desde 1.000 caracteres un pegado es un documento; la burbuja larga se pliega', () => {
  assert.equal(TOPE_PEGADO, 1000);
  assert.equal(esPegadoLargo('a'.repeat(1000)), false);
  assert.equal(esPegadoLargo('a'.repeat(1001)), true);
  assert.equal(esBurbujaLarga('corto'), false);
  assert.equal(esBurbujaLarga(Array.from({ length: 20 }, () => 'r').join('\n')), true, 'muchos renglones');
  assert.equal(caracteres('a'.repeat(12345)), '12.345 caracteres');
  assert.match(nombrePegado('a '.repeat(100)), /^Texto pegado — .+…$/);
});

test('el corte del turno respeta las marcas y dice lo que cortó', () => {
  const m = conPegados('x'.repeat(50), ['p'.repeat(30), 'q'.repeat(30)]);
  const r = recortarMensaje(m, 10, 40);
  const { texto, pegados } = partirPegados(r);
  assert.equal(texto, 'x'.repeat(10), 'lo escrito, hasta su tope');
  assert.equal(pegados.length, 2, 'las marcas siguen cerradas');
  assert.equal(pegados[0], 'p'.repeat(30));
  assert.equal(pegados[1], `${'q'.repeat(10)}\n${AVISO_CORTE_PEGADO}`, 'el segundo comparte lo que queda y lo dice');
});

test('#848: el hilo de escritorio y el del teléfono parten el mensaje y pliegan lo largo', () => {
  const hilo = sinComentarios(leer('app/_chat/HiloMako.tsx'));
  // Desde el 21/10/2026 lo partido puede traer la cita del mensaje que responde (lo de WhatsApp): va arriba, en el globo.
  assert.match(hilo, /const \{ texto: conTodo, pegados \} = partirPegados\(/);
  assert.match(hilo, /<PegadosHilo pegados=\{pegados\} \/>/);
  assert.match(hilo, /<TextoPlegable texto=\{texto\} className="co-burbuja" pie=\{pie\} arriba=\{cita\} \/>/);
  const tel = sinComentarios(leer('app/m/mako/ChatMako.tsx'));
  assert.match(tel, /const \{ texto: t, pegados \} = partirPegados\(/);
  assert.match(tel, /<PegadosHilo pegados=\{pegados\} \/>/);
  assert.match(leer('app/_chat/PegadoHilo.tsx'), /^import '\.\/chat\.css';/m, 'la hoja va con la pieza (el teléfono no carga chat.css)');
  assert.match(leer('app/_chat/chat.css'), /\.ch-pegado__cuerpo \{[^}]*max-height: min\(50dvh, 420px\); overflow-y: auto;/, 'el pegado abierto scrollea en su caja');
});

test('#864: pegar más de 1.000 caracteres deja una ficha, en la computadora y en el teléfono', () => {
  // El motor del chat del cliente (22/10/2026, useChatCliente.ts: la computadora y el teléfono). En una conversación de Offer lo
  // largo va entero: su motor lo parte en documentos.
  const sb = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(sb, /if \(idOffer == null && esPegadoLargo\(pegado\)\) \{ e\.preventDefault\(\); ponerPegados\(/);
  assert.match(sb, /if \(enviar\(conPegados\(t, pg\), elegidosRef\.current\)\)/, 'sale con el mensaje, entre marcas');
  const comp = sinComentarios(leer('app/m/mako/Composer.tsx'));
  assert.match(comp, /onPaste=\{\(e\) => \{[\s\S]*?if \(esPegadoLargo\(pegado\)\) \{ e\.preventDefault\(\); setPegados\(/);
  assert.match(comp, /onEnviar\(envioDe\(conPegados\(texto, pegados\), lista\.ref\.current\)\);/);
});

test('#884: lo pegado se guarda solo en El Archivero, entero, del admin y con guardarAdjuntos', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  // `mensaje` es la entrada ENTERA con las claves tapadas (pieza 1.6, lib/claves-en-el-chat.ts): el crudo no se vuelve a leer.
  assert.match(t, /const mensaje = tapado\.texto;\s*const textoPersona = recortarMensaje\(mensaje\.trim\(\), TOPE_MENSAJE\);/, 'el corte respeta las marcas');
  assert.match(t, /const pegados = persona\.rol === 'admin' && entrada\.guardarAdjuntos \? partirPegados\(mensaje\)\.pegados : \[\];/,
    'ENTERO (el mensaje de entrada, no el cortado), sólo del admin y sólo con guardarAdjuntos');
  // Con su propio Claude (D6b), El Archivero sólo con su clave: si no, no corre y se dice (tests/solo-su-ia.test.ts).
  assert.match(t, /if \(pegados\.length\) await archivarPegadosDelChat\(ws, inicio, pegados\);/);
  const a = sinComentarios(leer('lib/chat-mako-adjuntos.ts'));
  const bloque = a.slice(a.indexOf('export async function archivarPegadosDelChat('), a.indexOf('export async function archivarPdfsDelChat('));
  assert.match(bloque, /registrarDocumentoSinPisar\(ws, \{\s*origen, contenido, nombre, mime: 'text\/plain', texto,/);
  assert.match(bloque, /after\(trabajo\);/, 'después de responder');
});

test('la caja de escritorio suelta los pegados al cambiar de chat', () => {
  const sb = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  const elegir = sb.slice(sb.indexOf('const elegir = (e: ElegidoChat): boolean => {'), sb.indexOf('const marcar = '));
  assert.match(elegir, /ponerPegados\(\[\]\);/);
});

test('la ficha se puede quitar antes de mandar', () => {
  const sb = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.match(sb, /aria-label="Quitar el texto pegado"/);
  assert.match(sinComentarios(leer('app/m/mako/Composer.tsx')), /aria-label="Quitar el texto pegado"/);
});
