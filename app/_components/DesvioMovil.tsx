'use client';

// =============================================================================
// DesvioMovil — un teléfono no ve el escritorio
// =============================================================================
// Montado en el layout raíz. Cuando el SERVER dice que esto es un teléfono (UA, sin la
// cookie de «Versión completa»: `prefiereMovil`), tapa cualquier pantalla de escritorio
// DESDE EL PRIMER PINTADO — usePathname corre también en el render del server, así que la
// cubierta viaja en el HTML y no hay un parpadeo del escritorio con su Sidebar en
// miniatura. Qué hacer con cada pantalla lo decide `decidirDesvio` (lib/movil-desvio.ts):
// ir a su versión de MaKo Mobile, o decir que se usa en la computadora.
//
// «Abrirla igual» escribe la misma cookie que «Versión completa» (12 h) y recarga: la
// decisión es del server, así que el componente no guarda nada propio.
// =============================================================================

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link, { useRouter, useWs } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from './icons';
import { decidirDesvio } from '@/lib/movil-desvio';
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

export function DesvioMovil({ telefono }: { telefono: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const ws = useWs();
  const desvio = telefono ? decidirDesvio(pathname) : { tipo: 'nada' as const };

  useEffect(() => {
    if (!telefono) return;
    // La query sólo se conoce en el navegador (useSearchParams pediría un Suspense en el
    // layout raíz, que está prohibido): se vuelve a decidir con ella.
    const d = decidirDesvio(window.location.pathname, window.location.search);
    if (d.tipo === 'ir') router.replace(d.destino);
  }, [telefono, pathname, router]);

  if (desvio.tipo === 'nada') return null;

  if (desvio.tipo === 'ir') {
    // Con JavaScript, el efecto de arriba lleva solo; el link es la salida si tarda o falla
    // (sin él, la cubierta sería una pantalla vacía sin forma de seguir).
    return (
      <div style={{ ...cubierta, alignItems: 'center' }} aria-busy="true">
        <Link href={desvio.destino} style={{ fontSize: 18, fontWeight: 600, color: 'var(--primary)', padding: 12 }}>Abrir MaKo Mobile</Link>
      </div>
    );
  }

  return (
    <div style={cubierta} role="dialog" aria-modal="true" aria-labelledby="desvio-titulo">
      {/* La computadora, no la chispa: v2 (11/10/2026) — el logo de MaKo va sólo en Today y en More
          (Martín: «Ese no es el icono de MaKo»), y esto dice DÓNDE se usa la pantalla. */}
      <div style={{ color: 'var(--dim)' }}><Icon name="computadora" size={44} /></div>
      <h1 id="desvio-titulo" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.015em', margin: 0 }}>
        Esta pantalla se usa en la computadora.
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <Button variant="primary" size="lg" full onClick={() => router.replace(HOME_MOVIL)}>
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
