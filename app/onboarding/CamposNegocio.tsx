'use client';

// =============================================================================
// CamposNegocio — editor de un GRUPO de campos del brief (Oferta, cliente ideal…)
// =============================================================================
// Self-contained: trae el estado de /api/onboarding/archivero y muestra los campos
// del brief cuyas claves matchean (por clave exacta o por prefijo), editables en el
// lugar (tocás el texto y se guarda al salir, vía /manual). Los valores vienen
// pre-cargados de lo que MaKo extrajo de los documentos; el cliente los corrige o
// completa. Reusado por las tabs "Oferta" y "Avatares" del hub (P4).

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Fuente = { tipo: 'archivo' | 'manual'; id?: string; nombre?: string };
type Campo = { key: string; label: string; type: string; placeholder?: string; grupo: string };
type Estado = { brief: Campo[]; answers: Record<string, string>; fuente: Record<string, Fuente> };

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '6px 22px 14px' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

// Campo editable en el lugar, con placeholder faint cuando está vacío.
function CampoEditable({ valor, ph, onSave }: { valor: string; ph?: string; onSave: (v: string) => void }) {
  return (
    <div className="cn-edit" contentEditable suppressContentEditableWarning spellCheck={false} data-ph={ph || 'Toca para escribir…'}
      onBlur={(e) => { const nv = (e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim(); if (nv !== valor.trim()) onSave(nv); }}
      style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.55, outline: 'none', cursor: 'text', borderRadius: 7, padding: '4px 8px', margin: '0 -8px', minHeight: 20 }}
    >{valor}</div>
  );
}

export function CamposNegocio({ titulo, subtitulo, keys, prefijos, onSaved }: {
  titulo: string;
  subtitulo?: string;
  /** Claves exactas a mostrar (además de las que matcheen prefijos). */
  keys?: string[];
  /** Prefijos de clave a incluir (ej: 'oferta_'). */
  prefijos?: string[];
  /** Se llama tras guardar un campo (el padre puede refrescar su propio estado). */
  onSaved?: () => void;
}) {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/archivero')).json(); if (j.ok || j.brief) setEst(j as Estado); else setErr(j.error || 'No se pudo cargar.'); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (key: string, v: string) => {
    setEst((e) => (e ? { ...e, answers: { ...e.answers, [key]: v }, fuente: { ...e.fuente, [key]: { tipo: 'manual' } } } : e));
    const j = await (await fetch('/api/onboarding/archivero/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campos: { [key]: v } }) })).json();
    if (j.ok && j.brief) setEst(j as Estado);
    onSaved?.();
  };

  const css = <style>{'.cn-edit:hover{background:var(--surface-2)}.cn-edit:focus{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border-strong)}.cn-edit:empty:before{content:attr(data-ph);color:var(--faint)}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando…</div>;
  if (!est) return <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>{err}</div>;

  const incluir = (k: string) => (keys?.includes(k) ?? false) || (prefijos?.some((p) => k.startsWith(p)) ?? false);
  const campos = est.brief.filter((c) => incluir(c.key));
  const fuenteTxt = (k: string) => { const f = est.fuente[k]; return !f ? 'a mano' : f.tipo === 'manual' ? 'a mano' : (f.nombre || 'un archivo'); };
  const algunDato = campos.some((c) => (est.answers[c.key] ?? '').trim());

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {css}
      <div style={{ ...eyebrow, color: 'var(--accent)', marginBottom: 4 }}>✦ {titulo}</div>
      <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 14 }}>{subtitulo || 'Toca cualquier dato para corregirlo. Lo que ves salió de tus documentos.'}</div>
      <div style={card}>
        {campos.map((c, i) => (
          <div key={c.key} style={{ padding: '13px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 5 }}>{c.label}</div>
            <CampoEditable key={`${c.key}:${est.answers[c.key] ?? ''}`} valor={est.answers[c.key] ?? ''} ph={c.placeholder} onSave={(v) => guardar(c.key, v)} />
            {(est.answers[c.key] ?? '').trim() && <div style={{ ...eyebrow, fontSize: 10, marginTop: 6 }}>· {fuenteTxt(c.key)}</div>}
          </div>
        ))}
        {!campos.length && <div style={{ fontSize: 14, color: 'var(--dim)', padding: '14px 0' }}>No hay campos para mostrar.</div>}
      </div>
      {!algunDato && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 12, textAlign: 'center' }}>Todavía no hay datos aquí. Sube documentos en <b>El Archivero</b> y se completan solos.</div>}
    </div>
  );
}
