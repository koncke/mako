'use client';

// =============================================================================
// La bienvenida — lo primero que ve alguien que entra a MaKo
// =============================================================================
// Tres capas, en este orden y no en otro:
//
//   1. UNA INTRO que va sola, sin texto y sin botón: un ojo humano, el zoom entrando
//      por la pupila, las fibras que se vuelven neuronas, y un flash.
//   2. EL GRAFO DE VERDAD — `app/second-brain/Grafo.tsx`, el mismo de /second-brain,
//      con el cerebro REAL de ese cliente. Interactivo desde el primer segundo.
//   3. RECIÉN AHÍ el texto y el botón.
//
// ⚠️ EL GRAFO NO SE IMITA: SE MONTA. La primera versión de esta pantalla dibujaba una
// constelación propia con las áreas del catálogo, y el dueño la corrigió de una:
// «no es necesario que inventes una animación si el grafo que ya hicimos actúa como
// animación, es interactivo y se ve más impresionante». Tenía razón, y hay un dato que
// lo cierra: medido contra un workspace RECIÉN RESETEADO —cero datos cargados— el grafo
// real trae **50 nodos y 25 etiquetas**, porque el funnel viene sembrado y las áreas
// vacías existen como huecos con nombre. O sea que el cliente nuevo no ve un lienzo
// pelado: ve el mapa de todo lo que MaKo va a saber de él, con los huecos marcados.
//
// LA FORMA DEL TEXTO ES LA DE OPAL, también por pedido: un título, UNA frase corta, y un
// botón grande de ancho completo abajo. La versión anterior tenía dos párrafos y un botón
// chico en el medio — «hoy en día es mucho texto y el botón chiquito en el medio».
//
// SOBRE EL VIDEO: el dueño quiere un clip real (ojo macro → cerebro → flash). Mientras no
// haya uno con licencia verificada para uso comercial, la intro va dibujada en código:
// no pesa, no tiene licencia que revisar, y se reemplaza pasando `videoIntro`. La costura
// está hecha para eso — ver `IntroOjo`.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Grafo } from '@/app/second-brain/Grafo';
import { filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import type { Cerebro } from '@/lib/cerebro-modelo';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

/** Cuánto dura la intro dibujada. Si entra un video, manda el `onEnded` del video. */
const MS_INTRO = 3600;

export function Bienvenida({ cerebro, videoIntro, onComenzar }: {
  cerebro: Cerebro;
  /** Un clip propio para la intro. Sin esto va la versión dibujada. */
  videoIntro?: string;
  onComenzar: () => void;
}) {
  const [fase, setFase] = useState<'intro' | 'listo'>('intro');
  const [saliendo, setSaliendo] = useState(false);
  // El grafo exige un filtro con dueño. Acá nunca se filtra nada, pero el estado tiene
  // que existir igual: pasarle un objeto nuevo en cada render le haría recalcular todo.
  const [filtro, setFiltro] = useState<EstadoFiltro>(filtroVacio);

  const terminarIntro = useCallback(() => setFase((f) => (f === 'intro' ? 'listo' : f)), []);

  const arrancar = useCallback(() => {
    setSaliendo((s) => {
      if (!s) onComenzar();
      return true;
    });
  }, [onComenzar]);

  // Enter arranca; durante la intro, cualquier tecla la saltea. Nadie tiene que mirar
  // una animación dos veces, y el que ya la vio la va a querer saltar.
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (fase === 'intro') { terminarIntro(); return; }
      if (e.key === 'Enter' || e.key === ' ') arrancar();
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [fase, terminarIntro, arrancar]);

  return (
    <div className={`bv${saliendo ? ' bv-fuera' : ''}`}>
      <style>{ESTILOS}</style>

      {/* EL MAPA DE VERDAD, de fondo y vivo. Se puede arrastrar y hacerle zoom mientras
          se lee el texto: el primer contacto con MaKo es algo que responde, no una
          animación que se mira. */}
      <div className="bv-mapa" aria-hidden={fase === 'intro'}>
        <Grafo cerebro={cerebro} filtro={filtro} onFiltro={setFiltro} />
      </div>

      {/* El velo de abajo existe para que el texto se lea sobre el mapa sin apagarlo. */}
      <div className={`bv-velo${fase === 'listo' ? ' bv-velo-on' : ''}`} />

      {fase === 'intro' && <IntroCerebro src={videoIntro} onFin={terminarIntro} />}

      <div className={`bv-pie${fase === 'listo' ? ' bv-pie-on' : ''}`}>
        <h1 className="bv-titulo">Bienvenido a MaKo</h1>
        <p className="bv-frase">
          Todo tu negocio en un solo mapa. Desde aquí MaKo escribe tus anuncios y te dice
          qué hacer cada día.
        </p>
        <button type="button" className="bv-boton" onClick={arrancar} disabled={fase !== 'listo'}>
          Comenzar
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// IntroCerebro — la zambullida por la red neuronal
// =============================================================================
// ⚠️ ACÁ FALTA EL OJO, Y ESTÁ DICHO A PROPÓSITO. Lo que el dueño pidió es un clip real:
// macro de un ojo humano → zoom entrando → redes neuronales → flash → el grafo. La parte
// del OJO **no se puede fingir en SVG**: se intentó, y el resultado era un diente de león,
// no un ojo (iris sin borde, párpado roto, cero textura). Un ojo malo es peor que ningún
// ojo, porque promete realismo y no lo cumple.
//
// Así que esto hace la MITAD que sí funciona dibujada —la red neuronal, el zoom y el
// flash— y deja la costura hecha para el clip: `videoIntro` reemplaza todo esto sin tocar
// nada más. El video necesita una licencia verificada para uso comercial y esa
// verificación es una decisión del dueño, no algo que se resuelve bajando un archivo.
// Si le pasan un `src`, reproduce ESE clip y avisa al terminar. Si no, dibuja la versión
// propia. La costura es a propósito: el video que quiere el dueño necesita una licencia
// verificada para uso comercial, y hasta tenerla esta pantalla tiene que existir igual.
//
// Y las fibras llevan los colores `--grafo-*`, así que lo que se atraviesa no es un
// adorno genérico: es el material del que está hecho el mapa que aparece después.
// =============================================================================
function IntroCerebro({ src, onFin }: { src?: string; onFin: () => void }) {
  const fin = useRef(onFin);
  fin.current = onFin;

  useEffect(() => {
    // Con video manda su `onEnded`; el temporizador es solo la red por si no carga.
    const ms = src ? 9000 : MS_INTRO;
    const t = setTimeout(() => fin.current(), ms);
    return () => clearTimeout(t);
  }, [src]);

  // Quien pidió menos movimiento no ve la intro. No es una versión recortada: es que una
  // secuencia de zoom a pantalla completa es exactamente lo que esa preferencia evita.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) fin.current();
  }, []);

  if (src) {
    return (
      <div className="bv-intro" onClick={() => fin.current()}>
        <video className="bv-video" src={src} autoPlay muted playsInline onEnded={() => fin.current()} />
        <div className="bv-flash" />
      </div>
    );
  }

  // 96 fibras: suficientes para que el iris se lea lleno y pocas para que, ampliadas, se
  // distingan una de otra. Deterministas por índice — nada de Math.random, que rompería
  // la hidratación.
  const fibras = Array.from({ length: 96 }, (_, i) => {
    const a = (i * 360) / 96;
    const r = ((i * 37) % 100) / 100;
    return {
      a,
      largo: 96 + r * 96,
      ancho: 0.9 + ((i * 13) % 7) * 0.22,
      tono: ['var(--grafo-norte)', 'var(--grafo-documentos)', 'var(--grafo-cliente)', 'var(--grafo-panorama)'][i % 4],
      op: 0.28 + r * 0.5,
    };
  });

  return (
    <div className="bv-intro" onClick={() => fin.current()}>
      <svg viewBox="-300 -300 600 600" className="bv-ojo" aria-hidden>
        <defs>
          {/* Un halo que se apaga hacia afuera: sin borde duro, el campo no termina en
              ningún lado y por eso se lee como profundidad y no como un disco. */}
          <radialGradient id="bv-iris">
            <stop offset="0%" stopColor="#05070B" />
            <stop offset="30%" stopColor="#0B1120" stopOpacity="0.9" />
            <stop offset="62%" stopColor="#243354" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#05070B" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* El grupo entero es el que hace el zoom: entrar por la pupila es escalar esto. */}
        <g className="bv-zoom">
          <circle r="240" fill="url(#bv-iris)" />
          {fibras.map((f, i) => (
            <line
              key={i}
              x1={0} y1={-70} x2={0} y2={-f.largo}
              stroke={f.tono}
              strokeWidth={f.ancho}
              strokeLinecap="round"
              opacity={f.op}
              transform={`rotate(${f.a})`}
              className="bv-fibra"
              style={{ animationDelay: `${(i % 12) * 0.06}s` }}
            />
          ))}
          {/* El núcleo oscuro: es por donde se entra. Al escalar, se come la pantalla —
              eso es lo que hace que el movimiento se lea como ATRAVESAR y no como crecer. */}
          <circle className="bv-pupila" r="66" fill="#05070B" />
          <circle r="66" fill="none" stroke="var(--mako)" strokeWidth="1.2" opacity=".5" className="bv-anillo" />
        </g>

      </svg>
      <div className="bv-flash" />
    </div>
  );
}

