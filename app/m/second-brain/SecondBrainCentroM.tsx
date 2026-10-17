'use client';

// =============================================================================
// /m/second-brain del super admin: el chat con MaKo + sus chats de Claude Code (17/10/2026)
// =============================================================================
// La tanda 5 de docs/diseno-mako-ai-native.md en el teléfono (Martín: «quiero mandar prompts por MaKo en el Second
// Brain»). Es el chat de siempre (app/m/mako/ChatMako.tsx) y, en su hoja «Tus chats», debajo de los de MaKo, el Cerebro
// y cada jefe del Centro de Operaciones. Tocar uno abre SU conversación con la caja firmada: las mismas piezas del
// Centro del teléfono (app/m/operaciones/ChatsMovil.tsx) sobre el mismo motor (app/admin/operaciones/useCentro.ts).
//
// ⚠️ LA HOJA DE LA CONVERSACIÓN VA AFUERA DE «Tus chats»: una hoja sobre otra REEMPLAZA (SheetM.tsx), y si viviera
//    adentro, cerrar «Tus chats» la desmontaría. Por eso ChatsM va en dos partes, con el chat abierto acá.
// ⚠️ Esto se monta sólo si el servidor mandó los datos: `datosDelCentroSiOpera` (app/admin/operaciones/datos.ts) pide
//    `puedeOperar` antes de leer nada.

import { useState, type ComponentProps } from 'react';
import { useToastM } from '@/app/m/_ui';
import { useCentro, type DatosCentro } from '@/app/admin/operaciones/useCentro';
import { ChatsMDelCentro } from '@/app/m/operaciones/CentroAppMovil';
import { ChatMako } from '../mako/ChatMako';
import '@/app/m/operaciones/operaciones.css';

export function SecondBrainCentroM({ centro, chat }: { centro: DatosCentro; chat: Omit<ComponentProps<typeof ChatMako>, 'masChats'> }) {
  const toast = useToastM();
  const k = useCentro(centro, (t) => toast(t));
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <>
      <ChatMako {...chat} masChats={(cerrar) => (
        <ChatsMDelCentro centro={k} parte="lista" tituloChats="Claude Code" abierto={abierto}
          onAbierto={(clave) => { cerrar(); setAbierto(clave); }} />
      )} />
      <ChatsMDelCentro centro={k} parte="hoja" abierto={abierto} onAbierto={setAbierto} />
    </>
  );
}
