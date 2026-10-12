// =============================================================================
// La vista previa de adjuntos (como WhatsApp Web), la MISMA para todos los chats
// =============================================================================
// Pedido de Martín (11/10/2026), con una captura de WhatsApp Web: «Intenté subir un documento y saltó ese
// error. No se si apenas lo subí ya lo quiso analizar, eso estaría mal. Solo cuando le doy a ENVIAR
// debería... Sino, debería salir la vista previa del documento que acabo de subir, como lo tiene
// whatsapp… se ve la preview, y puedo agregar más documentos... Y aún escribir un mensaje abajo...
// Quiero que apliques este cambio no solo a offer, sino a todos los chats que consuman esto de subir
// documento.»
//
// Acá se EJECUTA lo que decide la vista (app/whatsapp/_shared/adjuntos-vista.ts), se DIBUJA la vista
// (VistaAdjuntos.tsx, con renderToStaticMarkup) y se fija el cableado de ChatHilo: elegir abre la vista,
// Enviar manda TODOS en orden con `onEnviarArchivo` (el texto como pie del primero) y, si uno falla, los
// que faltan vuelven a la vista con el error. Lo de Offer, en tests/offer-adjuntos-al-enviar.test.ts.
//
// PROBADO ROMPIÉNDOLO (11/10/2026, arnés en el scratchpad que rompe UNA cosa, corre este archivo y
// restaura DE MEMORIA; base 14 pases / 0 fallos). Las 14 roturas, cazadas, cada una con 13/1:
//   R1  el texto como pie de TODOS los archivos (`enviarEnOrden`)
//   R2  al fallar, `faltan` sin el que falló
//   R3  sin el tope de bytes (`repartirNuevos`)
//   R4  un HEIC como imagen (se dibujaría un cuadro roto)
//   R5  quitar la elegida salta a la primera, no a la de al lado
//   R6  Enter con el foco en un botón manda
//   R7  el «+» no se apaga con el máximo
//   R8  Enviar ignora `puedeEnviar`
//   R9  las URL `blob:` no se sueltan
//   R10 ChatHilo: el texto como pie de cada archivo
//   R11 ChatHilo: lo que falta no vuelve a la vista
//   R12 ChatHilo: el clip de UN archivo (sin `onArchivos`)
//   R13 el composer sin `multiple`
//   R14 ChatHilo sin el tope de 4 MB
// Restaurado → 14/0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  aceptaSegun, agregarALista, detalleDeAdjunto, elegidoTrasQuitar, enviarEnOrden, extDe, MAX_ADJUNTOS, repartirNuevos,
  teclaDeVista, textoPaginas, textoTamano, tipoDeVista, type ItemAdjunto,
} from '../app/whatsapp/_shared/adjuntos-vista';
import { VistaAdjuntos } from '../app/whatsapp/_shared/VistaAdjuntos';
import { ComposerWhatsApp } from '../app/whatsapp/_shared/ComposerWhatsApp';

const RAIZ = join(__dirname, '..');
const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (AGENTS.md). */
const sinComentarios = (src: string): string => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque de una función: desde su declaración hasta lo que la sigue (nunca un número de caracteres). */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}
const MB = 1024 * 1024;
const f = (name: string, type: string, size: number) => ({ name, type, size });

// ── Qué vista lleva cada archivo ─────────────────────────────────────────────

