// =============================================================================
// api — lo que la comunidad le pide al server, igual para el equipo y para el alumno
// =============================================================================
// Las pantallas de app/_comunidad/ son UNA sola para los dos (la del equipo en
// /customer-success/comunidad y la del alumno en su portal). Lo único que cambia es POR DÓNDE piden:
//   · el equipo, por las server actions de app/customer-success/comunidad/actions.ts (con su sesión);
//   · el alumno, por POST a /api/compartido/comunidad con el token de su link (`apiDelAlumno`).
// Este contrato es lo que las dos implementan; las pantallas no saben cuál tienen.
//
// Sin 'use client' ni 'server-only': son tipos y un `fetch` que sólo corre cuando el navegador lo llama.

import type {
  CategoriaVista, ComentarioVista, ComunidadVista, EncuestaVista, FeedVista, FiltroMiembros, MiembrosVista,
  PerfilVista, PostDetalle, PostVista, RankingVista, Resultado, CalendarioVista, CampanaVista, AboutVista,
  BusquedaVista, SacadoVista, OpcionesEvento, HiloClaseVista,
} from '@/lib/comunidad-tipos';
import type { OrdenFeed, PermisoCategoria, Red, TokenTexto } from '@/lib/comunidad-reglas';
import type { AccesoEvento, LugarTipo } from '@/lib/comunidad-eventos';

export type ConsultaFeed = { categoriaId: number | null; orden: OrdenFeed; pagina: number };

export type AdjuntoSubido = { path: string; nombre: string; mime: string; bytes: number };

/** Lo que manda el compositor. El server lo vuelve a validar entero (`validarPost`). */
export type EntradaPost = {
  titulo: string;
  cuerpo: string;
  categoriaId: number | null;
  videoUrl: string;
  menciones: string[];
  encuesta: string[] | null;
  adjunto: AdjuntoSubido | null;
};

export type EntradaComentario = { cuerpo: string; menciones: string[]; responderA: number | null };

export type EntradaCategoria = { id?: number; nombre: string; permiso: PermisoCategoria; ordenDefault: OrdenFeed };

export type EntradaPerfil = { bio: string; ubicacion: string; links: Partial<Record<Red, string>> };

/** «Editar / borrar: este evento · este y los siguientes · todos». */
export type AlcanceEvento = 'este' | 'siguientes' | 'todos';

/** Lo que manda el editor de eventos. El server lo vuelve a validar entero (`sanearEvento`). */
export type EntradaEvento = {
  id?: number;
  /** Con una serie: qué se edita, y desde qué ocurrencia (su fecha local). */
  alcance?: AlcanceEvento;
  ocurrencia?: string | null;
  titulo: string;
  descripcion: string;
  fecha: string;
  hora: string;
  zona: string;
  duracionMin: number;
  lugarTipo: LugarTipo;
  lugar: string;
  portada: string | null;
  acceso: AccesoEvento;
  /** `null` = no se repite. */
  recurrencia: {
    frecuencia: 'diaria' | 'semanal' | 'mensual';
    cada: number;
    dias: number[];
    fin: { tipo: 'nunca' } | { tipo: 'fecha'; fecha: string } | { tipo: 'veces'; veces: number };
  } | null;
};

export type EntradaAbout = { nombre: string; descripcion: string; texto: string; reglas: string };

