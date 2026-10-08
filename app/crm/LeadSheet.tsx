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
import { CHIP, BAND_LABEL, deriveStageKey, stageMeta, nutricionPositivaDe, type Stage, type StageBand } from '@/lib/pipeline';
import { DatosSinMarcarCard } from './lead-view/DatosSinMarcarCard';
import { buildJourney } from '@/lib/journey';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { deleteLeadInlineAction, getLeadFullAction, type LeadFullData } from './actions';
import { StageMoveDialog, type MoveLeadInfo } from './StageMoveDialog';
import { MoverEtapaConfirm } from './MoverEtapaConfirm';
import { pideWizardAlElegir } from './mover-etapa';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import type { FathomLink } from '@/lib/leads';
import { JourneyTimeline } from './JourneyTimeline';
import { OrigenCard } from './lead-view/OrigenCard';
import { InfoPrincipalCard } from './lead-view/InfoPrincipalCard';
import { CaraDelLead } from './lead-view/CaraDelLead';
import { ProductoDelLead, EtapaEnProducto, useProductosDeLaFicha } from './lead-view/ProductoDelLead';
import { AuditHistory } from './lead-view/AuditHistory';
import { ComportamientoCard } from './lead-view/ComportamientoCard';
// «¿Era calificado?» vive también acá, en Tracking: hay funnels sin reuniones y
// ese dato es el que viaja a Meta. Mismo control y misma columna que en Reuniones.
import { CalificacionCard } from './lead-view/CalificacionCard';
import { ReunionesCard } from './lead-view/ReunionesCard';
import { GeneratedInsightCard } from './lead-view/GeneratedInsightCard';
import { DealDetailsCard } from './[id]/DealDetailsCard';
import { LeadTabs } from './lead-view/LeadTabs';
import { NotasCard } from './lead-view/NotasCard';
import { RespuestasFormulario } from './lead-view/RespuestasFormulario';
import { MotivoCard, PlazoNutricionCard, leadSalio } from './lead-view/MotivoYPlazoCard';
import { ConfirmDialog } from '../components/ConfirmDialog';

import { profundidadModales } from '@/app/_components/pila-modales';
import { FichaCambioProvider } from './lead-view/ficha-cambio';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };


function IconX() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}

