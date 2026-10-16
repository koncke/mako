// =============================================================================
// La copia de lectura de los proyectos del Video Editor, para la API de MaKo (etapa 3 del diseño AI-native, 16/10/2026)
// =============================================================================
// El proyecto vive en el navegador y la API en el server: el editor sube, un rato después de cada cambio, la misma
// vista que lee su chat (mig 0299, lib/editor-video/espejo.ts). Fija:
//   · el saneo de lo que sube el editor (la ruta no le cree), con el tope del chat;
//   · que las refs se ACUMULAN y no se reusan: con la vista del chat de verdad, un texto nuevo no hereda la ref de uno
//     borrado (una propuesta vieja a «t1» no puede caer sobre otro texto);
//   · lo que muestra la API, las dos lecturas declaradas (y por HTTP), sus runners y sus rutas;
//   · la ruta, el server, la migración y el cableado del editor: sube con las refs guardadas, no repite, se para sin la
//     tabla, y la copia sale cuando se borra el proyecto por CUALQUIER camino.
//
// PROBADO ROMPIÉNDOLO: ver el final.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOPES_CHAT } from '../lib/editor-video/chat-catalogo';
import { NOTA_COPIA, TOPES_ESPEJO, espejoValido, proyectoEnLista, proyectoEntero, unirRefs, type FilaEspejo } from '../lib/editor-video/espejo';
import { vistaDeLinea } from '../app/video-editor/_opencut/chat/linea';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';
import { DEFS as DEFS_VIDEO } from '../lib/api-mako/areas/video.def';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));

const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);
const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) =>
  ({ id, type, name: 'archivo.mp4', startTime: t(ini), duration: t(dur), trimStart: 0, trimEnd: 0, params: {}, ...extra });
/** Dos textos y un clip; `sinPrimero` borra el primer texto y suma uno NUEVO al final. */
function escena(sinPrimero = false): SceneTracks {
  const textos = sinPrimero
    ? [el('txt2', 'text', 4, 2, { params: { content: 'Segundo' } }), el('txt3', 'text', 7, 2, { params: { content: 'Nuevo' } })]
    : [el('txt1', 'text', 1, 2, { params: { content: 'Primero' } }), el('txt2', 'text', 4, 2, { params: { content: 'Segundo' } })];
  return {
    overlay: [{ id: 'pt', type: 'text', name: 'Texto', hidden: false, elements: textos }],
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [el('vid1', 'video', 0, 10)] },
    audio: [],
  } as unknown as SceneTracks;
}
/** Lo que sube el editor de una vista (chat/espejo.ts): [id, ref] de los elementos y de los medios. */
const paresDe = (v: ReturnType<typeof vistaDeLinea>): Array<[string, string]> => [
  ...[...v.refs.values()].map((x) => [x.elementId, x.ref] as [string, string]),
  ...[...v.medios.values()].map((m) => [m.mediaId, m.ref] as [string, string]),
];
const FILA: FilaEspejo = { proyecto_id: 'p1', nombre: 'Anuncio', duracion: '12.34', demasiado_grande: false, updated_at: '2026-10-16T10:00:00Z', editado_por: 'u5', vista: { pistas: [] } };

// ── Lo que sube el editor ────────────────────────────────────────────────────

test('1: se valida lo que sube el editor: ids del motor, la vista del chat y su tope', () => {
  const base = { proyecto: 'p-1', escenaId: 'e-1', nombre: '  Mi anuncio  ', duracion: 12.5, vista: JSON.stringify({ pistas: [] }), refs: [['txt1', 't1']] };
  const ok = espejoValido(base);
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.espejo.nombre, 'Mi anuncio');
  assert.deepEqual(ok.ok && ok.espejo.vista, { pistas: [] });
  assert.equal(espejoValido({ ...base, proyecto: '../otro' }).ok, false, 'un id que no es del motor');
  assert.equal(espejoValido({ ...base, escenaId: '' }).ok, false);
  assert.equal(espejoValido({ ...base, vista: '{no es json' }).ok, false);
  assert.equal(espejoValido({ ...base, vista: JSON.stringify({ sin: 'pistas' }) }).ok, false, 'tiene que ser la vista del chat');
  const grande = espejoValido({ ...base, vista: JSON.stringify({ pistas: [], x: 'y'.repeat(TOPES_CHAT.vistaMax) }) });
  assert.ok(grande.ok && grande.espejo.demasiadoGrande && grande.espejo.vista === null, 'más grande que el tope del chat no se guarda');
  const raro = espejoValido({ ...base, nombre: '', duracion: -4, refs: [['txt1', 'T1'], ['../x', 't2'], 'basura'] });
  assert.ok(raro.ok);
  assert.equal(raro.ok && raro.espejo.nombre, 'Proyecto sin título');
  assert.equal(raro.ok && raro.espejo.duracion, 0);
  assert.deepEqual(raro.ok && raro.espejo.refs, [], 'una ref que no es del chat no entra');
});

