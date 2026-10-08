// =============================================================================
// curso-tareas-secciones — MÁS DE UNA TAREA por clase, la consigna con formato y que nada se pierda al guardar
// =============================================================================
// El audio del 08/10/2026 (la prueba del curso, docs/feedback-curso-08oct.md), en lo que es del MODELO:
//   · item 2 (15:30-16:40): «volví para atrás y se me borraron todos los campos de edición». La causa
//     medida: `sanearCampos` TIRABA en silencio un campo sin la pregunta escrita. Ahora frena
//     `erroresDeCampos` (el editor lo pinta en rojo, el server rechaza ANTES de sanear) y el saneo sólo
//     descarta basura, y la anota.
//   · item 11 (18:00): la consigna de la tarea con formato (`Clase.tareaHtml`, mig 0226).
//   · item 12 (21:30): más de una tarea = un campo `seccion`; los que la siguen son suyos
//     (`tareasDeClase`). TODO lector de `.campos` la tiene que saltear (`camposConRespuesta`), y el
//     guard de abajo barre app/ y lib/ para que un lector nuevo no se olvide.
//   · item 9 (14:50): `Escala.estilo` (deslizador, estrellas).
//
// ⚠️ lib/html-seguro.ts y lib/curso-tarea-html.ts llevan `server-only`, que TIRA fuera de la condición
//    `react-server`: lo del server corre en un HIJO con `--conditions=react-server` (el molde de
//    tests/html-seguro.test.ts) y devuelve JSON.
//
// Probado ROMPIÉNDOLO (08/10/2026), una rotura por vez sobre el archivo real, restaurado desde la copia en
// memoria (scratchpad/modelo/romper.mjs). Con todo en su lugar: 11 pass / 0 fail. Las roturas y lo que
// tumbaron están al pie, en ROTURAS.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  sanearCampos, erroresDeCampos, tareasDeClase, camposConRespuesta, tareaVacia, htmlsDeTareas, tieneTarea,
  respuestaCompleta, sanearValores, seApruebaSola, camposParaAlumno, urlDeAgenda, TOPE_HTML_SECCION, TOPE_CAMPOS, MAX_TAREAS,
  type Campo, type Clase,
} from '../lib/curso';
import { embedDe, claseDeProveedor } from '../lib/embeds';
import { queFalta } from '../app/compartido/curso/[token]/tarea-valores';
import { respuestaDe, gruposPorTarea } from '../app/customer-success/curso-ficha-lectura';
import { validarPropuesta, esProponible } from '../lib/curso-propuesta';
import { conHtmlSaneado, armarModulos, esClaseCerrada, type ClaseVista } from '../lib/curso-portal';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (AGENTS.md: al revés, un `/*` adentro de un `//` se come el código). */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa: 'e1', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});

/** Una clase con DOS tareas: la principal (un campo) y una `seccion` con dos campos. */
const DOS: Campo[] = [
  { id: 'a', label: 'Tu meta', tipo: 'linea', obligatorio: true },
  { id: 's1', label: 'Tu primer anuncio', tipo: 'seccion', descripcionHtml: '<p>Súbelo <strong>hoy</strong></p>' },
  { id: 'b', label: 'El link', tipo: 'link', obligatorio: true },
  { id: 'c', label: '¿Cómo te fue?', tipo: 'texto' },
];

// ── item 2: lo que le falta a un campo, y que el saneo no lo tire ─────────────

