'use client';

// =============================================================================
// RazonesView — las MOTIVACIONES de compra de cada avatar (a fondo)
// =============================================================================
// La tab "Razones": por cada avatar, las distintas motivaciones por las que compra
// (ej curso de inglés: mejor salario, un viaje, un ascenso). Es la capa ESTRATÉGICA
// (el porqué); la tab "Matriz" cruza esto con los avatares y le agrega el copy/guion.
// Mismo dato (/api/onboarding/razones), dos vistas. Edición inline.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Avatar = { id: string; nombre: string; segmento: string; senalesMeta: string; situacion: string; dolor: string };
type Razon = { id: string; avatarId: string; nombre: string; descripcion: string; copy: string; imagenUrl: string };
type Estado = { razones: Razon[]; avatares: Avatar[]; tieneAvatares: boolean; tieneBrief: boolean };

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

export function RazonesView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/razones')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const generar = async () => {
    setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar' }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudieron generar las razones.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  const css = <style>{'@keyframes raz-spin{to{transform:rotate(360deg)}}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tus razones…</div>;

  const razones = est?.razones ?? [];
  const avatares = est?.avatares ?? [];

  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'raz-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está encontrando las razones</div>
      </div>
    );
  }

  if (!est?.tieneAvatares) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>💡</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tus razones de compra</h2>
        <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero define tus avatares en el paso <b>Avatares</b>.</div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  if (!razones.length) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>💡</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 24px', lineHeight: 1.25 }}>Tus razones de compra</h2>
        <button type="button" onClick={generar} style={btnPrimary}>✦ Encontrar mis razones</button>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  return (
    <div>
      {css}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ ...eyebrow }}>Tus razones · las motivaciones de compra</div>
        <button type="button" onClick={generar} style={btnGhost}>↺ Regenerar</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {avatares.map((av) => {
          const rs = razones.filter((r) => r.avatarId === av.id);
          if (!rs.length) return null;
          return (
            <div key={av.id}>
              {/* Cabecera del avatar: apilada (el nombre ya no se parte palabra por palabra). */}
              <div style={{ marginBottom: 12, paddingBottom: 9, borderBottom: '1px solid var(--border)' }}>
                <div style={{ ...eyebrow, marginBottom: 3 }}>Avatar</div>
                <div style={{ fontFamily: SANS, fontSize: 16.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>{av.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{av.segmento}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {rs.map((r, i) => (
                  <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'var(--faint)', flex: 'none' }}>R{i + 1}</span>
                      <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }}>{r.nombre}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55 }}>{r.descripcion}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
    </div>
  );
}
