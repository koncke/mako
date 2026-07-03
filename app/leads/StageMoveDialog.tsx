'use client';

// =============================================================================
// StageMoveDialog — wizard progresivo para completar un movimiento de etapa
// =============================================================================
// Una pregunta por paso (nunca un formulario largo): el motor de requisitos
// acumulativos (lib/stage-requirements) decide qué falta para llegar a la etapa
// destino (fechas → asistencia → calificado → Fathom → monto → plan) y este
// wizard lo pide paso a paso, con resumen final antes de confirmar.

import { useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { stageMeta, type Stage } from '@/lib/pipeline';
import { stepsForStage, type Step } from '@/lib/stage-requirements';
import type { FathomLink } from '@/lib/leads';
import { completeStageMoveAction } from './actions';
import type { CrmLead } from './CrmBoard';

const SANS = "'Geist', sans-serif";
const compInput: CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14.5, outline: 'none' };

export type StageMoveTarget = { to: string; asistioJ1?: boolean | null; asistioJ2?: boolean | null };

/** Datos mínimos del lead que el wizard necesita (sirven CrmLead o Lead crudo). */
export type MoveLeadInfo = {
  id: number;
  name: string;
  fechaJ1: string | null;
  fechaJ2: string | null;
  asistioJ1: boolean | null;
  asistioJ2: boolean | null;
  calificado: boolean | null;
  fathom: FathomLink[];
  monto: number | null;
  motivo: string | null;
  setter: string | null;
  tienePlan?: boolean;
};

export function leadToMoveInfo(l: CrmLead): MoveLeadInfo {
  return { id: l.id, name: l.name, fechaJ1: l.fechaJ1, fechaJ2: l.fechaJ2, asistioJ1: l.asistioJ1, asistioJ2: l.asistioJ2, calificado: l.calificado, fathom: l.fathom, monto: l.monto || null, motivo: l.motivo || null, setter: l.setter || null };
}

type PlanModo = 'unico' | 'cuotas' | 'inicial_cuotas';

function BoolStep({ value, onChange, si, no }: { value: boolean | null; onChange: (v: boolean) => void; si: string; no: string }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[[true, si], [false, no]].map(([v, lbl]) => {
        const active = value === v;
        return (
          <button key={String(v)} type="button" onClick={() => onChange(v as boolean)} style={{ flex: 1, padding: '14px 10px', borderRadius: 11, border: '1px solid ' + (active ? (v ? 'var(--good)' : 'var(--bad)') : 'var(--border-strong)'), background: active ? (v ? 'var(--good-bg)' : 'var(--bad-bg)') : 'var(--surface)', color: active ? (v ? 'var(--good)' : 'var(--bad)') : 'var(--dim)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{lbl as string}</button>
        );
      })}
    </div>
  );
}

