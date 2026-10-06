'use client';

// =============================================================================
// Reproductor — el video de una clase en el portal del alumno, y la medición de cuánto vio
// =============================================================================
// Cuatro formas, según de dónde viene el video (`VideoVista`, lib/curso-portal.ts):
//   · `<video>` nativo para el SUBIDO (contra /api/compartido/curso/video, que valida el link y
//     redirige a una URL firmada) y para un .mp4/.webm directo.
//   · YouTube con su IFrame API: `onStateChange` + `getCurrentTime`/`getDuration` cada segundo
//     mientras reproduce.
//   · Vimeo con su Player API (`player.js`): el evento `timeupdate` trae segundos y duración.
//   · Loom y Drive en un iframe: se ven, pero no exponen el tiempo. La pantalla dice «Sin medir».
//
// El progreso se manda a /api/compartido/curso/progreso {t, c, seg, dur}: cada ~10 s mientras
// reproduce, en pausa, al terminar, al ocultar la pestaña y —con `navigator.sendBeacon`— al
// cerrarla. ⚠️ NUNCA SE MANDA UN %: el server lo calcula con lo más lejos que llegó sobre lo que
// dura (`guardarVisto`), y el % que se dibuja es el que él contesta.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoVista } from '@/lib/curso-portal';
import { ButtonLink } from '@/app/_ui';

type YTPlayer = { getCurrentTime: () => number; getDuration: () => number; destroy: () => void };
type YTApi = {
  Player: new (el: HTMLElement, opts: {
    videoId: string; host?: string; width?: string; height?: string;
    playerVars?: Record<string, string | number>;
    events?: { onStateChange?: (e: { data: number }) => void; onError?: () => void };
  }) => YTPlayer;
};
type VimeoPlayer = {
  on: (ev: string, cb: (d: { seconds?: number; duration?: number }) => void) => void;
  off: (ev: string) => void;
};
declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
    Vimeo?: { Player: new (el: HTMLIFrameElement) => VimeoPlayer };
  }
}

const URL_PROGRESO = '/api/compartido/curso/progreso';
const CADA_MS = 10_000;

// ── Los scripts de los reproductores, una vez por página ─────────────────────
const scripts = new Map<string, Promise<void>>();
function cargarScript(src: string): Promise<void> {
  let p = scripts.get(src);
  if (!p) {
    p = new Promise<void>((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => res();
      // Un bloqueador de anuncios lo corta: se olvida para poder reintentar en otra clase.
      s.onerror = () => { scripts.delete(src); rej(new Error(`no cargó ${src}`)); };
      document.head.appendChild(s);
    });
    scripts.set(src, p);
  }
  return p;
}

let ytListo: Promise<YTApi> | null = null;
/**
 * ⚠️ QUE CARGUE `iframe_api` NO ALCANZA: ese script trae otro, y YouTube avisa que está lista
 * llamando a `window.onYouTubeIframeAPIReady`. Se encadena con el que hubiera (otra pieza de la
 * página puede haberlo puesto) y se topa: sin respuesta en 15 s, el video se muestra sin medir.
 */
function cargarYouTube(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytListo) {
    ytListo = new Promise<YTApi>((res, rej) => {
      const previo = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previo?.(); if (window.YT) res(window.YT); };
      const tope = window.setTimeout(() => { ytListo = null; rej(new Error('YouTube no contestó')); }, 15_000);
      cargarScript('https://www.youtube.com/iframe_api')
        .then(() => { if (window.YT?.Player) { window.clearTimeout(tope); res(window.YT); } })
        .catch((e) => { window.clearTimeout(tope); ytListo = null; rej(e); });
    });
  }
  return ytListo;
}

// ── El reporte del progreso ───────────────────────────────────────────────────
/**
 * Lleva lo más lejos que llegó y lo manda. `marcar` se llama en cada lectura del reproductor;
 * `enviar` manda YA si hay algo nuevo (pausa, fin). Al ocultar o cerrar la pestaña, y al
 * desmontar (se cerró la clase), sale con `sendBeacon`, que sobrevive a la navegación.
 *
 * ⚠️ El primer avance real manda en el acto (el reloj arranca en cero): así queda registrado el
 * primer play aunque cierre a los tres segundos.
 */
