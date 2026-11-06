'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Orders/DownloadReceipt.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el PDF del recibo lo sirve /api/admin/recibos/<id>/pdf (sólo el super admin), así que no hay que esperar a que se genere
// (Polar lo genera en segundo plano y espera el evento): se abre en otra pestaña, como `openInNewTab` de Polar.

import { Button } from '@/app/admin/_polar/orbit'

const openInNewTab = (url: string) => {
  const newWindow = window.open(url, '_blank')
  if (!newWindow) {
    window.location.href = url
  }
}

export const DownloadReceiptDashboard = ({
  reciboId,
  className,
  variant = 'secondary',
}: {
  reciboId: number
  className?: string
  variant?: 'default' | 'secondary'
}) => (
  <Button className={className} variant={variant} onClick={() => openInNewTab(`/api/admin/recibos/${reciboId}/pdf`)}>
    Bajar el recibo
  </Button>
)
