// =============================================================================
// comunidad-tipos — la forma de lo que viaja al navegador (la comunidad del equipo y la del alumno)
// =============================================================================
// Sólo tipos. Los arma lib/comunidad-datos.ts (server) y los dibuja app/_comunidad/ (navegador): un
// solo lugar para la forma, así la vista del equipo y la del alumno no pueden divergir. Sin
// 'server-only' a propósito: un componente lo importa con `import type`, que se borra al compilar.
//
// ⚠️ LO QUE NO ESTÁ ACÁ NO VIAJA, Y ES A PROPÓSITO: ni emails ni teléfonos (del equipo ni de los
//    alumnos), ni la ruta de un adjunto en el bucket, ni el lead de nadie más que una clave opaca. La
//    comunidad la ven los alumnos entre sí: lo único que se muestra de una persona es su nombre, su
//    foto, su nivel, su bio y los links que ella eligió publicar.

import type { OrdenFeed, PermisoCategoria, Red, TokenTexto } from './comunidad-reglas';
import type { AccesoEvento, LugarTipo, Recurrencia } from './comunidad-eventos';
import type { TipoNotificacion } from './comunidad-notificaciones';

/** Una persona, como se dibuja en una tarjeta, un comentario o el ranking. */
export type MiembroVista = {
  /** `u:<id>` (equipo) o `l:<id>` (alumno). Opaca: no es un email. */
  clave: string;
  nombre: string;
  foto: string | null;
  /** 1-9. El equipo también tiene nivel (recibe likes), aunque no figure en el ranking. */
  nivel: number;
  equipo: boolean;
};

export type CategoriaVista = { id: number; nombre: string; permiso: PermisoCategoria; ordenDefault: OrdenFeed };

/** Un adjunto. `url` es una firma de vida corta (o `null` si no se pudo firmar: se dice, no se rompe). */
export type AdjuntoVista = { nombre: string; mime: string; bytes: number; imagen: boolean; url: string | null };

export type EncuestaVista = {
  opciones: Array<{ id: string; texto: string; votos: number; pct: number }>;
  total: number;
  miVoto: string | null;
};

export type VideoVista = { proveedor: 'youtube' | 'vimeo' | 'loom'; embed: string; url: string };

/** Una tarjeta del feed. */
export type PostVista = {
  id: number;
  autor: MiembroVista;
  categoriaId: number | null;
  titulo: string;
  extracto: string;
  creado: string;
  editado: boolean;
  fijado: boolean;
  likes: number;
  meGusta: boolean;
  comentarios: number;
  video: VideoVista | null;
  adjunto: AdjuntoVista | null;
  encuesta: EncuestaVista | null;
  puedoEditar: boolean;
  puedoBorrar: boolean;
  puedoLikear: boolean;
  /** Los comentarios están cerrados (moderación): nadie comenta hasta que el equipo los abra. */
  cerrado: boolean;
};

export type ComentarioVista = {
  id: number;
  /** `null` = primer nivel. */
  padreId: number | null;
  autor: MiembroVista;
  cuerpo: TokenTexto[];
  /** El texto tal cual, para editarlo. */
  texto: string;
  creado: string;
  editado: boolean;
  likes: number;
  meGusta: boolean;
  puedoEditar: boolean;
  puedoBorrar: boolean;
  puedoLikear: boolean;
  /** Sólo en los de primer nivel: sus respuestas (dos niveles, como Skool). */
  respuestas: ComentarioVista[];
};

/** El post abierto: el cuerpo entero (ya partido en texto, links y menciones) y sus comentarios. */
export type PostDetalle = PostVista & {
  cuerpo: TokenTexto[];
  /** El texto tal cual y a quién nombra, para editarlo. */
  texto: string;
  menciones: Array<{ clave: string; nombre: string }>;
  hilo: ComentarioVista[];
  /** ¿Quien mira sigue este post? (la campana del post: avisa de los comentarios nuevos). */
  sigo: boolean;
};

export type FeedVista = { fijados: PostVista[]; posts: PostVista[]; hayMas: boolean; pagina: number };

/** Quien mira, con sus puntos. */
export type YoVista = MiembroVista & { puntos: number; puntosParaSubir: number | null; nombreNivel: string };

export type FilaRanking = { puesto: number; miembro: MiembroVista; puntos: number };

/** Lo que va arriba y al costado del feed (lo que se sabe sin abrir nada). */
export type ComunidadVista = {
  productoId: number;
  nombre: string;
  descripcion: string;
  categorias: CategoriaVista[];
  yo: YoVista;
  conteos: { miembros: number; enLinea: number; equipo: number } | null;
  nombresNivel: string[];
  /** El ranking de 30 días de la columna lateral (los 5 primeros). `null` = no se pudo leer. */
  top30: FilaRanking[] | null;
  puedoConfigurar: boolean;
  puedoFijar: boolean;
  /** Nivel mínimo para postear (1 = todos). */
  nivelParaPostear: number;
  /** ¿Quien mira puede publicar? (el equipo siempre; el alumno, si llega al nivel). */
  puedoPublicar: boolean;
  /** Moderar: sacar a un alumno, cerrar los comentarios de un post (el equipo). */
  puedoModerar: boolean;
  /** Editar el About (el equipo). */
  puedoEditarAbout: boolean;
  /** Crear, editar y borrar eventos (el equipo). */
  puedoGestionarEventos: boolean;
};

