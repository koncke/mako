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

function EstrategiaBarras({ e }: { e: Estrategia }) {
  const filas: Array<[string, number, string]> = [
    ['Prospección', e.prospeccion, 'var(--primary)'],
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

      {/* El Norte */}
      <div>
        <SeccionLabel>Tu Norte: enfoca todo en {f.cuelloLabel}</SeccionLabel>
        <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55 }}>{f.objetivo}</div>
      </div>

      {/* Síntomas */}
      <div>
        <SeccionLabel>Síntomas de esta fase</SeccionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {f.sintomas.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--faint)', flex: 'none', marginTop: 1 }}>·</span>
              <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Acciones clave */}
      <div>
        <SeccionLabel>Acciones clave</SeccionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {f.acciones.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: a.critica ? 'var(--good-bg)' : 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 12px' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: a.critica ? 'var(--good)' : 'var(--faint)', flex: 'none', marginTop: 2 }}>{a.critica ? 'CLAVE' : `${i + 1}`}</span>
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{a.texto}</span>
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
