// =============================================================================
// editor-video/chat-hilo — el hilo del chat «Editar con IA», guardado: el formato, el saneo y la unión
// =============================================================================
// Etapa 3 del diseño AI-native (docs/diseno-mako-ai-native.md, decisión 5): el hilo del chat del Video Editor vivía en
// la memoria de la pestaña y se perdía al recargar; ahora se guarda en la base (`video_editor_chats`, mig 0298), uno
// por persona y por proyecto (decisión 3: los chats nuevos son por persona). Lo lee y lo escribe
// app/api/video-editor/chat/route.ts; lo sincroniza el store de app/video-editor/_opencut/chat/hilo.ts.
//
// Lo que gobierna, y no se ve en las firmas:
//   · SE GUARDA LO QUE SE PUEDE VOLVER A USAR. Una propuesta pendiente guarda lo necesario para aceptarla después de
//     recargar (la escena, las refs, el alcance y las operaciones, que se vuelven a validar al leer); las pistas de
//     «antes» y «después» de una aplicada, no: el deshacer no sobrevive a la recarga, así que después de recargar no
//     hay «Restaurar» (la vuelta es la línea de tiempo misma).
//   · UN «APLICANDO» GUARDADO SE CORTÓ A LA MITAD. No vuelve a «pendiente»: aceptarlo de nuevo aplicaría dos veces lo
//     que ya entró. Queda descartado, con el aviso de mirar la línea de tiempo.
//   · DOS PESTAÑAS NO SE PISAN. El guardado es compare-and-set; ante un 409 la pestaña UNE su copia con la del server
//     (`unirHilos`: por id de mensaje, gana el último cambio) y vuelve a guardar.
//   · CON TOPES: los últimos MAX_MENSAJES, cada texto y cada lista recortados. Un hilo largo pierde lo más viejo,
//     nunca lo último.
//
// Puro y sin `server-only`: lo leen la ruta, el store del navegador y los tests. De _opencut sólo importa TIPOS.
// =============================================================================

import type { CambioChat } from '@/app/video-editor/_opencut/chat/linea';
import { validarOperaciones, type OperacionChat } from './chat-catalogo';

export type EstadoPropuesta = 'pendiente' | 'aplicando' | 'sin-version' | 'aplicada' | 'descartada' | 'restaurada';

/** Lo de una propuesta que sirve para aceptarla más tarde (aplicar.ts → `PropuestaChat`, sin las pistas). */
export type PropuestaGuardada = {
  escenaId: string;
  /** id → ref de la vista con que se pidió, de los elementos y de los medios. */
  refsPorId: Array<[string, string]>;
  elegidos: Array<{ trackId: string; elementId: string }>;
  alcance: 'video' | 'seleccion';
  operaciones: OperacionChat[];
};

/** `c`: cuándo se creó (ordena el hilo); `t`: su último cambio (gana al unir dos copias). En ms. */
export type MensajeGuardado =
  | { id: string; c: number; t: number; de: 'yo'; texto: string; alcance: string | null }
  | {
      id: string; c: number; t: number; de: 'mako'; texto: string; error?: boolean;
      cambios?: CambioChat[]; descartes?: string[]; estado?: EstadoPropuesta; aviso?: string; propuesta?: PropuestaGuardada;
      /** Llegó por la API de MaKo (video_editor_propuestas, mig 0302): se cierra en la base al resolverla. */
      propuestaApi?: { id: string; canal: string };
      /** Una burbuja de un pedido que no es del proyecto abierto (chat/pedidos.ts): sus links, de adentro de la app. */
      links?: Array<{ texto: string; href: string }>;
    };

export const TOPES_HILO = {
  mensajes: 80,
  texto: 4000,
  cambios: 40,
  descartes: 20,
  refs: 4000,
  elegidos: 500,
  /** El JSON entero, en caracteres: con más, se cae lo más viejo. */
  total: 400_000,
} as const;

/** El aviso de una propuesta que se estaba aplicando cuando se cortó la pestaña. */
export const AVISO_CORTADA = 'Se cortó mientras se aplicaba: mira la línea de tiempo antes de volver a pedirlo.';

const ESTADOS: readonly EstadoPropuesta[] = ['pendiente', 'aplicando', 'sin-version', 'aplicada', 'descartada', 'restaurada'];
const TIPOS_CAMBIO: readonly CambioChat['tipo'][] = ['agrega', 'cambia', 'quita'];

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const texto = (x: unknown, tope: number): string => (typeof x === 'string' ? x.slice(0, tope) : '');
const numero = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null);
const idValido = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cambios(x: unknown): CambioChat[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const r = x.slice(0, TOPES_HILO.cambios).flatMap((c): CambioChat[] =>
    esObjeto(c) && TIPOS_CAMBIO.includes(c.tipo as CambioChat['tipo'])
      ? [{ tipo: c.tipo as CambioChat['tipo'], titulo: texto(c.titulo, 300), antes: texto(c.antes, 600), despues: texto(c.despues, 600) }]
      : [],
  );
  return r.length ? r : undefined;
}

function descartes(x: unknown): string[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const r = x.filter((d): d is string => typeof d === 'string' && d.length > 0).slice(0, TOPES_HILO.descartes).map((d) => d.slice(0, 500));
  return r.length ? r : undefined;
}

