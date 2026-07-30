'use client';

// =============================================================================
// FaseUI — piezas compartidas del diagnóstico de fase (quiz + resultado)
// =============================================================================
// Se usan en DOS lugares: el wizard de alta (OnboardingWizard) y la tab
// "Diagnóstico" del hub (DiagnosticoView). Antes vivían dentro del wizard; se
// extrajeron acá para no duplicar la lógica del resultado (síntomas, acciones,
// estrategia, hito, dimensión débil). La fuente de verdad del contenido es
// lib/fase-diagnostico.ts.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { faseDef, repartoTexto, CANALES, type CanalId, type Diagnostico, type Estrategia } from '@/lib/fase-diagnostico';

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

// Ícono SVG por fase (1-5): una metáfora clara de cada etapa —
// 1 Validación (brote) · 2 Conversión (embudo) · 3 Automatización (moneda) ·
// 4 Equipo (cohete) · 5 Escala (corona).
export function FaseIcono({ id, size = 22 }: { id: number; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 1: return <svg {...p}><path d="M12 21v-7.5" /><path d="M12 13.5c-.2-3 1.9-5.3 5.2-5.3.2 3.1-1.9 5.3-5.2 5.3z" /><path d="M12 15.5c.2-2.6-1.7-4.6-4.5-4.6-.2 2.7 1.7 4.7 4.5 4.6z" /></svg>;
    case 2: return <svg {...p}><path d="M4 5h16l-6 7v6l-4-2v-4z" /></svg>;
    case 3: return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.2v9.6" /><path d="M14.4 9.3c-.5-.8-1.4-1.3-2.4-1.3-1.4 0-2.5.8-2.5 2 0 2.7 5 1.4 5 4.1 0 1.2-1.1 2-2.5 2-1 0-1.9-.5-2.5-1.3" /></svg>;
    case 4: return <svg {...p}><path d="M12 3c2.6 1.9 3.9 4.6 3.9 8 0 1.9-.5 3.3-1.3 4.5H9.4C8.6 14.3 8.1 12.9 8.1 11c0-3.4 1.3-6.1 3.9-8z" /><circle cx="12" cy="9.2" r="1.5" /><path d="M9.4 15.5l-1.9 2 2.2-.5M14.6 15.5l1.9 2-2.2-.5M12 15.5V21" /></svg>;
    case 5: return <svg {...p}><path d="M5 18.5h14" /><path d="M4.8 8.4l3.7 2.9L12 5.8l3.5 5.5 3.7-2.9L17.6 18.5H6.4z" /></svg>;
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

// Chip de una fase (ícono + "Fase N · Nombre"), para el hito gráfico.
function FaseChip({ id, nombre, color, atenuado }: { id: number; nombre: string; color: string; atenuado?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: atenuado ? 0.85 : 1, minWidth: 0 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: 12, border: `1.5px solid ${color}`, background: atenuado ? 'var(--surface)' : `${color}18`, color }}>
        <FaseIcono id={id} size={26} />
      </span>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.06em', color: 'var(--faint)' }}>FASE {id}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.15 }}>{nombre}</div>
    </div>
  );
}

