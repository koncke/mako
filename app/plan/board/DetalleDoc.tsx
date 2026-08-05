'use client';

// =============================================================================
// DetalleDoc — el contexto de una tarea, largo pero plegado
// =============================================================================
// Desde que la extracción de reuniones escribe el detalle como corresponde (la cita
// textual, quién lo dijo, el minuto, los números, qué se descartó), el texto pasó de
// 140 caracteres a 800-1500. Volcado entero en una fila, una lista de 30 tareas se
// vuelve ilegible.
//
// La regla del dueño es minimalista: se ve el ARRANQUE y se despliega si interesa.
// Y con formato — negrita y bullets — porque el detalle ahora tiene estructura
// (**Qué pidió** · **Por qué** · **Detalles concretos** · **Listo cuando**).
//
// Mismo gesto que el resto de la app: el chevron ▾ y el borde de SeccionCard.
// =============================================================================

import { useState } from 'react';
import { Markdown } from '../../_components/Markdown';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Cuántos caracteres se ven sin desplegar. Debajo de esto no se pliega nada. */
const TOPE = 260;

export function DetalleDoc({ texto, size = 12.5, color = 'var(--dim)' }: {
  texto: string;
  size?: number;
  color?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const t = (texto ?? '').trim();
  if (!t) return null;

  // Corto: se muestra entero, sin ningún control. Un "ver más" para tres líneas es ruido.
  if (t.length <= TOPE) {
    return <div style={{ fontSize: size, color, marginTop: 3, lineHeight: 1.5, fontFamily: SANS }}><Markdown text={t} compacto /></div>;
  }

  // El arranque, cortado en el último espacio para no partir una palabra. Se le saca el
  // markdown al preview: en una línea, los ** se leen como basura.
  const plano = t.replace(/\*\*/g, '').replace(/^[-*•]\s+/gm, '· ').replace(/\s+/g, ' ');
  const corte = plano.slice(0, TOPE);
  const preview = `${corte.slice(0, corte.lastIndexOf(' ') > 120 ? corte.lastIndexOf(' ') : TOPE)}…`;

  return (
    <div style={{ marginTop: 3, fontFamily: SANS }}>
      {abierto ? (
        <div style={{ fontSize: size, color, lineHeight: 1.55, borderLeft: '2px solid var(--border)', paddingLeft: 11 }}>
          <Markdown text={t} compacto />
        </div>
      ) : (
        <div style={{ fontSize: size, color, lineHeight: 1.5 }}>{preview}</div>
      )}
      <button type="button" onClick={(e) => { e.stopPropagation(); setAbierto((v) => !v); }}
        style={{ marginTop: 4, padding: 0, border: 'none', background: 'transparent', color: 'var(--faint)', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer', lineHeight: 1.6 }}>
        {abierto ? '▴ menos' : `▾ ver el contexto completo (${Math.round(t.length / 100) / 10}k)`}
      </button>
    </div>
  );
}
