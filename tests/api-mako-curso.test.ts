// =============================================================================
// El área «curso» de la API de MaKo (08/10/2026): lo que no se puede romper sin que nadie lo vea
// =============================================================================
// Pedido de Martín (audio del 08/10/2026): que un Claude con un token pueda armar el curso entero
// («agregar nueva clase, agregar nuevo lo que sea»). Lo que este test fija:
//   · los topes del área son los de la tab (un tope de más deja pasar algo que la tab rechaza y la
//     escritura falla a mitad; uno de menos rechaza lo que la tab acepta);
//   · el área sale SÓLO por HTTP y la edita sólo el admin (la misma puerta que la tab);
//   · NO se exponen las escrituras que mueven clientes de etapa (vincular o borrar un módulo, mover
//     un cliente): en el ws1 eso dispara WhatsApp (pedido del chat de Customer Success);
//   · los módulos nacen SUELTOS y las clases van AL FINAL;
//   · los runners llaman a lib/, nunca a las server actions (que piden la sesión del navegador).
//
// Probado rompiéndolo (08/10/2026): con `input.vinculado !== false` en crear_modulo_curso, falla
// «los módulos nacen sueltos»; con TOPE_TITULO_CLASE en 300, falla el de los topes.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFS, TOPE_TITULO_CLASE, TOPE_NOMBRE_MODULO, TOPE_DESCRIPCION_HTML, TOPE_DESCRIPCION_TEXTO,
  MAX_TAREAS_API, TOPE_TITULO_TAREA_API, TOPE_PREGUNTA_API, TOPE_CAMPOS_API,
} from '../lib/api-mako/areas/curso.def';
import { htmlDeTexto, modeloDeTareas, tareasParaApi, TIPOS_CAMPO_API } from '../lib/api-mako/areas/curso.helpers';
import { erroresDeCampos, tareasDeClase, MAX_TAREAS, TOPE_TITULO_TAREA, TOPE_PREGUNTA, TOPE_CAMPOS } from '../lib/curso';
import { validarInput } from '../lib/api-mako/validar';
import { TOPE_TITULO, TOPE_TEXTO } from '../app/customer-success/curso/reglas';
import { TOPE_NOMBRE_ETAPA } from '../lib/servicio-etapas';
import { DIAS_PAPELERA } from '../lib/curso-papelera-reglas';
import { RUTAS_REST } from '../lib/api-mako/rest';
import { porId } from '../lib/api-mako/registro';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUN = sinComentarios(leer('lib/api-mako/areas/curso.run.ts'));

