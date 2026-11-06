'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerEventsView.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: lo que pasó en el negocio (`eventosDelNegocio`: sus pagos, los cambios de lo que paga por mes, lo que hizo MaKo, sus
// errores y sus reportes) llega entero por props, y el filtro (los nombres elegidos y el rango de la ficha) y «Cargar más» van
// en memoria; Polar los pide paginados a /v1/events. El filtro de nombres queda en la URL (`eventName`), como en Polar. Se sacó
// el selector de medidores (MeterSelector): MaKo no tiene medidores.

import { filtrarEventos, nombresDeEventos, type EventoNegocio } from '@/app/admin/_polar/datos/cliente'
import { Button } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ShortTextOutlined } from '@/app/admin/_polar/orbit/icons'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { useRouter } from '@/app/_ui/Link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import EventSelect from './EventSelect'
import { Events } from './EventRow'
import { useCustomerMetricsParams } from './useCustomerMetricsParams'

/** Cuántos se muestran por vez (el `limit: 50` de Polar). */
export const PAGINA_EVENTOS = 50

export const CustomerEventsView = ({
  eventos,
  inicio,
}: {
  eventos: EventoNegocio[]
  inicio: string
}) => {
  const { desde, hasta } = useCustomerMetricsParams(inicio)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [visibles, setVisibles] = useState(PAGINA_EVENTOS)

  const eventNames = useMemo(() => searchParams.getAll('eventName'), [searchParams])
  const setEventNames = useCallback(
    (names: string[]) => {
      const p = new URLSearchParams(searchParams.toString())
      p.delete('eventName')
      for (const n of names) p.append('eventName', n)
      const q = p.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
      setVisibles(PAGINA_EVENTOS)
    },
    [pathname, router, searchParams],
  )

  const nombres = useMemo(() => nombresDeEventos(eventos), [eventos])
  const filtrados = useMemo(
    () => filtrarEventos(eventos, { nombres: eventNames, desde, hasta }),
    [eventos, eventNames, desde, hasta],
  )
  const hasNextPage = filtrados.length > visibles

  return (
    <Box flexDirection="column" rowGap="2xl">
      <Box
        flexDirection={{ base: 'column', md: 'row' }}
        rowGap="l"
        columnGap="xl"
      >
        <EventSelect
          className="w-auto min-w-64"
          eventNames={nombres}
          value={eventNames}
          onChange={setEventNames}
        />
      </Box>
      {filtrados.length === 0 ? (
        <EmptyState
          icon={<ShortTextOutlined fontSize="medium" />}
          title="No hay eventos"
          description="No pasó nada en este negocio con el filtro y el rango elegidos."
        />
      ) : (
        <Events events={filtrados.slice(0, visibles)} />
      )}
      {hasNextPage && (
        <Button
          className="self-start"
          variant="secondary"
          onClick={() => setVisibles((n) => n + PAGINA_EVENTOS)}
        >
          Cargar más
        </Button>
      )}
    </Box>
  )
}
