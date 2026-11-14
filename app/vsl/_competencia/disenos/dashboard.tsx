// =============================================================================
// /vsl/dashboard con el DISEÑO de la portada de Reportei (https://reportei.com/es/): copiado el 11/11/2026, relevo fiel el 14/11/2026
// =============================================================================
// Medida con Chromium a 1440 y a 390 px el 14/11/2026: capturas por sección, video del scroll lento con una parada en cada sección,
// `getAnimations()` en cada paso, MutationObserver, IntersectionObserver, los estilos de 106 elementos antes y 700 ms después del
// hover y un clic en cada pestaña (notas de la sesión, referencias-landings/dashboard/; valores, docs/diseno/landings-competencia/
// dashboard.md). Es una página de Elementor: Quicksand 700 en los títulos e Inter en el texto, contenedor de 1200 px.
//
// LO QUE SE MUEVE en Reportei, y aquí igual (medido; lo demás está quieto, su hero es una imagen):
//   · el muro de logos de la caja celeste: dos filas que corren en sentidos opuestos (48 s y 55 s, lineal), con un desvanecido en los
//     bordes, que se frenan con el mouse encima o con «Pausar» (una casilla: su CSS, sin JavaScript);
//   · su video de YouTube en la caja: arranca solo y sin sonido, en bucle (a 390 la caja no lo muestra);
//   · los hovers: botones verdes #13BD49 → #41D771 en 0,3 s; las tarjetas pastel oscurecen su fondo un escalón en 0,3 s (NO suben:
//     su `transform` está en la transición y no cambia); los botones azules de las de borde fino #0757C9 → #034399 con un aro;
//     los íconos de la franja al 90 %; las pestañas de «Conoce la herramienta» toman un gris.
//   · «Conoce la herramienta»: las pestañas cambian la pantalla AL TOCARLAS (no avanzan solas). A 1024 px o menos la sección está
//     escondida y la abre el «Quiero saber más» de una tarjeta, con las pestañas en una fila que se desliza.
//
// De MaKo: el logo, el azul de los botones (su verde), el dorado de las palabras resaltadas (su verde), el azul oscuro de sus títulos,
// el botón para empezar, las PANTALLAS y el caso de Mauricio. Las pantallas son las hojas REALES del Dashboard grabadas en el banco
// C:/dev/bancos-portada/banco-dashboard-landing, con los números de UN negocio de ejemplo que cuadran entre sí (su ejemplo.ts: US$2,460
// en Meta → 167 leads → 27 agendas → 21 vinieron → 6 cierres → US$24,000 vendidos, US$12,480 cobrados).
//   · su imagen del hero (el informe de Google Ads con dos tarjetas que flotan) es la hoja Marketing con la cámara sobre sus números,
//     y la tarjeta que flota arriba, la meta del trimestre de General (la misma pieza que la tarjeta «Control», como en Reportei);
//   · su video de YouTube («Templates»: elegir una plantilla) es «¿Qué vas a crear hoy?» de MaKo: se elige Marketing y entra la hoja;
//   · cada tarjeta pastel lleva la pieza real de lo que dice; cada pestaña, la entrada de su hoja en la ventana del navegador.
// Lo que se sacó de la referencia, y por qué (lo que MaKo no tiene no se dibuja):
//   · su insignia de GetApp, «+10.000 clientes en 70 países», el muro de logos de sus clientes y su título: van los tableros listos;
//   · «Automatización de informes» (envíos programados por email y WhatsApp) y «Línea de tiempo»: MaKo no los tiene (van «Compartir»
//     y «Lo que vence», ver ../dashboard.ts); su Studio y su MCP pasan a las hojas de análisis y la API de MaKo;
//   · sus premios (el carrusel de Capterra y GetApp), sus precios con la promoción, Flux, Sync y el texto de SEO con su dibujo;
//   · sus testimonios: va el caso de Mauricio en sus tres columnas. Su barra y su pie los tapa la barra y el pie del sitio.
// El script (data-visor) sólo maneja los videos y las pestañas; con «menos movimiento» los videos quedan en su primer cuadro.
// =============================================================================

import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, EstrellaMaKo, LogoMaKo, MAKO, TEXTO_CTA, html, otrasFunciones } from '../marca';

type Hero = Extract<Bloque, { tipo: 'hero' }>;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Filas = Extract<Bloque, { tipo: 'filas' }>;
type Logos = Extract<Bloque, { tipo: 'logos' }>;
type Pasos = Extract<Bloque, { tipo: 'pasos' }>;

const P = 'd-dashboard';
const A = '/vsl-assets/dashboard';

/** El hero: la hoja Marketing con la cámara sobre sus números (`TAM=960:600 codificar-bucle.sh`); el póster es su PRIMER cuadro. */
export const VIDEO_HERO = { video: `${A}/hero.webm`, poster: `${A}/hero.jpg` } as const;
/** La tarjeta que flota sobre el hero: la meta del trimestre de General (foto de la pieza real). */
export const FOTO_FLOTA = { src: `${A}/meta.webp`, alt: 'La meta del trimestre en General: US$45,000 de facturación, 62 % hecho, a tiempo' } as const;
/** Su video de YouTube en la caja celeste: «¿Qué vas a crear hoy?» → Marketing → entra la hoja (16:9). */
export const VIDEO_NUEVA_HOJA = { video: `${A}/nueva-hoja.webm`, poster: `${A}/nueva-hoja.jpg` } as const;
/** La pieza de cada tarjeta pastel, EN EL ORDEN de las siete de ../dashboard.ts. */
export const FOTOS_TARJETAS: readonly { src: string; alt: string }[] = [
  { src: `${A}/informe.webp`, alt: 'La hoja Comercial: lo vendido, de cuántas agendas salieron los cierres y lo invertido en anuncios' },
  { src: `${A}/editor.webp`, alt: 'Añadir un gráfico en el editor del Dashboard: la galería con los tipos de gráfico' },
  { src: `${A}/compartir.webp`, alt: 'Compartir el informe: el link para verlo sin poder editar' },
  // La misma pieza que flota en el hero, como Reportei repite su «Costo» en el hero y en «Control».
  { src: `${A}/meta.webp`, alt: 'La meta del trimestre en General: lo que llevas y lo que tendrías que llevar a esta altura' },
  { src: `${A}/vence.webp`, alt: 'Lo que vence en el Plan: tareas y proyectos con su fecha' },
  { src: `${A}/general.webp`, alt: 'General: lo cobrado este mes, la inversión en anuncios, las agendas y los cierres' },
  { src: `${A}/editar.webp`, alt: 'Editar con MaKo: le pides un gráfico en palabras y MaKo lo agrega a la hoja' },
];
/** La entrada de cada hoja, EN EL ORDEN de las pestañas de ../dashboard.ts (banco: `grabar.mjs tableros` + `recortar.py`). */
export const PANTALLA_DE_PESTANA: readonly { id: string; video: string; poster: string }[] = [
  { id: 'general', video: `${A}/tablero-general.webm`, poster: `${A}/tablero-general.jpg` },
  { id: 'marketing', video: `${A}/tablero-marketing.webm`, poster: `${A}/tablero-marketing.jpg` },
  { id: 'comercial', video: `${A}/tablero-comercial.webm`, poster: `${A}/tablero-comercial.jpg` },
  { id: 'closing', video: `${A}/tablero-closing.webm`, poster: `${A}/tablero-closing.jpg` },
];
/** A qué pestaña lleva el «Quiero saber más» de cada tarjeta (como su «Overview» lleva a su pestaña). */
const PESTANA_DE_TARJETA = [2, 1, 0, 0, 0, 0, 1];
/** Los íconos de las pestañas (tabler, 24 × 24). */
const ICONOS_PESTANA: readonly string[][] = [
  ['M9 6l11 0', 'M9 12l11 0', 'M9 18l11 0', 'M5 6l0 .01', 'M5 12l0 .01', 'M5 18l0 .01'],
  ['M18 8a3 3 0 0 1 0 6', 'M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5', 'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8'],
  ['M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9', 'M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2', 'M12 12l0 .01', 'M3 13a20 20 0 0 0 18 0'],
  ['M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2'],
];

