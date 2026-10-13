// =============================================================================
// El dibujo de un curso con el diseño de Conocimientos (app/_cursos/) y sus dos adaptadores
// =============================================================================
// Desde el 07/10/2026 el portal del alumno y la tab Curso se dibujan con app/_cursos/CursoUgc.tsx
// («No se ve para nada igual, COPIA lo que ya hicimos en CONOCIMIENTOS», Martín). Lo que se
// EJECUTA acá: las reglas puras del dibujo (app/_cursos/reglas.ts) y las dos traducciones a su
// modelo (app/compartido/curso/[token]/modelo-ugc.ts y app/customer-success/curso/modelo-ugc.ts).
// Lo que se LEE del fuente: que no haya caracteres de 3 bytes en el código del dibujo, que sus
// estilos no se derramen sobre Conocimientos, y que las dos pantallas lo monten de verdad.
//
// ── Roturas (07/10/2026) ─────────────────────────────────────────────────────
// Con todo en su lugar: 13 pass / 0 fail. Rompiendo UNA cosa por vez sobre el archivo real
// (restaurado desde una copia en el scratchpad y comparado con `cmp`), cada rotura tumbó SU test:
//   · `clasesDelPortal` listando las clases de una etapa con candado        → 12 / 1
//   · `claseDeArranque` sin la prioridad de la propuesta de la IA            → 12 / 1
//   · `chipVisto` diciendo «0% visto» sobre un video que no se mide          → 12 / 1
//   · `puedeMoverEnEditor` dejando ordenar las huérfanas                     → 12 / 1
//     (la primera versión pasaba en VERDE: con UNA huérfana, la primera tampoco sube por
//     posición. Por eso el fixture lleva dos y se pregunta por la segunda.)
//   · una regla de app/_cursos/estilos.ts sin el acote `.ahdoc--ugc`         → 12 / 1
//   · una flecha cruda (no escapada) en el código de CursoUgc                → 12 / 1
//   · el portal volviendo a su propio dibujo (sin `<CursoUgc`)               → 12 / 1
//
// 08/10/2026 (D1 y D2): el portal arma MÓDULOS (`ProductoVista.modulos`), con los sueltos y los
// candados. Los fixtures de etapas pasaron a módulos vinculados con las mismas aserciones; se suman
// el suelto, el motivo del candado y la clase cerrada adentro de un módulo abierto. Roturas:
//   · `modulosDelPortal` sin pasar el `motivo`                              → 13 / 1
//   · `claseDeArranque` llevando a una clase CERRADA                        → 13 / 1
//   · `estadoDeModulo` marcando «hecha» a un suelto                         → 13 / 1
//   (sobre 14; scratchpad/nucleo/romper.mjs, restaurado de memoria)
// REVISIÓN del 08/10/2026 (scratchpad/rev-nucleo/romper-final.mjs). Sin romper 15 / 0; cada una dio
// 14 / 1 en «dónde está y cuánto lleva…»: `etapaActual` cayendo al ÚLTIMO módulo (lo de antes) ·
// `avanceDelCurso` contando sólo etapas `hecha` (lo de antes) · un suelto vacío contando como hecho ·
// la portada sin llamar a `avanceDelCurso`.
// EL EDITOR DE LA ESTRUCTURA (08/10/2026, la sección del final; scratchpad/editor/roturas.mjs, que
// restaura deshaciendo el reemplazo sobre el disco). Sin romper 23 / 0; cada rotura dio 22 / 1 en SU test:
//   · «Módulos»: el editor vuelve a «Etapas» · el portal a «Las etapas» · las huérfanas a «Sin etapa»
//   · la barra vuelve a decir el tiempo
//   · salir del campo de «+ Nuevo módulo» con algo escrito lo crea
//   · el arrastre: una foto propia en vez de la del Plan · la copia colgada del `body` · el setState
//     del hueco en cada `dragover` · el molde del Plan sin dónde colgar la copia · los controles de la
//     tarjeta sin `data-nodrag`
//   · láminas: la miniatura del video tapándola · el portal sin pasarla · la tarjeta siempre con el cuaderno
//   · el Avance de vuelta adentro del curso · el redirect del link viejo sin el `?ws=`
//   · «Invitar alumnos» del menú de la marca sin abrir el modal
//   · el `overflow` de vuelta en `body:has(.ahdoc)` (la sidebar de MaKo)
// LA LECCIÓN (08/10/2026, paso LECCIÓN; scratchpad/leccion/romper.mjs, restaurado de memoria con md5):
// sin romper 23 / 0; un chip «Por grabar» de vuelta en `chipsDelEditor` dio 22 / 1 en «editor: los
// chips del equipo…». Las roturas de la lección misma están en tests/curso-leccion.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProductoVista, ModuloVista, ClaseVista, EstadoEtapa } from '../lib/curso-portal';
import type { Clase } from '../lib/curso';
import { ROTULO_TAREA, tapaDeVideo } from '../lib/curso';
import type { ClaseUgc, ModuloUgc } from '../app/_cursos/tipos';
import { estiloVacio } from '../lib/curso-estilo';
import { clasesVisibles, pctAvance, textoBarraModulo, vecinas, moduloMarcado } from '../app/_cursos/reglas';
import { CSS_UGC } from '../app/_cursos/estilos';
// El editor de la estructura (08/10/2026): ver la sección del final.
import { readdirSync } from 'node:fs';
import { TEXTOS_DEFAULT, textoTarjetaModulo } from '../app/_cursos/reglas';
import { TEXTOS_PORTAL } from '../app/compartido/curso/[token]/modelo-ugc';
import { TEXTOS_EDITOR } from '../app/customer-success/curso/modelo-ugc';
import {
  agendaVigente, avanceDelCurso, chipTarea, chipVisto, claseDeArranque, clasesDelPortal, etapaActual, marcaDelProducto, modulosDelPortal,
} from '../app/compartido/curso/[token]/modelo-ugc';
import {
  SIN_ETAPA, chipsDelEditor, cierraLaEtapa, clasesDelEditor, modulosDelEditor, puedeMoverEnEditor,
} from '../app/customer-success/curso/modelo-ugc';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── Fixtures ─────────────────────────────────────────────────────────────────