test('erroresDeCampos: el motivo corto de cada campo, y la sección sin título', () => {
  assert.deepEqual(erroresDeCampos([]), {});
  assert.deepEqual(erroresDeCampos(null), {});
  assert.deepEqual(erroresDeCampos(DOS), {}, 'una clase bien armada no tiene nada que decir');
  const e = erroresDeCampos([
    { id: 'sin', label: '  ', tipo: 'texto' },
    { id: 'op', label: 'Elige', tipo: 'eleccion', opciones: ['', ' '] },
    { id: 'ex', label: 'Del 1 al 10', tipo: 'escala', escala: { min: 1, max: 10, bajo: 'Nada', alto: '' } },
    { id: 'ag', label: 'Agenda', tipo: 'agenda', url: 'no es un link' },
    { id: 'qz', label: 'Quiz', tipo: 'quiz', preguntas: [{ id: 'p', texto: '¿Sí?', opciones: ['Sí', 'No'], correctas: [] }] },
    { id: 'tb', label: 'Tabla', tipo: 'tabla', columnas: [] },
    { id: 'ck', label: 'Lista', tipo: 'checklist', opciones: [] },
    { id: 'se', label: '', tipo: 'seccion' },
    { id: 'se2', label: 'x'.repeat(141), tipo: 'seccion' },
    { id: 'se3', label: 'Larga', tipo: 'seccion', descripcionHtml: '<p>' + 'a'.repeat(TOPE_HTML_SECCION) + '</p>' },
  ]);
  assert.deepEqual(e, {
    sin: 'Falta la pregunta', op: 'Faltan opciones', ex: 'Faltan los extremos', ag: 'Falta el link',
    qz: 'Falta la respuesta correcta', tb: 'Faltan las columnas', ck: 'Faltan las acciones',
    se: 'Falta el título', se2: 'Título muy largo', se3: 'Texto muy largo',
  });
  // Lo de la lista entera va en `tarea` (no hay un campo donde pintarlo).
  assert.equal(erroresDeCampos('x').tarea, 'Los campos no llegaron.');
  assert.equal(erroresDeCampos([null]).tarea, 'Un campo llegó roto.');
  assert.equal(erroresDeCampos([{ label: 'sin id' }]).tarea, 'Un campo llegó roto.');
  assert.equal(erroresDeCampos(Array.from({ length: TOPE_CAMPOS + 1 }, (_, i) => ({ id: `c${i}`, label: 'P', tipo: 'texto' }))).tarea, `Máximo ${TOPE_CAMPOS} campos.`);
  assert.equal(erroresDeCampos(Array.from({ length: MAX_TAREAS }, (_, i) => ({ id: `s${i}`, label: 'T', tipo: 'seccion' }))).tarea, `Máximo ${MAX_TAREAS} tareas.`);
});

test('sanearCampos: un campo SIN PREGUNTA se conserva (lo frena erroresDeCampos), la basura se anota', () => {
  const descartes: string[] = [];
  const s = sanearCampos([{ id: 'a', label: '', tipo: 'texto' }, 'basura', { id: 'b', label: 'Bien', tipo: 'linea' }], { descartes });
  assert.deepEqual(s.map((c) => c.id), ['a', 'b'], 'el campo a medio escribir NO desaparece al guardar');
  assert.equal(s[0].label, '');
  assert.deepEqual(descartes, ['campo 2: no es un campo']);
  // El id repetido NO se tira: el segundo recibe uno nuevo que no choca con ninguno de la lista.
  const rep = sanearCampos([{ id: 'x', label: 'Uno', tipo: 'texto' }, { id: 'x', label: 'Copia', tipo: 'texto' }, { id: 'x-2', label: 'Otro', tipo: 'texto' }]);
  assert.deepEqual(rep.map((c) => [c.id, c.label]), [['x', 'Uno'], ['x-3', 'Copia'], ['x-2', 'Otro']]);
  const muchos: string[] = [];
  sanearCampos(Array.from({ length: TOPE_CAMPOS + 2 }, (_, i) => ({ id: `c${i}`, label: 'P', tipo: 'texto' })), { descartes: muchos });
  assert.deepEqual(muchos, [`2 campos de más (tope ${TOPE_CAMPOS})`], 'lo que pasa del tope se dice, no se tira callado');
});

