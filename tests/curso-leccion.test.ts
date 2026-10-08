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
// Audio del 08/10/2026 (pista EDITOR): la lección se GUARDA A MANO. `faltaEnFormulario`, `cambiosParaQuitarTarea`,
// `ofreceCierraModulo` y `textoDeGuardado` se fueron con el autoguardado; lo nuevo se prueba en
// tests/curso-guardado-manual.test.ts, y acá queda lo que sigue valiendo.
import {
  htmlDeTexto, htmlInicialDeDescripcion, linkDeVideo, lugarDelVideo, minutosDeDuracion, ofreceObligatoria, tareaAbierta, textoDeBarra,
} from '../app/customer-success/curso/leccion-reglas';
import { OPCIONES_DISPOSICION, claseDelSplit } from '../app/_cursos/reglas';
import { CSS_UGC } from '../app/_cursos/estilos';
import {
  ENTRADA_COMUNIDAD, chipsDeClase, descripcionDeClase, ofreceComunidad, partesDelPapel,
} from '../app/compartido/curso/[token]/modelo-ugc';
// Los ajustes del 08/10/2026 (pista LECCIÓN, items 9, 11, 12, 13, 18 y 20).
import {
  AVISO_DESHACER, AYUDA_OBLIGATORIA, AYUDA_POR_AREA, ROTULO_OBLIGATORIA, ROTULO_POR_AREA, miniaturaDeClase, oembedDeLoom, ofrecePorArea,
  pierdeAlCambiarTipo, tieneContenido,
} from '../app/customer-success/curso/leccion-reglas';
import { esMiniaturaDeVimeo, reproductorDeClase, tapaDeVideo, vimeoDeMiniatura, RUTA_MINIATURA } from '../lib/curso';
import { chipsDelEditor } from '../app/customer-success/curso/modelo-ugc';

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
  // El `tipo` es lo que el BORRADOR dibuja hasta «Guardar» (audio del 08/10/2026).
  assert.deepEqual(linkDeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    { ok: true, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', tipo: 'youtube', rotulo: 'YouTube' });
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

test('los minutos salen de la duración del video: al menos 1, con el tope de la clase, y sin duración nada', () => {
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

// ⚠️ «UN FORMULARIO A MEDIAS NO SE MANDA» SE FUE (audio del 08/10/2026, item 2): era la mitad del «se me
//    borraron todos los campos» —con un campo sin pregunta no se mandaba NINGUNO, y al salir de la clase se
//    perdían todos—. Lo incompleto ahora se queda en el borrador y se marca POR CAMPO
//    (tests/curso-guardado-manual.test.ts, «item 2»).

test('«Agregar tarea» abre la tarea; «Obligatoria» sólo donde cierra algo (un vinculado, o ya prendida)', () => {
  assert.equal(tareaAbierta({ tarea: '', campos: [] }, false), false, 'sin tarea va el botón punteado');
  assert.equal(tareaAbierta({ tarea: '', campos: [] }, true), true);
  assert.equal(tareaAbierta({ tarea: 'Escribe tu meta', campos: [] }, false), true);
  assert.equal(tareaAbierta({ tarea: '', campos: [campo({})] }, false), true);
  assert.equal(ofreceObligatoria(true, false), true);
  assert.equal(ofreceObligatoria(false, false), false, 'un módulo suelto no es una etapa: la marca no movería a nadie');
});

test('lo que dice la barra de guardar es corto', () => {
  assert.equal(textoDeBarra('limpio'), '');
  assert.equal(textoDeBarra('guardando'), 'Guardando…');
  assert.equal(textoDeBarra('error'), 'No se guardó');
  for (const e of ['sucio', 'guardando', 'guardado', 'error', 'falta'] as const) assert.ok(textoDeBarra(e).split(' ').length <= 3, e);
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
  // Item 13 (08/10/2026): el interruptor va ADENTRO del papel —se lo pasa a la función del papel— y un
  // papel que es un nodo lo lleva arriba suyo (nunca se pierde).
  assert.match(lec, /const papel = typeof l\.papel === 'function' \? l\.papel\(dispo\) : <>\{dispo\}\{l\.papel\}<\/>;/);
  assert.match(lec, /<div className="ugc-pcol">\{papel\}<\/div>/);
  assert.match(lec, /\{l\.video \? \([\s\S]*?\) : l\.sinVideo != null && \(\s*<div className="ugc-vvacio" data-recorrido="leccion-video">\{l\.sinVideo\}<\/div>/,
    'sin video va el recuadro, y SÓLO sin video');
  assert.match(lec, /<div className=\{claseDelSplit\(actual\)\}>/);
  assert.match(lec, /const dispo = edicion\?\.onDisposicion \? \(/, 'el interruptor es de quien edita');
  const titulo = entre(lec, '<div className="ugc-ltitle">', '{l.video ?');
  assert.doesNotMatch(titulo, /ugc-dispo/, 'volvió al lado del título, lejos de lo que mueve');
  const tipos = sinComentarios(leer('app/_cursos/tipos.ts'));
  assert.doesNotMatch(tipos, /pestanas\??:|PestanaUgc|onEditar|\beditar: string/);
  assert.match(tipos, /sinVideo\?: ReactNode;/);
  assert.match(tipos, /papel\?: ReactNode \| \(\(arriba: ReactNode\) => ReactNode\);/);
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

test('la tab: la descripción PRIMERO y la tarea debajo, y lo que se edita va al BORRADOR (se guarda con «Guardar»)', () => {
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  const papel = entre(le, 'function PapelDelEditor(', 'export function precargarLeccion');
  assert.ok(papel.indexOf('<DescripcionEditable') > 0 && papel.indexOf('<TareaEditor ') > papel.indexOf('<DescripcionEditable'),
    'la descripción va PRIMERO y la tarea debajo (item 14)');
  assert.ok(papel.indexOf('<DescripcionLectura') < papel.indexOf('<TareaComoLaVeElAlumno'), 'también para quien sólo mira');
  const lec = entre(le, 'export function leccionDelEditor(', 'function useUltimo<');
  assert.doesNotMatch(lec, /pestanas/);
  assert.match(lec, /sinVideo: lugar === 'vacio' && l \? <AgregarVideo/, 'el recuadro de «Agregar video» es de quien edita');
  // El video, SÓLO por link (item 11 del 08/10/2026), y quitarlo: al borrador (audio del 08/10/2026, item 1).
  assert.match(le, /l\.cambiar\(\{ video: videoDeUnLink\(r\.url, r\.tipo\) \}\)/);
  assert.match(le, /l\.cambiar\(\{ video: SIN_VIDEO \}\)/);
  // La descripción: el editor rico con adjuntos, que baja a demanda (item 18) y escribe en el borrador.
  assert.match(le, /<EditorRicoPerezoso [^>]*onCambio=\{\(h\) => l\.cambiar\(\{ descripcionHtml: h \}\)\} subirAdjunto=\{subirAdjunto\}/);
  // La tarea es la de la pista TAREA, CONTROLADA: lo que cambia vuelve al borrador, con los errores marcados.
  assert.match(papel, /<TareaEditor valor=\{\{ tareaHtml: b\.tareaHtml, campos: b\.campos, porArea: b\.porArea \}\}/);
  assert.match(papel, /onChange=\{\(v\) => l\.cambiar\(\{ tareaHtml: v\.tareaHtml, campos: v\.campos, porArea: v\.porArea \}\)\}/);
  assert.match(papel, /errores=\{l\.errores\}/);
  // ⚠️ La ÚNICA caja de la app que define este archivo es la pregunta de salir, y se dibuja AFUERA del curso:
  //    la hoja del curso le saca el fondo y el borde a sus botones (la monta la tab, `{leccionAbierta.dialogo}`).
  assert.doesNotMatch(le, /useConfirm|<Confirm\b/);
  assert.equal((le.match(/<Modal\b/g) ?? []).length, 1);
  assert.ok(le.indexOf('<Modal') > le.indexOf('function PreguntaSalir('), 'el Modal es el de la pregunta de salir');
  assert.equal((le.match(/<PreguntaSalir\b/g) ?? []).length, 1);
  assert.match(le, /const dialogo = pregunta \? \(\s*<PreguntaSalir/);
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  // `textos=` es la última prop de `<CursoUgc … />`: lo que va después está afuera del curso.
  assert.ok(app.indexOf('textos={TEXTOS_EDITOR}') > 0 && app.indexOf('{leccionAbierta.dialogo}') > app.indexOf('textos={TEXTOS_EDITOR}'),
    'la pregunta va afuera del curso');
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
  assert.match(app, /const l = leccionDelEditor\(c, ctx\);/);
  // La disposición se edita en el BORRADOR de la lección y se guarda como ajuste del curso con «Guardar».
  assert.match(app, /disposicion=\{leccionAbierta\.borrador\?\.disposicion \?\? disposicionDe\(estilo\)\}/);
  assert.match(app, /guardarDisposicionRef\.current = \(d\) => guardarAjuste\(\{ tipo: 'disposicion' \}, d === 'abajo' \? 'abajo' : null\);/);
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
  // Los de la descripción y, desde el 08/10/2026, los de la consigna de cada tarea (mig 0226 y las `seccion`).
  assert.match(vista, /\[c\.descripcionHtml, \.\.\.htmlsDeTareas\(c\)\]\.flatMap\(\(h\) => refsEnHtml\(h\)\)/);
  assert.match(vista, /await urlsAdjuntosEquipo\(refs\)/);
  assert.match(vista, /urlsAdjuntos=\{urlsAdjuntos\}/);
});

// =============================================================================
// Los ajustes del 08/10/2026 (pista LECCIÓN): items 9, 11, 12, 13, 18 y 20
// =============================================================================

test('item 11: el video SÓLO por link — sin subir archivos, y el recuadro ENTERO es el botón que abre el link', () => {
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  assert.doesNotMatch(le, /type="file"|urlSubidaVideoAction|descartarVideoAction|Subir un archivo|subirConProgreso\(firma/, 'volvió la subida');
  const agregar = entre(le, 'function AgregarVideo(', 'function ControlesDelVideo(');
  assert.match(agregar, /if \(!abierto\) \{\s*return \(\s*<button type="button" className="cu-vacio-boton" onClick=/, 'el recuadro entero es un botón');
  assert.match(agregar, />Agregar video</);
  assert.match(agregar, /<FormLink v=\{v\}/, 'el clic abre el campo del link ahí mismo');
  // Los subidos de antes se siguen viendo (el link firmado de vida corta).
  assert.match(le, /urlVerVideoAction\(path\)/);
  // La puerta de la subida se cerró: una action sin pantalla es un POST abierto.
  const acc = sinComentarios(leer('app/customer-success/curso/actions.ts'));
  assert.doesNotMatch(acc, /export async function (urlSubidaVideoAction|descartarVideoAction)/);
  // El recuadro (`.ugc-vvacio`) es la caja de posición del botón que lo llena.
  const css = le.slice(le.indexOf('export const CSS_LECCION'));
  assert.match(css, /\.cu-vacio-boton \{\s*position: absolute; inset: 0;/);
});

test('item 12: sin «Concepto» ni minutos a mano; los minutos salen SOLOS del reproductor (o del oEmbed de Loom)', () => {
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  assert.doesNotMatch(le, /TipoDeLaClase|MinutosDeLaClase|TIPOS_CLASE|rotuloTipo|type="number"/, 'volvió el tipo o los minutos a mano');
  assert.match(le, /onDuracion=\{alDurar\}/);
  const auto = entre(le, 'function useMinutosDelVideo(', 'function VideoDeClase(');
  assert.match(auto, /if \(!ctxRef\.current\.puedeEditar \|\| min == null\) return;/, 'sólo quien edita');
  // Una vez por video, y sólo el GUARDADO (audio del 08/10/2026): los de un video del borrador van con «Guardar».
  assert.match(auto, /if \(clave !== claveGuardada \|\| hecho\.current === clave\) return;/);
  assert.match(auto, /if \(min === minutos\) return;/, 'sin escribir lo que ya está');
  assert.match(auto, /guardarCampoClaseAction\(id, \{ minutos: min \}\)/);
  // El reproductor dice la duración sin play: YouTube al estar listo, Vimeo por su API, un archivo al cargar.
  const rep = sinComentarios(leer('app/compartido/curso/[token]/Reproductor.tsx'));
  assert.match(rep, /onReady: decirDuracion,/);
  assert.match(rep, /player\.getDuration\?\.\(\)\.then\(\(d\) => \{ if \(vivo && duracionOk\(d\)\) durRef\.current\?\.\(d\); \}\)/);
  assert.match(rep, /if \(v && duracionOk\(v\.duration\)\) onDuracion\?\.\(v\.duration\);/);
  // Loom: su oEmbed (que trae `duration`). Drive no tiene nada: ahí no hay minutos.
  assert.equal(oembedDeLoom('https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184'),
    'https://www.loom.com/v1/oembed?url=https%3A%2F%2Fwww.loom.com%2Fshare%2F0281766fa2d04bb788eaf19e65135184');
  for (const otro of ['https://drive.google.com/file/d/abc/view', 'https://youtu.be/x', null]) assert.equal(oembedDeLoom(otro), null);
  // Otro video, otros minutos: el server vacía los de antes (eran del video que se fue).
  const adm = sinComentarios(leer('lib/curso-admin.ts'));
  const video = entre(adm, "case 'video': {", "case 'tarea': {");
  assert.match(video, /const mismo = v\.video\.video_tipo === c\.videoTipo && v\.video\.video_url === c\.videoUrl && v\.video\.video_path === c\.videoPath;\s*if \(!mismo\) fila\.minutos = null;/);
  // Y el guardado de la lección (audio del 08/10/2026): otro video, los minutos que midió el reproductor, o vacíos.
  const lec = entre(adm, 'export async function guardarLeccion(', 'export async function claseEsDelProducto(');
  assert.match(lec, /if \(!mismo\) \{\s*const m = hay\('minutos'\) && cambios\.minutos !== null \? Number\(cambios\.minutos\) : null;/);
  // La tarjeta: sin el tipo, sólo los minutos.
  const mod = sinComentarios(leer('app/customer-success/curso/modelo-ugc.ts'));
  assert.match(mod, /meta: c\.minutos != null \? `\$\{c\.minutos\} min` : undefined,/);
  assert.doesNotMatch(mod, /rotuloTipo/);
});

test('item 13: «Texto al costado / Texto abajo» va ADENTRO del papel, arriba de la descripción', () => {
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  assert.match(le, /papel: \(arriba\) => <PapelDelEditor c=\{c\} vista=\{vista\} ctx=\{ctx\} l=\{l\} arriba=\{arriba\} \/>/);
  const papel = entre(le, 'function PapelDelEditor(', 'export function precargarLeccion');
  const dispo = papel.indexOf('data-recorrido="leccion-disposicion"');
  assert.ok(dispo > 0 && dispo < papel.indexOf('<DescripcionEditable'), 'arriba de la descripción, adentro del recuadro');
  assert.ok(papel.indexOf('className="ugc-paper cu-papel"') < dispo, 'adentro del recuadro del papel');
});

test('item 9: «Obligatoria para avanzar» dice qué pasa; «Una respuesta por área» sólo si el curso pide áreas', () => {
  for (const r of [ROTULO_OBLIGATORIA, ROTULO_POR_AREA]) assert.ok(r.split(' ').length <= 4, r);
  assert.equal(ROTULO_OBLIGATORIA, 'Obligatoria para avanzar');
  for (const a of [AYUDA_OBLIGATORIA, AYUDA_POR_AREA]) assert.ok(a.length <= 80 && a.endsWith('.'), a);
  assert.equal(ofrecePorArea(false, false), false, 'en un curso sin áreas no cambiaría nada');
  assert.equal(ofrecePorArea(true, false), true);
  assert.equal(ofrecePorArea(false, true), true, 'prendida, se tiene que poder apagar');
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  // «Una respuesta por área» lo dibuja la tarea (./TareaEditor.tsx) y va al borrador; la lección decide si se ofrece.
  assert.match(le, /ofrecerPorArea=\{ofrecePorArea\(ctx\.cursoPideAreas === true, c\.porArea === true \|\| b\.porArea\)\}/);
  assert.doesNotMatch(le, /Cierra el módulo/);
  // «Obligatoria para avanzar» SALIÓ de la tarea (audio del 08/10/2026, item 7): vive en el menú de la clase.
  assert.match(sinComentarios(leer('app/customer-success/curso/MenuCurso.tsx')), /<span className="cu-menu-switch-t">\{ROTULO_OBLIGATORIA\}<\/span>/);
  // La tarjeta dice lo mismo que el interruptor, corto.
  const c = { id: 1, productoId: 1, etapa: 'e', orden: 0, titulo: 'C', descripcion: '', tipo: 'clase', minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: 'Hazlo', campos: [], obligatoria: true } as Clase;
  assert.ok(chipsDelEditor(c, true).some((x) => x.texto === 'Obligatoria'));
  // La tab dice si el curso pide áreas: alguna clase del producto tiene el campo de áreas.
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(app, /cursoPideAreas: delProducto\.some\(\(x\) => x\.campos\.some\(\(f\) => f\.id === CAMPO_AREAS\)\)/);
});

// ⚠️ DESDE EL AUDIO DEL 08/10/2026 (item 1) quitar el video, quitar la tarea, borrar y mover un campo son
//    cambios del BORRADOR: no escriben en el server, así que su «Deshacer» tampoco (no hay nada que
//    revertir allá). Se deshacen con Ctrl+Z, con los botones de la barra o con «Descartar». El aviso de un
//    campo borrado o movido lo da ./TareaEditor.tsx y revierte por `onChange` (contrato (3)).
test('item 18: quitar el video o la tarea, borrar o mover un campo — se deshace en el BORRADOR, sin escribir', () => {
  for (const t of Object.values(AVISO_DESHACER)) assert.ok(t.split(' ').length <= 4, t);
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  assert.doesNotMatch(le, /AVISO_DESHACER|volverTarea|volverCampos|escribir\(/, 'volvió un «Deshacer» que escribe en el server');
  // Quitar un link es un cambio del borrador; un ARCHIVO subido pregunta (al guardar se borra del bucket).
  assert.match(le, /const quitar = \(\) => \{ setError\(null\); l\.cambiar\(\{ video: SIN_VIDEO \}\); \};/);
  assert.match(le, /c\.videoTipo === 'archivo' && !\(await ctx\.confirmar\('El archivo se borra al guardar\.'/);
  // La tab le sigue pasando su toast (`ctx.deshacer`): el contrato de la lección no cambió.
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(app, /deshacer: \(t, f\) => show\(t, f\),/);
});

// Revisión final (08/10/2026). Cambiar el TIPO de un campo arranca lo del tipo nuevo con sus defaults
// (`conTipo`) y «Quitar pregunta» de un quiz borra su texto: los dos se llevaban lo escrito sin preguntar y
// sin «Deshacer». Con algo escrito avisan; con nada (el campo que recién elige su tipo), no.
// Roto (scratchpad/revision/romper.mjs, R26 a R29): el cambio de tipo sin motivo, quitar pregunta sin
// motivo, `tieneContenido` contando el `id` de una pregunta → 25 / 1 cada una, este test; la lección que
// sólo ofrece «Deshacer» para borrar y mover → 25 / 1, el de arriba. Restaurado 26 / 0.
test('item 18: cambiar el tipo de un campo o quitar una pregunta CON algo escrito también se deshace', () => {
  const quiz = campo({ tipo: 'quiz', preguntas: [{ id: 'p1', texto: '¿Cuánto?', opciones: ['1', '2'], correctas: ['1'] }], notaMin: 70, intentos: 0 });
  assert.equal(pierdeAlCambiarTipo(quiz, campo({ tipo: 'texto' })), true, 'un quiz que pasa a texto pierde sus preguntas');
  assert.equal(pierdeAlCambiarTipo(campo({ tipo: 'eleccion', opciones: ['Sí', 'No'] }), campo({ tipo: 'checks', opciones: ['Sí', 'No'] })), false,
    'las opciones pasan entre una opción y varias: no se pierde nada');
  assert.equal(pierdeAlCambiarTipo(campo({ tipo: 'texto', placeholder: 'Ej.: 20 %' }), campo({ tipo: 'eleccion' })), true);
  // Recién creado (o con sólo los defaults del tipo): elegir otro no avisa.
  assert.equal(pierdeAlCambiarTipo(campo({ tipo: 'texto' }), campo({ tipo: 'quiz' })), false);
  const quizVacio = campo({ tipo: 'quiz', preguntas: [{ id: 'p1', texto: '', opciones: [], correctas: [] }], notaMin: 70, intentos: 0 });
  assert.equal(pierdeAlCambiarTipo(quizVacio, campo({ tipo: 'texto' })), false, 'una pregunta vacía no es algo escrito (su id lo pone la pantalla)');
  assert.equal(pierdeAlCambiarTipo(campo({ tipo: 'escala', escala: { min: 1, max: 10, bajo: '', alto: '' } }), campo({ tipo: 'texto' })), false,
    'los extremos de la escala vienen con su default');
  assert.equal(pierdeAlCambiarTipo(campo({ tipo: 'comentar', postId: 12 }), campo({ tipo: 'publicar' })), true, 'el post elegido');
  assert.equal(tieneContenido({ id: 'p1', texto: ' ', opciones: [''], correctas: [] }), false);
  for (const t of [AVISO_DESHACER.tipo, AVISO_DESHACER.pregunta]) assert.ok(t.split(' ').length <= 4, t);
  // El cableado: el formulario avisa con el motivo, y la lección ofrece el «Deshacer» con su aviso.
  const ed = sinComentarios(leer('app/customer-success/curso/EditorCampos.tsx'));
  assert.match(ed, /onCampos\(campos\.map\(\(x, j\) => \(j === i \? n : x\)\), pierdeAlCambiarTipo\(c, n\) \? 'tipo' : undefined\);/);
  assert.match(ed, /onCambio\(\{ preguntas: ps\.filter\(\(_, k\) => k !== j\) \}, tieneContenido\(p\) \? 'pregunta' : undefined\)/);
  assert.match(ed, /onCambio=\{\(parche, motivo\) => cambiar\(i, parche, motivo\)\}/);
});

test('item 20: la miniatura del video es la tapa por default (YouTube, Vimeo, Loom, Drive) y el selector la ofrece', () => {
  const tapa = (o: Partial<Clase>) => tapaDeVideo(reproductorDeClase({ videoTipo: 'ninguno', videoUrl: null, videoPath: null, ...o } as Clase).video);
  assert.equal(tapa({ videoTipo: 'youtube', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(tapa({ videoTipo: 'loom', videoUrl: 'https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184' }),
    'https://cdn.loom.com/sessions/thumbnails/0281766fa2d04bb788eaf19e65135184-00001.jpg');
  assert.equal(tapa({ videoTipo: 'vimeo', videoUrl: 'https://vimeo.com/1084537' }), `${RUTA_MINIATURA}?vimeo=1084537`);
  assert.equal(tapa({ videoTipo: 'vimeo', videoUrl: 'https://vimeo.com/1084537/abc123def' }), `${RUTA_MINIATURA}?vimeo=1084537&h=abc123def`, 'un no listado lleva su hash');
  assert.equal(tapa({ videoTipo: 'drive', videoUrl: 'https://drive.google.com/file/d/AbC_1/view' }), 'https://drive.google.com/thumbnail?id=AbC_1&sz=w800');
  assert.equal(tapa({ videoTipo: 'archivo', videoPath: '1/7/x.mp4' }), null);
  assert.equal(miniaturaDeClase({ videoTipo: 'youtube', videoUrl: 'https://youtu.be/dQw4w9WgXcQ', videoPath: null }), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(miniaturaDeClase(undefined), null);
  // La ruta de Vimeo: sólo un número (y el hash hex), y sólo redirige al CDN de Vimeo (comparando el ORIGEN).
  assert.deepEqual(vimeoDeMiniatura('1084537', null), { id: '1084537', hash: null });
  for (const [id, h] of [['abc', null], ['12/../x', null], ['123', 'zz!'], ['', null]] as const) assert.equal(vimeoDeMiniatura(id, h), null, `${id} ${h}`);
  assert.equal(esMiniaturaDeVimeo('https://i.vimeocdn.com/video/1-abc-d_640?region=us'), 'https://i.vimeocdn.com/video/1-abc-d_640?region=us');
  for (const malo of ['https://i.vimeocdn.com.evil.tld/x', 'https://i.vimeocdn.com@evil.tld/x', 'http://i.vimeocdn.com/x', 'javascript:alert(1)', 42]) {
    assert.equal(esMiniaturaDeVimeo(malo), null, String(malo));
  }
  const ruta = sinComentarios(leer('app/api/compartido/miniatura/route.ts'));
  assert.match(ruta, /const url = esMiniaturaDeVimeo\(j\?\.thumbnail_url\);\s*if \(!url\) return NO\(\);/);
  assert.match(ruta, /fetch\(`https:\/\/vimeo\.com\/api\/oembed\.json\?width=800&url=\$\{encodeURIComponent\(pagina\)\}`/);
  // El selector: «Miniatura del video» primero, y es la del default (elegirla es volver a él).
  const pp = sinComentarios(leer('app/_components/PortadaPicker.tsx'));
  assert.match(pp, /aria-label="Miniatura del video"/);
  assert.match(pp, /className=\{`pp-op pp-op--video\$\{!valor \? ' on' : ''\}`\} onClick=\{\(\) => onElegir\(null\)\}/);
  assert.match(pp, /\{!video && <button type="button" className="pp-quitar"/, 'con la miniatura, «Sin portada» haría lo mismo');
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(app, /video=\{picker\.ajuste\.tipo === 'portada-clase' \? miniaturaDeClase\(porId\.get\(picker\.ajuste\.clase\)\) : undefined\}/);
});

test('el recorrido de la lección: los puntos que señala están en la pantalla (data-recorrido)', () => {
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  const ed = sinComentarios(leer('app/customer-success/curso/EditorCampos.tsx'));
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  // Audio del 08/10/2026: la tarea la dibuja ./TareaEditor.tsx (pista TAREA), «Obligatoria» salió al menú de la
  // clase, y la lección suma la barra de «Guardar».
  for (const id of ['leccion-disposicion', 'leccion-descripcion', 'leccion-guardar']) assert.match(le, new RegExp(`data-recorrido="${id}"`), id);
  assert.doesNotMatch(le, /data-recorrido="leccion-obligatoria"/);
  assert.match(sinComentarios(leer('app/customer-success/curso/TareaEditor.tsx')), /data-recorrido="leccion-tarea"/);
  assert.match(ed, /data-recorrido="leccion-nuevo-campo"/);
  assert.match(ed, /data-recorrido=\{i === 0 \? 'leccion-campo' : undefined\}/, 'el contenedor del PRIMER campo');
  assert.match(ugc, /recorrido="leccion-titulo"/);
  assert.equal((ugc.match(/data-recorrido="leccion-video"/g) ?? []).length, 2, 'el video puesto y el recuadro de «Agregar video»');
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
//
// ── Roturas de los ajustes del 08/10/2026 (pista LECCIÓN, items 9, 11, 12, 13, 18 y 20) ──
// Arnés scratchpad/leccion20/romper.mjs, el mismo método. Base: 25 pass / 0 fail. Cada una, 24 / 1 con
// SU test caído:
//   · un `type="file"` de vuelta · el recuadro de «Agregar video» como `div`        → «item 11…»
//   · los minutos sin el «una vez por video» · YouTube sin `onReady` · el server sin vaciar los minutos
//     del video de antes · la tarjeta con el tipo · `oembedDeLoom` para cualquier link → «item 12…»
//   · la disposición DEBAJO de la descripción                                      → «item 13…»
//   · el papel recibiendo `null` (el interruptor perdido)                          → «el dibujo de la lección…»
//   · «Una respuesta por área» siempre · el chip «Cierra el módulo» de vuelta       → «item 9…»
//   · borrar un campo sin «Deshacer» · deshacer sin GUARDAR · quitar la tarea preguntando otra vez · la tab
//     sin pasar su toast                                                           → «item 18…»
//   · sin la tapa de Loom · el guard de Vimeo con `startsWith` · «Sin portada» con la miniatura · la tab sin
//     pasarle la miniatura al selector                                             → «item 20…»
//   · sin `data-recorrido="leccion-obligatoria"`                                   → «el recorrido de la lección…»
//
// ── Audio del 08/10/2026 (pista EDITOR): la lección se GUARDA A MANO ──────────
// Los tests del autoguardado (el formulario a medias que no se manda, el respiro, los «Deshacer» que
// escribían en el server) se reescribieron sobre el borrador; lo nuevo y sus roturas, con números, en
// tests/curso-guardado-manual.test.ts. Base acá después del cambio: 25 / 0.
