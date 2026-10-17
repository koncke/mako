// =============================================================================
// El área «comunidad» de la API de MaKo (08/10/2026): lo que no se puede romper sin que nadie lo vea
// =============================================================================
// Pedido de Martín (08/10/2026): «También falta la comunidad…». Lo que este test fija:
//   · el área sale SÓLO por HTTP, con la puerta de la tab (Customer Success), y configurar
//     (categorías, niveles, ajustes) es del admin, como `puedeConfigurar`;
//   · los topes son los de la pantalla (un tope de más deja pasar lo que la lib rechaza a mitad
//     de la escritura; uno de menos rechaza lo que la tab acepta);
//   · QUIÉN FIRMA: lo que se publica sale con el nombre de una persona del equipo o no sale. El actor
//     neutral (`CLAVE_API`) sólo lee, modera y configura, y la base no lo puede guardar como autor;
//     `ctx.actor` fuera de la bandeja (por HTTP es «API · token «x»») no firma nada;
//   · «vaciar» es `-`: el validador descarta "" como «no vino»;
//   · ninguna lectura devuelve una URL firmada de un adjunto, ni lo que es de quien mira;
//   · los runners llaman a lib/, nunca a una server action, y verifican la pertenencia al negocio de
//     cada id antes de escribir.
//
// Probado rompiéndolo (08/10/2026), una rotura por vez y restaurada a mano:
//   · `personaDe` aceptando `ctx.actor` sin bandeja → cae «quién firma» (1 fallo, el resto verde);
//   · `firmaDelEquipo` sin el chequeo de workspace (delNegocio = true) → cae «quién firma»;
//   · `textoMezclado` tratando "" como vaciar en vez de «-» → cae «la mezcla»;
//   · `postPublico` devolviendo `adjunto: p.adjunto` (con la url) → cae «lo que sale»;
//   · publicar_post_comunidad ejecutando con `lector(` en vez de `firmado(` → cae «lo que se publica
//     lleva firma»;
//   · TOPE_MOTIVO_API en 500 → cae «los topes»;
//   · sacar_alumno_comunidad sin `com.alumnos.has(clave)` → cae «la pertenencia».
//   Cada una tiró UN test (textoMezclado, dos: el del evento usa la misma mezcla) y el resto quedó en verde.
//
// Vuelto a romper el 13/10/2026 al portarlo al main de ese día (base en verde, 12/12; arnés del scratchpad
// que restaura DE MEMORIA, nunca con git checkout): las siete de arriba, otra vez una por una, tiraron los
// mismos tests (11/12, y 10/12 la de textoMezclado). Y las dos asserts nuevas de ese día:
//   · ordenar_categorias_comunidad escribiendo por otro camino que `ordenarCategorias` → cae «los runners
//     llaman a lib/» (11/12);
//   · editar_post_comunidad sin `vaciaEsValor` en menciones → cae «vaciar» (11/12).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFS, TOPE_MOTIVO_API, DURACION_DEFAULT_API } from '../lib/api-mako/areas/comunidad.def';
import {
  CLAVE_API, VACIAR, personaDe, firmaDelEquipo, nombreDeQuien, textoMezclado, ordenPedido, nombresDeNivel,
  eventoMezclado, perfilMezclado, msDeFecha, postPublico, detallePublico, comentarioPublico, comentarioEn,
  type EventoBase,
} from '../lib/api-mako/areas/comunidad.helpers';
import {
  TOPE_TITULO, TOPE_CUERPO, TOPE_COMENTARIO, TOPE_CATEGORIA, MAX_CATEGORIAS, MAX_MENCIONES, MAX_OPCIONES,
  TOPE_BIO, TOPE_UBICACION, TOPE_LINK, TOPE_DESCRIPCION_CORTA, TOPE_NOMBRE_COMUNIDAD, TOPE_ABOUT, TOPE_REGLAS,
  REDES, leerClave,
} from '../lib/comunidad-reglas';
import { NIVEL_MAX, TOPE_NOMBRE_NIVEL } from '../lib/comunidad-niveles';
import { TOPE_TITULO_EVENTO, TOPE_LUGAR, TOPE_DESCRIPCION_EVENTO } from '../lib/comunidad-eventos';
import { validarInput } from '../lib/api-mako/validar';
import { porId } from '../lib/api-mako/registro';
import type { OperacionDef, Parametro } from '../lib/api-mako/tipos';
import type { PostVista, PostDetalle, ComentarioVista, MiembroVista } from '../lib/comunidad-tipos';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md: un `/*` adentro de un `//`).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUN_CRUDO = leer('lib/api-mako/areas/comunidad.run.ts');
const RUN = sinComentarios(RUN_CRUDO);

