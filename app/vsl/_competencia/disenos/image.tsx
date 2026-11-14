// =============================================================================
// /vsl/image con el DISEÑO de la portada de PostNitro en español (copiado el 11/11/2026, rehecho el 14/11/2026 contra su versión de hoy)
// =============================================================================
// Referencia: https://postnitro.ai/es — releída el 14/11/2026 con Chromium a 1440 × 900 y 390 × 844: capturas por sección, estilos
// calculados antes y después de cada hover, su CSS (los módulos de cada sección) y un video de la bajada, en side-session-notes/…/
// referencias-landings/image/ (relevo.md). Los valores ordenados: docs/diseno/landings-competencia/image.md. Martín, 14/11/2026:
// «quiero que te concentres en que la copia salga muy fiel a todas las animaciones y cosas que tiene la landing original… los
// videos que tienen, las animaciones, los hover, todo, absolutamente todo».
//
// Lo copiado, en su orden: el hero de una pantalla entera (fondo de puntos de 14 px, contenido centrado en el alto) con la cejilla
// en caja, el titular de Archivo a ancho 92, la bajada, el botón con su ícono, la nota, la fila de chips de redes y, a la derecha,
// el MARCO de selección (borde de color, la pestaña con el nombre y un cuadradito en cada esquina) con cuatro láminas 4:5 (las del
// medio subidas 8 px) y la franja punteada del kit de marca; la tarjeta negra a lo ancho debajo; la franja blanca de prueba social
// al pie de esa misma pantalla; la sección blanca con el editor en un marco de 800 px; la de las plantillas (seis en fila, la
// sombra larga, el renglón y el botón de línea); los tres pasos («01 ——», el ícono en su caja); «01 Diseño» con cuatro filas que
// alternan el lado del marco y la grilla de seis celdas separadas por 1 px; «02 Automatizar» con cuatro tarjetas negras (suben 2 px
// y se bordean del color al pasar el mouse) y su grilla; los testimonios en columnas; las preguntas en acordeón (una abierta a la
// vez, se abre en 200 ms, el borde del color y la flecha que gira) y el pie de cuatro columnas. Los hovers son los suyos: el botón
// lleno oscurece (sin moverse) y baja 1 px al apretar; el de línea se pone gris; los chips suben 1 px con sombra; la pregunta se
// bordea a medias; los links del pie pasan al color. PostNitro NO anima nada al bajar (no hay entradas con el scroll): acá tampoco.
// De MaKo: el logo, el azul #2F6FED donde PostNitro pone su verde #087A68 (y #8FB2F7 donde pone su verde claro #0DC7A9), y lo
// que se muestra en cada marco, que es REAL:
//   · las láminas del hero, de «Formatos» y del «Kit de marca»: los tipos de carrusel y las plantillas de MaKo con su ejemplo
//     (negocios ficticios del elenco), dibujados con el MOTOR del editor en el banco C:/dev/bancos-portada/banco-image-landing
//     (renderPageToCanvas, `estiloConKit`); sin IA;
//   · el marco del editor: la grabación de «Editar» (los outliers de la biblioteca y la réplica que armó Image), la misma de la
//     portada (public/vsl-assets/sitio/carruseles.webm), con su póster en el primer cuadro;
//   · las seis tarjetas de «Carruseles que funcionan»: outliers VERDADEROS de la biblioteca de ejemplos, con su @, su outlier y el
//     link al original (la regla de Martín para los ejemplos, como en Spy);
//   · «Lienzo»: el EDITOR real (EditorApp) montado en el banco banco-image-landing/editor con el carrusel de la portada, la cámara
//     sobre la lámina (se toca el titular, se baja y vuelve); en bucle con codificar-bucle.sh y el póster en su primer cuadro.
// Lo que todavía no está grabado (el chat de MaKo al lado del lienzo: necesita la IA del negocio) va con el recuadro de lo que falta.
// Lo que NO se copió, y por qué: ver la cabecera de ../image.ts (Black Friday, «Publica en», el cronograma, el editor en vivo, sus
// socios, sus testimonios). Sus menús desplegables de la barra no van: en producción la barra es la del sitio (BARRA_PROPIA).
// Server component: lo que se mueve con JavaScript va en un <script data-visor> (el visor de Martín borra los demás): el acordeón
// animado, copiar el comando y el video que corre sólo a la vista. Sin JavaScript, las preguntas son <details> y andan igual.
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import { Icon } from '../../_detalle/FeatureDetail';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';
import type { Bloque } from '../tipos';
import { FaltaAnimacion } from '../FaltaAnimacion';
import { rotuloMultiplo } from '@/lib/multiplo-rendimiento';
import { TIPOS_CARRUSEL } from '@/lib/carruseles/tipos';

const P = 'd-image';
const A = '/vsl-assets/image';

type Hero = Extract<Bloque, { tipo: 'hero' }>;
type Cifras = Extract<Bloque, { tipo: 'cifras' }>;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Pasos = Extract<Bloque, { tipo: 'pasos' }>;
type Preguntas = Extract<Bloque, { tipo: 'preguntas' }>;

/** Las cuatro láminas del hero: «Paso a paso» (Consulta Rentable, un negocio del ejemplo) con el kit angosto de la portada
 *  (banco-image-landing/entrada.tsx → KITS.cierre: Anton y Inter), la portada, el paso 1, el paso 2 y el cierre. */
const LAMINAS_HERO = [1, 2, 3, 4].map((i) => `${A}/laminas/portada-${i}.jpg`);
/** Los colores del kit de esas láminas, en su orden (principal, acento, fondo, texto, secundario): los mismos del banco. */
const KIT_HERO = ['#1F3A5F', '#F25F4C', '#FAFAF7', '#111111', '#E9E4DA'];
/** «Formatos»: lo que arma MaKo en cada tamaño (el ancho y el alto son los del diseño, para la proporción). */
const FORMATOS = [
  { src: `${A}/laminas/formato-historia.jpg`, nombre: 'Historia', w: 1080, h: 1920 },
  { src: `${A}/laminas/formato-carrusel.jpg`, nombre: 'Carrusel', w: 1080, h: 1350 },
  { src: `${A}/laminas/formato-publicacion.jpg`, nombre: 'Publicación', w: 1080, h: 1350 },
  { src: `${A}/laminas/formato-miniatura.jpg`, nombre: 'Miniatura', w: 1280, h: 720 },
] as const;
/** «Kit de marca»: la MISMA lámina («Mito vs. realidad») con tres kits: sus colores y su letra de títulos. */
const KITS: readonly { src: string; letra: string; colores: readonly string[] }[] = [
  { src: `${A}/laminas/kit-cierre.jpg`, letra: 'Anton', colores: ['#1F3A5F', '#F25F4C', '#FAFAF7', '#111111'] },
  { src: `${A}/laminas/kit-pulso.jpg`, letra: 'Oswald', colores: ['#0F766E', '#F59E0B', '#F0FDFA', '#0B1F1D'] },
  { src: `${A}/laminas/kit-voz.jpg`, letra: 'Bebas Neue', colores: ['#F2B01E', '#E11D48', '#15171C', '#FFFFFF'] },
];
/** La grabación de «Editar» (la de la portada): la biblioteca, el clic, la copia que abre sus láminas y «Tu versión». */
// El póster es su PRIMER cuadro (el de la portada, sitio/carruseles.jpg, es un cuadro del medio: al arrancar saltaría).
const GRABACION_EDITAR = { video: '/vsl-assets/sitio/carruseles.webm', poster: '/vsl-assets/image/editar-poster.jpg' };
/** «Lienzo»: el editor real grabado en el banco (C:/dev/bancos-portada/banco-image-landing/editor/grabar-lienzo.mjs). */
const GRABACION_LIENZO = { video: `${A}/lienzo.webm`, poster: `${A}/lienzo.jpg` };
/** Seis outliers de la biblioteca de ejemplos (la que lee Instagram directo; banco-carruseles-replica/car-simple.json), de mayor a
 *  menor: su @, su outlier y su shortcode (el link al original). Las portadas, achicadas a 432 × 540, en public/vsl-assets/image/outliers. */
const OUTLIERS = [
  { u: 'reynardlowell', x: 542.1, ref: 'DeKVaEMmHBw' },
  { u: 'lifeofarjav', x: 382.6, ref: 'DaZFc_kkttt' },
  { u: 'brainchanges', x: 209.8, ref: 'DTD6IFeEW7f' },
  { u: 'studio_2am', x: 142, ref: 'DdnGF1hmJW2' },
  { u: 'creatoearn', x: 97.1, ref: 'Dc6RTCcCH41' },
  { u: 'endlesstools', x: 95.3, ref: 'DdbmRanCnXF' },
] as const;
/** Lo que se descarga (la franja de prueba social, en el lugar de sus socios). */
const DESCARGAS = ['PNG', 'JPG', 'PDF', 'SVG'] as const;
/** El comando de la tarjeta negra: la ruta REST de crear un diseño (lib/api-mako/rest.ts → crear_diseno_imagen). */
const COMANDO = 'POST /api/v1/imagen/disenos';

