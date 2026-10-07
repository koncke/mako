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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProductoVista, EtapaVista, ClaseVista } from '../lib/curso-portal';
import type { Clase } from '../lib/curso';
import { ROTULO_TAREA, tapaDeVideo } from '../lib/curso';
import type { ClaseUgc, ModuloUgc } from '../app/_cursos/tipos';
import { estiloVacio } from '../lib/curso-estilo';
import { clasesVisibles, pctAvance, textoBarraModulo, vecinas, moduloMarcado } from '../app/_cursos/reglas';
import { CSS_UGC } from '../app/_cursos/estilos';
import {
  agendaVigente, chipTarea, chipVisto, claseDeArranque, clasesDelPortal, marcaDelProducto, modulosDelPortal,
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
  id, titulo: `Clase ${id}`, descripcion: '', minutos: null, video: null, pct: null, tarea: '', campos: [],
  tieneTarea: false, obligatoria: false, estado: 'pendiente', valores: {}, ...o,
});
const etapaV = (key: string, estado: EtapaVista['estado'], clases: ClaseVista[], o: Partial<EtapaVista> = {}): EtapaVista => ({
  key, label: key.toUpperCase(), estado, clases: estado === 'bloqueada' ? [] : clases, cuantas: clases.length,
  obligatorias: 0, enviadas: 0, tareas: 0, tareasEnviadas: 0, ...o,
});
const producto = (etapas: EtapaVista[]): ProductoVista => ({ productoId: 1, nombre: 'Negocio que Escala', etapas, estilo: estiloVacio() });

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
  const cs = clasesDelPortal(p);
  assert.deepEqual(cs.map((c) => [c.ugc.id, c.ugc.moduloKey, c.ugc.vn]), [
    [1, 'bienvenida', 1], [2, 'bienvenida', 2], [3, 'arranque', 1],
  ]);
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

test('la tapa de una clase sale de su video: YouTube y Drive sí, el resto sin tapa', () => {
  assert.equal(tapaDeVideo({ tipo: 'youtube', id: 'dQw4w9WgXcQ' }), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(tapaDeVideo({ tipo: 'iframe', embed: 'https://drive.google.com/file/d/AbC_1/preview' }),
    'https://drive.google.com/thumbnail?id=AbC_1&sz=w800');
  assert.equal(tapaDeVideo({ tipo: 'iframe', embed: 'https://www.loom.com/embed/x' }), null);
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

test('editor: los chips del equipo, y sin poder leer la marca no se dice nada de grabar', () => {
  const c = clase(1, 'a', 0, { tarea: 'Completa', obligatoria: true });
  const textos = (marca: boolean | null | undefined, notas = 0) => chipsDelEditor(c, { marca, notas }).map((x) => x.texto);
  assert.deepEqual(textos(true, 2), ['Sin video', 'Tarea', 'Cierra la etapa', 'Grabar', '2 notas']);
  assert.ok(!textos(undefined).some((t) => /grabar/i.test(t)), 'marca ilegible: ni «Grabar» ni «No grabar»');
  assert.ok(textos(false).includes('No grabar'));
  assert.equal(cierraLaEtapa([c]), true);
  assert.equal(cierraLaEtapa([clase(2, 'a', 0, { obligatoria: true })]), false, 'obligatoria SIN tarea no cierra');
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
