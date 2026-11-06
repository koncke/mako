'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Products/ProductPage/ProductBenefits.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Los «Benefits» de Polar = lo que incluye un plan de MaKo (`incluye`, lib/planes-mako.ts): un renglón por beneficio.
// ⚠️ LO QUE SE SACÓ: el link «View all» y el de cada beneficio (MaKo no tiene una página de beneficios), el tipo de cada
//    uno y el «Hidden from customers» (un renglón de un plan no tiene tipo ni visibilidad propia). La paginación de 5 queda.

import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { Pagination } from '@/app/admin/_polar/web/Products/Benefits/components/Pagination'
import { List, ListItem, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { Gift } from '@/app/admin/_polar/orbit/icons'
import { useMemo, useState } from 'react'
import type { ProductoMako } from '@/app/admin/_polar/datos/productos'

const PAGE_SIZE = 5

export interface ProductBenefitsProps {
  product: Pick<ProductoMako, 'nombre' | 'incluye'>
}

export const ProductBenefits = ({ product }: ProductBenefitsProps) => {
  const [page, setPage] = useState(1)
  const benefitCount = product.incluye.length
  const totalPages = Math.max(1, Math.ceil(benefitCount / PAGE_SIZE))

  const pageBenefits = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return product.incluye.slice(start, start + PAGE_SIZE)
  }, [page, product.incluye])

  return (
    <Box flexDirection="column" gap="xl" minWidth={0}>
      <Box flexDirection="column" gap="xs" minWidth={0}>
        <Text variant="heading-xxs" as="h2">
          Beneficios
        </Text>
        <Text color="muted">
          {benefitCount} {benefitCount === 1 ? 'beneficio' : 'beneficios'} de {product.nombre}
        </Text>
      </Box>

      {benefitCount === 0 ? (
        <EmptyState icon={<Gift />} title="Sin beneficios" description="Este plan no tiene escrito qué incluye." />
      ) : (
        <Box flexDirection="column" gap="l">
          <List size="small">
            {pageBenefits.map((benefit, i) => (
              <ListItem key={`${page}-${i}`} size="small">
                <Box minWidth={0} flexGrow={1} alignItems="center" columnGap="m">
                  <Box
                    width={32}
                    height={32}
                    flexShrink={0}
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="s"
                    backgroundColor="background-secondary"
                    color="text-secondary"
                  >
                    <Gift className="h-4 w-4" />
                  </Box>
                  <Box flexDirection="column" minWidth={0}>
                    <Text truncate>{benefit}</Text>
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
          {totalPages > 1 && (
            <Box justifyContent="end">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
