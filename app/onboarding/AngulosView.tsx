'use client';

// =============================================================================
// AngulosView — la MATRIZ 3×3 de ángulos (metodología de Jan)
// =============================================================================
// Self-contained: trae su estado de /api/onboarding/angulos. La matriz son los
// AVATARES (filas, de lib/avatares.ts) × 3 RAZONES de compra (columnas: Dolor,
// Deseo, Explicación). Cada celda = un ángulo listo para volverse creativo — los
// ~9 anuncios "RECON" que Jan lanza para que el mercado elija al ganador. Edición
// INLINE (tocás el texto y se guarda al salir). Sin score por ahora.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Avatar = { id: string; nombre: string; descripcion: string; dolor: string; deseo: string };
type Angulo = { id: string; avatarId: string; razon: string; titulo: string; hook: string; descripcion: string };
type Estado = { angulos: Angulo[]; avatares: Avatar[]; tieneAvatares: boolean; tieneBrief: boolean };

// Las 3 razones = columnas de la matriz, en orden fijo, con su color.
const RAZONES: Array<{ id: string; color: string }> = [
  { id: 'Dolor', color: '#CF4E29' },
  { id: 'Deseo', color: '#7C4DD6' },
  { id: 'Explicación', color: '#2F6DDB' },
];
const colorRazon = (r: string) => RAZONES.find((x) => x.id === r)?.color ?? 'var(--dim)';

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

// Una celda de la matriz: la card del ángulo.
function AnguloCard({ a, onEdit }: { a: Angulo; onEdit: (campo: keyof Angulo, v: string) => void }) {
  const c = colorRazon(a.razon);
  return (
    <div style={{ border: '1px solid var(--border)', borderTop: `3px solid ${c}`, borderRadius: 14, background: 'var(--surface)', padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <span style={{ alignSelf: 'flex-start', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c, background: `${c}1e`, border: `1px solid ${c}55`, borderRadius: 999, padding: '4px 10px' }}>{a.razon}</span>
      <Edit valor={a.titulo} onSave={(v) => onEdit('titulo', v)} style={{ fontFamily: SANS, fontSize: 16.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }} />
      <div style={{ borderLeft: `3px solid ${c}`, paddingLeft: 10 }}>
        <Edit valor={a.hook} onSave={(v) => onEdit('hook', v)} style={{ fontFamily: SANS, fontSize: 13.5, fontStyle: 'italic', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4 }} />
      </div>
      <Edit valor={a.descripcion} onSave={(v) => onEdit('descripcion', v)} style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }} />
    </div>
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
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo generar la matriz.');
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

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu matriz…</div>;

  const angulos = est?.angulos ?? [];
  const avatares = est?.avatares ?? [];

  // ── Generando ────────────────────────────────────────────────────────────────
  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'ang-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está armando tu matriz</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>Para cada avatar, encuentra 3 razones de compra: un dolor, un deseo y una explicación.<br />El anuncio no se inventa, se encuentra.</div>
      </div>
    );
  }

  // ── Falta avatares ───────────────────────────────────────────────────────────
  if (!est?.tieneAvatares) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tu matriz de ángulos</h2>
        <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto 8px', maxWidth: 440 }}>
          Los ángulos salen de tus <b>avatares</b>: para cada uno, 3 razones de compra (un dolor, un deseo y una explicación).
        </p>
        <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero define tus avatares en el paso <b>Avatares</b>.</div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  // ── Con avatares pero sin matriz: generar ────────────────────────────────────
  if (!angulos.length) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tu matriz de ángulos</h2>
        <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 440 }}>
          Para tus <b>{avatares.length} avatares</b>, encuentro <b>3 ángulos cada uno</b> (un dolor, un deseo y una explicación): {avatares.length * 3} anuncios para testear y dejar que el mercado elija al ganador.
        </p>
        <button type="button" onClick={generar} style={btnPrimary}>✦ Armar mi matriz de ángulos</button>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  // ── La matriz: una fila por avatar, 3 ángulos por fila ───────────────────────
  const porAvatar = avatares.map((av) => ({
    avatar: av,
    angs: RAZONES.map((r) => angulos.find((a) => a.avatarId === av.id && a.razon === r.id)).filter(Boolean) as Angulo[],
  })).filter((g) => g.angs.length);
  // Ángulos huérfanos (sin avatar reconocido): al final, por si acaso.
  const huerfanos = angulos.filter((a) => !avatares.some((av) => av.id === a.avatarId));

  return (
    <div>
      {css}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 4 }}>Tu matriz de ángulos</div>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>Cada fila es un avatar; cada columna, una razón de compra. Toca cualquier texto para ajustarlo.</div>
        </div>
        <button type="button" onClick={generar} style={btnGhost}>↺ Regenerar</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {porAvatar.map(({ avatar, angs }) => (
          <div key={avatar.id}>
            {/* Cabecera de la fila = el avatar */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', flex: 'none' }}>Avatar</span>
              <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{avatar.nombre}</span>
              <span style={{ fontSize: 12.5, color: 'var(--dim)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {avatar.dolor}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {angs.map((a) => <AnguloCard key={a.id} a={a} onEdit={(campo, v) => editar(a.id, campo, v)} />)}
            </div>
          </div>
        ))}

        {huerfanos.length > 0 && (
          <div>
            <div style={{ ...eyebrow, marginBottom: 10 }}>Otros ángulos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {huerfanos.map((a) => <AnguloCard key={a.id} a={a} onEdit={(campo, v) => editar(a.id, campo, v)} />)}
            </div>
          </div>
        )}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
    </div>
  );
}
