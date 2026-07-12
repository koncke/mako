'use client';

// Piezas compartidas de los formularios del Perro Guardián: la pantalla de
// intro y la pregunta multiple-choice (opciones + "otra…" custom). Se usan
// dentro de WizardShell (1 pregunta por pantalla).

import { type CSSProperties } from 'react';
import { GuardianIcon } from './GuardianIcon';

const SANS = "'Geist', sans-serif";

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
