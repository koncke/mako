// =============================================================================
// /m/comunidad — lo que decide la Comunidad del teléfono, sin tocar la base (puro)
// =============================================================================
// Sin 'use client' ni 'server-only' a propósito: lo usan la página (server, al elegir el producto), la
// pantalla (navegador, al dar like, comentar o publicar) y tests/m-comunidad.test.ts lo EJECUTA.
//
// ⚠️ NADA DE ESTO DECIDE PERMISOS NI GUARDA NADA: las server actions de escritorio
//    (app/customer-success/comunidad/actions.ts, por `apiDelEquipo`) vuelven a preguntar todo con el actor
//    de la SESIÓN, y lib/comunidad-datos.ts valida lo que llega (`validarPost`, `validarComentario`). Lo de
//    acá es lo que la pantalla necesita para dibujar en el acto lo que el server va a confirmar.
// ⚠️ Las reglas son las de lib/comunidad-reglas.ts (quién publica en qué categoría: `puedePublicarEn`; qué
//    mención vale: `nombraA`), nunca una copia.

import type {
  CategoriaVista, ComentarioVista, ComunidadVista, FilaRanking, FiltroMiembros, MiembroDirectorio, MiembrosVista,
  PostVista, RankingVista,
} from '@/lib/comunidad-tipos';
import { haceCuanto, nombraA, puedePublicarEn, type OrdenFeed } from '@/lib/comunidad-reglas';
import type { EntradaComentario, EntradaPost } from '@/app/_comunidad/api';

// ── Los rótulos ────────────────────────────────────────────────────────────────
// Los que el teléfono REPITE de escritorio, escritos una vez. tests/m-comunidad.test.ts busca cada uno ENTERO
// en su archivo de escritorio (la tabla de orígenes está escrita a mano en el test).

export const R = {
  // Las pestañas de un grupo de Skool (app/_comunidad/Comunidad.tsx, `PESTANAS`).
  comunidad: 'Comunidad',
  miembros: 'Miembros',
  ranking: 'Ranking',
  // El selector de producto y los vacíos de la tab (ComunidadEquipo.tsx y su page.tsx).
  producto: 'Producto',
  sinProductos: 'Sin productos',
  noPudeCargar: 'No pude cargar la comunidad',
  sinLeerProductos: 'No pude leer tus productos.',
  // El feed (Feed.tsx).
  escribeAlgo: 'Escribe algo',
  todas: 'Todas',
  fijado: 'Fijado',
  cerrado: 'Cerrado',
  encuesta: 'Encuesta',
  video: 'Video',
  archivo: 'Archivo',
  sinPosts: 'Todavía no hay posts.',
  verMas: 'Ver más',
  publicado: 'Publicado',
  // El compositor (Compositor.tsx).
  nuevoPost: 'Nuevo post',
  titulo: 'Título',
  textoPost: 'Escribe algo…',
  publicar: 'Publicar',
  faltaTitulo: 'Falta el título.',
  eligeCategoria: 'Elige una categoría.',
  // El post abierto (PostAbierto.tsx).
  post: 'Post',
  escribeComentario: 'Escribe un comentario',
  tuRespuesta: 'Tu respuesta',
  comentar: 'Comentar',
  responder: 'Responder',
  noResponder: 'No responder',
  comentariosCerrados: 'Comentarios cerrados.',
  meGusta: 'Me gusta',
  quitarLike: 'Quitar like',
  esTuyo: 'Es tuyo',
  // Miembros (Miembros.tsx).
  todos: 'Todos',
  equipo: 'Equipo',
  enLinea: 'En línea',
  buscarMiembros: 'Buscar miembros',
  nadieConEseNombre: 'Nadie con ese nombre.',
  nadieEnFiltro: 'Nadie en este filtro.',
  activo: 'Activo',
  perfil: 'Perfil',
  // Ranking (Ranking.tsx).
  semana: 'Últimos 7 días',
  mes: 'Últimos 30 días',
  total: 'Total',
  nadieSumo: 'Nadie sumó puntos todavía.',
  unLike: '1 like = 1 punto',
  deLosMiembros: '% de los miembros',
  // Buscar (Busqueda.tsx).
  buscar: 'Buscar',
  postsYMiembros: 'Posts y miembros',
  posts: 'Posts',
} as const;