test('sanearCampos: la sección guarda título y consigna SANEADA; sin saneador la consigna no entra (y se anota)', () => {
  const crudo = [{ id: 's', label: '  Tu anuncio  ', tipo: 'seccion', descripcionHtml: '<p>Hola<script>x</script></p>', opciones: ['no va'], obligatorio: true }];
  const sinSaneador: string[] = [];
  const a = sanearCampos(crudo, { descartes: sinSaneador });
  assert.deepEqual(a, [{ id: 's', label: 'Tu anuncio', tipo: 'seccion' }], 'nada de lo de un campo que se contesta, y nada de HTML sin sanear');
  assert.deepEqual(sinSaneador, ['tarea «Tu anuncio»: consigna sin sanear']);
  const falso = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, '');
  const b = sanearCampos(crudo, { html: falso });
  assert.deepEqual(b, [{ id: 's', label: 'Tu anuncio', tipo: 'seccion', descripcionHtml: '<p>Hola</p>' }]);
  assert.deepEqual(sanearCampos(b, { html: falso }), b, 'idempotente');
  const largo: string[] = [];
  const c = sanearCampos([{ id: 's', label: 'T', tipo: 'seccion', descripcionHtml: 'x' }], { html: () => 'y'.repeat(TOPE_HTML_SECCION + 1), descartes: largo });
  assert.equal(c[0].descripcionHtml, undefined);
  assert.match(largo[0], /consigna de \d+ caracteres/);
});

test('Escala.estilo (item 9): la de siempre sale idéntica; deslizador y estrellas se guardan; estrellas arranca en 1', () => {
  const base = { id: 'e', label: 'Del 1 al 10', tipo: 'escala', escala: { min: 0, max: 10, bajo: 'Nada', alto: 'Mucho' } };
  assert.deepEqual(sanearCampos([base])[0].escala, { min: 0, max: 10, bajo: 'Nada', alto: 'Mucho' }, 'sin `estilo`: una escala guardada antes no cambia');
  assert.deepEqual(sanearCampos([{ ...base, escala: { ...base.escala, estilo: 'numeros' } }])[0].escala, { min: 0, max: 10, bajo: 'Nada', alto: 'Mucho' });
  assert.equal(sanearCampos([{ ...base, escala: { ...base.escala, estilo: 'deslizador' } }])[0].escala?.estilo, 'deslizador');
  const est = sanearCampos([{ ...base, escala: { ...base.escala, max: 5, estilo: 'estrellas' } }])[0].escala!;
  assert.deepEqual(est, { min: 1, max: 5, bajo: 'Nada', alto: 'Mucho', estilo: 'estrellas' }, '«cero estrellas» no se puede marcar');
  assert.equal(sanearCampos([{ ...base, escala: { ...base.escala, estilo: 'otra' } }])[0].escala?.estilo, undefined);
});

