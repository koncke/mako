'use client';

// =============================================================================
// La bienvenida — lo primero que ve alguien que entra a MaKo
// =============================================================================
// Cuatro tiempos, y cada uno espera al anterior:
//
//   1. EL VIDEO SOLO, sin una sola cosa encima: un ojo macro, la cámara ENTRA por la
//      pupila, y a 1,45 s corta a una neurona con sus pulsos. Todo eso es del clip —
//      filmado, no programado.
//   2. UN FUNDIDO sutil sobre el final.
//   3. EL GRAFO REAL, que entra MUY CERCA y se aleja hasta encuadrar. Ese alejarse es lo
//      que empalma con el ojo: se sale de adentro de algo y aparece el mapa.
//   4. RECIÉN AHÍ el texto y el botón, escalonados.
//
// ⚠️ ESTA PANTALLA SE REHIZO DESPUÉS DE MIRARLA CUADRO POR CUADRO, y conviene decir qué
// se sacó. La versión anterior dibujaba un abanico de fibras en SVG encima del video para
// hacer de «red neuronal». Grabada con screencast se veía así: el ojo limpio duraba UN
// cuadro y de 1,8 s a 5,4 s el gráfico lo tapaba entero. Casi cuatro segundos de un sol
// de rayos pegado sobre una cara.
//
// Lo que estaba mal no era el tiempo del fundido: era la idea. **El video ya hace el zoom
// y ya muestra el iris**, así que dibujarle fibras encima es competirle. Y las neuronas
// no hace falta dibujarlas: el grafo alejándose ES esa imagen, y además es verdad — son
// los datos del cliente, no un adorno.
//
// LA LECCIÓN, que es la cara: se midieron opacidades y clases del DOM durante cuatro
// rondas y todas dieron «bien». Nunca se miró la pantalla. Un screencast de 400 cuadros
// lo mostró en treinta segundos. **Medir una propiedad no es ver.**
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Grafo } from '@/app/second-brain/Grafo';
import { TemaOscuro } from '@/app/_components/TemaOscuro';
import { filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import type { Cerebro } from '@/lib/cerebro-modelo';

const SANS = "'Geist', sans-serif";

/** Cuánto tarda el mapa en alejarse. Por debajo de 2 s se lee como un salto. */
const MS_ALEJARSE = 2300;
/** Si el video no arranca (autoplay bloqueado, red mala, códec), se sigue sin él. Con un
 *  umbral corto la red salta SIEMPRE y el clip no se ve nunca — la protección se come
 *  justo lo que venía a proteger. */
const MS_ESPERA_VIDEO = 6000;
/**
 * DÓNDE SE CORTA EL CLIP, en segundos de su propia línea de tiempo.
 *
 * El clip dura 10,05 s y la parte que sirve es el principio: **el ojo y el zoom van de 0 a
 * 1,4 s** —a 0,29 s ya salieron las pestañas del cuadro, a 0,73 s la pupila se comió la
 * pantalla— y a **1,45 s corta a la neurona**. De ahí en adelante la neurona late con sus
 * pulsos pero la cámara ya no se mueve, así que quedarse los 10 s es mirar un loop.
 *
 * Se corta por `currentTime` y no por un `setTimeout`: un temporizador mide el reloj de
 * pared y el video mide el suyo. Si el clip se traba medio segundo, el temporizador corta
 * igual y se lleva puesta la parte que importa. Medido en este mismo archivo, dos veces.
 */
const SEG_UTILES = 4.6;
/** Techo de última instancia, por si el video nunca dispara `timeupdate`. */
const MS_TECHO_VIDEO = 9000;

type Tiempo = 'video' | 'mapa' | 'texto';

export function Bienvenida({ cerebro, videoIntro, onComenzar }: {
  cerebro: Cerebro;
  /** El clip del ojo. Sin esto se entra derecho al mapa. */
  videoIntro?: string;
  onComenzar: () => void;
}) {
  const [tiempo, setTiempo] = useState<Tiempo>(videoIntro ? 'video' : 'mapa');
  const [saliendo, setSaliendo] = useState(false);
  // El grafo exige un filtro con dueño. Acá nunca se filtra, pero el estado tiene que
  // existir: pasarle un objeto nuevo en cada render le haría recalcular todo.
  const [filtro, setFiltro] = useState<EstadoFiltro>(filtroVacio);

  const alMapa = useCallback(() => setTiempo((t) => (t === 'video' ? 'mapa' : t)), []);

  // El texto entra cuando el mapa TERMINÓ de alejarse, no antes: si aparece mientras la
  // cámara se mueve, compiten y no se lee ninguno de los dos.
  useEffect(() => {
    if (tiempo !== 'mapa') return;
    const t = setTimeout(() => setTiempo('texto'), MS_ALEJARSE);
    return () => clearTimeout(t);
  }, [tiempo]);

  const arrancar = useCallback(() => {
    setSaliendo((s) => { if (!s) onComenzar(); return true; });
  }, [onComenzar]);

  // Una tecla saltea lo que falte; con el texto puesto, Enter arranca.
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (tiempo !== 'texto') { setTiempo('texto'); return; }
      if (e.key === 'Enter' || e.key === ' ') arrancar();
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [tiempo, arrancar]);

  return (
    <div className={`bv bv-t-${tiempo}${saliendo ? ' bv-fuera' : ''}`}>
      <style>{ESTILOS}</style>

      {/* ⚠️ SIN ESTO LOS TÍTULOS DEL MAPA SON INVISIBLES, y el modo en que falla no se
          parece a un bug: los 25 `<text>` están en el DOM, tienen su caja y su posición,
          y no se pintan. El grafo pinta las etiquetas con `var(--ink)`, que en el tema
          CLARO —el default de la app— es casi negro. Sobre este fondo negro, texto negro.
          /second-brain no lo sufre porque su página monta esto; esta pantalla nació sin
          él y por eso el mapa se veía como una constelación anónima.
          Se desmonta solo al salir de la bienvenida: el componente tiene su limpieza. */}
      <TemaOscuro />

      {/* EL MAPA DE VERDAD. Entra cerca y se aleja.
          ⚠️ `pointer-events: none`: acá el mapa NO se toca. Pedido textual — «no se
          debería poder hacer zoom out en el grafo, de ahí rompe la experiencia; siempre
          debería estar centrado». Un lienzo que se puede arrastrar en la pantalla de
          bienvenida es una forma de perderse antes de empezar. */}
      <div className="bv-mapa" aria-hidden>
        <div className="bv-camara">
          <Grafo cerebro={cerebro} filtro={filtro} onFiltro={setFiltro} />
        </div>
      </div>

      <div className="bv-velo" />

      {tiempo === 'video' && videoIntro && <IntroOjo src={videoIntro} onFin={alMapa} />}

      <div className="bv-pie">
        <h1 className="bv-titulo">Bienvenido a MaKo</h1>
        <p className="bv-frase">
          Todo tu negocio en un solo mapa. Desde aquí MaKo escribe tus anuncios y te dice
          qué hacer cada día.
        </p>
        <button type="button" className="bv-boton" onClick={arrancar} disabled={tiempo !== 'texto'}>
          Comenzar
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// IntroOjo — el clip, y nada más que el clip
// =============================================================================
// Sin una sola cosa dibujada encima. Es la corrección más importante de esta pantalla:
// lo que la arruinaba era justamente lo que se le agregaba al video.
//
// El clip y sus términos están en public/onboarding/CREDITOS.md.
// =============================================================================
function IntroOjo({ src, onFin }: { src: string; onFin: () => void }) {
  const fin = useRef(onFin);
  fin.current = onFin;
  const [corriendo, setCorriendo] = useState(false);

  // ⚠️ Los relojes se atan al VIDEO, no al montaje del componente. El clip tarda en
  // llegar, así que un temporizador que arranca al montar corre por su cuenta y la
  // secuencia pasa antes de que se vea nada. Solo se nota con la red lenta, o sea nunca
  // en la máquina del que lo escribe.
  useEffect(() => {
    if (corriendo) return;
    const t = setTimeout(() => fin.current(), MS_ESPERA_VIDEO);
    return () => clearTimeout(t);
  }, [corriendo]);

  useEffect(() => {
    if (!corriendo) return;
    const t = setTimeout(() => fin.current(), MS_TECHO_VIDEO);
    return () => clearTimeout(t);
  }, [corriendo]);

  // Quien pidió menos movimiento no ve la intro: una secuencia de zoom a pantalla
  // completa es exactamente lo que esa preferencia evita.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) fin.current();
  }, []);

  return (
    <div className="bv-intro" onClick={() => fin.current()}>
      <video
        className="bv-video"
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        onPlaying={() => setCorriendo(true)}
        onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= SEG_UTILES) fin.current(); }}
        onEnded={() => fin.current()}
      />
      {/* El pase: un fundido corto sobre el final del clip. Sutil a propósito — un flash
          blanco a pantalla completa después de cuatro segundos de cara humana es una
          agresión, no una transición. */}
      {corriendo && <div className="bv-pase" />}
    </div>
  );
}