export function StageMoveDialog({ lead, stages, move, onDone, onClose }: {
  lead: MoveLeadInfo;
  stages: Stage[];
  move: StageMoveTarget;
  onDone: () => void;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const hoyISO = new Date().toISOString().slice(0, 10);

  // Respuestas del wizard (semilla = lo que el lead ya tiene).
  const [fechaJ1, setFechaJ1] = useState(lead.fechaJ1 ?? '');
  const [fechaJ2, setFechaJ2] = useState(lead.fechaJ2 ?? '');
  const [asistioJ1, setAsistioJ1] = useState<boolean | null>(move.asistioJ1 ?? lead.asistioJ1);
  const [asistioJ2, setAsistioJ2] = useState<boolean | null>(move.asistioJ2 ?? lead.asistioJ2);
  const [calificado, setCalificado] = useState<boolean | null>(lead.calificado);
  const [monto, setMonto] = useState(lead.monto ? String(lead.monto) : '');
  const [motivo, setMotivo] = useState(lead.motivo ?? '');
  const [fathom, setFathom] = useState<FathomLink[]>(() => (lead.fathom.length ? lead.fathom : [{ label: 'Llamada', url: '' }]));
  const [planModo, setPlanModo] = useState<PlanModo>('unico');
  const [planInicial, setPlanInicial] = useState('');
  const [planCuota, setPlanCuota] = useState('');
  const [planN, setPlanN] = useState('2');
  const [planDia, setPlanDia] = useState('1');
  const [extrayendo, setExtrayendo] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Pasos que faltan, calculados UNA vez al abrir (con lo que el lead ya tiene).
  const pasos = useMemo<Step[]>(() => {
    const s = stepsForStage(move.to, {
      fechaJ1: lead.fechaJ1, fechaJ2: lead.fechaJ2,
      asistioJ1: move.asistioJ1 ?? lead.asistioJ1, asistioJ2: move.asistioJ2 ?? lead.asistioJ2,
      calificado: lead.calificado,
      hasFathomUrl: lead.fathom.some((f) => f.url?.trim()),
      monto: lead.monto, motivo: lead.motivo, setter: lead.setter,
      tienePlan: move.to === 'ganado' ? (lead.tienePlan ?? false) : undefined,
      hoyISO,
    });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [idx, setIdx] = useState(0);
  const enResumen = idx >= pasos.length;
  const paso = pasos[idx];
  const label = stageMeta(stages, move.to)?.label ?? move.to;

  // ¿El paso actual está respondido? (para habilitar Siguiente)
  const respondido = (() => {
    if (!paso) return true;
    switch (paso.id) {
      case 'fechaJ1': return !!fechaJ1;
      case 'fechaJ2': return !!fechaJ2;
      case 'asistenciaR1': return asistioJ1 != null;
      case 'asistenciaR2': return asistioJ2 != null;
      case 'calificado': return calificado != null;
      case 'fathomR1': case 'fathomR2': return fathom.some((f) => f.url.trim());
      case 'monto': return parseFloat(monto) > 0;
      case 'motivo': return !!motivo.trim();
      case 'plan': {
        if (planModo === 'unico') return parseFloat(planInicial) > 0;
        if (planModo === 'cuotas') return parseFloat(planCuota) > 0 && parseInt(planN, 10) > 0;
        return parseFloat(planInicial) > 0 && parseFloat(planCuota) > 0 && parseInt(planN, 10) > 0;
      }
      default: return true;
    }
  })();

  // Si marcó que NO asistió, los pasos de calificado/fathom de esa reunión sobran.
  const saltear = (i: number): number => {
    let j = i;
    while (j < pasos.length) {
      const p = pasos[j];
      if (asistioJ1 === false && (p.id === 'calificado' || p.id === 'fathomR1')) { j++; continue; }
      if (asistioJ2 === false && p.id === 'fathomR2') { j++; continue; }
      break;
    }
    return j;
  };
  const avanzar = () => { setErr(null); setIdx((i) => saltear(i + 1)); };
  const volver = () => { setErr(null); setIdx((i) => Math.max(0, i - 1)); };

  const subirContrato = async (file: File) => {
    setExtrayendo(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('leadId', String(lead.id));
      const r = await fetch('/api/extract-contract', { method: 'POST', body: fd });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      const cuotas: Array<{ monto?: number; fecha?: string }> = Array.isArray(j.cuotas) ? j.cuotas : [];
      const inicial = Number(cuotas[0]?.monto) || Number(j.total_usd) || 0;
      const resto = cuotas.slice(1);
      if (resto.length) {
        setPlanModo('inicial_cuotas');
        setPlanInicial(String(inicial));
        setPlanCuota(String(Number(resto[0]?.monto) || 0));
        setPlanN(String(resto.length));
        const dia = resto[0]?.fecha ? parseInt(String(resto[0].fecha).slice(8, 10), 10) : NaN;
        if (Number.isFinite(dia) && dia >= 1 && dia <= 28) setPlanDia(String(dia));
      } else {
        setPlanModo('unico');
        setPlanInicial(String(inicial));
      }
      if (!monto && j.total_usd) setMonto(String(j.total_usd));
    } catch (e) {
      setErr(`No se pudo leer el contrato: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExtrayendo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmar = () => {
    setErr(null);
    startTransition(async () => {
      try {
        const incluyePlan = pasos.some((p) => p.id === 'plan');
        await completeStageMoveAction(lead.id, move.to, {
          ...(pasos.some((p) => p.id === 'fechaJ1') ? { fechaJ1: fechaJ1 || null } : {}),
          ...(pasos.some((p) => p.id === 'fechaJ2') ? { fechaJ2: fechaJ2 || null } : {}),
          ...(pasos.some((p) => p.id === 'asistenciaR1') ? { asistioJ1 } : { asistioJ1: move.asistioJ1 }),
          ...(pasos.some((p) => p.id === 'asistenciaR2') ? { asistioJ2 } : { asistioJ2: move.asistioJ2 }),
          ...(pasos.some((p) => p.id === 'calificado') ? { calificado } : {}),
          ...(pasos.some((p) => p.id === 'fathomR1' || p.id === 'fathomR2') ? { fathom: fathom.filter((f) => f.url.trim() || f.label.trim()) } : {}),
          ...(pasos.some((p) => p.id === 'monto') ? { monto: parseFloat(monto) || null } : {}),
          ...(pasos.some((p) => p.id === 'motivo') ? { motivo: motivo.trim() || null } : {}),
          ...(incluyePlan ? {
            plan: {
              cobro_inicial_usd: planModo === 'cuotas' ? null : (parseFloat(planInicial) || null),
              monto_cuota_usd: planModo === 'unico' ? null : (parseFloat(planCuota) || null),
              total_cuotas: planModo === 'unico' ? null : (parseInt(planN, 10) || null),
              dia_de_pago: planModo === 'unico' ? null : (parseInt(planDia, 10) || null),
            },
          } : {}),
        });
        onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const sugerencias = ['Precio', 'Timing', 'No calificado', 'Fantasma', 'Otro'];
  const fmt = (v: string | null | undefined) => (v && v.trim() ? v : '—');
  const boolTxt = (v: boolean | null) => (v === true ? 'Sí' : v === false ? 'No' : '—');

  // Contenido del paso actual.
  let cuerpo: ReactNode = null;
  let pregunta = '';
  if (paso) {
    switch (paso.id) {
      case 'fechaJ1':
        pregunta = '¿Cuándo es (o fue) la Reunión 1?';
        cuerpo = <input type="date" value={fechaJ1} onChange={(e) => setFechaJ1(e.target.value)} autoFocus style={compInput} />;
        break;
      case 'fechaJ2':
        pregunta = '¿Cuándo es (o fue) la Reunión 2?';
        cuerpo = <input type="date" value={fechaJ2} onChange={(e) => setFechaJ2(e.target.value)} autoFocus style={compInput} />;
        break;
      case 'asistenciaR1':
        pregunta = '¿Asistió a la Reunión 1?';
        cuerpo = <BoolStep value={asistioJ1} onChange={setAsistioJ1} si="Sí, asistió" no="No asistió" />;
        break;
      case 'asistenciaR2':
        pregunta = '¿Asistió a la Reunión 2?';
        cuerpo = <BoolStep value={asistioJ2} onChange={setAsistioJ2} si="Sí, asistió" no="No asistió" />;
        break;
      case 'calificado':
        pregunta = '¿Era un lead calificado?';
        cuerpo = (
          <>
            <BoolStep value={calificado} onChange={setCalificado} si="Sí, calificado" no="No calificado" />
            <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 10 }}>Este dato entrena las campañas de Meta (CAPI): marcalo siempre.</p>
          </>
        );
        break;
      case 'fathomR1':
      case 'fathomR2':
        pregunta = `Link de Fathom de la ${paso.id === 'fathomR1' ? 'Reunión 1' : 'Reunión 2'}`;
        cuerpo = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fathom.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <input aria-label="Etiqueta" value={f.label} onChange={(e) => setFathom((arr) => arr.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))} placeholder="Llamada" style={{ ...compInput, flex: 'none', width: 105 }} />
                <input aria-label="URL" value={f.url} onChange={(e) => setFathom((arr) => arr.map((x, xi) => (xi === i ? { ...x, url: e.target.value } : x)))} placeholder="https://fathom.video/…" autoFocus={i === 0} style={{ ...compInput, flex: 1 }} />
              </div>
            ))}
            <button type="button" onClick={() => setFathom((arr) => [...arr, { label: '', url: '' }])} style={{ padding: 8, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: SANS }}>+ Agregar otro link</button>
          </div>
        );
        break;
      case 'monto':
        pregunta = '¿De cuánto fue el cierre? (USD)';
        cuerpo = <input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" autoFocus style={compInput} />;
        break;
      case 'motivo':
        pregunta = '¿Por qué se perdió o descalificó?';
        cuerpo = (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
              {sugerencias.map((s) => {
                const active = motivo.trim().toLowerCase() === s.toLowerCase();
                return <button key={s} type="button" onClick={() => setMotivo(s)} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: SANS, cursor: 'pointer', background: active ? 'rgba(47,111,237,.10)' : 'var(--surface)', border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border-strong)'), color: active ? 'var(--primary)' : 'var(--dim)' }}>{s}</button>;
              })}
            </div>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Contá el contexto…" style={{ ...compInput, minHeight: 70, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        );
        break;
      case 'plan':
        pregunta = '¿Cómo va a pagar?';
        cuerpo = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, gap: 4, flexWrap: 'wrap' }}>
                {([['unico', 'Un solo pago'], ['cuotas', 'Cuotas'], ['inicial_cuotas', 'Inicial + cuotas']] as Array<[PlanModo, string]>).map(([m, lbl]) => (
                  <button key={m} type="button" onClick={() => setPlanModo(m)} style={{ padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, background: planModo === m ? 'var(--ink)' : 'transparent', color: planModo === m ? 'var(--on-sidebar)' : 'var(--dim)' }}>{lbl}</button>
                ))}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirContrato(f); }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={extrayendo} style={{ padding: '8px 13px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, opacity: extrayendo ? 0.6 : 1 }}>{extrayendo ? 'Leyendo contrato…' : 'Subir contrato y rellenar solo'}</button>
            </div>
            {(planModo === 'unico' || planModo === 'inicial_cuotas') && (
              <label><span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{planModo === 'unico' ? 'Monto del pago (USD)' : 'Cobro inicial (USD)'}</span><input inputMode="numeric" value={planInicial} onChange={(e) => setPlanInicial(e.target.value)} style={{ ...compInput, marginTop: 5 }} /></label>
            )}
            {planModo !== 'unico' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label><span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Cuota (USD)</span><input inputMode="numeric" value={planCuota} onChange={(e) => setPlanCuota(e.target.value)} style={{ ...compInput, marginTop: 5 }} /></label>
                <label><span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Cuotas</span><input inputMode="numeric" value={planN} onChange={(e) => setPlanN(e.target.value)} style={{ ...compInput, marginTop: 5 }} /></label>
                <label><span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Día de pago</span><input inputMode="numeric" value={planDia} onChange={(e) => setPlanDia(e.target.value)} style={{ ...compInput, marginTop: 5 }} /></label>
              </div>
            )}
          </div>
        );
        break;
      case 'setter':
        pregunta = '¿Qué setter lo va a trabajar?';
        cuerpo = <input value={lead.setter ?? ''} readOnly style={compInput} />;
        break;
    }
  }

  const resumen: Array<[string, string]> = [];
  for (const p of pasos) {
    if (asistioJ1 === false && (p.id === 'calificado' || p.id === 'fathomR1')) continue;
    if (asistioJ2 === false && p.id === 'fathomR2') continue;
    switch (p.id) {
      case 'fechaJ1': resumen.push(['Fecha R1', fmt(fechaJ1)]); break;
      case 'fechaJ2': resumen.push(['Fecha R2', fmt(fechaJ2)]); break;
      case 'asistenciaR1': resumen.push(['Asistió R1', boolTxt(asistioJ1)]); break;
      case 'asistenciaR2': resumen.push(['Asistió R2', boolTxt(asistioJ2)]); break;
      case 'calificado': resumen.push(['Calificado', boolTxt(calificado)]); break;
      case 'fathomR1': case 'fathomR2': resumen.push(['Fathom', `${fathom.filter((f) => f.url.trim()).length} link(s)`]); break;
      case 'monto': resumen.push(['Monto de cierre', monto ? `$${monto}` : '—']); break;
      case 'motivo': resumen.push(['Motivo', fmt(motivo)]); break;
      case 'plan': resumen.push(['Plan', planModo === 'unico' ? `Pago único $${planInicial}` : planModo === 'cuotas' ? `${planN} cuotas de $${planCuota}` : `$${planInicial} inicial + ${planN} × $${planCuota}`]); break;
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)', fontFamily: SANS, marginBottom: 4 }}>
          Mover a {label} · {lead.name}{pasos.length > 0 && !enResumen ? ` · ${Math.min(idx + 1, pasos.length)}/${pasos.length}` : ''}
        </div>

        {pasos.length === 0 || enResumen ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>{pasos.length === 0 ? 'Confirmá el movimiento' : 'Revisá y confirmá'}</div>
            {resumen.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 6 }}>
                {resumen.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 9 }}>
                    <span style={{ color: 'var(--dim)' }}>{k}</span><span style={{ color: 'var(--ink)', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>{pregunta}</div>
            {cuerpo}
          </>
        )}

        {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', fontWeight: 600, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18 }}>
          <button onClick={idx === 0 ? onClose : volver} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>{idx === 0 ? 'Cancelar' : '← Atrás'}</button>
          {enResumen || pasos.length === 0 ? (
            <button onClick={confirmar} disabled={pending} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Confirmar y mover'}</button>
          ) : (
            <button onClick={avanzar} disabled={!respondido} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: respondido ? 'var(--primary)' : 'var(--border)', color: respondido ? '#fff' : 'var(--ink)', fontSize: 14, fontWeight: 700, cursor: respondido ? 'pointer' : 'default', fontFamily: SANS }}>Siguiente →</button>
          )}
        </div>
      </div>
    </div>
  );
}
