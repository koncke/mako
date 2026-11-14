// =============================================================================
// /vsl/ai-avatar con el DISEÑO de la página de HeyGen para anuncios UGC (copiado el 11/11/2026, rehecho fiel el 14/11/2026)
// =============================================================================
// Referencia: https://www.heygen.com/es-mx/business/marketing/ugc-video-ads — los valores medidos con getComputedStyle a
// 1440 y a 390 px están en docs/diseno/landings-competencia/ai-avatar.md; el relevo del 14/11 (capturas, video, hovers con su
// tiempo), en las notas de la sesión: referencias-landings/ai-avatar/relevo.md.
// Se copió la página entera: la miga de pan con sus flechas, el hero de dos columnas con el titular gigante y el REPRODUCTOR de
// video de HeyGen (la caja negra de radio 24, el botón de play agrandado 2,4 veces al centro y la barra de controles que flota sobre
// el borde de abajo: play, la línea con su perilla en forma de gota, sonido y pantalla completa; se ve hasta que el video arranca y
// después sólo con el mouse encima), la banda gris de radio 70 con las tarjetas negras de números, la CINTA que corre debajo (25 s
// por vuelta, se frena con el mouse y tiene su botón de pausa) y su renglón con la línea fina, los encabezados de sección con el
// botón abajo a la derecha, las dos tarjetas «Sin / Con», las filas alternadas dentro de tarjetas crema con radio 80, los pasos con
// su pastilla «Paso N», la grilla de casos de uso, la tarjeta de testimonio con el video a la derecha y su botón «Ver video» encima,
// las preguntas en tarjetas grises con el título PEGADO a la izquierda mientras se bajan, y la banda final con su degradado.
// Los botones cambian como los suyos: el de marca pasa al color oscuro de la marca con la letra en el claro, y el negro pasa al de
// marca (en 0,15 s, sin moverse ni achicarse).
// Fuentes: HeyGen usa «ABC Solar Display» (títulos) y «TT Norms Pro» (texto), las dos de pago; acá van Gabarito y Figtree
// (Google Fonts, OFL), las más parecidas, servidas desde /vsl-assets/fuentes/.
// De MaKo: el azul #2F6FED donde HeyGen pone su cian (#00C3FF), el azul claro #6E9BF5 donde pone el cian sobre oscuro, el marino
// #0B2150 donde pone su verde petróleo (#033337), el dorado de la perilla donde pone su rosa, el caso de Mauricio en la tarjeta de
// testimonio y, en el reproductor, el anuncio REAL hecho con AI Avatar (el de Martín, con su voz: el mismo de la portada).
// Lo que NO se copió, y por qué:
//   · Sus logos de clientes en la cinta: son prueba social de HeyGen. La cinta lleva los lugares donde va el anuncio vertical
//     (Instagram, TikTok, Facebook y Meta), con el renglón que lo dice.
//   · Su sección de reseñas de G2 (estrellas, 10X / 5X / 40 %, insignias): son premios de HeyGen.
//   · Las flechas del carrusel de testimonios: hay un solo caso, el de Mauricio.
//   · «Explora más soluciones» (tres columnas de links): las otras funciones de MaKo van en el pie del sitio.
//   · Las imágenes de las tarjetas «Sin / Con» (un esquema de tiempos con días y una captura de su app): MaKo no tiene una
//     pieza que diga eso sin inventar los días.
// La barra y el pie de abajo son los del sitio (BarraGlobal y PieGlobal los reemplazan); los de este archivo quedan ocultos.
// Server component: las interacciones (el reproductor, el «Ver video») son un <script data-visor> (el visor de Martín borra los
// demás) que corre cuando React ya tomó la página; los botones son <label> de casillas ocultas (un <button> sin onClick lo marca
// tests/ningun-boton-muerto). Con «menos movimiento», la cinta queda quieta.
// =============================================================================

import type { PropsDiseno } from '.';
import { Icon } from '../../_detalle/FeatureDetail';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import type { Bloque } from '../tipos';
import { VisualDeLanding } from '../Visuales';

type Hero = Extract<Bloque, { tipo: 'hero' }>;
const P = 'd-ai-avatar';

/** El video del reproductor del hero: el anuncio REAL de Martín hecho con AI Avatar, con su voz (el de la portada, app/vsl/_sitio/
 *  datos.ts → VIDEOS_AVATAR). El póster es su primer cuadro. HeyGen pone ahí el video de un avatar suyo hablando a cámara. */
const VIDEO_HERO = { video: '/vsl-assets/sitio/avatar/martin.webm', poster: '/vsl-assets/sitio/avatar/martin.jpg' } as const;

/** Un anuncio REAL de avatar distinto en cada tarjeta (el Cerebro, 14/11/2026: «si hay más anuncios reales de avatar, usa uno distinto
 *  en cada tarjeta»). Los de Martín: los dos clips de su personaje con su voz (C:/dev/reel-mentores/clips-final/). Los de Mauricio:
 *  los primeros 12 s de sus anuncios con IA (OneDrive/Escritorio/Mauricio: el quinto, el primero, el sexto y el cuarto), sin sonido.
 *  El de Martín entero ya está en el reproductor del hero: en las filas va primero su clip corto y el entero al final. */
const ANUNCIOS_AVATAR: readonly { id: string; nombre: string }[] = [
  { id: 'martin-2', nombre: 'Martín' },
  { id: 'mauricio', nombre: 'Mauricio' },
  { id: 'mauricio-2', nombre: 'Mauricio' },
  { id: 'mauricio-4', nombre: 'Mauricio' },
  { id: 'mauricio-3', nombre: 'Mauricio' },
  { id: 'martin', nombre: 'Martín' },
];

/** La cinta de la banda gris. HeyGen pasa ahí los logos de sus clientes; AI Avatar no tiene clientes que mostrar: van los lugares
 *  donde se publica el video vertical que genera (lo dice la pregunta «¿En qué formato sale?» de ../ai-avatar.ts). Las formas
 *  son las de Simple Icons 13.21.0 (CC0), en un solo color como los logos de HeyGen. */
