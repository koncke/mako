// Aviso de licencia (Apache-2.0): lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo (6/11/2026): cómo cede cada pedazo de una fila de las tarjetas del Overview cuando no entra. La tarjeta tiene el alto
// fijo de Polar (`h-82` en WidgetContainer) y muestra un número fijo de filas (VISIBLE_ROWS): si una fila se parte en dos
// renglones, la quinta queda cortada a la mitad por el borde. Por eso cada fila va en UNA línea, como la de Polar, y lo que
// no entra se corta con «…» en este orden:
//   · lo de la derecha (el monto, cuándo, el motivo) no cede nunca y no se parte (`FIJO`);
//   · lo secundario (el plan, la fecha, cuántos pagos) cede primero y casi entero (`SECUNDARIO`: su `flex-shrink` es mil veces
//     el del nombre, y el reparto de lo que sobra es proporcional a eso);
//   · el nombre del negocio cede último (`PRINCIPAL`).
// Polar deja que los dos de la izquierda cedan por igual, y con nombres en español («Panadería La Espiga», «Sin entrar · hace
// 21 días») quedaban los dos en tres letras («Gi… E…»).

import type { CSSProperties } from 'react'

/** El nombre del negocio: cede último. */
export const PRINCIPAL: CSSProperties = { flex: '0 1 auto', minWidth: 0 }

/** Lo que acompaña al nombre (el plan, la fecha, cuántos pagos): cede primero. */
export const SECUNDARIO: CSSProperties = { flex: '0 1000 auto', minWidth: 0 }

/** Lo de la derecha (el monto, cuándo, el motivo): en una línea y sin ceder. */
export const FIJO: CSSProperties = { flexShrink: 0, whiteSpace: 'nowrap' }

/** Las filas que se ven en una tarjeta (Polar: `VISIBLE_ROWS = 5`); el resto, con «Ver todo». */
export const VISIBLE_ROWS = 5
