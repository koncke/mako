// =============================================================================
// El índice de la búsqueda ⌘K de Admin (el OmniSearch de Polar): los negocios y sus personas, recortados a lo que se muestra
// =============================================================================
// Lo lee el layout de Admin (la búsqueda de la barra) y la portada (el botón de búsqueda de sus «quick actions», como en
// Polar). `cache` de React: el layout y la página corren en el mismo pedido, así que la base se lee UNA vez.
// ⚠️ CRUZA NEGOCIOS: sólo el super admin (lo pregunta quien llama: el layout y la página, con `exigirSuperAdmin()`).

import 'server-only'
import { cache } from 'react'
import { listarWorkspaces, wsSuperAdmin } from '@/lib/workspace'
import { listarUsuarios } from '@/lib/usuarios'
import { nombreDePlan } from '@/lib/clientes-plataforma-reglas'
import { todasLasCarteras } from '@/lib/agencia'
import { esCarteraVigente } from '@/lib/agencia-cartera'
import { armarIndice, type IndiceBusqueda } from './busqueda-tipos'

export const indiceDeBusqueda = cache(async (): Promise<IndiceBusqueda> => {
  // Las carteras sólo agregan el «De <agencia>» de un cliente de agencia: si no se pueden leer, `todasLasCarteras` da `[]` y
  // el resultado sale sin ese detalle (no se esconde a nadie).
  const [workspaces, usuarios, plataforma, carteras] = await Promise.all([
    listarWorkspaces(), listarUsuarios(), wsSuperAdmin().catch(() => null), todasLasCarteras(),
  ])
  const deAgencia = new Map<number, number>()
  for (const f of carteras) if (esCarteraVigente(f)) deAgencia.set(Number(f.cliente_ws), Number(f.agencia_ws))
  return armarIndice({ workspaces, usuarios, plataforma, plan: nombreDePlan, deAgencia })
})
