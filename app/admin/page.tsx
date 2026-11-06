// =============================================================================
// /admin — la tab Admin del super admin (5/11/2026; era Customers, /customers)
// =============================================================================
// Martín, 5/11/2026: «rever completamente la tab que hoy en día se llama Customer dentro de Super Admin, que se llame Admin
// directamente... que lo copies completamente de otras aplicaciones... qué acciones hacen los usuarios dentro de MaKo, cuándo
// es que se conectan, qué no están utilizando... cuándo la app se crashea... suscripciones... cobros, gestión de usuarios,
// estado de alta». Y antes: «no se me refleja la cantidad de ingresos para suscripciones. ¿Cuánto es lo que me pagaron
// totalmente? ¿Cuánto me van pagando mes a mes?». El encargo, en docs/relevo/admin-encargo.md; qué se copia de dónde, en
// docs/investigacion-admin.md.
//
// EL DISEÑO Y LA FUNCIONALIDAD SON LOS DE STUDIO ADMIN (5/11/2026, arhamkhnz/next-shadcn-admin-dashboard, MIT). Martín rechazó
// la versión anterior («está horrible… copies tanto el diseño como la funcionalidad de alguna otra aplicación o repositorio
// de GitHub»): el shell (sidebar, cabecera, búsqueda ⌘K, modo) es el suyo (app/admin/_studio/shell) y cada sección es una
// pantalla suya, portada de a una (docs/investigacion-admin.md, docs/relevo/nube-admin-copia.md).
//
// LAS SECCIONES (`?tab=`, leída acá; son las seis del sidebar):
//   · revenue: dashboard/default de Studio (app/admin/ingresos/revenue.tsx) con lo que entra (lib/admin-ingresos.ts);
//   · users: dashboard/users de Studio (app/admin/usuarios/users.tsx) con las personas de todos los negocios;
//   · billing: dashboard/finance (Resumen, Cobros, Recibos) y su recibo dashboard/invoice (app/admin/cobros/billing.tsx);
//   · customers: dashboard/crm de Studio con los negocios, y su ficha (`?cliente=<ws>`) con dashboard/profile (app/admin/clientes);
//   · accounts: la grilla de administración (AdminView), la otra vista de Customers. `?cuenta=<ws>` abre su ficha;
//   · activity: la medición de la mig 0398 (app/admin/actividad) — por portar (dashboard/analytics). Al pie, Agents;
//   · errors: los errores agrupados (app/admin/errores) — por portar (dashboard/infrastructure);
//   · agents: abre Activity (su contenido vive al pie).
// Lo que espera a Martín (quién quiere entrar, qué pidieron las agencias) va en la tarjeta del pie del sidebar.
//
// ⚠️ LA RUTA. /admin redirigía a /customers desde el 25/10; desde hoy ES la tab, y sus subrutas (/admin/dev, /admin/ui,
//    /admin/docs, /admin/operaciones…) siguen igual: son otras tabs del super admin. /customers?tab=… redirige acá con su
//    query (app/customers/page.tsx), porque está en marcadores, en mails ya mandados y en el «Regresar a Admin» del modo Dev.
// ⚠️ SÓLO EL SUPER ADMIN (`getSesionAdmin`, no `rol_ws`: ése vale 'admin' para el dueño de cada negocio), en la primera línea
//    y antes de leer nada. `/admin` está además en `SOLO_ADMIN` del proxy, y cada action vuelve a preguntar. Todo lo de
//    adentro cruza negocios a propósito, sólo acá. ⚠️ `?cuenta=` y `?cliente=` y no `?ws=`: `?ws=` hace mirar a un cliente.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireSesion } from '@/lib/tab-access';
import { wsSuperAdmin } from '@/lib/workspace';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { getPerfil } from '@/lib/perfil';
import { vistaDeClientes } from '@/lib/clientes-plataforma';
import { vistaDeIngresos } from '@/lib/admin-ingresos';
import { clientesGanados, filasDeTodos } from '@/app/customer-success/trabajo';
import { Billing } from '@/app/admin/cobros/billing';
import { ContenidoAgentes } from '@/app/admin/agente/Contenido';
import { AdminView } from '@/app/admin/AdminView';
import '@/app/integraciones/tus-cuentas-ia.css';
import { cuantoEspera } from '@/lib/pedidos-ingreso';
import { textoDelCartel } from '@/lib/pedidos-ingreso-reglas';
import { AdminShell } from './_studio/shell/AdminShell';
import { ErrorSeccion } from './_studio/error-seccion';
import { esPestanaAdmin, type PestanaAdmin } from './pestanas-reglas';
import { Revenue } from './ingresos/revenue';
import { Customers } from './clientes/customers';
import { listarUsuarios } from '@/lib/usuarios';
import { listarWorkspaces } from '@/lib/workspace';
import { Users } from './usuarios/users';
import type { TipoCuenta, UserRow } from './usuarios/data';
import { zonaDelNegocio } from '@/lib/timezone';
import { vistaDeErrores } from '@/lib/admin-errores';
import { ErroresAdmin } from './errores/ErroresAdmin';
import { vistaDeActividad } from '@/lib/actividad';
import { ActividadAdmin } from './actividad/ActividadAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Admin' };

