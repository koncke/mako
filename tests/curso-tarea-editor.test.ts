// =============================================================================
// curso-tarea-editor — el EDITOR DE LA TAREA (pista TAREA, audio del 08/10/2026)
// =============================================================================
// Los items del audio de 26 minutos (docs/feedback-curso-08oct.md) que viven en
// app/customer-success/curso/TareaEditor.tsx, EditorCampos.tsx, arrastre-campos.ts y sus reglas puras
// (tarea-editor-reglas.ts), textuales con su minuto:
//   ·  2 (16:40) «un enmarcado rojo y que diga falta completar la pregunta»
//   ·  5 (21:00) «para eso tengo que ponerlo todo dentro de un contenedor… lo pondría abajo del campo que ya puse»
//   ·  6 (12:30) «cuando se crea la nueva tarea… ya se tienen que crear de manera automática… el primer campo»
//   ·  8 (14:00) «en lugar de salirte opciones multiple choice te sale un cuadro de texto gigante»
//   ·  9 (14:50) «una barra deslizable, no simplemente números… o la típica de estrellas»
//   · 10 (17:30) «no entiendo el campo de lo hice»
//   · 11 (18:00) «sería bueno que sea formateable la descripción de la tarea»
//   · 12 (21:30) «sería bueno que se pueda agregar más de una tarea»
//
// Lo que se EJECUTA: las reglas puras (partir la lista en tareas, crear, quitar, mover entre tareas, dónde
// cae un arrastre, los «Deshacer» que devuelven la MISMA identidad, las opciones como renglones, la escala y
// el selector de tipo). Lo que se LEE del fuente —sin comentarios y con los \r\n normalizados (AGENTS.md: el
// comentario que explica qué se sacó nombra lo que se sacó)—: el contrato del componente, que no guarda nada
// en el server, el arrastre con su tipo propio, los puntos del recorrido y la hoja sin nada que la corte.
//
// ── Roturas (08/10/2026) ─────────────────────────────────────────────────────
// Ver el bloque al final del archivo, con el resultado de cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Campo } from '../lib/curso';
import { tareasDeClase, erroresDeCampos, MAX_TAREAS, sanearCampos } from '../lib/curso';
import { marcasDeVoseo } from '../lib/puestas-data';
import { TIPOS_CAMPO, nuevoIdCampo } from '../app/customer-success/curso/reglas';
import { AVISO_DESHACER } from '../app/customer-success/curso/leccion-reglas';
import {
  QUE_HACE_EL_ALUMNO, campoDelGesto, cambiaAlSoltar, camposDeGrupos, conBloqueDevuelto, conCampoAlFinal, conCampoDevuelto,
  conCampoMovido, conCamposDeTarea, conEstilo, conFila, conFilaNueva, conOtraTarea, conPegado, conPrimeraTarea, conSeccion,
  correctasAlMarcar, correctasTrasQuitar, correctasTrasRenombrar, dondeCae, entraOtraTarea, esSeccion, estiloDe, filasDe,
  gruposDeCampos, hayTarea, htmlDeSeccion, idsNuevos, lugarDe, motivoVisible, opcionesDeTipo, rangosDeEscala, sinFila, sinTarea,
  type BorradorTarea,
} from '../app/customer-success/curso/tarea-editor-reglas';

const RAIZ = join(__dirname, '..');
// Las líneas `//` PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const crudo = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const leer = (rel: string) => sinComentarios(crudo(rel));
const TAREA = 'app/customer-success/curso/TareaEditor.tsx';
const CAMPOS = 'app/customer-success/curso/EditorCampos.tsx';
const ARRASTRE = 'app/customer-success/curso/arrastre-campos.ts';

const c = (id: string, o: Partial<Campo> = {}): Campo => ({ id, label: id.toUpperCase(), tipo: 'texto', ...o });
const s = (id: string, label = `Tarea ${id}`, o: Partial<Campo> = {}): Campo => ({ id, label, tipo: 'seccion', ...o });
const ids = (cs: readonly Campo[]) => cs.map((x) => x.id);
const borrador = (campos: Campo[], tareaHtml = '<p>Haz esto</p>'): BorradorTarea => ({ tareaHtml, campos, porArea: false });

// ── El modelo: una lista plana partida en tareas ─────────────────────────────

test('partir en tareas: los de antes de la primera sección son de la principal, y es la MISMA regla que tareasDeClase', () => {
  const casos: Campo[][] = [
    [c('a'), c('b')],
    [c('a'), s('s1'), c('b'), c('d'), s('s2'), c('e')],
    [s('s1'), c('a')],
    [c('a'), s('s1'), s('s2'), c('b')],
  ];
  for (const campos of casos) {
    const gs = gruposDeCampos(campos);
    // La del modelo (pista MODELO, lib/curso.ts): la misma partición, o el editor dibuja otras tareas que las del alumno.
    const delModelo = tareasDeClase({ tarea: '', tareaHtml: '<p>x</p>', campos });
    assert.deepEqual(gs.map((g) => [g.seccion?.id ?? null, ids(g.campos)]), delModelo.map((t) => [t.id, ids(t.campos)]), JSON.stringify(ids(campos)));
    // Ida y vuelta: los MISMOS objetos (las respuestas cuelgan de su id).
    const vuelta = camposDeGrupos(gs);
    assert.equal(vuelta.length, campos.length);
    vuelta.forEach((x, k) => assert.equal(x, campos[k]));
  }
  assert.deepEqual(gruposDeCampos([]), [{ seccion: null, campos: [] }], 'la principal está siempre, aunque vacía');
  assert.equal(esSeccion(s('x')), true);
  assert.equal(esSeccion(c('x')), false);
});