test('2: las refs se acumulan y no se reusan: un id conserva la suya y una ref de otro no se le da', () => {
  const previas: Array<[string, string]> = [['txt1', 't1'], ['vid1', 'v1']];
  assert.deepEqual(unirRefs(previas, [['txt1', 't9'], ['txt3', 't1'], ['txt4', 't2']]), [['txt1', 't1'], ['vid1', 'v1'], ['txt4', 't2']]);
  const muchas = Array.from({ length: TOPES_ESPEJO.refs + 10 }, (_, i) => [`e${i}`, `t${i + 1}`] as [string, string]);
  const r = unirRefs([], muchas);
  assert.equal(r.length, TOPES_ESPEJO.refs);
  assert.equal(r[0][0], 'e10', 'se caen las más viejas');
});

test('3: con la vista del chat de verdad, un texto NUEVO no hereda la ref de uno borrado', () => {
  const v1 = vistaDeLinea({ tracks: escena(), tps: TPS, cabezal: 0, elegidos: [] });
  const refs1 = unirRefs([], paresDe(v1));
  const refDe = (refs: Array<[string, string]>, id: string) => refs.find(([i]) => i === id)?.[1];
  assert.equal(refDe(refs1, 'txt1'), 't1');
  // Se borra txt1 y aparece txt3: con las refs guardadas como `refsPrevias`, txt3 no puede ser «t1».
  const v2 = vistaDeLinea({ tracks: escena(true), tps: TPS, cabezal: 0, elegidos: [], refsPrevias: new Map(refs1) });
  // La VISTA es lo que lee el modelo: ahí txt3 no puede ser «t1» (la unión de abajo lo rechazaría y lo taparía).
  assert.notEqual([...v2.refs.values()].find((r) => r.elementId === 'txt3')?.ref, 't1', 'la vista no le da al nuevo la ref del borrado');
  const refs2 = unirRefs(refs1, paresDe(v2));
  assert.equal(refDe(refs2, 'txt2'), refDe(refs1, 'txt2'), 'el que sigue conserva la suya');
  assert.notEqual(refDe(refs2, 'txt3'), 't1', 'la ref del borrado no se reusa');
  assert.equal(refDe(refs2, 'txt1'), 't1', 'y la copia la sigue recordando');
});

// ── Lo que lee la API ────────────────────────────────────────────────────────

test('4: la API muestra el proyecto con su línea de tiempo, dice que es una copia y avisa lo que no hay', () => {
  const lista = proyectoEnLista(FILA, 'https://x/video-editor/p1');
  assert.deepEqual(lista, { id: 'p1', nombre: 'Anuncio', duracion_segundos: 12.3, actualizado: FILA.updated_at, link: 'https://x/video-editor/p1' });
  const entero = proyectoEntero(FILA, 'L');
  assert.deepEqual((entero as { linea_de_tiempo?: unknown }).linea_de_tiempo, { pistas: [] });
  assert.equal(entero.nota, NOTA_COPIA);
  const grande = proyectoEntero({ ...FILA, demasiado_grande: true, vista: null }, 'L');
  assert.ok(!('linea_de_tiempo' in grande) && /muy grande/.test(String(grande.aviso)));
  const sinVista = proyectoEntero({ ...FILA, vista: null }, 'L');
  assert.ok(!('linea_de_tiempo' in sinVista) && /Todavía no se subió/.test(String(sinVista.aviso)));
});

test('5: las dos lecturas están declaradas (gratis, con la tab del editor, por HTTP), con runner y con ruta', () => {
  for (const id of ['listar_proyectos_video', 'ver_proyecto_video']) {
    const d = DEFS_VIDEO.find((x) => x.id === id);
    assert.ok(d, `falta ${id}`);
    assert.equal(d!.tipo, 'lectura');
    assert.equal(d!.costo, 'gratis');
    assert.deepEqual(d!.gating, { tab: 'video-editor' });
    assert.deepEqual([...d!.canales].sort(), ['app', 'http', 'whatsapp']);
    assert.match(d!.descripcion, /COPIA|copia/);
  }
  assert.ok(DEFS_VIDEO.find((x) => x.id === 'ver_proyecto_video')!.parametros.some((p) => p.nombre === 'proyecto' && p.obligatorio));
  const run = leer('lib', 'api-mako', 'areas', 'video.run.ts');
  assert.match(run, /const r = await listarEspejos\(ctx\.ws\);/, 'con el workspace del contexto');
  assert.match(run, /const r = await leerEspejo\(ctx\.ws, proyecto\);/);
  assert.match(run, /if \(!idDelMotor\(proyecto\)\)/);
  const rest = leer('lib', 'api-mako', 'rest.ts');
  assert.match(rest, /\['GET', '\/video\/proyectos', 'listar_proyectos_video'\]/);
  assert.match(rest, /\['GET', '\/video\/proyectos\/\{proyecto\}', 'ver_proyecto_video'\]/);
  const snap = readFileSync(join(RAIZ, 'tests', 'api-mako-http.snapshot.txt'), 'utf8');
  assert.match(snap, /listar_proyectos_video/);
  assert.match(snap, /ver_proyecto_video/);
});

