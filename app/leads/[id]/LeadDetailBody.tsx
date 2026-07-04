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
import { deriveStageKey, CHIP, type Stage } from '@/lib/pipeline';
import type { Lead, FathomLink } from '@/lib/leads';
import type { Pago } from '@/lib/pagos';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { EditLeadForm } from './EditLeadForm';
import { LeadTabs, type LeadTabDef } from '../lead-view/LeadTabs';
import { StageMoveDialog, type MoveLeadInfo } from '../StageMoveDialog';
import { Dropdown } from '@/app/components/Dropdown';

const SANS = "'Geist', sans-serif";

// Mapea la tab de LECTURA a la de EDICIÓN (solo 3 son editables); el resto abre
// en Overview. Así "Editar" respeta dónde estaba el usuario si esa tab se edita.
const TAB_EDITABLE: Record<string, string> = { resumen: 'resumen', reuniones: 'reuniones', cobranza: 'cobranza' };

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

export function LeadDetailBody({ lead, stages, pagos, initialTab, initialEdit, tabs, nombre, empresa, createdISO, stageLabel, chipTone }: {
  lead: Lead;
  stages: Stage[];
  pagos: Pago[];
  initialTab?: string;
  initialEdit?: boolean;
  /** Tabs de LECTURA (contenido server-rendered). */
  tabs: LeadTabDef[];
  // Datos del header (antes vivían en page.tsx; ahora acá para que "Editar"
  // conviva con las tabs y respete la tab actual).
  nombre: string;
  empresa: string | null;
  createdISO: string;
  stageLabel: string;
  chipTone: keyof typeof CHIP;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(!!initialEdit);
  const [tab, setTab] = useState(initialTab && tabs.some((t) => t.key === initialTab) ? initialTab : tabs[0]?.key ?? 'resumen');
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const chip = CHIP[chipTone] || CHIP.neutral;

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
    sinR1: !!lead.sin_r1,
    sinR2: !!lead.sin_r2,
    fathomOmitido: !!lead.fathom_omitido,
  };

  const editarBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };

  // Selector de etapa: muestra la ETAPA ACTUAL; elegir otra abre el wizard.
  // Dos columnas lado a lado (Pipeline + Salida | Nutrición) para verlo entero
  // sin scroll.
  const deBanda = (band: 'pipeline' | 'nutricion' | 'salidas') =>
    stages
      .filter((s) => (s.band ?? 'pipeline') === band)
      .sort((a, b) => (a.col ?? 0) - (b.col ?? 0))
      .map((s) => ({ value: s.key, label: s.label, color: s.dot }));
  const stageSelector: ReactNode = (
    <Dropdown
      value={currentStage}
      align="right"
      width={250}
      ariaLabel="Etapa del lead (elegí otra para mover)"
      onChange={(key) => { if (key && key !== currentStage) setMoveTo(key); }}
      columns={[
        [{ title: 'Pipeline', options: deBanda('pipeline') }, { title: 'Salida', options: deBanda('salidas') }],
        [{ title: 'Nutrición', options: deBanda('nutricion') }],
      ]}
    />
  );

  // El dropdown de etapa queda inline con las tabs (acciones); "Editar" vive en
  // el header (arriba a la derecha, donde antes estaba la Cohorte).
  const header: ReactNode = (
    <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: chip.bg, color: chip.fg, border: '1px solid ' + chip.bd, marginBottom: 9 }}>{stageLabel}</span>
        <h1 style={{ fontSize: 'clamp(28px,6vw,42px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>{nombre}</h1>
        <p style={{ marginTop: 6, fontSize: 14, color: 'var(--dim)' }}>{empresa ?? 'Sin empresa'} · Lead #{lead.id} · creado {fmtDDMMYYYY(createdISO)}</p>
      </div>
      {!editing && <button type="button" onClick={() => setEditing(true)} style={editarBtn}><IconPencil /> Editar</button>}
    </div>
  );

  return (
    <div>
      {header}
      {editing ? (
        <>
          {/* El selector de etapa sigue disponible en modo edición. */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>{stageSelector}</div>
          <EditLeadForm
            lead={lead}
            stages={stages}
            pagos={pagos}
            initialTab={TAB_EDITABLE[tab] ?? 'resumen'}
            onDone={() => { setEditing(false); router.refresh(); }}
            onCancel={() => setEditing(false)}
          />
        </>
      ) : (
        <LeadTabs initial={tab} onChange={setTab} tabs={tabs} actions={stageSelector} />
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
