// =============================================================================
// /m/hoy — «Today»: lo que te espera hoy, en el orden en que se mira
// =============================================================================
// Un paso por pantalla, cosas grandes, el test del segundo:
//   1. la frase héroe con el número adentro;
//   2. si algo BLOQUEA (aprobaciones), UNA tarjeta que lleva al Inbox (acá no se aprueba);
//   3. admin-cliente: la lámpara, LA acción del día, el objetivo, KPIs y alertas;
//   4. reuniones de hoy y mañana, con hora en la zona del negocio;
//   5. el plan: prioridades con su check (y, para pm/superadmin, vencimientos y borradores).
// Qué se pide por rol lo decide `composicionHoy` (lib/hoy-movil-modelo.ts); las lecturas,
// `componerHoy` (lib/hoy-movil.ts). Lo que no se pudo leer se DICE, no se esconde.
//
// ⚠️ RENDERIZAR ESCRIBE (ver lib/hoy-movil.ts): una vez por render, nunca en un sondeo.
// ⚠️ maxDuration 60: desde acá se marca hecha una tarea (`marcarHechaAction`), y una
// server action hereda el techo de la página que la invoca.
// =============================================================================

import Link from '@/app/_ui/Link';
import { ButtonLink } from '@/app/_ui/Button';
import { requireMovil } from '@/lib/movil-guard';
import { componerHoy, type LeadsPorDecidir, type ReunionHoy } from '@/lib/hoy-movil';
import {
  alertasRestantes, diasQueQuedan, fraseHeroe, sumaDe, textoLampara, TIPOS_QUE_BLOQUEAN,
} from '@/lib/hoy-movil-modelo';
import { rutaMovil } from '@/lib/movil-rutas';
import { ESTADO_LABEL, METRICA_LABEL } from '@/lib/objectives-modelo';
import { fmtNum, fmtUSD } from '@/lib/format';
import type { VistaGeneral } from '@/lib/vista-general';
import type { PlanHoy } from '@/lib/plan-hoy';
import { FilaM, PantallaM, SeccionM, TarjetaDecision } from '@/app/m/_ui';
import { FilasPlan } from './FilasPlan';
import { RegistrarKpi } from './RegistrarKpi';
import './hoy.css';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fmtValor = (n: number | null, unidad: string): string => (unidad === 'usd' ? fmtUSD(n) : n === null ? '—' : fmtNum(n));

