'use client';

// =============================================================================
// La bienvenida — el cerebro se arma con las manos del usuario
// =============================================================================
// Cuatro tiempos, y los tres primeros los dispara EL USUARIO con un click:
//
//   0. UN nodo solo, centrado, gigante: «Tus anuncios». Nada más en pantalla.
//      Si pasan unos segundos sin tocar, aparece una pista discreta.
//   1. (click) Salen las cinco piezas de las que sale un anuncio: tu oferta, tu
//      avatar, tu funnel, tu mensaje, tu negocio.
//   2. (click) Cada pieza se abre en las once áreas reales del Second Brain.
//   3. (click) Aparece TODO — el cerebro entero.
//   4. El mapa sube y recién ahí entran los textos.
//
// ⚠️ POR QUÉ NO SE MONTA `Grafo.tsx` ACÁ, aunque sea el mapa de verdad y aunque la
// versión anterior lo hiciera. Tres cosas que el componente real no puede dar y que son
// EL pedido:
//   · No sabe arrancar en UN nodo centrado. Su encuadre es «todo lo que hay».
//   · Los rótulos de los dos primeros niveles son narrativos y en segunda persona
//     —«Tus anuncios», «Tu Oferta»—, no los del catálogo («El funnel», «La oferta»).
//   · El revelado por niveles no existe en su filtro, que corta por área y por autoría.
// Así que esto es una pieza propia. Lo que SÍ sale del catálogo real
// (`lib/cerebro-modelo.ts`) es el nivel 2: las once áreas, con sus nombres y sus colores
// `--grafo-*`. El día que se agregue un área, esta pantalla la muestra sola.
//
// LA IDEA, que es lo que la hace funcionar: **el cerebro no se muestra, se construye, y
// lo construye el que mira**. Un mapa completo de entrada es un diagrama que hay que
// estudiar; el mismo mapa apareciendo bajo tu dedo es una demostración. Por eso el orden
// arranca en «Tus anuncios» y no en «Tu negocio»: se empieza por lo que el cliente
// quiere y se va hacia atrás mostrando de qué está hecho.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { AREAS } from '@/lib/cerebro-modelo';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Cuánto se espera antes de sugerir el click. Suficiente para leer el nodo y dudar. */
const MS_PISTA = 3200;
/** Lo que tarda el último nivel en terminar de aparecer, antes de subir el mapa. */
const MS_CIERRE = 1900;

const CX = 500;
const CY = 340;

const rad = (g: number) => ((g - 90) * Math.PI) / 180;
const px = (r: number, g: number) => CX + r * Math.cos(rad(g));
const py = (r: number, g: number) => CY + r * Math.sin(rad(g));

/**
 * Las cinco piezas de un anuncio, en segunda persona. Son las mismas cinco carpetas del
 * Second Brain (`NIVEL1`), dichas como se las diría el cliente: acá manda que se entienda
 * antes que el nombre interno.
 */
const PIEZAS = [
  { id: 'oferta', et: 'Tu Oferta', color: 'var(--grafo-oferta)', padre: 'oferta' },
  { id: 'avatar', et: 'Tu Avatar', color: 'var(--grafo-cliente)', padre: 'mercado' },
  { id: 'mensaje', et: 'Tu Mensaje', color: 'var(--grafo-razones)', padre: 'mensaje' },
  { id: 'funnel', et: 'Tu Funnel', color: 'var(--grafo-funnel)', padre: 'funnel' },
  { id: 'negocio', et: 'Tu Negocio', color: 'var(--grafo-norte)', padre: 'negocio' },
] as const;

type Nodo = {
  id: string; x: number; y: number; r: number; color: string;
  et?: string; nivel: 1 | 2 | 3; demora: number;
  /** de dónde cuelga, para dibujar la línea */
  de?: { x: number; y: number };
};

