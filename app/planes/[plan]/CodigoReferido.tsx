'use client';

// =============================================================================
// El código de referido en el carrito (25/10/2026)
// =============================================================================
// Martín (25/10): «es importante que en la compra, en el carrito, esté la opción de poner código de referido». Como el «Add
// promo code» de los checkouts (Stripe Checkout, Shopify): un renglón chico «¿Te recomendó alguien? Pon su código» que abre
// el campo; si la persona llegó con el link de un partner (`?ref=`), el campo ya viene abierto y lleno.
//
// Lo que se manda (`codigoParaMandar`): sólo lo que la persona ESCRIBIÓ. Si dejó el código que trajo el link, no se manda
// nada, así decide la cookie del primer link (lib/compra-plan-reglas.ts, `codigoDeLaCompra`). El servidor rechaza un código
// que no es de ningún partner (`TEXTO_CODIGO_NO_EXISTE`) y la pantalla lo muestra debajo del campo.
// =============================================================================

import { useState } from 'react';

/** Lo que se manda como `codigo`: lo escrito, si cambió lo que trajo el link. Vacío o igual al del link = nada. */
export const codigoParaMandar = (escrito: string, delLink: string | null): string | undefined => {
  const v = escrito.trim().toLowerCase();
  return v && v !== (delLink ?? '') ? v : undefined;
};

export function CodigoReferido({ valor, onCambio, delLink, error }: {
  valor: string;
  onCambio: (v: string) => void;
  /** El código que trajo el link del partner (`?ref=`): el campo arranca abierto y con él. */
  delLink: string | null;
  /** El servidor dijo que ese código no existe. */
  error: string | null;
}) {
  const [abierto, setAbierto] = useState(!!delLink);
  if (!abierto) {
    return (
      <button type="button" className="planes-codigo-abrir" onClick={() => setAbierto(true)}>
        ¿Te recomendó alguien? Pon su código
      </button>
    );
  }
  return (
    <div className="planes-codigo">
      <label htmlFor="cp-codigo">Código de referido <span className="planes-opcional">(opcional)</span></label>
      <input id="cp-codigo" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={32} placeholder="Ej.: estudio-sur"
        value={valor} onChange={(e) => onCambio(e.target.value)} aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'cp-codigo-error' : undefined} />
      {error && <p className="planes-error planes-codigo-error" id="cp-codigo-error" role="status" aria-live="polite">{error}</p>}
    </div>
  );
}
