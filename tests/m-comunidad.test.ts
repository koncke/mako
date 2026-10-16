// =============================================================================
// MaKo Mobile — «Comunidad» (app/m/comunidad): lo que se rompe sin un error
// =============================================================================
// La pantalla destila app/customer-success/comunidad (AGENTS.md, «MaKo Mobile (/m)»: mismas vistas, mismo
// orden, mismos rótulos). Esto fija:
//   · cada rótulo que el teléfono repite SIGUE, ENTERO, en su archivo de escritorio (la tabla de orígenes va
//     escrita a mano: una tabla que se recorre a sí misma no ve una fila borrada; y ENTERO, delimitado: un
//     `includes` daba por bueno «Escribe algo» adentro de «Escribe algo…»);
//   · las pestañas, los filtros de Miembros y las tablas del Ranking van en el ORDEN de escritorio;
//   · el producto y el post de la URL se leen como escritorio (`Number`: '12abc' no abre el 12);
//   · el feed: la categoría trae SU orden, una página no repite tarjetas, lo publicado va arriba sólo si entra
//     en el filtro, y el pulgar optimista nunca baja de 0;
//   · publicar pide lo que pide el compositor de escritorio y sólo ofrece las categorías que el server deja
//     (`puedePublicarEn`); comentar manda la mención SÓLO si el texto todavía la nombra (`nombraA`);
//   · el hilo de dos niveles: una respuesta va a su raíz, y nada cambia el hilo de entrada;
//   · la página: su guard, nada del `?ws=`, las lecturas y las actions de escritorio sin copia en /m, ningún
//     módulo 'use client' de escritorio, ninguna consulta propia a `comunidad_posts` (el hilo de una clase lo
//     decide lib/comunidad-datos.ts) y cada hoja con SU llave;
//   · el CSS de la carpeta (prefijo entero y tokens que existen), los íconos que existen y cero voseo.
// Que la página dibuje adentro de <PantallaM> lo fija tests/movil-refrescar.test.ts; que exista con su guard,
// tests/movil-mas-secciones.test.ts.
//
// Verificado ROMPIÉNDOLO (16/10/2026): ver el bloque «ROTURAS» al final (números medidos).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CategoriaVista, ComentarioVista, ComunidadVista, MiembroVista, PostVista } from '../lib/comunidad-tipos';
import { NOMBRES_ICO } from '../app/_comunidad/iconos';
import {
  FILTROS_MIEMBROS, PERIODOS, R, VISTAS_COMUNIDAD, categoriaInicial, categoriasParaPublicar, conCambio, conCambioEnHilo,
  conComentario, conPagina, conPublicado, entradaComentario, entradaPost, filasDelPeriodo, idDeUrl, likeOptimista,
  metaDePost, ordenDeCategoria, productoElegido, respondiendoA, segundaDeMiembro, textoDeRespuesta,
} from '../app/m/comunidad/modelo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (un `/*` dentro de un `//` se comería código). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CARPETA = 'app/m/comunidad';
const FUENTES = readdirSync(join(RAIZ, CARPETA)).filter((n) => /\.tsx?$/.test(n)).map((n) => `${CARPETA}/${n}`);
const ESC = 'app/_comunidad';
const CS = 'app/customer-success/comunidad';

