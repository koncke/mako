// =============================================================================
// curso-tareas-tipos — los tipos de tarea de la #18 (archivo, audio, video, link, escala, quiz,
// checklist, agenda, «lo hice»): su saneo, cuándo están completos, la corrección del quiz, que las
// correctas no viajen al alumno, y que la ruta de las entregas pase por el mismo candado que la tarea
// =============================================================================
// Pedido de Martín (07/10/2026, item 18 del curso tipo Skool): «Piensa en qué otras tareas se podría
// pedir aparte de formularios e impleméntalas».
//
// Lo que se EJECUTA: lib/curso.ts (lo de los campos), lib/curso-portal.ts (`armarEtapas`/`claseVista`),
// app/compartido/curso/[token]/tarea-valores.ts y app/customer-success/curso/reglas.ts. Lo que se LEE
// como fuente (SIN comentarios y con los CRLF normalizados, AGENTS.md): las dos rutas del portal que
// tocan esto y lib/curso-entregas.ts (que tiene `server-only` y no se puede importar acá), y la mig 0218.
//
// Probado ROMPIÉNDOLO (07/10/2026, scratchpad/tipos-tarea/roturas.mjs: rompe UNA cosa por vez y
// restaura de MEMORIA, nunca con git). Con todo en su lugar: 22 pass / 0 fail. Cada rotura:
//   · `archivosDeValor` sin mirar el dueño (sólo la forma del path)          → 21 / 1 «path ajeno»
//   · `camposParaAlumno` devolviendo los campos tal cual                     → 19 / 3 «correctas no viajan», «la vista
//                                                                               del alumno…» y «corregirQuiz» (sin las
//                                                                               correctas no aprueba nadie)
//   · `claseVista` con `campos: c.campos`                                    → 21 / 1 «la vista del alumno…»
//   · `corregirQuiz` aceptando de más (`dadas.size >= buenas.size`)          → 21 / 1 «EXACTAMENTE sus correctas»
//   · `corregirEnvio` sin el tope de intentos                                → 21 / 1 «sin intentos no corrige»
//   · `corregirEnvio` volviendo a corregir uno ya aprobado                   → 21 / 1 «ya aprobado»
//   · `campoCompleto` de checklist con «alguna» en vez de «todas»            → 21 / 1 «una checklist entera»
//   · `linkValido` aceptando cualquier esquema                               → 21 / 1 «sólo http/https»
//   · la ruta de entregas con `exigeEtapa: false`                            → 21 / 1 «el candado»
//     (08/10/2026: el candado se llama `exigeAbierta` — la clase abierta, D2 — y la rotura es la misma)
//   · la ruta de entregas sin `areaDeLaTarea`                                → 21 / 1 «el candado»
//   · la ruta de la tarea guardando sin `verificarEntregas`                  → 21 / 1 «verifica antes de guardar»
//   · la ruta de la tarea pasando `enviar` (y no `enviar && !desaprobo`)     → 21 / 1 «un quiz desaprobado…»
//   · un tipo en la mig 0218 que `MIME_ENTREGA` no tiene                     → 21 / 1 «el bucket y el código»
//   · `seApruebaSola` sin mirar los demás campos                             → 21 / 1 «un entregable no se aprueba solo»
//
// REVISIÓN ADVERSARIAL (08/10/2026, scratchpad/rev-tareas/roturas.mjs, el mismo arnés: restaura de
// memoria y, si otra pista tocó el archivo en el medio, deshace sólo la rotura). Cinco tests nuevos;
// base 27 / 0. Cada rotura tumbó UN test (26 / 1):
//   · la ruta de la tarea sin `conQuizzesAprobadosIntactos` (antes daba 22 / 0)  → «la ruta de la tarea…»
//   · `topeDeSubidasAlcanzado` con `n >` en vez de `n >=`                         → «topeDeSubidasAlcanzado…»
//   · el tope de bytes sin el peor caso del próximo archivo                     → «topeDeSubidasAlcanzado…»
//   · un objeto sin fecha contado como viejo                                    → «topeDeSubidasAlcanzado…»
//   · `urlSubidaEntrega` sin mirar el tope / sin el fail-closed / devolviendo
//     el mensaje de Storage al alumno (tres roturas)                            → «antes de FIRMAR cuenta…»
//   · la ruta de entregas sin el rate limit propio de `subir`                   → «firmar una subida tiene su propio…»
//   · `subir` o `abrir` de TareaAlumno sin el corte de la vista previa (dos)     → «la vista previa del equipo no pide…»
//   · `faltaEnCampo` sin el tope de opciones / sin el de preguntas (dos)         → «lo que el saneo cortaría…»
// Y se volvieron a correr cuatro de las de arriba con el archivo nuevo: `camposParaAlumno` tal cual
// → 24 / 3, `claseVista` con `c.campos`, la tarea sin `verificarEntregas` y `seApruebaSola` con un
// archivo → 26 / 1 cada una. Restaurado: 27 / 0.
// Pista TAREA (audio del 08/10/2026, el campo nace ABAJO y el arrastre entre tareas): los dos tests de
// EditorCampos / arrastre-campos se reescribieron y se rompieron con scratchpad/tarea/romper.mjs — el
// campo que vuelve a nacer arriba, el arrastre suelto sin avisar «movido» y la decisión del arrastre de
// vuelta adentro del hook → 34 / 1 cada una sobre 35. Restaurado: 35 / 0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sanearCampos, sanearValores, camposParaAlumno, campoLleno, campoCompleto, respuestaCompleta, corregirQuiz,
  corregirEnvio, conQuizzesAprobadosIntactos, seApruebaSola, linkValido, archivosDeValor, pathDeEntrega,
  pathEsDeEntrega, pathEsDelCliente, pathsDeEntregas, mimeDeEntrega, mimesDeCampo, leerCalificacion,
  topeDeSubidasAlcanzado, MIME_ENTREGA, MIME_ENTREGA_AUDIO, TOPE_ENTREGA_BYTES, NOTA_MIN_DEFAULT,
  TOPE_SUBIDAS_DIA, TOPE_BYTES_SUBIDAS_DIA, VENTANA_SUBIDAS_MS, MAX_OPCIONES_QUIZ, MAX_PREGUNTAS,
  type Campo, type Clase, type Progreso, type DuenoEntrega,
} from '../lib/curso';
import { armarModulos, esClaseCerrada, type ClaseVista } from '../lib/curso-portal';
import { queFalta, estadoDeQuiz } from '../app/compartido/curso/[token]/tarea-valores';
import { validarClase, faltaEnCampo, TIPOS_CAMPO } from '../app/customer-success/curso/reglas';
// Los ajustes del 08/10/2026 (items 5, 6, 8 y 17): el texto de ejemplo, el orden y la comunidad.
import {
  refDeComunidad, valorDeComunidad, conTextoDeEjemplo, esCampoDeComunidad, TOPE_TEXTO_EJEMPLO,
} from '../lib/curso';
import {
  camposEnOrden, opcionesDeCategoria, opcionesDePost,
} from '../app/customer-success/curso/leccion-reglas';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 7, etapa: 'e1', orden: id, titulo: `C${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});
/**
 * El portal de UNA etapa (un módulo vinculado, sin candados propios): la forma de `armarEtapas`, que
 * se fue el 08/10/2026 (D1). Exige que ninguna clase haya viajado cerrada.
 */
const armarEtapas = (etapas: Array<{ key: string; label: string }>, actual: string, clases: Clase[], progreso: Map<number, Progreso>) =>
  armarModulos({
    modulos: etapas.map((e, i) => ({ clave: e.key, nombre: e.label, vinculado: true, n: i + 1, bloqueo: null })),
    etapas, actual, clases, progreso,
  }).map((m) => {
    assert.ok(!m.clases.some(esClaseCerrada), `el módulo ${m.key} trajo una clase cerrada sin candados`);
    return { ...m, clases: m.clases as ClaseVista[] };
  });
const prog = (claseId: number, o: Partial<Progreso> = {}): Progreso => ({
  claseId, segundosMax: 0, duracionSeg: null, pct: 0, vistoAt: null, valores: {}, estado: 'pendiente', enviadaAt: null, ...o,
});

const UUID = 'a1b2c3d4-0000-4000-8000-000000000001';
const DUENO: DuenoEntrega = { ws: 3, productoId: 7, leadId: 55, claseId: 12 };
const entrega = (path: string, o: Record<string, unknown> = {}) => ({ path, nombre: 'mi pitch.pdf', mime: 'application/pdf', bytes: 2048, ...o });

const QUIZ: Campo = sanearCampos([{
  id: 'q', label: 'Repaso', tipo: 'quiz', notaMin: 60, intentos: 2,
  preguntas: [
    { id: 'p1', texto: '¿Cuánto es 2 + 2?', opciones: ['3', '4', '5'], correctas: ['4'] },
    { id: 'p2', texto: '¿Cuáles son pares?', opciones: ['1', '2', '4'], correctas: ['2', '4'], multiple: true },
    { id: 'p3', texto: '¿Capital de Perú?', opciones: ['Lima', 'Quito'], correctas: ['Lima'] },
  ],
}])[0];

// ── El saneo de los campos ────────────────────────────────────────────────────

test('sanearCampos: los tipos nuevos salen con sus defaults, es idempotente, y los de siempre no cambian', () => {
  const crudo = [
    { id: 'a', label: 'Tu entregable', tipo: 'archivo' },
    { id: 'b', label: 'Tu pitch', tipo: 'video', maxSeg: 9999 },
    { id: 'c', label: '¿Qué tan probable?', tipo: 'escala', escala: { min: 0, max: 10, bajo: 'Nada', alto: 'Seguro' } },
    { id: 'd', label: 'Agenda', tipo: 'agenda', url: 'javascript:alert(1)' },
    { id: 'e', label: 'Pasos', tipo: 'checklist', opciones: ['Uno', '', 'Dos'] },
    { id: 'f', label: 'Texto de siempre', tipo: 'texto' },
  ];
  const s = sanearCampos(crudo);
  assert.equal(s[0].maxArchivos, 1);
  assert.equal(s[1].maxSeg, 600, 'el tope de una grabación se recorta al máximo');
  assert.deepEqual(s[2].escala, { min: 0, max: 10, bajo: 'Nada', alto: 'Seguro' });
  assert.equal(s[3].url, undefined, 'un link de agenda que no es http/https no se guarda');
  assert.deepEqual(s[4].opciones, ['Uno', 'Dos']);
  assert.deepEqual(s[5], { id: 'f', label: 'Texto de siempre', tipo: 'texto' }, 'a un tipo de siempre no se le agrega nada');
  assert.deepEqual(sanearCampos(s), s, 'idempotente');
});

test('sanearCampos: un quiz es obligatorio, sus correctas son opciones suyas, y una de UNA respuesta tiene una', () => {
  assert.equal(QUIZ.obligatorio, true);
  assert.equal(QUIZ.notaMin, 60);
  assert.equal(QUIZ.intentos, 2);
  const raro = sanearCampos([{ id: 'q', label: 'Q', tipo: 'quiz', preguntas: [
    { id: 'x', texto: 'A', opciones: ['si', 'no'], correctas: ['si', 'no', 'inventada'] },
    { id: 'y', texto: 'Sin opciones', opciones: ['una sola'], correctas: ['una sola'] },
  ] }])[0];
  assert.deepEqual(raro.preguntas!.map((p) => p.correctas), [['si']], 'la de una respuesta queda con una; la que no tiene dos opciones se tira');
  assert.equal(raro.notaMin, NOTA_MIN_DEFAULT);
});

// ── Las entregas: el path es del alumno y de la clase ────────────────────────

test('pathDeEntrega: <ws>/<producto>/<lead>/<clase>/<uuid>.<ext>, y sólo con lo que pone el server', () => {
  assert.equal(pathDeEntrega(DUENO, 'application/pdf', UUID), `3/7/55/12/${UUID}.pdf`);
  assert.equal(pathDeEntrega(DUENO, 'application/x-msdownload', UUID), null, 'un tipo que el bucket no acepta');
  assert.equal(pathDeEntrega({ ...DUENO, leadId: 0 }, 'application/pdf', UUID), null);
  assert.equal(pathDeEntrega(DUENO, 'application/pdf', '../../x'), null);
});

test('una entrega de OTRO alumno, de OTRA clase o de OTRO negocio no se acepta (path ajeno)', () => {
  const archivo = sanearCampos([{ id: 'a', label: 'A', tipo: 'archivo', maxArchivos: 5 }])[0];
  const propio = `3/7/55/12/${UUID}.pdf`;
  const deOtroAlumno = `3/7/56/12/${UUID}.pdf`;
  const deOtraClase = `3/7/55/13/${UUID}.pdf`;
  const deOtroNegocio = `4/7/55/12/${UUID}.pdf`;
  const v = sanearValores([archivo], { a: [entrega(propio), entrega(deOtroAlumno), entrega(deOtraClase), entrega(deOtroNegocio), entrega('../../etc/passwd')] }, DUENO);
  assert.deepEqual((v.a as { path: string }[]).map((x) => x.path), [propio]);
  assert.equal(pathEsDeEntrega(deOtroAlumno, DUENO), false);
  assert.equal(pathEsDeEntrega(deOtraClase, DUENO), false);
});

test('archivosDeValor: el tipo tiene que ser del campo, el tamaño el del bucket, sin repetir y con el tope', () => {
  const audio = sanearCampos([{ id: 'r', label: 'R', tipo: 'audio' }])[0];
  const p1 = `3/7/55/12/${UUID}.weba`;
  const p2 = `3/7/55/12/${UUID.replace('1', '2')}.weba`;
  const lista = archivosDeValor(audio, [
    entrega(`3/7/55/12/${UUID}.pdf`),                                   // un PDF no es un audio
    entrega(p1, { mime: 'audio/webm;codecs=opus', seg: 42.4 }),
    entrega(p1, { mime: 'audio/webm' }),                                // repetido
    entrega(p2, { mime: 'audio/webm' }),                                // un audio admite UNO
  ], DUENO);
  assert.deepEqual(lista, [{ path: p1, nombre: 'mi pitch.pdf', mime: 'audio/webm', bytes: 2048, seg: 42 }]);
  const archivo = sanearCampos([{ id: 'a', label: 'A', tipo: 'archivo' }])[0];
  assert.equal(archivosDeValor(archivo, [entrega(`3/7/55/12/${UUID}.pdf`, { bytes: TOPE_ENTREGA_BYTES + 1 })], DUENO).length, 0, 'pasa del tope del bucket');
  assert.deepEqual(pathsDeEntregas({ a: [entrega(p1)], b: 'texto', c: [['x']] }), [p1]);
  assert.equal(pathEsDelCliente(p1, 3, 55), true);
  assert.equal(pathEsDelCliente(p1, 3, 56), false, 'el equipo abre sólo lo de ESE cliente');
});

test('mimeDeEntrega: una grabación .webm es audio en un campo de audio; un .csv sale por la extensión', () => {
  assert.equal(mimeDeEntrega('grabacion.webm', 'audio/webm;codecs=opus', MIME_ENTREGA_AUDIO), 'audio/webm');
  assert.equal(mimeDeEntrega('grabacion.webm', '', MIME_ENTREGA_AUDIO), 'audio/webm');
  assert.equal(mimeDeEntrega('pitch.webm', '', mimesDeCampo('video')), 'video/webm');
  assert.equal(mimeDeEntrega('datos.csv', 'application/vnd.ms-excel', mimesDeCampo('archivo')), 'text/csv');
  assert.equal(mimeDeEntrega('virus.exe', 'application/x-msdownload', mimesDeCampo('archivo')), null);
  assert.equal(mimeDeEntrega('informe.pdf', 'application/pdf', mimesDeCampo('audio')), null);
});

// ── El saneo de lo que contesta ──────────────────────────────────────────────

test('linkValido: sólo http/https; lo que parece un dominio se completa', () => {
  assert.equal(linkValido('javascript:alert(1)'), null);
  assert.equal(linkValido('data:text/html,hola'), null);
  assert.equal(linkValido('ftp://algo.com/x'), null);
  assert.equal(linkValido('loom.com/share/abc'), 'https://loom.com/share/abc');
  assert.equal(linkValido('https://drive.google.com/file/d/x'), 'https://drive.google.com/file/d/x');
  assert.equal(linkValido('no es un link'), null);
});

test('sanearValores: escala en su rango, checklist sólo sus acciones, agenda y «lo hice» sólo «si», quiz sólo sus opciones', () => {
  const campos = sanearCampos([
    { id: 'e', label: 'E', tipo: 'escala', escala: { min: 1, max: 5, bajo: 'a', alto: 'b' } },
    { id: 'k', label: 'K', tipo: 'checklist', opciones: ['Uno', 'Dos'] },
    { id: 'g', label: 'G', tipo: 'agenda', url: 'https://cal.com/x' },
    { id: 'h', label: 'H', tipo: 'confirmacion' },
    { id: 'l', label: 'L', tipo: 'link' },
  ]).concat(QUIZ);
  const v = sanearValores(campos, {
    e: '9', k: ['Uno', 'Tres', 'Uno'], g: 'true', h: 'si', l: 'javascript:x',
    q: [['4', '3'], ['2', '4', '9'], ['Lima']],
  });
  assert.equal(v.e, undefined, '9 no está entre 1 y 5');
  assert.deepEqual(v.k, ['Uno']);
  assert.equal(v.g, undefined);
  assert.equal(v.h, 'si');
  assert.equal(v.l, undefined);
  assert.deepEqual(v.q, [['4'], ['2', '4'], ['Lima']], 'una de una respuesta guarda una');
  assert.equal(sanearValores(campos, { e: '3' }).e, '3');
});

// ── Cuándo está completo ─────────────────────────────────────────────────────

test('completo: una checklist entera, un quiz contestado entero, un link que es un link', () => {
  const k = sanearCampos([{ id: 'k', label: 'Pasos', tipo: 'checklist', opciones: ['Uno', 'Dos'], obligatorio: true }])[0];
  assert.equal(campoLleno(k, ['Uno']), true);
  assert.equal(campoCompleto(k, ['Uno']), false, 'la checklist entera');
  assert.equal(campoCompleto(k, ['Dos', 'Uno']), true);
  assert.equal(campoCompleto(QUIZ, [['4'], ['2']]), false, 'falta la tercera');
  assert.equal(campoCompleto(QUIZ, [['4'], ['2'], ['Quito']]), true, 'contestado no es aprobado');
  const l = sanearCampos([{ id: 'l', label: 'Tu Loom', tipo: 'link', obligatorio: true }])[0];
  assert.equal(campoLleno(l, 'esto no'), false);
  assert.equal(respuestaCompleta(clase(1, { campos: [k, l] }), { k: ['Uno', 'Dos'], l: 'loom.com/share/a' }), true);
  assert.equal(respuestaCompleta(clase(1, { campos: [k, l] }), { k: ['Uno'], l: 'loom.com/share/a' }), false);
  // La pantalla dice lo mismo que el server.
  assert.deepEqual(queFalta([k, l], { k: ['Uno'], l: 'https://loom.com/a' }), { tipo: 'campos', labels: ['Pasos'] });
  const a = sanearCampos([{ id: 'a', label: 'Tu archivo', tipo: 'archivo', obligatorio: true }])[0];
  assert.equal(campoLleno(a, [{ nada: 1 }] as never), false, 'un objeto sin path no es un archivo');
  assert.equal(campoLleno(a, [entrega(`3/7/55/12/${UUID}.pdf`)] as never), true);
});

// ── El quiz se corrige en el server ──────────────────────────────────────────

test('corregirQuiz: una pregunta está bien si marcó EXACTAMENTE sus correctas', () => {
  assert.deepEqual(corregirQuiz(QUIZ, [['4'], ['2', '4'], ['Lima']]), { nota: 100, malas: [] });
  assert.deepEqual(corregirQuiz(QUIZ, [['4'], ['2', '4', '1'], ['Lima']]), { nota: 67, malas: [1] }, 'una de más es mal');
  assert.deepEqual(corregirQuiz(QUIZ, [['4'], ['2'], ['Quito']]), { nota: 33, malas: [1, 2] });
  // Sin las correctas (los campos del alumno) no aprueba nadie: es el error que se ve.
  assert.equal(corregirQuiz(camposParaAlumno([QUIZ])[0], [['4'], ['2', '4'], ['Lima']])!.nota, 0);
});

test('corregirEnvio: aprueba con la nota mínima, cuenta el intento, y sin intentos no corrige', () => {
  const T = '2026-10-07T12:00:00.000Z';
  const mal = { q: [['3'], ['2'], ['Quito']] };
  const bien = { q: [['4'], ['2', '4'], ['Lima']] };
  const r1 = corregirEnvio([QUIZ], mal, null, T)!;
  assert.equal(r1.tipo, 'corregido');
  assert.ok(r1.tipo === 'corregido' && !r1.aprobado);
  assert.deepEqual(r1.calificacion.q, { nota: 0, aprobado: false, intentos: 1, malas: [0, 1, 2], at: T });
  const r2 = corregirEnvio([QUIZ], mal, r1.calificacion, T)!;
  assert.equal(r2.calificacion.q.intentos, 2);
  const r3 = corregirEnvio([QUIZ], bien, r2.calificacion, T)!;
  assert.equal(r3.tipo, 'sin-intentos', 'con 2 intentos usados y el tope en 2, no se corrige más');
  assert.equal(r3.calificacion.q.intentos, 2, 'y no se cuenta uno de más');
  const ok = corregirEnvio([QUIZ], bien, null, T)!;
  assert.ok(ok.tipo === 'corregido' && ok.aprobado);
  assert.equal(ok.calificacion.q.nota, 100);
  assert.equal(corregirEnvio([sanearCampos([{ id: 't', label: 'T', tipo: 'texto' }])[0]], {}, null, T), null, 'sin quiz no hay nada que corregir');
});

test('corregirEnvio: un quiz ya aprobado no se vuelve a corregir ni gasta intentos', () => {
  const T = '2026-10-07T12:00:00.000Z';
  const aprobado = { q: { nota: 100, aprobado: true, intentos: 2, at: T } };
  const r = corregirEnvio([QUIZ], { q: [['3'], [], []] }, aprobado, T)!;
  assert.ok(r.tipo === 'corregido' && r.aprobado);
  assert.deepEqual(r.calificacion.q, aprobado.q);
  // Y sus respuestas quedan como estaban guardadas, mande lo que mande el pedido.
  const guardadas = { q: [['4'], ['2', '4'], ['Lima']], otro: 'x' };
  assert.deepEqual(conQuizzesAprobadosIntactos([QUIZ], { q: [['3']], otro: 'y' }, guardadas, aprobado), { q: guardadas.q, otro: 'y' });
});

test('seApruebaSola: un quiz solo (o con autodeclarados) sí; un entregable no se aprueba solo', () => {
  const escala = sanearCampos([{ id: 'e', label: 'E', tipo: 'escala', escala: { min: 1, max: 10, bajo: 'a', alto: 'b' } }])[0];
  const texto = sanearCampos([{ id: 't', label: 'T', tipo: 'texto' }])[0];
  const archivo = sanearCampos([{ id: 'a', label: 'A', tipo: 'archivo' }])[0];
  assert.equal(seApruebaSola([QUIZ]), true);
  assert.equal(seApruebaSola([QUIZ, escala]), true);
  assert.equal(seApruebaSola([QUIZ, texto]), false);
  assert.equal(seApruebaSola([QUIZ, archivo]), false);
  assert.equal(seApruebaSola([escala]), false, 'sin quiz no hay nada que lo apruebe');
});

test('leerCalificacion: lo que no cierra se tira (es un jsonb)', () => {
  assert.equal(leerCalificacion(null), null);
  assert.equal(leerCalificacion([]), null);
  assert.deepEqual(leerCalificacion({ q: { nota: 150, aprobado: true, intentos: 1, at: 'x' }, malo: { nota: 'a' } }), { q: { nota: 100, aprobado: true, intentos: 1, at: 'x' } });
});

test('estadoDeQuiz: la nota, lo que erró por número y los intentos que quedan, sin la correcta', () => {
  const T = 'x';
  assert.equal(estadoDeQuiz(QUIZ, undefined), null);
  assert.deepEqual(estadoDeQuiz(QUIZ, { nota: 100, aprobado: true, intentos: 1, at: T }), { aprobado: true, sinIntentos: false, titulo: 'Aprobado · 100 %', detalle: null });
  const e = estadoDeQuiz(QUIZ, { nota: 33, aprobado: false, intentos: 1, malas: [1, 2], at: T })!;
  assert.equal(e.titulo, 'Sacaste 33 %. Necesitas 60 %.');
  assert.equal(e.detalle, 'Revisa: 2, 3. Te queda 1 intento.');
  assert.equal(estadoDeQuiz(QUIZ, { nota: 33, aprobado: false, intentos: 2, at: T })!.sinIntentos, true);
});

// ── Las correctas NUNCA viajan al alumno ─────────────────────────────────────

test('camposParaAlumno: las correctas no viajan, y lo que usa el server no se toca', () => {
  const [vista] = camposParaAlumno([QUIZ]);
  assert.ok(vista.preguntas!.every((p) => !('correctas' in p)));
  assert.deepEqual(QUIZ.preguntas![0].correctas, ['4'], 'no muta los campos con los que el server corrige');
  assert.equal(camposParaAlumno([QUIZ, { id: 't', label: 'T', tipo: 'texto' }])[1].tipo, 'texto');
});

test('la vista del alumno (armarEtapas → claseVista) no lleva las correctas en ningún lado', () => {
  const c = clase(1, { campos: [QUIZ], obligatoria: true });
  const [e] = armarEtapas([{ key: 'e1', label: 'Uno' }], 'e1', [c], new Map([[1, prog(1)]]));
  const json = JSON.stringify(e);
  assert.doesNotMatch(json, /correctas/);
  assert.equal(e.clases[0].campos[0].preguntas!.length, 3, 'las preguntas sí viajan');
  // La nota viaja sólo si hay; sin nota, la lista blanca de siempre (tests/curso-portal.test.ts).
  assert.equal('calificacion' in e.clases[0], false);
  const conNota = armarEtapas([{ key: 'e1', label: 'Uno' }], 'e1', [c],
    new Map([[1, prog(1, { calificacion: { q: { nota: 33, aprobado: false, intentos: 1, at: 'x' } } })]]));
  assert.equal(conNota[0].clases[0].calificacion?.q.nota, 33);
});

// ── El editor no deja guardar un tipo que no cierra ──────────────────────────

test('validarClase: un quiz sin correcta, una escala sin extremos o una agenda sin link no se guardan', () => {
  const ctx = { ws: 3, productoId: 7, modulos: ['e1'] };
  const base = { productoId: 7, etapa: 'e1', titulo: 'Clase' };
  const con = (campos: unknown[]) => validarClase({ ...base, campos }, ctx);
  assert.deepEqual(con([{ id: 'q', label: 'Repaso', tipo: 'quiz', preguntas: [{ id: 'p', texto: '¿?', opciones: ['a', 'b'], correctas: [] }] }]),
    { ok: false, error: 'Marca la correcta en la pregunta 1 de «Repaso».' });
  assert.deepEqual(con([{ id: 'q', label: 'Repaso', tipo: 'quiz', preguntas: [{ id: 'p', texto: '¿?', opciones: ['a', 'b'], correctas: ['a', 'b'] }] }]),
    { ok: false, error: 'En la pregunta 1 de «Repaso» hay dos correctas.' });
  assert.deepEqual(con([{ id: 'e', label: 'NPS', tipo: 'escala', escala: { min: 0, max: 10, bajo: 'Nada', alto: '' } }]),
    { ok: false, error: 'Faltan los extremos de «NPS».' });
  assert.deepEqual(con([{ id: 'g', label: 'Tu llamada', tipo: 'agenda', url: 'calendly' }]),
    { ok: false, error: 'Falta el link para agendar de «Tu llamada».' });
  assert.equal(faltaEnCampo({ id: 'k', label: 'Pasos', tipo: 'checklist', opciones: ['', ' '] }), 'Faltan las acciones de «Pasos».');
  const ok = con([QUIZ, { id: 'a', label: 'Tu pitch', tipo: 'video' }]);
  assert.equal(ok.ok, true);
});

// ── El bucket y el código dicen lo mismo ─────────────────────────────────────

test('la mig 0218: el bucket acepta exactamente MIME_ENTREGA y topea en TOPE_ENTREGA_BYTES', () => {
  const sql = readFileSync(join(RAIZ, 'supabase/migrations/0218_curso_entregas.sql'), 'utf8').replace(/\r\n/g, '\n');
  const m = sql.match(/values \('curso-entregas', 'curso-entregas', false, (\d+), array\[([\s\S]*?)\]\)/);
  assert.ok(m, 'no encontré el insert del bucket');
  assert.equal(Number(m![1]), TOPE_ENTREGA_BYTES);
  const tipos = [...m![2].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(tipos, [...MIME_ENTREGA].sort());
  assert.match(sql, /alter table curso_progreso add column if not exists calificacion jsonb/);
  assert.match(sql, /revoke all on curso_progreso from anon, authenticated/);
  assert.match(sql, /ANTES del deploy/);
});

// ── La ruta de las entregas: el mismo candado que la tarea ───────────────────

test('la ruta de entregas: firma → resolver → candado (exigeAbierta) → área → y recién ahí firma la subida', () => {
  const src = leer('app/api/compartido/curso/entrega/route.ts');
  const handlers = [...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
  assert.deepEqual(handlers, ['POST']);
  assert.match(src, /const\s+firma\s*=\s*leerTokenPortal\(token\)/);
  assert.match(src, /runWithWorkspace\(\s*firma\.ws\s*,\s*async\s*\(\)\s*=>\s*\{\s*const\s+acceso\s*=\s*await\s+resolverAccesoPortal\(token\)/);
  assert.match(src, /claseDelAlumno\([^)]*exigeAbierta:\s*true[^)]*lider:\s*acceso\.area/, 'el candado de la clase y el área del acceso');
  const i = (s: string) => src.indexOf(s);
  assert.ok(i('rateLimit(`curso-entrega:ip') >= 0 && i('rateLimit(`curso-entrega:ip') < i('leerJsonTopeado('), 'el tope por IP antes de leer nada');
  assert.ok(i('resolverAccesoPortal(') < i('claseDelAlumno('));
  assert.ok(i('claseDelAlumno(') < i('areaDeLaTarea('));
  assert.ok(i('areaDeLaTarea(') < i('urlSubidaEntrega('), 'no se firma una subida antes del candado');
  assert.ok(i('claseDelAlumno(') < i('urlVerEntrega('), 'ni un link para ver');
  // El dueño del archivo sale de la firma y de la clase, nunca del pedido.
  assert.match(src, /dueno:\s*DuenoEntrega\s*=\s*\{\s*ws:\s*acceso\.ws,\s*productoId:\s*r\.clase\.productoId,\s*leadId:\s*acceso\.leadId,\s*claseId:\s*r\.clase\.id\s*\}/);
  assert.doesNotMatch(src, /\bb\.(ws|leadId|productoId|lead)\b/);
});

test('lib/curso-entregas: la subida valida contra el CAMPO y el tope; ver exige el dueño; el equipo, el cliente', () => {
  const src = leer('lib/curso-entregas.ts');
  const subida = src.slice(src.indexOf('export async function urlSubidaEntrega'), src.indexOf('async function firmarVer'));
  assert.match(subida, /mimesDeCampo\(campo\.tipo\)\.includes\(mime\)/);
  assert.match(subida, /bytes > TOPE_ENTREGA_BYTES/);
  assert.ok(subida.indexOf('pathDeEntrega(') < subida.indexOf('createSignedUploadUrl('));
  const ver = src.slice(src.indexOf('export async function urlVerEntrega'), src.indexOf('export async function urlEntregaParaEquipo'));
  assert.ok(ver.indexOf('pathEsDeEntrega(') >= 0 && ver.indexOf('pathEsDeEntrega(') < ver.indexOf('firmarVer('));
  const equipo = src.slice(src.indexOf('export async function urlEntregaParaEquipo'), src.indexOf('export type EntregaGuardada'));
  assert.match(equipo, /getWorkspaceActual\(\)/);
  assert.ok(equipo.indexOf('pathEsDelCliente(') < equipo.indexOf('firmarVer('));
  // El dueño ESTRICTO al verificar lo que se guarda.
  const verificar = src.slice(src.indexOf('export async function verificarEntregas'), src.indexOf('export async function registrarCalificacion'));
  assert.match(verificar, /archivosDeValor\(c,\s*v,\s*dueno\)/);
});

// ── La ruta de la tarea: verifica, corrige, y un desaprobado no queda enviado ─

test('la ruta de la tarea: verifica las entregas y corrige el quiz ANTES de guardar; un quiz desaprobado no queda enviado', () => {
  const src0 = leer('app/api/compartido/curso/tarea/route.ts');
  // ⚠️ Desde el 08/10/2026 la rama de la COMUNIDAD (item 17) también llama a `guardarTarea` (anota QUÉ
  // publicó), y va antes en el archivo: lo que se mira acá es el guardado de los VALORES (`crudo`).
  const src = src0.replace(/guardarTarea\(acceso\.leadId, r\.clase, \{ \.\.\.\(previaCom/, 'guardarTareaComunidad(acceso.leadId, r.clase, { ...(previaCom');
  const i = (s: string) => src.indexOf(s);
  assert.ok(i('verificarEntregas(') > 0 && i('verificarEntregas(') < i('guardarTarea('), 'verifica antes de guardar');
  assert.ok(i('corregirEnvio(') > 0 && i('corregirEnvio(') < i('guardarTarea('), 'corrige antes de guardar');
  assert.match(src, /guardarTarea\(acceso\.leadId,\s*r\.clase,\s*crudo,\s*enviar\s*&&\s*!desaprobo,\s*area\)/, 'un quiz desaprobado se guarda como borrador');
  assert.ok(src.indexOf('registrarCalificacion(', i('guardarTarea(')) > 0, 'la nota se anota DESPUÉS de crear la fila');
  assert.match(src, /corregido\?\.aprobado\s*&&\s*progreso\.estado\s*===\s*'enviada'\s*&&\s*seApruebaSola\(campos\)/);
  assert.match(src, /if\s*\(enviar\s*&&\s*!desaprobo\s*&&\s*!faltaCompletar/, 'un desaprobado no dispara el paso de etapa');
  // El dueño de la verificación sale de la firma y de la clase.
  assert.match(src, /dueno:\s*DuenoEntrega\s*=\s*\{\s*ws:\s*acceso\.ws,\s*productoId:\s*r\.clase\.productoId,\s*leadId:\s*acceso\.leadId,\s*claseId:\s*r\.clase\.id\s*\}/);
  // ⚠️ Un quiz ya aprobado no se vuelve a contestar: las respuestas guardadas se reponen ANTES de
  // corregir y de guardar. La función tenía su test; la LÍNEA que la enchufa en la ruta no tenía
  // ninguno (revisión del 08/10/2026: borrarla daba 22 / 0).
  const intactos = i('conQuizzesAprobadosIntactos(');
  assert.ok(intactos > 0, 'la ruta repone las respuestas de un quiz aprobado');
  assert.ok(intactos < i('corregirEnvio(') && intactos < i('guardarTarea('), 'antes de corregir y de guardar');
  assert.match(src, /crudo\s*=\s*conQuizzesAprobadosIntactos\(\s*campos\s*,\s*crudo\s*,/, 'y lo que guarda es lo repuesto');
});

// ── El tope de lo que sube un alumno (revisión del 08/10/2026) ──────────────
// La ruta de las entregas es pública y cada firma es un archivo de hasta 100 MB, contra 5 GiB de
// Storage para toda la plataforma. Sin tope, un link filtrado lo llenaba en dos minutos.

test('topeDeSubidasAlcanzado: cuenta objetos y bytes de las últimas 24 h, con el peor caso del próximo', () => {
  const AHORA = Date.parse('2026-10-08T12:00:00.000Z');
  const hoy = new Date(AHORA - 3600_000).toISOString();
  const viejo = new Date(AHORA - VENTANA_SUBIDAS_MS - 60_000).toISOString();
  const de = (n: number, creado: string | null, bytes: number | null = 1024) => Array.from({ length: n }, () => ({ creado, bytes }));
  assert.equal(topeDeSubidasAlcanzado([], AHORA), false);
  assert.equal(topeDeSubidasAlcanzado(de(TOPE_SUBIDAS_DIA - 1, hoy), AHORA), false);
  assert.equal(topeDeSubidasAlcanzado(de(TOPE_SUBIDAS_DIA, hoy), AHORA), true, 'el tope de objetos');
  assert.equal(topeDeSubidasAlcanzado(de(TOPE_SUBIDAS_DIA * 3, viejo), AHORA), false, 'lo de ayer no cuenta');
  assert.equal(topeDeSubidasAlcanzado(de(TOPE_SUBIDAS_DIA, null), AHORA), true, 'sin fecha legible cuenta como de hoy');
  // Los bytes: lo subido MÁS un archivo entero del tope (el tamaño que declara el navegador no se cumple).
  const libre = TOPE_BYTES_SUBIDAS_DIA - TOPE_ENTREGA_BYTES;
  assert.equal(topeDeSubidasAlcanzado([{ creado: hoy, bytes: libre }], AHORA), false);
  assert.equal(topeDeSubidasAlcanzado([{ creado: hoy, bytes: libre + 1 }], AHORA), true, 'el tope de bytes, con el peor caso');
  assert.equal(topeDeSubidasAlcanzado([{ creado: viejo, bytes: TOPE_BYTES_SUBIDAS_DIA * 4 }], AHORA), false);
});

test('lib/curso-entregas: antes de FIRMAR cuenta lo subido, falla cerrado, y no le muestra al alumno el error de Storage', () => {
  const src = leer('lib/curso-entregas.ts');
  const subida = src.slice(src.indexOf('export async function urlSubidaEntrega'), src.indexOf('async function firmarVer'));
  const firma = subida.indexOf('createSignedUploadUrl(');
  assert.ok(firma > 0);
  assert.ok(subida.indexOf('subidasDelAlumno(dueno)') >= 0 && subida.indexOf('subidasDelAlumno(dueno)') < firma, 'cuenta antes de firmar');
  assert.ok(subida.indexOf('topeDeSubidasAlcanzado(') >= 0 && subida.indexOf('topeDeSubidasAlcanzado(') < firma, 'y mira el tope antes de firmar');
  assert.match(subida, /if\s*\(\s*!hechas\s*\)\s*return\s*\{\s*ok:\s*false/, 'sin poder contar, no se firma');
  // Lo que vuelve al alumno nunca es el mensaje de Storage (inglés, técnico).
  assert.doesNotMatch(subida, /error:\s*(error\??\.message|msg\()/);
  // El conteo lee la carpeta del ALUMNO en ESTE programa: lo que pone el server, no el pedido.
  const contar = src.slice(src.indexOf('async function subidasDelAlumno'), src.indexOf('export async function urlSubidaEntrega'));
  assert.match(contar, /const\s+base\s*=\s*`\$\{d\.ws\}\/\$\{d\.productoId\}\/\$\{d\.leadId\}`/);
  assert.match(contar, /return\s+null;[\s\S]*return\s+null;/, 'fail-closed en las dos lecturas');
});

test('la ruta de entregas: firmar una subida tiene su propio rate limit, antes de firmar', () => {
  const src = leer('app/api/compartido/curso/entrega/route.ts');
  const tope = src.search(/accion\s*===\s*'subir'\s*&&\s*!rateLimit\(`curso-entrega:subir:/);
  assert.ok(tope > 0, 'el tope propio de subir');
  assert.ok(tope < src.indexOf('urlSubidaEntrega('));
  assert.ok(tope > src.indexOf('resolverAccesoPortal('), 'por alumno: después de resolverlo');
});

