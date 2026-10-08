// =============================================================================
// curso-guardado-manual — la lección del editor se GUARDA A MANO (audio del 08/10/2026)
// =============================================================================
// docs/feedback-curso-08oct.md, los items de la pista EDITOR:
//   · 1 (14:30): «prefiero que haya un botón que me obligue a guardar de forma manual frente a que
//     simplemente cambie y que se guarde solo, porque siento que esto puede llegar a traer bugs».
//   · 2 (15:30): «volví para atrás y se me borraron todos los campos de edición… un enmarcado rojo y
//     que diga falta completar la pregunta».
//   · 3 (15:40): «que no te permita entrar a la vista del alumno hasta que se actualice todo».
//   · 4 (20:50): «cuando aprieto control Z me deje deshacer».
//   · 7 (13:00): «Obligatoria para avanzar» sale de la tarea y va al menú «…» de la clase.
//   · 18 (10:40): «está tardando mucho en cargar una clase».
//   · 19 (11:00): el video y el texto al costado, alineados arriba.
//
// Lo que se EJECUTA: el borrador puro (app/customer-success/curso/leccion-reglas.ts): qué se manda al
// guardar y con qué base, el rebase, lo que impide guardar, el gesto del Ctrl+Z, la barra y la marca del
// menú. Lo que se LEE del fuente (sin comentarios, con los \r\n normalizados: AGENTS.md): que no quede
// autoguardado, que salir pregunte por los cuatro caminos, que el server rechace y compare antes de
// escribir, y que el editor rico no vuelva al chunk de la página.
//
// PROBADO ROMPIÉNDOLO: la tabla con los números está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Campo, Clase } from '../lib/curso';
import {
  GESTO_MS, MOTIVO_SIN_TAREA, MOTIVO_TAREA_SIN_GUARDAR, borradorDe, cambiosParaGuardar, claseDelBorrador, erroresDelBorrador,
  esGestoNuevo, gestoDe, motivoObligatoria, ofreceObligatoria, partesCambiadas, rebasar, textoDeBarra, videoParaGuardar,
  type BorradorLeccion, type EstadoBarra,
} from '../app/customer-success/curso/leccion-reglas';
import { ERROR_OBLIGATORIA_SIN_TAREA } from '../app/customer-success/curso/reglas';

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

const clase = (o: Partial<Clase> = {}): Clase => ({
  id: 7, productoId: 3, etapa: 'bienvenida', orden: 0, titulo: 'Las reglas', descripcion: 'Uno\n\nDos', tipo: 'clase', minutos: 4,
  videoTipo: 'youtube', videoUrl: 'https://youtu.be/dQw4w9WgXcQ', videoPath: null, tarea: 'Escribe tu meta.', campos: [], obligatoria: false,
  ...o,
} as Clase);
const campo = (o: Partial<Campo>): Campo => ({ id: 'c1', label: 'Tu meta', tipo: 'texto', ...o } as Campo);

// ── El borrador y lo que se manda ─────────────────────────────────────────────

test('abrir una clase vieja (texto plano) no la deja «Sin guardar»: la conversión a párrafos ES la base', () => {
  const c = clase();
  const b = borradorDe(c, 'costado');
  assert.equal(b.descripcionHtml, '<p>Uno</p><p>Dos</p>');
  assert.equal(b.tareaHtml, '<p>Escribe tu meta.</p>');
  assert.deepEqual(partesCambiadas(b, borradorDe(c, 'costado')), []);
  // La rica, si la hay, gana; la disposición es la del curso.
  const r = borradorDe(clase({ descripcionHtml: '<h2>Hola</h2>', tareaHtml: '<p><strong>Hazlo</strong></p>' } as Partial<Clase>), 'abajo');
  assert.equal(r.descripcionHtml, '<h2>Hola</h2>');
  assert.equal(r.tareaHtml, '<p><strong>Hazlo</strong></p>');
  assert.equal(r.disposicion, 'abajo');
});