// Sin comillas invertidas adentro: el CSS vive en un template literal y una comilla en un
// comentario cierra el string y rompe el build entero. Pasó tres veces en una sesión; lo
// cuida tests/bienvenida.test.ts.
const ESTILOS = `
.bv {
  position: fixed; inset: 0; z-index: 60;
  background: #14161B; overflow: hidden;
  animation: bv-in 380ms ease both;
}
.bv-fuera { animation: bv-out 420ms ease both; pointer-events: none; }
@keyframes bv-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes bv-out { from { opacity: 1 } to { opacity: 0 } }

/* ── El mapa ─────────────────────────────────────────────────────────────── */
.bv-mapa {
  position: absolute; inset: 0 0 24% 0;
  pointer-events: none;
  opacity: 0;
}
.bv-mapa > * { height: 100% }

/* La cámara. El grafo por dentro no se entera de este movimiento —su zoom sigue siendo el
   de encuadre, que es el que deja ver los títulos—, así que es puramente de cámara. */
.bv-camara { width: 100%; height: 100%; transform-origin: 50% 46%; }

.bv-mapa .cbg { --cbg-col: 0px !important; }
.bv-mapa .cbg-barra,
.bv-mapa .cbg-tirador,
.bv-mapa .cbg-detalle { display: none !important; }

.bv-t-mapa .bv-mapa,
.bv-t-texto .bv-mapa { animation: bv-aparece 900ms ease both; }
.bv-t-mapa .bv-camara,
.bv-t-texto .bv-camara { animation: bv-alejar 2300ms cubic-bezier(.16,.72,.24,1) both; }
@keyframes bv-aparece { from { opacity: 0 } to { opacity: 1 } }
@keyframes bv-alejar { from { transform: scale(3.4) } to { transform: scale(1) } }

.bv-velo {
  position: absolute; inset: auto 0 0 0; height: 58%;
  background: linear-gradient(to bottom, rgba(20,22,27,0) 0%, rgba(20,22,27,.88) 48%, #14161B 78%);
  opacity: 0; transition: opacity 800ms ease; pointer-events: none;
}
.bv-t-texto .bv-velo { opacity: 1 }

/* ── El clip ─────────────────────────────────────────────────────────────── */
.bv-intro { position: absolute; inset: 0; z-index: 3; background: #000; cursor: pointer; }
.bv-video {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  animation: bv-video-ent 500ms ease both;
}
@keyframes bv-video-ent { from { opacity: 0 } to { opacity: 1 } }

/* El fundido del pase. Arranca cuando al clip le queda alrededor de un segundo. */
.bv-pase {
  position: absolute; inset: 0; background: #05070B; opacity: 0; pointer-events: none;
  animation: bv-pase 900ms ease both; animation-delay: 3700ms;
}
@keyframes bv-pase { from { opacity: 0 } to { opacity: 1 } }

/* ── El pie ──────────────────────────────────────────────────────────────── */
.bv-pie {
  position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
  width: min(92vw, 520px); padding: 0 0 44px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  z-index: 4;
}

/* Escalonado: título, frase, botón. Cada uno entra donde el ojo ya está — leer un título
   y que aparezca todo lo demás de golpe obliga a re-escanear la pantalla entera. */
.bv-titulo, .bv-frase, .bv-boton { opacity: 0; }
.bv-t-texto .bv-titulo { animation: bv-sube 620ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 140ms; }
.bv-t-texto .bv-frase  { animation: bv-sube 620ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 340ms; }
.bv-t-texto .bv-boton  { animation: bv-sube 620ms cubic-bezier(.2,.7,.3,1) both; animation-delay: 560ms; }
@keyframes bv-sube { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }

.bv-titulo {
  font-family: ${SANS}; font-size: clamp(30px, 4.4vw, 42px); font-weight: 600;
  letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 12px; color: #F8F6F0;
}
.bv-frase {
  font-family: ${SANS}; font-size: 16px; line-height: 1.55;
  color: rgba(243,240,231,.66); margin: 0 0 30px; max-width: 40ch;
}
.bv-boton {
  width: 100%; padding: 18px 24px; border: none; border-radius: 999px;
  background: var(--mako); color: #14161B;
  font-family: ${SANS}; font-size: 16.5px; font-weight: 700; cursor: pointer;
  box-shadow: 0 8px 34px rgba(232,176,30,.3);
  transition: box-shadow 150ms ease;
}
.bv-t-texto .bv-boton:hover { box-shadow: 0 12px 42px rgba(232,176,30,.45); }
.bv-boton:disabled { pointer-events: none; }

@media (max-height: 720px) {
  .bv-mapa { inset: 0 0 32% 0 }
  .bv-titulo { font-size: 27px }
  .bv-frase { font-size: 14.5px; margin-bottom: 20px }
  .bv-pie { padding-bottom: 26px }
}

@media (prefers-reduced-motion: reduce) {
  .bv, .bv-mapa, .bv-camara, .bv-video, .bv-pase,
  .bv-titulo, .bv-frase, .bv-boton { animation: none !important; opacity: 1 !important; transform: none !important; }
  .bv-pie { transform: translateX(-50%) !important; }
  .bv-velo { opacity: 1 !important; transition: none !important; }
}
`;
