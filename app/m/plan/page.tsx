// =============================================================================
// /m/plan — el plan en el teléfono: qué hago ahora, qué vence hoy y esta semana
// =============================================================================
// Sólo lectura más UN gesto: marcar hecha (con Deshacer). Editar, reordenar,
// cambiar la prioridad y el Kanban se quedan en la computadora; cada tarea lleva
// el link a su ficha de escritorio.
//
// · CUÁL tablero → `leerPlanHoy` (lib/plan-hoy.ts) lo decide por SESIÓN, igual
//   que /plan: el dueño ve el suyo; un cliente (o un admin mirándolo), el del
//   cliente. Esta página no lee `?ws=`.
// · Las alertas van arriba, una línea cada una, y sólo si existen. Los
//   borradores llevan al Inbox (ahí se confirman); `borradores: null` es «no se
//   pudo leer» y NO se dibuja como «no hay».
// · `maxDuration` 60: marcar hecha corre la server action desde esta página.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { leerPlanHoy, type PlanHoy } from '@/lib/plan-hoy';
import { Icon } from '@/app/_components/icons';
import Link from '@/app/_ui/Link';
import { ErrorM, PantallaM } from '@/app/m/_ui';
import { ListaPlan, type SeccionPlan } from './ListaPlan';
import { contar } from './formato';
import './plan.css';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Alerta = { clave: string; texto: string; tono: 'bad' | 'warn' | 'mako'; href?: string };

function alertasDe(p: PlanHoy): Alerta[] {
  const out: Alerta[] = [];
  const nb = p.borradores?.length ?? 0;
  if (nb > 0) out.push({ clave: 'borradores', texto: `${contar(nb, 'borrador', 'borradores')} para confirmar`, tono: 'mako', href: '/m/inbox' });
  const atr = p.alertas.proyectosAtrasados;
  if (atr.length > 0) {
    out.push({
      clave: 'atrasados',
      texto: `${contar(atr.length, 'proyecto atrasado', 'proyectos atrasados')}: ${atr.map((f) => f.nombre).join(', ')}`,
      tono: 'bad',
    });
  }
  if (p.tablero === 'dueno' && p.alertas.bloqueadas > 0) {
    out.push({ clave: 'bloqueadas', texto: contar(p.alertas.bloqueadas, 'tarea bloqueada', 'tareas bloqueadas'), tono: 'warn' });
  }
  if (p.recortado) out.push({ clave: 'recortado', texto: 'Puede faltar parte del plan', tono: 'warn' });
  return out;
}

function Alertas({ items }: { items: Alerta[] }) {
  if (!items.length) return null;
  return (
    <ul className="m-plan-alertas">
      {items.map((a) => {
        const cuerpo = (
          <>
            <span className="m-plan-alerta__punto" data-tono={a.tono} aria-hidden />
            <span className="m-plan-alerta__txt">{a.texto}</span>
            {a.href && <span className="m-plan-alerta__ir" aria-hidden><Icon name="chevron" size={18} /></span>}
          </>
        );
        return (
          <li key={a.clave}>
            {a.href ? <Link href={a.href} className="m-plan-alerta">{cuerpo}</Link> : <div className="m-plan-alerta">{cuerpo}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export default async function PlanMovil() {
  await requireMovil({ navKey: 'todo' });

  let plan: PlanHoy;
  try {
    plan = await leerPlanHoy();
  } catch (e) {
    console.error('[m/plan] leerPlanHoy:', e instanceof Error ? e.message : e);
    return <PantallaM refrescable><ErrorM frase="No se pudo leer el plan." /></PantallaM>;
  }

  const secciones: SeccionPlan[] = [
    { id: 'prioridades', titulo: 'Prioridades', items: plan.prioridades },
    { id: 'hoy', titulo: 'Hoy', items: plan.hoy },
    { id: 'semana', titulo: 'Esta semana', items: plan.semana },
  ];

  return (
    <PantallaM refrescable actualizado={new Date()}>
      <Alertas items={alertasDe(plan)} />
      <ListaPlan secciones={secciones} fecha={plan.fecha} />
    </PantallaM>
  );
}
