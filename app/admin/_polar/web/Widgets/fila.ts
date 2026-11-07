// Aviso de licencia (Apache-2.0): lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo (6/11/2026): cómo cede cada pedazo de una fila de una TABLA de la ficha (Orders, Subscriptions) cuando no entra: el
// concepto y el medio en un renglón, lo secundario cede primero (`SECUNDARIO`: su `flex-shrink` es mil veces el del nombre) y
// lo principal último (`PRINCIPAL`).
// ⚠️ Las tarjetas del Overview YA NO usan esto (revisión del 6/11/2026): ahí el nombre y el dato no se cortan nunca y lo
//    secundario se esconde si no entra, con ./ListRow.tsx. Con estos `flex-shrink` el nombre igual quedaba en «Óptica…» y,
//    a 390 px, en nada, porque lo de la derecha no cedía y no tenía a dónde bajar.

import type { CSSProperties } from 'react'

/** El nombre del negocio: cede último. */
export const PRINCIPAL: CSSProperties = { flex: '0 1 auto', minWidth: 0 }

/** Lo que acompaña al nombre (el plan, la fecha, cuántos pagos): cede primero. */
export const SECUNDARIO: CSSProperties = { flex: '0 1000 auto', minWidth: 0 }

/** Lo de la derecha (el monto, cuándo, el motivo): en una línea y sin ceder. */
export const FIJO: CSSProperties = { flexShrink: 0, whiteSpace: 'nowrap' }

/** Las filas que se ven en una tarjeta del Overview (Polar: `VISIBLE_ROWS = 5`); el resto, con «Ver todo». */
export const VISIBLE_ROWS = 5
