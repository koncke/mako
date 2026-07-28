'use client';

// =============================================================================
// RazonesView — la matriz de RAZONES de compra, como TABLA literal + modal
// =============================================================================
// La matriz de Jan: filas = AVATARES, columnas = las 3 RAZONES (Dolor · Deseo ·
// Explicación). Se ve como una TABLA de verdad; al hacer clic en una celda se abre
// un MODAL minimalista con el detalle editable (título, gancho, descripción). El
// motor sigue siendo /api/onboarding/angulos (legacy: "ángulos" ahí = estas razones).
// Los "Ángulos" ahora son otra cosa (formatos de creativo, ver FormatosView).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Avatar = { id: string; nombre: string; segmento: string; senalesMeta: string; situacion: string; dolor: string };
type Razon = { id: string; avatarId: string; razon: string; titulo: string; hook: string; descripcion: string };
type Estado = { angulos: Razon[]; avatares: Avatar[]; tieneAvatares: boolean; tieneBrief: boolean };

const COLUMNAS: Array<{ id: string; color: string }> = [
  { id: 'Dolor', color: '#CF4E29' },
  { id: 'Deseo', color: '#7C4DD6' },
  { id: 'Explicación', color: '#2F6DDB' },
];
const colorRazon = (r: string) => COLUMNAS.find((x) => x.id === r)?.color ?? 'var(--dim)';

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

// Texto editable en el lugar (dentro del modal).
function Edit({ valor, onSave, style }: { valor: string; onSave: (v: string) => void; style?: CSSProperties }) {
  return (
    <div className="raz-edit" contentEditable suppressContentEditableWarning spellCheck={false}
      onBlur={(e) => { const nv = (e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim(); if (nv !== (valor ?? '').trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '3px 7px', margin: '0 -7px', ...style }}
    >{valor}</div>
  );
}

export function RazonesView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null); // id de la razón en el modal
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

  const guardar = async (angulos: Razon[]) => {
    setEst((e) => (e ? { ...e, angulos } : e));
    const j = await (await fetch('/api/onboarding/angulos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guardar', angulos }) })).json();
    if (j.ok) setEst(j as Estado);
  };
  const editar = (id: string, campo: keyof Razon, v: string) => {
    if (!est) return;
    dirty.current = true;
    guardar(est.angulos.map((a) => (a.id === id ? { ...a, [campo]: v } : a)));
  };

  const css = <style>{'@keyframes raz-spin{to{transform:rotate(360deg)}}@keyframes raz-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}.raz-edit:hover{background:var(--surface-2)}.raz-edit:focus{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border-strong)}.raz-cell:hover{background:var(--surface-2);border-color:var(--border-strong)}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu matriz…</div>;

  const razones = est?.angulos ?? [];
  const avatares = est?.avatares ?? [];
  const cell = (avatarId: string, razon: string) => razones.find((r) => r.avatarId === avatarId && r.razon === razon);

  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'raz-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está armando tus razones</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>Para cada avatar, un dolor, un deseo y una explicación.</div>
      </div>
    );
  }

  if (!est?.tieneAvatares) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧩</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tu matriz de razones</h2>
        <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto 8px', maxWidth: 440 }}>Las razones salen de tus <b>avatares</b>: para cada uno, un dolor, un deseo y una explicación.</p>
        <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero define tus avatares en el paso <b>Avatares</b>.</div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  if (!razones.length) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧩</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tu matriz de razones</h2>
        <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto 24px', maxWidth: 440 }}>Para tus <b>{avatares.length} avatares</b>, MaKo encuentra <b>3 razones cada uno</b> (dolor, deseo, explicación): {avatares.length * 3} razones para testear.</p>
        <button type="button" onClick={generar} style={btnPrimary}>✦ Armar mi matriz de razones</button>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  const razonAbierta = abierta ? razones.find((r) => r.id === abierta) : null;
  const avatarDe = (id: string) => avatares.find((a) => a.id === id);

  // ── La TABLA ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {css}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 4 }}>Tu matriz de razones</div>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>Filas = avatares, columnas = razones de compra. Toca una celda para ver y editar el detalle.</div>
        </div>
        <button type="button" onClick={generar} style={btnGhost}>↺ Regenerar</button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 14 }}>
        <div style={{ minWidth: 640, display: 'grid', gridTemplateColumns: '160px repeat(3, 1fr)' }}>
          {/* Cabecera */}
          <div style={{ ...eyebrow, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>Avatar</div>
          {COLUMNAS.map((c) => (
            <div key={c.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c.color }}>{c.id}</span>
            </div>
          ))}

          {/* Filas por avatar */}
          {avatares.map((av) => (
            <div key={av.id} style={{ display: 'contents' }}>
              <div style={{ padding: '13px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>{av.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{av.segmento}</div>
              </div>
              {COLUMNAS.map((c) => {
                const r = cell(av.id, c.id);
                return (
                  <button key={c.id} type="button" className={r ? 'raz-cell' : undefined} onClick={() => r && setAbierta(r.id)}
                    style={{ textAlign: 'left', font: 'inherit', cursor: r ? 'pointer' : 'default', padding: '13px 14px', borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--surface)', transition: 'background .12s', minHeight: 62, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {r ? (
                      <>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{r.titulo}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.hook}</span>
                      </>
                    ) : <span style={{ fontSize: 12, color: 'var(--faint)' }}>—</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}

      {/* ── MODAL de detalle (minimalista) ── */}
      {razonAbierta && (() => {
        const c = colorRazon(razonAbierta.razon);
        const av = avatarDe(razonAbierta.avatarId);
        return (
          <div onClick={() => setAbierta(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ animation: 'raz-in .18s ease-out', width: 'min(560px, 100%)', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `3px solid ${c}`, borderRadius: 16, padding: '22px 24px', boxShadow: '0 20px 60px rgba(18,21,27,.25)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c, background: `${c}1e`, border: `1px solid ${c}55`, borderRadius: 999, padding: '4px 10px' }}>{razonAbierta.razon}</span>
                  {av && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 8 }}>Avatar: <b style={{ color: 'var(--ink)' }}>{av.nombre}</b></div>}
                </div>
                <button type="button" onClick={() => setAbierta(null)} aria-label="Cerrar" style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 15 }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ ...eyebrow, marginBottom: 5 }}>Título</div>
                  <Edit valor={razonAbierta.titulo} onSave={(v) => editar(razonAbierta.id, 'titulo', v)} style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }} />
                </div>
                <div>
                  <div style={{ ...eyebrow, marginBottom: 5 }}>Gancho (primera línea del anuncio)</div>
                  <div style={{ borderLeft: `3px solid ${c}`, paddingLeft: 12 }}>
                    <Edit valor={razonAbierta.hook} onSave={(v) => editar(razonAbierta.id, 'hook', v)} style={{ fontFamily: SANS, fontSize: 15.5, fontStyle: 'italic', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4 }} />
                  </div>
                </div>
                <div>
                  <div style={{ ...eyebrow, marginBottom: 5 }}>Descripción</div>
                  <Edit valor={razonAbierta.descripcion} onSave={(v) => editar(razonAbierta.id, 'descripcion', v)} style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6 }} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
