// =============================================================================
// /vsl/ads — Marketing CoPilot con el DISEÑO de la portada de Master Ads (https://masterads.ai/, leída el 11/11/2026 y RELEÍDA
// entera el 14/11/2026: estilos calculados, @keyframes, hovers y un video del recorrido a 1440 y a 390)
// =============================================================================
// La referencia es una página QUIETA: no tiene videos, ni apariciones al bajar, ni IntersectionObserver (medido: cero elementos
// ocultos al cargar, cero cambios de estilo por JS al bajar). Todo lo que se mueve son CSS:
//   · `ma-breathe` (2,8 s, cubic-bezier(.4,0,.2,1)): la burbuja «¿Con qué arrancamos?» y los TRES «Probar gratis» crecen a 1,1 desde
//     su borde IZQUIERDO (transform-origin: 0 center, también los botones centrados) con un anillo que se abre de 0 a 12 px y se apaga;
//   · `ma-option-light` (8 s, ease-in-out, retrasos de 2 s): las cuatro opciones se encienden de a una (5 %–20 % del ciclo);
//   · `ma-integrations-scroll` (75 s, lineal): la tira de «Se conecta con», que se FRENA al pasar el mouse y con su botón de pausa
//     (36 × 36, «Pausar integraciones» ↔ «Reanudar integraciones», el ícono de pausa ↔ play). Con «menos movimiento» se vuelve una
//     fila que se desplaza a mano, sin la copia.
// Los hovers: los botones bajan su fondo (forest al 90 %), el de pausa toma la menta; nada más.
// Copiado con sus medidas y sus cortes de Tailwind (640 / 768 / 1024): ver docs/diseno/landings-competencia/ads.md.
// Las letras son las de la referencia (Space Grotesk en h1, h2 y h3; IBM Plex Sans en el resto), en public/vsl-assets/fuentes/.
//
// De MaKo: el azul #2F6FED donde Master Ads pone su verde de acción, la estrella donde pone su rayo, y su paleta de marca (los verdes)
// en la misma familia del azul. LAS PANTALLAS SON LAS REALES (Martín, 14/11/2026), grabadas en los bancos de C:/dev/bancos-portada:
//   · donde la referencia pone la captura de su videollamada: las decisiones del CoPilot (copilot.webm, la de la portada), y debajo
//     de 1024 px, donde pone otra imagen VERTICAL en un marco de 240 (300 desde 640), la misma animación en vertical
//     (copilot-vertical.webm, banco-copilot-vertical);
//   · donde dibuja su tablero de ejemplo: la pantalla de Campañas del CoPilot con lo que gastó y lo que vendió cada campaña
//     (copilot-reporte.webm, banco-copilot-reporte: `MediaBuyer` real con campañas inventadas, con la cámara), y debajo de 640 px,
//     donde la referencia rearma su tablero en una columna, la misma pantalla grabada a 390 px (copilot-reporte-tel.webm);
//   · donde dibuja el teléfono con su charla: lo que MaKo contesta en tu grupo (copilot-whatsapp.webm, banco-copilot-whatsapp, con las
//     respuestas de lib/api-mako/areas/ads.def.ts); el teléfono, su marco y la insignia de WhatsApp son los de la referencia.
// Lo que se sacó de la referencia, y por qué:
//   · Las integraciones que MaKo no tiene (Google Ads, TikTok Ads, Tiendanube, Kommo…) y sus «Próximamente»: van las del catálogo de
//     MaKo que usa el CoPilot (public/vsl-assets/logos/integraciones/), con su nombre (son íconos, no logotipos con la palabra).
//   · El precio del cierre («por sólo US$ 29 al mes»): en su lugar, con la misma letra y el mismo resaltado, la frase del cierre
//     de MaKo (TEXTO_CIERRE: los días de la prueba).
//   · Su barra y su pie: los pone el sitio (BarraGlobal y PieGlobal); los de acá quedan escondidos.
//   · Su tablero y su teléfono son QUIETOS; acá son pantallas grabadas que se mueven (lo que MaKo hace, no un dibujo).
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, EstrellaMaKo, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';

const P = 'd-ads';
type De<T extends Bloque['tipo']> = Extract<Bloque, { tipo: T }>;