test('item 15: el campo «Agendar» acepta el link o el CÓDIGO de una agenda de la lista; un video no', () => {
  const codigo = '<iframe src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abcDEF?gv=true" width="100%" height="600"></iframe>';
  assert.equal(urlDeAgenda('https://calendly.com/fiesta/llamada'), 'https://calendly.com/fiesta/llamada');
  assert.equal(urlDeAgenda(codigo), 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abcDEF?gv=true', 'el código de citas de Google (con el link solo no se inserta)');
  assert.equal(urlDeAgenda('<iframe src="https://www.youtube.com/embed/abc"></iframe>'), null, 'un video no es con qué agendar');
  assert.equal(urlDeAgenda('<iframe src="https://evil.example/x"></iframe>'), null);
  assert.equal(sanearCampos([{ id: 'g', label: 'Agenda', tipo: 'agenda', url: codigo }])[0].url, 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abcDEF?gv=true');
  assert.deepEqual(erroresDeCampos([{ id: 'g', label: 'Agenda', tipo: 'agenda', url: codigo }]), {}, 'pegar el código no es «Falta el link»');
  // Lo que se guarda vuelve a reconocerse como agenda (es lo que embebe la tarea del alumno).
  const e = embedDe(urlDeAgenda(codigo)!);
  assert.equal(e && claseDeProveedor(e.proveedor), 'agenda');
});

// ── item 12: las tareas de una clase ─────────────────────────────────────────

test('tareasDeClase: la principal primero con los de antes, cada sección con los que la siguen', () => {
  const t = tareasDeClase({ tarea: 'Haz esto', tareaHtml: '<p>Haz <strong>esto</strong></p>', campos: DOS });
  assert.deepEqual(t.map((x) => [x.id, x.titulo, x.descripcionHtml, x.campos.map((c) => c.id)]), [
    [null, null, '<p>Haz <strong>esto</strong></p>', ['a']],
    ['s1', 'Tu primer anuncio', '<p>Súbelo <strong>hoy</strong></p>', ['b', 'c']],
  ]);
  // Sin nada antes de la primera sección: la principal va VACÍA (el editor la necesita) y se ve como vacía.
  const sinPrincipal = tareasDeClase({ tarea: '', campos: DOS.slice(1) });
  assert.equal(sinPrincipal.length, 2);
  assert.equal(tareaVacia(sinPrincipal[0]), true);
  assert.equal(tareaVacia(sinPrincipal[0], 'texto de antes de la 0226'), false, 'la consigna en texto cuenta en la principal');
  assert.equal(tareaVacia(sinPrincipal[1]), false);
  assert.deepEqual(tareasDeClase({ tarea: '', campos: [] }), [], 'sin tarea, sin cajas');
  // `tareaHtml` sola es una tarea (una consigna que es sólo una imagen deriva un `tarea` vacío).
  assert.equal(tieneTarea({ tarea: '', tareaHtml: '<p><img src="mako-adjunto:x"></p>', campos: [] }), true);
  assert.deepEqual(camposConRespuesta(DOS).map((c) => c.id), ['a', 'b', 'c']);
  assert.deepEqual(htmlsDeTareas({ tareaHtml: '<p>P</p>', campos: DOS }), ['<p>P</p>', '<p>Súbelo <strong>hoy</strong></p>']);
});

test('los lectores SALTEAN la sección: enviar, sanear, qué falta, aprobarse sola, la ficha y la IA', () => {
  const c = clase(1, { campos: DOS });
  assert.equal(respuestaCompleta(c, { a: 'x' }), false, 'faltan los obligatorios de la SEGUNDA tarea');
  assert.equal(respuestaCompleta(c, { a: 'x', b: 'https://ej.com' }), true, 'la sección no es un obligatorio que falte');
  assert.deepEqual(sanearValores(DOS, { a: 'x', s1: 'intruso', b: 'ej.com/p' }), { a: 'x', b: 'https://ej.com/p' }, 'un valor con el id de la sección es una clave ajena');
  // Una clase con SÓLO secciones (ningún campo que se conteste) es de respuesta libre, como una sin campos.
  const soloSecciones: Campo[] = [{ id: 's', label: 'T', tipo: 'seccion' }];
  assert.deepEqual(sanearValores(soloSecciones, { respuesta: ' hice esto ' }), { respuesta: 'hice esto' });
  assert.equal(respuestaCompleta(clase(2, { campos: soloSecciones }), { respuesta: 'hice esto' }), true);
  assert.deepEqual(queFalta(soloSecciones, {}), { tipo: 'respuesta' });
  assert.deepEqual(queFalta(DOS, { a: 'x' }), { tipo: 'campos', labels: ['El link'] });
  // Un quiz con una sección delante se sigue aprobando solo (la sección no pide revisión).
  const quiz: Campo = { id: 'q', label: 'Quiz', tipo: 'quiz', preguntas: [{ id: 'p', texto: '¿Sí?', opciones: ['Sí', 'No'], correctas: ['Sí'] }] };
  assert.equal(seApruebaSola([{ id: 's', label: 'T', tipo: 'seccion' }, quiz]), true);
  // La ficha: ningún renglón «—» con el título de una tarea; y agrupadas, cada respuesta bajo su tarea.
  const bloques = respuestaDe(DOS, { a: 'meta', b: 'https://ej.com', viejo: 'quedó' });
  assert.deepEqual(bloques.map((b) => b.id), ['a', 'b', 'c', 'viejo']);
  assert.deepEqual(gruposPorTarea(DOS, bloques).map((g) => [g.titulo, g.bloques.map((b) => b.id)]), [
    ['1. Tarea', ['a']], ['2. Tu primer anuncio', ['b', 'c']], [null, ['viejo']],
  ]);
  assert.deepEqual(gruposPorTarea(camposConRespuesta(DOS), bloques).map((g) => g.titulo), [null], 'con una sola tarea, sin títulos');
  // La IA: la sección no se propone, y una clave suya es ajena.
  assert.equal(esProponible({ tipo: 'seccion' }), false);
  const v = validarPropuesta(DOS, { a: 'meta', b: 'https://ej.com' }, { a: 'meta mejor', c: 'bien' });
  assert.equal(v.ok, true);
  assert.equal(validarPropuesta(soloSecciones, { respuesta: 'a' }, { respuesta: 'a mejor' }).ok, true, 'sólo secciones = respuesta libre para la IA');
});

test('al alumno: la sección viaja con su consigna RE-SANEADA, y la tarea con formato también', () => {
  assert.deepEqual(camposParaAlumno(DOS).map((c) => c.tipo), ['linea', 'seccion', 'link', 'texto'], 'las secciones viajan: son lo que se lee');
  const [m] = armarModulos({
    modulos: [{ clave: 'e1', nombre: 'Uno', vinculado: true, n: 1, bloqueo: null }], etapas: [{ key: 'e1', label: 'Uno' }],
    actual: 'e1', clases: [clase(1, { campos: DOS, tareaHtml: '<p>T<script>x</script></p>' })], progreso: new Map(),
  });
  const marca = (h: string) => `[S]${h.replace(/<script[\s\S]*?<\/script>/g, '')}`;
  const [s] = conHtmlSaneado([m], marca);
  const c = s.clases.find((x): x is ClaseVista => !esClaseCerrada(x))!;
  assert.equal(c.tareaHtml, '[S]<p>T</p>');
  assert.equal(c.campos.find((x) => x.tipo === 'seccion')?.descripcionHtml, '[S]<p>Súbelo <strong>hoy</strong></p>');
  // Una consigna que el saneo vacía se va (no viaja `descripcionHtml: ''`).
  const [v] = conHtmlSaneado([m], () => '');
  const cv = v.clases.find((x): x is ClaseVista => !esClaseCerrada(x))!;
  assert.equal('descripcionHtml' in cv.campos.find((x) => x.tipo === 'seccion')!, false);
  assert.equal(cv.tareaHtml, null);
});

// ── El server: sanear con la lista blanca de verdad y derivar `tarea` ─────────

test('el server: la consigna de la sección pasa por sanearHtml, y `tarea` es el TEXTO de `tarea_html`', () => {
  const url = pathToFileURL(join(RAIZ, 'lib/curso-tarea-html.ts')).href;
  const codigo = `
    import { readFileSync } from 'node:fs';
    const m = await import(${JSON.stringify(url)});
    const d = JSON.parse(readFileSync(0, 'utf8'));
    console.log(JSON.stringify({
      campos: m.sanearCamposDelServidor(d.campos),
      tareas: d.tareas.map((h) => m.tareaParaGuardar(h)),
    }));
  `;
  const datos = {
    campos: [
      { id: 's', label: 'Anuncio', tipo: 'seccion', descripcionHtml: '<p onclick="x()">Hola <a href="javascript:alert(1)">y</a><strong>ya</strong></p>' },
      { id: 'q', label: '', tipo: 'texto' },
      42,
    ],
    tareas: ['<p>Haz <strong>esto</strong></p>', '<p></p>', '', null, 7],
  };
  const out = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', timeout: 170_000, input: JSON.stringify(datos), stdio: ['pipe', 'pipe', 'pipe'],
  });
  const linea = out.trim().split('\n').filter((x) => x.startsWith('{')).pop();
  assert.ok(linea, `el hijo no devolvió JSON:\n${out}`);
  const r = JSON.parse(linea) as {
    campos: { campos: Campo[]; descartes: string[] };
    tareas: Array<{ ok: boolean; tareaHtml?: string | null; tarea?: string; error?: string }>;
  };
  const sec = r.campos.campos[0];
  assert.equal(sec.tipo, 'seccion');
  assert.doesNotMatch(sec.descripcionHtml ?? '', /onclick|javascript/i, 'la lista blanca de verdad');
  assert.match(sec.descripcionHtml ?? '', /<strong>ya<\/strong>/);
  assert.equal(r.campos.campos[1].id, 'q', 'el campo sin pregunta llega entero: lo frena erroresDeCampos antes');
  assert.deepEqual(r.campos.descartes, ['campo 3: no es un campo']);
  assert.deepEqual(r.tareas[0], { ok: true, tareaHtml: '<p>Haz <strong>esto</strong></p>', tarea: 'Haz esto' });
  assert.deepEqual(r.tareas[1], { ok: true, tareaHtml: null, tarea: '' }, 'un párrafo vacío es «sin consigna», no HTML vacío');
  assert.deepEqual(r.tareas[2], { ok: true, tareaHtml: null, tarea: '' });
  assert.deepEqual(r.tareas[3], { ok: true, tareaHtml: null, tarea: '' });
  assert.equal(r.tareas[4].ok, false);
  assert.match(r.tareas[4].error ?? '', /^La tarea/);
});

