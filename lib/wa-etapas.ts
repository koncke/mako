// =============================================================================
// Etapa del funnel para el inbox de WhatsApp — colores + chip + derivación.
// Compartido entre server (getConversacionesNoOficial) y client (EmpresaInbox),
// y espeja 1:1 la derivarEtapa del inbox oficial (conversations/route.ts) para que
// el filtro por etapa se vea y funcione igual en ambos canales. Puro (sin
// server-only / use client): lo pueden importar los dos lados.
// =============================================================================

import type { CSSProperties } from 'react';

export const ETAPA_COLOR: Record<string, string> = {
  cliente: '#1D9E75', 'por-cobrar': '#C7417B', 'no-show': '#B5630A', j2: '#4F5BD5',
  'post-j1': '#6A4BD8', agendo: '#9D4EDD', 'vio-vsl': '#185FA5', form: '#888780', abierto: '#888780',
  manual: '#D8843C', // Nutrición - Manual (override del CRM)
};

export function etapaChip(key: string | null, label: string | null): { style: CSSProperties; dot: CSSProperties; label: string } | null {
  if (!key || !label) return null;
  const color = ETAPA_COLOR[key] ?? '#888780';
  return {
    label,
    dot: { width: '8px', height: '8px', flex: 'none', borderRadius: '50%', background: color },
    style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, padding: '3px 9px', borderRadius: '999px', background: 'var(--surface-2)', color: 'var(--dim)', border: '1px solid var(--border)', whiteSpace: 'nowrap' },
  };
}

// Etapas del funnel (para mapear a etiquetas de WhatsApp en /configuraciones).
export const ETAPAS_FUNNEL: Array<{ key: string; label: string }> = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'por-cobrar', label: 'Por cobrar' },
  { key: 'j2', label: 'En R2' },
  { key: 'post-j1', label: 'Post R1' },
  { key: 'no-show', label: 'No-show' },
  { key: 'agendo', label: 'Agendó' },
  { key: 'vio-vsl', label: 'Vio VSL' },
  { key: 'form', label: 'Form' },
  { key: 'abierto', label: 'Abierto' },
];

// Campos del lead que necesita la derivación (subconjunto de la fila de leads).
export type LeadEtapaFields = {
  fecha_primer_pago?: string | null; fecha_confirmacion?: string | null; cerro?: boolean | null;
  asistio_j1?: boolean | null; asistio_j2?: boolean | null; fecha_junta_2?: string | null;
  fecha_agenda?: string | null; visitor_id?: string | null; meta_lead_id?: string | null;
};

// Etapa del funnel (misma cascada que el inbox oficial).
export function derivarEtapa(l: LeadEtapaFields): { key: string; label: string } {
  if (l.fecha_primer_pago) return { key: 'cliente', label: 'Cliente' };
  if (l.fecha_confirmacion && l.cerro !== true) return { key: 'por-cobrar', label: 'Por cobrar' };
  if (l.asistio_j2 === false) return { key: 'no-show', label: 'No-show' };
  if (l.fecha_junta_2 || l.asistio_j2 === true) return { key: 'j2', label: 'En R2' };
  if (l.asistio_j1 === true) return { key: 'post-j1', label: 'Post R1' };
  if (l.asistio_j1 === false) return { key: 'no-show', label: 'No-show' };
  if (l.fecha_agenda) return { key: 'agendo', label: 'Agendó' };
  if (l.visitor_id) return { key: 'vio-vsl', label: 'Vio VSL' };
  if (l.meta_lead_id) return { key: 'form', label: 'Form' };
  return { key: 'abierto', label: 'Abierto' };
}
