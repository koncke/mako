'use client';

// =============================================================================
// El Second Brain DE VERDAD en la portada (14/11/2026)
// =============================================================================
// Martín: «no quiero que el second brain sea un video o una animación, sino que quiero que sea un second brain real, es decir,
// que ahí se renderice un second brain real y como el que tenemos, y que se pueda interactuar tal cual como lo tenemos en la
// aplicación, o sea que se pueda agarrar un grafo, que se pueda hacer zoom».
//
// Hasta hoy la fila de Brain mostraba `/vsl-assets/sitio/cerebro.webm`: una GRABACIÓN de este mismo componente. Acá se monta el
// componente, y se tira la grabación.
//
// Es el `Grafo` real de app/second-brain/Grafo.tsx, el mismo que corre dentro de la app, con el negocio real de Alex Hormozi
// (cerebro-ejemplo.json: 53 nodos, 94 aristas, con las posiciones ya calculadas por layoutCerebro, así que d3-force no entra al
// navegador en el primer dibujo). Se arrastra, se hace zoom y se toca un punto para ver lo que guarda, igual que en la app.
//
// TRES CUIDADOS, y cada uno tiene su porqué:
//   1. PESO. Grafo.tsx son 150 KB de fuente y arrastra el buscador, el filtro y @/app/_ui. En la portada eso está en el camino
//      crítico, así que entra con `next/dynamic` + `ssr: false` SÓLO cuando la fila se ve (IntersectionObserver), igual que
//      TablerosCarrusel difiere sus videos. Hasta entonces se muestra el póster, que ya existe.
//   2. TEMA. El grafo asume los tokens oscuros de la casa (--bg #14161B, --ink, --dim) y la portada es clara: el wrapper lleva
//      `data-tema="oscuro"`, que es lo mismo que hace VistaCerebro adentro de la app. Queda acotado a esta figura.
//   3. SCROLL EN EL TELÉFONO. El grafo se come la rueda y el gesto para desplazarse y hacer zoom; en un teléfono eso atrapa el
//      scroll de la página adentro del recuadro. Por eso abajo de 720 px arranca quieto, con el póster y un botón: se activa
//      cuando la persona lo toca, y recién ahí toma el gesto.
// =============================================================================

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import type { Cerebro } from '@/lib/cerebro-modelo';
import datos from './cerebro-ejemplo.json';

const cerebro = datos as unknown as Cerebro<string>;

// Sin SSR: el grafo mide el contenedor y escucha la rueda; en el servidor no hay ninguna de las dos cosas.
const Grafo = dynamic(() => import('@/app/second-brain/Grafo').then((m) => m.Grafo), { ssr: false });

const POSTER = '/vsl-assets/sitio/cerebro.jpg';

// Lo que NO es el mapa ni la ficha de un punto. Mismo recorte que el banco con el que se grabó el video
// (C:/dev/bancos-portada/banco-cerebro/entrada.tsx): Martín lo pidió «sin botones ni textos de más».
const CSS = `
.s-brain { position: relative; width: 100%; height: 100%; min-height: 380px; overflow: hidden;
  background: var(--bg); color: var(--ink); color-scheme: dark; border-radius: inherit; }
.s-brain .cbg { padding: 0; grid-template-columns: minmax(0, 1fr) 0 0; gap: 0; height: 100%; }
.s-brain .cbg-barra, .s-brain .cbg-pie, .s-brain .cbg-tirador, .s-brain .cbg-nav, .s-brain .cbg-det__acciones,
.s-brain .cbg-det__cab, .s-brain .cbg-det__origen, .s-brain .cbg-det__mas, .s-brain .cbg-viajeros,
.s-brain .cbg-flecha { display: none !important; }
.s-brain .cbg-detalle.cbg-det { position: absolute; top: 24px; right: 24px; width: min(360px, 62%); height: auto;
  max-height: calc(100% - 48px); z-index: 5; box-shadow: 0 30px 70px rgba(0,0,0,.45);
  animation: s-brain-entra .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes s-brain-entra { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }
.s-brain-cartel { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: center / cover no-repeat url(${POSTER}); }
.s-brain-cartel button { border: 0; cursor: pointer; font: inherit; font-weight: 600; font-size: 14px;
  padding: 12px 20px; border-radius: 999px; background: rgba(255,255,255,.92); color: #14161B;
  box-shadow: 0 8px 28px rgba(0,0,0,.35); }
@media (prefers-reduced-motion: reduce) { .s-brain .cbg-detalle.cbg-det { animation: none; } }
`;

export function BrainVivo() {
  const caja = useRef<HTMLDivElement>(null);
  const [filtro, setFiltro] = useState<EstadoFiltro>(filtroVacio());
  const [visto, setVisto] = useState(false);
  const [angosto, setAngosto] = useState(false);
  const [activado, setActivado] = useState(false);

  // En el teléfono el mapa arranca quieto, para no atrapar el scroll de la página.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 720px)');
    const leer = () => setAngosto(mq.matches);
    leer();
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, []);

  // Carga el grafo recién cuando la fila se ve.
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisto(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) setVisto(true); }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const monta = visto && (!angosto || activado);

  return (
    <div className="s-brain" ref={caja}>
      <style>{CSS}</style>
      <div data-tema="oscuro" style={{ width: '100%', height: '100%' }}>
        {monta ? <Grafo cerebro={cerebro} filtro={filtro} onFiltro={setFiltro} movil={angosto} /> : null}
      </div>
      {monta ? null : (
        <div className="s-brain-cartel">
          {angosto ? (
            <button type="button" onClick={() => setActivado(true)}>Tocar para explorar el mapa</button>
          ) : null}
        </div>
      )}
    </div>
  );
}
