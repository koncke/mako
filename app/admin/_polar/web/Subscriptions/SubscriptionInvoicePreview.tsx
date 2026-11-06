'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Subscriptions/SubscriptionInvoicePreview.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «Next invoice» es el primer mes que falta completar de la historia mes a mes (`proximo`): si ya venció, «Lo que debe»;
// si no, «Próximo cobro», por lo que falta de ese mes. Una de la pasarela no tiene esto (la pasarela no le cuenta a MaKo cuánto
// va a cobrar): si su renovación falló, se dice con su motivo.

import { InvoicePreview } from '@/app/admin/_polar/web/Orders/InvoicePreview'
import { OrderSection } from '@/app/admin/_polar/web/Orders/OrderSection'
import type { SuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { fechaCorta } from './SubscriptionStatus'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const SubscriptionInvoicePreview = ({ subscription: s, hoy }: { subscription: SuscripcionVenta; hoy: string }) => {
  if (s.renovacionFallida) {
    return (
      <Box flexDirection="column" borderTopWidth={1} borderStyle="solid" borderColor="border-primary" paddingTop="4xl">
        <OrderSection title="Falló la renovación">
          <Text color="danger">{s.renovacionFallida}</Text>
        </OrderSection>
      </Box>
    )
  }
  const p = s.proximo
  if (!p || s.estado === 'canceled') {
    return null
  }
  const monto = p.faltaUsd ?? s.mensualidadUsd
  if (monto == null) {
    return null
  }
  const vencido = p.vencido || p.vence <= hoy
  const titulo = vencido ? 'Lo que debe' : 'Próximo cobro'
  const mes = `${MESES[Number(p.mes.slice(5, 7)) - 1] ?? p.mes} ${p.mes.slice(0, 4)}`
  const items = vencido && s.deudaUsd > monto
    ? [{ id: 'deuda', label: 'Los meses vencidos', description: `desde ${mes}`, amount: s.deudaUsd }]
    : [{ id: p.mes, label: `Mensualidad de ${mes}`, description: p.faltaUsd != null && s.mensualidadUsd != null && p.faltaUsd < s.mensualidadUsd ? 'Lo que falta de ese mes' : null, amount: monto }]
  const total = items.reduce((t, i) => t + i.amount, 0)
  return (
    <Box flexDirection="column" borderTopWidth={1} borderStyle="solid" borderColor="border-primary" paddingTop="4xl">
      <OrderSection
        title={titulo}
        description={
          <Box alignItems="center" columnGap="s">
            <Text color="muted">{vencido ? 'Venció' : 'Vence'}</Text>
            <Text color="muted">·</Text>
            <Text color="muted">{fechaCorta(p.vence, hoy)}</Text>
          </Box>
        }
      >
        <InvoicePreview currency="USD" items={items} subtotalAmount={total} totalAmount={total} />
        {s.fuente === 'manual' && <Text color="muted">Se cobra a mano: entra cuando se registra el pago en el CRM.</Text>}
      </OrderSection>
    </Box>
  )
}

export default SubscriptionInvoicePreview
