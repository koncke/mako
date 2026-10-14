// =============================================================================
// curso-vista-alumno-0910 — la vista del alumno, lo que pidió el audio del 08/10 a la noche
// =============================================================================
// docs/feedback-curso-08oct-noche.md, puntos 2, 3, 4, 5 y 8 (la prueba de Leandro con su curso):
//   · 2: la escala y las estrellas, CENTRADAS.
//   · 3: el quiz no le decía al alumno si acertó. Ahora cada pregunta lo dice, y con el quiz CERRADO
//        (aprobado, o sin intentos) la respuesta correcta de la que erró.
//   · 4: «hay dos scroll»: con el cursor sobre el papel no se deslizaba. La lección del alumno tiene UN
//        solo scroll (`unSoloScroll`).
//   · 5: la vista previa del equipo y la del alumno tienen que decir LO MISMO del quiz.
//   · 8: ni «Este enlace es personal»: «Este curso es personal. © <el curso>».
//
// Lo que se EJECUTA: app/compartido/curso/[token]/tarea-valores.ts (puro) y lib/curso-portal.ts
// (`armarModulos`, para armar la vista como la arma el server). Lo que se LEE como fuente (sin
// comentarios y con los CRLF normalizados, AGENTS.md): el portal, la tarea, el dibujo y sus estilos, y
// las dos puertas del alumno.
//
// Probado ROMPIÉNDOLO (09/10/2026, scratchpad fb-alumno/romper.cjs: rompe UNA cosa por vez y restaura de
// MEMORIA, nunca con git). Ver el resultado al pie del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanearCampos, camposParaAlumno, corregirEnvio, type Campo, type Clase, type NotaQuiz, type Progreso } from '../lib/curso';
import { armarModulos, type VistaAlumno } from '../lib/curso-portal';
import { estiloVacio } from '../lib/curso-estilo';
import {
  quizCerrado, revisionDeQuiz, conCorrectas, revelarCorrectas, clasesConQuizCerrado, conCorrectasDelEquipo, estadoDeQuiz,
} from '../app/compartido/curso/[token]/tarea-valores';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const crudo = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const leer = (rel: string) => sinComentarios(crudo(rel));
/** Desde `desde` hasta la primera aparición de `hasta` después: el bloque, nunca un número de caracteres. */
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const f = src.indexOf(hasta, i + desde.length);
  assert.ok(f > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, f);
};

// Un quiz como el de Leandro (1 pregunta, nota 70, 2 intentos) y uno de tres preguntas.
const [QUIZ1] = sanearCampos([{
  id: 'q1', label: 'Repaso', tipo: 'quiz', notaMin: 70, intentos: 2,
  preguntas: [{ id: 'pa', texto: 'Color de pelo', opciones: ['blanco', 'rosa', 'naranja'], correctas: ['naranja'] }],
}]);
const [QUIZ3] = sanearCampos([{
  id: 'q3', label: 'Examen', tipo: 'quiz', notaMin: 60, intentos: 2,
  preguntas: [
    { id: 'p1', texto: '¿2 + 2?', opciones: ['3', '4'], correctas: ['4'] },
    { id: 'p2', texto: '¿Pares?', opciones: ['1', '2', '4'], correctas: ['2', '4'], multiple: true },
    { id: 'p3', texto: '¿Capital de Perú?', opciones: ['Lima', 'Quito'], correctas: ['Lima'] },
  ],
}]);
const T = '2026-10-09T12:00:00.000Z';
const nota = (o: Partial<NotaQuiz>): NotaQuiz => ({ nota: 0, aprobado: false, intentos: 1, at: T, ...o });

// ── 3: si acertó, y la correcta sólo con el quiz cerrado ─────────────────────