const ID = /^[1-9]\d{0,11}$/;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; cuenta?: string; cliente?: string; vista?: string; recibo?: string }> }) {
  await requireSesion();
  const sesionAdmin = await getSesionAdmin();
  if (!sesionAdmin) redirect('/inicio');
  const sp = await searchParams;
  const tab: PestanaAdmin = esPestanaAdmin(sp.tab) ? sp.tab : 'revenue';
  const cuenta = ID.test(sp.cuenta ?? '') ? Number(sp.cuenta) : null;
  const cliente = ID.test(sp.cliente ?? '') ? Number(sp.cliente) : null;

  return (
    <AdminShell cuenta={await cuentaDe(sesionAdmin)} esperan={await queEspera()}>
      {tab === 'revenue' ? await PestanaIngresos()
        : tab === 'users' ? await PestanaUsuarios()
        : tab === 'errors' ? await PestanaErrores()
        : tab === 'billing' ? <Billing vista={sp.vista} recibo={sp.recibo} />
        : tab === 'activity' || tab === 'agents' ? await PestanaActividad()
        : tab === 'accounts' ? await PestanaCuentas(sesionAdmin, cuenta)
        : await PestanaClientes(cliente)}
    </AdminShell>
  );
}

/** Quién mira (el super admin): su nombre, su email y su foto, para el pie del sidebar y el avatar de la cabecera. */
async function cuentaDe(sesion: NonNullable<Awaited<ReturnType<typeof getSesionAdmin>>>) {
  const p = await getPerfil().catch(() => null);
  return { name: p?.nombre || sesion.nombre || sesion.email, email: p?.email || sesion.email, avatar: p?.avatarUrl ?? '' };
}

/** Quién quiere entrar y qué pidieron las agencias (antes, el cartel de arriba de las pestañas). Sin nada, null. */
async function queEspera(): Promise<string | null> {
  const e = await cuantoEspera().catch(() => null);
  return e ? textoDelCartel(e.quierenEntrar, e.deAgencias) : null;
}

/** Revenue: lo que entra, de los pagos reales del CRM de la plataforma y de la pasarela. */
async function PestanaIngresos() {
  const vista = await vistaDeIngresos().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if ('error' in vista) return <ErrorSeccion titulo="No pude leer tus ingresos" detalle={vista.error} href="/admin" />;
  return <Revenue vista={vista} />;
}

/** Users: las personas de todos los negocios. Las acciones van por /api/admin/usuarios, que vuelve a preguntar. */
async function PestanaUsuarios() {
  const datos = await Promise.all([listarUsuarios(), listarWorkspaces(), wsSuperAdmin()]).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if ('error' in datos) return <ErrorSeccion titulo="No pude leer las personas" detalle={datos.error} href="/admin?tab=users" />;
  const [usuarios, wss, plataforma] = datos;
  const tz = await zonaDelNegocio(plataforma).catch(() => 'UTC');
  const nombre = new Map(wss.map((w) => [w.id, w.nombre]));
  const capa = new Map(wss.map((w) => [w.id, w.capa]));
  // El tipo de cuenta (la columna «Team» de Studio): de qué lado está la persona.
  const tipo = (rol: string, ws: number | null): TipoCuenta =>
    rol === 'admin' || ws === plataforma || (ws != null && capa.get(ws) === 'superadmin') ? 'Plataforma' : ws != null && capa.get(ws) === 'agencia' ? 'Agencia' : 'Cliente';
  // Sólo lo que la tabla dibuja: el resto de la fila (teléfono, bio, preferencias) no viaja al navegador.
  const filas: UserRow[] = usuarios.map((u) => ({
    id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, rolWs: u.rol_ws, estado: u.estado, ultimoLogin: u.ultimo_login,
    creado: u.created_at, invitacionEnviada: u.invitacion_enviada_at, workspaceId: u.workspace_id,
    negocio: u.workspace_id != null ? (nombre.get(u.workspace_id) ?? `Workspace ${u.workspace_id}`) : null,
    mfa: u.mfa_activo === true, foto: u.foto_url, tipo: tipo(u.rol, u.workspace_id),
  }));
  return <Users users={filas} ahoraMs={Date.now()} tz={tz} />;
}

/** Errors: los errores de la app agrupados por huella y los reportes de las personas. */
/** Activity: quién entra, qué usa y qué no (la medición de la mig 0398), y al pie lo que los agentes le contaron a MaKo. */
async function PestanaActividad() {
  const vista = await vistaDeActividad().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if ('error' in vista) return <ErrorSeccion titulo="No pude leer la actividad" detalle={vista.error} href="/admin?tab=activity" />;
  return <ActividadAdmin vista={vista} ahoraMs={Date.now()} agentes={<section aria-label="Agentes de los clientes"><ContenidoAgentes /></section>} />;
}

async function PestanaErrores() {
  const vista = await vistaDeErrores().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if ('error' in vista) return <ErrorSeccion titulo="No pude leer los errores" detalle={vista.error} href="/admin?tab=errors" />;
  return <ErroresAdmin vista={vista} ahoraMs={Date.now()} />;
}

/** Customers: la vista de los negocios, entera del server; con `?cliente=<ws>`, la ficha de uno. */
async function PestanaClientes(cliente: number | null) {
  const vista = await vistaDeClientes().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if ('error' in vista) return <ErrorSeccion titulo="No pude leer tus clientes" detalle={vista.error} href="/admin?tab=customers" />;
  return <Customers vista={vista} cliente={cliente} ahoraMs={Date.now()} />;
}

/** Accounts: la grilla de administración, con lo que la ficha de cada cliente necesita (como /clients antes). */
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
