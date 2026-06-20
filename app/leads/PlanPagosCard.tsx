'use client';

// =============================================================================
// PlanPagosCard — plan de pagos del lead en el CRM (ver / editar)
// =============================================================================
// Por defecto muestra el plan guardado en modo LECTURA: total, duración, fechas,
// contrato (descargable) y las cuotas con su estado "Cobrado ✅". El lápiz arriba
// entra a edición: inputs + subir contrato (autollenado con OpenAI) + cuotas.
// Guardar persiste y vuelve a lectura.

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { savePlanManualAction, marcarPagoAction } from './actions';
import type { PlanManual } from '@/lib/pagos';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Pago = { id: number; numero: number; monto_usd: number; fecha_esperada: string | null; pagado: boolean; fecha_pago: string | null };
type LeadPlan = { total_usd: number | null; duracion_meses: number | null; fecha_cierre: string | null; fecha_inicio: string | null; contrato_nombre: string | null; tiene_contrato: boolean; pagos: Pago[] };
type CuotaEdit = { monto: string; fecha: string };

const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '16px 18px' };
const lbl: CSSProperties = { fontSize: 11.5, color: 'var(--faint)', marginBottom: 5 };
const input: CSSProperties = { padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none', width: '100%' };
const sectLbl: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const fmtUSD = (n: number | null) => (n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n));
const isoToDmy = (s: string | null) => { if (!s) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? `${m[3]}/${m[2]}/${m[1]}` : s; };
const dmyToIso = (s: string): string | null => { const t = (s || '').trim(); if (!t) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
const toMonto = (s: string) => { const n = Number(String(s ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };

export function PlanPagosCard({ leadId, onChanged }: { leadId: number; onChanged?: () => void }) {
  const [plan, setPlan] = useState<LeadPlan | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [e, setE] = useState<{ total: string; duracion: string; cierre: string; inicio: string; cuotas: CuotaEdit[] }>({ total: '', duracion: '', cierre: '', inicio: '', cuotas: [] });
  const [pending, start] = useTransition();
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`/api/lead-plan?leadId=${leadId}`);
      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      if (j.error) { setLoadErr(j.error); return; }
      setLoadErr(null); setPlan(j);
    } catch (ex) { setLoadErr(String(ex)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [leadId]);

  const entrarEdit = () => {
    const noPag = (plan?.pagos ?? []).filter((p) => !p.pagado);
    setE({
      total: plan?.total_usd != null ? String(plan.total_usd) : '',
      duracion: plan?.duracion_meses != null ? String(plan.duracion_meses) : '',
      cierre: isoToDmy(plan?.fecha_cierre ?? null),
      inicio: isoToDmy(plan?.fecha_inicio ?? null),
      cuotas: noPag.length ? noPag.map((p) => ({ monto: String(p.monto_usd), fecha: isoToDmy(p.fecha_esperada) })) : [{ monto: '', fecha: '' }],
    });
    setMode('edit');
  };

  const guardar = () => {
    const payload: PlanManual = {
      total_usd: toMonto(e.total) || null,
      duracion_meses: e.duracion ? parseInt(e.duracion, 10) || null : null,
      fecha_cierre: dmyToIso(e.cierre),
      fecha_inicio: dmyToIso(e.inicio),
      cuotas: e.cuotas.map((c) => ({ monto_usd: toMonto(c.monto), fecha_esperada: dmyToIso(c.fecha) })).filter((c) => c.monto_usd > 0),
    };
    start(async () => { await savePlanManualAction(leadId, payload); await load(); setMode('view'); onChanged?.(); });
  };

  const toggleCobrado = (p: Pago) => {
    const hoy = new Date().toISOString().slice(0, 10);
    start(async () => { await marcarPagoAction(p.id, leadId, !p.pagado, p.pagado ? null : hoy); await load(); onChanged?.(); });
  };

  const onExtract = (d: { total_usd: number | null; duracion_meses: number | null; fecha_cierre: string | null; fecha_inicio: string | null; cuotas: Array<{ monto: number | null; fecha: string | null }> }) => {
    setE((cur) => ({
      total: d.total_usd != null ? String(d.total_usd) : cur.total,
      duracion: d.duracion_meses != null ? String(d.duracion_meses) : cur.duracion,
      cierre: d.fecha_cierre ?? cur.cierre,
      inicio: d.fecha_inicio ?? cur.inicio,
      cuotas: d.cuotas && d.cuotas.length ? d.cuotas.map((c) => ({ monto: c.monto != null ? String(c.monto) : '', fecha: c.fecha ?? '' })) : cur.cuotas,
    }));
  };

  if (!plan) return (
    <div style={{ ...card, fontSize: 13, color: loadErr ? 'var(--bad)' : 'var(--faint)' }}>
      {loadErr ? <>No se pudo cargar el plan: {loadErr} <button type="button" onClick={() => { setLoadErr(null); load(); }} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}>Reintentar</button></> : 'Cargando plan…'}
    </div>
  );

  // ── LECTURA ──
  if (mode === 'view') {
    const dato = (l: string, v: string) => (<div><div style={lbl}>{l}</div><div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{v}</div></div>);
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={sectLbl}>Plan de pagos</span>
          <button type="button" onClick={entrarEdit} title="Editar plan" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: 13, color: 'var(--dim)' }}>✏️ Editar</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {dato('Total del plan', fmtUSD(plan.total_usd))}
          {dato('Duración', plan.duracion_meses != null ? `${plan.duracion_meses} meses` : '—')}
          {dato('Fecha de cierre', isoToDmy(plan.fecha_cierre) || '—')}
          {dato('Inicio del servicio', isoToDmy(plan.fecha_inicio) || '—')}
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={lbl}>Contrato</div>
          {plan.tiene_contrato
            ? <a href={`/api/contract?leadId=${leadId}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: '#9A6A09', textDecoration: 'none', fontWeight: 600 }}>📄 {plan.contrato_nombre || 'contrato'} · Descargar ↓</a>
            : <span style={{ fontSize: 13, color: 'var(--faint)' }}>Sin contrato. Edita para subirlo.</span>}
        </div>
        <div style={{ ...sectLbl, marginBottom: 8 }}>Cuotas</div>
        {plan.pagos.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>Sin cuotas cargadas.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plan.pagos.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: p.pagado ? 'var(--good-bg)' : 'var(--surface)', border: '1px solid ' + (p.pagado ? 'var(--good)' : 'var(--border)') }}>
                <span style={{ flex: 'none', width: 22, fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>{i + 1}</span>
                <span style={{ flex: 1, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(p.monto_usd)}</span>
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--dim)' }}>vence {isoToDmy(p.fecha_esperada) || '—'}{p.pagado && p.fecha_pago ? ` · pagó ${isoToDmy(p.fecha_pago)}` : ''}</span>
                <button type="button" disabled={pending} onClick={() => toggleCobrado(p)} style={{ flex: 'none', cursor: pending ? 'wait' : 'pointer', borderRadius: 999, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, border: '1px solid ' + (p.pagado ? 'var(--good)' : 'var(--border-strong)'), background: p.pagado ? 'var(--good)' : 'var(--surface)', color: p.pagado ? '#fff' : 'var(--dim)' }}>{p.pagado ? 'Cobrado ✅' : 'Marcar cobrado'}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── EDICIÓN ──
  const setCuota = (i: number, f: 'monto' | 'fecha', v: string) => setE((c) => ({ ...c, cuotas: c.cuotas.map((q, qi) => (qi === i ? { ...q, [f]: v } : q)) }));
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={sectLbl}>Plan de pagos · editando</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><div style={lbl}>Total del plan (USD)</div><input value={e.total} onChange={(ev) => setE({ ...e, total: ev.target.value })} placeholder="0" style={input} /></div>
        <div><div style={lbl}>Duración del servicio (meses)</div><input value={e.duracion} onChange={(ev) => setE({ ...e, duracion: ev.target.value })} placeholder="3" style={input} /></div>
        <div><div style={lbl}>Fecha de cierre</div><input value={e.cierre} onChange={(ev) => setE({ ...e, cierre: ev.target.value })} placeholder="dd/mm/aaaa" style={input} /></div>
        <div><div style={lbl}>Inicio del servicio</div><input value={e.inicio} onChange={(ev) => setE({ ...e, inicio: ev.target.value })} placeholder="dd/mm/aaaa" style={input} /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={lbl}>Contrato</div>
        <ContratoUpload leadId={leadId} onExtract={onExtract} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--faint)', margin: '8px 0' }}>Cuotas (no cobradas)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {e.cuotas.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ flex: 'none', width: 22, fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>{i + 1}</span>
            <input value={c.monto} onChange={(ev) => setCuota(i, 'monto', ev.target.value)} placeholder="Monto cuota" style={{ ...input, flex: 1, width: 'auto' }} />
            <input value={c.fecha} onChange={(ev) => setCuota(i, 'fecha', ev.target.value)} placeholder="Fecha de pago" style={{ ...input, flex: 1, width: 'auto' }} />
            <button type="button" onClick={() => setE((cur) => ({ ...cur, cuotas: cur.cuotas.filter((_, qi) => qi !== i) }))} title="Quitar" style={{ flex: 'none', border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => setE((c) => ({ ...c, cuotas: [...c.cuotas, { monto: '', fecha: '' }] }))} style={{ padding: 9, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>+ Agregar otra cuota</button>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button type="button" disabled={pending} onClick={guardar} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Guardar plan'}</button>
        <button type="button" disabled={pending} onClick={() => setMode('view')} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
}

// Subir contrato (PDF/imagen) → guarda en Storage + OpenAI extrae → autollena.
function ContratoUpload({ leadId, onExtract }: { leadId: number; onExtract: (d: { total_usd: number | null; duracion_meses: number | null; fecha_cierre: string | null; fecha_inicio: string | null; cuotas: Array<{ monto: number | null; fecha: string | null }> }) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'ok' | 'error'>('idle');
  const [nombre, setNombre] = useState('');
  const [err, setErr] = useState('');

  const onFile = async (file: File) => {
    setNombre(file.name); setEstado('cargando'); setErr('');
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('leadId', String(leadId));
      const j = await (await fetch('/api/extract-contract', { method: 'POST', body: fd })).json();
      if (j.error) { setEstado('error'); setErr(j.error); return; }
      onExtract(j); setEstado('ok');
    } catch (ex) { setEstado('error'); setErr(String(ex)); }
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(ev) => { const f = ev.target.files?.[0]; if (f) onFile(f); }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={estado === 'cargando'} style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600, cursor: estado === 'cargando' ? 'wait' : 'pointer', fontFamily: SANS }}>⬆ Subir contrato</button>
        {estado === 'cargando' && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Leyendo {nombre} con OpenAI…</span>}
        {estado === 'ok' && <span style={{ fontSize: 12.5, color: 'var(--good)' }}>✓ {nombre} guardado y leído</span>}
        {estado === 'error' && <span style={{ fontSize: 12.5, color: 'var(--bad)' }}>Error: {err}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6 }}>PDF o imagen. Se guarda (descargable) y OpenAI autollena total, duración, fechas y cuotas.</div>
    </div>
  );
}
