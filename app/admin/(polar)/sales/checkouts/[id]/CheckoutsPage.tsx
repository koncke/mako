'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/checkouts/[id]/CheckoutsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: lo que se vende (el plan o el concepto, con su monto en la moneda del cobro) y «Payment Attempts» con lo que MaKo guarda
// del intento: si la pasarela lo rechazó, su motivo (es lo único guardado: no hay un renglón por intento). Lo que sí se hace acá,
// como en la pantalla de cobros de antes: copiar el link y anularlo (`anularCobroMakoAction`). Darle el plan a su cuenta es de un
// cobro PAGADO: está en su pedido.

import { useState } from 'react'
import { useRouter } from '@/app/_ui/Link'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import CheckoutStatus from '@/app/admin/_polar/web/Checkouts/CheckoutStatus'
import { OrderCustomerContext } from '@/app/admin/_polar/web/Orders/OrderCustomerContext'
import { AvisoDeError, AvisoHecho } from '@/app/admin/_polar/web/Orders/Aviso'
import { montoEnTexto } from '@/app/admin/_polar/web/Orders/montos'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { ConfirmModal } from '@/app/admin/_polar/web/Modal/ConfirmModal'
import { medioEnTexto, type CheckoutVenta } from '@/app/admin/_polar/datos/ventas'
import { anularCobroMakoAction } from '@/app/admin/cobros/actions'
import { Button, DataTable, List, ListItem, Text } from '@/app/admin/_polar/orbit'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import React from 'react'

const ClientPage: React.FC<{ checkout: CheckoutVenta }> = ({ checkout }) => {
  const router = useRouter()
  const anular = useModal()
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const puedeAnular = checkout.estado === 'open' || checkout.estado === 'failed'
  const intentos = checkout.estado === 'failed' ? [{ id: checkout.id, fecha: checkout.createdAt, medio: checkout.proveedor, motivo: checkout.motivo }] : []

  return (
    <DashboardBody
      title={
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-center gap-4">
            <h2 className="text-xl">Checkout</h2>
            <CheckoutStatus checkout={checkout} />
          </div>
          <span className="dark:text-polar-500 font-mono text-sm text-gray-500">{checkout.id}</span>
        </div>
      }
      header={
        <div className="flex flex-row items-center gap-3">
          {checkout.link && (
            <Button
              variant="secondary"
              onClick={() => {
                const url = new URL(checkout.link ?? '', window.location.origin).toString()
                navigator.clipboard.writeText(url).then(() => setHecho('Copiaste el link de pago.')).catch(() => setError('No pude copiar el link.'))
              }}
            >
              Copiar el link
            </Button>
          )}
          {puedeAnular && (
            <Button variant="secondary" onClick={anular.show}>
              Anular el link
            </Button>
          )}
        </div>
      }
      className="gap-y-8"
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none"
      contextViewTitle="Cliente"
      contextView={
        checkout.nombre || checkout.email ? (
          <OrderCustomerContext
            customer={{ clave: null, nombre: checkout.nombre ?? checkout.email ?? '—', ws: null, leadId: null, email: checkout.email }}
            plataforma={null}
          />
        ) : undefined
      }
    >
      <AvisoDeError texto={error} />
      <AvisoHecho texto={hecho} />
      <List size="small">
        <ListItem size="small" className="flex flex-row items-center justify-between gap-x-4">
          <div className="flex flex-col">
            <Text>{checkout.producto}</Text>
            <Text color="muted">{checkout.tipo === 'suscripcion' ? 'Suscripción mensual' : 'Pago único'}{checkout.modo === 'prueba' ? ' · de prueba' : ''}</Text>
          </div>
          <Text tabularNums>{montoEnTexto(checkout.monto, checkout.moneda, 'standard')}</Text>
        </ListItem>
      </List>

      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center justify-between gap-x-8">
          <div className="flex flex-row items-center justify-between gap-x-6">
            <h3 className="text-lg">Intentos de pago</h3>
          </div>
        </div>
        {intentos.length === 0 ? (
          <Text color="muted">{checkout.estado === 'open' ? 'Todavía nadie intentó pagarlo.' : 'Se anuló sin un intento rechazado.'}</Text>
        ) : (
          <DataTable
            isLoading={false}
            columns={[
              {
                accessorKey: 'fecha',
                header: 'Creado',
                cell: ({ row: { original } }) => <FormattedDateTime locale="es-AR" dateStyle="medium" resolution="time" datetime={original.fecha} />,
              },
              { accessorKey: 'medio', header: 'Medio', cell: ({ row: { original } }) => medioEnTexto(original.medio) },
              { accessorKey: 'motivo', header: 'Por qué no entró', cell: ({ row: { original } }) => <span className="whitespace-normal">{original.motivo ?? '—'}</span> },
            ]}
            data={intentos}
          />
        )}
      </div>

      {puedeAnular && (
        <ConfirmModal
          isShown={anular.isShown}
          hide={anular.hide}
          title="¿Anular el link de pago?"
          description="Nadie va a poder pagar este link."
          destructive
          destructiveText="Anular el link"
          onConfirm={async () => {
            setError(null)
            const r = await anularCobroMakoAction(checkout.id).catch(() => ({ ok: false, error: 'No pude anular el link.' }))
            if (!r.ok) return setError(r.error ?? 'No pude anular el link.')
            setHecho('Link anulado.')
            router.refresh()
          }}
        />
      )}
    </DashboardBody>
  )
}

export default ClientPage
