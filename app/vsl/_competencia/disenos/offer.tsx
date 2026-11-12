// =============================================================================
// /vsl/offer con el DISEÑO de su referencia: «The Offer Creation Formula + Atlas AI» de Done For You (11/11/2026)
// =============================================================================
// Copiado de https://go.doneforyou.com/offer-formula, medido con Chromium a 1440 y a 390 px el 11/11/2026 (los valores,
// en docs/diseno/landings-competencia/offer.md). Es una página de GoHighLevel: barra blanca de 77 px con el logo a la
// izquierda y los links a la derecha; el hero NEGRO con la cejilla de color, el titular en itálica de 45 px, la bajada de
// 25 px y dos columnas (el video de 730 px y la tarjeta blanca de 360 px con el botón); la tarjeta blanca de 1140 px sobre
// gris #F0F2F5 con su titular de 50 px y los párrafos de 22 px; la banda gris oscura #4B4B4B con «Here's Everything You're
// Getting» y su grilla de 3 × 2 tarjetas negras con borde de color; la sección blanca de su garantía (columna de 749 px) y
// la banda final con el botón. Letra: Roboto (títulos y botones), Raleway (textos) y Caveat (el link a mano del hero), las
// mismas de la referencia, bajadas de Google Fonts a /vsl-assets/fuentes/. Su tarjeta de precio usaba Montserrat 15 px:
// aquí ese renglón va en Raleway, para no cargar una cuarta familia.
//
// De MaKo: el logo, el azul de los botones (donde la referencia usa su amarillo), el dorado de la cejilla y de los bordes
// de las tarjetas (su amarillo), el azul oscuro de su titular violeta, el botón de la llamada y el caso de Mauricio.
//
// Lo que se sacó de la referencia, y por qué:
//   · La franja violeta «Make Sure Your Sound Is Turned ON!» y el párrafo de debajo del video: son de su VSL, que Offer no
//     tiene. En el cuadro del video va el visual de Offer, con el mismo encuadre (730 × 411, 16:9).
//   · Su tarjeta de precio («Only $147 FREE», «7 días gratis», «$97 al mes»), sus estrellas y su «4.7 / 5 de 398 alumnos»:
//     en esa tarjeta quedan los dos renglones del hero (sus cifras salen del código) y el botón de la llamada.
//   · Sus franjas amarillas del cupón («34% OFF»), la imagen del paquete de 900 × 550, el subtítulo «Inside The Offer
//     Creation Formula…» y el «INSTANT ACCESS | INCLUDED» de cada tarjeta: son de su producto y de su precio. La imagen de
//     cada tarjeta (la caja de su producto, 200 × 250) es aquí el ícono de la pieza en un cuadro del mismo tamaño.
//   · Su garantía de 30 días: en esa sección (el sello, el titular de 36 px y los párrafos) va el caso de Mauricio, con su
//     video donde iba el sello.
//   · Su página no tiene pie: el de MaKo (el resto de las funciones) copia su barra de arriba, con los links en Roboto 20 px.
// Server component sin JavaScript: todo es CSS, y sin animaciones (la referencia no tiene, ni al pasar el cursor).
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, MAKO, TEXTO_CTA, html, otrasFunciones } from '../marca';
import { VisualDeLanding } from '../Visuales';

const F = '/vsl-assets/fuentes';