export function LeadSheet({ data, onClose, initialTab }: { data: LeadFullData; onClose: () => void; initialTab?: string }) {
  // ⚠️ LA FICHA SE RELEE CUANDO CAMBIA LA CASA DEL LEAD. Sus datos los trajo una action al abrir
  // (LeadEditModal) y el `router.refresh()` no los toca: si desde el desplegable de productos se
  // quita la casa, la etapa, las etapas y el chip de acá serían los del producto anterior. Sólo
  // vale mientras sea el MISMO lead: si la ficha pasa a mostrar otro, mandan sus datos.
  const [fresca, setFresca] = useState<LeadFullData | null>(null);
  const vigente = fresca && fresca.lead.id === data.lead.id ? fresca : data;
  const { lead, stages, pagos, vslEng, campana, adNombre, adId, visitas, insights, tracking, pixelPuesto, respuestas, respuestasForm, insightGen, faltantesInsight, faltantes, equipo, closerDetectado, videos: videosLanding, replay, productos, fotoEmail } = vigente;
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
  const agregado = fichaProd.vista && !fichaProd.vista.esCasa ? fichaProd.vista : null;

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
  const chip = sm ? CHIP[sm.tone] || CHIP.neutral : CHIP.neutral;
  const isGanado = lead.estado_lead === 'ganado';
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

  // Cambiar etapa desde el header (botón a la derecha). `moveTo` abre el wizard de
  // datos: solo para las etapas que lo necesitan, y para «Completar ahora».
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const stageOptions: DropdownOption[] = (['pipeline', 'nutricion', 'salidas'] as StageBand[]).flatMap((b) =>
    stages.filter((s) => (s.band ?? 'pipeline') === b).sort((a, c) => (a.col ?? 0) - (c.col ?? 0)).map((s) => ({ value: s.key, label: s.label, sub: BAND_LABEL[b], color: s.dot })),
  );
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
      {/* ⚠️ A ESTE MONTAJE LE FALTA LA COHORTE, y es una diferencia REAL entre las dos
          puertas: medido el 05/10/2026 en un lead con R1, la ruta /crm/[id] dibuja
          «Cohorte · Madura · 48 dias desde R1» y este panel no dibuja nada. Quien entra
          por el link de WhatsApp ve un dato que el tablero le esconde.
          NO se arregla pasando la prop acá: la cohorte sale de `labelMadurez` y
          `textoCohorteJ1`, que viven en lib/leads.ts — 2.600 lineas y sus dependencias de
          servidor— y este archivo es 'use client'. Importar un VALOR de ahi se lleva el
          modulo entero al navegador del cliente, que es la frontera que esta casa ya pago.
          Se calcula en el SERVER y baja por props, como hace la ruta. Queda anotado en
          docs/relevo/crm.md. */}
      <InfoPrincipalCard leadId={lead.id} nombre={lead.nombre} empresa={lead.empresa} email={lead.email} telefono={lead.telefono} web={lead.web ?? null} />
      {/* Lo que contestó en el formulario de Meta. Hasta el 07/10/2026 sólo lo dibujaba la
          ruta, y el tablero abre ESTE pop-up: en el uso diario no se veía. Las respuestas
          llegan resueltas del server (`respuestasForm`, getLeadFullAction). */}
      <RespuestasFormulario respuestas={respuestasForm ?? []} />
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

  const tabCobranza = isGanado || pagos.length > 0 ? (
    <>
      {/* ⚠️ `onCambio`: acá el lead es estado de cliente (getLeadFullAction), así que el
          refresh de la tarjeta no lo alcanza. Se aplica lo que la action devolvió —el wizard
          de «Completar datos» se arma con ESTE lead— y se relee el resto (los «Datos sin
          marcar» cambian: sin «Sin cobro» vuelve a faltar el monto). */}
      <DealDetailsCard lead={lead} pagos={pagos} onCambio={(patch) => {
        setFresca({ ...vigente, lead: { ...vigente.lead, ...patch } });
        void getLeadFullAction(lead.id).then((x) => { if (x) setFresca(x); }).catch(() => {});
      }} />
      <Link href={`/crm/${lead.id}?tab=cobranza&edit=1`} style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Editar deal →</Link>
    </>
  ) : (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 10 }}>Deal Details</div>
      <p style={{ fontSize: 14, color: 'var(--faint)' }}>El deal se habilita cuando el lead pasa a Facturando o Ganado.</p>
    </section>
  );

  return (
    <FichaCambioProvider value={releer}>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(16px,4vw,48px) clamp(10px,3vw,20px)' }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="leadsheet-title" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, maxHeight: 'calc(100dvh - clamp(32px,8vw,96px))', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden', outline: 'none' }}>

        <div style={{ height: 3, background: sm?.dot ?? 'var(--accent)' }} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: 'clamp(18px,4vw,24px) clamp(16px,4vw,28px) 12px' }}>
          <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
            {/* La cara: lo elegido → WhatsApp → Gravatar → iniciales (CaraDelLead). */}
            <CaraDelLead nombre={lead.nombre} telefono={lead.telefono} fotoEmail={fotoEmail} fotoGuardada={lead.foto_auto_url} icono={lead.icono} avatarUrl={lead.avatar_url} color={chip.fg} />
            <div style={{ minWidth: 0 }}>
              <div style={{ marginBottom: 5 }}><span style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: chip.bg, color: chip.fg, border: '1px solid ' + chip.bd }}>{sm?.label ?? lead.estado_lead}</span></div>
              <h2 id="leadsheet-title" style={{ fontWeight: 600, fontSize: 'clamp(20px,5vw,27px)', letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', lineHeight: 1.1 }}>{lead.nombre}</h2>
              <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 3 }}>{lead.empresa ?? 'Sin empresa'}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)', marginTop: 4 }}>Lead #{lead.id} · creado {fmtDDMMYYYY(lead.created_at)}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX /></button>
        </div>

        {/* ⚠️ LA FILA DE CONTROLES, debajo de la cabecera y no apilada a su derecha. Estaban
            en una columna —✕, «Producto» + desplegable, etapa, «N sin marcar»— y Martín
            (06/10/2026): «Los 2 desplegables uno abajo del otro, el texto de "producto" y
            encima "2 sin marcar Solucionar →" está todo amontonado». Ahora es UN renglón:
            producto (con su ícono en vez del rótulo, como la barra de lote del tablero) y
            etapa a la izquierda —producto antes, porque la etapa es una posición DENTRO de un
            producto—, y el aviso de datos sin marcar a la derecha. Si no entra, envuelve: el
            aviso baja pegado a la derecha. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '0 clamp(16px,4vw,28px) 14px' }}>
          <ProductoDelLead ficha={fichaProd} rotulo={false} />
          {/* ⚠️ LA ETAPA ES LA DEL PRODUCTO QUE SE MIRA. En la casa, el selector de siempre (con su
              wizard); en un producto agregado, las etapas de ESE tablero, y moverla escribe sólo su
              fila. Mientras no se sabe cuál se mira, espera: ver `etapaEnEspera`. */}
          {agregado
            ? <EtapaEnProducto ficha={fichaProd} producto={agregado} width={210} />
            : <Dropdown value={fichaProd.esperando ? '' : stageKey} placeholder="Etapa" disabled={fichaProd.esperando} options={stageOptions} onChange={pickStage} align="left" width={210} ariaLabel="Cambiar etapa" buttonStyle={{ fontSize: 13, fontWeight: 600 }} />}
          {faltantes.length > 0 && (
            <span style={{ marginLeft: 'auto' }}>
              <DatosSinMarcarCard faltantes={faltantes} onSolucionar={solucionar} />
            </span>
          )}
        </div>

        {/* tabs + cuerpo scrolleable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 clamp(16px,4vw,28px) clamp(14px,4vw,20px)' }}>
          <LeadTabs
            initial={initialTab}
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
              { key: 'comportamiento', label: 'Tracking', content: <><OrigenCard lead={lead} vslEng={vslEng} campana={campana} adNombre={adNombre} adId={adId} /><CalificacionCard lead={lead} /><ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct} tieneVisitor={!!lead.visitor_id} porVideo={vslEng.porVideo} videos={videosLanding} eventos={tracking} pixelPuesto={pixelPuesto} replay={replay} /></> },
              { key: 'reuniones', label: 'Reuniones', content: <ReunionesCard lead={lead} respuestas={respuestas} equipo={equipo} closerDetectado={closerDetectado} /> },
              // ⚠️ SOLO CUANDO TIENE ALGO ADENTRO. En 1.124 de 1.138 leads esta
              // pestaña no decía más que «está vacía» —y con tres redacciones
              // distintas—: una pestaña cuyo único contenido es avisar que no hay
              // contenido es una pestaña que se abre una vez y no se abre nunca más,
              // pero que todos los días ocupa lugar y hace dudar de si falta algo.
              // Con pagos cargados vuelve sola, con todo lo de siempre.
              ...(pagos.length ? [{ key: 'cobranza', label: 'Pagos', content: tabCobranza, badge: pagos.filter((p) => !p.pagado).length }] : []),
              // ⚠️ ANÁLISIS VA PEGADO A HISTORIAL, y es pedido de Martín («que análisis
              // esté previo al historial», 27/09/2026). Las dos contestan «qué pasó con
              // esta persona» —una lo interpreta, la otra lo registra— así que se leen
              // seguidas; Pagos contesta otra cosa y estaba en el medio.
              {
                key: 'insights', label: 'Análisis', badge: insights.length,
                content: (
                  <GeneratedInsightCard
                    lead={lead}
                    stages={stages}
                    tienePlan={pagos.length > 0}
                    inicial={insightGen}
                    faltantesIniciales={faltantesInsight}
                    llamadas={insights.map((i) => ({ tipo: i.tipo, fecha: i.started_at, url: i.share_url }))}
                  />
                ),
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

        {/* footer */}
        {delErr && <div style={{ padding: '8px clamp(16px,4vw,28px)', color: 'var(--bad)', fontSize: 13, fontWeight: 600, fontFamily: SANS }}>{delErr}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px clamp(16px,4vw,28px)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button onClick={() => setConfirmDelete(true)} disabled={pending} style={{ padding: '8px 6px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Borrar lead</button>
          {/* ⚠️ ACÁ ESTABA «Editar lead →», y se fue el 05/10/2026 (pedido DOS veces:
              «que ya no exista el botón de "editar" … simplemente le doy click arriba y
              ya puedo sobre escribir»). No se reemplazó por un lápiz: los 15 campos que
              ese formulario editaba se editan en la ficha, cada uno donde se lee.
              Lo único que sigue teniendo pantalla propia es el DEAL, y su entrada está
              donde el deal se lee (el «Editar deal →» de la tab Pagos). */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Cerrar</button>
          </div>
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
