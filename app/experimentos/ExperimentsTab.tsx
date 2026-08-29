'use client';

// =============================================================================
// ExperimentsTab — experimentos en curso + creación guiada (método SIMPLE)
// =============================================================================

import { useState } from 'react';
import type { ExperimentosView, ExperimentoConMedicion, Experimento, Propuesta } from '@/lib/experimentos';
import { MakoStar, MakoWord } from '@/app/_components/MakoBrand';
import type { Toast } from './ExperimentosApp';
import {
  MONO, SANS, card, btnPrimary, btnGhost, btnDark, pregunta, ayuda,
  Pill, Spark, MakoLoading, Empty, fmtVal, fmtFechaCorta, dirLabel,
} from './ui';

export function ExperimentsTab({ view, refreshExp, notify, demo }: { view: ExperimentosView; refreshExp: () => Promise<void>; notify: Toast; demo: boolean }) {
  const [modal, setModal] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const accion = async (action: 'iniciar' | 'cerrar' | 'descartar', id: number) => {
    setBusyId(id);
    try {
      const j = await fetch('/api/experimentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id }) }).then((r) => r.json());
      if (j.ok) { await refreshExp(); notify(action === 'cerrar' ? 'Experimento cerrado — mira Conclusions' : action === 'iniciar' ? 'Experimento iniciado' : 'Descartado'); }
      else notify(j.error || 'Error', 'bad');
    } catch (e) { notify(String(e), 'bad'); } finally { setBusyId(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--dim)', maxWidth: 560, lineHeight: 1.55 }}>
          Cada experimento es una hipótesis puesta a prueba contra el <b>dato real</b>. MaKo la configura; tú la sigues día a día y la cierras con un aprendizaje.
        </p>
        <button type="button" onClick={() => setModal(true)} style={btnPrimary}>+ Nuevo experimento</button>
      </div>

      {view.activos.length === 0 && view.propuestos.length === 0 ? (
        <Empty titulo="No hay experimentos corriendo"
          sub="Cuéntale a MaKo una hipótesis (“¿y si filtro más el formulario?”, “¿y si cambio el hook del VSL?”) y la convierte en una prueba medible que arranca hoy.">
          <button type="button" onClick={() => setModal(true)} style={{ ...btnDark, marginTop: 6 }}>Diseñar mi primer experimento</button>
        </Empty>
      ) : (
        <>
          {view.activos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {view.activos.map((e) => <ActivoCard key={e.id} e={e} busy={busyId === e.id} onCerrar={() => accion('cerrar', e.id)} onDescartar={() => accion('descartar', e.id)} />)}
            </div>
          )}

          {view.propuestos.length > 0 && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', margin: '4px 0 12px' }}>Guardados · sin arrancar</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {view.propuestos.map((e) => <PropuestaGuardada key={e.id} e={e} busy={busyId === e.id} onIniciar={() => accion('iniciar', e.id)} onDescartar={() => accion('descartar', e.id)} />)}
              </div>
            </div>
          )}
        </>
      )}

      {modal && <NuevoExperimentoModal onClose={() => setModal(false)} refreshExp={refreshExp} demo={demo} />}
    </div>
  );
}

// ── Card de experimento en curso ──
function ActivoCard({ e, onCerrar, onDescartar, busy }: { e: ExperimentoConMedicion; onCerrar: () => void; onDescartar: () => void; busy: boolean }) {
  const m = e.medicion;
  const vaBien = m?.va_bien;
  const listo = m != null && m.dias_corridos >= m.dias_total;
  const progreso = m ? Math.min(100, Math.round((m.dias_corridos / Math.max(1, m.dias_total)) * 100)) : 0;
  const deltaTxt = m?.delta_pct != null ? `${m.delta_pct > 0 ? '+' : ''}${m.delta_pct.toFixed(1)}%` : '—';
  const col = vaBien === true ? 'var(--good)' : vaBien === false ? 'var(--bad)' : 'var(--primary)';

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{e.titulo}</div>
        {vaBien == null ? <Pill>sin dato aún</Pill> : vaBien ? <Pill tone="good">va bien</Pill> : <Pill tone="bad">en contra</Pill>}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--dim)', lineHeight: 1.45 }}>{e.hipotesis}</p>

      <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>{e.metrica_label ?? e.metrica}</div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 14, color: 'var(--faint)' }}>{fmtVal(m?.baseline, e.metrica)}</span>
        <span style={{ color: 'var(--faint)' }}>→</span>
        <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>{fmtVal(m?.actual, e.metrica)}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, color: col }}>{deltaTxt}</span>
        {e.objetivo_valor != null && <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', marginLeft: 'auto' }}>obj. {fmtVal(e.objetivo_valor, e.metrica)}</span>}
      </div>

      <div style={{ marginTop: 12 }}><Spark serie={m?.serie ?? []} color={col} /></div>

      <div style={{ marginTop: 8 }}>
        <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ width: `${progreso}%`, height: '100%', background: listo ? 'var(--good)' : 'var(--primary)' }} />
        </div>
        <div style={{ marginTop: 5, fontFamily: MONO, fontSize: 11, color: 'var(--faint)', display: 'flex', justifyContent: 'space-between' }}>
          <span>día {m?.dias_corridos ?? 0} de {m?.dias_total ?? e.ventana_dias}</span>
          <span>{e.fecha_inicio ? `desde ${fmtFechaCorta(e.fecha_inicio)}` : ''}</span>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" onClick={onCerrar} disabled={busy} style={{ ...btnDark, opacity: busy ? 0.6 : 1, background: listo ? 'var(--good)' : 'var(--ink)' }}>{busy ? 'Cerrando…' : 'Cerrar y concluir'}</button>
        <button type="button" onClick={onDescartar} disabled={busy} style={{ ...btnGhost, border: 'none', color: 'var(--faint)' }}>Descartar</button>
      </div>
    </div>
  );
}