test('tipo de vista: imagen, video, audio, PDF o tarjeta; manda el MIME y si no hay, la extensión', () => {
  assert.equal(tipoDeVista('precios.pdf', 'application/pdf'), 'pdf');
  assert.equal(tipoDeVista('precios.PDF', ''), 'pdf', 'un arrastre puede venir sin MIME');
  assert.equal(tipoDeVista('foto.png', 'image/png'), 'imagen');
  assert.equal(tipoDeVista('foto.JPG', ''), 'imagen');
  assert.equal(tipoDeVista('foto.heic', 'image/heic'), 'archivo', 'un HEIC no se dibuja en un <img> común: tarjeta, no un cuadro roto');
  assert.equal(tipoDeVista('clip.mp4', 'video/mp4'), 'video');
  assert.equal(tipoDeVista('nota.mp3', 'application/octet-stream'), 'audio');
  assert.equal(tipoDeVista('voz.ogg', 'audio/ogg; codecs=opus'), 'audio');
  assert.equal(tipoDeVista('contrato.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'archivo');
  assert.equal(tipoDeVista('planilla.xlsx', ''), 'archivo');
  assert.equal(extDe('C:\\fotos\\viaje.final.JPEG'), 'jpeg');
  assert.equal(extDe('.oculto'), '', 'un nombre que empieza con punto no tiene extensión');
});

test('textos: tamaño con coma decimal, páginas en singular y plural, y el renglón de abajo del nombre', () => {
  assert.equal(textoTamano(0), '0 B');
  assert.equal(textoTamano(18), '18 B');
  assert.equal(textoTamano(1024), '1 KB');
  assert.equal(textoTamano(320 * 1024), '320 KB');
  assert.equal(textoTamano(1.24 * MB), '1,2 MB');
  assert.equal(textoTamano(12.4 * MB), '12 MB');
  assert.equal(textoTamano(Number.NaN), '0 B');
  assert.equal(textoPaginas(1), '1 página');
  assert.equal(textoPaginas(8), '8 páginas');
  assert.equal(detalleDeAdjunto({ bytes: 1.24 * MB, paginas: 8 }), '8 páginas · 1,2 MB', 'como la captura: «8 páginas»');
  assert.equal(detalleDeAdjunto({ bytes: 1.24 * MB, paginas: null }), '1,2 MB', 'un PDF todavía sin abrir no inventa páginas');
  assert.equal(detalleDeAdjunto({ bytes: 2048 }), '2 KB');
});

// ── Qué entra a la vista ─────────────────────────────────────────────────────

const ACCEPT_HILO = 'image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx';

test('accept: las tres formas (.ext, tipo/*, tipo exacto), y sin accept entra todo', () => {
  assert.equal(aceptaSegun(ACCEPT_HILO, 'foto.png', 'image/png'), true);
  assert.equal(aceptaSegun(ACCEPT_HILO, 'informe.docx', ''), true, 'por la extensión');
  assert.equal(aceptaSegun(ACCEPT_HILO, 'precios.pdf', 'application/pdf'), true);
  assert.equal(aceptaSegun(ACCEPT_HILO, 'setup.exe', 'application/x-msdownload'), false);
  assert.equal(aceptaSegun(ACCEPT_HILO, 'notas.txt', 'text/plain'), false);
  assert.equal(aceptaSegun(undefined, 'lo-que-sea.bin', ''), true);
  assert.equal(aceptaSegun('', 'lo-que-sea.bin', ''), true);
});

test('repartir: cada rebote nombra el archivo y dice por qué; el tope de cantidad se dice una vez', () => {
  const topes = { maxBytes: 4 * MB, maxArchivos: 3, accept: ACCEPT_HILO };
  const r = repartirNuevos(1, [
    f('a.pdf', 'application/pdf', 100),
    f('grande.mp4', 'video/mp4', 5 * MB),
    f('vacio.png', 'image/png', 0),
    f('setup.exe', 'application/x-msdownload', 10),
    f('b.png', 'image/png', 100),
    f('c.png', 'image/png', 100),
    f('d.png', 'image/png', 100),
  ], topes);
  assert.deepEqual(r.entran.map((x) => x.name), ['a.pdf', 'b.png'], 'en el orden en que llegaron, hasta llenar 3 con el que ya había');
  assert.deepEqual(r.errores, [
    '«grande.mp4» pesa más de 4 MB.',
    '«vacio.png» está vacío.',
    '«setup.exe» no se puede adjuntar aquí.',
    'Puedes juntar hasta 3 archivos.',
  ]);
  // La regla propia del consumidor (Offer: que se pueda leer) dice SU motivo.
  const propia = repartirNuevos(0, [f('x.pages', '', 10)], { validar: (a) => `«${a.name}» no se puede leer: expórtalo a PDF.` });
  assert.deepEqual(propia, { entran: [], errores: ['«x.pages» no se puede leer: expórtalo a PDF.'] });
  // Sin tope de cantidad, el de la casa.
  assert.equal(repartirNuevos(0, Array.from({ length: MAX_ADJUNTOS + 2 }, (_, i) => f(`${i}.png`, 'image/png', 1))).entran.length, MAX_ADJUNTOS);
  assert.equal(repartirNuevos(0, [f('25.pdf', 'application/pdf', 25.5 * MB)], { maxBytes: 25 * MB }).errores[0], '«25.pdf» pesa más de 25 MB.');
});

test('agregar a la lista: lo nuevo al final, con id propio; lo que no entra no toca la lista', () => {
  let n = 0;
  const id = () => `id${++n}`;
  const archivo = (nombre: string, size = 10) => new File([new Uint8Array(size)], nombre, { type: 'image/png' });
  const uno = agregarALista([], [archivo('a.png')], {}, id);
  assert.deepEqual(uno.items.map((x) => [x.id, x.file.name]), [['id1', 'a.png']]);
  const dos = agregarALista(uno.items, [archivo('b.png'), archivo('vacio.png', 0)], {}, id);
  assert.deepEqual(dos.items.map((x) => x.id), ['id1', 'id2']);
  assert.deepEqual(dos.errores, ['«vacio.png» está vacío.']);
});

test('quitar la miniatura elegida elige la de al lado; quitar otra no mueve la elección', () => {
  assert.equal(elegidoTrasQuitar(['a', 'b', 'c'], 'b', 'b'), 'c');
  assert.equal(elegidoTrasQuitar(['a', 'b', 'c'], 'c', 'c'), 'b', 'la última: la de su izquierda');
  assert.equal(elegidoTrasQuitar(['a', 'b', 'c'], 'b', 'a'), 'b');
  assert.equal(elegidoTrasQuitar(['a'], 'a', 'a'), null);
  assert.equal(elegidoTrasQuitar(['a', 'b'], null, 'a'), 'b');
});

test('teclas: Escape cierra; Enter manda (no con Shift, ni componiendo, ni con el foco en un botón)', () => {
  assert.equal(teclaDeVista({ key: 'Escape' }), 'cerrar');
  assert.equal(teclaDeVista({ key: 'Enter' }), 'enviar');
  assert.equal(teclaDeVista({ key: 'Enter', shiftKey: true }), null, 'Shift+Enter es un renglón del pie');
  assert.equal(teclaDeVista({ key: 'Enter', isComposing: true }), null, 'un IME a mitad de una palabra no manda');
  assert.equal(teclaDeVista({ key: 'Enter', enBoton: true }), null, 'Enter sobre la ✕ de una miniatura es apretar la ✕');
  assert.equal(teclaDeVista({ key: 'a' }), null);
});

// ── Mandar varios, en orden ──────────────────────────────────────────────────

const item = (id: string): ItemAdjunto => ({ id, file: new File(['x'], `${id}.pdf`, { type: 'application/pdf' }) });

test('enviar en orden: TODOS, uno por uno, y el texto como pie SÓLO del primero', async () => {
  const llamadas: Array<[string, string | undefined, number]> = [];
  const r = await enviarEnOrden([item('a'), item('b'), item('c')], '  mira esto  ', async (it, caption, i) => { llamadas.push([it.id, caption, i]); return true; });
  assert.deepEqual(llamadas, [['a', 'mira esto', 0], ['b', undefined, 1], ['c', undefined, 2]]);
  assert.deepEqual(r.enviados.map((x) => x.id), ['a', 'b', 'c']);
  assert.deepEqual(r.faltan, []);
  assert.equal(r.textoSalio, true);
  assert.equal(r.error, null);
  // Sin texto, el primero va sin pie (no con un pie vacío).
  const sinTexto: Array<string | undefined> = [];
  await enviarEnOrden([item('a')], '   ', async (_it, caption) => { sinTexto.push(caption); return true; });
  assert.deepEqual(sinTexto, [undefined]);
});

test('enviar en orden: al primer fallo CORTA; los que faltan vuelven con el error, y el texto sólo si no salió', async () => {
  const mandados: string[] = [];
  const falla2 = await enviarEnOrden([item('a'), item('b'), item('c')], 'hola', async (it) => { mandados.push(it.id); return it.id !== 'b'; });
  assert.deepEqual(mandados, ['a', 'b'], 'después del que falló no sale nada (no queda un hueco en el medio)');
  assert.deepEqual(falla2.enviados.map((x) => x.id), ['a']);
  assert.deepEqual(falla2.faltan.map((x) => x.id), ['b', 'c']);
  assert.equal(falla2.textoSalio, true, 'el pie ya viajó con «a»');
  assert.equal(falla2.error, 'No se pudo enviar «b.pdf».');
  const falla1 = await enviarEnOrden([item('a'), item('b')], 'hola', async () => false);
  assert.equal(falla1.textoSalio, false, 'si el primero no salió, el texto vuelve');
  assert.deepEqual(falla1.faltan.map((x) => x.id), ['a', 'b']);
  const tira = await enviarEnOrden([item('a')], '', async () => { throw new Error('sin conexión'); });
  assert.equal(tira.error, 'No se pudo enviar «a.pdf» (sin conexión).');
});

// ── La vista, dibujada ───────────────────────────────────────────────────────

const pdf = (): ItemAdjunto => ({ id: 'p', file: new File([new Uint8Array(Math.round(1.24 * MB))], 'precios.pdf', { type: 'application/pdf' }) });
const png = (): ItemAdjunto => ({ id: 'i', file: new File([new Uint8Array(2048)], 'logo.png', { type: 'image/png' }) });
const vista = (p: Partial<Parameters<typeof VistaAdjuntos>[0]> = {}) => renderToStaticMarkup(createElement(VistaAdjuntos, {
  items: [pdf(), png()], onAgregar: () => {}, onQuitar: () => {}, onCerrar: () => {}, texto: 'hola', onTexto: () => {}, onEnviar: () => {},
  accept: ACCEPT_HILO, maxArchivos: 10, ...p,
}));

test('la vista: ✕ arriba, nombre y tamaño, el campo con emoji, miniaturas con su ✕, el «+» y Enviar en la esquina', () => {
  const html = vista();
  assert.match(html, /aria-label="Cerrar la vista previa"/);
  assert.match(html, /precios\.pdf/, 'el nombre del elegido (el primero) arriba');
  assert.match(html, /1,2 MB/, 'y su tamaño');
  assert.match(html, /<textarea[^>]*aria-label="Mensaje"[^>]*>hola<\/textarea>/, 'el campo trae el texto');
  assert.match(html, /aria-label="Emojis"/);
  assert.equal((html.match(/aria-label="Quitar [^"]+"/g) ?? []).length, 2, 'una ✕ por miniatura');
  assert.match(html, /aria-label="Ver precios\.pdf" aria-pressed="true"/, 'la primera queda elegida');
  assert.match(html, /aria-label="Agregar archivos"/);
  assert.match(html, /<input[^>]*type="file"[^>]*multiple=""[^>]*accept="image\/\*,video\/\*/, 'el «+» deja elegir varios con el MISMO accept');
  assert.match(html, /data-esquina-ocupada=""[\s\S]*aria-label="Enviar"/, 'Enviar vive en la fila marcada (la esquina de los avisos no lo tapa)');
  assert.doesNotMatch(html, /role="alert"|Leyendo/, 'sin error ni estado no hay renglón');
});

test('la vista: lleno apaga el «+»; enviando apaga los controles; el error y el estado se dicen', () => {
  const boton = (html: string, etiqueta: string) => new RegExp(`<button[^>]*aria-label="${etiqueta}"[^>]*>`).exec(html)?.[0] ?? '';
  assert.match(boton(vista({ maxArchivos: 2 }), 'Agregar archivos'), /disabled=""/, 'con el máximo no se suma más');
  assert.doesNotMatch(boton(vista({ maxArchivos: 3 }), 'Agregar archivos'), /disabled=""/);
  const enviando = vista({ enviando: true, estado: 'Leyendo «precios.pdf»…' });
  assert.match(boton(enviando, 'Enviar'), /disabled=""/);
  assert.match(boton(enviando, 'Cerrar la vista previa'), /disabled=""/, 'lo que está en vuelo no se descarta');
  assert.match(enviando, /role="status"[^>]*>[\s\S]*Leyendo «precios\.pdf»…/);
  assert.match(boton(vista({ puedeEnviar: false }), 'Enviar'), /disabled=""/);
  assert.doesNotMatch(boton(vista({ puedeEnviar: false }), 'Cerrar la vista previa'), /disabled=""/, 'puedeEnviar sólo apaga Enviar');
  assert.match(vista({ error: '«b.pdf»: No se pudo leer.' }), /role="alert"[^>]*>«b\.pdf»: No se pudo leer\.</);
});

test('la vista: sólo tokens de la casa (claro y oscuro), y el PDF se abre con unpdf DINÁMICO', () => {
  const src = sinComentarios(leer('app/whatsapp/_shared/VistaAdjuntos.tsx'));
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'un color fijo no se da vuelta en oscuro');
  assert.doesNotMatch(src, /^import[^\n]*'unpdf'/m, 'unpdf (pdf.js, ~1,6 MB) no va en el bundle de entrada');
  assert.match(src, /await import\('unpdf'\)/);
  // Las URL `blob:` se sueltan con el elemento.
  assert.match(bloque(src, 'function useUrlDe', 'type PrimeraPagina'), /return \(\) => \{ URL\.revokeObjectURL\(u\); \};/);
});

// ── El cableado de ChatHilo ──────────────────────────────────────────────────

test('ChatHilo: el clip abre la vista (varios), Enviar manda TODOS en orden con onEnviarArchivo, y lo que falta vuelve', () => {
  const src = sinComentarios(leer('app/whatsapp/_shared/ChatHilo.tsx'));
  // La firma de las props no cambia para los que montan el hilo.
  assert.match(src, /onEnviarArchivo\?: \(blob: Blob, tipo: '' \| 'audio', fileName: string, caption\?: string\) => Promise<boolean>;/);
  // El tope de 4 MB por archivo sigue (es del envío de quien monta el hilo).
  assert.match(src, /const TOPE_ARCHIVO_HILO = 4 \* 1024 \* 1024;/);
  assert.match(src, /useListaAdjuntos\(\s*\{ maxBytes: TOPE_ARCHIVO_HILO, maxArchivos: MAX_ADJUNTOS, accept: ACCEPT_HILO \}/);
  // El clip deja elegir varios y los junta en la vista; ya no hay chip.
  assert.match(src, /onArchivos=\{onEnviarArchivo \? agregarArchivos : undefined\}/);
  assert.doesNotMatch(src, /\bchip=\{/, 'volvió el chip de UN archivo');
  assert.match(src, /<VistaAdjuntos[\s\S]*?onEnviar=\{\(\) => void enviarAdjuntos\(\)\}/);
  // Enviar: todos en orden, el texto como pie del primero, por el MISMO onEnviarArchivo.
  const enviar = bloque(src, 'async function enviarAdjuntos()', 'const enviarAudio =');
  assert.match(enviar, /enviarEnOrden\(items, cap, \(it, caption\) => onEnviarArchivo\(it\.file, '', it\.file\.name, caption\)\)/);
  // Vuelve al hilo YA, y si uno falla lo que falta vuelve a la vista con el error.
  assert.ok(enviar.indexOf('lista.vaciar()') < enviar.indexOf('enviarEnOrden('), 'la vista se cierra antes de mandar (como WhatsApp)');
  assert.match(enviar, /lista\.poner\(r\.faltan\);/);
  assert.match(enviar, /setSendErr\(r\.error\);/);
  assert.match(enviar, /if \(!r\.textoSalio\) setDraft\(\(d\) => d \|\| cap\);/);
  // Lo de siempre sigue: el composer por conversación y la esquina ocupada.
  assert.match(src, /key=\{draftKey \?\? 'hilo'\}/);
  assert.match(src, /data-esquina-ocupada=\{puedeComponer/);
});

test('el composer: `onArchivos` abre el selector con `multiple` y entrega todos', () => {
  const src = sinComentarios(leer('app/whatsapp/_shared/ComposerWhatsApp.tsx'));
  assert.match(src, /multiple=\{!!onArchivos\}/);
  assert.match(src, /if \(onArchivos\) \{ if \(lista\.length\) onArchivos\(lista\); \} else if \(lista\[0\]\) onArchivo\?\.\(lista\[0\]\);/);
  const html = renderToStaticMarkup(createElement(ComposerWhatsApp, { modo: 'enviar', valor: '', onValor: () => {}, onEnviar: () => {}, onArchivos: () => {}, acceptArchivo: ACCEPT_HILO }));
  assert.match(html, /aria-label="Adjuntar archivo"/);
  assert.match(html, /<input[^>]*type="file"[^>]*multiple=""/);
  // Y el de UN archivo sigue igual (lo usan otras pantallas).
  const uno = renderToStaticMarkup(createElement(ComposerWhatsApp, { modo: 'enviar', valor: '', onValor: () => {}, onArchivo: () => {} }));
  assert.doesNotMatch(uno, /multiple=""/);
});