// ── El guard: todo lector de `.campos` saltea la sección ─────────────────────

/**
 * Los SUMIDEROS: funciones que reciben los campos enteros y ya saltean la sección por adentro (lo
 * prueba el test de arriba con datos), o que la cuentan A PROPÓSITO (`tieneTarea`: una sección es una
 * tarea; `htmlsDeTareas`: lee su consigna; `camposParaAlumno`: la manda a dibujar). Pasarles
 * `.campos` es seguro.
 */
const SUMIDEROS = [
  'sanearValores', 'respuestaCompleta', 'respuestaDe', 'camposParaAlumno', 'valoresAprobables', 'validarPropuesta',
  'tieneTarea', 'htmlsDeTareas', 'erroresDeCampos', 'sanearCamposDelServidor', 'validarCamposEntrada', 'gruposPorTarea',
  'camposConRespuesta', 'tareasDeClase', 'gruposDeCampos',
];

/** Lo que el guard no mira, por archivo (y, si hace falta, por lo que dice la línea), con su motivo. */
const EXCEPCIONES: Array<{ archivo: string; contiene?: string; motivo: string }> = [
  { archivo: 'lib/curso.ts', motivo: 'define las reglas (camposConRespuesta, tareasDeClase): las prueba este archivo con datos' },
  { archivo: 'app/customer-success/curso/TareaEditor.tsx', motivo: 'el EDITOR arma la lista con sus secciones a propósito: no lee respuestas' },
  { archivo: 'app/customer-success/curso/tarea-editor-reglas.ts', motivo: 'las reglas del editor de la tarea: agrupan y mueven secciones a propósito' },
  { archivo: 'app/customer-success/curso/leccion-reglas.ts', motivo: 'el borrador de la lección: compara y valida la lista entera (erroresDeCampos)' },
  { archivo: 'app/customer-success/curso/reglas.ts', motivo: 'validarClase (el guardado viejo): valida la lista entera con validarCamposEntrada' },
  { archivo: 'lib/curso-admin.ts', motivo: 'escribe la clase: valida con erroresDeCampos y sanea con sanearCamposDelServidor, no lee respuestas' },
  { archivo: 'lib/curso-programa-nqe.ts', motivo: 'la semilla del programa de Mauricio: escribe campos, no los lee' },
  { archivo: 'app/api/compartido/curso/tarea/route.ts', contiene: 'const campos = r.clase.campos;', motivo: 'la ruta de la tarea: lo que hace con `campos` es por TIPO (quiz, archivo, comunidad) o por los sumideros' },
  { archivo: 'app/compartido/curso/[token]/TareaAlumno.tsx', contiene: 't.campos', motivo: '`t` es una TareaDeClase: ya agrupada por tareasDeClase, sin secciones' },
  { archivo: 'app/customer-success/curso-ficha-lectura.ts', contiene: 't.campos', motivo: '`t` es una TareaDeClase (gruposPorTarea)' },
  { archivo: 'app/customer-success/FichaCurso.tsx', contiene: "!c.tarea.trim() && !c.campos.length", motivo: '«¿pide algo?»: una sección es una tarea, como en tieneTarea' },
  { archivo: 'lib/curso-portal.ts', contiene: 'campos: c.campos.map((x) => {', motivo: 'conHtmlSaneado: re-sanea la consigna de cada sección (la línea de abajo mira el tipo)' },
];

