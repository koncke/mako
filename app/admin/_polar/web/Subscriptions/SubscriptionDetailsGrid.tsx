'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Subscriptions/SubscriptionDetailsGrid.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «Billing schedule» es mensual (MaKo cobra por mes), con el día de cobro y, si tiene, su plazo fijo; «Amount» es la
// mensualidad de HOY (con los cambios guardados, mig 0401), marcada si es una estimación (sale de lo pagado el último mes). Sin
// «Discount», «Trial», pausa ni los motivos de la cancelación: MaKo no los guarda. Lo que MaKo suma: quién cobra (a mano o la
// pasarela) y lo que debe, cuando debe.

import type { SuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import { DetailCell, DetailGrid } from '@/app/admin/_polar/web/Orders/OrderSection'
import { usdEnTexto } from '@/app/admin/_polar/web/Orders/montos'
import { Text } from '@/app/admin/_polar/orbit'
import { SubscriptionStatus, fechaCorta } from './SubscriptionStatus'

const cobra = (s: SuscripcionVenta): string => {
  const dia = s.diaDeCobro != null ? `, el día ${s.diaDeCobro}` : ''
  const plazo = s.meses ? ` · ${s.meses} meses` : ''
  return `Mensual${dia}${plazo}`
}

export const SubscriptionDetailsGrid = ({ subscription: s, hoy }: { subscription: SuscripcionVenta; hoy: string }) => {
  const fecha = (iso: string | null) => (iso ? <Text variant="body" as="span">{fechaCorta(iso, hoy)}</Text> : undefined)
  return (
    <DetailGrid>
      <DetailCell label="Producto" value={s.producto ?? undefined} />
      <DetailCell label="Estado" value={<SubscriptionStatus subscription={s} />} />
      <DetailCell label="Cobro" value={cobra(s)} />
      <DetailCell label="Desde" value={fecha(s.empezo)} />
      {s.renovacion && <DetailCell label="Próxima" value={fecha(s.renovacion)} />}
      {s.terminaEl && <DetailCell label="Termina" value={fecha(s.terminaEl)} />}
      {s.termino && <DetailCell label="Terminó" value={fecha(s.termino)} />}
      <DetailCell
        label="Mensualidad"
        value={
          s.mensualidadUsd != null
            ? s.mensualidadEstimada
              ? `${usdEnTexto(s.mensualidadUsd, 'compact')} (estimada: no está cargada)`
              : usdEnTexto(s.mensualidadUsd, 'compact')
            : undefined
        }
      />
      <DetailCell label="La cobra" value={s.fuente === 'manual' ? 'A mano (se registra cada pago)' : 'La pasarela'} />
      <DetailCell label="Pagó en total" value={usdEnTexto(s.pagadoUsd, 'compact')} />
      {s.deudaUsd > 0 && (
        <DetailCell
          label="Debe"
          value={<Text as="span" color="danger">{usdEnTexto(s.deudaUsd, 'compact')}</Text>}
        />
      )}
    </DetailGrid>
  )
}
