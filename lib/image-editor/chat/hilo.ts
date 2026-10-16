// =============================================================================
// image-editor/chat/hilo — el hilo del chat «MaKo IA», guardado: el formato, el saneo y la unión
// =============================================================================
// Copia de lib/editor-video/chat-hilo.ts para el Image Editor (`image_editor_chats`, mig 0303): uno por persona y por
// diseño. Lo lee y lo escribe app/api/image-editor/chat/route.ts; lo sincroniza el store de
// app/image-editor/mako/chat/hilo.ts. Las mismas reglas:
//   · SE GUARDA LO QUE SE PUEDE VOLVER A USAR. Una propuesta pendiente guarda lo necesario para aceptarla después de
//     recargar (las refs de la vista con que se pidió, la página, el alcance y las operaciones, que se vuelven a
//     validar al leer); el documento de «antes» de una aplicada, no: el deshacer no sobrevive a la recarga.
//   · UN «APLICANDO» GUARDADO SE CORTÓ A LA MITAD: queda descartado con su aviso (aceptarlo otra vez aplicaría dos
//     veces lo que ya entró).
//   · DOS PESTAÑAS NO SE PISAN: compare-and-set; ante un 409 se une por id (gana el último cambio) y se vuelve a guardar.
//   · CON TOPES: los últimos `mensajes`, cada texto y cada lista recortados. Se cae lo más viejo, nunca lo último.
//
// Puro y sin `server-only`: lo leen la ruta, el store del navegador y los tests. No importa el motor (`_doory`).
// =============================================================================

import type { CambioImagen } from './aplicar';
import { validarOperaciones, type OperacionImagen } from './catalogo';

export type EstadoPropuesta = 'pendiente' | 'aplicando' | 'aplicada' | 'descartada' | 'restaurada';
export type AlcanceImagen = 'diseno' | 'seleccion';

/** Lo de una propuesta que sirve para aceptarla más tarde. */
export type PropuestaGuardada = {
  /** La página abierta al pedir (lo nuevo sin "pagina" va ahí). */
  paginaId: string | null;
  /** ref → id de la vista con que se pidió: elementos y páginas. */
  refs: Array<[string, string]>;
  paginas: Array<[string, string]>;
  /** Las refs elegidas, si el alcance fue lo elegido. */
  elegidos: string[];
  alcance: AlcanceImagen;
  operaciones: OperacionImagen[];
};

/** `c`: cuándo se creó (ordena el hilo); `t`: su último cambio (gana al unir dos copias). En ms. */
export type MensajeGuardado =
  | { id: string; c: number; t: number; de: 'yo'; texto: string; alcance: string | null }
  | {
      id: string; c: number; t: number; de: 'mako'; texto: string; error?: boolean;
      cambios?: CambioImagen[]; descartes?: string[]; estado?: EstadoPropuesta; aviso?: string; propuesta?: PropuestaGuardada;
      /** Llegó por la API de MaKo: se cierra en la base al resolverla. */
      propuestaApi?: { id: string; canal: string };
      /** Una burbuja de un pedido que no es del diseño abierto: sus links, de adentro de la app. */
      links?: Array<{ texto: string; href: string }>;
    };

export const TOPES_HILO = { mensajes: 80, texto: 4000, cambios: 40, descartes: 20, refs: 4000, total: 400_000 } as const;

/** El aviso de una propuesta que se estaba aplicando cuando se cortó la pestaña. */
export const AVISO_CORTADA = 'Se cortó mientras se aplicaba: mira el diseño antes de volver a pedirlo.';

const ESTADOS: readonly EstadoPropuesta[] = ['pendiente', 'aplicando', 'aplicada', 'descartada', 'restaurada'];
const TIPOS_CAMBIO: readonly CambioImagen['tipo'][] = ['agrega', 'cambia', 'quita'];

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const texto = (x: unknown, tope: number): string => (typeof x === 'string' ? x.slice(0, tope) : '');
const numero = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null);
const idValido = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cambios(x: unknown): CambioImagen[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const r = x.slice(0, TOPES_HILO.cambios).flatMap((c): CambioImagen[] =>
    esObjeto(c) && TIPOS_CAMBIO.includes(c.tipo as CambioImagen['tipo'])
      ? [{ tipo: c.tipo as CambioImagen['tipo'], titulo: texto(c.titulo, 300), antes: texto(c.antes, 600), despues: texto(c.despues, 600) }]
      : [],
  );
  return r.length ? r : undefined;
}

function descartes(x: unknown): string[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const r = x.filter((d): d is string => typeof d === 'string' && d.length > 0).slice(0, TOPES_HILO.descartes).map((d) => d.slice(0, 500));
  return r.length ? r : undefined;
}

const pares = (x: unknown): Array<[string, string]> =>
  (Array.isArray(x) ? x : [])
    .slice(0, TOPES_HILO.refs)
    .filter((p): p is [string, string] => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string' && p[0].length <= 20 && p[1].length <= 100);

function propuesta(x: unknown): PropuestaGuardada | undefined {
  if (!esObjeto(x)) return undefined;
  const { operaciones } = validarOperaciones(x.operaciones);
  if (!operaciones.length) return undefined;
  const elegidos = (Array.isArray(x.elegidos) ? x.elegidos : []).filter((r): r is string => typeof r === 'string' && r.length <= 20).slice(0, TOPES_HILO.refs);
  return {
    paginaId: typeof x.paginaId === 'string' && x.paginaId ? x.paginaId.slice(0, 100) : null,
    refs: pares(x.refs),
    paginas: pares(x.paginas),
    elegidos,
    alcance: x.alcance === 'seleccion' ? 'seleccion' : 'diseno',
    operaciones,
  };
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
  if (m.estado === 'pendiente' && !m.propuesta) m.estado = 'descartada';
  return m;
}

const enOrden = (a: MensajeGuardado, b: MensajeGuardado) => a.c - b.c || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Lo que se GUARDA: saneado, sin repetidos, en orden y dentro de los topes. La ruta no le cree al navegador. */
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

/** Lo que se MUESTRA al abrir: «aplicando» se cortó a la mitad y queda descartada con su aviso. */
export function hiloAlAbrir(raw: unknown): MensajeGuardado[] {
  return hiloParaGuardar(raw).map((m) => (m.de === 'mako' && m.estado === 'aplicando' ? { ...m, estado: 'descartada', aviso: AVISO_CORTADA } : m));
}

/** Dos copias del mismo hilo (la de la pestaña y la del server, ante un 409): la unión por id, gana el último cambio. */
export function unirHilos(a: readonly MensajeGuardado[], b: readonly MensajeGuardado[]): MensajeGuardado[] {
  return hiloParaGuardar([...a, ...b]);
}