const CSS = `
@font-face { font-family: 'D Offer Roboto'; src: url('${F}/roboto/roboto-latin-var.woff2') format('woff2'); font-weight: 400 900; font-style: normal; font-display: swap; }
@font-face { font-family: 'D Offer Roboto'; src: url('${F}/roboto/roboto-latin-900-italic.woff2') format('woff2'); font-weight: 900; font-style: italic; font-display: swap; }
@font-face { font-family: 'D Offer Raleway'; src: url('${F}/raleway/raleway-latin-var.woff2') format('woff2'); font-weight: 400 900; font-style: normal; font-display: swap; }
@font-face { font-family: 'D Offer Caveat'; src: url('${F}/caveat/caveat-latin-700.woff2') format('woff2'); font-weight: 700; font-style: normal; font-display: swap; }

.d-offer-raiz { --d-offer-roboto: 'D Offer Roboto', Roboto, Arial, sans-serif; --d-offer-raleway: 'D Offer Raleway', Raleway, Arial, sans-serif;
  background: #fff; color: #000; font-family: var(--d-offer-raleway); font-size: 16px; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
.d-offer-raiz *, .d-offer-raiz *::before, .d-offer-raiz *::after { box-sizing: border-box; }
.d-offer-raiz a { text-decoration: none; }
.d-offer-raiz :where(p, h1, h2, h3, ul) { margin: 0; }

/* La barra: blanca, 75 px + 2 px, el logo a la izquierda y los links a la derecha (Roboto 20 px, 5 px 21 px). */
.d-offer-nav { background: #fff; padding-bottom: 2px; }
.d-offer-nav-in { max-width: 1100px; height: 75px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
.d-offer-logo { font-family: var(--d-offer-roboto); }
.d-offer-links { display: flex; align-items: center; list-style: none; margin: 0; padding: 0; }
.d-offer-links a { display: flex; padding: 5px 21px; font-family: var(--d-offer-roboto); font-size: 20px; font-weight: 400; color: #000; transition: background-color .3s; }

/* El hero: negro, 20 px arriba y 10 abajo. */
.d-offer-hero { background: #000; padding: 20px 0 10px; }
.d-offer-cejilla { width: 971px; max-width: calc(100% - 20px); margin: 0 auto; padding: 5px; background: ${MAKO.dorado}; text-align: center;
  font-family: var(--d-offer-raleway); font-size: 33px; line-height: 33px; font-weight: 900; letter-spacing: -1px; color: #000; }
.d-offer-h1 { max-width: 1120px; margin: 25px auto 0; text-align: center; font-family: var(--d-offer-roboto); font-size: 45px; line-height: 45px;
  font-weight: 900; font-style: italic; letter-spacing: -1px; color: #fff; }
.d-offer-sub { max-width: 1120px; margin: 10px auto 0; text-align: center; font-family: var(--d-offer-raleway); font-size: 25px; line-height: 32.5px;
  font-weight: 700; color: #fff; }
.d-offer-sub strong { font-weight: 700; }
.d-offer-fila { width: 1130px; max-width: calc(100% - 20px); margin: 25px auto 21px; display: flex; gap: 40px; align-items: stretch; }
.d-offer-izq { flex: 0 0 730px; min-width: 0; }
.d-offer-video { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #F0F2F5; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.d-offer-video-in { width: 480px; zoom: 1.32; font-family: var(--d-offer-raleway); }
.d-offer-amano { display: block; margin: 40px 0 0; text-align: center; font-family: 'D Offer Caveat', Caveat, cursive; font-size: 60px; line-height: 60px;
  font-weight: 700; letter-spacing: -1px; color: #fff; }
.d-offer-tarjeta { flex: 0 0 360px; display: flex; flex-direction: column; align-items: center; padding: 30px 15px 10px; background: #fff; border-radius: 5px;
  border: 1px solid rgba(57, 117, 234, 0); box-shadow: rgba(0, 0, 0, .2) 0 1px 5px 0; }
.d-offer-tarjeta-h { padding: 5px; text-align: center; font-family: var(--d-offer-roboto); font-size: 22px; line-height: 22px; font-weight: 900;
  letter-spacing: -1px; color: #161616; }
.d-offer-tarjeta-p { margin-top: 10px; text-align: center; font-family: var(--d-offer-raleway); font-size: 15px; line-height: 16px; color: #000; }

/* Los botones: el amarillo de la referencia es aquí el azul de MaKo (Roboto 24 px 700, -1 px, 58 px de alto, sin radio). */
.d-offer-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 58px; padding: 5px 25px; background: ${MAKO.azul};
  font-family: var(--d-offer-roboto); font-size: 24px; line-height: 28px; font-weight: 700; letter-spacing: -1px; text-transform: uppercase; color: #fff; text-align: center; }
.d-offer-btn svg { flex: none; }
.d-offer-tarjeta .d-offer-btn { width: 312px; max-width: 100%; margin-top: 10px; }

/* La tarjeta blanca de 1140 px sobre el gris #F0F2F5. */
.d-offer-gris { background: #F0F2F5; padding: 20px 0 10px; }
.d-offer-carta { width: 1140px; max-width: calc(100% - 20px); margin: 20px auto 21px; padding: 25px; background: #fff; border: 1px solid rgba(219, 219, 219, .7);
  border-radius: 5px; box-shadow: rgba(0, 0, 0, .05) 0 1px 3px 0; }
.d-offer-carta-h { text-align: center; font-family: var(--d-offer-roboto); font-size: 50px; line-height: 50px; font-weight: 900; letter-spacing: -1px; color: ${MAKO.azulOscuro}; }
.d-offer-texto { font-family: var(--d-offer-raleway); font-size: 22px; line-height: 28.6px; font-weight: 500; color: #000; }
.d-offer-carta .d-offer-texto { margin-top: 20px; }
.d-offer-carta .d-offer-texto + .d-offer-texto { margin-top: 28.6px; }
.d-offer-lista { list-style: none; margin: 10px 0 0; padding: 0 0 0 33px; }
.d-offer-lista li { padding-left: 11px; font-family: var(--d-offer-raleway); font-size: 22px; line-height: 44px; font-weight: 400; color: #000; }

/* La banda gris oscura con la grilla de 3 × 2. */
.d-offer-oscura { background: #4B4B4B; padding: 70px 0 60px; }
.d-offer-oscura-h { max-width: 1130px; margin: 0 auto; padding: 0 10px; text-align: center; font-family: var(--d-offer-roboto); font-size: 56px; line-height: 67.2px;
  font-weight: 700; letter-spacing: -1px; color: #fff; }
.d-offer-oscura-p { max-width: 1130px; margin: 20px auto 0; padding: 0 10px; text-align: center; font-family: var(--d-offer-raleway); font-size: 22px;
  line-height: 28.6px; font-weight: 500; color: #fff; }
.d-offer-grilla { width: 849px; max-width: calc(100% - 20px); margin: 45px auto 0; display: grid; grid-template-columns: repeat(3, 263px); gap: 30px; }
.d-offer-pieza { display: flex; flex-direction: column; align-items: center; padding: 10px 5px 21px; background: #161716; border: 1px solid ${MAKO.dorado}; border-radius: 4px; }
.d-offer-pieza-img { width: 200px; height: 250px; margin-top: 11px; display: flex; align-items: center; justify-content: center; color: #fff;
  background: linear-gradient(160deg, ${MAKO.azul} 0%, ${MAKO.azulOscuro} 100%); }
.d-offer-pieza-h { margin-top: 10px; padding: 0 5px; text-align: center; font-family: var(--d-offer-raleway); font-size: 22px; line-height: 28.6px; font-weight: 700; color: #fff; }
.d-offer-pieza-p { margin-top: 10px; padding: 0 5px; text-align: center; font-family: var(--d-offer-raleway); font-size: 16px; line-height: 20.8px; font-weight: 500; color: #fff; }
.d-offer-pieza-p strong { font-weight: 700; }
.d-offer-ancho { display: flex; width: 1130px; max-width: calc(100% - 20px); margin: 55px auto 0; }
.d-offer-ancho .d-offer-btn { flex: 1; }

/* La sección blanca de su garantía, con el caso de Mauricio. */
.d-offer-caso { background: #fff; padding: 40px 0 20px; }
.d-offer-caso-video { display: block; width: 200px; aspect-ratio: 9 / 16; margin: 0 auto; object-fit: cover; background: #000; }
.d-offer-caso-h { max-width: 749px; margin: 50px auto 0; text-align: center; font-family: var(--d-offer-roboto); font-size: 36px; line-height: 36px; font-weight: 900;
  letter-spacing: -1px; color: #000; }
.d-offer-caso-col { max-width: 749px; margin: 36px auto 0; box-shadow: rgba(0, 0, 0, .05) 0 1px 3px 0; }
.d-offer-caso-col .d-offer-texto + .d-offer-texto { margin-top: 28.6px; }
.d-offer-caso-col strong { font-weight: 700; }

/* La banda final. */
.d-offer-final { background: #4B4B4B; padding: 70px 10px 70px; text-align: center; }
.d-offer-final-h { max-width: 1130px; margin: 0 auto; font-family: var(--d-offer-roboto); font-size: 42px; line-height: 50.4px; font-weight: 500; letter-spacing: -1px; color: #fff; }
.d-offer-final .d-offer-btn { width: 312px; max-width: 100%; margin-top: 10px; }

/* El pie de MaKo, con la forma de su barra de arriba. */
.d-offer-pie { background: #fff; border-top: 1px solid #E6E8EC; padding: 24px 0 28px; }
.d-offer-pie-in { max-width: 1100px; margin: 0 auto; padding: 0 10px; display: flex; align-items: flex-start; gap: 24px; }
.d-offer-pie-in .d-offer-links { flex: 1; flex-wrap: wrap; justify-content: flex-end; }
.d-offer-pie-in .d-offer-links a { font-size: 18px; }

@media (max-width: 1160px) {
  .d-offer-fila { flex-direction: column; align-items: center; }
  .d-offer-izq, .d-offer-tarjeta { flex: none; width: 100%; max-width: 730px; }
}
@media (max-width: 900px) {
  .d-offer-grilla { grid-template-columns: 1fr; gap: 0; width: 370px; }
}
/* A 390 px (la referencia corta a 768 px): barra de 40 px sin links, hero en una columna, todo a 370 px con 10 de margen. */
@media (max-width: 767px) {
  .d-offer-nav-in { height: 40px; padding: 0 10px; }
  .d-offer-nav .d-offer-links { display: none; }
  .d-offer-cejilla { width: 370px; font-size: 17px; line-height: 17px; }
  .d-offer-h1 { padding: 0 10px; font-size: 32px; line-height: 32px; }
  .d-offer-sub { padding: 0 10px; }
  .d-offer-fila { width: 370px; gap: 10px; margin-bottom: 20px; }
  .d-offer-video-in { zoom: .74; }
  .d-offer-amano { display: none; }
  .d-offer-tarjeta { padding: 16px 0 10px; }
  .d-offer-carta { width: 370px; padding: 25px 10px; }
  .d-offer-carta-h { font-size: 32px; line-height: 32px; }
  .d-offer-oscura-h { font-size: 32px; line-height: 38.4px; }
  .d-offer-pieza { padding: 10px 0 21px; }
  .d-offer-ancho { width: 370px; margin-top: 50px; }
  .d-offer-caso-h { padding: 0 10px; font-size: 28px; line-height: 28px; }
  .d-offer-caso-col { margin: 28px 10px 0; }
  .d-offer-final { padding: 70px 10px; }
  .d-offer-final-h { font-size: 32px; line-height: 38.4px; }
  .d-offer-pie-in { flex-direction: column; align-items: center; }
  .d-offer-pie-in .d-offer-links { justify-content: center; }
  .d-offer-pie-in .d-offer-links a { font-size: 16px; padding: 4px 12px; }
}
`;

