// Admin › Products › Templates (/admin/products/templates, 18/11/2026): las plantillas que los negocios compartieron con la
// comunidad, para moderarlas. La estructura es la del Catalogue (./../page.tsx, copiado de polarsource/polar, Apache-2.0; aviso:
// lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR): el server lee y la vista filtra en memoria. Lo puro y el porqué, en
// app/admin/_polar/datos/plantillas.ts. ⚠️ SÓLO EL SUPER ADMIN, en la primera línea y antes de leer (cruza negocios).

import type { Metadata } from 'next'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerPlantillasParaModerar } from '@/app/admin/_polar/datos/plantillas-server'
import PlantillasPage from './PlantillasPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Templates',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const datos = await leerPlantillasParaModerar()
  return <PlantillasPage datos={datos} />
}