test('item 6: «Agregar tarea» la crea con su PRIMER campo, una Respuesta de texto con la pregunta vacía', () => {
  const vacia = borrador([], '');
  assert.equal(hayTarea(vacia), false, 'sin descripción ni campos va el «Agregar tarea»');
  const [id] = idsNuevos([], 1, nuevoIdCampo);
  const v = conPrimeraTarea(vacia, id);
  assert.deepEqual(v.campos, [{ id, label: '', tipo: 'texto' }]);
  assert.equal(hayTarea(v), true);
  // Y la pregunta vacía es lo que se pinta en rojo (item 2), con el motivo corto del modelo.
  assert.equal(erroresDeCampos(v.campos)[id], 'Falta la pregunta');
  // «+ Agregar otra tarea»: la sección y su primer campo, con dos ids que no chocan entre sí ni con los de antes.
  const antes = [c('a')];
  const [sId, cId] = idsNuevos(antes, 2, nuevoIdCampo);
  assert.notEqual(sId, cId);
  assert.ok(![sId, cId].includes('a'));
  const otra = conOtraTarea(antes, sId, cId);
  assert.deepEqual(otra.slice(1), [{ id: sId, label: '', tipo: 'seccion' }, { id: cId, label: '', tipo: 'texto' }]);
  assert.equal(erroresDeCampos(otra)[sId], 'Falta el título', 'el título de una tarea es obligatorio');
  // `idsNuevos` aunque el azar repita: cada uno ve a los anteriores.
  let n = 0;
  const repetido = (e: readonly { id: string }[]) => nuevoIdCampo(e, () => (n++ < 3 ? 0.5 : Math.random()));
  const dos = idsNuevos([], 2, repetido);
  assert.notEqual(dos[0], dos[1]);
});

test('item 5: el campo nuevo nace ABAJO del último DE SU TAREA (no arriba de todo, no en la tarea de al lado)', () => {
  const lista = [c('a'), c('b'), s('s1'), c('d'), s('s2')];
  assert.deepEqual(ids(conCampoAlFinal(lista, 0, 'n')), ['a', 'b', 'n', 's1', 'd', 's2'], 'en la principal, antes de la primera sección');
  assert.deepEqual(ids(conCampoAlFinal(lista, 1, 'n')), ['a', 'b', 's1', 'd', 'n', 's2']);
  assert.deepEqual(ids(conCampoAlFinal(lista, 2, 'n')), ['a', 'b', 's1', 'd', 's2', 'n'], 'una sección sin campos recibe el primero');
  assert.deepEqual(conCampoAlFinal(lista, 2, 'n').at(-1), { id: 'n', label: '', tipo: 'texto' });
  assert.deepEqual(ids(conCampoAlFinal(lista, 9, 'n')), ids(lista), 'una tarea que no existe no cambia nada');
  // Los campos de UNA tarea (lo que devuelve su editor) y el título / la descripción de una sección.
  assert.deepEqual(ids(conCamposDeTarea(lista, 1, [c('x'), c('y')])), ['a', 'b', 's1', 'x', 'y', 's2']);
  const t = conSeccion(lista, 1, { label: 'Llamada', descripcionHtml: '<p>Agéndala</p>' });
  assert.deepEqual(t[2], { id: 's1', label: 'Llamada', tipo: 'seccion', descripcionHtml: '<p>Agéndala</p>' });
  assert.equal(conSeccion(lista, 0, { label: 'x' })[0], lista[0], 'la principal no tiene título');
});

test('item 12: «Quitar tarea» se va con sus campos; quitar la primera con otras detrás SUBE la segunda', () => {
  const v = borrador([c('a'), s('s1', 'Agenda <ya>', { descripcionHtml: '<p>Con tu link</p>' }), c('b'), c('d'), s('s2'), c('e')]);
  assert.deepEqual(ids(sinTarea(v, 2).campos), ['a', 's1', 'b', 'd'], 'la tercera, con su campo');
  assert.deepEqual(ids(sinTarea(v, 1).campos), ['a', 's2', 'e']);
  assert.equal(sinTarea(v, 1).tareaHtml, v.tareaHtml, 'quitar una sección no toca la descripción de la primera');
  const sube = sinTarea(v, 0);
  assert.deepEqual(ids(sube.campos), ['b', 'd', 's2', 'e'], 'los campos de la segunda pasan a ser de la primera');
  // El título de la que sube no se pierde: va arriba de su descripción, escapado (el saneo deja pasar h3).
  assert.equal(sube.tareaHtml, '<h3>Agenda &lt;ya&gt;</h3><p>Con tu link</p>');
  assert.equal(htmlDeSeccion({ label: '  ' }), '', 'sin título ni descripción, nada');
  const sola = sinTarea(borrador([c('a'), c('b')]), 0);
  assert.deepEqual(sola, { tareaHtml: '', campos: [], porArea: false });
  assert.equal(hayTarea(sola), false, 'vuelve el «Agregar tarea»');
  assert.equal(sinTarea(v, 7), v, 'una tarea que no existe no cambia nada');
  // El tope del modelo: con MAX_TAREAS, no se ofrece otra.
  const llena = [c('a'), ...Array.from({ length: MAX_TAREAS - 1 }, (_, k) => s(`s${k}`))];
  assert.equal(entraOtraTarea(llena), false);
  assert.equal(entraOtraTarea(llena.slice(0, -1)), true);
});