const claseV = (id: number, o: Partial<ClaseVista> = {}): ClaseVista => ({
  id, titulo: `Clase ${id}`, descripcion: '', descripcionHtml: '', minutos: null, video: null, pct: null, tarea: '', campos: [],
  tieneTarea: false, obligatoria: false, estado: 'pendiente', valores: {}, hecha: false, completa: false, ...o,
});
/** Un módulo VINCULADO en la etapa `estado`; `bloqueada` = cerrado por su candado de siempre. */
const etapaV = (key: string, estado: EstadoEtapa, clases: ModuloVista['clases'], o: Partial<ModuloVista> = {}): ModuloVista => ({
  key, label: key.toUpperCase(), vinculado: true, etapa: estado, abierto: estado !== 'bloqueada',
  ...(estado === 'bloqueada' ? { motivo: 'Se abre al terminar «Arranque»' } : {}),
  clases: estado === 'bloqueada' ? [] : clases, cuantas: clases.length,
  obligatorias: 0, enviadas: 0, tareas: 0, tareasEnviadas: 0, completo: false, ...o,
});
const producto = (modulos: ModuloVista[]): ProductoVista => ({ productoId: 1, nombre: 'Negocio que Escala', modulos, estilo: estiloVacio() });

const clase = (id: number, etapa: string, orden: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa, orden, titulo: `C${id}`, descripcion: '', tipo: 'video', minutos: null,
  videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
} as Clase);

// ── Las reglas puras del dibujo ──────────────────────────────────────────────

test('un módulo con candado no lista nada aunque la URL lo pida, y abrir uno filtra por su IDENTIDAD', () => {
  const modulos: ModuloUgc[] = [
    { key: 'a', nombre: 'A', n: 1, cuantas: 1 },
    { key: 'b', nombre: 'B', n: 2, cuantas: 1, estado: 'bloqueada' },
  ];
  const clases: ClaseUgc[] = [{ id: 1, moduloKey: 'a', titulo: 'Uno' }, { id: 2, moduloKey: 'b', titulo: 'Dos' }];
  assert.deepEqual(clasesVisibles(clases, modulos, 'b', '')!.length, 0);
  assert.deepEqual(clasesVisibles(clases, modulos, 'a', '')!.map((c) => c.id), [1]);
  assert.equal(clasesVisibles(clases, modulos, null, ''), null, 'sin módulo ni búsqueda va el índice');
  assert.equal(moduloMarcado(clases[0], null), 'a', 'adentro de una clase se marca su módulo');
});

test('la barra cuenta el avance si lo hay, la barra de % no pasa de 100, y Anterior/Siguiente siguen el curso', () => {
  assert.equal(textoBarraModulo({ key: 'a', nombre: 'A', n: 1, cuantas: 4, progreso: { hechas: 1, total: 3 } }), '1/3');
  assert.equal(pctAvance({ hechas: 9, total: 3 }), 100);
  assert.equal(pctAvance({ hechas: 1, total: 0 }), 0);
  const cs: ClaseUgc[] = [{ id: 1, moduloKey: 'a', titulo: '' }, { id: 2, moduloKey: 'b', titulo: '' }];
  assert.equal(vecinas(cs, 1).siguiente?.id, 2, 'terminar el último de un módulo lleva al primero del siguiente');
});

// ── El portal del alumno ─────────────────────────────────────────────────────

test('portal: las etapas son módulos con su estado; la de candado se dibuja y sus clases no se listan', () => {
  const p = producto([
    etapaV('bienvenida', 'hecha', [claseV(1), claseV(2)], { tareas: 1, tareasEnviadas: 1 }),
    etapaV('arranque', 'actual', [claseV(3)]),
    etapaV('ritmo', 'bloqueada', [claseV(4), claseV(5)]),
  ]);
  const m = modulosDelPortal(p);
  assert.deepEqual(m.map((x) => [x.key, x.n, x.estado, x.cuantas]), [
    ['bienvenida', 1, 'hecha', 2], ['arranque', 2, 'actual', 1], ['ritmo', 3, 'bloqueada', 2],
  ]);
  assert.deepEqual(m[0].progreso, { hechas: 1, total: 1 });
  assert.equal(m[1].progreso, undefined, 'una etapa sin tareas no lleva barra de avance');
  assert.equal(m[2].motivo, 'Se abre al terminar «Arranque»', 'el candado dice por qué');
  assert.equal(m[1].motivo, undefined);
  const cs = clasesDelPortal(p);
  assert.deepEqual(cs.map((c) => [c.ugc.id, c.ugc.moduloKey, c.ugc.vn]), [
    [1, 'bienvenida', 1], [2, 'bienvenida', 2], [3, 'arranque', 1],
  ]);
});

