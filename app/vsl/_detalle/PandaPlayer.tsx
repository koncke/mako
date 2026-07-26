'use client';

// =============================================================================
// PandaPlayer — el embed de Panda con Picture-in-Picture PROPIO: cuando el video
// sale de pantalla se encoge a una esquina y sigue reproduciéndose; con un botón
// para cerrarlo que lo devuelve a su lugar y en pausa.
// =============================================================================
// El PiP lo manejamos nosotros (no `pipScrollFollow` de Panda) por dos razones:
// su flotante es suyo y no admite un botón de cerrar, y su lógica depende de
// `window.scrollY`, que acá vale siempre 0 porque la página scrollea DENTRO de
// .mk-det (position:fixed; overflow:auto). Con un listener sobre ese contenedor
// no hace falta parchear nada global.
//
// De la API de Panda usamos `pause()` y sus eventos. El iframe NUNCA se
// re-parenta: solo cambia de CSS (absolute -> fixed), así que la reproducción
// no se corta.

import { useCallback, useEffect, useRef, useState } from 'react';

type PandaEvent = { message?: string };
type PandaInstance = { pause: () => void; onEvent?: (cb: (e: PandaEvent) => void) => void };
declare global {
  interface Window {
    pandascripttag?: Array<() => void>;
    PandaPlayer?: new (id: string, opts: { onReady?: () => void }) => PandaInstance;
  }
}

const API_SRC = 'https://player.pandavideo.com.br/api.v2.js';

export default function PandaPlayer({ src, title }: { src: string; title: string }) {
  const guid = (src.match(/[?&]v=([^&]+)/) || [])[1] || '';
  const playerId = `panda-${guid}`;
  const slotRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PandaInstance | null>(null);
  const wired = useRef(false);
  // Cerrado a mano: no vuelve a flotar hasta que el visitante le dé PLAY otra vez.
  const descartado = useRef(false);
  const evaluarRef = useRef<(() => void) | null>(null);
  const [pip, setPip] = useState(false);

  // ── API de Panda: pausar al cerrar + escuchar el play para rearmar el PiP ──
  useEffect(() => {
    if (!guid || wired.current) return;
    wired.current = true;
    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const s = document.createElement('script');
      s.src = API_SRC; s.async = true;
      document.head.appendChild(s);
    }
    window.pandascripttag = window.pandascripttag || [];
    window.pandascripttag.push(() => {
      try {
        const p = new window.PandaPlayer!(playerId, {
          onReady() {
            try {
              p.onEvent?.((e) => {
                // Le dio play de nuevo: el flotante vuelve a estar habilitado.
                if (typeof e?.message === 'string' && e.message.includes('play')) {
                  descartado.current = false;
                  evaluarRef.current?.();
                }
              });
            } catch { /* ignore */ }
          },
        });
        playerRef.current = p;
      } catch { /* ignore */ }
    });
  }, [guid, playerId]);

  // Segundo camino para enterarnos del PLAY: los mensajes que el iframe de Panda
  // publica en la ventana. Si su API cambiara de nombre o no llegara a cablear
  // `onEvent`, el flotante quedaría desarmado para siempre después de cerrarlo
  // una vez; con esto se rearma igual.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!String(e.origin).includes('pandavideo')) return;
      // OJO: hay que comparar el mensaje EXACTO. Panda publica eventos todo el
      // tiempo y varios llevan la palabra "player" (su propio dominio también),
      // así que un `includes('play')` rearmaba el flotante al instante y volvía
      // inútil el botón de cerrar.
      const d: unknown = e.data;
      let msg = '';
      if (typeof d === 'string') {
        try {
          const o = JSON.parse(d) as { message?: unknown };
          msg = typeof o?.message === 'string' ? o.message : d;
        } catch { msg = d; }
      } else if (d && typeof d === 'object') {
        const m = (d as { message?: unknown }).message;
        if (typeof m === 'string') msg = m;
      }
      if (msg === 'panda_play' || msg === 'panda_playing') {
        descartado.current = false;
        evaluarRef.current?.();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // ── PiP: flota cuando el hueco del video se fue por ARRIBA de la pantalla ──
  // Con listener de scroll y no IntersectionObserver: el IO depende de que el
  // navegador esté pintando (en una pestaña de fondo no dispara) y acá el
  // comportamiento tiene que ser exacto.
  useEffect(() => {
    const slot = slotRef.current;
    const scroller = document.querySelector<HTMLElement>('.mk-det');
    if (!slot || !scroller) return;

    const evaluar = () => {
      const tope = scroller.getBoundingClientRect().top;
      const fueraPorArriba = slot.getBoundingClientRect().bottom < tope + 8;
      setPip(fueraPorArriba && !descartado.current);
    };
    evaluarRef.current = evaluar;

    evaluar();
    scroller.addEventListener('scroll', evaluar, { passive: true });
    window.addEventListener('resize', evaluar);
    return () => {
      evaluarRef.current = null;
      scroller.removeEventListener('scroll', evaluar);
      window.removeEventListener('resize', evaluar);
    };
  }, []);

  // Cerrar = se pausa y vuelve a su lugar (NO mueve el scroll). No acompaña más
  // al visitante hasta que le dé play otra vez.
  const cerrar = useCallback(() => {
    try { playerRef.current?.pause(); } catch { /* ignore */ }
    descartado.current = true;
    setPip(false);
  }, []);

  return (
    <div className="mk-vsl-slot" ref={slotRef}>
      <div className={`mk-vsl${pip ? ' mk-vsl-pip' : ''}`}>
        <span className="mk-cor tl" /><span className="mk-cor tr" />
        <span className="mk-cor bl" /><span className="mk-cor br" />
        <iframe
          id={playerId}
          src={src}
          title={title}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
        {pip && (
          <button type="button" className="mk-vsl-x" onClick={cerrar} aria-label="Cerrar el video">
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
