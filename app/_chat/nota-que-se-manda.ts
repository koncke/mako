'use client';

// =============================================================================
// La nota de voz de una caja cuyo motor no recibe audios: se graba, se transcribe y se MANDA (24/10/2026)
// =============================================================================
// Martín, por el Cerebro: «es mejor que esa funcionalidad [el dictado] la saquemos de todos lados, que sólo se quede en
// lugares muy específicos, pero en chats o en los chats de MaKo que se grabe el audio y se envíe directamente». El
// micrófono de toda caja de chat graba con la barra de siempre (`BarraGrabacion`: se termina, se escucha si quiere y ➤).
// La pantalla que sabe recibir un audio pasa su `voz` a la caja y lo manda como audio (el chat del cliente, la ficha del
// lead, Offer, Chats). La que no, usa esto: la nota se pasa a MP3 (el webm de Chrome no lo toma el transcriptor), se
// transcribe con /api/plan-dictado (las reglas de la IA del negocio, `pii`) y el texto SALE, sin esperar en el campo.
// El diseño: docs/diseno-chats-de-mako.md → «El micrófono de un chat graba una nota de voz».
//
// ⚠️ SE MANDA CON EL `onMandar` DE LA PANTALLA, en el render siguiente: el que manda lee el texto de SU estado, así que
//    primero se le pone (`onTexto`) y recién cuando la caja lo recibe de vuelta se manda (`listaParaMandar`). Así cada
//    pantalla manda lo transcrito por su camino de siempre (el Ops Center lo FIRMA en el dispositivo), sin tocar ninguna.
// ⚠️ Nada transcrito queda a medias: si la transcripción falla o viene vacía, se dice y no se manda nada.

import { useEffect, useRef, useState } from 'react';
import { useGrabacionVoz, type GrabacionVoz } from '@/app/whatsapp/_shared/VoiceRecorder';
import { transcribirNota } from '@/app/_components/useDictar';
import { notaEnMp3 } from '@/app/second-brain/nota-de-voz';

/** Lo transcrito ya está en la caja: se puede mandar. Pura (test). */
export function listaParaMandar(pendiente: string | null, texto: string): boolean {
  return pendiente != null && !!pendiente.trim() && texto.trim() === pendiente.trim();
}

/** Lo que vuelve de transcribir: el texto para mandar, o la frase de por qué no. Pura (test). */
export function textoDeLaNota(r: { ok: true; texto: string } | { ok: false; error: string }): { texto: string } | { error: string } {
  if (!r.ok) return { error: r.error };
  const t = r.texto.trim();
  return t ? { texto: t } : { error: 'No se escuchó nada en la nota. Grábala de nuevo.' };
}

export type NotaQueSeManda = {
  grabacion: GrabacionVoz;
  /** Pasando a texto lo grabado: la caja gira y no deja escribir. */
  transcribiendo: boolean;
  /** Por qué no salió, para la línea de la caja. */
  error: string | null;
};

export function useNotaQueSeManda({ texto, onTexto, onMandar, onError }: {
  texto: string;
  onTexto: (t: string) => void;
  onMandar: () => void;
  onError?: (m: string) => void;
}): NotaQueSeManda {
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El `onMandar` del último render: el que lee el texto ya transcrito.
  const mandar = useRef(onMandar);
  useEffect(() => { mandar.current = onMandar; });
  const decir = (m: string) => { setError(m); onError?.(m); };
  const grabacion = useGrabacionVoz(async (blob) => {
    setError(null);
    setTranscribiendo(true);
    try {
      let mp3: Blob;
      try { mp3 = await notaEnMp3(blob); } catch (e) { decir(e instanceof Error ? e.message : 'No se pudo procesar el audio.'); return; }
      const r = textoDeLaNota(await transcribirNota(mp3, 90_000, 'chat'));
      if ('error' in r) { decir(r.error); return; }
      setPendiente(r.texto);
      onTexto(r.texto);
    } finally {
      setTranscribiendo(false);
    }
  }, decir);
  useEffect(() => {
    if (pendiente == null) return;
    if (listaParaMandar(pendiente, texto)) { setPendiente(null); mandar.current(); }
    // Si la caja ya dice otra cosa (la pantalla la vació o la cambió), lo pendiente se suelta: nada sale solo después.
    else if (texto.trim()) setPendiente(null);
  }, [pendiente, texto]);
  return { grabacion, transcribiendo, error };
}