function Icono({ d, size = 16, clase }: { d?: string[]; size?: number; clase?: string }) {
  if (!d?.length) return null;
  return (
    <svg className={clase} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const ICONO = {
  pregunta: ['M22 17a2 2 0 0 1 -2 2h-13.172a2 2 0 0 0 -1.414 .586l-2.202 2.202a.71 .71 0 0 1 -1.212 -.5v-15.288a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2z'],
  persona: ['M12 8m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M3 21a9 9 0 0 1 14 -6'],
  mano: ['M18 11v-5a2 2 0 0 0 -4 0', 'M14 10v-6a2 2 0 0 0 -4 0v2', 'M10 10.5v-4.5a2 2 0 0 0 -4 0v8', 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1 -8 8h-2c-2.8 0 -4.5 -.86 -6 -2.34l-3.6 -3.6a2 2 0 0 1 2.83 -2.82l1.77 1.76'],
  pausa: ['M6 4h4v16h-4z', 'M14 4h4v16h-4z'],
  play: ['M6 3l14 9l-14 9z'],
};

const WHATSAPP = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

/** Las pantallas grabadas de MaKo (public/vsl-assets/sitio/): el póster es su PRIMER cuadro (docs/hallazgos-landing.md). */
function Pantalla({ n, clase }: { n: string; clase: string }) {
  return <video className={clase} src={`/vsl-assets/sitio/${n}.webm`} poster={`/vsl-assets/sitio/${n}.jpg`} autoPlay muted loop playsInline preload="metadata" />;
}

function Cta() {
  return <a href={RUTA_CTA} className={`${P}-cta ${P}-respira`}>{TEXTO_CTA}</a>;
}

// ── La barra (escondida: va la del sitio, BARRA_PROPIA en ../TemaSitio.tsx) ──
function Barra() {
  return (
    <header className={`${P}-nav`}>
      <div className={`${P}-navin`}>
        <LogoMaKo className={`${P}-brand`} tamano={32} />
        <div className={`${P}-navright`}>
          <a href="/login" className={`${P}-pill ${P}-pill-claro`}>Iniciar sesión</a>
          <a href={RUTA_CTA} className={`${P}-pill ${P}-pill-oscuro`}>{TEXTO_CTA}</a>
        </div>
      </div>
    </header>
  );
}

// ── El hero y «¿Con qué arrancamos?» (en la referencia, la misma sección) ────
function Hero({ b }: { b: De<'hero'> }) {
  return (
    <>
      <span className={`${P}-badge`} dangerouslySetInnerHTML={html(b.etiqueta)} />
      <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
      <p className={`${P}-hero-p`} dangerouslySetInnerHTML={html(b.bajada)} />
    </>
  );
}

/** La burbuja que respira, la caja de cuatro opciones que se encienden por turno (links, como en la referencia: sólo el rótulo) y el botón. */
function Arrancamos({ b }: { b: De<'tarjetas'> }) {
  return (
    <div className={`${P}-arranca`}>
      <div className={`${P}-burbuja-fila`}>
        <span className={`${P}-rayo`}><EstrellaMaKo size={16} color="#fff" /></span>
        <span className={`${P}-burbuja ${P}-respira`} dangerouslySetInnerHTML={html(b.titulo)} />
      </div>
      <div className={`${P}-opciones`}>
        {b.items.map((it) => (
          <a key={it.titulo} href={RUTA_CTA} className={`${P}-opcion`}><Icono d={it.icono} size={16} /><span dangerouslySetInnerHTML={html(it.titulo)} /></a>
        ))}
      </div>
      {b.cta ? <div className={`${P}-cta-fila`}><Cta /></div> : null}
    </div>
  );
}

// ── «Inteligencia artificial, atención humana»: el texto y el botón; a la derecha, el marco oscuro con la pantalla ─
function Atencion({ b }: { b: De<'tarjetas'> }) {
  return (
    <section className={`${P}-sec ${P}-bg`}>
      <div className={`${P}-wrap ${P}-dos`}>
        <div className={`${P}-dos-txt`}>
          <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-lede`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
          <div className={`${P}-dos-cta`}><Cta /></div>
        </div>
        {/* Como la referencia: desde 1024 la pantalla horizontal; debajo, otra VERTICAL en un marco angosto (240, 300 desde 640). */}
        <div className={`${P}-marco ${P}-solo-ancho`}>
          <Pantalla n="copilot" clase={`${P}-marco-media`} />
        </div>
        <div className={`${P}-marco ${P}-marco-tel ${P}-solo-angosto`}>
          <Pantalla n="copilot-vertical" clase={`${P}-marco-media`} />
        </div>
      </div>
    </section>
  );
}

// ── Las bandas oscuras: «lo de siempre» (5 tarjetas con ícono) y «Pensado para…» (3 sin ícono y la frase del cierre) ──
function BandaOscura({ b, cierre = false }: { b: De<'tarjetas'>; cierre?: boolean }) {
  const cinco = b.items.length >= 5;
  return (
    <section className={`${P}-sec ${P}-deep`}>
      <div className={`${P}-wrap`}>
        <div className={`${P}-centro`}>
          <h2 className={`${P}-h2 ${P}-h2-claro`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-lede ${P}-lede-claro`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        <div className={`${P}-cards ${cinco ? `${P}-cards-5` : `${P}-cards-3`}`}>
          {b.items.map((it) => (
            <div key={it.titulo} className={`${P}-card`}>
              {cinco && it.icono ? <Icono d={it.icono} size={20} clase={`${P}-card-i`} /> : null}
              <h3 dangerouslySetInnerHTML={html(it.titulo)} />
              <p dangerouslySetInnerHTML={html(it.texto)} />
            </div>
          ))}
        </div>
        {cierre ? <p className={`${P}-cierre`} dangerouslySetInnerHTML={html(conResaltado(TEXTO_CIERRE))} /> : null}
      </div>
    </section>
  );
}

/** La frase del cierre con lo que la referencia resalta en su color de acción (allá, el precio; acá, los días de la prueba). */
function conResaltado(t: string): string {
  return t.replace(/^(\d+ días gratis)/, `<span class="${P}-resalta">$1</span>`);
}

// ── El reporte: el ícono, el titular y la pantalla de Campañas del CoPilot donde la referencia dibuja su tablero ─
function Reporte({ b }: { b: De<'filas'> }) {
  return (
    <section className={`${P}-sec ${P}-blanco`}>
      <div className={`${P}-wrap`}>
        <div className={`${P}-centro`}>
          <span className={`${P}-pide`} aria-hidden="true">
            <Icono d={ICONO.persona} size={40} clase={`${P}-pide-p`} />
            <Icono d={ICONO.mano} size={24} clase={`${P}-pide-m`} />
          </span>
          <h2 className={`${P}-h2c`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-lede`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
        </div>
        {/* Como la referencia, que debajo de 640 rearma su tablero en una columna: en el teléfono, la misma pantalla grabada a 390 px. */}
        <div className={`${P}-reporte`}>
          <Pantalla n="copilot-reporte" clase={`${P}-reporte-media ${P}-solo-sm`} />
          <Pantalla n="copilot-reporte-tel" clase={`${P}-reporte-media ${P}-solo-chico`} />
        </div>
        <div className={`${P}-cta-fila`}><Cta /></div>
      </div>
    </section>
  );
}

// ── El agente de WhatsApp: rótulo, titular, preguntas; a la derecha el teléfono con lo que contesta MaKo ─
function Whatsapp({ b }: { b: De<'tarjetas'> }) {
  return (
    <section className={`${P}-sec ${P}-bg`}>
      <div className={`${P}-wrap ${P}-wa`}>
        <div>
          {b.etiqueta ? <span className={`${P}-eyebrow`} dangerouslySetInnerHTML={html(b.etiqueta)} /> : null}
          <h2 className={`${P}-h2 ${P}-wa-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
          {b.bajada ? <p className={`${P}-lede ${P}-wa-lede`} dangerouslySetInnerHTML={html(b.bajada)} /> : null}
          <div className={`${P}-chips`}>
            {b.items.map((it) => (
              <div key={it.titulo} className={`${P}-chip`}><Icono d={ICONO.pregunta} size={16} /><span dangerouslySetInnerHTML={html(it.titulo)} /></div>
            ))}
          </div>
        </div>
        <div className={`${P}-tel-wrap`}>
          {/* La insignia de la referencia: el ícono de WhatsApp en blanco (simple-icons, el de public/vsl-assets/logos/integraciones/whatsapp.svg). */}
          <span className={`${P}-tel-wa`} aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24"><path fill="#fff" d={WHATSAPP} /></svg></span>
          <div className={`${P}-tel`}>
            <div className={`${P}-tel-in`}><Pantalla n="copilot-whatsapp" clase={`${P}-tel-media`} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * «Se conecta con»: la tira que corre sola (dos copias de la misma lista, -50 % en un ciclo), se frena al pasar el mouse y con su
 * botón. El botón es una casilla con su rótulo, SIN JavaScript (anda igual en el visor): la casilla es la que se enfoca y se lee
 * («Pausar integraciones», marcada o no) y el rótulo dibuja el ícono de pausa o de play.
 */
function Logos({ b }: { b: De<'logos'> }) {
  // Cada copia lleva la lista dos veces: con 8 logos, una vuelta mide 3 008 px y cubre cualquier pantalla (la referencia trae 25).
  const fila = [...b.items, ...b.items];
  const lista = (oculta: boolean) => (
    <ul aria-hidden={oculta ? 'true' : undefined}>
      {fila.map((l, i) => (
        <li key={`${l.logo}-${i}`} className={i >= b.items.length ? `${P}-dup` : undefined} aria-hidden={i >= b.items.length && !oculta ? 'true' : undefined}>
          <img src={`/vsl-assets/logos/${l.logo}`} alt={oculta || i >= b.items.length ? '' : l.nombre} width={40} height={40} loading="lazy" />
          <span>{l.nombre}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <section className={`${P}-logos`} aria-label="Integraciones">
      <input type="checkbox" id={`${P}-pausa`} className={`${P}-pausa-in`} aria-label="Pausar integraciones" />
      <div className={`${P}-logos-cab`}>
        <h2 className={`${P}-logos-t`} dangerouslySetInnerHTML={html(b.titulo)} />
        <label htmlFor={`${P}-pausa`} className={`${P}-pausa`} aria-hidden="true">
          <Icono d={ICONO.pausa} size={16} clase={`${P}-i-pausa`} />
          <Icono d={ICONO.play} size={16} clase={`${P}-i-play`} />
        </label>
      </div>
      <div className={`${P}-ventana`}>
        <div className={`${P}-pista`}>{lista(false)}{lista(true)}</div>
      </div>
    </section>
  );
}

function Pie() {
  const otras = otrasFunciones('ads');
  return (
    <footer className={`${P}-foot`}>
      <div className={`${P}-wrap`}>
        <LogoMaKo className={`${P}-brand`} tamano={28} />
        <nav className={`${P}-foot-links`} aria-label="Otras funciones de MaKo">
          {otras.map((o) => <a key={o.href} href={o.href}>{o.nombre}</a>)}
        </nav>
        <div className={`${P}-foot-bottom`}>
          <p>© MaKo — Todos los derechos reservados.</p>
          <div><a href="/privacidad">Privacidad</a><a href="/terminos">Términos</a></div>
        </div>
      </div>
    </footer>
  );
}

export default function DisenoAds({ landing }: PropsDiseno) {
  const bl = landing.bloques;
  const ultimaTarjetas = bl.reduce((k, b, i) => (b.tipo === 'tarjetas' ? i : k), -1);

  const cabeza: ReactNode[] = [];
  const resto: ReactNode[] = [];
  let tarjetasVistas = 0;
  bl.forEach((b, i) => {
    switch (b.tipo) {
      case 'hero': cabeza.push(<Hero key={i} b={b} />); break;
      case 'tarjetas': {
        tarjetasVistas += 1;
        if (tarjetasVistas === 1 && resto.length === 0) { cabeza.push(<Arrancamos key={i} b={b} />); break; }
        if (tarjetasVistas === 2) { resto.push(<Atencion key={i} b={b} />); break; }
        if (b.etiqueta && /whatsapp/i.test(b.etiqueta)) { resto.push(<Whatsapp key={i} b={b} />); break; }
        resto.push(<BandaOscura key={i} b={b} cierre={i === ultimaTarjetas} />);
        break;
      }
      case 'filas': resto.push(<Reporte key={i} b={b} />); break;
      case 'logos': resto.push(<Logos key={i} b={b} />); break;
      default: break;
    }
  });

  return (
    <div className={P}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra />
      <main>
        <section className={`${P}-hero`}><div className={`${P}-hero-in`}>{cabeza}</div></section>
        {resto}
      </main>
      <Pie />
      {/* Con «menos movimiento», las pantallas grabadas quedan en su primer cuadro (el CSS ya frena la respiración, las opciones y la tira);
          sin él, anda sólo la pantalla que se ve en este ancho. */}
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT_QUIETO }} />
    </div>
  );
}

// Las pantallas grabadas: con «menos movimiento», quietas en su primer cuadro; si no, anda sólo la que se ve en este ancho (la del teléfono
// o la de la computadora: la otra está escondida y no tiene por qué gastar). Es un <script data-visor>: el visor borra los demás.
const SCRIPT_QUIETO = `(function(){
var quieto=false;try{quieto=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
function mirar(){document.querySelectorAll('.${P} video').forEach(function(v){
  if(quieto||!v.offsetWidth){v.autoplay=false;if(!v.paused)try{v.pause();}catch(e){}return;}
  if(v.paused){var r=v.play();if(r&&r.catch)r.catch(function(){});}});}
mirar();var t=null;addEventListener('resize',function(){clearTimeout(t);t=setTimeout(mirar,200);});
})();`;

// Los valores salen de getComputedStyle sobre https://masterads.ai/ a 1440 y 390 px (11/11 y 14/11/2026). Sus variables:
// --ma-deep #0A2E23, --ma-forest #0E3B2D, --ma-brand #146C43, --ma-action #14794C, --ma-action-hover #105E3B, --ma-mist
// #E3F3EA, --ma-fog #F3F9F6, --background #F5F8F6, --border #D7E3DC, --foreground #12241D, --muted-foreground #52645B; --radius
// 10 px (rounded-lg 10, rounded-xl 14, rounded-2xl 18). Aquí, la misma familia en el azul de MaKo (ver la tabla del .md).
// Los cortes son los de Tailwind: sm 640, md 768, lg 1024 (la base es el teléfono).
const CSS = `
@font-face { font-family: 'd-ads-grotesk'; src: url('/vsl-assets/fuentes/space-grotesk/space-grotesk-latin-var.woff2') format('woff2'); font-weight: 300 700; font-style: normal; font-display: swap; }
@font-face { font-family: 'd-ads-plex'; src: url('/vsl-assets/fuentes/ibm-plex-sans/ibm-plex-sans-latin-var.woff2') format('woff2'); font-weight: 100 700; font-style: normal; font-display: swap; }
.d-ads { --deep: #0A1C3D; --forest: #0E2650; --brand: #1F57C8; --action: #2F6FED; --action-h: #1F57C8; --mist: #E4ECFC; --fog: #F3F6FC; --bgc: #F5F7FA; --borde: #D7DFEC; --tinta: #12192A; --gris: #525D6E;
  --sombra-sm: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1); --sombra-elegante: 0 20px 60px -20px rgba(70,90,230,.35);
  background: var(--bgc); color: var(--tinta); font-family: 'd-ads-plex', 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif; font-size: 16px; line-height: 24px; -webkit-font-smoothing: antialiased; overflow-x: clip; }
.d-ads *, .d-ads *::before, .d-ads *::after { box-sizing: border-box; }
.d-ads :where(h1, h2, h3, h4, p, ul) { margin: 0; padding: 0; }
.d-ads :where(h1, h2, h3) { font-family: 'd-ads-grotesk', 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
.d-ads :where(ul) { list-style: none; }
.d-ads :where(a) { color: inherit; text-decoration: none; }
.d-ads-wrap { max-width: 1152px; margin: 0 auto; padding: 0 16px; }

/* ── Barra (escondida por la del sitio): 64 + filete ── */
.d-ads-nav { background: #fff; border-bottom: 1px solid var(--borde); }
.d-ads-navin { max-width: 1152px; margin: 0 auto; height: 64px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.d-ads-brand { flex: none; }
.d-ads-navright { display: flex; align-items: center; gap: 6px; }
.d-ads-pill { display: inline-flex; align-items: center; justify-content: center; padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 16px; transition: color .15s cubic-bezier(.4,0,.2,1), background-color .15s cubic-bezier(.4,0,.2,1), border-color .15s cubic-bezier(.4,0,.2,1); white-space: nowrap; }
.d-ads .d-ads-pill-claro { background: var(--bgc); border: 1px solid var(--borde); color: var(--tinta); box-shadow: var(--sombra-sm); }
.d-ads .d-ads-pill-claro:hover { background: var(--fog); color: var(--forest); }
.d-ads .d-ads-pill-oscuro { background: var(--action); color: #fff; box-shadow: var(--sombra-sm); }
.d-ads .d-ads-pill-oscuro:hover { background: rgba(47,111,237,.9); }

/* ── Hero: fondo fog, py 64 → 96 (md), contenedor de 896 ── */
.d-ads-hero { background: var(--fog); }
.d-ads-hero-in { max-width: 896px; margin: 0 auto; padding: 64px 16px; text-align: center; }
.d-ads-badge { display: inline-flex; align-items: center; padding: 6px 16px; border-radius: 999px; background: var(--mist); color: var(--forest); font-size: 14px; font-weight: 500; line-height: 20px; }
.d-ads-h1 { margin-top: 24px; font-size: 36px; font-weight: 700; line-height: 40px; letter-spacing: -0.025em; color: var(--tinta); }
.d-ads-hero-p { margin: 20px auto 0; max-width: 672px; font-size: 16px; line-height: 24px; color: var(--gris); }
.d-ads-hero-p strong { color: var(--tinta); font-weight: 600; }
.d-ads-arranca { max-width: 576px; margin: 48px auto 0; }
.d-ads-burbuja-fila { display: flex; align-items: center; justify-content: flex-start; gap: 12px; }
.d-ads-rayo { flex: none; width: 36px; height: 36px; border-radius: 999px; background: var(--action); display: flex; align-items: center; justify-content: center; }
.d-ads-burbuja { display: inline-flex; align-items: center; padding: 10px 20px; border-radius: 999px; background: var(--action); color: #fff; font-size: 14px; font-weight: 500; line-height: 20px; }
.d-ads-opciones { margin-top: 16px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; padding: 16px; background: #fff; border: 1px solid var(--borde); border-radius: 18px; box-shadow: var(--sombra-sm); text-align: left; }
.d-ads-opcion { display: inline-flex; align-items: center; justify-content: flex-start; gap: 8px; min-height: 48px; padding: 12px 16px; border-radius: 10px; background: var(--bgc); border: 1px solid var(--borde); box-shadow: var(--sombra-sm); color: var(--tinta); font-size: 14px; font-weight: 500; line-height: 20px; cursor: pointer;
  transition: color .15s cubic-bezier(.4,0,.2,1), background-color .15s cubic-bezier(.4,0,.2,1), border-color .15s cubic-bezier(.4,0,.2,1); animation: d-ads-luz 8s ease-in-out infinite; }
.d-ads-opcion:hover { background: var(--mist); color: var(--forest); }
.d-ads-opcion:nth-child(2) { animation-delay: 2s; }
.d-ads-opcion:nth-child(3) { animation-delay: 4s; }
.d-ads-opcion:nth-child(4) { animation-delay: 6s; }
.d-ads-opcion svg { flex: none; }
.d-ads-cta-fila { margin-top: 40px; display: flex; justify-content: center; }
.d-ads-cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 16px 32px; border-radius: 999px; background: var(--action); color: #fff !important; font-size: 16px; font-weight: 600; line-height: 24px; box-shadow: var(--sombra-sm); white-space: nowrap; cursor: pointer;
  transition: color .15s cubic-bezier(.4,0,.2,1), background-color .15s cubic-bezier(.4,0,.2,1), border-color .15s cubic-bezier(.4,0,.2,1); }
.d-ads-cta:hover { background: rgba(47,111,237,.9); }
/* La respiración de la referencia: crece desde el borde IZQUIERDO (también el botón centrado) con un anillo que se abre y se apaga. */
.d-ads-respira { transform-origin: 0 center; will-change: transform; animation: d-ads-respira 2.8s cubic-bezier(.4,0,.2,1) infinite; }

/* ── Secciones: py 64 → 96 (md), contenedor de 1152 ── */
.d-ads-sec { padding: 64px 0; }
.d-ads-bg { background: var(--bgc); }
.d-ads-blanco { background: #fff; }
.d-ads-deep { background: var(--deep); }
.d-ads-h2 { font-size: 30px; font-weight: 700; line-height: 36px; letter-spacing: -0.025em; color: var(--tinta); }
.d-ads-h2-claro { color: #fff; }
.d-ads-lede { margin-top: 20px; font-size: 16px; line-height: 24px; color: var(--gris); }
.d-ads-lede-claro { margin-top: 16px; color: rgba(255,255,255,.72); }
.d-ads-centro { text-align: center; }
/* «Inteligencia artificial, atención humana» */
.d-ads-dos { display: grid; grid-template-columns: minmax(0, 1fr); gap: 48px; align-items: center; }
.d-ads-dos-txt { text-align: center; }
.d-ads-dos-txt .d-ads-lede { max-width: 448px; margin-left: auto; margin-right: auto; }
.d-ads-dos-cta { margin-top: 32px; }
.d-ads-marco { width: 100%; max-width: 605px; margin: 0 auto; overflow: hidden; padding: 10px; border-radius: 18px; background: var(--forest); box-shadow: var(--sombra-elegante); }
.d-ads-marco-media { display: block; width: 100%; height: auto; border-radius: 14px; background: #F5F5F4; }
.d-ads-marco-tel { max-width: 240px; }
.d-ads-solo-ancho { display: none; }
/* las tarjetas translúcidas de las bandas oscuras */
.d-ads-cards { margin-top: 48px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.d-ads-card { padding: 20px; border-radius: 18px; background: rgba(255,255,255,.05); box-shadow: 0 0 0 1px rgba(255,255,255,.1); }
.d-ads-cards-3 .d-ads-card { padding: 24px; }
.d-ads-card-i { display: block; color: #fff; }
.d-ads-card h3 { margin-top: 12px; font-size: 14px; font-weight: 600; line-height: 20px; color: #fff; }
.d-ads-cards-3 .d-ads-card h3 { margin-top: 0; font-size: 16px; line-height: 24px; }
.d-ads-card p { margin-top: 6px; white-space: pre-line; font-size: 14px; line-height: 20px; color: rgba(255,255,255,.72); }
.d-ads-cards-3 .d-ads-card p { margin-top: 8px; }
.d-ads-card p strong { color: #fff; font-weight: 600; }
.d-ads-cierre { max-width: 672px; margin: 56px auto 0; text-align: center; font-size: 20px; font-weight: 600; line-height: 28px; color: #fff; }
.d-ads-resalta { color: var(--action); }
/* el reporte */
.d-ads-pide { position: relative; display: block; margin: 0 auto; width: 48px; height: 48px; color: var(--forest); }
.d-ads-pide-p { position: absolute; left: 0; bottom: 0; }
.d-ads-pide-m { position: absolute; right: 0; top: 0; }
.d-ads-h2c { margin-top: 20px; font-size: 30px; font-weight: 700; line-height: 36px; color: var(--tinta); }
.d-ads-blanco .d-ads-lede { margin-top: 16px; }
.d-ads-reporte { margin-top: 40px; overflow: hidden; background: #fff; border: 1px solid var(--borde); border-radius: 10px; box-shadow: 0 24px 48px -16px rgba(10,28,61,.18); }
.d-ads-reporte-media { display: block; width: 100%; height: auto; }
.d-ads-reporte-media.d-ads-solo-sm { display: none; }
/* el agente de WhatsApp */
.d-ads-wa { display: grid; grid-template-columns: minmax(0, 1fr); gap: 48px; align-items: center; }
.d-ads-eyebrow { display: block; font-size: 12px; font-weight: 600; line-height: 16px; letter-spacing: .1em; text-transform: uppercase; color: var(--brand); }
.d-ads-wa-h2 { margin-top: 12px; }
.d-ads-wa-lede { max-width: 448px; }
.d-ads-chips { margin-top: 32px; display: flex; flex-direction: column; gap: 12px; }
.d-ads-chip { max-width: 448px; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; background: #fff; border: 1px solid var(--borde); box-shadow: var(--sombra-sm); font-size: 14px; font-weight: 500; line-height: 20px; color: var(--tinta); }
.d-ads-chip svg { flex: none; color: var(--action); }
.d-ads-tel-wrap { position: relative; width: 100%; max-width: 300px; margin: 0 auto; }
.d-ads-tel-wa { position: absolute; right: -12px; top: -12px; z-index: 1; width: 40px; height: 40px; border-radius: 999px; background: #25D366; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1); }
.d-ads-tel { padding: 12px; border-radius: 32px; background: var(--forest); box-shadow: var(--sombra-elegante); }
.d-ads-tel-in { overflow: hidden; border-radius: 24px; background: #ECE5DD; }
.d-ads-tel-media { display: block; width: 100%; height: auto; }
/* «Se conecta con»: la tira de 75 s de la referencia, a su misma velocidad (63 px por segundo) */
.d-ads-logos { position: relative; padding: 40px 0; background: var(--fog); border-top: 1px solid var(--borde); border-bottom: 1px solid var(--borde); }
.d-ads-logos-cab { margin-bottom: 24px; padding: 0 16px; display: flex; align-items: center; justify-content: center; gap: 12px; }
.d-ads-logos-t { font-size: 18px; font-weight: 600; line-height: 28px; color: var(--tinta); }
.d-ads-pausa-in { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.d-ads-pausa { width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: var(--tinta); cursor: pointer; transition: color .15s cubic-bezier(.4,0,.2,1), background-color .15s cubic-bezier(.4,0,.2,1); }
.d-ads-pausa:hover { background: var(--mist); color: var(--forest); }
.d-ads-pausa-in:focus-visible ~ .d-ads-logos-cab .d-ads-pausa { box-shadow: 0 0 0 1px var(--brand); }
.d-ads-i-play, .d-ads-pausa-in:checked ~ .d-ads-logos-cab .d-ads-i-pausa { display: none; }
.d-ads-pausa-in:checked ~ .d-ads-logos-cab .d-ads-i-play { display: block; }
.d-ads-ventana { overflow: hidden; }
.d-ads-pista { display: flex; width: max-content; animation: d-ads-tira 48s linear infinite; }
.d-ads-ventana:hover .d-ads-pista, .d-ads-pausa-in:checked ~ .d-ads-ventana .d-ads-pista { animation-play-state: paused; }
.d-ads-pista ul { display: flex; flex: none; align-items: center; gap: 12px; padding-right: 12px; }
.d-ads-pista li { flex: none; width: 176px; height: 112px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; background: #fff; border: 1px solid var(--borde); border-radius: 10px; box-shadow: var(--sombra-sm); }
.d-ads-pista img { display: block; width: 40px; height: 40px; object-fit: contain; }
.d-ads-pista span { font-size: 13px; font-weight: 600; line-height: 18px; color: var(--tinta); }
/* el pie (escondido: va el del sitio) */
.d-ads-foot { background: #fff; padding: 40px 0; }
.d-ads-foot-links { margin-top: 24px; display: flex; flex-wrap: wrap; gap: 10px 24px; font-size: 14px; line-height: 20px; color: var(--gris); }
.d-ads-foot-links a:hover, .d-ads-foot-bottom a:hover { color: var(--action); }
.d-ads-foot-bottom { margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--borde); display: flex; flex-direction: column; align-items: flex-start; gap: 16px; font-size: 14px; line-height: 20px; color: var(--gris); }
.d-ads-foot-bottom div { display: flex; gap: 16px; }

@keyframes d-ads-respira { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(47,111,237,.35); } 45% { transform: scale(1.1); box-shadow: 0 0 0 12px rgba(47,111,237,0); } }
@keyframes d-ads-luz { 0%, 25%, 100% { background-color: var(--bgc); color: var(--tinta); border-color: var(--borde); } 5%, 20% { background-color: var(--action); color: #fff; border-color: var(--action); } }
@keyframes d-ads-tira { to { transform: translateX(-50%); } }

/* sm (640) */
@media (min-width: 640px) {
  .d-ads-wrap, .d-ads-hero-in { padding-left: 24px; padding-right: 24px; }
  .d-ads-navin { padding: 0 24px; gap: 12px; }
  .d-ads-navright { gap: 12px; }
  .d-ads-pill { padding: 10px 20px; font-size: 14px; line-height: 20px; }
  .d-ads-h1 { font-size: 48px; line-height: 48px; }
  .d-ads-hero-p, .d-ads-lede { font-size: 18px; line-height: 28px; }
  .d-ads-opciones { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .d-ads-h2 { font-size: 36px; line-height: 40px; }
  .d-ads-h2c { font-size: 36px; line-height: 40px; }
  .d-ads-cards-5 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .d-ads-marco-tel { max-width: 300px; }
  .d-ads-reporte-media.d-ads-solo-sm { display: block; }
  .d-ads-reporte-media.d-ads-solo-chico { display: none; }
  .d-ads-cierre { font-size: 24px; line-height: 32px; }
  .d-ads-foot-bottom { flex-direction: row; align-items: center; justify-content: space-between; }
}
/* md (768) */
@media (min-width: 768px) {
  .d-ads-hero-in { padding-top: 96px; padding-bottom: 96px; }
  .d-ads-sec { padding: 96px 0; }
  .d-ads-dos { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .d-ads-dos-txt { text-align: left; }
  .d-ads-dos-txt .d-ads-lede { margin-left: 0; margin-right: 0; }
  .d-ads-wa { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .d-ads-cards-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
/* lg (1024) */
@media (min-width: 1024px) {
  .d-ads-h1 { font-size: 60px; line-height: 60px; }
  .d-ads-h2 { font-size: 48px; line-height: 48px; }
  .d-ads-dos { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 32px; }
  .d-ads-marco { max-width: none; }
  .d-ads-solo-ancho { display: block; }
  .d-ads-solo-angosto { display: none; }
  .d-ads-cards-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .d-ads *, .d-ads *::before, .d-ads *::after { animation: none !important; transition: none !important; }
  .d-ads-ventana { overflow-x: auto; }
  .d-ads-pista > ul[aria-hidden="true"], .d-ads-pista .d-ads-dup, .d-ads-logos-cab .d-ads-pausa { display: none; }
}
`;
