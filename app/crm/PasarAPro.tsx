'use client';

// =============================================================================
// «Pasar a Pro» y el cartel del tope del plan en el CRM (23/10/2026)
// =============================================================================
// El tope lo decide lib/topes-crm.ts (sólo a los negocios que MaKo cobra por la pasarela). Acá, lo que se ve: un cartel
// corto con `textoTope` y el link a los planes, sin borrar ni esconder nada.
// =============================================================================

import Link from '@/app/_ui/Link';
import { SANS } from '@/app/_ui';
import { CtaPasarAPro } from '@/app/_components/CtaPasarAPro';
import { esTelefono } from '@/lib/telefono';
import { RUTA_CAMBIAR_PLAN, textoTope } from '@/lib/topes-plan';

/** El link «Pasar a Pro», al lado de un error de tope. Lo usan el tablero, el alta de un lead y la barra del CRM. */
export function PasarAPro() {
  // El teléfono no vende (T5, docs/tiendas-play-appstore.md): el alta de un lead se dibuja también en /m. Sale después de un error, nunca en el primer dibujo.
  if (typeof navigator !== 'undefined' && esTelefono(navigator.userAgent)) return null;
  // Al cliente de una AGENCIA, el cambio de plan se lo pide a ella (6/11/2026, #494): el link le vendía un segundo plan
  // del que su agencia ya paga. El texto del tope de al lado no cambia: llegó al tope igual.
  return (
    <CtaPasarAPro>
      <Link href={RUTA_CAMBIAR_PLAN} style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 650, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
        Pasar a Pro
      </Link>
    </CtaPasarAPro>
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
