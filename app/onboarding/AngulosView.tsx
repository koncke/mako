'use client';

// =============================================================================
// AngulosView — los 3 ÁNGULOS de venta que MaKo propone (estilo "100 anuncios")
// =============================================================================
// Self-contained: trae su estado de /api/onboarding/angulos. Si no hay ángulos,
// un botón los genera desde el brief del Archivero (lógica de Jan por dentro). Cada
// ángulo = una card estilo 100ads: tag de tipo + título + hook + descripción, con
// edición INLINE (tocás el texto y se guarda al salir). Sin score por ahora.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Angulo = { id: string; tipo: string; titulo: string; hook: string; descripcion: string };
type Estado = { angulos: Angulo[]; tieneBrief: boolean };

// Color por tipo (razón de compra).
const COLOR_TIPO: Record<string, string> = {
  'Problema': '#CF4E29', 'Deseo': '#7C4DD6', 'Mecanismo': '#2F6DDB',
  'Creencia': '#1E9E57', 'Prueba social': '#0E9AA7', 'Enemigo común': '#C8870C',
};
const colorDe = (t: string) => COLOR_TIPO[t] ?? 'var(--dim)';

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

// Texto editable en el lugar (igual que en El Archivero).
function Edit({ valor, onSave, style }: { valor: string; onSave: (v: string) => void; style?: CSSProperties }) {
  return (
    <div className="ang-edit" contentEditable suppressContentEditableWarning spellCheck={false}
      onBlur={(e) => { const nv = (e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim(); if (nv !== valor.trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '2px 6px', margin: '0 -6px', ...style }}
    >{valor}</div>
  );
}

export function AngulosView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = useRef(false);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/angulos')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const generar = async () => {
    setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/angulos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar' }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudieron generar los ángulos.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  const guardar = async (angulos: Angulo[]) => {
    setEst((e) => (e ? { ...e, angulos } : e));
    const j = await (await fetch('/api/onboarding/angulos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guardar', angulos }) })).json();
    if (j.ok) setEst(j as Estado);
  };
  const editar = (id: string, campo: keyof Angulo, v: string) => {
    if (!est) return;
    dirty.current = true;
    guardar(est.angulos.map((a) => (a.id === id ? { ...a, [campo]: v } : a)));
  };

  const css = <style>{'@keyframes ang-spin{to{transform:rotate(360deg)}}.ang-edit:hover{background:var(--surface-2)}.ang-edit:focus{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border-strong)}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tus ángulos…</div>;

  const angulos = est?.angulos ?? [];

  // ── Generando ────────────────────────────────────────────────────────────────
  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'ang-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está encontrando tus ángulos</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>Cruza tus audiencias, tus dolores y las formas de explicar tu oferta.<br />El anuncio no se inventa, se encuentra.</div>
      </div>
    );
  }

  // ── Vacío: generar ─────────────────────────────────────────────────────────
  if (!angulos.length) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tus ángulos de venta</h2>
        <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 420 }}>
          A partir de lo que entendí de tu negocio, encuentro <b>3 ángulos</b> para tus anuncios: distintas razones por las que tu cliente compra, cada una lista para volverse un creativo.
        </p>
        {est?.tieneBrief ? (
          <button type="button" onClick={generar} style={btnPrimary}>✦ Generar mis 3 ángulos</button>
        ) : (
          <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero carga tu negocio en <b>El Archivero</b>: de ahí salen los ángulos.</div>
        )}
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  // ── Las 3 cards ──────────────────────────────────────────────────────────────
  return (
    <div>
      {css}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 4 }}>Tus ángulos de venta</div>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>Toca cualquier texto para ajustarlo. Cada ángulo será un creativo.</div>
        </div>
        <button type="button" onClick={generar} style={btnGhost}>↺ Regenerar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
        {angulos.map((a) => {
          const c = colorDe(a.tipo);
          return (
            <div key={a.id} style={{ border: '1px solid var(--border)', borderTop: `3px solid ${c}`, borderRadius: 14, background: 'var(--surface)', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ alignSelf: 'flex-start', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c, background: `${c}1e`, border: `1px solid ${c}55`, borderRadius: 999, padding: '4px 10px' }}>{a.tipo}</span>
              <Edit valor={a.titulo} onSave={(v) => editar(a.id, 'titulo', v)} style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }} />
              <div style={{ borderLeft: `3px solid ${c}`, paddingLeft: 11 }}>
                <Edit valor={a.hook} onSave={(v) => editar(a.id, 'hook', v)} style={{ fontFamily: SANS, fontSize: 14.5, fontStyle: 'italic', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4 }} />
              </div>
              <Edit valor={a.descripcion} onSave={(v) => editar(a.id, 'descripcion', v)} style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }} />
            </div>
          );
        })}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
    </div>
  );
}
