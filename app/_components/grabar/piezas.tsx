'use client';

// =============================================================================
// Las piezas chicas de grabar una llamada: el punto que late, el reloj y «¿Cómo terminó?» (04/11/2026)
// =============================================================================
// Las usan el panel (./GrabarLlamada.tsx) y el indicador de la esquina (./GrabacionEnCurso.tsx), que va en el layout de TODA la
// app: por eso viven aparte, sin el Modal ni el resto del panel (lo que monta el layout lo carga cada pantalla).
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { RESULTADOS, ROTULO_RESULTADO, duracionTexto, type ResultadoLlamada } from '@/lib/grabar-llamada-reglas';

export const boton = (tono: 'rojo' | 'claro' | 'oscuro'): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 18px', borderRadius: 12,
  font: 'inherit', fontSize: 14.5, fontWeight: 650, cursor: 'pointer',
  border: tono === 'claro' ? '1px solid var(--border-strong)' : '1px solid transparent',
  background: tono === 'rojo' ? 'var(--bad)' : tono === 'oscuro' ? 'var(--ink)' : 'var(--surface-2)',
  color: tono === 'claro' ? 'var(--ink)' : 'var(--surface)',
});
export const chip = (activo: boolean): CSSProperties => ({
  minHeight: 36, padding: '0 12px', borderRadius: 999, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${activo ? 'var(--ink)' : 'var(--border-strong)'}`, background: activo ? 'var(--ink)' : 'var(--surface)',
  color: activo ? 'var(--surface)' : 'var(--ink)',
});

/** El reloj de la grabación en curso, que se redibuja solo. */
export function Reloj({ desde }: { desde: number | null }) {
  const [, tic] = useState(0);
  useEffect(() => { const t = setInterval(() => tic((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{duracionTexto(desde ? (Date.now() - desde) / 1000 : 0)}</span>;
}

const LATIDO = '@keyframes mk-grabando{0%,100%{opacity:1}50%{opacity:.35}}@media (prefers-reduced-motion: reduce){.mk-punto-grabando{animation:none!important}}';
export function Punto() {
  return (
    <>
      <style>{LATIDO}</style>
      <span aria-hidden className="mk-punto-grabando" style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--bad)', flex: 'none', animation: 'mk-grabando 1.2s ease-in-out infinite' }} />
    </>
  );
}

/** «¿Cómo terminó?»: un toque, y es lo que cuenta Cold Calling. */
export function ComoTermino({ valor, onElegir }: { valor: ResultadoLlamada | null; onElegir: (r: ResultadoLlamada) => void }) {
  return (
    <div role="group" aria-label="Cómo terminó" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {RESULTADOS.map((r) => (
        <button key={r} type="button" style={chip(valor === r)} aria-pressed={valor === r} onClick={() => onElegir(r)}>{ROTULO_RESULTADO[r]}</button>
      ))}
    </div>
  );
}

