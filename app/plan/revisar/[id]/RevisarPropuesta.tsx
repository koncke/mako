'use client';

// =============================================================================
// RevisarPropuesta — el dueño O el cliente responde el borrador de MaKo, de a 1
// =============================================================================
// SOLO wizard (WizardShell), nada de editor: preguntas de a UNA (ChoiceBody) →
// bajas sugeridas (checkbox, si hay) → confirmar. Al crear, las tareas las prioriza
// y describe el PERRO (nadie toca la prioridad a mano acá) y la revisión final se ve
// en el plan (modal "MaKo cargó tareas"). Las respuestas viajan como CONTEXTO al Perro.

import { useState, useEffect, type CSSProperties } from 'react';
import { WizardShell } from '../../../_components/WizardShell';
import { ChoiceBody } from '../../board/guardian-form';
import type { Propuesta, PropuestaPregunta } from '@/lib/plan-propuesta';

const SANS = "'Geist', sans-serif";

// Loader mientras MaKo genera las repreguntas dinámicas — un spinner, NO el input.
function DynLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '18px 0' }}>
      <style>{'@keyframes mkSpin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'mkSpin .8s linear infinite' }} />
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>Analizando tus respuestas para profundizar…</span>
    </div>
  );
}

// Cuerpo de una pregunta según su FORMATO: opción (default), multi (varias), escala 1-5,
// o texto libre. Así MaKo puede variar el tipo de pregunta, no solo multiple-choice.
function PreguntaBody({ q, value, onChange }: { q: PropuestaPregunta; value: string; onChange: (v: string) => void }) {
  const box = (on: boolean): CSSProperties => ({ display: 'flex', gap: 9, alignItems: 'center', textAlign: 'left', width: '100%', background: on ? 'var(--primary-bg)' : 'var(--surface-2)', border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontFamily: SANS, fontSize: 13.5, color: 'var(--ink)' });
  const check = (on: boolean): CSSProperties => ({ width: 15, height: 15, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' });
  if (q.tipo === 'escala') {
    return <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>{[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(String(n))} style={{ width: 46, height: 46, borderRadius: 11, border: `1px solid ${value === String(n) ? 'var(--primary)' : 'var(--border-strong)'}`, background: value === String(n) ? 'var(--primary)' : 'var(--surface)', color: value === String(n) ? '#fff' : 'var(--ink)', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{n}</button>
    ))}</div>;
  }
  if (q.tipo === 'multi') {
    const sel = new Set(value ? value.split(' · ') : []);
    const toggle = (o: string) => { const c = new Set(sel); if (c.has(o)) c.delete(o); else c.add(o); onChange([...c].join(' · ')); };
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{q.opciones.map((o) => (
      <button key={o} type="button" onClick={() => toggle(o)} style={box(sel.has(o))}><span style={check(sel.has(o))}>{sel.has(o) ? '✓' : ''}</span>{o}</button>
    ))}</div>;
  }
  if (q.tipo === 'texto') {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder="Escribí tu respuesta…" rows={3} style={{ width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', resize: 'vertical' }} />;
  }
  if (q.tipo === 'comparacion') {
    // Dos (o más) ítems ENFRENTADos: el dueño marca cuál pesa más; es una SEÑAL para el
    // Perro, no una orden (el Perro compara y decide con su propio criterio).
    return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(2, q.opciones.length)}, 1fr)`, gap: 10, alignItems: 'stretch' }}>{q.opciones.map((o) => (
      <button key={o} type="button" onClick={() => onChange(o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 76, padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, background: value === o ? 'var(--primary-bg)' : 'var(--surface-2)', border: `1.5px solid ${value === o ? 'var(--primary)' : 'var(--border)'}`, color: value === o ? 'var(--primary)' : 'var(--ink)', lineHeight: 1.35 }}>{o}</button>
    ))}</div>;
  }
  return <ChoiceBody opciones={q.opciones} value={value} onChange={onChange} />;
}

function Mensaje({ texto, sub, ok }: { texto: string; sub?: string; ok?: boolean }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, padding: 24 }}>
      <div style={{ textAlign: 'center', padding: '26px 30px', background: ok ? 'var(--good-bg)' : 'var(--surface)', border: `1px solid ${ok ? '#BFE6CD' : 'var(--border)'}`, borderRadius: 16, maxWidth: 420 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: ok ? 'var(--good)' : 'var(--ink)' }}>{texto}</div>
        {sub ? <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 6 }}>{sub}</div>
          : <a href="/plan" style={{ display: 'inline-block', marginTop: 14, padding: '9px 18px', borderRadius: 9, background: 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>Ir al plan</a>}
      </div>
    </main>
  );
}

type Step = { kind: 'q'; i: number } | { kind: 'dyn'; i: number } | { kind: 'elim' } | { kind: 'confirm' };

export function RevisarPropuesta({ prop }: { prop: Propuesta }) {
  const [paso, setPaso] = useState(0);
  const [resp, setResp] = useState<Record<number, string>>({});
  const [elimSel, setElimSel] = useState<Set<string>>(new Set(prop.eliminar.map((e) => e.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'' | 'aplicada' | 'descartada'>('');
  // Formulario DINÁMICO: tras las preguntas iniciales, MaKo genera repreguntas de
  // contexto según lo respondido. Se piden UNA vez (dynFetched) y se insertan como pasos.
  const [dynQs, setDynQs] = useState<PropuestaPregunta[]>([]);
  const [dynResp, setDynResp] = useState<Record<number, string>>({});
  const [dynFetched, setDynFetched] = useState(false);
  const [dynLoading, setDynLoading] = useState(false);
  // Persistencia (#2): si te salís del form y volvés al link, retomás donde ibas
  // (respuestas + repreguntas dinámicas incluidas). Vive en localStorage por propuesta.
  const LS_KEY = `mako.revisar.${prop.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { paso?: number; resp?: Record<number, string>; dynQs?: PropuestaPregunta[]; dynResp?: Record<number, string>; dynFetched?: boolean };
      if (Array.isArray(s.dynQs)) setDynQs(s.dynQs);
      if (s.dynResp) setDynResp(s.dynResp);
      if (s.dynFetched) setDynFetched(true);
      if (s.resp) setResp(s.resp);
      if (typeof s.paso === 'number') setPaso(s.paso);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ paso, resp, dynQs, dynResp, dynFetched })); } catch { /* ignore */ }
  }, [LS_KEY, paso, resp, dynQs, dynResp, dynFetched]);
  const irPlan = () => { window.location.href = '/plan'; };
  const nT = prop.tareas.length;
  // Cuántos proyectos abarcan las tareas (distintos nombres referenciados) — el dueño
  // quiere ver "N tareas en M proyectos", no solo las tareas.
  const nP = new Set(prop.tareas.map((t) => (t.proyecto || '').trim()).filter(Boolean)).size;
  const enProy = nP ? ` en ${nP} proyecto${nP === 1 ? '' : 's'}` : '';

  const steps: Step[] = [
    ...prop.preguntas.map((_, i) => ({ kind: 'q' as const, i })),
    ...dynQs.map((_, i) => ({ kind: 'dyn' as const, i })),
    ...(prop.eliminar.length ? [{ kind: 'elim' as const }] : []),
    { kind: 'confirm' as const },
  ];
  const cur = steps[Math.min(paso, steps.length - 1)];
  const esUltimo = paso >= steps.length - 1;

  // Avanzar: al pasar de la ÚLTIMA pregunta inicial, MaKo genera repreguntas dinámicas
  // (una sola vez) con las respuestas dadas y las inserta como pasos antes de seguir.
  const avanzar = async () => {
    const enUltimaInicial = cur.kind === 'q' && cur.i === prop.preguntas.length - 1;
    if (enUltimaInicial && !dynFetched && prop.preguntas.length > 0) {
      setDynLoading(true);
      try {
        const respuestas = prop.preguntas.map((q, i) => ({ pregunta: q.pregunta, respuesta: (resp[i] || '').trim() })).filter((r) => r.respuesta);
        const r = await fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'profundizar', id: prop.id, respuestas }) }).then((x) => x.json());
        if (r?.ok && Array.isArray(r.preguntas) && r.preguntas.length) setDynQs(r.preguntas as PropuestaPregunta[]);
      } catch { /* sin repreguntas: seguimos */ } finally { setDynFetched(true); setDynLoading(false); }
    }
    setPaso((p) => p + 1);
  };

  const enviar = async (action: 'aplicar' | 'descartar') => {
    setBusy(true); setError('');
    try {
      // El contexto para el Perro junta las respuestas iniciales + las dinámicas.
      const contexto = [
        ...prop.preguntas.map((q, i) => (resp[i]?.trim() ? `${q.pregunta} → ${resp[i].trim()}` : null)),
        ...dynQs.map((q, i) => (dynResp[i]?.trim() ? `${q.pregunta} → ${dynResp[i].trim()}` : null)),
      ].filter(Boolean).join('\n');
      const body = action === 'aplicar' ? { action, id: prop.id, eliminarIds: [...elimSel], contexto } : { action, id: prop.id };
      const r = await fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((res) => res.json());
      if (!r.ok) { setError(r.error || 'No se pudo.'); setBusy(false); return; }
      try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } // ya se aplicó/descartó
      setDone(action === 'aplicar' ? 'aplicada' : 'descartada');
      setTimeout(irPlan, 1300);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de red.'); setBusy(false); }
  };

  if (prop.estado !== 'pendiente') return <Mensaje texto={`Este borrador ya fue ${prop.estado}.`} />;
  if (done) return <Mensaje ok texto={done === 'aplicada' ? `✓ Creé ${nT} tarea${nT === 1 ? '' : 's'}${enProy}${elimSel.size ? ` y borré ${elimSel.size}` : ''}` : '✓ Borrador descartado'} sub="Te llevo al plan…" />;

  const crearLabel = `Crear ${nT}${elimSel.size ? ` · borrar ${elimSel.size}` : ''}`;
  const pregunta = cur.kind === 'q' ? (prop.preguntas[cur.i]?.pregunta || '…')
    : cur.kind === 'dyn' ? (dynQs[cur.i]?.pregunta || '…')
    : cur.kind === 'elim' ? '¿Borro estas tareas?'
      : `Listo — creo ${nT} tarea${nT === 1 ? '' : 's'}${enProy}`;
  const sub = cur.kind === 'q' ? 'Elegí una opción o escribí la tuya.'
    : cur.kind === 'dyn' ? 'MaKo profundiza según lo que respondiste — así el Perro prioriza mejor.'
    : cur.kind === 'elim' ? 'MaKo las ve obsoletas o duplicadas. Destildá las que quieras conservar.'
      : 'El Perro Guardián las prioriza, las describe y les arma la checklist. La revisión final la ves en el plan.';

  return (
    <WizardShell
      titulo={prop.resumen || `Borrador · ${nT} tarea${nT === 1 ? '' : 's'}`}
      total={steps.length} idx={Math.min(paso, steps.length - 1)}
      pregunta={dynLoading ? 'MaKo está pensando…' : busy ? 'Creando…' : pregunta} sub={dynLoading || busy ? undefined : sub}
      puedeAvanzar={!busy && !dynLoading} enUltimo={esUltimo} confirmLabel={crearLabel} pending={busy || dynLoading}
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'} siguienteLabel="Siguiente →"
      error={error || undefined}
      // No se puede cerrar a mitad (sin ✕, sin backdrop): si cerrás perdés las
      // respuestas y la ejecución queda a medias sin contexto. Solo se sale creando
      // (Crear) o descartando explícito (en el paso final), o Cancelar en el paso 0.
      bloqueante
      onClose={irPlan}
      onAtras={() => (paso === 0 ? irPlan() : setPaso(paso - 1))}
      onSiguiente={avanzar}
      onConfirmar={() => enviar('aplicar')}
    >
      {dynLoading ? (
        <DynLoader />
      ) : cur.kind === 'q' ? (
        <PreguntaBody q={prop.preguntas[cur.i]} value={resp[cur.i] || ''} onChange={(v) => setResp((r) => ({ ...r, [cur.i]: v }))} />
      ) : cur.kind === 'dyn' ? (
        <PreguntaBody q={dynQs[cur.i]} value={dynResp[cur.i] || ''} onChange={(v) => setDynResp((r) => ({ ...r, [cur.i]: v }))} />
      ) : cur.kind === 'elim' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
          {prop.eliminar.map((e) => (
            <button key={e.id} type="button" onClick={() => setElimSel((s) => { const c = new Set(s); if (c.has(e.id)) c.delete(e.id); else c.add(e.id); return c; })}
              style={{ display: 'flex', gap: 9, alignItems: 'flex-start', textAlign: 'left', background: elimSel.has(e.id) ? 'var(--warn-bg, #fdecea)' : 'var(--surface-2)', border: `1px solid ${elimSel.has(e.id) ? 'var(--warn, #d0504a)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', padding: '10px 12px', width: '100%', fontFamily: SANS }}>
              <span style={{ width: 15, height: 15, borderRadius: 4, border: `1px solid ${elimSel.has(e.id) ? 'var(--warn, #d0504a)' : 'var(--border-strong)'}`, background: elimSel.has(e.id) ? 'var(--warn, #d0504a)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>{elimSel.has(e.id) ? '✓' : ''}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: elimSel.has(e.id) ? 'line-through' : 'none' }}>{e.titulo || e.id}</span>
                {e.motivo && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--dim)' }}>{e.motivo}</span>}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>{nT} tarea{nT === 1 ? '' : 's'}{enProy}{prop.eliminar.length && elimSel.size ? ` · ${elimSel.size} baja${elimSel.size === 1 ? '' : 's'}` : ''}.</div>
          <button onClick={() => enviar('descartar')} disabled={busy} style={{ marginTop: 14, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 12.5, cursor: busy ? 'default' : 'pointer', textDecoration: 'underline', fontFamily: SANS }}>o descartar este borrador</button>
        </div>
      )}
    </WizardShell>
  );
}