/** ¿Esta línea con `.campos` está bien? (ver las reglas en el test) */
function lineaSegura(l: string): boolean {
  if (/'seccion'/.test(l)) return true;
  if (new RegExp(`\\b(${SUMIDEROS.join('|')})\\(`).test(l)) return true;
  // Buscar UN campo por su id: una sección no tiene valor ni es de un tipo que se conteste.
  if (/\.campos\.(find|some)\(\((\w+)\) => \2\.id ===/.test(l)) return true;
  // La lista positiva de lo que la IA reescribe (`esProponible`): la sección no está.
  if (/\.campos\.(filter|some)\(esProponible\)/.test(l)) return true;
  // TRANSPORTE: la lista entera pasa a otro `campos` (una prop, una fila) y la mira quien la recibe.
  if (/\bcampos(?:=\{|\s*:\s*)(?:Array\.isArray\([\w.?]+\.campos\)\s*\?\s*)?[\w.?]+\.campos\b(?!\.)/.test(l)) return true;
  return false;
}

/** Los archivos .ts/.tsx de una carpeta, del DISCO (no de git: un archivo nuevo sin `git add` también cuenta). */
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = `${dir}/${n}`;
    if (statSync(join(RAIZ, p)).isDirectory()) { if (n !== 'node_modules') out.push(...archivos(p)); continue; }
    if (/\.(ts|tsx)$/.test(n) && !/\.d\.ts$/.test(n)) out.push(p);
  }
  return out;
}

