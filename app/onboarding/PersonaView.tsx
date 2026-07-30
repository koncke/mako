'use client';

// =============================================================================
// PersonaView — la cara de marca: fotos + descripción para generar imágenes con IA
// =============================================================================
// Self-contained: /api/onboarding/persona. Subís varias fotos de la persona/vocero y
// escribís una descripción (apariencia, estilo, tono). Eso después le sirve a la IA
// para generar las imágenes de los creativos con esa persona. Corre en el workspace.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { SeccionCard, parsearSecciones } from '../components/SeccionCard';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Foto = { id: string; nombre: string; mime: string; url: string | null };
type Estado = { descripcion: string; fotos: Foto[] };

const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const btnPrimary: CSSProperties = { padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };

const MIN_FOTOS = 5;
const btnPrimaryStyle: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
const btnGhostStyle: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };

const ICONO_SECCION: Record<string, string> = {
  IDENTIDAD: '🧑', ROSTRO: '😐', OJOS: '👁️', CABELLO: '💇', COMPLEXIÓN: '📏',
  'MARCAS DISTINTIVAS': '✨', VESTIMENTA: '👔', ACTITUD: '🎭',
};

// La descripción viene SECCIONADA (mismo patrón que el panorama del Archivero: un
// encabezado en MAYÚSCULA por línea + su frase abajo) — misma tarjeta desplegable
// que el Resumen (pedido explícito de Martín: "que sean como el RESUMEN que
// hicimos antes"), con su propio mapa fijo de íconos por sección.
function DescripcionSecciones({ texto }: { texto: string }) {
  const secciones = parsearSecciones(texto, undefined, 30);
  // Si el modelo no siguió el formato (texto viejo, o algo se coló), mostramos el
  // texto crudo en vez de perderlo silenciosamente.
  if (secciones.length < 3) {
    return <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>{texto}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {secciones.map((s, i) => <SeccionCard key={s.titulo + i} s={s} abiertoDefault={i < 1} icono={ICONO_SECCION[s.titulo] ?? '📌'} size="sm" />)}
    </div>
  );
}

