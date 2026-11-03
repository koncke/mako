'use client';

// =============================================================================
// La estrella en TODAS las tabs (1/11/2026)
// =============================================================================
// Martín: «ponerlo como antes que esté flotando. Dentro de la misma página, independientemente de qué tab estemos». Medido ese
// día: `MakoEnLaTab` lo montaban sólo siete pantallas (CRM, Plan, Calendario, Clients, Media Buyer, el editor del Dashboard y
// Llamadas); General, Chats, Competitors Spy o Integraciones no tenían estrella. La barra es la única pieza que está en todas, así
// que la monta ella, salvo en donde ya hay un chat de MaKo a la vista (lib/estrella-rutas.ts) o la tab tiene la suya.
//
// ⚠️ SE CARGA APARTE (`dynamic`): MakoEnLaTab trae el motor del chat y centro.css, y la barra pesa en cada página.
// ⚠️ `key` CON LA RUTA: cambiar de tab cierra el panel, como pasa con la de cada tab (se desmonta con la página), y lo que se
//    escribe sale «desde» la tab nueva.

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { llevaEstrellaDeLaApp } from '@/lib/estrella-rutas';
import { TODOS_LOS_ITEMS } from '@/app/_components/nav';
import { useHayEstrellaPropia } from './estrella-propia';

const MakoEnLaTab = dynamic(() => import('./MakoEnLaTab').then((m) => m.MakoEnLaTab), { ssr: false });

export function EstrellaDeLaApp() {
  const pathname = usePathname() ?? '';
  const hayPropia = useHayEstrellaPropia();
  if (hayPropia || !llevaEstrellaDeLaApp(pathname)) return null;
  const tab = TODOS_LOS_ITEMS.find((it) => it.match(pathname))?.label ?? 'MaKo';
  return <MakoEnLaTab key={pathname} tab={tab} deLaApp />;
}
