'use client';

// =============================================================================
// «Actualiza la extensión de MaKo», en la esquina de TODA la app (27/10/2026)
// =============================================================================
// Leila (Fathom 876470842-07) estaba en la 0.70 con la 0.74 vigente, y el «Extraer» del CRM no le andaba como a Martín. El
// aviso de extensión vieja existía, pero sólo en las pantallas de video (app/video-generator/extension-instalada.tsx), y ella
// no las abre. Una instalada DESCOMPRIMIDA no se actualiza sola (ahí está explicado por qué el ↻ de Chrome no alcanza): lo que
// queda es decirlo donde la persona esté, con el paso para cambiarla por la de la tienda.
//
// Mismo molde que «Actualiza el Pixel» (AvisoPixelViejo): una tarjeta en la esquina, que lleva al instructivo. Sólo si la
// extensión ESTÁ instalada y va atrás (`useExtensionVieja`, que ya descuenta la de la tienda). Sin extensión, nada.

import { usePathname } from 'next/navigation';
import Link from '@/app/_ui/Link';
import { esVistaSinChrome } from './PublicRouteGate';
import { useVistaMovil } from './VistaMovil';
import { useExtensionInstalada, useExtensionVieja } from '@/app/video-generator/extension-instalada';
import { VERSION_EN_TIENDA } from '@/lib/extension-tienda';

const SANS = "'Geist', sans-serif";

export function AvisoExtensionVieja() {
  const pathname = usePathname() ?? '';
  const movil = useVistaMovil();
  const instalada = useExtensionInstalada();
  const vieja = useExtensionVieja(instalada);
  // Ni en lo público, ni en el teléfono, ni donde ya está el aviso grande (video) o el instructivo mismo.
  const fuera = movil || esVistaSinChrome(pathname) || pathname.startsWith('/login')
    || pathname.startsWith('/video-generator') || pathname.startsWith('/extension');
  if (fuera || typeof instalada !== 'string' || !vieja) return null;

  const porque = `Tienes la extensión de MaKo ${instalada} y la actual es la ${VERSION_EN_TIENDA}. Quítala y agrégala desde la Chrome Web Store.`;
  return (
    <Link href="/extension/instalar" title={porque} aria-label={porque}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', textDecoration: 'none',
        background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14,
        boxShadow: '0 14px 40px rgba(18,21,27,.22)', fontFamily: SANS, pointerEvents: 'auto',
      }}>
      <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--warn-bg)', color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>!</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Actualiza la extensión de MaKo</span>
    </Link>
  );
}
