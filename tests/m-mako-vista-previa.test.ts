// =============================================================================
// /m/mako — la vista previa de lo que se va a mandar, a pantalla completa (como WhatsApp del celular)
// =============================================================================
// Pedido de Martín (11/10/2026), lo trajo el chat de Offer: «la vista previa del documento… como lo
// tiene WhatsApp… en todos los chats que suben documentos».
//
// En el teléfono: la hoja de adjuntar (cámara, fotos, archivo) sólo JUNTA; con algo juntado la pantalla
// pasa a la vista previa (app/m/mako/VistaAdjuntosM.tsx, que monta la MISMA VistaAdjuntos de ChatHilo y
// Offer), se suman o quitan archivos, se escribe el mensaje, y Enviar manda lo de siempre
// (`onEnviar({ texto, adjuntos })`): recién ahí ChatMako sube, todo junto por multipart. Acá se EJECUTA
// lo que decide la pantalla (app/m/mako/chat-ui.ts y el tope de la lista) y se fija el cableado. La
// vista en sí la fija tests/vista-adjuntos.test.ts.
//
// PROBADO ROMPIÉNDOLO (12/10/2026, arnés que rompe UNA cosa, corre este archivo y restaura DE MEMORIA;
// base 12 pases / 0 fallos). Las 22 roturas, cazadas, cada una con 11/1:
//   R1  `sumar` manda al elegir (onEnviar adentro)          R12 «atrás» no cierra la vista
//   R2  Enviar sin los adjuntos                             R13 la cámara no pasa por `sumar`
//   R3  `envioDe` no recorta el texto                       R14 la capa debajo del encabezado (z 30)
//   R4  la lista con tope 10 en vez de TOPE_ADJUNTOS        R15 «MaKo ocupado» antes que «preparando»
//   R5  4 archivos / 4 MB medidos sólo sobre lo nuevo       R16 la ✕ borra también el texto
//   R6  la capa sin portal a #m-capas                       R17 el teclado se mide siempre (rompe el zoom)
//   R7  el campo sin !important (iOS hace zoom)             R18 la capa con data-m-sin-barra
//   R8  `altoTeclado` sin el offsetTop                      R19 voseo en el placeholder («Escribí»)
//   R9  un PDF sin tipo deja de entrar por la extensión     R20 sin el área segura de abajo
//   R10 la vista montada aunque no haya nada juntado        R21 el chat de atrás scrollea bajo la vista
//   R11 el «+» del composer no se apaga con 4               R22 el mensaje de la vista no es el del composer
// Restaurado → 12/0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { altoTeclado, avisoDeVista, envioDe, problemaDeSeleccion, tipoDeElegido } from '../app/m/mako/chat-ui';
import { agregarALista } from '../app/whatsapp/_shared/adjuntos-vista';
import { ERROR_ADJUNTO, TOPE_ADJUNTOS, TOPE_TOTAL_BYTES } from '../lib/mako-adjuntos';
import { GRAMATICA } from '../lib/mako-gramatica';

const leer = (r: string): string => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
/**
 * Las líneas de comentario PRIMERO y los bloques después (AGENTS.md). Los bloques, sólo los que abren
 * un renglón o una llave de JSX: el `accept="image/*"` de la cámara abriría un «comentario» que se
 * comía las tres entradas hasta el próximo `*\/`.
 */
const sinComentarios = (src: string): string => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '');
const sinComentariosCss = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '');
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}
const contar = (src: string, re: RegExp): number => (src.match(re) ?? []).length;
/** El z-index de la regla cuyo selector es exactamente `sel`. */
function zDe(css: string, sel: string): number {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `no encontré la regla ${sel}`);
  const m = css.slice(i, css.indexOf('}', i)).match(/z-index:\s*(\d+)/);
  assert.ok(m, `${sel} no declara z-index`);
  return Number(m[1]);
}

const COMPOSER = sinComentarios(leer('app/m/mako/Composer.tsx'));
const CAPA = sinComentarios(leer('app/m/mako/VistaAdjuntosM.tsx'));
const CHAT = sinComentarios(leer('app/m/mako/ChatMako.tsx'));
const VISTA = (): string => bloque(COMPOSER, '<VistaAdjuntosM', '/>');

// ── Lo que decide la pantalla, ejecutado ─────────────────────────────────────

