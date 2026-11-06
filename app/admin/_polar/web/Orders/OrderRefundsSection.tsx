'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Orders/OrderRefundsSection.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: lo devuelto sale del RECIBO (`devuelto_at`, `devuelto_monto`). «Refund order» es, según por dónde entró
// (`devolucionDelPedido`, app/admin/_polar/datos/ventas.ts):
//   · la pasarela, y SÓLO si el pedido es el pago que devuelve `reembolsarCobro` (el primero del cobro): `reembolsarCobroMakoAction`
//     devuelve el pago ENTERO por la pasarela, una sola vez (lo que gasta plata ajena no se reintenta), y si es una suscripción viva
//     ofrece cortarla en el mismo paso: devolver un pago de una suscripción NO la corta (app/admin/cobros/actions.ts). Una
//     RENOVACIÓN es otro pedido con el mismo cobro: ofrecerle el botón devolvía el primer mes (revisión del Cerebro del 6/11/2026,
//     punto 1), así que ahí no hay botón y se dice dónde se devuelve;
//   · a mano (un recibo de «Cargar pago»): `marcarDevueltoReciboAction` lo marca devuelto (la plata se devolvió por fuera).
// Al devolver por la pasarela, el pedido pasa a `c-<cobro>` (devuelto): se navega ahí con el resultado en la URL (punto 3), porque
// `router.refresh()` caía en un 404 que se llevaba el mensaje de una acción que mueve plata y no se reintenta.
// Sin monto parcial ni «Revoke Benefits»: MaKo devuelve el pago entero y no tiene beneficios que quitar.

import { useState } from 'react'
import { useRouter } from '@/app/_ui/Link'
import { devolucionDelPedido, type CobroVenta, type Pedido } from '@/app/admin/_polar/datos/ventas'
import { reembolsarCobroMakoAction } from '@/app/admin/cobros/actions'
import { marcarDevueltoReciboAction } from '@/app/admin/cobros/recibos-actions'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { ConfirmModal } from '@/app/admin/_polar/web/Modal/ConfirmModal'
import { Alert, Button, Checkbox, DataTable, Status, Text } from '@/app/admin/_polar/orbit'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import { montoEnTexto, usdEnTexto } from './montos'
import { OrderSection } from './OrderSection'

export const OrderRefundsSection = ({
  order,
  cobro,
}: {
  order: Pedido
  /** El cobro de la pasarela de este pedido, si salió por la pasarela. */
  cobro: CobroVenta | null
}) => {
  const router = useRouter()
  const modal = useModal()
  // La casilla ARRANCA marcada en una suscripción viva: devolver el pago de una suscripción NO la corta (AGENTS.md), y sin cortarla
  // la pasarela le sigue cobrando todos los meses. Quien la quiere seguir cobrando la destilda.
  const [cortar, setCortar] = useState(!!cobro?.suscripcionViva)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  const recibo = order.recibo
  const devuelto = order.estado === 'refunded' || order.estado === 'partially_refunded'
  const devolucion = devolucionDelPedido(order, cobro)
  const porLaPasarela = devolucion?.tipo === 'pasarela'
  const canRefund = porLaPasarela || devolucion?.tipo === 'a-mano'

  if (!devuelto && !devolucion && !hecho) {
    return null
  }

  const devolver = async () => {
    setError(null)
    if (porLaPasarela && cobro) {
      const r = await reembolsarCobroMakoAction(cobro.id, null, { cortarSuscripcion: cobro.suscripcionViva && cortar }).catch(() => ({ ok: false, resumen: 'No pude hacer el reembolso.' }))
      if (!r.ok) return setError(r.resumen)
      // El pedido devuelto es `c-<cobro>` (su pago ya no está en lo cobrado): se va ahí, y el resultado viaja en la URL.
      router.replace(`/admin/sales/c-${cobro.id}?hecho=${encodeURIComponent(r.resumen || 'Reembolso hecho.')}`)
      return
    }
    if (recibo) {
      const r = await marcarDevueltoReciboAction(recibo.id).catch(() => ({ ok: false as const, error: 'No pude marcarlo devuelto.' }))
      if (!r.ok) return setError(r.error)
      setHecho('Marcado devuelto.')
      router.refresh()
    }
  }

  const filas = devuelto && recibo
    ? [{ id: recibo.id, fecha: recibo.devueltoAt, monto: recibo.devueltoMonto, total: order.estado === 'refunded' }]
    : []

  return (
    <OrderSection
      title="Devoluciones"
      action={
        canRefund ? (
          <Button variant="secondary" onClick={modal.show}>
            {porLaPasarela ? 'Devolver el pago' : 'Marcar devuelto'}
          </Button>
        ) : undefined
      }
    >
      {error && <Alert variant="danger" title="No se devolvió" description={error} />}
      {hecho && <Alert variant="success" title={hecho} />}
      {devolucion?.tipo === 'en-la-pasarela' && <Text color="muted">{devolucion.texto}</Text>}
      {filas.length > 0 && (
        <DataTable
          isLoading={false}
          columns={[
            {
              accessorKey: 'fecha',
              header: 'Fecha',
              cell: ({ row }) =>
                row.original.fecha ? <FormattedDateTime locale="es-AR" dateStyle="long" datetime={row.original.fecha} /> : '—',
            },
            {
              accessorKey: 'monto',
              header: 'Monto',
              cell: ({ row }) =>
                row.original.monto != null && recibo
                  ? montoEnTexto(row.original.monto, recibo.monedaDetalle, 'standard')
                  : row.original.total
                    ? usdEnTexto(order.usd, 'standard')
                    : '—',
            },
            {
              accessorKey: 'total',
              header: 'Estado',
              cell: ({ row }) => <Status color="purple" status={row.original.total ? 'Devuelto' : 'Devolución parcial'} />,
            },
          ]}
          data={filas}
        />
      )}

      <ConfirmModal
        isShown={modal.isShown}
        hide={modal.hide}
        title={porLaPasarela ? '¿Devolver el pago entero?' : '¿Marcar devuelto?'}
        description={
          devolucion?.tipo === 'pasarela'
            // El monto del PEDIDO (`devolucionDelPedido`): el del cobro es la mensualidad, y el primer mes pudo tener otro monto.
            ? `La pasarela le devuelve ${usdEnTexto(devolucion.usd, 'standard')} a ${order.cliente?.nombre ?? 'quien pagó'}. Se pide una sola vez: si falla, se dice por qué y no se reintenta. La cuenta que se creó al pagar no se toca.`
            : 'El recibo queda marcado devuelto, con el mismo número. Si el correo ya le llegó, le avisamos una vez.'
        }
        body={
          porLaPasarela && cobro?.suscripcionViva ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cortar} onCheckedChange={(v) => setCortar(v === true)} />
              Cortar también la suscripción (si no, la pasarela le sigue cobrando todos los meses)
            </label>
          ) : undefined
        }
        destructive
        destructiveText={porLaPasarela ? 'Devolver el pago' : 'Marcar devuelto'}
        onConfirm={devolver}
      />
    </OrderSection>
  )
}