/** Los tonos de sus tarjetas pastel, en el orden de las siete: fondo, fondo al pasar el mouse, rótulo y título (medidos). */
// `oscuro`: fondo, fondo al pasar el mouse, rótulo y título en el modo oscuro (escritos a mano: ver el CSS).
const TONOS = [
  { id: 'verde', fondo: '#EEFBF2', hover: '#DFF7E6', rot: '#0A9B38', tit: '#0A782D', oscuro: ['#102419', '#15301F', '#3FCF6E', '#A8EBBE'] },
  { id: 'celeste', fondo: '#EDF9FF', hover: '#DBF4FF', rot: '#0D8DC7', tit: '#0A6E9B', oscuro: ['#0F2230', '#142C3D', '#4CB8EA', '#A9DDF5'] },
  { id: 'naranja', fondo: '#FFF2EE', hover: '#FFEBE5', rot: '#D14D24', tit: '#A33C1C', oscuro: ['#2B1812', '#371E16', '#F07A55', '#F5C2AE'] },
  { id: 'gris', fondo: '#F4F6FA', hover: '#E9EEF5', rot: '#00449D', tit: '#00449D', oscuro: ['#181D27', '#1F2533', '#7FA6E6', '#C4D4EE'] },
  { id: 'lila', fondo: '#F6F1FA', hover: '#EDE5F6', rot: '#954CDC', tit: '#6E35A7', oscuro: ['#21182C', '#2A1F38', '#B98AF0', '#DCC6F7'] },
  { id: 'azul', fondo: '#F0F7FF', hover: '#E5F0FF', rot: '#0054C2', tit: '#003375', oscuro: ['#111E33', '#172843', '#6FA2F0', '#BCD3F7'] },
  { id: 'ambar', fondo: '#FFF8EC', hover: '#FEF3DD', rot: '#CD820A', tit: '#A06508', oscuro: ['#2A2010', '#362915', '#F0B23E', '#F5D9A3'] },
] as const;

function Ico({ paths, size = 20, grueso = 2 }: { paths?: readonly string[]; size?: number; grueso?: number }) {
  if (!paths?.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grueso} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
const Flecha = () => <Ico paths={['M5 12l14 0', 'M13 18l6 -6', 'M13 6l6 6']} size={20} />;

function Barra() {
  return (
    <header className={`${P}-barra`}>
      <div className={`${P}-cont ${P}-barra-in`}>
        <LogoMaKo className={`${P}-logo`} tamano={32} />
        <div className={`${P}-barra-der`}>
          <a href="/vsl" className={`${P}-barra-link`}>Todas las funcionalidades</a>
          <a href={RUTA_CTA} className={`${P}-barra-btn`}>{TEXTO_CTA}</a>
        </div>
      </div>
    </header>
  );
}

/** Un video que corre solo y sin sonido mientras se ve (lo maneja el script). */
function Video({ v, etiqueta, clase, bucle = true }: { v: { video: string; poster: string }; etiqueta: string; clase?: string; bucle?: boolean }) {
  return <video className={clase} src={v.video} poster={v.poster} muted loop={bucle} playsInline autoPlay={bucle} preload="metadata" aria-label={etiqueta} />;
}

/** Su hero: el título de dos tonos, los dos párrafos, la píldora, la línea en negrita, el botón y la imagen con la tarjeta que flota. */
function HeroD({ b }: { b: Hero }) {
  const [p1, p2, linea] = b.puntos ?? [];
  return (
    <section className={`${P}-hero`}>
      <div className={`${P}-cont ${P}-hero-in`}>
        <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
        <div className={`${P}-hero-media`} data-tema-fijo="">
          <span className={`${P}-hero-fondo`} />
          <div className={`${P}-hero-tarjeta`}>
            <Video v={VIDEO_HERO} clase={`${P}-hero-video`} etiqueta="Grabado en MaKo: la hoja Marketing con lo invertido en Meta, los leads, las agendas y lo que costó cada una" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`${P}-hero-flota`} src={FOTO_FLOTA.src} alt={FOTO_FLOTA.alt} width={560} height={300} decoding="async" />
        </div>
        <div className={`${P}-hero-txt`}>
          <p dangerouslySetInnerHTML={html(b.bajada)} />
          {p1 || p2 ? <p dangerouslySetInnerHTML={html([p1, p2].filter(Boolean).join(' '))} /> : null}
        </div>
        <p className={`${P}-pill`}><EstrellaMaKo size={16} /><span>{b.etiqueta}</span></p>
        {linea ? <p className={`${P}-hero-linea`} dangerouslySetInnerHTML={html(linea)} /> : null}
        <a href={RUTA_CTA} className={`${P}-btn ${P}-hero-btn`}>{TEXTO_CTA}</a>
      </div>
    </section>
  );
}