function PropuestaGuardada({ e, onIniciar, onDescartar, busy }: { e: Experimento; onIniciar: () => void; onDescartar: () => void; busy: boolean }) {
  return (
    <div style={{ ...card, borderColor: 'var(--primary-weak)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)' }}>{e.titulo}</div>
        <Pill tone="primary">guardado</Pill>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>{e.hipotesis}</p>
      <div style={{ marginTop: 12, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <Pill tone="primary">📏 {e.metrica_label ?? e.metrica}</Pill>
        <Pill>objetivo: {dirLabel(e.direccion)}</Pill>
        <Pill>ventana: {e.ventana_dias}d</Pill>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
        <button type="button" onClick={onIniciar} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? 'Arrancando…' : 'Iniciar'}</button>
        <button type="button" onClick={onDescartar} disabled={busy} style={{ ...btnGhost, border: 'none', color: 'var(--faint)' }}>Descartar</button>
      </div>
    </div>
  );
}

// ── Modal de creación guiada (hipótesis → MaKo configura → revisión) ──
type Step = 'hipotesis' | 'armando' | 'revision' | 'listo';

function NuevoExperimentoModal({ onClose, refreshExp, demo }: { onClose: () => void; refreshExp: () => Promise<void>; demo: boolean }) {
  const [step, setStep] = useState<Step>('hipotesis');
  const [hip, setHip] = useState('');
  const [ctx, setCtx] = useState('');
  const [showCtx, setShowCtx] = useState(false);
  const [p, setP] = useState<Propuesta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const diseñar = async () => {
    const h = hip.trim(); if (!h) return;
    setStep('armando'); setErr(null);
    try {
      const j = await fetch('/api/experimentos/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hipotesis: h, contexto: ctx }) }).then((r) => r.json());
      if (j.ok && j.propuesta) { setP(j.propuesta); setStep('revision'); }
      else { setErr(j.error || 'No se pudo diseñar'); setStep('hipotesis'); }
    } catch (e) { setErr(String(e)); setStep('hipotesis'); }
  };

  const iniciar = async () => {
    if (!p) return;
    setBusy(true); setErr(null);
    try {
      const j = await fetch('/api/experimentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crear', experimento: {
          titulo: p.titulo, hipotesis: p.hipotesis, cambio: p.cambio, metrica: p.metrica, direccion: p.direccion,
          objetivo_valor: p.objetivo_valor, criterio_exito: p.criterio_exito, ventana_dias: p.ventana_dias,
          presupuesto_usd: p.presupuesto_usd, origen: 'mako', racional: p.racional, config: { propuesta: p }, arrancar: true,
        } }),
      }).then((r) => r.json());
      if (j.ok) { setStep('listo'); await refreshExp(); }
      else setErr(j.error || 'No se pudo iniciar');
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };

  const dots = ['hipotesis', 'revision'];
  const dotIdx = step === 'hipotesis' ? 0 : 1;
  const set = (patch: Partial<Propuesta>) => setP((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: step === 'revision' ? 640 : 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden', fontFamily: SANS }}>
        {/* barra superior */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            <MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord>
          </div>
          {(step === 'hipotesis' || step === 'revision') && (
            <div style={{ display: 'flex', gap: 6, margin: '0 auto' }}>
              {dots.map((s, i) => <span key={s} style={{ width: i === dotIdx ? 22 : 7, height: 7, borderRadius: 999, background: i <= dotIdx ? 'var(--primary)' : 'var(--border-strong)', transition: 'all .2s' }} />)}
            </div>
          )}
          <button aria-label="Cerrar" onClick={onClose} style={{ marginLeft: (step === 'hipotesis' || step === 'revision') ? 0 : 'auto', width: 32, height: 32, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {step === 'hipotesis' && (
            <div style={{ padding: '30px 30px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div>
                <h2 style={pregunta}>¿Qué quieres probar?</h2>
                <p style={ayuda}>Escribe tu hipótesis en una frase. MaKo elige la métrica, el baseline y la ventana, y la deja lista para arrancar.</p>
              </div>
              <textarea value={hip} autoFocus onChange={(e) => setHip(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); diseñar(); } }}
                rows={3} placeholder="Ej.: si filtro más fuerte el formulario, baja el costo por agenda…"
                style={{ width: '100%', maxWidth: 500, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15.5, outline: 'none', resize: 'vertical', lineHeight: 1.5, textAlign: 'center' }} />
              {err && <div style={{ fontSize: 13, color: 'var(--bad)', textAlign: 'center' }}>{err}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 500 }}>
                {['El VSL nuevo sube la tasa de agenda', 'Un follow-up al día 2 recupera agendas', 'Escalar el ganador 20% no sube el CPL'].map((s) => (
                  <button key={s} type="button" onClick={() => setHip(s)} style={{ padding: '7px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, cursor: 'pointer' }}>{s}</button>
                ))}
              </div>
              {showCtx ? (
                <div style={{ width: '100%', maxWidth: 500 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5 }}>Contexto (opcional)</div>
                  <textarea value={ctx} onChange={(e) => setCtx(e.target.value)} rows={2} placeholder="¿Qué viste o por qué lo crees? Ayuda a MaKo a elegir mejor la métrica."
                    style={{ width: '100%', padding: '11px 13px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
                </div>
              ) : (
                <button type="button" onClick={() => setShowCtx(true)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' }}>+ Agregar contexto (opcional)</button>
              )}
            </div>
          )}

          {step === 'armando' && <MakoLoading pasos={['Leyendo tu funnel real…', 'Eligiendo la métrica termómetro…', 'Midiendo el baseline…', 'Definiendo el experimento…']} />}

          {step === 'revision' && p && (
            <div style={{ padding: '26px 30px 6px' }}>
              <h2 style={{ ...pregunta, fontSize: 22 }}>Tu experimento, listo</h2>
              <p style={{ ...ayuda, margin: '8px auto 20px' }}>Revisa y ajusta lo que quieras. MaKo eligió la métrica y midió el baseline.</p>

              <input value={p.titulo} onChange={(e) => set({ titulo: e.target.value })}
                style={{ width: '100%', fontSize: 17, fontWeight: 600, color: 'var(--ink)', border: 'none', borderBottom: '1px dashed var(--border-strong)', background: 'transparent', fontFamily: SANS, outline: 'none', padding: '2px 0 6px' }} />
              <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>{p.hipotesis}</p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
                <Pill tone="primary">📏 {p.metrica_label}</Pill>
                <Pill>objetivo: {dirLabel(p.direccion)}</Pill>
              </div>

              <Campo label="Qué se cambia">
                <textarea value={p.cambio} onChange={(e) => set({ cambio: e.target.value })} rows={2}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, resize: 'vertical', outline: 'none' }} />
              </Campo>
              {p.criterio_exito && (
                <Campo label="Criterio de éxito"><div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{p.criterio_exito}</div></Campo>
              )}
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 12 }}>
                <Campo label="Ventana (días)">
                  <input type="number" value={p.ventana_dias} onChange={(e) => set({ ventana_dias: Number(e.target.value) || 14 })}
                    style={numInput} />
                </Campo>
                <Campo label="Objetivo (opcional)">
                  <input type="number" value={p.objetivo_valor ?? ''} placeholder="—" onChange={(e) => set({ objetivo_valor: e.target.value === '' ? null : Number(e.target.value) })}
                    style={numInput} />
                </Campo>
              </div>
              {p.racional && <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic', lineHeight: 1.5 }}>💡 {p.racional}</p>}
              {err && <div style={{ fontSize: 13, color: 'var(--bad)', marginTop: 10 }}>{err}</div>}
            </div>
          )}

          {step === 'listo' && (
            <div style={{ padding: '52px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--good-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: 'var(--good)' }}>✓</div>
              <h3 style={pregunta}>Experimento en marcha</h3>
              <p style={ayuda}>MaKo ya midió el baseline y arranca a medir contra el dato real. Lo sigues aquí, en Experiments.</p>
              <button onClick={onClose} style={btnDark}>Listo</button>
            </div>
          )}
        </div>

        {/* pie */}
        {(step === 'hipotesis' || step === 'revision') && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px' }}>
            <button onClick={step === 'revision' ? () => setStep('hipotesis') : onClose} style={btnGhost}>← {step === 'revision' ? 'Atrás' : 'Cancelar'}</button>
            {step === 'hipotesis'
              ? <button onClick={diseñar} disabled={!hip.trim()} style={{ ...btnPrimary, opacity: hip.trim() ? 1 : 0.5 }}>Diseñar con MaKo →</button>
              : <button onClick={iniciar} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? 'Arrancando…' : 'Iniciar experimento'}</button>}
          </div>
        )}
        {demo && step === 'revision' && <div style={{ padding: '0 20px 12px', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', textAlign: 'center' }}>en local no se guarda (sin Supabase); en prod arranca de verdad</div>}
      </div>
    </div>
  );
}

const numInput: React.CSSProperties = { width: 120, padding: '8px 11px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: MONO, fontSize: 14, outline: 'none' };

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
