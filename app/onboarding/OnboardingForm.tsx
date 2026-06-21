'use client';

// =============================================================================
// OnboardingForm — perfil del negocio: completar respuestas + editar los campos
// =============================================================================
// El formulario es editable: los campos se definen y modifican acá (se guardan
// flexibles en app_settings), sin migrar la base. Las respuestas se guardan
// aparte. Todo alimenta el contexto de MaKo (campo vacío → no se inyecta).

import { useEffect, useState, type CSSProperties } from 'react';
import { MakoLogo } from '../_components/MakoBrand';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type FieldType = 'text' | 'number' | 'textarea';
type Field = { key: string; label: string; type: FieldType; placeholder?: string };
type Group = { key: string; label: string; fields: Field[] };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const input: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const labelStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' };

const nuevaKey = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

export function OnboardingForm() {
  const [schema, setSchema] = useState<Group[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [modo, setModo] = useState<'completar' | 'editar'>('completar');
  const [cargando, setCargando] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/mako/onboarding').then((r) => r.json()).then((j) => { setSchema(j.schema ?? []); setAnswers(j.answers ?? {}); }).finally(() => setCargando(false));
  }, []);

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

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <MakoLogo size={36} />
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Onboarding</h1>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 22px', maxWidth: 720 }}>El perfil del negocio del cliente. Completá lo que tengas; podés editar los campos cuando se te ocurran más cosas para pedir.</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, maxWidth: 760 }}>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
          {(['completar', 'editar'] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)} style={{ padding: '7px 15px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, background: modo === m ? 'var(--surface)' : 'transparent', color: modo === m ? 'var(--ink)' : 'var(--dim)', boxShadow: modo === m ? '0 1px 3px rgba(23,21,17,.12)' : 'none' }}>{m === 'completar' ? 'Completar' : 'Editar campos'}</button>
          ))}
        </div>
        {saved && <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>Guardado ✓</span>}
      </div>

      {cargando ? (
        <div style={{ ...card, maxWidth: 760, color: 'var(--faint)', fontFamily: MONO, fontSize: 13 }}>Cargando…</div>
      ) : modo === 'completar' ? (
        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {schema.map((g) => (
            <div key={g.key} style={card}>
              <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 14 }}>{g.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {g.fields.map((f) => (
                  <div key={f.key}>
                    <label style={labelStyle}>{f.label}</label>
                    {f.type === 'textarea' ? (
                      <textarea style={{ ...input, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }} value={answers[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))} />
                    ) : (
                      <input type={f.type === 'number' ? 'number' : 'text'} style={input} value={answers[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
                {g.fields.length === 0 && <div style={{ fontSize: 13, color: 'var(--faint)' }}>Sin campos. Agregalos en “Editar campos”.</div>}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button style={btnDark} onClick={guardarRespuestas}>Guardar respuestas</button></div>
        </div>
      ) : (
        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {schema.map((g, gi) => (
            <div key={g.key} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <input style={{ ...input, fontWeight: 600 }} value={g.label} onChange={(e) => setGroup(gi, { label: e.target.value })} />
                <button style={{ ...btnGhost, color: 'var(--bad)', whiteSpace: 'nowrap' }} onClick={() => delGroup(gi)}>Quitar grupo</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {g.fields.map((f, fi) => (
                  <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 1fr auto', gap: 8, alignItems: 'center' }}>
                    <input style={input} value={f.label} placeholder="Etiqueta" onChange={(e) => setField(gi, fi, { label: e.target.value })} />
                    <select style={{ ...input, cursor: 'pointer' }} value={f.type} onChange={(e) => setField(gi, fi, { type: e.target.value as FieldType })}>
                      <option value="text">Texto</option>
                      <option value="number">Número</option>
                      <option value="textarea">Párrafo</option>
                    </select>
                    <input style={input} value={f.placeholder ?? ''} placeholder="Placeholder (opcional)" onChange={(e) => setField(gi, fi, { placeholder: e.target.value })} />
                    <button style={{ ...btnGhost, color: 'var(--bad)' }} onClick={() => delField(gi, fi)}>✕</button>
                  </div>
                ))}
              </div>
              <button style={{ ...btnGhost, marginTop: 12 }} onClick={() => addField(gi)}>+ Campo</button>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <button style={btnGhost} onClick={addGroup}>+ Grupo</button>
            <button style={btnDark} onClick={guardarEsquema}>Guardar campos</button>
          </div>
        </div>
      )}
    </main>
  );
}
