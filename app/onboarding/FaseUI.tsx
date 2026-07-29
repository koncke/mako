'use client';

// =============================================================================
// FaseUI — piezas compartidas del diagnóstico de fase (quiz + resultado)
// =============================================================================
// Se usan en DOS lugares: el wizard de alta (OnboardingWizard) y la tab
// "Diagnóstico" del hub (DiagnosticoView). Antes vivían dentro del wizard; se
// extrajeron acá para no duplicar la lógica del resultado (síntomas, acciones,
// estrategia, hito, dimensión débil). La fuente de verdad del contenido es
// lib/fase-diagnostico.ts.

import type { CSSProperties, ReactNode } from 'react';
import { faseDef, dimensionDeFase, repartoTexto, CANALES, type CanalId, type Diagnostico, type Estrategia } from '@/lib/fase-diagnostico';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// El canal de venta adapta la pregunta de volumen (llamadas/carrito/webinar).
export function CanalSelector({ canal, onPick }: { canal: CanalId; onPick: (c: CanalId) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 7, textAlign: 'center' }}>¿Cómo cierras la venta?</div>
      <div style={{ display: 'flex', gap: 7, justifyContent: 'center', flexWrap: 'wrap' }}>
        {CANALES.map((c) => {
          const on = canal === c.id;
          return (
            <button key={c.id} type="button" onClick={() => onPick(c.id)}
              style={{ cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 999,
                border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'var(--surface)', color: on ? '#fff' : 'var(--dim)' }}>
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Las 5 opciones votan a una fase (índice = fase). Single-select, estilo cards.
export function FaseQuiz({ emoji, opciones, value, onPick }: { emoji: string; opciones: string[]; value: number; onPick: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 30, textAlign: 'center', marginBottom: 2 }}>{emoji}</div>
      {opciones.map((o, i) => {
        const on = value === i;
        return (
          <button key={i} type="button" onClick={() => onPick(i)}
            style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, fontSize: 14, padding: '12px 15px', borderRadius: 12, lineHeight: 1.4,
              border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)',
              display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 'none', width: 16, height: 16, borderRadius: '50%', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', boxShadow: on ? 'inset 0 0 0 2.5px var(--surface)' : 'none' }} />
            {o}
          </button>
        );
      })}
    </div>
  );
}

export const SeccionLabel = ({ children }: { children: ReactNode }) => (
  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>{children}</div>
);

// Ícono SVG por fase (1-5), en vez de emoji. Mismo set que /conocimientos.
export function FaseIcono({ id, size = 22 }: { id: number; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 1: return <svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" /></svg>;
    case 2: return <svg {...p}><path d="M4 5h16l-6 7v7l-4-2v-5z" /></svg>;
    case 3: return <svg {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-1.9 1.9M7.5 16.5l-1.9 1.9M18.4 18.4l-1.9-1.9M7.5 7.5L5.6 5.6" /></svg>;
    case 4: return <svg {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>;
    case 5: return <svg {...p}><path d="M3 21h4v-4h4v-4h4v-4h5" /></svg>;
    default: return null;
  }
}

function EstrategiaBarras({ e }: { e: Estrategia }) {
  const filas: Array<[string, number, string]> = [
    ['Tráfico frío', e.prospeccion, 'var(--primary)'],
    ['Retargeting y nutrición', e.nutricion, 'var(--warn)'],
    ['Escala', e.escala, 'var(--good)'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {filas.map(([lbl, val, color]) => (
        <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--dim)', flex: 'none', width: 130 }}>{lbl}</span>
          <span style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${val}%`, background: color, borderRadius: 999 }} />
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: 'var(--ink)', flex: 'none', width: 34, textAlign: 'right' }}>{val}%</span>
        </div>
      ))}
    </div>
  );
}

// El resultado: qué priorizar (el Norte) + síntomas, acciones, estrategia, hito,
// qué no hacer y la dimensión débil.
export function FaseResultado({ diag }: { diag: Diagnostico }) {
  const f = faseDef(diag.fase);
  const dim = dimensionDeFase(f.id);
  return (
    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {diag.mixto && (
        <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: 4 }}>Diagnóstico mixto ({repartoTexto(diag.reparto)})</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>Tus respuestas se reparten entre fases: avanzaste en una dimensión y te quedaste atrás en otra. Trabaja primero el cuello de tu fase más baja antes de saltar adelante.</div>
        </div>
      )}

      {/* El Norte — el foco de todo, destacado con el color de la fase */}
      <div style={{ background: 'var(--primary-bg)', border: `1px solid ${f.color}55`, borderLeft: `4px solid ${f.color}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
          <span style={{ color: f.color, display: 'inline-flex', flex: 'none' }}><FaseIcono id={f.id} size={22} /></span>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: f.color, fontWeight: 700 }}>Tu Norte · enfoca todo en {f.cuelloLabel}</div>
        </div>
        <div style={{ fontSize: 15.5, color: 'var(--ink)', lineHeight: 1.5, fontWeight: 500 }}>{f.objetivo}</div>
      </div>

      {/* Síntomas — los puntos negativos, con ✕ en rojo */}
      <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
        <SeccionLabel><span style={{ color: 'var(--bad)' }}>Síntomas de esta fase</span></SeccionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {f.sintomas.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--bad)', flex: 'none', marginTop: 1, fontWeight: 800, fontSize: 12 }}>✕</span>
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Acciones clave — cada una con su título */}
      <div>
        <SeccionLabel>Acciones clave</SeccionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {f.acciones.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: a.critica ? 'var(--good-bg)' : 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px' }}>
              <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: a.critica ? 'var(--good)' : 'var(--faint)', flex: 'none', marginTop: 3, letterSpacing: '.04em' }}>{a.critica ? 'CLAVE' : `0${i + 1}`}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 3 }}>{a.titulo}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{a.texto}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estrategia de pauta */}
      <div>
        <SeccionLabel>Estrategia de pauta</SeccionLabel>
        <EstrategiaBarras e={f.estrategia} />
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, marginTop: 9 }}>{f.estrategia.nota}</div>
      </div>

      {/* Hito para avanzar */}
      <div style={{ background: 'var(--primary-bg)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 5 }}>Hito para pasar a la siguiente fase</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{f.hito}</div>
      </div>

      {/* No hacer */}
      <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 12px', fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>
        <b style={{ color: 'var(--bad)' }}>No hagas ahora:</b> {f.noHacer}
      </div>

      {/* Dimensión débil */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px' }}>
        <SeccionLabel>Tu dimensión débil</SeccionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
          <span style={{ fontSize: 18, flex: 'none' }}>{dim.emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{dim.nombre}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{dim.descripcion}</div>
      </div>
    </div>
  );
}