/** De qué archivo de escritorio sale cada rótulo de `R`. A MANO: si se agrega uno a R, se agrega acá. */
const ORIGEN: Record<keyof typeof R, string> = {
  comunidad: `${ESC}/Comunidad.tsx`, miembros: `${ESC}/Comunidad.tsx`, ranking: `${ESC}/Comunidad.tsx`,
  producto: `${CS}/ComunidadEquipo.tsx`, sinProductos: `${CS}/ComunidadEquipo.tsx`, noPudeCargar: `${CS}/ComunidadEquipo.tsx`,
  sinLeerProductos: `${CS}/page.tsx`,
  escribeAlgo: `${ESC}/Feed.tsx`, todas: `${ESC}/Feed.tsx`, fijado: `${ESC}/Feed.tsx`, cerrado: `${ESC}/Feed.tsx`,
  encuesta: `${ESC}/Feed.tsx`, video: `${ESC}/Feed.tsx`, archivo: `${ESC}/Feed.tsx`, sinPosts: `${ESC}/Feed.tsx`,
  verMas: `${ESC}/Feed.tsx`, publicado: `${ESC}/Feed.tsx`,
  nuevoPost: `${ESC}/Compositor.tsx`, titulo: `${ESC}/Compositor.tsx`, textoPost: `${ESC}/Compositor.tsx`,
  publicar: `${ESC}/Compositor.tsx`, faltaTitulo: `${ESC}/Compositor.tsx`, eligeCategoria: `${ESC}/Compositor.tsx`,
  post: `${ESC}/PostAbierto.tsx`, escribeComentario: `${ESC}/PostAbierto.tsx`, tuRespuesta: `${ESC}/PostAbierto.tsx`,
  comentar: `${ESC}/PostAbierto.tsx`, responder: `${ESC}/PostAbierto.tsx`, noResponder: `${ESC}/PostAbierto.tsx`,
  comentariosCerrados: `${ESC}/PostAbierto.tsx`,
  meGusta: `${ESC}/piezas.tsx`, quitarLike: `${ESC}/piezas.tsx`, esTuyo: `${ESC}/piezas.tsx`,
  todos: `${ESC}/Miembros.tsx`, equipo: `${ESC}/Miembros.tsx`, enLinea: `${ESC}/Miembros.tsx`, buscarMiembros: `${ESC}/Miembros.tsx`,
  nadieConEseNombre: `${ESC}/Miembros.tsx`, nadieEnFiltro: `${ESC}/Miembros.tsx`, activo: `${ESC}/Miembros.tsx`, perfil: `${ESC}/Miembros.tsx`,
  semana: `${ESC}/Ranking.tsx`, mes: `${ESC}/Ranking.tsx`, total: `${ESC}/Ranking.tsx`, nadieSumo: `${ESC}/Ranking.tsx`,
  unLike: `${ESC}/Ranking.tsx`, deLosMiembros: `${ESC}/Ranking.tsx`,
  buscar: `${ESC}/Busqueda.tsx`, postsYMiembros: `${ESC}/Busqueda.tsx`, posts: `${ESC}/Busqueda.tsx`,
};

/** El rótulo ENTERO en el fuente: entre comillas, o como texto de JSX (entre `>`/`}` y `<`/`{`/`$`). */
function estaEntero(src: string, rotulo: string): boolean {
  return new RegExp(`['"\`>}]\\s*${escapar(rotulo)}\\s*['"\`<{$]`).test(src);
}

// ── Fixtures ────────────────────────────────────────────────────────────────────

const persona = (clave: string, nombre: string, equipo = false): MiembroVista => ({ clave, nombre, foto: null, nivel: 1, equipo });
let sec = 0;
function post(p: Partial<PostVista> & { id: number }): PostVista {
  sec += 1;
  return {
    autor: persona('l:1', 'Alumna Uno'), categoriaId: null, titulo: `Post ${p.id}`, extracto: '', creado: '2026-10-16T10:00:00.000Z',
    editado: false, fijado: false, likes: 0, meGusta: false, comentarios: 0, video: null, adjunto: null, encuesta: null,
    puedoEditar: false, puedoBorrar: true, puedoLikear: true, cerrado: false, ...p,
  };
}
function com(p: Partial<ComentarioVista> & { id: number }): ComentarioVista {
  return {
    padreId: null, autor: persona('l:2', 'Ana Prueba'), cuerpo: [], texto: '', creado: '2026-10-16T10:00:00.000Z', editado: false,
    likes: 0, meGusta: false, puedoEditar: false, puedoBorrar: true, puedoLikear: true, respuestas: [], ...p,
  };
}
const cat = (id: number, nombre: string, permiso: 'todos' | 'equipo' = 'todos', ordenDefault: CategoriaVista['ordenDefault'] = 'default'): CategoriaVista =>
  ({ id, nombre, permiso, ordenDefault });
const CATS = [cat(1, 'General'), cat(2, 'Anuncios', 'equipo', 'nuevos'), cat(3, 'Logros', 'todos', 'top_mes')];
function comunidad(equipo: boolean, categorias = CATS): Pick<ComunidadVista, 'categorias' | 'yo' | 'puedoConfigurar'> {
  return {
    categorias,
    yo: { ...persona(equipo ? 'u:9' : 'l:9', 'Quien Mira', equipo), puntos: 0, puntosParaSubir: 5, nombreNivel: 'Nivel 1' },
    puedoConfigurar: equipo,
  };
}

