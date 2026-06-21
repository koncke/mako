'use client';

// =============================================================================
// OnboardingForm — perfil del negocio: wizard minimalista (paso a paso)
// =============================================================================
// Por defecto se "completa" en un wizard de una pantalla por grupo (concreto,
// centrado). El lápiz de arriba a la derecha abre el editor de campos (el form
// es editable sin migrar la base). Alimenta el contexto de MaKo.

import { useEffect, useState, type CSSProperties } from 'react';
import { MakoLogo, MakoIntro } from '../_components/MakoBrand';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type FieldType = 'text' | 'number' | 'textarea';
type Field = { key: string; label: string; type: FieldType; placeholder?: string };
type Group = { key: string; label: string; fields: Field[] };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const input: CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none' };
const btnDark: CSSProperties = { padding: '11px 20px', borderRadius: 11, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' };
const btnGhostSm: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' };

const nuevaKey = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
  );
}

export function OnboardingForm() {
  const [schema, setSchema] = useState<Group[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [intro, setIntro] = useState(true);
  const [editando, setEditando] = useState(false);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/mako/onboarding').then((r) => r.json()).then((j) => { setSchema(j.schema ?? []); setAnswers(j.answers ?? {}); }).finally(() => setCargando(false));
  }, []);
  useEffect(() => { const t = setTimeout(() => setIntro(false), 1700); return () => clearTimeout(t); }, []);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const guardarRespuestas = async () => { await fetch('/api/mako/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'answers', answers }) }); flash(); };
  const guardarEsquema = async () => { await fetch('/api/mako/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'schema', schema }) }); flash(); };

  // edición de esquema
  const setGroup = (gi: number, patch: Partial<Group>) => setSchema((s) => s.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setField = (gi: number, fi: number, patch: Partial<Field>) => setSchema((s) => s.map((g, i) => (i === gi ? { ...g, fields: g.fields.map((f, j) => (j === fi ? { ...f, ...patch } : f)) } : g)));
  const addField = (gi: number) => setSchema((s) => s.map((g, i) => (i === gi ? { ...g, fields: [...g.fields, { key: nuevaKey('campo'), label: 'Nuevo campo', type: 'text' as FieldType, placeholder: '' }] } : g)));
  const delField = (gi: number, fi: number) => setSchema((s) => s.map((g, i) => (i === gi ? { ...g, fields: g.fields.filter((_, j) => j !== fi) } : g)));
  const addGroup = () => setSchema((s) => [...s, { key: nuevaKey('grupo'), label: 'Nuevo grupo', fields: [] }]);
  const delGroup = (gi: number) => setSchema((s) => s.filter((_, i) => i !== gi));

  const total = schema.length;
  const stepSafe = Math.min(step, Math.max(0, total - 1));
  const group = schema[stepSafe];

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px', minHeight: '100vh', position: 'relative' }}>
      {intro && <MakoIntro saludo="Bienvenido a" caption="Configurá el perfil de tu negocio" />}

      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <MakoLogo size={36} />
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Onboarding</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>Guardado ✓</span>}
          <button type="button" title={editando ? 'Volver al formulario' : 'Editar campos'} onClick={() => setEditando((v) => !v)} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: editando ? 'var(--surface-2)' : 'var(--surface)', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {editando ? <span style={{ fontSize: 15 }}>✕</span> : <PencilIcon />}
          </button>
        </div>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 6px', maxWidth: 720 }}>El perfil del negocio del cliente. Alimenta el contexto de MaKo.</p>

      {cargando ? (
        <div style={{ ...card, maxWidth: 760, color: 'var(--faint)', fontFamily: MONO, fontSize: 13, marginTop: 18 }}>Cargando…</div>
      ) : editando ? (
        // ── Editor de campos (lápiz) ──
        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16, marginTop: 18 }}>
          {schema.map((g, gi) => (
            <div key={g.key} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <input style={{ ...input, fontWeight: 600 }} value={g.label} onChange={(e) => setGroup(gi, { label: e.target.value })} />
                <button style={{ ...btnGhostSm, color: 'var(--bad)', whiteSpace: 'nowrap' }} onClick={() => delGroup(gi)}>Quitar grupo</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {g.fields.map((f, fi) => (
                  <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 1fr auto', gap: 8, alignItems: 'center' }}>
                    <input style={input} value={f.label} placeholder="Etiqueta / pregunta" onChange={(e) => setField(gi, fi, { label: e.target.value })} />
                    <select style={{ ...input, cursor: 'pointer' }} value={f.type} onChange={(e) => setField(gi, fi, { type: e.target.value as FieldType })}>
                      <option value="text">Texto</option>
                      <option value="number">Número</option>
                      <option value="textarea">Párrafo</option>
                    </select>
                    <input style={input} value={f.placeholder ?? ''} placeholder="Placeholder (opcional)" onChange={(e) => setField(gi, fi, { placeholder: e.target.value })} />
                    <button style={{ ...btnGhostSm, color: 'var(--bad)' }} onClick={() => delField(gi, fi)}>✕</button>
                  </div>
                ))}
              </div>
              <button style={{ ...btnGhostSm, marginTop: 12 }} onClick={() => addField(gi)}>+ Campo</button>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <button style={btnGhostSm} onClick={addGroup}>+ Grupo</button>
            <button style={btnDark} onClick={guardarEsquema}>Guardar campos</button>
          </div>
        </div>
      ) : (
        // ── Wizard minimalista (una pantalla por grupo) ──
        <div style={{ maxWidth: 540, margin: '0 auto', minHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 10 }}>
            {schema.map((_, i) => <span key={i} style={{ width: i === stepSafe ? 22 : 7, height: 7, borderRadius: 999, background: i === stepSafe ? 'var(--accent)' : i < stepSafe ? 'var(--accent-soft)' : 'var(--border-strong)', transition: 'all .2s' }} />)}
          </div>
          <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 22 }}>Paso {stepSafe + 1} de {total}</div>

          <h2 style={{ textAlign: 'center', fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 28px' }}>{group?.label}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {group?.fields.map((f) => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea style={{ ...input, minHeight: 96, resize: 'vertical', lineHeight: 1.5 }} value={answers[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))} />
                ) : (
                  <input type={f.type === 'number' ? 'number' : 'text'} style={input} value={answers[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
            {(!group || group.fields.length === 0) && <div style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 13.5 }}>Este grupo no tiene campos. Editalos con el lápiz de arriba.</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 30 }}>
            <button style={{ ...btnGhost, opacity: stepSafe === 0 ? 0.4 : 1, cursor: stepSafe === 0 ? 'default' : 'pointer' }} disabled={stepSafe === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>← Anterior</button>
            {stepSafe < total - 1
              ? <button style={btnDark} onClick={() => { guardarRespuestas(); setStep((s) => s + 1); }}>Siguiente →</button>
              : <button style={btnDark} onClick={guardarRespuestas}>Guardar</button>}
          </div>
        </div>
      )}
    </main>
  );
}