// ── La geometría, calculada una vez y sin azar ──────────────────────────────
// `Math.random` acá sería un mismatch de hidratación garantizado: el server pinta un
// layout y el cliente otro.
const nodos: Nodo[] = [];
{
  const paso = 360 / PIEZAS.length;
  PIEZAS.forEach((p, i) => {
    const ang = i * paso;
    const x = px(150, ang);
    const y = py(150, ang);
    nodos.push({ id: p.id, x, y, r: 15, color: p.color, et: p.et, nivel: 1, demora: i * 0.11, de: { x: CX, y: CY } });

    const suyas = AREAS.filter((a) => a.padre === p.padre);
    const abanico = Math.min(34, 15 * suyas.length);
    suyas.forEach((a, j) => {
      const off = suyas.length === 1 ? 0 : -abanico + (2 * abanico * j) / (suyas.length - 1);
      const aAng = ang + off;
      const ax = px(268, aAng);
      const ay = py(268, aAng);
      nodos.push({ id: a.id, x: ax, y: ay, r: 9, color: a.color, et: a.nombre, nivel: 2, demora: nodos.filter((n) => n.nivel === 2).length * 0.07, de: { x, y } });

      // El nivel 3 es el polvo: los datos concretos que cuelgan de cada área. Es lo que
      // hace que el final se lea como «lleno de cosas mías» y no como un diagrama.
      for (let k = 0; k < 6; k++) {
        const dAng = aAng + (k - 2.5) * 4.6;
        const dR = 268 + 46 + ((k * 11 + j * 17) % 44);
        nodos.push({
          id: `${a.id}-${k}`, x: px(dR, dAng), y: py(dR, dAng),
          r: 3.2 + ((k + j) % 3) * 0.8, color: a.color, nivel: 3,
          demora: nodos.filter((n) => n.nivel === 3).length * 0.012,
          de: { x: ax, y: ay },
        });
      }
    });
  });
}

export function Bienvenida({ onComenzar }: { onComenzar: () => void }) {
  const [paso, setPaso] = useState(0);
  const [pista, setPista] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  const conTexto = paso >= 4;

  // La pista aparece SOLO en el primer nivel: después el usuario ya entendió que se
  // toca, y repetírselo tres veces sería tratarlo de tonto.
  useEffect(() => {
    if (paso !== 0) { setPista(false); return; }
    const t = setTimeout(() => setPista(true), MS_PISTA);
    return () => clearTimeout(t);
  }, [paso]);

  // El último nivel no espera otro click: cuando termina de aparecer, el mapa sube solo
  // y entra el texto. Pedir un cuarto click ahí sería pedirlo para nada.
  useEffect(() => {
    if (paso !== 3) return;
    const t = setTimeout(() => setPaso(4), MS_CIERRE);
    return () => clearTimeout(t);
  }, [paso]);

  // Quien pidió menos movimiento entra al RESULTADO, no al camino: el cerebro entero y
  // el texto puesto. Sin esto el CSS le mostraba todo pero el botón quedaba deshabilitado
  // —porque el estado seguía en el paso 0— y la pantalla era un callejón sin salida.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaso(4);
  }, []);

  const avanzar = useCallback(() => setPaso((p) => (p < 3 ? p + 1 : p)), []);

  const arrancar = useCallback(() => {
    setSaliendo((s) => { if (!s) onComenzar(); return true; });
  }, [onComenzar]);

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (!conTexto) { avanzar(); return; }
      if (e.key === 'Enter' || e.key === ' ') arrancar();
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [conTexto, avanzar, arrancar]);

  return (
    <div
      className={`bv bv-p${paso}${saliendo ? ' bv-fuera' : ''}`}
      onClick={() => { if (!conTexto) avanzar(); }}
    >
      <style>{ESTILOS}</style>

      <div className="bv-velo" />

      <div className="bv-mapa">
        <svg viewBox="0 0 1000 680" className="bv-svg" aria-hidden>
          {nodos.map((n) => (
            n.de ? (
              <line
                key={`l-${n.id}`}
                x1={n.de.x} y1={n.de.y} x2={n.x} y2={n.y}
                stroke={n.color}
                className={`bv-linea bv-n${n.nivel}`}
                style={{ animationDelay: `${n.demora}s` }}
              />
            ) : null
          ))}

          {nodos.map((n) => (
            <g key={n.id} className={`bv-nodo bv-n${n.nivel}`} style={{ animationDelay: `${n.demora}s`, transformOrigin: `${n.x}px ${n.y}px` }}>
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} />
              {n.et && (
                <text x={n.x} y={n.y + n.r + 19} textAnchor="middle" className={`bv-et bv-et${n.nivel}`}>
                  {n.et}
                </text>
              )}
            </g>
          ))}

          {/* El centro. Es el único que existe desde el primer instante, y arranca
              GRANDE y solo: es lo que el cliente vino a buscar. */}
          <g className="bv-centro">
            <circle cx={CX} cy={CY} r={30} fill="var(--mako)" />
            <circle cx={CX} cy={CY} r={30} fill="none" stroke="var(--mako)" className="bv-pulso" />
            <text x={CX} y={CY + 62} textAnchor="middle" className="bv-et bv-et0">Tus anuncios</text>
          </g>
        </svg>
      </div>

      {/* La pista. Va abajo, chica y en mono: tiene que ayudar sin robarle la pantalla
          al nodo, que es lo único que hay para mirar. */}
      <div className={`bv-pista${pista && paso === 0 ? ' bv-pista-on' : ''}`} aria-live="polite">
        Toca en cualquier lugar
      </div>

      <div className="bv-pie">
        <h1 className="bv-titulo">Bienvenido a MaKo</h1>
        <p className="bv-frase">
          Desde hoy MaKo será tu Segundo Cerebro™.
        </p>
        <p className="bv-golpe">
          Nunca más tendrás que explicar tu negocio desde cero.
        </p>
        <button type="button" className="bv-boton" onClick={(e) => { e.stopPropagation(); arrancar(); }} disabled={!conTexto}>
          Comenzar
        </button>
      </div>
    </div>
  );
}