// ── El arrastre: adentro de su tarea y entre tareas ──────────────────────────

test('mover un campo: en su tarea, a otra tarea (aunque esté vacía), y soltarlo al lado de sí mismo no cambia nada', () => {
  const lista = [c('a'), c('b'), c('d'), s('s1'), c('e'), s('s2')];
  const grupos = gruposDeCampos(lista).map((g) => ids(g.campos));
  // En su tarea: el índice se cuenta sobre la lista que TODAVÍA lo tiene (el origen no se colapsa).
  assert.deepEqual(ids(conCampoMovido(lista, 'a', 0, 3)!), ['b', 'd', 'a', 's1', 'e', 's2']);
  assert.deepEqual(ids(conCampoMovido(lista, 'd', 0, 0)!), ['d', 'a', 'b', 's1', 'e', 's2']);
  assert.equal(conCampoMovido(lista, 'b', 0, 1), null, 'en su lugar');
  assert.equal(conCampoMovido(lista, 'b', 0, 2), null, 'justo después de sí mismo');
  assert.equal(cambiaAlSoltar(grupos, 'b', 0, 1), false);
  assert.equal(cambiaAlSoltar(grupos, 'b', 0, 2), false);
  assert.equal(cambiaAlSoltar(grupos, 'b', 0, 3), true);
  // A otra tarea.
  assert.deepEqual(ids(conCampoMovido(lista, 'b', 1, 0)!), ['a', 'd', 's1', 'b', 'e', 's2']);
  assert.deepEqual(ids(conCampoMovido(lista, 'e', 0, 1)!), ['a', 'e', 'b', 'd', 's1', 's2']);
  assert.deepEqual(ids(conCampoMovido(lista, 'a', 2, 0)!), ['b', 'd', 's1', 'e', 's2', 'a'], 'a una tarea sin campos');
  assert.equal(cambiaAlSoltar(grupos, 'e', 2, 0), true);
  // El MISMO objeto, en el lugar nuevo.
  assert.equal(conCampoMovido(lista, 'b', 1, 0)!.find((x) => x.id === 'b'), lista[1]);
  assert.equal(conCampoMovido(lista, 'zz', 0, 0), null, 'un id que no está');
  assert.equal(conCampoMovido(lista, 's1', 0, 0), null, 'una sección no se arrastra como un campo');
});

test('dónde cae: la tarea bajo el cursor, la más cercana en el aire entre dos, y lejos de todas en ninguna', () => {
  const tareas = [{ y1: 0, y2: 300, medios: [100, 200] }, { y1: 330, y2: 600, medios: [450] }];
  assert.deepEqual(dondeCae(tareas, 50), { g: 0, i: 0 });
  assert.deepEqual(dondeCae(tareas, 150), { g: 0, i: 1 });
  assert.deepEqual(dondeCae(tareas, 290), { g: 0, i: 2 }, 'abajo del último de la primera');
  assert.deepEqual(dondeCae(tareas, 312), { g: 0, i: 2 }, 'en el hueco entre dos tarjetas, la más cercana');
  assert.deepEqual(dondeCae(tareas, 322), { g: 1, i: 0 });
  assert.deepEqual(dondeCae(tareas, 500), { g: 1, i: 1 });
  assert.deepEqual(dondeCae(tareas, 610), { g: 1, i: 1 }, 'un poco abajo de la última');
  assert.equal(dondeCae(tareas, 700), null, 'lejos: no hay hueco que prometa un lugar');
  assert.equal(dondeCae(tareas, -40), null);
  assert.equal(dondeCae([], 10), null);
});

// ── «Deshacer» por onChange: la MISMA identidad, sobre el borrador de AHORA ──

