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

/** La intro sin video: neuronas, zoom y flash. */
const MS_INTRO = 3600;
/** Con el ojo adelante: 2,4 s de video + el zoom que entra + las neuronas + el flash. */
const MS_INTRO_VIDEO = 5200;

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

  /**
   * ⚠️ LA SECUENCIA ARRANCA CUANDO EL VIDEO EMPIEZA A CORRER, no cuando monta el
   * componente. Sin esto, el reloj del CSS y el del video son dos relojes distintos: el
   * clip pesa 2,9 MB y tarda en llegar, así que con una conexión lenta el buceo, las
   * neuronas y el flash ya pasaron **antes de que se viera el ojo**. Medido acá: con el
   * video demorando ~1,6 s en arrancar, las neuronas estaban al 99% de opacidad encima
   * de un ojo recién aparecido.
   *
   * Es el mismo error de siempre —dos cosas que tienen que ir juntas y cada una con su
   * propio reloj— y solo se ve con la red lenta, o sea nunca en la máquina del que lo
   * escribe.
   */
  const [corriendo, setCorriendo] = useState(!src);
  /**
   * ⚠️ «Arrancó» y «arrancó CON video» son dos hechos distintos, y meterlos en una sola
   * variable fue el bug: la red de seguridad marcaba la secuencia como arrancada, pero el
   * `src` seguía existiendo, así que se usaban los tiempos LARGOS —los que dejan lugar
   * para el ojo— sobre una pantalla que no tenía ojo. Resultado: tres segundos de negro y
   * después las neuronas apuradas. Cada pregunta, su campo.
   */
  const [conVideo, setConVideo] = useState(false);

  // La red: si el video no arranca en 2,5 s —autoplay bloqueado, red mala, códec que no
  // soporta— la secuencia sale igual sin él. Una bienvenida que depende de que un mp4
  // baje bien es una bienvenida que se cuelga.
  useEffect(() => {
    if (!src || corriendo) return;
    // 5 s y no 2,5: el clip pesa 2,9 MB y en una primera carga fría tarda más que eso.
    // Con el umbral corto la red saltaba SIEMPRE y el ojo no se veía nunca — o sea que la
    // protección se comía justo lo que venía a proteger.
    const t = setTimeout(() => setCorriendo(true), 5000);
    return () => clearTimeout(t);
  }, [src, corriendo]);

  useEffect(() => {
    if (!corriendo) return;
    // El corte lo manda el RELOJ y no el `onEnded` del video: la secuencia sigue después
    // de que el clip termina —el zoom, las neuronas y el flash— así que atarla al final
    // del video la cortaría por la mitad.
    const t = setTimeout(() => fin.current(), conVideo ? MS_INTRO_VIDEO : MS_INTRO);
    return () => clearTimeout(t);
  }, [conVideo, corriendo]);

  // Quien pidió menos movimiento no ve la intro. No es una versión recortada: es que una
  // secuencia de zoom a pantalla completa es exactamente lo que esa preferencia evita.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) fin.current();
  }, []);

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
    <div className={`bv-intro${corriendo ? ' bv-corre' : ''}${conVideo ? ' bv-con-video' : ''}`} onClick={() => fin.current()}>
      {/* EL OJO REAL. Va primero y se ZAMBULLE: la escala crece con el origen puesto en la
          PUPILA, que en este clip cae a 63%/45% del cuadro y no en el centro. Con el
          origen por defecto el zoom se va contra la mejilla y la ilusión de entrar se
          rompe — se ve como una imagen que crece, no como un túnel.
          Autor: Emirhan Emiroğlu (Pexels). Los términos y las dos cosas que hay que
          respetar están en public/onboarding/CREDITOS.md. */}
      {src && (
        <video
          className="bv-video" src={src} autoPlay muted playsInline preload="auto"
          onPlaying={() => { setConVideo(true); setCorriendo(true); }}
        />
      )}

      <svg viewBox="-300 -300 600 600" className={conVideo ? 'bv-ojo bv-ojo-tarde' : 'bv-ojo'} aria-hidden>
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
}
/* NADA se anima hasta que la secuencia arranca de verdad (ver el estado corriendo). Con las
   animaciones sueltas en .bv-intro, el reloj empezaba al montar y se comía el video. */
