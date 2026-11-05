// Las pestañas de la tab Admin (5/11/2026). Sin `'use client'` ni `server-only`: las leen la página (server), las pestañas
// (navegador), la redirección de /customers y los tests. El orden es el de la barra: Revenue primero, porque es lo que Martín
// pide hoy (docs/relevo/admin-encargo.md). Los nombres, en inglés (las tabs de MaKo).

export const PESTANAS_ADMIN = ['revenue', 'billing', 'customers', 'accounts', 'users', 'errors', 'agents'] as const;
export type PestanaAdmin = (typeof PESTANAS_ADMIN)[number];

/**
 * Las que se ven en la barra: SEIS, el tope de la casa (app/_ui/Tabs.tsx). `accounts` no es una pestaña aparte: es la otra
 * VISTA de los negocios (la grilla de administración), con el selector de vista (AGENTS.md: «las vistas de una misma cosa
 * son UN selector»). Su `?tab=accounts` se queda: lo nombran los mails de «Quieren entrar» y el «Administrar» de la ficha.
 */
export const PESTANAS_BARRA = ['revenue', 'billing', 'customers', 'users', 'errors', 'agents'] as const satisfies readonly PestanaAdmin[];
export type PestanaBarra = (typeof PESTANAS_BARRA)[number];
/** La pestaña de la barra que se marca para un `?tab=`. */
export const pestanaDeBarra = (t: PestanaAdmin): PestanaBarra => (t === 'accounts' ? 'customers' : t);

export const ROTULO_PESTANA_ADMIN: Record<PestanaAdmin, string> = {
  revenue: 'Revenue',
  billing: 'Billing',
  customers: 'Customers',
  accounts: 'Accounts',
  users: 'Users',
  errors: 'Errors',
  agents: 'Agents',
};

export const esPestanaAdmin = (t: unknown): t is PestanaAdmin => typeof t === 'string' && (PESTANAS_ADMIN as readonly string[]).includes(t);

/** El link a una pestaña: Revenue es la que abre (`/admin` a secas). */
export const rutaPestanaAdmin = (t: PestanaAdmin): string => (t === 'revenue' ? '/admin' : `/admin?tab=${t}`);

/**
 * A dónde va un link viejo de /customers (los marcadores, los mails ya mandados, «Volver» del modo Dev): a la MISMA
 * pestaña de Admin, con su `?cuenta=` y su `?cliente=`. Sin `?tab=`, /customers abría la lista de los negocios: sigue
 * abriendo esa (Customers), no Revenue. Lo que no es un número se cae (es un id).
 */
export function destinoDeCustomers(sp: { tab?: string; cuenta?: string; cliente?: string }): string {
  const tab: PestanaAdmin = esPestanaAdmin(sp.tab) && sp.tab !== 'revenue' ? sp.tab : 'customers';
  const q = new URLSearchParams({ tab });
  for (const k of ['cuenta', 'cliente'] as const) {
    const v = sp[k];
    if (v && /^[1-9]\d{0,11}$/.test(v)) q.set(k, v);
  }
  return `/admin?${q.toString()}`;
}
