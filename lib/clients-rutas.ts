// =============================================================================
// clients-rutas — las sub-tabs de Clients y sus rutas (puro: lo importan la cabecera, las páginas, el
// teléfono y los tests)
// =============================================================================
// Martín, 17/10/2026: «Quiero unificar completamente la tab de "Cursos" con "Comunidad" y con "Clientes" y
// que la tab en la sidebar se llame "Clients"… Como lo tiene Skool, con una tab más de "Classroom"». El
// diseño y el porqué de cada decisión, en docs/diseno-clients.md.
//
// UNA tab con las sub-tabs de un grupo de Skool, en su orden (sin Map), y adelante Clients: el kanban de
// la entrega, que es lo que el nombre de la tab promete (D1).
//
// ⚠️ EL CÓDIGO DE LAS PANTALLAS SIGUE EN app/customer-success/ (D2): la carpeta es interna, la URL es
//    /clients. Las rutas viejas REDIRIGEN acá (`rutaNuevaDeVieja`) con su query: hay mails, avisos y
//    links de la API ya mandados que las nombran.
//
// ⚠️ Los nombres de las tabs van SIEMPRE en inglés (regla de la casa).
// =============================================================================

export const RUTA_CLIENTS = '/clients';

/** Las sub-tabs, en el orden en que se dibujan. `id` es también el último tramo de la URL (salvo Clients). */
export const SECCIONES_CLIENTS = [
  { id: 'clients', label: 'Clients', href: RUTA_CLIENTS },
  { id: 'community', label: 'Community', href: `${RUTA_CLIENTS}/community` },
  { id: 'classroom', label: 'Classroom', href: `${RUTA_CLIENTS}/classroom` },
  { id: 'calendar', label: 'Calendar', href: `${RUTA_CLIENTS}/calendar` },
  { id: 'members', label: 'Members', href: `${RUTA_CLIENTS}/members` },
  { id: 'leaderboards', label: 'Leaderboards', href: `${RUTA_CLIENTS}/leaderboards` },
  { id: 'about', label: 'About', href: `${RUTA_CLIENTS}/about` },
] as const;

export type SeccionClients = (typeof SECCIONES_CLIENTS)[number]['id'];

/**
 * Las secciones que son de la COMUNIDAD: una sola página (`app/clients/[seccion]`) que ya tiene sus datos,
 * así que cambiar entre ellas no viaja al server (D5). Cada una es una pestaña de app/_comunidad/Comunidad.tsx.
 */
export const SECCIONES_COMUNIDAD = ['community', 'calendar', 'members', 'leaderboards', 'about'] as const;
export type SeccionComunidad = (typeof SECCIONES_COMUNIDAD)[number];

/** La pestaña de la comunidad (sus nombres internos, en castellano) de cada sección. */
export type PestanaComunidad = 'comunidad' | 'calendario' | 'miembros' | 'ranking' | 'about';
export const PESTANA_DE_SECCION: Readonly<Record<SeccionComunidad, PestanaComunidad>> = {
  community: 'comunidad',
  calendar: 'calendario',
  members: 'miembros',
  leaderboards: 'ranking',
  about: 'about',
};

export function esSeccionComunidad(s: unknown): s is SeccionComunidad {
  return typeof s === 'string' && (SECCIONES_COMUNIDAD as readonly string[]).includes(s);
}

/** La sección de la comunidad de una pestaña (la inversa de `PESTANA_DE_SECCION`). */
export function seccionDePestana(p: PestanaComunidad): SeccionComunidad {
  for (const s of SECCIONES_COMUNIDAD) if (PESTANA_DE_SECCION[s] === p) return s;
  return 'community';
}

/** La vista previa del alumno: cuelga de Classroom y se dibuja SIN la cabecera (tiene su propia barra). */
export const RUTA_VISTA_PREVIA = `${RUTA_CLIENTS}/classroom/preview`;

const sinBarra = (p: string) => (p.replace(/\/+$/, '') || '/');

/**
 * La sub-tab de una ruta, o `null` si no es de Clients. La vista previa cuenta como Classroom (es su hija),
 * pero quien dibuja la cabecera la saltea aparte (`esVistaPrevia`).
 */
