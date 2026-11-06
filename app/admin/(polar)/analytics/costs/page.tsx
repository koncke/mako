// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/costs/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Analytics › Costs: el gasto de IA de MaKo de un mes (`?mes=YYYY-MM`, por default el mes en curso), comparado con
// el anterior. Lee lib/costos-ia.ts por `leerCostos`. Un `?mes=` que no es un mes se saca de la URL.
// ⚠️ SÓLO EL SUPER ADMIN, antes de leer nada (cruza todos los negocios).

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerCostos } from '@/app/admin/_polar/datos/costos-server'
import { esMes } from '@/app/admin/_polar/datos/costos'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { Alert } from '@/app/admin/_polar/orbit'
import { redirect, RedirectType } from 'next/navigation'
import CostsPage from './CostsPage'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Costs' }

export default async function Page(props: {
  searchParams: Promise<{ mes?: string | string[] }>
}) {
  await exigirSuperAdmin()
  const { mes } = await props.searchParams
  const pedido = Array.isArray(mes) ? mes[0] : mes
  if (pedido !== undefined && !esMes(pedido)) redirect('/admin/analytics/costs', RedirectType.replace)

  const hoy = new Date()
  const periodo = pedido ?? hoy.toISOString().slice(0, 7)
  try {
    const vista = await leerCostos(periodo, hoy)
    return <CostsPage vista={vista} />
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    return (
      <DashboardBody title="Costs">
        <Alert variant="danger" title="No pude leer el gasto de IA" description={mensaje} />
      </DashboardBody>
    )
  }
}