test('deshacer devuelve el MISMO campo a su lugar, no duplica, y respeta lo escrito después', () => {
  const lista = [c('a'), c('b'), s('s1'), c('d'), c('e')];
  const b = lista[1];
  const lugar = lugarDe(lista, 'b');
  assert.deepEqual(lugar, { ancla: 's1', seccion: null });
  const sinB = lista.filter((x) => x.id !== 'b');
  // Mientras tanto se escribió otra cosa: eso se queda.
  const despues = sinB.map((x) => (x.id === 'd' ? { ...x, label: 'Cambiada' } : x));
  const vuelto = conBloqueDevuelto(despues, [b], lugar);
  assert.deepEqual(ids(vuelto), ['a', 'b', 's1', 'd', 'e']);
  assert.equal(vuelto[1], b, 'el MISMO objeto');
  assert.equal(vuelto[3].label, 'Cambiada', 'lo de los cinco segundos no se pierde');
  assert.deepEqual(ids(conBloqueDevuelto(vuelto, [b], lugar)), ids(vuelto), 'deshacer dos veces no lo duplica');
  // El de al lado ya no está: al final de SU tarea.
  const lugarD = lugarDe(lista, 'd');
  assert.deepEqual(lugarD, { ancla: 'e', seccion: 's1' });
  assert.deepEqual(ids(conBloqueDevuelto([c('a'), c('b'), s('s1'), s('s2'), c('x')], [lista[3]], lugarD)), ['a', 'b', 's1', 'd', 's2', 'x']);
  // Una tarea entera (sin `seccion` en el lugar): antes de la que le seguía, o al final.
  const bloque = [s('s9'), c('k')];
  assert.deepEqual(ids(conBloqueDevuelto([c('a'), s('s2')], bloque, { ancla: 's2' })), ['a', 's9', 'k', 's2']);
  assert.deepEqual(ids(conBloqueDevuelto([c('a')], bloque, { ancla: 's2' })), ['a', 's9', 'k']);
  // Cambiar el tipo o quitar una pregunta: vuelve el objeto de antes, por id.
  const quiz = c('q', { tipo: 'quiz', preguntas: [{ id: 'p', texto: '¿?', opciones: ['1', '2'], correctas: ['1'] }] });
  const comoTexto = { ...quiz, tipo: 'texto' as const, preguntas: undefined };
  assert.equal(conCampoDevuelto([c('a'), comoTexto], quiz)[1], quiz);
});

test('qué campo tocó el gesto: el borrado, el que cambió (por referencia) y el que se movió con las flechas', () => {
  const a = c('a'); const b = c('b'); const d = c('d');
  assert.equal(campoDelGesto([a, b, d], [a, d], 'borrado'), b);
  const b2 = { ...b, tipo: 'eleccion' as const };
  assert.equal(campoDelGesto([a, b, d], [a, b2, d], 'tipo'), b, 'el de ANTES, para devolverlo');
  assert.equal(campoDelGesto([a, b, d], [a, b2, d], 'pregunta'), b);
  // Las flechas: devolver el primero que quedó en otro lugar devuelve el orden.
  const subio = campoDelGesto([a, b, d], [a, d, b], 'movido')!;
  const vuelto = conBloqueDevuelto([a, d, b], [subio], lugarDe([a, b, d], subio.id));
  assert.deepEqual(ids(vuelto), ['a', 'b', 'd']);
  const bajo = campoDelGesto([a, b, d], [b, a, d], 'movido')!;
  assert.deepEqual(ids(conBloqueDevuelto([b, a, d], [bajo], lugarDe([a, b, d], bajo.id))), ['a', 'b', 'd']);
  assert.equal(campoDelGesto([a], [a], 'nuevo'), null);
});

test('los avisos de «Deshacer» son de 3-4 palabras (AGENTS.md)', () => {
  for (const t of [AVISO_DESHACER.borrado, AVISO_DESHACER.movido, AVISO_DESHACER.tarea, AVISO_DESHACER.tipo, AVISO_DESHACER.pregunta]) {
    assert.ok(t.split(' ').length <= 4, t);
  }
});

// ── Item 8: las opciones como opciones ───────────────────────────────────────

test('item 8: un renglón por opción; Enter agrega la siguiente; quitar deja al menos uno; pegar varias líneas', () => {
  assert.deepEqual(filasDe(undefined), [''], 'sin opciones, un renglón para escribir la primera');
  assert.deepEqual(conFila(undefined, 0, 'Sí'), ['Sí']);
  assert.deepEqual(conFila(['Sí', 'No'], 1, 'Nunca'), ['Sí', 'Nunca']);
  assert.deepEqual(conFilaNueva(['Sí', 'No'], 0, 30), ['Sí', '', 'No'], 'Enter: el nuevo va DEBAJO del renglón');
  assert.equal(conFilaNueva(['a', 'b'], 1, 2), null, 'con el tope, no entra otro');
  assert.deepEqual(sinFila(['Sí', 'No'], 0), ['No']);
  assert.deepEqual(sinFila(['Sí'], 0), [''], 'el último queda vacío, para escribir');
  const p = conPegado(['Rojo', 'Azul'], 1, 'Az', '', 'ul\nVerde\n\nAmarillo', 30)!;
  assert.deepEqual(p.lista, ['Rojo', 'Azul', 'Verde', 'Amarillo'], 'cada línea una opción; las vacías no');
  assert.equal(p.foco, 3);
  assert.equal(conPegado(['a'], 0, '', '', 'una sola línea', 30), null, 'una línea se pega como siempre');
  // Lo que queda crudo (con renglones vacíos) lo limpia el saneo al guardar.
  assert.deepEqual(sanearCampos([{ id: 'e', label: '¿Cuál?', tipo: 'eleccion', opciones: ['Sí', '', 'No', ''] }])[0].opciones, ['Sí', 'No']);
});

