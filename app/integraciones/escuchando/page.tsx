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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EscuchandoPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sesion = await getUsuarioActual();
  if (!sesion) redirect('/inicio');
  // El mismo gate que la tab: una ventana sin chrome sigue siendo la misma
  // pantalla, y el permiso no se relaja porque el marco sea más chico.
  await requireRolWs([], { nav: 'integraciones' });

  const { p } = await searchParams;
  // Sin marcador no hay nada que escuchar: esta ventana solo existe como parte de
  // una prueba que arrancó en la tab. Se manda de vuelta en vez de mostrar un
  // panel vacío que parece roto.
  if (!p) redirect('/integraciones?abrir=landing');

  return (
    <main style={{ padding: 14, minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Geist', sans-serif" }}>
      <ProbarTracking pruebaInicial={p} />
    </main>
  );
}
