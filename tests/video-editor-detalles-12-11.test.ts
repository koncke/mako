// =============================================================================
// Cuatro detalles del Video Editor, vistos probando la tab entera en producción (12/11/2026)
// =============================================================================
//   1. La portada de «Publicar» salía NEGRA. No era Publicar: Exportar y Publicar son el mismo cuerpo y la misma
//      `portada()`. Medido en el panel del navegador: en un proyecto sano las dos dan el MISMO JPEG; en el de la prueba las
//      dos salían todo negro (su video ya no estaba en el OPFS). Ahora un cuadro vacío se vuelve a probar (otra vez y más
//      adelante) y, si falta un archivo, el diálogo lo dice (export/portada-reglas.ts).
//   2. El reel de Outliers quedaba unos segundos en blanco: el loader de la app tapa la caja hasta que el iframe carga.
//   3. Clips mágicos dejaba «Este video ya dura como un clip…» después de sumarle video, y el mensaje corría el botón: el
//      mensaje vale para la línea sobre la que se dijo (clips/resultado.ts › mensajeVigente) y va ARRIBA del botón.
//   4. La pastilla de la Edición automática tapaba el nombre del proyecto: la columna derecha de la cabecera no baja de
//      lo que mide y la pastilla va en corto (enjambre/pastilla.ts).
// Lo que es dibujo (canvas, iframe, grid) no corre en node: se fija el fuente.
//
// Correr: node --import tsx --test tests/video-editor-detalles-12-11.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avisoSinArchivo, cuadroVacio, intentosDePortada, LUZ_MINIMA } from '../app/video-editor/_opencut/export/portada-reglas';
import { mensajeVigente, TEXTO_MOTIVO_CLIPS } from '../app/video-editor/_opencut/clips/resultado';
import { textoPastillaCorta } from '../app/video-editor/_opencut/enjambre/pastilla';
import { PASOS, textoPastilla } from '../app/video-editor/_opencut/enjambre/plan';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Píxeles RGBA de un cuadro de `n` píxeles todos iguales. */
const cuadro = (n: number, [r, g, b, a]: [number, number, number, number]) => {
  const p = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) p.set([r, g, b, a], i * 4);
  return p;
};

test('1a. un cuadro todo negro o transparente cuenta como vacío; uno con algo de luz, no', () => {
  assert.equal(cuadroVacio(cuadro(256, [0, 0, 0, 255])), true, 'el negro del fondo');
  assert.equal(cuadroVacio(cuadro(256, [0, 0, 0, 0])), true, 'transparente: el JPEG lo pinta negro');
  assert.equal(cuadroVacio(cuadro(256, [255, 255, 255, 0])), true, 'blanco con opacidad 0 no se ve');
  assert.equal(cuadroVacio(cuadro(256, [LUZ_MINIMA - 2, LUZ_MINIMA - 2, LUZ_MINIMA - 2, 255])), true, 'casi negro, por la compresión');
  const conAlgo = cuadro(256, [0, 0, 0, 255]);
  conAlgo.set([180, 140, 120, 255], 77 * 4);
  assert.equal(cuadroVacio(conAlgo), false, 'UN píxel con luz alcanza: es un cuadro del video');
});

test('1b. los intentos: el momento pedido, otra vez el mismo, un segundo después y la mitad, sin salir del tramo', () => {
  const tps = 1000;
  assert.deepEqual(intentosDePortada({ desde: 0, hasta: 10 * tps, tps }), [0, 0, 1000, 5000]);
  // Con un rango (I / O): dentro de él.
  assert.deepEqual(intentosDePortada({ desde: 5000, hasta: 5500, tps }), [5000, 5000, 5499, 5250]);
  // Un tramo de un tick: sólo el pedido (y su segundo intento).
  assert.deepEqual(intentosDePortada({ desde: 0, hasta: 1, tps }), [0, 0]);
  // Negativo o fuera: se acota.
  assert.equal(intentosDePortada({ desde: -50, hasta: 3000, tps })[0], 0);
  for (const t of intentosDePortada({ desde: 0, hasta: 2500, tps })) assert.ok(t >= 0 && t < 2500, `${t} fuera del tramo`);
});

test('1c. si falta un archivo, el diálogo lo dice (corto)', () => {
  assert.equal(avisoSinArchivo([]), null);
  assert.equal(avisoSinArchivo(['toma-larga.mp4']), 'Falta «toma-larga.mp4» en este navegador');
  assert.equal(avisoSinArchivo(['toma-larga.mp4', 'mi-toma.mp4']), 'Faltan 2 archivos en este navegador');
});