test('item 8: en el quiz la correcta se marca tocando el círculo, y SIGUE a la opción al renombrarla', () => {
  assert.deepEqual(correctasAlMarcar([], 'B', false), ['B']);
  assert.deepEqual(correctasAlMarcar(['A'], 'B', false), ['B'], 'una respuesta: marcar otra desmarca la anterior');
  assert.deepEqual(correctasAlMarcar(['B'], 'B', false), [], 'tocarla de nuevo la desmarca');
  assert.deepEqual(correctasAlMarcar(['A'], 'B', true), ['A', 'B'], 'varias correctas');
  assert.deepEqual(correctasAlMarcar(['A', 'B'], 'A', true), ['B']);
  assert.deepEqual(correctasAlMarcar(['A'], '  ', false), ['A'], 'un renglón vacío no se marca');
  // Renombrar la marcada: la marca la sigue (con un cuadro de texto, renombrar la desmarcaba).
  assert.deepEqual(correctasTrasRenombrar(['París'], ['Roma', 'París'], 1, 'Parí'), ['Parí']);
  assert.deepEqual(correctasTrasRenombrar(['París'], ['Roma', 'París'], 0, 'Romaa'), ['París'], 'renombrar otra no la toca');
  assert.deepEqual(correctasTrasRenombrar(['A'], ['A', 'A'], 0, 'B'), ['A'], 'si otra tiene el mismo texto, se queda con ésa');
  assert.deepEqual(correctasTrasRenombrar(['A'], ['A', 'B'], 0, ''), [], 'vaciada, deja de ser correcta');
  assert.deepEqual(correctasTrasQuitar(['A', 'B'], ['A', 'B', 'C'], 1), ['A']);
  assert.deepEqual(correctasTrasQuitar(['A'], ['A', 'A'], 0), ['A']);
});

// ── Item 9: la escala ────────────────────────────────────────────────────────

test('item 9: «Mostrar como» Números / Deslizador / Estrellas; números no escribe nada y estrellas no tiene 0', () => {
  const e = { min: 0 as const, max: 10 as const, bajo: 'Nada', alto: 'Todo' };
  assert.equal(estiloDe(e), 'numeros', 'ausente = números, lo de siempre');
  assert.equal(estiloDe({ estilo: 'raro' }), 'numeros');
  assert.deepEqual(conEstilo({ ...e, estilo: 'deslizador' }, 'numeros'), e, 'volver a números deja la escala como antes');
  assert.deepEqual(conEstilo(e, 'deslizador'), { ...e, estilo: 'deslizador' });
  assert.deepEqual(conEstilo(e, 'estrellas'), { ...e, min: 1, estilo: 'estrellas' }, 'cero estrellas no se puede marcar');
  assert.ok(!rangosDeEscala('estrellas').some((r) => r.value.startsWith('0')));
  assert.ok(rangosDeEscala('numeros').some((r) => r.value === '0-10'));
  // El saneo del modelo deja pasar el estilo (y lo mismo cuando no está).
  const [g] = sanearCampos([{ id: 'x', label: '¿Cuánto?', tipo: 'escala', escala: conEstilo(e, 'estrellas') }]);
  assert.equal((g.escala as { estilo?: string }).estilo, 'estrellas');
});

// ── Item 10: el selector de tipo dice qué hace el alumno ─────────────────────

test('item 10: cada tipo lleva ícono, nombre y UNA línea corta; el de confirmar se llama como el BOTÓN del alumno; la sección no se ofrece', () => {
  const ops = opcionesDeTipo();
  assert.equal(ops.length, TIPOS_CAMPO.filter((t) => (t.value as string) !== 'seccion').length);
  assert.ok(!ops.some((o) => o.value === 'seccion'), 'una sección no es un tipo de campo: es «Agregar otra tarea»');
  for (const o of ops) {
    const q = QUE_HACE_EL_ALUMNO[o.value as keyof typeof QUE_HACE_EL_ALUMNO];
    assert.ok(q && q.icono.trim() && q.linea.trim(), `sin línea: ${o.value}`);
    assert.ok(o.label.startsWith(q.icono) && o.label.includes(TIPOS_CAMPO.find((t) => t.value === o.value)!.label), o.label);
    assert.equal(o.sub, q.linea);
    assert.ok(q.linea.length <= 40, `línea larga (${q.linea.length}): «${q.linea}»`);
    assert.deepEqual(marcasDeVoseo(q.linea), [], `voseo en «${q.linea}»`);
  }
  // Revisión final del 08/10/2026: la pista del portal cambió «Lo hice» por un BOTÓN «Marcar como hecho»
  // (TareaAlumno) y el editor seguía diciendo «Casilla» y dibujando una: dos nombres para lo mismo.
  assert.match(QUE_HACE_EL_ALUMNO.confirmacion.linea, /^Botón/);
  assert.equal(TIPOS_CAMPO.find((t) => t.value === 'confirmacion')?.label, 'Marcar como hecho');
  const alumno = crudo('app/compartido/curso/[token]/TareaAlumno.tsx');
  assert.match(alumno, /'Marcar como hecho'/, 'el botón del alumno se llama igual que el tipo');
});

