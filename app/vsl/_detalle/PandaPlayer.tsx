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
