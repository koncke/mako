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
//    /classroom. Las rutas viejas REDIRIGEN acá (`rutaNuevaDeVieja` y next.config.ts) con su query: hay
//    mails, avisos y links de la API ya mandados que las nombran.
//
// LA TAB SE LLAMA «CLASSROOM» DESDE EL 25/10/2026 (Martín: «La tab de "clients" pasa a llamarse "Classroom".
// También su ruta.»). Abre en el curso, que es lo que el nombre promete; el kanban de la entrega queda como
// sub-tab, «Clients» (/classroom/clients), hasta que la vista nueva de clientes del super admin lo tome. Lo
// viejo (/clients, /clients/classroom, /clients/community…) redirige en next.config.ts, con su query.
//
// ⚠️ Los nombres de las tabs van SIEMPRE en inglés (regla de la casa).
// =============================================================================

export const RUTA_CLASSROOM = '/classroom';
/** El kanban de la entrega: la sub-tab Clients. */
export const RUTA_CLIENTES = `${RUTA_CLASSROOM}/clients`;

/** Las sub-tabs, en el orden en que se dibujan. `id` es también el último tramo de la URL (salvo Classroom, la raíz). */
export const SECCIONES_CLIENTS = [
  { id: 'classroom', label: 'Classroom', href: RUTA_CLASSROOM },
  { id: 'community', label: 'Community', href: `${RUTA_CLASSROOM}/community` },
  { id: 'clients', label: 'Clients', href: RUTA_CLIENTES },
  { id: 'calendar', label: 'Calendar', href: `${RUTA_CLASSROOM}/calendar` },
  { id: 'members', label: 'Members', href: `${RUTA_CLASSROOM}/members` },
  { id: 'leaderboards', label: 'Leaderboards', href: `${RUTA_CLASSROOM}/leaderboards` },
  { id: 'about', label: 'About', href: `${RUTA_CLASSROOM}/about` },
] as const;

/** Lo que sabe MaKo para responder (era «Conocimiento» de MaKo Context, 25/10/2026): sólo la plataforma la ve. */
export const SECCION_METODOLOGIA = { id: 'methodology', label: 'Methodology', href: `${RUTA_CLASSROOM}/methodology` } as const;

export type SeccionClients = (typeof SECCIONES_CLIENTS)[number]['id'] | typeof SECCION_METODOLOGIA.id;

/** Todas, para leer una ruta o armar un link (quién ve cuál lo dice `seccionesDe`). */
const TODAS_LAS_SECCIONES: ReadonlyArray<{ id: SeccionClients; label: string; href: string }> = [...SECCIONES_CLIENTS, SECCION_METODOLOGIA];

/**
 * Las sub-tabs que ve quien mira. La plataforma (el super admin en su propio workspace) ve Methodology, y NO ve «Clients»:
 * sus clientes son NEGOCIOS y su grilla es Customers (/customers, con Billing y Agents; la fila de la barra va justo debajo
 * de Classroom). El kanban de leads ganados es de cada negocio. Una sola grilla de cada cosa y ningún link que salte de una
 * tab a otra (25/10/2026, el Cerebro al juntar Classroom con Customers): /classroom/clients le redirige a /customers sólo
 * por los links viejos (app/customer-success/pantalla.tsx).
 */
export function seccionesDe(plataforma: boolean): ReadonlyArray<{ id: SeccionClients; label: string; href: string }> {
  return plataforma ? [...SECCIONES_CLIENTS.filter((s) => s.id !== 'clients'), SECCION_METODOLOGIA] : SECCIONES_CLIENTS;
}

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
export const RUTA_VISTA_PREVIA = `${RUTA_CLASSROOM}/preview`;

const sinBarra = (p: string) => (p.replace(/\/+$/, '') || '/');

/**
 * La sub-tab de una ruta, o `null` si no es de Classroom. La vista previa cuenta como Classroom (es su hija),
 * pero quien dibuja la cabecera la saltea aparte (`esVistaPrevia`).
 */
export function seccionDeRuta(pathname: string | null | undefined): SeccionClients | null {
  const p = sinBarra((pathname ?? '').split(/[?#]/)[0]);
  if (p === RUTA_CLASSROOM || p === RUTA_VISTA_PREVIA) return 'classroom';
  if (!p.startsWith(`${RUTA_CLASSROOM}/`)) return null;
  const tramo = p.slice(RUTA_CLASSROOM.length + 1).split('/')[0];
  return tramo !== 'classroom' && TODAS_LAS_SECCIONES.some((s) => s.id === tramo) ? (tramo as SeccionClients) : null;
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
  const base = TODAS_LAS_SECCIONES.find((s) => s.id === id)?.href ?? RUTA_CLASSROOM;
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
 * La ruta NUEVA de una ruta vieja de Customer Success o de Clients, con su query intacta (`?ws=` incluido), o
 * `null` si no es una de ellas. ⚠️ El ORDEN importa: lo más largo primero, como en `rutaMovil` (lib/movil-rutas.ts).
 *
 *   /customer-success                 → /classroom/clients
 *   /customer-success/curso           → /classroom   (`?vista=avance` → /classroom/clients?vista=avance:
 *                                        el Avance se fue del Curso a Clientes el 07/10/2026)
 *   /customer-success/curso/vista     → /classroom/preview
 *   /customer-success/comunidad       → /classroom/community
 *   /clients (hasta el 25/10/2026)    → /classroom/clients · /clients/classroom → /classroom · /clients/<sección>
 *                                        → /classroom/<sección>. En el servidor lo hace next.config.ts, antes de
 *                                        dibujar nada; esto es lo mismo para quien arma un link (y su test).
 */
export function rutaNuevaDeVieja(pathname: string, search?: string | null): string | null {
  const p = sinBarra(pathname.split(/[?#]/)[0]);
  const q = (search ?? '').replace(/^\?/, '');
  const con = (destino: string, query = q) => (query ? `${destino}?${query}` : destino);
  if (p === '/customer-success/curso/vista' || p === '/clients/classroom/preview') return con(RUTA_VISTA_PREVIA);
  if (p === '/customer-success/curso') {
    const sp = new URLSearchParams(q);
    return sp.get('vista') === 'avance' ? con(RUTA_CLIENTES) : con(RUTA_CLASSROOM);
  }
  if (p === '/clients/classroom') return con(RUTA_CLASSROOM);
  if (p === '/customer-success/comunidad') return con(`${RUTA_CLASSROOM}/community`);
  if (p === '/customer-success' || p === '/clients') return con(RUTA_CLIENTES);
  if (p.startsWith('/clients/')) return con(`${RUTA_CLASSROOM}/${p.slice('/clients/'.length)}`);
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