// ── La ruta, el server, la migración y el editor ─────────────────────────────

test('6: la ruta valida lo que sube y la persona sale de la SESIÓN; el server une las refs y no muestra lo borrado', () => {
  const ruta = leer('app', 'api', 'video-editor', 'proyectos', 'route.ts');
  assert.match(ruta, /await veEditorVideo\(\)/);
  assert.match(ruta, /const persona = personaDeSesion\(sesion\);/);
  assert.match(ruta, /const v = espejoValido\(body\);/);
  assert.match(ruta, /const r = await guardarEspejo\(p\.ws, p\.persona, v\.espejo\);/);
  const srv = leer('lib', 'editor-video', 'espejo-server.ts');
  assert.match(srv, /refs: unirRefs\(previas\.refs, e\.refs\),/, 'el server no le cree al navegador las refs');
  assert.match(srv, /borrado_at: null,/, 'subir de nuevo lo vuelve a la lista');
  assert.match(srv, /\.is\('borrado_at', null\)\.order\('updated_at'/, 'la lista no muestra lo borrado');
  assert.match(srv, /e\?\.code === 'PGRST205' \|\| e\?\.code === '42P01'/);
});

test('7: la migración: una fila por proyecto, RLS sin políticas, sin default de workspace, y en los dos registros', () => {
  const crudo = readFileSync(join(RAIZ, 'supabase', 'migrations', '0299_video_editor_proyectos.sql'), 'utf8');
  assert.match(crudo, /ORDEN DE DESPLIEGUE: ANTES o JUNTO/);
  const sql = crudo.replace(/^\s*--.*$/gm, '');
  assert.match(sql, /primary key \(workspace_id, proyecto_id\)/);
  assert.doesNotMatch(sql, /workspace_id[^,\n]*default/);
  assert.match(sql, /alter table video_editor_proyectos enable row level security;/);
  assert.match(sql, /revoke all on video_editor_proyectos from anon, authenticated;/);
  assert.match(leer('lib', 'workspace.ts'), /'video_editor_proyectos',/);
  assert.match(leer('lib', 'tablas-de-inquilino.ts'), /'video_editor_proyectos',/);
});

test('8: el editor sube la vista del chat con las refs guardadas, no repite y se para sin la tabla', () => {
  const e = leer('app', 'video-editor', '_opencut', 'chat', 'espejo.ts');
  assert.match(e, /refsPrevias: new Map\(previas\),/);
  assert.match(e, /cabezal: 0,\s*elegidos: \[\],/, 'sin lo de quien mira: el cabezal y la selección');
  assert.match(e, /const refs = unirRefs\(previas, actuales\);/);
  assert.match(e, /if \(ultimaSubida\.get\(proyectoId\) === cuerpo\) return;/);
  assert.match(e, /vista: demasiadoGrande \? null : vista\.json,/);
  assert.match(e, /if \(r\?\.sinTabla\) sinTabla = true;/);
  assert.match(leer('app', 'video-editor', '_opencut', 'editor-page.tsx'), /useEffect\(\(\) => iniciarEspejo\(editor\), \[editor\]\);/);
});

test('9: la copia sale con el proyecto por CUALQUIER camino: el borrado vive en ProjectManager, no en una pantalla', () => {
  const pm = leer('app', 'video-editor', '_opencut', 'core', 'managers', 'project-manager.ts');
  const borrar = pm.slice(pm.indexOf('async deleteProjects('), pm.indexOf('async deleteProjects(') + 1200);
  assert.match(borrar, /for \(const id of uniqueIds\) borrarCopiaDelProyecto\(id\);/);
  const chico = readFileSync(join(RAIZ, 'app', 'video-editor', '_opencut', 'chat', 'espejo-borrar.ts'), 'utf8');
  assert.doesNotMatch(chico, /^import /m, 'el núcleo del motor no carga el chat');
  assert.match(chico, /method: "DELETE"/);
});

// Probado rompiéndolo (16/10/2026), cada rotura restaurada (base 9/0), todas -> 8/1:
//   · no valida el id del proyecto / guarda una vista más grande que el tope / acepta una que no es la del chat
//   · una ref de otro se reusa / un id cambia de ref / sin el tope de refs
//   · la vista no recuerda las refs de lo borrado (SOBREVIVÍA: el test miraba la unión de refs, que rechaza la «t1»
//     repetida y tapaba que la VISTA —lo que lee el modelo— se la daba al texto nuevo; ahora se mira la vista)
//   · el editor sube sin las refs guardadas / sube lo mismo otra vez / sigue intentando sin la tabla / no se monta
//   · la API no dice que es una copia / lista con el workspace del pedido / sin la ruta REST / no sale por HTTP
//   · el server no une las refs / subir de nuevo no lo vuelve a la lista / la lista muestra lo borrado
//   · la ruta guarda sin validar / la tabla sin RLS / fuera de TABLAS_DE_INQUILINO
//   · borrar el proyecto no saca la copia / el borrado chico carga el chat
