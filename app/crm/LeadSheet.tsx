'use client';

// =============================================================================
// LeadSheet — ficha del lead en modal: PREVIEW de solo lectura, organizada en tabs
// =============================================================================
// Tabs: Resumen / Cobranza / Actividad. La edición vive en /crm/[id] (botón
// "Editar lead →"). Los movimientos del Kanban que exigen datos usan su propio
// pop-up chico (StageMoveDialog), no esta ficha.

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { CHIP, BAND_LABEL, deriveStageKey, stageMeta, nutricionPositivaDe, type Stage, type StageBand } from '@/lib/pipeline';
import { hayPasoDeWizard, tabDeSolucion } from '@/lib/stage-requirements';
import { DatosSinMarcarCard } from './lead-view/DatosSinMarcarCard';
import { buildJourney } from '@/lib/journey';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { deleteLeadInlineAction, reactivarPendientesAction, type LeadFullData } from './actions';
import { StageMoveDialog, type MoveLeadInfo } from './StageMoveDialog';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import type { FathomLink } from '@/lib/leads';
import { JourneyTimeline } from './JourneyTimeline';
import { OrigenCard } from './lead-view/OrigenCard';
import { InfoPrincipalCard } from './lead-view/InfoPrincipalCard';
import { AuditHistory } from './lead-view/AuditHistory';
import { ComportamientoCard } from './lead-view/ComportamientoCard';
import { ReunionesCard } from './lead-view/ReunionesCard';
import { ChatCard } from './lead-view/ChatCard';
import { NotasCard } from './lead-view/NotasCard';
import { GeneratedInsightCard } from './lead-view/GeneratedInsightCard';
import { TrackingTimelineCard } from './lead-view/TrackingTimelineCard';
import { DealDetailsCard } from './[id]/DealDetailsCard';
import { LeadTabs } from './lead-view/LeadTabs';
import { ConfirmDialog } from '../components/ConfirmDialog';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

function IconX() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}

