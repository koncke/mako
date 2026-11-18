'use client';

// =============================================================================
// «¿Por qué ser partner de MaKo te conviene?» como CARRUSEL (18/11/2026)
// =============================================================================
// Martín por el Cerebro: «que sea como una tarjeta grandota… un carrusel que vaya desplazando con las opciones». Una tarjeta grande
// a la vez (ícono grande, título y texto), pasa sola cada 4 s, con puntos abajo, flechas en la computadora y deslizar con el dedo
// en el teléfono. Se pausa al pasar el mouse, al tocarla o con el foco adentro. Con «reducir movimiento», quieta y con las flechas
// (también en el teléfono). Sin JavaScript se ve la primera.
// Lo usan la landing (app/mako-partners/LandingPartners.tsx) y el artefacto (fuentes/partners/entrada-calculadora.tsx, que lo monta).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import type { Beneficio } from './beneficios';

const CADA_MS = 4000;

const Flecha = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export function Carrusel({ items }: { items: readonly Beneficio[] }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [quieto, setQuieto] = useState(false);
  const toque = useRef<number | null>(null);
  useEffect(() => { setQuieto(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); }, []);
  useEffect(() => {
    if (pausa || quieto || items.length < 2) return;
    const id = window.setTimeout(() => setI((x) => (x + 1) % items.length), CADA_MS);
    return () => window.clearTimeout(id);
  }, [i, pausa, quieto, items.length]);
  const ir = (k: number) => setI((k + items.length) % items.length);
  return (
    <div id="beneficios" className={`mp-car${quieto ? ' quieto' : ''}`} role="region" aria-roledescription="carrusel" aria-label="Por qué te conviene ser partner"
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}
      onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}
      onTouchStart={(e) => { setPausa(true); toque.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const x0 = toque.current; toque.current = null;
        const x1 = e.changedTouches[0]?.clientX;
        if (x0 == null || x1 == null || Math.abs(x1 - x0) < 40) return;
        ir(i + (x1 < x0 ? 1 : -1));
      }}>
      <div className="mp-car-ventana">
        <div className="mp-car-pista" style={{ transform: `translateX(-${i * 100}%)` }}>
          {items.map((b, k) => (
            <article key={b.titulo} className="mp-car-tarjeta" role="group" aria-roledescription="diapositiva"
              aria-label={`${k + 1} de ${items.length}: ${b.titulo}`} aria-hidden={k !== i || undefined} inert={k !== i || undefined}>
              <span className="mp-car-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {b.icono.map((d) => <path key={d} d={d} />)}
                </svg>
              </span>
              <h3>{b.titulo}</h3>
              <p>{b.texto}</p>
            </article>
          ))}
        </div>
      </div>
      <button type="button" className="mp-car-fl ant" aria-label="Anterior" onClick={() => ir(i - 1)}><Flecha d="M15 6l-6 6l6 6" /></button>
      <button type="button" className="mp-car-fl sig" aria-label="Siguiente" onClick={() => ir(i + 1)}><Flecha d="M9 6l6 6l-6 6" /></button>
      <div className="mp-car-puntos">
        {items.map((b, k) => (
          <button key={b.titulo} type="button" className={k === i ? 'activo' : undefined} aria-label={`Ver «${b.titulo}»`}
            aria-current={k === i || undefined} onClick={() => ir(k)} />
        ))}
      </div>
    </div>
  );
}
