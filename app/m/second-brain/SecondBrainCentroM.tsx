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
  // El «atrás» de Android (18/10/2026, Martín: «si le doy para atrás debería sacarme del chat para ir a ver todos los
  // chats»). Abrir un chat de la lista REEMPLAZA la hoja «Tus chats» (SheetM: nunca hay dos), así que cerrarlo, con el
  // «atrás», la ✕ o el arrastre, dejaba el chat de MaKo y no la lista. Al cerrarse, la lista vuelve. ⚠️ Con una demora:
  // cerrar por la ✕ consume su entrada del historial con un `back()` asíncrono, y una hoja que hiciera su `pushState`
  // antes lo vería pisado (SecondBrainM.tsx → editarDesdeElGrafo, el mismo cuidado).
  const [reabrir, setReabrir] = useState(0);
  const alAbrir = (clave: string | null) => {
    setAbierto(clave);
    if (clave == null && abierto != null) window.setTimeout(() => setReabrir((n) => n + 1), 350);
  };
  return (
    <>
      <ChatMako {...chat} reabrirChats={reabrir} masChats={(cerrar) => (
        <ChatsMDelCentro centro={k} parte="lista" tituloChats="Claude Code" abierto={abierto}
          onAbierto={(clave) => { cerrar(); setAbierto(clave); }} />
      )} />
      <ChatsMDelCentro centro={k} parte="hoja" abierto={abierto} onAbierto={alAbrir} />
    </>
  );
}
