'use client';
// =============================================================================
// EL MENSAJE QUE NOMBRA ALGO DEL VIDEO SALE CUANDO LA VOZ LLEGA AHÍ (20/11/2026)
// =============================================================================
// Martín, probando el onboarding en producción: en el paso del WhatsApp salían JUNTOS el video y el mensaje con «Abrir WhatsApp».
// La regla (el Cerebro): primero va solo el video; cuando la voz nombra el botón (el t_inicio de esa frase en el manifiesto), MaKo
// escribe (los tres puntitos) y llega el mensaje. Nunca dos mensajes de MaKo de golpe. Y nadie queda trabado: si el video no corre
// (no le dan play, falla, lo pausan, termina o ya se vio), el mensaje sale igual, con sus puntitos.
// Lo usan, en app/onboarding/ChatArranqueV2.tsx, la primera pregunta (la bienvenida dice «unas preguntas cortas…»), el mensaje del
// código («toca Abrir WhatsApp») y «¿Guardaste el contacto de MaKo?» («guarda el contacto de MaKo»).
// El núcleo (`esperarAlMomento`) no usa React: lo prueba tests/onboarding-mensaje-del-video.test.ts con un video de mentira.
// =============================================================================
import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { useVideoTutorial } from './useVideoTutorial';
import { pausaPorFlotar } from './useVideoQueFlota';
import type { FraseVideo } from '@/lib/tutoriales/videos';

/** 'espera': todavía no llegó su momento. 'listo': ya puede salir (sus puntitos y su pieza los pone la cola: app/_chat/useColaDeSalida.ts). */
export type FaseMensaje = 'espera' | 'listo';

/** Sin el video en el manifiesto (o sin manifiesto), el mensaje sale después de este momento. */
export const MS_SIN_VIDEO = 2500;
/** Un video que nadie pone a correr (no arranca solo) no retiene el mensaje para siempre. */
export const MS_SIN_PLAY = 12_000;
/** Con el video corriendo, el momento llega a más tardar a su hora más esto (se trabó, o flota en la esquina y no se oye aquí). */
export const MS_TOPE_EXTRA = 2000;

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** El segundo en que la voz nombra `dice` (el t_inicio de la primera frase que lo dice), o null si ninguna frase lo nombra. */
export function momentoDelVideo(frases: readonly Pick<FraseVideo, 't_inicio' | 'texto'>[], dice: string | null): number | null {
  if (!dice) return null;
  const d = sinAcentos(dice);
  const f = frases.find((x) => sinAcentos(x.texto ?? '').includes(d));
  return f ? f.t_inicio : null;
}

/** Lo que se usa del video y de su lugar (un HTMLElement con su <video>; en el test, uno de mentira). */
export type VideoQueCorre = { paused: boolean; ended: boolean; currentTime: number; playbackRate: number; dataset?: Record<string, string | undefined> };
export type LugarDelVideo = {
  addEventListener(tipo: string, f: () => void, captura: boolean): void;
  removeEventListener(tipo: string, f: () => void, captura: boolean): void;
  querySelector(sel: 'video'): VideoQueCorre | null;
};
export type Reloj = { poner(f: () => void, ms: number): number; sacar(id: number): void };
const RELOJ: Reloj = { poner: (f, ms) => window.setTimeout(f, ms), sacar: (id) => window.clearTimeout(id) };

/**
 * Espera el momento del video y llama `soltar` UNA vez. `conPuntitos` false: no hubo que esperar nada (el video no corría y
 * `esperaPlay` es 0). Los puntitos de verdad los pone la cola de salida. Devuelve la limpieza.
 * Los eventos del <video> no burbujean: se oyen en CAPTURA desde su lugar (la fila del mensaje), sin tocar el reproductor.
 */
