'use client';

// =============================================================================
// RevisarPropuesta — el dueño revisa/edita el borrador de MaKo y lo confirma
// =============================================================================
// Muestra las NOTAS/preguntas de MaKo arriba (lo que quiere confirmar) y la lista de
// tareas EDITABLE debajo (título, proyecto, deadline, prioridad, quitar). "Crear todo"
// → /api/plan-propuesta (aplicar) crea las tareas + corre el Perro → vuelve a /plan.

import { useState, type CSSProperties } from 'react';
import { MakoStar } from '../../../_components/MakoBrand';
import type { Propuesta, PropuestaTarea } from '@/lib/plan-propuesta';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const PRIO_OPS: Array<[string, string]> = [['', 'Prioridad'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja'], ['futuro', 'A futuro']];

type Editable = PropuestaTarea & { _k: string };

const inp: CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS, minWidth: 0 };

export function RevisarPropuesta({ prop }: { prop: Propuesta }) {
  const [tareas, setTareas] = useState<Editable[]>(prop.tareas.map((t, i) => ({ ...t, _k: 'k' + i })));
  const [busy, setBusy] = useState<'' | 'aplicar' | 'descartar'>('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<'' | 'aplicada' | 'descartada'>('');
  const yaResuelta = prop.estado !== 'pendiente';

  const patch = (k: string, campo: keyof PropuestaTarea, v: string) => setTareas((ts) => ts.map((t) => (t._k === k ? { ...t, [campo]: v || undefined } : t)));
  const quitar = (k: string) => setTareas((ts) => ts.filter((t) => t._k !== k));
  const agregar = () => setTareas((ts) => [...ts, { titulo: '', _k: 'k' + Date.now() }]);
  const validas = tareas.filter((t) => t.titulo.trim());

  const enviar = async (action: 'aplicar' | 'descartar') => {
    setBusy(action); setError('');
    try {
      const body = action === 'aplicar'
        ? { action, id: prop.id, tareas: validas.map((t) => ({ titulo: t.titulo, proyecto: t.proyecto, deadline: t.deadline, detalle: t.detalle, prioridad: t.prioridad })) }
        : { action, id: prop.id };
      const r = await fetch('/api/plan-propuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((res) => res.json());
      if (!r.ok) { setError(r.error || 'No se pudo.'); setBusy(''); return; }
      setDone(action === 'aplicar' ? 'aplicada' : 'descartada');
      setTimeout(() => { window.location.href = '/plan/agencia'; }, 1300);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error de red.'); setBusy(''); }
  };

  return (
    <main style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, padding: 'clamp(18px,4vw,40px)' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 6 }}>
          <MakoStar size={24} color="var(--primary)" />
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>Borrador de MaKo</h1>
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>{prop.resumen || `${prop.tareas.length} tarea${prop.tareas.length === 1 ? '' : 's'} para revisar`}</div>
          </div>
        </div>

        {yaResuelta ? (
          <div style={{ marginTop: 24, padding: '20px 22px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Este borrador ya fue {prop.estado}.</div>
            <a href="/plan/agencia" style={{ display: 'inline-block', marginTop: 12, padding: '9px 18px', borderRadius: 9, background: 'var(--ink)', color: 'var(--surface)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>Ir al plan</a>
          </div>
        ) : done ? (
          <div style={{ marginTop: 24, padding: '22px', background: 'var(--good-bg)', border: '1px solid #BFE6CD', borderRadius: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--good)' }}>{done === 'aplicada' ? `✓ Creé ${validas.length} tarea${validas.length === 1 ? '' : 's'} — el Perro las está priorizando` : '✓ Borrador descartado'}</div>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 6 }}>Te llevo al plan…</div>
          </div>
        ) : (
          <>
            {/* Preguntas / notas de MaKo */}
            {prop.notas.length > 0 && (
              <div style={{ marginTop: 18, padding: '15px 17px', background: 'var(--primary-bg, var(--surface-2))', border: '1px solid var(--primary-weak)', borderRadius: 13 }}>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700, marginBottom: 9 }}>✨ MaKo quiere confirmar</div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {prop.notas.map((n, i) => <li key={i} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>{n}</li>)}
                </ul>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 9 }}>Ajustá las tareas de abajo según esto (proyecto, fecha, prioridad, o separalas/borralas).</div>
              </div>
            )}

            {/* Tareas editables */}
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 11 }}>
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

            {error && <div style={{ marginTop: 14, padding: '10px 13px', background: 'var(--warn-bg, #fde8e8)', border: '1px solid var(--warn, #d0504a)', borderRadius: 10, color: 'var(--warn, #d0504a)', fontSize: 13 }}>{error}</div>}

            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--faint)' }}>El Perro va a priorizar y armar las checklists al crearlas.</span>
              <button onClick={() => enviar('descartar')} disabled={!!busy} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy === 'descartar' ? 'Descartando…' : 'Descartar'}</button>
              <button onClick={() => enviar('aplicar')} disabled={!!busy || validas.length === 0} style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: (busy || validas.length === 0) ? 'default' : 'pointer', opacity: (busy || validas.length === 0) ? 0.6 : 1 }}>{busy === 'aplicar' ? 'Creando…' : `Crear ${validas.length} tarea${validas.length === 1 ? '' : 's'}`}</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