export default async function HoyPage() {
  const ctx = await requireMovil();
  const hoy = await componerHoy(ctx);

  const conteo = hoy.decidir.estado === 'ok' ? hoy.decidir.dato : null;
  const bloquean = conteo ? sumaDe(conteo.porTipo, TIPOS_QUE_BLOQUEAN) : null;
  // Los borradores del plan y los contactos se revisan en la computadora: no van a la frase del
  // teléfono (eran «68 cosas para revisar» que desde acá no se pueden resolver, 11/10/2026).
  const revisar: number | null = null;
  const pulso = hoy.pulso.estado === 'ok' ? hoy.pulso.dato : null;
  const plan = hoy.plan.estado === 'ok' ? hoy.plan.dato : null;
  const reuniones = hoy.reuniones.estado === 'ok' ? hoy.reuniones.dato : null;
  const leads = hoy.leads.estado === 'ok' ? hoy.leads.dato : null;

  const tareasHoy = plan
    ? plan.hoy.length + plan.prioridades.filter((p) => p.cuando === 'hoy').length
    : null;
  const fallas = [hoy.pulso, hoy.plan, hoy.reuniones, hoy.leads, hoy.decidir].filter((l) => l.estado === 'error').length
    + (conteo && conteo.total === null ? 1 : 0);

  const frase = fraseHeroe({
    aprobaciones: bloquean,
    revisiones: revisar,
    llamadas: reuniones ? reuniones.filter((r) => r.dia === 'hoy').length : null,
    urgentes: pulso && !pulso.sinFuentes ? pulso.lampara.urgentes : null,
    tareas: tareasHoy,
    leads: leads ? leads.total : null,
    fuentes: pulso ? pulso.fuentes : null,
    fallas,
  });

  return (
    <PantallaM
      refrescable
      actualizado={hoy.leidoAt}
      titulo={frase.map((s, i) => (s.numero ? <strong key={i} className="m-hoy-num">{s.texto}</strong> : <span key={i}>{s.texto}</span>))}
    >
      {bloquean != null && bloquean > 0 && (
        <div className="m-hoy-bloque">
          <TarjetaDecision
            titulo={bloquean === 1 ? 'Una aprobación te espera' : `${bloquean} aprobaciones te esperan`}
            consecuencia="No se aplica nada hasta que decidas."
            accion={{ rotulo: 'Revisar en el Inbox', href: '/m/inbox' }}
          />
        </div>
      )}

      {hoy.pulso.estado === 'error' && <NoPude que="el pulso de tu negocio" />}
      {pulso && <Pulso v={pulso} />}

      {hoy.composicion.reuniones && (
        <SeccionM titulo="Reuniones">
          {hoy.reuniones.estado === 'error' && <NoPude que="las reuniones" />}
          {reuniones && (reuniones.length
            ? <div className="m-lista">{reuniones.map((r) => <FilaReunion key={`${r.leadId}-${r.tipo}`} r={r} />)}</div>
            : <p className="m-hoy-vacio">Sin reuniones hoy ni mañana.</p>)}
        </SeccionM>
      )}

      {hoy.composicion.leadsPorDecidir && (
        <SeccionM titulo="Leads por decidir">
          {hoy.leads.estado === 'error' && <NoPude que="los leads" />}
          {leads && <Leads l={leads} />}
        </SeccionM>
      )}

      {hoy.composicion.plan && (
        <>
          {hoy.plan.estado === 'error' && (
            <SeccionM titulo="Prioridades"><NoPude que="el plan" /></SeccionM>
          )}
          {plan && <Plan p={plan} conVencimientos={hoy.composicion.vencimientos} />}
        </>
      )}
    </PantallaM>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function NoPude({ que }: { que: string }) {
  return <p className="m-hoy-error" role="status">No pude leer {que}. Tira hacia abajo para reintentar.</p>;
}

/** El Pulso del admin-cliente: lámpara, LA acción, el objetivo, KPIs y alertas. */
function Pulso({ v }: { v: VistaGeneral }) {
  const foco = v.foco;
  const destino = rutaMovil(foco.href);
  // El KPI manual que es LA acción se registra ACÁ, no con un link a /general.
  const kpiFoco = foco.origen === 'kpi'
    ? v.kpis.find((k) => k.fuente === 'manual' && foco.razon.startsWith(`«${k.nombre}»`))
    : undefined;
  const restantes = alertasRestantes(v.alertas, foco.alertaIdx);
  const kpis = v.kpis.slice(0, 3);

  return (
    <>
      <div className="m-hoy-lampara" data-estado={v.lampara.estado} role="status">
        <span className="m-hoy-lampara__punto" aria-hidden />
        <span>{textoLampara(v.lampara, v.fuentes)}</span>
      </div>

      <section className="m-hoy-foco" aria-label="La acción de hoy">
        <h3 className="m-hoy-foco__accion">{foco.accion}</h3>
        <p className="m-hoy-foco__razon">{foco.razon}</p>
        {kpiFoco
          ? <RegistrarKpi kpiId={kpiFoco.id} cadencia={kpiFoco.cadencia} nombre={kpiFoco.nombre} />
          : destino
            ? <ButtonLink href={destino} variant="primary" size="md" full>{foco.hrefLabel}</ButtonLink>
            : <ButtonLink href={foco.href} variant="secondary" size="md" full>Abrir en la computadora</ButtonLink>}
      </section>

      {v.objetivoPrincipal && <Objetivo v={v} />}

      {kpis.length > 0 && (
        <SeccionM titulo="KPIs">
          <div className="m-lista">
            {kpis.map((k) => {
              const periodo = k.cadencia === 'diaria' ? 'hoy' : 'esta semana';
              const sinValor = k.valor === null;
              return (
                <div key={k.id} className="m-hoy-pulso" data-estado={k.estado}>
                  <div className="m-hoy-pulso__txt">
                    <span className="m-hoy-pulso__rotulo">{k.nombre}</span>
                    <span className="m-hoy-pulso__valor">{sinValor ? (k.fuente === 'manual' ? 'Sin registrar' : 'Sin datos aún') : fmtValor(k.valor, k.unidad)}</span>
                    <span className="m-hoy-pulso__comp">
                      <span className="m-hoy-pulso__punto" aria-hidden />
                      {sinValor ? `Compromiso: ${fmtValor(k.compromiso, k.unidad)} ${periodo}` : `de ${fmtValor(k.compromiso, k.unidad)} ${periodo} · ${ESTADO_LABEL[k.estado]}`}
                    </span>
                  </div>
                  {k.fuente === 'manual' && kpiFoco?.id !== k.id && (
                    <RegistrarKpi kpiId={k.id} cadencia={k.cadencia} nombre={k.nombre} />
                  )}
                </div>
              );
            })}
          </div>
        </SeccionM>
      )}

      {restantes.length > 0 && (
        <SeccionM titulo="Alertas">
          <div className="m-lista">
            {restantes.map((a, i) => (
              <FilaM
                key={`${a.tipo}-${i}`}
                titulo={a.titulo}
                segunda={a.detalle}
                leading={<span className="m-hoy-alerta" data-nivel={a.nivel} aria-label={a.nivel === 'rojo' ? 'Urgente' : 'Para vigilar'} />}
                href={rutaMovil(a.href) ?? undefined}
              />
            ))}
          </div>
        </SeccionM>
      )}
    </>
  );
}

/** El objetivo principal: actual / meta, barra con la marca del tiempo, el ritmo en palabras. */
function Objetivo({ v }: { v: VistaGeneral }) {
  const o = v.objetivoPrincipal!;
  const metaOk = o.metaValor > 0;
  const leido = o.actual !== null;
  const supera = leido && metaOk && o.actual! >= o.metaValor;
  const pct = leido && metaOk ? Math.max(0, Math.min(1, o.actual! / o.metaValor)) : 0;
  const quedan = diasQueQuedan(v.hoy, o.hasta);
  const periodo = o.quarter === null ? String(o.anio) : `Q${o.quarter}`;

  let ritmo: string;
  if (!leido) ritmo = 'No pude leer el avance.';
  else if (!metaOk) ritmo = 'Falta cargar la meta.';
  else if (supera) ritmo = 'Meta superada.';
  else if (!o.ritmo || o.ritmo.desvioPct === null) ritmo = 'Recién arranca: todavía no hay ritmo.';
  else ritmo = `Vas ${fmtValor(Math.abs(o.ritmo.desvio), o.unidad)} ${o.ritmo.alDia ? 'arriba' : 'abajo'} de lo esperado.`;

  return (
    <SeccionM titulo={`${METRICA_LABEL[o.metrica]} · ${periodo}`}>
      <div className="m-hoy-obj">
        <p className="m-hoy-obj__num">
          <strong>{leido ? fmtValor(o.actual, o.unidad) : '—'}</strong>
          <span>{metaOk ? ` / ${fmtValor(o.metaValor, o.unidad)}` : ' · sin meta'}</span>
        </p>
        {metaOk && leido && (
          <div className="m-hoy-obj__barra" role="img" aria-label={`${Math.round(pct * 100)}% de la meta, con ${Math.round(v.fraccionObjetivo * 100)}% del período consumido`}>
            <i style={{ width: `${pct * 100}%` }} data-atrasado={v.objetivoAtrasado || undefined} />
            <b style={{ left: `${Math.max(0, Math.min(1, v.fraccionObjetivo)) * 100}%` }} />
          </div>
        )}
        <p className="m-hoy-obj__ritmo">
          {ritmo}
          {quedan > 0 ? ` Quedan ${quedan} ${quedan === 1 ? 'día' : 'días'}.` : ''}
        </p>
      </div>
    </SeccionM>
  );
}

function FilaReunion({ r }: { r: ReunionHoy }) {
  const cual = r.tipo === 'J1' ? 'Primera reunión' : 'Segunda reunión';
  const cuando = r.dia === 'hoy' ? (r.hora ?? 'Sin hora') : `Mañana${r.hora ? ` ${r.hora}` : ''}`;
  return (
    <FilaM
      titulo={r.nombre}
      segunda={[cual, r.empresa].filter(Boolean).join(' · ')}
      riel={cuando}
      href={`/m/crm/${r.leadId}`}
    />
  );
}

function Leads({ l }: { l: LeadsPorDecidir }) {
  return (
    <>
      {l.aviso && <p className="m-hoy-error" role="status">{l.aviso}</p>}
      {l.items.length ? (
        <div className="m-lista">
          {l.items.map((i) => (
            <FilaM key={i.lead_id} titulo={i.lead_nombre} segunda={i.mensaje} href={`/m/crm/${i.lead_id}`} />
          ))}
          {l.total > l.items.length && <FilaM titulo={`Ver los ${l.total}`} href="/m/crm" />}
        </div>
      ) : !l.aviso && <p className="m-hoy-vacio">Ningún lead espera una decisión.</p>}
    </>
  );
}

/**
 * Qué arrastra un proyecto. ⚠️ «0 tareas abiertas» miente: un proyecto con sólo recurrentes
 * llega con `abiertas: 0` (la misma trampa que `carga` de lib/plan-vencimientos.ts, que es privada).
 */
function carga(f: { abiertas: number; recurrentes: number }): string {
  if (f.abiertas > 0) return `${f.abiertas} ${f.abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}`;
  return 'Sin trabajo con fin';
}

/** Cuántas de «Para hoy» entran en Today; el resto, en /m/plan. */
const TOPE_HOY = 5;

function Plan({ p, conVencimientos }: { p: PlanHoy; conVencimientos: boolean }) {
  const venc = conVencimientos ? [...p.alertas.proyectosAtrasados, ...p.alertas.proyectosPorVencer] : [];
  const borradores = conVencimientos ? p.borradores : [];
  return (
    <>
      {p.prioridades.length > 0 && (
        <SeccionM titulo="Prioridades" accion={<Link href="/m/plan" className="m-hoy-ver">Ver el plan</Link>}>
          <FilasPlan items={p.prioridades} />
        </SeccionM>
      )}

      {/* Today es un vistazo, no el plan: se ven las primeras y el resto vive en /m/plan.
          Sin tope, el Today del dueño medía 9.352 px con todas las vencidas (11/10/2026). */}
      {conVencimientos && p.hoy.length > 0 && (
        <SeccionM
          titulo="Para hoy"
          accion={p.hoy.length > TOPE_HOY ? <Link href="/m/plan" className="m-hoy-ver">{`Ver las ${p.hoy.length}`}</Link> : undefined}
        >
          <FilasPlan items={p.hoy.slice(0, TOPE_HOY)} />
        </SeccionM>
      )}

      {venc.length > 0 && (
        <SeccionM titulo="Vencimientos">
          <div className="m-lista">
            {p.alertas.proyectosAtrasados.map((f) => (
              <FilaM key={`a-${f.nombre}`} titulo={f.nombre}
                segunda={carga(f)}
                riel={<span className="m-hoy-vencida">{f.dias === 1 ? 'Venció ayer' : `Hace ${f.dias} días`}</span>}
                leading={<span className="m-hoy-alerta" data-nivel="rojo" aria-label="Atrasado" />} />
            ))}
            {p.alertas.proyectosPorVencer.map((f) => (
              <FilaM key={`v-${f.nombre}`} titulo={f.nombre}
                segunda={carga(f)}
                riel={f.dias === 0 ? 'Vence hoy' : f.dias === 1 ? 'Vence mañana' : `En ${f.dias} días`}
                leading={<span className="m-hoy-alerta" data-nivel="ambar" aria-label="Por vencer" />} />
            ))}
          </div>
        </SeccionM>
      )}

      {conVencimientos && borradores === null && <NoPude que="los borradores" />}
      {borradores && borradores.length > 0 && (
        <SeccionM titulo="Para confirmar">
          <div className="m-lista">
            {borradores.map((b) => (
              <FilaM key={b.id} titulo={b.titulo}
                segunda={[b.tareas ? `${b.tareas} ${b.tareas === 1 ? 'tarea' : 'tareas'}` : null, b.cierres ? `${b.cierres} para cerrar` : null].filter(Boolean).join(' · ') || undefined}
                href="/m/inbox" />
            ))}
          </div>
        </SeccionM>
      )}
    </>
  );
}
