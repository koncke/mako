'use client';

// =============================================================================
// Storyboard — la secuencia del día, frame por frame, en vertical
// =============================================================================
// Lo comparten el ensayo del onboarding y la vista principal: es LA forma de
// leer una PiezaStory. Cada frame: número, formato del frame, el texto que se
// dice o se escribe, la indicación de producción y —cuando aplica— la marca
// honesta de que lo interactivo (encuesta/pregunta/slider) se agrega A MANO en
// la app de Instagram: la API de Meta no publica stickers (LIMITES_STORY).

import type { CSSProperties } from 'react';
import type { PiezaStory } from '@/lib/ig-writer';

const MONO = "'Geist Mono', monospace";

const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' };
const pill: CSSProperties = { fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--dim)', whiteSpace: 'nowrap' };

export function Storyboard({ pieza }: { pieza: PiezaStory }) {
  const n = pieza.frames.length;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
      {/* La idea única del día — la regla dura del método: una idea por día. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200, flex: 1 }}>
          <div style={eyebrow}>La idea del día</div>
          <div style={{ fontSize: 17, fontWeight: 650, letterSpacing: '-0.015em', marginTop: 6, lineHeight: 1.35 }}>{pieza.idea}</div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{n} {n === 1 ? 'frame' : 'frames'}</span>
      </div>

      {/* Los frames, en el orden en que se suben (el bloque se sube junto). */}
      <div style={{ marginTop: 16 }}>
        {pieza.frames.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: 'var(--faint)', paddingTop: 3, minWidth: 22 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={pill}>{f.tipo}</span>
                {f.interactivoManual && (
                  <span style={{ ...pill, background: 'var(--warn-bg)', color: 'var(--warn)' }}>interactivo · a mano</span>
                )}
              </div>
              {f.texto && (
                <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink)', marginTop: 7, whiteSpace: 'pre-wrap' }}>{f.texto}</div>
              )}
              {f.indicacion && (
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)', marginTop: 5 }}>
                  <span style={{ fontWeight: 600 }}>Producción:</span> {f.indicacion}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* El cierre del día: CTA y palabra clave, si el objetivo los trajo. */}
      {(pieza.cta || pieza.palabraClave) && (
        <div style={{ marginTop: 4, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={eyebrow}>Cierre del día</div>
          {pieza.cta && <div style={{ fontSize: 14, lineHeight: 1.55, marginTop: 6 }}>{pieza.cta}</div>}
          {pieza.palabraClave && (
            <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 6 }}>
              Palabra clave: <span style={{ fontFamily: MONO, fontWeight: 700, color: 'var(--ink)' }}>{pieza.palabraClave}</span>
              {' '}— quien responda la story con esa palabra llega al inbox de la tab Instagram, donde MaKo deja el borrador de respuesta.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
