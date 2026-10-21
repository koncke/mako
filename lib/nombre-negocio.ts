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
