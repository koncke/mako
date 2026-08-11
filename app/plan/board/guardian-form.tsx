'use client';

// Piezas compartidas de los formularios del Perro Guardián: la pantalla de
// intro y la pregunta multiple-choice (opciones + "otra…" custom). Se usan
// dentro de WizardShell (1 pregunta por pantalla).

import { type CSSProperties } from 'react';
import { GuardianIcon } from './GuardianIcon';
import { type Pregunta, type TipoPregunta, SIN_FECHA } from '@/lib/preguntas-contrato';

const SANS = "'Geist', sans-serif";

// Ícono del score 1-100 (medidor / gauge) — reemplaza al emoji ⚡ (feedback #5:
// "no poner un emoji, mejor un ícono sofisticado"). Toma el color del contexto.
export function ScoreIcon({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="M4 19a8 8 0 1 1 16 0" />
      <path d="M12 19l4.2-6.2" />
    </svg>
  );
}

// Pantalla de presentación del guardián (primer paso de todo debate/creación).
export function IntroBody({ que, mi = 'priorizar lo que de verdad mueve la aguja y protegerte de la parálisis por análisis' }: { que: string; mi?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <GuardianIcon size={68} />
      <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: 0, maxWidth: 420 }}>
        Mi trabajo es <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{mi}</strong>.
      </p>
      <div style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', maxWidth: 440 }}>
        Veo que estás intentando <strong style={{ fontWeight: 600 }}>{que}</strong>. Te hago un par de preguntas para hacerlo bien.
      </div>
    </div>
  );
}

// Pregunta con opciones (elegís 1 con un clic) + caja para una respuesta propia.
export function ChoiceBody({ opciones, value, onChange, customPlaceholder = 'Otra… (escribí tu respuesta)' }: { opciones: string[]; value: string; onChange: (v: string) => void; customPlaceholder?: string }) {
  const esCustom = value.trim() !== '' && !opciones.includes(value);
  return (
    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {opciones.map((o) => {
        const on = value === o;
        return (
          <button key={o} type="button" onClick={() => onChange(on ? '' : o)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', flex: 'none', boxShadow: on ? 'inset 0 0 0 2.5px var(--surface)' : 'none' }} />
            {o}
          </button>
        );
      })}
      <input value={esCustom ? value : ''} onChange={(e) => onChange(e.target.value)} placeholder={customPlaceholder}
        style={{ ...inputStyle, borderColor: esCustom ? 'var(--primary)' : 'var(--border-strong)', marginTop: 2 }} />
    </div>
  );
}

export const inputStyle: CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14.5, outline: 'none', fontFamily: SANS };
export const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.55, textAlign: 'left' };

// =============================================================================
// PreguntaCampo — EL campo de una pregunta del Perro, para todas las pantallas
// =============================================================================
// Había DOS renderizadores del mismo contrato (el wizard de /plan/revisar y el
// modal de reuniones del board) y dibujaban cosas distintas para el mismo tipo:
// una `escala` eran cinco botones cuadrados en uno y cinco radios apilados —
// idénticos a un multiple choice, pero con las etiquetas "1".."5"— en el otro.
// Encima el segundo declaraba el tipo como `string`, así que el compilador no
// podía avisar cuando divergían. Es el antipatrón "una cosa, un lugar" del
// AGENTS.md, y el precio se pagó en la pantalla.
//
// El valor SIEMPRE viaja como string (es lo que después se le manda al Perro):
//   opcion/comparacion → la opción elegida     · escala → "1".."5"
//   multi              → unidas con SEPARADOR  · fecha  → "YYYY-MM-DD" o el atajo
//   texto              → lo que escribió

/** Cómo se unen las respuestas de un `multi`. Una sola definición: el modal del
 *  board y el wizard usaban la misma cadena por casualidad, no por contrato. */
export const SEPARADOR_MULTI = ' · ';


