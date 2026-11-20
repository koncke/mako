'use client';

// =============================================================================
// EL VIDEO DE CADA COACH, ARRIBA DE SU CHAT LA PRIMERA VEZ (onboarding V2, 18/11/2026)
// =============================================================================
// La maqueta (C:/dev/artefactos-onboarding/cuerpo.html, OF_VIDEO y FC_VIDEO): cada coach abre con un mensaje de MaKo «Antes de
// empezar, mira este video corto…» y el video de ese coach, y después su saludo. Las claves, acordadas con el chat de los videos:
// `offer-coach` y `funnel-coach` (public/tutoriales/manifiesto.json). Lo dibuja app/_ui/tutorial/VideoDelMomento.tsx: sin video para
// esa clave, NADA (nunca otro en su lugar); en la revisión de Martín, su lugar marcado.
// ⚠️ SÓLO CON EL INTERRUPTOR (`dosCoaches`) Y SÓLO CON EL CHAT VACÍO («la primera vez»): quien lo mira con el coach único no ve nada.
//    Es la portada, como el saludo: no se guarda en el hilo.
// =============================================================================

import { useCallback, useMemo } from 'react';
import { VideoDelMomento } from '@/app/_ui/tutorial/VideoDelMomento';
import { useVideoTutorial } from '@/app/_ui/tutorial/useVideoTutorial';
import { useEsRevision } from '@/app/_ui/tutorial/store';
import { ORIGEN_FUNNEL_COACH, ORIGEN_OFFER_COACH, type CoachDelOps } from '@/lib/chat-mako-reglas';
import type { EnMensaje } from '@/app/_chat/HiloMako';
import type { ItemHilo } from '@/app/m/mako/chat-ui';

/** La clave del video de cada coach en el manifiesto. */
export const CLAVE_VIDEO_DEL_COACH: Record<CoachDelOps, string> = { offer: 'offer-coach', funnel: 'funnel-coach' };

/** Lo que dice MaKo arriba del video (la maqueta, textual). */
const LINEA: Record<CoachDelOps, string> = {
  offer: `Antes de empezar, mira este video corto: te cuento cómo trabaja ${ORIGEN_OFFER_COACH}.`,
  funnel: `Antes de elegir, mira este video corto: te cuento cómo trabaja ${ORIGEN_FUNNEL_COACH}.`,
};

/**
 * El saludo del coach con su video adelante: los mensajes de la portada y lo que se dibuja adentro del del video (`enMensaje` de
 * HiloMako). Sin el V2, o sin video fuera de la revisión, el saludo tal cual.
 */
export function useVideoDelCoach(cual: CoachDelOps, dosCoaches: boolean, saludo: readonly ItemHilo[], dalePlay = false) {
  const clave = CLAVE_VIDEO_DEL_COACH[cual];
  const video = useVideoTutorial(dosCoaches ? clave : null);
  // La placa, sólo en la revisión de Martín (20/11, la verificación de V10): no en todo el Cliente de Prueba.
  const revision = useEsRevision() && dosCoaches;
  const conVideo = dosCoaches && (video != null || revision);
  const id = `video-${clave}`;
  const items = useMemo<readonly ItemHilo[]>(() => {
    const primero = saludo[0];
    if (!conVideo || !primero || primero.k !== 'msg') return saludo;
    return [{ k: 'msg', id, role: 'assistant', texto: LINEA[cual], at: primero.at }, ...saludo];
  }, [conVideo, saludo, id, cual]);
  // «Mira aquí, la caja del chat» se marca mientras la voz lo dice (`marcarFrases`; 20/11, coaches-6: la maqueta la marca).
  // Quieto, el motor lo marca con «{título}: dale play» (V5, app/_ui/tutorial/useDalePlay.ts), sólo mientras es la portada (el chat
  // vacío): con la charla empezada, el video sigue arriba (V12) pero no vuelve a pedir play. El video va ARRIBA del texto (F4).
  const enMensaje = useCallback((x: { id: string }): EnMensaje | null => {
    if (x.id !== id) return null;
    return {
      arriba: cual === 'offer'
        ? <VideoDelMomento clave="offer-coach" titulo={ORIGEN_OFFER_COACH} revision={revision} dalePlay={dalePlay} marcarFrases />
        : <VideoDelMomento clave="funnel-coach" titulo={ORIGEN_FUNNEL_COACH} revision={revision} dalePlay={dalePlay} marcarFrases />,
    };
  }, [id, cual, revision, dalePlay]);
  return { items, enMensaje, conVideo };
}

// Los videos de cada coach del V2 para su ícono de videos (18/11; V6, 20/11: sólo lo que ya eligió): lib/onboarding-v2/videos-coach.ts.
export { videosDelFunnel, videosDelOffer } from '@/lib/onboarding-v2/videos-coach';