// Sin comillas invertidas adentro: el CSS vive en un template literal y una comilla en un
// comentario cierra el string y rompe el build entero. Lo cuida tests/bienvenida.test.ts.
const ESTILOS = `
.bv {
  position: fixed; inset: 0; z-index: 60;
  background: #14161B; overflow: hidden; cursor: pointer;
  animation: bv-in 420ms ease both;
}
.bv-fuera { animation: bv-out 420ms ease both; pointer-events: none; }
@keyframes bv-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes bv-out { from { opacity: 1 } to { opacity: 0 } }

/* ── El mapa ─────────────────────────────────────────────────────────────── */
/* Sube cuando entra el texto, y NO antes: mientras el usuario está armando el cerebro,
   el cerebro es el centro de la pantalla. */
.bv-mapa {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  transition: transform 900ms cubic-bezier(.2,.7,.3,1);
}
.bv-p4 .bv-mapa { transform: translateY(-21%) scale(.82); }

/* El velo. Sin esto el título aterriza ENCIMA de los nodos de abajo: medido, «Bienvenido
   a MaKo» caía justo sobre «Voz y cara». Subir el mapa solo no alcanza — abajo siempre
   queda algo, porque el cerebro es redondo. */
.bv-velo {
  position: absolute; inset: auto 0 0 0; height: 46%;
  background: linear-gradient(to bottom, rgba(20,22,27,0) 0%, rgba(20,22,27,.9) 42%, #14161B 72%);
  opacity: 0; transition: opacity 800ms ease; pointer-events: none; z-index: 2;
}
.bv-p4 .bv-velo { opacity: 1 }

.bv-svg { width: min(94vw, 1000px); height: auto; overflow: visible; }

/* Todo lo que no es el centro nace apagado y aparece cuando su nivel llega. */
.bv-nodo, .bv-linea { opacity: 0; }

.bv-p1 .bv-n1, .bv-p2 .bv-n1, .bv-p3 .bv-n1, .bv-p4 .bv-n1,
.bv-p2 .bv-n2, .bv-p3 .bv-n2, .bv-p4 .bv-n2,
.bv-p3 .bv-n3, .bv-p4 .bv-n3 { animation-fill-mode: both; }

.bv-p1 .bv-nodo.bv-n1, .bv-p2 .bv-nodo.bv-n1, .bv-p3 .bv-nodo.bv-n1, .bv-p4 .bv-nodo.bv-n1,
.bv-p2 .bv-nodo.bv-n2, .bv-p3 .bv-nodo.bv-n2, .bv-p4 .bv-nodo.bv-n2,
.bv-p3 .bv-nodo.bv-n3, .bv-p4 .bv-nodo.bv-n3 { animation: bv-pop 520ms cubic-bezier(.34,1.4,.5,1) both; }

.bv-p1 .bv-linea.bv-n1, .bv-p2 .bv-linea.bv-n1, .bv-p3 .bv-linea.bv-n1, .bv-p4 .bv-linea.bv-n1,
.bv-p2 .bv-linea.bv-n2, .bv-p3 .bv-linea.bv-n2, .bv-p4 .bv-linea.bv-n2,
.bv-p3 .bv-linea.bv-n3, .bv-p4 .bv-linea.bv-n3 { animation: bv-traza 560ms cubic-bezier(.4,0,.2,1) both; }

@keyframes bv-pop { from { opacity: 0; transform: scale(.15) } to { opacity: 1; transform: scale(1) } }

/* Las líneas se DIBUJAN, no aparecen: una línea que se traza dice «esto se está
   construyendo»; una que hace fade dice «esto ya estaba y no lo veías». */
.bv-linea {
  stroke-width: 1.4;
  stroke-dasharray: 420; stroke-dashoffset: 420;
}
@keyframes bv-traza { to { opacity: .38; stroke-dashoffset: 0 } }

.bv-centro { animation: bv-centro 900ms cubic-bezier(.34,1.3,.5,1) both; }
@keyframes bv-centro { from { opacity: 0; transform: scale(.4) } to { opacity: 1; transform: none } }
.bv-pulso { stroke-width: 2; transform-origin: 500px 340px; animation: bv-pulso 3s ease-out infinite; }
@keyframes bv-pulso {
  0%   { transform: scale(1); opacity: .65 }
  100% { transform: scale(2.4); opacity: 0 }
}

.bv-et {
  font-family: ${SANS}; fill: #F3F0E7; text-anchor: middle;
  paint-order: stroke; stroke: #14161B; stroke-width: 4px; stroke-linejoin: round;
}
.bv-et0 { font-size: 27px; font-weight: 600; letter-spacing: -0.02em }
.bv-et1 { font-size: 16px; font-weight: 600 }
.bv-et2 { font-size: 12px; font-weight: 500; fill: rgba(243,240,231,.72) }

/* ── La pista ────────────────────────────────────────────────────────────── */
.bv-pista {
  position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%);
  font-family: ${MONO}; font-size: 12px; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(243,240,231,.34);
  opacity: 0; transition: opacity 900ms ease; pointer-events: none;
}
.bv-pista-on { opacity: 1; animation: bv-respira 2.6s ease-in-out 900ms infinite; }
@keyframes bv-respira { 0%,100% { opacity: .34 } 50% { opacity: .7 } }

/* ── El pie ──────────────────────────────────────────────────────────────── */
.bv-pie {
  position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
  width: min(92vw, 540px); padding: 0 0 44px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  z-index: 4; cursor: default;
}
.bv-titulo, .bv-frase, .bv-golpe, .bv-boton { opacity: 0; }
.bv-p4 .bv-titulo { animation: bv-sube 640ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 260ms }
.bv-p4 .bv-frase  { animation: bv-sube 640ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 480ms }
.bv-p4 .bv-golpe  { animation: bv-sube 640ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 760ms }
.bv-p4 .bv-boton  { animation: bv-sube 640ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 1020ms }
@keyframes bv-sube { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }

.bv-titulo {
  font-family: ${SANS}; font-size: clamp(30px, 4.4vw, 42px); font-weight: 600;
  letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 14px; color: #F8F6F0;
}
.bv-frase {
  font-family: ${SANS}; font-size: 17px; line-height: 1.5; font-weight: 500;
  color: #F3F0E7; margin: 0 0 6px;
}
.bv-golpe {
  font-family: ${SANS}; font-size: 15.5px; line-height: 1.5;
  color: rgba(243,240,231,.6); margin: 0 0 30px; max-width: 38ch;
}
.bv-boton {
  width: 100%; padding: 18px 24px; border: none; border-radius: 999px;
  background: var(--mako); color: #14161B;
  font-family: ${SANS}; font-size: 16.5px; font-weight: 700; cursor: pointer;
  box-shadow: 0 8px 34px rgba(232,176,30,.3);
  transition: box-shadow 150ms ease;
}
.bv-p4 .bv-boton:hover { box-shadow: 0 12px 42px rgba(232,176,30,.45); }
.bv-boton:disabled { pointer-events: none; }

@media (max-height: 760px) {
  .bv-svg { width: min(78vw, 800px) }
  .bv-titulo { font-size: 27px }
  .bv-pie { padding-bottom: 26px }
  .bv-p4 .bv-mapa { transform: translateY(-24%) scale(.76) }
}

/* Quien pidió menos movimiento ve el resultado, no el camino: el cerebro entero, quieto,
   con su texto. La pantalla tiene que decir lo mismo sin una sola transición. */
@media (prefers-reduced-motion: reduce) {
  .bv-nodo, .bv-linea, .bv-centro, .bv-titulo, .bv-frase, .bv-golpe, .bv-boton {
    animation: none !important; opacity: 1 !important; transform: none !important;
  }
  .bv-linea { stroke-dashoffset: 0 !important; opacity: .38 !important; }
  .bv-mapa { transition: none !important; }
  .bv-pulso { animation: none !important; opacity: 0 !important; }
}
`;
