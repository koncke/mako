'use client';

// =============================================================================
// ChipArchivo — un archivo que viajó con un mensaje, adentro de su burbuja
// =============================================================================
// Antes de salir, un archivo se ve en la vista previa de la casa (app/whatsapp/_shared/
// VistaAdjuntos.tsx); cuando ya salió, es éste, adentro de la burbuja del mensaje (ChatOffer).
//
// ⚠️ SIN EL ✓ DE «LEÍDO» (11/10/2026). Existía porque elegir un archivo lo leía en el acto y el ✓
// avisaba que ya estaba; ahora se lee al ENVIAR y un turno no sale si una lectura falla, así que todo
// archivo de un mensaje enviado está leído: el ✓ no distinguía nada. Un archivo enviado es una
// tarjeta, como en WhatsApp. Queda el AVISO (se leyó, pero MaKo avisa algo: «solo leí las primeras 20
// páginas») y, por si vuelven, el giro de «leyendo» y el error. El aviso y el error se ESCRIBEN en el
// chip y no sólo en el title: en el celular no hay hover, y un aviso que no se ve no avisa.

import { Spinner } from '@/app/_ui';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { iconoDeAdjunto } from './ayudas';

export type EstadoChip = 'leyendo' | 'listo' | 'aviso' | 'error';

export function ChipArchivo({ nombre, estado, nota, onQuitar, via }: {
  nombre: string;
  /** Cómo se leyó (AdjuntoVista.via). 'audio' = la transcripción de una nota de voz: lleva el ícono del audio. */
  via?: string;
  estado: EstadoChip;
  /** El aviso o el error, en una frase. */
  nota?: string;
  /** Si se puede sacar del próximo mensaje. Sin esto no se dibuja la ✕. */
  onQuitar?: () => void;
}) {
  const color = estado === 'error' ? 'var(--bad)' : estado === 'aviso' ? 'var(--warn)' : 'var(--dim)';
  const borde = estado === 'error' ? 'var(--bad)' : estado === 'aviso' ? 'var(--warn-fill)' : 'var(--border)';
  return (
    <span
      title={nota ? `${nombre} · ${nota}` : nombre}
      style={{
        display: 'inline-flex', flexDirection: 'column', gap: 3, maxWidth: '100%', minWidth: 0,
        padding: '6px 8px 6px 10px', borderRadius: 12, border: `1px solid ${borde}`,
        background: 'var(--surface-2)', fontSize: 'var(--fs-sm)', color: 'var(--ink)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span aria-hidden style={{ display: 'inline-flex', color: 'var(--dim)' }}><IconoMenu nombre={iconoDeAdjunto(nombre, '', via)} size={15} /></span>
        <span style={{ minWidth: 0, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{nombre}</span>
        {estado === 'leyendo' && <span style={{ display: 'inline-flex', color: 'var(--mako-ink)' }}><Spinner size={13} /></span>}
        {estado === 'aviso' && <span aria-label="Leído con aviso" style={{ display: 'inline-flex', color: 'var(--warn)' }}><IconoMenu nombre="avisar" size={15} /></span>}
        {onQuitar && (
          <button type="button" className="of-quitar" onClick={onQuitar} aria-label={`Quitar ${nombre}`} title="Quitar">
            <IconoMenu nombre="cerrar" size={13} />
          </button>
        )}
      </span>
      {nota && (estado === 'aviso' || estado === 'error') && (
        <span style={{ fontSize: 'var(--fs-meta)', color, lineHeight: 1.4, maxWidth: 360, overflowWrap: 'anywhere' }}>{nota}</span>
      )}
    </span>
  );
}
