'use client';

// =============================================================================
// PersonaView — la cara de marca: fotos + descripción para generar imágenes con IA
// =============================================================================
// Self-contained: /api/onboarding/persona. Subís varias fotos de la persona/vocero y
// escribís una descripción (apariencia, estilo, tono). Eso después le sirve a la IA
// para generar las imágenes de los creativos con esa persona. Corre en el workspace.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Foto = { id: string; nombre: string; mime: string; url: string | null };
type Estado = { descripcion: string; fotos: Foto[] };

const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const btnPrimary: CSSProperties = { padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };

export function PersonaView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/persona')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const subir = async (files: FileList | null) => {
    const arr = files ? Array.from(files).filter((f) => f.type.startsWith('image/')) : [];
    if (!arr.length) return;
    setSubiendo(true); setErr(null); setWarnings([]);
    try {
      const fd = new FormData(); arr.forEach((f) => fd.append('file', f));
      const j = await (await fetch('/api/onboarding/persona', { method: 'POST', body: fd })).json();
      setWarnings(Array.isArray(j.warnings) ? j.warnings : []);
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudieron subir las fotos.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setSubiendo(false); }
  };

  const borrar = async (id: string) => {
    try { const j = await (await fetch(`/api/onboarding/persona?id=${id}`, { method: 'DELETE' })).json(); if (j.ok) setEst(j as Estado); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const guardarDescripcion = async (texto: string) => {
    setEst((e) => (e ? { ...e, descripcion: texto } : e));
    await fetch('/api/onboarding/persona', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descripcion: texto }) });
  };

  const css = <style>{'@keyframes per-spin{to{transform:rotate(360deg)}}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu persona…</div>;

  const fotos = est?.fotos ?? [];

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {css}
      <div style={{ ...eyebrow, marginBottom: 18 }}>Tu persona · la cara de marca</div>

      {/* Fotos */}
      <div style={{ ...eyebrow, marginBottom: 10 }}>Fotos{fotos.length ? ` · ${fotos.length}` : ''}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
        {fotos.map((f) => (
          <div key={f.id} style={{ position: 'relative', width: 104 }}>
            <div style={{ width: 104, height: 128, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              {f.url ? <img src={f.url} alt={f.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ ...eyebrow, display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>IMG</div>}
            </div>
            <button type="button" aria-label="Quitar" onClick={() => borrar(f.id)} style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 999, border: 'none', background: 'rgba(18,21,27,.72)', color: '#fff', fontSize: 12, lineHeight: '22px', cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
        ))}
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); subir(e.dataTransfer.files); }}
          style={{ width: 104, height: 128, borderRadius: 12, border: `1.5px dashed ${drag ? 'var(--primary)' : 'var(--border-strong)'}`, background: drag ? 'var(--primary-bg)' : 'var(--surface-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 6 }}>
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />
          {subiendo
            ? <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'per-spin .8s linear infinite' }} />
            : <><span style={{ fontSize: 22, color: 'var(--faint)' }}>+</span><span style={{ fontSize: 11, color: 'var(--dim)' }}>Subir fotos</span></>}
        </label>
      </div>

      {/* Descripción */}
      <div style={{ ...eyebrow, margin: '20px 0 8px' }}>Descripción de la persona</div>
      <textarea
        defaultValue={est?.descripcion ?? ''}
        onBlur={(e) => { const v = e.target.value.trim(); if (v !== (est?.descripcion ?? '').trim()) guardarDescripcion(v); }}
        placeholder="Ej: Hombre, ~40 años, barba corta, camisa casual, tono cercano y directo. Suele grabar en su oficina con buena luz…"
        style={{ width: '100%', minHeight: 120, padding: '13px 15px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14.5, lineHeight: 1.6, outline: 'none', resize: 'vertical' }}
      />
      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8, lineHeight: 1.5 }}>Cuanto más precisa la descripción (edad, rasgos, ropa, estilo, escenario), mejor sale la imagen generada.</div>
      {warnings.length > 0 && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 13px', marginTop: 12 }}>
          {warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--warn)', lineHeight: 1.5 }}>· {w}</div>)}
        </div>
      )}
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{err}</div>}
    </div>
  );
}
