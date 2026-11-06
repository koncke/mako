// =============================================================================
// Admin › dar de alta un negocio: UN formulario (el «Create Customer» de Polar, web/Customer/CreateCustomerModal.tsx)
// =============================================================================
// Martín (6/11/2026) rechazó versiones con lo mismo en varios lugares. Había dos altas: el «+» de la lista de Customers y el
// «Dar de alta» del aviso «Quieren entrar» de Overview (con el plan y lo que dejó escrito quien pidió entrar). Queda UNA, la
// de Customers; el aviso la abre con lo del pedido ya puesto (`inicialDeAlta`). Las dos mandan al alta de siempre
// (POST /api/admin/workspaces, action 'crear' → lib/alta-cliente.ts), con el cuerpo que arma `cuerpoDeAlta`.
//
// Puro (sin server-only): lo usan el formulario del navegador y tests/admin-polar-arreglos.test.ts. Los planes los arma el
// server (`opcionesDeAlta`, clientes-server.ts) desde lib/capas.ts, para no llevar el catálogo entero al navegador.
// =============================================================================

import { altaDelPedido } from '@/lib/pedidos-ingreso-reglas'

/** Un plan que se puede dar al dar de alta. */
export type PlanAlta = { id: string; nombre: string; descripcion: string; aviso: string | null }

/** Los planes que ofrece el formulario y el que viene elegido. */
export type OpcionesAlta = { planes: PlanAlta[]; planPorDefecto: string }

/** Lo que tiene el formulario. */
export type FormAlta = { nombre: string; email: string; adminNombre: string; plan: string }

/** Lo que precarga el aviso «Quieren entrar»: el pedido de la persona. */
export type PedidoParaAlta = { email: string; nombre: string | null }

/**
 * Lo que el formulario trae puesto. Sin pedido, vacío; con uno, el nombre (el de la persona, o lo de antes de la @) y su email,
 * con la regla de siempre (`altaDelPedido`). El plan es el por defecto si se ofrece, y si no el primero de la lista: un valor
 * que no está entre las opciones deja el desplegable sin nada elegido y manda un plan que nadie vio.
 */
export function inicialDeAlta(o: OpcionesAlta, pedido?: PedidoParaAlta | null): FormAlta {
  const plan = o.planes.some((p) => p.id === o.planPorDefecto) ? o.planPorDefecto : (o.planes[0]?.id ?? o.planPorDefecto)
  if (!pedido) return { nombre: '', email: '', adminNombre: '', plan }
  const a = altaDelPedido(pedido)
  return { nombre: a.nombre, email: a.adminEmail, adminNombre: a.adminNombre, plan }
}

/** El cuerpo del alta. Lo que se escribió, sin espacios de más; el nombre del admin sólo si se puso (el email lo normaliza el alta). */
export function cuerpoDeAlta(f: FormAlta): { action: 'crear'; nombre: string; capa: string; adminEmail: string; adminNombre?: string } {
  const adminNombre = f.adminNombre.replace(/\s+/g, ' ').trim()
  return {
    action: 'crear',
    nombre: f.nombre.replace(/\s+/g, ' ').trim(),
    capa: f.plan,
    adminEmail: f.email.trim(),
    ...(adminNombre ? { adminNombre } : {}),
  }
}
