// =============================================================================
// Qué encuentra el buscador de la barra («Ctrl K», 17/10/2026 noche) — la regla, sin React
// =============================================================================
// La usa app/_components/BuscadorNav.tsx y la fija tests/sidebar-nueva.test.ts. Busca entre lo que ESTA persona ve (la
// barra le pasa la lista ya filtrada por rol y capa) y entiende los nombres viejos: «General» o «home» llevan al
// Dashboard (Focus), «Customer Success» a Classroom (era Clients).

import type { NavItem } from '@/app/_components/nav';

/** Un lugar al que se puede ir: el ítem y, si es una pantalla de ADENTRO de una tab, el nombre de esa tab. */
export type Destino = { item: NavItem; donde: string | null };

/**
 * Los nombres viejos o en castellano que la gente va a escribir, y la key del ítem al que llevan. Con VARIAS keys, la
 * primera que la persona ve: «second brain» es el Ops Center del negocio (`mako`) y, para el super admin, el suyo.
 */
export const ALIAS: Readonly<Record<string, string | readonly string[]>> = {
  // El Second Brain de cada negocio se llama Ops Center desde el 18/10/2026 (nav.ts → MAKO_NAV).
  'second brain': ['mako', 'admin-operaciones'], cerebro: ['mako', 'admin-operaciones'], brain: ['mako', 'admin-operaciones'],
  home: 'graphics', general: 'graphics', inicio: 'graphics', focus: 'graphics', hoy: 'graphics',
  // «curso» y «comunidad» encuentran algo desde el 25/10/2026 (f31): hasta ahí la barra no le pasaba Classroom ni Community.
  'customer success': 'customer-success', clientes: 'customer-success', curso: 'cs-curso', clases: 'cs-curso', comunidad: 'cs-comunidad',
  calendario: 'calendario', whatsapp: 'bandeja', email: 'bandeja', mensajes: 'bandeja',
  'tu cuenta': 'perfil', perfil: 'perfil', configuracion: 'configuraciones', ajustes: 'configuraciones',
  // Lo que salió de la barra el 11/11/2026 sigue encontrando DÓNDE se hace (mirado en producción ese día: «lead magnet» y
  // «avatar» daban «Nothing found», y el 404 de las rutas viejas dice que el buscador «entiende también los nombres viejos»).
  // Lead Magnet se archivó (lib/lead-magnets/archivado.ts): el regalo se escribe en el Copywriter. AI Avatar salió de la
  // barra (nav.ts, `fueraDeLaBarra`): se abre desde Video, «Tu personaje con IA».
  'lead magnet': 'copywriter', leadmagnet: 'copywriter', regalo: 'copywriter',
  avatar: 'video-editor', 'ai avatar': 'video-editor', personaje: 'video-editor',
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

/** Lo que encuentra una búsqueda, en orden: primero lo que EMPIEZA con lo escrito, después los alias y lo que lo contiene. */
export function buscarDestinos(q: string, destinos: readonly Destino[], tope = 8): Destino[] {
  const t = norm(q);
  if (!t) return [];
  const porKey = new Map(destinos.map((d) => [d.item.key, d] as const));
  const primera = (k: string | readonly string[]) => (typeof k === 'string' ? [k] : k).map((x) => porKey.get(x)).find((d) => !!d);
  const alias = Object.entries(ALIAS).filter(([a]) => a.startsWith(t) || t.startsWith(a)).map(([, k]) => primera(k)).filter((d): d is Destino => !!d);
  const textoDe = (d: Destino) => norm(`${d.item.label} ${d.item.seccion ?? ''} ${d.item.bajada ?? ''} ${d.donde ?? ''}`);
  const empiezan = destinos.filter((d) => norm(d.item.label).startsWith(t) || norm(d.item.seccion ?? '').startsWith(t));
  const contienen = destinos.filter((d) => textoDe(d).includes(t));
  const out: Destino[] = [];
  for (const d of [...empiezan, ...alias, ...contienen]) if (!out.some((x) => x.item.href === d.item.href)) out.push(d);
  return out.slice(0, tope);
}
