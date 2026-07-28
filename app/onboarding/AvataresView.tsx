'use client';

// =============================================================================
// AvataresView — los 3 AVATARES que MaKo propone (el "¿a quién?" de Jan)
// =============================================================================
// Self-contained: trae su estado de /api/onboarding/avatares. Si no hay avatares,
// un botón los propone desde el brief del Archivero. Cada avatar = una card con
// nombre (el subnicho), una escena, su dolor y su deseo, con edición INLINE (tocás
// el texto y se guarda al salir). Son las FILAS de la matriz de ángulos: primero
// definís a QUIÉN le hablás, después MaKo encuentra las razones de compra.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Avatar = { id: string; nombre: string; descripcion: string; dolor: string; deseo: string };
type Estado = { avatares: Avatar[]; tieneBrief: boolean };

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

// Texto editable en el lugar (igual que en El Archivero / Ángulos).
function Edit({ valor, onSave, style }: { valor: string; onSave: (v: string) => void; style?: CSSProperties }) {
  return (
    <div className="ava-edit" contentEditable suppressContentEditableWarning spellCheck={false}
      onBlur={(e) => { const nv = (e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim(); if (nv !== valor.trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '2px 6px', margin: '0 -6px', ...style }}
    >{valor}</div>
  );
}

// Bloque etiqueta + texto (Dolor / Deseo), con la etiqueta chiquita arriba.
function Campo({ label, color, valor, onSave }: { label: string; color: string; valor: string; onSave: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color, marginBottom: 3 }}>{label}</div>
      <Edit valor={valor} onSave={onSave} style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }} />
    </div>
  );
}

export function AvataresView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/avatares')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const generar = async () => {
    setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/avatares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar' }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudieron generar los avatares.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  const guardar = async (avatares: Avatar[]) => {
    setEst((e) => (e ? { ...e, avatares } : e));
    const j = await (await fetch('/api/onboarding/avatares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guardar', avatares }) })).json();
    if (j.ok) setEst(j as Estado);
  };
  const editar = (id: string, campo: keyof Avatar, v: string) => {
    if (!est) return;
    guardar(est.avatares.map((a) => (a.id === id ? { ...a, [campo]: v } : a)));
  };

  const css = <style>{'@keyframes ava-spin{to{transform:rotate(360deg)}}.ava-edit:hover{background:var(--surface-2)}.ava-edit:focus{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border-strong)}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tus avatares…</div>;

  const avatares = est?.avatares ?? [];

  // ── Generando ────────────────────────────────────────────────────────────────
  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'ava-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está definiendo tus avatares</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>Busca los 3 subnichos que te compran por razones distintas.<br />No le hablas a todos: le hablas a cada uno.</div>
      </div>
    );
  }

  // ── Vacío: generar ─────────────────────────────────────────────────────────
  if (!avatares.length) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tus avatares</h2>
        <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 440 }}>
          Antes de los ángulos, definimos a <b>quién</b> le hablas. De lo que entendí de tu negocio, propongo <b>3 avatares</b>: tres tipos de cliente que te compran por razones distintas. Los revisas y ajustas.
        </p>
        {est?.tieneBrief ? (
          <button type="button" onClick={generar} style={btnPrimary}>✦ Proponer mis 3 avatares</button>
        ) : (
          <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero carga tu negocio en <b>El Archivero</b>: de ahí salen los avatares.</div>
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
          <div style={{ ...eyebrow, marginBottom: 4 }}>Tus avatares</div>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>Toca cualquier texto para ajustarlo. Son las filas de tu matriz de ángulos.</div>
        </div>
        <button type="button" onClick={generar} style={btnGhost}>↺ Regenerar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {avatares.map((a, i) => (
          <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--faint)', flex: 'none' }}>0{i + 1}</span>
              <Edit valor={a.nombre} onSave={(v) => editar(a.id, 'nombre', v)} style={{ fontFamily: SANS, fontSize: 17.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }} />
            </div>
            <Edit valor={a.descripcion} onSave={(v) => editar(a.id, 'descripcion', v)} style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }} />
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 11, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Campo label="Dolor" color="#CF4E29" valor={a.dolor} onSave={(v) => editar(a.id, 'dolor', v)} />
              <Campo label="Deseo" color="#7C4DD6" valor={a.deseo} onSave={(v) => editar(a.id, 'deseo', v)} />
            </div>
          </div>
        ))}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
    </div>
  );
}
