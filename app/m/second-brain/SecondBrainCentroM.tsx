'use client';

// =============================================================================
// /m/second-brain del super admin: el Ops Center del cliente que mira + sus chats de Claude Code (17/10/2026)
// =============================================================================
// La tanda 5 de docs/diseno-mako-ai-native.md en el teléfono (Martín: «quiero mandar prompts por MaKo en el Second
// Brain»). Es el Ops Center del cliente (ChatClienteM.tsx, el del teléfono del super admin con los chats del cliente) y,
// debajo de sus chats, el Cerebro y cada jefe del Centro de Operaciones. Tocar uno abre SU conversación con la caja firmada:
// las mismas piezas del Centro del teléfono (app/m/operaciones/ChatsMovil.tsx) sobre el mismo motor
// (app/admin/operaciones/useCentro.ts).
//
// ⚠️ LA HOJA DE LA CONVERSACIÓN DE CLAUDE CODE VA AFUERA DE LA LISTA: ChatsM va en dos partes, con el chat abierto acá.
// ⚠️ Esto se monta sólo si el servidor mandó los datos: `datosDelCentroSiOpera` (app/admin/operaciones/datos.ts) pide
//    `puedeOperar` antes de leer nada.

import { useState, type ComponentProps } from 'react';
import { useToastM } from '@/app/m/_ui';
import { useCentro, type DatosCentro } from '@/app/admin/operaciones/useCentro';
import { ChatsMDelCentro } from '@/app/m/operaciones/CentroAppMovil';
import { ChatClienteM } from './ChatClienteM';
import '@/app/m/operaciones/operaciones.css';

export function SecondBrainCentroM({ centro, chat }: { centro: DatosCentro; chat: Omit<ComponentProps<typeof ChatClienteM>, 'masChats'> }) {
  const toast = useToastM();
  const k = useCentro(centro, (t) => toast(t));
  const [abierto, setAbierto] = useState<string | null>(null);
  // Desde el 22/10/2026 la lista ES la pantalla (como en /m/operaciones): cerrar un chat de Claude Code vuelve a ella sola (antes
  // la lista era la hoja «Tus chats», y había que volver a abrirla con una demora).
  return (
    <>
      <ChatClienteM {...chat} masChats={() => (
        <ChatsMDelCentro centro={k} parte="lista" tituloChats="Claude Code" abierto={abierto} onAbierto={setAbierto} />
      )} />
      <ChatsMDelCentro centro={k} parte="hoja" abierto={abierto} onAbierto={setAbierto} />
    </>
  );
}