test('la vista previa del equipo no pide firmas ni links: subir y abrir cortan antes del fetch', () => {
  const src = leer('app/compartido/curso/[token]/TareaAlumno.tsx');
  for (const nombre of ['const subir = useCallback(', 'const abrir = useCallback(']) {
    const ini = src.indexOf(nombre);
    assert.ok(ini > 0, nombre);
    const fetchEntrega = src.indexOf('fetch(URL_ENTREGA', ini);
    const cuerpo = src.slice(ini, fetchEntrega);
    assert.ok(fetchEntrega > ini && cuerpo.length < 2500, `${nombre}: no encontré su fetch`);
    assert.match(cuerpo, /if\s*\(\s*previa\s*\)/, `${nombre}: sin el corte de la vista previa`);
  }
});

test('faltaEnCampo: lo que el saneo cortaría en silencio se dice antes de guardar', () => {
  const opciones = Array.from({ length: MAX_OPCIONES_QUIZ + 1 }, (_, i) => `op ${i + 1}`);
  // La correcta en la opción 13: el saneo la cortaba y el quiz no lo aprobaba nadie.
  const pregunta = { id: 'p', texto: '¿Cuál?', opciones, correctas: [opciones.at(-1)] };
  assert.equal(faltaEnCampo({ id: 'q', label: 'Repaso', tipo: 'quiz', preguntas: [pregunta] }),
    `Máximo ${MAX_OPCIONES_QUIZ} opciones en la pregunta 1 de «Repaso».`);
  const preguntas = Array.from({ length: MAX_PREGUNTAS + 1 }, (_, i) => ({ id: `p${i}`, texto: `P${i}`, opciones: ['a', 'b'], correctas: ['a'] }));
  assert.equal(faltaEnCampo({ id: 'q', label: 'Repaso', tipo: 'quiz', preguntas }), `Máximo ${MAX_PREGUNTAS} preguntas en «Repaso».`);
  assert.equal(faltaEnCampo({ id: 'q', label: 'Repaso', tipo: 'quiz', preguntas: preguntas.slice(0, MAX_PREGUNTAS) }), null);
});

