// =============================================================================
// «Configuración del negocio»: qué secciones ve quien mira (15/10/2026)
// =============================================================================
// La lista y el orden viven en lib/ajustes-secciones.ts (puro, lo comparte el celular). Acá se decide
// con la sesión, en el server, cuáles se ofrecen. Cada página igual se cuida sola con su guard: esto
// sólo arma el índice, y esconder una sección del índice no es protegerla.

import 'server-only';
import { getUsuarioActual } from './auth';
import { estaImpersonando, getCapaActual, getRolWsEfectivo, getWorkspaceActual, wsSuperAdmin } from './workspace';
import { tabEnCapa } from './capas';
import { gruposAjustes, seccionesCuenta, seccionesNegocio, type DisponiblesNegocio, type GrupoSecciones, type SeccionAjustes } from './ajustes-secciones';

export async function disponiblesNegocio(): Promise<DisponiblesNegocio> {
  const [sesion, capa, ws, plataforma] = await Promise.all([getUsuarioActual(), getCapaActual(), getWorkspaceActual(), wsSuperAdmin()]);
  const superAdmin = sesion?.rol === 'admin';
  return {
    integraciones: tabEnCapa('integraciones', capa),
    // (Lo de la plataforma —Método, después Prompts— salió del índice el 26/10/2026: no queda una sección sólo de la agencia.)
    // La plataforma no tiene un plan de MaKo: «Tu plan» es de cada negocio.
    plan: ws != null && ws !== plataforma,
  };
}

export async function seccionesNegocioActuales(): Promise<SeccionAjustes[]> {
  return seccionesNegocio(await disponiblesNegocio());
}

/**
 * EL ÍNDICE DE SETTINGS (24/10/2026, un solo lugar): «Tu cuenta» para todos, y «Tu negocio» sólo para quien lo administra (el
 * mismo corte que `requireRolWs([])` de sus páginas). `deOtro`: mirando a un cliente, de «Tu cuenta» sólo su perfil (ver
 * `seccionesCuenta`). Como antes, esconder una sección del índice no la protege: cada página se cuida con su guard.
 */
export async function gruposDeAjustes(deOtro: boolean | undefined, activa?: string): Promise<GrupoSecciones[]> {
  // Las páginas del negocio no leen el perfil: mirando a un cliente es lo mismo que «viendo a otro».
  const otro = deOtro ?? await estaImpersonando().catch(() => false);
  const rol = await getRolWsEfectivo().catch(() => null);
  const negocio = rol === 'admin' ? seccionesNegocio(await disponiblesNegocio()) : null;
  return gruposAjustes(seccionesCuenta(otro, activa, rol === 'admin'), negocio);
}