// ── Íconos (tabler, de línea, como los suyos) ───────────────────────────────
const svg = (d: string[], size = 16, w = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.map((x) => <path key={x} d={x} />)}</svg>
);
const I = {
  rayo: ['M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11'],
  lapiz: ['M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4', 'M13.5 6.5l4 4'],
  flecha: ['M5 12l14 0', 'M13 18l6 -6', 'M13 6l6 6'],
  tilde: ['M5 12l5 5l10 -10'],
  chevron: ['M6 9l6 6l6 -6'],
  copiar: ['M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z', 'M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1'],
  codigo: ['M7 8l-4 4l4 4', 'M17 8l4 4l-4 4', 'M14 4l-4 16'],
  libro: ['M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6l0 13', 'M12 6l0 13', 'M21 6l0 13'],
  ajustes: ['M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M4 6l8 0', 'M16 6l4 0', 'M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M4 12l2 0', 'M10 12l10 0', 'M17 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M4 18l11 0', 'M19 18l1 0'],
  varita: ['M6 21l15 -15l-3 -3l-15 15l3 3', 'M15 6l3 3', 'M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2', 'M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2'],
  diagonal: ['M17 7l-10 10', 'M8 7l9 0l0 9'],
  bajar: ['M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2', 'M7 11l5 5l5 -5', 'M12 4l0 12'],
  archivo: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z'],
};
/** Las redes de «Diseña para» (su «Publica en»): el chip de color de cada una con su marca en blanco. */
const REDES = [
  { nombre: 'Instagram', clase: 'ig', d: ['M4 4m0 4a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z', 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M16.5 7.5l0 .01'] },
  { nombre: 'Facebook', clase: 'fb', d: ['M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3'] },
  { nombre: 'YouTube', clase: 'yt', d: ['M2 8a4 4 0 0 1 4 -4h12a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-12a4 4 0 0 1 -4 -4v-8z', 'M10 9l5 3l-5 3z'] },
] as const;

function Boton({ texto = TEXTO_CTA, href = RUTA_CTA, clase = '', izq, der }: { texto?: string; href?: string; clase?: string; izq?: ReactNode; der?: ReactNode }) {
  return (
    <a href={href} className={`${P}-btn ${clase}`}>
      {izq ? <span className={`${P}-btn-sec`}>{izq}</span> : null}
      <span className={`${P}-btn-txt`}>{texto}</span>
      {der ? <span className={`${P}-btn-sec`}>{der}</span> : null}
    </a>
  );
}

/** El marco de selección (su `.pn-frame`): la pestaña con el nombre, el borde del color y un cuadradito en cada esquina. */
function Marco({ nombre, children, clase = '' }: { nombre: string; children: ReactNode; clase?: string }) {
  return (
    <div className={`${P}-marco ${clase}`}>
      <span className={`${P}-marco-tab`}>{nombre}</span>
      <span className={`${P}-esq ${P}-esq-1`} aria-hidden="true" /><span className={`${P}-esq ${P}-esq-2`} aria-hidden="true" />
      <span className={`${P}-esq ${P}-esq-3`} aria-hidden="true" /><span className={`${P}-esq ${P}-esq-4`} aria-hidden="true" />
      {children}
    </div>
  );
}

/** Su cabecera de sección centrada: cejilla mono del color, titular y bajada. */
function Cabecera({ cejilla, titulo, bajada, id, ancha = false }: { cejilla?: string; titulo: string; bajada?: string; id?: string; ancha?: boolean }) {
  return (
    <div className={`${P}-cont${ancha ? ` ${P}-cont-ancha` : ''}`}>
      {cejilla ? <p className={`${P}-cej`}>{cejilla}</p> : null}
      <h2 className={`${P}-h2c`} id={id} dangerouslySetInnerHTML={html(titulo)} />
      {bajada ? <p className={`${P}-desc`} dangerouslySetInnerHTML={html(bajada)} /> : null}
    </div>
  );
}

// ── Hero + franja de prueba social (una pantalla) ───────────────────────────
function HeroPostNitro({ b, cifras }: { b: Hero; cifras?: Cifras }) {
  const tipos = TIPOS_CARRUSEL.length;
  return (
    <section className={`${P}-hero`} aria-labelledby={`${P}-h1`}>
      <span className={`${P}-puntos`} aria-hidden="true" />
      <div className={`${P}-hero-in`}>
        <div className={`${P}-hero-txt`}>
          <p className={`${P}-badge`}><span className={`${P}-badge-ic`}>{svg(I.rayo, 14)}</span>{b.etiqueta}</p>
          <h1 className={`${P}-h1`} id={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
          <p className={`${P}-hero-p`} dangerouslySetInnerHTML={html(b.bajada)} />
          <div className={`${P}-hero-acc`}><Boton izq={svg(I.lapiz, 18)} /></div>
          <p className={`${P}-nota`}>{TEXTO_CIERRE}</p>
          <div className={`${P}-redes`}>
            <span className={`${P}-redes-t`}>Diseña para</span>
            {REDES.map((r) => <span key={r.nombre} className={`${P}-red ${P}-red-${r.clase}`} title={r.nombre} data-tema-fijo="">{svg([...r.d], 15, 2)}<span className={`${P}-oculto`}>{r.nombre}</span></span>)}
          </div>
        </div>
        <Marco nombre="Plantillas · 4:5" clase={`${P}-marco-hero`}>
          <div className={`${P}-muro`}>
            {LAMINAS_HERO.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <div key={src} className={`${P}-lam`} data-tema-fijo=""><img src={src} alt={i === 0 ? 'La portada de un carrusel «Paso a paso» de MaKo con el kit de marca aplicado' : `La lámina ${i + 1} del mismo carrusel`} width={540} height={675} decoding="async" /></div>
            ))}
          </div>
          <div className={`${P}-kit`}>
            <span className={`${P}-kit-t`}>Kit de marca</span>
            {KIT_HERO.map((c) => <span key={c} className={`${P}-kit-c`} style={{ background: c }} data-tema-fijo="" aria-hidden="true" />)}
            <span className={`${P}-kit-t ${P}-kit-nota`}>{tipos} tipos de carrusel y los tuyos.</span>
          </div>
        </Marco>
        {/* Su «Dale acceso a PostNitro a tu agente»: en MaKo, la API (lib/api-mako/areas/imagen.def.ts), con su ruta de verdad. */}
        <section className={`${P}-agente`} aria-labelledby={`${P}-agente-t`} data-tema-fijo="">
          <div className={`${P}-agente-txt`}>
            <span className={`${P}-agente-cej`}>Para tu sistema</span>
            <h2 className={`${P}-agente-t`} id={`${P}-agente-t`}>Dale acceso a Image a tu código.</h2>
            <p className={`${P}-agente-p`}>Con un token de la <a href="/vsl/api">API de MaKo</a>, tu sistema ve tus diseños, crea uno desde una plantilla y le cambia los textos. El diseño final y la descarga, en el editor.</p>
          </div>
          <div className={`${P}-agente-acc`}>
            <div className={`${P}-puertas`}>
              <Boton texto="La API de MaKo" href="/vsl/api" clase={`${P}-btn-sm`} izq={svg(I.codigo, 16)} der={svg(I.flecha, 14)} />
              <Boton texto="Lo que hace" href={`#${P}-automatizar`} clase={`${P}-btn-sm ${P}-btn-blanco`} izq={svg(I.libro, 16)} der={svg(I.flecha, 14)} />
            </div>
            <span className={`${P}-cmd`} role="button" tabIndex={0} data-copiar={COMANDO} aria-label={`Copia la ruta: ${COMANDO}`}>
              <span className={`${P}-cmd-t`}>{COMANDO}</span>
              <span className={`${P}-cmd-ic ${P}-cmd-copiar`}>{svg(I.copiar, 16)}</span>
              <span className={`${P}-cmd-ic ${P}-cmd-listo`}>{svg(I.tilde, 16)}</span>
            </span>
          </div>
        </section>
      </div>
      {cifras ? <Franja c={cifras} /> : null}
    </section>
  );
}

/** Su franja de prueba social (avatares, 5.0, «86,000+ creators» | «200+ platforms…» y sus socios): lo que Image trae y lo que se descarga. */
function Franja({ c }: { c: Cifras }) {
  const [primera, ...resto] = c.items;
  const formatos = resto.filter((x) => !/formatos de descarga/.test(x.label));
  return (
    <div className={`${P}-franja`} aria-label={c.titulo ?? 'En números'}>
      <div className={`${P}-franja-g`}>
        <span className={`${P}-franja-pila`} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {LAMINAS_HERO.map((src) => <img key={src} src={src} alt="" width={26} height={32} data-tema-fijo="" />)}
        </span>
        <span>
          <span className={`${P}-franja-fila`}><b className={`${P}-franja-num`}>{primera.valor}</b><span className={`${P}-franja-txt`}>{primera.label}</span></span>
          <span className={`${P}-franja-fuerte`}>{formatos.map((x) => `${x.valor} ${x.label}`).join(' · ')}</span>
        </span>
      </div>
      <span className={`${P}-franja-div`} aria-hidden="true" />
      <div>
        <span className={`${P}-franja-fuerte`}>Lo descargas en</span>
        <span className={`${P}-socios`}>{DESCARGAS.map((d) => <span key={d} className={`${P}-socio`}>{svg(I.archivo, 13)}{d}</span>)}</span>
      </div>
    </div>
  );
}

// ── «Pruébalo, no es un video»: la grabación de «Editar» en su marco ────────
function Demo({ b }: { b: Tarjetas }) {
  return (
    <section className={`${P}-sec ${P}-blanca`} aria-labelledby={`${P}-demo-t`}>
      <Cabecera cejilla={b.etiqueta} titulo={b.titulo} bajada={b.bajada} id={`${P}-demo-t`} ancha />
      <Marco nombre="Editar · en MaKo" clase={`${P}-marco-demo`}>
        <div className={`${P}-demo-vid`} data-tema-fijo="">
          <video src={GRABACION_EDITAR.video} poster={GRABACION_EDITAR.poster} muted loop playsInline preload="none" data-a-la-vista="" aria-label="Grabado en MaKo: la biblioteca de carruseles que funcionan, el clic en uno y su réplica, lámina por lámina, con tus textos" />
        </div>
      </Marco>
      <div className={`${P}-demo-pie`}>
        <Boton izq={svg(I.lapiz, 18)} />
        <p className={`${P}-pista`}>Grabado en MaKo: los ejemplos y la réplica son de verdad.</p>
      </div>
    </section>
  );
}

// ── «Más de 100 plantillas»: los carruseles que funcionan ───────────────────
function Plantillas({ b }: { b: Tarjetas }) {
  return (
    <section className={`${P}-sec ${P}-blanca`} aria-labelledby={`${P}-plant-t`}>
      <Cabecera cejilla={b.etiqueta} titulo={b.titulo} bajada={b.bajada} id={`${P}-plant-t`} />
      <div className={`${P}-plant`}>
        {OUTLIERS.map((o) => (
          <a key={o.u} className={`${P}-plant-i`} href={`https://www.instagram.com/p/${o.ref}/`} target="_blank" rel="noopener noreferrer" title={`El original de @${o.u}, en Instagram`}>
            <span className={`${P}-plant-img`} data-tema-fijo="">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${A}/outliers/${o.u}.jpg`} alt={`La portada del carrusel de @${o.u}`} width={432} height={540} loading="lazy" decoding="async" />
              <span className={`${P}-plant-x`}>{rotuloMultiplo(o.x)}</span>
            </span>
            <span className={`${P}-plant-u`}>@{o.u}</span>
          </a>
        ))}
      </div>
      <div className={`${P}-plant-pie`}>
        <p className={`${P}-plant-txt`}>Con «Editar», tu versión: su mismo diseño y tus textos.</p>
        <Boton clase={`${P}-btn-linea`} der={svg(I.flecha, 16)} />
      </div>
    </section>
  );
}

// ── Los tres pasos ───────────────────────────────────────────────────────────
function TresPasos({ b }: { b: Pasos }) {
  const iconos = [I.ajustes, I.varita, I.bajar];
  return (
    <section className={`${P}-sec ${P}-blanca`} aria-labelledby={`${P}-pasos-t`}>
      <div className={`${P}-pasos-sec`}>
        <h2 className={`${P}-h2`} id={`${P}-pasos-t`} dangerouslySetInnerHTML={html(b.titulo)} />
        <ol className={`${P}-pasos`}>
          {b.pasos.map((p, i) => (
            <li key={p.titulo} className={`${P}-paso`}>
              <span className={`${P}-paso-cab`}><b className={`${P}-paso-n`}>{String(i + 1).padStart(2, '0')}</b><i className={`${P}-raya`} aria-hidden="true" /></span>
              <span className={`${P}-paso-fila`}><span className={`${P}-paso-ic`}>{svg(iconos[i % 3], 16)}</span><h3 className={`${P}-paso-t`} dangerouslySetInnerHTML={html(p.titulo)} /></span>
              <p className={`${P}-paso-x`} dangerouslySetInnerHTML={html(p.texto)} />
            </li>
          ))}
        </ol>
        <div><Boton clase={`${P}-btn-linea`} der={svg(I.flecha, 16)} /></div>
      </div>
    </section>
  );
}

// ── Los grupos numerados («01 DISEÑO ——», «02 AUTOMATIZAR ——») ─────────────
function CabGrupo({ n, b, id }: { n: number; b: Tarjetas; id: string }) {
  return (
    <div className={`${P}-grupo-cab`}>
      <p className={`${P}-indice`}><span className={`${P}-indice-n`}>{String(n).padStart(2, '0')}</span><span className={`${P}-indice-t`}>{b.etiqueta}</span><i className={`${P}-raya`} aria-hidden="true" /></p>
      <h2 className={`${P}-grupo-t`} id={id} dangerouslySetInnerHTML={html(b.titulo)} />
      {b.bajada ? <p className={`${P}-grupo-p`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
    </div>
  );
}

/** Lo que va en el marco de cada fila de «01 Diseño», por su etiqueta. */
function MedioDeFila({ etiqueta }: { etiqueta?: string }) {
  if (etiqueta === 'Formatos') {
    return (
      <div className={`${P}-formatos`} data-tema-fijo="">
        {FORMATOS.map((f) => (
          <figure key={f.nombre} className={`${P}-formato ${P}-formato-${f.nombre.toLowerCase()}`} style={{ aspectRatio: `${f.w} / ${f.h}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.src} alt={`${f.nombre} hecha en Image con una plantilla de MaKo`} loading="lazy" decoding="async" />
          </figure>
        ))}
      </div>
    );
  }
  if (etiqueta === 'Kit de marca') {
    return (
      <div className={`${P}-kits`} data-tema-fijo="">
        {KITS.map((k) => (
          <figure key={k.letra} className={`${P}-kits-i`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={k.src} alt={`La misma lámina con otro kit de marca: sus colores y la letra ${k.letra}`} width={540} height={675} loading="lazy" decoding="async" />
            <figcaption>{k.colores.map((c) => <i key={c} style={{ background: c }} />)}<span>{k.letra}</span></figcaption>
          </figure>
        ))}
      </div>
    );
  }
  if (etiqueta === 'Chat de MaKo') return <FaltaAnimacion que="El chat de MaKo al lado del lienzo: le pides un cambio y te muestra «Original | Modificado» para aceptarlo." />;
  // «Lienzo»: el editor REAL (banco-image-landing/editor: EditorApp con el carrusel de la portada), la cámara sobre la lámina: se toca el
  // titular, se baja y vuelve. El póster es su primer cuadro.
  return (
    <div className={`${P}-lienzo-vid`} data-tema-fijo="">
      <video src={GRABACION_LIENZO.video} poster={GRABACION_LIENZO.poster} muted loop playsInline preload="none" data-a-la-vista="" aria-label="El editor de Image: se toca el titular de la lámina, sale su caja con los tiradores y la barra de texto, y se arrastra" />
    </div>
  );
}

