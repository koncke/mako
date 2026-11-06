'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/[id]/SalesPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el pedido llega armado por el server (sin `useOrder`, `usePayments`, `useRefunds`). Arriba, lo del recibo: «Bajar el
// recibo» (Polar: Download receipt) y, en el menú, «Reenviar», «Anular» (sólo los cargados a mano), «Darle el plan a su cuenta»
// (un cobro que «Ya tenía cuenta») y «Copiar el ID». Lo que Polar tiene y MaKo no llena se sacó: la factura (Download/Edit
// Invoice: MaKo emite recibos, no facturas), el aviso de cobro rechazado en reintento (dunning) y el de prevención de
// contracargos, los asientos (seats), los campos personalizados y la metadata.

import { useState } from 'react'
import { useRouter } from '@/app/_ui/Link'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { OrderCustomerContext } from '@/app/admin/_polar/web/Orders/OrderCustomerContext'
import { OrderSecondaryDetails } from '@/app/admin/_polar/web/Orders/OrderSecondaryDetails'
import { OrderDetails } from '@/app/admin/_polar/web/Orders/OrderDetails'
import { OrderDisputesTable } from '@/app/admin/_polar/web/Orders/OrderDisputesTable'
import { OrderPaymentsTable } from '@/app/admin/_polar/web/Orders/OrderPaymentsTable'
import { OrderRefundsSection } from '@/app/admin/_polar/web/Orders/OrderRefundsSection'
import { OrderSection } from '@/app/admin/_polar/web/Orders/OrderSection'
import { OrderStatus } from '@/app/admin/_polar/web/Orders/OrderStatus'
import { DownloadReceiptDashboard } from '@/app/admin/_polar/web/Orders/DownloadReceipt'
import { InvoicePreview } from '@/app/admin/_polar/web/Orders/InvoicePreview'
import { ResendReceiptModal } from '@/app/admin/_polar/web/Orders/ResendReceiptModal'
import { AvisosDeLectura } from '@/app/admin/_polar/web/Customer/AvisosDeLectura'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { ConfirmModal } from '@/app/admin/_polar/web/Modal/ConfirmModal'
import type { CobroVenta, Pedido } from '@/app/admin/_polar/datos/ventas'
import { anularReciboAction } from '@/app/admin/cobros/recibos-actions'
import { atarCobroMakoAction } from '@/app/admin/cobros/actions'
import { totalesEnTexto } from '@/lib/recibos-reglas'
import { MoreVertOutlined } from '@/app/admin/_polar/orbit/icons'
import { Alert, Button, Checkbox, InlineModal, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/admin/_polar/ui/dropdown-menu'
import React from 'react'

interface ClientPageProps {
  order: Pedido
  cobro: CobroVenta | null
  plataforma: number | null
  avisos: string[]
  /** La ruta de la suscripción del pedido (`suscripcionDelPedido`), o null: sin ella, «Suscripción» va sin enlace. */
  suscripcion?: string | null
  /** El resultado de una devolución recién hecha (`?hecho=`, OrderRefundsSection), o null. */
  hecho?: string | null
}

const ClientPage: React.FC<ClientPageProps> = ({ order, cobro, plataforma, avisos, suscripcion = null, hecho: hechoInicial = null }) => {
  const router = useRouter()
  const reenviar = useModal()
  const anular = useModal()
  const atar = useModal()
  const [avisar, setAvisar] = useState(order.recibo?.correoEstado === 'enviado')
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(hechoInicial)

  const recibo = order.recibo
  const puedeReenviar = recibo?.estado === 'emitido'
  const puedeAnular = recibo?.origen === 'manual' && recibo.estado !== 'anulado'
  const puedeAtar = cobro?.estado === 'pagado' && cobro.altaEstado === 'ya_tenia_cuenta'

  const copiarId = () => {
    navigator.clipboard
      .writeText(order.id)
      .then(() => setHecho('Copiaste el ID del pedido.'))
      .catch(() => setError('No pude copiar el ID del pedido.'))
  }

  const items = recibo
    ? recibo.lineas.map((l, i) => ({ id: String(i), label: l.concepto, description: l.mes, amount: l.monto }))
    : [{ id: order.id, label: order.concepto || 'Pago', description: null, amount: order.usd ?? 0 }]
  const moneda = recibo ? recibo.monedaDetalle : 'USD'
  const total = recibo ? recibo.totalDetalle : order.usd ?? 0
  const recibido = recibo && !(recibo.totales.length === 1 && recibo.totales[0].moneda === recibo.monedaDetalle && recibo.totales[0].monto === recibo.totalDetalle)
    ? totalesEnTexto(recibo.totales)
    : null

  return (
    <DashboardBody
      title={
        <Box alignItems="center" columnGap="l">
          <Text variant="heading-xs" as="h2">
            {recibo ? `Pedido · recibo N.º ${String(recibo.numero).padStart(4, '0')}` : 'Pedido'}
          </Text>
          <OrderStatus status={order.estado} />
        </Box>
      }
      header={
        <Box alignItems="center" columnGap="l">
          {recibo && <DownloadReceiptDashboard reciboId={recibo.id} className="w-auto" variant="secondary" />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="Más acciones">
                <MoreVertOutlined fontSize="small" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {puedeReenviar && <DropdownMenuItem onClick={reenviar.show}>Reenviar el recibo</DropdownMenuItem>}
              {puedeAtar && <DropdownMenuItem onClick={atar.show}>Darle el plan a su cuenta</DropdownMenuItem>}
              {puedeAnular && <DropdownMenuItem onClick={anular.show}>Anular el recibo</DropdownMenuItem>}
              <DropdownMenuItem onClick={copiarId}>Copiar el ID del pedido</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      }
      className="gap-y-16"
      contextViewTitle="Cliente"
      contextView={order.cliente ? <OrderCustomerContext customer={order.cliente} plataforma={plataforma} /> : undefined}
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:shadow-none"
    >
      <AvisosDeLectura avisos={avisos} />
      {error && <Alert variant="danger" title="No se pudo" description={error} />}
      {hecho && <Alert variant="success" title={hecho} />}

      <OrderDetails order={order} suscripcion={suscripcion} />

      <Box flexDirection="column" borderTopWidth={1} borderStyle="solid" borderColor="border-primary" paddingTop="4xl">
        <OrderSection title="Cobro">
          <InvoicePreview
            currency={moneda}
            items={items}
            subtotalAmount={total}
            taxAmount={recibo?.impuesto ?? null}
            totalAmount={total}
            refundedAmount={recibo?.devueltoMonto ?? null}
            received={recibido}
          />
          {!recibo && (
            <Text color="muted">Este pago no tiene recibo.</Text>
          )}
        </OrderSection>
      </Box>

      <OrderSecondaryDetails order={order} />

      <OrderPaymentsTable order={order} />

      <OrderRefundsSection order={order} cobro={cobro} />

      <OrderDisputesTable order={order} cobro={cobro} />

      {order.cliente && (
        <Box flexDirection="column" rowGap="l" display={{ base: 'flex', md: 'none' }}>
          <Text variant="heading-xs" as="h3">
            Cliente
          </Text>
          <OrderCustomerContext customer={order.cliente} plataforma={plataforma} />
        </Box>
      )}

      {recibo && (
        <InlineModal isShown={reenviar.isShown} hide={reenviar.hide} modalContent={<ResendReceiptModal recibo={recibo} hide={reenviar.hide} />} />
      )}
      {recibo && puedeAnular && (
        <ConfirmModal
          isShown={anular.isShown}
          hide={anular.hide}
          title={`¿Anular el recibo N.º ${String(recibo.numero).padStart(4, '0')}?`}
          description="El número queda gastado y sus pagos se liberan: se corrige cargando otro."
          body={recibo.correoEstado === 'enviado' ? <Checkbox checked={avisar} onCheckedChange={(v) => setAvisar(v === true)} label="Avisarle a quien lo recibió" /> : undefined}
          destructive
          destructiveText="Anular el recibo"
          onConfirm={async () => {
            setError(null)
            const r = await anularReciboAction(recibo.id, avisar).catch(() => ({ ok: false as const, error: 'No pude anular el recibo.' }))
            if (!r.ok) return setError(r.error)
            setHecho(`Recibo N.º ${String(r.numero).padStart(4, '0')} anulado.`)
            router.refresh()
          }}
        />
      )}
      {cobro && puedeAtar && (
        <ConfirmModal
          isShown={atar.isShown}
          hide={atar.hide}
          title="¿Darle el plan a su cuenta?"
          description={`La cuenta de MaKo de ${cobro.email ?? 'quien pagó'} pasa al plan ${cobro.plan ?? 'pagado'}, y este cobro queda atado a ella.`}
          destructive
          destructiveText="Darle el plan"
          onConfirm={async () => {
            setError(null)
            const r = await atarCobroMakoAction(cobro.id).catch(() => ({ ok: false, resumen: 'No pude atar el cobro a su cuenta.' }))
            if (!r.ok) return setError(r.resumen)
            setHecho(r.resumen || 'Plan asignado.')
            router.refresh()
          }}
        />
      )}
    </DashboardBody>
  )
}

export default ClientPage
