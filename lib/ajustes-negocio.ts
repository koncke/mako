// =============================================================================
// «Configuración del negocio»: qué secciones ve quien mira (15/10/2026)
// =============================================================================
// La lista y el orden viven en lib/ajustes-secciones.ts (puro, lo comparte el celular). Acá se decide
// con la sesión, en el server, cuáles se ofrecen. Cada página igual se cuida sola con su guard: esto
// sólo arma el índice, y esconder una sección del índice no es protegerla.

import 'server-only';
import { getUsuarioActual } from './auth';
import { getCapaActual, getWorkspaceActual, wsSuperAdmin } from './workspace';
import { tabEnCapa } from './capas';
import { seccionesNegocio, type DisponiblesNegocio, type SeccionAjustes } from './ajustes-secciones';

export async function disponiblesNegocio(): Promise<DisponiblesNegocio> {
  const [sesion, capa, ws, plataforma] = await Promise.all([getUsuarioActual(), getCapaActual(), getWorkspaceActual(), wsSuperAdmin()]);
  const superAdmin = sesion?.rol === 'admin';
  return {
    // Horario y Criterio de reuniones: la pantalla de antes los mostraba sólo si `/api/auth/me` decía
    // `rol === 'admin'` (el de la plataforma), aunque sus acciones aceptan al admin del negocio. Se
    // conserva lo que se VE hasta que Martín decida (15/10/2026): mostrarlos a un cliente es un cambio.
    general: superAdmin,
    integraciones: tabEnCapa('integraciones', capa),
    // /metodo se cuida con `getSesionAdmin()`, que es esta misma pregunta.
    metodo: superAdmin,
    // La plataforma no tiene un plan de MaKo: «Tu plan» es de cada negocio.
    plan: ws != null && ws !== plataforma,
  };
}

export async function seccionesNegocioActuales(): Promise<SeccionAjustes[]> {
  return seccionesNegocio(await disponiblesNegocio());
}