/** Su franja «Integración con más de 50 plataformas:»: el rótulo gris a la izquierda y los íconos de 24 px. */
function Franja({ b }: { b: Logos }) {
  return (
    <section className={`${P}-franja`} aria-label={b.titulo}>
      <div className={`${P}-cont ${P}-franja-in`}>
        <p className={`${P}-franja-t`}><span dangerouslySetInnerHTML={html(b.titulo)} />:</p>
        <ul className={`${P}-franja-ics`}>
          {b.items.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <li key={l.nombre} title={l.nombre}><img src={`/vsl-assets/logos/${l.logo}`} alt={l.nombre} width={24} height={24} /></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Su caja celeste: el título, las dos filas que corren (aquí, los tableros listos), «Pausar», el video y el botón. */
function Caja({ b }: { b: Tarjetas }) {
  const mitad = Math.ceil(b.items.length / 2);
  const filas = [b.items.slice(0, mitad), b.items.slice(mitad)];
  const grupo = (items: Tarjetas['items'], copia: boolean) => (
    <div className={`${P}-muro-g`} aria-hidden={copia || undefined}>
      {items.map((t) => (
        <div key={t.titulo} className={`${P}-muro-t`}><span className={`${P}-muro-e`} aria-hidden="true">{t.texto}</span><span>{t.titulo}</span></div>
      ))}
    </div>
  );
  return (
    <section className={`${P}-caja-sec`}>
      <div className={`${P}-cont`}>
        <div className={`${P}-caja`}>
          <h2 className={`${P}-caja-h`} dangerouslySetInnerHTML={html(b.titulo)} />
          <div className={`${P}-muro`} role="region" aria-label="Los tableros listos de MaKo">
            <input className={`${P}-muro-pausa`} id={`${P}-pausa`} type="checkbox" />
            <label htmlFor={`${P}-pausa`}><span className={`${P}-muro-pp`} aria-hidden="true" /> <span className={`${P}-muro-pt`}>Pausar tableros</span><span className={`${P}-muro-rt`}>Reanudar tableros</span></label>
            <div className={`${P}-muro-filas`}>
              {filas.map((f, i) => <div key={i} className={`${P}-muro-pista`}>{grupo(f, false)}{grupo(f, true)}</div>)}
            </div>
          </div>
          <div className={`${P}-caja-video`} data-tema-fijo="">
            <Video v={VIDEO_NUEVA_HOJA} etiqueta="Grabado en MaKo: en «Nueva hoja» se elige el tablero Marketing y la hoja entra con los números del negocio" />
          </div>
          {b.cta ? <a href={RUTA_CTA} className={`${P}-btn ${P}-caja-btn`}>{TEXTO_CTA}</a> : null}
        </div>
      </div>
    </section>
  );
}

/** Una tarjeta pastel: el chip con su ícono y el rótulo, el título grande, «Quiero saber más» y la pieza real. */
function Tarjeta({ t, i, forma }: { t: Tarjetas['items'][number]; i: number; forma: 'ancha' | 'ancha-inv' | 'alta' }) {
  const tono = TONOS[i] ?? TONOS[0];
  const foto = FOTOS_TARJETAS[i];
  const pest = PANTALLA_DE_PESTANA[PESTANA_DE_TARJETA[i] ?? 0];
  return (
    <a className={`${P}-card ${P}-card-${forma} ${P}-t-${tono.id}`} href={`#${P}-h-${pest.id}`} data-pestana={pest.id}>
      <div className={`${P}-card-txt`}>
        <div className={`${P}-card-rot`}>
          <span className={`${P}-chip`}><Ico paths={t.icono} size={18} /></span>
          <h3 className={`${P}-card-r`} dangerouslySetInnerHTML={html(t.titulo)} />
        </div>
        <p className={`${P}-card-t`} dangerouslySetInnerHTML={html(t.texto)} />
        <span className={`${P}-mas`}>Quiero saber más <Flecha /></span>
      </div>
      {foto ? (
        <div className={`${P}-card-img`} data-tema-fijo="">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto.src} alt={foto.alt} loading="lazy" decoding="async" />
        </div>
      ) : null}
    </a>
  );
}

/** «¡Deja de perder tiempo…!»: dos anchas, tres altas, dos anchas y, debajo, las dos de borde fino (su Studio y su MCP). */
function TarjetasD({ b }: { b: Tarjetas }) {
  const pastel = b.items.slice(0, 7);
  const finas = b.items.slice(7);
  return (
    <>
      <section className={`${P}-sec-cards`}>
        <div className={`${P}-cont`}>
          <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
          <div className={`${P}-cards`}>
            {pastel.slice(0, 2).map((t, i) => <Tarjeta key={t.titulo} t={t} i={i} forma={i % 2 ? 'ancha-inv' : 'ancha'} />)}
            <div className={`${P}-altas`}>{pastel.slice(2, 5).map((t, i) => <Tarjeta key={t.titulo} t={t} i={i + 2} forma="alta" />)}</div>
            {pastel.slice(5).map((t, i) => <Tarjeta key={t.titulo} t={t} i={i + 5} forma={i % 2 ? 'ancha-inv' : 'ancha'} />)}
          </div>
        </div>
      </section>
      {finas.length ? (
        <section className={`${P}-finas`} aria-label="Hojas de análisis y API de MaKo">
          {finas.map((t) => (
            <article key={t.titulo}>
              <div className={`${P}-fina-marca`}><Ico paths={t.icono} size={32} grueso={1.6} /><span dangerouslySetInnerHTML={html(t.titulo)} /></div>
              <h2 dangerouslySetInnerHTML={html(t.texto)} />
              {t.meta ? <p dangerouslySetInnerHTML={html(t.meta)} /> : null}
              <a className={`${P}-fina-cta`} href={RUTA_CTA}>{TEXTO_CTA}</a>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}

/** Su banda azul: el título y el texto a la izquierda, la grilla de íconos en círculos a la derecha (los de la franja). */
function Banda({ b, logos }: { b: Filas; logos: Logos['items'] }) {
  return (
    <section className={`${P}-banda`} data-tema-fijo="">
      <div className={`${P}-cont ${P}-banda-in`}>
        <div className={`${P}-banda-txt`}>
          <h2 className={`${P}-banda-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-banda-p`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <ul className={`${P}-banda-ics`} aria-label="Lo que lee el Dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logos.map((l) => <li key={l.nombre} title={l.nombre}><img src={`/vsl-assets/logos/${l.logo}`} alt={l.nombre} width={28} height={28} loading="lazy" /></li>)}
        </ul>
      </div>
    </section>
  );
}

/** «Conoce la herramienta»: las pestañas (radios: andan sin JavaScript), la ventana del navegador con la entrada de cada hoja, el
 *  párrafo de cada una y el botón. El oscuro de lo que cambia con :checked va escrito a mano (el sol y la luna lo congelaría). */
function Herramienta({ b }: { b: Pasos }) {
  return (
    <section className={`${P}-herr`} id={`${P}-herramienta`} aria-label={b.titulo}>
      <h2 className={`${P}-herr-h`} dangerouslySetInnerHTML={html(b.titulo)} />
      {b.pasos.map((p, i) => (
        <input key={p.titulo} type="radio" name={`${P}-pestana`} id={`${P}-h-${PANTALLA_DE_PESTANA[i]?.id ?? i}`} className={`${P}-herr-radio`} defaultChecked={i === 0} />
      ))}
      <div className={`${P}-herr-tabs`} data-tema-fijo="">
        <div className={`${P}-herr-tabs-in`}>
          {b.pasos.map((p, i) => (
            <label key={p.titulo} htmlFor={`${P}-h-${PANTALLA_DE_PESTANA[i]?.id ?? i}`} className={`${P}-herr-tab`}>
              <Ico paths={ICONOS_PESTANA[i]} size={24} grueso={1.8} /><span dangerouslySetInnerHTML={html(p.titulo)} />
            </label>
          ))}
        </div>
      </div>
      <div className={`${P}-herr-paneles`}>
        {b.pasos.map((p, i) => {
          const v = PANTALLA_DE_PESTANA[i];
          return (
            <div key={p.titulo} className={`${P}-herr-panel`} data-pestana={v?.id}>
              <div className={`${P}-herr-ventana`} data-tema-fijo="">
                <div className={`${P}-herr-marco`}>
                  <span className={`${P}-herr-puntos`} aria-hidden="true"><i /><i /><i /></span>
                  {v ? <video src={v.video} poster={v.poster} muted playsInline preload="none" aria-label={`Grabado en MaKo: la hoja ${p.titulo} con su entrada`} /> : null}
                </div>
              </div>
              <p className={`${P}-herr-p`} dangerouslySetInnerHTML={html(p.texto)} />
            </div>
          );
        })}
      </div>
      <a href={RUTA_CTA} className={`${P}-btn ${P}-herr-btn`}>{TEXTO_CTA}</a>
    </section>
  );
}

/** Su banda de testimonios: el título chico, la línea en negrita y tres columnas (logo, cita, persona). */
function Caso() {
  const citas = [...CASO.historia, CASO.resultado];
  return (
    <section className={`${P}-testi`} data-tema-fijo="">
      <div className={`${P}-testi-in`}>
        <h2 className={`${P}-testi-h`} dangerouslySetInnerHTML={html(CASO.titulo)} />
        <p className={`${P}-testi-sub`}>{CASO.sub}</p>
        <div className={`${P}-testi-cols`}>
          {citas.map((c, i) => (
            <div key={i} className={`${P}-testi-col`}>
              <p className={`${P}-testi-mes`}><span>{CASO.meses[i]?.mes}</span> {CASO.meses[i]?.monto}</p>
              <blockquote className={`${P}-testi-q`} dangerouslySetInnerHTML={html(c)} />
              {i === citas.length - 1 ? (
                <div className={`${P}-testi-quien`}>
                  <video className={`${P}-testi-av`} muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en video`}><source src={CASO.video} type="video/mp4" /></video>
                  <div><p className={`${P}-testi-n`}>{CASO.quien}</p><p className={`${P}-testi-r`}>{CASO.rol}</p></div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PieD({ slug, linea }: { slug: string; linea: string }) {
  return (
    <footer className={`${P}-pie`}>
      <div className={`${P}-pie-in`}>
        <div className={`${P}-pie-marca`}><LogoMaKo tamano={32} /></div>
        <div className={`${P}-pie-cols`}>
          <p className={`${P}-pie-h`}>Funciones de MaKo</p>
          <ul>{otrasFunciones(slug).map((f) => <li key={f.href}><a href={f.href}>{f.nombre}</a></li>)}</ul>
        </div>
      </div>
      <div className={`${P}-pie-base`}><p>{linea}</p></div>
    </footer>
  );
}

export default function DisenoDashboard({ landing }: PropsDiseno) {
  const logos = landing.bloques.find((b): b is Logos => b.tipo === 'logos')?.items ?? [];
  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        {landing.bloques.map((b, i) => {
          switch (b.tipo) {
            case 'hero': return <HeroD key={i} b={b} />;
            case 'logos': return <Franja key={i} b={b} />;
            // La caja celeste lleva botón; las tarjetas pastel, fondo (../dashboard.ts).
            case 'tarjetas': return b.fondo ? <TarjetasD key={i} b={b} /> : <Caja key={i} b={b} />;
            case 'filas': return <Banda key={i} b={b} logos={logos} />;
            case 'pasos': return <Herramienta key={i} b={b} />;
            case 'caso': return <Caso key={i} />;
            default: return null;
          }
        })}
      </main>
      <PieD slug={landing.slug} linea={landing.metaDesc} />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

// Los valores salen de docs/diseno/landings-competencia/dashboard.md (medidos el 11/11 y el 14/11/2026).
const AZUL = MAKO.azul;
const AZUL_OSC = MAKO.azulOscuro;
const DORADO = MAKO.dorado;
const CSS = `
@font-face{font-family:'Quicksand';font-style:normal;font-weight:700;font-display:swap;src:url('/vsl-assets/fuentes/quicksand/quicksand-latin-700.woff2') format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2')}
.${P}{background:#fff;color:#212B30;font-family:'Inter',system-ui,sans-serif;font-size:18px;line-height:1.2;-webkit-font-smoothing:antialiased;overflow-x:clip}
.${P} *{box-sizing:border-box}
:where(.${P}) :where(h1,h2,h3,p,ul,blockquote){margin:0;padding:0}
:where(.${P}) :where(ul){list-style:none}
:where(.${P}) :where(a){text-decoration:none;color:inherit}
.${P} em{font-style:normal;color:${DORADO}}
.${P}-cont{max-width:1200px;margin:0 auto}

/* La barra (en producción la tapa la del sitio, BARRA_PROPIA): 80 px, el logo a 10 px del borde, «Entrar» y el botón a la derecha. */
.${P}-barra{background:#fff;padding-top:10px}
.${P}-barra-in{height:70px;display:flex;align-items:center;justify-content:space-between}
.${P}-logo{margin-left:10px;font-family:'Inter',sans-serif}
.${P}-barra-der{display:flex;align-items:center;gap:19px}
.${P}-barra-link{font-size:18px;font-weight:700;line-height:21.6px;color:${AZUL};padding:13px 18px;transition:color .2s linear}
.${P}-barra-link:hover{color:${AZUL_OSC}}
.${P}-barra-btn{display:inline-block;background:${AZUL};color:#fff;font-size:18px;font-weight:700;line-height:21.4px;padding:13px 18px;border-radius:12px;transition:color .2s linear,background-color .2s linear}
.${P}-barra-btn:hover{background:${AZUL_OSC}}

/* Su botón verde (aquí el azul de MaKo): Inter 18/21,6 500, 13 × 18, radio 12; al pasar el mouse se ACLARA en 0,3 s (#13BD49 → #41D771). */
.${P}-btn{display:inline-block;background:${AZUL};color:#fff;font-size:18px;font-weight:500;line-height:21.6px;padding:13px 18px;border-radius:12px;transition:background-color .3s,color .3s}
.${P}-btn:hover,.${P}-btn:focus-visible{background:#5A8DF2;color:#fff}

/* El hero: 100 px arriba; el texto en una columna de 504 px con 24 de separación, la imagen de 660 × 583 a la derecha. */
.${P}-hero{padding:100px 0 40px}
.${P}-hero-in{display:grid;grid-template-columns:504px 660px;column-gap:36px;row-gap:24px;grid-template-areas:'h1 media' 'txt media' 'pill media' 'linea media' 'btn media' 'resto media';grid-template-rows:auto auto auto auto auto 1fr;align-items:start}
.${P}-h1{grid-area:h1;font-family:'Quicksand',sans-serif;font-size:40px;line-height:52px;font-weight:700;letter-spacing:-.2px;color:${AZUL_OSC}}
.${P}-hero-txt{grid-area:txt;font-size:17px;line-height:22.1px;font-weight:500;color:#455A64}
.${P}-hero-txt p+p{margin-top:22px}
.${P}-hero-txt strong{font-weight:700}
.${P}-pill{grid-area:pill;justify-self:start;display:inline-flex;align-items:center;gap:8px;background:#EAF4FF;color:${AZUL};font-size:16px;line-height:21.6px;font-weight:500;padding:8px 12px;border-radius:12px}
.${P}-hero-linea{grid-area:linea;font-size:18px;line-height:23.4px;font-weight:800;color:${AZUL_OSC}}
.${P}-hero-btn{grid-area:btn;justify-self:start;margin-top:16px}
.${P}-hero-media{grid-area:media;position:relative;margin-top:-24px;aspect-ratio:660/583;width:100%}
.${P}-hero-fondo{position:absolute;left:7.6%;top:5.5%;width:85.3%;height:78.7%;background:#E3EEFC;border-radius:24px}
.${P}-hero-tarjeta{position:absolute;left:12.2%;top:13.4%;width:85.2%;aspect-ratio:16/10;background:#fff;border-top:4px solid ${DORADO};border-radius:8px;box-shadow:0 5px 16px rgba(5,15,36,.18);overflow:hidden}
.${P}-hero-video{display:block;width:100%;height:100%;object-fit:cover;background:#F3F5F9}
.${P}-hero-flota{position:absolute;right:2%;top:1.5%;width:44%;height:auto;border-radius:10px;box-shadow:0 5px 16px rgba(5,15,36,.18);background:#fff}

/* La franja «Integración con más de 50 plataformas:»: rótulo de 14 px en mayúsculas y los íconos de 24 px cada 42. */
.${P}-franja{padding:44px 0 44px 4px}
.${P}-franja-in{display:flex;align-items:center;gap:24px}
.${P}-franja-t{font-size:14px;line-height:18.2px;font-weight:800;text-transform:uppercase;color:#78909C;flex:none;width:328px}
.${P}-franja-ics{display:flex;flex-wrap:wrap;gap:20px 18px}
.${P}-franja-ics li{width:24px;height:24px;transition:opacity .3s}
.${P}-franja-ics li:hover{opacity:.9}
.${P}-franja-ics img{width:24px;height:24px;object-fit:contain;display:block}

/* La caja celeste: 1200 px, radio 24, el título centrado, el muro de dos filas que corren, «Pausar», el video y el botón. */
.${P}-caja-sec{padding:0}
.${P}-caja{background:#F1F7FD;border-radius:24px;padding:64px 48px 40px;display:flex;flex-direction:column;align-items:center;gap:20px}
.${P}-caja-h{max-width:720px;text-align:center;font-family:'Quicksand',sans-serif;font-size:24px;line-height:33.6px;font-weight:700;letter-spacing:-.2px;color:#212B30}
.${P}-caja-h em{color:${AZUL_OSC}}
.${P}-muro{position:relative;width:100%;padding:12px 0;display:flex;flex-direction:column;align-items:center;gap:20px}
.${P}-muro-filas{width:100%;overflow:hidden;display:grid;gap:18px;order:0;-webkit-mask-image:linear-gradient(to right,transparent,#000 3%,#000 97%,transparent);mask-image:linear-gradient(to right,transparent,#000 3%,#000 97%,transparent)}
.${P}-muro-pista{display:flex;width:max-content;animation:${P}-corre 48s linear infinite}
.${P}-muro-pista:nth-child(2){animation-direction:reverse;animation-duration:55s}
.${P}-muro-g{display:flex;gap:20px;padding-right:20px;flex-shrink:0}
.${P}-muro-t{display:flex;align-items:center;justify-content:center;gap:10px;width:174px;height:90px;padding:18px;background:#fff;border:1px solid #E7EDF3;border-radius:14px;font-size:16px;line-height:20px;font-weight:700;color:#212B30;text-align:center}
.${P}-muro-e{font-size:26px;line-height:1;flex:none}
.${P}-muro-pausa{position:absolute;opacity:0;width:1px;height:1px}
.${P}-muro label{order:1;display:inline-flex;align-items:center;gap:4px;font-size:14px;line-height:21.6px;padding:6px 12px;border:1px solid #DCE6F0;border-radius:8px;color:#455A64;cursor:pointer;background:#fff}
.${P}-muro-pp{display:inline-block;width:8px;height:10px;border-left:2px solid currentColor;border-right:2px solid currentColor}
.${P}-muro-rt{display:none}
.${P}-muro-pausa:checked+label .${P}-muro-pt{display:none}
.${P}-muro-pausa:checked+label .${P}-muro-rt{display:inline}
.${P}-muro-pausa:checked+label .${P}-muro-pp{width:0;height:0;border:0;border-left:8px solid currentColor;border-top:5px solid transparent;border-bottom:5px solid transparent}
.${P}-muro-pausa:focus-visible+label{outline:3px solid #AACAFA;outline-offset:3px}
.${P}-muro-pausa:checked~.${P}-muro-filas .${P}-muro-pista,.${P}-muro:hover .${P}-muro-pista{animation-play-state:paused}
@keyframes ${P}-corre{to{transform:translateX(-50%)}}
/* Su video: 1104 × 632 con un borde blanco de 12 px, radio 12 y la sombra de sus capturas; 31 px debajo de «Pausar». */
.${P}-caja-video{width:100%;max-width:1104px;margin-top:11px;border:12px solid #fff;border-radius:12px;background:#fff;box-shadow:0 5px 16px rgba(5,15,36,.18);overflow:hidden}
.${P}-caja-video video{display:block;width:100%;aspect-ratio:16/9;background:#F3F5F9;object-fit:cover}
.${P}-caja-btn{margin-top:16px}

/* «¡Deja de perder tiempo…!»: 120 px arriba, el título centrado de 32 px y las tarjetas pastel de radio 24 con 40 de separación. */
.${P}-sec-cards{padding:120px 0 0}
.${P}-h2{max-width:792px;margin:0 auto;text-align:center;font-family:'Quicksand',sans-serif;font-size:32px;line-height:41.6px;font-weight:700;letter-spacing:-.2px;color:${AZUL_OSC}}
.${P}-cards{margin-top:80px;display:flex;flex-direction:column;gap:40px}
.${P}-card{position:relative;display:flex;border-radius:24px;overflow:hidden;transition:background .3s,border .3s,box-shadow .3s,transform .4s}
/* Las anchas: con el texto a la izquierda (su «Overview»: 0 40 0 80, 20 de separación, la captura pegada abajo a la derecha) o con la
   captura a la izquierda (su «Dashboard» y su «Reportei AI»: 0 40, 79 de separación, la captura de 507 pegada abajo). La captura
   empieza 40 px debajo del borde: ella da el alto (305–330). */
.${P}-card-ancha,.${P}-card-ancha-inv{align-items:stretch}
.${P}-card-ancha{padding:0 40px 0 80px;gap:20px}
.${P}-card-ancha-inv{flex-direction:row-reverse;padding:0 40px;gap:79px}
.${P}-card-ancha .${P}-card-txt{flex:0 0 400px;align-self:center;padding:40px 0}
.${P}-card-ancha-inv .${P}-card-txt{flex:0 0 380px;align-self:center;padding:40px 0}
.${P}-card-ancha .${P}-card-img{flex:1;min-width:0;align-self:flex-end;display:flex;justify-content:flex-end;padding-top:40px}
.${P}-card-ancha-inv .${P}-card-img{flex:0 0 507px;min-width:0;align-self:flex-end;display:flex;justify-content:center;padding-top:40px}
.${P}-card-img img{display:block;max-width:100%;height:auto;max-height:290px;object-fit:contain;object-position:bottom;border-radius:10px 10px 0 0;box-shadow:0 5px 16px rgba(5,15,36,.12)}
.${P}-altas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:40px}
/* Las altas: 373 × 535, 40 40 0, la captura pegada abajo. */
.${P}-card-alta{flex-direction:column;padding:40px 40px 0;min-height:535px}
.${P}-card-alta .${P}-card-img{margin-top:auto;padding-top:28px;display:flex;justify-content:center}
.${P}-card-alta .${P}-card-img img{max-height:250px}
.${P}-card-rot{display:flex;align-items:center;gap:16px}
.${P}-chip{flex:none;width:31px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#fff}
.${P}-card-r{font-family:'Quicksand',sans-serif;font-size:18px;line-height:23.4px;font-weight:700;letter-spacing:-.2px}
.${P}-card-t{margin-top:24px;font-family:'Quicksand',sans-serif;font-size:24px;line-height:28.8px;font-weight:700;letter-spacing:-.2px}
.${P}-card-ancha .${P}-card-t,.${P}-card-ancha-inv .${P}-card-t{margin-top:28px}
.${P}-mas{margin-top:25px;display:inline-flex;align-items:center;gap:12px;font-size:16px;line-height:21.6px;font-weight:700;color:#849287}
${TONOS.map((t) => `.${P}-t-${t.id}{background:${t.fondo}}.${P}-t-${t.id}:hover{background:${t.hover}}.${P}-t-${t.id} .${P}-chip{background:${t.rot}}.${P}-t-${t.id} .${P}-card-r,.${P}-t-${t.id} .${P}-mas svg{color:${t.rot}}.${P}-t-${t.id} .${P}-card-t{color:${t.tit}}`).join('\n')}

/* Las de borde fino (su Studio y su MCP, rpt-home-ai): 1200 px, dos columnas con 24 de separación, 32 de aire, radio 20. */
.${P}-finas{width:100%;max-width:1200px;margin:0 auto;padding:32px 0 56px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
.${P}-finas article{padding:32px;border:1px solid #DCE6F4;border-radius:20px;background:#F4F8FF;display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.${P}-finas article+article{background:#EEFBF2;border-color:#D8EFDF}
.${P}-fina-marca{display:flex;gap:12px;align-items:center;font-weight:700;color:${AZUL_OSC};margin-bottom:20px}
.${P}-fina-marca svg{width:32px;height:32px;flex-shrink:0}
.${P}-finas h2{font-size:28px;line-height:1.25;font-weight:700;color:${AZUL_OSC};margin:0 0 16px;font-family:'Quicksand',sans-serif}
.${P}-finas p{font-size:17px;line-height:1.5;color:#455A64;margin:0 0 24px}
.${P}-fina-cta{display:inline-flex;margin-top:auto;padding:12px 20px;border-radius:12px;background:${AZUL};color:#fff;font-weight:600;line-height:1.4;transition:background-color .2s linear}
.${P}-fina-cta:hover,.${P}-fina-cta:focus-visible{background:${AZUL_OSC};outline:3px solid #C3D9FA;outline-offset:3px}

/* La banda azul: 542 px de alto, el título blanco de 32 px con su resaltado, el texto celeste y los íconos en círculos cada 64 px. */
.${P}-banda{background:${AZUL_OSC};padding:110px 0}
.${P}-banda-in{display:grid;grid-template-columns:376px 624px;column-gap:100px;align-items:start;padding:0 10px}
.${P}-banda-h2{max-width:316px;font-family:'Quicksand',sans-serif;font-size:32px;line-height:38.4px;font-weight:700;letter-spacing:-.2px;color:#fff;margin-bottom:20px}
.${P}-banda-p{font-size:16px;line-height:20.8px;font-weight:500;color:#BAD2F1}
.${P}-banda-ics{display:flex;flex-wrap:wrap;gap:16px;max-width:624px;justify-content:center}
.${P}-banda-ics li{width:48px;height:48px;border-radius:50%;background:#ECF0F1;display:flex;align-items:center;justify-content:center}
.${P}-banda-ics img{width:28px;height:28px;object-fit:contain;display:block}

/* «Conoce la herramienta» (#F9FAFB, 62 px arriba y abajo): el título, la caja blanca de las pestañas, la ventana con sus tres puntos,
   el párrafo y el botón. A 1024 px o menos la esconde (como Reportei) y la abre el «Quiero saber más» de una tarjeta. */
.${P}-herr{background:#F9FAFB;padding:62px 0;display:flex;flex-direction:column;align-items:center}
.${P}-herr-h{font-family:'Quicksand',sans-serif;font-size:28px;line-height:36.4px;font-weight:700;color:#212B30;text-align:center}
.${P}-herr-radio{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
/* La caja de las pestañas: 1344 px (32 más que el contenedor a cada lado), borde de 2 px #ECF0F1, radio 16, 12 de aire; cada pestaña
   11 × 19, radio 12, Inter 16; la elegida en #E3EEFC con la letra azul en 700; al pasar el mouse, gris. */
.${P}-herr-tabs{width:calc(100% - 96px);max-width:1344px;margin-top:20px;background:#fff;border:2px solid #ECF0F1;border-radius:16px;padding:12px}
.${P}-herr-tabs-in{display:flex;flex-wrap:wrap;justify-content:center;gap:0}
.${P}-herr-tab{display:inline-flex;align-items:center;gap:8px;padding:11px 19px;border-radius:12px;font-size:16px;line-height:21.6px;font-weight:400;color:#212B30;cursor:pointer;transition:background-color .2s linear,color .2s linear}
.${P}-herr-tab:hover{background:#ECF0F1}
.${P}-herr-tab svg{flex:none;margin:0 0 0 3px}
/* La captura (1260 × 709, con su ventana de navegador dibujada): aquí la ventana es HTML y adentro corre la entrada de cada hoja. */
.${P}-herr-paneles{width:calc(100% - 180px);max-width:1260px;margin-top:26px}
.${P}-herr-panel{display:none}
.${P}-herr-ventana{background:#fff;border-radius:24px;padding:14px;box-shadow:0 4px 20px rgba(5,15,36,.05)}
.${P}-herr-marco{background:#EEF1F4;border-radius:12px;overflow:hidden;border:1px solid #E1E5EA}
.${P}-herr-puntos{display:flex;gap:8px;padding:9px 12px}
.${P}-herr-puntos i{width:14px;height:14px;border-radius:50%;background:#FF5FC8}
.${P}-herr-puntos i:nth-child(2){background:#F9B935}
.${P}-herr-puntos i:nth-child(3){background:#1EBE54}
.${P}-herr-marco video{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#F3F5F9}
.${P}-herr-p{margin-top:20px;font-size:18px;line-height:23.4px;color:#455A64}
.${P}-herr-btn{margin-top:26px}
${[0, 1, 2, 3].map((i) => `.${P}-herr:has(.${P}-herr-radio:nth-of-type(${i + 1}):checked) .${P}-herr-panel:nth-child(${i + 1}){display:block}
.${P}-herr:has(.${P}-herr-radio:nth-of-type(${i + 1}):checked) .${P}-herr-tab:nth-child(${i + 1}){background:#E3EEFC;color:${AZUL};font-weight:700}`).join('\n')}
.${P}-herr-radio:focus-visible~.${P}-herr-tabs{outline:2px solid ${AZUL};outline-offset:2px}

/* La banda de testimonios: azul, 62 px arriba y abajo, 880 px de ancho, tres columnas. */
.${P}-testi{background:${AZUL};padding:62px 0}
.${P}-testi-in{max-width:880px;margin:0 auto;color:#fff}
.${P}-testi-h{text-align:center;font-family:'Quicksand',sans-serif;font-size:20px;line-height:24px;font-weight:700}
.${P}-testi-sub{margin-top:20px;text-align:center;font-size:20px;line-height:26px;font-weight:700}
.${P}-testi-cols{margin-top:64px;display:grid;grid-template-columns:repeat(3,1fr);gap:40px;align-items:start}
.${P}-testi-col{padding:0 10px}
.${P}-testi-mes{font-family:'Quicksand',sans-serif;font-size:36px;line-height:51px;font-weight:700;color:#fff}
.${P}-testi-mes span{font-family:'Inter',sans-serif;font-size:16px;font-weight:500;color:rgba(255,255,255,.65);margin-right:6px}
.${P}-testi-q{margin-top:35px;font-size:18px;line-height:21.6px;font-weight:500}
.${P}-testi-q strong{font-weight:800}
.${P}-testi-quien{margin-top:24px;display:flex;align-items:center;gap:4px}
.${P}-testi-av{width:64px;height:64px;border-radius:100px;object-fit:cover;flex:none;margin-right:12px;background:${AZUL_OSC}}
.${P}-testi-n{font-size:18px;line-height:21.6px;font-weight:700}
.${P}-testi-r{font-size:16px;line-height:19.2px;font-weight:500;color:rgba(255,255,255,.45)}

/* El pie (en producción lo tapa el del sitio). */
.${P}-pie{background:#F9FAFB}
.${P}-pie-in{max-width:1160px;margin:0 auto;padding:60px 0 56px;display:grid;grid-template-columns:240px 1fr}
.${P}-pie-h{font-size:18px;line-height:23.4px;font-weight:600;color:#212B30;margin-bottom:12px}
.${P}-pie-cols ul{columns:4 206px;column-gap:32px}
.${P}-pie-cols li{font-size:16px;line-height:25.6px;margin-bottom:6px;break-inside:avoid}
.${P}-pie-cols a{color:#212B30;transition:opacity .2s}
.${P}-pie-cols a:hover{opacity:.7}
.${P}-pie-base{border-top:1px solid #ECEFF1;padding:21px 24px 50px;text-align:center}
.${P}-pie-base p{font-size:14px;line-height:21px;color:#212B30}

/* El modo oscuro de lo que el sol y la luna no puede llevar (lo que cambia con :checked y lo que va con data-tema-fijo). */
html[data-sitio-modo="oscuro"] .${P}-herr-tabs{background:#161B24;border-color:#2A313D}
html[data-sitio-modo="oscuro"] .${P}-herr-tab{color:#E8EAF0}
html[data-sitio-modo="oscuro"] .${P}-herr-tab:hover{background:#222935}
${[0, 1, 2, 3].map((i) => `html[data-sitio-modo="oscuro"] .${P}-herr:has(.${P}-herr-radio:nth-of-type(${i + 1}):checked) .${P}-herr-tab:nth-child(${i + 1}){background:#1B2A45;color:#8FB3FF}`).join('\n')}
html[data-sitio-modo="oscuro"] .${P}-herr-ventana{background:#161B24}
html[data-sitio-modo="oscuro"] .${P}-herr-marco{background:#1E242E;border-color:#2A313D}
html[data-sitio-modo="oscuro"] .${P}-hero-fondo{background:#1A2638}
html[data-sitio-modo="oscuro"] .${P}-caja-video{background:#161B24;border-color:#161B24}
/* Las tarjetas pastel son links: el sol y la luna deja un link con fondo como está (es un botón) y quedaban claras en el oscuro. */
${TONOS.map((t) => `html[data-sitio-modo="oscuro"] .${P}-t-${t.id}{background:${t.oscuro[0]}}html[data-sitio-modo="oscuro"] .${P}-t-${t.id}:hover{background:${t.oscuro[1]}}html[data-sitio-modo="oscuro"] .${P}-t-${t.id} .${P}-chip{background:${t.oscuro[2]};color:#0E1219}html[data-sitio-modo="oscuro"] .${P}-t-${t.id} .${P}-card-r,html[data-sitio-modo="oscuro"] .${P}-t-${t.id} .${P}-mas svg{color:${t.oscuro[2]}}html[data-sitio-modo="oscuro"] .${P}-t-${t.id} .${P}-card-t{color:${t.oscuro[3]}}`).join('\n')}
html[data-sitio-modo="oscuro"] .${P}-mas{color:#9AA5A0}

/* Entre 1240 y 1025 px el contenedor deja 24 de aire a los lados. */
@media (max-width:1240px){
  .${P}-cont,.${P}-pie-in,.${P}-finas{padding-left:24px;padding-right:24px}
  .${P}-hero-in{grid-template-columns:minmax(0,504fr) minmax(0,660fr)}
  .${P}-banda-in{grid-template-columns:minmax(0,376px) minmax(0,1fr);column-gap:48px}
  .${P}-testi-in{padding:0 24px}
  .${P}-card-ancha .${P}-card-txt,.${P}-card-ancha-inv .${P}-card-txt{flex-basis:340px}
  .${P}-card-ancha-inv{gap:40px}
  .${P}-card-ancha-inv .${P}-card-img{flex:1 1 0}
}
/* A 1024 px o menos: «Conoce la herramienta» escondida hasta que la abre una tarjeta, y entonces las pestañas en una fila que se desliza. */
@media (max-width:1024px){
  .${P}-herr{display:none}
  .${P}-herr.${P}-revelada{display:flex}
  .${P}-herr-tabs{width:calc(100% - 32px)}
  .${P}-herr-tabs-in{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;max-width:100%}
  .${P}-herr-tab{flex:0 0 auto;white-space:nowrap}
  .${P}-herr-paneles{width:calc(100% - 32px)}
  .${P}-altas{grid-template-columns:minmax(0,1fr)}
}
/* A 390 px (su versión de teléfono): la imagen entre el título y el texto, todo en una columna, la caja sin su video. */
@media (max-width:767px){
  .${P}-barra{padding-top:0}
  .${P}-cont{padding-left:24px;padding-right:24px}
  .${P}-barra .${P}-cont{padding-left:0;padding-right:16px}
  .${P}-barra-link{display:none}
  .${P}-barra-btn{background:none;color:${AZUL};padding:0;font-weight:500;line-height:21.6px}
  .${P}-hero{padding:64px 0 40px}
  .${P}-hero-in{grid-template-columns:minmax(0,1fr);grid-template-areas:'h1' 'media' 'txt' 'pill' 'linea' 'btn';grid-template-rows:none;row-gap:24px}
  .${P}-h1{font-size:32px;line-height:41.6px}
  .${P}-hero-media{margin:0 -24px;width:auto}
  .${P}-hero-txt{font-size:16px;line-height:20.8px}
  .${P}-hero-txt p+p{margin-top:20.8px}
  .${P}-pill{justify-self:stretch;justify-content:center;text-align:center}
  .${P}-hero-linea{font-size:16px;line-height:20.8px}
  .${P}-btn{font-size:16px}
  .${P}-hero-btn{margin-top:0}
  .${P}-franja{padding:40px 0 24px}
  .${P}-franja-in{flex-direction:column;align-items:flex-start;gap:16px}
  .${P}-franja-t{font-size:15px;line-height:19.5px;width:auto}
  .${P}-franja-ics{width:100%;display:grid;grid-template-columns:repeat(8,24px);justify-content:space-between;row-gap:20px}
  .${P}-caja-sec .${P}-cont{padding:0}
  .${P}-caja{border-radius:0;padding:64px 24px}
  .${P}-caja-h{font-size:20px;line-height:28px}
  .${P}-muro-t{width:140px;height:78px;padding:14px;font-size:14px;line-height:17px;gap:8px}
  .${P}-muro-e{font-size:22px}
  .${P}-muro-g{gap:12px;padding-right:12px}
  .${P}-muro-filas{gap:12px}
  .${P}-caja-video{display:none}
  .${P}-caja-btn{margin-top:7px}
  .${P}-sec-cards{padding:80px 0 0}
  .${P}-h2{text-align:left;font-size:24px;line-height:31.2px}
  .${P}-cards{margin-top:48px;gap:24px}
  .${P}-card-ancha,.${P}-card-ancha-inv{flex-direction:column;padding:24px 24px 0;gap:0}
  .${P}-card-ancha .${P}-card-txt,.${P}-card-ancha-inv .${P}-card-txt{flex:none;padding:0}
  .${P}-card-ancha .${P}-card-img,.${P}-card-ancha-inv .${P}-card-img{flex:none;padding-top:24px;align-self:stretch;justify-content:center}
  .${P}-card-alta{padding:24px 24px 0;min-height:0}
  .${P}-card-alta .${P}-card-img{padding-top:24px}
  .${P}-altas{gap:24px}
  .${P}-card-r{font-size:16px;line-height:20.8px}
  .${P}-card-t{margin-top:20px;font-size:20px;line-height:24px}
  .${P}-mas{margin-top:20px}
  .${P}-finas{grid-template-columns:minmax(0,1fr);gap:20px;padding:20px 20px 36px}
  .${P}-finas article{padding:24px}
  .${P}-finas h2{font-size:26px}
  .${P}-banda{padding:80px 0}
  .${P}-banda-in{grid-template-columns:minmax(0,1fr);row-gap:40px;padding:0 24px}
  .${P}-banda-h2{max-width:none}
  .${P}-banda-ics{justify-content:center;gap:12px}
  .${P}-herr-h{font-size:26px;line-height:32px}
  .${P}-herr-p{font-size:16px;line-height:22px}
  .${P}-herr-ventana{padding:8px;border-radius:16px}
  .${P}-testi-h{font-size:18.24px;line-height:21.9px;padding:0 10px}
  .${P}-testi-sub{padding:0 10px}
  .${P}-testi-cols{grid-template-columns:minmax(0,1fr);gap:56px;margin-top:48px;padding:0 10px}
  .${P}-testi-mes{text-align:center}
  .${P}-testi-quien{flex-direction:column;align-items:flex-start}
  .${P}-testi-av{align-self:center;margin:0 0 10px}
  .${P}-pie-in{grid-template-columns:minmax(0,1fr);padding:40px 16px 48px;row-gap:32px}
  .${P}-pie-marca{justify-self:center}
  .${P}-pie-cols ul{columns:1}
}
@media (prefers-reduced-motion:reduce){
  .${P} *{transition:none!important}
  .${P}-muro-pista{animation:none}
}
`;

// =============================================================================
// El script (data-visor): los videos del hero y de la caja corren solos y sin sonido mientras se ven; la pestaña elegida de «Conoce
// la herramienta» reproduce la ENTRADA de su hoja una vez (desde el principio) y las demás se pausan; un «Quiero saber más» elige su
// pestaña, abre la sección (a 1024 px o menos está escondida, como en Reportei) y baja hasta ella. Con «menos movimiento», los videos
// quedan en su primer cuadro. Idempotente (`__listo`) y limpia su estado: pulir.mjs guarda el DOM DESPUÉS de correrlo.
// =============================================================================
const SCRIPT = `(function(){
var P='${P}';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function iniciar(){
  var R=document.querySelector('.'+P);if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  var H=R.querySelector('.'+P+'-herr');
  if(H)H.classList.remove(P+'-revelada');
  var radios=H?[].slice.call(H.querySelectorAll('.'+P+'-herr-radio')):[];
  radios.forEach(function(r,i){r.checked=i===0;});
  var sueltos=[].slice.call(R.querySelectorAll('.'+P+'-hero-video,.'+P+'-caja-video video,.'+P+'-testi-av'));
  var deTab=H?[].slice.call(H.querySelectorAll('.'+P+'-herr-panel video')):[];
  sueltos.concat(deTab).forEach(function(v){v.muted=true;if(quieto){v.removeAttribute('autoplay');try{v.pause();}catch(e){}}});
  var verH=false;
  function activa(){for(var i=0;i<radios.length;i++)if(radios[i].checked)return i;return 0;}
  function tocar(desde){if(quieto)return;deTab.forEach(function(v,i){if(i===activa()&&verH){if(v.preload!=='auto')v.preload='auto';if(desde){try{v.currentTime=0;}catch(e){}}var p=v.play();if(p&&p.catch)p.catch(function(){});}else if(!v.paused)v.pause();});}
  radios.forEach(function(r){r.addEventListener('change',function(){tocar(true);});});
  if('IntersectionObserver' in window&&!quieto){
    // Fuera de la vista (o escondido: el video de la caja a 390) se pausa SIEMPRE: con autoplay, un pause() antes de que arranque
    // es lo que lo frena; preguntar si estaba en pausa primero lo dejaba arrancar igual.
    var ob=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;if(e.isIntersecting&&v.offsetParent!==null){var p=v.play();if(p&&p.catch)p.catch(function(){});}else v.pause();});},{threshold:.25});
    sueltos.forEach(function(v){ob.observe(v);});
    if(H)new IntersectionObserver(function(es){var antes=verH;verH=es[0].isIntersecting;if(verH&&!antes)tocar(true);else if(!verH)tocar(false);},{threshold:.2}).observe(H);
  }
  // Su «Quiero saber más»: elige la pestaña, abre la sección y baja hasta ella.
  R.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-pestana]');if(!a||!H)return;var r=H.querySelector('#'+P+'-h-'+a.getAttribute('data-pestana'));if(!r)return;e.preventDefault();H.classList.add(P+'-revelada');r.checked=true;H.scrollIntoView({behavior:quieto?'auto':'smooth',block:'start'});tocar(true);});
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;