/** El cuerpo de un runner: desde su id hasta el id del siguiente (los ids van a 2 espacios). */
function runner(id: string): string {
  const ini = RUN.indexOf(`\n  ${id}: {`);
  assert.ok(ini >= 0, `no encontré el runner ${id}`);
  const fin = RUN.slice(ini + 1).search(/\n {2}[a-z_]+: \{/);
  return fin < 0 ? RUN.slice(ini) : RUN.slice(ini, ini + 1 + fin);
}
/** La mitad `ejecutar` de un runner de acción. */
function ejecutar(id: string): string {
  const r = runner(id);
  const i = r.indexOf('ejecutar:');
  assert.ok(i >= 0, `${id} no tiene ejecutar`);
  return r.slice(i);
}
function preparar(id: string): string {
  const r = runner(id);
  const i = r.indexOf('preparar:');
  const j = r.indexOf('ejecutar:');
  assert.ok(i >= 0 && j > i, `${id} no tiene preparar antes de ejecutar`);
  return r.slice(i, j);
}

const def = (id: string): OperacionDef => {
  const d = DEFS.find((x) => x.id === id);
  assert.ok(d, `no está la op ${id}`);
  return d;
};
const param = (id: string, nombre: string): Parametro => {
  const p = def(id).parametros.find((x) => x.nombre === nombre);
  assert.ok(p, `${id} no declara ${nombre}`);
  return p;
};

/** Configurar la comunidad: `puedeConfigurar` (equipo && admin del workspace). */
const DE_ADMIN = new Set([
  'crear_categoria_comunidad', 'editar_categoria_comunidad', 'borrar_categoria_comunidad',
  'ordenar_categorias_comunidad', 'nombrar_niveles_comunidad', 'ajustar_comunidad',
]);
/** Lo que sale con el nombre de una persona del equipo (o no sale). */
const FIRMADAS = [
  'publicar_post_comunidad', 'editar_post_comunidad', 'seguir_post_comunidad', 'votar_encuesta_comunidad',
  'cambiar_like_post_comunidad', 'comentar_post_comunidad', 'editar_comentario_comunidad',
  'cambiar_like_comentario_comunidad', 'comentar_clase_comunidad', 'marcar_avisos_leidos_comunidad',
  'editar_perfil_comunidad',
];
/** Moderar y configurar: con el actor neutral, sin persona. */
const SIN_PERSONA = [
  'borrar_post_comunidad', 'fijar_post_comunidad', 'cerrar_comentarios_post_comunidad', 'borrar_comentario_comunidad',
  'crear_categoria_comunidad', 'editar_categoria_comunidad', 'borrar_categoria_comunidad', 'ordenar_categorias_comunidad',
  'nombrar_niveles_comunidad', 'editar_about_comunidad', 'ajustar_comunidad', 'sacar_alumno_comunidad',
  'admitir_alumno_comunidad', 'crear_evento_comunidad', 'editar_evento_comunidad', 'borrar_evento_comunidad',
];

test('el área sale SÓLO por HTTP, con la puerta de la tab, y configurar es del admin', () => {
  assert.equal(DEFS.length, 41, 'cambió la cantidad de operaciones de la comunidad: revisar este test y el snapshot');
  const ids = new Set<string>();
  for (const d of DEFS) {
    assert.equal(d.area, 'comunidad');
    assert.ok(!ids.has(d.id), `${d.id} repetida`);
    ids.add(d.id);
    assert.ok(d.id.endsWith('_comunidad') || d.id === 'listar_comunidades' || d.id === 'ajustar_comunidad' || d.id === 'buscar_en_comunidad',
      `${d.id} sin el sustantivo del área: chocaría con otra`);
    assert.deepEqual([...d.canales], ['http'], `${d.id} sale por otro canal: sumarla al doer es otra decisión`);
    assert.deepEqual(d.gating, DE_ADMIN.has(d.id) ? { tab: 'customer-success', rolMinimo: 'admin' } : { tab: 'customer-success' }, `${d.id} con otra puerta`);
    assert.equal(porId(d.id)?.id, d.id, `${d.id} no está en el registro`);
    assert.equal(d.costo, 'gratis');
  }
});

test('las acciones: pantalla genérica (nunca una propia), y lo que no tiene vuelta lo dice', () => {
  for (const d of DEFS) {
    if (d.tipo !== 'accion') continue;
    if (d.confirmacion === 'pantalla') assert.equal(d.pantalla, '/mako/revisar', `${d.id} con pantalla propia`);
    assert.ok(d.escribe && d.escribe.length > 10, `${d.id} sin escribe`);
  }
  // `tests/flujo-acciones.test.ts` cuenta las de pantalla PROPIA: el área no suma ninguna.
  assert.doesNotMatch(RUN, /\bproponer:\s*(async|revisando|\()/);
  for (const id of ['borrar_post_comunidad', 'borrar_comentario_comunidad', 'borrar_categoria_comunidad', 'borrar_evento_comunidad', 'sacar_alumno_comunidad']) {
    const d = def(id);
    assert.equal(d.tipo === 'accion' && d.reversible, false, `${id} se declara reversible`);
    assert.equal(d.tipo === 'accion' && d.confirmacion, 'pantalla', `${id} irreversible sin pantalla`);
  }
  // Publicar con el nombre de alguien y crear un evento (fecha y hora exactas) se miran en pantalla.
  for (const id of ['publicar_post_comunidad', 'editar_post_comunidad', 'crear_evento_comunidad', 'editar_about_comunidad']) {
    const d = def(id);
    assert.equal(d.tipo === 'accion' && d.confirmacion, 'pantalla', `${id} sin pantalla`);
  }
});

test('los topes son los de la pantalla', () => {
  // El motivo de un baneo es privado de un módulo server-only: va copiado y se compara con el fuente.
  const mod = /const TOPE_MOTIVO = (\d+);/.exec(leer('lib/comunidad-moderacion.ts'));
  assert.ok(mod, 'no encontré TOPE_MOTIVO en lib/comunidad-moderacion.ts');
  assert.equal(TOPE_MOTIVO_API, Number(mod[1]));
  assert.equal(param('sacar_alumno_comunidad', 'motivo').max, TOPE_MOTIVO_API);
  // La duración que pone la API cuando no se dice es la que la vista lee de una fila sin duración.
  assert.match(leer('lib/comunidad-calendario.ts'), new RegExp(`Number\\(f\\.duracion_min\\) \\|\\| ${DURACION_DEFAULT_API}\\b`));
  // La página más alta del feed es el tope de `feedComunidad`.
  const pag = /const pagina = Math\.min\((\d+),/.exec(leer('lib/comunidad-datos.ts'));
  assert.ok(pag);
  assert.equal(param('listar_posts_comunidad', 'pagina').maximo, Number(pag[1]));

  const casos: Array<[string, string, number]> = [
    ['publicar_post_comunidad', 'titulo', TOPE_TITULO], ['publicar_post_comunidad', 'cuerpo', TOPE_CUERPO],
    ['publicar_post_comunidad', 'menciones', MAX_MENCIONES], ['publicar_post_comunidad', 'encuesta', MAX_OPCIONES],
    ['editar_post_comunidad', 'titulo', TOPE_TITULO], ['editar_post_comunidad', 'cuerpo', TOPE_CUERPO],
    ['comentar_post_comunidad', 'cuerpo', TOPE_COMENTARIO], ['editar_comentario_comunidad', 'cuerpo', TOPE_COMENTARIO],
    ['comentar_clase_comunidad', 'cuerpo', TOPE_COMENTARIO],
    ['crear_categoria_comunidad', 'nombre', TOPE_CATEGORIA], ['editar_categoria_comunidad', 'nombre', TOPE_CATEGORIA],
    ['ordenar_categorias_comunidad', 'categoriaIds', MAX_CATEGORIAS], ['nombrar_niveles_comunidad', 'niveles', NIVEL_MAX],
    ['editar_about_comunidad', 'nombre', TOPE_NOMBRE_COMUNIDAD], ['editar_about_comunidad', 'descripcion', TOPE_DESCRIPCION_CORTA],
    ['editar_about_comunidad', 'texto', TOPE_ABOUT], ['editar_about_comunidad', 'reglas', TOPE_REGLAS],
    ['editar_perfil_comunidad', 'bio', TOPE_BIO], ['editar_perfil_comunidad', 'ubicacion', TOPE_UBICACION],
    ['crear_evento_comunidad', 'titulo', TOPE_TITULO_EVENTO], ['crear_evento_comunidad', 'lugar', TOPE_LUGAR],
    ['crear_evento_comunidad', 'descripcion', TOPE_DESCRIPCION_EVENTO],
  ];
  for (const [id, nombre, tope] of casos) assert.equal(param(id, nombre).max, tope, `${id}.${nombre}`);
  const niveles = param('nombrar_niveles_comunidad', 'niveles');
  assert.equal(niveles.campos?.find((c) => c.nombre === 'nombre')?.max, TOPE_NOMBRE_NIVEL);
  assert.equal(niveles.campos?.find((c) => c.nombre === 'nivel')?.maximo, NIVEL_MAX);
  const links = param('editar_perfil_comunidad', 'links');
  assert.deepEqual(links.campos?.map((c) => c.nombre), [...REDES]);
  for (const c of links.campos ?? []) assert.equal(c.max, TOPE_LINK);
});

test('«vaciar» es «-»: el validador descarta "" como «no vino»', () => {
  const v1 = validarInput(def('editar_post_comunidad').parametros, { postId: 1, videoUrl: '' }, 'json');
  assert.ok('input' in v1 && !('videoUrl' in v1.input), 'si "" llegara, «-» sobraría: revisar VACIAR');
  const v2 = validarInput(def('editar_post_comunidad').parametros, { postId: 1, videoUrl: VACIAR }, 'json');
  assert.ok('input' in v2 && v2.input.videoUrl === VACIAR);
  // La lista POSICIONAL de niveles se rompería con un "" adentro: va por objeto { nivel, nombre }.
  const v3 = validarInput(def('nombrar_niveles_comunidad').parametros, { productoId: 1, niveles: [{ nivel: 3, nombre: VACIAR }] }, 'json');
  assert.ok('input' in v3);
  assert.deepEqual(v3.input.niveles, [{ nivel: 3, nombre: VACIAR }]);
  // Las menciones de un post o un comentario que se EDITA reemplazan la lista entera: `[]` es «sacarlas
  // todas» (`vaciaEsValor`, AGENTS.md). Sin la marca, el validador tira `[]` como «no vino» y las que
  // tenía quedan para siempre. Al PUBLICAR no reemplazan nada: ahí `[]` sigue siendo «no vino».
  for (const [id, base] of [['editar_post_comunidad', { postId: 1 }], ['editar_comentario_comunidad', { comentarioId: 1, cuerpo: 'hola' }]] as const) {
    const v = validarInput(def(id).parametros, { ...base, menciones: [] }, 'json');
    assert.ok('input' in v && Array.isArray(v.input.menciones) && v.input.menciones.length === 0, `${id}: [] no vacía las menciones`);
  }
  const v4 = validarInput(def('publicar_post_comunidad').parametros, { productoId: 1, titulo: 'x', menciones: [] }, 'json');
  assert.ok('input' in v4 && !('menciones' in v4.input));
});

test('quién firma: una persona del equipo de ESTE negocio, y nunca el actor del canal', () => {
  // El actor neutral no es una clave de miembro: `leerClave` lo rechaza (y el CHECK de la 0217 también).
  assert.equal(leerClave(CLAVE_API), null);

  assert.equal(personaDe({ persona: '  Ana@Negocio.com ' }), 'ana@negocio.com');
  assert.equal(personaDe({ bandeja: true, actor: 'dueno@negocio.com' }), 'dueno@negocio.com');
  assert.equal(personaDe({ actor: 'dueno@negocio.com' }), null, 'fuera de la bandeja, el actor no firma');
  assert.equal(personaDe({ actor: 'API · token «ci»' }), null);
  assert.equal(personaDe({ bandeja: true, actor: 'API · token «ci»' }), null);
  assert.equal(personaDe({}), null);

  const u = { id: 7, email: 'ana@negocio.com', nombre: 'Ana', estado: 'activo', workspace_id: 13, rol: 'usuario' };
  assert.deepEqual(firmaDelEquipo(u, 13), { clave: 'u:7', nombre: 'Ana' });
  assert.equal(firmaDelEquipo(u, 14), null, 'una cuenta de otro negocio no firma acá');
  assert.equal(firmaDelEquipo({ ...u, estado: 'suspendido' }, 13), null);
  assert.equal(firmaDelEquipo(null, 13), null);
  assert.equal(firmaDelEquipo({ ...u, id: 0 }, 13), null);
  // El admin de la PLATAFORMA (rol 'admin', sin workspace) firma en la comunidad de un cliente, como en la tab.
  assert.deepEqual(firmaDelEquipo({ ...u, rol: 'admin', workspace_id: null }, 13), { clave: 'u:7', nombre: 'Ana' });
  assert.deepEqual(firmaDelEquipo({ ...u, nombre: '  ' }, 13), { clave: 'u:7', nombre: 'ana' }, 'sin nombre, lo de antes de la arroba');

  // Lo que queda escrito como «quién» (un baneo, un evento) nunca es un email.
  assert.equal(nombreDeQuien({ nombre: 'Ana' }, {}), 'Ana');
  assert.equal(nombreDeQuien(null, { actor: 'API · token «ci»' }), 'API · token «ci»');
  assert.equal(nombreDeQuien(null, { actor: 'dueno@negocio.com' }), 'API de MaKo');
});

test('lo que se publica lleva firma; moderar y configurar corren con el actor neutral', () => {
  for (const id of FIRMADAS) {
    const e = ejecutar(id);
    assert.match(e, /firmaAlEscribir\(ctx\)/, `${id} escribe sin preguntar quién firma`);
    assert.match(e, /firmado\(ctx,/, `${id} escribe sin el actor firmado`);
    assert.doesNotMatch(e, /\blector\(ctx,/, `${id} publica con el actor neutral`);
  }
  for (const id of SIN_PERSONA) {
    assert.doesNotMatch(ejecutar(id), /firmaAlEscribir|firmado\(/, `${id} pide una persona que no necesita`);
  }
  // La campana es de una persona: sin ella, error (nunca la del actor neutral).
  assert.match(runner('ver_avisos_comunidad'), /if \(!q\.firma\) return fallo\(/);
  // Un token detallado escribe en el acto: sin persona falla al PROPONER, no a mitad de camino.
  assert.match(RUN, /if \(!q\.firma && ctx\.token\) return \{ error: SIN_PERSONA \};/);
  // El actor neutral lleva la clave que la base no acepta como autor.
  assert.match(RUN, /const lector = \(ctx: Ctx, productoId: number, nombre = 'API de MaKo'\): Actor =>\s*\(\{ ws: ctx\.ws, productoId, clave: CLAVE_API,/);
});

test('los runners llaman a lib/, nunca a una server action ni a un componente', () => {
  const imports = [...RUN_CRUDO.matchAll(/from '@\/([^']+)'/g)].map((m) => m[1]);
  assert.ok(imports.length > 5);
  for (const rel of imports) {
    const archivo = [`${rel}.ts`, `${rel}.tsx`, `${rel}/index.ts`].find((f) => existsSync(join(RAIZ, f)));
    assert.ok(archivo, `no encontré ${rel}`);
    const src = leer(archivo);
    assert.doesNotMatch(src, /^['"]use server['"];?\s*$/m, `${archivo} es una server action: lee la sesión de la cookie`);
    assert.doesNotMatch(src, /^['"]use client['"];?\s*$/m, `${archivo} es un componente`);
  }
  // Ni consultas propias: todo pasa por lib/ (y comunidad_posts, además, lo barre curso-comentarios-clase).
  // (`Array.from` no es una consulta.)
  assert.doesNotMatch(RUN, /(?<!Array)\.from\(|getSupabaseServer|getTenantDb|comunidad_posts/);
  // El orden de las categorías lo escribe UNA función, la misma que usan las flechas de la pantalla
  // (`moverCategoria` delega en `ordenarCategorias`, lib/comunidad-datos.ts): dos escritores del orden
  // son dos reglas de «sin empates» que se separan.
  assert.match(ejecutar('ordenar_categorias_comunidad'), /ordenarCategorias\(lector\(ctx, /);
});

test('la pertenencia: cada id que llega se resuelve en ESTE negocio antes de escribir', () => {
  for (const d of DEFS) {
    const nombres = d.parametros.map((p) => p.nombre);
    const cuerpo = d.tipo === 'accion' ? preparar(d.id) : runner(d.id);
    if (nombres.includes('productoId')) assert.match(cuerpo, /productoDe\(ctx, input\)/, `${d.id} no mira que el producto sea del negocio`);
    if (nombres.includes('postId')) assert.match(cuerpo, /postDeId\(ctx,/, `${d.id} no mira que el post sea del negocio`);
    if (nombres.includes('comentarioId')) assert.match(cuerpo, /comentarioDeId\(ctx,/, `${d.id} no mira que el comentario sea del negocio`);
    if (nombres.includes('claseId')) assert.match(cuerpo, /claseDeId\(/, `${d.id} no mira que la clase sea del negocio`);
    if (nombres.includes('eventoId') && d.tipo === 'accion') assert.match(cuerpo, /eventoParaEditar\(lector\(ctx, p\.id\)/, `${d.id} no mira que el evento sea de la comunidad`);
  }
  // Las funciones que resuelven la pertenencia leen con el workspace a mano (las tablas de la 0217 no están en TENANT_TABLES).
  assert.match(RUN, /productoDelWorkspace\(ctx\.ws, id\)/);
  assert.match(RUN, /productoDelPost\(ctx\.ws, postId\)/);
  assert.match(RUN, /productoDelComentario\(ctx\.ws, id\)/);
  // Responder a un comentario de OTRO post no pasa.
  assert.match(preparar('comentar_post_comunidad'), /c\.postId !== Number\(r\.fila\.id\)/);
  // Sacar: el alumno tiene que ser de ESTA comunidad (`sacarAlumno` sólo mira que el lead sea del negocio).
  assert.match(preparar('sacar_alumno_comunidad'), /com\.alumnos\.has\(clave\)/);
});

test('«no existe» se dice antes: las funciones de borrar contestan ok sobre lo que no está', () => {
  assert.match(preparar('borrar_post_comunidad'), /postDeId\(/);
  assert.match(preparar('borrar_comentario_comunidad'), /comentarioDeId\(/);
  assert.match(preparar('borrar_categoria_comunidad'), /if \(!c\) return \{ error:/);
  assert.match(preparar('borrar_evento_comunidad'), /if \(!e\) return \{ error:/);
  // El hilo de una clase no se borra ni se fija entero.
  assert.match(preparar('borrar_post_comunidad'), /clase_id != null/);
  assert.match(preparar('fijar_post_comunidad'), /clase_id != null/);
});

test('la mezcla de los PATCH: lo que no viene queda, y «-» vacía', () => {
  assert.equal(textoMezclado(undefined, 'hola'), 'hola');
  assert.equal(textoMezclado('nuevo', 'hola'), 'nuevo');
  assert.equal(textoMezclado(` ${VACIAR} `, 'hola'), '');
  assert.equal(textoMezclado('', 'hola'), '', 'un "" que llegue (no llega: el validador lo saca) no se confunde con «no vino»');

  // El orden de las categorías: la lista entera, una vez cada una.
  assert.deepEqual(ordenPedido([1, 2, 3], ['3', '1', '2']), { ids: [3, 1, 2] });
  assert.deepEqual(ordenPedido([1, 2, 3], ['1', '2', '3']), { error: 'Las categorías ya están en ese orden.', yaEstaba: true });
  const falta = ordenPedido([1, 2, 3], ['3', '1']);
  assert.ok('error' in falta && /Faltan: 2/.test(falta.error));
  const sobra = ordenPedido([1, 2], ['2', '1', '9']);
  assert.ok('error' in sobra && /No existen: 9/.test(sobra.error));
  const rep = ordenPedido([1, 2], ['1', '1']);
  assert.ok('error' in rep && /repetidos/.test(rep.error));

  // Los niveles van por número: un «-» devuelve el nombre de fábrica, y nadie corre de lugar.
  const actuales = ['Novato', '', 'Pro', '', '', '', '', '', ''];
  const n = nombresDeNivel(actuales, [{ nivel: 3, nombre: VACIAR }, { nivel: 9, nombre: '  Leyenda ' }]);
  assert.ok('nombres' in n);
  assert.deepEqual(n.nombres, ['Novato', '', '', '', '', '', '', '', 'Leyenda']);
  assert.deepEqual(n.cambiados, [3, 9]);
  const igual = nombresDeNivel(actuales, [{ nivel: 1, nombre: 'Novato' }]);
  assert.ok('nombres' in igual && igual.cambiados.length === 0);
  assert.ok('error' in nombresDeNivel(actuales, [{ nivel: 10, nombre: 'x' }]));
  assert.ok('error' in nombresDeNivel(actuales, [{ nivel: 2, nombre: 'a' }, { nivel: 2, nombre: 'b' }]));
  assert.ok('error' in nombresDeNivel(actuales, [{ nivel: 2, nombre: 'x'.repeat(TOPE_NOMBRE_NIVEL + 1) }]), 'un nombre largo se frena, no se recorta en silencio');

  // El perfil: un link que no viene queda; uno con «-» se saca.
  const p = perfilMezclado({ bio: 'Coach', ubicacion: 'CDMX', links: { web: 'https://a.com', instagram: 'https://ig.com/a' } },
    { ubicacion: VACIAR, links: { instagram: VACIAR, youtube: 'https://yt.com/a' } });
  assert.deepEqual(p, { bio: 'Coach', ubicacion: '', links: { web: 'https://a.com', youtube: 'https://yt.com/a' } });
});

test('la mezcla de un evento: en una serie, la fecha por defecto es la de la ocurrencia elegida', () => {
  const base: EventoBase = {
    titulo: 'Q&A', descripcion: 'Traer preguntas', zona: 'America/Mexico_City', duracionMin: 60,
    local: { fecha: '2026-10-01', hora: '18:00' }, lugarTipo: 'link', lugar: 'https://meet.example.com/x',
    portada: 'grad:aurora', acceso: { tipo: 'todos' }, recurrencia: { frecuencia: 'semanal', cada: 1, dias: [4], fin: { tipo: 'nunca' } },
    serie: true,
  };
  // Con alcance «todos», `guardarEvento` corre la serie `diasEntre(ocurrencia, fecha)`: rellenar con el
  // inicio de la serie movería todas las fechas para atrás sin un error.
  const e = eventoMezclado(base, { hora: '19:00', ocurrencia: '2026-10-15' });
  assert.equal(e.fecha, '2026-10-15');
  assert.equal(e.hora, '19:00');
  assert.equal(e.titulo, 'Q&A');
  assert.deepEqual(e.recurrencia, base.recurrencia);
  // Un evento suelto (o sin ocurrencia): la fecha que tiene.
  assert.equal(eventoMezclado({ ...base, serie: false }, { ocurrencia: '2026-10-15' }).fecha, '2026-10-01');
  // «-» saca la portada y el lugar; acceso y recurrencia REEMPLAZAN entero.
  const v = eventoMezclado(base, { portada: VACIAR, lugar: VACIAR, acceso: { tipo: 'nivel', nivel: 3 }, recurrencia: { frecuencia: 'nunca' } });
  assert.equal(v.portada, null);
  assert.equal(v.lugar, '');
  assert.deepEqual(v.acceso, { tipo: 'nivel', nivel: 3 });
  assert.deepEqual(v.recurrencia, { frecuencia: 'nunca' });

  assert.equal(msDeFecha(undefined), undefined);
  assert.equal(msDeFecha(''), undefined);
  assert.equal(msDeFecha('2026-10-08'), Date.parse('2026-10-08T00:00:00Z'));
  assert.equal(msDeFecha('mañana'), null, 'lo que no es una fecha se rechaza, no se ignora');
});

test('lo que sale: sin URLs firmadas y sin lo de quien mira', () => {
  const autor: MiembroVista = { clave: 'l:5', nombre: 'Leo', foto: null, nivel: 2, equipo: false };
  const comentario: ComentarioVista = {
    id: 10, padreId: null, autor, cuerpo: [], texto: 'Buenísimo', creado: '2026-10-08T00:00:00Z', editado: false,
    likes: 2, meGusta: true, puedoEditar: true, puedoBorrar: true, puedoLikear: false,
    respuestas: [{
      id: 11, padreId: 10, autor, cuerpo: [], texto: 'Gracias', creado: '2026-10-08T01:00:00Z', editado: false,
      likes: 0, meGusta: false, puedoEditar: false, puedoBorrar: true, puedoLikear: true, respuestas: [],
    }],
  };
  const post: PostVista = {
    id: 1, autor, categoriaId: 3, titulo: 'Hola', extracto: 'Hola a todos', creado: '2026-10-08T00:00:00Z', editado: false,
    fijado: false, likes: 4, meGusta: true, comentarios: 2,
    video: { proveedor: 'youtube', embed: 'https://www.youtube.com/embed/x', url: 'https://youtu.be/x' },
    adjunto: { nombre: 'guia.pdf', mime: 'application/pdf', bytes: 1200, imagen: false, url: 'https://x.supabase.co/sign/guia.pdf?token=SECRETO' },
    encuesta: { opciones: [{ id: 'o1', texto: 'Sí', votos: 3, pct: 100 }], total: 3, miVoto: 'o1' },
    puedoEditar: true, puedoBorrar: true, puedoLikear: false, cerrado: false,
  };
  const det: PostDetalle = { ...post, cuerpo: [], texto: 'Hola a todos', menciones: [], hilo: [comentario], sigo: true };

  const salidas = [postPublico(post), detallePublico(det), comentarioPublico(comentario)];
  for (const s of salidas) {
    const t = JSON.stringify(s);
    assert.doesNotMatch(t, /SECRETO|\/sign\//, 'una URL firmada de un adjunto salió por la API');
    assert.doesNotMatch(t, /"meGusta"|"puedo(Editar|Borrar|Likear)"|"miVoto"|"sigo"/, 'salió algo que es de quien mira');
  }
  assert.deepEqual(postPublico(post).adjunto, { nombre: 'guia.pdf', mime: 'application/pdf', bytes: 1200, imagen: false });
  assert.equal(detallePublico(det).hilo[0].respuestas[0].id, 11);
  assert.equal(comentarioEn(det.hilo, 11)?.texto, 'Gracias');
  assert.equal(comentarioEn(det.hilo, 99), null);

  // Las lecturas de posts y comentarios pasan por esos tres, nunca la vista cruda.
  assert.match(runner('listar_posts_comunidad'), /feed\.posts\.map\(postPublico\)/);
  assert.match(runner('listar_posts_comunidad'), /feed\.fijados\.map\(postPublico\)/);
  assert.match(runner('buscar_en_comunidad'), /b\.posts\.map\(postPublico\)/);
  assert.match(runner('ver_post_comunidad'), /detallePublico\(d\)/);
  assert.match(runner('ver_comentarios_clase_comunidad'), /hilo\.map\(comentarioPublico\)/);
});
