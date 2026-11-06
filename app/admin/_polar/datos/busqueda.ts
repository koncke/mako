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
import { armarIndice, type IndiceBusqueda } from './busqueda-tipos'

export const indiceDeBusqueda = cache(async (): Promise<IndiceBusqueda> => {
  const [workspaces, usuarios, plataforma] = await Promise.all([listarWorkspaces(), listarUsuarios(), wsSuperAdmin().catch(() => null)])
  return armarIndice({ workspaces, usuarios, plataforma, plan: nombreDePlan })
})
