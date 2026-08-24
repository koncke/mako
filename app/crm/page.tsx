// =============================================================================
// /crm — CRM (rediseño Marketing OS): Kanban + Tabla + ficha en modal
// =============================================================================

import { listLeads, getPipelineStages, getFunnelTransitions, type Lead } from '@/lib/leads';
import { generateFunnel, DEFAULT_PIPELINE, type FunnelTransition } from '@/lib/pipeline';
import {
  getCampaignNameMap,
  getJuntasProximas,
  getPendientesDeMarcar,
  type JuntaProxima,
  type PendienteItem,
} from '@/lib/queries';
import { hoyEnWorkspace } from '@/lib/timezone';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { integracionConectada } from '@/lib/credenciales';
import { PanelActivacion } from '../_components/PanelActivacion';
import { tabActivacion } from '@/lib/tab-activacion';
import { credWs } from '@/lib/credenciales';
import { CrmBoard, type CrmLead, type CrmJunta, type CrmMarcar } from './CrmBoard';
import { mapToCrmLead } from './crm-map';
import { getEquipoAction, type MiembroEquipo } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Los server actions de esta página heredan este techo (route segment config).
// Reagendar es el más caro de todos: escribe el CRM y DESPUÉS habla con Google
// (refresh del token + buscar el evento + moverlo, hasta ~28s en el peor caso).
// Con el default corto, el corte llegaba con la fila YA guardada y el usuario
// veía "No se pudo reagendar" en rojo sobre algo que sí se hizo, y reagendaba
// dos veces.
export const maxDuration = 60;

export default async function LeadsPage() {
  await requireCapa('crm');

  // Sin NINGUNA fuente de leads el Kanban es una bienvenida muerta, y encima es
  // la primera tab de todos los roles (FALLBACK de tab-access).
  const tabCrm = tabActivacion('crm');
  // ⚠️ Cal.com cuenta como fuente de leads. Sin esto, a un cliente que vende por
  // Cal.com —y cuyas reservas SÍ entran al CRM— se le escondía el Kanban entero
  // detrás de un panel de activación que le pedía conectar otra cosa.
  if (tabCrm && !(await integracionConectada('calendly')) && !(await integracionConectada('calcom')) && !(await integracionConectada('meta'))) {
    return <PanelActivacion tab={tabCrm} />;
  }
  await guardOnboarding();
  // "Hoy" en la zona del WORKSPACE, no en Tijuana fija. Este `hoy` gobierna el
  // `min` del selector de fecha, los chips de reagendado y el guard de "esa fecha
  // ya pasó" — y del otro lado /api/crm/horarios filtra los horarios pasados en la
  // zona del workspace. Con las dos mitades en zonas distintas, un negocio en
  // Madrid podía elegir a las 03:00 un día que para el server ya estaba vencido.
  const hoy = await hoyEnWorkspace();

  let leads: Lead[] = [];
  let campMap: Record<string, string> = {};
  let juntasRaw: JuntaProxima[] = [];
  let pendientesRaw: PendienteItem[] = [];
  // Por qué la lista de pendientes puede no ser completa ('' = está entera). El
  // `.catch(() => [])` de abajo convertía CUALQUIER falla en una lista vacía, y la
  // pantalla la celebraba con "✓ Todo marcado — datos al día": el peor final
  // posible para el worklist, porque el usuario deja de mirar.
  let pendientesAviso = '';
  let stages: Awaited<ReturnType<typeof getPipelineStages>> | undefined;
  let transitions: FunnelTransition[] = generateFunnel(DEFAULT_PIPELINE).transitions;
  let errorMsg: string | null = null;

  try {
    // getPipelineStages ahora va en la misma ola (antes serializaba al frente).
    let stagesRaw: Awaited<ReturnType<typeof getPipelineStages>> | undefined;
    let transitionsRaw: FunnelTransition[] | undefined;
    let pendRaw: { items: PendienteItem[]; aviso: string };
    [leads, campMap, juntasRaw, pendRaw, stagesRaw, transitionsRaw] = await Promise.all([
      listLeads(),
      getCampaignNameMap().catch(() => ({}) as Record<string, string>),
      getJuntasProximas(hoy, 3).catch(() => [] as JuntaProxima[]),
      getPendientesDeMarcar(hoy)
        .then((p) => ({ items: p.items, aviso: p.aviso ?? '' }))
        // La lista vacía se sigue devolviendo (el CRM no se cae por el worklist),
        // pero ahora VIENE DICHO que no se pudo calcular.
        .catch((e) => ({ items: [] as PendienteItem[], aviso: `No se pudieron calcular los datos sin marcar: ${e instanceof Error ? e.message : String(e)}` })),
      getPipelineStages().catch(() => undefined),
      getFunnelTransitions().catch(() => undefined),
    ]);
    pendientesRaw = pendRaw.items;
    pendientesAviso = pendRaw.aviso;
    stages = stagesRaw;
    if (transitionsRaw) transitions = transitionsRaw;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }
  if (!stages) {
    stages = generateFunnel(DEFAULT_PIPELINE).stages;
  }

  const telById = new Map(leads.map((l) => [l.id, l.telefono]));

  const validStageKeys = new Set(stages.map((s) => s.key));
  const crmLeads: CrmLead[] = leads.map((l) => mapToCrmLead(l, campMap, validStageKeys));

  const juntas: CrmJunta[] = juntasRaw.map((j) => ({
    id: `${j.lead_id}-${j.tipo}`,
    leadId: j.lead_id,
    when: `${j.tipo === 'J1' ? 'R1' : 'R2'} · ${j.dia}`,
    warn: j.vsl_estado === 'sin_ver',
    warnText: 'agendó sin ver el VSL',
    name: j.nombre,
    company: j.empresa ?? 'Sin empresa',
    phone: telById.get(j.lead_id) ?? '—',
    goal: j.respuestas.objetivo ?? '—',
  }));

  const marcar: CrmMarcar[] = pendientesRaw.map((p) => ({
    id: `${p.lead_id}-${p.tipo}`,
    leadId: p.lead_id,
    name: p.lead_nombre,
    company: crmLeads.find((c) => c.id === p.lead_id)?.company ?? '',
    message: p.mensaje,
    tipo: p.tipo,
    soloEdit: p.soloEdit,
    solTab: p.solTab,
    faltantes: p.faltantes,
    cual: p.cual,
    etapa: p.etapa,
  }));

  const equipo = await getEquipoAction().catch(() => [] as MiembroEquipo[]);

  // Qué etapas se agendan por Calendly EN ESTE workspace. Se decide acá y no en
  // el bundle: hasta el 13/08/2026 la lista era una constante de cliente con la
  // agenda del dueño adentro, así que el CRM de cualquier clienta ofrecía
  // reservar en el calendario de otra persona. Se mira si el cliente tiene
  // cargado el event type de esa reunión (lectura barata, sin pegarle a
  // Calendly); la URL real la resuelve `linkDeAgendaAction` al hacer click.
  const calendlyStages: string[] = (
    await Promise.all(
      [['agenda', 'CALENDLY_EVENT_TYPE_J1'], ['agendaj2', 'CALENDLY_EVENT_TYPE_J2']].map(
        async ([stage, clave]) => ((await credWs(clave).catch(() => null))?.trim() ? stage : null),
      ),
    )
  ).filter((s): s is string => Boolean(s));

  return (
    <CrmBoard
      calendlyStages={calendlyStages}
      leads={crmLeads}
      stages={stages}
      juntas={juntas}
      marcar={marcar}
      marcarAviso={pendientesAviso}
      transitions={transitions}
      total={leads.length}
      errorMsg={errorMsg}
      hoy={hoy}
      equipo={equipo}
    />
  );
}
