'use client';

// Carrusel de fotos del caso — el mismo de la landing principal (#historia,
// bloque 2): 3 fotos en 3/4, flechas a los costados y degradado abajo.
// Avanza solo cada 5s y se puede mover a mano.

import { useEffect, useState } from 'react';

const FOTOS = [
  { src: '/vsl-assets/caso-stage.png', alt: 'Mauricio presentando en vivo' },
  { src: '/vsl-assets/caso-martin.jpg', alt: 'Martín Koncke junto a Mauricio' },
  { src: '/vsl-assets/caso-equipo.jpg', alt: 'Mauricio con su equipo' },
];

function Flecha({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'prev' ? 'M15 6l-6 6l6 6' : 'M9 6l6 6l-6 6'} />
    </svg>
  );
}

export default function CasoCarrusel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => (v + 1) % FOTOS.length), 5000);
    return () => window.clearInterval(id);
  }, []);
  const ir = (d: number) => setI((v) => (v + d + FOTOS.length) % FOTOS.length);
  return (
    <div className="mk-carr">
      <div className="mk-carr-track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {FOTOS.map((f) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={f.src} src={f.src} alt={f.alt} />
        ))}
      </div>
      <div className="mk-carr-fade" />
      <button type="button" className="mk-carr-btn mk-carr-prev" onClick={() => ir(-1)} aria-label="Foto anterior"><Flecha dir="prev" /></button>
      <button type="button" className="mk-carr-btn mk-carr-next" onClick={() => ir(1)} aria-label="Foto siguiente"><Flecha dir="next" /></button>
      <div className="mk-carr-dots">
        {FOTOS.map((f, k) => (
          <button key={f.src} type="button" className={`mk-carr-dot ${k === i ? 'on' : ''}`} onClick={() => setI(k)} aria-label={`Foto ${k + 1}`} />
        ))}
      </div>
    </div>
  );
}
