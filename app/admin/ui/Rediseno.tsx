'use client';

// =============================================================================
// Las nueve partes y el Change History
// =============================================================================
// Es lo ÚNICO de esta pantalla que está escrito a mano, porque es lo único que
// ningún código puede deducir: el porqué de cada cambio. Todo lo demás —la
// barra, los íconos, las piezas— se monta de los componentes de verdad.

import { Section, MONO } from '@/app/_ui';
// El mismo «ver más» del historial de Proyectos del plan. Vive ahí y no en
// app/_ui porque nació ahí; se importa en vez de escribir un segundo.
import { useVerMas } from '@/app/plan/board/VerMas';
import { BITACORA, PARTES, CUENTAS } from './bitacora';

/** `**negrita**` y `` `código` `` — lo mínimo para que el historial se lea. */
export function texto(s: string) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((p, k) => {
    if (p.startsWith('**')) return <strong key={k} style={{ color: 'var(--ink)', fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`')) return <code key={k} style={{ fontFamily: MONO, fontSize: '.9em', color: 'var(--ink)' }}>{p.slice(1, -1)}</code>;
    return <span key={k}>{p}</span>;
  });
}

const CHIP = {
  hecha: { t: 'Hecha', bg: 'var(--good-bg)', c: 'var(--good)' },
  sigue: { t: 'Sigue', bg: 'var(--primary-bg)', c: 'var(--primary)' },
  cola: { t: 'En cola', bg: 'var(--surface-2)', c: 'var(--faint)' },
} as const;

// ── Las nueve partes ─────────────────────────────────────────────────────────
export function Partes() {
  return (
    <Section titulo="Las nueve partes">
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        {PARTES.map((p, i) => {
          const c = CHIP[p.estado];
          return (
            <li key={p.titulo} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: '13px 16px', background: p.estado === 'hecha' ? 'var(--good-bg)' : 'var(--surface)' }}>
              <span style={{ fontFamily: MONO, fontSize: 13, color: p.estado === 'hecha' ? 'var(--good)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)' }}>
                {p.titulo}
                <span style={{ display: 'block', fontWeight: 400, fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>{p.detalle}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', background: c.bg, color: c.c, border: `1px solid ${p.estado === 'cola' ? 'var(--border-strong)' : `color-mix(in srgb, ${c.c} 35%, transparent)`}` }}>
                {p.estado !== 'cola' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
                {c.t}
              </span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

// ── Change History ───────────────────────────────────────────────────────────
/** Un color por cuenta. Es CATEGORÍA, no estado: por eso no usa los semánticos. */
const COLOR_CUENTA: Record<keyof typeof CUENTAS, string> = {
  claude1: '#7C5CE0',
  claude2: '#0E9AA7',
};

export function ChangeHistory() {
  // El array se mantiene en orden cronológico —se agrega al final, que es lo
  // natural al escribirlo— pero se LEE al revés: lo último que pasó va arriba.
  // Un historial que obliga a scrollear hasta el fondo para ver el último
  // cambio está al revés de para qué se abre.
  const recientes = [...BITACORA].reverse();
  const { visibles, boton } = useVerMas(recientes, { inicial: 5, tanda: 5, estilo: 'texto' });

  return (
    <Section titulo="Change History">
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {visibles.map((h, i) => {
          const cuenta = CUENTAS[h.cuenta];
          const color = COLOR_CUENTA[h.cuenta];
          // La línea de tiempo se corta en el último VISIBLE, no en el último
          // del array: si no, cuelga en el aire cuando hay entradas plegadas.
          const ultimo = i === visibles.length - 1;
          return (
            <li key={h.titulo + i} className="mk-hist">
              {/* Columna de metadata: cuándo, en qué chat y desde qué cuenta.
                  Va a la izquierda y en mono para que las diez entradas se
                  puedan barrer en vertical sin leer ninguna. */}
              <div style={{ paddingTop: 15, textAlign: 'right' }}>
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{h.fecha}</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{h.hora}</div>
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 9, lineHeight: 1.35 }}>{h.chat}</div>
                <div title={`${h.cuenta} · config ${cuenta.config} · ventana ${cuenta.ventana}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 11, color: 'var(--dim)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px', cursor: 'help' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flex: 'none' }} />
                  {cuenta.nombre}
                </div>
              </div>

              <div style={{ borderLeft: `1px solid ${ultimo ? 'transparent' : 'var(--border)'}`, padding: '15px 0 22px 20px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: -4.5, top: 20, width: 8, height: 8, borderRadius: '50%', background: color }} />
                <div style={{ fontSize: 'var(--fs-card)', fontWeight: 600, color: 'var(--ink)' }}>{h.titulo}</div>
                <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {h.puntos.map((p, k) => (
                    <li key={k} style={{ position: 'relative', paddingLeft: 16, fontSize: 'var(--fs-sm)', lineHeight: 1.55, color: 'var(--dim)' }}>
                      <span style={{ position: 'absolute', left: 1, top: '.62em', width: 5, height: 5, borderRadius: '50%', background: 'var(--faint)' }} />
                      {texto(p)}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
      {boton}
    </Section>
  );
}
