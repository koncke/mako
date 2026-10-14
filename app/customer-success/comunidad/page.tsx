// =============================================================================
// /customer-success/comunidad — la comunidad tipo Skool de cada producto
// =============================================================================
// Pedido de Martín (07/10/2026, item 10), textual: «quiero implementar una nueva tab dentro del
// desplegable de la sidebar de Customer Success, que sea Comunidad, replica lo que tiene skool tal
// cual, todas las funcionalidades de comunidad.» Las decisiones y los contratos, en
// docs/diseno-curso-skool.md (D8); el modelo, en supabase/migrations/0217_comunidad.sql.
//
// Una comunidad por PRODUCTO (el programa que el negocio les da a sus clientes): el equipo del
// workspace es admin ahí y los alumnos son los clientes con acceso al curso de ese producto. Esta es
// la vista del EQUIPO; la del alumno la monta su portal (<ComunidadAlumno />, app/_comunidad/).
//
// ⚠️ TODO VIENE CON EL HTML, como en el Curso: la comunidad del producto elegido y su primera página
//    del feed. Cambiar de producto es otra URL (`?producto=`), no un estado de carga.

import { requireCapa } from '@/lib/tab-access';
import { inicioComunidad, feedComunidad, productoDelPost } from '@/lib/comunidad-datos';
import { getWorkspaceActual } from '@/lib/workspace';
import { productosDeLaEntrega } from '../entrega';
import { nombresDeCursos } from '@/lib/curso-nombre-datos';
import { SIN_NOMBRE_EQUIPO } from '@/lib/curso-nombre';
import { actorDelEquipo } from './actor';
import { ComunidadEquipo } from './ComunidadEquipo';
import { lineaOnboarding } from './onboarding-comunidad';
import { sincronizarOnboardingComunidad } from './onboarding-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Comunidad · Customer Success' };

const mensaje = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

export default async function ComunidadPage({ searchParams }: { searchParams: Promise<{ producto?: string; post?: string }> }) {
  await requireCapa('customer-success');
  const sp = await searchParams;
  // `?post=N` abre ESE post (el link de la ficha a lo que un alumno publicó o comentó desde una tarea,
  // item 17 del 08/10/2026). Sin `?producto=`, el producto sale del post: el link no sabe de cuál es.
  const postPedido = Number(sp.post);
  const postInicial = Number.isInteger(postPedido) && postPedido > 0 ? postPedido : null;

  // Los productos de Customer Success: la MISMA lista que el kanban y el Curso.
  let productos: Array<{ id: number; nombre: string }> = [];
  try {
    // Cada comunidad se nombra como su CURSO, nunca como el producto (que es el CRM): lib/curso-nombre.ts.
    const lista = await productosDeLaEntrega();
    const nombres = await nombresDeCursos(lista.map((p) => p.id), { conTitulo: true }).catch(() => new Map<number, string>());
    productos = lista.map((p) => ({ id: p.id, nombre: nombres.get(p.id) ?? SIN_NOMBRE_EQUIPO }));
  } catch (e) {
    return <ComunidadEquipo productos={[]} productoId={null} inicial={null} error={mensaje(e, 'No pude leer tus productos.')} onboarding={null} />;
  }
  let pedido = Number(sp.producto);
  if (!pedido && postInicial) {
    const ws = await getWorkspaceActual();
    pedido = ws ? ((await productoDelPost(ws, postInicial).catch(() => null)) ?? NaN) : NaN;
  }
  const productoId = productos.find((p) => p.id === pedido)?.id ?? productos[0]?.id ?? null;
  if (!productoId) return <ComunidadEquipo productos={[]} productoId={null} inicial={null} error={null} onboarding={null} />;

  const actor = await actorDelEquipo(productoId);
  if (typeof actor === 'string') {
    return <ComunidadEquipo productos={productos} productoId={productoId} inicial={null} error={actor} onboarding={null} />;
  }

  // ⚠️ SI FALLA, FALLA VISIBLE: «no pude cargar» en vez de un feed vacío, que se leería como una
  //    comunidad sin nadie.
  let inicial: { comunidad: Awaited<ReturnType<typeof inicioComunidad>>; feed: Awaited<ReturnType<typeof feedComunidad>> } | null = null;
  let error: string | null = null;
  try {
    const [comunidad, feed] = await Promise.all([inicioComunidad(actor), feedComunidad(actor, {})]);
    inicial = { comunidad, feed };
  } catch (e) {
    error = mensaje(e, 'No pude cargar la comunidad.');
  }

  // El onboarding de la tab (regla de la casa): los pasos se derivan de los datos y se anotan acá.
  // Es de quien la arma: sólo se dibuja a un admin del workspace.
  const steps = actor.adminWs ? await sincronizarOnboardingComunidad(actor.ws) : null;

  return (
    <ComunidadEquipo
      productos={productos}
      productoId={productoId}
      inicial={inicial}
      error={error}
      onboarding={lineaOnboarding(steps)}
      postInicial={postInicial}
    />
  );
}
