// =============================================================================
// tab-access — enforcement server-side de rol-de-workspace y CAPA, por página
// =============================================================================
// El filtrado del Sidebar es solo cosmético (esconde links). Para que alguien no
// entre a una tab tecleando la URL, cada page.tsx de negocio llama a
// requireRolWs(...) al inicio de su Server Component. Dos ejes independientes:
//
//   · ROL   — qué ve cada persona DENTRO del cliente (admin-cliente/closer/setter).
//   · CAPA  — qué compró el cliente (lib/capas.ts). Un cliente 'pm' no tiene Meta
//             ni CRM: esas tabs no le faltan, no las compró.
//
// El rol EFECTIVO se resuelve fresco desde la base en cada request, así una
// revocación aplica sin re-login.
//
// Regla del rol: admin-cliente (rol_ws='admin'), agencia y owner/dev devuelven
// 'admin' → pasan siempre. Solo closer/setter se filtran.
// Regla de la capa: aplica a TODOS, incluido el admin-cliente — es lo que compró,
// no un permiso. La agencia sin impersonar corre con la capa completa.

import 'server-only';
import { redirect } from 'next/navigation';
import { getCapaActual, getRolWsEfectivo } from './workspace';
import { onboardingPendiente } from './onboarding-state';
import { capaDef, tabEnCapa, type CapaId } from './capas';
import type { RolWorkspace } from './auth-session';

/**
 * Adónde mandar a alguien que pidió una tab que no le toca. Depende de la capa:
 * un cliente 'pm' no tiene /leads, así que su casa es el board.
 */
export function homeDeCapa(capa: CapaId): string {
  return capaDef(capa).navKeys?.includes('crm') === false ? '/plan' : '/leads';
}

/**
 * Onboarding bloqueante: un admin-cliente (o la agencia impersonando) con el
 * onboarding pendiente va al wizard antes que a cualquier tab. Aplica SOLO a
 * rol efectivo 'admin' (closer/setter nunca hacen onboarding) y nunca al dueño.
 * Llamarlo en las páginas del whitelist de closer/setter (que no pasan por
 * requireRolWs); las demás lo heredan de requireRolWs.
 */
export async function guardOnboarding(): Promise<void> {
  if (await onboardingPendiente()) redirect('/onboarding');
}

/**
 * Exige que la CAPA del cliente incluya esta tab. `nav` es la key de nav.ts
 * (ej. 'general', 'crm', 'closing'). Si no la compró → a su casa.
 * Se llama solo desde requireRolWs; exportada para las pocas páginas que no lo
 * usan (el whitelist de closer/setter).
 */
export async function requireCapa(nav: string): Promise<void> {
  const capa = await getCapaActual();
  if (!tabEnCapa(nav, capa)) redirect(homeDeCapa(capa));
}

/**
 * Exige que el rol-de-workspace efectivo esté en `permitidos` (el admin-cliente
 * y la agencia siempre pasan). Si no, redirige a la primera tab que el usuario
 * sí puede ver. Pasar `[]` = página solo para admin-cliente.
 *
 * `opts.nav`: key de nav.ts de esta página → además exige que la capa la incluya.
 * `opts.gateOnboarding: false`: lo usa /onboarding para no redirigirse a sí misma.
 *
 * OJO con `[]`: NO significa "solo la agencia" — el admin-cliente de CADA
 * workspace devuelve 'admin' y pasa. Para restringir a la agencia el guard es
 * getSesionAdmin() (ver /contexto, /admin, /metodo).
 */
export async function requireRolWs(
  permitidos: RolWorkspace[],
  opts?: { gateOnboarding?: boolean; nav?: string },
): Promise<void> {
  const rol = await getRolWsEfectivo();
  // Fail-closed: rol null = sin sesión resuelta. El proxy ya exige login, pero
  // valida el token con cripto sin tocar la base, así que un usuario suspendido
  // o borrado con la cookie todavía firmada llegaba hasta acá y la página
  // renderizaba. Una red que depende enteramente de otra red no es una red.
  if (rol == null) redirect('/login');
  if (rol !== 'admin' && !permitidos.includes(rol)) redirect(homeDeCapa(await getCapaActual()));
  if (opts?.nav) await requireCapa(opts.nav);
  if (opts?.gateOnboarding !== false) await guardOnboarding();
}
