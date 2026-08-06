'use client';

// =============================================================================
// CanalToggle — la cápsula que prende o apaga un canal en una fila
// =============================================================================
// El pedido original era "el logo del canal, en gris cuando está desactivado".
// La cápsula lleva el logo Y la palabra, por dos razones concretas:
//
//   · Un ícono suelto no se lee como algo clickeable. Con ~17 filas, la primera
//     pregunta del usuario sería si eso es un botón o una etiqueta.
//   · Si el único indicador de "apagado" es que el color se va al gris, quien no
//     distingue bien los colores no puede leer el estado (WCAG 1.4.1). Acá el
//     estado se nota además por el relleno y por el borde.
//
// Encendido = el color propio del canal (verde WhatsApp, azul email, dorado MaKo);
// apagado = gris sobre el fondo hundido. La palabra no cambia, así que la fila se
// lee igual de rápido en los dos estados.
//
// Estados: encendido · apagado · "no aplica" (este canal no existe para esta fila,
// p. ej. un reporte no tiene sonido) · "no disponible" (el canal existe pero está
// sin conectar). Los últimos dos NO son un interruptor apagado y no se dibujan
// como tal: un canal sin conectar apagado se lee como "yo lo apagué" y manda al
// usuario a buscar el problema en el lugar equivocado.

import type { CSSProperties } from 'react';
import { Icon } from './icons';

const SANS = "'Geist', sans-serif";

export type EstadoCanal = 'on' | 'off' | 'na' | 'sin-conectar';

/** Los colores de cada canal cuando está encendido. */
const COLOR: Record<string, { fg: string; bg: string; borde: string }> = {
  whatsapp: { fg: 'var(--wa)', bg: 'var(--wa-bubble)', borde: 'var(--wa)' },
  email: { fg: 'var(--primary)', bg: 'var(--primary-bg)', borde: 'var(--primary)' },
  bell: { fg: 'var(--accent)', bg: 'rgba(200,135,12,.12)', borde: 'var(--accent)' },
  sonido: { fg: 'var(--accent)', bg: 'rgba(200,135,12,.12)', borde: 'var(--accent)' },
};
const NEUTRO = { fg: 'var(--dim)', bg: 'var(--surface)', borde: 'var(--border-strong)' };

export function CanalToggle({ icono, label, estado, onChange, fila, motivoNoDisponible }: {
  /** nombre del ícono en icons.tsx */
  icono: string;
  label: string;
  estado: EstadoCanal;
  onChange?: (on: boolean) => void;
  /** de qué fila es, para que el lector de pantalla lea algo completo. */
  fila: string;
  /** por qué el canal no puede entregar (solo con estado 'sin-conectar'). */
  motivoNoDisponible?: string;
}) {
  const on = estado === 'on';
  const inerte = estado === 'na' || estado === 'sin-conectar';
  const c = on ? (COLOR[icono] ?? COLOR.bell) : NEUTRO;

  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    // 34px de alto: por debajo de eso el blanco de click queda chico para el pulgar.
    minHeight: 34, padding: '6px 11px 6px 9px', borderRadius: 999,
    fontFamily: SANS, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
    transition: 'background .13s, border-color .13s, color .13s',
  };

  if (estado === 'na') {
    // Ni botón ni interruptor: no hay nada que decidir acá.
    return (
      <span aria-hidden style={{ ...base, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--faint)', fontWeight: 500 }}>
        <Icon name={icono} size={15} />
        <span style={{ textDecoration: 'line-through', textDecorationThickness: 1 }}>{label}</span>
      </span>
    );
  }

  if (estado === 'sin-conectar') {
    return (
      <span
        title={motivoNoDisponible ?? `${label} todavía no está conectado`}
        style={{ ...base, border: '1px solid var(--warn)', background: 'var(--warn-bg)', color: 'var(--warn)', cursor: 'help' }}
      >
        <Icon name={icono} size={15} />
        {label}
        <span aria-hidden style={{ fontSize: 13, lineHeight: 1, marginLeft: 1 }}>!</span>
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          {`${label} para ${fila}: ${motivoNoDisponible ?? 'sin conectar'}`}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label} para ${fila}`}
      title={`${label}: ${on ? 'activado' : 'desactivado'}`}
      onClick={() => onChange?.(!on)}
      style={{
        ...base,
        cursor: 'pointer',
        border: `1px solid ${c.borde}`,
        background: c.bg,
        color: c.fg,
        // Sin esto, encendido y apagado se distinguen SOLO por el color.
        opacity: on ? 1 : 0.75,
      }}
    >
      <Icon name={icono} size={15} />
      {label}
    </button>
  );
}
