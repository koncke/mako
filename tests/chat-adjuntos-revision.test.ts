// =============================================================================
// La revisión del Cerebro sobre 34b0687f0 (27/10/2026): lo adjuntado en las cajas que adjuntan solas
// =============================================================================
// C:/dev/revisiones/2710-mi-34b0687f0.md. Lo que fija:
//   4. (medio) el Video Editor y el Image Editor cortaban lo adjuntado a 2.000 caracteres callados y sin la marca de cierre: ahora
//      la caja sabe el tope del motor (`topeTexto`), lo leído entra hasta ahí CON su marca (`conPegadosHasta`) y se dice;
//   7. el arranque de Offer (sólo texto) no adjunta: `sinAdjuntos` también a la caja;
//   8. leer-archivo mira el tamaño y el tipo de lo que BAJÓ (no lo que declaró el navegador) y anota el gasto en el chat;
//   9. el cartel «Suelta para adjuntar» se apaga aunque se suelte sobre la caja (que corta la propagación).
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conPegados, conPegadosHasta, partirPegados, SIGUE_CORTADO } from '../lib/chat-pegado';
import { textoDelArchivo } from '../lib/chat-formatos';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('4. lo leído entra hasta el tope del motor, con su marca de cierre, y dice cuánto quedó afuera', () => {
  const guion = textoDelArchivo('guion.docx', 'Escena uno. '.repeat(700)); // ~8.400 caracteres
  const { mensaje, afuera } = conPegadosHasta('Pon estos textos en pantalla', [guion], 2000);
  assert.ok(mensaje.length <= 2000, `salieron ${mensaje.length} caracteres`);
  assert.ok(afuera > 6000 && afuera < guion.length, `quedaron afuera ${afuera}`);
  const partido = partirPegados(mensaje);
  assert.equal(partido.texto, 'Pon estos textos en pantalla', 'lo escrito no salió entero');
  assert.equal(partido.pegados.length, 1, 'sin la marca de cierre el hilo no encuentra lo pegado');
  assert.ok(partido.pegados[0].endsWith(SIGUE_CORTADO), 'el recorte no se dice adentro del pegado');
  // Lo que entra, entra igual que siempre.
  assert.deepEqual(conPegadosHasta('Hola', ['corto'], 2000), { mensaje: conPegados('Hola', ['corto']), afuera: 0 });
  // La caja lo dice, y los dos editores le pasan su tope.
  const hook = fuente('app/_chat/adjuntos-que-se-leen.ts');
  assert.match(hook, /const \{ mensaje: nuevo, afuera \} = tope \? conPegadosHasta\(texto, leidos, tope\) : \{ mensaje: conPegados\(texto, leidos\), afuera: 0 \};/);
  assert.match(hook, /if \(afuera\) setAviso\(/);
  const caja = fuente('app/_chat/CajaChat.tsx');
  assert.match(caja, /onError: p\.onErrorMic, tope: p\.topeTexto,/);
  assert.match(caja, /\{leidos\.aviso && <p className="co-caja__estado" aria-live="polite">\{leidos\.aviso\}<\/p>\}/);
  assert.match(fuente('app/video-editor/_opencut/chat/PanelChat.tsx'), /<CajaChat [\s\S]{0,500}?topeTexto=\{TOPES_CHAT\.instruccion\} \/>/);
  assert.match(fuente('app/image-editor/mako/chat/PanelMakoIA.tsx'), /<CajaChat [\s\S]{0,500}?topeTexto=\{TOPES_CHAT_IMAGEN\.instruccion\} \/>/);
});

test('7. el arranque de Offer (sólo texto) no adjunta', () => {
  const offer = fuente('app/offer/OfferApp.tsx');
  const caja = offer.slice(offer.indexOf('const caja: PropsCajaChat = {'), offer.indexOf('voz: sinAdjuntos ? undefined'));
  assert.match(caja, /\n\s*sinAdjuntos,\n\s*adjuntos: sinAdjuntos \? undefined : adjuntosCaja,/, 'la caja del arranque adjunta sola');
});

test('8. leer-archivo mira lo que BAJÓ y anota el gasto en el chat', () => {
  const ruta = fuente('app/api/chat/leer-archivo/route.ts');
  const leer = ruta.slice(ruta.indexOf("body.accion === 'leer'"));
  const baja = leer.indexOf('storage.download(path)');
  const mira = leer.indexOf('porQueNoSeAdjunta(nombre, mime || data.type, data.size)');
  assert.ok(baja > 0 && mira > baja && leer.indexOf('archivoATexto(file') > mira, 'leer-archivo no mira el tamaño real antes de leer');
  assert.match(leer, /archivoATexto\(file, \{ feature: 'mako-chat', motivo:/);
});

test('9. el cartel de soltar se apaga en la captura, aunque la caja corte la propagación', () => {
  assert.match(fuente('app/admin/operaciones/PanelChat.tsx'), /onDropCapture=\{\(\) => setSoltando\(false\)\}/);
  assert.match(fuente('app/offer/ChatOffer.tsx'), /onDropCapture=\{\(\) => setEncima\(false\)\}/);
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   1. `conPegadosHasta` devolviendo el mensaje entero                  → rojo el 4.
//   2. el Video Editor sin `topeTexto`                                    → rojo el 4.
//   3. leer-archivo sin mirar lo que bajó                                  → rojo el 8.
//   4. el panel del Ops Center sin `onDropCapture`                         → rojo el 9.
