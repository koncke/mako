'use client';

// =============================================================================
// LO QUE COMPARTEN EL COACH DE LA COMPUTADORA (./ChatDelCoach.tsx) Y EL DEL TELÉFONO (app/m/second-brain/HojaDelCoach.tsx)
// =============================================================================
// Aparte, para que el teléfono no cargue el panel de la computadora: la voz de los coaches debajo de cada mensaje, el hilo con la
// portada adelante, la oferta armada en su mensaje y el aviso de que el Offer Coach no pudo abrir su conversación de Offer
// (onboarding V2; el motor de Offer, 19/11/2026: ./useChatDelCoach.ts → `motorOffer`).
// =============================================================================

import { useCallback, useMemo } from 'react';
import { BotonVozCoach } from '@/app/_ui/voz-coach/BotonVozCoach';
import { pdfDeMensaje } from '@/app/offer/ayudas';
import { OfertaEnElChat, PdfDeOtraVersion } from './OfertaEnElChat';
import type { ChatCliente } from './useChatCliente';
import type { EnMensaje } from '@/app/_chat/HiloMako';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { OfferSesionVista } from '@/lib/offer-marco';

/** El hilo del coach con su portada adelante (la presentación y el video del Offer Coach mientras la persona no escribió). Como la
 *  portada del chat vacío, no se guarda: es sólo lo que se dibuja. Sin portada, el motor tal cual. */
export function useHiloConPortada(k: ChatCliente, portada: readonly ItemHilo[] | null): ChatCliente {
  return useMemo(() => (portada?.length ? { ...k, items: [...portada, ...k.items] } : k), [k, portada]);
}

/**
 * Lo que va adentro del mensaje de MaKo que trae el PDF de una versión (con el motor de Offer): la oferta armada en UN mensaje
 * (./OfertaEnElChat.tsx) si es la última; sólo su PDF si es una anterior. Los mensajes del hilo llevan el id de Offer (`of-<id>`,
 * `itemsDeOffer`): así se sabe cuál es.
 */
export function useOfertaEnMensaje(sesion: OfferSesionVista | null, onSeguir: () => void, movil: boolean) {
  return useCallback((x: { id: string }): EnMensaje | null => {
    if (!sesion) return null;
    const m = sesion.mensajes.find((y) => `of-${y.id}` === x.id);
    const pdf = m ? pdfDeMensaje(m) : null;
    if (!pdf) return null;
    const c = sesion.conclusion;
    return { abajo: c && c.version === pdf.version
      ? <OfertaEnElChat sesion={sesion} conclusion={c} onSeguir={onSeguir} movil={movil} />
      : <PdfDeOtraVersion sesionId={sesion.id} version={pdf.version} /> };
  }, [sesion, onSeguir, movil]);
}

/** El Offer Coach no pudo abrir su conversación de Offer: por qué, con «Reintentar» (como el hilo que no cargó). */
export function ErrorDelOfferCoach({ error, onReintentar }: { error: string; onReintentar: () => void }) {
  return (
    <div className="co-portada">
      <p className="co-portada__dato">{error}</p>
      <button type="button" className="co-chip" onClick={onReintentar}>Reintentar</button>
    </div>
  );
}

/**
 * LA VOZ DE LOS COACHES debajo de cada mensaje del coach (la computadora y, desde el 19/11/2026, el teléfono: HojaDelCoach.tsx).
 * `fija`: una pregunta predefinida (el saludo de la portada), que se guarda la primera vez. El último mensaje suena solo. Junta lo
 * que el hilo ya llevaba en ese mensaje (`previo`: el video de la portada, la oferta armada) con el botón debajo.
 */
export function vozDelCoach(items: readonly ItemHilo[]) {
  const ultimoDelCoach = [...items].reverse().find((x) => x.k === 'msg')?.id ?? null;
  return (fija: boolean, previo?: (x: { id: string; texto: string }) => EnMensaje | null) => (x: { id: string; texto: string; k?: string }): EnMensaje | null => {
    const antes = previo?.(x as never) ?? null;
    if (!x.texto?.trim()) return antes;
    const voz = <BotonVozCoach id={x.id} texto={x.texto} fija={fija} autoplay={fija ? false : x.id === ultimoDelCoach} />;
    return { ...antes, abajo: <>{antes?.abajo}{voz}</> };
  };
}