/** El cuerpo de un runner: desde su id hasta el id del siguiente. */
function runner(id: string): string {
  const ini = RUN.indexOf(`  ${id}: {`);
  assert.ok(ini >= 0, `no encontré el runner ${id}`);
  const fin = RUN.slice(ini + 1).search(/\n {2}[a-z_]+: \{/);
  return fin < 0 ? RUN.slice(ini) : RUN.slice(ini, ini + 1 + fin);
}

test('los topes del área son los de la tab', () => {
  assert.equal(TOPE_TITULO_CLASE, TOPE_TITULO);
  assert.equal(TOPE_DESCRIPCION_TEXTO, TOPE_TEXTO);
  assert.equal(TOPE_NOMBRE_MODULO, TOPE_NOMBRE_ETAPA);
  const html = /export const TOPE_HTML = ([\d_]+);/.exec(leer('lib/html-seguro.ts'));
  assert.ok(html, 'no encontré TOPE_HTML en lib/html-seguro.ts');
  assert.equal(TOPE_DESCRIPCION_HTML, Number(html[1].replace(/_/g, '')));
  // Las descripciones prometen 7 días de papelera: tienen que ser los de la purga.
  const conDias = DEFS.filter((d) => /\b\d+ días\b/.test(d.descripcion));
  assert.ok(conDias.length >= 2);
  for (const d of conDias) assert.match(d.descripcion, new RegExp(`\\b${DIAS_PAPELERA} días\\b`), `${d.id} promete otros días de papelera`);
});

// ⚠️ LAS DOS LECTURAS DE LA ESTRUCTURA SALEN TAMBIÉN POR LA APP (sexta tanda, segunda pasada,
// 09/10/2026): el ✦ que redacta un mensaje en el lienzo (`LECTURAS_REDACTA`, lib/mako-redacta.ts) pide
// `listar_cursos`, y por la app contestaba 404. Son la estructura del curso, sin una sola persona; por
// WhatsApp, no. Todo lo demás —y toda escritura— sigue SÓLO por HTTP.
// Probado rompiéndolo (09/10/2026, este archivo, base 13 / 0): `ver_clase_curso` con 'app' → 12 / 1;
// las dos lecturas también por 'whatsapp' → 12 / 1. Restaurado: 13 / 0.
const LECTURAS_POR_LA_APP: ReadonlySet<string> = new Set(['listar_cursos', 'ver_curso']);

test('el área sale SÓLO por HTTP (salvo las dos lecturas de la estructura, también por la app), gateada como la tab, y cada operación tiene su ruta REST', () => {
  assert.ok(DEFS.length >= 10);
  for (const d of DEFS) {
    assert.equal(d.area, 'curso');
    if (LECTURAS_POR_LA_APP.has(d.id)) {
      assert.equal(d.tipo, 'lectura', `${d.id}: por la app sólo una LECTURA`);
      assert.deepEqual([...d.canales].sort(), ['app', 'http'], `${d.id}: por la app y por HTTP, nunca por WhatsApp`);
    } else {
      assert.deepEqual([...d.canales], ['http'], `${d.id} sale por otro canal: sumarla al doer es otra decisión`);
    }
    assert.deepEqual(d.gating, { tab: 'customer-success', rolMinimo: 'admin' }, `${d.id} sin la puerta de la tab`);
    assert.ok(porId(d.id)?.id === d.id, `${d.id} no está en el registro`);
    assert.ok(RUTAS_REST.some(([, , op]) => op === d.id), `${d.id} sin ruta REST`);
  }
});

test('NO se exponen las escrituras que mueven clientes de etapa', () => {
  for (const prohibida of ['vincularModulo', 'borrarModulo', 'restaurarModulo', 'moverClienteDeEtapa', 'guardarEtapasEntrega', 'previaDeQuitar']) {
    assert.ok(!RUN.includes(prohibida), `curso.run.ts usa ${prohibida}: mueve clientes en el kanban (y en el ws1 eso manda WhatsApp)`);
  }
});

test('los runners llaman a lib/, nunca a las server actions', () => {
  assert.doesNotMatch(RUN, /from ['"]@\/app\/customer-success\/curso\/[a-z-]*actions['"]/);
  // Y repiten la pregunta de esas actions: que el producto sea de este workspace.
  assert.match(RUN, /await productoPropio\(productoId\)/);
});

test('los módulos nacen SUELTOS, y sin «despuesDe» van al final', () => {
  const r = runner('crear_modulo_curso');
  assert.match(r, /const vinculado = input\.vinculado === true;/, 'un vinculado agrega una columna al kanban de clientes: sólo si se pide');
  assert.match(r, /pedido \?\? claves\[claves\.length - 1\] \?\? null/, 'sin despuesDe la lib lo pone AL PRINCIPIO');
});

test('una clase nueva va AL FINAL, y si algo falla después de crearla no queda a medias', () => {
  const r = runner('crear_clase_curso');
  assert.match(r, /await moverClaseA\(id, moduloClave, null\)/, 'la tab la crea al principio: por la API quedarían al revés');
  assert.match(r, /await borrarClase\(id\)/, 'una «Nueva clase» a medias hace que el reintento deje dos');
  assert.ok(r.indexOf('camposDe') > -1 && r.indexOf('camposDe') < r.indexOf('ejecutar'), 'se valida en preparar(), antes de crear');
});

test('la guía «Migrar un curso con Claude» nombra rutas que existen', () => {
  // El mensaje que se le pega a Claude es una instrucción: una ruta vieja ahí es un 404 en la
  // migración de un cliente, que no sabe leerlo.
  const guia = leer('app/api-mako/Articulos.tsx');
  const ini = guia.indexOf('function MigrarCurso');
  assert.ok(ini > 0, 'no encontré la guía');
  const rutas = [...guia.slice(ini).matchAll(/(GET|POST|PUT|PATCH|DELETE) \/api\/v1(\/curso\/[a-zA-Z0-9/{}&#;]+)/g)];
  assert.ok(rutas.length >= 5, `sólo ${rutas.length} rutas en la guía: el barrido quedó ciego`);
  for (const [, metodo, ruta] of rutas) {
    const forma = ruta.replace(/&#123;|\{/g, '{').replace(/&#125;|\}/g, '}');
    assert.ok(RUTAS_REST.some(([m, r]) => m === metodo && r === forma), `la guía nombra ${metodo} ${forma}, que no existe`);
  }
});

test('los topes de la tarea son los del modelo', () => {
  assert.equal(MAX_TAREAS_API, MAX_TAREAS);
  assert.equal(TOPE_TITULO_TAREA_API, TOPE_TITULO_TAREA);
  assert.equal(TOPE_PREGUNTA_API, TOPE_PREGUNTA);
  assert.equal(TOPE_CAMPOS_API, TOPE_CAMPOS);
});

test('las tareas de la API → el modelo: la principal sin título, las demás como `seccion`', () => {
  let n = 0;
  const gen = () => `n${++n}`;
  const m = modeloDeTareas([
    { consigna: 'Mira el video.\n\nY contesta.', campos: [{ tipo: 'linea', label: 'Tu meta', obligatorio: true }] },
    { titulo: 'Tu primer anuncio', consignaHtml: '<p>Súbelo</p>', campos: [{ tipo: 'link', label: 'El link' }, { tipo: 'eleccion', label: '¿Te gustó?', opciones: ['Sí', 'No'] }] },
  ], [], gen);
  assert.ok(!('error' in m));
  if ('error' in m) return;
  assert.equal(m.tareaHtml, '<p>Mira el video.</p><p>Y contesta.</p>');
  assert.deepEqual(m.campos.map((c) => [c.tipo, c.label]), [['linea', 'Tu meta'], ['seccion', 'Tu primer anuncio'], ['link', 'El link'], ['eleccion', '¿Te gustó?']]);
  assert.deepEqual(erroresDeCampos(m.campos), {}, 'lo que arma la API pasa la misma validación que el editor');
  assert.deepEqual(tareasDeClase({ tarea: 'x', tareaHtml: m.tareaHtml, campos: m.campos }).map((t) => t.titulo), [null, 'Tu primer anuncio']);
});

test('editar las tareas CONSERVA los ids (las respuestas de los alumnos cuelgan de ellos)', () => {
  const antes = [
    { id: 'meta', label: 'Tu meta', tipo: 'linea' as const },
    { id: 'sec', label: 'Tu primer anuncio', tipo: 'seccion' as const },
    { id: 'link', label: 'El link', tipo: 'link' as const },
  ];
  const existentes = tareasDeClase({ tarea: 'x', tareaHtml: '<p>x</p>', campos: antes });
  // Ida y vuelta tal cual: los mismos ids.
  const ida = modeloDeTareas(tareasParaApi(existentes).map((t) => ({ titulo: t.titulo ?? undefined, consignaHtml: t.consignaHtml ?? undefined, campos: t.campos as never })), existentes, () => 'NUEVO');
  assert.ok(!('error' in ida));
  if ('error' in ida) return;
  assert.deepEqual(ida.campos.map((c) => c.id), ['meta', 'sec', 'link']);
  // Sin id, con la misma pregunta y el mismo tipo: se reusa. Una pregunta nueva nace con id nuevo.
  const sinIds = modeloDeTareas([
    { campos: [{ tipo: 'linea', label: 'Tu meta' }, { tipo: 'texto', label: 'Algo nuevo' }] },
    { titulo: 'Tu primer anuncio', campos: [{ tipo: 'link', label: 'el link' }] },
  ], existentes, () => 'NUEVO');
  assert.ok(!('error' in sinIds));
  if ('error' in sinIds) return;
  assert.deepEqual(sinIds.campos.map((c) => c.id), ['meta', 'NUEVO', 'sec', 'link']);
});

test('`tareas: []` llega como lista vacía (las saca), y una lista sin la marca se sigue descartando', () => {
  // Medido el 08/10/2026 en la prueba de punta a punta: sin `vaciaEsValor`, el validador tiraba la
  // lista vacía y editar contestaba «No pasaste nada para cambiar» — no había forma de sacar la tarea.
  const editar = DEFS.find((d) => d.id === 'editar_clase_curso')!;
  const r = validarInput(editar.parametros, { claseId: 1, tareas: [] }, 'json');
  assert.ok('input' in r);
  if ('input' in r) assert.deepEqual(r.input.tareas, []);
  const comun = [{ nombre: 'ids', tipo: 'string[]' as const, descripcion: 'x' }];
  const r2 = validarInput(comun, { ids: [] }, 'json');
  assert.ok('input' in r2 && !('ids' in r2.input));
});

test('lo que la API no arma se rechaza con su motivo, no se descarta', () => {
  const gen = () => 'x';
  assert.match(String((modeloDeTareas([{ titulo: 'Principal' }], [], gen) as { error: string }).error), /principal y no lleva título/);
  assert.match(String((modeloDeTareas([{}, { campos: [] }], [], gen) as { error: string }).error), /no tiene `titulo`/);
  assert.match(String((modeloDeTareas([{ campos: [{ tipo: 'quiz', label: 'Q' }] }], [], gen) as { error: string }).error), /no se arma por la API/);
  assert.match(String((modeloDeTareas([{ consigna: 'a', consignaHtml: '<p>a</p>' }], [], gen) as { error: string }).error), /no en las dos/);
  for (const t of TIPOS_CAMPO_API) assert.notEqual(t, 'seccion');
});

test('el texto plano se vuelve párrafos, escapado', () => {
  assert.equal(htmlDeTexto('Hola\n\nChau'), '<p>Hola</p><p>Chau</p>');
  assert.equal(htmlDeTexto('uno\ndos'), '<p>uno<br>dos</p>');
  assert.equal(htmlDeTexto('a < b & <script>'), '<p>a &lt; b &amp; &lt;script&gt;</p>');
  assert.equal(htmlDeTexto('\r\n\r\n  \r\n'), '');
});
