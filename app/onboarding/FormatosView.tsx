'use client';

// =============================================================================
// FormatosView — la sub-pestaña «Ángulos» de Second Brain: los FORMATOS de creativo (imagen/video)
// =============================================================================
// La biblioteca de formatos es FIJA (la definimos nosotros). MaKo elige UN formato por anuncio (celda de la
// matriz: `elegirAngulo` → anguloImagen/anguloVideo), y acá se ve la biblioteca con cuántos anuncios de la
// matriz usan cada uno, contados de las razones, sin IA (GET /api/onboarding/formatos → `usosPorFormato`).
//
// ⚠️ HASTA EL 23/10/2026 había un botón «✦ Que MaKo elija mis formatos» / «↺ Recomendar de nuevo» que pagaba IA
// por una recomendación a nivel negocio que ningún generador leía. Medido en prod: 0 negocios la tenían y 0
// llamadas en toda la historia. Se sacó (docs/hallazgos-onboarding.md); no vuelve sin un consumidor.
// Pantalla existente: no se diseñó nada nuevo. La marca «En N anuncios» ocupa el lugar de la vieja «✦ Reco», con
// el color del medio que ya usaba; sin la ✦, que marca lo que hizo MaKo, y esto es un conteo.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { BIBLIOTECA_ANGULOS } from '@/lib/angulos-data';

const MONO = "'Geist Mono', monospace";

type Medio = 'imagen' | 'video';
type Formato = { id: string; nombre: string; medio: Medio; descripcion: string; ejemplo: string };
type Estado = { biblioteca: Formato[]; usos: Record<string, number> };

const COLOR_MEDIO: Record<Medio, string> = { imagen: '#2F6DDB', video: '#7C4DD6' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

function MedioPill({ medio }: { medio: Medio }) {
  const c = COLOR_MEDIO[medio];
  return <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: c, background: `${c}1e`, border: `1px solid ${c}55`, borderRadius: 999, padding: '3px 9px' }}>{medio === 'imagen' ? 'Imagen' : 'Video'}</span>;
}

export function FormatosView() {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/formatos')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando los formatos…</div>;

  // La biblioteca es fija: si el GET cae (403, 500, red), se ve igual, sin conteos, con el error arriba.
  const biblioteca = est?.biblioteca ?? BIBLIOTECA_ANGULOS;
  const usos = est?.usos ?? {};
  const usosDe = (id: string) => usos[id] ?? 0;
  // Dentro de cada medio, primero los que usa la matriz (de más a menos); después, en el orden de la biblioteca.
  const porMedio = (m: Medio) => biblioteca
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.medio === m)
    .sort((a, b) => usosDe(b.f.id) - usosDe(a.f.id) || a.i - b.i)
    .map(({ f }) => f);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...eyebrow, marginBottom: 4 }}>Ángulos · formatos de creativo</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', maxWidth: 520 }}>MaKo elige uno para cada anuncio de tu Matriz.</div>
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, margin: '0 0 14px' }}>{err}</div>}
      {(['imagen', 'video'] as Medio[]).map((m) => (
        <div key={m} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}><MedioPill medio={m} /><span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{porMedio(m).length} formatos</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
            {porMedio(m).map((f) => {
              const n = usosDe(f.id);
              const on = n > 0;
              return (
                <div key={f.id} style={{ border: `1px solid ${on ? COLOR_MEDIO[m] : 'var(--border)'}`, background: on ? `${COLOR_MEDIO[m]}0d` : 'var(--surface)', borderRadius: 12, padding: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{f.nombre}</span>
                    {on && <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: COLOR_MEDIO[m] }}>En {n} {n === 1 ? 'anuncio' : 'anuncios'}</span>}
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
}
