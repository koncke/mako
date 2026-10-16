'use client';

// =============================================================================
// LeadSheet — ficha del lead en modal, organizada en tabs
// =============================================================================
// ⚠️ YA NO ES UN PREVIEW DE SOLO LECTURA, y por eso no tiene botón de editar: cada
// dato se corrige donde se lee (ver `app/crm/campo-inline.ts`). El «Editar lead →»
// que vivía en el pie se fue el 05/10/2026. Lo que todavía tiene pantalla aparte es
// el DEAL, con su entrada en la tab Pagos. Los movimientos del Kanban que exigen
// datos usan su propio pop-up chico (StageMoveDialog), no esta ficha.

import Link from '@/app/_ui/Link';
import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { deriveStageKey, stageMeta, nutricionPositivaDe, type Stage } from '@/lib/pipeline';
import { tieneEtapaDeReunion } from '@/lib/etapa-reunion';
import { DatosSinMarcarCard } from './lead-view/DatosSinMarcarCard';
import { AvisosDatosModal } from './lead-view/AvisosDatosModal';
import { Senalar } from '@/app/_ui/Senalar';
import { TAB_DE_DATO, marcaDato } from '@/lib/datos-aviso';
import type { StepId } from '@/lib/stage-requirements';
import { buildJourney } from '@/lib/journey';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { deleteLeadInlineAction, getLeadFullAction, type LeadFullData } from './actions';
import { StageMoveDialog, type MoveLeadInfo } from './StageMoveDialog';
import { MoverEtapaConfirm } from './MoverEtapaConfirm';
import { pideWizardAlElegir } from './mover-etapa';
import type { FathomLink } from '@/lib/leads';
import { suscripcionDeFila } from '@/lib/venta-tipo';
import { muestraPagos, planEnLead, tieneDeal } from '@/lib/muestra-pagos';
import { JourneyTimeline } from './JourneyTimeline';
import { OrigenCard } from './lead-view/OrigenCard';
import { InfoPrincipalCard } from './lead-view/InfoPrincipalCard';
import { CabeceraLead } from './lead-view/CabeceraLead';
import { FunnelYEtapa, useProductosDeLaFicha } from './lead-view/ProductoDelLead';
import { AnalystDelLead } from './lead-view/AnalystDelLead';
import { ANCHO_FICHA_LEAD, ALTO_CHAT_EN_EL_POPUP, ALTO_FICHA_LEAD, MARGEN_FICHA_LEAD } from './lead-view/ficha-medidas';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { AuditHistory } from './lead-view/AuditHistory';
import { ComportamientoCard } from './lead-view/ComportamientoCard';
// «¿Era calificado?» vive también acá, en Tracking: hay funnels sin reuniones y
// ese dato es el que viaja a Meta. Mismo control y misma columna que en Reuniones.
import { CalificacionCard } from './lead-view/CalificacionCard';
import { ReunionesCard } from './lead-view/ReunionesCard';
import { DealDetailsCard } from './[id]/DealDetailsCard';
import { OfertaDelLead } from './lead-view/OfertaDelLead';
import { LeadTabs } from './lead-view/LeadTabs';
import { NotasCard } from './lead-view/NotasCard';
import { RespuestasFormulario } from './lead-view/RespuestasFormulario';
import { seVe } from '@/lib/resumen-ficha';
import { MotivoCard, PlazoNutricionCard, leadSalio } from './lead-view/MotivoYPlazoCard';
import { ConfirmDialog } from '../components/ConfirmDialog';

import { profundidadModales } from '@/app/_components/pila-modales';
import { FichaCambioProvider } from './lead-view/ficha-cambio';
import { EtiquetasDelLead, versionDeEtiquetas } from './lead-view/EtiquetasDelLead';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

