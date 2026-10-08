// =============================================================================
// curso-leccion — la LECCIÓN del curso (items 13 a 17 del pedido de Martín, 07/10/2026)
// =============================================================================
// «Dentro de una clase, no deberían haber tabs de "Tarea" y "Descripción", por defecto ambas juntas
// siempre, y primero siempre la descripción... Elimina el botón de "Editar", para eso ya se edita en
// cada parte... debe siempre estar un placeholder donde iría el vídeo para la opción de "Agregar
// vídeo"... que la descripción y la tarea estén al costado del vídeo, o abajo de forma extendida...
// Lo mismo con el botón de "Agregar tarea" ahí mismo abajo de la descripción, como placeholder.»
//
// Lo que se EJECUTA: las reglas puras de la lección editable de la tab
// (app/customer-success/curso/leccion-reglas.ts), las del dibujo compartido (app/_cursos/reglas.ts: la
// disposición) y las del portal del alumno (su modelo-ugc: el orden del papel, la descripción, la
// comunidad y el tilde «Hecha»). Lo que se LEE del fuente —sin comentarios y con los \r\n
// normalizados (AGENTS.md: el que explica qué se sacó nombra lo que se sacó)—: que el dibujo no tenga
// pestañas ni «Editar», que el lugar del video que falta sea un recuadro punteado y no un marco negro,
// que las DOS pantallas pongan la descripción antes que la tarea, la regla de la hoja para «Texto
// abajo», la vista previa con las URLs de los adjuntos, y la comunidad sin el líder de un área ni la
// vista previa.
//
// ── Roturas (08/10/2026) ─────────────────────────────────────────────────────
// Ver el bloque al final del archivo, con el resultado de cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Campo, Clase } from '../lib/curso';
import type { ClaseVista } from '../lib/curso-portal';
import {
  cambiosParaQuitarTarea, faltaEnFormulario, htmlDeTexto, htmlInicialDeDescripcion, linkDeVideo, lugarDelVideo,
  minutosDeDuracion, ofreceCierraModulo, tareaAbierta, textoDeGuardado,
} from '../app/customer-success/curso/leccion-reglas';
import { OPCIONES_DISPOSICION, claseDelSplit } from '../app/_cursos/reglas';
import { CSS_UGC } from '../app/_cursos/estilos';
import {
  ENTRADA_COMUNIDAD, chipsDeClase, descripcionDeClase, ofreceComunidad, partesDelPapel,
} from '../app/compartido/curso/[token]/modelo-ugc';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas `//` PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** De `desde` hasta `hasta` (exclusivo), y que los dos estén: un recorte que no encuentra su fin mira de más. */
const entre = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(i >= 0 && j > i, `no encontré «${desde}» … «${hasta}»`);
  return src.slice(i, j);
};

const video = (o: Partial<Clase>) => ({ videoTipo: 'ninguno', videoUrl: null, videoPath: null, ...o }) as Pick<Clase, 'videoTipo' | 'videoUrl' | 'videoPath'>;
const campo = (o: Partial<Campo>): Campo => ({ id: 'c1', label: 'Tu meta', tipo: 'texto', ...o } as Campo);
const claseV = (o: Partial<ClaseVista> = {}): ClaseVista => ({
  id: 1, titulo: 'Clase', descripcion: '', descripcionHtml: '', minutos: null, video: null, pct: null, tarea: '', campos: [],
  tieneTarea: false, obligatoria: false, estado: 'pendiente', valores: {}, hecha: false, completa: false, ...o,
});

// ── El video de la lección ───────────────────────────────────────────────────

