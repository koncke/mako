// =============================================================================
// /m/chats — la pestaña Chats del teléfono: TODOS los chats, como la bandeja de escritorio (17/10/2026)
// =============================================================================
// Martín (14/10/2026): «una tab de Chats con TODOS los chats integrados». En escritorio es /chats (la
// bandeja unificada: WhatsApp, Instagram, Messenger y Email); el proxy la sirve acá en el teléfono con la
// MISMA URL (rutaMovil). Lo que se lee, en ./datos.ts; lo que se decide, en ./modelo.ts; la lista, en
// ./ListaChats.tsx. Tocar una fila abre /m/chats/<clave> (la URL de escritorio: /chats?c=<clave>).
//
// ⚠️ LOS LINKS PROFUNDOS DE ESCRITORIO LLEGAN ACÁ (un aviso, MaKo por WhatsApp, la ficha): `?c=` y `?lead=`
// ya nombran la conversación y van directo a su pantalla; `?linea=&chat=` (un mensaje de WhatsApp) se
// busca en la lista con `resolverLinkProfundo`, el de escritorio, que NUNCA elige otra conversación: si no
// está, se queda en la lista.
// =============================================================================

import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { rutaConWs } from '@/lib/workspace';
import { leerLinkProfundo, resolverLinkProfundo } from '@/app/chats/lista-reglas';
import { ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { leerChatsM } from './datos';
import { hiloDelLink, rutaHiloM } from './modelo';
import { ListaChats } from './ListaChats';
import './chats.css';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Busqueda = Promise<{ ver?: string; c?: string; lead?: string; linea?: string; chat?: string }>;

export default async function ChatsPage({ searchParams }: { searchParams: Busqueda }) {
  await requireMovil({ navKey: 'chats' });
  const sp = await searchParams;
  const link = leerLinkProfundo((k) => (sp as Record<string, string | undefined>)[k] ?? null);
  const directo = hiloDelLink(link);
  if (directo) redirect(await rutaConWs(directo));

  const datos = await leerChatsM();
  if (!datos) {
    return <PantallaM><ErrorM frase="No pude leer los chats." /></PantallaM>;
  }
  if (link) {
    const chat = resolverLinkProfundo(datos.filas.map((f) => f.chat), link);
    if (chat) redirect(await rutaConWs(rutaHiloM(chat.clave)));
  }
  return (
    <PantallaM>
      <ListaChats
        filas={datos.filas}
        conteos={datos.conteos}
        yo={datos.yo}
        canales={datos.canales}
        fallas={datos.fallas}
        fuera={datos.fuera}
        sinResponderInicial={sp.ver === 'sin-responder'}
      />
      <ComputadoraM que="Conectar canales y asignar" />
    </PantallaM>
  );
}
