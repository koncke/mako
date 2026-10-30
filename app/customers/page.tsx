// =============================================================================
// /customers — Customers: los clientes de MaKo para el super admin (25/10/2026, rediseñada el 26/10/2026)
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md puntos 10 y 12): «Para SuperAdmin, creame una vista especial para ver a mis
// clientes... Donde pueda ver a los partners, a agency y al resto de clientes» y «Elimina la tab de /admin/cobros y
// /admin/agente, para eso ya vamos a tener la nueva vista». El 26/10: «quiero que mejores muchísimo el diseño de ese
// dahboard de super admin, investiga a fondo como lo tienen otras apps» (las referencias, en docs/customers/referencias).
//
// CUATRO PESTAÑAS (`?tab=`):
//   · Customers: lo que entra, «Para mirar», los grupos en chips, la lista y la ficha en un panel (CustomersApp.tsx);
//   · Accounts: la grilla de administración de siempre (AdminView: alta, plan, equipo, borrar). `?cuenta=<ws>` abre su
//     ficha: es a donde lleva «Administrar» desde la ficha de Customers;
//   · Billing: lo que era /admin/cobros (app/admin/cobros/Contenido.tsx);
//   · Agents: lo que era /admin/agente (app/admin/agente/Contenido.tsx).
//
// ⚠️ SÓLO EL SUPER ADMIN (`getSesionAdmin`, no `rol_ws`: ése vale 'admin' para el dueño de cada negocio). Todo lo de
//    adentro cruza negocios. Cada action de Billing y de Accounts vuelve a preguntar. ⚠️ `?cuenta=` y no `?ws=`: `?ws=`
//    es el parámetro que hace mirar a un cliente.

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
import { AdminView } from '@/app/admin/AdminView';
import { ErrorState, Pagina, PageHeader } from '@/app/_ui';
import '@/app/integraciones/tus-cuentas-ia.css';
import { CustomersApp } from './CustomersApp';
import { PestanasCustomers, type PestanaCustomers } from './Pestanas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Customers' };

const PESTANAS: readonly PestanaCustomers[] = ['customers', 'accounts', 'billing', 'agents'];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ tab?: string; cuenta?: string; cliente?: string }> }) {
  await requireSesion();
  const sesionAdmin = await getSesionAdmin();
  if (!sesionAdmin) redirect('/inicio');
  const sp = await searchParams;
  const tab: PestanaCustomers = (PESTANAS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as PestanaCustomers) : 'customers';
  const cuenta = /^[1-9]\d{0,11}$/.test(sp.cuenta ?? '') ? Number(sp.cuenta) : null;
  // `?cliente=<ws>`: la ficha de Customers abierta (un link a un cliente).
  const cliente = /^[1-9]\d{0,11}$/.test(sp.cliente ?? '') ? Number(sp.cliente) : null;

  return (
    <Pagina ancho="completo">
      <PageHeader titulo="Customers" />
      <PestanasCustomers activa={tab} />
      {tab === 'billing' ? <ContenidoCobros />
        : tab === 'agents' ? <ContenidoAgentes />
        : tab === 'accounts' ? await PestanaCuentas(sesionAdmin, cuenta)
        : await PestanaClientes(cliente)}
    </Pagina>
  );
}

/** La pestaña Customers: la vista de la plataforma, entera del server (la ficha es un panel sin estado de carga). */
async function PestanaClientes(cliente: number | null) {
  const vista = await vistaDeClientes().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if ('error' in vista) return <ErrorState titulo="No pude leer tus clientes" detalle={vista.error} accion={{ label: 'Volver a cargar', href: '/customers' }} />;
  return <CustomersApp vista={vista} abiertoInicial={cliente} />;
}

/** La pestaña Accounts: la grilla de administración, con lo que la ficha de cada cliente necesita (como /clients antes). */
async function PestanaCuentas(sesionAdmin: NonNullable<Awaited<ReturnType<typeof getSesionAdmin>>>, cuenta: number | null) {
  const [trabajo, clientes, perfil, plataforma] = await Promise.all([
    filasDeTodos().catch(() => null),
    clientesGanados().catch(() => []),
    getPerfil().catch(() => ({ nombre: '', avatarUrl: '' })),
    wsSuperAdmin(),
  ]);
  return (
    <AdminView incrustado trabajo={trabajo} clientes={clientes} user={{ nombre: perfil.nombre, avatarUrl: perfil.avatarUrl }}
      // Las computadoras de un cliente, en su ficha: sólo para quien pasa la guarda del Centro (la de sus acciones).
      verComputadoras={puedeOperar(sesionAdmin, plataforma)} abrirInicial={cuenta} />
  );
}
