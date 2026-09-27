// =============================================================================
// /customer-success/[id] — el cliente, con SU tablero adentro
// =============================================================================
// «Te recomiendo replicar EXACTAMENTE igual la tab de plan dentro del detail de ese
// cliente. Solo que en filtros siempre se filtra por ese cliente. Pero el resto todo
// igual. Que tenga sus 4 tabs, su barra de búsqueda, el diseño idéntico» (26/09/2026).
//
// ⚠️ ES EL TABLERO DE VERDAD, NO UNA COPIA DE SU DISEÑO. Las dos tandas anteriores
// dibujaron primero una lista y después unas tarjetas «parecidas» a las del plan, y las
// dos se rechazaron por lo mismo: parecido no es igual, y mantener una segunda cara de la
// misma cosa garantiza que diverjan. Acá se monta `PlanBoard` / `TodoBoard` —los mismos
// componentes que renderiza `/plan`— con las filas ya filtradas.
//
// ⚠️ Y ES UNA PÁGINA, NO UN MODAL, por tres razones medidas:
//   1. El tablero tiene cuatro columnas de Kanban. En un modal de 1040 px entran
//      apretadas; acá usa el ancho de la pantalla, como en /plan.
//   2. Los datos vienen con el HTML. El modal los pedía al abrirse, y por eso se seguía
//      viendo «Leyendo lo suyo…» en cada apertura — que es lo que se reportó dos veces.
//      Una navegación del server no tiene estado de carga que mostrar.
//   3. Es un link: se puede compartir, abrir en otra pestaña y marcar. Un modal no.
//
// ⚠️ EL TABLERO ESCRIBE DE VERDAD, y está bien: `useBoard` autoguarda, pero acá no hay
// OTRO `useBoard` montado sobre las mismas filas (esta página y /plan son dos rutas). Lo
// que sí se acota es el ALTA: lo que se cree adentro nace con este cliente puesto
// (`clienteFijo`), o desaparecería al recargar.

import { notFound } from 'next/navigation';
import Link from '@/app/_ui/Link';
import { requireCapa } from '@/lib/tab-access';
import { getPerfil } from '@/lib/perfil';
import { getTenantDb } from '@/lib/workspace';
import { rowToTask, rowToLabel, type Row } from '@/lib/plan-board';
import { rowTo, catRow } from '@/lib/todo';
import { clientesGanadosOVacio } from '@/lib/clientes-ganados';
import { listDependencias } from '@/lib/plan-board';
import { PlanBoard } from '../../plan/PlanBoard';
import { TodoBoard } from '../../plan/TodoBoard';
import { filasDeCliente } from '../trabajo';
import { CabeceraCliente } from '../CabeceraCliente';
import { PanelCliente } from '../PanelCliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** La pestaña del navegador dice de QUIÉN es esta página. Con «Customer Success» a secas,
 *  tres clientes abiertos en tres pestañas son tres pestañas idénticas. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return { title: 'Cliente' };
  try {
    const db = await getTenantDb();
    const { data } = await db.from('leads').select('nombre').eq('id', id).eq('estado_lead', 'ganado').maybeSingle();
    const n = (data as { nombre?: string } | null)?.nombre?.trim();
    return { title: n ? `${n} · Clientes` : 'Cliente' };
  } catch { return { title: 'Cliente' }; }
}

export default async function ClientePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  await requireCapa('customer-success');

  const leadId = Number((await params).id);
  if (!Number.isInteger(leadId) || leadId <= 0) notFound();

  // ⚠️ FAIL-CLOSED Y CONTRA ESTE WORKSPACE: `getTenantDb` ya lo acota al inquilino, y el
  // `estado_lead` exige que sea un CLIENTE. Sin lo segundo, esta página sería una ficha de
  // cualquier lead del CRM con un tablero al lado.
  const db = await getTenantDb();
  const { data } = await db.from('leads')
    .select('id, nombre, empresa').eq('id', leadId).eq('estado_lead', 'ganado').maybeSingle();
  const lead = data as { id: number; nombre: string | null; empresa: string | null } | null;
  if (!lead) notFound();

  const nombre = (lead.nombre ?? '').trim() || 'Sin nombre';
  const [perfil, clientes] = await Promise.all([
    getPerfil().catch(() => ({ nombre: '', avatarUrl: '' })),
    clientesGanadosOVacio(),
  ]);
  const user = { nombre: perfil.nombre, avatarUrl: perfil.avatarUrl };
  // El número de cliente es el orden de alta, igual que en la grilla.
  const n = clientes.findIndex((c) => c.leadId === leadId) + 1;

  const vista = (await searchParams)?.vista;

  // ⚠️ EL `try` ENVUELVE LA LECTURA, NO EL JSX. Armar elementos adentro de un try/catch
  // hace que un error de RENDER —no de datos— caiga en el catch y se reporte como «no
  // pude leer su tablero», que manda a mirar la base por un bug de la pantalla. Lo caza
  // el lint de React; la cura es leer primero y decidir después.
  let filas: Awaited<ReturnType<typeof filasDeCliente>> | null = null;
  let fallo: string | null = null;
  try { filas = await filasDeCliente(leadId); }
  catch (e) { fallo = e instanceof Error ? e.message : 'No pude leer su tablero.'; }

  const deps = filas?.dueno ? await listDependencias().catch(() => []) : [];

  const cuerpo = !filas
    ? (
      // «No pude leer» no se pinta como «no tiene trabajo»: son dos pantallas, y la
      // segunda sobre la primera es la mentira que nadie audita.
      <div style={{ padding: '32px 24px' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--bad)' }}>No pude leer su tablero</p>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--dim)' }}>{fallo}</p>
      </div>
    )
    : filas.dueno
      ? (
        <PlanBoard
          user={user}
          tareas={filas.tareas.map((f) => rowToTask(f as Row))}
          proyectos={filas.proyectos.map((p) => rowToLabel(p as Row))}
          deps={deps}
          vacio={false}
          vistaInicial={vista}
          clientes={clientes}
          clienteFijo={{ leadId, nombre }}
        />
      )
      : (
        <TodoBoard
          tareas={filas.tareas.map((f) => rowTo(f))}
          categorias={filas.proyectos.map((p) => catRow(p))}
          demo={false}
          user={user}
          vistaInicial={vista}
          clientes={clientes}
          clienteFijo={{ leadId, nombre }}
        />
      );

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <CabeceraCliente
        nombre={nombre}
        empresa={lead.empresa}
        n={n > 0 ? n : null}
        leadId={leadId}
        volver={<Link href="/customer-success" className="cl-pag-volver">← Clientes</Link>}
        acciones={<PanelCliente leadId={leadId} nombre={nombre} />}
      />
      {/* El tablero estira: es un flex column y esto es lo que crece. `minHeight: 0` es lo
          que hace que su scroll interno funcione en vez de empujar la página. */}
      <div style={{ flex: 1, minHeight: 0 }}>{cuerpo}</div>
    </main>
  );
}