test('quizCerrado: aprobado, o el tope de intentos usado entero; sin tope no se cierra nunca', () => {
  assert.equal(quizCerrado(QUIZ1, undefined), false, 'sin corregir no está cerrado');
  assert.equal(quizCerrado(QUIZ1, nota({ aprobado: true, nota: 100 })), true);
  assert.equal(quizCerrado(QUIZ1, nota({ intentos: 1 })), false, 'le queda un intento');
  assert.equal(quizCerrado(QUIZ1, nota({ intentos: 2 })), true, 'gastó los dos');
  assert.equal(quizCerrado({ ...QUIZ1, intentos: 0 }, nota({ intentos: 50 })), false, 'sin tope, reprobado sigue abierto');
  // La misma cuenta que «Ya no quedan intentos» y que el server (que con el tope agotado no corrige más).
  for (const n of [nota({ intentos: 1 }), nota({ intentos: 2 }), nota({ intentos: 3 })]) {
    assert.equal(estadoDeQuiz(QUIZ1, n)!.sinIntentos, quizCerrado(QUIZ1, n));
  }
  const agotado = corregirEnvio([QUIZ1], { q1: [['rosa']] }, { q1: nota({ intentos: 2 }) }, T);
  assert.equal(agotado?.tipo, 'sin-intentos', 'el server tampoco lo corrige');
});

test('revisionDeQuiz: cada pregunta dice si acertó; la correcta, SÓLO en la que erró y con el quiz cerrado', () => {
  assert.deepEqual(revisionDeQuiz(QUIZ3, undefined).map((r) => r.bien), [null, null, null], 'sin corregir no se dice nada');
  // Reprobado con un intento por delante: qué erró, sin la correcta (sería darle el examen resuelto).
  const abierto = revisionDeQuiz(QUIZ3, nota({ nota: 33, malas: [1, 2], intentos: 1 }));
  assert.deepEqual(abierto.map((r) => r.bien), [true, false, false]);
  assert.deepEqual(abierto.map((r) => r.correctas), [null, null, null]);
  // Sin intentos: la correcta de lo que erró.
  const agotado = revisionDeQuiz(QUIZ3, nota({ nota: 33, malas: [1, 2], intentos: 2 }));
  assert.deepEqual(agotado.map((r) => r.correctas), [null, ['2', '4'], ['Lima']]);
  // Aprobado con un error (nota 67 con mínimo 60): ya no se vuelve a contestar, así que se le dice.
  const aprobado = revisionDeQuiz(QUIZ3, nota({ nota: 67, aprobado: true, malas: [0], intentos: 1 }));
  assert.deepEqual(aprobado.map((r) => r.bien), [false, true, true]);
  assert.deepEqual(aprobado.map((r) => r.correctas), [['4'], null, null]);
  // Al alumno, con el quiz abierto, las correctas no llegaron: cerrado y sin ellas, no se inventa nada.
  const [delAlumno] = camposParaAlumno([QUIZ3]);
  assert.deepEqual(revisionDeQuiz(delAlumno, nota({ nota: 33, malas: [1, 2], intentos: 2 })).map((r) => r.correctas), [null, null, null]);
  // Una nota vieja sin `malas`: sólo los extremos dicen algo.
  assert.deepEqual(revisionDeQuiz(QUIZ3, nota({ nota: 100, aprobado: true })).map((r) => r.bien), [true, true, true]);
  assert.deepEqual(revisionDeQuiz(QUIZ3, nota({ nota: 0 })).map((r) => r.bien), [false, false, false]);
  assert.deepEqual(revisionDeQuiz(QUIZ3, nota({ nota: 50 })).map((r) => r.bien), [null, null, null]);
});

test('conCorrectas: vuelven por id de campo y de pregunta, sólo a los quizzes elegidos, sin mutar nada', () => {
  const [alumno] = camposParaAlumno([QUIZ3]);
  // La base con las preguntas en OTRO orden: el cruce es por id, no por posición.
  const base: Campo = { ...QUIZ3, preguntas: [...QUIZ3.preguntas!].reverse() };
  const [con] = conCorrectas([alumno], [base]);
  assert.deepEqual(con.preguntas!.map((p) => p.correctas), [['4'], ['2', '4'], ['Lima']]);
  assert.ok(alumno.preguntas!.every((p) => !('correctas' in p)), 'no muta lo que recibe');
  assert.deepEqual(conCorrectas([alumno], [base], () => false), [alumno], 'un quiz no elegido queda como estaba');
  const texto: Campo = { id: 't', label: 'Texto', tipo: 'texto' };
  assert.equal(conCorrectas([texto], [QUIZ3])[0], texto, 'lo que no es un quiz no se toca');
});

