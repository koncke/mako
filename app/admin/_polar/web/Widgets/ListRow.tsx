// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/ListRow.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// La fila de Polar (un renglón con el filete de arriba, lo principal a la izquierda y el dato a la derecha, con su link), con la
// regla de MaKo para cuando no entra. Polar recibe los pedazos como `children`; acá cada uno por su nombre, porque cada uno cede
// distinto.
//
// MaKo (revisión del 6/11/2026): en las tarjetas del Overview, con nombres en español, la fila de Polar cortaba lo que no podía
// cortar («Mover un le…», «Pago de un…», «Óptica…», «Atrasado …» sin la fecha, y a 390 px una fila sin nombre). La regla:
//   · el NOMBRE (el negocio, o lo que pasó) y el DATO (el monto, el estado con su fecha, cuándo) se ven siempre enteros. Si no
//     entran juntos en un renglón, el dato baja al segundo, a la derecha (`flex-wrap`): nunca se corta. Y si el dato solo no
//     entra en la fila (a 190 px, «Sin entrar hace 19 días» y el monto), sus pedazos van uno debajo del otro, enteros;
//   · lo SECUNDARIO (el plan, cuántos pagos) cede primero: ocupa sólo lo que sobra en el renglón del nombre (su base es 0, así
//     que nunca empuja al dato abajo), se corta con «…» y, si le quedan menos de 4,5rem, se esconde entero (un `@container`
//     sobre su hueco): no deja «M…» ni le saca lugar al nombre;
//   · el DETALLE (el negocio de una actividad) es secundario pero no se esconde ni se corta: si no entra entero al lado del
//     nombre, baja al renglón de abajo.
// Medido en Chrome con estas mismas reglas a 190, 242, 310 y 400 px de tarjeta (6/11/2026): ningún nombre ni dato cortado; lo
// secundario entero, cortado con al menos 4,5rem o escondido.
// El nombre se corta sólo si solo, sin nada al lado, no entra en la fila entera. Por eso la tarjeta ya no tiene el alto fijo de
// Polar (WidgetContainer: `min-h-82`): una fila de dos renglones no deja la quinta cortada por el borde.

import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import Link from '@/app/_ui/Link'
import type { ReactNode } from 'react'

export interface ListRowProps {
  href?: string
  /** El negocio, o lo que pasó: entero. */
  nombre: ReactNode
  /** Lo que acompaña al nombre: cede primero y, si no entra, se esconde. */
  secundario?: ReactNode
  /** Lo que acompaña y no se esconde: si no entra al lado del nombre, baja al segundo renglón. */
  detalle?: ReactNode
  /** El dato clave, a la derecha: entero y en una línea. */
  dato: ReactNode
}

export const ListRow = ({ href, nombre, secundario, detalle, dato }: ListRowProps) => {
  const fila = (
    <Box
      flexWrap="wrap"
      alignItems="baseline"
      columnGap="m"
      paddingVertical="s"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <Text truncate style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }} data-fila="nombre">
        {nombre}
      </Text>
      {detalle != null && (
        <Text color="muted" truncate style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }} data-fila="detalle">
          {detalle}
        </Text>
      )}
      {secundario != null && (
        <div className="@container relative min-w-0 self-stretch" style={{ flex: '1 1 0%' }} data-fila="hueco">
          <div className="absolute inset-x-0 top-0 @max-[4.5rem]:hidden">
            <Text color="muted" truncate data-fila="secundario">
              {secundario}
            </Text>
          </div>
        </div>
      )}
      <Box
        flexWrap="wrap"
        justifyContent="end"
        alignItems="baseline"
        columnGap="m"
        marginLeft="auto"
        flexShrink={0}
        style={{ maxWidth: '100%', whiteSpace: 'nowrap' }}
        data-fila="dato"
      >
        {dato}
      </Box>
    </Box>
  )

  return href ? (
    <Link href={href} className="block hover:opacity-60">
      {fila}
    </Link>
  ) : (
    fila
  )
}
