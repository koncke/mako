// El plan guardado del coach, en el lugar del chat: el mismo en la computadora (./ChatDelCoach.tsx) y en el teléfono
// (app/m/second-brain/HojaDelCoach.tsx). Aparte para que el teléfono no se lleve el panel de la computadora.

import { lineasDelPlan, type PlanFunnel } from '@/lib/funnel-plan';

/** Lo guardado, en vez del chat: lo que el CRM o el Dashboard pueden leer, y lo que la persona retoma en tres semanas. */
export function VistaDelPlan({ plan }: { plan: PlanFunnel }) {
  return (
    <article className="fc-plan">
      <dl className="fc-plan__datos">
        {lineasDelPlan(plan).map((l) => <div key={l.rotulo}><dt>{l.rotulo}</dt><dd>{l.valor}</dd></div>)}
      </dl>
      {plan.porque && <p className="fc-plan__porque">{plan.porque}</p>}
      {plan.pasos.length > 0 && <ol className="fc-plan__pasos">{plan.pasos.map((p) => <li key={p}>{p}</li>)}</ol>}
    </article>
  );
}
