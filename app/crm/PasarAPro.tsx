'use client';

// =============================================================================
// «Pasar a Pro» y el cartel del tope del plan en el CRM (23/10/2026)
// =============================================================================
// El tope lo decide lib/topes-crm.ts (sólo a los negocios que MaKo cobra por la pasarela). Acá, lo que se ve: un cartel
// corto con `textoTope` y el link a los planes, sin borrar ni esconder nada.
// =============================================================================

import Link from '@/app/_ui/Link';
import { SANS } from '@/app/_ui';
import { textoTope } from '@/lib/topes-plan';

/** Donde cambia de plan quien ya es cliente (el Cerebro, 23/10/2026): el panel del plan. `/planes` es la página pública
 *  para quien todavía no compró. Un solo lugar, por si cambia. */
export const RUTA_PLANES = '/configuraciones/plan';

/** El link «Pasar a Pro», al lado de un error de tope. */
export function PasarAPro() {
  return (
    <Link href={RUTA_PLANES} style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 650, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
      Pasar a Pro
    </Link>
  );
}

/** El cartel del tablero cuando el negocio llegó al tope de leads: lo que entró solo (anuncios, webhooks) entró igual. */
export function CartelTope({ tope }: { tope: number }) {
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 12px', padding: '10px 14px', borderRadius: 12,
      border: '1px solid color-mix(in srgb, var(--warn) 45%, var(--border))', background: 'color-mix(in srgb, var(--warn) 8%, var(--surface))',
      fontFamily: SANS, fontSize: 13.5, color: 'var(--ink)',
    }}>
      <span style={{ flex: '1 1 260px' }}>{textoTope(tope)}</span>
      <PasarAPro />
    </div>
  );
}