// ── 3 y 5: lo que se le manda al alumno, y que la vista previa diga lo mismo ──

const clase = (id: number, campos: Campo[], o: Partial<Clase> = {}): Clase => ({
  id, productoId: 7, etapa: 'e1', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos, obligatoria: false, ...o,
});
const prog = (claseId: number, o: Partial<Progreso> = {}): Progreso => ({
  claseId, segundosMax: 0, duracionSeg: null, pct: 0, vistoAt: null, valores: {}, estado: 'pendiente', enviadaAt: null, ...o,
});
/** La vista del alumno como la arma el server (`armarModulos` → `claseVista`, que saca las correctas). */
const vistaDe = (clases: Clase[], progreso: Map<number, Progreso>): VistaAlumno => ({
  nombre: 'Leandro', area: null,
  productos: [{
    productoId: 7, nombre: 'Fiesta Music', estilo: estiloVacio(),
    modulos: armarModulos({
      modulos: [{ clave: 'e1', nombre: 'Uno', vinculado: true, n: 1, bloqueo: null }],
      etapas: [{ key: 'e1', label: 'Uno' }], actual: 'e1', clases, progreso,
    }),
  }],
});

test('revelarCorrectas: vuelven SÓLO las de un quiz cerrado; las de uno abierto no viajan', () => {
  const cerrada = clase(1, [QUIZ1]);
  const abierta = clase(2, [QUIZ3]);
  const progreso = new Map([
    [1, prog(1, { calificacion: { q1: nota({ intentos: 2, malas: [0] }) } })], // sin intentos: cerrado
    [2, prog(2, { calificacion: { q3: nota({ nota: 33, intentos: 1, malas: [1, 2] }) } })], // le queda uno
  ]);
  const vista = vistaDe([cerrada, abierta], progreso);
  assert.doesNotMatch(JSON.stringify(vista), /correctas/, 'la vista del server sale sin correctas');
  assert.deepEqual(clasesConQuizCerrado(vista), [1], 'sólo la clase del quiz cerrado pide leer la base');
  const base = new Map([[1, cerrada.campos], [2, abierta.campos]]);
  const revelada = revelarCorrectas(vista, (id) => base.get(id));
  const [c1, c2] = revelada.productos[0].modulos[0].clases as Array<{ id: number; campos: Campo[] }>;
  assert.deepEqual(c1.campos[0].preguntas!.map((p) => p.correctas), [['naranja']]);
  assert.doesNotMatch(JSON.stringify(c2), /correctas/, 'el quiz que todavía se puede contestar no lleva las correctas');
  assert.doesNotMatch(JSON.stringify(vista), /correctas/, 'no muta la vista que recibe');
  // Sin la base (la lectura falló), la vista sale como estaba.
  assert.doesNotMatch(JSON.stringify(revelarCorrectas(vista, () => undefined)), /correctas/);
});

test('revelarCorrectas: una clase POR ÁREA no las revela (la nota es de cada área, los campos de la clase)', () => {
  const comun = vistaDe([clase(3, [QUIZ1])], new Map([[3, prog(3, { calificacion: { q1: nota({ aprobado: true, nota: 100, malas: [] }) } })]]));
  assert.deepEqual(clasesConQuizCerrado(comun), [3], 'la misma clase, contestada una vez, sí');
  // La misma clase con sus áreas (`ClaseVista.areas`): se la marca por área a mano.
  const m = comun.productos[0].modulos[0];
  const porArea: VistaAlumno = { ...comun, productos: [{ ...comun.productos[0], modulos: [{ ...m, clases: m.clases.map((c) => ({ ...c, areas: [] })) }] }] };
  assert.deepEqual(clasesConQuizCerrado(porArea), []);
  assert.doesNotMatch(JSON.stringify(revelarCorrectas(porArea, () => [QUIZ1])), /correctas/);
});