// ── Los rótulos y el orden ──────────────────────────────────────────────────────

test('cada rótulo que el teléfono repite sigue, ENTERO, en su archivo de escritorio', () => {
  assert.deepEqual(Object.keys(ORIGEN).sort(), Object.keys(R).sort(), 'R y ORIGEN no tienen las mismas claves');
  const fuentes = new Map<string, string>();
  const faltan: string[] = [];
  for (const [k, rel] of Object.entries(ORIGEN)) {
    if (!fuentes.has(rel)) fuentes.set(rel, sinComentarios(leer(rel)));
    const r = R[k as keyof typeof R];
    if (!estaEntero(fuentes.get(rel)!, r)) faltan.push(`${k} «${r}» en ${rel}`);
  }
  assert.deepEqual(faltan, []);
});

test('las pestañas, los filtros y las tablas van en el orden de escritorio', () => {
  // Las pestañas: un subconjunto de `PESTANAS`, en su orden.
  const pestanas = [...sinComentarios(leer(`${ESC}/Comunidad.tsx`)).matchAll(/\{ id: '(\w+)', label: '([^']+)' \}/g)].map((m) => m[1]);
  assert.ok(pestanas.length >= 5, `leí ${pestanas.length} pestañas de escritorio`);
  const ids = VISTAS_COMUNIDAD.map((v) => v.id);
  assert.deepEqual(ids, pestanas.filter((p) => ids.includes(p as never)), 'el teléfono cambió el orden de las pestañas');
  assert.deepEqual(ids, ['comunidad', 'miembros', 'ranking'], 'las tres del prototipo');

  // Los filtros de Miembros (los chips de escritorio, sin «Fuera», que es moderación).
  const chips = [...sinComentarios(leer(`${ESC}/Miembros.tsx`)).matchAll(/\{ id: '(\w+)', label: '[^']+', n: /g)].map((m) => m[1]);
  assert.deepEqual(FILTROS_MIEMBROS.map((f) => f.id), chips);

  // Las tablas del Ranking, en el orden en que escritorio las dibuja.
  const tablas = [...sinComentarios(leer(`${ESC}/Ranking.tsx`)).matchAll(/<Tabla titulo="([^"]+)" filas=\{r\.(\w+)\}/g)].map((m) => m[2]);
  assert.deepEqual(PERIODOS.map((p) => p.id), tablas);
  const r = { semana: [{ puesto: 1, puntos: 3, miembro: persona('l:1', 'A') }], mes: [], total: [] };
  assert.equal(filasDelPeriodo(r, 'semana'), r.semana);
  assert.equal(filasDelPeriodo(r, 'total'), r.total);
});

// ── La URL ──────────────────────────────────────────────────────────────────────

test('el producto y el post de la URL: un entero positivo entero, y el producto de ESTA lista', () => {
  assert.equal(idDeUrl('12'), 12);
  assert.equal(idDeUrl('12abc'), null, "'12abc' no abre el 12 (escritorio lee con Number)");
  assert.equal(idDeUrl('1.5'), null);
  assert.equal(idDeUrl('0'), null);
  assert.equal(idDeUrl('-3'), null);
  assert.equal(idDeUrl(''), null);
  assert.equal(idDeUrl(undefined), null);
  assert.equal(idDeUrl(['7', '8']), 7);
  const productos = [{ id: 7 }, { id: 12 }];
  assert.equal(productoElegido(productos, 12), 12);
  assert.equal(productoElegido(productos, 99), 7, 'un producto que no es de este negocio no abre nada');
  assert.equal(productoElegido(productos, null), 7);
  assert.equal(productoElegido([], 7), null);
});

// ── El feed ─────────────────────────────────────────────────────────────────────

test('el feed: la categoría trae SU orden, una página no repite y lo publicado va arriba si entra', () => {
  assert.equal(ordenDeCategoria(CATS, 2), 'nuevos');
  assert.equal(ordenDeCategoria(CATS, 3), 'top_mes');
  assert.equal(ordenDeCategoria(CATS, null), 'default');
  assert.equal(ordenDeCategoria(CATS, 99), 'default');

  const lista = [post({ id: 1 }), post({ id: 2 })];
  const cambiada = conCambio(lista, 2, { likes: 5, meGusta: true });
  assert.equal(cambiada[1].likes, 5);
  assert.equal(lista[1].likes, 0, 'conCambio tocó la lista de entrada');
  assert.equal(cambiada[0], lista[0], 'conCambio rehízo una tarjeta que no cambiaba');

  assert.deepEqual(conPagina(lista, [post({ id: 2 }), post({ id: 3 })]).map((p) => p.id), [1, 2, 3]);

  const nuevo = post({ id: 9, categoriaId: 3 });
  assert.deepEqual(conPublicado(lista, nuevo, null).map((p) => p.id), [9, 1, 2], 'con «Todas», arriba');
  assert.deepEqual(conPublicado(lista, nuevo, 3).map((p) => p.id), [9, 1, 2], 'en su categoría, arriba');
  assert.deepEqual(conPublicado(lista, nuevo, 1).map((p) => p.id), [1, 2], 'en otra categoría no se mete');
  assert.deepEqual(conPublicado([nuevo, ...lista], nuevo, null).map((p) => p.id), [9, 1, 2], 'no se duplica');

  assert.equal(metaDePost({ creado: '2026-10-16T10:00:00.000Z', categoriaId: 2 }, CATS, Date.parse('2026-10-16T13:00:00.000Z')), '3 h · Anuncios');
  assert.equal(metaDePost({ creado: '2026-10-16T10:00:00.000Z', categoriaId: 2 }, CATS, null), 'Anuncios', 'sin reloj, sin «hace»');
});

test('el pulgar optimista: suma o resta uno, y nunca baja de 0', () => {
  assert.deepEqual(likeOptimista(3, false), { likes: 4, meGusta: true });
  assert.deepEqual(likeOptimista(3, true), { likes: 2, meGusta: false });
  assert.deepEqual(likeOptimista(0, true), { likes: 0, meGusta: false });
});

// ── Publicar y comentar ─────────────────────────────────────────────────────────

test('publicar: las categorías que deja el server, el título y la categoría obligatorios, y sólo texto', () => {
  assert.deepEqual(categoriasParaPublicar(comunidad(false)).map((c) => c.id), [1, 3], 'un alumno no publica en las del equipo');
  assert.deepEqual(categoriasParaPublicar(comunidad(true)).map((c) => c.id), [1, 2, 3], 'el equipo publica en todas');
  const permitidas = categoriasParaPublicar(comunidad(false));
  assert.equal(categoriaInicial(permitidas, 3), 3);
  assert.equal(categoriaInicial(permitidas, 2), null, 'la del feed sólo se propone si ahí se puede publicar');

  const sinTitulo = entradaPost({ titulo: '   ', cuerpo: 'algo', categoriaId: 1 }, permitidas);
  assert.deepEqual(sinTitulo, { ok: false, error: R.faltaTitulo });
  assert.deepEqual(entradaPost({ titulo: 'Hola', cuerpo: '', categoriaId: null }, permitidas), { ok: false, error: R.eligeCategoria });
  assert.deepEqual(entradaPost({ titulo: 'Hola', cuerpo: '', categoriaId: 2 }, permitidas), { ok: false, error: R.eligeCategoria },
    'una categoría donde no se puede publicar cuenta como ninguna');
  const ok = entradaPost({ titulo: '  Hola  ', cuerpo: 'Texto', categoriaId: 3 }, permitidas);
  assert.deepEqual(ok, {
    ok: true,
    entrada: { titulo: 'Hola', cuerpo: 'Texto', categoriaId: 3, videoUrl: '', menciones: [], encuesta: null, adjunto: null },
  });
  assert.equal(entradaPost({ titulo: 'Hola', cuerpo: '', categoriaId: null }, []).ok, true, 'sin categorías, no se pide una');
});

test('comentar: la mención viaja sólo si el texto todavía la nombra, y a uno mismo no se lo menciona', () => {
  const r = respondiendoA(com({ id: 40, autor: persona('l:2', 'Ana') }), 'u:9');
  assert.equal(textoDeRespuesta(r), '@Ana ');
  assert.deepEqual(entradaComentario('@Ana gracias', r), { cuerpo: '@Ana gracias', menciones: ['l:2'], responderA: 40 });
  assert.deepEqual(entradaComentario('gracias', r).menciones, [], 'borró el @Ana: no se avisa');
  assert.deepEqual(entradaComentario('@Anabel hola', r).menciones, [], '@Anabel no es @Ana');
  assert.deepEqual(entradaComentario('Primer comentario', null), { cuerpo: 'Primer comentario', menciones: [], responderA: null });
  const propio = respondiendoA(com({ id: 41, autor: persona('u:9', 'Quien Mira', true) }), 'u:9');
  assert.equal(propio.mencion, null);
  assert.equal(textoDeRespuesta(propio), '');
  assert.equal(entradaComentario('sigo', propio).responderA, 41);
});

test('el hilo de dos niveles: una respuesta va a su raíz, y el hilo de entrada no cambia', () => {
  const hilo = [com({ id: 1 }), com({ id: 2, respuestas: [com({ id: 3, padreId: 2 })] })];
  const congelado = JSON.stringify(hilo);
  const conRaiz = conComentario(hilo, com({ id: 4 }));
  assert.deepEqual(conRaiz.map((c) => c.id), [1, 2, 4], 'uno de primer nivel va al final');
  const conResp = conComentario(hilo, com({ id: 5, padreId: 2 }));
  assert.deepEqual(conResp[1].respuestas.map((c) => c.id), [3, 5], 'la respuesta, al final de las de su raíz');
  assert.deepEqual(conResp[0].respuestas, []);
  const huerfana = conComentario(hilo, com({ id: 6, padreId: 77 }));
  assert.deepEqual(huerfana.map((c) => [c.id, c.padreId]), [[1, null], [2, null], [6, null]], 'sin su raíz, se ve igual');
  const likeado = conCambioEnHilo(hilo, 3, { likes: 2, meGusta: true });
  assert.equal(likeado[1].respuestas[0].likes, 2);
  assert.equal(likeado[0].likes, 0);
  assert.equal(JSON.stringify(hilo), congelado, 'se cambió el hilo de entrada');
});

test('Miembros: la segunda línea dice «En línea», «Activo …» o la bio', () => {
  const ahora = Date.parse('2026-10-16T12:00:00.000Z');
  assert.equal(segundaDeMiembro({ enLinea: true, ultimaActividad: '2026-10-16T11:59:00.000Z', bio: 'x' }, ahora), R.enLinea);
  assert.equal(segundaDeMiembro({ enLinea: false, ultimaActividad: '2026-10-16T11:55:00.000Z', bio: 'x' }, ahora), `${R.activo} 5 min`);
  assert.equal(segundaDeMiembro({ enLinea: false, ultimaActividad: '2026-10-16T11:55:00.000Z', bio: 'Coach' }, null), 'Coach', 'sin reloj, sin «hace»');
  assert.equal(segundaDeMiembro({ enLinea: false, ultimaActividad: null, bio: '' }, ahora), '');
});

// ── La página y la carpeta ──────────────────────────────────────────────────────

test('la página: su guard, nada del ?ws=, las lecturas y las actions de escritorio, y sin copias en /m', () => {
  const page = sinComentarios(leer(`${CARPETA}/page.tsx`));
  assert.match(page, /requireMovil\(\{ navKey: 'cs-comunidad' \}\)/);
  const datos = sinComentarios(leer(`${CARPETA}/datos.ts`));
  assert.match(datos, /^import 'server-only';/m);
  for (const f of ['productosDeLaEntrega()', 'nombresDeCursos(lista.map((p) => p.id), { conTitulo: true })', 'productoDelPost(ws, postInicial)',
    'actorDelEquipo(productoId)', 'inicioComunidad(actor)', 'feedComunidad(actor, {})']) {
    assert.ok(datos.includes(f), `datos.ts ya no lee con ${f} (la lectura de escritorio)`);
  }
  assert.match(sinComentarios(leer(`${CARPETA}/ComunidadM.tsx`)),
    /import \{ apiDelEquipo \} from '@\/app\/customer-success\/comunidad\/api-equipo'/, 'las actions de escritorio, por su API');

  // Ningún módulo 'use client' de escritorio (se llevaría la comunidad entera al paquete del teléfono).
  const clientes = readdirSync(join(RAIZ, ESC)).filter((n) => /\.tsx?$/.test(n) && /^'use client'/.test(leer(`${ESC}/${n}`)))
    .map((n) => n.replace(/\.tsx?$/, ''));
  assert.ok(clientes.includes('piezas') && clientes.includes('Feed'), 'no leí los módulos de cliente de escritorio');
  for (const f of FUENTES) {
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /\bsp\.ws\b|get\('ws'\)|searchParams\.ws\b|\bws=/, `${f} lee el workspace de la URL`);
    for (const c of clientes) assert.ok(!src.includes(`'@/app/_comunidad/${c}'`), `${f} importa ${c} (un módulo 'use client' de escritorio)`);
    assert.doesNotMatch(src, /function (contar|tapaDeVideo|mencionesVigentes|apiDelEquipo|actorDelEquipo|seguro|nombraA|puedePublicarEn)\b|\bTRAZOS\b/,
      `${f} tiene su copia de algo de escritorio`);
    // El hilo de una clase (comunidad_posts.clase_id) lo decide lib/comunidad-datos.ts: acá no se consulta la tabla.
    assert.doesNotMatch(src, /comunidad_posts|\.from\(|getTenantDb|getSupabase/, `${f} consulta la base por su cuenta`);
  }
  // Los íconos de la comunidad, mudados a un módulo sin 'use client' y re-exportados (no copiados).
  assert.doesNotMatch(leer(`${ESC}/iconos.tsx`), /^'use client'/m);
  const piezasEsc = sinComentarios(leer(`${ESC}/piezas.tsx`));
  assert.match(piezasEsc, /export \{ Ico \} from '\.\/iconos';/);
  assert.doesNotMatch(piezasEsc, /\bTRAZOS\b|function Ico\b/, 'piezas.tsx volvió a tener su propia copia de los íconos');
});

test('cada hoja se monta de nuevo con SU llave, y lo que no es idempotente no va dos veces', () => {
  const raiz = sinComentarios(leer(`${CARPETA}/ComunidadM.tsx`));
  // Con UNA llave para todas, abrir el perfil desde Buscar montaba de nuevo también a Buscar (todavía abierta).
  for (const [hoja, k] of [['HojaPostM', 'post'], ['HojaPerfilM', 'perfil'], ['HojaBuscarM', 'buscar'], ['HojaEscribirM', 'escribir']]) {
    assert.match(raiz, new RegExp(`<${hoja} key=\\{vez\\.${k}\\}`), `${hoja} no tiene su propia llave`);
  }
  assert.match(raiz, /setVez\(\(v\) => \(\{ \.\.\.v, \[h\]: v\[h\] \+ 1 \}\)\)/, 'abrir una hoja sube SÓLO su vez');
  const postM = sinComentarios(leer(`${CARPETA}/PostM.tsx`));
  assert.match(postM, /if \(!post \|\| enviandoRef\.current/, 'comentar dos veces a la vez');
  assert.match(postM, /ocupado=\{enviando\}/);
  const hojas = sinComentarios(leer(`${CARPETA}/HojasM.tsx`));
  assert.match(hojas, /if \(enviandoRef\.current\) return;/, 'publicar dos veces a la vez');
  assert.match(sinComentarios(leer(`${CARPETA}/piezas.tsx`)), /if \(!puede \|\| enCurso\.current\) return;/, 'el pulgar dos veces a la vez');
});

test('el CSS de la carpeta, los íconos y el copy', () => {
  const css = sinComentarios(leer(`${CARPETA}/comunidad.css`));
  const primitivas = leer('app/m/m.css') + leer('app/_ui/ui.css');
  const clases = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  assert.ok(clases.size >= 20, 'no se leyó ninguna clase');
  for (const c of clases) {
    if (c.startsWith('m-comunidad-')) continue;
    assert.match(primitivas, new RegExp(`\\.${escapar(c)}(?![\\w-])`), `.${c}: ni lleva .m-comunidad- ni es una primitiva`);
  }
  const globales = leer('app/globals.css');
  const tokens = new Set([...css.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]));
  assert.ok(tokens.size >= 8, 'no se leyó ningún token');
  for (const t of tokens) assert.match(globales, new RegExp(`--${escapar(t)}\\s*:`), `var(--${t}) no existe en app/globals.css`);
  // Las clases que dibuja el código, en la hoja (una sin regla queda sin estilo, sin error).
  const todas = FUENTES.map((f) => sinComentarios(leer(f))).join('\n');
  const usadas = new Set([...todas.matchAll(/\bm-comunidad-[\w-]+/g)].map((m) => m[0]).filter((c) => !c.endsWith('-')));
  for (const c of usadas) assert.ok(clases.has(c), `.${c} se usa y no está en comunidad.css`);

  const iconos = leer('app/_components/icons.tsx');
  const delSet = new Set([
    ...[...todas.matchAll(/<Icon name="([\w-]+)"/g)].map((m) => m[1]),
    ...[...todas.matchAll(/\bicono="([\w-]+)"/g)].map((m) => m[1]),
  ]);
  assert.ok(delSet.size >= 4, 'no se leyó ningún ícono');
  for (const n of delSet) assert.match(iconos, new RegExp(`^\\s*'?${escapar(n)}'?\\s*:`, 'm'), `<Icon name="${n}"> no existe: dibuja un punto`);
  const deLaComunidad = new Set([...todas.matchAll(/<Ico n="([\w-]+)"/g)].map((m) => m[1]));
  assert.ok(deLaComunidad.size >= 6, 'no se leyó ningún ícono de la comunidad');
  for (const n of deLaComunidad) assert.ok(NOMBRES_ICO.includes(n), `<Ico n="${n}"> no existe: dibuja un SVG vacío`);

  // Español neutro con tú: ningún voseo en lo que se dibuja (borde UNICODE: `\b` no ve la «á»).
  const VOSEO = /(?<!\p{L})(tocá|mirá|tenés|podés|querés|elegí|escribí|hacé|andá|fijate|contá|probá|abrí|sabés|decí|poné|usá|guardá|publicá|comentá|respondé|buscá|cerrá|votá|subí|dejá|mandá|esperá|intentá|llegás|vos|sos|acá)(?!\p{L})/iu;
  for (const f of FUENTES) {
    for (const m of sinComentarios(leer(f)).matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`|>([^<>{}\n]+)</g)) {
      const t = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
      assert.doesNotMatch(t, VOSEO, `${f}: voseo en «${t.trim()}»`);
    }
  }
});

// ── ROTURAS (16/10/2026) ─────────────────────────────────────────────────────────
// Medido de a una con un script que muta el archivo, corre este test y lo devuelve. Base: 12 / 0.
//   · R.verMas = 'Ver mas' (sin tilde)                                                → 11 / 1
//   · R.escribeAlgo = 'Escribe alg' (con `includes` pasaba: está ADENTRO de 'Escribe algo') → 11 / 1
//   · VISTAS_COMUNIDAD con Ranking antes que Miembros                                  → 11 / 1
//   · idDeUrl con `parseInt` ('12abc' abría el 12)                                     → 11 / 1
//   · conPublicado sin mirar la categoría (el post nuevo se metía en otro filtro)      → 11 / 1
//   · likeOptimista sin `Math.max` (un -1 en el pulgar)                                → 11 / 1
//   · categoriasParaPublicar devolviendo todas (un alumno en las del equipo)           → 11 / 1
//   · entradaComentario mandando la mención aunque se borró el @nombre                 → 11 / 1
//   · conComentario empujando la respuesta en el hilo de ENTRADA                       → 11 / 1
//   · <HojaPerfilM key={vez.post}> (una llave para dos hojas)                          → 11 / 1
//   · comentar sin `enviandoRef` (dos envíos a la vez)                                 → 11 / 1
//   · comunidad.css con `.m-cmu-check` (prefijo abreviado)                             → 11 / 1
//   · comunidad.css con `var(--comunidad-fondo)` (no existe)                           → 11 / 1
//   · <Ico n="chinche"> (no está en NOMBRES_ICO)                                      → 11 / 1
//   · icono="nivel" en una FilaM (no está en icons.tsx)                                → 11 / 1
//   · «Cerrá sin publicar» en un rótulo (antes de sumar «cerrá» a la lista: 12 / 0)    → 11 / 1
//   · datos.ts con `nombresDeCursos(…, { conTitulo: false })`                          → 11 / 1
//   · FeedM.tsx importando `Ico` de '@/app/_comunidad/piezas' ('use client')           → 11 / 1
//   · datos.ts con un 'comunidad_posts' propio                                         → 11 / 1
//   · app/_comunidad/piezas.tsx con su `const TRAZOS` de vuelta                        → 11 / 1