/** Los lectores de `.campos` (sin comentarios) de los archivos que importan el modelo del curso. */
function lectores(): Array<{ archivo: string; n: number; linea: string }> {
  const out: Array<{ archivo: string; n: number; linea: string }> = [];
  for (const archivo of [...archivos('app'), ...archivos('lib')]) {
    const src = sinComentarios(leer(archivo));
    if (!/from '(@\/lib\/curso(-portal)?|\.\/curso(-portal)?|\.\.\/lib\/curso)'/.test(src) && archivo !== 'lib/curso.ts') continue;
    src.split('\n').forEach((linea, i) => {
      // `...campos` (un spread) no lee la propiedad: es la variable.
      if (/[\w\])?]\.campos\b/.test(linea)) out.push({ archivo, n: i + 1, linea: linea.trim() });
    });
  }
  return out;
}

const exceptuada = (x: { archivo: string; linea: string }) =>
  EXCEPCIONES.some((e) => e.archivo === x.archivo && (e.contiene == null || x.linea.includes(e.contiene)));

test('el guard: cada lector de `.campos` en app/ y lib/ pasa por camposConRespuesta (o mira la sección)', () => {
  const todos = lectores();
  assert.ok(todos.length > 20, `el barrido encontró ${todos.length} lecturas: si son tan pocas, está mirando otra cosa`);
  const malos = todos.filter((x) => !exceptuada(x) && !lineaSegura(x.linea)).map((x) => `${x.archivo}:${x.n}: ${x.linea}`);
  assert.deepEqual(malos, [], 'un lector de `.campos` que no saltea la sección (use camposConRespuesta o tareasDeClase)');
  // Cada excepción con `contiene` sigue existiendo: una que ya no calza es un permiso escrito para una lectura futura.
  for (const e of EXCEPCIONES.filter((x) => x.contiene)) {
    assert.ok(todos.some((x) => x.archivo === e.archivo && x.linea.includes(e.contiene!)), `excepción vieja: ${e.archivo} «${e.contiene}»`);
  }
});