test('5: la vista previa del EQUIPO lleva TODAS las correctas (para corregir como el server), abierto o no', () => {
  const abierta = clase(2, [QUIZ3]);
  const vista = vistaDe([abierta], new Map()); // sin alumno: nadie contestó nada
  const conEquipo = conCorrectasDelEquipo(vista, [abierta]);
  const [c] = conEquipo.productos[0].modulos[0].clases as Array<{ campos: Campo[] }>;
  assert.deepEqual(c.campos[0].preguntas!.map((p) => p.correctas), [['4'], ['2', '4'], ['Lima']]);
  assert.doesNotMatch(JSON.stringify(vista), /correctas/, 'no muta la vista que recibe');
  // Con ellas, la nota que pone la vista previa es la del server.
  const v = { q3: [['4'], ['2'], ['Quito']] };
  assert.deepEqual(corregirEnvio(c.campos, v, null, T), corregirEnvio([QUIZ3], v, null, T));
});

test('5: la vista previa (con TODAS las correctas) y el alumno (con las del quiz cerrado) dicen LO MISMO', () => {
  // La vista previa corrige en local con las correctas puestas de vuelta (`conCorrectas` sin filtro); al
  // alumno le llegan con el quiz cerrado. Pregunta por pregunta, en cada estado, tiene que dar igual.
  const [delAlumno] = camposParaAlumno([QUIZ3]);
  const [deLaPrevia] = conCorrectas([delAlumno], [QUIZ3]);
  const estados = [
    undefined,
    nota({ nota: 33, malas: [1, 2], intentos: 1 }),
    nota({ nota: 33, malas: [1, 2], intentos: 2 }),
    nota({ nota: 67, aprobado: true, malas: [0], intentos: 1 }),
    nota({ nota: 100, aprobado: true, malas: [], intentos: 2 }),
  ];
  for (const n of estados) {
    const alAlumno = quizCerrado(delAlumno, n) ? conCorrectas([delAlumno], [QUIZ3])[0] : delAlumno;
    assert.deepEqual(revisionDeQuiz(deLaPrevia, n), revisionDeQuiz(alAlumno, n), `distinto con ${JSON.stringify(n)}`);
  }
  // Y la nota que calcula la vista previa (`corregirEnvio` con las correctas de vuelta) es la del server.
  const v = { q3: [['4'], ['2'], ['Quito']] };
  assert.deepEqual(corregirEnvio([deLaPrevia], v, null, T), corregirEnvio([QUIZ3], v, null, T));
});

test('la pantalla decide con `revisionDeQuiz` (nunca con «¿llegaron las correctas?») y pide la página al cerrarse', () => {
  const tarea = leer('app/compartido/curso/[token]/TareaAlumno.tsx');
  const quiz = bloque(tarea, 'function CampoQuiz(', 'function FilaArchivo(');
  assert.match(quiz, /revisionDeQuiz\(campo, nota\)/);
  assert.doesNotMatch(quiz, /p\.correctas/, 'la correcta que se dibuja sale de la revisión, no de lo que llegó');
  assert.match(quiz, /r\.correctas/);
  const enviar = bloque(tarea, 'async function enviar()', 'function descartar()');
  assert.match(enviar, /!quizCerrado\(q, calif\[q\.id\]\) && quizCerrado\(q, j\.calificacion\?\.\[q\.id\]\)/,
    'el quiz que se cierra con este envío se detecta comparando antes y después');
  assert.match(enviar, /if \(cerro && !j\.avance\?\.movido\) onAvance\(\);/);
});