test('item 2: el rojo de un campo recién creado espera a que alguien salga de su pregunta', () => {
  const errores = { a: 'Falta la pregunta', b: 'Faltan opciones' };
  assert.equal(motivoVisible(errores, 'a', new Set(['a'])), null);
  assert.equal(motivoVisible(errores, 'a', new Set()), 'Falta la pregunta');
  assert.equal(motivoVisible(errores, 'b', new Set(['a'])), 'Faltan opciones');
  assert.equal(motivoVisible(errores, 'zz', new Set()), null);
});

// ── El fuente: el contrato, el dibujo y lo que no se puede volver a escribir ──

test('el contrato 3: controlado, sin guardar NADA en el server, y lo monta LeccionEditable', () => {
  const t = leer(TAREA);
  assert.match(t, /export type \{ BorradorTarea \} from '\.\/tarea-editor-reglas';/);
  assert.match(crudo('app/customer-success/curso/tarea-editor-reglas.ts'), /export type BorradorTarea = \{ tareaHtml: string; campos: Campo\[\]; porArea: boolean \};/);
  assert.match(t, /export function TareaEditor\(p: \{\s*valor: BorradorTarea;\s*onChange: \(v: BorradorTarea\) => void;[\s\S]*?errores: Record<string, string>;\s*claseId: number;\s*productoId: number;[\s\S]*?ofrecerPorArea: boolean;\s*\}\): JSX\.Element/);
  // Nada de escribir la clase desde acá: lo guarda el botón «Guardar» de quien lo monta.
  for (const f of [TAREA, CAMPOS]) {
    assert.doesNotMatch(leer(f), /guardarLeccionAction|guardarCampoClaseAction|modulos-actions/, `${f} guarda en el server`);
    // Adentro del curso, un Modal o un Confirm se dibujan sin fondo (no se portalean).
    assert.doesNotMatch(leer(f), /useConfirm|<Modal\b|<Confirm\b/, f);
  }
  // Los «Deshacer» revierten por onChange, sobre el borrador de ahora.
  assert.match(t, /show\(texto, \(\) => cambiar\.current\(revertir\(ultimo\.current\)\)\)/);
});

