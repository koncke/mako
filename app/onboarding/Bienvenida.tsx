'use client';

// =============================================================================
// La bienvenida — lo primero que ve alguien que entra a MaKo
// =============================================================================
// Antes del wizard, una pantalla sola: el mapa del Second Brain armándose, el título,
// dos frases y un botón. Pedido textual del dueño: «una animación EPICA... con un texto
// tipo marketing abajo, como lo hace Opal... y un botón de comenzar». La idea de fondo
// es de Opal y vale la pena decirla: **se sigue vendiendo después de que el usuario ya
// compró**, porque el momento de mayor duda no es antes de pagar, es antes de trabajar.
//
// ⚠️ LA ANIMACIÓN NO ES UNA DECORACIÓN: ES EL MAPA DE VERDAD. Los cinco grupos y las once
// áreas salen de `lib/cerebro-modelo.ts`, el MISMO catálogo que arma `/second-brain`, con
// los mismos nombres y los mismos colores `--grafo-*`. Por eso se puede importar: ese
// módulo es puro a propósito (sin `server-only`) y lo dice en su propio comentario.
// Dibujar once círculos inventados habría sido más fácil y habría envejecido solo: el día
// que se agregue un área, ésta la muestra sin que nadie se acuerde.
//
// LO QUE GOBIERNA EL DISEÑO ES QUE SE ENTIENDA, no que impresione — «tiene que ser simple
// de entender la animación para que no confunda», también textual. De ahí tres decisiones
// que se ven poco y pesan mucho:
//
//   1. **Se arma en un orden, no todo junto.** Primero el centro, después las cinco ramas
//      de a una, después las áreas, y al final el polvo de datos. Un estallido simultáneo
//      es más espectacular y no cuenta nada; una secuencia lenta SE LEE.
//   2. **Solo cinco etiquetas.** Las once áreas entran como puntos de color. Con once
//      rótulos en este tamaño el texto se pisa y lo que queda es ruido, que es
//      exactamente lo contrario de lo pedido.
//   3. **El polvo de datos va último y es chiquito.** Es lo que hace que el final se lea
//      como «lleno de cosas mías» en vez de como un diagrama vacío.
//
// ⚠️ DOS ANIMACIONES QUE TOCAN `transform` EN EL MISMO ELEMENTO SE PISAN: la segunda gana
// y la primera no se ve. Ya se pagó en `/second-brain` (los nodos «no flotaban»: 0,03 px
// de recorrido medido). Por eso la entrada va en el `<g>` de afuera y la flotación en el
// de adentro, nunca las dos juntas.
// =============================================================================

import { useEffect, useState } from 'react';
import { AREAS, NIVEL1 } from '@/lib/cerebro-modelo';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── Geometría, calculada una vez y determinista ─────────────────────────────
// Sin `Math.random`: el server pinta el mismo HTML que el cliente hidrata. Un layout al
// azar acá es un mismatch de hidratación garantizado.
const CX = 460;
const CY = 300;
const R_GRUPO = 138;
const R_AREA = 246;
/** Dónde cae el rótulo de un grupo: sobre su radio, entre el centro y el nodo. */
const R_ROTULO = 92;

const rad = (g: number) => ((g - 90) * Math.PI) / 180;
const px = (r: number, g: number) => CX + r * Math.cos(rad(g));
const py = (r: number, g: number) => CY + r * Math.sin(rad(g));

type NodoDibujo = {
  id: string;
  x: number;
  y: number;
  r: number;
  color: string;
  etiqueta?: string;
  /** El ángulo, para saber de qué lado del centro cae y hacia dónde alinear el texto. */
  ang: number;
  demora: number;
};

const grupos: NodoDibujo[] = [];
const areas: NodoDibujo[] = [];
const polvo: Array<{ x: number; y: number; r: number; color: string; demora: number }> = [];
const lineas: Array<{ x1: number; y1: number; x2: number; y2: number; color: string; demora: number }> = [];