function useReporte(token: string, claseId: number, onPct?: (pct: number) => void) {
  const max = useRef(0);
  const dur = useRef<number | null>(null);
  const enviado = useRef<{ seg: number; dur: number | null; at: number }>({ seg: 0, dur: null, at: 0 });
  const onPctRef = useRef(onPct);
  useEffect(() => { onPctRef.current = onPct; }, [onPct]);

  // ⚠️ Nada sale hasta que AVANZÓ: un `<video>` emite `timeupdate` en 0 al cargar, y eso
  // registraría como vista (`visto_at`) una clase que sólo se abrió.
  const pendiente = useCallback(
    () => max.current > 0 && (max.current > enviado.current.seg + 0.5 || dur.current !== enviado.current.dur),
    [],
  );
  const cuerpo = useCallback(
    () => JSON.stringify({ t: token, c: claseId, seg: Math.round(max.current * 10) / 10, dur: dur.current }),
    [token, claseId],
  );

  const enviar = useCallback(() => {
    if (!pendiente()) return;
    const antes = enviado.current;
    enviado.current = { seg: max.current, dur: dur.current, at: Date.now() };
    // `text/plain`: es lo mismo que manda el beacon, y la ruta lee el cuerpo sin mirar el tipo.
    fetch(URL_PROGRESO, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: cuerpo(), keepalive: true })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { progreso?: { pct?: unknown } } | null) => {
        if (typeof j?.progreso?.pct === 'number') onPctRef.current?.(j.progreso.pct);
      })
      // Sin red: se vuelve a la marca anterior para que el próximo intento lo lleve.
      .catch(() => { enviado.current = { ...antes, at: enviado.current.at }; });
  }, [pendiente, cuerpo]);

  const marcar = useCallback((seg: number, d: number | null | undefined) => {
    if (Number.isFinite(seg) && seg > max.current) max.current = seg;
    if (d && Number.isFinite(d) && d > 0) dur.current = d;
    if (Date.now() - enviado.current.at >= CADA_MS) enviar();
  }, [enviar]);

  useEffect(() => {
    const salir = () => {
      if (!pendiente()) return;
      const ok = typeof navigator.sendBeacon === 'function'
        && navigator.sendBeacon(URL_PROGRESO, new Blob([cuerpo()], { type: 'text/plain' }));
      if (ok) enviado.current = { seg: max.current, dur: dur.current, at: Date.now() };
      else enviar();
    };
    const alOcultar = () => { if (document.visibilityState === 'hidden') salir(); };
    window.addEventListener('pagehide', salir);
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      window.removeEventListener('pagehide', salir);
      document.removeEventListener('visibilitychange', alOcultar);
      salir();
    };
  }, [pendiente, cuerpo, enviar]);

  return { marcar, enviar };
}

// ── Las cuatro formas ─────────────────────────────────────────────────────────

export default function Reproductor({ token, claseId, video, titulo, onPct }: {
  token: string;
  claseId: number;
  video: VideoVista;
  titulo: string;
  /** El % que contestó el server después de guardar. */
  onPct?: (pct: number) => void;
}) {
  switch (video.tipo) {
    case 'archivo':
      return <VideoNativo token={token} claseId={claseId} src={`/api/compartido/curso/video?t=${encodeURIComponent(token)}&c=${claseId}`} reintenta titulo={titulo} onPct={onPct} />;
    case 'directo':
      return <VideoNativo token={token} claseId={claseId} src={video.url} titulo={titulo} onPct={onPct} />;
    case 'youtube':
      return <VideoYouTube token={token} claseId={claseId} id={video.id} titulo={titulo} onPct={onPct} />;
    case 'vimeo':
      return <VideoVimeo token={token} claseId={claseId} embed={video.embed} titulo={titulo} onPct={onPct} />;
    case 'iframe':
      return (
        <div className="cp-video">
          <iframe src={video.embed} title={titulo} allow="fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
        </div>
      );
    case 'afuera':
      return (
        <div className="cp-afuera">
          <ButtonLink href={video.url} newTab variant="secondary">Ver el video</ButtonLink>
        </div>
      );
  }
}

/**
 * `<video>` nativo. Con `reintenta` (el subido): si la URL firmada venció a mitad de la clase,
 * el próximo rango falla — se vuelve a pedir el endpoint del portal (que revalida el link) y se
 * sigue desde donde estaba. Dos veces como mucho: si vuelve a fallar, no es un vencimiento.
 */