test('portal: dónde está y cuánto lleva, con un SUELTO y con su etapa fuera del curso (revisión 08/10)', () => {
  // Desde D1 un cliente puede estar en una etapa que NO es módulo (la que quedó al desvincular uno):
  // ningún módulo es «actual». Antes caía al ÚLTIMO del curso («Etapa 3 de 3» a mitad del programa).
  const suelto = (key: string, o: Partial<ModuloVista> = {}): ModuloVista => ({
    ...etapaV(key, 'actual', [claseV(8)]), vinculado: false, etapa: undefined, ...o,
  });
  const enMedio = producto([etapaV('a', 'hecha', [claseV(1)]), suelto('m_s'), etapaV('c', 'bloqueada', [claseV(3)])]);
  assert.deepEqual([etapaActual(enMedio).etapa?.key, etapaActual(enMedio).i], ['a', 0], 'el último que ya pasó');
  const alPrincipio = producto([etapaV('a', 'bloqueada', [claseV(1)]), etapaV('b', 'bloqueada', [claseV(2)])]);
  assert.deepEqual([etapaActual(alPrincipio).etapa?.key, etapaActual(alPrincipio).i], ['a', 0], 'si no pasó ninguno, el primero');
  assert.equal(etapaActual(producto([etapaV('a', 'hecha', []), etapaV('b', 'actual', [])])).etapa?.key, 'b');
  // La barra: un suelto cuenta al completarse (y uno vacío no); con sólo «etapa hecha» no se llenaba nunca.
  const todo = producto([etapaV('a', 'hecha', []), suelto('m_s', { completo: true }), suelto('m_vacio', { completo: true, cuantas: 0, clases: [] })]);
  assert.deepEqual(avanceDelCurso(todo), { hechas: 2, total: 3 });
  assert.deepEqual(avanceDelCurso(producto([etapaV('a', 'hecha', []), suelto('m_s', { completo: false })])), { hechas: 1, total: 2 });
  // Y la portada la USA (una función sin call site es una salida que nadie pide).
  assert.match(sinComentarios(leer('app/compartido/curso/[token]/PortalAlumno.tsx')), /progreso: lider \? undefined : avanceDelCurso\(producto\),/);
});

test('portal: aunque una etapa con candado TRAIGA clases, no se listan (abrirlas sería saltearla)', () => {
  const e = etapaV('ritmo', 'bloqueada', []);
  e.clases = [claseV(9)];
  assert.equal(clasesDelPortal(producto([e])).length, 0);
});

test('portal: el botón de la portada lleva a la propuesta de la IA, después a la tarea pendiente de la actual', () => {
  const ia = claseV(2, { tieneTarea: true, estado: 'enviada', ia: { valores: {}, desde: '2026-10-07' } });
  const p = producto([
    etapaV('bienvenida', 'hecha', [claseV(1), ia]),
    etapaV('arranque', 'actual', [claseV(3), claseV(4, { tieneTarea: true })]),
  ]);
  const cs = clasesDelPortal(p);
  assert.equal(claseDeArranque(cs, 'arranque'), 2, 'la versión de la IA esperando su ok va primero');
  const sinIa = { propuesta: () => false, estado: (c: ClaseVista) => c.estado };
  assert.equal(claseDeArranque(cs, 'arranque', sinIa), 4, 'resuelta la propuesta, la tarea pendiente de la actual');
  assert.equal(claseDeArranque(cs, 'arranque', { propuesta: () => false, estado: () => 'enviada' }), 3,
    'sin nada pendiente, la primera clase de la etapa actual');
});

test('portal: un módulo SUELTO se dibuja abierto y sin marca de etapa; una clase CERRADA adentro se lista y no es destino', () => {
  const suelto: ModuloVista = {
    key: 'm_bonus', label: 'Bonus', vinculado: false, abierto: true,
    clases: [{ id: 7, titulo: 'Cerrada', cerrada: true, motivo: 'Se abre el 12 de octubre' }, claseV(8, { tieneTarea: true })],
    cuantas: 2, obligatorias: 0, enviadas: 0, tareas: 1, tareasEnviadas: 0, completo: false,
  };
  const p = producto([etapaV('arranque', 'actual', [claseV(3)]), suelto]);
  const m = modulosDelPortal(p);
  assert.equal(m[1].estado, undefined, 'un suelto no está «hecho» ni es «el actual»: no es una etapa');
  const cs = clasesDelPortal(p);
  assert.deepEqual(cs.map((c) => [c.ugc.id, c.ugc.moduloKey, c.ugc.vn]), [[3, 'arranque', 1], [7, 'm_bonus', 1], [8, 'm_bonus', 2]]);
  const cerrada = cs.find((c) => c.ugc.id === 7)!;
  assert.ok(!cerrada.ugc.conVideo, 'una cerrada no promete un video');
  assert.equal(JSON.stringify(cerrada.vista), JSON.stringify(suelto.clases[0]), 'de la cerrada viaja lo que vino, nada más');
  // El botón de la portada no lleva nunca a una cerrada, aunque su módulo sea «el actual».
  assert.equal(claseDeArranque(cs, 'm_bonus', { propuesta: () => false, estado: () => 'pendiente' }), 8);
  assert.equal(claseDeArranque([cerrada], 'm_bonus'), undefined, 'sólo cerradas: no hay a dónde llevar');
});

test('portal: los chips no mienten — «Sin medir» nunca «0%», y la revisada dice el rótulo del equipo', () => {
  assert.deepEqual(chipVisto(null), { tono: 'neutro', texto: 'Sin medir' });
  assert.deepEqual(chipVisto(0), { tono: 'neutro', texto: 'Sin ver' });
  assert.equal(chipVisto(100).texto, 'Visto');
  assert.equal(chipTarea('aprobada').texto, ROTULO_TAREA.aprobada);
  assert.equal(chipTarea('pendiente').tono, 'aviso');
});

test('portal: la marca es el PRODUCTO con la última palabra en lima, y la agenda de arriba es la de la última terminada', () => {
  assert.deepEqual(marcaDelProducto('Negocio que Escala'), { texto: 'Negocio que ', resaltado: 'Escala' });
  assert.deepEqual(marcaDelProducto('Programa'), { texto: 'Programa' });
  const p = producto([
    etapaV('a', 'hecha', [], { agendaUrl: 'https://cal.com/a' }),
    etapaV('b', 'hecha', [], { agendaUrl: 'https://cal.com/b' }),
    etapaV('c', 'actual', []),
  ]);
  assert.equal(agendaVigente(p)?.key, 'b');
  assert.equal(agendaVigente(producto([etapaV('a', 'actual', [])])), null);
});