{
  const paso = 360 / NIVEL1.length;
  let iArea = 0;
  NIVEL1.forEach((g, i) => {
    const ang = i * paso;
    const suyas = AREAS.filter((a) => a.padre === g.id);
    // El grupo hereda el color de su PRIMERA área — la misma regla que usa
    // `cerebro-grafo.ts` para los nodos de nivel 1. No se inventa un color nuevo.
    const color = suyas[0]?.color ?? 'var(--grafo-norte)';
    const gx = px(R_GRUPO, ang);
    const gy = py(R_GRUPO, ang);
    const demoraG = 0.55 + i * 0.19;

    lineas.push({ x1: CX, y1: CY, x2: gx, y2: gy, color, demora: demoraG - 0.16 });
    grupos.push({ id: g.id, x: gx, y: gy, r: 13, color, etiqueta: g.nombre, ang, demora: demoraG });

    // Las áreas de un grupo se abren en abanico alrededor de SU ángulo. El abanico crece
    // con la cantidad para que un grupo de una sola área no quede pegado al de al lado.
    const abanico = Math.min(30, 13 * suyas.length);
    suyas.forEach((a, j) => {
      const off = suyas.length === 1 ? 0 : -abanico + (2 * abanico * j) / (suyas.length - 1);
      const aAng = ang + off;
      const ax = px(R_AREA, aAng);
      const ay = py(R_AREA, aAng);
      const demoraA = 1.5 + iArea * 0.085;
      lineas.push({ x1: gx, y1: gy, x2: ax, y2: ay, color: a.color, demora: demoraA - 0.1 });
      areas.push({ id: a.id, x: ax, y: ay, r: 8, color: a.color, ang: aAng, demora: demoraA });

      // El polvo: los datos concretos que cuelgan de cada área. Cantidades y posiciones
      // fijas por índice — de nuevo, nada de azar.
      for (let k = 0; k < 5; k++) {
        const dAng = aAng + (k - 2) * 5.5;
        const dR = R_AREA + 34 + ((k * 7 + iArea * 11) % 30);
        polvo.push({
          x: px(dR, dAng),
          y: py(dR, dAng),
          r: 2.4 + ((k + iArea) % 3) * 0.7,
          color: a.color,
          demora: 2.5 + (iArea * 5 + k) * 0.022,
        });
      }
      iArea++;
    });
  });
}

