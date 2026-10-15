// =============================================================================
// /m/chats — la pestaña Chats (v3, 14/10/2026): todos los chats, y «Sin responder» de un toque
// =============================================================================
// Martín (14/10/2026): «una tab de Chats con TODOS los chats integrados». En el escritorio es
// /whatsapp (el proxy manda acá en el teléfono: rutaMovil). Arriba el segmentado Todos · Sin
// responder, que filtra en el cliente (./ListaChats.tsx; `?ver=sin-responder` sólo elige con
// cuál abre); debajo, una fila por chat con el avatar, el último mensaje y hace cuánto. Tocar
// abre el hilo del lead (/m/crm/<id>/chat), que ya existe y se responde ahí.
//
// Tanda 1: sólo WhatsApp (ver ./datos.ts). Las bandejas de escritorio (Míos, Sin asignar, MaKo,
// por canal) llegan con los chats unificados.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { listaChats } from './datos';
import { ListaChats } from './ListaChats';
import './chats.css';

export const dynamic = 'force-dynamic';

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  await requireMovil({ navKey: 'chats' });
  const inicial = (await searchParams).ver === 'sin-responder' ? 'sin' : 'todos';
  const lista = await listaChats();

  if (!lista) {
    return <PantallaM refrescable><ErrorM frase="No pude leer los chats." /></PantallaM>;
  }
  return (
    <PantallaM refrescable>
      <ListaChats filas={lista.filas} sinResponder={lista.sinResponder} inicial={inicial} />
      {lista.sinLead > 0 && (
        <ComputadoraM que={lista.sinLead === 1 ? 'Un chat sin lead' : `${lista.sinLead} chats sin lead`} />
      )}
    </PantallaM>
  );
}