test('la tapa de una clase sale de su video: YouTube, Drive, Loom y Vimeo (por nuestra ruta); un archivo no', () => {
  assert.equal(tapaDeVideo({ tipo: 'youtube', id: 'dQw4w9WgXcQ' }), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(tapaDeVideo({ tipo: 'iframe', embed: 'https://drive.google.com/file/d/AbC_1/preview' }),
    'https://drive.google.com/thumbnail?id=AbC_1&sz=w800');
  // Item 20 del 08/10/2026: Loom publica la suya en su CDN (la `thumbnail_url` de su oEmbed, medido), y la
  // de Vimeo la busca nuestra ruta (tests/curso-leccion.test.ts). Un embed de Loom con un id que no lo es, nada.
  // Probado rompiéndolo (scratchpad/leccion20/romper.mjs): Vimeo sin tapa → 23 / 1, cae ESTE test.
  assert.equal(tapaDeVideo({ tipo: 'iframe', embed: 'https://www.loom.com/embed/abc123def' }), 'https://cdn.loom.com/sessions/thumbnails/abc123def-00001.jpg');
  assert.equal(tapaDeVideo({ tipo: 'iframe', embed: 'https://www.loom.com/embed/x' }), null);
  assert.equal(tapaDeVideo({ tipo: 'vimeo', embed: 'https://player.vimeo.com/video/1084537' }), '/api/compartido/miniatura?vimeo=1084537');
  assert.equal(tapaDeVideo({ tipo: 'archivo' }), null);
  assert.equal(tapaDeVideo(null), null);
});

// ── La tab Curso ─────────────────────────────────────────────────────────────

test('editor: las huérfanas van a «Sin etapa», al final, y no se ordenan', () => {
  const etapas = [{ key: 'bienvenida', label: 'Bienvenida' }, { key: 'arranque', label: 'Arranque' }];
  const porEtapa = { bienvenida: [clase(1, 'bienvenida', 0, { minutos: 10 }), clase(2, 'bienvenida', 1, { minutos: 5 })], arranque: [] };
  const huerfanas = [clase(3, 'borrada', 0), clase(4, 'borrada', 1)];
  const m = modulosDelEditor(etapas, porEtapa, huerfanas);
  assert.deepEqual(m.map((x) => [x.key, x.n, x.cuantas]), [['bienvenida', 1, 2], ['arranque', 2, 0], [SIN_ETAPA, 3, 2]]);
  assert.equal(m[0].rotuloExtra, '15 min');
  const cs = clasesDelEditor(etapas, porEtapa, huerfanas);
  assert.deepEqual(cs.map((c) => [c.id, c.moduloKey, c.vn]), [[1, 'bienvenida', 1], [2, 'bienvenida', 2], [3, SIN_ETAPA, 1], [4, SIN_ETAPA, 2]]);
  assert.equal(puedeMoverEnEditor(cs, 1, 'abajo'), true);
  assert.equal(puedeMoverEnEditor(cs, 1, 'arriba'), false, 'la primera de su etapa no sube');
  // La SEGUNDA huérfana: por posición podría subir, y no se ordena igual (su etapa no existe).
  assert.equal(puedeMoverEnEditor(cs, 4, 'arriba'), false, 'una huérfana no se ordena');
  assert.equal(modulosDelEditor(etapas, porEtapa, []).length, 2, 'sin huérfanas no hay «Sin etapa»');
});

test('editor: los chips del equipo dicen qué le falta y qué pide la clase; ni «Grabar» ni notas (08/10), y «Obligatoria» sólo en un vinculado', () => {
  const c = clase(1, 'a', 0, { tarea: 'Completa', obligatoria: true });
  // Desde el 08/10/2026 (items 13 y 15) la marca de grabar y las notas se fueron de la tab: la
  // tarjeta dice lo que la CLASE tiene, nada más.
  const textos = chipsDelEditor(c, true).map((x) => x.texto);
  // «Obligatoria»: el nombre del interruptor de la lección («Obligatoria para avanzar»), corto. Era
  // «Cierra el módulo», que Martín no entendió (item 9 del 08/10/2026).
  assert.deepEqual(textos, ['Sin video', 'Tarea', 'Obligatoria']);
  assert.ok(!textos.some((t) => /grabar|nota/i.test(t)), 'volvió un chip de grabar o de notas');
  // En un SUELTO la marca se conserva y no cierra nada: el chip no lo afirma.
  assert.deepEqual(chipsDelEditor(c, false).map((x) => x.texto), ['Sin video', 'Tarea']);
  assert.equal(cierraLaEtapa([c]), true);
  assert.equal(cierraLaEtapa([clase(2, 'a', 0, { obligatoria: true })]), false, 'obligatoria SIN tarea no cierra');
});

test('editor: el chip cuenta las TAREAS que ve el alumno — la principal vacía no es una (revisión final, 08/10/2026)', () => {
  // `tareasDeClase` devuelve la principal aunque esté vacía cuando hay secciones (el editor la necesita);
  // contada, una clase con UNA sección decía «2 tareas» sobre lo que el alumno ve como una.
  // Probado rompiéndolo: contar `tareasDeClase(c).length` pelado → 24 / 1 (este test).
  const seccion = { id: 's1', label: 'Tu web', tipo: 'seccion' as const };
  const pregunta = { id: 'q1', label: '¿Qué vendes?', tipo: 'linea' as const };
  const textos = (o: Partial<Clase>) => chipsDelEditor(clase(3, 'a', 0, o), false).map((x) => x.texto);
  assert.deepEqual(textos({ campos: [seccion, pregunta] }), ['Sin video', 'Formulario · 1']);
  assert.deepEqual(textos({ tarea: 'Lee esto', campos: [seccion, pregunta] }), ['Sin video', '2 tareas']);
  assert.deepEqual(textos({ campos: [pregunta, seccion] }), ['Sin video', '2 tareas']);
});

// ── Lo que se lee del fuente ─────────────────────────────────────────────────

test('el CÓDIGO de CursoUgc no tiene caracteres de 3 bytes (van escapados): un reemplazo los volvió rombos una vez', () => {
  const codigo = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  const malos = [...codigo].filter((ch) => ch.codePointAt(0)! >= 0x800);
  assert.deepEqual(malos, [], `caracteres de 3 bytes en el código: ${[...new Set(malos)].join(' ')}`);
});

test('los estilos del dibujo van acotados a .ahdoc--ugc: no pueden tocar a Conocimientos, que no lo monta', () => {
  const css = CSS_UGC.replace(/\/\*[\s\S]*?\*\//g, '');
  // Cada preludio antes de una llave: así entran también los selectores de ADENTRO de un @media o
  // un @supports. La primera versión partía por '}' y se quedaba con el arranque del bloque, o sea
  // `@media (...)`, y nunca miraba lo de adentro (revisión del 07/10/2026).
  const selectores = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim())
    .filter((p) => p && !p.startsWith('@')).flatMap((p) => p.split(',')).map((p) => p.trim()).filter(Boolean);
  assert.ok(selectores.length > 40, `leí ${selectores.length} selectores: el parser quedó corto`);
  const sueltos = selectores.filter((s) => !s.startsWith('.ahdoc.ahdoc--ugc') && !/^(html|body):has\(\.ahdoc--embebido\)$/.test(s));
  assert.deepEqual(sueltos, []);
  assert.ok(!CSS_UGC.includes('`') && !CSS_UGC.includes('${'));
});

test('las dos pantallas montan el dibujo (y ninguna volvió a uno propio)', () => {
  const portal = sinComentarios(leer('app/compartido/curso/[token]/PortalAlumno.tsx'));
  assert.match(portal, /<CursoUgc\b/);
  assert.match(portal, /modo=\{vistaPrevia \? 'embebido' : 'pagina'\}/, 'la vista previa va embebida debajo de su barra');
  assert.doesNotMatch(portal, /className="cp-etapa|className="cp-clase/, 'volvió el acordeón de etapas');
  const editor = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  // Desde el 07/10/2026 la tab Curso ES el curso, como Conocimientos: pantalla completa y sin la
  // cabecera de la app («que no aparezca absolutamente nada... ni el título», Martín).
  assert.match(editor, /<CursoUgc\b[\s\S]*?modo="pagina"/);
  const principal = editor.slice(editor.indexOf('<Pagina ancho="completo"'));
  assert.ok(principal.length > 500, 'no encontré la pantalla principal de la tab');
  assert.doesNotMatch(principal, /<PageHeader/, 'volvió la barra de arriba de la tab Curso');
  assert.match(editor, /edicion=\{puedeEditar \? \{/, 'los controles de editar son sólo de un admin');
  assert.doesNotMatch(editor, /function ListaClases/, 'volvió la lista de filas');
});

// ── El editor de la ESTRUCTURA (08/10/2026, pedido del 07/10: items 2, 4, 5, 7, 9, 11 y 12) ──────
// Lo que el dibujo hace para quien arma el curso (los «+» primero, el arrastre del Plan, los nombres)
// y lo que la tab dejó de tener (el Avance). La lógica de dónde cae lo arrastrado y del candado se
// EJECUTA en tests/curso-editor.test.ts.

/** El bloque que arranca en `desde` y termina en el primer `hasta` después de él. */
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

/** El código de una función del dibujo, hasta la siguiente. */
const funcion = (src: string, nombre: string, siguiente: string) => {
  const i = src.indexOf(`function ${nombre}(`);
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const j = src.indexOf(`function ${siguiente}(`, i);
  assert.ok(j > i, `no encontré ${siguiente} después de ${nombre}`);
  return src.slice(i, j);
};

test('«Módulos» y no «Etapas» adentro del curso, en el editor y en el portal (item 11)', () => {
  for (const [quien, textos] of [['dibujo', TEXTOS_DEFAULT], ['editor', TEXTOS_EDITOR], ['portal', TEXTOS_PORTAL]] as const) {
    const etapa = Object.entries(textos).filter(([, v]) => /etapa/i.test(String(v)));
    assert.deepEqual(etapa, [], `${quien}: todavía dice etapa`);
  }
  assert.equal(TEXTOS_EDITOR.modulo, 'Módulo', 'el rótulo de la lámina');
  const huerfanas = modulosDelEditor([{ key: 'a', label: 'A' }], { a: [] }, [clase(3, 'borrada', 0)]);
  assert.equal(huerfanas.at(-1)!.nombre, 'Sin módulo');
  const portal = sinComentarios(leer('app/compartido/curso/[token]/PortalAlumno.tsx'));
  assert.doesNotMatch(portal, /`Etapa \$\{/, 'el portal todavía dice «Etapa N»');
});

test('la barra de los módulos cuenta SÓLO las clases, sin el tiempo; la tarjeta sí lo dice (item 11)', () => {
  const m: ModuloUgc = { key: 'a', nombre: 'A', n: 1, cuantas: 4, rotuloExtra: '71 min' };
  assert.equal(textoBarraModulo(m), '4');
  assert.equal(textoTarjetaModulo(m, TEXTOS_DEFAULT), '4 lecciones · 71 min');
  // Y la barra sigue diciendo el avance cuando lo hay (es lo que cambia).
  assert.equal(textoBarraModulo({ ...m, progreso: { hechas: 1, total: 3 } }), '1/3');
});

test('«+ Nuevo módulo» y «+ Nueva clase» van PRIMERO, antes de las tarjetas (item 12)', () => {
  const src = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  const indice = funcion(src, 'Indice', 'TarjetaModulo');
  const nuevo = indice.indexOf('<NuevoModulo ');
  assert.ok(nuevo > 0, 'el índice no dibuja «+ Nuevo módulo»');
  assert.ok(nuevo < indice.indexOf('{modulos.map('), '«+ Nuevo módulo» quedó después de las tarjetas');
  const grilla = funcion(src, 'Grilla', 'Leccion');
  const nueva = grilla.indexOf('ugc-modcard--nueva');
  assert.ok(nueva > 0, 'la grilla no dibuja «+ Nueva clase»');
  assert.ok(nueva < grilla.indexOf('{clases.map('), '«+ Nueva clase» quedó después de las tarjetas');
  assert.equal(TEXTOS_DEFAULT.nueva, '+ Nueva clase');
  assert.equal(TEXTOS_DEFAULT.nuevoModulo, '+ Nuevo módulo');
  // El nombre del módulo nuevo se pide EN SU LUGAR, y salir con algo escrito NO lo crea (crearía una
  // etapa del kanban por un clic que se fue a otro lado): sólo Enter o «Crear».
  const nm = src.slice(src.indexOf('function NuevoModulo('));
  assert.ok(nm.length > 300, 'no encontré NuevoModulo');
  assert.match(nm, /if \(!creando && !nombre\.trim\(\) && !\(n && caja\.current\?\.contains\(n\)\)\) cerrar\(\);/);
  assert.match(nm, /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); void crear\(\); \}/);
});

test('el arrastre es el del PLAN: importa sus helpers y no los copia (item 7)', () => {
  const arr = sinComentarios(leer('app/_cursos/arrastre-curso.ts'));
  assert.match(arr, /import \{[^}]*\bfotoVaciaDeArrastre\b[^}]*\buseArrastreCopia\b[^}]*\} from '@\/app\/plan\/board\/arrastre-copia';/);
  assert.match(arr, /fotoVaciaDeArrastre\(e\.dataTransfer\);/);
  // La copia se cuelga del `.ugc` (la hoja del curso viste todo bajo `.ahdoc .ugc`) y el molde lo acepta.
  assert.match(arr, /montarCopia\(nodo, e\.clientX - r\.left, e\.clientY - r\.top, raiz\);/);
  assert.match(sinComentarios(leer('app/plan/board/arrastre-copia.ts')), /\(dentroDe \?\? document\.body\)\.appendChild\(nodo\);/);
  // Un setState del hueco por `dragover` redibuja el curso sesenta veces por segundo: sólo si cambió.
  assert.match(arr, /if \(mismoDestino\(destinoRef\.current, d\)\) return;/);
  // NINGÚN archivo del dibujo arma su propia foto ni su propia copia: eso es copiar el molde.
  for (const f of readdirSync(join(RAIZ, 'app/_cursos')).filter((x) => /\.tsx?$/.test(x))) {
    const s = sinComentarios(leer(`app/_cursos/${f}`));
    assert.doesNotMatch(s, /setDragImage\(|createElement\('canvas'\)|rotate\(1\.5deg\)/, `${f} copia el arrastre del Plan`);
  }
  // Y el dibujo lo usa en sus tres zonas, con lo que no arrastra marcado.
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  assert.match(ugc, /const arr = useArrastreCurso\(\{/);
  for (const z of ['rail', 'barra', 'grilla']) assert.ok(ugc.includes(`arr.zona('${z}')`), `la zona «${z}» no recibe nada`);
  assert.ok((ugc.match(/className="ugc-editable-ctrls"[^>]*data-nodrag/g) ?? []).length >= 2, 'los controles de las tarjetas arrastran la tarjeta');
});

test('portadas: la lámina elegida llega al dibujo y la miniatura del video no la tapa (item 5)', () => {
  const lam = 'lam:pizarra:2E4A3B:F4D35E:';
  const estilo = { ...estiloVacio(), portadasEtapa: { a: lam }, portadasClase: { 1: lam } };
  const m = modulosDelEditor([{ key: 'a', label: 'A' }], { a: [] }, [], estilo);
  assert.equal(m[0].lamina?.diseno, 'pizarra');
  const conVideo = clase(1, 'a', 0, { videoTipo: 'youtube', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  const c = clasesDelEditor([{ key: 'a', label: 'A' }], { a: [conVideo] }, [], estilo)[0];
  assert.equal(c.tapa, null, 'la miniatura del video taparía la lámina');
  assert.equal(c.lamina?.diseno, 'pizarra');
  const p = producto([etapaV('a', 'actual', [claseV(1, { video: { tipo: 'youtube', id: 'dQw4w9WgXcQ' } })])]);
  p.estilo = estilo;
  assert.equal(modulosDelPortal(p)[0].lamina?.diseno, 'pizarra', 'el alumno ve la lámina que eligió el equipo');
  assert.equal(clasesDelPortal(p)[0].ugc.tapa, null);
  // El dibujo la pinta en el lugar del cuaderno, y el chip del número sólo donde no tapa el diseño.
  const ugc = sinComentarios(leer('app/_cursos/CursoUgc.tsx'));
  assert.match(funcion(ugc, 'TarjetaModulo', 'TarjetaClase'), /\{m\.lamina\s*\? <Lamina /);
  assert.match(ugc, /conChipDeNumero\(m\.portada \|\| m\.fondo \? null : m\.lamina\)/);
  assert.match(ugc, /conChipDeNumero\(clase\.tapa \|\| clase\.fondo \? null : clase\.lamina\)/);
  // La pestaña «Diseños» del selector se abre para un módulo o una clase.
  assert.match(sinComentarios(leer('app/customer-success/curso/CursoApp.tsx')), /disenos=\{disenosDe\(picker\.ajuste\)\}/);
});

test('el Avance de los clientes SE FUE del curso a Clientes, y el link viejo redirige (item 4)', () => {
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.doesNotMatch(app, /entradasExtra=|<AvanceCurso\b|Avance de los clientes/, 'volvió el Avance adentro del curso');
  const page = sinComentarios(leer('app/customer-success/curso/page.tsx'));
  assert.match(page, /if \(sp\.vista === 'avance'\) \{\s*redirect\(await rutaConWs\(`\/customer-success\?vista=avance\$\{productoId \? `&producto=\$\{productoId\}` : ''\}`\)\);/,
    'un ?vista=avance viejo tiene que caer en la vista Avance de Clientes, con el ?ws=');
});

// 08/10/2026 (item 14, pista APARIENCIA): «Vista del alumno», «Invitar alumnos» y el «?» van arriba a la
// derecha, EN EL LUGAR del nombre del curso (`acciones`), y se fueron del menú de la marca: dos lugares
// para la misma acción partían la respuesta en dos. Lo del lugar lo fija tests/curso-apariencia.test.ts.
// Roturas (scratchpad/apariencia/romper.mjs, de memoria + md5): «Invitar alumnos» de vuelta en el menú de
// la marca → 23 / 1 (este test); la piel del «?» sin el acote de la barra → 23 / 1 («la piel del «?»…»).
test('invitar desde el editor: un modal, que abre el botón de arriba a la derecha (items 9 y 14)', () => {
  const app = sinComentarios(leer('app/customer-success/curso/CursoApp.tsx'));
  assert.match(app, /<button type="button" className="ugc-btn" data-recorrido="invitar" onClick=\{\(\) => setInvitando\(true\)\}>Invitar alumnos<\/button>/);
  assert.doesNotMatch(bloque(app, 'const menuMarca = ', 'if (!servicio)'), /Invitar alumnos|Vista del alumno/, 'volvieron al menú de la marca');
  assert.match(app, /\{invitando && \(\s*<ModalInvitarAlumnos productoId=\{servicio\.productoId\}/);
  assert.match(app, /acciones=\{barraDeArriba\}/);
  // La lista se prellena con el email del CRM.
  assert.match(sinComentarios(leer('app/customer-success/curso/page.tsx')), /email: c\.email \?\? null,/);
});

test('la sidebar de MaKo: con el curso abierto, el BODY no lleva overflow (item 2)', () => {
  // Un overflow en el body (con el html ya en hidden) lo vuelve un contenedor de scroll, y la sidebar
  // de MaKo (sticky) le suma su padding: con la barra de agencia quedaba un bloque en blanco arriba de
  // su logo (07/10/2026). Se lee la regla del body ENTERA, en la hoja y sin comentarios.
  const css = leer('public/cono-doc/ugc.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const reglas = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].split(',').some((s) => s.trim() === 'body:has(.ahdoc)'));
  assert.ok(reglas.length >= 1, 'no encontré la regla de body:has(.ahdoc)');
  for (const r of reglas) assert.doesNotMatch(r[2], /overflow/, `volvió el overflow al body: ${r[2].trim()}`);
});

// ── REVISIÓN FINAL del 08/10/2026 (scratchpad/rev-final) ─────────────────────
// Los pasos EDITOR y LECCIÓN escribieron cada uno su regla para `.mk-iconbtn` en app/_cursos/estilos.ts:
// la de la lección (los botones de la app ADENTRO del curso, transparentes) y la del editor (el «?» del
// recorrido en la barra de arriba, con borde y sombra). Con el mismo selector gana la de más abajo, así
// que las flechas y la cruz del formulario de una tarea salían de 36 px con borde grueso y sombra —
// medido en el banco de la lección: 36 × 36, «2px solid», sombra—. Arreglado acotando la del editor a
// `.ugc-topbar-extra`: el banco da los botones del formulario sin borde y el «?» igual que antes.
// Y el chip de la tarjeta decía «Cierra la etapa» donde el interruptor de la lección dice «Cierra el
// módulo», también en un suelto (donde no cierra nada): ver «editor: los chips del equipo…».
// Roturas (scratchpad/rev-final/romper.mjs, deshaciendo el reemplazo y comparando el md5): sin romper
// 24 / 0; la regla de la barra sin el acote → 23 / 1 (este test) · el chip sin mirar si el módulo es
// vinculado → 23 / 1 («editor: los chips del equipo…»).
test('la piel del «?» de la barra de arriba no se derrama sobre los botones de la lección', () => {
  const css = CSS_UGC.replace(/\/\*[\s\S]*?\*\//g, '');
  const reglas = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), cuerpo: m[2] }));
  const deIconbtn = reglas.filter((r) => r.sel.split(',').some((s) => /\.mk-iconbtn\b/.test(s)));
  assert.ok(deIconbtn.length >= 2, `leí ${deIconbtn.length} reglas de .mk-iconbtn: el parser quedó corto`);
  // Lo que da el tamaño y el borde grueso de la barra de arriba va SOLO bajo la barra de arriba.
  const conPiel = deIconbtn.filter((r) => /\bwidth\s*:|\bborder\s*:\s*2px/.test(r.cuerpo));
  assert.ok(conPiel.length >= 1, 'no encontré la piel del «?» de la barra de arriba');
  for (const r of conPiel) {
    // Desde el 08/10/2026 (item 14) el «?» de quien edita vive en `.ugc-topbar-acciones`: la misma piel,
    // acotada igual a la barra de arriba.
    for (const s of r.sel.split(',')) assert.match(s.trim(), /\.ugc-topbar-(?:extra|acciones) \.mk-iconbtn$/, `se derrama: ${s.trim()}`);
  }
});

// =============================================================================
// Las fuentes de la hoja del curso: lo que el origen self-hostea NO sirve acá
// =============================================================================
// `public/cono-doc/ugc.css` es GENERADA (scripts/avatarhype-css.mjs) desde la hoja del
// origen, y el origen es una app Next que self-hostea sus fuentes en
// `/_next/static/media/<hash>.woff2`. Ese hash es de SU build: en nuestro dominio la URL
// no existe y nunca va a existir.
//
// Medido el 13/10/2026 contra producción: los 38 `@font-face` que venían copiados daban
// **404**. Y como van DESPUÉS del `@import` de Google que la cabecera agrega, le ganaban:
// para cada peso que ellos declaraban, la cara buena quedaba tapada por una que no carga.
//
// El síntoma es el peor: la pantalla no se rompe, «se parece». Medido antes/después en
// Chrome sobre la misma página, con las 8 caras dibujadas:
//   ANTES   → Archivo 400 ✓ pero Archivo 700 ✖, Bricolage 700 ✖, Instrument Serif ✖,
//             Caveat ✖, Spline Sans Mono ✖, JetBrains Mono ✖ · 12 respuestas 404/fallidas
//   DESPUÉS → las 8 ✓ · 0 fallidas
// O sea: el texto normal salía bien y la NEGRITA caía a la fuente de sistema, en los 132
// cursos de /conocimientos. Es el «la negrita del curso sale en Arial» que estaba anotado
// como pendiente desde el 08/10.
//
// Probado ROMPIÉNDOLO (13/10/2026), restaurando de MEMORIA. Con todo en su lugar 27 / 0;
// cada rotura tumba SU test (26 / 1 las cuatro veces):
//   · devolviendo UN @font-face con src a /_next a la hoja     → «la hoja servida»
//   · sacándole el filtro al generador                         → «el generador los descarta»
//   · dejando de pedirle Archivo a Google en el @import        → «el generador los descarta»
//   · haciendo que el generador descarte en silencio           → «el generador los descarta»
//
// ⚠️ Son DOS tests y no uno a propósito: el generador y la hoja servida contestan preguntas
// distintas. Arreglar sólo el generador deja la hoja rota hasta que alguien lo vuelva a
// correr, y arreglar sólo la hoja la deja volver a romperse en la próxima regeneración —
// en silencio, porque nadie audita 38 líneas de @font-face en un diff de 350 KB.

const HOJA = leer('public/cono-doc/ugc.css');
const GENERADOR = leer('scripts/avatarhype-css.mjs');

test('la hoja servida no pide una sola fuente del dominio del origen', () => {
  // La pregunta es sobre el ARCHIVO QUE SE SIRVE, no sobre el generador: una regla que se
  // aplica AL GENERAR no arregla ni una línea ya escrita, así que son dos tests.
  const muertas = HOJA.split('\n').filter(
    (l) => l.trim().startsWith('@font-face') && l.includes('/_next/static/media'),
  );
  assert.equal(muertas.length, 0,
    `${muertas.length} @font-face apuntan a /_next: en nuestro dominio son 404 y tapan a los de Google`);

  // Y ninguna referencia a /_next por otro camino (un background, una máscara).
  assert.equal((HOJA.match(/_next\/static\/media/g) || []).length, 0,
    'quedó una referencia al build del origen');

  // Las que SÍ se quedan son las `* Fallback` locales de Next: no apuntan a /_next y son
  // las que sostienen la métrica mientras Google llega. Si desaparecen, el texto salta.
  const fallback = (HOJA.match(/@font-face[^\n]*Fallback/g) || []).length;
  assert.ok(fallback >= 7, `esperaba las 7 familias Fallback y hay ${fallback}`);

  // Sin el @import no hay NINGUNA fuente: tirar los muertos dejaría la hoja pelada.
  assert.match(HOJA, /@import url\('https:\/\/fonts\.googleapis\.com\/css2/,
    'la hoja se quedó sin el @import: sin él, tirar los @font-face la deja sin fuentes');
});

test('el generador los descarta, para que no vuelvan en la próxima regeneración', () => {
  // Sin esto el arreglo dura hasta que alguien vuelva a correr el script, y vuelve EN
  // SILENCIO: la hoja se regenera entera y nadie mira 38 líneas de @font-face.
  assert.match(GENERADOR, /@font-face'\) && l\.includes\('\/_next\/static\/media'\)/,
    'el generador tiene que tirar los @font-face que apunten a /_next');

  // Y las 7 familias que esos @font-face declaraban tienen que seguir pedidas a Google, o
  // tirarlos deja huérfana a la que falte. Son exactamente las 7 medidas en la hoja.
  for (const fam of ['Bricolage+Grotesque', 'Hanken+Grotesk', 'Instrument+Serif', 'Caveat',
    'Spline+Sans+Mono', 'Archivo', 'JetBrains+Mono']) {
    assert.ok(GENERADOR.includes(`family=${fam}`), `el @import del generador no pide ${fam}`);
  }

  // Un filtro que descarta en silencio hace indistinguible «no había ninguno» de «los tiré
  // todos»: el script cuenta y lo dice.
  assert.match(GENERADOR, /fuentesMuertas\+\+/, 'el generador tiene que CONTAR lo que descarta');
  assert.match(GENERADOR, /@font-face del origen descartados/, 'y decirlo al terminar');
});
