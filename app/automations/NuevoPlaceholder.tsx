'use client';

// =============================================================================
// NuevoPlaceholder — «＋ Nuevo CRON» con la animación de «＋ Nueva automatización»
// =============================================================================
// Pedido de Martín (10/10/2026, CRON 1): «SI paso el cursor por la tarjeta donde dice "Nuevo Cron"
// debería tener la misma animación que ya tenemos en "Nueva automatización" en la sidebar». Es la MISMA
// receta que `.chb-nueva` de la lista (app/automations/SimuladorWhatsApp.tsx, `CSS_LISTA`): el borde
// punteado se vuelve primario y el ＋ gira 90°. Quieto con `prefers-reduced-motion`.
//
// ⚠️ EL HOVER VA EN LA CLASE Y NO EN EL `style`: un estilo en línea le gana a cualquier `:hover`
// (AGENTS.md, los 129 botones del CRM). Por eso el color, el borde y el fondo NO van en línea.
// Sin backticks acá adentro: `CSS_NUEVO` es un template literal.

import type { CSSProperties } from 'react';

export const CSS_NUEVO = `
.mk-nuevo{background:transparent;color:var(--dim);border:1.5px dashed var(--border-strong);transition:border-color .16s ease,color .16s ease,background .16s ease}
.mk-nuevo:hover:not(:disabled),.mk-nuevo:focus-visible{color:var(--primary);border-color:var(--primary);background:var(--primary-bg);outline:none}
.mk-nuevo__mas{display:inline-flex;align-items:center;justify-content:center;transition:transform .24s cubic-bezier(.34,1.36,.64,1)}
.mk-nuevo:hover:not(:disabled) .mk-nuevo__mas,.mk-nuevo:focus-visible .mk-nuevo__mas{transform:rotate(90deg) scale(1.08)}
.mk-nuevo:active:not(:disabled) .mk-nuevo__mas{transform:rotate(90deg) scale(.92)}
@media (prefers-reduced-motion: reduce){.mk-nuevo__mas{transition:none}}
`;

export function NuevoPlaceholder({ texto, onClick, style, chico, ...resto }: {
  texto: string;
  onClick: () => void;
  /** Lo que acomoda el botón (alto, flex). No el color, el borde ni el fondo: son de la clase. */
  style?: Omit<CSSProperties, 'color' | 'border' | 'borderColor' | 'background'>;
  /** La versión de la tarjeta del lienzo: letra y ＋ más chicos. */
  chico?: boolean;
  'data-nuevo-disparador'?: boolean;
  'data-no-pan'?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="mk-nuevo" {...resto}
      style={{
        width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        borderRadius: chico ? 8 : 12, cursor: 'pointer', fontFamily: "'Geist', sans-serif",
        fontSize: chico ? 12.5 : 14.5, fontWeight: 600, ...style,
      }}>
      <style>{CSS_NUEVO}</style>
      <span aria-hidden className="mk-nuevo__mas" style={{ fontSize: chico ? 14 : 18, lineHeight: 1 }}>＋</span>
      {texto}
    </button>
  );
}
