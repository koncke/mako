// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/metrics/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Analytics › Metrics: MRR, ingresos y suscripciones mes a mes, de lib/admin-ingresos.ts (`vistaDeIngresos`).
// Como en Polar, la página valida el rango de la URL y, si arranca antes del primer dato, redirige con el rango corregido.
// Sin `interval` (MaKo mide por mes) ni `product_id` (no reparte por producto): se sacan de la URL al redirigir.
// ⚠️ SÓLO EL SUPER ADMIN, antes de leer nada (cruza todos los negocios).
// ⚠️ A LA VISTA VIAJAN MESES Y DÍAS COMO TEXTO (`vistaDeMetricas`), nunca un `Date`: este server corre en UTC y el navegador
//    en la hora de quien mira, y un mes armado acá se dibujaba corrido (punto 5 de la revisión del 6/11/2026). Las fechas las
//    arma MetricsPage.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { primerDiaLeido, vistaDeMetricas } from '@/app/admin/_polar/datos/metricas'
import { fromISODate, toISODate } from '@/app/admin/_polar/web/utils/metrics'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { Alert } from '@/app/admin/_polar/orbit'
import { vistaDeIngresos } from '@/lib/admin-ingresos'
import { redirect, RedirectType } from 'next/navigation'
import MetricsPage from './MetricsPage'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Metrics' }

export default async function Page(props: {
  searchParams: Promise<{
    start_date?: string | string[]
    end_date?: string | string[]
    interval?: string | string[]
    product_id?: string | string[]
  }>
}) {
  await exigirSuperAdmin()
  const searchParams = await props.searchParams

  let vista: Awaited<ReturnType<typeof vistaDeIngresos>>
  try {
    vista = await vistaDeIngresos()
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    return (
      <DashboardBody wide title="Metrics">
        <Alert variant="danger" title="No pude leer tus ingresos" description={mensaje} />
      </DashboardBody>
    )
  }

  const redirectPath = '/admin/analytics/metrics'
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const start = uno(searchParams.start_date)
  const end = uno(searchParams.end_date)
  const esFecha = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(fromISODate(v).getTime())

  // La URL de Polar trae `interval` y `product_id`; acá no deciden nada. Y un rango que arranca antes del primer mes leído
  // (o que no es una fecha) se corrige, como hace Polar con su `minDate`.
  const minDate = fromISODate(primerDiaLeido(vista))
  const sobra = searchParams.interval !== undefined || searchParams.product_id !== undefined
  const malInicio = start !== undefined && (!esFecha(start) || fromISODate(start) < minDate)
  const malFin = end !== undefined && !esFecha(end)
  if (sobra || malInicio || malFin) {
    const params = new URLSearchParams()
    if (start !== undefined) params.set('start_date', malInicio ? toISODate(minDate) : start)
    if (end !== undefined && !malFin) params.set('end_date', end)
    const q = params.toString()
    redirect(`${redirectPath}${q ? `?${q}` : ''}`, RedirectType.replace)
  }

  return <MetricsPage vista={vistaDeMetricas(vista)} />
}