test('«Guardar» manda SÓLO lo que cambió, con su base al lado; la disposición va aparte (es del curso)', () => {
  const base = borradorDe(clase(), 'costado');
  const b: BorradorLeccion = { ...base, titulo: 'Las reglas del juego', disposicion: 'abajo' };
  const r = cambiosParaGuardar(base, b, () => undefined);
  assert.deepEqual(r.cambios, { titulo: 'Las reglas del juego' });
  assert.deepEqual(r.antes, { titulo: 'Las reglas' }, 'la base de lo que se escribe: con eso el server detecta otra pestaña');
  assert.equal(r.disposicion, 'abajo');
  // Nada de la clase: sólo la disposición.
  const s = cambiosParaGuardar(base, { ...base, disposicion: 'abajo' }, () => undefined);
  assert.equal(s.cambios, null);
  assert.equal(s.disposicion, 'abajo');
  // Sin cambios, nada.
  assert.deepEqual(cambiosParaGuardar(base, base, () => undefined), { cambios: null, antes: {}, disposicion: null });
});

test('el video nuevo viaja con los minutos que ya midió el reproductor; sin medir, sin minutos', () => {
  const base = borradorDe(clase(), 'costado');
  const nuevo = { videoTipo: 'vimeo' as const, videoUrl: 'https://vimeo.com/1084537', videoPath: null };
  const conMin = cambiosParaGuardar(base, { ...base, video: nuevo }, (k) => (k === 'vimeo:https://vimeo.com/1084537' ? 12 : undefined));
  assert.deepEqual(conMin.cambios, { video: { tipo: 'url', url: 'https://vimeo.com/1084537' }, minutos: 12 });
  assert.deepEqual(conMin.antes, { video: { tipo: 'url', url: 'https://youtu.be/dQw4w9WgXcQ' } });
  const sinMin = cambiosParaGuardar(base, { ...base, video: nuevo }, () => undefined);
  assert.equal('minutos' in sinMin.cambios!, false);
  // Quitar el video es `null`; un subido de antes, por su ruta.
  assert.equal(videoParaGuardar({ videoTipo: 'ninguno', videoUrl: null, videoPath: null }), null);
  assert.deepEqual(videoParaGuardar({ videoTipo: 'archivo', videoUrl: null, videoPath: '1/3/x.mp4' }), { tipo: 'archivo', path: '1/3/x.mp4' });
});

test('el rebase: lo que la persona NO tocó toma lo nuevo; lo que tocó se queda (un choque se pisa a sabiendas)', () => {
  const vieja = borradorDe(clase(), 'costado');
  const b: BorradorLeccion = { ...vieja, descripcionHtml: '<p>Lo que escribo</p>' };
  const nueva = borradorDe(clase({ titulo: 'Renombrada desde el menú', descripcion: 'Otra pestaña' }), 'costado');
  const r = rebasar(vieja, b, nueva);
  assert.equal(r.titulo, 'Renombrada desde el menú', 'el título no lo tocó: llega el nuevo');
  assert.equal(r.descripcionHtml, '<p>Lo que escribo</p>', 'la descripción la tocó: se queda la suya');
  // Después de guardar, lo ENVIADO toma lo que devolvió el server (ya saneado) y la lección queda limpia.
  const saneada = { ...nueva, descripcionHtml: '<p>Lo que escribo</p>' };
  assert.deepEqual(partesCambiadas(saneada, rebasar(b, b, saneada)), []);
});

test('la lección dibuja el BORRADOR: el título, el video y la tarea de lo que se está editando', () => {
  const c = clase();
  const b: BorradorLeccion = { ...borradorDe(c, 'costado'), titulo: 'Nuevo', campos: [campo({})], video: { videoTipo: 'ninguno', videoUrl: null, videoPath: null } };
  const v = claseDelBorrador(c, b);
  assert.equal(v.titulo, 'Nuevo');
  assert.equal(v.videoTipo, 'ninguno');
  assert.equal(v.campos.length, 1);
  assert.equal(v.minutos, 4, 'los minutos no se editan: son los guardados');
  assert.equal(v.obligatoria, false);
});

// ── Item 2: lo incompleto se marca, no se pierde ─────────────────────────────

test('item 2: un campo sin pregunta se MARCA con su motivo (por id), y el título vacío también', () => {
  const e = erroresDelBorrador({ titulo: '  ', campos: [campo({ id: 'a', label: '' }), campo({ id: 'b', label: 'Bien' }), campo({ id: 'c', tipo: 'eleccion', opciones: [] })] });
  assert.equal(e.a, 'Falta la pregunta');
  assert.equal(e.b, undefined);
  assert.equal(e.c, 'Faltan opciones');
  assert.equal(e.titulo, 'Falta el título');
  assert.deepEqual(erroresDelBorrador({ titulo: 'Ok', campos: [campo({})] }), {});
  // Los motivos son cortos: se dibujan pegados al campo (AGENTS.md).
  for (const m of Object.values(e)) assert.ok(m.split(' ').length <= 4, m);
});

