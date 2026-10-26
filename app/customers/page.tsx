// =============================================================================
// /customers — Customers: los clientes de MaKo para el super admin (25/10/2026)
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md puntos 10 y 12): «Para SuperAdmin, creame una vista especial para ver a mis
// clientes... Donde pueda ver a los partners, a agency y al resto de clientes... Siempre revisa como lo hacen otras apps,
// que se vea epico» y «Elimina la tab de /admin/cobros y /admin/agente, para eso ya vamos a tener la nueva vista».
//
// TRES PESTAÑAS (`?tab=`), como Stripe (Customers · Billing) y la herramienta de la plataforma que faltaba:
//   · Customers: los números de arriba (el MRR de los cobros reales, activos, nuevos, en riesgo), los segmentos en pills
//     (Partners, Agencies, Clientes, Clientes de agencias) y la grilla de siempre (AdminView: alta, plan, equipo, ficha,
//     entrar), en tabla y con su segmento y su MRR. Las referencias, en docs/hallazgos-agencias.md.
//   · Billing: lo que era /admin/cobros (app/admin/cobros/Contenido.tsx).
//   · Agents: lo que era /admin/agente (app/admin/agente/Contenido.tsx).
//
// ⚠️ SÓLO EL SUPER ADMIN (`getSesionAdmin`, no `rol_ws`: ése vale 'admin' para el dueño de cada negocio). Todo lo de
//    adentro cruza negocios. Cada action de Billing vuelve a preguntar.

import { redirect } from 'next/navigation';
import { requireSesion } from '@/lib/tab-access';
import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { getPerfil } from '@/lib/perfil';
import { vistaDeClientes } from '@/lib/clientes-plataforma';
import { clientesGanados, filasDeTodos } from '@/app/customer-success/trabajo';
import { ContenidoCobros } from '@/app/admin/cobros/Contenido';
import { ContenidoAgentes } from '@/app/admin/agente/Contenido';
import { ErrorState, Pagina, PageHeader } from '@/app/_ui';
import '@/app/integraciones/tus-cuentas-ia.css';
import { CustomersApp } from './CustomersApp';
import { PestanasCustomers, type PestanaCustomers } from './Pestanas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Customers' };

const PESTANAS: readonly PestanaCustomers[] = ['customers', 'billing', 'agents'];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSesion();
  const sesionAdmin = await getSesionAdmin();
  if (!sesionAdmin) redirect('/inicio');
  const sp = await searchParams;
  const tab: PestanaCustomers = (PESTANAS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as PestanaCustomers) : 'customers';

  return (
    <Pagina ancho="completo">
      <PageHeader titulo="Customers" />
      <PestanasCustomers activa={tab} />
      {tab === 'billing' ? <ContenidoCobros /> : tab === 'agents' ? <ContenidoAgentes /> : await PestanaClientes(sesionAdmin)}
    </Pagina>
  );
}

/** La pestaña Customers: la vista de la plataforma y lo que la ficha de cada cliente necesita (como /clients del super admin). */
async function PestanaClientes(sesionAdmin: NonNullable<Awaited<ReturnType<typeof getSesionAdmin>>>) {
  const [vista, trabajo, clientes, perfil, plataforma] = await Promise.all([
    vistaDeClientes().catch((e) => ({ error: e instanceof Error ? e.message : String(e) })),
    filasDeTodos().catch(() => null),
    clientesGanados().catch(() => []),
    getPerfil().catch(() => ({ nombre: '', avatarUrl: '' })),
    wsSuperAdmin(),
  ]);
  if ('error' in vista) return <ErrorState titulo="No pude leer tus clientes" detalle={vista.error} accion={{ label: 'Volver a cargar', href: '/customers' }} />;
  return (
    <CustomersApp vista={vista} trabajo={trabajo} clientes={clientes}
      user={{ nombre: perfil.nombre, avatarUrl: perfil.avatarUrl }}
      // Las computadoras de un cliente, en su ficha: sólo para quien pasa la guarda del Centro (la de sus acciones).
      verComputadoras={puedeOperar(sesionAdmin, plataforma)} />
  );
}