export function Bienvenida({ onComenzar }: { onComenzar: () => void }) {
  const [saliendo, setSaliendo] = useState(false);

  // El botón responde también con Enter: es la única acción de la pantalla, y quien viene
  // de completar un formulario de pago llega con la mano en el teclado.
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !saliendo) { setSaliendo(true); onComenzar(); }
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [onComenzar, saliendo]);

  const arrancar = () => { if (!saliendo) { setSaliendo(true); onComenzar(); } };

  return (
    <div className={`bv${saliendo ? ' bv-fuera' : ''}`}>
      <style>{ESTILOS}</style>

      <div className="bv-lienzo">
        <svg viewBox="0 0 920 600" className="bv-svg" aria-hidden>
          <defs>
            <radialGradient id="bv-halo">
              <stop offset="0%" stopColor="var(--mako)" stopOpacity="0.28" />
              <stop offset="70%" stopColor="var(--mako)" stopOpacity="0.05" />
              <stop offset="100%" stopColor="var(--mako)" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx={CX} cy={CY} r={250} fill="url(#bv-halo)" className="bv-halo" />

          {lineas.map((l, i) => (
            <line
              key={`l${i}`}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={l.color}
              className="bv-linea"
              style={{ animationDelay: `${l.demora}s` }}
            />
          ))}

          {polvo.map((d, i) => (
            <circle
              key={`d${i}`}
              cx={d.x} cy={d.y} r={d.r}
              fill={d.color}
              className="bv-polvo"
              style={{ animationDelay: `${d.demora}s` }}
            />
          ))}

          {areas.map((a) => (
            /* La entrada afuera, la flotación adentro: las dos animan `transform`. */
            <g key={a.id} className="bv-entra" style={{ animationDelay: `${a.demora}s`, transformOrigin: `${a.x}px ${a.y}px` }}>
              <g className="bv-flota" style={{ animationDelay: `${a.demora * 1.7}s`, transformOrigin: `${a.x}px ${a.y}px` }}>
                <circle cx={a.x} cy={a.y} r={a.r} fill={a.color} />
              </g>
            </g>
          ))}

          {grupos.map((g) => (
            <g key={g.id} className="bv-entra" style={{ animationDelay: `${g.demora}s`, transformOrigin: `${g.x}px ${g.y}px` }}>
              <g className="bv-flota" style={{ animationDelay: `${g.demora * 1.7}s`, transformOrigin: `${g.x}px ${g.y}px` }}>
                <circle cx={g.x} cy={g.y} r={g.r} fill={g.color} />
                {/* ⚠️ EL RÓTULO VA HACIA ADENTRO, entre el centro y su nodo, y no al costado.
                    Al costado chocaba con los puntos de área: «Mensaje» y «Mercado» salían con
                    un círculo pegado a la palabra, que es exactamente el ruido que esta
                    pantalla no puede tener. Adentro el espacio está vacío POR CONSTRUCCIÓN —
                    todo lo demás del mapa vive en radios mayores—, así que no es que hoy
                    entre: es que no puede chocar. */}
                <text
                  x={px(R_ROTULO, g.ang)}
                  y={py(R_ROTULO, g.ang) + 5}
                  textAnchor="middle"
                  className="bv-rotulo"
                >
                  {g.etiqueta}
                </text>
              </g>
            </g>
          ))}

          <g className="bv-raiz">
            <circle cx={CX} cy={CY} r={26} fill="var(--mako)" />
            <circle cx={CX} cy={CY} r={26} fill="none" stroke="var(--mako)" className="bv-pulso" />
          </g>
        </svg>
      </div>

      <div className="bv-texto">
        <span className="bv-marca">✦ SECOND BRAIN</span>
        <h1 className="bv-titulo">Bienvenido a MaKo</h1>
        <p className="bv-cuerpo">
          Todo lo que tu negocio necesita para vender ya existe. Hoy vive repartido: una parte
          en tu cabeza, otra en un Drive y otra en conversaciones que nadie vuelve a leer.
        </p>
        <p className="bv-cuerpo bv-cuerpo-2">
          En los próximos minutos MaKo lo reúne en un solo mapa. Desde ahí escribe tus anuncios,
          prioriza tu día y te propone qué responderle a cada lead.
        </p>
        <button type="button" className="bv-boton" onClick={arrancar}>Comenzar</button>
      </div>
    </div>
  );
}