.bv-corre { animation: bv-intro-fuera 480ms ease both; animation-delay: 3120ms; }
@keyframes bv-intro-fuera { to { opacity: 0; visibility: hidden } }

/* ── El ojo real, y la zambullida ─────────────────────────────────────────
   El origen del zoom es LA PUPILA (63% / 45% del cuadro en este clip), no el centro.
   Con el default el zoom se va contra la mejilla: se ve una imagen que crece, no un
   túnel. Es el mismo error de encuadre que arruina cualquier transición de este tipo.
   La escala llega a 14: a esa altura el negro de la pupila es la pantalla entera, y ahí
   es donde entran las neuronas sin que se vea el corte. */
.bv-video {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  transform-origin: 63% 45%;
}
.bv-corre .bv-video {
  animation: bv-buceo 2600ms cubic-bezier(.5,0,.85,.3) both;
  animation-delay: 2100ms;
}
@keyframes bv-buceo {
  0%   { transform: scale(1); filter: brightness(1) }
  60%  { transform: scale(4.5); filter: brightness(.7) }
  100% { transform: scale(14); filter: brightness(.15); opacity: 0 }
}

/* Con video, las neuronas no arrancan de cero: aparecen cuando la pupila ya se comió la
   pantalla, así el corte entre lo filmado y lo dibujado cae adentro del negro.

   ⚠️ VA CON .bv-intro ADELANTE, y no es adorno: con la misma especificidad que .bv-ojo
   gana el que está DESPUÉS en la hoja, y estas reglas quedaron antes. Resultado medido:
   la demora se perdía y las neuronas se dibujaban ENCIMA del ojo, las dos cosas a la vez.
   Un selector más específico no depende del orden en que alguien pegue el bloque. */
.bv-corre .bv-ojo-tarde { animation: bv-ojo-ent 900ms ease both; animation-delay: 3000ms; }
.bv-corre .bv-ojo-tarde .bv-zoom,
.bv-corre .bv-ojo-tarde .bv-pupila,
.bv-corre .bv-ojo-tarde .bv-anillo { animation-delay: 3200ms; }
.bv-corre .bv-ojo-tarde .bv-fibra { animation-delay: 3000ms; }

.bv-ojo { width: min(150vh, 150vw); height: min(150vh, 150vw); opacity: 0; }
.bv-corre .bv-ojo { animation: bv-ojo-ent 700ms ease both; }
@keyframes bv-ojo-ent { from { opacity: 0 } to { opacity: 1 } }

/* El zoom: entra por la pupila. La escala es grande a propósito — a 26x las fibras del
   iris ya no se leen como iris, se leen como una red. Es la misma primitiva. */
.bv-corre .bv-zoom {
  animation: bv-zoom 2600ms cubic-bezier(.55,0,.85,.35) both;
  animation-delay: 620ms;
}
@keyframes bv-zoom {
  0%   { transform: scale(1) }
  36%  { transform: scale(1.5) }
  100% { transform: scale(26) }
}

.bv-corre .bv-pupila { animation: bv-pupila 2600ms cubic-bezier(.5,0,.9,.4) both; animation-delay: 620ms; }
@keyframes bv-pupila {
  0%   { r: 66; opacity: 1 }
  55%  { r: 74; opacity: .92 }
  100% { r: 92; opacity: 0 }
}

/* Las fibras laten antes del zoom: es lo que hace que el iris se vea VIVO y no impreso. */
.bv-corre .bv-fibra { animation: bv-fibra 1600ms ease-in-out infinite alternate; }
@keyframes bv-fibra { from { opacity: .2 } to { opacity: .85 } }


.bv-corre .bv-anillo { animation: bv-anillo 2600ms ease both; animation-delay: 620ms; }
@keyframes bv-anillo { to { opacity: 0 } }

.bv-flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
.bv-corre .bv-flash { animation: bv-flash 620ms ease both; animation-delay: 2760ms; }
/* Con el ojo adelante todo corre: el flash cierra la secuencia, no la parte. */
/* Clase explicita y no :has(.bv-video): el elemento existe aunque el video no haya
   corrido nunca, asi que :has() prendia los tiempos largos en la pantalla sin ojo. */
.bv-con-video .bv-flash { animation-delay: 4400ms; }
.bv-con-video { animation-delay: 4760ms; }
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