test('qué se puede juntar: foto o PDF por el tipo, o por la extensión si el navegador no dio tipo', () => {
  assert.equal(tipoDeElegido({ name: 'a.jpg', type: 'image/jpeg' }), 'image');
  assert.equal(tipoDeElegido({ name: 'IMG_1.HEIC', type: '' }), 'image', 'el HEIC sin tipo se intenta achicar (y si no se puede leer, se dice)');
  assert.equal(tipoDeElegido({ name: 'precios.pdf', type: 'application/pdf' }), 'document');
  assert.equal(tipoDeElegido({ name: 'precios.PDF', type: '' }), 'document', 'un PDF sin tipo (selector de Android) también entra');
  assert.equal(tipoDeElegido({ name: 'contrato.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), null);
  assert.equal(tipoDeElegido({ name: 'clip.mp4', type: 'video/mp4' }), null);
});

test('Enviar: el texto (recortado) y TODOS los archivos juntados, en el orden de la tira', () => {
  const items = [
    { id: 'a', file: new File(['x'], 'foto.jpg', { type: 'image/jpeg' }) },
    { id: 'b', file: new File(['%PDF-'], 'precios.pdf', { type: '' }) },
    { id: 'c', file: new File(['y'], 'otra.png', { type: 'image/png' }) },
  ];
  const e = envioDe('  mira esto  ', items);
  assert.equal(e.texto, 'mira esto');
  assert.deepEqual(e.adjuntos.map((a) => [a.id, a.nombre, a.tipo]), [
    ['a', 'foto.jpg', 'image'], ['b', 'precios.pdf', 'document'], ['c', 'otra.png', 'image'],
  ]);
  assert.equal(e.adjuntos[1].file, items[1].file, 'viaja el MISMO archivo que se juntó (el achicado)');
  assert.deepEqual(envioDe('hola', []), { texto: 'hola', adjuntos: [] }, 'sin archivos, sólo el texto');
});

test('los topes de siempre: 4 archivos y 4 MB en total, contando lo que YA hay más lo nuevo', () => {
  assert.equal(TOPE_ADJUNTOS, 4);
  const f = (name: string, size = 1000) => ({ name, type: 'image/jpeg', size }) as unknown as File;
  let i = 0;
  const r = agregarALista([], [f('1.jpg'), f('2.jpg'), f('3.jpg'), f('4.jpg'), f('5.jpg')], { maxArchivos: TOPE_ADJUNTOS }, () => `x${++i}`);
  assert.equal(r.items.length, 4, 'la lista no junta un quinto');
  assert.deepEqual(r.errores, ['Puedes juntar hasta 4 archivos.']);
  assert.equal(problemaDeSeleccion([1000, 1000, 1000, 1000, 1000]), ERROR_ADJUNTO.muchos);
  assert.equal(problemaDeSeleccion([TOPE_TOTAL_BYTES - 10, 20]), ERROR_ADJUNTO.pesado);
  assert.equal(problemaDeSeleccion([1000, 2000, 3000, 4000]), null);
});

test('lo que dice la vista mientras Enviar está apagado: preparar gana, después transcribir, después MaKo', () => {
  assert.equal(avisoDeVista({ preparando: false, transcribiendo: false, ocupado: false }), null);
  assert.equal(avisoDeVista({ preparando: true, transcribiendo: true, ocupado: true }), 'Preparando el archivo…');
  assert.equal(avisoDeVista({ preparando: false, transcribiendo: true, ocupado: true }), 'Transcribiendo…');
  assert.equal(avisoDeVista({ preparando: false, transcribiendo: false, ocupado: true }), `${GRAMATICA.analizando.rotulo} · tu mensaje anterior`,
    'el estado de MaKo sale de GRAMATICA, con su fuente al lado');
});

test('el teclado: en iOS tapa lo que el visualViewport no muestra; en Android (ya achicado) da 0', () => {
  assert.equal(altoTeclado(844, { height: 508, offsetTop: 0 }), 336);
  assert.equal(altoTeclado(844, { height: 508, offsetTop: 100 }), 236, 'iOS corrió la vista: se descuenta');
  assert.equal(altoTeclado(520, { height: 520, offsetTop: 0 }), 0, 'Android con resizes-content');
  assert.equal(altoTeclado(844, null), 0);
  assert.equal(altoTeclado(844, { height: 900, offsetTop: 0 }), 0, 'nunca negativo');
});

// ── El cableado ──────────────────────────────────────────────────────────────

test('ELEGIR no sube nada: las tres entradas y el «+» de la vista pasan por `sumar`, que sólo achica y junta', () => {
  const sumar = bloque(COMPOSER, 'async function sumar(archivos: File[]) {', 'function alElegir(');
  assert.doesNotMatch(sumar, /onEnviar|postConProgreso|fetch\(|FormData|XMLHttpRequest/, 'elegir volvió a mandar o a subir');
  assert.match(sumar, /const tipo = tipoDeElegido\(f\);/);
  assert.match(sumar, /await achicarImagen\(f\)/, 'la foto se achica en el teléfono, antes de subir');
  assert.match(sumar, /motivos\.push\(\.\.\.lista\.agregar\(nuevos\)\)/);
  // El composer entero no sube ni manda de a uno: eso es de ChatMako, con Enviar, todo junto.
  assert.doesNotMatch(COMPOSER, /postConProgreso|fetch\(|new FormData|XMLHttpRequest|enviarEnOrden/);
  assert.doesNotMatch(CAPA, /postConProgreso|fetch\(|new FormData|XMLHttpRequest|enviarEnOrden/);
  assert.equal(contar(COMPOSER, /onChange=\{alElegir\}/g), 3, 'cámara, fotos y archivo');
  assert.match(bloque(COMPOSER, 'function alElegir(', 'const quitar ='), /void sumar\(elegidos\);/);
  assert.match(VISTA(), /onAgregar=\{\(fs\) => void sumar\(fs\)\}/);
});

test('Enviar manda los adjuntos y el texto, y recién ahí ChatMako sube TODO JUNTO por multipart', () => {
  const enviar = bloque(COMPOSER, 'const enviar = () => {', 'const micApagado');
  assert.match(enviar, /if \(!puedeEnviar\) return;/);
  const iMandar = enviar.indexOf('onEnviar(envioDe(texto, lista.ref.current));');
  const iVaciar = enviar.indexOf('lista.vaciar();');
  assert.ok(iMandar > 0 && iVaciar > iMandar, 'se manda lo de AHORA (la ref) y después se vacía la lista');
  const vista = VISTA();
  assert.match(vista, /onEnviar=\{enviar\}/, 'el Enviar de la vista es el mismo del composer');
  assert.match(vista, /items=\{lista\.items\}/);
  assert.match(vista, /texto=\{texto\}/, 'el mensaje de la vista es el texto del composer');
  assert.match(vista, /puedeEnviar=\{listo\}/);
  const turno = bloque(CHAT, 'const enviar = async (e: Envio) => {', 'const reintentar =');
  assert.equal(contar(CHAT, /postConProgreso\(/g), 1, 'ChatMako sube en un solo lugar');
  assert.match(turno, /fd\.append\('mensaje', e\.texto\);/);
  assert.match(turno, /for \(const a of e\.adjuntos\) fd\.append\('adjuntos', a\.file, a\.file\.name\);/);
  assert.doesNotMatch(CHAT, /enviarEnOrden/);
  assert.match(CHAT, /<Composer enLinea=\{enLinea\} ocupado=\{trabajo != null\} onEnviar=\{\(e\) => void enviar\(e\)\}/);
});

test('el tope de 4 en el teléfono: la lista, el «+» del composer y el «+» de la vista', () => {
  assert.match(COMPOSER, /const TOPES_LISTA = \{ maxArchivos: TOPE_ADJUNTOS \};/);
  assert.match(COMPOSER, /const lista = useListaAdjuntos\(TOPES_LISTA\);/);
  assert.match(COMPOSER, /disabled=\{!enLinea \|\| lista\.items\.length >= TOPE_ADJUNTOS\}/);
  const vista = VISTA();
  assert.match(vista, /maxArchivos=\{TOPE_ADJUNTOS\}/);
  assert.match(vista, /accept=\{ACCEPT_ADJUNTOS_CHAT\}/, 'los formatos de lib/mako-adjuntos.ts');
  const sumar = bloque(COMPOSER, 'async function sumar(archivos: File[]) {', 'function alElegir(');
  assert.match(sumar, /problemaDeSeleccion\(\[\.\.\.lista\.ref\.current\.map\(\(a\) => a\.file\.size\), \.\.\.nuevos\.map\(\(f\) => f\.size\)\]\)/,
    'los 4 archivos y los 4 MB se miden sobre lo que ya hay más lo nuevo');
});

test('la vista se dibuja sólo con algo juntado, y es la MISMA VistaAdjuntos (no una copia)', () => {
  assert.match(COMPOSER, /const hayVista = lista\.items\.length > 0;/);
  assert.match(COMPOSER, /\{hayVista && \(\s*<VistaAdjuntosM/);
  assert.match(CAPA, /import \{ VistaAdjuntos, type VistaAdjuntosProps \} from '@\/app\/whatsapp\/_shared\/VistaAdjuntos';/);
  assert.match(CAPA, /<VistaAdjuntos \{\.\.\.props\} onCerrar=\{pedirCierre\} \/>/);
  // Lo que dibuja la vista no se reescribe en /m (el PDF, las URL blob de las miniaturas).
  for (const src of [COMPOSER, CAPA]) assert.doesNotMatch(src, /unpdf|getDocumentProxy|createObjectURL\(listo\)/);
  // La ✕ descarta los archivos, no el texto (es el borrador del chat).
  const cerrar = bloque(COMPOSER, 'const cerrarVista = () => {', 'const abrirHoja =');
  assert.match(cerrar, /lista\.vaciar\(\);/);
  assert.doesNotMatch(cerrar, /setTexto/);
  assert.match(VISTA(), /onCerrar=\{cerrarVista\}/);
});

test('la capa: portal a #m-capas, «atrás» la cierra, sin data-m-sin-barra, y el teclado de iOS', () => {
  assert.equal(contar(CAPA, /createPortal\(/g), 1);
  assert.match(CAPA, /setCapa\(document\.getElementById\('m-capas'\) \?\? document\.body\)/,
    'adentro del composer (fixed, z 35, con transform en iOS) quedaba debajo del encabezado');
  assert.match(CAPA, /window\.history\.pushState\(null, '', urlCon\(true\)\);/);
  assert.match(bloque(CAPA, 'const alAtras = () => {', "window.addEventListener('popstate', alAtras);"), /cerrar\.current\(\);/);
  assert.match(bloque(CAPA, 'const pedirCierre = () => {', 'if (!capa) return null;'), /window\.history\.back\(\);/);
  assert.doesNotMatch(CAPA, /data-m-sin-barra/, 'reacomoda el chat de atrás y el scroll se pierde');
  assert.match(CAPA, /if \(!vv \|\| !campo\) \{ setTeclado\(null\); return; \}/, 'sólo con el campo enfocado (el zoom de dos dedos achicaría la capa)');
  assert.match(CAPA, /const t = altoTeclado\(window\.innerHeight, vv\);/);
  assert.match(COMPOSER, /setTeclado\(altoTeclado\(window\.innerHeight, vv\)\)/, 'el composer y la capa miden el teclado con la MISMA función');
});

test('CSS: la capa tapa el encabezado, la barra y el composer; queda debajo de sheets y toasts; 16 px y áreas seguras', () => {
  const mako = sinComentariosCss(leer('app/m/mako/mako.css'));
  const m = sinComentariosCss(leer('app/m/m.css'));
  const zVista = zDe(mako, '[data-m] .m-mako-vista');
  for (const [sel, css] of [['.m-cabecera', m], ['.m-barra', m], ['[data-m] .m-mako-composer', mako]] as const) {
    assert.ok(zVista > zDe(css, sel), `z ${zVista}: ${sel} queda encima`);
  }
  assert.ok(zVista < zDe(m, '.m-sheet-capa') && zVista < zDe(m, '.m-toast-capa'), `z ${zVista}: tapa los sheets o los toasts`);
  assert.match(mako, /\[data-m\] \.m-mako-vista textarea \{ font-size: max\(16px, var\(--fs-md\)\) !important; \}/,
    'el fontSize: 14 en línea de la vista le gana a la regla de m.css sin el !important (iOS hace zoom)');
  const regla = bloque(mako, '[data-m] .m-mako-vista {', '}');
  assert.match(regla, /position: fixed;/);
  assert.match(regla, /inset: 0;/);
  for (const lado of ['top', 'right', 'bottom', 'left']) assert.match(regla, new RegExp(`env\\(safe-area-inset-${lado}, 0px\\)`), `falta el área segura de ${lado}`);
  assert.match(mako, /:root:has\(\[data-m\] \.m-mako-vista\) \{ overflow: hidden; \}/, 'el chat de atrás no scrollea con el dedo sobre la vista');
});

test('copy en español neutro con tú: nada de voseo en lo que dibujan el composer y la capa', () => {
  // Con tilde: «mira» es tú, «mirá» es vos. Y `\b` no sirve después de una «á» (no es letra para \w).
  const VOSEO = /(?<!\p{L})(pod[eé]s|ten[eé]s|quer[eé]s|sab[eé]s|escribí|agregá|mirá|elegí|tocá|mandá|probá|fijate|vos)(?!\p{L})/iu;
  for (const [nombre, src] of [['Composer.tsx', leer('app/m/mako/Composer.tsx')], ['VistaAdjuntosM.tsx', leer('app/m/mako/VistaAdjuntosM.tsx')], ['chat-ui.ts', leer('app/m/mako/chat-ui.ts')]] as const) {
    const textos = src.match(/'[^'\n]*'|`[^`\n]*`|>[^<>{}\n]+</g) ?? [];
    for (const t of textos) assert.doesNotMatch(t, VOSEO, `${nombre}: voseo en ${t}`);
  }
});
