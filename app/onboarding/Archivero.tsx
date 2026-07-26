'use client';

// =============================================================================
// El Archivero — el cliente TIRA todos sus documentos sueltos (avatar, oferta,
// nicho, su web/IG, texto) y MaKo los lee y ordena en el brief del negocio.
// Tres momentos: intake (subir) → leyendo → review editable ("esto entendí,
// corregí"). De from-0: si no sube nada, "lo lleno yo" abre el brief vacío.
//
// Reusable en DOS lugares con el mismo componente:
//  · OnboardingWizard (paso 'archivero'): sin onGuardar — el wizard persiste al
//    tocar "Siguiente".
//  · Configuraciones → Onboarding: CON onGuardar — como no hay wizard, el review
//    trae su propio botón "Guardar" para persistir las correcciones.
//
// El endpoint /api/onboarding/archivero YA persiste server-side (mergea sobre el
// perfil) apenas ordena; onGuardar es solo para guardar las EDICIONES del review.
// =============================================================================

import { useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { wizardInput } from '../_components/WizardShell';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const btnPrimary: CSSProperties = { padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };

/** Campo del brief, APLANADO y con el nombre de su grupo (para agrupar el review). */
export type BriefCampo = { key: string; label: string; type: 'text' | 'number' | 'textarea'; placeholder?: string; grupo: string };

export function Archivero({ brief, answers, setAnswers, onGuardar }: {
  brief: BriefCampo[];
  answers: Record<string, string>;
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>;
  /** Configuraciones: persistir las correcciones del review. Si falta, el review no muestra botón (el wizard guarda por su cuenta). */
  onGuardar?: (answers: Record<string, string>) => Promise<void> | void;
}) {
  const yaHayDatos = brief.some((c) => (answers[c.key] ?? '').trim());
  const [fase, setFase] = useState<'intake' | 'leyendo' | 'listo'>(yaHayDatos ? 'listo' : 'intake');
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState('');
  const [notas, setNotas] = useState('');
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hayAlgo = files.length > 0 || url.trim() !== '' || notas.trim() !== '';

  const addFiles = (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.name + f.size, f]));
      for (const f of Array.from(fl)) map.set(f.name + f.size, f);
      return Array.from(map.values());
    });
  };

  const ordenar = async () => {
    if (!hayAlgo) return;
    setFase('leyendo'); setErr(null); setWarnings([]);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('file', f));
      if (url.trim()) fd.append('url', url.trim());
      if (notas.trim()) fd.append('texto', notas.trim());
      const r = await fetch('/api/onboarding/archivero', { method: 'POST', body: fd });
      const j = await r.json();
      if (!j.ok) { setErr(String(j.error ?? 'No pude leer eso.')); setWarnings(Array.isArray(j.warnings) ? j.warnings : []); setFase('intake'); return; }
      setAnswers((a) => ({ ...a, ...(j.answers as Record<string, string>) }));
      setWarnings(Array.isArray(j.warnings) ? j.warnings : []);
      setFase('listo');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e)); setFase('intake');
    }
  };

  const guardar = async () => {
    if (!onGuardar) return;
    setGuardando(true);
    try { await onGuardar(answers); setGuardadoOk(true); setTimeout(() => setGuardadoOk(false), 2200); }
    finally { setGuardando(false); }
  };

  const inputIzq: CSSProperties = { ...wizardInput, textAlign: 'left', fontSize: 14 };
  const linkBtn: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', padding: 0 };
  const cajaWarn = warnings.length > 0 ? (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', margin: '10px 0 0', textAlign: 'left' }}>
      {warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--warn)', lineHeight: 1.5 }}>· {w}</div>)}
    </div>
  ) : null;

  // ── Leyendo ──────────────────────────────────────────────────────────────
  if (fase === 'leyendo') {
    return (
      <div style={{ textAlign: 'center', padding: '14px 0' }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: 'var(--ink)', marginBottom: 8 }}>MaKo está leyendo lo que le diste…</div>
        <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.6 }}>Ordenando tu avatar, tu oferta y tu nicho.<br />Tarda unos segundos.</div>
      </div>
    );
  }

  // ── Review editable ("esto entendí, corregí") ──────────────────────────────
  if (fase === 'listo') {
    const grupos: { label: string; campos: BriefCampo[] }[] = [];
    for (const c of brief) {
      let g = grupos.find((x) => x.label === c.grupo);
      if (!g) { g = { label: c.grupo, campos: [] }; grupos.push(g); }
      g.campos.push(c);
    }
    const captados = brief.filter((c) => (answers[c.key] ?? '').trim()).length;
    return (
      <div style={{ textAlign: 'left' }}>
        <p style={{ fontSize: 13, color: 'var(--dim)', margin: '0 0 14px', lineHeight: 1.55 }}>
          {captados > 0
            ? <>Entendí <b style={{ color: 'var(--ink)' }}>{captados}</b> {captados === 1 ? 'dato' : 'datos'} de tu negocio. Revisá y corregí lo que haga falta — con esto armo tus ángulos.</>
            : <>Completá lo que puedas. No hace falta que esté perfecto: después lo afinamos juntos.</>}
        </p>
        {cajaWarn}
        {grupos.map((g) => (
          <div key={g.label} style={{ marginTop: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>{g.label}</div>
            {g.campos.map((c) => (
              <div key={c.key} style={{ marginBottom: 9 }}>
                <label style={{ fontSize: 11.5, color: 'var(--faint)', display: 'block', marginBottom: 3 }}>{c.label}</label>
                {c.type === 'textarea'
                  ? <textarea style={{ ...inputIzq, minHeight: 52, resize: 'vertical', lineHeight: 1.5, padding: '9px 12px' }} value={answers[c.key] ?? ''} placeholder={c.placeholder}
                      onChange={(e) => setAnswers((a) => ({ ...a, [c.key]: e.target.value }))} />
                  : <input style={{ ...inputIzq, padding: '9px 12px' }} value={answers[c.key] ?? ''} placeholder={c.placeholder}
                      onChange={(e) => setAnswers((a) => ({ ...a, [c.key]: e.target.value }))} />}
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
          {onGuardar && (
            <button type="button" onClick={guardar} disabled={guardando}
              style={{ ...btnPrimary, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : guardadoOk ? 'Guardado ✓' : 'Guardar en mi perfil'}
            </button>
          )}
          <button type="button" onClick={() => { setWarnings([]); setGuardadoOk(false); setFase('intake'); }} style={linkBtn}>↑ Subir más documentos</button>
        </div>
      </div>
    );
  }

  // ── Intake (dump zone) ─────────────────────────────────────────────────────
  return (
    <div style={{ textAlign: 'left' }}>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        style={{ display: 'block', cursor: 'pointer', border: `1.5px dashed ${drag ? 'var(--primary)' : 'var(--border-strong)'}`, background: drag ? 'var(--primary-bg)' : 'var(--surface-2)', borderRadius: 13, padding: '22px 16px', textAlign: 'center', transition: 'all .15s' }}
      >
        <input ref={inputRef} type="file" multiple accept=".txt,.md,.markdown,.docx,.pdf,image/*" style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Arrastrá tus documentos o hacé clic</div>
        <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4, lineHeight: 1.5 }}>Avatar, oferta, nicho, producto… PDF, Word, texto o imágenes. Todos juntos.</div>
      </label>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {files.map((f) => (
            <span key={f.name + f.size} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 6px 4px 11px', fontSize: 12, color: 'var(--ink)', maxWidth: '100%' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{f.name}</span>
              <span style={{ color: 'var(--faint)', fontFamily: MONO, fontSize: 10.5 }}>{f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(f.size / 1024))}KB`}</span>
              <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setFiles((prev) => prev.filter((x) => x.name + x.size !== f.name + f.size))}
                style={{ border: 'none', background: 'var(--border)', color: 'var(--dim)', borderRadius: 999, width: 16, height: 16, lineHeight: '15px', fontSize: 10, cursor: 'pointer', padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', letterSpacing: '.08em', margin: '14px 0 10px' }}>Y/O</div>

      <input style={inputIzq} value={url} placeholder="Tu web o Instagram (https://…)" onChange={(e) => setUrl(e.target.value)} />
      <textarea style={{ ...inputIzq, minHeight: 66, resize: 'vertical', lineHeight: 1.5, marginTop: 8 }} value={notas} placeholder="O pegá acá lo que tengas, aunque esté desordenado…" onChange={(e) => setNotas(e.target.value)} />

      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 10 }}>{err}</div>}
      {cajaWarn}

      <button type="button" onClick={ordenar} disabled={!hayAlgo} style={{ ...btnPrimary, width: '100%', marginTop: 14, opacity: hayAlgo ? 1 : 0.4, cursor: hayAlgo ? 'pointer' : 'default' }}>✦ Ordenar esto</button>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button type="button" onClick={() => setFase('listo')} style={linkBtn}>{yaHayDatos ? 'Volver a mi perfil' : 'No tengo nada a mano — lo lleno yo'}</button>
      </div>
    </div>
  );
}
