'use client';

// =============================================================================
// LeadDetailBody — cuerpo del detalle del lead: tabs + modo edición
// =============================================================================
// "Editar" NO es una tab: es un botón global. Al editar, el contenido se
// reemplaza por el formulario; al guardar (confirmado) o cancelar se vuelve a
// la tab donde estaba el usuario. "Volver" usa el historial del navegador para
// regresar al contexto exacto (p.ej. el chat de WhatsApp desde donde se entró).

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Stage } from '@/lib/pipeline';
import type { Lead } from '@/lib/leads';
import { EditLeadForm } from './EditLeadForm';
import { LeadTabs } from '../lead-view/LeadTabs';

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

export function LeadDetailBody({ lead, stages, initialTab, initialEdit, resumen, cobranza, actividad, cuotasPendientes }: {
  lead: Lead;
  stages: Stage[];
  initialTab?: string;
  initialEdit?: boolean;
  resumen: ReactNode;
  cobranza: ReactNode;
  actividad: ReactNode;
  cuotasPendientes: number;
}) {
  const [editing, setEditing] = useState(!!initialEdit);
  const [tab, setTab] = useState(initialTab && ['resumen', 'cobranza', 'actividad'].includes(initialTab) ? initialTab : 'resumen');

  const editarBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS };

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <EditLeadForm
          lead={lead}
          stages={stages}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -40, position: 'relative', zIndex: 5 }}>
        <button type="button" onClick={() => setEditing(true)} style={editarBtn}><IconPencil /> Editar</button>
      </div>
      <LeadTabs
        initial={tab}
        onChange={setTab}
        tabs={[
          { key: 'resumen', label: 'Resumen', content: resumen },
          { key: 'cobranza', label: 'Cobranza', content: cobranza, badge: cuotasPendientes },
          { key: 'actividad', label: 'Actividad', content: actividad },
        ]}
      />
    </div>
  );
}