// El bloque va como string sin interpolar: este archivo ya vive adentro de un template
// literal, y una comilla invertida suelta en un comentario de acá rompe el build entero.
// Pasó ocho veces en la sesión del grafo.
const ESTILOS = `
.bv {
  position: fixed; inset: 0; z-index: 60;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  background: #14161B;
  overflow: hidden;
  animation: bv-in 480ms ease both;
}
.bv-fuera { animation: bv-out 420ms ease both; pointer-events: none; }
@keyframes bv-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes bv-out { from { opacity: 1 } to { opacity: 0; transform: scale(1.03) } }

.bv-lienzo { width: min(92vw, 760px); flex: 0 1 auto; }
.bv-svg { width: 100%; height: auto; display: block; overflow: visible; }

.bv-halo { animation: bv-halo 2.2s ease both; }
@keyframes bv-halo { from { opacity: 0 } to { opacity: 1 } }

/* Se DIBUJA, no aparece: una línea que se traza dice "esto se está construyendo",
   y una que hace fade dice "esto ya estaba y no lo veías". */
.bv-linea {
  stroke-width: 1.4; opacity: 0.42;
  stroke-dasharray: 260; stroke-dashoffset: 260;
  animation: bv-traza 620ms cubic-bezier(.4,0,.2,1) both;
}
@keyframes bv-traza { to { stroke-dashoffset: 0 } }

.bv-entra { animation: bv-pop 520ms cubic-bezier(.34,1.4,.5,1) both; }
@keyframes bv-pop { from { opacity: 0; transform: scale(.2) } to { opacity: 1; transform: scale(1) } }

.bv-flota { animation: bv-flota 5.5s ease-in-out infinite; }
@keyframes bv-flota {
  0%, 100% { transform: translateY(0) }
  50%      { transform: translateY(-4px) }
}

.bv-polvo { animation: bv-polvo 700ms ease both; }
@keyframes bv-polvo { from { opacity: 0 } to { opacity: .55 } }

.bv-raiz { animation: bv-pop 700ms cubic-bezier(.34,1.4,.5,1) both; transform-origin: 460px 300px; animation-delay: .15s; }
.bv-pulso { stroke-width: 2; animation: bv-pulso 2.8s ease-out infinite; transform-origin: 460px 300px; }
@keyframes bv-pulso {
  0%   { transform: scale(1); opacity: .7 }
  100% { transform: scale(2.6); opacity: 0 }
}

.bv-rotulo {
  font-family: ${SANS}; font-size: 15px; font-weight: 600;
  fill: #F3F0E7; letter-spacing: -0.01em;
  paint-order: stroke; stroke: #14161B; stroke-width: 4px; stroke-linejoin: round;
}

.bv-texto {
  width: min(92vw, 560px); text-align: center;
  display: flex; flex-direction: column; align-items: center;
  animation: bv-texto 700ms ease both; animation-delay: 2.9s;
}
@keyframes bv-texto { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }

.bv-marca {
  font-family: ${MONO}; font-size: 11px; letter-spacing: .18em;
  color: var(--mako); margin-bottom: 14px;
}
.bv-titulo {
  font-family: ${SANS}; font-size: clamp(34px, 5.2vw, 52px); font-weight: 600;
  letter-spacing: -0.03em; line-height: 1.02; margin: 0 0 16px; color: #F8F6F0;
}
.bv-cuerpo {
  font-family: ${SANS}; font-size: 15.5px; line-height: 1.62;
  color: rgba(243,240,231,.62); margin: 0; max-width: 50ch;
}
.bv-cuerpo-2 { margin-top: 12px; color: rgba(243,240,231,.78); }

.bv-boton {
  margin-top: 30px; padding: 15px 42px; border: none; border-radius: 13px;
  background: var(--mako); color: #14161B;
  font-family: ${SANS}; font-size: 15.5px; font-weight: 700; cursor: pointer;
  transition: transform 140ms ease, box-shadow 140ms ease;
  box-shadow: 0 6px 30px rgba(232,176,30,.28);
}
.bv-boton:hover { transform: translateY(-2px); box-shadow: 0 10px 38px rgba(232,176,30,.4); }
.bv-boton:active { transform: translateY(0); }

/* Pantallas bajas: el mapa cede espacio, el texto nunca. Lo que no puede pasar es que el
   botón quede abajo del pliegue — sin él la pantalla es un callejón sin salida. */
@media (max-height: 780px) {
  .bv-lienzo { width: min(78vw, 560px); }
  .bv-texto { animation-delay: 2.4s }
}
@media (max-height: 640px) {
  .bv-lienzo { display: none }
  .bv-texto { animation-delay: .2s }
}

/* Quien pidió menos movimiento ve el resultado, no el camino: todo en su lugar y quieto.
   La pantalla tiene que decir lo mismo sin una sola transición. */
@media (prefers-reduced-motion: reduce) {
  .bv, .bv-texto, .bv-entra, .bv-raiz, .bv-halo { animation: none !important; opacity: 1 !important; transform: none !important; }
  .bv-linea { animation: none !important; stroke-dashoffset: 0 !important; }
  .bv-polvo { animation: none !important; opacity: .55 !important; }
  .bv-flota, .bv-pulso { animation: none !important; }
  .bv-boton { transition: none }
}
`;
