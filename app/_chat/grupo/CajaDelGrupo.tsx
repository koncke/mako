'use client';

// =============================================================================
// La caja del grupo: la ÚNICA de la app, con su motor (3/11/2026)
// =============================================================================
//   · SIN `ocupado`: dos personas tienen que poder escribir mientras MaKo piensa. El POST guarda y vuelve (./useHiloDelGrupo.ts).
//   · `sinAdjuntos` + los adjuntos del motor: fotos y PDF, los que el servidor guarda. Sin esto, la caja LEE un Word y lo manda como texto dentro del mensaje, y en un grupo tiene
//     que llegar el archivo o nada.
//   · `onGrabada`: la nota sale en el acto, sin transcribir (Martín, 27/10). En un grupo se guarda siempre: un audio entre personas no rebota porque el negocio no tiene IA.
//   · SIN el bloqueo de la app de escritorio (tests/app-de-escritorio-todos-los-chats.test.ts): el pedido de hoy es un grupo sin fricción, y MaKo acá corre como en
//     WhatsApp, no en la computadora de nadie.

import { useState, type RefObject } from 'react';
import { CajaChat } from '@/app/_chat/CajaChat';
import { useAdjuntosDelChat } from '@/app/_chat/useAdjuntosDelChat';
import { CitaCaja } from '@/app/admin/operaciones/MensajeWA';
import { citaDeMensaje } from './pantalla';
import type { HiloDelGrupoK } from './useHiloDelGrupo';

export function CajaDelGrupo({ k, campo, seguir, movil = false, onError, onEnviado }: {
  k: HiloDelGrupoK;
  campo: RefObject<HTMLTextAreaElement | null>;
  seguir: () => HTMLElement | null;
  movil?: boolean;
  /** La línea de estado de cada pantalla. */
  onError: (m: string | null) => void;
  onEnviado?: () => void;
}) {
  const [texto, setTexto] = useState('');
  const adj = useAdjuntosDelChat({ puede: k.estado !== 'fuera', onError, conversacion: String(k.ws) });
  const mandar = () => {
    if (adj.preparando) { onError('Espera a que termine de preparar la foto.'); return; }
    const archivos = adj.tomar();
    if (!texto.trim() && !archivos.length) return;
    onError(null);
    k.enviar(texto, archivos);
    setTexto('');
    onEnviado?.();
  };
  return (
    <CajaChat texto={texto} onTexto={(v) => { onError(null); setTexto(v); }} onMandar={mandar}
      apagado={k.estado === 'cargando' || k.estado === 'fuera'} placeholder="Escribe un mensaje" tituloMandar={movil ? undefined : 'Mandar (Enter)'}
      enterManda={!movil} campo={campo} seguir={seguir} onErrorMic={onError} adjuntos={adj.caja} sinAdjuntos hayAlgoMas={adj.hay}
      onGrabada={(g) => { onError(null); k.enviarNota(g.audio, g.segundos); onEnviado?.(); }}
      {...(movil ? { altoMax: null, fila: 'm-operaciones-caja__fila' } : {})}
      arriba={k.cita ? <CitaCaja cita={citaDeMensaje(k.cita)} onQuitar={() => k.setCita(null)} /> : null} />
  );
}