export function LeadSheet({ data, onClose, initialTab }: { data: LeadFullData; onClose: () => void; initialTab?: string }) {
  const { lead, stages, pagos, vslEng, campana, adNombre, visitas, insights, tracking, respuestas, insightGen, faltantesInsight, faltantes, equipo, closerDetectado } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  // Avisos ignorados a mano (mig 0109): tono suave + reactivar desde la ficha.
  const ignorado = !!lead.pendientes_ignorados;
  const [, startReactivar] = useTransition();
  const reactivar = () => { startReactivar(async () => { try { await reactivarPendientesAction(lead.id); router.refresh(); } catch { /* noop */ } }); };

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
      if (e.key === 'Escape' && !e.isComposing) { e.stopPropagation(); onCloseRef.current(); return; }
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
  const isLost = lead.estado_lead === 'perdido' || lead.estado_lead === 'descalificado';
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
  });

  // Cambiar etapa desde el header (botón a la derecha). Elegir otra etapa abre el
  // wizard con TODAS las validaciones (Ganado → form completo), igual que el Kanban.
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
  };
  const pickStage = (k: string) => { if (k && k !== stageKey) setMoveTo(k); };

  const doDelete = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      try { await deleteLeadInlineAction(lead.id); router.refresh(); onClose(); }
      catch { setDelErr('No se pudo borrar. Reintentá.'); }
    });
  };

  // "Datos sin marcar" (arriba de TODAS las tabs). Solucionar rutea a la ficha:
  // reunión/venta/higiene → wizard (?solucionar=1); Deal Details/comprobante →
  // Cobranza; respuestas R2 → Meetings.
  const tab = tabDeSolucion(faltantes);
  const solucionarHref = hayPasoDeWizard(faltantes)
    ? `/crm/${lead.id}?solucionar=1`
    : tab === 'cobranza' ? `/crm/${lead.id}?edit=1&tab=cobranza&ia=1`
    : tab === 'reuniones' ? `/crm/${lead.id}?edit=1&tab=reuniones`
    : `/crm/${lead.id}?edit=1`;
  // Nutrición positiva (derivada): el lead avanza dentro de su etapa.
  const nutriPos = nutricionPositivaDe(lead, new Date().toISOString().slice(0, 10));

  const tabResumen = (
    <>
      {nutriPos && (
        <section style={{ ...card, borderColor: '#BFE6CD', background: 'var(--good-bg)' }}>
          <div style={{ ...sectLabel, color: 'var(--good)', marginBottom: 6 }}>🌱 Nutrición {nutriPos.tipo === 'post-agenda' ? 'Post Agenda' : 'Post Reunión R1'}</div>
          <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>El lead está avanzando — sigue en su etapa. Ventana informativa hasta la {nutriPos.tipo === 'post-agenda' ? 'Reunión 1' : 'Reunión 2'} del <b>{fmtDDMMYYYY(nutriPos.hasta)}</b> ({nutriPos.dias === 0 ? 'es hoy' : `faltan ${nutriPos.dias} día${nutriPos.dias === 1 ? '' : 's'}`}).</p>
        </section>
      )}
      <InfoPrincipalCard leadId={lead.id} nombre={lead.nombre} empresa={lead.empresa} email={lead.email} telefono={lead.telefono} direccion={lead.deal_fiscal?.domicilio ?? null} />
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 16 }}>Recorrido del lead</div>
        <JourneyTimeline steps={journey} />
      </section>
      {isLost && lead.motivo_perdida && (
        <section style={card}>
          <div style={{ ...sectLabel, marginBottom: 12 }}>Motivo de pérdida</div>
          <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>{lead.motivo_perdida}</div>
        </section>
      )}
    </>
  );

  const tabCobranza = isGanado || pagos.length > 0 ? (
    <>
      <DealDetailsCard lead={lead} pagos={pagos} />
      <Link href={`/crm/${lead.id}?tab=cobranza&edit=1`} style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Editar deal →</Link>
    </>
  ) : (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 10 }}>Deal Details</div>
      <p style={{ fontSize: 14, color: 'var(--faint)' }}>El deal se habilita cuando el lead pasa a Facturando o Ganado.</p>
    </section>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(16px,4vw,48px) clamp(10px,3vw,20px)' }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="leadsheet-title" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, maxHeight: 'calc(100dvh - clamp(32px,8vw,96px))', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden', outline: 'none' }}>

        <div style={{ height: 3, background: sm?.dot ?? 'var(--accent)' }} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: 'clamp(18px,4vw,24px) clamp(16px,4vw,28px) 12px' }}>
          <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
            <div aria-hidden style={{ flex: 'none', width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 17, fontWeight: 700, background: chip.bg, color: chip.fg, border: '1px solid ' + chip.bd }}>{initials(lead.nombre)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ marginBottom: 5 }}><span style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: chip.bg, color: chip.fg, border: '1px solid ' + chip.bd }}>{sm?.label ?? lead.estado_lead}</span></div>
              <h2 id="leadsheet-title" style={{ fontWeight: 600, fontSize: 'clamp(20px,5vw,27px)', letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', lineHeight: 1.1 }}>{lead.nombre}</h2>
              <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 3 }}>{lead.empresa ?? 'Sin empresa'}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)', marginTop: 4 }}>Lead #{lead.id} · creado {fmtDDMMYYYY(lead.created_at)}</div>
            </div>
          </div>
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <button onClick={onClose} aria-label="Cerrar" style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX /></button>
            <Dropdown value={stageKey} options={stageOptions} onChange={pickStage} align="right" width={210} ariaLabel="Cambiar etapa" buttonStyle={{ fontSize: 13, fontWeight: 600 }} />
          </div>
        </div>

        {/* tabs + cuerpo scrolleable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 clamp(16px,4vw,28px) clamp(14px,4vw,20px)' }}>
          {/* Datos sin marcar: arriba de las tabs → visible en TODAS. */}
          {faltantes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <DatosSinMarcarCard faltantes={faltantes} label="Solucionar →" onSolucionar={() => router.push(solucionarHref)} nota="Completá estos datos para tener la ficha al día." ignorado={ignorado} onReactivar={reactivar} />
            </div>
          )}
          <LeadTabs
            initial={initialTab}
            tabs={[
              { key: 'resumen', label: 'Overview', content: tabResumen },
              { key: 'notas', label: 'Notas', content: <NotasCard leadId={lead.id} /> },
              { key: 'comportamiento', label: 'Tracking', content: <><OrigenCard lead={lead} vslEng={vslEng} campana={campana} adNombre={adNombre} /><ComportamientoCard visitas={visitas.total_visitas} dias={visitas.dias_distintos} plays={vslEng.plays} maxPct={vslEng.sin_datos ? null : vslEng.max_pct} tieneVisitor={!!lead.visitor_id} /><TrackingTimelineCard eventos={tracking} /></> },
              { key: 'reuniones', label: 'Meetings', content: <ReunionesCard lead={lead} respuestas={respuestas} equipo={equipo} closerDetectado={closerDetectado} /> },
              { key: 'chat', label: 'Chat', content: <ChatCard leadId={lead.id} /> },
              {
                key: 'insights', label: 'Insights', badge: insights.length,
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
              { key: 'cobranza', label: 'Deal Details', content: tabCobranza, badge: pagos.filter((p) => !p.pagado).length },
              { key: 'actividad', label: 'Change History', content: <AuditHistory leadId={lead.id} stages={stages} /> },
            ]}
          />
        </div>

        {/* footer */}
        {delErr && <div style={{ padding: '8px clamp(16px,4vw,28px)', color: 'var(--bad)', fontSize: 13, fontWeight: 600, fontFamily: SANS }}>{delErr}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px clamp(16px,4vw,28px)', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button onClick={() => setConfirmDelete(true)} disabled={pending} style={{ padding: '8px 6px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Borrar lead</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>Cerrar</button>
            <Link href={`/crm/${lead.id}?edit=1`} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, textDecoration: 'none' }}>Editar lead →</Link>
          </div>
        </div>
      </div>

      {moveTo && (
        <StageMoveDialog
          lead={moveInfo}
          stages={stages}
          move={{ to: moveTo }}
          equipo={equipo}
          onClose={() => setMoveTo(null)}
          onDone={() => { setMoveTo(null); router.refresh(); onClose(); }}
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
  );
}