export function PersonaView({ onListo }: { onListo?: (listo: boolean) => void } = {}) {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [describiendo, setDescribiendo] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/persona')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { onListo?.(!!est && est.fotos.length >= MIN_FOTOS && !!est.descripcion.trim()); }, [est, onListo]);

  // Sube de a UNA foto por request, aunque el usuario haya elegido varias juntas: 5
  // fotos en un solo multipart superan el límite de body de Vercel (~4.5 MB) y el
  // server devuelve un 413 en HTML, no JSON — el fetch de golpe tiraba "Unexpected
  // token" al parsear. De a una (como ya andaba) nunca pega ese techo.
  const subir = async (files: FileList | null) => {
    const arr = files ? Array.from(files).filter((f) => f.type.startsWith('image/')) : [];
    if (!arr.length) return;
    setSubiendo(true); setErr(null); setWarnings([]);
    const warns: string[] = [];
    let ultimo: (Estado & { ok?: boolean }) | null = null;
    try {
      for (const f of arr) {
        const fd = new FormData(); fd.append('file', f);
        const res = await fetch('/api/onboarding/persona', { method: 'POST', body: fd });
        const j = await res.json().catch(() => null) as (Estado & { ok?: boolean; warnings?: string[]; error?: string }) | null;
        if (!j) { warns.push(`No se pudo subir "${f.name}" (error ${res.status}).`); continue; }
        if (Array.isArray(j.warnings)) warns.push(...j.warnings);
        if (j.ok !== false) ultimo = j; else warns.push(j.error || `No se pudo subir "${f.name}".`);
      }
    } finally {
      setWarnings(warns);
      if (ultimo) setEst(ultimo);
      else if (warns.length) setErr(warns[warns.length - 1]);
      setSubiendo(false);
    }
  };

  const borrar = async (id: string) => {
    try { const j = await (await fetch(`/api/onboarding/persona?id=${id}`, { method: 'DELETE' })).json(); if (j.ok) setEst(j as Estado); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  // MaKo mira las fotos y arma la descripción física detallada (para la IA generativa).
  const describir = async () => {
    setDescribiendo(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/persona', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'describir' }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo generar la descripción.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setDescribiendo(false); }
  };

  const css = <style>{'@keyframes per-spin{to{transform:rotate(360deg)}}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu persona…</div>;

  const fotos = est?.fotos ?? [];
  const faltan = Math.max(0, MIN_FOTOS - fotos.length);
  const descripcion = est?.descripcion ?? '';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {css}
      <div style={{ ...eyebrow, marginBottom: 14 }}>Tu persona · la cara de marca</div>

      {/* Fotos */}
      <div style={{ ...eyebrow, marginBottom: 10 }}>Fotos · {fotos.length}/{MIN_FOTOS}{faltan > 0 ? ' mínimo' : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 10 }}>
        {fotos.map((f) => (
          <div key={f.id} style={{ position: 'relative' }}>
            <div style={{ width: '100%', aspectRatio: '4 / 5', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              {f.url ? <img src={f.url} alt={f.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ ...eyebrow, display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>IMG</div>}
            </div>
            <button type="button" aria-label="Quitar" onClick={() => borrar(f.id)} style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 999, border: 'none', background: 'rgba(18,21,27,.72)', color: '#fff', fontSize: 12, lineHeight: '22px', cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
        ))}
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); subir(e.dataTransfer.files); }}
          style={{ width: '100%', aspectRatio: '4 / 5', borderRadius: 12, border: `1.5px dashed ${drag ? 'var(--primary)' : 'var(--border-strong)'}`, background: drag ? 'var(--primary-bg)' : 'var(--surface-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 6 }}>
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />
          {subiendo
            ? <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'per-spin .8s linear infinite' }} />
            : <><span style={{ fontSize: 22, color: 'var(--faint)' }}>+</span><span style={{ fontSize: 11, color: 'var(--dim)' }}>Subir fotos</span></>}
        </label>
      </div>
      {subiendo && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: -2, marginBottom: 8 }}>Subiendo de a una…</div>}
      {faltan > 0 && <div style={{ fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.5, marginBottom: 6 }}>Subí al menos <b>{MIN_FOTOS} fotos</b> de la persona (te faltan {faltan}) — mientras más ángulos, mejor la describe MaKo.</div>}

      {/* Descripción — la hace MaKo mirando las fotos (read-only) */}
      <div style={{ ...eyebrow, margin: '22px 0 8px' }}>Descripción de la persona · la hace MaKo</div>
      {describiendo ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 18px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'per-spin .8s linear infinite', flex: 'none' }} />
          <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>MaKo está mirando tus fotos y armando la descripción…</span>
        </div>
      ) : descripcion ? (
        <div>
          <DescripcionSecciones texto={descripcion} />
          <button type="button" onClick={describir} disabled={fotos.length === 0} style={{ ...btnGhostStyle, marginTop: 10, opacity: fotos.length === 0 ? 0.5 : 1 }}>↺ Regenerar descripción</button>
        </div>
      ) : (
        <button type="button" onClick={describir} disabled={fotos.length < MIN_FOTOS} style={{ ...btnPrimaryStyle, opacity: fotos.length < MIN_FOTOS ? 0.5 : 1, cursor: fotos.length < MIN_FOTOS ? 'default' : 'pointer' }}>✦ Que MaKo la describa</button>
      )}

      {/* Contexto: para qué sirve (siempre abajo) */}
      <div style={{ marginTop: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
        <div style={{ ...eyebrow, marginBottom: 7 }}>¿Para qué es esto?</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6 }}>La cara de marca es la persona que aparece en tus anuncios. MaKo mira sus fotos y arma una <b>descripción física detallada</b> (rostro, pelo, estilo, vibra). Esa ficha es lo que después usa la IA para <b>generar tus creativos con esa misma persona</b>, coherente en todos los anuncios.</div>
      </div>

      {warnings.length > 0 && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 13px', marginTop: 12 }}>
          {warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--warn)', lineHeight: 1.5 }}>· {w}</div>)}
        </div>
      )}
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{err}</div>}
    </div>
  );
}
