// =============================================================================
// El índice de la búsqueda ⌘K de Admin (el OmniSearch de Polar): los negocios y sus personas, recortados a lo que se muestra
// =============================================================================
// Lo lee el layout de Admin (la búsqueda de la barra) y la portada (el botón de búsqueda de sus «quick actions», como en
// Polar). `cache` de React: el layout y la página corren en el mismo pedido, así que la base se lee UNA vez.
// ⚠️ CRUZA NEGOCIOS: sólo el super admin (lo pregunta quien llama: el layout y la página, con `exigirSuperAdmin()`).
// ⚠️ NO TIRA (punto 23 de docs/admin/revision-cerebro-6-11.md): si no se pudo leer, el índice viaja vacío y con su `error`, y
//    ⌘K dice «No pude leer los negocios». Antes, quien llamaba lo cambiaba por listas vacías y ⌘K decía «No hay resultados»:
//    parecía que el negocio no existía. Y cuál es la plataforma ya no se adivina con un `.catch(() => null)`: con esa lectura
//    caída la plataforma entraba como un cliente y llevaba a una ficha 404. La regla vive en `leerIndice` (busqueda-tipos.ts).

import 'server-only'
import { cache } from 'react'
import { listarWorkspaces, wsSuperAdmin } from '@/lib/workspace'
import { listarUsuarios } from '@/lib/usuarios'
import { nombreDePlan } from '@/lib/clientes-plataforma-reglas'
import { todasLasCarteras } from '@/lib/agencia'
import { esCarteraVigente } from '@/lib/agencia-cartera'
import { leerIndice, type IndiceBusqueda } from './busqueda-tipos'

export const indiceDeBusqueda = cache(
  (): Promise<IndiceBusqueda> =>
    leerIndice(
      {
        workspaces: listarWorkspaces,
        usuarios: listarUsuarios,
        plataforma: wsSuperAdmin,
        // Las carteras sólo agregan el «De <agencia>» de un cliente de agencia: si no se pueden leer, `todasLasCarteras` da `[]`
        // y el resultado sale sin ese detalle (no se esconde a nadie).
        deAgencia: async () => {
          const deAgencia = new Map<number, number>()
          for (const f of await todasLasCarteras()) if (esCarteraVigente(f)) deAgencia.set(Number(f.cliente_ws), Number(f.agencia_ws))
          return deAgencia
        },
      },
      nombreDePlan,
    ),
)