/** Lo del teléfono que escritorio no tiene escrito. */
export const T = {
  /** El título de la hoja de los niveles (escritorio los dibuja al lado de su tarjeta, sin título). */
  niveles: 'Niveles',
  respondiendoA: 'Respondiendo a',
  sinConexion: 'Sin conexión',
  postIdo: 'Ese post ya no está.',
} as const;

/** La fila «… · En la computadora»: lo que en el teléfono no se hace. */
export const EN_LA_COMPUTADORA = 'Calendario, About y moderación';

// ── Las pestañas ────────────────────────────────────────────────────────────────

export type VistaComunidad = 'comunidad' | 'miembros' | 'ranking';

/**
 * Las pestañas del teléfono: las de escritorio (`PESTANAS`, app/_comunidad/Comunidad.tsx) que se usan con el
 * dedo, en SU orden. Calendario y About quedan en la computadora (`EN_LA_COMPUTADORA`).
 */
export const VISTAS_COMUNIDAD: Array<{ id: VistaComunidad; label: string }> = [
  { id: 'comunidad', label: R.comunidad },
  { id: 'miembros', label: R.miembros },
  { id: 'ranking', label: R.ranking },
];

// ── El producto y el post de la URL ─────────────────────────────────────────────

/**
 * Un id que llega en la URL (`?producto=`, `?post=`): un entero positivo ENTERO, o nada. Es la lectura de
 * escritorio (`Number(sp.producto)`): '12abc' no abre el 12.
 */
export function idDeUrl(raw: string | string[] | null | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || s.trim() === '') return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** El producto que se mira: el pedido si es de esta lista, o el primero (como escritorio). */
export function productoElegido(productos: ReadonlyArray<{ id: number }>, pedido: number | null): number | null {
  return productos.find((p) => p.id === pedido)?.id ?? productos[0]?.id ?? null;
}

// ── El feed ─────────────────────────────────────────────────────────────────────

/** El orden con que se pide el feed al elegir una categoría: el que ESA categoría tiene por defecto (escritorio). */
export function ordenDeCategoria(categorias: readonly CategoriaVista[], id: number | null): OrdenFeed {
  return id != null ? categorias.find((c) => c.id === id)?.ordenDefault ?? 'default' : 'default';
}

/** Cambia un post de una lista (una tarjeta), sin tocar las otras ni la lista de entrada. */
export function conCambio(lista: readonly PostVista[], id: number, cambio: Partial<PostVista>): PostVista[] {
  return lista.map((p) => (p.id === id ? { ...p, ...cambio } : p));
}

/** Suma una página del feed sin repetir lo que ya está (dos «Ver más» no duplican tarjetas). */
export function conPagina(lista: readonly PostVista[], nuevos: readonly PostVista[]): PostVista[] {
  const ya = new Set(lista.map((p) => p.id));
  return [...lista, ...nuevos.filter((p) => !ya.has(p.id))];
}

/** El post recién publicado va ARRIBA, si entra en la categoría que se está mirando (escritorio). */
export function conPublicado(lista: readonly PostVista[], p: PostVista, categoria: number | null): PostVista[] {
  if (categoria != null && p.categoriaId !== categoria) return [...lista];
  return [p, ...lista.filter((x) => x.id !== p.id)];
}

/** La línea gris de una tarjeta: «3 h · Anuncios». Sin reloj (antes de montar), sólo la categoría. */
export function metaDePost(p: Pick<PostVista, 'creado' | 'categoriaId'>, categorias: readonly CategoriaVista[], ahora: number | null): string {
  const hace = ahora == null ? '' : haceCuanto(p.creado, ahora);
  const cat = p.categoriaId == null ? null : categorias.find((c) => c.id === p.categoriaId)?.nombre ?? null;
  return [hace, cat].filter(Boolean).join(' · ');
}

