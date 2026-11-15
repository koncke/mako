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
//   2. TEMA: SIEMPRE NEGRO, Y EL NEGRO VA EN EL MISMO NODO QUE LOS TOKENS (15/11/2026). Martín: «lo mismo pasa con el Second
//      Brain. El Second Brain siempre debe estar negro. No importa qué, siempre debe estar negro. El Second Brain tampoco lo
//      copiaste tal cual como lo tenemos, porque no se ven los títulos, no se ven justamente, al menos no en el white mode,
//      cuando sí debería verse todo».
//      LAS DOS QUEJAS SON UNA SOLA FALLA. `data-tema="oscuro"` estaba en un div HIJO, y el `background: var(--bg)` y el
//      `color: var(--ink)` de `.s-brain` están en el PADRE. Una variable se resuelve en el elemento que la USA: la caja se
//      pintaba con los tokens claros de `:root` (--bg #efefed) mientras el grafo de adentro dibujaba sus etiquetas
//      (`.cbg-et`, con `--cbg-texto: var(--ink)`) con el --ink oscuro, #ededeb. #ededeb sobre #efefed da 1,02:1 — los
//      títulos estaban ahí, invisibles. En modo oscuro se leían por accidente, porque el sol y la luna del sitio le llevaba
//      ese #efefed a casi negro. Así lo hace la app, y así hay que copiarlo: `app/second-brain/VistaCerebro.tsx` (.sb-vista)
//      y `SuSecondBrain.tsx` ponen el atributo y el `background: var(--bg)` en el MISMO nodo. El div de adentro queda sólo
//      para darle el tamaño al grafo.
//      Y `data-tema-fijo` para que el sol y la luna (app/vsl/_competencia/TemaSitio.tsx) no entre nunca: su `fuera()`
//      descarta con `closest()`, que mira el elemento Y sus ancestros, así que marcando `.s-brain` queda afuera la figura
//      entera, grafo incluido. Hace falta: la foto que saca el script (`leer()`, sobre `body, body *`) se toma al cargar la
//      página y queda cacheada, así que nunca vio los nodos del grafo —entra con `next/dynamic` mucho después— pero sí vio
//      `.s-brain`, que viene del servidor; en modo claro le llevaba el negro a casi blanco. Las dos marcas se necesitan: con
//      los tokens oscuros y sin `data-tema-fijo`, la caja volvía a aclararse; con la marca y sin los tokens, se quedaba con
//      el #efefed claro en los DOS modos.
//   3. SCROLL EN EL TELÉFONO. El grafo se come la rueda y el gesto para desplazarse y hacer zoom; en un teléfono eso atrapa el
//      scroll de la página adentro del recuadro. Por eso abajo de 720 px arranca quieto, con el póster y un botón: se activa
//      cuando la persona lo toca, y recién ahí toma el gesto.
//   4. EL ALTO MÍNIMO NO PUEDE SER MÁS QUE LA FILA (15/11/2026). Misma queja de Martín que el punto 2 —«no se ven los
//      títulos»— pero por la otra causa, y en el teléfono: el color ya está arreglado y los títulos de abajo SIGUEN sin
//      verse, porque están dibujados afuera del recuadro.
//      MEDIDO en el navegador a 375 px: la fila (`.s-zz-vis`, app/vsl/_sitio/estilos.ts) es `aspect-ratio:16/10` con
//      `overflow:hidden`, y con `.s-cont{padding:0 20px}` el contenido mide 335,2 px → la fila queda de 210,1 px de alto.
//      Un `min-height:380px` le gana al `height:100%`, así que `.s-brain` se plantaba en 380 px: 169,9 px (el 44,7 %) del
//      mapa quedaban recortados, y de seis títulos de prueba repartidos a lo alto sólo entraban tres. En los DOS modos, así
//      que el negro no lo tapa.
//      `min(380px, 100%)` es el piso que NO puede pasarse de la fila: a 1440 px la fila da 400,5 px y la figura sigue en
//      398,9 px, idéntico que antes (medido); a 375 px baja a 208,5 px y el grafo se reencuadra solo —`ajustar()` mide la
//      caja real— con todo adentro. El texto no se achica con la caja: `font-size: calc(13.5px * var(--u) / var(--k))` y
//      `--u` es `1/porPixel`, que cancela la escala del viewBox, así que la etiqueta se dibuja a 13,5 px siempre.
//      Lo que NO se toca acá: que la fila sea tan baja en el teléfono es del `aspect-ratio` de `.s-zz-vis`, y ese archivo
//      lo está editando otro. Si se quiere el mapa más alto en el teléfono, se cambia ahí.
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
/* El piso de alto no puede pasarse de la fila, o el mapa se dibuja afuera del recorte (ver el cuidado 4). */
.s-brain { position: relative; width: 100%; height: 100%; min-height: min(380px, 100%); overflow: hidden;
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
    // `data-tema="oscuro"` acá y no en el hijo: es este nodo el que usa `var(--bg)` y `var(--ink)` (ver el cuidado 2).
    // `data-tema-fijo` deja la figura afuera del sol y la luna del sitio, para que sea negra en los dos modos.
    <div className="s-brain" data-tema="oscuro" data-tema-fijo="" ref={caja}>
      <style>{CSS}</style>
      <div style={{ width: '100%', height: '100%' }}>
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
