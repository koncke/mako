'use server';

// =============================================================================
// tz-workspace — la zona horaria del workspace para las cards de la ficha
// =============================================================================
// Las cards del lead pintan fechas y horas, y casi todas son componentes de
// CLIENTE: ahí no se puede llamar a tzActual(), que es `server-only`.
//
// Por qué una acción y no un prop: la ficha vive en DOS lugares (el modal
// app/crm/LeadSheet.tsx y la ruta app/crm/[id]/page.tsx). Un prop `tz` habría
// que enhebrarlo por los dos árboles y por LeadFullData, y el día que alguien
// monte una card en un tercer lugar se le olvida y vuelve a Tijuana en silencio.
// La acción hace que cada card se baste sola. useTzWorkspace memoiza el pedido,
// así que es UNA llamada por carga de página, no una por card.
//
// No expone nada sensible: devuelve la zona del workspace que la sesión del
// propio usuario resuelve (tzActual() → getWorkspaceActual()).

import { tzActual } from '@/lib/timezone';

/** Zona IANA del workspace actual (setting mako.timezone), con fallback al default. */
export async function tzWorkspaceAction(): Promise<string> {
  return tzActual();
}