export type ApiComunidad = {
  inicio(): Promise<Resultado<{ comunidad: ComunidadVista; feed: FeedVista }>>;
  feed(q: ConsultaFeed): Promise<Resultado<{ feed: FeedVista }>>;
  post(id: number): Promise<Resultado<{ post: PostDetalle }>>;
  publicar(e: EntradaPost): Promise<Resultado<{ post: PostVista }>>;
  editarPost(id: number, e: EntradaPost): Promise<Resultado<{ post: PostVista }>>;
  borrarPost(id: number): Promise<Resultado>;
  comentar(postId: number, e: EntradaComentario): Promise<Resultado<{ comentario: ComentarioVista }>>;
  editarComentario(id: number, e: EntradaComentario): Promise<Resultado<{ cuerpo: TokenTexto[]; texto: string }>>;
  borrarComentario(id: number): Promise<Resultado>;
  like(objetivo: string, si: boolean): Promise<Resultado<{ likes: number; meGusta: boolean }>>;
  votar(postId: number, opcion: string): Promise<Resultado<{ encuesta: EncuestaVista }>>;
  ranking(): Promise<Resultado<{ ranking: RankingVista }>>;
  miembros(q: { filtro: FiltroMiembros; q: string }): Promise<Resultado<{ miembros: MiembrosVista }>>;
  perfil(clave: string): Promise<Resultado<{ perfil: PerfilVista }>>;
  guardarPerfil(p: EntradaPerfil): Promise<Resultado<{ perfil: PerfilVista }>>;
  subida(mime: string, bytes: number): Promise<Resultado<{ path: string; signedUrl: string; apikey: string | null }>>;
  descartar(path: string): Promise<Resultado>;
  /** Avisa que sigue acá («en línea»). Sólo el alumno: el equipo ya lo marca cada pedido. */
  latido?(): Promise<void>;
  // ── La segunda mitad, para los dos ──
  calendario(q: { desde: number; hasta: number }): Promise<Resultado<{ calendario: CalendarioVista }>>;
  /** El .ics de una ocurrencia (`fecha`) o de la serie entera (`serie`), armado en el server. */
  ics(q: { id: number; fecha: string | null; serie: boolean }): Promise<Resultado<{ nombre: string; ics: string }>>;
  campana(): Promise<Resultado<{ campana: CampanaVista }>>;
  leerCampana(ids: number[] | 'todas'): Promise<Resultado>;
  seguirPost(id: number, si: boolean): Promise<Resultado<{ sigo: boolean }>>;
  about(): Promise<Resultado<{ about: AboutVista }>>;
  buscar(q: string): Promise<Resultado<{ busqueda: BusquedaVista }>>;
  // ── Los comentarios de una CLASE (item 13 del 08/10/2026, mig 0227), para los dos ──
  // Opcionales: la comunidad entera no los necesita, y lo que los dibuja (app/_cursos/ComentariosClase.tsx)
  // no se monta si la API no los trae. Responder, likear, editar y borrar un comentario de una clase son
  // las de arriba, sobre el post del hilo (`postId`).
  hiloClase?(claseId: number): Promise<Resultado<{ hilo: HiloClaseVista }>>;
  comentarClase?(claseId: number, e: EntradaComentario): Promise<Resultado<{ comentario: ComentarioVista; postId: number }>>;
  // ── Sólo el equipo (la pantalla no los ofrece si faltan; el server igual los rechaza) ──
  fijarPost?(id: number, si: boolean): Promise<Resultado<{ fijado: boolean }>>;
  guardarCategoria?(c: EntradaCategoria): Promise<Resultado<{ categorias: CategoriaVista[] }>>;
  borrarCategoria?(id: number): Promise<Resultado<{ categorias: CategoriaVista[] }>>;
  moverCategoria?(id: number, dir: 'arriba' | 'abajo'): Promise<Resultado<{ categorias: CategoriaVista[] }>>;
  guardarNombresNivel?(nombres: string[]): Promise<Resultado<{ nombresNivel: string[] }>>;
  opcionesEvento?(): Promise<Resultado<OpcionesEvento>>;
  guardarEvento?(e: EntradaEvento): Promise<Resultado<{ id: number }>>;
  borrarEvento?(q: { id: number; alcance: AlcanceEvento; ocurrencia: string | null }): Promise<Resultado>;
  guardarAbout?(e: EntradaAbout): Promise<Resultado<{ about: AboutVista }>>;
  guardarAjustes?(e: { nivelParaPostear: number; zona: string | null }): Promise<Resultado<{ about: AboutVista }>>;
  sacar?(clave: string, opts: { motivo: string; borrarContenido: boolean }): Promise<Resultado<{ borrados: { posts: number; comentarios: number } }>>;
  admitir?(clave: string): Promise<Resultado>;
  sacados?(): Promise<Resultado<{ sacados: SacadoVista[] }>>;
  cerrarComentarios?(id: number, si: boolean): Promise<Resultado<{ cerrado: boolean }>>;
};

