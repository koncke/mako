// =============================================================================
// La ficha de un negocio mientras carga: su cabecera, su subnav y sus bloques, vacíos, con EL loader encima (punto 31)
// =============================================================================
// La ficha lee el negocio, sus pagos, sus suscripciones, sus conexiones y sus eventos (datos/cliente-server.ts). Sin este
// archivo, al tocar otro negocio en la lista la pantalla quedaba en el anterior y ni el resaltado cambiaba (punto 31 de
// docs/admin/revision-cerebro-6-11.md). Con él, el router cambia la URL en el acto: la lista resalta el negocio tocado y la
// derecha muestra esto hasta que llega la ficha. La lista de la izquierda (customers/layout.tsx) NO se vuelve a dibujar.
//
// La forma es la de CustomerPageShell (web/Customer/CustomerPage/CustomerPageShell.tsx) adentro de MasterDetailLayoutContent:
// el nombre, la línea de debajo, las pestañas y las tarjetas. Encima, CargandoMako con el fondo transparente.
// ⚠️ Un loading.tsx ES un Suspense: en la lista blanca de tests/layout-sin-suspense.test.ts. La página que redirige de esta
//    carpeta (events/) lo hace antes, en el layout de Admin (app/admin/(polar)/layout-reglas.ts).

import { CargandoMako } from '@/app/_ui/CargandoMako'

const Barra = ({ w, h = 12 }: { w: number | string; h?: number }) => (
  <div className="dark:bg-polar-800 rounded-md bg-gray-100" style={{ width: w, height: h }} />
)

export default function CargandoNegocio() {
  return (
    <div aria-busy="true" className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex w-full flex-col gap-2 py-8">
        <Barra w={220} h={22} />
        <Barra w={120} h={16} />
      </div>
      <div className="flex w-full flex-col gap-y-12 pb-8">
        <div className="flex flex-row gap-3">
          {[64, 48, 72, 56].map((w, i) => (
            <Barra key={i} w={w} h={28} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dark:border-polar-800 flex flex-col gap-3 rounded-2xl border border-gray-200 p-5">
              <Barra w="45%" />
              <Barra w="65%" h={24} />
            </div>
          ))}
        </div>
        <div className="dark:border-polar-800 flex flex-col gap-3 rounded-2xl border border-gray-200 p-5">
          {[70, 52, 64, 44].map((w, i) => (
            <Barra key={i} w={`${w}%`} />
          ))}
        </div>
      </div>
      <CargandoMako cubre que="el negocio" style={{ backgroundColor: 'transparent' }} />
    </div>
  )
}
