'use client';

// =============================================================================
// Desglose — primitivo compartido "valor clickeable → pop-up con el detalle"
// =============================================================================
// Generaliza el patrón nacido en app/comercial/RevenueKpis.tsx para que cualquier
// KPI / card / fila / etapa pueda abrir un modal con su desglose línea por línea.
//
//   • DesgloseModal   — el pop-up en sí (overlay + lista de filas).
//   • DesgloseTrigger — envuelve CUALQUIER markup (lo que ya rendea el server)
//                       y lo vuelve un botón que abre el modal. Útil para colgar
//                       el desglose de una card existente sin reescribir su estilo.
//   • DesgloseCard    — preset de "card" con el look de RevenueKpis, para grids.
//
// Las filas llegan YA formateadas (`valor` es un string listo para mostrar), así
// el primitivo sirve igual para montos USD, conteos, días, etc.
// =============================================================================

import { useState, type CSSProperties, type ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Code-split: el editor del CRM (LeadDetail + PlanPagosCard + server actions) NO
// entra al bundle inicial de las tabs que usan Desglose; se baja al abrir la ficha.
const LeadEditModal = dynamic(() => import('../leads/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

/**
 * Una fila del desglose: nombre principal + valor (derecha) + detalle (sub).
 * Si trae leadId, la fila muestra "Editar lead" → abre la ficha editable in-place
 * (saltando a `focus`: datos-comerciales | plan-pagos | motivo | etapa | …).
 */
export type DesgloseItem = { nombre: string; valor: string; detalle?: string; leadId?: number; focus?: string };

export type DesgloseData = {
  label: string;          // título chico (uppercase) del modal y de la card
  value: string;          // número grande
  color: string;          // color de acento (var(--...))
  items: DesgloseItem[];
  emptyText?: string;     // texto cuando no hay filas
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────

export function DesgloseModal({ data, onClose }: { data: DesgloseData; onClose: () => void }) {
  const [edit, setEdit] = useState<{ leadId: number; focus?: string } | null>(null);
  return (
    <>
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto', fontFamily: SANS }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '22px 26px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>{data.label}</div>
            <div style={{ fontWeight: 600, fontSize: 28, color: data.color, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{data.value}</div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>{data.items.length} {data.items.length === 1 ? 'registro' : 'registros'}</div>
          </div>
          <button onClick={onClose} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
        </div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {data.items.length === 0 ? (
            <div style={{ padding: '20px 26px', fontSize: 13.5, color: 'var(--faint)' }}>{data.emptyText ?? 'Sin registros en el período.'}</div>
          ) : (
            data.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 26px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.nombre}</div>
                  {it.detalle && <div style={{ fontSize: 12, color: 'var(--faint)' }}>{it.detalle}</div>}
                  {it.leadId != null && (
                    <button
                      type="button"
                      onClick={() => setEdit({ leadId: it.leadId!, focus: it.focus })}
                      style={{ marginTop: 4, padding: 0, background: 'none', border: 'none', color: 'var(--accent)', fontFamily: SANS, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                    >✎ Editar lead</button>
                  )}
                </div>
                <div style={{ flex: 'none', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: data.color }}>{it.valor}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    {edit && <LeadEditModal leadId={edit.leadId} focus={edit.focus} onClose={() => setEdit(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger — envuelve markup existente y lo vuelve clickeable
// ─────────────────────────────────────────────────────────────────────────────

export function DesgloseTrigger({ data, children, style }: { data: DesgloseData; children: ReactNode; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: 'block', width: '100%', textAlign: 'inherit', background: 'none', border: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', ...style }}
      >
        {children}
      </button>
      {open && <DesgloseModal data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card preset — el look de las cards de Revenue (Comercial)
// ─────────────────────────────────────────────────────────────────────────────

export function DesgloseCard({ data, sub }: { data: DesgloseData; sub: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', cursor: 'pointer', fontFamily: SANS, transition: 'border-color .15s, box-shadow .15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = data.color; e.currentTarget.style.boxShadow = '0 4px 16px rgba(23,21,17,.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>{data.label}</span>
          <span style={{ fontSize: 11.5, color: data.color, fontWeight: 600 }}>ver detalle →</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', color: data.color, fontVariantNumeric: 'tabular-nums' }}>{data.value}</div>
        <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 8 }}>{sub}</div>
      </button>
      {open && <DesgloseModal data={data} onClose={() => setOpen(false)} />}
    </>
  );
}
