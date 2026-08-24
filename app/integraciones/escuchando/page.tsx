// =============================================================================
// /integraciones/escuchando — la ventana de prueba, encima de la landing
// =============================================================================
// El pedido: «cuando le doy a Probar debería abrirme la tab de esa landing, pero
// también una ventana de MaKo que se superponga… así no tengo que estar volviendo
// para ir probando».
//
// Es exactamente el problema de la prueba: para verificar que un click se
// registra hay que hacer el click EN la landing y mirar el resultado EN MaKo, y
// con dos pestañas eso es alternar a ciegas — apretás, cambiás de pestaña, y para
// cuando mirás ya no sabés si lo que ves es de ese click o del anterior.
//
// Sin sidebar y sin `Pagina`: esto vive en una ventana de ~420 px que se apoya
// sobre la landing. El chrome de la app acá no orienta, ocupa.
//
// Renderiza el MISMO `ProbarTracking` con `pruebaInicial`. Una segunda copia del
// panel es una copia que se queda vieja.

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { requireRolWs } from '@/lib/tab-access';
import { ProbarTracking } from '../ProbarTracking';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EscuchandoPage({ searchParams }: { searchParams: Promise<{ p?: string; l?: string }> }) {
  const sesion = await getUsuarioActual();
  if (!sesion) redirect(await rutaConWs('/inicio'));
  // El mismo gate que la tab: una ventana sin chrome sigue siendo la misma
  // pantalla, y el permiso no se relaja porque el marco sea más chico.
  await requireRolWs([], { nav: 'integraciones' });

  const { p, l } = await searchParams;
  // Sin marcador no hay nada que escuchar: esta ventana solo existe como parte de
  // una prueba que arrancó en la tab. Se manda de vuelta en vez de mostrar un
  // panel vacío que parece roto.
  if (!p) redirect(await rutaConWs('/integraciones?abrir=landing'));

  return (
    <main style={{ padding: 14, minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Geist', sans-serif" }}>
      {/* ⚠️ LA LANDING VIAJA. Esta ventana se montaba solo con el marcador, así
          que `ProbarTracking` recibía `landingFija` en undefined, no analizaba
          nada y pedía los chequeos SIN saber qué piezas tiene la página. Y esta
          es la ventana que el cliente MIRA durante la prueba —la tab queda
          atrás—, o sea que la pantalla con menos contexto era la que hablaba:
          a una landing sin video le pedía «reproduce tu video» y le informaba
          un problema de retención (24/08/2026, ws13).
          Va por la URL y no por el marcador para que la ventana no dependa de
          una consulta más antes de poder pintar el primer chequeo. */}
      <ProbarTracking pruebaInicial={p} landingFija={l ?? null} />
    </main>
  );
}
