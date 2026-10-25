// =============================================================================
// /m/chats — lo que REDIRIGE va acá, ANTES del loader (25/10/2026, React #310)
// =============================================================================
// El caso de los tickets #7 y #9 (docs/hallazgos-infra.md): `./loading.tsx` envuelve a la lista Y a cada chat, y un `redirect()`
// de la página va en el stream (200 + meta refresh, no 307), en carrera con la hidratación. La lista redirige con un link
// profundo de escritorio (`?c=`, `?lead=`: directo a su chat; `?linea=&chat=`: lo busca y abre el suyo), que es como llegan
// los avisos y MaKo por WhatsApp: una carga directa, la que se rompe. Este layout queda AFUERA del loader y hace lo mismo antes
// (307), con la ruta y la query que recibe la página (el proxy sirve /chats con /m/chats: `pedidoMovilActual`). La página
// conserva sus redirect para cuando se llega navegando. Si el link no está en la lista, la página la vuelve a leer: es el caso
// raro, y se queda en la lista.
// LA PUERTA, PARA LAS DOS (25/10/2026, chat «Landings»): `requireMovil` también redirige por dentro (sin sesión, al onboarding
// pendiente). La lista y cada chat (`/m/chats/<clave>`) pasan por la misma: va primero y sin mirar la ruta, así el chat que
// se abre directo desde un aviso tampoco redirige adentro del loader (tests/redirige-antes-del-loader.test.ts).
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { rutaConWs } from '@/lib/workspace';
import { pedidoMovilActual } from '@/lib/pedido-actual';
import { RUTA_CHATS } from '@/lib/movil-rutas';
import { leerLinkProfundo, resolverLinkProfundo } from '@/app/chats/lista-reglas';
import { leerChatsM } from './datos';
import { hiloDelLink, rutaHiloM } from './modelo';

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ChatsMLayout({ children }: { children: ReactNode }) {
  await requireMovil({ navKey: 'chats' });
  const pedido = await pedidoMovilActual();
  if (pedido?.ruta === RUTA_CHATS) {
    const sp = pedido.query;
    const link = leerLinkProfundo((k) => uno(sp[k]) ?? null);
    const directo = hiloDelLink(link);
    if (directo) redirect(await rutaConWs(directo));
    if (link) {
      const datos = await leerChatsM();
      const chat = datos ? resolverLinkProfundo(datos.filas.map((f) => f.chat), link) : null;
      if (chat) redirect(await rutaConWs(rutaHiloM(chat.clave)));
    }
  }
  return children;
}
