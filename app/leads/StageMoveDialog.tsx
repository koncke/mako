'use client';

// =============================================================================
// StageMoveDialog — wizard progresivo para completar un movimiento de etapa
// =============================================================================
// Diseño tipo asistente MaKo: logo, dots de progreso, una pregunta grande por
// paso, botones grandes y footer Cancelar/Siguiente. El flujo es dinámico:
// "¿Hubo R1?" (cierres sin reunión piden el motivo y saltan lo demás), Fathom
// omitible si la reunión no se grabó, y el plan de pagos son cuotas explícitas
// (primera cuota + "Agregar cuota") que deben cuadrar con el monto de cierre.

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { stageMeta, type Stage } from '@/lib/pipeline';
import { stepsForStage } from '@/lib/stage-requirements';
import type { FathomLink } from '@/lib/leads';
import { completeStageMoveAction, type StageMoveCuota } from './actions';
import type { CrmLead } from './CrmBoard';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const compInput: CSSProperties = { width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', textAlign: 'center' };

export type StageMoveTarget = { to: string; asistioJ1?: boolean | null; asistioJ2?: boolean | null };

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

type PasoId =
  | 'huboR1' | 'motivoNoR1' | 'fechaJ1' | 'asistenciaR1' | 'calificado' | 'fathomR1'
  | 'huboR2' | 'motivoNoR2' | 'fechaJ2' | 'asistenciaR2' | 'fathomR2'
  | 'monto' | 'plan' | 'motivo' | 'resumen';

function BigChoice({ options, value, onPick }: { options: Array<{ v: string; label: string; sub?: string }>; value: string | null; onPick: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onPick(o.v)} style={{ minWidth: 150, padding: '13px 22px', borderRadius: 12, border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border-strong)'), background: active ? 'var(--ink)' : 'var(--surface)', color: active ? '#F3F5F8' : 'var(--ink)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
            {o.label}
            {o.sub && <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 2, opacity: 0.75 }}>{o.sub}</div>}
          </button>
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
  const to = move.to;
  const label = stageMeta(stages, to)?.label ?? to;
  const esCierre = to === 'ganado' || to === 'facturando';

  // ── Respuestas ──
  const [huboR1, setHuboR1] = useState<boolean | null>(lead.fechaJ1 ? true : null);
  const [motivoNoR1, setMotivoNoR1] = useState('');
  const [huboR2, setHuboR2] = useState<boolean | null>(lead.fechaJ2 ? true : null);
  const [motivoNoR2, setMotivoNoR2] = useState('');
  const [fechaJ1, setFechaJ1] = useState(lead.fechaJ1 ?? '');
  const [fechaJ2, setFechaJ2] = useState(lead.fechaJ2 ?? '');
  const [asistioJ1, setAsistioJ1] = useState<boolean | null>(move.asistioJ1 ?? lead.asistioJ1);
  const [asistioJ2, setAsistioJ2] = useState<boolean | null>(move.asistioJ2 ?? lead.asistioJ2);
  const [calificado, setCalificado] = useState<boolean | null>(lead.calificado);
  const [fathom, setFathom] = useState<FathomLink[]>(() => (lead.fathom.length ? lead.fathom : [{ label: 'Llamada', url: '' }]));
  const [fathomOmitido, setFathomOmitido] = useState(false);
  const [monto, setMonto] = useState(lead.monto ? String(lead.monto) : '');
  const [motivo, setMotivo] = useState(lead.motivo ?? '');
  const [cuotas, setCuotas] = useState<Array<{ monto: string; fecha: string }>>([{ monto: '', fecha: hoyISO }]);

  // Pasos que la etapa destino EXIGE con lo que el lead ya tiene (se calcula
  // UNA vez al montar — lazy useState, no depende de las respuestas del wizard).
  const [requeridos] = useState(() => new Set(stepsForStage(to, {
    fechaJ1: lead.fechaJ1, fechaJ2: lead.fechaJ2,
    asistioJ1: move.asistioJ1 ?? lead.asistioJ1, asistioJ2: move.asistioJ2 ?? lead.asistioJ2,
    calificado: lead.calificado,
    hasFathomUrl: lead.fathom.some((f) => f.url?.trim()),
    monto: lead.monto, motivo: lead.motivo, setter: lead.setter,
    tienePlan: to === 'ganado' ? (lead.tienePlan ?? false) : undefined,
    hoyISO,
  }).map((s) => s.id)));

  // ── Flujo DINÁMICO: la lista de pasos visibles depende de las respuestas ──
  const pasos = useMemo<PasoId[]>(() => {
    const p: PasoId[] = [];
    const necesitaR1 = requeridos.has('fechaJ1') || requeridos.has('asistenciaR1') || requeridos.has('calificado') || requeridos.has('fathomR1');
    const necesitaR2 = requeridos.has('fechaJ2') || requeridos.has('asistenciaR2') || requeridos.has('fathomR2');

    if (necesitaR1) {
      // En cierres puede no haber existido la reunión (caso raro): preguntar.
      if (esCierre && !lead.fechaJ1) p.push('huboR1');
      if (huboR1 === false) p.push('motivoNoR1');
      else {
        if (requeridos.has('fechaJ1')) p.push('fechaJ1');
        if (requeridos.has('asistenciaR1')) p.push('asistenciaR1');
        if (asistioJ1 !== false) {
          if (requeridos.has('calificado')) p.push('calificado');
          if (requeridos.has('fathomR1')) p.push('fathomR1');
        }
      }
    }
    // Si no hubo R1, no tiene sentido preguntar por R2.
    if (necesitaR2 && huboR1 !== false) {
      if (esCierre && !lead.fechaJ2) p.push('huboR2');
      if (huboR2 === false) p.push('motivoNoR2');
      else {
        if (requeridos.has('fechaJ2')) p.push('fechaJ2');
        if (requeridos.has('asistenciaR2')) p.push('asistenciaR2');
        if (asistioJ2 !== false && requeridos.has('fathomR2')) p.push('fathomR2');
      }
    }
    if (requeridos.has('monto')) p.push('monto');
    if (requeridos.has('plan')) p.push('plan');
    if (requeridos.has('motivo')) p.push('motivo');
    p.push('resumen');
    return p;
  }, [requeridos, esCierre, lead.fechaJ1, lead.fechaJ2, huboR1, huboR2, asistioJ1, asistioJ2]);

  // Índice actual + historial REAL de pasos visitados (para que Atrás vuelva
  // al paso anterior visitado, no al índice-1 cuando hubo saltos).
  const [idx, setIdx] = useState(0);
  const [visitados, setVisitados] = useState<PasoId[]>([]);
  const paso = pasos[Math.min(idx, pasos.length - 1)];

  const totalMonto = parseFloat(monto) || 0;
  const sumaCuotas = cuotas.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
  const cuotasCuadran = requeridos.has('plan') ? Math.abs(sumaCuotas - totalMonto) < 0.5 && sumaCuotas > 0 : true;

  const respondido = (() => {
    switch (paso) {
      case 'huboR1': return huboR1 != null;
      case 'motivoNoR1': return !!motivoNoR1.trim();
      case 'huboR2': return huboR2 != null;
      case 'motivoNoR2': return !!motivoNoR2.trim();
      case 'fechaJ1': return !!fechaJ1;
      case 'fechaJ2': return !!fechaJ2;
      case 'asistenciaR1': return asistioJ1 != null;
      case 'asistenciaR2': return asistioJ2 != null;
      case 'calificado': return calificado != null;
      case 'fathomR1': case 'fathomR2': return fathomOmitido || fathom.some((f) => f.url.trim());
      case 'monto': return totalMonto > 0;
      case 'plan': return cuotasCuadran;
      case 'motivo': return !!motivo.trim();
      default: return true;
    }
  })();

  const avanzar = () => {
    setErr(null);
    setVisitados((v) => [...v, paso]);
    setIdx((i) => Math.min(i + 1, pasos.length - 1));
  };
  const atras = () => {
    setErr(null);
    // Volver al ÚLTIMO paso visitado (aunque la lista haya cambiado por saltos).
    const prev = visitados[visitados.length - 1];
    if (!prev) { onClose(); return; }
    setVisitados((v) => v.slice(0, -1));
    const i = pasos.indexOf(prev);
    setIdx(i >= 0 ? i : Math.max(0, idx - 1));
  };

  const confirmar = () => {
    setErr(null);
    startTransition(async () => {
      try {
        const cuotasPayload: StageMoveCuota[] = requeridos.has('plan')
          ? cuotas.filter((c) => parseFloat(c.monto) > 0).map((c) => ({ monto: parseFloat(c.monto), fecha: c.fecha || null }))
          : [];
        await completeStageMoveAction(lead.id, to, {
          ...(pasos.includes('fechaJ1') && huboR1 !== false ? { fechaJ1: fechaJ1 || null } : {}),
          ...(pasos.includes('fechaJ2') && huboR2 !== false ? { fechaJ2: fechaJ2 || null } : {}),
          ...(pasos.includes('asistenciaR1') ? { asistioJ1 } : { asistioJ1: move.asistioJ1 }),
          ...(pasos.includes('asistenciaR2') ? { asistioJ2 } : { asistioJ2: move.asistioJ2 }),
          ...(pasos.includes('calificado') ? { calificado } : {}),
          ...(pasos.includes('fathomR1') || pasos.includes('fathomR2') ? { fathom: fathom.filter((f) => f.url.trim() || f.label.trim()) } : {}),
          ...(pasos.includes('monto') ? { monto: totalMonto || null } : {}),
          ...(pasos.includes('motivo') ? { motivo: motivo.trim() || null } : {}),
          ...(cuotasPayload.length ? { cuotas: cuotasPayload } : {}),
          sinR1Motivo: huboR1 === false ? motivoNoR1.trim() : null,
          sinR2Motivo: huboR1 !== false && huboR2 === false ? motivoNoR2.trim() : null,
          fathomOmitido,
        });
        onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  };

  // ── Render del paso ──
  const sugerencias = ['Precio', 'Timing', 'No calificado', 'Fantasma', 'Otro'];
  let pregunta = '';
  let sub = '';
  let cuerpo: ReactNode = null;
  const boolStep = (value: boolean | null, set: (v: boolean) => void, si: string, no: string) => (
    <BigChoice value={value == null ? null : String(value)} onPick={(v) => set(v === 'true')} options={[{ v: 'true', label: si }, { v: 'false', label: no }]} />
  );

  switch (paso) {
    case 'huboR1':
      pregunta = '¿Hubo Reunión 1?';
      sub = 'Hay cierres raros sin reunión — si no la hubo, contanos por qué.';
      cuerpo = boolStep(huboR1, setHuboR1, 'Sí, hubo R1', 'No hubo R1');
      break;
    case 'motivoNoR1':
      pregunta = '¿Por qué no hubo Reunión 1?';
      cuerpo = <textarea value={motivoNoR1} onChange={(e) => setMotivoNoR1(e.target.value)} placeholder="Ej: cerró directo por WhatsApp, cliente referido…" autoFocus style={{ ...compInput, minHeight: 80, textAlign: 'left', lineHeight: 1.5 }} />;
      break;
    case 'huboR2':
      pregunta = '¿Hubo Reunión 2?';
      cuerpo = boolStep(huboR2, setHuboR2, 'Sí, hubo R2', 'No hubo R2');
      break;
    case 'motivoNoR2':
      pregunta = '¿Por qué no hubo Reunión 2?';
      cuerpo = <textarea value={motivoNoR2} onChange={(e) => setMotivoNoR2(e.target.value)} placeholder="Ej: cerró en la misma R1…" autoFocus style={{ ...compInput, minHeight: 80, textAlign: 'left', lineHeight: 1.5 }} />;
      break;
    case 'fechaJ1':
      pregunta = '¿Cuándo es (o fue) la Reunión 1?';
      cuerpo = <input type="date" value={fechaJ1} onChange={(e) => setFechaJ1(e.target.value)} autoFocus style={{ ...compInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />;
      break;
    case 'fechaJ2':
      pregunta = '¿Cuándo es (o fue) la Reunión 2?';
      cuerpo = <input type="date" value={fechaJ2} onChange={(e) => setFechaJ2(e.target.value)} autoFocus style={{ ...compInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />;
      break;
    case 'asistenciaR1':
      pregunta = '¿Asistió a la Reunión 1?';
      cuerpo = boolStep(asistioJ1, setAsistioJ1, 'Sí, asistió', 'No asistió');
      break;
    case 'asistenciaR2':
      pregunta = '¿Asistió a la Reunión 2?';
      cuerpo = boolStep(asistioJ2, setAsistioJ2, 'Sí, asistió', 'No asistió');
      break;
    case 'calificado':
      pregunta = '¿Era un lead calificado?';
      sub = 'Este dato entrena las campañas de Meta (CAPI): marcalo siempre.';
      cuerpo = boolStep(calificado, setCalificado, 'Sí, calificado', 'No calificado');
      break;
    case 'fathomR1':
    case 'fathomR2':
      pregunta = `Link de Fathom de la ${paso === 'fathomR1' ? 'Reunión 1' : 'Reunión 2'}`;
      sub = 'Si la reunión no se grabó, podés omitirlo.';
      cuerpo = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fathom.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input aria-label="Etiqueta" value={f.label} onChange={(e) => setFathom((arr) => arr.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))} placeholder="Llamada" style={{ ...compInput, flex: 'none', width: 110, textAlign: 'left' }} />
              <input aria-label="URL" value={f.url} onChange={(e) => { setFathomOmitido(false); setFathom((arr) => arr.map((x, xi) => (xi === i ? { ...x, url: e.target.value } : x))); }} placeholder="https://fathom.video/…" autoFocus={i === 0} style={{ ...compInput, flex: 1, textAlign: 'left' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button type="button" onClick={() => setFathom((arr) => [...arr, { label: '', url: '' }])} style={{ padding: 8, borderRadius: 9, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: SANS, flex: 1 }}>+ Agregar otro link</button>
            <button type="button" onClick={() => setFathomOmitido(true)} style={{ padding: 8, borderRadius: 9, border: '1px solid ' + (fathomOmitido ? 'var(--warn-fill)' : 'var(--border-strong)'), background: fathomOmitido ? 'var(--warn-bg)' : 'transparent', color: fathomOmitido ? 'var(--warn)' : 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>{fathomOmitido ? 'Sin grabación ✓' : 'No se grabó (omitir)'}</button>
          </div>
        </div>
      );
      break;
    case 'monto':
      pregunta = '¿De cuánto fue el cierre?';
      sub = 'En USD.';
      cuerpo = <input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" autoFocus style={{ ...compInput, maxWidth: 220, margin: '0 auto', display: 'block', fontSize: 22, fontWeight: 700 }} />;
      break;
    case 'motivo':
      pregunta = '¿Por qué se perdió o descalificó?';
      cuerpo = (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10, justifyContent: 'center' }}>
            {sugerencias.map((s) => {
              const active = motivo.trim().toLowerCase() === s.toLowerCase();
              return <button key={s} type="button" onClick={() => setMotivo(s)} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: SANS, cursor: 'pointer', background: active ? 'rgba(47,111,237,.10)' : 'var(--surface)', border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border-strong)'), color: active ? 'var(--primary)' : 'var(--dim)' }}>{s}</button>;
            })}
          </div>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Contá el contexto…" style={{ ...compInput, minHeight: 74, textAlign: 'left', lineHeight: 1.5 }} />
        </div>
      );
      break;
    case 'plan':
      pregunta = '¿Cómo se van a cobrar las cuotas?';
      sub = `Las cuotas tienen que sumar el monto de cierre (${totalMonto ? '$' + totalMonto.toLocaleString('en-US') : 'definilo en el paso anterior'}).`;
      cuerpo = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cuotas.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 'none', width: 70, fontSize: 13, fontWeight: 600, color: 'var(--dim)', textAlign: 'left' }}>Cuota {i + 1}</span>
              <input inputMode="numeric" value={c.monto} onChange={(e) => setCuotas((arr) => arr.map((x, xi) => (xi === i ? { ...x, monto: e.target.value } : x)))} placeholder={i === 0 ? 'Monto primera cuota' : 'Monto'} style={{ ...compInput, flex: 1, textAlign: 'left' }} />
              <input type="date" value={c.fecha} onChange={(e) => setCuotas((arr) => arr.map((x, xi) => (xi === i ? { ...x, fecha: e.target.value } : x)))} style={{ ...compInput, flex: 'none', width: 160, textAlign: 'left' }} />
              {i > 0 && <button type="button" onClick={() => setCuotas((arr) => arr.filter((_, xi) => xi !== i))} aria-label="Quitar cuota" style={{ flex: 'none', background: 'transparent', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>✕</button>}
            </div>
          ))}
          <button type="button" onClick={() => { const last = cuotas[cuotas.length - 1]; const d = last?.fecha ? new Date(last.fecha + 'T00:00:00Z') : new Date(); d.setUTCMonth(d.getUTCMonth() + 1); setCuotas((arr) => [...arr, { monto: '', fecha: d.toISOString().slice(0, 10) }]); }} style={{ padding: 10, borderRadius: 10, border: '1.5px dashed var(--border-strong)', background: 'transparent', color: 'var(--primary)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>+ Agregar cuota</button>
          {sumaCuotas > 0 && (
            <div style={{ borderRadius: 10, padding: '9px 13px', fontSize: 13, fontWeight: 600, background: cuotasCuadran ? 'var(--good-bg)' : 'var(--bad-bg)', color: cuotasCuadran ? 'var(--good)' : 'var(--bad)', textAlign: 'left' }}>
              {cuotasCuadran
                ? `Cuadra: las cuotas suman $${sumaCuotas.toLocaleString('en-US')}.`
                : `Las cuotas suman $${sumaCuotas.toLocaleString('en-US')} y ${sumaCuotas > totalMonto ? 'exceden' : 'no alcanzan'} el cierre de $${totalMonto.toLocaleString('en-US')}.`}
            </div>
          )}
        </div>
      );
      break;
    case 'resumen': {
      const filas: Array<[string, string]> = [];
      if (huboR1 === false) filas.push(['Sin R1', motivoNoR1]);
      else {
        if (pasos.includes('fechaJ1')) filas.push(['Fecha R1', fechaJ1 || '—']);
        if (pasos.includes('asistenciaR1')) filas.push(['Asistió R1', asistioJ1 ? 'Sí' : 'No']);
        if (pasos.includes('calificado')) filas.push(['Calificado', calificado ? 'Sí' : 'No']);
      }
      if (huboR1 !== false) {
        if (huboR2 === false) filas.push(['Sin R2', motivoNoR2]);
        else {
          if (pasos.includes('fechaJ2')) filas.push(['Fecha R2', fechaJ2 || '—']);
          if (pasos.includes('asistenciaR2')) filas.push(['Asistió R2', asistioJ2 ? 'Sí' : 'No']);
        }
      }
      if (pasos.includes('fathomR1') || pasos.includes('fathomR2')) filas.push(['Fathom', fathomOmitido ? 'Sin grabación' : `${fathom.filter((f) => f.url.trim()).length} link(s)`]);
      if (pasos.includes('monto')) filas.push(['Monto de cierre', totalMonto ? `$${totalMonto.toLocaleString('en-US')}` : '—']);
      if (pasos.includes('plan')) filas.push(['Cuotas', `${cuotas.filter((c) => parseFloat(c.monto) > 0).length} (suman $${sumaCuotas.toLocaleString('en-US')})`]);
      if (pasos.includes('motivo')) filas.push(['Motivo', motivo || '—']);
      pregunta = filas.length ? 'Revisá y confirmá' : 'Confirmá el movimiento';
      cuerpo = filas.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {filas.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, padding: '9px 13px', background: 'var(--surface-2)', borderRadius: 10, textAlign: 'left' }}>
              <span style={{ color: 'var(--dim)' }}>{k}</span><span style={{ color: 'var(--ink)', fontWeight: 600, maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
            </div>
          ))}
        </div>
      ) : <p style={{ fontSize: 14, color: 'var(--dim)' }}>No falta ningún dato: el lead pasa a {label}.</p>;
      break;
    }
  }

  const enResumen = paso === 'resumen';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 640, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* Header: logo · dots de progreso · cerrar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px' }}>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {pasos.map((p, i) => (
              <span key={p + i} style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 999, background: i === idx ? 'var(--primary)' : i < idx ? 'var(--primary-weak, #B9CDF8)' : 'var(--border)', transition: 'width .2s' }} />
            ))}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14, fontFamily: SANS }}>✕</button>
        </div>

        {/* Cuerpo centrado: una pregunta por paso */}
        <div style={{ padding: '26px clamp(20px,6vw,56px) 30px', textAlign: 'center' }}>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', fontFamily: MONO, marginBottom: 8 }}>Mover a {label} · {lead.name}</div>
          <h3 style={{ fontSize: 'clamp(20px,4vw,26px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 6px', fontFamily: SANS }}>{pregunta}</h3>
          {sub && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 18px' }}>{sub}</p>}
          {!sub && <div style={{ height: 12 }} />}
          <div style={{ maxWidth: 520, margin: '0 auto' }}>{cuerpo}</div>
          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{err}</div>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button onClick={atras} style={{ padding: '11px 20px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>← {visitados.length === 0 ? 'Cancelar' : 'Atrás'}</button>
          {enResumen ? (
            <button onClick={confirmar} disabled={pending} style={{ padding: '12px 26px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : 'Confirmar y mover'}</button>
          ) : (
            <button onClick={avanzar} disabled={!respondido} style={{ padding: '12px 26px', borderRadius: 11, border: 'none', background: respondido ? 'var(--primary)' : 'var(--border)', color: respondido ? '#fff' : 'var(--faint)', fontSize: 14.5, fontWeight: 700, cursor: respondido ? 'pointer' : 'default', fontFamily: SANS }}>Siguiente →</button>
          )}
        </div>
      </div>
    </div>
  );
}