function propuesta(x: unknown): PropuestaGuardada | undefined {
  if (!esObjeto(x) || typeof x.escenaId !== 'string' || !x.escenaId) return undefined;
  const { operaciones } = validarOperaciones(x.operaciones);
  if (!operaciones.length) return undefined;
  const refsPorId = (Array.isArray(x.refsPorId) ? x.refsPorId : [])
    .slice(0, TOPES_HILO.refs)
    .filter((p): p is [string, string] => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string');
  const elegidos = (Array.isArray(x.elegidos) ? x.elegidos : [])
    .slice(0, TOPES_HILO.elegidos)
    .flatMap((e) => (esObjeto(e) && typeof e.trackId === 'string' && typeof e.elementId === 'string' ? [{ trackId: e.trackId, elementId: e.elementId }] : []));
  return { escenaId: x.escenaId.slice(0, 64), refsPorId, elegidos, alcance: x.alcance === 'seleccion' ? 'seleccion' : 'video', operaciones };
}

/** Un mensaje como vino (del navegador o de la base), saneado. null = no es un mensaje. */
function mensaje(x: unknown): MensajeGuardado | null {
  if (!esObjeto(x) || !idValido(x.id)) return null;
  const c = numero(x.c);
  const t = numero(x.t) ?? c;
  if (c == null || t == null) return null;
  if (x.de === 'yo') {
    const tx = texto(x.texto, TOPES_HILO.texto);
    if (!tx) return null;
    return { id: x.id, c, t, de: 'yo', texto: tx, alcance: typeof x.alcance === 'string' ? x.alcance.slice(0, 80) : null };
  }
  if (x.de !== 'mako') return null;
  const m: Extract<MensajeGuardado, { de: 'mako' }> = { id: x.id, c, t, de: 'mako', texto: texto(x.texto, TOPES_HILO.texto) };
  if (x.error === true) m.error = true;
  const cs = cambios(x.cambios);
  if (cs) m.cambios = cs;
  const ds = descartes(x.descartes);
  if (ds) m.descartes = ds;
  const p = propuesta(x.propuesta);
  if (p) m.propuesta = p;
  if (ESTADOS.includes(x.estado as EstadoPropuesta)) m.estado = x.estado as EstadoPropuesta;
  if (typeof x.aviso === 'string' && x.aviso) m.aviso = x.aviso.slice(0, 500);
  const api = x.propuestaApi as { id?: unknown; canal?: unknown } | undefined;
  if (api && typeof api.id === 'string' && UUID.test(api.id) && typeof api.canal === 'string') m.propuestaApi = { id: api.id, canal: api.canal.slice(0, 20) };
  // Los links de una burbuja: sólo de ADENTRO de la app (`/algo`, nunca `//otro.com` ni `javascript:`), pocos y cortos.
  const links = (Array.isArray(x.links) ? x.links : []).slice(0, 4).flatMap((l) => {
    const o = l as { texto?: unknown; href?: unknown };
    return typeof o.texto === 'string' && o.texto && typeof o.href === 'string' && /^\/(?!\/)[^\s<>"]{0,300}$/.test(o.href)
      ? [{ texto: o.texto.slice(0, 80), href: o.href }]
      : [];
  });
  if (links.length) m.links = links;
  // Una propuesta sin lo que hace falta para aceptarla no puede quedar «pendiente».
  if ((m.estado === 'pendiente' || m.estado === 'sin-version') && !m.propuesta) m.estado = 'descartada';
  return m;
}

const enOrden = (a: MensajeGuardado, b: MensajeGuardado) => a.c - b.c || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Lo que se GUARDA: saneado, sin repetidos, en orden y dentro de los topes (lo más viejo se cae primero). Lo usan el
 * navegador antes de mandar y la ruta antes de escribir: la ruta no le cree al navegador.
 */
export function hiloParaGuardar(raw: unknown): MensajeGuardado[] {
  const porId = new Map<string, MensajeGuardado>();
  for (const x of Array.isArray(raw) ? raw : []) {
    const m = mensaje(x);
    if (!m) continue;
    const ya = porId.get(m.id);
    if (!ya || m.t >= ya.t) porId.set(m.id, m);
  }
  let lista = [...porId.values()].sort(enOrden).slice(-TOPES_HILO.mensajes);
  while (lista.length > 1 && JSON.stringify(lista).length > TOPES_HILO.total) lista = lista.slice(1);
  return lista;
}

/**
 * Lo que se MUESTRA al abrir: lo guardado, con lo que no sobrevive a una recarga resuelto. «Aplicando» se cortó a la
 * mitad (queda descartada con su aviso: aceptarla de nuevo aplicaría dos veces); «sin-versión» vuelve a pendiente
 * (no se aplicó nada: el guardado previo había fallado).
 */
export function hiloAlAbrir(raw: unknown): MensajeGuardado[] {
  return hiloParaGuardar(raw).map((m) => {
    if (m.de !== 'mako') return m;
    if (m.estado === 'aplicando') return { ...m, estado: 'descartada', aviso: AVISO_CORTADA };
    if (m.estado === 'sin-version') return { ...m, estado: 'pendiente', aviso: undefined };
    return m;
  });
}

/**
 * Dos copias del mismo hilo (la de esta pestaña y la del server, ante un 409): la unión por id, y de cada mensaje el
 * último cambio. Nada se pierde de ninguna de las dos.
 */
export function unirHilos(a: readonly MensajeGuardado[], b: readonly MensajeGuardado[]): MensajeGuardado[] {
  return hiloParaGuardar([...a, ...b]);
}