function Fila({ b, i }: { b: Tarjetas; i: number }) {
  return (
    <div className={`${P}-fila`} data-giro={i % 2 === 1 ? 'si' : 'no'}>
      <div>
        <h3 className={`${P}-fila-t`} dangerouslySetInnerHTML={html(b.titulo)} />
        {b.bajada ? <p className={`${P}-fila-p`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        <ul className={`${P}-lista`}>
          {b.items.map((t) => (
            <li key={t.titulo}>
              <span className={`${P}-tic`} aria-hidden="true">{svg(I.tilde, 11, 2.5)}</span>
              <span><b dangerouslySetInnerHTML={html(t.titulo)} /><span dangerouslySetInnerHTML={html(t.texto)} /></span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`${P}-medio`}>
        <Marco nombre={b.etiqueta ?? ''} clase={`${P}-marco-fila`}><MedioDeFila etiqueta={b.etiqueta} /></Marco>
      </div>
    </div>
  );
}

function Celdas({ b }: { b: Tarjetas }) {
  return (
    <div className={`${P}-celdas`}>
      <h3 className={`${P}-oculto`}>{b.titulo}</h3>
      {b.items.map((t) => (
        <div key={t.titulo} className={`${P}-celda`}>
          <span className={`${P}-celda-cab`}><span className={`${P}-celda-ic`}>{t.icono ? <Icon paths={t.icono} size={18} /> : null}</span><span className={`${P}-celda-t`} dangerouslySetInnerHTML={html(t.titulo)} /></span>
          <span className={`${P}-celda-x`} dangerouslySetInnerHTML={html(t.texto)} />
        </div>
      ))}
    </div>
  );
}

function GrupoDiseno({ cab, filas, celdas }: { cab: Tarjetas; filas: Tarjetas[]; celdas?: Tarjetas }) {
  return (
    <section className={`${P}-sec ${P}-gris`} id={`${P}-diseno`} aria-labelledby={`${P}-diseno-t`}>
      <div className={`${P}-grupo`}>
        <CabGrupo n={1} b={cab} id={`${P}-diseno-t`} />
        <div className={`${P}-filas`}>{filas.map((f, i) => <Fila key={f.titulo} b={f} i={i} />)}</div>
        {celdas ? <Celdas b={celdas} /> : null}
      </div>
    </section>
  );
}

function GrupoAutomatizar({ b, celdas }: { b: Tarjetas; celdas?: Tarjetas }) {
  return (
    <section className={`${P}-sec ${P}-gris ${P}-sec-auto`} id={`${P}-automatizar`} aria-labelledby={`${P}-auto-t`}>
      <div className={`${P}-grupo`}>
        <CabGrupo n={2} b={b} id={`${P}-auto-t`} />
        <div className={`${P}-negras`}>
          {b.items.map((t) => (
            // Sus tarjetas son links (con la flecha ↗): la de la API lleva a /vsl/api; las otras, a empezar con MaKo.
            <a key={t.titulo} href={/API/.test(t.titulo) ? '/vsl/api' : RUTA_CTA} className={`${P}-negra`} data-tema-fijo="">
              <span className={`${P}-negra-cab`}><span className={`${P}-negra-ic`}>{t.icono ? <Icon paths={t.icono} size={16} /> : null}</span><h3 className={`${P}-negra-t`} dangerouslySetInnerHTML={html(t.titulo)} /><span className={`${P}-negra-fl`}>{svg(I.diagonal, 16)}</span></span>
              {t.meta ? <span className={`${P}-negra-art`}>{t.meta}</span> : null}
              <p className={`${P}-negra-x`} dangerouslySetInnerHTML={html(t.texto)} />
            </a>
          ))}
        </div>
        {celdas ? <Celdas b={celdas} /> : null}
      </div>
    </section>
  );
}

// ── Testimonios (su muro de tarjetas): el caso de Mauricio ──────────────────
function Testimonios() {
  return (
    <section className={`${P}-sec ${P}-blanca`} aria-labelledby={`${P}-caso-t`}>
      <Cabecera cejilla="Resultados" titulo={CASO.titulo} bajada={CASO.sub} id={`${P}-caso-t`} />
      <div className={`${P}-muro-t`}>
        <figure className={`${P}-testi`}>
          <div className={`${P}-testi-vid`} data-tema-fijo="">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video muted loop playsInline controls preload="metadata"><source src={CASO.video} type="video/mp4" /></video>
          </div>
          <figcaption className={`${P}-testi-quien`}><span className={`${P}-mono`} aria-hidden="true">{CASO.quien.slice(0, 2).toUpperCase()}</span><span><span className={`${P}-testi-n`}>{CASO.quien}</span><span className={`${P}-testi-r`}>{CASO.rol}</span></span></figcaption>
        </figure>
        <figure className={`${P}-testi`}>
          <blockquote className={`${P}-testi-m`}>{CASO.historia.map((h) => <p key={h} dangerouslySetInnerHTML={html(h)} />)}</blockquote>
          <figcaption className={`${P}-testi-quien`}><span className={`${P}-mono`} aria-hidden="true">{CASO.quien.slice(0, 2).toUpperCase()}</span><span><span className={`${P}-testi-n`}>{CASO.quien}</span><span className={`${P}-testi-r`}>{CASO.rol}</span></span></figcaption>
        </figure>
        <figure className={`${P}-testi`}>
          <blockquote className={`${P}-testi-m`}><p dangerouslySetInnerHTML={html(CASO.resultado)} /></blockquote>
          <ul className={`${P}-testi-meses`}>{CASO.meses.map((m) => <li key={m.mes}><span>{m.mes}</span><b>{m.monto}</b></li>)}</ul>
        </figure>
      </div>
      <div className={`${P}-testi-acc`}><Boton der={svg(I.flecha, 16)} /></div>
    </section>
  );
}

// ── Preguntas (su acordeón separado) ────────────────────────────────────────
function PreguntasPN({ b }: { b: Preguntas }) {
  return (
    <section className={`${P}-sec ${P}-blanca`} id={`${P}-faq`} aria-labelledby={`${P}-faq-t`}>
      <Cabecera cejilla="Preguntas" titulo={b.titulo} id={`${P}-faq-t`} />
      <div className={`${P}-cont ${P}-faq`}>
        {b.items.map((q, i) => (
          <details key={q.p} className={`${P}-faq-i`} open={i === 0}>
            <summary className={`${P}-faq-c`}><h3 className={`${P}-faq-l`}>{q.p}</h3><span className={`${P}-faq-ch`}>{svg(I.chevron, 16)}</span></summary>
            <div className={`${P}-faq-panel`}><p className={`${P}-faq-x`} dangerouslySetInnerHTML={html(q.r)} /></div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function DisenoImage({ landing }: PropsDiseno) {
  const bl = landing.bloques;
  const hero = bl.find((b): b is Hero => b.tipo === 'hero');
  const cifras = bl.find((b): b is Cifras => b.tipo === 'cifras');
  const tar = bl.filter((b): b is Tarjetas => b.tipo === 'tarjetas');
  const pasos = bl.find((b): b is Pasos => b.tipo === 'pasos');
  const preguntas = bl.find((b): b is Preguntas => b.tipo === 'preguntas');
  // Las tarjetas, en el orden de ../image.ts: el demo, las plantillas, la cabecera de «Diseño», sus cuatro filas, su grilla,
  // «Automatizar» y su grilla.
  const [demo, plantillas, cabDiseno, ...resto] = tar;
  const filas = resto.slice(0, 4);
  const celdasDiseno = resto[4];
  const auto = resto[5];
  const celdasAuto = resto[6];
  const otras = otrasFunciones(landing.slug);
  const porCol = Math.ceil(otras.length / 4);
  const columnas = [0, 1, 2, 3].map((k) => otras.slice(k * porCol, (k + 1) * porCol));
  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      {/* Su barra: dos cajas blancas flotantes. En producción la tapa la barra del sitio (BARRA_PROPIA en ../TemaSitio.tsx). */}
      <header className={`${P}-barra`}>
        <div className={`${P}-barra-caja`}>
          <LogoMaKo className={`${P}-logo`} tamano={26} />
          <a href="/vsl" className={`${P}-barra-link`}>Funcionalidades</a>
        </div>
        <div className={`${P}-barra-caja`}>
          <a href={RUTA_CTA} className={`${P}-barra-btn`}>{svg(I.lapiz, 14)}{TEXTO_CTA}</a>
        </div>
      </header>

      <main>
        {hero ? <HeroPostNitro b={hero} cifras={cifras} /> : null}
        {demo ? <Demo b={demo} /> : null}
        {plantillas ? <Plantillas b={plantillas} /> : null}
        {pasos ? <TresPasos b={pasos} /> : null}
        {cabDiseno ? <GrupoDiseno cab={cabDiseno} filas={filas} celdas={celdasDiseno} /> : null}
        {auto ? <GrupoAutomatizar b={auto} celdas={celdasAuto} /> : null}
        {bl.some((b) => b.tipo === 'caso') ? <Testimonios /> : null}
        {preguntas ? <PreguntasPN b={preguntas} /> : null}
      </main>

      <footer className={`${P}-pie`}>
        <div className={`${P}-pie-in`}>
          <div className={`${P}-pie-marca`}>
            <LogoMaKo tamano={30} />
            <p>El mejor software para vender High Ticket.</p>
          </div>
          <div className={`${P}-pie-cols`}>
            {columnas.map((col, i) => (
              <div key={i} className={`${P}-pie-col`}>
                <p className={`${P}-pie-t`}>{i === 0 ? 'Funcionalidades' : '\u00a0'}</p>
                {col.map((f) => <a key={f.href} href={f.href}>{f.nombre}</a>)}
              </div>
            ))}
          </div>
        </div>
        <div className={`${P}-pie-base`}>
          <span>© MaKo — Todos los derechos reservados.</span>
          <span className={`${P}-pie-legal`}><a href="/terminos">Términos</a><a href="/privacidad">Privacidad</a></span>
        </div>
      </footer>
    </div>
  );
}

// =============================================================================
// Los valores: los de su CSS (los módulos HeroSection, SlideWall, BrandKitStrip, AgentAccess, ProofStrip, EditorDemo,
// TemplatesSection, StepsSection, FeatureGroups, AgentCard, WallOfLove, FaqSection, Footer y las clases globales .pn-*), leídos
// el 14/11/2026 y confirmados con getComputedStyle. 1 rem = 16 px. Sus fórmulas fluidas (clamp con vw) van tal cual.
// Sus tokens: --pn-ground #F5F8F7, --pn-surface #FFF, --pn-ink #07120F, --pn-ink-2 #384843, --pn-muted #5A6C67, --pn-rule #D5E0DC,
// --pn-rule-soft #E9EFED, --pn-accent #087A68 (→ #2F6FED), --pn-accent-hover #065D50 (→ #1F57C8), --pn-accent-bright #0DC7A9
// (→ #8FB2F7), --pn-accent-soft #E0F1EC (→ #E4EDFD), --pn-accent-ink #065A4D (→ #1F57C8), --pn-agent-bg #07120F, --pn-agent-ink-2
// #9FB4AE, --pn-gutter clamp(1.25rem, 5vw, 5rem), --pn-w-page 82rem, --pn-w-prose 48rem, --pn-section-y clamp(3.5rem, 7vw, 6rem),
// --pn-radius-frame 12px, --pn-radius-card 9px. Las sombras de Mantine del tema: xs 0 1px 2px rgba(7,18,15,.05); sm + 0 6px 14px
// -8px .14; md + 0 14px 30px -14px .20.
// =============================================================================
const CSS = `
@font-face { font-family: 'DImgArchivo'; src: url('/vsl-assets/fuentes/archivo/archivo-latin-wdth-wght.woff2') format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; font-display: swap; }
@font-face { font-family: 'DImgInstrument'; src: url('/vsl-assets/fuentes/instrument-sans/instrument-sans-latin-var.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'DImgMono'; src: url('/vsl-assets/fuentes/jetbrains-mono/jetbrains-mono-latin-var.woff2') format('woff2'); font-weight: 100 800; font-display: swap; }

.${P} { --disp: 'DImgArchivo', -apple-system, 'Segoe UI', sans-serif; --txt: 'DImgInstrument', -apple-system, 'Segoe UI', sans-serif; --mono: 'DImgMono', ui-monospace, Menlo, Consolas, monospace;
  --ground: #F5F8F7; --surface: #FFFFFF; --surface-2: #E9EFED; --ink: #07120F; --ink-2: #384843; --muted: #5A6C67; --rule: #D5E0DC; --rule-soft: #E9EFED;
  --accent: #2F6FED; --accent-hover: #1F57C8; --accent-lleno-hover: #2962D4; --accent-bright: #8FB2F7; --accent-soft: #E4EDFD; --accent-ink: #1F57C8; --star: #FFAC2F;
  --agent-bg: #07120F; --agent-ink: #FFFFFF; --agent-ink-2: #9FB4AE;
  /* La barra del sitio (../_sitio/estilos.ts: 76 + 1 de borde; 56 + 1 desde 1023): el hero llena lo que queda de la pantalla. */
  --barra-sitio: 77px;
  --gutter: clamp(20px, 5vw, 80px); --w-page: 1312px; --w-prose: 768px; --sec-y: clamp(56px, 7vw, 96px); --r-frame: 12px; --r-card: 9px;
  --sh-xs: 0 1px 2px rgba(7,18,15,.05); --sh-sm: 0 1px 2px rgba(7,18,15,.05), 0 6px 14px -8px rgba(7,18,15,.14); --sh-md: 0 1px 2px rgba(7,18,15,.05), 0 14px 30px -14px rgba(7,18,15,.20);
  background: var(--ground); color: var(--ink-2); font-family: var(--txt); font-size: 16px; line-height: 1.6; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.${P} *, .${P} *::before, .${P} *::after { box-sizing: border-box; }
.${P} :where(h1, h2, h3, p, ul, ol, figure, blockquote) { margin: 0; padding: 0; }
.${P} :where(ul, ol) { list-style: none; }
.${P} :where(a) { color: inherit; }
.${P} strong { font-weight: 600; color: var(--ink); }
.${P}-oculto { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* Barra: dos cajas blancas flotantes (su HeaderBar: radio 8, padding 4 / 8, sombra 0 2px 10px #0000001a, borde de abajo 1 px) */
.${P}-barra { position: relative; z-index: 30; display: flex; justify-content: space-between; align-items: center; min-height: 56px; padding: 4px .9vw; }
.${P}-barra-caja { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 8px; background: var(--surface); border-bottom: 1px solid var(--rule); box-shadow: 0 2px 10px rgba(0,0,0,.1); }
.${P}-logo { margin-right: 10px; }
.${P}-logo span:last-child { font-family: var(--disp); font-weight: 800 !important; }
.${P}-barra-link { height: 28px; display: inline-flex; align-items: center; padding: 0 10px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--ink); text-decoration: none; transition: background-color .15s; }
.${P}-barra-link:hover { background: color-mix(in oklab, var(--accent) 6%, transparent); }
.${P}-barra-btn { height: 30px; display: inline-flex; align-items: center; gap: 8px; padding: 0 14px 0 9.33px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 12px; font-weight: 600; text-decoration: none; white-space: nowrap; transition: background-color .15s; }
.${P}-barra-btn:hover { background: var(--accent-lleno-hover); }
.${P}-barra-btn:active { transform: translateY(1px); }

/* Botones (su Mantine Button): md = 42 px de alto, padding 22 (14,67 del lado del ícono), radio 8, 16 px; la etiqueta en 600.
   Al pasar el mouse sólo cambia el fondo (no se mueve); al apretar baja 1 px. */
.${P}-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 42px; padding: 0 22px; border-radius: 8px; border: 1px solid transparent; background: var(--accent); color: #fff; font-family: var(--txt); font-size: 16px; line-height: 1; font-weight: 500; text-decoration: none; white-space: nowrap; cursor: pointer; user-select: none; transition: background-color .15s, border-color .15s; }
.${P}-btn:has(> .${P}-btn-sec:first-child) { padding-left: 14.67px; }
.${P}-btn:has(> .${P}-btn-sec:last-child) { padding-right: 14.67px; }
.${P}-btn-txt { font-weight: 600; }
.${P}-btn-sec { display: inline-flex; }
.${P}-btn:hover { background: var(--accent-lleno-hover); }
.${P}-btn:active { transform: translateY(1px); }
.${P}-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 32%, transparent); }
/* El de línea (su variante «default»): blanco, borde gris #CED4DA, tinta; al pasar el mouse, gris #F8F9FA */
.${P}-btn-linea { background: #FFFFFF; color: var(--ink); border-color: #CED4DA; }
.${P}-btn-linea:hover { background: #F8F9FA; }
/* Chico (sm = 36 px, 14 px, padding 18 / 12) */
.${P}-btn-sm { height: 36px; padding: 0 18px; font-size: 14px; }
.${P}-btn-blanco { background: #FFFFFF; color: var(--ink); }
.${P}-btn-blanco:hover { background: #F1F3F5; }
.${P}-btn-sm:has(> .${P}-btn-sec:first-child) { padding-left: 12px; }
.${P}-btn-sm:has(> .${P}-btn-sec:last-child) { padding-right: 12px; }

/* ── Hero: una pantalla entera (min-height 100svh), fondo con puntos de 0,5 px cada 14 px ── */
.${P}-hero { position: relative; isolation: isolate; display: flex; flex-direction: column; align-items: stretch; min-height: calc(100svh - var(--barra-sitio)); padding-top: clamp(20px, 3vw, 40px); overflow: hidden; background: var(--ground); }
.${P}-puntos { position: absolute; inset: 0; z-index: -1; background-image: radial-gradient(var(--rule) .5px, transparent .5px); background-size: 14px 14px; pointer-events: none; }
.${P}-hero-in { width: 100%; max-width: calc(var(--w-page) + 2 * var(--gutter)); margin: auto; padding: 0 var(--gutter); display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); align-items: center; gap: clamp(24px, 4vw, 48px); text-align: left; }
.${P}-hero-txt { display: flex; flex-direction: column; align-items: flex-start; }
/* La cejilla (su Badge lg): caja blanca, borde 1 px, sombra xs, 11 px 700 en mayúsculas con .06em */
.${P}-badge { display: inline-flex; align-items: center; gap: 6.4px; max-width: 100%; min-height: 26px; padding: 0 12px; margin-bottom: 20.8px; border-radius: 8px; border: 1px solid var(--rule); background: var(--surface); box-shadow: var(--sh-xs); color: var(--ink-2); font-size: 11px; line-height: 1.4; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.${P}-badge-ic { display: inline-flex; color: var(--ink); }
.${P}-h1 { margin-bottom: 16px; font-family: var(--disp); font-variation-settings: "wdth" 92; font-size: clamp(33.6px, 5vw, 56px); line-height: 1.02; font-weight: 800; letter-spacing: -.032em; color: var(--ink); text-wrap: balance; }
.${P}-hero-p { max-width: 44ch; margin-bottom: 16px; font-size: clamp(16px, 1.6vw, 18px); line-height: 1.55; color: var(--ink-2); }
.${P}-hero-acc { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 9.6px; }
.${P}-nota { margin-bottom: 17.6px; font-size: 12px; line-height: 1.6; color: var(--muted); }
.${P}-redes { width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.${P}-redes-t { margin-right: 3.2px; font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); }
.${P}-red { width: 27.2px; height: 27.2px; flex: none; display: grid; place-items: center; border-radius: 7px; color: #fff; box-shadow: 0 1px 3px rgba(7,18,15,.16); transition: transform .12s, box-shadow .12s; }
.${P}-red:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(7,18,15,.22); }
.${P}-red svg { width: 15.2px; height: 15.2px; display: block; }
.${P}-red-ig { background: linear-gradient(45deg, #FCAF45, #F77737, #E1306C, #833AB4); }
.${P}-red-fb { background: #1877F2; }
.${P}-red-yt { background: #FF0000; }

/* El marco de selección (.pn-frame): fondo blanco, borde 1 px del color, padding clamp(11.2, 1.5vw, 17.6); la pestaña JetBrains 10 /
   700 blanca sobre el color, radio 3 3 0 0, arriba a -24 px; los cuadraditos de 7 px con borde de 1,5 px a -4 px. */
.${P}-marco { position: relative; width: 100%; padding: clamp(11.2px, 1.5vw, 17.6px); background: var(--surface); border: 1px solid var(--accent); }
.${P}-marco-tab { position: absolute; top: -24px; left: -1px; padding: 1.6px 6.72px; border-radius: 3px 3px 0 0; background: var(--accent); color: var(--surface); font-family: var(--mono); font-size: 10px; line-height: 1.6; font-weight: 700; white-space: nowrap; }
.${P}-esq { position: absolute; width: 7px; height: 7px; border-radius: 1px; border: 1.5px solid var(--accent); background: var(--surface); }
.${P}-esq-1 { top: -4px; left: -4px; } .${P}-esq-2 { top: -4px; right: -4px; } .${P}-esq-3 { bottom: -4px; left: -4px; } .${P}-esq-4 { bottom: -4px; right: -4px; }
/* Las cuatro láminas (SlideWall): grilla de 4, abajo alineadas, gap 8,8; las del medio suben 8 px */
.${P}-muro { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: end; gap: 8.8px; }
.${P}-lam { aspect-ratio: 4 / 5; border-radius: var(--r-card); overflow: hidden; box-shadow: var(--sh-sm); transition: transform .18s; }
.${P}-lam:nth-child(2), .${P}-lam:nth-child(3) { transform: translateY(-8px); }
.${P}-lam img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
/* La franja del kit (BrandKitStrip): borde punteado arriba, 13,6 / 12 */
.${P}-kit { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 13.6px; padding-top: 12px; border-top: 1px dashed var(--rule); }
.${P}-kit-t { font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.${P}-kit-nota { margin-left: auto; }
.${P}-kit-c { width: 16.8px; height: 16.8px; border-radius: 50%; box-shadow: 0 0 0 1px var(--rule); }

/* La tarjeta negra a lo ancho (AgentAccess): #07120F, radio 9, padding 20, grilla texto | acciones */
.${P}-agente { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: clamp(20px, 3vw, 40px); padding: clamp(17.6px, 2.5vw, 20px); border-radius: var(--r-card); background: var(--agent-bg); border: 1px solid var(--agent-bg); color: var(--agent-ink-2); text-align: left; }
.${P}-agente-txt { display: grid; gap: 6.4px; }
.${P}-agente-cej { font-family: var(--mono); font-size: 11px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-bright); }
.${P}-agente-t { font-family: var(--disp); font-size: clamp(17.6px, 2vw, 22.4px); line-height: 1.25; font-weight: 600; letter-spacing: -.015em; color: var(--agent-ink); }
.${P}-agente-p { font-size: 14.72px; line-height: 1.55; color: var(--agent-ink-2); }
.${P}-agente-p a { color: var(--accent-bright); text-decoration: underline; text-underline-offset: 2px; }
.${P}-agente-p a:hover { text-decoration-thickness: 2px; }
.${P}-agente-acc { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.${P}-puertas { display: flex; flex-wrap: wrap; gap: 6.4px; }
.${P}-puertas > * { flex: auto; }
.${P}-cmd { display: flex; align-items: center; gap: 9.6px; width: 100%; padding: 7.2px 9.6px; border-radius: var(--r-card); border: 1px solid var(--rule); background: #050D0B; font-family: var(--mono); font-size: 12.48px; line-height: 1.55; color: var(--agent-ink); cursor: pointer; text-align: left; transition: border-color .15s; }
.${P}-cmd:hover { border-color: var(--accent); }
.${P}-cmd:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 32%, transparent); }
.${P}-cmd-t { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.${P}-cmd-ic { flex: none; display: flex; color: var(--accent-bright); }
.${P}-cmd-listo { display: none; }
.${P}-cmd[data-copiado] .${P}-cmd-copiar { display: none; }
.${P}-cmd[data-copiado] .${P}-cmd-listo { display: flex; }

/* La franja de prueba social (ProofStrip): blanca, borde 1 px arriba, padding 16,8 / gutter, centrada; gap clamp(14.4, 2.5vw, 25.6) */
.${P}-franja { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: clamp(14.4px, 2.5vw, 25.6px); margin-top: clamp(24px, 4vw, 48px); padding: 16.8px var(--gutter); background: var(--surface); border-top: 1px solid var(--rule); font-variant-numeric: tabular-nums; }
.${P}-franja-g { display: flex; align-items: center; gap: 16px; }
.${P}-franja-pila { display: flex; height: 32px; }
.${P}-franja-pila img { width: 26px; height: 32px; object-fit: cover; border-radius: 5px; border: 2px solid var(--surface); box-shadow: 0 1px 2px rgba(7,18,15,.12); }
.${P}-franja-pila img + img { margin-left: -9px; }
.${P}-franja-fila { display: flex; align-items: center; gap: 5.6px; }
.${P}-franja-num { font-size: 12px; font-weight: 700; color: var(--ink); }
.${P}-franja-txt { font-size: 12px; color: var(--muted); }
.${P}-franja-fuerte { display: block; font-size: 13px; line-height: 1.6; font-weight: 700; color: var(--ink); }
.${P}-franja-div { align-self: stretch; width: 1px; min-height: 33.6px; background: var(--rule); }
.${P}-socios { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.${P}-socio { display: flex; align-items: center; gap: 5.12px; padding: 3.84px 8.8px; border-radius: 6px; border: 1px solid var(--rule); background: var(--ground); color: var(--ink-2); font-size: 11.52px; line-height: 1.2; font-weight: 600; white-space: nowrap; }

/* ── Secciones (.page-padding + .section-background) ── */
.${P}-sec { padding: var(--sec-y) max(var(--gutter), (100% - var(--w-page)) / 2); }
.${P}-blanca { background: var(--surface); border-top: 1px solid var(--rule-soft); border-bottom: 1px solid var(--rule-soft); }
.${P}-gris { background: var(--ground); }
.${P}-cont { max-width: var(--w-prose); margin: 0 auto; }
.${P}-cont-ancha { max-width: var(--w-page); }
.${P}-cej { margin-bottom: 12px; font-family: var(--mono); font-size: 11px; line-height: 1.6; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; color: var(--accent); text-align: center; }
.${P}-h2c { margin-bottom: 12px; font-family: var(--disp); font-variation-settings: "wdth" 92; font-size: clamp(25.6px, 3.4vw, 37.6px); line-height: 1.1; font-weight: 800; letter-spacing: -.026em; color: var(--ink); text-align: center; text-wrap: balance; }
.${P}-desc { margin-bottom: 28px; font-size: 16px; line-height: 1.6; color: var(--ink-2); text-align: center; }

/* El editor en su marco (EditorDemo): hasta 819,2 px, padding 9,6; el video con el radio de la tarjeta */
.${P}-marco-demo { max-width: calc(800px + 19.2px); margin: 0 auto; padding: 9.6px; }
.${P}-demo-vid { position: relative; aspect-ratio: 960 / 600; border-radius: var(--r-card); overflow: hidden; background: #F6F7F9; }
.${P}-demo-vid video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.${P}-demo-pie { display: flex; flex-direction: column; align-items: center; gap: 4.8px; margin-top: 24px; }
.${P}-demo-pie .${P}-btn { margin-top: 16px; }
.${P}-pista { font-size: 12px; line-height: 1.6; color: var(--muted); text-align: center; }

/* Las plantillas: seis en fila (2 / 3 / 6 columnas), gap 16; la imagen con radio 8 y su sombra larga */
.${P}-plant { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
.${P}-plant-i { display: block; min-width: 0; text-decoration: none; color: inherit; }
.${P}-plant-img { position: relative; display: block; aspect-ratio: 4 / 5; border-radius: 8px; overflow: hidden; box-shadow: 1px 1px 1px #E4E7EC, 18px 26px 64px -12px rgba(16,24,40,.15); }
.${P}-plant-img img { display: block; width: 100%; height: 100%; object-fit: cover; }
.${P}-plant-x { position: absolute; left: 8px; top: 8px; padding: 4px 6px; border-radius: 6px; background: #E11D48; color: #fff; font-size: 11px; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums; }
.${P}-plant-u { display: block; margin-top: 8px; font-size: 12px; line-height: 1.4; font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color .15s; }
.${P}-plant-i:hover .${P}-plant-u { color: var(--accent); }
.${P}-plant-pie { max-width: var(--w-prose); margin: 0 auto; display: flex; flex-direction: column; align-items: center; }
.${P}-plant-pie .${P}-btn, .${P}-pasos-sec .${P}-btn, .${P}-testi-acc .${P}-btn { margin-top: 16px; }
.${P}-plant-txt { margin: 10px 0 0; font-size: 17.6px; line-height: 1.6; color: #475467; text-align: center; }

/* Los tres pasos (StepsSection): título a la izquierda 600, grilla auto-fit de 240 px, gap clamp(24, 3vw, 44) */
.${P}-pasos-sec { display: grid; gap: clamp(32px, 4vw, 48px); }
.${P}-h2 { max-width: var(--w-prose); font-family: var(--disp); font-size: clamp(28px, 3.6vw, 42.4px); line-height: 1.1; font-weight: 600; letter-spacing: -.02em; color: var(--ink); }
.${P}-pasos { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: clamp(24px, 3vw, 44px); }
.${P}-paso { display: grid; align-content: start; gap: 13.6px; }
.${P}-paso-cab { display: flex; align-items: center; gap: 13.6px; }
.${P}-paso-n { font-family: var(--disp); font-size: 32px; line-height: 1; font-weight: 600; letter-spacing: -.03em; color: var(--accent); font-variant-numeric: tabular-nums; }
.${P}-raya { flex: 1; height: 1px; background: var(--rule); }
.${P}-paso-fila { display: flex; align-items: center; gap: 11.2px; }
.${P}-paso-ic { flex: none; width: 32px; height: 32px; display: grid; place-items: center; border-radius: var(--r-card); border: 1px solid var(--rule); background: var(--surface); color: var(--accent); }
.${P}-paso-t { font-family: var(--disp); font-size: 18.4px; line-height: 1.3; font-weight: 600; letter-spacing: -.01em; color: var(--ink); }
.${P}-paso-x { font-size: 15.68px; line-height: 1.6; color: var(--ink-2); }

/* Los grupos numerados (FeatureGroups) */
.${P}-grupo { max-width: var(--w-page); margin: 0 auto; display: grid; gap: clamp(40px, 5vw, 64px); }
.${P}-grupo-cab { max-width: var(--w-prose); display: grid; gap: 12px; }
.${P}-indice { display: flex; align-items: center; gap: 12px; font-family: var(--mono); font-size: 12px; line-height: 1.6; font-weight: 500; letter-spacing: .14em; }
.${P}-indice-n { color: var(--accent); }
.${P}-indice-t { text-transform: uppercase; color: var(--ink-2); }
.${P}-grupo-t { font-family: var(--disp); font-size: clamp(28px, 3.6vw, 42.4px); line-height: 1.1; font-weight: 600; letter-spacing: -.02em; color: var(--ink); }
.${P}-grupo-p { font-size: 16.8px; line-height: 1.6; color: var(--ink-2); }
.${P}-filas { display: grid; gap: clamp(48px, 6vw, 88px); }
.${P}-fila { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: clamp(32px, 4vw, 64px); }
.${P}-fila[data-giro="si"] .${P}-medio { order: -1; }
.${P}-fila-t { margin-bottom: 12px; font-family: var(--disp); font-size: clamp(20.8px, 2.2vw, 27.2px); line-height: 1.2; font-weight: 600; letter-spacing: -.015em; color: var(--ink); }
.${P}-fila-p { margin-bottom: 28px; font-size: 16px; line-height: 1.65; color: var(--ink-2); }
.${P}-lista { display: grid; gap: 18.4px; }
.${P}-lista li { display: grid; grid-template-columns: auto 1fr; align-items: start; gap: 12.8px; }
.${P}-tic { width: 18.4px; height: 18.4px; margin-top: 3.2px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--accent); color: var(--accent); }
.${P}-lista b { display: block; font-size: 16px; line-height: 1.4; font-weight: 600; color: var(--ink); }
.${P}-lista b + span { display: block; font-size: 15.2px; line-height: 1.55; color: var(--ink-2); }
.${P}-medio { display: flex; justify-content: center; min-width: 0; }
.${P}-marco-fila > .mk-falta { min-height: 0; border-radius: 8px; }
.${P}-lienzo-vid { position: relative; aspect-ratio: 960 / 600; border-radius: 8px; overflow: hidden; background: #F5F5F2; }
.${P}-lienzo-vid video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
/* «Formatos»: lo que armó MaKo en cada tamaño, sobre su mesa gris, alineado abajo */
/* Las columnas salen de las proporciones: la historia (9:16) mide de alto lo que el carrusel (4:5) y la miniatura (16:9) juntos. */
.${P}-formatos { display: grid; grid-template-columns: 1.34fr 1fr 1fr; grid-template-rows: auto auto; gap: 12px; align-items: end; padding: 18px; border-radius: 8px; background: #EEF2F1; }
.${P}-formato { margin: 0; border-radius: 6px; overflow: hidden; box-shadow: var(--sh-sm); background: #fff; }
.${P}-formato img { display: block; width: 100%; height: 100%; object-fit: cover; }
.${P}-formato-historia { grid-row: 1 / 3; align-self: stretch; aspect-ratio: auto !important; }
.${P}-formato-miniatura { grid-column: 2 / 4; }
/* «Kit de marca»: la misma lámina sin kit y con tres */
.${P}-kits { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 18px; border-radius: 8px; background: #EEF2F1; }
.${P}-kits-i { margin: 0; min-width: 0; }
.${P}-kits-i img { display: block; width: 100%; height: auto; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 6px; box-shadow: var(--sh-sm); }
.${P}-kits-i figcaption { display: flex; align-items: center; gap: 3px; margin-top: 8px; font-family: var(--mono); font-size: 9px; line-height: 1.2; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #5A6C67; }
.${P}-kits-i figcaption i { flex: none; width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 1px #D5E0DC; }
.${P}-kits-i figcaption span { margin-left: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* La grilla de celdas (1 px de separación: el fondo es la línea) */
.${P}-celdas { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; overflow: hidden; border-radius: var(--r-card); border: 1px solid var(--rule); background: var(--rule); }
.${P}-celda { display: grid; align-content: start; gap: 8.8px; padding: 22.4px 21.6px; background: var(--ground); }
.${P}-celda-cab { display: flex; align-items: center; gap: 10px; }
.${P}-celda-ic { display: flex; color: var(--accent); }
.${P}-celda-t { font-size: 15.68px; line-height: 1.35; font-weight: 600; color: var(--ink); }
.${P}-celda-x { font-size: 14.4px; line-height: 1.55; color: var(--ink-2); }

/* «Automatizar»: las cuatro tarjetas negras (AgentCard): 1 / 2 / 4 columnas, gap 12; suben 2 px y se bordean del color */
.${P}-negras { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.${P}-negra { display: block; text-decoration: none; height: 100%; padding: 16px 18.4px; border-radius: var(--r-card); background: var(--agent-bg); border: 1px solid var(--agent-bg); color: var(--agent-ink-2); transition: transform .16s, border-color .16s; }
.${P}-negra:hover { transform: translateY(-2px); border-color: var(--accent); }
/* En el oscuro, como su [data-mantine-color-scheme=dark] .pn-card--agent: el borde pasa a su línea oscura #213330 (si no, la tarjeta se
   pierde en el fondo). El sol y la luna marca el modo en <html data-sitio-modo>. */
html[data-sitio-modo="oscuro"] .${P}-negra:not(:hover), html[data-sitio-modo="oscuro"] .${P}-agente { border-color: #213330; }
.${P}-negra-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.${P}-negra-ic { display: flex; color: var(--agent-ink); }
.${P}-negra-fl { display: flex; margin-left: auto; color: var(--agent-ink-2); }
.${P}-negra-t { font-family: var(--disp); font-variation-settings: "wdth" 92; font-size: 15px; line-height: 1.25; font-weight: 700; letter-spacing: -.012em; color: var(--agent-ink); }
.${P}-negra-art { display: block; margin-bottom: 4px; font-family: var(--mono); font-size: 12px; line-height: 1.6; color: var(--accent-bright); }
.${P}-negra-x { font-size: 13px; line-height: 1.5; color: var(--agent-ink-2); }

/* Testimonios (WallOfLove): columnas (3 / 2 / 1), gap 16; tarjeta gris con borde, radio 9, padding clamp(20, 2.5vw, 25.6) */
.${P}-muro-t { column-count: 3; column-gap: 16px; margin-top: clamp(32px, 4vw, 48px); margin-bottom: -16px; }
.${P}-testi { break-inside: avoid; display: flex; flex-direction: column; gap: 13.6px; margin: 0 0 16px; padding: clamp(20px, 2.5vw, 25.6px); border-radius: var(--r-card); border: 1px solid var(--rule); background: var(--ground); }
.${P}-testi-vid { position: relative; aspect-ratio: 848 / 480; border-radius: 6px; overflow: hidden; background: #000; }
.${P}-testi-vid video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.${P}-testi-m { display: grid; gap: 10px; font-size: 15.2px; line-height: 1.6; color: var(--ink-2); }
.${P}-testi-quien { display: flex; align-items: center; gap: 11.2px; padding-top: 2.4px; }
.${P}-mono { flex: none; width: 37.6px; height: 37.6px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--rule); background: var(--accent-soft); color: var(--accent-ink); font-family: var(--mono); font-size: 12px; font-weight: 500; letter-spacing: .02em; }
.${P}-testi-n { display: block; font-size: 15.2px; line-height: 1.3; font-weight: 600; color: var(--ink); }
.${P}-testi-r { display: block; font-size: 13px; line-height: 1.4; color: var(--muted); }
.${P}-testi-meses { display: grid; gap: 6px; }
.${P}-testi-meses li { display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px solid var(--rule); font-size: 13.6px; color: var(--ink-2); }
.${P}-testi-meses b { font-family: var(--disp); font-weight: 800; color: var(--ink); }
.${P}-testi-acc { display: flex; flex-wrap: wrap; justify-content: center; gap: 9.6px; margin-top: clamp(32px, 4vw, 48px); }

/* Preguntas (FaqSection, acordeón separado): borde 1 px, radio 9, 8 entre una y otra; la abierta con el borde del color */
.${P}-faq { margin-top: 16px; }
.${P}-faq-i { margin-bottom: 8px; border-radius: var(--r-card); border: 1px solid var(--rule); background: var(--surface); transition: border-color .16s; }
.${P}-faq-i:last-of-type { margin-bottom: 0; }
.${P}-faq-i:hover { border-color: color-mix(in oklab, var(--accent) 45%, var(--rule)); }
.${P}-faq-i[open] { border-color: var(--accent); }
.${P}-faq-c { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13.6px 17.6px; }
.${P}-faq-c::-webkit-details-marker { display: none; }
.${P}-faq-c:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 32%, transparent); border-radius: var(--r-card); }
.${P}-faq-l { font-family: var(--disp); font-variation-settings: "wdth" 92; font-size: 15px; line-height: 1.4; font-weight: 700; letter-spacing: -.012em; color: var(--ink); }
.${P}-faq-ch { flex: none; display: flex; color: var(--muted); transition: transform .2s ease; }
.${P}-faq-i[open] .${P}-faq-ch { transform: rotate(180deg); color: var(--accent); }
.${P}-faq-panel { overflow: hidden; }
.${P}-faq-x { padding: 0 48px 16px 17.6px; font-size: 15px; line-height: 1.65; color: var(--ink-2); }

/* Pie (Footer): blanco, borde arriba, padding clamp(40, 5vw, 64) gutter 0; la marca (240) y cuatro columnas */
.${P}-pie { background: var(--surface); border-top: 1px solid var(--rule); padding: clamp(40px, 5vw, 64px) var(--gutter) 0; }
.${P}-pie-in { max-width: var(--w-page); margin: 0 auto; display: grid; grid-template-columns: minmax(0, 240px) minmax(0, 1fr); align-items: start; gap: clamp(32px, 5vw, 64px); }
.${P}-pie-marca { display: flex; flex-direction: column; align-items: flex-start; gap: 14.4px; }
.${P}-pie-marca span:last-child { font-family: var(--disp); }
.${P}-pie-marca p { max-width: 30ch; font-size: 14px; line-height: 1.55; color: var(--muted); }
.${P}-pie-cols { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: start; gap: clamp(16px, 2.2vw, 32px); }
.${P}-pie-col { display: flex; flex-direction: column; align-items: flex-start; row-gap: 5.6px; min-width: 0; }
.${P}-pie-t { margin-bottom: 7.2px; font-family: var(--mono); font-size: 10px; line-height: 1.6; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; color: var(--muted); }
.${P}-pie-col a { padding: 1.6px 0; font-size: 13px; line-height: 1.45; font-weight: 500; color: var(--ink-2); text-decoration: none; transition: color .16s; }
.${P}-pie-col a:hover { color: var(--accent); }
.${P}-pie-base { max-width: var(--w-page); margin: clamp(32px, 4vw, 48px) auto 0; padding: 17.6px 0; border-top: 1px solid var(--rule-soft); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.${P}-pie-legal { display: flex; flex-wrap: wrap; gap: 8px 16px; }
.${P}-pie-legal a { color: var(--ink-2); text-decoration: none; transition: color .16s; }
.${P}-pie-legal a:hover { color: var(--accent); }

/* Menos movimiento: lo de PostNitro (transiciones y animaciones a 0,01 ms) */
@media (prefers-reduced-motion: reduce) {
  .${P} *, .${P} *::before, .${P} *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
  .${P}-red:hover, .${P}-negra:hover { transform: none; }
}

@media (max-width: 1023px) { .${P} { --barra-sitio: 57px; } }
/* ≤ 1200: las plantillas en 3 */
@media (max-width: 1199.98px) { .${P}-plant { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
/* ≤ 1024: los testimonios en 2 */
@media (max-width: 1024px) { .${P}-muro-t { column-count: 2; } }
/* ≤ 992 (62em): el hero en una columna y centrado; las filas en una (el marco arriba); celdas en 2; tarjetas negras en 2 */
@media (max-width: 991.98px) {
  .${P}-hero-in { grid-template-columns: minmax(0, 1fr); text-align: center; }
  .${P}-hero-txt { align-items: center; }
  .${P}-hero-p { max-width: 52ch; }
  .${P}-hero-acc, .${P}-redes { justify-content: center; }
  .${P}-badge { margin-top: 35.2px; }
  .${P}-agente { grid-template-columns: minmax(0, 1fr); text-align: center; }
  .${P}-agente-txt { justify-items: center; }
  .${P}-cmd { justify-content: center; }
  .${P}-cmd-t { flex: none; }
  .${P}-fila { grid-template-columns: minmax(0, 1fr); }
  .${P}-fila .${P}-medio { order: -1; }
  .${P}-celdas { grid-template-columns: repeat(2, 1fr); }
  .${P}-negras { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .${P}-pasos { grid-template-columns: minmax(0, 1fr); gap: 32px; }
}
/* ≤ 768 (48em): la franja sin divisor; las láminas sin escalón; el marco con 9,6 de aire; las plantillas en 2 */
@media (max-width: 767.98px) {
  .${P}-plant { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .${P}-plant-txt { margin-top: 8px; font-size: 15.2px; line-height: 1.5; }
  .${P}-muro-t { column-count: 1; }
  .${P}-muro { gap: 6.4px; }
  .${P}-lam:nth-child(2), .${P}-lam:nth-child(3) { transform: none; }
  .${P}-marco { padding: 9.6px; }
  .${P}-franja-div { display: none; }
  .${P}-faq-l { font-size: 14px; }
  .${P}-faq-x { padding-right: 17.6px; }
  .${P}-barra { padding: 0 12px; }
  .${P}-barra-link { display: none; }
  .${P}-pie-in { grid-template-columns: minmax(0, 1fr); }
  .${P}-pie-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* ≤ 576: las tarjetas negras en 1 */
@media (max-width: 575.98px) { .${P}-negras { grid-template-columns: minmax(0, 1fr); } }
/* ≤ 560: las celdas en 1 */
@media (max-width: 559.98px) { .${P}-celdas { grid-template-columns: minmax(0, 1fr); } }
`;

// =============================================================================
// El script (data-visor): el acordeón como el suyo (una abierta a la vez, se abre y se cierra en 200 ms con la altura y la opacidad),
// copiar la ruta de la tarjeta negra (y el tilde 1,5 s) y el video que corre sólo mientras se ve. Idempotente (`__listo`) y limpia
// su propio estado: pulir.mjs guarda el DOM DESPUÉS de correrlo (docs/hallazgos-landing.md, «Video como Cherry, segunda vuelta»).
// =============================================================================
const SCRIPT = `(function(){
var P='${P}';
// Después de que React hidrate (como el de ../video.tsx): en producción, un listener puesto antes se pierde si React rehace el nodo.
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function iniciar(){
  var R=document.querySelector('.'+P);if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  // ── las preguntas ──
  var items=[].slice.call(R.querySelectorAll('.'+P+'-faq-i'));
  items.forEach(function(d){var pa=d.querySelector('.'+P+'-faq-panel');if(pa){pa.style.height='';pa.style.opacity='';pa.style.transition='';}});
  function cerrar(d){var pa=d.querySelector('.'+P+'-faq-panel');if(!d.open)return;if(quieto||!pa){d.open=false;return;}
    pa.style.height=pa.scrollHeight+'px';pa.style.opacity='1';void pa.offsetHeight;pa.style.transition='height 200ms ease, opacity 200ms ease';pa.style.height='0px';pa.style.opacity='0';
    d.setAttribute('data-cierra','');
    setTimeout(function(){if(d.hasAttribute('data-cierra')){d.open=false;d.removeAttribute('data-cierra');pa.style.height='';pa.style.opacity='';pa.style.transition='';}},210);}
  function abrir(d){var pa=d.querySelector('.'+P+'-faq-panel');d.removeAttribute('data-cierra');d.open=true;if(quieto||!pa)return;
    var h=pa.scrollHeight;pa.style.transition='none';pa.style.height='0px';pa.style.opacity='0';void pa.offsetHeight;pa.style.transition='height 200ms ease, opacity 200ms ease';pa.style.height=h+'px';pa.style.opacity='1';
    setTimeout(function(){if(d.open&&!d.hasAttribute('data-cierra')){pa.style.height='';pa.style.transition='';}},210);}
  items.forEach(function(d){var s=d.querySelector('summary');if(!s)return;s.addEventListener('click',function(e){e.preventDefault();
    if(d.open&&!d.hasAttribute('data-cierra')){cerrar(d);return;}
    items.forEach(function(o){if(o!==d)cerrar(o);});abrir(d);});});
  // ── copiar la ruta ──
  [].slice.call(R.querySelectorAll('[data-copiar]')).forEach(function(c){c.removeAttribute('data-copiado');var t=0;
    var copiar=function(){var txt=c.getAttribute('data-copiar');var listo=function(){c.setAttribute('data-copiado','');clearTimeout(t);t=setTimeout(function(){c.removeAttribute('data-copiado');},1500);};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(listo,listo);}else{listo();}};
    c.addEventListener('click',copiar);c.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();copiar();}});});
  // ── el video corre sólo a la vista (con «menos movimiento» queda en su póster) ──
  var vids=[].slice.call(R.querySelectorAll('video[data-a-la-vista]'));
  vids.forEach(function(v){v.muted=true;if(!v.paused)v.pause();});
  if(!quieto&&'IntersectionObserver' in window){var ob=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;if(e.isIntersecting){v.preload='auto';var p=v.play();if(p&&p.catch)p.catch(function(){});}else if(!v.paused)v.pause();});},{threshold:.25});
    vids.forEach(function(v){ob.observe(v);});}
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;