test('item 5 y 11: cada tarea es UNA tarjeta con su título, su descripción con formato (EditorRico) y sus campos adentro', () => {
  const t = leer(TAREA);
  const tarjeta = t.slice(t.indexOf('className="te-tarea"'), t.indexOf('className="te-otra"'));
  assert.ok(tarjeta.length > 400 && tarjeta.length < 4000, `recorte de ${tarjeta.length}`);
  const titulo = tarjeta.indexOf('<TituloDeTarea');
  const desc = tarjeta.indexOf('<EditorRicoPerezoso');
  const campos = tarjeta.indexOf('<EditorCampos');
  assert.ok(titulo > 0 && desc > titulo && campos > desc, 'título, descripción y campos, en ese orden y ADENTRO de la tarjeta');
  assert.match(tarjeta, /valor=\{s \? s\.descripcionHtml \?\? '' : valor\.tareaHtml\}/, 'la de la primera y la de cada sección');
  // A demanda, como todo editor rico de la tab (tests/curso-guardado-manual.test.ts, item 18 del audio).
  assert.doesNotMatch(t, /from '@\/app\/_ui\/EditorRico'/);
  assert.match(tarjeta, /\{\.\.\.arr\.grupo\(g\)\}/, 'la tarjeta entera recibe campos (el arrastre entre tareas)');
  assert.match(t, /<section className=\{`ec te\$\{arr\.mano \? ' is-arrastrando' : ''\}`\} aria-label="Tarea" \{\.\.\.arr\.zona\}>/);
  // Item 12: «+ Agregar otra tarea» con su tope, y «Quitar tarea» en cada una.
  assert.match(t, /\{entraOtraTarea\(valor\.campos\) && <button type="button" className="te-otra" onClick=\{agregarOtra\}>\+ Agregar otra tarea<\/button>\}/);
  assert.match(tarjeta, /onClick=\{\(\) => quitar\(g\)\}>Quitar tarea</);
  // Item 6: sin tarea, el placeholder la crea con su primer campo.
  assert.match(t, /const agregarPrimera = \(\) => \{\s*const \[id\] = idsNuevos\(valor\.campos, 1, nuevoIdCampo\);\s*onChange\(conPrimeraTarea\(valor, id\)\);/);
  assert.match(t, /onClick=\{agregarPrimera\}>\+ Agregar tarea</);
});

test('item 5: «+ Nuevo campo» queda ARRIBA de los campos de cada tarea y el campo nace ABAJO, con el foco en su pregunta', () => {
  const ed = leer(CAMPOS);
  const lista = ed.slice(ed.indexOf('<div className={`ec-lista'), ed.indexOf('function Pregunta('));
  assert.ok(lista.indexOf('className="ec-nuevo"') > 0 && lista.indexOf('className="ec-nuevo"') < lista.indexOf('{campos.map('), 'el botón ANTES de la lista');
  assert.match(ed, /onCampos\(\[\.\.\.campos, campoNuevo\(id\)\], 'nuevo'\);\s*pedirFoco\(id\);/, 'el campo, al FINAL');
  assert.doesNotMatch(ed, /campoNuevoArriba/, 'volvió el campo que nace arriba');
  assert.match(ed, /el\?\.closest\('\.ec-campo'\)\?\.scrollIntoView\(\{ block: 'nearest', behavior: 'smooth' \}\)/, 'al crearlo se trae a la vista');
});

test('item 8: nunca más el cuadro de texto de un renglón por opción; las opciones, el quiz y la tabla son renglones', () => {
  const ed = leer(CAMPOS);
  assert.doesNotMatch(ed, /<Textarea\b/, 'un cuadro de texto grande para las opciones');
  assert.doesNotMatch(ed, /Una opción por renglón|una por renglón/i);
  assert.match(ed, /\{\(c\.tipo === 'eleccion' \|\| c\.tipo === 'checks' \|\| c\.tipo === 'checklist'\) && \(\s*<ListaDeOpciones /);
  assert.match(ed, /<ListaDeOpciones filas=\{p\.opciones\}[\s\S]{0,400}onMarcar=\{\(texto\) => setP\(j, \{ correctas: correctasAlMarcar\(p\.correctas, texto, multiple\) \}\)\}/, 'el quiz marca tocando el círculo');
  assert.match(ed, /<ListaDeOpciones filas=\{c\.columnas\}/);
  // Enter agrega la siguiente; borrar un renglón vacío vuelve al de arriba.
  assert.match(ed, /if \(e\.key === 'Enter'\) \{\s*e\.preventDefault\(\);\s*const n = conFilaNueva\(lista, k, tope\);/);
  assert.match(ed, /e\.key === 'Backspace' && filas\[k\] === '' && filas\.length > 1/);
});

test('item 9 y 10 en la pantalla: «Mostrar como» con los tres estilos, y el selector de tipo con su línea', () => {
  const ed = leer(CAMPOS);
  assert.match(ed, /role="radiogroup" aria-label="Mostrar como"/);
  assert.match(ed, /onClick=\{\(\) => onCambio\(conEstilo\(e, s\.value\)\)\}/);
  assert.match(ed, /options=\{rangosDeEscala\(estilo\)\}/);
  for (const est of ['numeros', 'deslizador', 'estrellas']) assert.match(ed, new RegExp(`estilo === '${est}'`), est);
  assert.match(ed, /const OPCIONES_TIPO = opcionesDeTipo\(\);/);
  assert.match(ed, /<Select value=\{c\.tipo\} width=\{\d+\} ariaLabel="Tipo de campo" disabled=\{deshabilitado\} options=\{OPCIONES_TIPO\}/);
});

test('item 2 en la pantalla: la tarjeta en rojo con su motivo debajo de la pregunta; la descripción de la primera también', () => {
  const ed = leer(CAMPOS);
  assert.match(ed, /const motivo = motivoVisible\(errores, c\.id, silenciados\);/);
  assert.match(ed, /\$\{motivo \? ' ec-campo--error' : ''\}/);
  const tarjeta = ed.slice(ed.indexOf('<Pregunta valor={c.label}'), ed.indexOf('className="ec-cuerpo"'));
  assert.match(tarjeta, /\{motivo && <p className="ec-motivo" role="alert">\{motivo\}<\/p>\}/, 'el motivo, debajo de la pregunta');
  // Lo que busca la lección para llevar la vista al primer error (LeccionEditable, `scrollAlPrimerError`).
  assert.match(ed, /data-error=\{motivo \? '' : undefined\}/);
  const t = leer(TAREA);
  assert.match(t, /const motivoTarea = errores\.tarea \|\| null;/);
  assert.match(t, /\{g === 0 && motivoTarea && <p className="ec-motivo" role="alert">\{motivoTarea\}<\/p>\}/);
  assert.match(t, /const motivoTitulo = s \? motivoVisible\(errores, s\.id, silenciados\) : null;/);
  assert.match(crudo('app/customer-success/curso/EditorCampos.tsx'), /\.ec \.ec-campo\.ec-campo--error\{ border-color:#b3261e;/);
});

test('el arrastre: un tipo propio (no text/plain, que ProseMirror inserta en la descripción) y el editor rico sin puntero', () => {
  const arr = leer(ARRASTRE);
  assert.match(arr, /e\.dataTransfer\.setData\(MIME_CAMPO, id\);/);
  assert.doesNotMatch(arr, /setData\('text\/plain'/);
  assert.match(arr, /export const MIME_CAMPO = 'application\/x-mako-campo';/);
  assert.match(crudo(TAREA), /\.ec\.is-arrastrando \.te-desc\{ pointer-events:none; \}/);
  // Decide lo puro, con test: dónde cae y si cambia algo (el hueco no se abre al lado de sí mismo).
  assert.match(arr, /const d = dondeCae\(m\.tareas, e\.clientY \+ desplazamiento\(m\.sc\)\);\s*ponerHueco\(d && cambiaAlSoltar\(datos\.current\.grupos, id, d\.g, d\.i\) \? d : null\);/);
  assert.match(arr, /onDragEnter: \(e: ReactDragEvent<HTMLElement>\) => \{ if \(manoRef\.current\) e\.preventDefault\(\); \}/, 'el dragenter aceptado');
  assert.match(arr, /if \(medida\.current\) return medida\.current;/, 'una medida por gesto');
  // La tarea entera arrastra entre tareas: TareaEditor le da el suyo a cada lista.
  assert.match(leer(TAREA), /arrastre=\{arr\} grupo=\{g\}/);
});

test('el recorrido de la clase: los puntos que señala siguen en la pantalla', () => {
  const t = leer(TAREA);
  const ed = leer(CAMPOS);
  assert.match(t, /data-recorrido="leccion-tarea" onClick=\{agregarPrimera\}/, 'el placeholder');
  assert.match(t, /data-recorrido=\{g === 0 \? 'leccion-tarea' : undefined\}/, 'la tarjeta de la PRIMERA tarea');
  assert.match(ed, /data-recorrido="leccion-nuevo-campo"/);
  assert.match(ed, /data-recorrido=\{i === 0 \? 'leccion-campo' : undefined\}/);
});

test('las hojas: todo acotado a .ec y sin nada que corte el template literal', () => {
  for (const [f, nombre] of [[CAMPOS, 'CSS_TAREA'], [TAREA, 'CSS_TAREA_ENTERA']] as const) {
    const src = crudo(f);
    const ini = src.indexOf(`export const ${nombre} = \``);
    assert.ok(ini > 0, nombre);
    const fin = src.indexOf('`;', ini + 30);
    const css = src.slice(ini + `export const ${nombre} = \``.length, fin).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!css.includes('${'), `${nombre}: una interpolación`);
    assert.ok(css.length > 1500, `${nombre}: la hoja quedó cortada (${css.length})`);
    const selectores = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((p) => p && !p.startsWith('@'))
      .flatMap((p) => p.split(',')).map((p) => p.trim()).filter(Boolean);
    // Con una sola clase, el reset del curso (`.ahdoc button`, `.ahdoc *`) les gana.
    assert.deepEqual(selectores.filter((x) => !/^\.ec[ .]/.test(x)), [], nombre);
  }
});

// ── Roturas (08/10/2026) ─────────────────────────────────────────────────────
// Sin romper: 23 pass / 0 fail. Arnés scratchpad/tarea/romper.mjs: UNA rotura por vez sobre el archivo
// real, restaurada de MEMORIA (nunca con git: el árbol es compartido) y comprobada con md5. Pass / fail:
//   R1  la sección contada como campo (`esSeccion` no la reconoce)          → 18 / 5
//   R2  el campo nuevo nace arriba de su tarea (`conCampoAlFinal`)            → 22 / 1  (item 5)
//   R3  la primera tarea nace con un campo de línea                           → 22 / 1  (item 6)
//   R4  quitar la primera no sube la segunda                                  → 22 / 1  (item 12)
//   R5  el título que sube, sin escapar                                       → 22 / 1
//   R6  soltar al lado de sí mismo «cambia» (`cambiaAlSoltar`)                → 22 / 1
//   R7  a otra tarea, siempre al final                                        → 22 / 1
//   R8  `dondeCae` sin margen                                                 → 22 / 1
//   R9  deshacer duplica                                                      → 21 / 2
//   R10 deshacer devuelve una copia (otro objeto)                             → 22 / 1
//   R11 la correcta no sigue a la opción renombrada                           → 22 / 1  (item 8)
//   R12 una pregunta de una respuesta con dos correctas                       → 22 / 1
//   R13 «Números» se escribe en la escala                                     → 22 / 1  (item 9)
//   R14 estrellas desde 0                                                     → 22 / 1
//   R15 «Lo hice» sin decir que es una casilla                                → 22 / 1  (item 10)
//   R16 el rojo no espera a que se salga de la pregunta                       → 22 / 1  (item 2)
//   R17 una tarea de más que el tope del modelo                               → 22 / 1
//   R18 TareaEditor importa una action que guarda la clase                    → 22 / 1  (contrato 3)
//   R19 la pantalla crea el campo arriba                                      → 22 / 1
//   R20 el arrastre con `text/plain`                                          → 22 / 1
//   R21 sin `pointer-events:none` en la descripción mientras se arrastra      → 22 / 1
//   R22 sin el motivo en rojo debajo de la pregunta                           → 22 / 1
//   R23 `leccion-tarea` en todas las tareas                                   → 22 / 1
//   R24 una regla de la hoja sin acotar a `.ec`                               → 22 / 1
//   R25 el editor rico importado estático                                     → 22 / 1  (y tests/curso-guardado-manual)
//   R26 el «Deshacer» revierte sobre la foto vieja (`valor`) y no la de ahora  → 22 / 1
//   R27 volvió un `<Textarea` para las opciones                               → 22 / 1  (item 8)
//   R28 Enter no agrega la opción siguiente                                   → 22 / 1
// Restaurado: 23 / 0, y el md5 de los cuatro archivos igual al de antes.
// Lo que el arrastre y el foco hacen EN PANTALLA no lo prueba un test de fuente: lo midió el banco
// (scratchpad/tarea/banco/correr.mts y arrastre.mts, Chrome headless con --mute-audio).
