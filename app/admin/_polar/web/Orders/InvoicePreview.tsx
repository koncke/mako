'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Orders/InvoicePreview.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el monto va en la moneda del recibo (un pago en USDT o en pesos se dice en esa moneda: `montoEnTexto`), no en centavos.
// Sin «Discount», «Net», «Applied balance» ni «To be paid»: MaKo no guarda descuentos ni saldo a favor de un pago (se sacaron).

import { Grid, GridItem, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { Fragment, type ReactNode } from 'react'
import { montoEnTexto } from './montos'

export interface InvoiceLineItem {
  id: string
  label: string
  description?: string | null
  amount: number
}

export interface InvoicePreviewProps {
  currency: string
  items: InvoiceLineItem[]
  subtotalAmount: number
  taxAmount?: number | null
  totalAmount: number
  refundedAmount?: number | null
  /** Lo que entró, por moneda, si no es lo mismo que el total (un pago en otra moneda que la del detalle). */
  received?: ReactNode
}

const TotalRow = ({
  label,
  value,
  emphasis,
}: {
  label: ReactNode
  value: ReactNode
  emphasis?: boolean
}) => (
  <Box justifyContent="between" columnGap="xl">
    <Text variant="body" color={emphasis ? 'default' : 'muted'}>
      {label}
    </Text>
    <Text
      as="span"
      variant="body"
      color={emphasis ? 'default' : 'muted'}
      tabularNums
    >
      {value}
    </Text>
  </Box>
)

export const InvoicePreview = ({
  currency,
  items,
  subtotalAmount,
  taxAmount,
  totalAmount,
  refundedAmount,
  received,
}: InvoicePreviewProps) => {
  const format = (n: number) => montoEnTexto(n, currency)
  const showRefunded = refundedAmount != null && refundedAmount > 0

  return (
    <Grid templateColumns="repeat(3, minmax(0, 1fr))" columnGap="2xl">
      <GridItem
        colSpan={3}
        justifyContent="between"
        columnGap="l"
        paddingBottom="m"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Text color="muted" variant="body">
          Concepto
        </Text>
        <Text color="muted" variant="body" as="span">
          Monto
        </Text>
      </GridItem>

      {items.map((item, index) => (
        <Fragment key={item.id}>
          <GridItem
            colSpan={2}
            flexDirection="column"
            paddingTop={index === 0 ? 'l' : 'm'}
          >
            <Text variant="body">{item.label}</Text>
            {item.description && (
              <Text variant="caption" color="muted">
                {item.description}
              </Text>
            )}
          </GridItem>
          <GridItem justifyContent="end" paddingTop={index === 0 ? 'l' : 'm'}>
            <Text as="span" variant="body" tabularNums>
              {format(item.amount)}
            </Text>
          </GridItem>
        </Fragment>
      ))}

      <GridItem
        colStart={{ base: 1, sm: 3 }}
        colSpan={{ base: 3, sm: 1 }}
        flexDirection="column"
        rowGap="s"
        marginTop="l"
        paddingTop="l"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <TotalRow label="Subtotal" value={format(subtotalAmount)} />
        {taxAmount != null && taxAmount > 0 && (
          <TotalRow label="Impuesto" value={format(taxAmount)} />
        )}

        <Box
          flexDirection="column"
          rowGap="s"
          marginTop="xs"
          paddingTop="m"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <TotalRow label="Total" value={format(totalAmount)} emphasis />
          {received && <TotalRow label="Recibido" value={received} />}
          {showRefunded && (
            <TotalRow label="Devuelto" value={format(refundedAmount)} />
          )}
        </Box>
      </GridItem>
    </Grid>
  )
}