/** Cuánto se espera una respuesta antes de decir que no llegó (AGENTS.md: el `fetch` va con `signal`). */
const ESPERA_MS = 35_000;

/**
 * La API del ALUMNO: POST a /api/compartido/comunidad con el token en el CUERPO. Un 404 es «tu acceso
 * no abre esto» (token cortado, baneado, producto ajeno): el server no dice cuál, y acá tampoco.
 */
export function apiDelAlumno(token: string, productoId: number): ApiComunidad {
  async function pedir<T extends object>(a: string, args: Record<string, unknown> = {}): Promise<Resultado<T>> {
    try {
      const r = await fetch('/api/compartido/comunidad', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...args, t: token, p: productoId, a }),
        cache: 'no-store',
        signal: AbortSignal.timeout(ESPERA_MS),
      });
      if (r.status === 404) return { ok: false, error: 'Tu acceso a la comunidad no está activo.' };
      if (r.status === 429) return { ok: false, error: 'Vas muy rápido. Espera un momento.' };
      const j = (await r.json().catch(() => null)) as Resultado<T> | null;
      if (!j || typeof j !== 'object') return { ok: false, error: 'No pude conectar.' };
      return j;
    } catch (e) {
      const corte = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
      return { ok: false, error: corte ? 'Tardó demasiado. Intenta de nuevo.' : 'No pude conectar.' };
    }
  }
  return {
    inicio: () => pedir('inicio'),
    feed: (q) => pedir('feed', q),
    post: (id) => pedir('post', { id }),
    publicar: (post) => pedir('publicar', { post }),
    editarPost: (id, post) => pedir('editar', { id, post }),
    borrarPost: (id) => pedir('borrar', { id }),
    comentar: (postId, comentario) => pedir('comentar', { postId, comentario }),
    editarComentario: (id, comentario) => pedir('editarComentario', { id, comentario }),
    borrarComentario: (id) => pedir('borrarComentario', { id }),
    like: (objetivo, si) => pedir('like', { objetivo, si }),
    votar: (postId, opcion) => pedir('votar', { postId, opcion }),
    ranking: () => pedir('ranking'),
    miembros: (q) => pedir('miembros', q),
    perfil: (clave) => pedir('perfil', { clave }),
    guardarPerfil: (perfil) => pedir('guardarPerfil', { perfil }),
    subida: (mime, bytes) => pedir('subida', { mime, bytes }),
    descartar: (path) => pedir('descartar', { path }),
    latido: async () => { await pedir('latido'); },
    calendario: (q) => pedir('calendario', q),
    ics: (q) => pedir('ics', q),
    campana: () => pedir('campana'),
    leerCampana: (ids) => pedir('leerCampana', { ids }),
    seguirPost: (id, si) => pedir('seguir', { id, si }),
    about: () => pedir('about'),
    buscar: (q) => pedir('buscar', { q }),
    hiloClase: (claseId) => pedir('clase', { claseId }),
    comentarClase: (claseId, comentario) => pedir('comentarClase', { claseId, comentario }),
  };
}

/**
 * Envuelve una server action para que un corte de red no TIRE en la pantalla: devuelve `{ ok: false }`
 * como cualquier otro fallo. Una action que se cae a mitad (deploy nuevo, conexión) rechaza la promesa.
 */
export function seguro<A extends unknown[], T extends object>(fn: (...a: A) => Promise<Resultado<T>>): (...a: A) => Promise<Resultado<T>> {
  return async (...a: A) => {
    try {
      return await fn(...a);
    } catch {
      return { ok: false, error: 'No pude conectar.' };
    }
  };
}