/** La flecha de sus botones («➧»), dibujada para que no dependa de la fuente. */
const Flecha = () => (
  <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><path d="M2 1.5 12.5 9 2 16.5 4.5 9Z" fill="currentColor" /></svg>
);

function Boton({ className = '' }: { className?: string }) {
  return <a href={RUTA_CTA} className={['d-offer-btn', className].filter(Boolean).join(' ')}>{TEXTO_CTA}<Flecha /></a>;
}

function Icono({ paths }: { paths?: string[] }) {
  return (
    <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(paths ?? []).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;

/** Las secciones, en el orden de la landing. El «sin / con» abre la tarjeta blanca y la lista que lo sigue va adentro. */
function secciones(bloques: Bloque[]) {
  const out: ReactNode[] = [];
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    const k = `b${i}`;
    switch (b.tipo) {
      case 'hero':
        out.push(
          <section key={k} className="d-offer-hero">
            <p className="d-offer-cejilla" dangerouslySetInnerHTML={html(b.etiqueta)} />
            <h1 className="d-offer-h1" dangerouslySetInnerHTML={html(b.titulo)} />
            <h2 className="d-offer-sub" dangerouslySetInnerHTML={html(b.bajada)} />
            <div className="d-offer-fila">
              <div className="d-offer-izq">
                <div className="d-offer-video"><div className="d-offer-video-in"><VisualDeLanding visual={b.visual} /></div></div>
                <a href={RUTA_CTA} className="d-offer-amano">{TEXTO_CTA} &gt;&gt;</a>
              </div>
              <div className="d-offer-tarjeta">
                {b.puntos?.[0] && <p className="d-offer-tarjeta-h" dangerouslySetInnerHTML={html(b.puntos[0])} />}
                {b.puntos?.slice(1).map((p, j) => <p key={j} className="d-offer-tarjeta-p" dangerouslySetInnerHTML={html(p)} />)}
                <Boton />
              </div>
            </div>
          </section>,
        );
        break;
      case 'contraste': {
        const sigue = bloques[i + 1];
        const lista = sigue && sigue.tipo === 'tarjetas' && !sigue.fondo ? (sigue as Tarjetas) : null;
        out.push(
          <section key={k} className="d-offer-gris">
            <div className="d-offer-carta">
              <h2 className="d-offer-carta-h" dangerouslySetInnerHTML={html(b.titulo)} />
              <p className="d-offer-texto"><span dangerouslySetInnerHTML={html(b.sin.titulo)} /> <span dangerouslySetInnerHTML={html(b.sin.texto)} /></p>
              <p className="d-offer-texto"><span dangerouslySetInnerHTML={html(b.con.titulo)} /> <span dangerouslySetInnerHTML={html(b.con.texto)} /></p>
              {lista && (
                <>
                  <p className="d-offer-texto" dangerouslySetInnerHTML={html(lista.titulo)} />
                  <ul className="d-offer-lista">
                    {lista.items.map((it, j) => <li key={j}><span dangerouslySetInnerHTML={html(it.titulo)} /> — <span dangerouslySetInnerHTML={html(it.texto)} /></li>)}
                  </ul>
                </>
              )}
            </div>
            {b.cta && <div className="d-offer-ancho"><Boton className="d-offer-btn-ancho" /></div>}
          </section>,
        );
        if (lista) i++;
        break;
      }
      case 'tarjetas':
        out.push(
          <section key={k} className="d-offer-oscura">
            <h2 className="d-offer-oscura-h" dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada && <p className="d-offer-oscura-p" dangerouslySetInnerHTML={html(b.bajada)} />}
            <div className="d-offer-grilla">
              {b.items.map((it, j) => (
                <div key={j} className="d-offer-pieza">
                  <div className="d-offer-pieza-img"><Icono paths={it.icono} /></div>
                  <p className="d-offer-pieza-h" dangerouslySetInnerHTML={html(it.titulo)} />
                  <p className="d-offer-pieza-p" dangerouslySetInnerHTML={html(it.texto)} />
                </div>
              ))}
            </div>
            {b.cta && <div className="d-offer-ancho"><Boton className="d-offer-btn-ancho" /></div>}
          </section>,
        );
        break;
      case 'caso':
        out.push(
          <section key={k} className="d-offer-caso">
            <video className="d-offer-caso-video" muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en un escenario`}>
              <source src={CASO.video} type="video/mp4" />
            </video>
            <h2 className="d-offer-caso-h" dangerouslySetInnerHTML={html(CASO.titulo)} />
            <div className="d-offer-caso-col">
              {CASO.historia.map((h, j) => <p key={j} className="d-offer-texto" dangerouslySetInnerHTML={html(h)} />)}
              <p className="d-offer-texto" dangerouslySetInnerHTML={html(CASO.resultado)} />
              <p className="d-offer-texto"><strong>{CASO.quien}</strong> · {CASO.rol}.</p>
              <p className="d-offer-texto">{CASO.sub}</p>
            </div>
          </section>,
        );
        break;
      default:
        // Esta landing no tiene otros tipos de bloque; si se suman, se dibujan como un párrafo de su tarjeta blanca.
        out.push(
          <section key={k} className="d-offer-gris">
            <div className="d-offer-carta"><h2 className="d-offer-carta-h" dangerouslySetInnerHTML={html('titulo' in b && b.titulo ? b.titulo : '')} /></div>
          </section>,
        );
    }
  }
  return out;
}

export default function DisenoOffer({ landing }: PropsDiseno) {
  const otras = otrasFunciones(landing.slug);
  return (
    <div className="d-offer-raiz">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="d-offer-nav">
        <div className="d-offer-nav-in">
          <LogoMaKo className="d-offer-logo" tamano={34} />
          <ul className="d-offer-links">
            <li><a href="#d-offer-funciones">Funciones</a></li>
            <li><a href={RUTA_CTA}>{TEXTO_CTA}</a></li>
          </ul>
        </div>
      </header>
      <main>
        {secciones(landing.bloques)}
        <section className="d-offer-final">
          <h2 className="d-offer-final-h">{landing.metaTitle}</h2>
          <Boton />
        </section>
      </main>
      <footer className="d-offer-pie" id="d-offer-funciones">
        <div className="d-offer-pie-in">
          <LogoMaKo className="d-offer-logo" tamano={30} />
          <ul className="d-offer-links" aria-label="Las otras funciones de MaKo">
            {otras.map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}
          </ul>
        </div>
      </footer>
    </div>
  );
}