test('el video: el marco, un link de afuera, o el recuadro de «Agregar video» (y lo que no es un video, también el recuadro)', () => {
  assert.equal(lugarDelVideo(video({})), 'vacio');
  assert.equal(lugarDelVideo(video({ videoTipo: 'youtube', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' })), 'marco');
  assert.equal(lugarDelVideo(video({ videoTipo: 'drive', videoUrl: 'https://drive.google.com/file/d/abc/view' })), 'marco');
  assert.equal(lugarDelVideo(video({ videoTipo: 'archivo', videoPath: '1/7/x.mp4' })), 'marco');
  assert.equal(lugarDelVideo(video({ videoTipo: 'url', videoUrl: 'https://ejemplo.com/una-pagina' })), 'afuera');
  // La MISMA regla que el portal (`reproductorDeClase`): lo que el alumno no ve, el equipo lo arregla.
  assert.equal(lugarDelVideo(video({ videoTipo: 'archivo', videoPath: null })), 'vacio', 'un archivo sin ruta no se reproduce');
  assert.equal(lugarDelVideo(video({ videoTipo: 'youtube', videoUrl: 'javascript:alert(1)' })), 'vacio');
});

test('pegar un link: los de la lista y un archivo directo; lo que no es http no va, y se dice si no se mide', () => {
  assert.deepEqual(linkDeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    { ok: true, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', rotulo: 'YouTube' });
  const rotulo = (u: string) => { const r = linkDeVideo(u); assert.ok(r.ok, u); return r.rotulo; };
  assert.equal(rotulo('https://vimeo.com/123456'), 'Vimeo');
  assert.equal(rotulo('https://www.loom.com/share/abc123'), 'Loom · sin medir');
  assert.equal(rotulo('https://drive.google.com/file/d/abc/view'), 'Drive · sin medir');
  assert.equal(rotulo('https://cdn.ejemplo.com/clase.mp4'), 'Link');
  assert.deepEqual(linkDeVideo('   '), { ok: false, error: 'Pega un link.' });
  for (const malo of ['ftp://ejemplo.com/v.mp4', 'javascript:alert(1)', 'no es un link']) {
    assert.equal(linkDeVideo(malo).ok, false, `aceptó ${malo}`);
  }
});

test('los minutos salen de la duración del archivo subido: al menos 1, con el tope de la clase, y sin duración nada', () => {
  // 20 s y no 59: 59/60 redondea a 1 solo, y con 59 el «al menos 1» se podía borrar en VERDE (rotura).
  assert.equal(minutosDeDuracion(20), 1, 'un video corto no es una clase de 0 minutos');
  assert.equal(minutosDeDuracion(125), 2);
  assert.equal(minutosDeDuracion(100_000), 600);
  for (const nada of [0, -3, Number.NaN, null, undefined]) assert.equal(minutosDeDuracion(nada), null);
});

// ── La descripción ───────────────────────────────────────────────────────────

test('la descripción: la rica si la hay; si no, el texto plano ESCAPADO en párrafos', () => {
  assert.equal(htmlDeTexto('Hola <b>\n\nChau & listo\nfin'), '<p>Hola &lt;b&gt;</p><p>Chau &amp; listo<br>fin</p>');
  assert.equal(htmlDeTexto('  \n '), '');
  assert.equal(htmlInicialDeDescripcion({ descripcion: 'plano', descripcionHtml: '<p>rico</p>' }), '<p>rico</p>');
  assert.equal(htmlInicialDeDescripcion({ descripcion: 'plano', descripcionHtml: '' }), '<p>plano</p>',
    'una clase de antes del editor rico arranca con su texto: vacía, el primer guardado lo borraría');
  assert.equal(htmlInicialDeDescripcion({ descripcion: '<script>x</script>' }), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
});

// ── La tarea ─────────────────────────────────────────────────────────────────

test('la tarea: un formulario a medias no se manda (se dice qué falta), y uno completo sí', () => {
  const quiz = (correctas: string[]) => campo({ id: 'q1', label: 'Repaso', tipo: 'quiz', obligatorio: true,
    preguntas: [{ id: 'p1', texto: '¿Cuánto es 2 + 2?', opciones: ['3', '4'], correctas }] });
  assert.match(faltaEnFormulario([quiz([])])!, /Marca la correcta/);
  assert.equal(faltaEnFormulario([campo({ label: '' })]), 'Hay un campo sin pregunta.');
  assert.equal(faltaEnFormulario([quiz(['4'])]), null);
  assert.equal(faltaEnFormulario([campo({})]), null);
  assert.equal(faltaEnFormulario([]), null, 'sin campos es una respuesta libre: se guarda');
});

test('«Agregar tarea» abre la tarea; «Quitar» manda sólo lo que hace falta; «Cierra el módulo» sólo en un vinculado', () => {
  assert.equal(tareaAbierta({ tarea: '', campos: [] }, false), false, 'sin tarea va el botón punteado');
  assert.equal(tareaAbierta({ tarea: '', campos: [] }, true), true);
  assert.equal(tareaAbierta({ tarea: 'Escribe tu meta', campos: [] }, false), true);
  assert.equal(tareaAbierta({ tarea: '', campos: [campo({})] }, false), true);
  assert.deepEqual(cambiosParaQuitarTarea({ tarea: 'Hazlo', campos: [campo({})] }), [{ tarea: '' }, { campos: [] }]);
  assert.deepEqual(cambiosParaQuitarTarea({ tarea: '   ', campos: [campo({})] }), [{ campos: [] }]);
  assert.deepEqual(cambiosParaQuitarTarea({ tarea: '', campos: [] }), []);
  assert.equal(ofreceCierraModulo(true), true);
  assert.equal(ofreceCierraModulo(false), false, 'un módulo suelto no es una etapa: la marca no movería a nadie');
});

test('lo que dice el guardado es corto (y lo que falta va entero: es lo único que se puede arreglar)', () => {
  assert.equal(textoDeGuardado('limpio'), '');
  assert.equal(textoDeGuardado('guardando'), 'Guardando…');
  assert.equal(textoDeGuardado('error'), 'No se guardó');
  assert.equal(textoDeGuardado({ falta: 'Marca la correcta en la pregunta 1 de «Repaso».' }), 'Marca la correcta en la pregunta 1 de «Repaso».');
  for (const e of ['sucio', 'guardando', 'guardado', 'error'] as const) assert.ok(textoDeGuardado(e).split(' ').length <= 3, e);
});

// ── La disposición: texto al costado o abajo ─────────────────────────────────

test('«Texto al costado / Texto abajo»: dos opciones cortas, y «abajo» es una clase más del contenedor', () => {
  assert.deepEqual(OPCIONES_DISPOSICION.map((o) => o.valor), ['costado', 'abajo']);
  for (const o of OPCIONES_DISPOSICION) assert.ok(o.texto.split(' ').length <= 3, o.texto);
  assert.equal(claseDelSplit('abajo'), 'ugc-split ugc-split--abajo');
  for (const otro of ['costado', undefined, null] as const) assert.equal(claseDelSplit(otro), 'ugc-split');
});

test('la hoja: «abajo» sin base 0 (apiladas quedaban en alto CERO), el recuadro del video punteado, y lo de la app con su relleno', () => {
  const css = CSS_UGC.replace(/\/\*[\s\S]*?\*\//g, '');
  const regla = (inicio: string) => {
    const i = css.indexOf(inicio);
    assert.ok(i >= 0, `no encontré la regla «${inicio}»`);
    return css.slice(i, css.indexOf('}', i));
  };
  assert.match(regla('.ahdoc.ahdoc--ugc .ugc .ugc-split.ugc-split--abajo {'), /flex-direction: column !important/);
  assert.match(regla('.ahdoc.ahdoc--ugc .ugc .ugc-split.ugc-split--abajo > .ugc-vcol,'), /flex: 0 0 auto !important/);
  assert.match(regla('.ahdoc.ahdoc--ugc .ugc .ugc-content > .ugc-split.ugc-split--abajo > .ugc-pcol {'), /max-height: none !important/);
  const vacio = regla('.ahdoc.ahdoc--ugc .ugc .ugc-vvacio {');
  assert.match(vacio, /dashed/);
  assert.match(vacio, /aspect-ratio: 16 \/ 9/);
  assert.doesNotMatch(vacio, /#000|rgb\(13, 12, 10\)|black/, 'un marco negro vacío se lee como un reproductor roto');
  // En el teléfono la lección va siempre apilada: el interruptor no cambiaría nada y no se dibuja.
  const tel = css.slice(css.indexOf('@media (max-width: 760px)'));
  assert.match(tel, /\.ahdoc\.ahdoc--ugc \.ugc \.ugc-dispo \{ display: none; \}/);
  assert.match(css, /\.ahdoc\.ahdoc--ugc \.mk-input, \.ahdoc\.ahdoc--ugc \.mk-textarea \{ padding: 10px 12px; \}/);
  assert.match(css, /\.ahdoc\.ahdoc--ugc \.mk-switch \{ background: /, 'un interruptor sin fondo es sólo la bolita');
});

// ── El dibujo compartido (CursoUgc) ──────────────────────────────────────────

test('el dibujo de la lección: un papel, sin pestañas y sin «Editar»; sin video, el recuadro y no el marco', () => {
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  const lec = entre(ugc, 'function Leccion(', 'const IconoImagen');
  assert.ok(lec.length > 500 && lec.length < 6000, `el recorte de Leccion mide ${lec.length}: está mirando otra cosa`);
  assert.doesNotMatch(lec, /pestanas|CabeceraPestanas|setTab/, 'volvieron las pestañas de la lección');
  assert.doesNotMatch(lec, /onEditar|t\.editar|ltitle-editar/, 'volvió el botón «Editar»');
  assert.match(lec, /<div className="ugc-pcol">\{l\.papel\}<\/div>/);
  assert.match(lec, /\{l\.video \? \([\s\S]*?\) : l\.sinVideo != null && \(\s*<div className="ugc-vvacio">\{l\.sinVideo\}<\/div>/,
    'sin video va el recuadro, y SÓLO sin video');
  assert.match(lec, /<div className=\{claseDelSplit\(actual\)\}>/);
  assert.match(lec, /\{edicion\?\.onDisposicion \? \(/, 'el interruptor es de quien edita');
  const tipos = sinComentarios(leer('app/_cursos/tipos.ts'));
  assert.doesNotMatch(tipos, /pestanas\??:|PestanaUgc|onEditar|\beditar: string/);
  assert.match(tipos, /sinVideo\?: ReactNode;/);
});

test('no queda rastro de «Editar» ni de su modal en la tab ni en el dibujo', () => {
  const archivos = [
    'app/_cursos/CursoUgc.tsx', 'app/_cursos/tipos.ts', 'app/_cursos/reglas.ts', 'app/customer-success/curso/CursoApp.tsx',
    'app/customer-success/curso/LeccionEditable.tsx', 'app/customer-success/curso/modelo-ugc.ts', 'app/customer-success/curso/page.tsx',
  ];
  for (const f of archivos) {
    assert.doesNotMatch(sinComentarios(leer(f)), /\bonEditar\b|\bEditorClase\b|\bt\.editar\b|\beditar: '|\bsetEditando\b/, `${f} todavía tiene «Editar»`);
  }
});

// ── La tab Curso: la lección editable ────────────────────────────────────────

test('la tab: la descripción PRIMERO y la tarea debajo, y lo que edita cada parte va por su propia escritura', () => {
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  const papel = entre(le, 'function PapelDelEditor(', 'function useUrlsDeAdjuntos(');
  assert.ok(papel.indexOf('<DescripcionEditable') > 0 && papel.indexOf('<TareaEditable') > papel.indexOf('<DescripcionEditable'),
    'la descripción va PRIMERO y la tarea debajo (item 14)');
  assert.ok(papel.indexOf('<DescripcionLectura') < papel.indexOf('<TareaComoLaVeElAlumno'), 'también para quien sólo mira');
  const lec = entre(le, 'export function leccionDelEditor(', 'const claveDeVideo');
  assert.doesNotMatch(lec, /pestanas/);
  assert.match(lec, /sinVideo: lugar === 'vacio' && ctx\.puedeEditar \? <AgregarVideo/, 'el recuadro de «Agregar video» es de quien edita');
  // El video, por los dos caminos (link y archivo con su barra), y quitarlo.
  assert.match(le, /guardar\(\{ video: \{ tipo: 'url', url: l\.url \} \}\)/);
  assert.match(le, /subirConProgreso\(firma\.signedUrl, archivo, firma\.apikey, setPct\)/, 'la barra es la del XHR de subir-video.ts');
  assert.match(le, /guardar\(\{ video: \{ tipo: 'archivo', path: firma\.path \} \}\)/);
  assert.match(le, /guardar\(\{ video: null \}\)/);
  // La descripción: el editor rico con adjuntos, guardado con respiro.
  assert.match(le, /<EditorRico [^>]*subirAdjunto=\{subirAdjunto\}/);
  assert.match(le, /guardarCampoClaseAction\(claseId, \{ descripcionHtml: h \}\)/);
  assert.match(le, /window\.setTimeout\(\(\) => \{ void guardar\(h\); \}, RESPIRO_DESCRIPCION_MS\)/);
  // La tarea: el formulario a medias no se manda, y «Cierra el módulo» sólo en un vinculado.
  const tarea = entre(le, 'function TareaEditable(', 'export const CSS_LECCION');
  assert.match(tarea, /const falta = faltaEnFormulario\(cs\);\s*if \(falta\) \{ setEstado\(\{ falta \}\); return; \}/);
  assert.match(tarea, /\{ofreceCierraModulo\(ctx\.vinculado\) && \(/);
  assert.match(tarea, /label="Cierra el módulo"/);
  assert.match(tarea, /<EditorCampos campos=\{campos\}/);
  assert.match(tarea, />\+ Agregar tarea</);
  // Ninguna pregunta se dibuja ADENTRO del curso: la hoja le saca el fondo y el borde a sus botones.
  assert.doesNotMatch(le, /useConfirm|<Modal\b|<Confirm\b/);
});

test('la hoja de la lección: todo acotado al curso, y sin nada que corte el template literal', () => {
  const crudo = leer('app/customer-success/curso/LeccionEditable.tsx');
  const ini = crudo.indexOf('export const CSS_LECCION = `');
  assert.ok(ini > 0);
  const css = crudo.slice(ini + 'export const CSS_LECCION = `'.length, crudo.indexOf('`;', ini + 30)).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!css.includes('${'), 'una interpolación adentro de la hoja');
  const selectores = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((p) => p && !p.startsWith('@'))
    .flatMap((p) => p.split(',')).map((p) => p.trim()).filter(Boolean);
  assert.ok(selectores.length > 25, `leí ${selectores.length} selectores: el parser quedó corto`);
  // Con menos que esto, el reset de la hoja del curso (`.ahdoc button`, `.ahdoc *`) les gana.
  assert.deepEqual(selectores.filter((s) => !s.startsWith('.ahdoc.ahdoc--ugc .ugc ')), []);
});

test('la tab arma la lección con leccionDelEditor, le pasa la disposición y guarda el interruptor como ajuste del curso', () => {
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(app, /return leccionDelEditor\(c, ctx\);/);
  assert.match(app, /disposicion=\{disposicionDe\(estilo\)\}/);
  assert.match(app, /onDisposicion: estiloError \? undefined : \(d\) => \{ void guardarAjuste\(\{ tipo: 'disposicion' \}, d === 'abajo' \? 'abajo' : null\); \}/);
  // Las preguntas de la lección las dibuja la tab, afuera del curso.
  assert.match(app, /confirmar: \(mensaje, o\) => confirm\(mensaje, \{ title: o\.titulo, confirmLabel: o\.boton \}\)/);
  // «+ Clase» crea la clase en el server y la abre: ya no hay un modal que llenar antes.
  assert.match(app, /await crearClaseAction\(servicio\.productoId, moduloKey\)/);
  assert.match(app, /navegar\(\{ mod: moduloKey, clase: r\.clase\.id \}\)/);
});

// ── El portal del alumno ─────────────────────────────────────────────────────

test('portal: el papel es la descripción y DEBAJO la tarea; «Marcar como hecha» sólo sin tarea y nunca al líder', () => {
  assert.deepEqual(partesDelPapel(claseV({ descripcion: 'Lee esto', tieneTarea: true, tarea: 'Hazlo' }), false), ['descripcion', 'tarea']);
  assert.deepEqual(partesDelPapel(claseV({ descripcionHtml: '<p>Rico</p>' }), false), ['descripcion', 'hecha']);
  assert.deepEqual(partesDelPapel(claseV({}), false), ['hecha']);
  assert.deepEqual(partesDelPapel(claseV({}), true), [], 'el líder de un área no completa clases por el cliente');
  assert.deepEqual(partesDelPapel(claseV({ tieneTarea: true }), true), ['tarea']);
  assert.deepEqual(descripcionDeClase(claseV({ descripcion: 'plano', descripcionHtml: '<p>rico</p>' })), { tipo: 'html', html: '<p>rico</p>' });
  assert.deepEqual(descripcionDeClase(claseV({ descripcion: 'Uno\n\nDos' })), { tipo: 'texto', parrafos: ['Uno', 'Dos'] });
  assert.equal(descripcionDeClase(claseV({ descripcion: '   ' })), null);
});

test('portal: el chip «Hecha» en una clase sin tarea (la que se marcó), y nunca en una con tarea', () => {
  const vivo = { pct: null, estado: 'pendiente' as const, propuesta: false };
  assert.ok(chipsDeClase(claseV({}), { ...vivo, hecha: true }).some((c) => c.texto === 'Hecha'));
  assert.ok(chipsDeClase(claseV({ hecha: true }), vivo).some((c) => c.texto === 'Hecha'), 'lo que trajo el server');
  assert.ok(!chipsDeClase(claseV({ hecha: true }), { ...vivo, hecha: false }).some((c) => c.texto === 'Hecha'), 'lo que desmarcó en la pantalla');
  assert.ok(!chipsDeClase(claseV({ tieneTarea: true, hecha: true }), { ...vivo, hecha: true }).some((c) => c.texto === 'Hecha'));
});

test('portal: la comunidad es del CLIENTE — ni en la vista previa del equipo ni para el líder de un área', () => {
  assert.equal(ENTRADA_COMUNIDAD, 'comunidad');
  assert.equal(ofreceComunidad({ vistaPrevia: false, area: null }), true);
  assert.equal(ofreceComunidad({ vistaPrevia: true, area: null }), false, 'la vista previa no tiene token: escribiría con nada');
  assert.equal(ofreceComunidad({ vistaPrevia: false, area: 'Ventas' }), false, 'el líder escribiría con el nombre del cliente');
  const portal = sinComentarios(leer('app/compartido/curso/[token]/PortalAlumno.tsx'));
  assert.match(portal, /const conComunidad = ofreceComunidad\(\{ vistaPrevia, area: vista\.area \}\);/);
  assert.match(portal, /if \(conComunidad && pos\.extra === ENTRADA_COMUNIDAD\)/);
  assert.match(portal, /entradasExtra=\{conComunidad \? \[/);
  assert.equal((portal.match(/<ComunidadAlumno\b/g) ?? []).length, 1, 'la comunidad se monta en UN lugar, detrás de la puerta');
});

test('portal: sin pestañas, la descripción rica con la URL de quien mira, «Hecha» por la ruta del progreso, y la disposición', () => {
  const portal = sinComentarios(leer('app/compartido/curso/[token]/PortalAlumno.tsx'));
  assert.doesNotMatch(portal, /pestanas/, 'volvieron las pestañas Tarea / Descripción');
  assert.match(portal, /const partes = partesDelPapel\(c, lider\);/);
  assert.match(portal, /<HtmlSeguro html=\{d\.html\} urlDeAdjunto=\{urlDeAdjunto\} \/>/);
  assert.match(portal, /\? urlsAdjuntos\?\.\[idDeRef\(ref\) \?\? ''\] \?\? null\s*: urlAdjuntoDelAlumno\(token, claseId, ref\)/,
    'el alumno pide cada adjunto con SU token; la vista previa, con la URL firmada del server');
  const mh = entre(portal, 'function MarcarHecha(', 'function PantallaComunidad(');
  assert.match(mh, /if \(previa\) \{ onCambio\(quiero, false\); return; \}/);
  assert.ok(mh.indexOf('if (previa)') < mh.indexOf('fetch(URL_PROGRESO'), 'la vista previa no puede llegar al fetch');
  assert.match(mh, /JSON\.stringify\(\{ t: token, c: claseId, hecha: quiero \}\)/);
  assert.match(mh, /onCambio\(j\.progreso\?\.hecha === true, true\)/, 'se dibuja lo que contestó el server');
  assert.match(portal, /disposicion=\{disposicionDe\(estilo\)\}/);
  // La vista previa trae las URLs de los adjuntos (sin token no hay otra forma de verlos).
  const vista = sinComentarios(leer('app/customer-success/curso/vista/page.tsx'));
  assert.match(vista, /refsEnHtml\(c\.descripcionHtml\)/);
  assert.match(vista, /await urlsAdjuntosEquipo\(refs\)/);
  assert.match(vista, /urlsAdjuntos=\{urlsAdjuntos\}/);
});

// ── Roturas (08/10/2026) ─────────────────────────────────────────────────────
// Sin romper: 18 pass / 0 fail. Arnés scratchpad/leccion/romper.mjs: UNA rotura por vez sobre el
// archivo real, restaurada de MEMORIA (nunca con git) y comprobada con md5; si otra sesión hubiera
// escrito el archivo mientras estaba roto, deshace SÓLO la rotura (el paso EDITOR toca los mismos
// archivos del dibujo). 36 roturas, cada una 17 / 1 con SU test caído:
//   · el video: `lugarDelVideo` mandando un link de afuera al marco
//   · pegar un link: lo que no es http aceptado como link
//   · los minutos sin el «al menos 1» (⚠️ con el fixture de antes, 59 s, pasaba en VERDE: 59/60
//     redondea a 1 solo. Por eso el caso es de 20 s.)
//   · la descripción: el texto plano sin escapar `<` · la clase vieja arrancando VACÍA (sin su texto)
//   · la tarea: `faltaEnFormulario` dejando pasar todo
//   · «Agregar tarea» / «Quitar» / «Cierra el módulo»: ofrecido en un suelto · «Quitar» mandando la
//     instrucción vacía aunque no la haya · la tarea abierta sólo si alguien la tocó
//   · el guardado: «No se pudo guardar el cambio» (más de tres palabras)
//   · la disposición: `claseDelSplit` sin la clase de «abajo»
//   · la hoja: «abajo» con `flex: 1 1 0` (alto cero apiladas) · el recuadro del video sólido · el
//     interruptor de la app sin su fondo
//   · el dibujo: el recuadro sin mirar `sinVideo` · el interruptor para cualquiera, no sólo quien edita
//   · la tab: la tarea ANTES que la descripción · el recuadro de «Agregar video» para quien sólo mira
//     · el formulario a medias mandado igual · «Cierra el módulo» en un suelto · la descripción
//     guardada por tecla (sin el respiro)
//   · la hoja de la lección: una regla sin el acote `.ahdoc.ahdoc--ugc .ugc`
//   · un `onEditar` de vuelta en la lección → «no queda rastro de "Editar"…»
//   · la tab: la disposición fija al costado · las preguntas sin `confirm` (dibujadas adentro del curso)
//   · el portal: «Marcar como hecha» al líder · la tarea antes que la descripción · el chip «Hecha»
//     sin mirar lo que se marcó en la pantalla · «Hecha» en una clase con tarea · la comunidad en la
//     vista previa · `conComunidad` fijo en true · la vista previa llegando al fetch del progreso · la
//     vista previa pidiendo los adjuntos con el token (vacío) del alumno · «Hecha» dibujada sin
//     esperar al server · la disposición fija al costado · la vista previa sin `urlsAdjuntos`
