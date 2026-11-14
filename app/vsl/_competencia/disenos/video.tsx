// =============================================================================
// /vsl/video con el DISEÑO de la portada de Cherry Studio (copiado el 11/11/2026, rehecho el 14/11/2026 contra su versión nueva)
// =============================================================================
// Referencia: https://cherrysweet.app/ — releída el 14/11/2026 con Chromium a 1440 × 900 y 390 × 844: capturas por sección,
// estilos calculados, su script de interacciones y videos de cada animación, en side-session-notes/…/referencias-landings/
// video-cherry/ (relevo.md). Martín, 14/11/2026: «quiero que te concentres en que la copia salga muy fiel a todas las animaciones
// y cosas que tiene la landing original… los videos que tienen, las animaciones, los hover, todo, absolutamente todo».
//
// Lo copiado, en su orden: el hero con la pastilla de la marca en el titular, los dos botones y la VITRINA (cuatro tarjetas 4:5
// inclinadas con video, las calcomanías encima y el disco del logo en el medio), que sigue al mouse y se abre al bajar; la fila
// de dos tarjetas (7fr / 5fr); «Lo que hace» con la lista numerada que avanza sola con su barra de 7,5 s, el paso siguiente que
// late hasta que se toca uno, la pista a mano «toca cada paso» y el marco 4:5 con la escena de cada paso y su calcomanía que
// salta; el comparador que se arrastra (y se pasea solo una vez al aparecer); la banda de papel rasgado con lunares, la palabra
// calada que corre con el scroll y la hoja de calcomanías (se agrandan al pasar el mouse y se menean al tocarlas); las preguntas
// en dos columnas con el + que gira a ×; la banda final con el abanico de tres videos cortado por el borde; el pie; el botón fijo
// del teléfono; la entrada al bajar (sube 34 px y aparece; las calcomanías caen de 1,45×); la barra de desplazamiento; y su
// manejo de videos (corren a lo sumo 4 a la vez, 2 en el teléfono, y se frenan mientras se baja). Los botones NO se mueven al
// pasar el mouse (Cherry sólo los achica al apretar): la versión anterior los subía 2 px, y eso no era de Cherry.
// De MaKo: el logo, el azul #2F6FED donde Cherry pone su rosa, y las pantallas REALES del editor de Video grabadas en el banco
// (C:/dev/bancos-portada/banco-video: el panel del enjambre sobre las tomas del personaje de Martín; los cortes 4:5 salen de
// cortar-4x5.sh, en public/vsl-assets/video/). Lo que todavía no está grabado va con el recuadro de lo que falta.
// Lo que NO se copió, y por qué: ver la cabecera de ../video.ts (calendario, Instagram, virales, mosaico, conector, simulador,
// logos y precios). Sus estatuas, el «very sweet» a mano y el sello «BETA» son su arte o su marca: no van.
// Server component: las interacciones son un <script data-visor> (el visor de Martín borra los demás). Los pasos son radios con
// su <label> (sin JavaScript igual cambian; un <button> sin onClick lo marca tests/ningun-boton-muerto) y el comparador un
// <input type="range">.
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import { Icon } from '../../_detalle/FeatureDetail';
import { RUTA_CTA, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE, EstrellaMaKo } from '../marca';
import type { Bloque } from '../tipos';
import { FaltaAnimacion } from '../FaltaAnimacion';

const P = 'd-video';
const A = '/vsl-assets/video';
/** Las tomas 4:5 (C:/dev/bancos-portada/banco-video/cortar-4x5.sh): el póster es su primer cuadro. */
const TOMA = {
  cortes: { video: `${A}/cortes.webm`, poster: `${A}/cortes.jpg` },
  subtitulos: { video: `${A}/subtitulos.webm`, poster: `${A}/subtitulos.jpg` },
  corte: { video: `${A}/corte-final.webm`, poster: `${A}/corte-final.jpg` },
  personaje: { video: `${A}/personaje.webm`, poster: `${A}/personaje.jpg` },
} as const;
type Toma = (typeof TOMA)[keyof typeof TOMA];

/** La escena de cada paso de «Lo que hace», en su orden: la toma real, o lo que falta grabar. */
const ESCENAS: readonly (Toma | { falta: string })[] = [
  TOMA.cortes,
  TOMA.subtitulos,
  { falta: 'La portada de Video, «Encuentra tu siguiente outlier», con los reels que funcionan y el botón para replicarlos.' },
  { falta: 'El chat del editor: le pides un cambio a MaKo y te muestra el original y el modificado para aceptarlo.' },
];
/** El color de la calcomanía de cada paso (su data-tono): verde, azul (su rosa), crema y dorado. */
const TONOS = ['verde', 'azul', 'crema', 'dorado'] as const;

type Hero = Extract<Bloque, { tipo: 'hero' }>;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Contraste = Extract<Bloque, { tipo: 'contraste' }>;
type Pasos = Extract<Bloque, { tipo: 'pasos' }>;
type Preguntas = Extract<Bloque, { tipo: 'preguntas' }>;

/**
 * El borde de papel rasgado (sus PNG «rasgado-arriba/abajo», dibujados acá): un borde irregular de 480 × 30 que se repite a lo
 * ancho. Arriba se ve lo que queda DEBAJO del borde; abajo, lo de arriba. Los dientes empiezan y terminan a la misma altura, así
 * la tira no se corta entre una copia y la otra. El papel crema de atrás es 5 px más alto: asoma como el borde blanco del rasgado.
 */
