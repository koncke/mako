// =============================================================================
// Admin mientras carga: la tarjeta de una página de Polar, vacía, con EL loader de las tabs encima (6/11/2026, punto 31)
// =============================================================================
// Cada página de Admin lee en el server los datos de todos los negocios, y sin este archivo el clic en la barra dejaba la
// pantalla anterior quieta hasta que el server terminaba: «se hace clic y no pasa nada» (punto 31 de
// docs/admin/revision-cerebro-6-11.md). Va junto con sacar el `prefetch={true}` de la barra (NavList.tsx): sin precarga y
// sin loader, la barra tampoco respondía.
//
// La forma es la de `DashboardBody` (web/Layout/DashboardLayout.tsx): la tarjeta redondeada con su título y sus bloques, para
// que nada salte al llegar. Encima, CargandoMako (la criatura y la barra que corre, AGENTS.md), con el fondo transparente:
// el esqueleto queda a la vista y la criatura aparece a los 150 ms.
//
// ⚠️ Un loading.tsx ES un Suspense: va en la lista blanca de tests/layout-sin-suspense.test.ts (Admin es privado entero) y
//    las páginas que redirigen lo hacen ANTES, en el layout (./layout-reglas.ts, tests/redirige-antes-del-loader.test.ts).
// ⚠️ SIN TEXTO a la vista y sin hooks: el lector de pantalla oye «Cargando Admin» (role="status" de CargandoMako).

import { CargandoMako } from '@/app/_ui/CargandoMako'

/** Un renglón gris del esqueleto. */
const Barra = ({ w, h = 12, className = '' }: { w: number | string; h?: number; className?: string }) => (
  <div className={`dark:bg-polar-800 rounded-md bg-gray-100 ${className}`} style={{ width: w, height: h }} />
)

export default function CargandoAdmin() {
  return (
    <div aria-busy="true" className="flex h-full w-full flex-row gap-x-2">
      <div className="dark:bg-polar-900 dark:border-polar-800 relative flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-hidden rounded-2xl border-gray-200 bg-white px-4 md:border md:px-8 md:shadow-xs">
        <div className="flex w-full max-w-(--breakpoint-xl) flex-col gap-8 pt-8">
          <Barra w={180} h={28} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="dark:border-polar-800 flex flex-col gap-3 rounded-2xl border border-gray-200 p-5">
                <Barra w="40%" />
                <Barra w="60%" h={24} />
                <Barra w="100%" h={80} />
              </div>
            ))}
          </div>
          <div className="dark:border-polar-800 flex flex-col gap-3 rounded-2xl border border-gray-200 p-5">
            {[72, 56, 64, 48, 60].map((w, i) => (
              <Barra key={i} w={`${w}%`} />
            ))}
          </div>
        </div>
        <CargandoMako cubre que="Admin" style={{ backgroundColor: 'transparent' }} />
      </div>
    </div>
  )
}