test('el guard: sus reglas cazan un lector nuevo (y no dejan pasar `.length`, `.map` ni `.filter` pelados)', () => {
  for (const l of ['const n = c.campos.length;', 'c.campos.map((x) => x.label)', 'const obl = clase.campos.filter((x) => x.obligatorio);', 'for (const x of c.campos) {']) {
    assert.equal(lineaSegura(l), false, l);
  }
  for (const l of ['campos={c.campos}', 'campos: c.campos,', 'sanearValores(clase.campos, raw)', "c.campos.some((x) => x.tipo === 'seccion')", 'r.clase.campos.find((c) => c.id === b.campo)']) {
    assert.equal(lineaSegura(l), true, l);
  }
  // Los sumideros de verdad saltean la sección por ADENTRO (con datos arriba; acá, que la llamada esté).
  const curso = sinComentarios(leer('lib/curso.ts'));
  for (const f of ['export function sanearValores(', 'export function respuestaCompleta(', 'export function seApruebaSola(']) {
    const i = curso.indexOf(f);
    assert.ok(i >= 0, f);
    assert.match(curso.slice(i, curso.indexOf('\n}\n', i)), /camposConRespuesta\(/, f);
  }
});

// ROTURAS (08/10/2026, scratchpad/modelo/romper.mjs: una por vez sobre el archivo real, restaurado de
// memoria y verificado por hash). Sin romper: 11 pass / 0 fail. Cada rotura y lo que tumbó:
//   · respuestaCompleta / sanearValores / seApruebaSola sin camposConRespuesta → 9 / 2 cada una
//     («los lectores SALTEAN la sección» y «sus reglas cazan un lector nuevo»)
//   · sanearCampos vuelve a tirar el campo sin pregunta                       → 9 / 2
//   · sanearCampos tira el id repetido                                        → 10 / 1 (⚠️ la PRIMERA vez dio
//     11 / 0: el repetido sólo lo miraba tests/curso.test.ts; se sumó la aserción acá y se volvió a romper)
//   · sanearCampos descarta sin anotar                                        → 9 / 2
//   · erroresDeCampos sin «Falta la pregunta»                                 → 10 / 1
//   · la sección guarda el HTML sin sanear                                    → 9 / 2
//   · tareasDeClase mete los campos de la sección en la principal             → 9 / 2
//   · estrellas con mínimo 0                                                  → 10 / 1
//   · urlDeAgenda sin el código pegado                                        → 10 / 1
//   · queFalta / respuestaDe / validarPropuesta sin camposConRespuesta        → 10 / 1 cada una
//   · conHtmlSaneado no re-sanea la consigna de la tarea                      → 10 / 1
//   · un lector nuevo `c.campos.length` en un archivo del portal              → 10 / 1 (el guard)
