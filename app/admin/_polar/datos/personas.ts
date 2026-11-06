// =============================================================================
// Dónde vive cada persona en Admin: en la ficha de SU negocio o en Settings › Members (punto 25 de la revisión del 6/11/2026)
// =============================================================================
// Polar tiene dos listas de personas: los miembros de un Customer (su ficha) y los de la organización (Settings › Members). En
// MaKo son las personas de un negocio-cliente (`usuarios` con `rol = 'usuario'` y ese `workspace_id`: Customers › <negocio> ›
// Members) y las de la PLATAFORMA: los admins de MaKo (cruzan negocios), el equipo del workspace de la plataforma y las cuentas
// sin un negocio que exista. La pantalla vieja de Users las tenía a todas; la copia de Polar se había quedado sólo con las de
// los negocios, y las de MaKo no se veían en ningún lado (ni en ⌘K).
//
// ⚠️ UNA SOLA REGLA PARA LAS TRES PANTALLAS (la ficha, Settings › Members y ⌘K): con dos, una persona sale dos veces o en
//    ninguna. `tipoDePersona` es el complemento exacto de `miembrosDe` (./cliente.ts) sobre los negocios que existen.
// ⚠️ PURO y chico: lo importa el navegador (la búsqueda de la barra) sin traerse el resto de la ficha.
// =============================================================================

/** Settings › Members (la sección de Polar, segunda en Settings). */
export const RUTA_MIEMBROS_PLATAFORMA = '/admin/settings/members'

export type TipoPersonaPlataforma = 'admin' | 'equipo' | 'sin-negocio'

export const ROTULO_TIPO_PERSONA: Record<TipoPersonaPlataforma, string> = {
  admin: 'Admin de MaKo',
  equipo: 'Equipo de MaKo',
  'sin-negocio': 'Sin negocio',
}

/**
 * De qué lado está una persona. `null` = es de un negocio-cliente (vive en su ficha). Si no, de la plataforma: un admin de MaKo
 * (aunque tenga un negocio puesto, la ficha no lo lista), el equipo del workspace de la plataforma, o alguien cuyo negocio no
 * existe (o no tiene ninguno). `clientes` son los negocios que existen, sin la plataforma.
 */
export function tipoDePersona(
  u: { rol?: string | null; workspace_id: number | null },
  plataforma: number | null,
  clientes: ReadonlySet<number>,
): TipoPersonaPlataforma | null {
  if (u.rol === 'admin') return 'admin'
  if (u.workspace_id != null && u.workspace_id === plataforma) return 'equipo'
  if (u.workspace_id != null && clientes.has(u.workspace_id)) return null
  return 'sin-negocio'
}
