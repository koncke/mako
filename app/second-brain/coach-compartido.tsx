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
import type { CoachDelOps } from '@/lib/chat-mako-reglas';
import type { PlanFunnel } from '@/lib/funnel-plan';
import { VideoDelMomento } from '@/app/_ui/tutorial/VideoDelMomento';
import { PARA_TODOS } from '@/lib/onboarding-v2/revision';
import { claveClaseFunnel, conLaClase, itemClaseFunnel, tituloClaseFunnel } from '@/lib/onboarding-v2/videos-coach';

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

type EnMensajeDe = (x: { id: string; texto: string }) => EnMensaje | null;

/**
 * EL HILO DE UN COACH DEL V2 (20/11/2026, auditoría V7, V12 y F4; la computadora y el teléfono):
 *   · la presentación con su video queda SIEMPRE al principio del hilo, como un mensaje más (antes se iba apenas la persona
 *     escribía; V12);
 *   · con el funnel guardado, la clase del funnel principal llega como un mensaje de MaKo en su lugar (V7;
 *     lib/onboarding-v2/videos-coach.ts), con el video arriba del texto (F4);
 *   · cada mensaje lleva lo suyo: la voz, y con el motor de Offer la oferta armada adentro del que trae su PDF.
 * Sin el V2 (`dosCoaches`), el hilo tal cual.
 */
export function useHiloDelCoach(o: {
  k: ChatCliente; cual: CoachDelOps; dosCoaches: boolean; plan: PlanFunnel | null; motorOffer: boolean;
  portada: { items: readonly ItemHilo[]; enMensaje: (x: { id: string }) => EnMensaje | null };
  conVoz: ReturnType<typeof vozDelCoach>; deLaOferta: EnMensajeDe | ((x: { id: string }) => EnMensaje | null);
}): { hilo: ChatCliente; enMensaje: EnMensajeDe | undefined } {
  const { k, cual, dosCoaches, plan, motorOffer, portada, conVoz, deLaOferta } = o;
  const clase = useMemo(() => (dosCoaches && cual === 'funnel' && plan ? itemClaseFunnel(plan) : null), [dosCoaches, cual, plan]);
  const kConClase = useMemo(() => (clase ? { ...k, items: conLaClase<ItemHilo>(k.items, clase) } : k), [k, clase]);
  const hilo = useHiloConPortada(kConClase, dosCoaches ? portada.items : null);
  const idsPortada = useMemo(() => new Set(portada.items.map((x) => x.id)), [portada.items]);
  const enMensaje: EnMensajeDe = (x) => {
    if (idsPortada.has(x.id)) return conVoz(true, portada.enMensaje as never)(x);
    if (clase && plan && x.id === clase.id) {
      return conVoz(false, () => ({ arriba: <VideoDelMomento clave={claveClaseFunnel(plan.funnel)} titulo={tituloClaseFunnel(plan.funnel)} revision={!PARA_TODOS} /> }))(x);
    }
    return conVoz(false, motorOffer ? (deLaOferta as never) : undefined)(x);
  };
  return { hilo, enMensaje: dosCoaches ? enMensaje : undefined };
}