export function seccionDeRuta(pathname: string | null | undefined): SeccionClients | null {
  const p = sinBarra((pathname ?? '').split(/[?#]/)[0]);
  if (p === RUTA_CLIENTS) return 'clients';
  if (!p.startsWith(`${RUTA_CLIENTS}/`)) return null;
  const tramo = p.slice(RUTA_CLIENTS.length + 1).split('/')[0];
  return SECCIONES_CLIENTS.some((s) => s.id === tramo) ? (tramo as SeccionClients) : null;
}

export function esVistaPrevia(pathname: string | null | undefined): boolean {
  const p = sinBarra((pathname ?? '').split(/[?#]/)[0]);
  return p === RUTA_VISTA_PREVIA;
}

/**
 * Lo que una sub-tab conserva de la URL al ir a OTRA: el programa (`producto`) y el workspace que se mira
 * (`ws`, el del super admin o la agencia: perderlo es terminar mirando otra cuenta). Nada más: `?cliente=`,
 * `?post=` o `?vista=` son de UNA pantalla, y llevarlos a otra abriría cosas que no pidió.
 */
const QUERY_QUE_VIAJA = ['producto', 'ws'] as const;

/** El href de una sub-tab, con lo que viaja de la query actual. */
export function hrefSeccion(id: SeccionClients, search: string | URLSearchParams | null | undefined): string {
  const base = SECCIONES_CLIENTS.find((s) => s.id === id)?.href ?? RUTA_CLIENTS;
  const q = typeof search === 'string' || search == null ? new URLSearchParams(search ?? '') : search;
  const sale = new URLSearchParams();
  for (const k of QUERY_QUE_VIAJA) {
    const v = q.get(k);
    if (v) sale.set(k, v);
  }
  const s = sale.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * La misma URL con OTRO programa: cambia `producto` y conserva el resto (el `ws` incluido). Lo usa el
 * desplegable del programa de la cabecera. `?cliente=` y `?post=` se van: son de un programa.
 */
export function hrefConPrograma(pathname: string, search: string | null | undefined, productoId: number): string {
  const q = new URLSearchParams(search ?? '');
  q.delete('cliente');
  q.delete('post');
  q.set('producto', String(productoId));
  return `${sinBarra(pathname)}?${q.toString()}`;
}

/**
 * La ruta NUEVA de una ruta vieja de Customer Success, con su query intacta (`?ws=` incluido), o `null` si
 * no es una de ellas. ⚠️ El ORDEN importa: lo más largo primero, como en `rutaMovil` (lib/movil-rutas.ts).
 *
 *   /customer-success                 → /clients
 *   /customer-success/curso           → /clients/classroom   (`?vista=avance` → /clients?vista=avance:
 *                                        el Avance se fue del Curso a Clientes el 07/10/2026)
 *   /customer-success/curso/vista     → /clients/classroom/preview
 *   /customer-success/comunidad       → /clients/community
 */
export function rutaNuevaDeVieja(pathname: string, search?: string | null): string | null {
  const p = sinBarra(pathname.split(/[?#]/)[0]);
  const q = (search ?? '').replace(/^\?/, '');
  const con = (destino: string, query = q) => (query ? `${destino}?${query}` : destino);
  if (p === '/customer-success/curso/vista') return con(RUTA_VISTA_PREVIA);
  if (p === '/customer-success/curso') {
    const sp = new URLSearchParams(q);
    return sp.get('vista') === 'avance' ? con(RUTA_CLIENTS) : con(`${RUTA_CLIENTS}/classroom`);
  }
  if (p === '/customer-success/comunidad') return con(`${RUTA_CLIENTS}/community`);
  if (p === '/customer-success') return con(RUTA_CLIENTS);
  return null;
}

/** Arma la query de un `searchParams` de Next (valores sueltos o listas) para `rutaNuevaDeVieja`. */
export function queryDeSearchParams(sp: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) for (const x of v) q.append(k, x);
    else if (typeof v === 'string') q.set(k, v);
  }
  return q.toString();
}