function VideoNativo({ token, claseId, src, reintenta = false, titulo, onPct }: {
  token: string; claseId: number; src: string; reintenta?: boolean; titulo: string; onPct?: (pct: number) => void;
}) {
  const { marcar, enviar } = useReporte(token, claseId, onPct);
  const ref = useRef<HTMLVideoElement>(null);
  const [intento, setIntento] = useState(0);
  const [roto, setRoto] = useState(false);
  const volverA = useRef(0);
  const seguia = useRef(false);

  const leer = () => { const v = ref.current; if (v) marcar(v.currentTime, Number.isFinite(v.duration) ? v.duration : null); };

  if (roto) return <p className="cp-nota">No se pudo cargar el video.</p>;
  return (
    <div className="cp-video cp-video--nativo">
      <video
        ref={ref}
        key={intento}
        src={intento ? `${src}&n=${intento}` : src}
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload"
        aria-label={titulo}
        onTimeUpdate={leer}
        onPause={() => { leer(); enviar(); }}
        onEnded={() => { leer(); enviar(); }}
        onLoadedMetadata={() => {
          const v = ref.current;
          if (!v || !volverA.current) return;
          v.currentTime = volverA.current;
          if (seguia.current) void v.play().catch(() => {});
        }}
        onError={() => {
          const v = ref.current;
          if (!reintenta || intento >= 2) { setRoto(true); return; }
          volverA.current = v?.currentTime || volverA.current;
          seguia.current = v ? !v.paused : false;
          setIntento((n) => n + 1);
        }}
      />
    </div>
  );
}

/**
 * YouTube. ⚠️ EL REPRODUCTOR SE MONTA EN UN NODO QUE REACT NO CONOCE: `YT.Player` reemplaza el
 * elemento que recibe por su iframe, y si ese elemento fuera de React, al desmontar React
 * intentaría sacar un nodo que ya no está. React maneja la caja; adentro manda YouTube.
 */
function VideoYouTube({ token, claseId, id, titulo, onPct }: {
  token: string; claseId: number; id: string; titulo: string; onPct?: (pct: number) => void;
}) {
  const { marcar, enviar } = useReporte(token, claseId, onPct);
  const caja = useRef<HTMLDivElement>(null);
  const [sinApi, setSinApi] = useState(false);

  useEffect(() => {
    let vivo = true;
    let player: YTPlayer | null = null;
    let reloj: number | undefined;
    const muestra = () => { try { if (player) marcar(player.getCurrentTime(), player.getDuration()); } catch { /* todavía no está listo */ } };
    cargarYouTube().then((YT) => {
      if (!vivo || !caja.current) return;
      const nodo = document.createElement('div');
      caja.current.appendChild(nodo);
      player = new YT.Player(nodo, {
        videoId: id,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
        events: {
          // 1 = reproduciendo · 2 = pausa · 0 = terminó (los demás: cargando, en cola).
          onStateChange: ({ data }) => {
            window.clearInterval(reloj);
            if (data === 1) { reloj = window.setInterval(muestra, 1000); muestra(); return; }
            muestra();
            if (data === 2 || data === 0) enviar();
          },
        },
      });
    }).catch(() => { if (vivo) setSinApi(true); });
    const nodoCaja = caja.current;
    return () => {
      vivo = false;
      window.clearInterval(reloj);
      muestra();
      enviar();
      try { player?.destroy(); } catch { /* ya no estaba */ }
      if (nodoCaja) nodoCaja.innerHTML = '';
    };
  }, [id, marcar, enviar]);

  // Sin la API (un bloqueador la cortó): el video se ve igual, pero no se puede medir.
  if (sinApi) {
    return (
      <div className="cp-video">
        <iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1`} title={titulo} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" />
      </div>
    );
  }
  return <div className="cp-video" ref={caja} aria-label={titulo} />;
}

/** Vimeo: el iframe lo dibuja React y la Player API se le engancha encima. */
function VideoVimeo({ token, claseId, embed, titulo, onPct }: {
  token: string; claseId: number; embed: string; titulo: string; onPct?: (pct: number) => void;
}) {
  const { marcar, enviar } = useReporte(token, claseId, onPct);
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let vivo = true;
    let player: VimeoPlayer | null = null;
    cargarScript('https://player.vimeo.com/api/player.js').then(() => {
      if (!vivo || !ref.current || !window.Vimeo) return;
      player = new window.Vimeo.Player(ref.current);
      player.on('timeupdate', (d) => marcar(Number(d.seconds), Number(d.duration)));
      player.on('pause', (d) => { marcar(Number(d.seconds), Number(d.duration)); enviar(); });
      player.on('ended', (d) => { marcar(Number(d.seconds), Number(d.duration)); enviar(); });
    }).catch(() => { /* sin la API se ve igual; no se mide */ });
    return () => {
      vivo = false;
      try { player?.off('timeupdate'); player?.off('pause'); player?.off('ended'); } catch { /* ya no estaba */ }
      enviar();
    };
  }, [marcar, enviar]);

  return (
    <div className="cp-video">
      <iframe ref={ref} src={embed} title={titulo} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
    </div>
  );
}
