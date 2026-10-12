// =============================================================================
// /m/hoy — «Today» (v2): lo que te espera hoy, en el orden en que se mira
// =============================================================================
// docs/diseno-mako-mobile-v2.md, «Por sección → Today», y el prototipo (data-ir="today"):
//   1. lo que BLOQUEA, como UNA tarjeta que lleva al Inbox (aquí no se aprueba: se ve allá);
//   2. «Reuniones»: las de HOY con la hora grande; tocar una abre la ficha del lead;
//   3. «Para hoy»: las 3 primeras del plan con su casilla (completar con Deshacer);
//   4. el trimestre en una fila: lo cobrado, la barra contra el tiempo y «$620 arriba».
// El título «Today», el logo y la cuenta los pone el shell: aquí no hay frase héroe, ni
// «Actualizado», ni lámpara, ni LA acción del día (la v2 los sacó; el semáforo completo y
// los KPIs quedan en /general, en la computadora).
//
// SE COMPONE POR ROL como en la v1, con `composicionHoy` (lib/hoy-movil-modelo.ts):
//   · admin-cliente: tarjeta + reuniones + para hoy + trimestre;
//   · closer/setter: tarjeta + reuniones + leads por decidir + para hoy;
//   · capa pm/superadmin: tarjeta + para hoy.
// Las lecturas son `componerHoy` (lib/hoy-movil.ts). Lo que no se pudo leer se DICE en su
// sección (ErrorM); nunca se dibuja como una lista vacía.
//
// ⚠️ RENDERIZAR ESCRIBE (ver lib/hoy-movil.ts): una vez por render, nunca en un sondeo.
// ⚠️ maxDuration 60: desde aquí se completa una tarea (`marcarHechaAction`), y una server
// action hereda el techo de la página que la invoca.
// =============================================================================

import Link from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { requireMovil } from '@/lib/movil-guard';
import { componerHoy, type LeadsPorDecidir, type ReunionHoy } from '@/lib/hoy-movil';
import {
  ComputadoraM, ErrorM, FilaM, ListaM, PantallaM, SeccionM, TarjetaDecision, VacioM,
} from '@/app/m/_ui';
import { ParaHoy } from './ParaHoy';
import { bloqueoDeHoy, filaTrimestre, paraHoy, TOPE_LEADS_HOY, type FilaTrimestre } from './modelo';
import './hoy.css';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** «Primera llamada» / «Segunda llamada»: los mismos nombres que el CRM v2 (app/m/crm/reglas.ts). */
const NOMBRE_REUNION: Record<ReunionHoy['tipo'], string> = { J1: 'Primera llamada', J2: 'Segunda llamada' };