// ── Item 4: el Ctrl+Z, una entrada por GESTO ─────────────────────────────────

test('item 4: escribir de corrido es UN paso; un hueco, otra parte o un gesto del formulario empiezan otro', () => {
  const a = borradorDe(clase({ campos: [campo({ id: 'p1', label: 'Uno' }), campo({ id: 'p2', label: 'Dos' })] }), 'costado');
  const t1 = gestoDe(a, { ...a, descripcionHtml: '<p>H</p>' })!;
  assert.deepEqual(t1, { clave: 'descripcionHtml', continuo: true });
  assert.equal(esGestoNuevo(null, t1, 0), true, 'el primero apila');
  assert.equal(esGestoNuevo({ clave: 'descripcionHtml', en: 0 }, t1, GESTO_MS - 1), false, 'seguir escribiendo NO apila');
  assert.equal(esGestoNuevo({ clave: 'descripcionHtml', en: 0 }, t1, GESTO_MS + 1), true, 'después de un hueco, sí');
  assert.equal(esGestoNuevo({ clave: 'titulo', en: 0 }, t1, 10), true, 'otra parte, sí');
  // La pregunta de UN campo se escribe de corrido; cambiar de campo es otro gesto.
  const p1 = gestoDe(a, { ...a, campos: [campo({ id: 'p1', label: 'Uno!' }), a.campos[1]] })!;
  assert.deepEqual(p1, { clave: 'campos:p1', continuo: true });
  const p2 = gestoDe(a, { ...a, campos: [a.campos[0], campo({ id: 'p2', label: 'Dos!' })] })!;
  assert.equal(esGestoNuevo({ clave: p1.clave, en: 0 }, p2, 10), true);
  // Agregar, borrar, mover o cambiar el tipo de un campo: un paso por gesto, siempre.
  for (const otro of [
    [...a.campos, campo({ id: 'p3', label: '' })],
    [a.campos[1], a.campos[0]],
    [campo({ id: 'p1', label: 'Uno', tipo: 'linea' }), a.campos[1]],
  ]) {
    const g = gestoDe(a, { ...a, campos: otro })!;
    assert.equal(g.continuo, false, JSON.stringify(otro));
    assert.equal(esGestoNuevo({ clave: g.clave, en: 0 }, g, 1), true);
  }
  assert.equal(gestoDe(a, { ...a, video: { videoTipo: 'ninguno', videoUrl: null, videoPath: null } })!.continuo, false);
  assert.equal(gestoDe(a, a), null, 'sin cambio no hay gesto');
});

// ── La barra y la marca del menú ─────────────────────────────────────────────

test('la barra dice en qué está, corto (y limpia no dice nada)', () => {
  const estados: EstadoBarra[] = ['limpio', 'sucio', 'guardando', 'guardado', 'falta', 'conflicto', 'error'];
  assert.equal(textoDeBarra('limpio'), '');
  assert.equal(textoDeBarra('sucio'), 'Sin guardar');
  assert.equal(textoDeBarra('guardando'), 'Guardando…');
  assert.equal(textoDeBarra('guardado'), 'Guardado');
  assert.equal(textoDeBarra('falta'), 'Completa lo marcado');
  for (const e of estados) assert.ok(textoDeBarra(e).split(' ').length <= 4, e);
});

