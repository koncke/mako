// =============================================================================
// tab-access — enforcement server-side del rol-de-workspace por página
// =============================================================================
// El filtrado del Sidebar es solo cosmético (esconde links). Para que un
// closer/setter no acceda a una tab tecleando la URL, cada page.tsx de negocio
// que NO le corresponde llama a requireRolWs(...) al inicio de su Server
// Component. El rol EFECTIVO se resuelve fresco desde la base en cada request
// (getRolWsEfectivo), así una revocación aplica sin re-login.
//
// Regla: admin-cliente (rol_ws='admin'), agencia y owner/dev devuelven 'admin'
// → ven TODO (requireRolWs nunca los bloquea). Solo closer/setter se filtran.

import 'server-only';
import { redirect } from 'next/navigation';
import { getRolWsEfectivo } from './workspace';
import { onboardingPendiente } from './onboarding-state';
import type { RolWorkspace } from './auth-session';

/** CRM es la primera tab que ven todos los roles de cliente → destino de fallback. */
const FALLBACK = '/leads';

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
 * Exige que el rol-de-workspace efectivo esté en `permitidos` (el admin-cliente
 * y la agencia siempre pasan). Si no, redirige a la primera tab que el usuario
 * sí puede ver. Pasar `[]` = página solo para admin-cliente.
 * Además gatea el onboarding pendiente (salvo `gateOnboarding:false`, que usa
 * la propia página /onboarding para no redirigirse a sí misma).
 */
export async function requireRolWs(permitidos: RolWorkspace[], opts?: { gateOnboarding?: boolean }): Promise<void> {
  const rol = await getRolWsEfectivo();
  if (rol != null && rol !== 'admin' && !permitidos.includes(rol)) redirect(FALLBACK);
  if (opts?.gateOnboarding !== false) await guardOnboarding();
}
