'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Orders/OrderSecondaryDetails.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «Billing Details» son los datos del RECIBO (a nombre de quién, cuándo se emitió y por quién) y, en vez de «Metadata» y
// «Custom Fields» (MaKo no los tiene), a dónde salió: el correo y el grupo de WhatsApp de la cuenta, con su estado y su error.

import type { Pedido } from '@/app/admin/_polar/datos/ventas'
import { ROTULO_CORREO, ROTULO_ESTADO_RECIBO, ROTULO_WA } from '@/lib/recibos-reglas'
import { Grid, Text } from '@/app/admin/_polar/orbit'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import { DetailColumn, type DetailColumnRow } from './OrderSection'

type DetailRow = DetailColumnRow

const FALLA = new Set(['fallo', 'reboto', 'sin_destino'])

export const OrderSecondaryDetails = ({ order }: { order: Pedido }) => {
  const recibo = order.recibo
  if (!recibo) {
    return null
  }

  const billingItems: DetailRow[] = [
    { key: 'a_nombre', label: 'A nombre de', value: recibo.aNombre },
    { key: 'estado', label: 'Estado', value: ROTULO_ESTADO_RECIBO[recibo.estado] ?? recibo.estado },
    {
      key: 'emitido',
      label: 'Emitido',
      value: (
        <Text as="span" align="right" wrap="nowrap">
          <FormattedDateTime locale="es-AR" dateStyle="medium" resolution="time" datetime={recibo.emitidoAt} />
        </Text>
      ),
    },
    { key: 'origen', label: 'Origen', value: recibo.origen === 'manual' ? 'Cargado a mano' : 'La pasarela' },
  ]

  const envioItems: DetailRow[] = [
    {
      key: 'correo',
      label: 'Correo',
      value: (
        <Text as="span" color={FALLA.has(recibo.correoEstado) ? 'danger' : 'default'}>
          {ROTULO_CORREO[recibo.correoEstado] ?? recibo.correoEstado}
        </Text>
      ),
    },
    ...(recibo.correoA.length ? [{ key: 'correo_a', label: 'A', value: recibo.correoA.join(', ') }] : []),
    ...(recibo.correoError ? [{ key: 'correo_error', label: 'Por qué', value: recibo.correoError }] : []),
    {
      key: 'wa',
      label: 'WhatsApp',
      value: recibo.soloCorreo ? (
        'No va (sólo correo)'
      ) : (
        <Text as="span" color={FALLA.has(recibo.waEstado) ? 'danger' : 'default'}>
          {ROTULO_WA[recibo.waEstado] ?? recibo.waEstado}
        </Text>
      ),
    },
    ...(recibo.waError ? [{ key: 'wa_error', label: 'Por qué', value: recibo.waError }] : []),
  ]

  return (
    <Grid
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      paddingTop="4xl"
      /* MaKo: dos columnas (Recibo y Envío; Polar tiene tres con Metadata y Custom Fields, que MaKo no tiene): con la grilla
         de tres quedaban apretadas en dos tercios y «Emitido» se partía en dos renglones. */
      templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }}
      columnGap="2xl"
      rowGap="2xl"
    >
      <DetailColumn title="Recibo" items={billingItems} />

      <DetailColumn title="Envío" items={envioItems} />
    </Grid>
  )
}
