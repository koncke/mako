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
import { esRevision } from '@/lib/onboarding-v2/revision';
import { ORIGEN_FUNNEL_COACH, ORIGEN_OFFER_COACH, type CoachDelOps } from '@/lib/chat-mako-reglas';
import type { EnMensaje } from '@/app/_chat/HiloMako';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { VideoDeUnChat } from '@/app/_ui/tutorial/VideosDelChat';
import { FUNNELS, ROTULO_FUNNEL } from '@/lib/funnel-plan';

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
export function useVideoDelCoach(cual: CoachDelOps, dosCoaches: boolean, saludo: readonly ItemHilo[]) {
  const clave = CLAVE_VIDEO_DEL_COACH[cual];
  const video = useVideoTutorial(dosCoaches ? clave : null);
  const revision = esRevision(dosCoaches);
  const conVideo = dosCoaches && (video != null || revision);
  const id = `video-${clave}`;
  const items = useMemo<readonly ItemHilo[]>(() => {
    const primero = saludo[0];
    if (!conVideo || !primero || primero.k !== 'msg') return saludo;
    return [{ k: 'msg', id, role: 'assistant', texto: LINEA[cual], at: primero.at }, ...saludo];
  }, [conVideo, saludo, id, cual]);
  // Quieto, el motor lo marca con «{título}: dale play» (V5, app/_ui/tutorial/useDalePlay.ts).
  const enMensaje = useCallback((x: { id: string }): EnMensaje | null => {
    if (x.id !== id) return null;
    return {
      abajo: cual === 'offer'
        ? <VideoDelMomento clave="offer-coach" titulo={ORIGEN_OFFER_COACH} revision={revision} dalePlay />
        : <VideoDelMomento clave="funnel-coach" titulo={ORIGEN_FUNNEL_COACH} revision={revision} dalePlay />,
    };
  }, [id, cual, revision]);
  return { items, enMensaje, conVideo };
}

// Los videos de cada coach del V2 para su ícono de videos (18/11, Martín: «el mismo ícono de videos que tiene el reto… que al
// cliquearlo se vean los videos de ese chat»; app/_ui/tutorial/VideosDelChat.tsx), con las claves del chat de los videos: su
// presentación, la clase de la oferta y una clase por funnel.
export const VIDEOS_DEL_OFFER: readonly VideoDeUnChat[] = [{ clave: 'offer-coach', titulo: `Cómo trabaja ${ORIGEN_OFFER_COACH}` }, { clave: 'offer-coach-clase', titulo: 'La clase de la oferta' }];
export const VIDEOS_DEL_FUNNEL: readonly VideoDeUnChat[] = [
  { clave: 'funnel-coach', titulo: `Cómo trabaja ${ORIGEN_FUNNEL_COACH}` },
  ...FUNNELS.map((f) => ({ clave: `funnel-clase-${f}`, titulo: `La clase de ${ROTULO_FUNNEL[f]}` })),
];
