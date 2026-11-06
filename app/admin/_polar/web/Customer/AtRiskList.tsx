'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Customer/AtRiskList.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: lo que Polar junta en `useAtRisk` (las suscripciones atrasadas y las que se cancelan) lo junta el server
// (`clientesEnRiesgo`, app/admin/_polar/datos/clientes.ts): atrasados, cobros fallidos, pausados, los que dejaron de pagar
// y los que nadie usa.

import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  Toplist,
  ToplistItem,
  ToplistText,
  ToplistValue,
} from '@/app/admin/_polar/web/Customer/Toplist'
import { rutaDeNegocio, type ClienteEnRiesgo } from '@/app/admin/_polar/datos/clientes'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { useRouter } from '@/app/_ui/Link'
import { Alert, Avatar } from '@/app/admin/_polar/orbit'
import { ShieldCheck } from '@/app/admin/_polar/orbit/icons'
import { AvisosDeLectura } from './AvisosDeLectura'

interface AtRiskListProps {
  atRisk: ClienteEnRiesgo[] | null
  error?: string | null
  avisos?: string[]
}

export const AtRiskList = ({ atRisk, error, avisos }: AtRiskListProps) => {
  const router = useRouter()

  if (error || !atRisk) {
    return (
      <Alert
        variant="danger"
        title="No pude leer los negocios en riesgo"
        description={error ?? undefined}
        actions={[{ text: 'Reintentar', onClick: () => router.refresh() }]}
      />
    )
  }

  if (atRisk.length === 0) {
    return (
      <>
        <AvisosDeLectura avisos={avisos} />
        <EmptyState
          icon={<ShieldCheck />}
          title="Nada en riesgo"
          description="Ningún pago atrasado, cobro fallido ni negocio sin uso."
          fill
        />
      </>
    )
  }

  return (
    <>
      <AvisosDeLectura avisos={avisos} />
      <Toplist>
        {atRisk.map((item) => (
          <ToplistItem
            key={item.clave}
            href={item.ws != null ? rutaDeNegocio(item.ws) : undefined}
          >
            <Avatar
              className="h-8 w-8"
              avatar_url={null}
              name={item.nombre}
            />
            <ToplistText
              primary={item.nombre}
              secondary={item.plan ?? 'Sin cuenta en MaKo'}
            />
            <ToplistValue
              value={
                item.montoCentavos != null
                  ? formatCurrency('statistics')(item.montoCentavos, 'usd')
                  : '—'
              }
              caption={item.texto}
              captionColor={item.grave ? 'danger' : 'warning'}
            />
          </ToplistItem>
        ))}
      </Toplist>
    </>
  )
}