export function PreguntaCampo({ q, value, onChange, autoFocus }: {
  q: { pregunta: string; tipo?: TipoPregunta | string; opciones?: string[] } | Pregunta;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const tipo = (q.tipo ?? 'opcion') as TipoPregunta;
  const opciones = q.opciones ?? [];

  const fila = (on: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
    padding: '12px 15px', borderRadius: 12, cursor: 'pointer', fontFamily: SANS, fontSize: 14.5,
    border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`,
    background: on ? 'var(--primary-bg)' : 'var(--surface-2)',
    color: on ? 'var(--primary)' : 'var(--ink)', fontWeight: on ? 700 : 500,
    transition: 'border-color .12s, background .12s',
  });
  const marca = (on: boolean, redondo: boolean): CSSProperties => ({
    width: 18, height: 18, flex: 'none', borderRadius: redondo ? '50%' : 5,
    border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`,
    background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  // ESCALA: 1 a 5 y nada más. El saneo garantiza que el enunciado explique los
  // extremos (si no los explicaba, ya no llega acá como escala).
  if (tipo === 'escala') {
    return (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === String(n);
          // Volver a tocar el mismo número lo DESELECCIONA: en el wizard no había
          // forma de deshacer un toque por error, y como saltear no cuenta lo
          // mismo que contestar, quedabas obligado a mandarle un número al Perro.
          return (
            <button key={n} type="button" onClick={() => onChange(on ? '' : String(n))}
              style={{ width: 48, height: 48, borderRadius: 12, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'var(--surface)', color: on ? '#fff' : 'var(--ink)', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{n}</button>
          );
        })}
      </div>
    );
  }

  // FECHA: un calendario de verdad. Es el campo que faltaba y por el que las
  // preguntas de deadline terminaban dibujadas como una escala del 1 al 5.
  if (tipo === 'fecha') {
    const esAtajo = !!value && opciones.includes(value);
    const sinFecha = value === SIN_FECHA;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <input type="date" value={iso} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus}
          style={{ ...inputStyle, borderColor: iso ? 'var(--primary)' : 'var(--border-strong)', background: 'var(--surface-2)', colorScheme: 'light dark' }} />
        {[...opciones, SIN_FECHA].map((o) => {
          const on = (esAtajo && value === o) || (o === SIN_FECHA && sinFecha);
          return (
            <button key={o} type="button" onClick={() => onChange(on ? '' : o)} style={fila(on)}>
              <span style={marca(on, true)}>{on ? '✓' : ''}</span>{o}
            </button>
          );
        })}
      </div>
    );
  }

  if (tipo === 'multi') {
    const sel = value ? value.split(SEPARADOR_MULTI).filter(Boolean) : [];
    const toggle = (o: string) => onChange((sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]).join(SEPARADOR_MULTI));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {opciones.map((o) => (
          <button key={o} type="button" onClick={() => toggle(o)} style={fila(sel.includes(o))}>
            <span style={marca(sel.includes(o), false)}>{sel.includes(o) ? '✓' : ''}</span>{o}
          </button>
        ))}
      </div>
    );
  }

  if (tipo === 'texto') {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} rows={3} placeholder="Escribí tu respuesta…" style={{ ...textareaStyle, minHeight: 78, background: 'var(--surface-2)', fontSize: 15 }} />;
  }

  // COMPARACIÓN: los dos ítems enfrentados, uno al lado del otro. Es una SEÑAL
  // para el Perro, no una orden (él compara y decide con su propio criterio).
  if (tipo === 'comparacion') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(2, opciones.length)}, 1fr)`, gap: 10, alignItems: 'stretch' }}>
        {opciones.map((o) => (
          <button key={o} type="button" onClick={() => onChange(value === o ? '' : o)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 76, padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, background: value === o ? 'var(--primary-bg)' : 'var(--surface-2)', border: `1.5px solid ${value === o ? 'var(--primary)' : 'var(--border)'}`, color: value === o ? 'var(--primary)' : 'var(--ink)', lineHeight: 1.35 }}>{o}</button>
        ))}
      </div>
    );
  }

  // OPCIÓN (default): los botones + la caja para una respuesta propia. El «otra…»
  // existe en TODOS los lugares donde hay opciones, no solo en uno de los dos.
  return <ChoiceBody opciones={opciones} value={value} onChange={onChange} />;
}