const RASGADO = (() => {
  // Un azar con semilla (siempre el mismo borde): una ondulación lenta (las «mordidas» del papel, 3 por tira) con dientes chicos
  // encima y, de vez en cuando, uno más hondo. La onda cierra en la misma altura, así la tira empalma con la siguiente.
  let semilla = 7;
  const azar = () => (semilla = (semilla * 9301 + 49297) % 233280) / 233280;
  const N = 120, ANCHO = 480;
  const y = Array.from({ length: N }, (_, i) => {
    const v = 10 + 5 * Math.sin((i / N) * Math.PI * 2 * 3 + 0.6) + 2.5 * Math.sin((i / N) * Math.PI * 2 * 7) + (azar() - 0.5) * 5 + (azar() < 0.12 ? azar() * 6 : 0);
    return Number(Math.max(1.5, Math.min(24, v)).toFixed(1));
  });
  const tramo = (f: (v: number) => number) => y.map((v, i) => `${((i * ANCHO) / N).toFixed(1)} ${f(v)}`).concat(`${ANCHO} ${f(y[0])}`).join(' L');
  const svg = (d: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${ANCHO}' height='30'><path d='${d}' fill='#000'/></svg>`)}")`;
  return { arriba: svg(`M0 30 L${tramo((v) => v)} L${ANCHO} 30 Z`), abajo: svg(`M0 0 L${tramo((v) => Number((30 - v).toFixed(1)))} L${ANCHO} 0 Z`) };
})();
const MASCARA = `${RASGADO.arriba} left top / auto 30px repeat-x, linear-gradient(#000, #000) left 29px / 100% calc(100% - 58px) no-repeat, ${RASGADO.abajo} left bottom / auto 30px repeat-x`;
/** El grano de papel (su --grano: un ruido fractal). */
const GRANO = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>")}")`;

const FLECHA_MANO = <svg className={`${P}-flecha`} viewBox="0 0 38 26" aria-hidden="true"><path d="M34 4c-6 12-16 17-28 16" /><path d="M11 14l-6 6 8 3" /></svg>;
const DEDO = <svg className={`${P}-dedo`} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0V12" /><path d="M14 10.5a1.5 1.5 0 0 1 3 0V12" /><path d="M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L7 19c-.3-.5-1.4-2.4-3.2-5.6a1.5 1.5 0 0 1 .5-2 1.9 1.9 0 0 1 2.3.3L8 13" /></svg>;
const FLECHAS = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7l-5 5 5 5" /><path d="M16 7l5 5-5 5" /></svg>;
const ICONO_CRUDO = ['M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z', 'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'];
const ICONO_TIJERA = ['M6 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M6 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M8.6 8.6l10.4 10.4', 'M8.6 15.4l10.4 -10.4'];

function Boton({ clase = '', texto = TEXTO_CTA, href = RUTA_CTA }: { clase?: string; texto?: string; href?: string }) {
  return <a href={href} className={`${P}-btn ${clase}`}>{texto}</a>;
}

function Video({ t, demo = true, carga = 'none' }: { t: Toma; demo?: boolean; carga?: 'none' | 'auto' }) {
  // Sin autoPlay: los arranca el script (a lo sumo 4 a la vez, como Cherry); con «menos movimiento» quedan en su póster.
  return <video src={t.video} poster={t.poster} muted loop playsInline preload={carga} {...(demo ? { 'data-demo': '' } : {})} />;
}

/** La nota chica debajo de los botones (su «Hay un plan gratis y no te pedimos tarjeta», con la primera parte en verde): acá, la
 *  regla de la prueba de ../cta.ts, la misma frase de la banda final. */
function Nota() {
  const i = TEXTO_CIERRE.indexOf('. ');
  const [a, z] = i > 0 ? [TEXTO_CIERRE.slice(0, i + 1), TEXTO_CIERRE.slice(i + 1)] : ['', TEXTO_CIERRE];
  return <p className={`${P}-nota`}>{a ? <b>{a}</b> : null}{z}</p>;
}

function Etq({ texto, clase = '' }: { texto?: string; clase?: string }) {
  return texto ? <p className={`${P}-etq ${clase}`}>{texto}</p> : null;
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function HeroCherry({ b }: { b: Hero }) {
  const pegas = (b.puntos ?? []).slice(0, 4);
  const tonos = ['negra', 'crema', 'verde', 'azul'];
  const tomas = [TOMA.cortes, TOMA.subtitulos, TOMA.corte, TOMA.personaje];
  return (
    <section className={`${P}-vol ${P}-hero`} aria-label="Qué es Video">
      <span className={`${P}-puntos`} aria-hidden="true" data-tema-fijo="" style={{ left: '32%', top: 30 }} />
      <Etq texto={b.etiqueta} clase={`${P}-etq-hero`} />
      <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
      <p className={`${P}-bajada`} dangerouslySetInnerHTML={html(b.bajada)} />
      <div className={`${P}-acciones`}>
        <Boton clase={`${P}-btn-claro ${P}-primero`} />
        <Boton clase={`${P}-btn-linea`} texto="Ver lo que hace" href="#hace" />
      </div>
      <Nota />
      <div className={`${P}-vitrina`} aria-hidden="true">
        {tomas.map((t, i) => (
          // El fondo es el póster (sin comillas: el visor localiza las url( ) que empiezan con «/»).
          <div key={t.video} className={`${P}-t ${P}-f${i + 1}${i === 1 || i === 2 ? ` ${P}-medio` : ''}`} data-tema-fijo="" style={{ backgroundImage: `url(${t.poster})` }}>
            <Video t={t} carga="auto" />
          </div>
        ))}
        {pegas.map((p, i) => (
          <span key={p} className={`${P}-pega ${P}-pega-${tonos[i]} ${P}-pg${i + 1} ${P}-toca`} data-tema-fijo="" dangerouslySetInnerHTML={html(p)} />
        ))}
        <span className={`${P}-disco ${P}-sello ${P}-toca`} data-tema-fijo=""><EstrellaMaKo size={44} /></span>
      </div>
    </section>
  );
}

// ── La fila de dos tarjetas: el comparador y los tres pasos ──────────────────
function Comparador({ b }: { b: Contraste }) {
  return (
    <section className={`${P}-vol ${P}-tarjeta ${P}-compara`} aria-label="Antes y después">
      <span className={`${P}-puntos`} aria-hidden="true" data-tema-fijo="" style={{ right: 22, top: 22 }} />
      <Etq texto={b.etiqueta} />
      <h2 className={`${P}-h2-par`} dangerouslySetInnerHTML={html(b.titulo)} />
      <div className={`${P}-cmp`} data-tema-fijo="" style={{ ['--x' as string]: '50%' }}>
        {/* Dos cuadros de la MISMA grabación del editor (banco-video): antes de «Editar con MaKo» y con el corte final. */}
        {/* La capa de después va recortada desde la línea (clip-path sobre la CAJA, no sobre la imagen, que es más ancha). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className={`${P}-cmp-capa`}><img src={`${A}/antes.jpg`} alt="La línea de tiempo con las tres tomas tal cual salieron: 19 segundos" width={1280} height={800} loading="lazy" decoding="async" /></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className={`${P}-cmp-capa ${P}-cmp-despues`}><img src={`${A}/despues.jpg`} alt="La misma línea de tiempo después de la Edición automática: 11 segundos, con subtítulos" width={1280} height={800} loading="lazy" decoding="async" /></div>
        <span className={`${P}-rot ${P}-rot-a`} dangerouslySetInnerHTML={html(b.sin.titulo)} />
        <span className={`${P}-rot ${P}-rot-d`} dangerouslySetInnerHTML={html(b.con.titulo)} />
        <div className={`${P}-mango`} aria-hidden="true"><span>{FLECHAS}</span></div>
        <span className={`${P}-cmp-pista`} aria-hidden="true">{FLECHAS}arrástrame</span>
        <input className={`${P}-cmp-rango`} type="range" min={0} max={100} defaultValue={50} aria-label="Mover la comparación" />
      </div>
      <div className={`${P}-items`}>
        {[b.sin, b.con].map((it, i) => (
          <div key={it.titulo} className={`${P}-item`}>
            <i><Icon paths={i === 0 ? ICONO_CRUDO : ICONO_TIJERA} size={20} /></i>
            <div><b dangerouslySetInnerHTML={html(it.titulo)} /><span dangerouslySetInnerHTML={html(it.texto)} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TresPasos({ b }: { b: Pasos }) {
  return (
    <section className={`${P}-vol ${P}-tarjeta ${P}-pasos`} id="empieza" aria-label="Cómo empiezas">
      <Etq texto={b.etiqueta} />
      <h2 className={`${P}-h2-par`} dangerouslySetInnerHTML={html(b.titulo)} />
      {b.pasos.map((p, i) => (
        <div key={p.titulo} className={`${P}-paso`}>
          <i data-tema-fijo="">{i + 1}</i>
          <div><b dangerouslySetInnerHTML={html(p.titulo)} /><span dangerouslySetInnerHTML={html(p.texto)} /></div>
        </div>
      ))}
      <Boton clase={`${P}-btn-claro ${P}-btn-ancho`} />
    </section>
  );
}

// ── «Lo que hace»: la lista que avanza sola y el marco con la escena de cada paso ──
function LoQueHace({ b }: { b: Tarjetas }) {
  const items = b.items.slice(0, 4);
  return (
    // `-quieto` de nacimiento: la barra no corre hasta que el script ve la sección (como Cherry, que la pausa fuera de la vista).
    <section className={`${P}-vol ${P}-hace ${P}-quieto`} id="hace" aria-label="Lo que hace Video">
      <div className={`${P}-hace-lista`}>
        <Etq texto={b.etiqueta} />
        <h2 className={`${P}-h2-hace`} dangerouslySetInnerHTML={html(b.titulo)} />
        <span className={`${P}-pista ${P}-pista-hace`}>{FLECHA_MANO} toca cada paso</span>
        {items.map((t, i) => (
          <div key={t.titulo} className={`${P}-paso-hace`}>
            <input type="radio" name={`${P}-paso`} id={`${P}-paso-${i}`} className={`${P}-radio ${P}-r${i}`} defaultChecked={i === 0} />
            <label htmlFor={`${P}-paso-${i}`} className={`${P}-ph ${P}-ph${i}`}>
              <span className={`${P}-n`} data-tema-fijo="">{i + 1}</span>
              <span className={`${P}-ph-txt`}>
                <b dangerouslySetInnerHTML={html(t.titulo)} />
                <span className={`${P}-ph-p`} dangerouslySetInnerHTML={html(t.texto)} />
                <i className={`${P}-avance`}><i /></i>
              </span>
            </label>
          </div>
        ))}
      </div>
      <div className={`${P}-hace-tel`}>
        <div className={`${P}-marco`} data-tema-fijo="">
          {items.map((t, i) => {
            const e = ESCENAS[i];
            return (
              <div key={t.titulo} className={`${P}-escena ${P}-escena${i}`}>
                {e && 'video' in e ? <Video t={e} demo={false} /> : <FaltaAnimacion que={e?.falta ?? `La pantalla de «${t.titulo.replace(/<[^>]+>/g, '')}» tal cual es en MaKo.`} />}
              </div>
            );
          })}
        </div>
        {items.map((t, i) => (
          <span key={t.titulo} className={`${P}-pega ${P}-pega-${TONOS[i % 4]} ${P}-hace-pega ${P}-hace-pega${i}`} aria-hidden="true" data-tema-fijo="">{t.meta ?? ''}</span>
        ))}
      </div>
    </section>
  );
}

// ── La banda rasgada con la hoja de calcomanías ─────────────────────────────
function HojaDeCalcomanias({ b }: { b: Tarjetas }) {
  const tiras = b.items.slice(0, 4);
  const ademas = b.items.slice(4);
  return (
    <div className={`${P}-banner`}>
      <span className={`${P}-disco ${P}-cruza-arriba ${P}-toca`} aria-hidden="true" data-tema-fijo=""><EstrellaMaKo size={52} /></span>
      <section className={`${P}-rasgada ${P}-hojacalcas`} aria-label="Las herramientas">
        <span className={`${P}-lunares`} aria-hidden="true" data-tema-fijo="" />
        <span className={`${P}-aguamarca`} aria-hidden="true">MAKO</span>
        <Etq texto={b.etiqueta} />
        <h2 className={`${P}-h2-hoja`} dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className={`${P}-bajada-hoja`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        <div className={`${P}-pliego`}>
          <span className={`${P}-etq ${P}-etq-pliego`}>Hoja de calcomanías de MaKo · despega y usa</span>
          <span className={`${P}-pista ${P}-pista-pliego`}>{DEDO}tócalas</span>
          <div className={`${P}-tiras`}>
            {tiras.map((t, i) => (
              <div key={t.titulo} className={`${P}-tira`}>
                <span className={`${P}-calca ${P}-calca-${i} ${P}-toca`} data-tema-fijo=""><Icon paths={t.icono ?? []} size={64} /></span>
                <b data-tema-fijo="" dangerouslySetInnerHTML={html(t.titulo)} />
                <span dangerouslySetInnerHTML={html(t.texto)} />
              </div>
            ))}
          </div>
        </div>
        {ademas.length ? (
          <div className={`${P}-ademas`}>{ademas.map((t) => <span key={t.titulo} title={t.texto.replace(/<[^>]+>/g, '')} dangerouslySetInnerHTML={html(t.titulo)} />)}</div>
        ) : null}
      </section>
    </div>
  );
}

// ── Preguntas: la cabecera suelta y el panel en dos columnas ────────────────
function PreguntasCherry({ b }: { b: Preguntas }) {
  return (
    <>
      <section className={`${P}-titular`} aria-label="Preguntas">
        <Etq texto="Preguntas" />
        <h2 className={`${P}-h2-tit`} dangerouslySetInnerHTML={html(b.titulo)} />
      </section>
      <section className={`${P}-vol ${P}-preguntas`} aria-label="Preguntas frecuentes">
        {b.items.map((q, i) => (
          // Abiertas la primera y la tercera: las dos de arriba de la columna izquierda, como Cherry.
          <details key={q.p} open={i === 0 || i === 2}>
            <summary>{q.p}</summary>
            <p dangerouslySetInnerHTML={html(q.r)} />
          </details>
        ))}
      </section>
    </>
  );
}

export default function DisenoVideo({ landing }: PropsDiseno) {
  const bloques = landing.bloques;
  const partes: ReactNode[] = [];
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    const sig = bloques[i + 1];
    switch (b.tipo) {
      case 'hero': partes.push(<HeroCherry key={i} b={b} />); break;
      case 'contraste':
        // La fila de dos de Cherry (7fr / 5fr): el comparador y, si vienen después, los tres pasos.
        if (sig?.tipo === 'pasos') { partes.push(<div key={i} className={`${P}-par`}><Comparador b={b} /><TresPasos b={sig} /></div>); i++; }
        else partes.push(<div key={i} className={`${P}-par ${P}-par-uno`}><Comparador b={b} /></div>);
        break;
      case 'pasos': partes.push(<div key={i} className={`${P}-par ${P}-par-uno`}><TresPasos b={b} /></div>); break;
      case 'tarjetas': partes.push(b.fondo ? <HojaDeCalcomanias key={i} b={b} /> : <LoQueHace key={i} b={b} />); break;
      case 'preguntas': partes.push(<PreguntasCherry key={i} b={b} />); break;
      // Video no tiene estos bloques (Cherry no tiene testimonios, contadores ni filas).
      case 'cifras': case 'caso': case 'filas': case 'logos': break;
    }
  }
  const hero = bloques.find((b): b is Hero => b.tipo === 'hero');
  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <main className={`${P}-hoja`}>
        <header className={`${P}-vol ${P}-barra`}>
          <LogoMaKo className={`${P}-logo`} tamano={34} />
          <nav aria-label="Principal">
            <a href="#hace">Qué hace</a>
            <a href="/vsl">Funcionalidades</a>
            <a href={RUTA_CTA} className={`${P}-barra-btn`}>{TEXTO_CTA}</a>
          </nav>
        </header>
        {partes}
        <div className={`${P}-banner`}>
          <section className={`${P}-rasgada ${P}-final`} aria-label="Empieza">
            <span className={`${P}-lunares`} aria-hidden="true" data-tema-fijo="" />
            <span className={`${P}-aguamarca`} aria-hidden="true">MAKO VIDEO</span>
            <Etq texto={hero?.etiqueta} clase={`${P}-etq-final`} />
            <h2 className={`${P}-h2-final`}>¿Lo quieres funcionando en tu negocio?</h2>
            <p className={`${P}-final-p`}>{TEXTO_CIERRE}</p>
            <div className={`${P}-acciones`}><Boton clase={`${P}-btn-negro`} /></div>
            <div className={`${P}-abanico`} aria-hidden="true" data-tema-fijo="">
              {[TOMA.subtitulos, TOMA.personaje, TOMA.cortes].map((t) => <span key={t.video}><Video t={t} /></span>)}
            </div>
          </section>
        </div>
        <footer className={`${P}-pie`}>
          <LogoMaKo tamano={28} />
          <nav aria-label="Otras funcionalidades">
            {otrasFunciones(landing.slug).map((f) => <a key={f.href} href={f.href}>{f.nombre}</a>)}
          </nav>
          <p>El mejor software para vender High Ticket.</p>
          <p>© MaKo — Todos los derechos reservados.</p>
        </footer>
      </main>
      {/* El botón fijo del teléfono: aparece cuando el del hero quedó arriba y antes de la banda final. */}
      <div className={`${P}-fijo`} data-tema-fijo=""><Boton clase={`${P}-btn-claro`} /></div>
    </div>
  );
}

// =============================================================================
// Los valores, de getComputedStyle sobre cherrysweet.app (14/11/2026). Cherry en claro: --fondo #ECE3DD, --tinta #140C11,
// --tinta-2 rgba(20,12,17,.68), --tinta-3 .48, --borde .09, --foco .05, --pastilla .06, --sombra rgba(70,40,50,.22). Su rosa
// #FF2D8A / #D8156E / #FF5AA3 → el azul de MaKo #2F6FED / #1F57C8 / #6E9BF5.
// =============================================================================
const CSS = `
@font-face { font-family: 'DVidOutfit'; src: url('/vsl-assets/fuentes/outfit/outfit-latin-var.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
@font-face { font-family: 'DVidGrotesk'; src: url('/vsl-assets/fuentes/space-grotesk/space-grotesk-latin-var.woff2') format('woff2'); font-weight: 300 700; font-display: swap; }
@font-face { font-family: 'DVidMono'; src: url('/vsl-assets/fuentes/dm-mono/dm-mono-latin-500.woff2') format('woff2'); font-weight: 500; font-display: swap; }
@font-face { font-family: 'DVidCaveat'; src: url('/vsl-assets/fuentes/caveat/caveat-latin-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }

.${P} { --disp: 'DVidOutfit', 'Arial Black', system-ui, sans-serif; --ui: 'DVidGrotesk', 'Segoe UI', system-ui, sans-serif; --mono: 'DVidMono', ui-monospace, Consolas, monospace; --mano: 'DVidCaveat', 'Segoe Script', cursive;
  --fondo: #ECE3DD; --tinta: #140C11; --tinta-2: rgba(20,12,17,.68); --tinta-3: rgba(20,12,17,.48); --borde: rgba(20,12,17,.09); --foco: rgba(20,12,17,.05); --pastilla: rgba(20,12,17,.06); --sombra: rgba(70,40,50,.22); --puntos: rgba(20,12,17,.13);
  --marca: #2F6FED; --marca-h: #1F57C8; --marca-luz: #6E9BF5; --verde: #6ED49C; --ambar: #FFC93C; --crema: #F4ECE7; --negro: #0B0709;
  --grano: ${GRANO};
  background: var(--fondo); color: var(--tinta); font: 400 16px/1.5 var(--ui); padding: 16px 16px 110px; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.${P} *, .${P} *::before, .${P} *::after { box-sizing: border-box; }
.${P} :where(h1, h2, h3, p, ul, ol, figure) { margin: 0; padding: 0; }
.${P} :where(a) { color: inherit; }
.${P} strong { font-weight: 600; color: var(--tinta); }
.${P}-hoja { max-width: 1160px; margin: 0 auto; display: grid; gap: 16px; }
.${P}-hoja > * { min-width: 0; }

/* El panel «vol»: blanco con un degradado apenas crema, borde de 1 px, radio 30 y la sombra en capas */
.${P}-vol { position: relative; isolation: isolate; border: 1px solid var(--borde); border-radius: 30px;
  background: radial-gradient(120% 90% at 78% 72%, var(--foco), transparent 60%), linear-gradient(180deg, #FFFFFF, #FBF7F4);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 1px 0 rgba(0,0,0,.25), 0 26px 50px -26px var(--sombra), 0 60px 90px -60px var(--sombra); }
.${P}-etq { font: 500 10.5px/1.2 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--tinta-2); }
.${P}-puntos { position: absolute; width: 132px; height: 78px; background-image: radial-gradient(var(--puntos) 1.6px, transparent 1.8px); background-size: 12px 12px; z-index: 0; pointer-events: none; }

/* Barra en píldora (en producción la tapa la barra del sitio: BARRA_PROPIA en ../TemaSitio.tsx) */
.${P}-barra { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-radius: 999px; padding: 9px 10px 9px 18px; z-index: 20; }
.${P}-logo span:last-child { font-family: var(--disp); font-weight: 800 !important; }
.${P}-barra nav { display: flex; align-items: center; gap: 4px; }
.${P}-barra nav a { text-decoration: none; font: 500 14px/1 var(--ui); color: var(--tinta-2); padding: 10px 12px; border-radius: 999px; }
.${P}-barra nav a:hover { color: var(--tinta); background: var(--pastilla); }
.${P}-barra nav a.${P}-barra-btn { color: var(--fondo); background: var(--tinta); padding: 12px 18px; transition: transform .2s; }
.${P}-barra nav a.${P}-barra-btn:active { transform: scale(.98); }

/* Botones: píldora 16 / 700, padding 17 26. No se mueven al pasar el mouse: sólo se achican al apretar */
.${P}-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; font: 700 16px/1 var(--ui); border-radius: 999px; padding: 17px 26px; text-decoration: none; border: 0; white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform .2s; }
.${P}-btn:active { transform: scale(.98); }
.${P}-btn-claro { background: var(--tinta); color: var(--fondo); box-shadow: 0 12px 26px -10px var(--sombra); }
/* El borde va como sombra: el sol y la luna lleva al modo los BORDES oscuros (en el claro los aclaraba y el botón quedaba sin línea) */
.${P}-btn-linea { background: transparent; color: var(--tinta); box-shadow: inset 0 0 0 1px rgba(20,12,17,.22); }
.${P}-btn-negro { background: var(--negro); color: #fff; box-shadow: 0 16px 30px -14px rgba(10,25,60,.6); }
.${P}-btn-ancho { width: 100%; margin-top: 6px; position: relative; z-index: 5; }
.${P}-acciones { display: flex; gap: 8px; flex-wrap: wrap; position: relative; z-index: 6; }

/* Calcomanías («pega»), el disco del logo y las que se tocan */
.${P}-pega { position: absolute; z-index: 4; font: 800 15px/1 var(--disp); letter-spacing: -.01em; padding: 11px 15px 12px; border-radius: 12px; white-space: nowrap; box-shadow: 0 0 0 4px #fff, 0 10px 18px rgba(70,40,50,.28); pointer-events: none; }
.${P}-pega-negra { background: var(--negro); color: #fff; }
.${P}-pega-azul { background: var(--marca); color: #fff; }
.${P}-pega-crema { background: var(--crema); color: var(--negro); }
.${P}-pega-verde { background: var(--verde); color: var(--negro); }
.${P}-pega-dorado { background: #F2B01E; color: var(--negro); }
.${P}-disco { position: absolute; z-index: 4; border-radius: 50%; display: grid; place-items: center; background: #0C0409; box-shadow: 0 0 0 6px #fff, 0 14px 20px rgba(70,40,50,.32); pointer-events: none; }
.${P}-toca { pointer-events: auto; cursor: grab; }
.${P}-toca:hover { scale: 1.07; }
.${P}-toca.${P}-menea { animation: ${P}-menea .5s ease; }
@keyframes ${P}-menea { 20% { rotate: -6deg; } 45% { rotate: 5deg; } 70% { rotate: -3deg; } 100% { rotate: 0deg; } }

/* Hero: padding 38 20 0 (64 40 0 desde 960), todo centrado */
.${P}-hero { padding: 38px 20px 0; display: grid; gap: 16px; justify-items: center; text-align: center; overflow: hidden; --mx: 0; --my: 0; --abre: 0; }
.${P}-etq-hero { position: relative; z-index: 5; }
.${P}-h1 { font: 900 clamp(44px, 11.5vw, 84px)/.9 var(--disp); letter-spacing: -.045em; text-wrap: balance; position: relative; z-index: 5; color: var(--tinta); }
.${P}-h1 em { font-style: normal; position: relative; display: inline-block; background: var(--marca); color: var(--negro); padding: 0 .12em .04em; border-radius: 14px; margin-right: .18em; transform: rotate(-2.5deg) translateY(4px); box-shadow: 0 14px 30px -12px color-mix(in srgb, var(--marca) 70%, transparent); }
.${P}-bajada { font-size: 17px; line-height: 1.5; color: var(--tinta-2); max-width: 44ch; margin: 0 auto; position: relative; z-index: 5; }
.${P}-hero .${P}-acciones { justify-content: center; }
.${P}-nota { font: 400 13px/1.35 var(--ui); color: var(--tinta-3); position: relative; z-index: 6; max-width: 60ch; }
.${P}-nota b { color: #0E8F56; font-weight: 600; }

/* La vitrina: cuatro tarjetas 4:5 inclinadas, las calcomanías y el disco; siguen al mouse y se abren al bajar */
.${P}-vitrina { position: relative; width: calc(100% + 40px); margin: 16px -20px 0; height: 300px; z-index: 2; }
.${P}-t { position: absolute; bottom: -40px; width: 150px; aspect-ratio: 4 / 5; border-radius: 22px; overflow: hidden; background: #0B0709 center / cover no-repeat; box-shadow: 0 24px 44px -18px rgba(50,20,35,.6); z-index: 2; }
.${P}-t video { width: 100%; height: 100%; object-fit: cover; display: block; }
.${P}-t.${P}-medio { z-index: 3; }
.${P}-f1 { left: calc(50% - 250px); transform: rotate(-9deg); bottom: -64px; }
.${P}-f2 { left: calc(50% - 138px); transform: rotate(-3deg); }
.${P}-f3 { left: calc(50% - 8px); transform: rotate(3deg); }
.${P}-f4 { left: calc(50% + 110px); transform: rotate(9deg); bottom: -64px; }
.${P}-vitrina .${P}-pega { z-index: 5; font-size: 12.5px; padding: 9px 12px 10px; }
.${P}-pg2, .${P}-pg3 { display: none; }
.${P}-pg1 { left: 12px; bottom: 150px; transform: rotate(-9deg); }
.${P}-pg4 { right: 12px; bottom: 142px; transform: rotate(8deg); }
.${P}-sello { width: 50px; height: 50px; left: calc(50% - 25px); bottom: 170px; transform: rotate(-8deg); z-index: 6; }
.${P}-sello svg { width: 56%; height: 56%; }
.${P}-t, .${P}-vitrina .${P}-pega, .${P}-vitrina .${P}-disco { transition: translate .35s ease-out; }
.${P}-t { translate: calc(var(--mx) * 10px + var(--abre) * var(--dx, 0px)) calc(var(--my) * 6px + var(--abre) * var(--dy, 0px)); }
.${P}-vitrina .${P}-pega, .${P}-vitrina .${P}-disco { translate: calc(var(--mx) * 16px + var(--abre) * var(--dx, 0px)) calc(var(--my) * 9px + var(--abre) * var(--dy, 0px)); }
.${P}-f1, .${P}-pg1 { --dx: -64px; --dy: 26px; }
.${P}-f2, .${P}-pg2 { --dx: -24px; --dy: 10px; }
.${P}-f3, .${P}-pg3 { --dx: 24px; --dy: 10px; }
.${P}-f4, .${P}-pg4 { --dx: 64px; --dy: 26px; }
.${P}-sello { --dx: 0px; --dy: -14px; }

/* La fila de dos tarjetas (7fr / 5fr desde 760) */
.${P}-par { display: grid; gap: 16px; }
.${P}-tarjeta { padding: 24px 22px; display: grid; gap: 16px; align-content: start; overflow: hidden; }
.${P}-h2-par { margin: 0; font: 900 clamp(30px, 8vw, 42px)/.94 var(--disp); letter-spacing: -.045em; text-wrap: balance; position: relative; z-index: 1; }
.${P} h2 em { font-style: normal; color: var(--marca); }
.${P}-rasgada h2 em { color: inherit; }
.${P}-items { display: grid; gap: 14px; }
.${P}-item { display: grid; grid-template-columns: 42px 1fr; gap: 14px; align-items: start; font-size: 14.5px; line-height: 1.5; color: var(--tinta-2); }
.${P}-item i { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; background: var(--pastilla); border: 1px solid var(--borde); color: var(--marca); }
.${P}-item b { color: var(--tinta); display: block; font: 700 16px/1.3 var(--ui); margin-bottom: 2px; }
.${P}-paso { display: grid; grid-template-columns: 44px 1fr; gap: 14px; align-items: center; position: relative; z-index: 5; }
.${P}-paso i { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; font: 900 20px/1 var(--disp); font-style: normal; background: var(--negro); color: #fff; box-shadow: 0 0 0 4px #fff, 0 8px 14px rgba(70,40,50,.3); transform: rotate(5deg); }
.${P}-paso:nth-of-type(even) i { background: var(--marca); transform: rotate(-6deg); }
.${P}-paso b { display: block; font: 800 18px/1.15 var(--disp); letter-spacing: -.01em; }
.${P}-paso span { font-size: 14px; line-height: 1.5; color: var(--tinta-2); }

/* El comparador: dos cuadros de la misma grabación, el de después recortado desde la línea; se arrastra */
.${P}-cmp { position: relative; height: 190px; border-radius: 22px; overflow: hidden; background: #140D12; border: 1px solid rgba(255,255,255,.09); margin-top: 2px; touch-action: pan-y; cursor: ew-resize; user-select: none; }
.${P}-cmp-capa { position: absolute; inset: 0; overflow: hidden; }
/* Acercada a la línea de tiempo y al reproductor: la imagen entera (1280 × 800) se ve chica en la tarjeta */
.${P}-cmp-capa img { position: absolute; left: 0; bottom: 0; width: max(100%, 500px); height: auto; max-width: none; display: block; }
.${P}-cmp-despues { clip-path: inset(0 0 0 var(--x)); }
.${P}-rot { position: absolute; top: 12px; z-index: 2; font: 500 10.5px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; padding: 7px 9px; border-radius: 8px; pointer-events: none; }
.${P}-rot-a { left: 12px; background: #1D2740; color: #CFE0FF; }
.${P}-rot-d { right: 12px; background: #13261B; color: var(--verde); }
.${P}-mango { position: absolute; top: 0; bottom: 0; left: var(--x); width: 3px; margin-left: -1.5px; background: #fff; pointer-events: none; z-index: 2; }
.${P}-mango span { position: absolute; top: 50%; left: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%; background: var(--marca); color: #fff; display: grid; place-items: center; box-shadow: 0 0 0 5px #fff, 0 12px 22px rgba(0,0,0,.5); }
.${P}-mango svg, .${P}-cmp-pista svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.${P}-cmp-pista { position: absolute; left: var(--x); top: calc(50% + 32px); translate: -50%; z-index: 3; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px 8px; border-radius: 99px; background: #fff; color: var(--negro); font: 700 20px/1 var(--mano); pointer-events: none; box-shadow: 0 10px 18px rgba(0,0,0,.45); transition: opacity .4s; animation: ${P}-empuja 1.6s ease-in-out infinite; }
.${P}-cmp-pista svg { width: 18px; height: 18px; stroke-width: 2.2; }
@keyframes ${P}-empuja { 0%, 100% { translate: -50%; } 50% { translate: calc(-50% + 9px); } }
.${P}-cmp.${P}-usado .${P}-cmp-pista { opacity: 0; }
.${P}-cmp-rango { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: ew-resize; margin: 0; z-index: 4; }

/* «Lo que hace»: la lista que avanza sola (radios con su label) y el marco 4:5 */
.${P}-hace { padding: 26px 18px 30px; display: grid; gap: 26px; overflow: hidden; }
.${P}-hace-lista { display: grid; gap: 8px; align-content: start; }
.${P}-h2-hace { margin: 6px 0 4px; font: 900 clamp(34px, 9vw, 58px)/.9 var(--disp); letter-spacing: -.045em; text-wrap: balance; }
.${P}-pista { display: inline-flex; align-items: center; gap: 6px; font: 700 23px/1 var(--mano); color: var(--marca-h); pointer-events: none; animation: ${P}-flota 2.4s ease-in-out infinite; transition: opacity .4s; white-space: nowrap; }
.${P}-pista svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.${P}-pista .${P}-flecha { width: 38px; height: 26px; }
.${P}-pista .${P}-dedo { animation: ${P}-toque 1.5s ease-in-out infinite; transform-origin: 50% 85%; }
.${P}-pista-hace { margin: 2px 0 2px 4px; }
.${P}-usado .${P}-pista-hace, .${P}-pista.${P}-usado { opacity: 0; }
@keyframes ${P}-flota { 50% { translate: 0 -4px; } }
@keyframes ${P}-toque { 0%, 55%, 100% { scale: 1; } 25% { scale: .8; } }
.${P}-paso-hace { position: relative; }
.${P}-radio { position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px; margin: 0; }
.${P}-ph { cursor: pointer; display: grid; grid-template-columns: 50px 1fr; gap: 14px; align-items: start; padding: 14px 14px 14px 10px; border-radius: 22px; border: 1px solid transparent; transition: background .3s, border-color .3s; -webkit-tap-highlight-color: transparent; }
.${P}-ph:hover { background: var(--foco); }
.${P}-radio:checked + .${P}-ph { background: #fff; border-color: var(--borde); box-shadow: 0 14px 28px -20px var(--sombra); }
.${P}-radio:focus-visible + .${P}-ph { outline: 2px solid var(--marca); outline-offset: 2px; }
.${P}-n { position: relative; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; background: var(--negro); color: #fff; font: 900 22px/1 var(--disp); box-shadow: 0 0 0 4px #fff, 0 8px 14px rgba(70,40,50,.3); transform: rotate(-7deg); transition: background .3s, color .3s, transform .4s cubic-bezier(.34,1.56,.64,1); }
.${P}-ph1 .${P}-n, .${P}-ph3 .${P}-n { transform: rotate(6deg); }
.${P}-radio:checked + .${P}-ph .${P}-n { background: var(--marca); color: #fff; transform: rotate(-3deg) scale(1.08); }
.${P}-ph-txt { display: grid; gap: 6px; padding-top: 2px; }
.${P}-ph b { font: 900 21px/1.05 var(--disp); letter-spacing: -.02em; color: var(--tinta-2); transition: color .3s; }
.${P}-radio:checked + .${P}-ph b { color: var(--tinta); }
.${P}-ph-p { font-size: 14.5px; line-height: 1.45; color: var(--tinta-2); max-height: 0; overflow: hidden; transition: max-height .5s; }
.${P}-radio:checked + .${P}-ph .${P}-ph-p { max-height: 140px; }
.${P}-avance { display: block; height: 3px; border-radius: 9px; background: var(--pastilla); overflow: hidden; margin-top: 4px; opacity: 0; transition: opacity .3s; }
.${P}-avance i { display: block; height: 100%; width: 0; background: var(--marca); }
.${P}-radio:checked + .${P}-ph .${P}-avance { opacity: 1; }
.${P}-radio:checked + .${P}-ph .${P}-avance i { animation: ${P}-llena 7.5s linear forwards; }
.${P}-quieto .${P}-avance i { animation-play-state: paused !important; }
@keyframes ${P}-llena { to { width: 100%; } }
/* El paso que sigue late (un anillo ámbar) hasta que la persona toca uno */
.${P}-hace:has(.${P}-r0:checked) .${P}-ph1 .${P}-n::after, .${P}-hace:has(.${P}-r1:checked) .${P}-ph2 .${P}-n::after,
.${P}-hace:has(.${P}-r2:checked) .${P}-ph3 .${P}-n::after, .${P}-hace:has(.${P}-r3:checked) .${P}-ph0 .${P}-n::after {
  content: ''; position: absolute; inset: -7px; border-radius: 18px; border: 2px solid var(--ambar); animation: ${P}-late 1.5s ease-out infinite; }
.${P}-hace.${P}-usado .${P}-n::after { display: none !important; }
@keyframes ${P}-late { 0% { opacity: .95; scale: .9; } 100% { opacity: 0; scale: 1.35; } }
.${P}-hace-tel { position: relative; justify-self: center; width: min(74vw, 320px); aspect-ratio: 4 / 5; }
.${P}-marco { position: absolute; inset: 0; border-radius: 30px; overflow: hidden; background: #0B0709; box-shadow: 0 34px 60px -26px rgba(50,20,35,.6); z-index: 2; }
.${P}-escena { position: absolute; inset: 0; overflow: hidden; opacity: 0; transition: opacity .45s; background: #EEE6E2; }
.${P}-escena video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.${P}-escena .mk-falta { height: 100%; min-height: 0; aspect-ratio: auto; border-radius: 0; border-width: 0; padding: 22px; }
.${P}-escena .mk-falta-t { font-size: 15px; }
.${P}-hace:has(.${P}-r0:checked) .${P}-escena0, .${P}-hace:has(.${P}-r1:checked) .${P}-escena1,
.${P}-hace:has(.${P}-r2:checked) .${P}-escena2, .${P}-hace:has(.${P}-r3:checked) .${P}-escena3 { opacity: 1; }
.${P}-hace-pega { display: none; top: -14px; right: -8px; transform: rotate(7deg); z-index: 5; font-size: 14px; }
.${P}-hace:has(.${P}-r0:checked) .${P}-hace-pega0, .${P}-hace:has(.${P}-r1:checked) .${P}-hace-pega1,
.${P}-hace:has(.${P}-r2:checked) .${P}-hace-pega2, .${P}-hace:has(.${P}-r3:checked) .${P}-hace-pega3 { display: block; animation: ${P}-salta .55s cubic-bezier(.34,1.56,.64,1); }
@keyframes ${P}-salta { 0% { scale: 1.45; opacity: 0; } 100% { scale: 1; opacity: 1; } }

/* Las bandas de papel rasgado: el papel crema 5 px más alto detrás, el color de marca, el grano, los lunares y la palabra calada */
.${P}-banner { position: relative; }
.${P}-banner::before { content: ''; position: absolute; inset: -5px 0; background: #F7F1EA; z-index: 0; pointer-events: none; -webkit-mask: ${MASCARA}; mask: ${MASCARA}; }
.${P}-banner > .${P}-disco { z-index: 8; }
.${P}-rasgada { position: relative; z-index: 1; border-radius: 3px; overflow: hidden; isolation: isolate; color: var(--negro); -webkit-mask: ${MASCARA}; mask: ${MASCARA}; }
.${P}-rasgada::after { content: ''; position: absolute; inset: 0; background-image: var(--grano); background-size: 180px auto; opacity: .05; pointer-events: none; }
.${P}-rasgada > * { position: relative; z-index: 1; }
.${P}-rasgada .${P}-etq { color: rgba(11,7,9,.7); }
.${P}-rasgada > .${P}-lunares, .${P}-rasgada > .${P}-aguamarca { position: absolute; z-index: 0; }
.${P}-lunares { inset: 0; pointer-events: none; opacity: .5; background-image: radial-gradient(rgba(11,7,9,.28) 1.4px, transparent 1.6px); background-size: 14px 14px; -webkit-mask-image: radial-gradient(120% 90% at 100% 100%, #000 10%, transparent 60%); mask-image: radial-gradient(120% 90% at 100% 100%, #000 10%, transparent 60%); }
.${P}-aguamarca { pointer-events: none; font: 900 clamp(120px, 30vw, 300px)/.8 var(--disp); letter-spacing: -.06em; white-space: nowrap; color: transparent; -webkit-text-stroke: 2px rgba(11,7,9,.16); translate: var(--corre, 0px) 0; }
.${P}-hojacalcas { padding: 30px 20px 26px; background: radial-gradient(90% 70% at 20% 0%, var(--marca-luz), transparent 60%), linear-gradient(160deg, var(--marca), var(--marca-h)); box-shadow: 0 40px 80px -40px rgba(47,111,237,.6); }
.${P}-hojacalcas .${P}-aguamarca { right: -30px; bottom: -40px; }
.${P}-h2-hoja { margin: 8px 0 0; font: 900 clamp(38px, 10vw, 66px)/.9 var(--disp); letter-spacing: -.045em; text-wrap: balance; max-width: 13ch; }
.${P}-cruza-arriba { width: 96px; height: 96px; right: 18px; top: -46px; transform: rotate(12deg); }
.${P}-cruza-arriba svg { width: 54%; height: 54%; }
.${P}-pliego { position: relative; margin-top: 24px; padding: 22px 16px 20px; border-radius: 28px; background: #F6F9FF; transform: rotate(-1.2deg); box-shadow: 0 30px 60px -24px rgba(0,25,80,.7), inset 0 0 0 2px rgba(47,111,237,.12); }
.${P}-pliego::before { content: ''; position: absolute; inset: 10px; border: 2px dashed rgba(47,111,237,.28); border-radius: 20px; pointer-events: none; }
.${P}-etq-pliego { color: rgba(11,7,9,.55) !important; text-align: center; display: block; margin-bottom: 14px; }
.${P}-pista-pliego { position: absolute; right: 18px; top: -30px; color: #12357F; z-index: 3; }
.${P}-tiras { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px; }
.${P}-tira { display: grid; gap: 6px; justify-items: center; text-align: center; }
.${P}-calca { width: min(100%, 150px); aspect-ratio: 1; margin: 6px 0 4px; border-radius: 50%; display: grid; place-items: center; background: #fff; color: var(--negro); box-shadow: 0 0 0 7px #fff; filter: drop-shadow(0 12px 14px rgba(0,25,80,.32)); transition: opacity .35s, scale .55s cubic-bezier(.34,1.56,.64,1); }
.${P}-calca svg { width: 44%; height: 44%; }
.${P}-calca-0 { background: var(--negro); color: #fff; transform: rotate(-6deg); }
.${P}-calca-1 { background: var(--marca); color: #fff; transform: rotate(6deg); }
.${P}-calca-2 { background: #F2B01E; color: var(--negro); transform: rotate(-6deg); }
.${P}-calca-3 { background: var(--crema); color: var(--negro); transform: rotate(6deg); }
.${P}-tira b { font: 900 22px/1 var(--disp); letter-spacing: -.02em; background: var(--negro); color: #fff; padding: 8px 13px 10px; border-radius: 10px; box-shadow: 0 0 0 4px #fff; transform: rotate(-2deg); }
.${P}-tira > span:last-child { font-size: 13.5px; line-height: 1.35; color: rgba(11,7,9,.8); max-width: 24ch; font-weight: 500; }
.${P}-ademas { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 24px; }
.${P}-ademas span { font: 800 14px/1 var(--disp); background: #fff; color: var(--negro); padding: 10px 14px; border-radius: 999px; }

/* Preguntas: la cabecera suelta y el panel; el + gira a × */
.${P}-titular { padding: 28px 6px 2px; display: grid; gap: 8px; }
.${P}-h2-tit { margin: 0; font: 900 clamp(36px, 9.5vw, 62px)/.9 var(--disp); letter-spacing: -.045em; text-wrap: balance; }
.${P}-preguntas { padding: 8px 22px; display: grid; }
.${P}-preguntas details { border-bottom: 1px solid var(--borde); }
.${P}-preguntas summary { list-style: none; cursor: pointer; padding: 17px 0; display: flex; justify-content: space-between; gap: 14px; font: 700 15.5px/1.35 var(--ui); }
.${P}-preguntas summary::-webkit-details-marker { display: none; }
.${P}-preguntas summary::after { content: '+'; font: 400 24px/1 var(--ui); color: var(--marca-h); transition: transform .2s; }
.${P}-preguntas details[open] summary::after { transform: rotate(45deg); }
.${P}-preguntas details p { padding: 0 0 17px; color: var(--tinta-2); font-size: 14.5px; line-height: 1.5; }

/* La banda final: rasgada, centrada, titular de 92 px, la palabra calada y el abanico cortado por el borde */
.${P}-final { padding: 66px 22px 0; text-align: center; display: grid; gap: 18px; justify-items: center; background: radial-gradient(80% 80% at 50% 0%, var(--marca-luz), transparent 60%), linear-gradient(180deg, var(--marca), var(--marca-h)); }
.${P}-final .${P}-aguamarca { left: 50%; top: 18px; transform: translateX(-50%); }
.${P}-etq-final { position: relative; z-index: 5; }
.${P}-h2-final { margin: 0; font: 900 clamp(44px, 12vw, 92px)/.88 var(--disp); letter-spacing: -.05em; max-width: 12ch; text-wrap: balance; position: relative; z-index: 5; }
.${P}-final-p { font-size: 16px; line-height: 1.5; font-weight: 500; max-width: 40ch; position: relative; z-index: 5; }
.${P}-final .${P}-acciones { justify-content: center; }
.${P}-abanico { position: relative; width: 100%; height: 190px; margin-top: 10px; z-index: 2; }
.${P}-abanico span { position: absolute; bottom: -70px; width: 150px; aspect-ratio: 4 / 5; border-radius: 20px; overflow: hidden; background: #0B0709; border: 3px solid #0B0709; box-shadow: 0 -10px 40px -10px rgba(0,25,80,.6); }
.${P}-abanico span video { width: 100%; height: 100%; object-fit: cover; display: block; }
.${P}-abanico span:nth-child(1) { left: calc(50% - 205px); transform: rotate(-10deg); }
.${P}-abanico span:nth-child(2) { left: calc(50% - 75px); bottom: -40px; z-index: 2; }
.${P}-abanico span:nth-child(3) { left: calc(50% + 55px); transform: rotate(10deg); }

/* Pie centrado */
.${P}-pie { padding: 26px 8px 0; display: grid; gap: 14px; justify-items: center; text-align: center; }
.${P}-pie > a { opacity: .85; }
.${P}-pie nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; font-size: 14px; max-width: 760px; }
.${P}-pie nav a { color: var(--tinta-2); text-decoration: none; }
.${P}-pie p { font-size: 12.5px; line-height: 1.5; color: var(--tinta-3); max-width: 60ch; }

/* El botón fijo del teléfono */
.${P}-fijo { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(rgba(11,7,9,0), rgba(11,7,9,.92) 32%); transform: translateY(110%); transition: transform .3s; z-index: 30; }
.${P}-fijo.${P}-ver { transform: none; }
.${P}-fijo .${P}-btn { width: 100%; max-width: 520px; margin: 0 auto; display: flex; }

/* La entrada al bajar (sólo lo que empieza fuera de la pantalla; las clases las pone el script) */
.${P}-rv { transition: opacity .8s cubic-bezier(.16,1,.3,1), translate .8s cubic-bezier(.16,1,.3,1); }
.${P}-rv.${P}-espera { opacity: 0; translate: 0 34px; }
.${P}-pegable { transition: opacity .35s, scale .55s cubic-bezier(.34,1.56,.64,1); }
.${P}-pegable.${P}-espera { opacity: 0; scale: 1.45; }

/* La barra de desplazamiento de Cherry (su scroll.css), con el azul al pasar el mouse */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background-color: rgba(128,108,118,.42); border-radius: 99px; border: 3px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover, ::-webkit-scrollbar-thumb:active { background-color: #2F6FED; }

@media (max-width: 560px) {
  .${P}-barra nav a:not(.${P}-barra-btn) { display: none; }
  .${P}-barra { padding: 8px 8px 8px 14px; }
  .${P}-barra nav a.${P}-barra-btn { padding: 11px 14px; font-size: 13.5px; }
}
@media (min-width: 760px) {
  .${P} { padding: 16px 24px 60px; }
  .${P}-fijo { display: none; }
  .${P}-par { grid-template-columns: 7fr 5fr; align-items: stretch; }
  .${P}-par-uno { grid-template-columns: minmax(0, 560px); justify-content: center; }
  .${P}-hace { grid-template-columns: 1.1fr .9fr; align-items: center; padding: 48px 48px 48px 36px; column-gap: 40px; }
  .${P}-hace-tel { width: 360px; }
  .${P}-cmp { height: 240px; }
  .${P}-cmp-capa img { width: max(100%, 800px); }
  .${P}-hojacalcas { padding: 44px 40px 36px; }
  .${P}-tiras { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .${P}-calca { width: min(100%, 170px); }
  .${P}-preguntas { grid-template-columns: 1fr 1fr; column-gap: 40px; padding: 8px 32px; }
  .${P}-final { padding: 70px 40px 60px; }
  .${P}-abanico { height: 260px; }
  .${P}-abanico span { width: 210px; }
  .${P}-abanico span:nth-child(1) { left: calc(50% - 300px); }
  .${P}-abanico span:nth-child(2) { left: calc(50% - 105px); }
  .${P}-abanico span:nth-child(3) { left: calc(50% + 90px); }
}
@media (min-width: 900px) {
  .${P}-h1 { max-width: 25ch; }
}
@media (min-width: 960px) {
  .${P}-hero { padding: 64px 40px 0; }
  .${P}-vitrina { height: 350px; margin-top: 4px; }
  .${P}-t { width: 230px; }
  .${P}-f1 { left: calc(50% - 470px); bottom: -80px; }
  .${P}-f2 { left: calc(50% - 245px); }
  .${P}-f3 { left: calc(50% + 15px); }
  .${P}-f4 { left: calc(50% + 240px); bottom: -80px; }
  .${P}-vitrina .${P}-pega { font-size: 16px; padding: 11px 15px 12px; }
  .${P}-pg1 { left: calc(50% - 505px); bottom: 188px; }
  .${P}-pg2 { display: block; left: calc(50% - 262px); bottom: 232px; transform: rotate(-4deg); }
  .${P}-pg3 { display: block; left: calc(50% + 150px); bottom: 236px; transform: rotate(6deg); }
  .${P}-pg4 { right: auto; left: calc(50% + 395px); bottom: 176px; }
  .${P}-sello { width: 82px; height: 82px; left: calc(50% - 41px); bottom: 250px; }
}
@media (prefers-reduced-motion: reduce) {
  .${P} *, .${P} *::before, .${P} *::after { animation: none !important; transition: none !important; }
  .${P}-rv.${P}-espera, .${P}-pegable.${P}-espera { opacity: 1; translate: none; scale: 1; }
}
`;

// =============================================================================
// LAS INTERACCIONES (las de su script, reescritas): un <script data-visor> porque el visor borra los demás. Corre cuando React ya
// tomó la página (cambiarle clases a sus nodos antes rompe la hidratación: hallazgos-landing, «el sitio no se hidrata»), o en el
// acto sin Next (el visor). Empieza limpiando lo que pudo quedar congelado en una foto del DOM (pulir.mjs guarda la página DESPUÉS
// de correr este script).
//   · videos: corren a lo sumo 4 a la vez (2 en el teléfono), los que se ven, y se frenan mientras se baja;
//   · «Lo que hace»: cuando termina la barra de 7,5 s pasa al siguiente; la escena vuelve a empezar; fuera de la vista se pausa;
//     al tocar un paso se va la pista y deja de latir el siguiente;
//   · el comparador se pasea solo una vez (1,8 s) al aparecer; la pista se va con el primer arrastre;
//   · la vitrina sigue al mouse (sólo con mouse) y se abre al bajar (--abre); la palabra calada corre con el scroll (--corre);
//   · lo que empieza fuera de la pantalla entra al bajar (34 px y opacidad; las calcomanías de 1,45× con un retraso al azar);
//   · las calcomanías se menean al tocarlas; el botón fijo del teléfono aparece entre el hero y la banda final.
// Con «menos movimiento»: nada corre solo (los videos quedan en su póster, sin entradas ni seguimiento del mouse).
// =============================================================================
const SCRIPT = `(function(){
var P='${P}';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function q(r,s){return r.querySelector(s);}
function qa(r,s){return [].slice.call(r.querySelectorAll(s));}
function jugar(v){if(!v)return;v.muted=true;if(v.preload!=='auto')v.preload='auto';var p=v.play();if(p&&p.catch)p.catch(function(){});}
function iniciar(){
  var R=q(document,'.'+P);if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches),IO='IntersectionObserver' in window;
  qa(R,'.'+P+'-espera').forEach(function(e){e.classList.remove(P+'-espera');});
  qa(R,'video').forEach(function(v){v.muted=true;if(!v.paused)v.pause();});
  // ── los videos de muestra ──
  var demos=qa(R,'video[data-demo]');
  if(!quieto&&IO){
    var TOPE=innerWidth<760?2:4,vistos=[],moviendo=false,tm=0;
    var repartir=function(){var sale=vistos.slice(0,TOPE);demos.forEach(function(v){if(!moviendo&&!document.hidden&&sale.indexOf(v)>=0){if(v.paused)jugar(v);}else if(!v.paused)v.pause();});};
    var ob=new IntersectionObserver(function(es){es.forEach(function(e){var i=vistos.indexOf(e.target);if(e.isIntersecting&&i<0)vistos.push(e.target);if(!e.isIntersecting&&i>=0)vistos.splice(i,1);});repartir();},{threshold:.3});
    demos.forEach(function(v){ob.observe(v);});
    addEventListener('scroll',function(){if(!moviendo){moviendo=true;repartir();}clearTimeout(tm);tm=setTimeout(function(){moviendo=false;repartir();},180);},{passive:true});
    document.addEventListener('visibilitychange',repartir);
  }
  // ── «Lo que hace» ──
  var hace=q(R,'.'+P+'-hace');
  if(hace){
    var radios=qa(hace,'.'+P+'-radio'),escenas=qa(hace,'.'+P+'-escena'),enVista=false;
    var activo=function(){for(var i=0;i<radios.length;i++)if(radios[i].checked)return i;return 0;};
    var correr=function(){escenas.forEach(function(e,k){var v=q(e,'video');if(!v)return;if(k===activo()&&enVista&&!quieto){try{v.currentTime=0;}catch(x){}jugar(v);}else if(!v.paused)v.pause();});};
    var reiniciarBarra=function(k){var b=q(hace,'.'+P+'-ph'+k+' .'+P+'-avance i');if(b){b.style.animation='none';void b.offsetWidth;b.style.animation='';}};
    hace.classList.add(P+'-quieto');hace.classList.remove(P+'-usado');
    if(!radios.some(function(r){return r.checked;})&&radios[0])radios[0].checked=true;
    reiniciarBarra(activo());
    radios.forEach(function(r,k){
      r.addEventListener('change',function(){if(r.checked){hace.classList.add(P+'-usado');reiniciarBarra(k);correr();}});
      var barra=q(hace,'.'+P+'-ph'+k+' .'+P+'-avance i');
      if(barra)barra.addEventListener('animationend',function(){if(k!==activo())return;var n=(k+1)%radios.length;radios[n].checked=true;reiniciarBarra(n);correr();});
    });
    if(IO)new IntersectionObserver(function(es){es.forEach(function(e){enVista=e.isIntersecting;hace.classList.toggle(P+'-quieto',!enVista);
      var v=q(escenas[activo()]||hace,'video');if(enVista&&!quieto){if(v&&v.paused)jugar(v);}else if(v&&!v.paused)v.pause();});},{threshold:.35}).observe(hace);
    else hace.classList.remove(P+'-quieto');
  }
  // ── el comparador ──
  var cmp=q(R,'.'+P+'-cmp');
  if(cmp){var rango=q(cmp,'input');var mover=function(v){cmp.style.setProperty('--x',v+'%');};
    cmp.classList.remove(P+'-usado');rango.value=50;mover(50);
    rango.addEventListener('input',function(e){mover(rango.value);if(e.isTrusted)cmp.classList.add(P+'-usado');});
    if(!quieto&&IO){var visto=false;var obc=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting||visto)return;visto=true;obc.disconnect();
      var t0=null;var paseo=function(ts){if(!t0)t0=ts;var f=Math.min(1,(ts-t0)/1800);var v=50+Math.sin(f*Math.PI*2)*28;mover(v.toFixed(2));rango.value=v;if(f<1)requestAnimationFrame(paseo);};requestAnimationFrame(paseo);});},{threshold:.6});obc.observe(cmp);}
  }
  // ── la vitrina sigue al mouse ──
  var hero=q(R,'.'+P+'-hero');
  if(hero){hero.style.setProperty('--mx',0);hero.style.setProperty('--my',0);hero.style.setProperty('--abre',0);}
  if(hero&&!quieto&&window.matchMedia&&matchMedia('(pointer: fine)').matches){
    hero.addEventListener('pointermove',function(e){var r=hero.getBoundingClientRect();hero.style.setProperty('--mx',(((e.clientX-r.left)/r.width-.5)*2).toFixed(3));hero.style.setProperty('--my',(((e.clientY-r.top)/r.height-.5)*2).toFixed(3));});
    hero.addEventListener('pointerleave',function(){hero.style.setProperty('--mx',0);hero.style.setProperty('--my',0);});
  }
  // ── las calcomanías se menean al tocarlas ──
  qa(R,'.'+P+'-toca').forEach(function(el){el.classList.remove(P+'-menea');el.addEventListener('click',function(){el.classList.remove(P+'-menea');void el.offsetWidth;el.classList.add(P+'-menea');var pl=el.closest('.'+P+'-pliego');if(pl){var pi=q(pl,'.'+P+'-pista');if(pi)pi.classList.add(P+'-usado');}});});
  // ── la entrada al bajar ──
  if(!quieto&&IO){
    var alto=innerHeight;
    var ob2=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var el=e.target,ret=el.classList.contains(P+'-pegable')?180+Math.random()*260:0;setTimeout(function(){el.classList.remove(P+'-espera');},ret);ob2.unobserve(el);});},{threshold:.15});
    qa(R,'.'+P+'-titular, .'+P+'-hojacalcas, .'+P+'-par > section, .'+P+'-preguntas, .'+P+'-final, .'+P+'-hace').forEach(function(el){el.classList.add(P+'-rv');if(el.getBoundingClientRect().top>alto){el.classList.add(P+'-espera');ob2.observe(el);}});
    qa(R,'.'+P+'-banner > .'+P+'-disco, .'+P+'-tira .'+P+'-calca').forEach(function(el){el.classList.add(P+'-pegable');if(el.getBoundingClientRect().top>alto){el.classList.add(P+'-espera');ob2.observe(el);}});
  }
  // ── lo que reacciona con el scroll ──
  var aguas=qa(R,'.'+P+'-aguamarca'),fijo=q(R,'.'+P+'-fijo'),primero=hero?q(hero,'.'+P+'-primero'):null,fin=q(R,'.'+P+'-final'),pend=false;
  if(fijo)fijo.classList.remove(P+'-ver');
  var alScroll=function(){pend=false;var vh=innerHeight,r;
    if(hero&&!quieto){r=hero.getBoundingClientRect();hero.style.setProperty('--abre',Math.max(0,Math.min(1,-r.top/(r.height*.7))).toFixed(3));}
    if(!quieto)aguas.forEach(function(a){var p=a.parentNode.getBoundingClientRect(),pa=Math.max(0,Math.min(1,(vh-p.top)/(vh+p.height)));a.style.setProperty('--corre',((pa-.5)*240).toFixed(1)+'px');});
    if(fijo&&primero&&fin){var a1=primero.getBoundingClientRect(),b1=fin.getBoundingClientRect();fijo.classList.toggle(P+'-ver',a1.bottom<0&&b1.top>vh);}
  };
  addEventListener('scroll',function(){if(!pend){pend=true;requestAnimationFrame(alScroll);}},{passive:true});
  addEventListener('resize',alScroll);alScroll();
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;