/** La foto de la tarjeta: la imagen adjunta, si se pudo firmar. */
export const tapaDePost = (p: Pick<PostVista, 'adjunto'>): string | null => (p.adjunto?.imagen && p.adjunto.url ? p.adjunto.url : null);

// ── El like ─────────────────────────────────────────────────────────────────────

/** Lo que se dibuja en el acto al tocar el pulgar (el server confirma o se vuelve atrás). Nunca menos de 0. */
export function likeOptimista(likes: number, meGusta: boolean): { likes: number; meGusta: boolean } {
  return { likes: Math.max(0, likes + (meGusta ? -1 : 1)), meGusta: !meGusta };
}

// ── Publicar ────────────────────────────────────────────────────────────────────

/**
 * Las categorías donde quien mira puede publicar: la MISMA regla del server (`puedePublicarEn`), con quien
 * mira como lo describe `ComunidadVista` (el equipo publica en todas; un alumno, en las de «todos»).
 */
export function categoriasParaPublicar(c: Pick<ComunidadVista, 'categorias' | 'yo' | 'puedoConfigurar'>): CategoriaVista[] {
  const actor = { clave: c.yo.clave, equipo: c.yo.equipo, adminWs: c.puedoConfigurar };
  return c.categorias.filter((x) => puedePublicarEn(actor, x));
}

/**
 * Lo que manda el teléfono al publicar: título, texto y categoría. El video, la encuesta y el archivo se
 * suman en la computadora. Valida lo que valida el compositor de escritorio antes de mandar (el server lo
 * vuelve a validar entero).
 */
export function entradaPost(
  b: { titulo: string; cuerpo: string; categoriaId: number | null },
  permitidas: readonly CategoriaVista[],
): { ok: true; entrada: EntradaPost } | { ok: false; error: string } {
  const titulo = b.titulo.trim();
  if (!titulo) return { ok: false, error: R.faltaTitulo };
  const categoriaId = b.categoriaId != null && permitidas.some((c) => c.id === b.categoriaId) ? b.categoriaId : null;
  if (permitidas.length && categoriaId == null) return { ok: false, error: R.eligeCategoria };
  return {
    ok: true,
    entrada: { titulo, cuerpo: b.cuerpo, categoriaId, videoUrl: '', menciones: [], encuesta: null, adjunto: null },
  };
}

/** La categoría con que abre el compositor: la del feed, si ahí se puede publicar (escritorio). */
export function categoriaInicial(permitidas: readonly CategoriaVista[], delFeed: number | null): number | null {
  return delFeed != null && permitidas.some((c) => c.id === delFeed) ? delFeed : null;
}

// ── Comentar ────────────────────────────────────────────────────────────────────

/** A quién se le contesta: el comentario, su hilo y la mención (salvo que sea uno mismo, como en Skool). */
export type Respondiendo = { a: number; nombre: string; mencion: { clave: string; nombre: string } | null };

export function respondiendoA(c: Pick<ComentarioVista, 'id' | 'autor'>, yo: string): Respondiendo {
  return {
    a: c.id,
    nombre: c.autor.nombre,
    mencion: c.autor.clave === yo ? null : { clave: c.autor.clave, nombre: c.autor.nombre },
  };
}

/** El texto con que arranca una respuesta: `@Nombre ` (como escritorio), o nada si es a uno mismo. */
export const textoDeRespuesta = (r: Respondiendo | null): string => (r?.mencion ? `@${r.mencion.nombre} ` : '');

/**
 * Lo que manda el teléfono al comentar. La mención viaja sólo si el texto TODAVÍA la nombra (`nombraA`): si
 * se borró el `@Nombre`, no se avisa a nadie. El server la vuelve a filtrar igual (`sanearMenciones`).
 */
