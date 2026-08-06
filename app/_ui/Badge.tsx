'use client';

// =============================================================================
// Badge · Tag · Status — tres cosas distintas que hoy se usan indistintamente
// =============================================================================
// El documento de rediseño las separa a propósito, porque mezclarlas es lo que
// hace que la interfaz parezca ruido de colores:
//
//   Badge   un CONTADOR o una novedad («3 sin leer»). Regla dura del documento:
//           «los badges representan una obligación concreta y no ruido — si todo
//           tiene badge, nada tiene badge».
//   Tag     una CATEGORÍA: proyecto, canal, etiqueta, ángulo. Color libre y SIN
//           carga semántica. Nunca usa los colores de estado.
//   Status  un ESTADO semántico, con punto de color. Es el único de los tres
//           que puede usar la regla de color completa.
//
// Si dudás entre Tag y Status, preguntate: ¿el color me dice si algo está bien
// o mal? Si sí, es Status. Si solo me dice de qué tipo es, es Tag.

import type { ReactNode } from 'react';
import { TONO, type Tono } from './tokens';

export type { Tono };

/** Contador / novedad. `tono` por defecto rojo, que es lo que exige atención. */
export function Badge({ children, tono = 'bad', max = 99 }: { children: number | string; tono?: Tono; max?: number }) {
  const t = TONO[tono];
  const texto = typeof children === 'number' && children > max ? `${max}+` : children;
  return (
    <span className="mk-badge" style={{ background: t.fill, color: tono === 'mako' ? '#17140C' : '#fff' }}>
      {texto}
    </span>
  );
}

/**
 * Categoría. El `color` es libre (el del proyecto, el del canal); si no viene,
 * queda neutro. No acepta tonos semánticos a propósito.
 */
export function Tag({ children, color, icon }: { children: ReactNode; color?: string; icon?: ReactNode }) {
  return (
    <span className="mk-tag" style={{
      background: color ? `color-mix(in srgb, ${color} 12%, transparent)` : 'var(--surface-2)',
      borderColor: color ? `color-mix(in srgb, ${color} 32%, transparent)` : 'var(--border-strong)',
      color: color ?? 'var(--dim)',
    }}>
      {icon}
      {children}
    </span>
  );
}

/**
 * Estado semántico. El punto de color va SIEMPRE acompañado del texto: el color
 * solo deja afuera a quien no lo distingue, y en una tabla densa tampoco se lee.
 */
export function Status({ children, tono = 'neutral', solido = false }: {
  children: ReactNode;
  tono?: Tono;
  /** Relleno lleno en vez de fondo suave. Para lo que tiene que saltar (riesgo). */
  solido?: boolean;
}) {
  const t = TONO[tono];
  const estiloSolido = { background: t.fill, borderColor: t.fill, color: tono === 'mako' ? '#17140C' : '#fff' };
  const estiloSuave = { background: t.bg, borderColor: t.border, color: t.ink };
  return (
    <span className="mk-status" style={solido ? estiloSolido : estiloSuave}>
      <span className="mk-dot" style={{ background: solido ? 'currentColor' : t.fill }} aria-hidden />
      {children}
    </span>
  );
}