// =============================================================================
// Los ajustes del 08/10/2026 (pista LECCIÓN): items 5, 6, 8 y 17
// =============================================================================
// «No podés poner la pregunta dentro del cuadro de texto donde va a completar el alumno como si fuera un
// placeholder... Y también agregar la opción de placeholder» (5) · «ese contenedor se debe poder
// arrastrar» (6) · «arriba del todo, un placeholder grande que diga "Nuevo campo"» (8) · «Faltan opciones
// en las tareas para interactuar en la comunidad que hicimos» (17).
// Las roturas, con su resultado, en el bloque al final del archivo.

test('el texto de ejemplo: sólo donde hay un cuadro, recortado y en una línea; los campos de siempre no cambian', () => {
  for (const t of ['texto', 'linea', 'numero', 'link']) assert.equal(conTextoDeEjemplo(t), true, t);
  for (const t of ['eleccion', 'tabla', 'quiz', 'archivo', 'publicar', 'confirmacion']) assert.equal(conTextoDeEjemplo(t), false, t);
  const [a, b, c] = sanearCampos([
    { id: 'a', label: 'Tu meta', tipo: 'linea', placeholder: '  Ej:   vender   más  ' },
    { id: 'b', label: 'Tu rubro', tipo: 'eleccion', opciones: ['A', 'B'], placeholder: 'no va' },
    { id: 'c', label: 'Largo', tipo: 'texto', placeholder: 'x'.repeat(TOPE_TEXTO_EJEMPLO + 50) },
  ]);
  assert.equal(a.placeholder, 'Ej: vender más');
  assert.equal('placeholder' in b, false, 'una elección no tiene cuadro: el ejemplo no se guarda');
  assert.equal(c.placeholder!.length, TOPE_TEXTO_EJEMPLO);
  // Idempotente, y un campo de siempre sin ejemplo sale IDÉNTICO (los programas cargados se comparan así).
  const viejo = { id: 'v', label: 'Pregunta', tipo: 'texto' as const };
  assert.deepEqual(sanearCampos([viejo]), [viejo]);
  assert.deepEqual(sanearCampos(sanearCampos([a, c])), [a, c]);
});

