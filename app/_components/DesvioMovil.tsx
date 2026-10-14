'use client';

// =============================================================================
// DesvioMovil — un teléfono no ve el escritorio
// =============================================================================
// Montado en el layout raíz. Cuando el SERVER dice que esto es un teléfono (UA, sin la
// cookie de «Versión completa»: `prefiereMovil`), tapa toda pantalla de escritorio que NO
// tiene versión del teléfono, DESDE EL PRIMER PINTADO — usePathname corre también en el
// render del server, así que la cubierta viaja en el HTML y no hay un parpadeo del
// escritorio con su Sidebar en miniatura. Qué es cada pantalla lo decide `decidirDesvio`
// (lib/movil-desvio.ts).
//
// ⚠️ YA NO NAVEGA (13/10/2026, LAS MISMAS RUTAS). Hasta ese día, lo que tenía versión del
// teléfono se mandaba a /m/… con un `router.replace`, y el teléfono terminaba en otra URL.
// Ahora esa página la sirve el PROXY en la misma URL (`pedidoMovil`), así que acá 'movil' no
// dibuja nada: el shell de /m ya está en pantalla.
//
// «Abrirla igual» escribe la misma cookie que «Versión completa» (12 h) y recarga: la
// decisión es del server, así que el componente no guarda nada propio.
// =============================================================================

import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter, useWs } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from './icons';
import { decidirDesvio, destinoMovil } from '@/lib/movil-desvio';
import { cookieVistaEscritorio } from '@/lib/movil-dispositivo';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { conWs } from '@/lib/ws-tab';

const cubierta: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 10000,
  background: 'var(--bg)', color: 'var(--ink)',
  display: 'flex', flexDirection: 'column', justifyContent: 'center',
  padding: 'calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom))',
  gap: 16,
};

export function DesvioMovil({ telefono, wsPropio = null }: {
  telefono: boolean;
  /** El admin global SIN cliente va a /m de SU negocio (lo resuelve el layout: `wsSuperAdmin`). */
  wsPropio?: number | null;
}) {
  const pathname = usePathname();
  // La query decide en dos pantallas (/configuraciones?tab=notif es la cuenta del teléfono). Sin
  // Suspense a propósito: el layout es dinámico (app/_ui/Link.tsx → WsProvider, la misma razón).
  const sp = useSearchParams();
  const router = useRouter();
  const ws = useWs();
  const desvio = telefono ? decidirDesvio(pathname, sp?.toString() ?? '') : { tipo: 'nada' as const };

  // 'movil': la página de /m ya la sirvió el proxy en esta URL. Nada que tapar.
  if (desvio.tipo !== 'computadora') return null;

  return (
    <div style={cubierta} role="dialog" aria-modal="true" aria-labelledby="desvio-titulo">
      {/* La computadora, no la chispa: v2 (11/10/2026) — el logo de MaKo va sólo en Today y en More
          (Martín: «Ese no es el icono de MaKo»), y esto dice DÓNDE se usa la pantalla. */}
      <div style={{ color: 'var(--dim)' }}><Icon name="computadora" size={44} /></div>
      <h1 id="desvio-titulo" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.015em', margin: 0 }}>
        Esta pantalla se usa en la computadora.
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <Button variant="primary" size="lg" full onClick={() => router.replace(destinoMovil(HOME_MOVIL, ws, wsPropio))}>
          Ir a MaKo Mobile
        </Button>
        <Button
          variant="tertiary"
          size="lg"
          full
          onClick={() => {
            document.cookie = cookieVistaEscritorio();
            window.location.replace(conWs(window.location.pathname + window.location.search, ws));
          }}
        >
          Abrirla igual
        </Button>
      </div>
    </div>
  );
}