const PLATAFORMAS: readonly { nombre: string; d: string }[] = [
  { nombre: 'Instagram', d: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077' },
  { nombre: 'TikTok', d: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
  { nombre: 'Facebook', d: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z' },
  { nombre: 'Meta', d: 'M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z' },
];

function Flecha({ size = 16 }: { size?: number }) {
  // La flecha llena de HeyGen (la de sus botones y su miga de pan), dibujada de nuevo.
  return <svg width={size} height={size} viewBox="0 0 20 19" fill="none" aria-hidden="true"><path d="M13.5 11.9H.5V7.8h13L6.8.8h4.5l8.7 9.1-8.7 9.1H6.8z" fill="currentColor" /></svg>;
}

function Tilde() {
  return <svg className={`${P}-tilde`} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" /></svg>;
}

function Boton({ flecha = false, clase = '' }: { flecha?: boolean; clase?: string }) {
  // En las filas, HeyGen escribe la flecha como texto (« →»); en el hero es un dibujo.
  return <a href={RUTA_CTA} className={`${P}-btn ${clase}`}>{TEXTO_CTA}{flecha ? <span aria-hidden="true">&nbsp;→</span> : null}</a>;
}

/** La miga de pan de HeyGen (arriba del hero y arriba del pie): flechas llenas de 11 px y el último paso en el color de marca. */
function Miga({ hero, nombre, oscura = false }: { hero: Hero | undefined; nombre: string; oscura?: boolean }) {
  const sep = <span className={`${P}-miga-sep`}><Flecha size={11} /></span>;
  return (
    <nav className={`${P}-miga${oscura ? ` ${P}-miga-osc` : ''}`} aria-label="Ruta">
      <a href="/">Inicio</a>{sep}
      <a href="/vsl">Funcionalidades</a>{sep}
      <span>{nombre}</span>
      {hero ? <>{sep}<span className={`${P}-miga-act`}>{hero.etiqueta}</span></> : null}
    </nav>
  );
}

/** El encabezado de cada sección de HeyGen: el título enorme, su bajada debajo y el botón abajo a la derecha. */
function Cabeza({ titulo, bajada, comoTitulo = true }: { titulo: string; bajada?: string; comoTitulo?: boolean }) {
  return (
    <div className={`${P}-cabeza`}>
      <div className={`${P}-cabeza-txt`}>
        {comoTitulo ? <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(titulo)} /> : <h2 className={`${P}-h2`}>{titulo}</h2>}
        {bajada ? <p className={`${P}-cabeza-p`} dangerouslySetInnerHTML={html(bajada)} /> : null}
      </div>
      <Boton />
    </div>
  );
}

const IcPlay = () => <svg className={`${P}-ic-play`} width="15" height="17" viewBox="0 0 15 17" aria-hidden="true"><path d="M12.8 10.3c1.6-1 1.6-3.3 0-4.3L4 .4C2.2-.7 0 .6 0 2.6v11.1c0 2 2.2 3.3 4 2.2z" fill="currentColor" /></svg>;
const IcPausa = () => <svg className={`${P}-ic-pausa`} width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><rect x="1" y="1" width="4" height="14" rx="1.5" fill="currentColor" /><rect x="9" y="1" width="4" height="14" rx="1.5" fill="currentColor" /></svg>;

/**
 * El reproductor del hero, como el de HeyGen: la caja negra de radio 24 con el video, que arranca SOLO y sin sonido al verse; la
 * barra de controles flota sobre el borde de abajo (a 30 px de los costados y 14 px por debajo: play, la línea con su perilla,
 * sonido —arranca silenciado— y pantalla completa) y, mientras corre, sólo se ve con el mouse encima (0,2 s). Tocar el video lo
 * pausa o lo sigue; pausado, aparece el botón de play grande al centro (27 px agrandado 2,4 veces, radio 10) y la barra queda. HeyGen pone un video horizontal; el
 * de AI Avatar es vertical: va al centro y los costados los llena su primer cuadro desenfocado. Los botones son <label> de casillas
 * ocultas; el script del final (SCRIPT) las conecta con el video.
 */
function Reproductor() {
  const id = `${P}-rep`;
  return (
    <div className={`${P}-rep`} data-rep="" role="region" aria-label="Video: un anuncio hecho con AI Avatar">
      <input type="checkbox" id={`${id}-play`} className={`${P}-chk`} data-rep-play="" aria-label="Reproducir el video" />
      <input type="checkbox" id={`${id}-mudo`} className={`${P}-chk`} data-rep-mudo="" aria-label="Silenciar" defaultChecked />
      <input type="checkbox" id={`${id}-grande`} className={`${P}-chk`} data-rep-grande="" aria-label="Pantalla completa" />
      <label htmlFor={`${id}-play`} className={`${P}-rep-caja`} data-tema-fijo="">
        <span className={`${P}-rep-fondo`} style={{ backgroundImage: `url(${VIDEO_HERO.poster})` }} aria-hidden="true" />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={VIDEO_HERO.video} poster={VIDEO_HERO.poster} preload="metadata" playsInline aria-label="Un anuncio hecho con AI Avatar: el personaje de Martín diciendo su guion" />
        <span className={`${P}-rep-grande`} aria-hidden="true"><IcPlay /></span>
      </label>
      <div className={`${P}-rep-ctl`} role="group" aria-label="Controles del video" data-tema-fijo="">
        <label htmlFor={`${id}-play`} className={`${P}-rep-b`} title="Reproducir o pausar"><IcPlay /><IcPausa /></label>
        <span className={`${P}-rep-linea`}>
          <span className={`${P}-rep-pista`}><span className={`${P}-rep-relleno`} /></span>
          <span className={`${P}-rep-perilla`} aria-hidden="true" />
          <input type="range" min={0} max={1000} step={1} defaultValue={0} data-rep-linea="" aria-label="Posición del video" />
        </span>
        <label htmlFor={`${id}-mudo`} className={`${P}-rep-b`} title="Silenciar o activar el sonido">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" /><path className={`${P}-ic-on`} d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /><path className={`${P}-ic-off`} d="m23 9-6 6M17 9l6 6" /></svg>
        </label>
        <label htmlFor={`${id}-grande`} className={`${P}-rep-b`} title="Pantalla completa">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg>
        </label>
      </div>
    </div>
  );
}

/** La cinta de HeyGen: la pista con dos mitades iguales que corre hacia la izquierda (25 s por vuelta, lineal), se frena con el
 *  mouse encima y tiene su botón de pausa redondo a la derecha. Los bordes se funden con una máscara (8 % de cada lado). */
function Cinta() {
  const id = `${P}-cinta-pausa`;
  const vuelta = [...PLATAFORMAS, ...PLATAFORMAS];
  return (
    <div className={`${P}-cinta`}>
      <input type="checkbox" id={id} className={`${P}-chk`} aria-label="Pausar la animación" />
      <div className={`${P}-cinta-ver`} role="group" aria-label="Dónde se publica tu anuncio vertical">
        <div className={`${P}-cinta-pista`}>
          {[0, 1].map((mitad) => vuelta.map((p, i) => (
            <span key={`${mitad}-${i}`} className={`${P}-cinta-logo`} aria-hidden={mitad === 1 || i >= PLATAFORMAS.length ? true : undefined}>
              <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d={p.d} fill="currentColor" /></svg>{p.nombre}
            </span>
          )))}
        </div>
      </div>
      <label htmlFor={id} className={`${P}-cinta-pausa`} title="Pausar o seguir la animación">
        <svg className={`${P}-ic-pausa`} width="10" height="10" viewBox="0 0 14 16" aria-hidden="true"><rect x="1" y="1" width="4" height="14" rx="1" fill="currentColor" /><rect x="9" y="1" width="4" height="14" rx="1" fill="currentColor" /></svg>
        <svg className={`${P}-ic-play`} width="10" height="11" viewBox="0 0 15 17" aria-hidden="true"><path d="M12.8 10.3c1.6-1 1.6-3.3 0-4.3L4 .4C2.2-.7 0 .6 0 2.6v11.1c0 2 2.2 3.3 4 2.2z" fill="currentColor" /></svg>
      </label>
    </div>
  );
}

function DibujarBloque({ b, hero, icono, n }: { b: Bloque; hero: Hero | undefined; icono: string[]; n: number }) {
  switch (b.tipo) {
    case 'hero':
      return (
        <section className={`${P}-hero`}>
          <div className={`${P}-hero-in`}>
            <div className={`${P}-hero-txt`}>
              <Miga hero={b} nombre="AI Avatar" />
              <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
              <div className={`${P}-hero-baja`}>
                <p className={`${P}-hero-p`} dangerouslySetInnerHTML={html(b.bajada)} />
                {b.puntos?.length ? (
                  <ul className={`${P}-checks`}>
                    {b.puntos.map((p) => <li key={p}><Tilde /><span dangerouslySetInnerHTML={html(p)} /></li>)}
                  </ul>
                ) : null}
              </div>
              <a href={RUTA_CTA} className={`${P}-btn ${P}-btn-negro`}>{TEXTO_CTA}<Flecha /></a>
            </div>
            <div className={`${P}-hero-media`}><Reproductor /></div>
          </div>
        </section>
      );
    case 'cifras':
      return (
        <section className={`${P}-banda`} aria-label={b.titulo ?? 'En números'}>
          <div className={`${P}-banda-in`}>
            <ul className={`${P}-cifras`} data-tema-fijo="">
              {b.items.map((c) => (
                <li key={c.label}><span className={`${P}-cifra-v`}>{c.valor}</span><span className={`${P}-cifra-l`}>{c.label}</span></li>
              ))}
            </ul>
            <Cinta />
            {b.titulo ? <p className={`${P}-banda-pie`}><span>{b.titulo}</span></p> : null}
          </div>
        </section>
      );
    case 'contraste':
      return (
        <section className={`${P}-sec`}>
          {/* HeyGen: «El reto del marketing» como título y una frase debajo. La etiqueta del bloque es ese título corto. */}
          {b.etiqueta ? <Cabeza titulo={b.etiqueta} bajada={b.titulo} comoTitulo={false} /> : <Cabeza titulo={b.titulo} />}
          <div className={`${P}-reto`}>
            <div className={`${P}-reto-c`}>
              <div><span className={`${P}-pil`}>Sin MaKo</span><h3 className={`${P}-h3`} dangerouslySetInnerHTML={html(b.sin.titulo)} /></div>
              <p className={`${P}-reto-p`} dangerouslySetInnerHTML={html(b.sin.texto)} />
            </div>
            <div className={`${P}-reto-c`}>
              <div><span className={`${P}-pil`}>Con MaKo</span><h3 className={`${P}-h3`} dangerouslySetInnerHTML={html(b.con.titulo)} /></div>
              <p className={`${P}-reto-p`} dangerouslySetInnerHTML={html(b.con.texto)} />
            </div>
          </div>
        </section>
      );
    case 'tarjetas':
      // HeyGen tiene dos secciones de tarjetas: primero las filas alternadas de capacidades y, después de los pasos, la
      // grilla de tres columnas «Diseñado para todas tus necesidades». La primera tarjeta de la landing va a las filas.
      if (n > 0) {
        return (
          <section className={`${P}-sec`}>
            <Cabeza titulo={b.titulo} bajada={b.bajada} />
            <div className={`${P}-usos`}>
              {b.items.map((t) => (
                <div key={t.titulo} className={`${P}-uso`}>
                  <span className={`${P}-uso-ic`}><Icon paths={t.icono ?? icono} size={30} /></span>
                  <h3 className={`${P}-uso-t`} dangerouslySetInnerHTML={html(t.titulo)} />
                  <p className={`${P}-uso-p`} dangerouslySetInnerHTML={html(t.texto)} />
                </div>
              ))}
            </div>
          </section>
        );
      }
      return (
        <section className={`${P}-sec`}>
          <Cabeza titulo={b.titulo} bajada={b.bajada} />
          <div className={`${P}-filas`}>
            {b.items.map((t, i) => {
              const a = ANUNCIOS_AVATAR[i % ANUNCIOS_AVATAR.length];
              return (
                <div key={t.titulo} className={`${P}-fila${i % 2 ? ` ${P}-fila-inv` : ''}`}>
                  {/* El anuncio REAL hecho con AI Avatar, uno por fila: HeyGen pone ahí una imagen de su app sobre un fondo pastel. */}
                  <div className={`${P}-panel ${P}-panel-${i % 3}`}>
                    <span className={`${P}-panel-tel`} data-tema-fijo="">
                      <video src={`/vsl-assets/sitio/avatar/${a.id}.webm`} poster={`/vsl-assets/sitio/avatar/${a.id}.jpg`}
                        muted autoPlay loop playsInline preload="none" aria-label={`Un anuncio hecho con AI Avatar: ${a.nombre}`} />
                    </span>
                  </div>
                  <div className={`${P}-fila-txt`}>
                    <div>
                      <h3 className={`${P}-fila-h`} dangerouslySetInnerHTML={html(t.titulo)} />
                      <p className={`${P}-fila-p`} dangerouslySetInnerHTML={html(t.texto)} />
                    </div>
                    <Boton flecha />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    case 'pasos':
      return (
        <section className={`${P}-sec`}>
          <Cabeza titulo={b.titulo} bajada={b.bajada} />
          <ol className={`${P}-pasos`}>
            {b.pasos.map((p, i) => (
              <li key={p.titulo} className={`${P}-paso${i % 2 ? ` ${P}-paso-inv` : ''}`}>
                {/* La foto inclinada de HeyGen: acá, la pieza del visual de AI Avatar que corresponde a ese paso. */}
                <div className={`${P}-paso-img ${P}-paso-img-${i + 1}`} aria-hidden="true">
                  {hero ? <div className={`${P}-paso-pieza`}><VisualDeLanding visual={hero.visual} /></div> : null}
                </div>
                <div className={`${P}-paso-txt`}>
                  <span className={`${P}-paso-n`}>Paso {i + 1}</span>
                  <h3 className={`${P}-paso-h`} dangerouslySetInnerHTML={html(p.titulo)} />
                  <p className={`${P}-paso-p`} dangerouslySetInnerHTML={html(p.texto)} />
                  <Boton />
                </div>
              </li>
            ))}
          </ol>
        </section>
      );
    case 'caso':
      return (
        <section className={`${P}-testi`}>
          <div className={`${P}-testi-in`}>
            <h2 className={`${P}-testi-h`} dangerouslySetInnerHTML={html(CASO.titulo)} />
            <p className={`${P}-testi-sub`}>{CASO.sub}</p>
            <div className={`${P}-testi-c`}>
              <div className={`${P}-testi-txt`}>
                <span className={`${P}-testi-n`}>{CASO.quien}</span>
                <div className={`${P}-testi-cita`}>
                  {CASO.historia.map((h) => <p key={h} className={`${P}-testi-q`} dangerouslySetInnerHTML={html(h)} />)}
                  <p className={`${P}-testi-q`} dangerouslySetInnerHTML={html(CASO.resultado)} />
                  <span className={`${P}-testi-a`}>{CASO.quien}, {CASO.rol}</span>
                </div>
              </div>
              {/* HeyGen: el video quieto y, encima, su botón «Watch video» (al tocarlo arranca con sonido y el botón se va). */}
              <div className={`${P}-testi-vid`} data-ver="" data-tema-fijo="">
                <input type="checkbox" id={`${P}-ver`} className={`${P}-chk`} data-ver-chk="" aria-label="Ver el video del caso de Mauricio" />
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video preload="metadata" playsInline loop src={CASO.video} aria-label={`El caso de ${CASO.quien}`} />
                <label htmlFor={`${P}-ver`} className={`${P}-ver`}><span className={`${P}-ver-ic`}><IcPlay /><IcPausa /></span><span className={`${P}-ver-si`}>Ver video</span><span className={`${P}-ver-no`}>Pausar video</span></label>
              </div>
            </div>
          </div>
        </section>
      );
    case 'preguntas':
      return (
        <section className={`${P}-faq`}>
          <div className={`${P}-faq-in`}>
            <div className={`${P}-faq-izq`}><h2 className={`${P}-faq-h`} dangerouslySetInnerHTML={html(b.titulo)} /></div>
            <div className={`${P}-faq-l`}>
              {b.items.map((q) => (
                <div key={q.p} className={`${P}-faq-i`}>
                  <h3 className={`${P}-faq-p`}>{q.p}</h3>
                  <p className={`${P}-faq-r`} dangerouslySetInnerHTML={html(q.r)} />
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case 'filas':
    case 'logos':
      // AI Avatar no tiene estos bloques (HeyGen tampoco los tiene en esta página).
      return null;
  }
}

export default function DisenoAiAvatar({ landing }: PropsDiseno) {
  const hero = landing.bloques.find((b): b is Hero => b.tipo === 'hero');
  const otras = otrasFunciones(landing.slug);
  // Las columnas del pie de HeyGen, de a tres links por columna.
  const columnas: { nombre: string; href: string }[][] = [];
  for (let i = 0; i < otras.length; i += 3) columnas.push(otras.slice(i, i + 3));
  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className={`${P}-barra`}>
        <div className={`${P}-barra-in`}>
          <LogoMaKo className={`${P}-logo`} tamano={34} />
          <span className={`${P}-barra-sep`} aria-hidden="true" />
          <span className={`${P}-barra-nombre`}>{landing.nombre}</span>
          <div className={`${P}-barra-der`}>
            <a href="/vsl" className={`${P}-btn ${P}-btn-gris`}>Funcionalidades</a>
            <a href={RUTA_CTA} className={`${P}-btn`}>{TEXTO_CTA}<Flecha /></a>
          </div>
        </div>
      </header>

      <main>
        {landing.bloques.map((b, i) => <DibujarBloque key={`${b.tipo}-${i}`} b={b} hero={hero} icono={landing.icono} n={landing.bloques.slice(0, i).filter((x) => x.tipo === b.tipo).length} />)}

        <section className={`${P}-final`}>
          <div className={`${P}-final-c`}>
            <h2 className={`${P}-final-h`}>¿Lo quieres funcionando en tu negocio?</h2>
            <p className={`${P}-final-p`}>{TEXTO_CIERRE}</p>
            <Boton />
            {hero?.puntos?.length ? (
              <ul className={`${P}-final-checks`}>
                {hero.puntos.map((p) => <li key={p}><Tilde /><span dangerouslySetInnerHTML={html(p)} /></li>)}
              </ul>
            ) : null}
          </div>
        </section>
      </main>

      <footer className={`${P}-pie`}>
        <div className={`${P}-pie-in`}>
          <Miga hero={hero} nombre={landing.nombre} oscura />
          <div className={`${P}-pie-grid`}>
            <div className={`${P}-pie-logo`}><LogoMaKo tamano={44} claro /></div>
            <div className={`${P}-pie-cols`}>
              {columnas.map((col, i) => (
                <div key={i} className={`${P}-pie-col`}>
                  <h3 className={`${P}-pie-t`}>{i === 0 ? 'Funcionalidades' : ' '}</h3>
                  <ul>{col.map((f) => <li key={f.href}><a href={f.href}>{f.nombre}</a></li>)}</ul>
                </div>
              ))}
            </div>
          </div>
          <div className={`${P}-pie-base`}>© MaKo — Todos los derechos reservados.</div>
        </div>
      </footer>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

const CSS = `
@font-face { font-family: 'DAvGabarito'; src: url('/vsl-assets/fuentes/gabarito/gabarito-latin-var.woff2') format('woff2'); font-weight: 400 900; font-style: normal; font-display: swap; }
@font-face { font-family: 'DAvFigtree'; src: url('/vsl-assets/fuentes/figtree/figtree-latin.woff2') format('woff2'); font-weight: 300 900; font-style: normal; font-display: swap; }

.${P} { --d-av-tit: 'DAvGabarito', 'DAvFigtree', Arial, Helvetica, sans-serif; --d-av-txt: 'DAvFigtree', Arial, Helvetica, sans-serif;
  --d-av-azul: #2F6FED; --d-av-azul-claro: #6E9BF5; --d-av-azul-palido: #E4EDFD; --d-av-azul-tinta: #1F57C8; --d-av-marino: #0B2150; --d-av-dorado: #F2B01E;
  background: #fff; color: #171717; font-family: var(--d-av-txt); font-size: 16px; line-height: 24px; overflow-x: clip; }
.${P} *, .${P} *::before, .${P} *::after { box-sizing: border-box; }
/* El reseteo va con :where() para no pisar las clases de abajo */
.${P} :where(a) { color: inherit; }
.${P} :where(h1, h2, h3, p, ul, ol) { margin: 0; padding: 0; }
.${P} :where(ul, ol) { list-style: none; }
.${P} strong { font-weight: 700; }
/* Las casillas que manejan los botones de <label>: fuera de la vista, pero se pueden enfocar y tocar con el teclado. */
.${P}-chk { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; opacity: 0; }

/* Botones: 40 px de alto, radio 12, 18 px / 700, -0.02em. Cambian de color en 0,15 s (transition-colors de Tailwind), sin moverse. */
.${P}-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: 12px; background: var(--d-av-azul); color: #fff; font-family: var(--d-av-txt); font-size: 18px; font-weight: 700; letter-spacing: -0.02em; line-height: 27px; text-decoration: none; white-space: nowrap; flex: none; cursor: pointer; overflow: hidden;
  transition: color .15s cubic-bezier(.4,0,.2,1), background-color .15s cubic-bezier(.4,0,.2,1), border-color .15s cubic-bezier(.4,0,.2,1); }
.${P}-btn:hover, .${P}-btn:active { background: var(--d-av-marino); color: var(--d-av-azul-claro); }
.${P}-btn:focus-visible { outline: 2px solid var(--d-av-azul); outline-offset: 2px; }
.${P}-btn-negro { background: #000; color: var(--d-av-azul-claro); }
.${P}-btn-negro:hover, .${P}-btn-negro:active { background: var(--d-av-azul); color: #fff; }
.${P}-btn-gris { background: #D9D9D9; color: #000; }
.${P}-btn-gris:hover { background: #CACACA; color: #000; }

/* La barra copiada (oculta: la reemplaza la del sitio) */
.${P}-barra { position: sticky; top: 0; z-index: 30; padding: 16px 84px 0; }
.${P}-barra-in { max-width: 1272px; margin: 0 auto; display: flex; align-items: center; gap: 16px; padding: 16px 32px; border-radius: 28px; background: rgba(255,255,255,.92); }
.${P}-barra-sep { width: 1px; height: 24px; background: #D9D9D9; }
.${P}-barra-nombre { font-size: 18px; font-weight: 500; color: #262626; }
.${P}-barra-der { margin-left: auto; display: flex; align-items: center; gap: 8px; }

/* Miga de pan: ABC Solar 15 px; acá Gabarito. Flechas llenas de 11 px con 4 px de cada lado. */
.${P}-miga { display: flex; flex-wrap: nowrap; align-items: center; min-width: 0; max-width: 100%; font-family: var(--d-av-tit); font-size: 15px; line-height: 22.5px; font-weight: 700; color: #000; }
.${P}-miga a, .${P}-miga > span { flex: none; text-decoration: none; white-space: nowrap; }
.${P}-miga a:hover { text-decoration: underline; }
.${P}-miga-sep { display: inline-flex; margin: -2px 4px 0; }
.${P}-miga > .${P}-miga-act { flex: 0 1 auto; min-width: 0; color: var(--d-av-azul-tinta); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.${P}-miga-osc { color: #fff; }
.${P}-miga-osc .${P}-miga-act { color: #fff; }

/* Hero: el contenedor de 1280 con 20 px a los lados y dos columnas de 583 con 75 entre ellas; 100 abajo. Arriba, HeyGen deja 125
   desde el borde de la página con su barra flotante encima: la miga queda a 165 px. Acá la barra del sitio ya ocupa 76: 77 más. */
.${P}-hero { padding: 77px 20px 100px; }
.${P}-hero-in { max-width: 1240px; margin: 0 auto; display: flex; align-items: center; gap: 75px; }
.${P}-hero-txt, .${P}-hero-media { flex: 1 1 0; min-width: 0; }
.${P}-hero-txt { display: flex; flex-direction: column; align-items: flex-start; gap: 30px; }
.${P}-h1 { max-width: 800px; font-family: var(--d-av-tit); font-size: 68px; line-height: 72px; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #1A1A1A; }
.${P}-hero-baja { display: flex; flex-direction: column; gap: 30px; }
.${P}-hero-p { max-width: 610px; font-size: 18px; line-height: 130%; font-weight: 450; letter-spacing: -0.36px; color: #171717; }
.${P}-hero-p strong { font-weight: 700; }
/* Los renglones con tilde: en fila (se parten si no entran), 40 px de alto cada uno, 18 px / 500 en el color oscuro de la marca */
.${P}-checks { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; }
.${P}-checks li, .${P}-final-checks li { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 5px 0; font-size: 18px; line-height: 100%; font-weight: 500; letter-spacing: -0.18px; color: var(--d-av-marino); }
.${P}-tilde { flex: none; color: var(--d-av-azul); }
.${P}-hero-media { padding: 20px 0; }

/* El reproductor: la caja negra de radio 24, el play grande y la barra de controles que flota sobre el borde */
.${P}-rep { position: relative; }
.${P}-rep-caja { position: relative; display: block; overflow: hidden; border-radius: 24px; background: #000; aspect-ratio: 16 / 9; cursor: pointer; }
.${P}-rep-fondo { position: absolute; inset: -30px; background-size: cover; background-position: center; filter: blur(26px) brightness(.62); }
.${P}-rep-caja video { position: relative; display: block; height: 100%; aspect-ratio: 9 / 16; margin: 0 auto; object-fit: cover; background: #000; }
.${P}-rep-grande { position: absolute; left: 50%; top: 50%; width: 27px; height: 27px; margin: -13.5px 0 0 -13.5px; border-radius: 10px; background: var(--d-av-azul-tinta); color: #fff; display: flex; align-items: center; justify-content: center; transform: scale(2.4); transition: background-color .2s, opacity .2s; }
.${P}-rep-grande svg { width: 15px; margin-left: 2px; }
.${P}-rep-caja:hover .${P}-rep-grande { background: var(--d-av-marino); }
.${P}-rep-ctl { position: absolute; left: 30px; right: 30px; bottom: -14px; z-index: 10; display: flex; align-items: center; gap: 5px; padding: 5px 6px; opacity: var(--rep-ver, 1); pointer-events: var(--rep-toca, auto); transition: opacity .2s; }
.${P}-rep-b { flex: none; width: 27px; height: 27px; border-radius: 10px; background: var(--d-av-azul-tinta); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color .2s; }
.${P}-rep-b:hover { background: var(--d-av-marino); }
.${P}-rep-b .${P}-ic-play { width: 15px; margin-left: 2px; }
.${P}-rep-b .${P}-ic-pausa, .${P}-rep-b .${P}-ic-off { display: none; }
.${P}-rep-linea { position: relative; flex: 1 1 auto; height: 27px; border-radius: 12px; display: flex; align-items: center; isolation: isolate; }
.${P}-rep-pista { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; background: var(--d-av-azul-palido); }
.${P}-rep-relleno { position: absolute; inset: 0 auto 0 0; width: var(--rep-k, 0%); background: var(--d-av-azul); opacity: .4; }
.${P}-rep[data-rep-listo] .${P}-rep-relleno { opacity: 1; }
/* La perilla: la gota de HeyGen (un triángulo redondeado que cuelga sobre la línea), en el dorado de MaKo */
.${P}-rep-perilla { position: absolute; top: -7px; left: var(--rep-k, 0%); width: 50px; height: 17px; transform: translateX(-50%); pointer-events: none; background: var(--d-av-dorado); clip-path: polygon(0 0, 100% 0, 58% 92%, 50% 100%, 42% 92%); border-radius: 3px; opacity: .6; }
.${P}-rep[data-rep-listo] .${P}-rep-perilla { opacity: 1; }
.${P}-rep-linea input { position: absolute; inset: 0; z-index: 5; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; appearance: none; -webkit-appearance: none; background: none; }
/* Sonando: el play grande se va, el botón pasa a pausa y la barra se esconde salvo con el mouse encima */
.${P}-rep:has([data-rep-play]:checked) .${P}-rep-grande { opacity: 0; }
.${P}-rep:has([data-rep-play]:checked) .${P}-rep-b .${P}-ic-play { display: none; }
.${P}-rep:has([data-rep-play]:checked) .${P}-rep-b .${P}-ic-pausa { display: block; }
.${P}-rep:has([data-rep-play]:checked) { --rep-ver: 0; --rep-toca: none; }
.${P}-rep:has([data-rep-play]:checked):hover, .${P}-rep:has([data-rep-play]:checked):focus-within { --rep-ver: 1; --rep-toca: auto; }
.${P}-rep:has([data-rep-mudo]:checked) .${P}-ic-on { display: none; }
.${P}-rep:has([data-rep-mudo]:checked) .${P}-ic-off { display: block; }
.${P}-rep:has(.${P}-chk:focus-visible) .${P}-rep-caja { outline: 2px solid var(--d-av-azul); outline-offset: 3px; }

/* La banda gris de los números: ancho completo, radio 70, padding 100 / 28 */
.${P}-banda { margin: 0 auto; background: #F2F2F2; border-radius: 70px; padding: 100px 28px; }
.${P}-banda-in { max-width: 1384px; margin: 0 auto; }
.${P}-cifras { display: flex; gap: 20px; margin: 20px 0; }
.${P}-cifras li { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; border-radius: 30px; background: #1A1A1A; color: #fff; text-align: center; }
.${P}-cifra-v { font-family: var(--d-av-tit); font-size: 44px; line-height: 1; font-weight: 900; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.${P}-cifra-l { font-size: 18px; line-height: 1; font-weight: 500; letter-spacing: -0.18px; }
/* La cinta: 16 px debajo de las tarjetas, máscara del 8 %, separación de 80 entre logos de 60 px de alto */
.${P}-cinta { position: relative; margin-top: 16px; }
.${P}-cinta-ver { overflow: hidden; padding: 10px 0; -webkit-mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent); }
.${P}-cinta-pista { display: flex; width: max-content; gap: 80px; animation: dAvCinta 25s linear infinite; will-change: transform; }
.${P}-cinta-ver:hover .${P}-cinta-pista, .${P}-chk:checked + .${P}-cinta-ver .${P}-cinta-pista, .${P}-cinta:has(.${P}-chk:focus-visible) .${P}-cinta-pista { animation-play-state: paused; }
@keyframes dAvCinta { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.${P}-cinta-logo { display: flex; align-items: center; gap: 10px; height: 60px; font-family: var(--d-av-txt); font-size: 26px; font-weight: 700; letter-spacing: -0.03em; color: #3A3A3A; white-space: nowrap; }
.${P}-cinta-logo svg { flex: none; }
.${P}-cinta-pausa { position: absolute; right: 8px; top: 50%; z-index: 2; width: 28px; height: 28px; margin-top: -14px; border-radius: 999px; border: 1px solid #E6E6E6; background: #fff; color: #1A1A1A; display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.${P}-cinta-pausa .${P}-ic-play { display: none; margin-left: 1px; }
.${P}-chk:checked ~ .${P}-cinta-pausa .${P}-ic-play { display: block; }
.${P}-chk:checked ~ .${P}-cinta-pausa .${P}-ic-pausa { display: none; }
.${P}-cinta:has(.${P}-chk:focus-visible) .${P}-cinta-pausa { outline: 2px solid var(--d-av-azul); outline-offset: 2px; }
.${P}-banda-pie { display: flex; align-items: center; font-size: 16px; line-height: 24px; color: #374151; }
.${P}-banda-pie span { white-space: nowrap; }
.${P}-banda-pie::after { content: ''; flex: 1; margin-left: 16px; border-bottom: 1px solid #D1D5DB; }

/* Secciones: padding 120 / 20 (contenido de 1408), encabezado con el título de 60 px y el botón abajo a la derecha */
.${P}-sec { padding: 120px 20px; max-width: 1448px; margin: 0 auto; }
.${P}-cabeza { display: flex; align-items: flex-end; justify-content: space-between; gap: 30px; margin-bottom: 75px; }
.${P}-cabeza-txt { display: flex; flex-direction: column; align-items: flex-start; gap: 30px; }
.${P}-h2 { font-family: var(--d-av-tit); font-size: 60px; line-height: 1.05; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #171717; max-width: 780px; overflow-wrap: anywhere; }
.${P}-cabeza-p { max-width: 600px; font-size: 18px; line-height: 140%; letter-spacing: -0.16px; color: #171717; }

/* «Sin / Con»: dos tarjetas con borde negro al 10 %, radio 22, padding 30, 40 entre el título y el texto */
.${P}-reto { display: flex; gap: 20px; }
.${P}-reto-c { flex: 1 1 0; display: flex; flex-direction: column; gap: 40px; padding: 30px; border-radius: 22px; border: 1px solid #E6E6E6; }
.${P}-pil { display: block; width: fit-content; margin-bottom: 20px; padding: 10px 15px; border-radius: 999px; border: 1px solid #E6E6E6; font-size: 14px; line-height: 1; }
.${P}-h3 { font-family: var(--d-av-tit); font-size: 40px; line-height: 1; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #171717; }
.${P}-reto-p { font-size: 16px; line-height: 140%; letter-spacing: -0.01em; color: #333; }

/* Filas: tarjetas crema #FDFBF9 de 1408 px, radio 80, padding 50, 75 px entre una y otra */
.${P}-filas { display: flex; flex-direction: column; gap: 75px; }
.${P}-fila { display: flex; gap: 50px; padding: 50px; border-radius: 80px; background: #FDFBF9; }
.${P}-fila-inv { flex-direction: row-reverse; }
.${P}-fila-txt { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; gap: 30px; }
.${P}-panel { flex: 1 1 0; min-width: 0; min-height: 406px; max-height: 600px; border-radius: 80px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.${P}-panel-0 { background: #DCE8FD; }
.${P}-panel-1 { background: #FBEFD3; }
.${P}-panel-2 { background: #EDF0F5; }
.${P}-panel-tel { display: block; height: 340px; aspect-ratio: 9 / 16; border-radius: 26px; overflow: hidden; background: #12151B; box-shadow: 0 0 0 6px #12151B, 0 30px 60px -24px rgba(16,19,25,.45); }
.${P}-panel-tel video { display: block; width: 100%; height: 100%; object-fit: cover; }
.${P}-fila-h { font-family: var(--d-av-tit); font-size: 50px; line-height: 120%; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #000; }
.${P}-fila-p { margin-top: 30px; font-size: 16px; line-height: 1.4; letter-spacing: -0.16px; color: #333; }

/* El visual de AI Avatar en los pasos (sus clases viven en LandingCompetencia; acá van con el marco de HeyGen) */
.${P} .mk-c-av { display: flex; align-items: center; justify-content: center; gap: 14px; }
.${P} .mk-c-av-foto { flex: none; width: 128px; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 10px; border-radius: 16px; background: #fff; border: 1px solid #E3EAF6; text-align: center; }
.${P} .mk-c-av-foto-cara { width: 64px; height: 64px; border-radius: 50%; background: var(--d-av-azul-palido); color: var(--d-av-azul); display: flex; align-items: center; justify-content: center; }
.${P} .mk-c-av-foto-t { font-size: 14px; font-weight: 600; color: #12151B; line-height: 1.3; }
.${P} .mk-c-av-foto-d { font-size: 12px; line-height: 1.35; color: #6B7280; }
.${P} .mk-c-av-flecha { flex: none; color: var(--d-av-azul-claro); display: inline-flex; }
.${P} .mk-c-av-escenas { display: flex; align-items: center; justify-content: center; }
.${P} .mk-c-av-tel { position: relative; z-index: 2; flex: none; width: 216px; aspect-ratio: 9 / 16; padding: 7px; border-radius: 30px; background: #22252C; box-shadow: 0 28px 60px -30px rgba(16,19,25,.6); }
.${P} .mk-c-av-tel-lado { z-index: 1; width: 172px; }
.${P} .mk-c-av-escenas > .mk-c-av-tel-lado:first-child { margin-right: -46px; transform: rotate(-7deg) translateY(14px); }
.${P} .mk-c-av-escenas > .mk-c-av-tel-lado:last-child { margin-left: -46px; transform: rotate(7deg) translateY(14px); }
.${P} .mk-c-av-escena { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 24px; background: linear-gradient(170deg, #3A3F4A 0%, #1D2027 100%); }
.${P} .mk-c-av-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.${P} .mk-c-av-escena::after { content: ''; position: absolute; inset: 0; z-index: 1; background: linear-gradient(to top, rgba(0,0,0,.62), transparent 44%); pointer-events: none; }
.${P} .mk-c-av-tel-lado .mk-c-av-escena::after { background: linear-gradient(to top, rgba(0,0,0,.45), rgba(0,0,0,.18) 50%); }
.${P} .mk-c-av-pill { position: absolute; top: 12px; left: 12px; z-index: 2; max-width: calc(100% - 64px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 5px 9px; border-radius: 999px; background: rgba(16,19,25,.55); color: #fff; font-size: 10.5px; line-height: 1.3; font-weight: 600; }
.${P} .mk-c-av-tel-lado .mk-c-av-pill { max-width: calc(100% - 50px); }
.${P} .mk-c-av-escenas > .mk-c-av-tel-lado:last-child .mk-c-av-pill { left: auto; right: 12px; }
.${P} .mk-c-av-dur { position: absolute; top: 17px; right: 12px; z-index: 2; font-size: 10.5px; line-height: 1.3; font-weight: 600; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.85); }
.${P} .mk-c-av-sub { position: absolute; left: 12px; right: 12px; bottom: 16px; z-index: 2; margin: 0; text-align: center; font-size: 13px; line-height: 1.38; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.55); }
.${P} .mk-c-av-sub span { animation-name: dAvPalabra; animation-iteration-count: infinite; animation-timing-function: steps(1, end); }
@keyframes dAvPalabra { 0% { color: #fff; } 6% { color: #F2B01E; } 18%, 100% { color: #fff; } }

/* Pasos: tarjetas crema de 450 px, radio 80, la imagen de un lado y el texto del otro */
.${P}-pasos { display: flex; flex-direction: column; gap: 50px; }
/* Como en HeyGen: la imagen a la izquierda en el 1 y el 3, a la derecha en el 2; en el teléfono, arriba del texto */
.${P}-paso { display: flex; flex-direction: row; align-items: center; gap: 50px; border-radius: 80px; background: #FDFBF9; overflow: hidden; }
.${P}-paso-inv { flex-direction: row-reverse; }
.${P}-paso-img { flex: 1 1 0; min-width: 0; position: relative; display: flex; align-items: center; justify-content: center; height: 450px; }
.${P}-paso-pieza { transform: rotate(-9deg); }
.${P}-paso-img-1 .mk-c-av-flecha, .${P}-paso-img-1 .mk-c-av-escenas { display: none; }
.${P}-paso-img-1 .${P}-paso-pieza { transform: rotate(-9deg) scale(1.7); }
/* Paso 2 («Elige tu escena»): las tres escenas en abanico, casi derechas. Paso 3: tu foto → el anuncio, sin las de los lados. */
.${P}-paso-img-2 .mk-c-av-foto, .${P}-paso-img-2 .mk-c-av-flecha { display: none; }
.${P}-paso-img-2 .${P}-paso-pieza { transform: rotate(-3deg); }
.${P}-paso-img-3 .mk-c-av-tel-lado { display: none; }
.${P}-paso-img-3 .${P}-paso-pieza { transform: rotate(-4deg) scale(.92); }
.${P}-paso-txt { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 20px 50px; }
.${P}-paso-n { padding: 6px 12px; border-radius: 80px; background: var(--d-av-azul-palido); color: var(--d-av-azul); font-family: var(--d-av-tit); font-size: 15px; line-height: 22.5px; font-weight: 700; }
.${P}-paso-h { font-family: var(--d-av-tit); font-size: 30px; line-height: 125%; font-weight: 900; letter-spacing: -0.01em; color: #333; }
.${P}-paso-p { font-size: 16px; line-height: 1.4; letter-spacing: -0.16px; color: #333; }
.${P}-paso-p strong { font-weight: 700; }
.${P}-paso-txt .${P}-btn { margin-top: 10px; }

/* Casos de uso: grilla de 3 columnas de hasta 411 px, 75 px entre filas y columnas; ícono de 36, título de 24 px */
.${P}-usos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 75px; }
.${P}-uso { display: flex; flex-direction: column; max-width: 411px; }
.${P}-uso-ic { width: 36px; height: 36px; margin-bottom: 13px; color: #171717; display: flex; align-items: center; justify-content: center; }
.${P}-uso-ic svg { stroke-width: 1.6; }
.${P}-uso-t { margin-bottom: 13px; font-family: var(--d-av-tit); font-size: 24px; line-height: 32px; font-weight: 700; letter-spacing: -0.01em; color: #171717; }
.${P}-uso-p { font-size: 16px; line-height: 140%; font-weight: 450; letter-spacing: -0.16px; color: #171717; }

/* Testimonio: título de 70 px y una tarjeta de 1208 px, radio 40, con el video a la derecha (60 %) */
.${P}-testi { padding: 120px 20px; }
.${P}-testi-in { max-width: 1208px; margin: 0 auto; }
.${P}-testi-h { max-width: 842px; font-family: var(--d-av-tit); font-size: 70px; line-height: 110%; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: var(--d-av-marino); }
.${P}-testi-sub { margin-top: 20px; max-width: 600px; font-size: 18px; line-height: 130%; font-weight: 500; letter-spacing: -0.025em; color: rgba(22,22,22,.7); }
.${P}-testi-c { margin-top: 70px; display: flex; border-radius: 40px; border: 1px solid #CCCCCC; background: #fff; overflow: hidden; }
.${P}-testi-txt { width: 40%; flex: none; padding: 50px; display: flex; flex-direction: column; }
.${P}-testi-n { font-size: 24px; line-height: 1.25; font-weight: 800; letter-spacing: -0.025em; color: #171717; }
.${P}-testi-cita { margin-top: auto; padding-top: 16px; font-size: 14px; line-height: 20px; color: #374151; }
.${P}-testi-q { margin-bottom: 10px; }
.${P}-testi-q strong { color: #171717; }
.${P}-testi-a { display: block; margin-top: 20px; }
.${P}-testi-vid { position: relative; flex: 1 1 auto; background: #000; min-height: 380px; }
.${P}-testi-vid video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
/* «Ver video»: la pastilla celeste al centro con su círculo oscuro; al tocarla se va (0,3 s) y el video arranca con sonido */
.${P}-ver { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 12px; background: var(--d-av-azul-palido); color: var(--d-av-marino); font-size: 20px; line-height: 28px; font-weight: 700; cursor: pointer; transition: opacity .3s; white-space: nowrap; }
.${P}-ver-ic { width: 32px; height: 32px; border-radius: 999px; background: var(--d-av-marino); color: var(--d-av-azul-palido); display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1); }
.${P}-ver-ic svg { width: 12px; margin-left: 2px; }
.${P}-ver-ic .${P}-ic-pausa { width: 11px; margin-left: 0; }
.${P}-ver-no, .${P}-ver .${P}-ic-pausa, .${P}-testi-vid:has(.${P}-chk:checked) .${P}-ver-si, .${P}-testi-vid:has(.${P}-chk:checked) .${P}-ver .${P}-ic-play { display: none; }
.${P}-testi-vid:has(.${P}-chk:checked) .${P}-ver-no, .${P}-testi-vid:has(.${P}-chk:checked) .${P}-ver .${P}-ic-pausa { display: block; }
.${P}-testi-vid:has(.${P}-chk:checked) .${P}-ver { opacity: 0; }
.${P}-testi-vid:has(.${P}-chk:checked):hover .${P}-ver { opacity: 1; }
.${P}-testi-vid:has(.${P}-chk:focus-visible) .${P}-ver { outline: 2px solid var(--d-av-azul); outline-offset: 3px; }

/* Preguntas: el título PEGADO a la izquierda (a 120 px de arriba, 350 px, 40 / 40) y las tarjetas grises #F2F2F2 a la derecha */
.${P}-faq { padding: 120px 20px; }
.${P}-faq-in { max-width: 1248px; margin: 0 auto; padding: 0 15px; display: flex; gap: 100px; }
.${P}-faq-izq { flex: 1 1 0; }
.${P}-faq-h { position: sticky; top: 120px; max-width: 350px; font-family: var(--d-av-tit); font-size: 40px; line-height: 1; font-weight: 900; letter-spacing: 0.4px; color: #333; }
.${P}-faq-l { flex: 2 1 0; display: flex; flex-direction: column; gap: 20px; }
.${P}-faq-i { display: flex; flex-direction: column; gap: 20px; padding: 30px 30px 54px; border-radius: 20px; background: #F2F2F2; }
.${P}-faq-p { font-size: 18px; line-height: 140%; font-weight: 500; letter-spacing: -0.14px; color: #000; }
.${P}-faq-r { font-size: 16px; line-height: 140%; letter-spacing: -0.14px; color: #333; }

/* La banda final: ancho completo, radio 40, el degradado de un lado; el pie negro asoma debajo de las esquinas */
.${P}-final { background: linear-gradient(#fff calc(100% - 50px), #000 calc(100% - 50px)); }
.${P}-final-c { max-width: 1280px; margin: 0 auto; border-radius: 40px; padding: 100px 130px; text-align: center; display: flex; flex-direction: column; align-items: center;
  background: linear-gradient(97deg, #6E9BF5 0%, #7FA6F6 18%, #B9CEFA 26.4%, #F6E2B8 27.8%, #FBFAF8 28.9%, #FBFAF8 100%); }
.${P}-final-h { max-width: 550px; font-family: var(--d-av-tit); font-size: 60px; line-height: 1; font-weight: 900; letter-spacing: -0.04em; word-spacing: -0.03em; color: #171717; }
.${P}-final-p { max-width: 550px; padding: 20px 0 30px; font-size: 16px; line-height: 140%; color: var(--d-av-marino); }
.${P}-final-checks { margin-top: 20px; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 32px; }
.${P}-final-checks li { gap: 5px; }

/* El pie copiado (oculto: lo reemplaza el del sitio) */
.${P}-pie { background: #000; color: #fff; padding: 62px 84px; }
.${P}-pie-in { max-width: 1272px; margin: 0 auto; }
.${P}-pie-grid { margin-top: 40px; display: grid; grid-template-columns: 213px 1fr; }
.${P}-pie-cols { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px 6px; }
.${P}-pie-t { min-height: 21px; font-size: 14px; line-height: 21px; font-weight: 700; text-transform: uppercase; }
.${P}-pie-col a { font-size: 14px; line-height: 24px; color: rgba(255,255,255,.72); text-decoration: none; }
.${P}-pie-base { margin-top: 70px; padding-top: 50px; border-top: 1px solid #333; font-size: 14px; font-weight: 700; }

@media (prefers-reduced-motion: reduce) {
  .${P} *, .${P} *::before, .${P} *::after { animation: none !important; transition: none !important; }
  .${P}-cinta-pausa { display: none; }
}

/* Hasta 1280 (el xl de HeyGen): los encabezados de sección con 15 px de sangría */
@media (max-width: 1279px) {
  .${P}-cabeza { padding: 0 15px; }
}

/* Hasta 1024 (el lg de HeyGen): una columna en el hero, las filas y los pasos; los números uno debajo de otro */
@media (max-width: 1023px) {
  .${P}-hero-in { flex-direction: column; align-items: stretch; gap: 75px; }
  .${P}-h1 { font-size: 55px; line-height: 60px; }
  .${P}-cifras { flex-direction: column; }
  .${P}-fila, .${P}-fila-inv { flex-direction: column; }
  .${P}-panel { flex: none; width: 100%; order: 2; }
  .${P}-paso, .${P}-paso-inv { flex-direction: column; gap: 0; }
  .${P}-paso-img { flex: none; width: 100%; }
  .${P}-paso-txt { flex: none; width: 100%; padding: 20px; }
  .${P}-usos { grid-template-columns: repeat(2, 1fr); }
  .${P}-faq-in { flex-direction: column; gap: 100px; }
  .${P}-faq-h { position: static; }
}

/* Hasta 768 (el md de HeyGen): las medidas de 390 */
@media (max-width: 767px) {
  .${P}-hero { padding-top: 60px; }
  .${P}-h1 { font-size: 40px; line-height: 48px; }
  .${P}-checks { flex-direction: column; }
  .${P}-banda { padding: 24px 28px 60px; }
  .${P}-cinta-pista { gap: 40px; }
  .${P}-banda-pie { font-size: 14px; line-height: 20px; }
  .${P}-banda-pie span { white-space: normal; text-align: center; }
  .${P}-sec { padding: 100px 20px; }
  .${P}-cabeza { flex-direction: column; align-items: flex-start; gap: 30px; padding: 0 15px; }
  .${P}-h2 { font-size: 44px; }
  .${P}-reto { flex-direction: column; }
  .${P}-reto-c { padding: 20px; }
  .${P}-fila, .${P}-fila-inv { padding: 50px 0; gap: 50px; }
  .${P}-fila-txt { padding: 0 20px; }
  .${P}-filas { gap: 240px; }
  .${P}-fila-h { font-size: 44px; }
  .${P}-panel { min-height: 0; aspect-ratio: 692 / 449; border-radius: 48px; }
  .${P}-panel-tel { height: 84%; width: auto; }
  .${P}-paso-txt { padding: 20px 10px; }
  .${P}-paso-img { height: auto; aspect-ratio: 678 / 500; overflow: hidden; }
  .${P}-usos { grid-template-columns: 1fr; gap: 38px; }
  .${P}-uso-t { font-size: 18px; }
  .${P}-testi { padding: 100px 20px; }
  .${P}-testi-h { font-size: 35px; }
  .${P}-testi-sub { font-size: 16px; }
  .${P}-testi-c { flex-direction: column; }
  .${P}-testi-txt { width: auto; padding: 20px; }
  .${P}-testi-n { font-size: 20px; }
  .${P}-testi-cita { font-size: 12px; line-height: 16px; }
  .${P}-testi-vid { min-height: 0; aspect-ratio: 4 / 3; }
  .${P}-faq { padding: 100px 0; }
  .${P}-faq-in { gap: 50px; }
  .${P}-faq-h { max-width: none; margin: 0 auto; font-size: 30px; text-align: center; }
  .${P}-faq-r { font-size: 14px; }
  .${P}-final { padding: 0 20px; }
  .${P}-final-c { padding: 100px 40px; background: linear-gradient(100deg, #6E9BF5 0%, #8FB2F7 6%, #C9D9FB 9%, #FBFAF8 13%, #FBFAF8 100%); }
  .${P}-final-h { font-size: 32px; }
  .${P}-pie { padding: 62px 20px; }
  .${P}-pie-grid { grid-template-columns: 1fr; gap: 40px; }
  .${P}-pie-cols { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 560px) {
  /* El abanico de los pasos entra en el ancho del teléfono: 116 + 150 + 116 − 2 × 42 ≈ 300 px. */
  .${P} .mk-c-av-tel { width: 150px; padding: 5px; border-radius: 22px; }
  .${P} .mk-c-av-tel-lado { width: 116px; }
  .${P} .mk-c-av-escena { border-radius: 18px; }
  .${P} .mk-c-av-escenas > .mk-c-av-tel-lado:first-child { margin-right: -42px; transform: rotate(-7deg) translateY(10px); }
  .${P} .mk-c-av-escenas > .mk-c-av-tel-lado:last-child { margin-left: -42px; transform: rotate(7deg) translateY(10px); }
  .${P} .mk-c-av-pill { top: 8px; left: 8px; max-width: calc(100% - 16px); padding: 4px 7px; font-size: 9px; }
  .${P} .mk-c-av-tel-lado .mk-c-av-pill, .${P} .mk-c-av-dur { display: none; }
  .${P} .mk-c-av-sub { left: 8px; right: 8px; bottom: 10px; font-size: 11px; }
  .${P}-paso-img-1 .${P}-paso-pieza { transform: rotate(-9deg) scale(1.3); }
  .${P}-paso-img-3 .${P}-paso-pieza { transform: rotate(-4deg) scale(.8); }
  .${P}-rep-ctl { left: 16px; right: 16px; }
}
@media (max-width: 420px) {
  .${P}-btn { font-size: 16px; padding: 0 13px; }
  .${P} .mk-c-av { gap: 8px; }
  .${P} .mk-c-av-foto { width: 96px; padding: 12px 6px; }
  .${P} .mk-c-av-foto-cara { width: 48px; height: 48px; }
  .${P}-final-checks li { font-size: 16px; }
}
`;

// =============================================================================
// LAS INTERACCIONES: un <script data-visor> porque el visor borra los demás. Corre cuando React ya tomó la página (cambiarle cosas
// a sus nodos antes rompe la hidratación), o en el acto sin Next (el visor).
//   · el reproductor (lo que hace el de HeyGen, mirado el 14/11): arranca solo y sin sonido cuando se ve (y se frena fuera de la vista)
//     mientras nadie lo toque; tocar el video o el botón lo pausa o lo sigue; la línea avanza con el video y se puede arrastrar;
//     el de sonido lo prende; el de pantalla completa pide la pantalla entera. Al terminar queda pausado, con el play grande.
//   · «Ver video» del testimonio: arranca el video del caso con sonido; tocar el video lo pausa (vuelve el botón) o lo sigue.
// =============================================================================
const SCRIPT = `(function(){
var P='${P}';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function jugar(v){var p=v.play();if(p&&p.catch)p.catch(function(){});}
function iniciar(){
  var R=document.querySelector('.'+P);if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  [].forEach.call(R.querySelectorAll('[data-rep]'),function(rep){
    var v=rep.querySelector('video'),play=rep.querySelector('[data-rep-play]'),mudo=rep.querySelector('[data-rep-mudo]'),grande=rep.querySelector('[data-rep-grande]'),linea=rep.querySelector('[data-rep-linea]');
    if(!v||!play)return;
    play.checked=false;mudo.checked=true;grande.checked=false;v.muted=true;
    var arrastra=false,solo=true;
    // Como el de HeyGen: arranca solo y sin sonido cuando se ve; si lo pausa la persona, ya no vuelve a arrancar solo.
    if(!quieto&&'IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!solo)return;if(e.isIntersecting){if(v.paused&&!v.ended){v.muted=mudo.checked;jugar(v);}}else if(!v.paused)v.pause();});},{threshold:.25});io.observe(rep);}
    function pintar(){var k=v.duration?v.currentTime/v.duration:0;rep.style.setProperty('--rep-k',(k*100).toFixed(2)+'%');if(!arrastra)linea.value=String(Math.round(k*1000));}
    play.addEventListener('change',function(){solo=false;if(play.checked){v.muted=mudo.checked;if(v.preload!=='auto')v.preload='auto';jugar(v);}else v.pause();});
    mudo.addEventListener('change',function(){v.muted=mudo.checked;});
    grande.addEventListener('change',function(){grande.checked=false;var f=rep.requestFullscreen||rep.webkitRequestFullscreen;if(document.fullscreenElement){document.exitFullscreen();return;}if(f)try{f.call(rep);}catch(e){}else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();});
    v.addEventListener('play',function(){play.checked=true;});
    v.addEventListener('pause',function(){play.checked=false;});
    v.addEventListener('ended',function(){play.checked=false;try{v.currentTime=0;}catch(e){}pintar();});
    v.addEventListener('timeupdate',pintar);
    v.addEventListener('loadedmetadata',function(){rep.setAttribute('data-rep-listo','');pintar();});
    if(v.readyState>0)rep.setAttribute('data-rep-listo','');
    linea.addEventListener('input',function(){arrastra=true;if(v.duration){v.currentTime=v.duration*Number(linea.value)/1000;}rep.style.setProperty('--rep-k',(Number(linea.value)/10).toFixed(2)+'%');});
    linea.addEventListener('change',function(){arrastra=false;});
  });
  [].forEach.call(R.querySelectorAll('[data-ver]'),function(c){
    var v=c.querySelector('video'),chk=c.querySelector('[data-ver-chk]');if(!v||!chk)return;
    chk.checked=false;
    chk.addEventListener('change',function(){if(chk.checked){v.muted=false;jugar(v);}else v.pause();});
    v.addEventListener('click',function(){if(v.paused){v.muted=false;jugar(v);}else v.pause();});
    v.addEventListener('play',function(){chk.checked=true;});
    v.addEventListener('pause',function(){chk.checked=false;});
  });
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;