test('la pregunta es el TÍTULO y el cuadro lleva sólo el texto de ejemplo: nunca la pregunta como placeholder', () => {
  const src = leer('app/compartido/curso/[token]/TareaAlumno.tsx');
  assert.doesNotMatch(src, /placeholder=\{campo\.label/, 'la pregunta como placeholder');
  assert.match(src, /const ejemplo = campo\.placeholder\?\.trim\(\) \|\| undefined;/);
  for (const n of [/<Input id=\{id\} type="url"[^>]*placeholder=\{ejemplo \?\? 'https:\/\/'\}/, /inputMode=\{campo\.tipo === 'numero' \? 'decimal' : undefined\}\s*placeholder=\{ejemplo\}/, /<Textarea id=\{id\} rows=\{4\} placeholder=\{ejemplo\}/]) {
    assert.match(src, n);
  }
  // La pregunta va arriba, como rótulo del campo (`cabeza` / `grupo`).
  assert.match(src, /<label className="cp-preg" htmlFor=\{id\}>\{rotulo\}<\/label>/);
  // En el editor, la pregunta es el título de la tarjeta y el cuadro del alumno es otro campo.
  const ed = leer('app/customer-success/curso/EditorCampos.tsx');
  assert.match(ed, /<Pregunta valor=\{c\.label\}/);
  assert.match(ed, /onChange=\{\(e\) => cambiar\(i, \{ placeholder: e\.target\.value \}\)\}/);
  assert.match(ed, /\{conTextoDeEjemplo\(c\.tipo\) && \(/);
});

// El audio de la tarde del 08/10/2026 (item 5, 21:00: «lo pondría abajo del campo que ya puse») dio vuelta
// DÓNDE nace el campo: el recuadro grande sigue ARRIBA (lo pidió Martín esa mañana) y el campo, ABAJO del
// último, con el foco y a la vista. El detalle, en tests/curso-tarea-editor.test.ts.
test('«+ Nuevo campo»: el recuadro grande PRIMERO, y el campo nace ABAJO del último; reordenar no pierde ninguno', () => {
  const c = (id: string): Campo => ({ id, label: id, tipo: 'texto' });
  assert.deepEqual(camposEnOrden([c('a'), c('b'), c('c')], ['c', 'a', 'b']).map((x) => x.id), ['c', 'a', 'b']);
  // Un id de más se ignora; uno que falta queda al final (las respuestas cuelgan de su id).
  assert.deepEqual(camposEnOrden([c('a'), c('b'), c('c')], ['b', 'zz']).map((x) => x.id), ['b', 'a', 'c']);
  const ed = leer('app/customer-success/curso/EditorCampos.tsx');
  const ini = ed.indexOf('<div className={`ec-lista');
  assert.ok(ini > 0, 'la lista de los campos de una tarea');
  assert.match(ed.slice(ini, ini + 200), /\{ \.\.\.arr\.zona, \.\.\.arr\.grupo\(0\) \}/, 'sola, la lista es su propia zona de arrastre');
  const nuevo = ed.indexOf('className="ec-nuevo"', ini);
  const primero = ed.indexOf('{campos.map(', ini);
  assert.ok(nuevo > ini && nuevo < primero, '«+ Nuevo campo» va ANTES de los campos');
  assert.match(ed, />\s*\+ Nuevo campo\s*</);
  assert.doesNotMatch(ed, />\s*\+ Campo\s*</, 'volvió el botón chico de abajo');
  assert.match(ed, /onCampos\(\[\.\.\.campos, campoNuevo\(id\)\], 'nuevo'\);/, 'el campo nace al FINAL');
});

test('el campo es una tarjeta que se ARRASTRA con las piezas del curso y del Plan (no una copia)', () => {
  const arr = leer('app/customer-success/curso/arrastre-campos.ts');
  assert.match(arr, /import \{ fotoVaciaDeArrastre, scrollerDe, useArrastreCopia \} from '@\/app\/plan\/board\/arrastre-copia';/);
  // Desde el audio del 08/10/2026 (item 12, varias tareas) lo que decide vive puro en tarea-editor-reglas.ts,
  // que usa las piezas del curso (`indiceEnLista`, `ordenAlSoltar`).
  assert.match(arr, /import \{ cambiaAlSoltar, dondeCae, type TareaMedida \} from '\.\/tarea-editor-reglas';/);
  assert.match(leer('app/customer-success/curso/tarea-editor-reglas.ts'), /import \{ indiceEnLista, ordenAlSoltar \} from '@\/app\/_cursos\/orden';/);
  assert.match(arr, /fotoVaciaDeArrastre\(e\.dataTransfer\);/, 'la foto del sistema operativo, vacía');
  // La copia cuelga de la LISTA (su hoja va acotada ahí), y la medición la saltea.
  assert.match(arr, /montarCopia\(nodo, e\.clientX - r\.left, e\.clientY - r\.top, nodo\.closest<HTMLElement>\('\[data-zona-campos\]'\) \?\? nodo\.closest<HTMLElement>\('\.ugc'\)\)/);
  assert.match(arr, /\.filter\(\(c\) => c\.style\.position !== 'fixed'\)/);
  assert.match(arr, /document\.addEventListener\('dragover', empuje, true\)/, 'el auto-scroll en el dragover de document, en captura');
  assert.match(arr, /const h = huecoRef\.current;[\s\S]{0,120}terminar\(\);/, 'el hueco se lee ANTES de terminar');
  assert.doesNotMatch(arr, /requestAnimationFrame|setInterval/, 'durante un arrastre nativo se congelan');
  const ed = leer('app/customer-success/curso/EditorCampos.tsx');
  assert.match(ed, /onDragStart=\{\(e\) => arr\.agarrar\(e, c\.id\)\}/);
  assert.match(ed, /onPointerDownCapture=\{arr\.marcarOrigen\}/, 'adentro de un campo de texto no arrastra');
  assert.match(ed, /onSoltar: \(id, _g, i\) => \{ const l = conCampoMovido\(campos, id, 0, i\); if \(l\) onCampos\(l, 'movido'\); \}/, 'mover avisa (para el Deshacer)');
  assert.match(ed, /onCampos\(campos\.filter\(\(_, j\) => j !== i\), 'borrado'\)/, 'borrar avisa (para el Deshacer)');
});

test('la comunidad: la referencia de lo publicado o comentado, sólo con su forma', () => {
  assert.deepEqual(refDeComunidad('publicar', '42'), { postId: 42, comentarioId: null });
  assert.deepEqual(refDeComunidad('comentar', '42/7'), { postId: 42, comentarioId: 7 });
  for (const malo of ['', '0', '-3', '42/7', 'abc', '1e3']) assert.equal(refDeComunidad('publicar', malo), null, `publicar ${malo}`);
  for (const malo of ['42', '0/7', '42/0', '42/x']) assert.equal(refDeComunidad('comentar', malo), null, `comentar ${malo}`);
  assert.equal(valorDeComunidad(42), '42');
  assert.equal(valorDeComunidad(42, 7), '42/7');
  assert.equal(esCampoDeComunidad('publicar') && esCampoDeComunidad('comentar') && !esCampoDeComunidad('texto'), true);
  const campos = sanearCampos([
    { id: 'p', label: 'Preséntate', tipo: 'publicar', categoriaId: 9 },
    { id: 'c', label: 'Opina', tipo: 'comentar', postId: 33, postTitulo: '  Bienvenida  ' },
    { id: 'c2', label: 'Opina', tipo: 'comentar', postId: -1, postTitulo: 'no' },
  ]);
  assert.deepEqual(campos[0], { id: 'p', label: 'Preséntate', tipo: 'publicar', categoriaId: 9 });
  assert.deepEqual(campos[1], { id: 'c', label: 'Opina', tipo: 'comentar', postId: 33, postTitulo: 'Bienvenida' });
  assert.deepEqual(campos[2], { id: 'c2', label: 'Opina', tipo: 'comentar' }, 'sin post válido = el último fijado');
  // Lo que manda el navegador se recorta a la FORMA; que sea SUYO lo mira la ruta (abajo).
  assert.deepEqual(sanearValores(campos, { p: '42', c: '33/8', c2: '<script>' }), { p: '42', c: '33/8' });
  assert.equal(campoLleno(campos[0], '42'), true);
  assert.equal(campoLleno(campos[0], ''), false);
  assert.ok(TIPOS_CAMPO.some((t) => t.value === 'publicar') && TIPOS_CAMPO.some((t) => t.value === 'comentar'), 'el selector los ofrece');
  assert.equal(seApruebaSola([QUIZ, campos[0]]), true, 'publicar no pide que el equipo lo revise');
});

test('los desplegables de la comunidad: el elegido SIEMPRE está entre las opciones (si no, el primer clic lo borra)', () => {
  const opc = { categorias: [{ id: 1, nombre: 'Presentaciones' }], posts: [{ id: 5, titulo: 'Reglas', fijado: false }, { id: 6, titulo: 'Bienvenida', fijado: true }] };
  assert.deepEqual(opcionesDeCategoria(opc, undefined).map((o) => o.value), ['', '1']);
  assert.ok(opcionesDeCategoria(opc, 99).some((o) => o.value === '99'), 'una categoría que ya no está se sigue viendo');
  assert.ok(opcionesDeCategoria(null, 4).some((o) => o.value === '4'), 'sin red, la elegida igual');
  const posts = opcionesDePost(opc, undefined);
  assert.deepEqual(posts.map((o) => o.value), ['', '6', '5'], 'el último fijado, y los fijados primero');
  assert.equal(posts[0].label, 'El último fijado');
  assert.deepEqual(opcionesDePost(null, 33, 'Bienvenida').at(-1), { value: '33', label: 'Bienvenida' });
});

test('la ruta de la tarea: publicar y comentar pasan por TODAS sus puertas, y lo publicado se VERIFICA antes de guardar', () => {
  const src = leer('app/api/compartido/curso/tarea/route.ts');
  const i = (s: string) => src.indexOf(s);
  const rama = i('if (b.comunidad !== undefined)');
  assert.ok(rama > 0, 'no encontré la rama de la comunidad');
  // Después de la firma, el resolver, la clase con su candado y el área: las puertas de siempre.
  for (const puerta of ['leerTokenPortal(token)', 'resolverAccesoPortal(token)', 'claseDelAlumno(acceso.leadId, claseId, { exigeAbierta: true', 'areaDeLaTarea(r.clase']) {
    assert.ok(i(puerta) > 0 && i(puerta) < rama, `la comunidad antes de ${puerta}`);
  }
  assert.match(src, /pedido\.accion !== 'ver' && !rateLimit\(`curso-tarea-comunidad:lead:\$\{acceso\.ws\}:\$\{acceso\.leadId\}`, 6, 60_000\)/, 'un tope propio para escribir');
  assert.match(src, /await accionDeComunidad\(token, r\.clase, pedido\)/);
  // Lo que manda el navegador como «ya publiqué» se verifica contra la base, ANTES del guardado de los valores.
  const verif = i('verificarComunidad(campos, crudo, previa?.valores ?? null, { ws: acceso.ws, productoId: r.clase.productoId, leadId: acceso.leadId })');
  assert.ok(verif > 0, 'la ruta no verifica lo publicado');
  assert.ok(verif < i('guardarTarea(acceso.leadId, r.clase, crudo'), 'verifica ANTES de guardar');
  // Y la línea que la enchufa: se corre con la tarea que tiene campos de comunidad, y lo que se guarda es lo verificado.
  assert.match(src, /if \(conComunidad\) \{\s*crudo = \(await verificarComunidad\(/);
  assert.match(src, /const conComunidad = campos\.some\(\(c\) => esCampoDeComunidad\(c\.tipo\)\);/);
  assert.match(src, /const leida = conQuiz \|\| conArchivos \|\| conComunidad;/, 'lo guardado se lee para comparar');
});

test('lib/curso-tarea-comunidad: publica y comenta con las funciones de la comunidad; la categoría y el post salen del CAMPO', () => {
  const src = leer('lib/curso-tarea-comunidad.ts');
  assert.match(src, /^import 'server-only';/m);
  assert.match(src, /await publicarPost\(actor, \{ titulo: pedido\.titulo, cuerpo: pedido\.cuerpo, categoriaId \}\)/);
  assert.match(src, /await comentar\(actor, objetivo\.id, \{ cuerpo: pedido\.cuerpo \}\)/);
  assert.doesNotMatch(src, /\.insert\(/, 'una segunda escritura de un post es la que se olvida de avisar');
  assert.doesNotMatch(src, /pedido\.categoriaId|pedido\.postId/, 'la categoría o el post del PEDIDO');
  assert.match(src, /const actor = await actorDelAlumno\(token, clase\.productoId\);\s*if \(!actor\) return \{ ok: false, status: 403/);
  // La verificación: el post (o el comentario) de ESTE alumno en ESTE producto.
  const v = src.slice(src.indexOf('export async function verificarComunidad('));
  assert.match(v, /\.eq\('producto_id', dueno\.productoId\)\.eq\('id', ref\.postId\)\.eq\('miembro', miembro\)/);
  assert.match(v, /\.eq\('id', ref\.comentarioId!\)\.eq\('post_id', ref\.postId\)\.eq\('miembro', miembro\)/);
  assert.match(v, /const miembro = claveDeLead\(dueno\.leadId\);/);
  // La vista del equipo (la ficha) lleva el link al post, y la tab Comunidad lo abre.
  const ficha = leer('app/customer-success/curso/RespuestaTarea.tsx');
  assert.match(ficha, /<Link className="rt-link" href=\{`\/customer-success\/comunidad\?post=\$\{r\.postId\}`\}>Ver post<\/Link>/);
  const pag = leer('app/customer-success/comunidad/page.tsx');
  assert.match(pag, /postInicial=\{postInicial\}/);
  assert.match(leer('app/_comunidad/Comunidad.tsx'), /useState<number \| null>\(postInicial\)/);
});

// ── Roturas de los ajustes del 08/10/2026 (pista LECCIÓN) ───────────────────
// Arnés scratchpad/leccion20/romper.mjs (UNA rotura por vez sobre el archivo real, restaurada de
// MEMORIA y comprobada con md5; nunca con git). Base: 35 pass / 0 fail. Cada una, 34 / 1 con SU test:
//   · el texto de ejemplo guardado en cualquier tipo · sin su tope                 → «el texto de ejemplo…»
//   · `placeholder={campo.label}` en la línea del alumno                           → «la pregunta es el TÍTULO…»
//   · el campo nuevo al FINAL · `camposEnOrden` perdiendo el que no venía          → «+ Nuevo campo…»
//   · mover sin avisar 'movido' (sin Deshacer) · sin la foto vacía del arrastre     → «el campo es una tarjeta…»
//   · `refDeComunidad` aceptando «42/0» · `sanearValores` guardando cualquier texto → «la comunidad: la referencia…»
//   · el elegido fuera de las opciones del desplegable                              → «los desplegables…»
//   · sin el tope propio de publicar · `if (false)` alrededor de `verificarComunidad` (el guard de la línea
//     que la enchufa se sumó para esta rotura: los de orden miran que el llamado esté ESCRITO, y con el
//     `if (false)` lo sigue estando)                                               → «la ruta de la tarea…»
//   · la categoría del PEDIDO · la verificación del post sin el `miembro` · la ficha sin `?post=` → «lib/curso-tarea-comunidad…»