// El resultado: la fase diagnosticada + Norte, síntomas, funnel sugerido, checklist
// de qué hacer / qué no, estrategia de pauta y el hito gráfico con sus criterios.
export function FaseResultado({ diag }: { diag: Diagnostico }) {
  const f = faseDef(diag.fase);
  // La fase siguiente (para el hito gráfico). index = id (porque index = id-1).
  const sig = f.id < 5 ? faseDef(f.id) : null;
  const compColor = f.funnelSugerido.complejidad === 'Simple' ? 'var(--good)' : f.funnelSugerido.complejidad === 'Media' ? 'var(--warn)' : 'var(--bad)';
  // Checklist tachable: la PRIMERA tarea arranca hecha; el usuario tacha el resto.
  const [hechas, setHechas] = useState<Set<number>>(() => new Set([0]));
  const toggle = (i: number) => setHechas((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Fase diagnosticada: ícono + nombre + subtítulo, CENTRADO bajo "Tu diagnóstico" */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, textAlign: 'center' }}>
        <span style={{ color: f.color, flex: 'none', width: 50, height: 50, borderRadius: 14, border: `1.5px solid ${f.color}`, background: `${f.color}18`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaseIcono id={f.id} size={29} /></span>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', color: 'var(--faint)' }}>FASE {f.id}</div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }}>{f.nombre}</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{f.subtitulo}</div>
        </div>
      </div>

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

      {/* Funnel sugerido — gráfico: los pasos conectados con flechas */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
        <SeccionLabel>Funnel sugerido</SeccionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>{f.funnelSugerido.nombre}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: compColor, background: 'var(--surface-2)', border: `1px solid ${compColor}`, borderRadius: 999, padding: '2px 9px' }}>{f.funnelSugerido.complejidad}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          {f.funnelSugerido.pasos.map((paso, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke={f.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M1 6h12M9 2l4 4-4 4" /></svg>}
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', background: `${f.color}14`, border: `1px solid ${f.color}55`, borderRadius: 9, padding: '6px 11px', whiteSpace: 'nowrap' }}>{paso}</span>
            </div>
          ))}
        </div>
        {f.funnelSugerido.retarget && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 11, fontSize: 11.5, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', borderRadius: 999, padding: '4px 11px' }}>
            <span style={{ color: f.color, fontWeight: 700, fontSize: 13 }}>↺</span> + Retargeting: reimpactas al que no compró
          </div>
        )}
      </div>

      {/* ✓ Qué hacer ahora — checklist tachable: clic para marcar una tarea hecha */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
        <SeccionLabel><span style={{ color: 'var(--good)' }}>✓ Qué hacer ahora</span></SeccionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {f.acciones.map((a, i) => {
            const done = hechas.has(i);
            return (
              <button key={i} type="button" onClick={() => toggle(i)}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: SANS, display: 'flex', gap: 11, alignItems: 'flex-start', background: done ? 'var(--surface-2)' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px' }}>
                <span aria-hidden style={{ flex: 'none', width: 19, height: 19, borderRadius: 6, border: `1.5px solid ${done ? 'var(--good)' : 'var(--border-strong)'}`, background: done ? 'var(--good)' : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, marginTop: 1 }}>{done ? '✓' : ''}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: done ? 'var(--faint)' : 'var(--ink)', lineHeight: 1.3, textDecoration: done ? 'line-through' : 'none' }}>{a.titulo}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45, marginTop: 2, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.65 : 1 }}>{a.texto}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ✕ No hagas ahora — el don't, justo debajo del checklist, en bullets */}
      <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '13px 15px' }}>
        <SeccionLabel><span style={{ color: 'var(--bad)' }}>✕ No hagas ahora</span></SeccionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {f.noHacer.map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span aria-hidden style={{ color: 'var(--bad)', flex: 'none', marginTop: 1, fontWeight: 800, fontSize: 12 }}>✕</span>
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Estrategia de pauta — primero el mix en %, debajo cuánto y cómo repartirlo */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
        <SeccionLabel>Estrategia de pauta</SeccionLabel>
        <EstrategiaBarras e={f.estrategia} />
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, marginTop: 11 }}>{f.estrategia.nota}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--good)', flex: 'none', marginTop: 2, width: 62 }}>Cuánto</span>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{f.estrategia.inversion}</span>
          </div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--primary)', flex: 'none', marginTop: 2, width: 62 }}>Repartir</span>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{f.estrategia.comoRepartir}</span>
          </div>
        </div>
      </div>

      {/* Hito para avanzar — gráfico (fase → fase) + resumen corto + criterios sí/no */}
      <div style={{ background: 'var(--primary-bg)', border: `1px solid ${f.color}44`, borderRadius: 14, padding: '15px 16px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 12, textAlign: 'center' }}>Hito para pasar a la siguiente fase</div>
        {sig ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12 }}>
            <FaseChip id={f.id} nombre={f.nombre} color={f.color} atenuado />
            <svg width="30" height="16" viewBox="0 0 30 16" fill="none" stroke={f.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M2 8h24M20 3l6 5-6 5" /></svg>
            <FaseChip id={sig.id} nombre={sig.nombre} color={sig.color} />
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><FaseChip id={f.id} nombre={f.nombre} color={f.color} /></div>
        )}
        {/* Resumen corto y directo */}
        <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, textAlign: 'center', fontWeight: 500 }}>{f.hito}</div>
        {/* Criterios sí/no que el usuario se responde */}
        <div style={{ marginTop: 13, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 13px' }}>
          <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 9 }}>{sig ? <>Si respondes <b style={{ color: 'var(--ink)' }}>SÍ</b> a todo, ya estás listo para la <b style={{ color: 'var(--ink)' }}>Fase {sig.id}</b>:</> : <>Ya estás en la fase más alta. Sostén esto:</>}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {f.hitoCriterios.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span aria-hidden style={{ flex: 'none', width: 17, height: 17, borderRadius: '50%', border: `1.5px solid ${f.color}`, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
        {sig && (
          <div style={{ marginTop: 11, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--surface)', border: `1px solid ${sig.color}55`, borderRadius: 999, padding: '5px 12px' }}>
              <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>Meta Fase {sig.id}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{sig.rango}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
