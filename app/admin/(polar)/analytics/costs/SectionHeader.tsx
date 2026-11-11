// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/costs/CostsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El encabezado de cada sección de Costs (el título y su frase), que en Polar vive al final de CostsPage.tsx. Se sacó a su
// archivo el 10/11/2026 para que lo usen también las secciones de una suscripción (Suscripcion.tsx), sin copiarlo.

export function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-medium dark:text-white">{title}</h2>
      <p className="dark:text-polar-500 mt-0.5 text-sm text-gray-400">
        {description}
      </p>
    </div>
  )
}
