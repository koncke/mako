'use client';

// =============================================================================
// PandaPlayer — el embed oficial de Panda con Picture-in-Picture que sigue al
// scroll (pipScrollFollow). Cuando el video sale de pantalla, se encoge a una
// esquina y sigue reproduciéndose mientras el visitante baja.
// =============================================================================
// Panda NO tiene esto por querystring: hay que cargar su api.v2.js y llamar
// p.pipScrollFollow({panda_id_player}) cuando el player está listo. El id del
// iframe DEBE ser `panda-<guid>` para que la API lo encuentre.

import { useEffect, useRef } from 'react';

type PandaInstance = { pipScrollFollow: (o: { panda_id_player: string }) => void };
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
  const wired = useRef(false);

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
          onReady() { try { p.pipScrollFollow({ panda_id_player: playerId }); } catch { /* ignore */ } },
        });
      } catch { /* ignore */ }
    });

    // pipScrollFollow escucha `window` scroll, pero la página de feature scrollea
    // DENTRO de .mk-det (position:fixed; overflow:auto), así que window nunca
    // scrollea y el PiP no dispara jamás. Reenviamos el scroll del contenedor a
    // window para que el handler de Panda reciba el evento y flote el video.
    const scroller = document.querySelector<HTMLElement>('.mk-det');
    if (!scroller) return;

    // …y por el mismo motivo hay que devolverlo a su lugar nosotros: Panda decide
    // el "volver" con `window.scrollY <= umbral`, y acá scrollY SIEMPRE es 0, así
    // que esa condición nunca se cumple y el video se quedaba flotando para
    // siempre. Cuando el hueco que dejó (el placeholder de Panda) vuelve a
    // entrar en pantalla, restauramos los estilos originales y lo sacamos.
    const restaurar = () => {
      const ifr = document.getElementById(playerId) as HTMLIFrameElement | null;
      if (!ifr || ifr.style.position !== 'fixed') return;
      const hueco = ifr.parentElement?.querySelector<HTMLElement>(':scope > div');
      if (!hueco) return;
      if (hueco.getBoundingClientRect().top < -8) return;   // todavía estamos abajo
      try {
        const o = JSON.parse(ifr.dataset.originalStyles || '{}') as Record<string, string>;
        (['position', 'bottom', 'right', 'left', 'top', 'width', 'height', 'zIndex'] as const)
          .forEach((k) => { ifr.style[k] = o[k] || ''; });
      } catch { ifr.removeAttribute('style'); }
      hueco.remove();
    };

    const onScroll = () => { window.dispatchEvent(new Event('scroll')); restaurar(); };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [guid, playerId]);

  return (
    <iframe
      id={playerId}
      src={src}
      title={title}
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}