test('item 7: «Obligatoria para avanzar» en el menú: apagada sin tarea GUARDADA, con su motivo corto', () => {
  assert.equal(motivoObligatoria({ prendida: false, tareaGuardada: true, tareaEnBorrador: true }), null);
  assert.equal(motivoObligatoria({ prendida: true, tareaGuardada: false, tareaEnBorrador: false }), null, 'prendida, siempre se puede apagar');
  assert.equal(motivoObligatoria({ prendida: false, tareaGuardada: false, tareaEnBorrador: false }), MOTIVO_SIN_TAREA);
  assert.equal(motivoObligatoria({ prendida: false, tareaGuardada: false, tareaEnBorrador: true }), MOTIVO_TAREA_SIN_GUARDAR);
  assert.equal(MOTIVO_SIN_TAREA, 'Necesita una tarea.');
  assert.equal(MOTIVO_SIN_TAREA, ERROR_OBLIGATORIA_SIN_TAREA, 'el motivo y el rechazo del server son el MISMO texto');
  assert.equal(ofreceObligatoria(true, false), true);
  assert.equal(ofreceObligatoria(false, false), false, 'un módulo suelto no cierra etapas');
  assert.equal(ofreceObligatoria(false, true), true, 'prendida en un suelto (llegó arrastrada): se tiene que poder apagar');
  // El texto viejo no queda en ningún lado del código (lo que dibuja la pantalla o contesta el server).
  for (const f of ['app/customer-success/curso/reglas.ts', 'lib/curso-admin.ts', 'app/customer-success/curso/LeccionEditable.tsx', 'app/customer-success/curso/MenuCurso.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /Para cerrar la etapa, agrega la tarea/, f);
  }
});

// ── Lo que se LEE del fuente ─────────────────────────────────────────────────

test('item 1: la lección NO se guarda sola — sin timers, y sólo los minutos del video GUARDADO se escriben en el acto', () => {
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  assert.doesNotMatch(le, /RESPIRO_|setTimeout|visibilitychange/, 'volvió el autoguardado (un respiro, o guardar al ocultar la pestaña)');
  // La única escritura suelta: los minutos, y sólo del video que ya está guardado.
  assert.equal((le.match(/guardarCampoClaseAction\(/g) ?? []).length, 1, 'otra escritura suelta de la lección');
  const min = entre(le, 'function useMinutosDelVideo(', 'function VideoDeClase(');
  assert.match(min, /if \(clave !== claveGuardada \|\| hecho\.current === clave\) return;/, 'un video del borrador no escribe minutos solo');
  assert.ok(min.indexOf('medidos?.current.set(clave, min)') < min.indexOf('if (clave !== claveGuardada'), 'los de un video nuevo se anotan para el guardado');
  // «Guardar» escribe el borrador de una vez.
  const g = entre(le, 'const guardar = useCallback(async', 'const pedirSalida');
  assert.match(g, /const errores = erroresDelBorrador\(l\.borrador\);\s*if \(Object\.keys\(errores\)\.length\) \{/);
  assert.ok(g.indexOf('erroresDelBorrador') < g.indexOf('guardarLeccionAction('), 'lo incompleto no se manda');
  assert.match(g, /await guardarLeccionAction\(l\.claseId, cambios, antes\)/);
  // La barra: «Guardar», «Descartar» y su marca para la esquina de avisos (AGENTS.md).
  const barra = entre(le, 'function BarraDeLeccion(', 'function useMinutosDelVideo(');
  assert.match(barra, /data-recorrido="leccion-guardar"/);
  assert.match(barra, /data-esquina-ocupada/);
  assert.match(barra, /\{guardando \? 'Guardando…' : 'Guardar'\}/);
  assert.match(barra, />Descartar</);
  // Quitar el video y quitar la tarea ya no escriben en el server: son del borrador.
  assert.doesNotMatch(le, /guardar\(\{ video: null \}\)|escribir\(/);
});

test('item 1 y 3: salir con cambios pregunta — el hash del curso, un link de la app, la pestaña y la vista del alumno', () => {
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  const hook = entre(le, 'export function useLeccionAbierta(', 'function nuevoEstado(');
  // (1) El dibujo movió el hash (otra clase, el índice, el Atrás): se vuelve ANTES de pintar y se pregunta.
  assert.match(hook, /useLayoutEffect\(\(\) => \{[\s\S]*?if \(!esSucio\(l\)\) return;\s*const destino = pos;\s*const empujo = history\.length > largoHistorial\.current;\s*navegar\(posDelBorrador\.current \?\? \{ clase: l\.claseId \}, 'reemplazar'\);/);
  // «Seguir editando» después de un clic que EMPUJÓ: saca la entrada repetida (si no, el Atrás siguiente no hace nada).
  assert.match(hook, /onSeguirEditando=\{\(\) => \{ if \(pregunta\.empujo\) history\.back\(\); setPregunta\(null\); \}\}/);
  // (2) Un link que saca de la página, en captura y antes de que lo vea el router.
  assert.match(hook, /document\.addEventListener\('click', f, true\)/);
  assert.match(hook, /e\.preventDefault\(\);\s*e\.stopPropagation\(\);/);
  assert.match(hook, /a\.closest\('\[data-guardar-y-ver\]'\) \? 'Guardar y ver' : 'Guardar'/, 'item 3: «Guardar y ver»');
  // (3) Cerrar la pestaña.
  assert.match(hook, /window\.addEventListener\('beforeunload', f\)/);
  // Las tres salidas de la pregunta tienen nombre (AGENTS.md: ningún botón es «Aceptar» a secas).
  const p = entre(le, 'function PreguntaSalir(', 'function BarraDeLeccion(');
  for (const b of ['Seguir editando', 'Descartar']) assert.match(p, new RegExp(`>${b}<`));
  // La tab: la vista del alumno marcada y sin prefetch, cambiar de curso y borrar la clase abierta.
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(app, /<Link className="ugc-btn" href=\{hrefVistaPrevia\(productoId\)\} prefetch=\{false\} data-recorrido="vista-alumno" data-guardar-y-ver>/);
  assert.match(entre(app, 'const cambiarProducto = (id: number) => {', '};'), /leccionAbierta\.pedirSalida\(\(\) => \{/);
  assert.match(entre(app, 'const borrar = async (c: Clase) => {', 'show(\'Clase borrada\''), /leccionAbierta\.soltar\(c\.id\);\s*if \(pos\.clase === c\.id\) navegar/);
  assert.match(app, /\{leccionAbierta\.dialogo\}/);
  // El título y la disposición de la lección abierta van al borrador.
  assert.match(app, /if \(que\.tipo !== 'clase' \|\| leccionAbierta\.claseId !== que\.id\) return guardarTexto\(que, valor\);/);
  assert.match(app, /onDisposicion: estiloError \? undefined : \(d\) => \{ leccionAbierta\.cambiar\(\{ disposicion:/);
  assert.match(app, /disposicion=\{leccionAbierta\.borrador\?\.disposicion \?\? disposicionDe\(estilo\)\}/);
});

test('item 4: el Ctrl+Z es la pila de la casa, llenada en el choke point (`cambiar`), y el del texto gana', () => {
  const le = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  assert.match(le, /usePilaDeshacer<BorradorLeccion>\(l\.aplicarDeshacer\)/);
  const cambiar = entre(le, 'const cambiar = useCallback((parche', 'const descartar');
  assert.match(cambiar, /if \(esGestoNuevo\(ultimoGesto\.current, g, ahora\)\) pila\.current\?\.apilar\(l\.borrador\);/);
  // Todo lo que edita la lección pasa por `cambiar` (nada escribe el borrador por otro lado).
  assert.equal((le.match(/\bl\.cambiar\(/g) ?? []).length >= 4, true);
  // `usePilaDeshacer` deja pasar el Ctrl+Z nativo con el foco en un texto: no se le apaga.
  assert.doesNotMatch(le, /ignoraEnTexto:\s*false/);
});

test('item 2: el server RECHAZA lo incompleto y lo que el saneo tiraría — nunca escribe una lista con menos', () => {
  const adm = sinComentarios(leer('lib/curso-admin.ts'));
  const g = entre(adm, 'export async function guardarLeccion(', 'export async function claseEsDelProducto(');
  const campos = entre(g, "if (hay('campos')) {", "if (hay('porArea')) {");
  assert.ok(campos.indexOf('erroresDeCampos(cambios.campos)') < campos.indexOf('sanearCamposDelServidor('), 'los errores ANTES de sanear');
  assert.match(campos, /if \(s\.descartes\.length\) \{/);
  assert.match(g, /if \(Object\.keys\(errores\)\.length\) return \{ ok: false, error: 'Completa lo marcado\.', errores \};/);
  // Compare-and-set: el contenido contra la base de la pantalla, y el `update` con la versión leída.
  assert.match(g, /if \(choca\) return \{ ok: false, error: 'Cambió en otra pestaña\.', conflicto: true, clase: c \};/);
  assert.match(g, /q = fila0\.version == null \? q\.is\('updated_at', null\) : q\.eq\('updated_at', fila0\.version\);/);
  // La base del server sale de la MISMA función que la de la pantalla (si no, un choque falso por guardado).
  assert.match(g, /const actual = borradorDe\(c, 'costado'\);/);
  // Sin tarea, «Obligatoria» se apaga en la misma escritura.
  assert.match(g, /if \(c\.obligatoria && !tieneTarea\(\{ tarea: tareaFinal, tareaHtml: tareaHtmlFinal, campos: camposFinal \}\)\) fila\.obligatoria = false;/);
  // La action: un admin, y sólo funciones async (es un archivo 'use server').
  const acc = sinComentarios(leer('app/customer-success/curso/modulos-actions.ts'));
  assert.match(acc, /export async function guardarLeccionAction\(claseId: number, cambios: CambiosLeccion, antes: CambiosLeccion\): Promise<ResultadoLeccion> \{\s*try \{\s*const no = await puedeEditar\(\);/);
});

test('item 18: el editor rico baja A DEMANDA — ningún archivo de la tab lo importa estático, y se precarga al pasar por una clase', () => {
  // La tab y todo lo que dibuja la lección: un solo `import` estático de app/_ui/EditorRico lo vuelve a meter en
  // el chunk de la página. Medido con esbuild (splitting + minificado, scratchpad/editor-leccion/medir): el JS
  // inicial de la tab era 856,6 KB con TipTap adentro (HEAD del 08/10); con el editor perezoso en la lección
  // y en la tarea, 422,7 KB, y TipTap en un chunk aparte de 509,9 KB que se pide al pasar por una clase. Con
  // la tarea todavía estática eran 932,3 KB: un solo archivo alcanza para perder todo. Un `import type` no
  // cuenta: se borra al compilar.
  const dirs = ['app/customer-success/curso', 'app/_cursos', 'app/compartido/curso/[token]'];
  const malos: string[] = [];
  const recorrer = (d: string) => {
    for (const n of readdirSync(join(RAIZ, d))) {
      const p = join(RAIZ, d, n);
      if (statSync(p).isDirectory()) { recorrer(relative(RAIZ, p)); continue; }
      if (!/\.tsx?$/.test(n) || n === 'editor-rico-perezoso.tsx') continue;
      const src = sinComentarios(readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
      if (/^import(?!\s+type\b)[^;]*from\s+['"]@\/app\/_ui\/EditorRico['"]/m.test(src)) malos.push(relative(RAIZ, p).replace(/\\/g, '/'));
    }
  };
  for (const d of dirs) recorrer(d);
  assert.deepEqual(malos, [], `importan el editor rico estático (usen EditorRicoPerezoso, ./editor-rico-perezoso.tsx): ${malos.join(', ')}`);
  const per = sinComentarios(leer('app/customer-success/curso/editor-rico-perezoso.tsx'));
  assert.match(per, /import\('@\/app\/_ui\/EditorRico'\)/);
  // Precargado, se dibuja en el MISMO render (sin `lazy`: con él, React retenía el editor ~300 ms aunque el
  // chunk ya estuviera, medido en el banco); si no, una caja del mismo alto mientras baja.
  assert.doesNotMatch(per, /\blazy\(|<Suspense/);
  assert.match(per, /const \[m, setM\] = useState<Modulo \| null>\(modulo\);/);
  assert.match(per, /if \(m\) return <m\.EditorRico \{\.\.\.p\} \/>;/);
  assert.match(per, /className="cu-rico-cargando" style=\{\{ minHeight: \(p\.minAlto \?\? 120\) \+ 44 \}\}/, 'mientras baja, una caja del mismo alto');
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(app, /closest\?\.\('\.ugc-editable\[data-arr\]'\)/);
  assert.match(app, /precargarEditorRico\(\);\s*const c = porId\.get\(Number\(el\.getAttribute\('data-arr'\)\)\);\s*if \(c\) precargarLeccion\(c\);/);
});

test('item 19: con texto al costado el título va ARRIBA de las dos columnas, así el video y el papel arrancan juntos', () => {
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  const lec = entre(ugc, 'function Leccion(', 'const IconoImagen');
  const titulo = lec.indexOf('<div className="ugc-ltitle">');
  const split = lec.indexOf('<div className={claseDelSplit(actual)}>');
  const vcol = lec.indexOf('<div className="ugc-vcol">');
  assert.ok(titulo > 0 && split > titulo && vcol > split, 'el título antes del split, y el video lo primero de su columna');
  assert.ok(lec.indexOf('{l.video ?') > vcol && lec.indexOf('{l.video ?') - vcol < 60, 'nada entre el arranque de la columna y el video');
  // Y el menú «…» de la clase al lado del título (item 7: la obligatoria vive ahí).
  assert.match(lec, /\{opciones && <BotonOpciones t=\{t\} nombre=\{clase\.titulo\} recorrido="menu-clase" onAbrir=\{opciones\} \/>\}/);
});

// Probado rompiéndolo (revisión final, 08/10/2026), una por vez y deshecha: sin el `revalidatePath` → 22 / 2
// (este y el de tests/curso-modulos-actions.test.ts); la disposición DESPUÉS de la clase → 15 / 1; sin el
// aviso de lo que no tiene rojo → 15 / 1.
test('revisión final: «Guardar» revalida el curso (el Atrás), la disposición va ANTES, y lo que no tiene rojo se avisa', () => {
  // El Atrás del navegador REUSA la página bajada (glosario de Next, «Client Cache»): sin revalidar, volver de
  // la Vista del alumno dibujaba la clase de antes de guardar, y el próximo «Guardar» chocaba consigo mismo.
  const acc = sinComentarios(leer('app/customer-success/curso/modulos-actions.ts'));
  const action = entre(acc, 'export async function guardarLeccionAction', '\n}\n');
  assert.match(action, /const r = await guardarLeccion\(Number\(claseId\), cambios, antes\);\s*if \(r\.ok\) revalidatePath\('\/customer-success\/curso'\);\s*return r;/);
  // Esa vuelta trae los ajustes del SERVER (CursoApp resiembra `estilos`): la disposición se guarda ANTES.
  const lec = sinComentarios(leer('app/customer-success/curso/LeccionEditable.tsx'));
  const guardar = entre(lec, 'const guardar = useCallback(', '}, [poner, oRef]);');
  const iDispo = guardar.indexOf('oRef.current.guardarDisposicion(disposicion)');
  const iClase = guardar.indexOf('await guardarLeccionAction(');
  assert.ok(iDispo > 0 && iClase > iDispo, 'la disposición se guarda antes que la clase');
  // El título y la descripción no se pintan en rojo: su motivo va al aviso de la tab.
  assert.match(guardar, /filter\(\(\[k\]\) => k === 'titulo' \|\| k === 'descripcion'\)/);
  assert.match(guardar, /if \(sinLugar\.length\) oRef\.current\.avisar\(sinLugar\.join\(' · '\)\);/);
});

// ── Probado ROMPIÉNDOLO (08/10/2026) ──────────────────────────────────────────
// Arnés scratchpad/editor-leccion/romper.mjs: UNA rotura por vez sobre el archivo real, deshecha
// REEMPLAZANDO DE VUELTA lo que se escribió (cada rotura lleva una marca única: otras pistas editaban los
// mismos archivos), nunca con git. Base de este archivo cuando se rompió: 14 pass / 1 fail — el de «item
// 18», rojo mientras ./TareaEditor.tsx importaba el editor rico estático (la pista TAREA lo pasó al perezoso
// después: hoy 15 / 0). Cada rotura, 13 / 2 (o 12 / 3) con SU test caído:
//   · `rebasar` que se queda siempre con el borrador                              → «el rebase…»
//   · «Guardar» que manda TODAS las partes (12 / 3)                                → «Guardar manda SÓLO…» y «el video nuevo…»
//   · el título vacío sin marcar                                                  → «item 2: un campo sin pregunta…»
//   · todo gesto continuo · el hueco que no corta el gesto                        → «item 4…»
//   · `motivoObligatoria` que siempre deja tocar · vuelve el texto viejo del server → «item 7…»
//   · un timer en `cambiar` · lo incompleto que se manda · los minutos de un video del borrador escritos
//     solos                                                                       → «item 1: la lección NO se guarda sola…»
//   · salir por el hash sin volver · el link atajado en burbuja · sin `beforeunload` · «Seguir editando» que
//     deja la entrada repetida · la vista del alumno sin «Guardar y ver» · cambiar de curso sin preguntar
//                                                                                 → «item 1 y 3: salir con cambios…»
//   · el server que escribe lo que el saneo descarta · el `update` sin la versión leída · sin el
//     compare-and-set del contenido                                               → «item 2: el server RECHAZA…»
//   · el título de vuelta adentro de la columna del video                          → «item 19…»
//   · un `import EditorRico` estático en ./LeccionEditable.tsx                    → «item 18» nombra LeccionEditable.tsx
//     además de TareaEditor.tsx (sigue 14 / 1: el test ya estaba rojo; se leyó el mensaje)
// Y en tests/curso-menu-estructura.test.ts (base 10 / 0): la obligatoria en una sección propia → 8 / 2; el
// interruptor sin su motivo · sin «Deshacer» → 9 / 1. En tests/curso-recorridos.test.ts (base 9 / 0): vuelve
// el paso «Obligatoria» de la tarea → 7 / 2.