export function LeadSheet({ data, onClose, initialTab, solucionarAlAbrir }: {
  data: LeadFullData; onClose: () => void; initialTab?: string;
  /** Abrir llevando a ese dato sin marcar («A revisar» del CRM, 13/10/2026). Se aplica UNA vez. */
  solucionarAlAbrir?: StepId;
}) {
  // ⚠️ LA FICHA SE RELEE CUANDO CAMBIA LA CASA DEL LEAD. Sus datos los trajo una action al abrir
  // (LeadEditModal) y el `router.refresh()` no los toca: si desde el desplegable de productos se
  // quita la casa, la etapa, las etapas y el chip de acá serían los del producto anterior. Sólo
  // vale mientras sea el MISMO lead: si la ficha pasa a mostrar otro, mandan sus datos.
  const [fresca, setFresca] = useState<LeadFullData | null>(null);
  const vigente = fresca && fresca.lead.id === data.lead.id ? fresca : data;
  const { lead, stages, pagos, vslEng, campana, adNombre, adId, visitas, insights, tracking, pixelPuesto, respuestas, respuestasForm, respuestasLanding, resumen, cohorte, insightGen, faltantesInsight, faltantes, datos, equipo, closerDetectado, videos: videosLanding, replay, productos, fotoEmail } = vigente;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  // En qué productos está y cuál se mira (ver lead-view/ProductoDelLead.tsx). La etapa de la fila
  // de controles es la del producto EN VISTA: la de la casa, o la de su fila en un producto agregado.
  // ⚠️ Y SE RELEE DESPUÉS DE CADA COSA QUE ESCRIBE, no sólo al cambiar la casa (08/10/2026). Con la
  // foto vieja, «Solucionar» abría «Completar datos» con la etapa de ANTES de moverlo, y su Guardar
  // devolvía al lead a esa etapa: en el CRM de Leila (ws11) el #2608 volvió tres veces de
  // «Conversación abierta» a «Contacto nuevo», y el #2605 perdió el Ganado 25 minutos. Las tarjetas
  // avisan por `useRefrescarFicha` (lead-view/ficha-cambio.tsx); los botones de mover, acá abajo.
  const releer = useCallback(() => {
    void getLeadFullAction(lead.id).then((x) => { if (x) setFresca(x); }).catch(() => {});
  }, [lead.id]);
  const fichaProd = useProductosDeLaFicha({
    leadId: lead.id, casa: lead.funnel_id, foto: productos,
    onCasaCambiada: releer,
  });

  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // a11y de diálogo: ESC, foco al panel, focus-trap básico, scroll-lock.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevActive = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Escape cierra la ficha SOLO si no hay nada encima. Esto escucha en fase de
      // CAPTURA sobre window, o sea que corre ANTES que cualquier diálogo anidado —
      // el `stopPropagation` de acá abajo no lo evita, porque para cuando corre ya
      // ganó—. Resultado hasta el 27/09: Escape adentro de un wizard o de una
      // confirmación cerraba la ficha entera con lo que estuvieras escribiendo.
      if (e.key === 'Escape' && !e.isComposing) {
        if (profundidadModales() > 0) return; // lo cierra el de arriba
        e.stopPropagation(); onCloseRef.current(); return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, []);

  const stageKey = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);
  const sm: Stage | undefined = stageMeta(stages, stageKey);
  const monto = lead.monto_cierre_usd ?? 0;

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
    monto,
    hoyISO: new Date().toISOString().slice(0, 10),
    // Las reuniones del recorrido son las etapas `kind: 'reunion'` DE ESTE
    // embudo, con el nombre que les puso el dueño. `stageKey` sólo decide si se
    // dibuja una reunión sin slot (la 3ª en adelante, que no tiene columnas).
    etapas: stages, etapaActual: stageKey,
  });

  // Cambiar etapa desde el header (el desplegable del funnel, a la derecha). `moveTo` abre el
  // wizard de datos: solo para las etapas que lo necesitan, y para «Completar ahora».
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const moveInfo: MoveLeadInfo = {
    id: lead.id, name: lead.nombre,
    fechaJ1: lead.fecha_junta_1, fechaJ2: lead.fecha_junta_2,
    asistioJ1: lead.asistio_j1, asistioJ2: lead.asistio_j2, calificado: lead.calificado,
    fathom: (lead.fathom_links ?? []) as FathomLink[],
    monto: lead.monto_cierre_usd ?? null, motivo: lead.motivo_perdida,
    setter: lead.setter ?? null, closer: lead.closer ?? null,
    empresa: lead.empresa ?? null, telefono: lead.telefono ?? null,
    tienePlan: pagos.length > 0,
    sinR1: !!lead.sin_r1, sinR2: !!lead.sin_r2, fathomOmitido: !!lead.fathom_omitido,
    email: lead.email ?? null, tieneContrato: !!lead.contrato_path,
    dealServicioOk: !!lead.deal_servicio?.que_es?.trim(),
    dealPromesaOk: !!lead.deal_promesa?.resultado?.trim(),
    dealFiscalOk: !!lead.deal_fiscal?.razon?.trim(),
    dealObligacionesOk: (lead.deal_obligaciones?.cliente?.length ?? 0) > 0 || (lead.deal_obligaciones?.prestador?.length ?? 0) > 0,
    // El tipo de venta guardado (un becado, #747, no vuelve a ver el paso del monto).
    ventaTipo: lead.venta_tipo ?? null,
    // La mensualidad y el plazo de una suscripción: sin ellos reabrirla pedía el monto
    // vacío, y guardar escribía NULL encima (lib/venta-tipo.ts).
    ...suscripcionDeFila(lead),
  };
  // Elegir otra etapa MUEVE, igual que soltar una card en el tablero (08-T22): se
  // confirma y se guarda, y lo que falta se avisa después sin frenar. Antes abría
  // el wizard con todas las preguntas de la etapa, que es lo que hacía abandonar
  // el CRM. Las etapas de reunión y la nutrición manual sí van al wizard: ahí hay
  // una fecha o un plazo que decidir (ver pideWizardAlElegir).
  const [moverDirecto, setMoverDirecto] = useState<string | null>(null);
  const pickStage = (k: string) => {
    if (!k || k === stageKey) return;
    if (pideWizardAlElegir(stages, k)) setMoveTo(k); else setMoverDirecto(k);
  };

  const doDelete = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      try { await deleteLeadInlineAction(lead.id); router.refresh(); onClose(); }
      catch { setDelErr('No se pudo borrar. Reintenta.'); }
    });
  };

  // ⚠️ «SOLUCIONAR» SE RESUELVE ACÁ ADENTRO, sin salir de la ficha. Pedido textual de
  // Martín (05/10/2026): «el botón de "Solucionar" debería permitirme solucionar allí
  // mismo, sin redirigirme a otra ruta, en el mismo modal».
  //
  // Antes navegaba a `/crm/<id>?solucionar=1` (o a `?edit=1&tab=…`, según qué faltara):
  // cerraba el modal, cargaba otra pantalla, y volver era el botón Atrás. Y el destino
  // no hacía nada que no se pueda hacer acá — en la ruta, «Solucionar» es exactamente
  // `setMoveTo(currentStage)` (`app/crm/[id]/LeadDetailBody.tsx`), o sea el MISMO
  // `StageMoveDialog` que este modal ya monta para cambiar de etapa.
  //
  // ⚠️ NO SE ESCRIBE UNA SEGUNDA ESCRITURA. El wizard es el único que marca los datos
  // del worklist (`completeStageMoveAction`), y `faltantes` —calculado en el server— es
  // su lista autoritativa. Lo que lo convierte en «Completar datos» en vez de un
  // movimiento es que `moveTo` apunte a la etapa ACTUAL, igual que en la ruta.
  const solucionar = () => setMoveTo(stageKey);
  const completandoDatos = moveTo === stageKey;

  // ⚠️ «SOLUCIONAR» UN DATO LLEVA AL DATO, NO ABRE EL ASISTENTE (13/10/2026). Martín: «Elimina
  // completamente el pop-up que salta al darle el botón de "solucionar"... me tiene que redirijir
  // al dato que falta, ya sea cambiando de tab o desplazando a donde está el dato... y marcarse
  // donde falta, como lo hacemos con los tutoriales». Cambia a la tab donde vive su campo
  // (TAB_DE_DATO, lib/datos-aviso.ts) y lo señala (<Senalar>, que busca la marca del campo).
  // El asistente queda SÓLO de respaldo: la tab no está en este lead (un funnel sin reuniones) o
  // el campo no se dibujó (la R2 todavía no existe) — ahí es el único lugar que lo sabe pedir.
  const [irATab, setIrATab] = useState<{ key: string; n: number } | null>(null);
  const [senal, setSenal] = useState<{ id: StepId; label: string } | null>(null);
  const [configAvisos, setConfigAvisos] = useState(false);
  const solucionarDato = (id: StepId) => {
    const tab = TAB_DE_DATO[id];
    const hay = tab === 'resumen' || (tab === 'reuniones' && verReuniones) || (tab === 'cobranza' && verPagos);
    if (!hay) { solucionar(); return; }
    const d = [...(datos?.avisar ?? []), ...(datos?.ocultos ?? [])].find((x) => x.id === id);
    setIrATab({ key: tab, n: Date.now() });
    setSenal({ id, label: d?.label ?? 'este dato' });
  };
  const yaSolucionado = useRef(false);
  useEffect(() => {
    if (!solucionarAlAbrir || yaSolucionado.current) return;
    yaSolucionado.current = true;
    solucionarDato(solucionarAlAbrir);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez, al abrir
  }, [solucionarAlAbrir]);
  // Nutrición positiva (derivada): el lead avanza dentro de su etapa.
  const nutriPos = nutricionPositivaDe(lead, new Date().toISOString().slice(0, 10));

  const tabResumen = (
    <>
      {nutriPos && (
        <section style={{ ...card, borderColor: '#BFE6CD', background: 'var(--good-bg)' }}>
          <div style={{ ...sectLabel, color: 'var(--good)', marginBottom: 6 }}>Nutrición {nutriPos.tipo === 'post-agenda' ? 'Post Agenda' : 'Post Reunión R1'}</div>
          {/* ⚠️ SIN «ventana informativa», que es jerga NUESTRA. Es la fila del plan
              «un cartel que explica jerga nuestra», arreglada el 27/09 en la ruta
              /crm/[id] y no acá. El mismo copy en las dos, y dice lo único que la
              persona necesita: cuándo es y cuánto falta. */}
          <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>Va bien: su {nutriPos.tipo === 'post-agenda' ? 'Reunión 1' : 'Reunión 2'} es el <b>{fmtDDMMYYYY(nutriPos.hasta)}</b> ({nutriPos.dias === 0 ? 'hoy' : `en ${nutriPos.dias} día${nutriPos.dias === 1 ? '' : 's'}`}).</p>
        </section>
      )}
      {/* ⚠️ LA COHORTE LLEGA RESUELTA DEL SERVER (`cohorte`, getLeadFullAction). Hasta el 13/10/2026
          este panel no la dibujaba y la ruta /crm/[id] sí («Cohorte · Madura · 48 días desde R1»):
          quien entraba por el link de WhatsApp veía un dato que el tablero le escondía. No se
          calcula acá porque sale de lib/leads.ts (2.600 líneas con dependencias de servidor) y
          este archivo es 'use client': las dos puertas usan `cohorteDeLead`. */}
      <InfoPrincipalCard leadId={lead.id} nombre={lead.nombre} empresa={lead.empresa} email={lead.email} telefono={lead.telefono} web={lead.web ?? null}
        cohorte={cohorte ?? null} ingresoEstimado={lead.ingreso_estimado ?? null} instagram={lead.instagram ?? null}
        youtube={lead.youtube ?? null} linkedin={lead.linkedin ?? null} direccion={lead.direccion ?? null} sexo={lead.sexo ?? null}
        resumen={resumen ?? {}} />
      {/* Lo que contestó en el formulario de Meta. Hasta el 07/10/2026 sólo lo dibujaba la
          ruta, y el tablero abre ESTE pop-up: en el uso diario no se veía. Las respuestas
          llegan resueltas del server (`respuestasForm`, getLeadFullAction). */}
      {/* ⚠️ «¿ERA CALIFICADO?» VIVE EN RESUMEN DESDE EL 13/10/2026, no en Tracking. Martín: «quiero
          que en esta tab se configure la opción de "¿Era cualificado?" para alimentar a CAPI... Que no
          esté más en tracking». La MISMA tarjeta que la ruta /crm/[id]. */}
      <CalificacionCard lead={lead} />
      {/* Los dos formularios, cada uno si el negocio lo quiere ver (lib/resumen-ficha.ts). */}
      {seVe(resumen, 'form_meta') && <RespuestasFormulario respuestas={respuestasForm ?? []} />}
      {seVe(resumen, 'form_landing') && <RespuestasFormulario respuestas={respuestasLanding ?? []} de="landing" />}
      {/* ⚠️ Las notas NO son una pestaña: son parte de lo que mirás del lead. Como
          pestaña propia se escribieron 4 en toda la base — no porque no sirvan,
          sino porque escribir una costaba un viaje a otro lado. Acá abajo del
          resumen están a la vista, que es donde se usan. */}
      <NotasCard leadId={lead.id} />
      {/* ⚠️ EL MOTIVO Y EL PLAZO SE EDITAN ACÁ, y es lo que terminó de vaciar el botón
          «Editar lead →». Las dos tarjetas son las MISMAS que monta la ruta /crm/[id]:
          es la misma ficha por dos puertas. */}
      {leadSalio(lead.estado_lead) && <MotivoCard leadId={lead.id} motivo={lead.motivo_perdida} />}
      {stageKey === 'manual' && <PlazoNutricionCard leadId={lead.id} deadline={lead.nutricion_manual_deadline ?? null} />}
    </>
  );

  // ⚠️ LA TAB PAGOS SALE DE LA MISMA REGLA QUE LA RUTA /crm/[id] (lib/muestra-pagos.ts), con los
  // mismos datos. Hasta el 11/10/2026 acá se pedía «tiene cuotas» y allá «es venta o tiene plan»: un
  // Ganado sin cuotas tenía Pagos por una puerta y no por la otra. Con una pasarela conectada la tab
  // también está en el lead que todavía no compró: ahí vive «Cobrar con link», y la tarjeta le
  // dibuja sólo los links (sin el deal vacío), por eso «Editar deal →» va sólo cuando hay deal.
  const etapaPagos = { estado: lead.estado_lead, etapa: stageKey, cuotas: pagos.length, planEnLead: planEnLead(lead) };
  const verPagos = muestraPagos({ ...etapaPagos, ...vigente.cobro });
  const tabCobranza = (
    <>
      {/* La OFERTA va primero (13/10/2026, Pagos punto 1): a qué oferta entró, y una nueva desde acá. */}
      <OfertaDelLead leadId={lead.id} funnelId={lead.funnel_id ?? null} onCambio={releer} />
      {/* ⚠️ `onCambio`: acá el lead es estado de cliente (getLeadFullAction), así que el
          refresh de la tarjeta no lo alcanza. Se aplica lo que la action devolvió —el wizard
          de «Completar datos» se arma con ESTE lead— y se relee el resto (los «Datos sin
          marcar» cambian: sin «Sin cobro» vuelve a faltar el monto). */}
      <DealDetailsCard lead={lead} pagos={pagos} onCambio={(patch) => {
        setFresca({ ...vigente, lead: { ...vigente.lead, ...patch } });
        void getLeadFullAction(lead.id).then((x) => { if (x) setFresca(x); }).catch(() => {});
      }} />
      {tieneDeal(etapaPagos) && <Link href={`/crm/${lead.id}?tab=cobranza&edit=1`} style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Editar deal →</Link>}
    </>
  );

  // ⚠️ LAS PESTAÑAS QUE DEPENDEN DEL FUNNEL DEL LEAD (su casa), con la MISMA regla que la ruta
  // /crm/[id]: Tracking si su funnel tiene una campaña de Meta asignada (lo decide el server; sin
  // el dato, se dibuja), y Reuniones si tiene una etapa de reunión.
  const verTracking = vigente.verTracking ?? true;
  const verReuniones = tieneEtapaDeReunion(stages);

  // MaKo Analyst: el chat y, debajo, plegado, el análisis de las llamadas (lead-view/AnalystDelLead.tsx).
  const tabAnalyst = (
    <AnalystDelLead
      lead={lead}
      stages={stages}
      tienePlan={pagos.length > 0}
      inicial={insightGen}
      faltantesIniciales={faltantesInsight}
      llamadas={insights.map((i) => ({ tipo: i.tipo, fecha: i.started_at, url: i.share_url }))}
      alto={ALTO_CHAT_EN_EL_POPUP}
    />
  );

  return (
    <FichaCambioProvider value={releer}>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `${MARGEN_FICHA_LEAD}px clamp(10px,3vw,20px)` }}>
      {/* ⚠️ MÁS ANCHO (punto 14 del 12/10/2026: «bastante más ancho, para aprovechar más el
          espacio»): eran 760. El número vive en lead-view/ficha-medidas.ts, que también lee el
          esqueleto de carga. Sin `aria-labelledby`: el nombre ahora es un campo editable, y un
          diálogo no se nombra con un campo. */}
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={lead.nombre || 'Lead'} onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: ANCHO_FICHA_LEAD, height: ALTO_FICHA_LEAD, maxHeight: ALTO_FICHA_LEAD, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden', outline: 'none' }}>

        {/* ⚠️ LA CABECERA ES LA MISMA PIEZA QUE LA DE LA RUTA (lead-view/CabeceraLead.tsx): la
            portada con la cara del lead cruzándola (punto 11), el nombre que se edita con un clic,
            las ETIQUETAS ARRIBA DEL NOMBRE en el lugar de la pastilla de la etapa (punto 9), y a la
            derecha UN desplegable en árbol —el funnel con sus etapas adentro— ENCIMA de «N sin
            marcar · Solucionar». La cruz va sobre la portada. Queda FIJA: no está adentro del
            cuerpo que scrollea (punto 16).

            Antes eran tres renglones: la cabecera con la etapa en una pastilla, una fila con el
            desplegable de producto y el de la etapa, y otra con las etiquetas. Martín (12/10/2026):
            «Que sea solo 1 desplegable de "PROSPECCIÓN" que es el funnel, y que sea un desplegable
            tipo arbol». */}
        <CabeceraLead
          lead={lead}
          fotoEmail={fotoEmail}
          onCerrar={onClose}
          junto={<EtiquetasDelLead compacto leadId={lead.id} version={versionDeEtiquetas(lead.updated_at, fichaProd.productos)} />}
          acciones={
            <>
              <FunnelYEtapa ficha={fichaProd} etapasCasa={stages} etapaCasa={stageKey} onElegirCasa={pickStage} ariaLabel="Cambiar etapa o funnel" />
              {datos && (
                <DatosSinMarcarCard leadId={lead.id} datos={datos} onSolucionar={solucionarDato}
                  onConfigurar={() => setConfigAvisos(true)} onCambio={releer} />
              )}
            </>
          }
        />

        {/* tabs + cuerpo scrolleable. ⚠️ LA FILA DE PESTAÑAS QUEDA PEGADA ARRIBA de este cuerpo
            (`fija`, punto 16: «las tabs de arriba deben acompañar el scroll. Deben permanecer fijas,
            como todo lo que esta arriba»). Este div es el que scrollea y TIENE ALTO (flex: 1 en un
            panel con el alto topeado), que es lo que un sticky necesita para pegarse. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 clamp(16px,4vw,28px) clamp(14px,4vw,20px)' }}>
          <LeadTabs
            initial={initialTab}
            irA={irATab}
            fija={{ fondo: 'var(--surface)' }}
            tabs={[
              { key: 'resumen', label: 'Resumen', content: tabResumen },
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
              // ⚠️ Y ESTE MONTAJE Y EL DE `app/crm/[id]/page.tsx` TIENEN QUE QUEDAR IGUALES:
              // es la MISMA ficha por dos puertas, y ya se pagó que una se quedara con la
              // versión anterior.
              //
              // ⚠️ Y SÓLO SI EL FUNNEL DEL LEAD TIENE UNA CAMPAÑA DE META ASIGNADA (punto 18, 12/10/2026:
              // «La tab de "Tracking" recién debería salir si configuré una campaña vinculado a ese
              // funnel, sino que no aparezca»). Lo decide el server (`verTracking`, getLeadFullAction →
              // lib/tracking-ficha-server.ts) y con la lectura caída la pestaña SE DIBUJA.
              ...(verTracking ? [{ key: 'comportamiento', label: 'Tracking', content: <><OrigenCard lead={lead} vslEng={vslEng} campana={campana} adNombre={adNombre} adId={adId} /><ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct} tieneVisitor={!!lead.visitor_id} porVideo={vslEng.porVideo} videos={videosLanding} eventos={tracking} pixelPuesto={pixelPuesto} replay={replay} /></> }] : []),
              // ⚠️ SÓLO SI EL FUNNEL TIENE UNA ETAPA DE REUNIÓN (punto 13, 12/10/2026: «Si en mi funnel no
              // tengo ninguna etapa marcada como "reunión" no debería aparecer la tab de "reuniones"»).
              // Marcada, o con un nombre que lo dice («Agenda R1», «Llamada»): `tieneEtapaDeReunion`.
              ...(verReuniones ? [{ key: 'reuniones', label: 'Reuniones', content: <ReunionesCard lead={lead} respuestas={respuestas} equipo={equipo} closerDetectado={closerDetectado} /> }] : []),
              // ⚠️ SOLO CUANDO TIENE ALGO ADENTRO. En 1.124 de 1.138 leads esta
              // pestaña no decía más que «está vacía» —y con tres redacciones
              // distintas—: una pestaña cuyo único contenido es avisar que no hay
              // contenido es una pestaña que se abre una vez y no se abre nunca más,
              // pero que todos los días ocupa lugar y hace dudar de si falta algo.
              // Con pagos cargados vuelve sola, con todo lo de siempre.
              ...(verPagos ? [{ key: 'cobranza', label: 'Pagos', content: tabCobranza, badge: pagos.filter((p) => !p.pagado).length }] : []),
              // ⚠️ ANÁLISIS VA PEGADO A HISTORIAL, y es pedido de Martín («que análisis
              // esté previo al historial», 27/09/2026). Las dos contestan «qué pasó con
              // esta persona» —una lo interpreta, la otra lo registra— así que se leen
              // seguidas; Pagos contesta otra cosa y estaba en el medio.
              //
              // ⚠️ Y DESDE EL 12/10/2026 SE LLAMA «MaKo Analyst» Y ES UN CHAT (punto 19: «Cambia el
              // nombre de la tab "Análisis" por "MaKo Analyst" y replica el chat que tenemos en la tab
              // de "Offer"... un chat con la IA que por defecto tenga atado los datos de ese lead»). La
              // `key` sigue siendo 'insights': es la que viaja en los links (`?tab=`). Lo que mostraba
              // antes (el análisis de las llamadas) queda debajo, PLEGADO, y sólo si hay algo.
              {
                key: 'insights', label: 'MaKo Analyst',
                content: tabAnalyst,
              },
              // ⚠️ EL RECORRIDO SE MUDÓ ACÁ. Estaba arriba de todo en el Resumen, ocupando
              // la primera pantalla con algo que ya pasó — y el Historial, que es
              // justamente «qué pasó», estaba en otra pestaña. Ahora la línea de tiempo
              // y el detalle de cada cambio se leen juntos, que es como se consultan.
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

        {/* footer — ⚠️ SIN «Cerrar» (punto 12, 12/10/2026: «Elimina el botón de "Cerrar" que está
            abajo del modal de un lead, para eso ya tenemos la cruz... Ahí debería estar el botón de
            "Borrar lead" y en rojo»). Es el tacho rojo de la casa (BotonBorrar), con la confirmación
            que nombra la consecuencia. Antes era un texto gris a la izquierda, que no se leía como
            algo irreversible.
            ⚠️ Y ACÁ ESTABA «Editar lead →», que se fue el 05/10/2026 (pedido DOS veces): los 15
            campos que ese formulario editaba se editan en la ficha, cada uno donde se lee. Lo único
            con pantalla propia es el DEAL, y su entrada está en la tab Pagos. */}
        {delErr && <div style={{ padding: '8px clamp(16px,4vw,28px)', color: 'var(--bad)', fontSize: 13, fontWeight: 600, fontFamily: SANS }}>{delErr}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, padding: '12px clamp(16px,4vw,28px)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <BotonBorrar texto="Borrar lead" title={`Borrar a ${lead.nombre || 'este lead'}`} onClick={() => setConfirmDelete(true)} disabled={pending} />
        </div>
      </div>

      {/* ⚠️ EL CLICK NO PUEDE LLEGAR AL BACKDROP DE LA FICHA. Este wizard se monta
          DENTRO del overlay de la ficha, que tiene `onClick={onClose}`: en React los
          eventos suben por el árbol de componentes, así que un click en el fondo del
          wizard (el `padding: 20` alrededor de su panel) cerraba su diálogo Y la ficha
          entera — un portal no lo evita, porque la propagación sigue el árbol de React
          y no el DOM. Da igual cuando mover de etapa cierra la ficha de todos modos, y
          deja de dar igual con «Completar datos», donde la ficha tiene que quedar.
          Es el gemelo por CLICK del Escape que `profundidadModales()` ya resuelve. */}
      {senal && (
        <Senalar objetivo={marcaDato(senal.id)} texto={`Falta: ${senal.label}`}
          onCerrar={() => setSenal(null)} onNoEsta={solucionar} />
      )}
      {/* Envuelto por lo mismo que el wizard de abajo: un clic adentro no puede llegar al fondo de
          la ficha, que la cierra (los eventos de React suben por el árbol, no por el DOM). */}
      {configAvisos && (
        <div onClick={(e) => e.stopPropagation()}>
          <AvisosDatosModal funnelId={lead.funnel_id ?? null} onCerrar={() => setConfigAvisos(false)} onGuardado={releer} />
        </div>
      )}
      {moveTo && (
        <div onClick={(e) => e.stopPropagation()}>
          <StageMoveDialog
            lead={moveInfo}
            stages={stages}
            move={{ to: moveTo }}
            // Completar datos (el «Solucionar» del aviso): es el mismo wizard sobre la
            // etapa actual, con la lista de faltantes que calculó el server. Los tres
            // props van juntos y con la misma condición que en `LeadDetailBody`.
            titulo={completandoDatos ? 'Completar datos' : undefined}
            completarDatos={completandoDatos}
            faltantes={completandoDatos ? faltantes : undefined}
            equipo={equipo}
            onClose={() => setMoveTo(null)}
            // Al completar datos la ficha SE QUEDA: la persona no pidió irse de acá, y
            // cerrarla sería la redirección que este cambio vino a sacar. Mover de
            // etapa sí la cierra — la tarjeta ya no vive en la columna que se estaba
            // mirando.
            onDone={() => { const quedarse = completandoDatos; setMoveTo(null); router.refresh(); if (quedarse) releer(); else onClose(); }}
          />
        </div>
      )}

      {moverDirecto && (
        <MoverEtapaConfirm
          lead={{ id: lead.id, nombre: lead.nombre, fechaJ1: lead.fecha_junta_1, asistioJ1: lead.asistio_j1, calificado: lead.calificado }}
          desde={sm?.label ?? stageKey}
          destino={{ key: moverDirecto, label: stageMeta(stages, moverDirecto)?.label ?? moverDirecto }}
          zIndex={120}
          onCancel={() => setMoverDirecto(null)}
          // ⚠️ La etapa nueva se pinta YA (el parche) y se confirma releyendo: sin el parche,
          // `completandoDatos` compara contra la etapa vieja y «Solucionar» abre «Mover a…».
          onHecho={() => { const k = moverDirecto; setMoverDirecto(null); router.refresh(); if (k) setFresca({ ...vigente, lead: { ...vigente.lead, pipeline_stage: k } }); releer(); }}
          // «Completar ahora»: el lead YA está en la etapa nueva, así que el wizard
          // abre sobre ella, a completar — no a mover de nuevo.
          onCompletar={() => { const k = moverDirecto; setMoverDirecto(null); router.refresh(); if (k) setFresca({ ...vigente, lead: { ...vigente.lead, pipeline_stage: k } }); releer(); setMoveTo(k); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Borrar lead"
          message={<>Vas a borrar definitivamente a <b style={{ color: 'var(--ink)' }}>{lead.nombre}</b> y todo su historial. <b style={{ color: 'var(--bad)' }}>No se puede deshacer.</b></>}
          confirmLabel="Borrar definitivamente"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
          zIndex={120}
        />
      )}
    </div>
    </FichaCambioProvider>
  );
}
