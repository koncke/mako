'use client';

// =============================================================================
// StageMoveDialog — pop-up chico para completar un movimiento de etapa
// =============================================================================
// Cuando el Kanban/worklist mueve a una etapa que exige datos, este diálogo pide
// SOLO esos datos (no abre la ficha entera). Guarda vía completeStageMoveAction
// (validación server) y avisa al caller para el toast de Deshacer.

import { useState, useTransition, type CSSProperties } from 'react';
import { stageMeta, type Stage } from '@/lib/pipeline';
import { missingForStage } from '@/lib/stage-requirements';
import type { FathomLink } from '@/lib/leads';
import { completeStageMoveAction } from './actions';
import type { CrmLead } from './CrmBoard';

const SANS = "'Geist', sans-serif";
const compInput: CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const fieldLabel: CSSProperties = { fontSize: 12, color: 'var(--dim)', fontWeight: 600 };

export type StageMoveTarget = { to: string; asistioJ1?: boolean | null; asistioJ2?: boolean | null };

export function StageMoveDialog({ lead, stages, move, onDone, onClose }: {
  lead: CrmLead;
  stages: Stage[];
  move: StageMoveTarget;
  /** Se llama tras guardar OK (para refrescar + toast Deshacer con la etapa previa). */
  onDone: () => void;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const hoyISO = new Date().toISOString().slice(0, 10);
  const [fechaJ1, setFechaJ1] = useState(lead.fechaJ1 ?? '');
  const [fechaJ2, setFechaJ2] = useState(lead.fechaJ2 ?? '');
  const [monto, setMonto] = useState(lead.monto ? String(lead.monto) : '');
  const [motivo, setMotivo] = useState(lead.motivo ?? '');
  const [fathom, setFathom] = useState<FathomLink[]>(() => (lead.fathom.length ? lead.fathom : [{ label: 'Llamada', url: '' }]));

  const to = move.to;
  const label = stageMeta(stages, to)?.label ?? to;
  const needFechaJ1 = to === 'agenda';
  const needFechaJ2 = to === 'agendaj2' || to === 'facturando';
  const needMonto = to === 'ganado';
  const needMotivo = to === 'perdido' || to === 'descal';
  // Fathom solo si la reunión ya pasó (una reunión futura no puede tener grabación).
  const fechaRelevante = needFechaJ1 ? fechaJ1 : needFechaJ2 ? fechaJ2 : '';
  const needFathom = (needFechaJ1 || needFechaJ2) && !!fechaRelevante && fechaRelevante < hoyISO;

  const faltan = missingForStage(to, {
    fechaJ1, fechaJ2,
    hasFathomUrl: fathom.some((f) => f.url.trim()),
    monto: parseFloat(monto) || null,
    motivo,
    setter: lead.setter,
    hoyISO,
  });

  const setFathomAt = (i: number, field: 'label' | 'url', v: string) =>
    setFathom((arr) => arr.map((f, fi) => (fi === i ? { ...f, [field]: v } : f)));

  const guardar = () => {
    if (faltan.length) return;
    setErr(null);
    startTransition(async () => {
      try {
        await completeStageMoveAction(lead.id, to, {
          ...(needFechaJ1 ? { fechaJ1: fechaJ1 || null } : {}),
          ...(needFechaJ2 ? { fechaJ2: fechaJ2 || null } : {}),
          ...(needFathom ? { fathom: fathom.filter((f) => f.url.trim() || f.label.trim()) } : {}),
          ...(needMonto ? { monto: parseFloat(monto) || null } : {}),
          ...(needMotivo ? { motivo: motivo.trim() || null } : {}),
          asistioJ1: move.asistioJ1,
          asistioJ2: move.asistioJ2,
        });
        onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const sugerencias = ['Precio', 'Timing', 'No calificado', 'Fantasma', 'Otro'];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Mover a {label}</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginBottom: 16 }}>{lead.name}{faltan.length ? ' — completá lo obligatorio' : ' — confirmá el cambio'}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {needFechaJ1 && (
            <label><span style={fieldLabel}>Fecha de la Reunión 1</span><input type="date" value={fechaJ1} onChange={(e) => setFechaJ1(e.target.value)} style={{ ...compInput, marginTop: 5 }} /></label>
          )}
          {needFechaJ2 && (
            <label><span style={fieldLabel}>Fecha de la Reunión 2</span><input type="date" value={fechaJ2} onChange={(e) => setFechaJ2(e.target.value)} style={{ ...compInput, marginTop: 5 }} /></label>
          )}
          {needMonto && (
            <label><span style={fieldLabel}>Monto de cierre (USD)</span><input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" autoFocus style={{ ...compInput, marginTop: 5 }} /></label>
          )}
          {needMotivo && (
            <div>
              <span style={fieldLabel}>Motivo</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: '7px 0 8px' }}>
                {sugerencias.map((s) => {
                  const active = motivo.trim().toLowerCase() === s.toLowerCase();
                  return (
                    <button key={s} type="button" onClick={() => setMotivo(s)} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, fontFamily: SANS, cursor: 'pointer', background: active ? 'rgba(47,111,237,.10)' : 'var(--surface)', border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border-strong)'), color: active ? 'var(--primary)' : 'var(--dim)' }}>{s}</button>
                  );
                })}
              </div>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="¿Por qué se perdió o descalificó?" style={{ ...compInput, minHeight: 74, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          )}
          {needFathom && (
            <div>
              <span style={fieldLabel}>Link(s) de Fathom</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 5 }}>
                {fathom.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <input aria-label="Etiqueta" value={f.label} onChange={(e) => setFathomAt(i, 'label', e.target.value)} placeholder="Llamada" style={{ ...compInput, flex: 'none', width: 105 }} />
                    <input aria-label="URL de Fathom" value={f.url} onChange={(e) => setFathomAt(i, 'url', e.target.value)} placeholder="https://fathom.video/…" style={{ ...compInput, flex: 1 }} />
                  </div>
                ))}
                <button onClick={() => setFathom((arr) => [...arr, { label: '', url: '' }])} style={{ padding: 8, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>+ Agregar otro link</button>
              </div>
            </div>
          )}
        </div>

        {faltan.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Falta:</span>
            {faltan.map((x) => (<span key={x} style={{ fontSize: 12, fontWeight: 600, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', padding: '3px 9px', borderRadius: 999 }}>{x}</span>))}
          </div>
        )}
        {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', fontWeight: 600, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
          <button onClick={guardar} disabled={pending || faltan.length > 0} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: faltan.length ? 'var(--border)' : 'var(--primary)', color: faltan.length ? 'var(--ink)' : '#fff', fontSize: 14, fontWeight: 700, cursor: faltan.length ? 'default' : 'pointer', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Guardar y mover'}</button>
        </div>
      </div>
    </div>
  );
}
