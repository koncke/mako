'use client';

// =============================================================================
// FormatosView — la tab "Ángulos": los FORMATOS de creativo (imagen/video)
// =============================================================================
// La biblioteca de formatos es FIJA (la definimos nosotros); MaKo ELIGE de ahí los
// mejores para el negocio (según sus razones + su gancho) y dice por qué. Arriba, las
// recomendaciones de MaKo; abajo, la biblioteca completa (referencia), con los
// recomendados marcados. El cliente NO edita la biblioteca (solo regenera las recos).

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Medio = 'imagen' | 'video';
type Formato = { id: string; nombre: string; medio: Medio; descripcion: string; ejemplo: string };
type Recomendacion = { formatoId: string; para: string; porque: string };
type Estado = { biblioteca: Formato[]; recomendaciones: Recomendacion[]; tieneRazones: boolean };

const COLOR_MEDIO: Record<Medio, string> = { imagen: '#2F6DDB', video: '#7C4DD6' };
const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

function MedioPill({ medio }: { medio: Medio }) {
  const c = COLOR_MEDIO[medio];
  return <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c, background: `${c}1e`, border: `1px solid ${c}55`, borderRadius: 999, padding: '3px 9px' }}>{medio === 'imagen' ? 'Imagen' : 'Video'}</span>;
}

export function FormatosView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/formatos')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const generar = async () => {
    setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/formatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar' }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudieron elegir los formatos.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  const css = <style>{'@keyframes fmt-spin{to{transform:rotate(360deg)}}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando los formatos…</div>;

  const biblioteca = est?.biblioteca ?? [];
  const recos = est?.recomendaciones ?? [];
  const fmtPorId = new Map(biblioteca.map((f) => [f.id, f]));
  const recomendados = new Set(recos.map((r) => r.formatoId));
  const porMedio = (m: Medio) => biblioteca.filter((f) => f.medio === m);

  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'fmt-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está eligiendo tus formatos</div>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.6 }}>De la biblioteca, los que mejor le pegan a tus razones y tu gancho.</div>
      </div>
    );
  }

  const bibliotecaBloque = (
    <div>
      <div style={{ ...eyebrow, marginBottom: 12 }}>Biblioteca de formatos</div>
      {(['imagen', 'video'] as Medio[]).map((m) => (
        <div key={m} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}><MedioPill medio={m} /><span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{porMedio(m).length} formatos</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
            {porMedio(m).map((f) => {
              const on = recomendados.has(f.id);
              return (
                <div key={f.id} style={{ border: `1px solid ${on ? COLOR_MEDIO[m] : 'var(--border)'}`, background: on ? `${COLOR_MEDIO[m]}0d` : 'var(--surface)', borderRadius: 12, padding: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{f.nombre}</span>
                    {on && <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: COLOR_MEDIO[m] }}>✦ Reco</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{f.descripcion}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.45, marginTop: 6, fontStyle: 'italic' }}>{f.ejemplo}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  // Sin recomendaciones aún: CTA (o pedir Razones) + la biblioteca de referencia.
  if (!recos.length) {
    return (
      <div>
        {css}
        <div style={{ maxWidth: 540, margin: '0 auto 26px', textAlign: 'center', padding: '32px 0 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
          <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tus ángulos · formatos de creativo</h2>
          <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto 22px', maxWidth: 470 }}>
            De esta biblioteca de formatos (imagen y video), MaKo elige los que mejor le pegan a <b>tus razones</b> y <b>tu gancho</b>, y te dice por qué.
          </p>
          {est?.tieneRazones ? (
            <button type="button" onClick={generar} style={btnPrimary}>✦ Que MaKo elija mis formatos</button>
          ) : (
            <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero arma tus <b>Razones</b> (la matriz): de ahí salen los formatos.</div>
          )}
          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
        </div>
        {bibliotecaBloque}
      </div>
    );
  }

  return (
    <div>
      {css}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...eyebrow, marginBottom: 4 }}>Ángulos · formatos recomendados</div>
          <div style={{ fontSize: 13, color: 'var(--dim)', maxWidth: 520 }}>De la biblioteca, estos son los que MaKo elige para tu negocio.</div>
        </div>
        <button type="button" onClick={generar} style={btnGhost}>↺ Recomendar de nuevo</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 26 }}>
        {recos.map((r, i) => {
          const f = fmtPorId.get(r.formatoId);
          if (!f) return null;
          const c = COLOR_MEDIO[f.medio];
          return (
            <div key={i} style={{ border: '1px solid var(--border)', borderTop: `3px solid ${c}`, borderRadius: 14, background: 'var(--surface)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MedioPill medio={f.medio} /><span style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>{f.nombre}</span></div>
              <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{f.descripcion}</div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 2 }}>
                <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 3 }}>Para · {r.para}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{r.porque}</div>
              </div>
            </div>
          );
        })}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, margin: '0 0 14px', textAlign: 'center' }}>{err}</div>}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>{bibliotecaBloque}</div>
    </div>
  );
}
