// =============================================================================
// /crm/[id] — detalle del lead en tabs: Resumen / Tracking / Reuniones / …
// =============================================================================
// Header fijo (etapa, nombre, acciones rápidas) + tabs. ⚠️ YA NO HAY MODO EDICIÓN:
// cada dato se corrige donde se lee (ver `app/crm/campo-inline.ts`). `?edit=1` abre
// el editor del DEAL, que es lo único que sigue teniendo pantalla propia.

import { getVideosLanding, landingRecibioEventos } from '@/lib/landing-token';
import { replayDeLead } from '@/lib/replay-leer';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import {
  getLead,
  estadoMadurezLead,
  labelMadurez,
  textoCohorteJ1,
  getVslEngagement,
  getVisitasLandingMap,
  getTrackingEvents,
  getLeadRespuestas,
} from '@/lib/leads';
import { deriveStageKey, stageMeta, DEFAULT_STAGES, nutricionPositivaDe, type Stage } from '@/lib/pipeline';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { getPagosByLead } from '@/lib/pagos';
import { getCampaignNameMap, resolverNombreCampana, getAdNameMap, resolverNombreAd, adIdDeLead } from '@/lib/queries';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { buildJourney } from '@/lib/journey';
import { JourneyTimeline } from '../JourneyTimeline';
import { DealDetailsCard } from './DealDetailsCard';
import { LeadDetailBody, BackButton } from './LeadDetailBody';
import { OrigenCard } from '../lead-view/OrigenCard';
import { InfoPrincipalCard } from '../lead-view/InfoPrincipalCard';
import { NotasCard } from '../lead-view/NotasCard';
import { RespuestasFormulario } from '../lead-view/RespuestasFormulario';
import { MotivoCard, PlazoNutricionCard, leadSalio } from '../lead-view/MotivoYPlazoCard';
import { AuditHistory } from '../lead-view/AuditHistory';
import { ComportamientoCard } from '../lead-view/ComportamientoCard';
// «¿Era calificado?» vive también acá, en Tracking: hay funnels sin reuniones y
// ese dato es el que viaja a Meta. Mismo control y misma columna que en Reuniones.
import { CalificacionCard } from '../lead-view/CalificacionCard';
import { ReunionesCard } from '../lead-view/ReunionesCard';
import { AnalystDelLead } from '../lead-view/AnalystDelLead';
import { ANCHO_FICHA_LEAD, ALTO_CHAT_EN_LA_RUTA } from '../lead-view/ficha-medidas';
import { tieneEtapaDeReunion } from '@/lib/etapa-reunion';
import { verTrackingDeLead } from '@/lib/tracking-ficha-server';
import { getUltimoInsightGenerado, faltantesParaInsights } from '@/lib/lead-insights';
import { respuestasPropias } from '@/lib/meta-leads-campos';
import { faltantesDeLead } from '@/lib/leads';
import { getPipelineStagesDeLead, listarFunnels } from '@/lib/funnels';
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import { urlGravatar } from '@/lib/gravatar';
import { getLeadInsights, getEquipoAction } from '../actions';
import { senalesDeCobroAction } from './cobros-actions';
import { muestraPagos, planEnLead } from '@/lib/muestra-pagos';
import { faltaComprobante } from '@/lib/pago-comprobante';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; edit?: string; solucionar?: string }> }) {
  await requireCapa('crm');
  await guardOnboarding();
  const [{ id: idStr }, { tab, edit, solucionar }] = await Promise.all([params, searchParams]);
  const idNum = Number(idStr);
  if (!Number.isFinite(idNum)) notFound();

  const lead = await getLead(idNum);
  if (!lead) notFound();

  const [vslEng, pagos, campMap, adMap, stagesRaw, visitasMap, insights, trackingEventos, videosLanding, pixelPuesto] = await Promise.all([
    getVslEngagement(lead.visitor_id),
    getPagosByLead(lead.id),
    getCampaignNameMap(),
    getAdNameMap().catch(() => ({} as Record<string, string>)),
    // DEL LEAD: la ficha muestra el recorrido de ESE lead.
    getPipelineStagesDeLead(lead).catch(() => [] as Stage[]),
    getVisitasLandingMap([lead.visitor_id]).catch(() => new Map<string, { total_visitas: number; dias_distintos: number }>()),
    getLeadInsights(idNum),
    getTrackingEvents(lead.visitor_id),
    getVideosLanding(),
  // ¿El Pixel de MaKo está midiendo? Es para el VACÍO de la tarjeta de tracking:
  // sin código pegado, «sin eventos» no es un lead que no interactuó, es un negocio
  // que todavía no mide — y eso se arregla en otra pantalla. Misma señal que el
  // semáforo de /integraciones (1 fila con LIMIT 1 sobre un índice) para que las dos
  // pantallas no puedan contradecirse. Nunca rompe la ficha.
    landingRecibioEventos().catch(() => true),
  ]);

  // La ÚLTIMA actividad —no el alta— porque alguien de marzo que volvió ayer
  // tiene grabación de ayer. La lee `replayDeLead` para explicar un vacío («su
  // última visita es anterior a los días que guardamos»), no para filtrar.
  const ultimaActividad = trackingEventos.length
    ? trackingEventos.map((e) => e.ts).sort().at(-1) ?? null
    : lead.created_at;
  // ⚠️ ACÁ SE GATEABAN LOS LINKS A MICROSOFT CLARITY, y se fueron el 06/10/2026
  // con Clarity entero (ver el mismo comentario en app/crm/actions.ts, que es la
  // otra puerta de esta MISMA ficha). `replayDeLead` no tira nunca.
  const [respuestas, insightGen, equipo, funnels, replay, cobro, verTracking] = await Promise.all([getLeadRespuestas(lead), getUltimoInsightGenerado(lead.id), getEquipoAction(), listarFunnels().catch(() => []), replayDeLead(lead.visitor_id, ultimaActividad), senalesDeCobroAction(lead.id), verTrackingDeLead(lead.funnel_id)]);
  // Los productos para el desplegable de la ficha. Sólo el id, el nombre y si es el del
  // negocio: lo demás no lo necesita la pantalla y bajaría la config entera de cada embudo
  // al navegador.
  // ⚠️ ES LA FOTO, no la respuesta (06/10/2026, mig 0207): con esto el botón se dibuja al
  // toque con el nombre correcto, y EN CUÁLES está el lead —con la etapa de cada uno— lo
  // pide la ficha misma (`useProductosDeLaFicha` → `productosDeLaFichaAction`). Antes el
  // desplegable recibía además `funnelId` y movía; ya no recibe ni una cosa ni la otra.
  // ⚠️ EL NOMBRE DEL PRODUCTO, no el del embudo: el desplegable decía «Funnel principal», que
  // es el nombre que puso la migración y el mismo en todos los workspaces (captura de Martín,
  // 06/10/2026). Mismo criterio que el selector del tablero.
  const productos = funnels.map((f) => ({ id: f.id, nombre: nombreVisible(f), esDefault: f.esDefault }));
  const closerDetectado = insights.find((i) => i.closer?.trim())?.closer ?? null;
  const stages = stagesRaw.length ? stagesRaw : DEFAULT_STAGES;
  const campanaResuelta = resolverNombreCampana(lead.utm_campaign, campMap);
  // El anuncio puede venir por meta_ad_id (instant form), por utm_content numérico
  // o por el NOMBRE en utm_content (Calendly) — adIdDeLead resuelve los tres casos.
  const utmC = lead.utm_content?.trim() || null;
  const adIdCand = adIdDeLead(lead.meta_ad_id, utmC, adMap);
  const adResuelto = resolverNombreAd(adIdCand, lead.meta_ad_name ?? utmC, adMap);
  const visitas = visitasMap.get(lead.visitor_id ?? '') ?? { total_visitas: 0, dias_distintos: 0 };

  const { emoji: _e, label: cohorteLabel, color: cohorteColor } = labelMadurez(estadoMadurezLead(lead));
  void _e;
  const textoJ1 = textoCohorteJ1(lead.fecha_junta_1);

  // Las preguntas propias del formulario de Meta, resueltas en el SERVER: la
  // sección de abajo sólo las dibuja.
  const respuestasForm = respuestasPropias(lead.meta_field_data);
  const stageKey = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const sm = stages.length ? stageMeta(stages, stageKey) : null;

  const journey = buildJourney({
    createdISO: lead.created_at,
    fechaAgenda: lead.fecha_agenda,
    fechaJ1: lead.fecha_junta_1,
    asistioJ1: lead.asistio_j1,
    fechaJ2: lead.fecha_junta_2,
    asistioJ2: lead.asistio_j2,
    fechaConfirmacion: lead.fecha_confirmacion,
    fechaPrimerPago: lead.fecha_primer_pago ?? null,
    fechaCierre: lead.fecha_cierre,
    estadoLead: lead.estado_lead,
    monto: lead.monto_cierre_usd ?? 0,
    hoyISO: new Date().toISOString().slice(0, 10),
    // Las reuniones del recorrido son las etapas `kind: 'reunion'` DE ESTE
    // embudo, con el nombre que les puso el dueño. `stageKey` sólo decide si se
    // dibuja una reunión sin slot (la 3ª en adelante, que no tiene columnas).
    etapas: stages, etapaActual: stageKey,
  });

  // Las dos pestañas que dependen del FUNNEL del lead (su casa), con la MISMA regla que el modal:
  // «Tracking» si su funnel tiene una campaña de Meta asignada (punto 18; `verTracking`, arriba, con
  // la lectura caída da `true`) y «Reuniones» si tiene una etapa de reunión (punto 13).
  const verReuniones = tieneEtapaDeReunion(stages);

  // La tab Pagos: LA MISMA regla que el modal (lib/muestra-pagos.ts), con los mismos datos.
  const verPagos = muestraPagos({ estado: lead.estado_lead, etapa: stageKey, cuotas: pagos.length, planEnLead: planEnLead(lead), ...cobro });

  // "Datos sin marcar": todo lo que la etapa actual adeuda (posible de conseguir). Un cobro confirmado
  // por la pasarela no pide comprobante (lib/pago-comprobante.ts).
  const comprobantesFaltantes = pagos.filter(faltaComprobante).length;
  const faltantes = faltantesDeLead(lead, pagos.length > 0 ? true : undefined, { comprobantesFaltantes, r2RespuestasOk: respuestas.R2.length > 0, pipeline: stages });
  const cuotasPendientes = pagos.filter((p) => !p.pagado).length;
  // Nutrición positiva (derivada): el lead avanza y está en su ventana informativa.
  const nutriPos = nutricionPositivaDe(lead, new Date().toISOString().slice(0, 10));

  return (
    <main className="crm-hover" style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", padding: 'clamp(20px,4vw,44px)' }}>
      {/* El mismo ancho que el pop-up del tablero (punto 14, lead-view/ficha-medidas.ts): es la misma
          ficha por otra puerta. */}
      <div style={{ maxWidth: ANCHO_FICHA_LEAD, margin: '0 auto' }}>
        <BackButton />
        {/* HEADER (nombre + chip + Editar) y tabs viven en LeadDetailBody; la
            cohorte pasó adentro de Información principal. */}
        <LeadDetailBody
          lead={lead}
          stages={stages}
          pagos={pagos}
          initialTab={tab}
          initialEdit={edit === '1'}
          initialSolucionar={solucionar === '1'}
          nombre={lead.nombre}
          stageLabel={sm?.label ?? lead.estado_lead}
          faltantes={faltantes}
          equipo={equipo}
          productos={productos}
          fotoEmail={lead.email?.trim() ? urlGravatar(lead.email, 160) : null}
          tabs={[
            {
              // ⚠️ ESTA PANTALLA ES LA MISMA FICHA QUE EL MODAL, y hasta el 27/09/2026
              // se había quedado con las pestañas VIEJAS: en inglés, con «Notas» y «Chat»
              // —las dos que la tanda 2 sacó— y con «Deal Details» dibujándose siempre
              // aunque no tenga nada adentro. Las tres filas estaban marcadas como
              // aplicadas en /admin/friccion y lo estaban SOLO en `LeadSheet.tsx`.
              //
              // No es una pantalla muerta: se llega desde el WhatsApp que avisa de un
              // lead nuevo de la landing (`app/api/track/optin/route.ts`), desde el
              // Closing Analyst y desde «Solucionar» de la propia ficha. O sea que el
              // cliente que sigue ese link ve la versión anterior del producto.
              key: 'resumen', label: 'Resumen',
              content: (
                <>
                  {nutriPos && (
                    <section style={{ ...card, borderColor: '#BFE6CD', background: 'var(--good-bg)' }}>
                      <div style={{ ...sectLabel, color: 'var(--good)', marginBottom: 6 }}>Nutrición {nutriPos.tipo === 'post-agenda' ? 'Post Agenda' : 'Post Reunión R1'}</div>
                      <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>Va bien: su {nutriPos.tipo === 'post-agenda' ? 'Reunión 1' : 'Reunión 2'} es el <b>{fmtDDMMYYYY(nutriPos.hasta)}</b> ({nutriPos.dias === 0 ? 'hoy' : `en ${nutriPos.dias} día${nutriPos.dias === 1 ? '' : 's'}`}).</p>
                    </section>
                  )}
                  <InfoPrincipalCard
                    leadId={lead.id}
                    nombre={lead.nombre}
                    empresa={lead.empresa}
                    email={lead.email}
                    telefono={lead.telefono}
                    web={lead.web ?? null}
                    cohorte={lead.fecha_junta_1 ? { label: cohorteLabel, color: cohorteColor, texto: textoJ1 } : null}
                    // Mig 0258 (12/10/2026): el ingreso estimado (punto 21) y el Instagram (punto 28).
                    ingresoEstimado={lead.ingreso_estimado ?? null}
                    instagram={lead.instagram ?? null}
                  />
                  {/* ⚠️ Las notas NO son una pestaña: son parte de lo que mirás del
                      lead. Como pestaña propia se escribieron 4 en toda la base — no
                      porque no sirvan, sino porque escribir una costaba un viaje a otro
                      lado. Acá abajo del resumen están a la vista, que es donde se usan.

                      Se sacaron de la ruta el 27/09 junto con la pestaña, y volvieron
                      SOLO al modal: quien entra por el link del WhatsApp de la landing
                      se quedó sin notas. Es la misma trampa de las pestañas en inglés. */}
                  {/* LO QUE LA PERSONA CONTESTÓ EN EL FORMULARIO DEL ANUNCIO.
                      Pedido de Martín (05/10): «hay un cliente de Código Inmobiliario
                      que está corriendo campañas de formulario y hace esas preguntas…
                      no lo estamos guardando en el detalle del CRM».

                      ⚠️ GUARDAR YA SE GUARDABA: `leads.meta_field_data` existe desde la
                      mig 0187 y el webhook la escribe. Lo que faltaba era LEERLA — cero
                      lectores en toda la pantalla. Es la diferencia entre «no llegó» y
                      «lo tenemos y no lo mostramos», y desde afuera se ven igual.

                      Sólo las preguntas PROPIAS del formulario: nombre, email, teléfono y
                      empresa ya están arriba con su rótulo. Y no se dibuja nada cuando no
                      hay — un bloque vacío diciendo «sin respuestas» sobre un lead que no
                      vino de un formulario es ruido fijo.

                      La pieza es la MISMA que dibuja el pop-up del tablero (07/10/2026):
                      lead-view/RespuestasFormulario.tsx. */}
                  <RespuestasFormulario respuestas={respuestasForm} />
                  <NotasCard leadId={lead.id} />
                  {/* ⚠️ LAS MISMAS DOS TARJETAS QUE EL MODAL, y acá es la primera vez
                      que aparecen: el motivo de salida no se veía en esta ruta ni de
                      lectura, y el plazo de la nutrición manual en ninguna de las dos.
                      Eran los últimos dos campos que sólo se podían tocar desde
                      «Editar lead →». */}
                  {leadSalio(lead.estado_lead) && <MotivoCard leadId={lead.id} motivo={lead.motivo_perdida} />}
                  {stageKey === 'manual' && <PlazoNutricionCard leadId={lead.id} deadline={lead.nutricion_manual_deadline ?? null} />}
                </>
              ),
            },
            // ⚠️ SÓLO SI EL FUNNEL DEL LEAD TIENE UNA CAMPAÑA DE META ASIGNADA (punto 18, 12/10/2026:
            // «La tab de "Tracking" recién debería salir si configuré una campaña vinculado a ese
            // funnel, sino que no aparezca»). Igual que el modal.
            ...(verTracking ? [{
              key: 'comportamiento', label: 'Tracking',
              // ⚠️ EL ORDEN LO DECIDIÓ MARTÍN, textual (05/10/2026): «la primera sección debe
              // ser "Origen del lead" y luego "Comportamiento" y por ultimo "Actividad
              // registrada"». La noche anterior estaba al revés —Comportamiento primero y
              // Origen al fondo— con una medición de píxeles como argumento (Origen ocupa
              // ~320 px y empujaba el recorrido a 601 px del tope, sobre 583 visibles). La
              // medición era cierta y contestaba otra pregunta: es su pantalla y la lee como
              // una frase, de dónde vino → qué hizo → evento por evento.
              //
              // «Actividad registrada» NO se monta acá: va adentro de ComportamientoCard.
              // Lo fija `tests/crm-tracking-ficha.test.ts`.
              //
              // ⚠️ Y ESTE MONTAJE Y EL DE `app/crm/LeadSheet.tsx` TIENEN QUE QUEDAR IGUALES:
              // es la MISMA ficha por dos puertas, y ya se pagó que una se quedara con la
              // versión anterior.
              content: (
                <>
                  <OrigenCard lead={lead} vslEng={vslEng} campana={campanaResuelta} adNombre={adResuelto} adId={adIdCand} />
                  <CalificacionCard lead={lead} />
                  <ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct} tieneVisitor={!!lead.visitor_id} porVideo={vslEng.porVideo} videos={videosLanding} eventos={trackingEventos} pixelPuesto={pixelPuesto} replay={replay} />
                </>
              ),
            }] : []),
            // ⚠️ SÓLO SI EL FUNNEL TIENE UNA ETAPA DE REUNIÓN (punto 13), igual que el modal.
            ...(verReuniones ? [{ key: 'reuniones', label: 'Reuniones', content: <ReunionesCard lead={lead} respuestas={respuestas} equipo={equipo} closerDetectado={closerDetectado} /> }] : []),
            // ⚠️ SOLO CUANDO TIENE ALGO ADENTRO, igual que en el modal. En 1.124 de los
            // 1.138 leads esta pestaña no decía más que «está vacía»: una pestaña cuyo
            // único contenido es avisar que no hay contenido se abre una vez y no se
            // abre nunca más, pero todos los días ocupa lugar y hace dudar de si falta
            // algo. Con pagos cargados vuelve sola, con todo lo de siempre. Y con una pasarela
            // conectada también está en el lead que todavía no compró: ahí vive «Cobrar con link».
            ...(verPagos ? [{ key: 'cobranza', label: 'Pagos', badge: cuotasPendientes, content: <DealDetailsCard lead={lead} pagos={pagos} /> }] : []),
            // Análisis va pegado a Historial: las dos contestan «qué pasó con esta
            // persona» —una lo interpreta, la otra lo registra— y se leen seguidas.
            //
            // ⚠️ DESDE EL 12/10/2026 SE LLAMA «MaKo Analyst» Y ES UN CHAT atado a este lead (punto 19),
            // con el análisis de las llamadas debajo, plegado y sólo si hay algo. La MISMA pieza que el
            // modal (lead-view/AnalystDelLead.tsx). La `key` no cambia: viaja en los links (`?tab=`).
            {
              key: 'insights', label: 'MaKo Analyst',
              content: (
                <AnalystDelLead
                  lead={lead}
                  stages={stages}
                  tienePlan={pagos.length > 0}
                  inicial={insightGen}
                  faltantesIniciales={faltantesParaInsights(lead, pagos.length > 0, stages)}
                  llamadas={insights.map((i) => ({ tipo: i.tipo, fecha: i.started_at, url: i.share_url }))}
                  alto={ALTO_CHAT_EN_LA_RUTA}
                />
              ),
            },
            // El recorrido se mudó acá desde el Resumen: junto al registro de cambios,
            // que es la otra mitad de «qué pasó». Igual que en el modal.
            {
              key: 'actividad', label: 'Historial',
              content: (
                <>
                  <section style={card}>
                    <div style={{ ...sectLabel, marginBottom: 16 }}>Recorrido del lead</div>
                    <JourneyTimeline steps={journey} />
                  </section>
                  <AuditHistory leadId={lead.id} stages={stages} />
                </>
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