test('1d. el cableado: portada() mira si salió vacío y reintenta; Exportar y Publicar dibujan la MISMA portada', () => {
  const x = sinComentarios(leer('app/video-editor/_opencut/export/exportar.ts'));
  const fn = x.slice(x.indexOf('export async function portada('), x.indexOf('refrescarReproductor(editor);', x.indexOf('export async function portada(')));
  assert.match(fn, /export async function portada\(editor: EditorCore, ancho = 480, tiempo = 0, hasta\?: number\)/);
  assert.match(fn, /const intentos = intentosDePortada\(\{/);
  assert.match(fn, /for \(const \[i, momento\] of intentos\.entries\(\)\) \{/);
  assert.match(fn, /await renderer\.renderToCanvas\(\{ node: escena, time: momento, targetCanvas: canvas \}\);/);
  assert.match(fn, /if \(!cuadroVacio\(mirar\.getImageData\(0, 0, LADO_MUESTRA, LADO_MUESTRA\)\.data\)\) break;/);
  assert.match(fn, /isPreview: true/, 'la portada sigue saliendo de la copia liviana');

  const d = sinComentarios(leer('app/video-editor/_opencut/export/dialogo-exportar.tsx'));
  assert.match(d, /void portada\(editor, 480, datos\.tramo\?\.desde \?\? 0, datos\.tramo\?\.hasta\)/);
  // Una sola <Portada> para los dos modos: si Publicar tuviera la suya, este test lo marca.
  assert.equal((d.match(/<Portada\b/g) ?? []).length, 1);
  assert.match(d, /archivosFaltantes\(editor\.scenes\.getActiveScene\(\)\.tracks, new Set\(editor\.media\.getAssets\(\)\.map\(\(m\) => m\.id\)\)\)/);
  assert.match(d, /sinArchivo=\{fase\.tipo === "formulario" \? sinArchivo : null\}/);
  assert.match(d, /\{sinArchivo && \(\s*<p data-portada-sin-archivo=""/);
});

test('2. el reel de Outliers: el loader de la app tapa la caja hasta que el reproductor de la red carga', () => {
  const v = sinComentarios(leer('app/video-editor/VerReel.tsx'));
  assert.match(v, /import \{ CargandoMako \} from '@\/app\/_ui\/CargandoMako';/, 'directo, no desde el índice de app/_ui');
  assert.match(v, /const \[cargado, setCargado\] = useState\(false\);/);
  // 13/11/2026, mirado en producción: el `load` del iframe llega VACÍO y el reel se dibuja ~5 s después. El loader espera el
  // aviso del reproductor (su `postMessage`) o un tope después del `load`, no el `load` solo.
  assert.match(v, /<iframe\s+src=\{embed\}\s+ref=\{marco\}[\s\S]*?onLoad=\{\(\) => setDocumento\(true\)\}\s*\/>/);
  assert.doesNotMatch(v, /onLoad=\{\(\) => setCargado\(true\)\}/, 'el load del iframe no es el reel dibujado');
  assert.match(v, /if \(marco\.current && e\.source === marco\.current\.contentWindow\) setCargado\(true\);/, 'sólo los avisos de SU reproductor');
  assert.match(v, /const tope = documento \? setTimeout\(\(\) => setCargado\(true\), TOPE_TRAS_CARGAR_MS\) : null;/);
  assert.match(v, /\{!cargado && <CargandoMako cubre que="el reel"/);
  // Los ganchos van ANTES del `if (!embed) return`: uno después cambia la cuenta de hooks entre renders (ticket #91).
  assert.ok(v.indexOf('useEffect(') > 0 && v.indexOf('useEffect(') < v.indexOf('if (!embed)'));
  // Volver a abrir la caja vuelve a mostrar el loader.
  assert.match(v, /onClick=\{\(\) => \{\s*setCargado\(false\);\s*setDocumento\(false\);\s*setAbierto\(true\);\s*\}\}/);
  // El loader es absoluto: la caja del video lo contiene.
  const css = leer('app/video-editor/outliers.module.css');
  assert.match(css, /\.verVideo \{ position: relative;/);
  // 13/11/2026, mirado en producción otra vez: el loader ya esperaba al reproductor, pero no se VEÍA. Mientras el iframe de
  // Instagram se arma la página casi no dibuja cuadros y las animaciones quedan pendientes en el tiempo 0; con `both` (ui.css)
  // el loader se quedaba en su primer cuadro, con opacidad 0. En la caja del reel va sin relleno hacia atrás.
  const sinRelleno = sinComentarios(css);
  assert.match(sinRelleno, /\.verVideo :global\(\.cm-carga__centro\), \.verVideo :global\(\.cm-carga__cria\) \{ animation-fill-mode: forwards; \}/);
  // Lo que se pisa: las dos entran con `both` y una demora (si eso cambia en ui.css, esta regla se revisa).
  const ui = leer('app/_ui/ui.css');
  assert.match(ui, /\.cm-carga__centro \{[^}]*animation: cm-aparece \.2s ease-out \.15s both;/);
  assert.match(ui, /\.cm-carga__cria \{ display: flex; animation: cm-nace \.5s cubic-bezier\(\.34, 1\.56, \.64, 1\) \.15s both,/);
});

test('3a. un mensaje de Clips mágicos vale para la línea sobre la que se dijo', () => {
  const corto = { proyectoId: 'p1', duracion: 30_000 };
  assert.equal(mensajeVigente(corto, { proyectoId: 'p1', duracion: 30_000 }), true, 'la misma línea: se muestra');
  assert.equal(mensajeVigente(corto, { proyectoId: 'p1', duracion: 148_000 }), false, 'le sumaron video (2:28): «ya dura como un clip» se va');
  assert.equal(mensajeVigente(corto, { proyectoId: 'p2', duracion: 30_000 }), false, 'otro proyecto');
  assert.equal(mensajeVigente(null, { proyectoId: 'p9', duracion: 1 }), true, 'el aviso de «Abrir» se lee en el proyecto nuevo');
  assert.ok(TEXTO_MOTIVO_CLIPS.corto.startsWith('Este video ya dura como un clip'));
});

test('3b. el cableado: «Buscar» ata el mensaje a la línea, y el mensaje va ARRIBA del botón (el botón no se corre)', () => {
  const b = sinComentarios(leer('app/video-editor/_opencut/clips/buscar.ts'));
  const terminar = b.slice(b.indexOf('const terminar ='), b.indexOf('return r;', b.indexOf('const terminar =')));
  assert.match(terminar, /vigencia: vigenciaDe\(editor\),/);
  assert.match(b, /duracion: editor\.timeline\.getTotalDuration\(\)/);

  const v = sinComentarios(leer('app/video-editor/_opencut/clips/components/clips-view.tsx'));
  assert.match(v, /const duracion = useEditor\(\(e\) => e\.timeline\.getTotalDuration\(\)\);/);
  assert.match(v, /mensajeVigente\(vigencia, \{ proyectoId: actual, duracion \}\)/);
  assert.doesNotMatch(v, /\{mensaje\}/, 'el mensaje crudo del store, sin mirar si sigue valiendo');
  const pie = v.slice(v.indexOf('border-t border-(--cc-line-2)'));
  const elMensaje = pie.indexOf('{aviso && !error && (');
  const elBoton = pie.indexOf('{trabajando ? (');
  assert.ok(elMensaje > 0 && elBoton > 0, 'el pie perdió el mensaje o el botón');
  assert.ok(elMensaje < elBoton, 'el mensaje volvió debajo del botón: lo empuja hacia arriba');
  assert.doesNotMatch(pie, /text-\[11px\] text-\(--cc-text-3\)/, 'sin renglones chicos grises');
});

test('4a. la pastilla de la Edición automática, en corto; lo largo queda en el title', () => {
  assert.equal(textoPastillaCorta('subtitulos'), `Subtítulos · 2/${PASOS.length}`);
  assert.equal(textoPastillaCorta(null), 'en vivo');
  for (const p of PASOS) {
    assert.ok(textoPastillaCorta(p.id).length < textoPastilla(p.id).length, `${p.id}: la corta no es más corta`);
    assert.ok(textoPastillaCorta(p.id).length <= 22, `${p.id}: «${textoPastillaCorta(p.id)}» es larga para la barra`);
  }
  const e = sinComentarios(leer('app/video-editor/_opencut/enjambre/components/en-vivo.tsx'));
  assert.match(e, /title=\{`\$\{textoPastilla\(paso\)\} · guardado automático`\}/);
  assert.match(e, /\{textoPastillaCorta\(paso\)\}\s*<\/span>/);
});

test('4b. la cabecera: la columna derecha no se desborda sobre el nombre; el que cede es el nombre, con elipsis', () => {
  const c = sinComentarios(leer('app/video-editor/_opencut/components/editor/editor-header.tsx'));
  assert.doesNotMatch(c, /grid-cols-\[1fr_auto_1fr\]/, 'volvieron las columnas que dejan que la derecha tape el nombre');
  assert.match(c, /<header className="grid [^"]*grid-cols-\[minmax\(0,1fr\)_auto_minmax\(min-content,1fr\)\]/);
  // Todo en una línea: el mínimo de la columna es su ancho real (un texto que se parte daría un mínimo falso).
  assert.match(c, /<div className="flex min-w-0 items-center justify-end gap-1\.5 whitespace-nowrap">\s*(?:\{\}\s*)?<EnVivo \/>/);
  // El nombre se achica con elipsis.
  assert.match(c, /className="h-\[26px\] max-w-\[40vw\] cursor-text truncate/);
});

test('3c. un aviso de Clips mágicos que dice qué hacer no es una falla: sin «Reportar a Soporte» (13/11/2026)', async () => {
  const { esFallaDeClips } = await import('../app/video-editor/_opencut/clips/resultado');
  assert.equal(esFallaDeClips({ ok: false, motivo: 'corto' }), false, '«ya dura como un clip» salía con «Reportar a Soporte»');
  assert.equal(esFallaDeClips({ ok: false, motivo: 'sin-voz' }), false);
  assert.equal(esFallaDeClips({ ok: false, motivo: 'sin-clips' }), false);
  assert.equal(esFallaDeClips({ ok: false, motivo: 'red' }), true);
  assert.equal(esFallaDeClips({ ok: true, clips: 3, aviso: null }), false);
  assert.match(sinComentarios(leer('app/video-editor/_opencut/clips/buscar.ts')), /error: esFallaDeClips\(r\),/);
});
