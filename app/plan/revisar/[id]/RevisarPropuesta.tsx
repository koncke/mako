'use client';

// =============================================================================
// RevisarPropuesta — el dueño O el cliente revisa el borrador de MaKo y confirma
// =============================================================================
// Dos fases: (1) PREGUNTAS de MaKo de a UNA (WizardShell + ChoiceBody, mismo form que
// el resto de la app); (2) TAREAS editables (título/proyecto/deadline/prioridad, con
// tus respuestas al costado como guía) → "Crear todo". aplicar → dueño: plan_tareas +
// Perro; cliente: su board (lib/todo). Funciona para TODOS los workspaces.

import { useState, type CSSProperties } from 'react';
import { WizardShell } from '../../../_components/WizardShell';
import { ChoiceBody } from '../../board/guardian-form';
import { MakoStar } from '../../../_components/MakoBrand';
import type { Propuesta, PropuestaTarea } from '@/lib/plan-propuesta';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const PRIO_OPS: Array<[string, string]> = [['', 'Prioridad'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja'], ['futuro', 'A futuro']];
const inp: CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS, minWidth: 0 };

type Editable = PropuestaTarea & { _k: string };

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

export function RevisarPropuesta({ prop }: { prop: Propuesta }) {
  const N = prop.preguntas.length;
  const [fase, setFase] = useState<'preguntas' | 'tareas'>(N > 0 ? 'preguntas' : 'tareas');
  const [paso, setPaso] = useState(0);
  const [resp, setResp] = useState<Record<number, string>>({});
  const [tareas, setTareas] = useState<Editable[]>(prop.tareas.map((t, i) => ({ ...t, _k: 'k' + i })));
  const [elimSel, setElimSel] = useState<Set<string>>(new Set(prop.eliminar.map((e) => e.id))); // bajas confirmadas (por defecto: las que sugirió MaKo)
  const [busy, setBusy] = useState<'' | 'aplicar' | 'descartar'>('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<'' | 'aplicada' | 'descartada'>('');

  const irPlan = () => { window.location.href = '/plan'; };
  const patch = (k: string, campo: keyof PropuestaTarea, v: string) => setTareas((ts) => ts.map((t) => (t._k === k ? { ...t, [campo]: v || undefined } : t)));
  const quitar = (k: string) => setTareas((ts) => ts.filter((t) => t._k !== k));
  const agregar = () => setTareas((ts) => [...ts, { titulo: '', _k: 'k' + Date.now() }]);
  const validas = tareas.filter((t) => t.titulo.trim());

  const enviar = async (action: 'aplicar' | 'descartar') => {
    setBusy(action); setError('');
    try {
      const body = action === 'aplicar'
        ? { action, id: prop.id, tareas: validas.map((t) => ({ titulo: t.titulo, proyecto: t.proyecto, deadline: t.deadline, detalle: t.detalle, prioridad: t.prioridad })), eliminarIds: [...elimSel] }
        : { action, id: prop.id };
      const r = await fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((res) => res.json());
      if (!r.ok) { setError(r.error || 'No se pudo.'); setBusy(''); return; }
      setDone(action === 'aplicar' ? 'aplicada' : 'descartada');
      setTimeout(irPlan, 1300);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de red.'); setBusy(''); }
  };

  if (prop.estado !== 'pendiente') return <Mensaje texto={`Este borrador ya fue ${prop.estado}.`} />;
  if (done) return <Mensaje ok texto={done === 'aplicada' ? `✓ Creé ${validas.length} tarea${validas.length === 1 ? '' : 's'}${elimSel.size ? ` y borré ${elimSel.size}` : ''}` : '✓ Borrador descartado'} sub="Te llevo al plan…" />;

  // ── Fase 1: preguntas de a UNA (WizardShell) ──────────────────────────────
  if (fase === 'preguntas') {
    const q = prop.preguntas[paso];
    return (
      <WizardShell
        titulo={`Borrador de MaKo · ${prop.tareas.length} tarea${prop.tareas.length === 1 ? '' : 's'}`}
        total={N + 1} idx={paso}
        pregunta={q?.pregunta || '…'}
        sub="Elegí una opción o escribí la tuya. Con esto ajustás las tareas en el paso siguiente."
        puedeAvanzar enUltimo={false} confirmLabel=""
        atrasLabel={paso === 0 ? 'Cerrar' : 'Atrás'}
        siguienteLabel={paso === N - 1 ? 'Ver las tareas →' : 'Siguiente →'}
        onClose={irPlan}
        onAtras={() => (paso === 0 ? irPlan() : setPaso(paso - 1))}
        onSiguiente={() => (paso < N - 1 ? setPaso(paso + 1) : setFase('tareas'))}
        onConfirmar={() => {}}
      >
        <ChoiceBody opciones={q?.opciones || []} value={resp[paso] || ''} onChange={(v) => setResp((r) => ({ ...r, [paso]: v }))} />
      </WizardShell>
    );
  }

  // ── Fase 2: tareas editables + confirmar ──────────────────────────────────
  const respondidas = prop.preguntas.map((q, i) => ({ q: q.pregunta, a: resp[i]?.trim() })).filter((x) => x.a);
  return (
    <main style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, padding: 'clamp(18px,4vw,40px)' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 8 }}>
          <MakoStar size={24} color="var(--primary)" />
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>Revisá y confirmá</h1>
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>{prop.resumen || `${prop.tareas.length} tarea${prop.tareas.length === 1 ? '' : 's'}`}</div>
          </div>
          {N > 0 && <button onClick={() => { setFase('preguntas'); setPaso(0); }} style={{ marginLeft: 'auto', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, cursor: 'pointer', fontFamily: SANS }}>← Preguntas</button>}
        </div>

        {respondidas.length > 0 && (
          <div style={{ marginTop: 6, padding: '12px 15px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, marginBottom: 7 }}>Tus respuestas</div>
            {respondidas.map((x, i) => <div key={i} style={{ fontSize: 12.5, marginBottom: 4 }}><span style={{ color: 'var(--faint)' }}>{x.q} </span><b>{x.a}</b></div>)}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {tareas.map((t) => (
            <div key={t._k} style={{ padding: '13px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input value={t.titulo} onChange={(e) => patch(t._k, 'titulo', e.target.value)} placeholder="Título de la tarea" style={{ ...inp, flex: 1, fontWeight: 600 }} />
                <button onClick={() => quitar(t._k)} title="Quitar" style={{ flex: 'none', width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--faint)', cursor: 'pointer', fontSize: 15 }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={t.proyecto ?? ''} onChange={(e) => patch(t._k, 'proyecto', e.target.value)} placeholder="📁 Proyecto" style={{ ...inp, flex: '1 1 150px' }} />
                <input type="date" value={t.deadline ?? ''} onChange={(e) => patch(t._k, 'deadline', e.target.value)} style={{ ...inp, flex: '0 1 150px' }} />
                <select value={t.prioridad ?? ''} onChange={(e) => patch(t._k, 'prioridad', e.target.value)} style={{ ...inp, flex: '0 1 120px', cursor: 'pointer' }}>
                  {PRIO_OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {t.detalle && <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.4 }}>{t.detalle}</div>}
            </div>
          ))}
          <button onClick={agregar} style={{ padding: '10px', borderRadius: 10, border: '1.5px dashed var(--border-strong)', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>＋ Agregar una tarea</button>
        </div>

        {prop.eliminar.length > 0 && (
          <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--warn-bg, #fdecea)', border: '1px solid var(--warn, #d0504a)', borderRadius: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--warn, #d0504a)', fontWeight: 700, marginBottom: 9 }}>🗑 MaKo sugiere eliminar</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {prop.eliminar.map((e) => (
                <button key={e.id} type="button" onClick={() => setElimSel((s) => { const c = new Set(s); if (c.has(e.id)) c.delete(e.id); else c.add(e.id); return c; })} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, width: '100%', fontFamily: SANS }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, border: `1px solid ${elimSel.has(e.id) ? 'var(--warn, #d0504a)' : 'var(--border-strong)'}`, background: elimSel.has(e.id) ? 'var(--warn, #d0504a)' : 'transparent', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>{elimSel.has(e.id) ? '✓' : ''}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: elimSel.has(e.id) ? 'line-through' : 'none' }}>{e.titulo || e.id}</span>
                    {e.motivo && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--dim)' }}>{e.motivo}</span>}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 9 }}>Tildadas = se borran al confirmar. Destildá las que quieras conservar.</div>
          </div>
        )}

        {error && <div style={{ marginTop: 14, padding: '10px 13px', background: 'var(--warn-bg, #fde8e8)', border: '1px solid var(--warn, #d0504a)', borderRadius: 10, color: 'var(--warn, #d0504a)', fontSize: 13 }}>{error}</div>}

        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button onClick={() => enviar('descartar')} disabled={!!busy} style={{ marginRight: 'auto', padding: '10px 14px', borderRadius: 9, border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 13, cursor: busy ? 'default' : 'pointer', textDecoration: 'underline' }}>{busy === 'descartar' ? 'Descartando…' : 'Descartar borrador'}</button>
          <button onClick={() => enviar('aplicar')} disabled={!!busy || (validas.length === 0 && elimSel.size === 0)} style={{ padding: '11px 22px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: (busy || (validas.length === 0 && elimSel.size === 0)) ? 'default' : 'pointer', opacity: (busy || (validas.length === 0 && elimSel.size === 0)) ? 0.6 : 1 }}>{busy === 'aplicar' ? 'Aplicando…' : `Crear ${validas.length}${elimSel.size ? ` · borrar ${elimSel.size}` : ''}`}</button>
        </div>
      </div>
    </main>
  );
}