test('las DOS puertas del alumno le ponen de vuelta las correctas de sus quizzes cerrados', () => {
  const comun = leer('app/mi-curso/portal-comun.tsx');
  assert.match(bloque(comun, 'export async function cargarPortal', 'export async function conCorrectasCerradas'),
    /conCorrectasCerradas\(await armarVistaAlumno\(/);
  assert.match(leer('app/compartido/curso/[token]/page.tsx'), /conCorrectasCerradas\(await armarVistaAlumno\(/);
  const fn = bloque(comun, 'export async function conCorrectasCerradas', 'export function AvisoPortal');
  assert.match(fn, /clasesConQuizCerrado\(vista\)/, 'lee de la base sólo las clases con un quiz cerrado');
  assert.match(fn, /catch[\s\S]*return vista;/, 'si la lectura falla, la vista sale como estaba');
});

test('5: la PÁGINA de la vista previa le pasa al portal TODAS las correctas', () => {
  // Revisión del 09/10/2026: `conCorrectasDelEquipo` tenía test y CERO call sites, así que la vista
  // previa seguía sin poder corregir el quiz. Sin esta línea el punto 5 no llega a la app.
  const pagina = leer('app/customer-success/curso/vista/page.tsx');
  assert.match(pagina, /<PortalAlumno token="" vista=\{conCorrectasDelEquipo\(vista, clases\)\} vistaPrevia/);
  // `clases` es la de la base (con las correctas), no la vista armada.
  // (13/10/2026: la lista suma `nombreCurso`, el nombre del curso por su oferta, tests/curso-nombre.test.ts.)
  assert.match(pagina, /const \[cur, clases, adminId, estilos, tz, nombreCurso\] = await Promise\.all\(\[\s*modulosDelCurso\(productoId\),\s*clasesDelProducto\(productoId\),/);
});

// ── 2: la escala y las estrellas, centradas ──────────────────────────────────

test('2: la escala (números y estrellas) va centrada, con sus extremos debajo de las puntas', () => {
  const src = crudo('app/compartido/curso/[token]/TareaAlumno.tsx');
  const css = bloque(src, 'const CSS_TIPOS = `', '`;\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const regla = (sel: string) => {
    const m = css.match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{([^}]*)\\}`));
    assert.ok(m, `no encontré la regla ${sel}`);
    return m![1];
  };
  assert.match(regla('.cp-tarea .cpt-escala-caja'), /margin-inline: auto/);
  assert.match(regla('.cp-tarea .cpt-escala-caja'), /var\(--n/, 'la caja mide lo que miden sus botones');
  assert.match(regla('.cp-tarea .cpt-estrellas-caja'), /width: fit-content/);
  assert.match(regla('.cp-tarea .cpt-estrellas-caja'), /margin-inline: auto/);
  assert.match(regla('.cp-tarea .cpt-escala'), /justify-content: center/);
  assert.match(regla('.cp-tarea .cpt-estrellas'), /justify-content: center/);
  // Los números y sus extremos van ADENTRO de la caja (si no, los extremos quedan a lo ancho).
  const escala = bloque(sinComentarios(src), 'function CampoEscala(', 'function CampoAgenda(');
  assert.match(escala, /<div className="cpt-escala-caja"[^>]*>\s*<div ref=\{grupoRef\} className="cpt-escala"[\s\S]*\{extremos\}\s*<\/div>/);
});

// ── 4: un solo scroll en la lección del alumno ───────────────────────────────

// Desde el 13/10/2026 la tab Curso TAMBIÉN (el relevo del 10/10 lo dejó pendiente: «el editor de la tab
// Curso sigue con dos scrolls en la lección»). Conocimientos sigue igual: no hubo pedido ahí.
// Roto el 13/10 (sin la prop en CursoApp): 13 / 1.
test('4: el portal y la tab Curso piden UN solo scroll (Conocimientos sigue igual)', () => {
  assert.match(leer('app/compartido/curso/[token]/PortalAlumno.tsx'), /<CursoUgc[\s\S]*\n\s+unSoloScroll\n[\s\S]*\/>/);
  assert.doesNotMatch(leer('app/conocimientos/CursoConocimientos.tsx'), /unSoloScroll/);
  assert.match(sinComentarios(leer('app/customer-success/curso/CursoApp.tsx')), /<CursoUgc[\s\S]*\n\s+unSoloScroll\n[\s\S]*\/>/);
  assert.match(leer('app/_cursos/CursoUgc.tsx'), /\$\{unSoloScroll \? ' ahdoc--un-scroll' : ''\}/);
});

test('4: con la clase, las columnas no scrollean, el split no se encoge y el video se pega arriba', async () => {
  const { CSS_UGC } = await import('../app/_cursos/estilos');
  const css = CSS_UGC.replace(/\/\*[\s\S]*?\*\//g, '');
  const reglas = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), cuerpo: m[2] }));
  const de = (pedazo: string) => reglas.filter((r) => r.sel.includes('ahdoc--un-scroll') && r.sel.includes(pedazo));
  const columnas = de('.ugc-pcol');
  assert.ok(columnas.some((r) => r.sel.includes('.ugc-vcol') && /overflow: visible !important/.test(r.cuerpo)),
    'una columna que es un contenedor de scroll con contain frena la rueda (medido: NADA con el cursor encima)');
  assert.ok(de('.ugc-content > .ugc-split').some((r) => /flex: 0 0 auto !important/.test(r.cuerpo)),
    'un split que se encoge deja lo de abajo encima del papel');
  const pegado = de('.ugc-vcol').find((r) => /position: sticky/.test(r.cuerpo));
  assert.ok(pegado && pegado.sel.includes(':not(.ugc-split--abajo)'), 'el video se pega sólo al costado');
  // Y sólo en escritorio: en el teléfono va primero y se va con el scroll.
  const escritorio = bloque(css, '@media (min-width: 761px) {\n  .ahdoc.ahdoc--ugc.ahdoc--un-scroll', '}\n}');
  assert.match(escritorio, /position: sticky/);
});

// ── 8: el aviso del pie ───────────────────────────────────────────────────────

test('8: el pie dice «Este curso es personal. © <el curso>», nunca «Este enlace es personal»', () => {
  const portal = leer('app/compartido/curso/[token]/PortalAlumno.tsx');
  assert.doesNotMatch(portal, /enlace es personal/i);
  assert.match(portal, /pieBarra=\{vistaPrevia \? '[^']+' : `Este curso es personal\. © \$\{tituloDe\(producto\)\}`\}/,
    'con la marca del CURSO (el título que eligió el equipo o el nombre del producto), nunca MaKo');
});

// Resultado de las roturas (09/10/2026, scratchpad fb-alumno/romper.cjs). Sin romper: 13 pass / 0 fail.
//   · `quizCerrado` con `>` en vez de `>=` (un intento de más)        → 10 / 3 «quizCerrado», «revisionDeQuiz», «revelarCorrectas…»
//   · `revisionDeQuiz` revelando con el quiz abierto                  → 11 / 2 «revisionDeQuiz», «5: la vista previa… dicen LO MISMO»
//   · `conCorrectas` sin el filtro `cuales`                           → 12 / 1 «conCorrectas»
//   · `revelarCorrectas` sin saltear las clases por área              → 12 / 1 «…POR ÁREA no las revela»
//   · `conCorrectasDelEquipo` devolviendo la clase sin las correctas  → 12 / 1 «5: la vista previa del EQUIPO lleva TODAS…»
//   · `clasesConQuizCerrado` contando cualquier quiz                  → 12 / 1 «revelarCorrectas: vuelven SÓLO…»
//   · `CampoQuiz` decidiendo por las correctas que llegaron           → 12 / 1 «la pantalla decide con revisionDeQuiz…»
//   · `enviar` sin pedir la página al cerrarse un quiz                → 12 / 1 «la pantalla decide con revisionDeQuiz…»
//   · /mi-curso, o el link del portal, sin `conCorrectasCerradas`     → 12 / 1 «las DOS puertas…» (cada una)
//   · la caja de los números o la de las estrellas sin centrar, y los
//     extremos de los números afuera de la caja (tres roturas)        → 12 / 1 «2: la escala…» (cada una)
//   · el portal sin `unSoloScroll`, o el dibujo sin su clase          → 12 / 1 «4: el portal pide UN solo scroll…» (cada una)
//   · las columnas con su scroll, el split que se encoge, o el video
//     pegado también con el texto abajo (tres roturas)                → 12 / 1 «4: con la clase…» (cada una)
//   · el pie de vuelta en «Este enlace es personal»                   → 12 / 1 «8: el pie…»
// Restaurado: 13 / 0.
// El cierre de la corrida (09/10/2026) sumó «5: la PÁGINA de la vista previa…» (14 / 0). La página con
// `vista={vista}` → 13 / 1 acá, y otro rojo en tests/curso-onboarding.test.ts (scratchpad fb-cierre).
