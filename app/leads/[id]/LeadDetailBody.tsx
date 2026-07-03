'use client';

// =============================================================================
// LeadDetailBody — cuerpo del detalle del lead: tabs + mover de etapa + edición
// =============================================================================
// La etapa se cambia SIN entrar a editar: "Mover a…" en la barra de tabs abre
// el mismo wizard progresivo del Kanban. "Editar" es un botón (no una tab): el
// modo edición usa las mismas tabs con sus campos editables, y al guardar
// (confirmado) o cancelar se vuelve a la tab donde estaba el usuario.
// "Volver" usa el historial del navegador (regresa al contexto exacto).

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { deriveStageKey, type Stage } from '@/lib/pipeline';
import type { Lead, FathomLink } from '@/lib/leads';
import type { Pago } from '@/lib/pagos';
import { EditLeadForm } from './EditLeadForm';
import { LeadTabs, type LeadTabDef } from '../lead-view/LeadTabs';
import { StageMoveDialog, type MoveLeadInfo } from '../StageMoveDialog';
import { Dropdown } from '@/app/components/Dropdown';

const SANS = "'Geist', sans-serif";

function IconPencil() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>;
}

export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => { if (window.history.length > 1) router.back(); else router.push('/leads'); }}
      style={{ fontSize: 14, color: 'var(--dim)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: SANS }}
    >← Volver</button>
  );
}

export function LeadDetailBody({ lead, stages, pagos, initialTab, initialEdit, tabs }: {
  lead: Lead;
  stages: Stage[];
  pagos: Pago[];
  initialTab?: string;
  initialEdit?: boolean;
  /** Tabs de LECTURA (contenido server-rendered). */
  tabs: LeadTabDef[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(!!initialEdit);
  const [tab, setTab] = useState(initialTab && tabs.some((t) => t.key === initialTab) ? initialTab : tabs[0]?.key ?? 'resumen');
  const [moveTo, setMoveTo] = useState<string | null>(null);

  const currentStage = lead.pipeline_stage && stages.some((s) => s.key === lead.pipeline_stage) ? lead.pipeline_stage : deriveStageKey(lead);

  const moveInfo: MoveLeadInfo = {
    id: lead.id,
    name: lead.nombre,
    fechaJ1: lead.fecha_junta_1,
    fechaJ2: lead.fecha_junta_2,
    asistioJ1: lead.asistio_j1,
    asistioJ2: lead.asistio_j2,
    calificado: lead.calificado,
    fathom: (lead.fathom_links ?? []) as FathomLink[],
    monto: lead.monto_cierre_usd ?? null,
    motivo: lead.motivo_perdida,
    setter: lead.setter ?? null,
    tienePlan: pagos.length > 0,
  };

  const editarBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };

  const actions: ReactNode = (
    <>
      <Dropdown
        value=""
        resetAfterSelect
        align="right"
        width={230}
        placeholder="Mover a…"
        ariaLabel="Mover de etapa"
        onChange={(key) => { if (key && key !== currentStage) setMoveTo(key); }}
        options={stages.filter((s) => s.key !== currentStage).map((s) => ({ value: s.key, label: s.label, color: s.dot }))}
      />
      {!editing && <button type="button" onClick={() => setEditing(true)} style={editarBtn}><IconPencil /> Editar</button>}
    </>
  );

  return (
    <div>
      {editing ? (
        <EditLeadForm
          lead={lead}
          stages={stages}
          pagos={pagos}
          onDone={() => { setEditing(false); router.refresh(); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <LeadTabs initial={tab} onChange={setTab} tabs={tabs} actions={actions} />
      )}

      {moveTo && (
        <StageMoveDialog
          lead={moveInfo}
          stages={stages}
          move={{ to: moveTo }}
          onClose={() => setMoveTo(null)}
          onDone={() => { setMoveTo(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