export type RankingVista = {
  /** `null` si quien mira es del equipo: el equipo no está en el ranking. */
  yo: YoVista | null;
  niveles: Array<{ nivel: number; nombre: string; pct: number; cantidad: number; abre: string[] }>;
  semana: FilaRanking[];
  mes: FilaRanking[];
  total: FilaRanking[];
  actualizado: string;
};

export type MiembroDirectorio = MiembroVista & {
  bio: string;
  enLinea: boolean;
  ultimaActividad: string | null;
  desde: string | null;
};

export type FiltroMiembros = 'todos' | 'equipo' | 'en_linea';

export type MiembrosVista = {
  miembros: MiembroDirectorio[];
  conteos: { todos: number; equipo: number; enLinea: number };
};

export type PerfilVista = MiembroDirectorio & {
  links: Partial<Record<Red, string>>;
  ubicacion: string;
  puntos: number;
  nombreNivel: string;
  esYo: boolean;
  /** ¿Quien mira puede sacarlo de la comunidad? (el equipo, a un alumno). */
  puedoSacar: boolean;
};

// ── El calendario ─────────────────────────────────────────────────────────────────

/**
 * Un evento (o una serie), como lo ve quien mira.
 *
 * ⚠️ LO CERRADO NO VIAJA: a un alumno que no entra (nivel, módulo) le llegan el título, la hora y el
 *    motivo (`bloqueado`), y NO el lugar (el link de la llamada), ni la descripción, ni la regla de
 *    acceso. Esconderlo en la pantalla no alcanzaría: lo que llega al navegador ya se puede leer.
 */
export type EventoVista = {
  id: number;
  titulo: string;
  descripcion: string;
  zona: string;
  duracionMin: number;
  /** El primer inicio (de la serie, o del evento). */
  inicio: string;
  /** La fecha y la hora de pared del primer inicio, en SU zona (para editar). */
  local: { fecha: string; hora: string };
  recurrente: boolean;
  /** «Cada semana: lun, mié · 10 veces». `null` = no se repite. */
  textoRecurrencia: string | null;
  lugarTipo: LugarTipo;
  lugar: string;
  portada: string | null;
  /** El motivo de que esté cerrado para quien mira, o `null` si entra. */
  bloqueado: string | null;
  /** Una ocurrencia movida de una serie («editar este evento»): se edita sola, sin preguntar el alcance. */
  esReemplazo: boolean;
  puedoEditar: boolean;
  /** Sólo para quien edita (el equipo): la regla de acceso y la recurrencia tal cual. */
  acceso: AccesoEvento | null;
  recurrencia: Recurrencia | null;
};

/** Una ocurrencia en el calendario. `fecha` = la fecha LOCAL en la zona del evento (la que nombra a la ocurrencia). */
export type OcurrenciaVista = { eventoId: number; inicio: string; fin: string; fecha: string };

export type CalendarioVista = { eventos: EventoVista[]; ocurrencias: OcurrenciaVista[] };

/** Lo que necesita el editor de eventos (el equipo): los módulos del curso y la zona por defecto. */
export type OpcionesEvento = { modulos: Array<{ clave: string; nombre: string }>; zona: string };

// ── La campana ────────────────────────────────────────────────────────────────────

/** Un renglón de la campana (los likes sobre la misma cosa, agrupados). */
export type NotificacionVista = {
  ids: number[];
  tipo: TipoNotificacion;
  /** Quiénes (hasta 3) y cuántos en total. Un evento no tiene «quién». */
  quienes: MiembroVista[];
  total: number;
  postId: number | null;
  postTitulo: string | null;
  comentarioId: number | null;
  eventoId: number | null;
  eventoTitulo: string | null;
  ocurrencia: string | null;
  creado: string;
  leida: boolean;
};

export type CampanaVista = { items: NotificacionVista[]; sinLeer: number };

// ── About, búsqueda y moderación ──────────────────────────────────────────────────

export type AboutVista = {
  nombre: string;
  /** El nombre propio de la comunidad (`null` = el del producto, que va en `nombre`). */
  nombrePropio: string | null;
  descripcion: string;
  texto: string;
  reglas: string;
  conteos: { miembros: number; enLinea: number; equipo: number } | null;
  equipo: MiembroVista[];
  nivelParaPostear: number;
  /** La zona por defecto del calendario (`null` = la del negocio). */
  zona: string | null;
  puedoEditar: boolean;
  puedoConfigurar: boolean;
};

export type BusquedaVista = { posts: PostVista[]; miembros: MiembroDirectorio[] };

/** Un alumno fuera de la comunidad (lo ve el equipo, para volver a admitirlo). */
export type SacadoVista = { miembro: MiembroVista; desde: string; motivo: string; por: string | null };

/** Lo que vuelve de cada pedido: el dato, o el porqué en una frase. */
export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };
