// =============================================================================
// /crm — CRM (rediseño Marketing OS): Kanban + Tabla + ficha en modal
// =============================================================================

import { listLeadsDeFunnel, type Lead } from '@/lib/leads';
// DEFAULT en las dos: el board pinta las COLUMNAS del negocio (la etapa de cada lead
// se deriva de sus propias columnas con deriveStageKey, no del funnel).
import { getPipelineStagesDefault, getFunnelTransitionsDefault, getFunnelDe, listarFunnels } from '@/lib/funnels';
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

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ funnel?: string; embudo?: string }> }) {
  // Qué funnel dibuja el tablero. Va por la URL y no por estado del cliente: las
  // etapas se leen en el server, así que cambiar de funnel es cambiar de página.
  const sp = await searchParams;
  const funnelPedido = Number(sp?.funnel);
  // ⚠️ `?embudo=` ABRE EL POP-UP AL ENTRAR, y existe para que un link pueda llevar a una
  // CONFIGURACIÓN y no sólo a una pantalla. Lo usan el panel de tracking que ve el
  // cliente en su landing («activar la landing como entrada de leads» → la subtab «Cómo
  // entran») y el cerebro. Sin esto, el link deja a la persona en el tablero buscando
  // un menú que no sabe que existe.
  const abrirEmbudo = sp?.embudo === 'entradas' ? 'entradas' : sp?.embudo ? 'etapas' : null;
  const funnelPideId = Number.isInteger(funnelPedido) && funnelPedido > 0 ? funnelPedido : null;
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
  let leads: Lead[] = [];
  let campMap: Record<string, string> = {};
  let juntasRaw: JuntaProxima[] = [];
  let pendientesRaw: PendienteItem[] = [];
  // Por qué la lista de pendientes puede no ser completa ('' = está entera). El
  // `.catch(() => [])` de abajo convertía CUALQUIER falla en una lista vacía, y la
  // pantalla la celebraba con "✓ Todo marcado — datos al día": el peor final
  // posible para el worklist, porque el usuario deja de mirar.
  let pendientesAviso = '';
  let stages: Awaited<ReturnType<typeof getPipelineStagesDefault>> | undefined;
  let transitions: FunnelTransition[] = generateFunnel(DEFAULT_PIPELINE).transitions;
  let errorMsg: string | null = null;
  let calendlyStages: string[] = [];
  let equipo: MiembroEquipo[] = [];

  // El id de la URL se valida contra los funnels DE ESTE workspace antes de usarlo,
  // y por eso esta lectura no entra en la ola de abajo: lo que se pide depende de
  // su resultado. `getFunnelDe` ya va por `getTenantDb`, así que un id ajeno no
  // devuelve datos de nadie — devuelve `sin-fila`, o sea el pipeline GENÉRICO. Ahí
  // está el problema que esto cierra: el tablero se dibujaría con el genérico
  // mientras el desplegable, que no encuentra ese id, muestra el del negocio. Dos
  // superficies contando cosas distintas del mismo tablero. Con un id que no es de
  // acá se ignora el parámetro y se dibuja el del negocio, que es lo que el
  // desplegable va a decir.
  //
  // "Hoy" en la zona del WORKSPACE, no en Tijuana fija. Este `hoy` gobierna el
  // `min` del selector de fecha, los chips de reagendado y el guard de "esa fecha
  // ya pasó" — y del otro lado /api/crm/horarios filtra los horarios pasados en la
  // zona del workspace. Con las dos mitades en zonas distintas, un negocio en
  // Madrid podía elegir a las 03:00 un día que para el server ya estaba vencido.
  //
  // ⚠️ VA EN LA MISMA OLA QUE «hoy»: no se necesitan entre sí, y en fila eran dos
  // viajes antes de empezar a leer los leads.
  const [hoy, funnels] = await Promise.all([hoyEnWorkspace(), listarFunnels().catch(() => [])]);
  const funnelId = funnels.some((f) => f.id === funnelPideId && !f.esDefault) ? funnelPideId : null;

  // ⚠️ Estas dos NO dependen de los leads, y hasta el 27/09/2026 se esperaban
  // DESPUÉS de la ola: eran la segunda y la tercera pasada de una carga que ya
  // había terminado de leer todo lo que importa. Se arrancan acá y se esperan
  // adentro del `Promise.all`, así que cuestan cero.
  //
  // Qué etapas se agendan por Calendly EN ESTE workspace. Se decide acá y no en
  // el bundle: hasta el 13/08/2026 la lista era una constante de cliente con la
  // agenda del dueño adentro, así que el CRM de cualquier clienta ofrecía
  // reservar en el calendario de otra persona. Se mira si el cliente tiene
  // cargado el event type de esa reunión (lectura barata, sin pegarle a
  // Calendly); la URL real la resuelve `linkDeAgendaAction` al hacer click.
  const pCalendly = Promise.all(
    [['agenda', 'CALENDLY_EVENT_TYPE_J1'], ['agendaj2', 'CALENDLY_EVENT_TYPE_J2']].map(
      async ([stage, clave]) => ((await credWs(clave).catch(() => null))?.trim() ? stage : null),
    ),
  ).then((r) => r.filter((x): x is string => Boolean(x)));
  const pEquipo = getEquipoAction().catch(() => [] as MiembroEquipo[]);

  try {
    // Las etapas van en la misma ola (antes serializaban al frente).
    let stagesRaw: Awaited<ReturnType<typeof getPipelineStagesDefault>> | undefined;
    let transitionsRaw: FunnelTransition[] | undefined;
    let pendRaw: { items: PendienteItem[]; aviso: string };
    [leads, campMap, juntasRaw, pendRaw, stagesRaw, transitionsRaw, calendlyStages, equipo] = await Promise.all([
      // ⚠️ LOS LEADS DE ESTE FUNNEL, no los del workspace. Sin esto el selector cambiaba
      // las COLUMNAS y dejaba las mismas tarjetas: se reportó tres veces como «creé un
      // producto nuevo y no cambió absolutamente nada, los mismos leads».
      //
      // `funnelId` es null para el funnel del NEGOCIO, y ahí se piden los que no tienen
      // funnel asignado — que hoy son todos. Un funnel secundario recién creado arranca
      // sin ninguno.
      listLeadsDeFunnel(funnelId),
      getCampaignNameMap().catch(() => ({}) as Record<string, string>),
      getJuntasProximas(hoy, 3).catch(() => [] as JuntaProxima[]),
      getPendientesDeMarcar(hoy)
        .then((p) => ({ items: p.items, aviso: p.aviso ?? '' }))
        // La lista vacía se sigue devolviendo (el CRM no se cae por el worklist),
        // pero ahora VIENE DICHO que no se pudo calcular.
        .catch((e) => ({ items: [] as PendienteItem[], aviso: `No se pudieron calcular los datos sin marcar: ${e instanceof Error ? e.message : String(e)}` })),
      // Con ?funnel= manda ese; sin él, el del negocio. Mismo dato, otra fila.
      (funnelId ? getFunnelDe(funnelId).then((f) => f.stages) : getPipelineStagesDefault()).catch(() => undefined),
      (funnelId ? getFunnelDe(funnelId).then((f) => f.transitions) : getFunnelTransitionsDefault()).catch(() => undefined),
      pCalendly,
      pEquipo,
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

  // ⚠️ LAS REUNIONES Y EL WORKLIST SE ACOTAN A ESTE FUNNEL. Las dos lecturas de arriba son
  // del workspace entero —no saben de funnels— y sus tarjetas resuelven el TELÉFONO y la
  // EMPRESA contra los leads del tablero. Con el tablero filtrado, una reunión de otro
  // funnel salía con el teléfono en «—» y una fila del worklist con la empresa vacía, sin
  // un solo error; y «Solucionar» sacaba a la persona del tablero para arreglar un lead
  // que este tablero dice que no existe.
  //
  // Se acotan acá y no en las consultas porque las dos las usan otras pantallas que SÍ
  // quieren el negocio entero.
  const idsDelFunnel = new Set(leads.map((l) => l.id));
  juntasRaw = juntasRaw.filter((j) => idsDelFunnel.has(j.lead_id));
  pendientesRaw = pendientesRaw.filter((p) => idsDelFunnel.has(p.lead_id));

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




  return (
    <CrmBoard
      calendlyStages={calendlyStages}
      leads={crmLeads}
      stages={stages}
      funnels={funnels}
      funnelActivo={funnelId}
      abrirEmbudo={abrirEmbudo}
      juntas={juntas}
      marcar={marcar}
      marcarAviso={pendientesAviso}
      transitions={transitions}
      errorMsg={errorMsg}
      hoy={hoy}
      equipo={equipo}
    />
  );
}
