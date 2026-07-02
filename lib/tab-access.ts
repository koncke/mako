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
import type { RolWorkspace } from './auth-session';

/** CRM es la primera tab que ven todos los roles de cliente → destino de fallback. */
const FALLBACK = '/leads';

/**
 * Exige que el rol-de-workspace efectivo esté en `permitidos` (el admin-cliente
 * y la agencia siempre pasan). Si no, redirige a la primera tab que el usuario
 * sí puede ver. Pasar `[]` = página solo para admin-cliente.
 */
export async function requireRolWs(permitidos: RolWorkspace[]): Promise<void> {
  const rol = await getRolWsEfectivo();
  if (rol == null || rol === 'admin') return; // agencia / owner / admin-cliente ven todo
  if (!permitidos.includes(rol)) redirect(FALLBACK);
}
