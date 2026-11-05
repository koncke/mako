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
// LAS PESTAÑAS (`?tab=`, leída acá; se suman por tandas, Revenue primero porque es lo que Martín pide hoy):
//   · revenue: lo que entra (lib/admin-ingresos.ts): MRR, cobrado mes a mes, movimientos y lo que pagó cada cliente;
//   · billing: lo que era /admin/cobros (app/admin/cobros/Contenido.tsx);
//   · customers: los negocios, con «Para mirar» y su ficha (app/customers/CustomersApp.tsx);
//   · accounts: la grilla de administración (AdminView: alta, plan, equipo, borrar). `?cuenta=<ws>` abre su ficha. No es
//     otra pestaña de la barra: es la otra VISTA de Customers (el selector de vista, app/admin/Pestanas.tsx);
//   · users: las personas de todos los negocios con su estado de alta (app/admin/usuarios, lib/admin-usuarios-reglas.ts);
//   · errors: los errores de la app agrupados y los reportes (app/admin/errores, lib/admin-errores.ts);
//   · agents: lo que era /admin/agente.
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
import { ContenidoCobros } from '@/app/admin/cobros/Contenido';
import { ContenidoAgentes } from '@/app/admin/agente/Contenido';
import { AdminView } from '@/app/admin/AdminView';
import { ErrorState, Pagina, PageHeader } from '@/app/_ui';
import '@/app/integraciones/tus-cuentas-ia.css';
import Link from 'next/link';
import { cuantoEspera } from '@/lib/pedidos-ingreso';
import { RUTA_QUIEREN_ENTRAR, textoDelCartel } from '@/lib/pedidos-ingreso-reglas';
import { CustomersApp } from '@/app/customers/CustomersApp';
import { PestanasAdmin } from './Pestanas';
import { esPestanaAdmin, type PestanaAdmin } from './pestanas-reglas';
import { IngresosAdmin } from './ingresos/IngresosAdmin';
import { listarUsuarios } from '@/lib/usuarios';
import { listarWorkspaces } from '@/lib/workspace';
import type { FilaUsuario } from '@/lib/admin-usuarios-reglas';
import { UsuariosAdmin } from './usuarios/UsuariosAdmin';
import { vistaDeErrores } from '@/lib/admin-errores';
import { ErroresAdmin } from './errores/ErroresAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = { title: 'Admin' };

const ID = /^[1-9]\d{0,11}$/;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; cuenta?: string; cliente?: string }> }) {
  await requireSesion();
  const sesionAdmin = await getSesionAdmin();
  if (!sesionAdmin) redirect('/inicio');
  const sp = await searchParams;
  const tab: PestanaAdmin = esPestanaAdmin(sp.tab) ? sp.tab : 'revenue';
  const cuenta = ID.test(sp.cuenta ?? '') ? Number(sp.cuenta) : null;
  const cliente = ID.test(sp.cliente ?? '') ? Number(sp.cliente) : null;

  return (
    <Pagina ancho="completo">
      <PageHeader titulo="Admin" />
      {/* Accounts no es la pestaña que se abre: sin esto, lo que espera a Martín no se ve (30/10/2026). */}
      {tab !== 'accounts' && <CartelQueEspera />}
      <PestanasAdmin activa={tab} />
      {tab === 'revenue' ? await PestanaIngresos()
        : tab === 'users' ? await PestanaUsuarios()
        : tab === 'errors' ? await PestanaErrores()
        : tab === 'billing' ? <ContenidoCobros />
        : tab === 'agents' ? <ContenidoAgentes />
        : tab === 'accounts' ? await PestanaCuentas(sesionAdmin, cuenta)
        : await PestanaClientes(cliente)}
    </Pagina>
  );
}

/** Quién quiere entrar y qué pidieron las agencias, a un clic. Sin nada, no se dibuja. */
async function CartelQueEspera() {
  const e = await cuantoEspera();
  const texto = textoDelCartel(e.quierenEntrar, e.deAgencias);
  if (!texto) return null;
  return (
    <Link href={RUTA_QUIEREN_ENTRAR} style={{ display: 'block', margin: '0 0 12px', padding: '10px 14px', borderRadius: 11, border: '1px solid var(--primary)', background: 'var(--primary-bg)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
      {texto} →
    </Link>
  );
}

/** Revenue: lo que entra, de los pagos reales del CRM de la plataforma y de la pasarela. */
async function PestanaIngresos() {
  const vista = await vistaDeIngresos().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if ('error' in vista) return <ErrorState titulo="No pude leer tus ingresos" detalle={vista.error} accion={{ label: 'Volver a cargar', href: '/admin' }} />;
  return <IngresosAdmin vista={vista} />;
}

/** Users: las personas de todos los negocios. Las acciones van por /api/admin/usuarios, que vuelve a preguntar. */
async function PestanaUsuarios() {
  const datos = await Promise.all([listarUsuarios(), listarWorkspaces()]).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if ('error' in datos) return <ErrorState titulo="No pude leer las personas" detalle={datos.error} accion={{ label: 'Volver a cargar', href: '/admin?tab=users' }} />;
  const [usuarios, wss] = datos;
  const nombre = new Map(wss.map((w) => [w.id, w.nombre]));
  // Sólo lo que la tabla dibuja: el perfil (teléfono, bio, preferencias) no viaja al navegador.
  const filas: FilaUsuario[] = usuarios.map((u) => ({
    id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, rolWs: u.rol_ws, estado: u.estado, ultimoLogin: u.ultimo_login,
    creado: u.created_at, invitacionEnviada: u.invitacion_enviada_at, workspaceId: u.workspace_id,
    negocio: u.workspace_id != null ? (nombre.get(u.workspace_id) ?? `Workspace ${u.workspace_id}`) : null,
    mfa: u.mfa_activo === true, foto: u.foto_url,
  }));
  return <UsuariosAdmin filas={filas} ahoraMs={Date.now()} />;
}

/** Errors: los errores de la app agrupados por huella y los reportes de las personas. */
async function PestanaErrores() {
  const vista = await vistaDeErrores().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if ('error' in vista) return <ErrorState titulo="No pude leer los errores" detalle={vista.error} accion={{ label: 'Volver a cargar', href: '/admin?tab=errors' }} />;
  return <ErroresAdmin vista={vista} ahoraMs={Date.now()} />;
}

/** Customers: la vista de los negocios, entera del server (la ficha es un panel sin estado de carga). */
async function PestanaClientes(cliente: number | null) {
  const vista = await vistaDeClientes().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if ('error' in vista) return <ErrorState titulo="No pude leer tus clientes" detalle={vista.error} accion={{ label: 'Volver a cargar', href: '/admin?tab=customers' }} />;
  return <CustomersApp vista={vista} abiertoInicial={cliente} />;
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