export function esperarAlMomento(lugar: LugarDelVideo | null, o: { tMomento: number | null; esperaPlay: number; hayVideo: boolean },
  soltar: (conPuntitos: boolean) => void, reloj: Reloj = RELOJ): () => void {
  let hecho = false;
  const relojes: number[] = [];
  const quitar: (() => void)[] = [];
  const limpiar = () => { for (const id of relojes) reloj.sacar(id); relojes.length = 0; for (const q of quitar) q(); quitar.length = 0; };
  const listo = (conPuntitos = true) => { if (hecho) return; hecho = true; limpiar(); soltar(conPuntitos); };
  const video = lugar?.querySelector('video') ?? null;
  if (!o.hayVideo || !lugar || !video) {
    relojes.push(reloj.poner(() => listo(), MS_SIN_VIDEO));
    return limpiar;
  }
  const llego = () => o.tMomento != null && video.currentTime >= o.tMomento - 0.05;
  const tope = () => {
    if (o.tMomento == null) return;
    const ms = (Math.max(0, o.tMomento - video.currentTime) / (video.playbackRate || 1)) * 1000 + MS_TOPE_EXTRA;
    relojes.push(reloj.poner(() => listo(), ms));
  };
  const oir = (tipo: string, f: () => void) => { lugar.addEventListener(tipo, f, true); quitar.push(() => lugar.removeEventListener(tipo, f, true)); };
  let sinPlay = 0;
  oir('play', () => { if (sinPlay) { reloj.sacar(sinPlay); sinPlay = 0; } tope(); });
  oir('timeupdate', () => { if (llego()) listo(); });
  // Pausarlo, que termine o que falle: la persona dejó de verlo (o no puede), y el mensaje no la deja esperando. La pausa por pasar a la
  // esquina NO (videos-1): el video sigue hablando ahí; el momento lo da el tope (`tope`, puesto al darle play).
  oir('pause', () => { if (!video.ended && !pausaPorFlotar(video)) listo(); });
  oir('ended', () => listo());
  oir('error', () => listo());
  const corre = !video.paused && !video.ended;
  if (corre) {
    // Ya pasó su momento: sale ahora (sin puntitos de más si no se esperaba un play: lo de antes ya trajo los suyos).
    if (llego()) { listo(o.esperaPlay > 0); return limpiar; }
    tope();
    return limpiar;
  }
  // Quieto. Ya pasó su momento (lo vio antes), o no se espera un play: sale ahora, sin puntitos de más.
  if (llego() || video.ended || o.esperaPlay <= 0) { listo(o.esperaPlay > 0); return limpiar; }
  sinPlay = reloj.poner(() => listo(), o.esperaPlay);
  relojes.push(sinPlay);
  return limpiar;
}

/**
 * El mensaje que espera el momento del video `clave` en que la voz dice `dice`. `lugar`: la fila del video. `activo`: el mensaje ya
 * existe y le toca esperar (antes, nada corre). `inicial`: 'listo' si ya había salido (quien vuelve lo ve todo de una).
 * `esperaPlay`: cuánto se espera un play si el video está quieto (0: no se espera, sale ya).
 */
export function useMensajeDelVideo(o: { lugar: RefObject<HTMLElement | null>; activo: boolean; inicial: FaseMensaje; clave: string; dice: string | null; esperaPlay: number }):
  { fase: FaseMensaje; soltar: () => void; listo: () => void } {
  const video = useVideoTutorial(o.clave);
  const tMomento = useMemo(() => momentoDelVideo(video?.frases ?? [], o.dice), [video, o.dice]);
  const [fase, setFase] = useState<FaseMensaje>(o.inicial);
  const soltarCon = useCallback(() => { setFase('listo'); }, []);
  const soltar = soltarCon;
  const listo = soltarCon;
  const { activo, esperaPlay, lugar } = o;
  useEffect(() => {
    if (!activo || fase !== 'espera') return;
    return esperarAlMomento(lugar.current as unknown as LugarDelVideo | null, { tMomento, esperaPlay, hayVideo: !!video }, soltarCon);
  }, [activo, fase, video, tMomento, esperaPlay, lugar, soltarCon]);
  return { fase, soltar, listo };
}