export function entradaComentario(texto: string, r: Respondiendo | null): EntradaComentario {
  const menciones = r?.mencion && nombraA(texto, r.mencion.nombre) ? [r.mencion.clave] : [];
  return { cuerpo: texto, menciones, responderA: r?.a ?? null };
}

/**
 * Suma un comentario al hilo de DOS niveles: uno de primer nivel va al final; una respuesta, al final de las
 * respuestas de su raíz (el server la cuelga de la raíz: `padreDeRespuesta`). Nunca cambia el hilo de entrada.
 */
export function conComentario(hilo: readonly ComentarioVista[], c: ComentarioVista): ComentarioVista[] {
  if (c.padreId == null) return [...hilo, c];
  if (!hilo.some((r) => r.id === c.padreId)) return [...hilo, { ...c, padreId: null }];
  return hilo.map((r) => (r.id === c.padreId ? { ...r, respuestas: [...r.respuestas, c] } : r));
}

/** Cambia un comentario (o una respuesta) del hilo: el like. */
export function conCambioEnHilo(hilo: readonly ComentarioVista[], id: number, cambio: Partial<ComentarioVista>): ComentarioVista[] {
  return hilo.map((r) => (r.id === id
    ? { ...r, ...cambio }
    : { ...r, respuestas: r.respuestas.map((x) => (x.id === id ? { ...x, ...cambio } : x)) }));
}

// ── Miembros ────────────────────────────────────────────────────────────────────

/** Los filtros del directorio, en el orden de escritorio. («Fuera» es moderación: en la computadora.) */
export const FILTROS_MIEMBROS: ReadonlyArray<{ id: FiltroMiembros; label: string }> = [
  { id: 'todos', label: R.todos },
  { id: 'equipo', label: R.equipo },
  { id: 'en_linea', label: R.enLinea },
];

export function conteoDeFiltro(conteos: MiembrosVista['conteos'] | null | undefined, id: FiltroMiembros): number | null {
  if (!conteos) return null;
  return id === 'todos' ? conteos.todos : id === 'equipo' ? conteos.equipo : conteos.enLinea;
}

/** La segunda línea de un miembro: «En línea», «Activo 5 min», o su bio si nunca entró. */
export function segundaDeMiembro(m: Pick<MiembroDirectorio, 'enLinea' | 'ultimaActividad' | 'bio'>, ahora: number | null): string {
  if (m.enLinea) return R.enLinea;
  if (m.ultimaActividad && ahora != null) {
    const hace = haceCuanto(m.ultimaActividad, ahora);
    if (hace) return `${R.activo} ${hace}`;
  }
  return m.bio;
}

/** El vacío del directorio: con una búsqueda, «nadie con ese nombre»; sin ella, «nadie en este filtro». */
export const vacioDeMiembros = (q: string): string => (q.trim() ? R.nadieConEseNombre : R.nadieEnFiltro);

// ── Ranking ─────────────────────────────────────────────────────────────────────

export type Periodo = 'semana' | 'mes' | 'total';

/** Las tres tablas de Leaderboards, en el orden de escritorio. */
export const PERIODOS: ReadonlyArray<{ id: Periodo; label: string }> = [
  { id: 'semana', label: R.semana },
  { id: 'mes', label: R.mes },
  { id: 'total', label: R.total },
];

export function filasDelPeriodo(r: Pick<RankingVista, 'semana' | 'mes' | 'total'>, p: Periodo): FilaRanking[] {
  return p === 'semana' ? r.semana : p === 'mes' ? r.mes : r.total;
}

/** Los puntos de una fila, como escritorio: «+12». */
export const rotuloPuntos = (n: number): string => `+${n}`;

/** «Nivel 3 · 12 puntos» del perfil (escritorio). */
export const rotuloPuntosPerfil = (n: number): string => `${n} ${n === 1 ? 'punto' : 'puntos'}`;