export default async function HoyPage() {
  const ctx = await requireMovil();
  const hoy = await componerHoy(ctx);
  const { composicion } = hoy;

  const bloqueo = hoy.decidir.estado === 'ok' ? bloqueoDeHoy(hoy.decidir.dato.porTipo) : null;
  const reuniones = hoy.reuniones.estado === 'ok' ? hoy.reuniones.dato.filter((r) => r.dia === 'hoy') : [];
  const leads = hoy.leads.estado === 'ok' ? hoy.leads.dato : null;
  const plan = hoy.plan.estado === 'ok' ? hoy.plan.dato : null;
  const tareas = plan ? paraHoy(plan) : [];
  const trimestre = hoy.pulso.estado === 'ok' ? filaTrimestre(hoy.pulso.dato) : null;

  const errReuniones = composicion.reuniones && hoy.reuniones.estado === 'error';
  const errLeads = composicion.leadsPorDecidir && hoy.leads.estado === 'error';
  const errPlan = composicion.plan && hoy.plan.estado === 'error';
  const errPulso = composicion.pulso && hoy.pulso.estado === 'error';

  const hayAlgo = !!bloqueo || reuniones.length > 0 || (leads?.items.length ?? 0) > 0 || tareas.length > 0 || !!trimestre
    || errReuniones || errLeads || errPlan || errPulso;
  const leadsDeMas = leads ? Math.max(0, leads.total - Math.min(leads.items.length, TOPE_LEADS_HOY)) : 0;

  return (
    <PantallaM refrescable>
      {bloqueo && (
        <TarjetaDecision
          titulo={bloqueo.titulo}
          consecuencia={bloqueo.consecuencia}
          accion={{ rotulo: 'Revisar en el Inbox', href: '/m/inbox' }}
        />
      )}

      {errReuniones && <SeccionM titulo="Reuniones"><ErrorM frase="No pude leer las reuniones de hoy." /></SeccionM>}
      {reuniones.length > 0 && (
        <SeccionM titulo="Reuniones">
          <ListaM>
            {reuniones.map((r) => (
              <FilaM
                key={`${r.leadId}-${r.tipo}`}
                leading={<span className="m-fila__hora">{r.hora ?? '—'}</span>}
                titulo={r.nombre}
                segunda={NOMBRE_REUNION[r.tipo]}
                href={`/m/crm/${r.leadId}`}
                etiqueta={`${r.nombre}, ${NOMBRE_REUNION[r.tipo].toLowerCase()}${r.hora ? ` a las ${r.hora}` : ', sin hora'}`}
              />
            ))}
          </ListaM>
        </SeccionM>
      )}

      {errLeads && <SeccionM titulo="Leads por decidir"><ErrorM frase="No pude leer los leads por decidir." /></SeccionM>}
      {leads && leads.items.length > 0 && <Leads l={leads} />}

      {errPlan && <SeccionM titulo="Para hoy"><ErrorM frase="No pude leer el plan." /></SeccionM>}
      {plan && tareas.length > 0 && (
        <SeccionM titulo="Para hoy" accion={<Link href="/m/plan" className="m-lnk">Ver el plan</Link>}>
          <ParaHoy items={tareas} fecha={plan.fecha} />
        </SeccionM>
      )}

      {errPulso && <SeccionM titulo="Trimestre"><ErrorM frase="No pude leer el trimestre." /></SeccionM>}
      {trimestre && (
        <SeccionM titulo={trimestre.titulo}>
          <ListaM><Trimestre t={trimestre} /></ListaM>
        </SeccionM>
      )}

      {!hayAlgo && (
        <VacioM
          frase="Nada pendiente para hoy."
          accion={composicion.plan ? { rotulo: 'Ver el plan', href: '/m/plan' } : undefined}
        />
      )}

      {leadsDeMas > 0 && <ComputadoraM que={`${leadsDeMas} ${leadsDeMas === 1 ? 'lead más' : 'leads más'} por decidir`} />}
    </PantallaM>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** La cola del closer/setter: leads cuya etapa adeuda algo. Abre la ficha. */
function Leads({ l }: { l: LeadsPorDecidir }) {
  return (
    <SeccionM titulo="Leads por decidir">
      <ListaM>
        {l.items.slice(0, TOPE_LEADS_HOY).map((i) => (
          <FilaM key={i.lead_id} avatar={i.lead_nombre} titulo={i.lead_nombre} segunda={i.mensaje} href={`/m/crm/${i.lead_id}`} />
        ))}
      </ListaM>
      {/* La lectura vino con aviso: la lista puede estar incompleta, y se dice. */}
      {l.aviso && <div className="m-hoy-nota" role="status">Puede faltar alguno.</div>}
    </SeccionM>
  );
}

/** El trimestre en una fila: rótulo y valor · la barra contra el tiempo · meta y ritmo. */
function Trimestre({ t }: { t: FilaTrimestre }) {
  const pct = t.barra ? Math.round(t.barra.avance * 100) : 0;
  const tiempo = t.barra ? Math.round(t.barra.tiempo * 100) : 0;
  return (
    <div className="m-hoy-trim">
      <div className="m-hoy-trim__l1">
        <span className="m-hoy-trim__rotulo">{t.rotulo}</span>
        <strong className="m-hoy-trim__valor">{t.valor}</strong>
      </div>
      {t.barra && (
        <div
          className="m-hoy-barra"
          role="img"
          aria-label={`${pct} % de la meta, con el ${tiempo} % del ${t.titulo === 'Año' ? 'año' : 'trimestre'} corrido`}
        >
          <i style={{ width: `${t.barra.avance * 100}%` }} data-atrasado={t.barra.atrasado || undefined} />
          <b style={{ left: `${t.barra.tiempo * 100}%` }} />
        </div>
      )}
      <div className="m-hoy-trim__l2">
        <span>{t.meta}</span>
        {t.ritmo ? (
          <span className="m-hoy-ritmo" data-baja={!t.ritmo.sube || undefined}>
            <Icon name="flecha" size={14} />
            {t.ritmo.texto}
          </span>
        ) : t.nota ? <span>{t.nota}</span> : null}
      </div>
    </div>
  );
}