// El bloque va como string sin interpolar comillas invertidas adentro: este archivo ya
// vive dentro de un template literal y una comilla suelta rompe el build entero.
const ESTILOS = `
.bv {
  position: fixed; inset: 0; z-index: 60;
  background: #14161B; overflow: hidden;
  animation: bv-in 420ms ease both;
}
.bv-fuera { animation: bv-out 420ms ease both; pointer-events: none; }
@keyframes bv-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes bv-out { from { opacity: 1 } to { opacity: 0 } }

/* El mapa ocupa todo y respira arriba: el texto vive abajo, así que el centro del grafo
   se corre hacia arriba para que no queden tapados los nodos que importan. */
.bv-mapa { position: absolute; inset: 0 0 26% 0; }
.bv-mapa > * { height: 100% }

/* ⚠️ EL GRAFO VIENE CON SU CHROME PUESTO y acá no va nada de eso: el filtro, los
   controles de zoom, el tirador y el navegador lateral («Toca un punto del mapa para
   verlo») son la interfaz de /second-brain, no la de una bienvenida. Con todo eso
   encendido la pantalla se lee como una tab del producto y no como su portada.

   Se apaga desde acá y no con una prop nueva en Grafo.tsx a propósito: ese archivo tiene
   1954 líneas y un solo consumidor más; meterle una rama por esta pantalla es agrandarlo
   para siempre por un caso. Lo que sí queda es la RED: la única forma de que esto se
   rompa es que alguien renombre una de estas clases, y tests/bienvenida.test.ts falla si
   eso pasa. Sin ese test, un renombre haría reaparecer el chrome en silencio.

   (Y sí: la versión anterior de este comentario tenía comillas invertidas adentro, o sea
   la trampa que la cabecera de este mismo archivo advierte. Rompió el build entero. El
   typecheck la habría cazado en siete segundos y no lo corrí — corrí el test.) */
.bv-mapa .cbg { --cbg-col: 0px !important; }
.bv-mapa .cbg-barra,
.bv-mapa .cbg-tirador,
.bv-mapa .cbg-detalle { display: none !important; }

.bv-velo {
  position: absolute; inset: auto 0 0 0; height: 62%;
  background: linear-gradient(to bottom, rgba(20,22,27,0) 0%, rgba(20,22,27,.86) 46%, #14161B 76%);
  opacity: 0; transition: opacity 900ms ease; pointer-events: none;
}
.bv-velo-on { opacity: 1 }

/* ── La intro ────────────────────────────────────────────────────────────── */
.bv-intro {
  position: absolute; inset: 0; z-index: 3; background: #000;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  animation: bv-intro-fuera 480ms ease both;
  animation-delay: 3120ms;
}
@keyframes bv-intro-fuera { to { opacity: 0; visibility: hidden } }

.bv-video { width: 100%; height: 100%; object-fit: cover; }

.bv-ojo {
  width: min(150vh, 150vw); height: min(150vh, 150vw);
  animation: bv-ojo-ent 700ms ease both;
}
@keyframes bv-ojo-ent { from { opacity: 0 } to { opacity: 1 } }

/* El zoom: entra por la pupila. La escala es grande a propósito — a 26x las fibras del
   iris ya no se leen como iris, se leen como una red. Es la misma primitiva. */
.bv-zoom {
  animation: bv-zoom 2600ms cubic-bezier(.55,0,.85,.35) both;
  animation-delay: 620ms;
}
@keyframes bv-zoom {
  0%   { transform: scale(1) }
  36%  { transform: scale(1.5) }
  100% { transform: scale(26) }
}

.bv-pupila { animation: bv-pupila 2600ms cubic-bezier(.5,0,.9,.4) both; animation-delay: 620ms; }
@keyframes bv-pupila {
  0%   { r: 66; opacity: 1 }
  55%  { r: 74; opacity: .92 }
  100% { r: 92; opacity: 0 }
}

/* Las fibras laten antes del zoom: es lo que hace que el iris se vea VIVO y no impreso. */
.bv-fibra { animation: bv-fibra 1600ms ease-in-out infinite alternate; }
@keyframes bv-fibra { from { opacity: .2 } to { opacity: .85 } }


.bv-anillo { animation: bv-anillo 2600ms ease both; animation-delay: 620ms; }
@keyframes bv-anillo { to { opacity: 0 } }

.bv-flash {
  position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none;
  animation: bv-flash 620ms ease both; animation-delay: 2760ms;
}
@keyframes bv-flash {
  0%   { opacity: 0 }
  22%  { opacity: 1 }
  100% { opacity: 0 }
}

/* ── El pie, con la forma de Opal ────────────────────────────────────────── */
.bv-pie {
  position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
  width: min(92vw, 520px); padding: 0 0 42px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  z-index: 4;
  opacity: 0; transform: translate(-50%, 22px);
  transition: opacity 760ms ease 260ms, transform 760ms cubic-bezier(.2,.7,.3,1) 260ms;
  pointer-events: none;
}
.bv-pie-on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }

.bv-titulo {
  font-family: ${SANS}; font-size: clamp(30px, 4.4vw, 42px); font-weight: 600;
  letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 12px; color: #F8F6F0;
}
.bv-frase {
  font-family: ${SANS}; font-size: 16px; line-height: 1.55;
  color: rgba(243,240,231,.66); margin: 0 0 30px; max-width: 40ch;
}

/* Ancho completo y grande, como el de Opal. Un botón chico en el medio de una pantalla
   entera se lee como un detalle, y esto es LA acción de la pantalla. */
.bv-boton {
  width: 100%; padding: 18px 24px; border: none; border-radius: 999px;
  background: var(--mako); color: #14161B;
  font-family: ${SANS}; font-size: 16.5px; font-weight: 700; cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
  box-shadow: 0 8px 34px rgba(232,176,30,.3);
}
.bv-boton:hover { transform: translateY(-2px); box-shadow: 0 12px 42px rgba(232,176,30,.42); }
.bv-boton:active { transform: translateY(0); }
.bv-boton:disabled { opacity: 0; pointer-events: none; }

/* Pantallas bajas: el mapa cede, el pie nunca. Un botón abajo del pliegue en la primera
   pantalla del producto es un callejón sin salida. */
@media (max-height: 720px) {
  .bv-mapa { inset: 0 0 34% 0 }
  .bv-titulo { font-size: 27px }
  .bv-frase { font-size: 14.5px; margin-bottom: 20px }
  .bv-pie { padding-bottom: 26px }
}

@media (prefers-reduced-motion: reduce) {
  .bv, .bv-pie { animation: none !important; transition: none !important; opacity: 1 !important; transform: translateX(-50%) !important; }
  .bv-velo { opacity: 1 !important; transition: none !important; }
  .bv-boton { transition: none }
}
`;
