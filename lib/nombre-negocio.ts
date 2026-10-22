// =============================================================================
// El NOMBRE DEL NEGOCIO que escribe su admin en Configuración del negocio › Tu negocio (21/10/2026)
// =============================================================================
// Florencia (ws21) no podía cambiar el nombre de su negocio en ningún lado: el onboarding del 18/10 le guardó «mi marca
// personal: Florencia Ayelen Carballo» y sólo el super admin podía tocar workspaces.nombre. Lo guarda
// app/configuraciones/negocio-actions.ts; esto es la regla, pura, para poder probarla.
// =============================================================================

/** Lo más largo que se acepta: el nombre va en la tarjeta de /admin, en el funnel, en el PDF y en el grupo de WhatsApp. */
export const NOMBRE_NEGOCIO_MAX = 80;

/** El nombre limpio (espacios de más, sin saltos), o por qué no se acepta. */
export function limpiarNombreNegocio(crudo: unknown): { ok: true; nombre: string } | { ok: false; error: string } {
  const nombre = (typeof crudo === 'string' ? crudo : '').replace(/\s+/g, ' ').trim();
  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre de tu negocio.' };
  if (Array.from(nombre).length > NOMBRE_NEGOCIO_MAX) return { ok: false, error: `Hasta ${NOMBRE_NEGOCIO_MAX} caracteres.` };
  if (!/\p{L}/u.test(nombre)) return { ok: false, error: 'El nombre necesita al menos una letra.' };
  return { ok: true, nombre };
}

/** El nombre del NEGOCIO (workspaces.nombre), como lo lee «Tu negocio» (app/configuraciones/negocio-actions.ts) y el perfil (app/perfil/InformacionPersonal.tsx). */
export type NegocioDelPerfil = { nombre: string | null; puedeEditar: boolean };

/**
 * ¿La fila «Nombre del negocio» va en el perfil? (21/10/2026, Martín buscó el nombre de Florencia en su perfil y no
 * estaba: vivía sólo en Configuración › Tu negocio). Sólo para quien lo puede cambiar, el admin del negocio, o el super
 * admin mirando el cliente.
 * PENDIENTE (Cerebro, 22/10): «Empresa» (`perfil.empresa`, un dato personal) queda al lado y confunde; la propuesta del
 * chat Onboarding es que para quien ve esta fila no se ofrezca (docs/hallazgos-ajustes.md).
 */
export const muestraNegocio = (n: NegocioDelPerfil | null | undefined): n is NegocioDelPerfil => !!n?.puedeEditar;

