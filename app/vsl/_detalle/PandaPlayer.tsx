'use client';

// =============================================================================
// PandaPlayer — el embed de Panda con Picture-in-Picture PROPIO: cuando el video
// sale de pantalla se encoge a una esquina y sigue reproduciéndose; con un botón
// para cerrarlo que devuelve el video arriba y en pausa.
// =============================================================================
// El PiP lo manejamos nosotros (no `pipScrollFollow` de Panda) por dos razones:
// su flotante es suyo y no admite un botón de cerrar, y su lógica depende de
// `window.scrollY`, que acá vale siempre 0 porque la página scrollea DENTRO de
// .mk-det (position:fixed; overflow:auto). Con IntersectionObserver sobre ese
// contenedor no hace falta parchear nada global.
//
// De la API de Panda solo usamos `pause()`. El iframe NUNCA se re-parenta: solo
// cambia de CSS (absolute -> fixed), así que la reproducción no se corta.

import { useCallback, useEffect, useRef, useState } from 'react';

type PandaInstance = { pause: () => void };
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
  // Mientras volvemos al tope tras cerrar, no dejamos que el flotante reaparezca.
  const cerrando = useRef(false);
  const [pip, setPip] = useState(false);

  // ── API de Panda (solo para poder pausar al cerrar) ──
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
      try { playerRef.current = new window.PandaPlayer!(playerId, {}); } catch { /* ignore */ }
    });
  }, [guid, playerId]);

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
      if (!fueraPorArriba) { cerrando.current = false; setPip(false); return; }  // se ve: se rearma
      if (!cerrando.current) setPip(true);
    };

    evaluar();
    scroller.addEventListener('scroll', evaluar, { passive: true });
    window.addEventListener('resize', evaluar);
    return () => {
      scroller.removeEventListener('scroll', evaluar);
      window.removeEventListener('resize', evaluar);
    };
  }, []);

  // Cerrar = pausar + volver arriba del todo (y queda listo para volver a flotar).
  const cerrar = useCallback(() => {
    try { playerRef.current?.pause(); } catch { /* ignore */ }
    cerrando.current = true;
    setPip(false);
    document.querySelector<HTMLElement>('.mk-det')?.scrollTo({ top: 0, behavior: 'smooth' });
    // Red de seguridad: el guard se libera solo cuando el video vuelve a verse,
    // así que si el scroll suave no corre o lo interrumpen a mitad de camino, el
    // flotante quedaría bloqueado para siempre. Con esto siempre se rearma.
    window.setTimeout(() => { cerrando.current = false; }, 1200);
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
