// =============================================================================
// /vsl/closing con el DISEÑO de la página de AI Call Scoring de Hyperbound (https://www.hyperbound.ai/uses/ai-call-scoring)
// =============================================================================
// Leída el 16/11/2026 con el navegador del panel, a 1440 y a 390 px; los valores son los MEDIDOS (getComputedStyle), no a ojo:
//   · la página: fondo #202020, tinta #E9E9E4, gris #BEBEB8, filetes de 0,8 px #50504C, la grilla del muro #383835; gutter 44 px
//     (18 px en el teléfono). Geist para el texto y Geist Mono en MAYÚSCULAS para los títulos (las dos de Vercel, OFL 1.1: los
//     woff2 salen de los que trae Next, node_modules/next/dist/next-devtools/server/font/, y viven en public/vsl-assets/fuentes/).
//   · el hero: 67 px arriba y 48 abajo; el H1 en mono 64,8/73,2 con −2,5 px (34,75 px en el teléfono); la bajada 16/25,6 en
//     494 px; el botón de 40 px, sin radio. Debajo, su muro de logos: 8 columnas (4 en el teléfono) de 90 px (66) con 1 px de grilla.
//   · cada sección abre con un filete arriba (26 px de aire) y su H2 en mono 32/37,8 con −1,6 px (29 px en el teléfono); 94 px
//     entre secciones; los problemas en 3 columnas con 43 px y su filete; las filas: texto 497 y figura 746 (7 % de aire), 38 px
//     bajo su filete, alternadas, la cejilla en mono 10/16 con 1,3 px, el H3 en mono 24/30 con −1,08 px, el párrafo 14/24,5 en
//     413 px y tres tildes; la figura con su borde de 0,8 px sobre blanco.
//   · las preguntas: 501 + 702 con 134 px, cada una en mono 12/19,2 con 0,96 px y su «+»; el cierre: 92 px arriba y 100 abajo,
//     el H2 en mono 39/44,5 y los botones de 45 px con su flecha.
// De MaKo lleva sólo lo de ../marca.tsx: el logo, el botón para empezar (en el azul de MaKo: los colores de marca van en los
// botones) y los links al resto de las funciones en el pie copiado (que el sitio oculta: va el suyo, PieGlobal).
// Lo que NO se copió: su muro de logos de clientes y su sello de G2 (MaKo no tiene esos clientes: en la grilla va lo que trae cada
// llamada, contado del código), su segundo botón («Try free demo»: no hay una demo), su arte de hilos del cierre (es suyo) y su
// menú (va la barra del sitio, BarraGlobal; la copiada se oculta por su clase, BARRA_PROPIA de ../TemaSitio.tsx).
// Sus capturas de producto: la hoja Closing del Dashboard (números de ejemplo) y los grabadores, sí; las tres de lo que ESCRIBE el
// análisis (el puntaje con sus notas, el coaching y las objeciones) son animaciones con llamadas REALES de Mauricio, sólo sus notas
// (app/vsl/_sitio/ClosingNotas.tsx y ClosingAntesDespues.tsx; la regla de Martín del 12/11 y el 13/11/2026: lo que escribe la IA no
// se inventa).
// Server component sin JS: las preguntas son <details>. Las figuras van con data-tema-fijo: son capturas sobre blanco, como las suyas,
// y el sol y la luna no las toca.
// =============================================================================

import type { ReactNode } from 'react';
import type { Bloque } from '../tipos';
import type { PropsDiseno } from './index';
import { RUTA_CTA, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';
import { GRABADORES_CLOSING, TITULO_CIERRE_CLOSING } from '../closing';
import { ClosingAntesDespues } from '../../_sitio/ClosingAntesDespues';
import { ClosingCoaching, ClosingPuntaje } from '../../_sitio/ClosingNotas';

const P = 'd-closing';

/** Las fotos de la hoja Closing del Dashboard (la tasa del período y la de cada closer): números y nombres ficticios de los datos de
 *  ejemplo de la hoja, sin una palabra escrita por la IA (banco C:/dev/bancos-portada/banco-closing-landing: fotos.mjs --solo-hoja).
 *  ⚠️ La ficha de una llamada (el puntaje con sus notas y citas, el coaching y las objeciones) NO va en foto: lo escribe el análisis, y
 *  la que había era una llamada INVENTADA. Van las animaciones con las llamadas reales de Mauricio (`FIGURAS_FILAS`). */
export const FOTOS_CLOSING = {
  tasa: { src: '/vsl-assets/closing/hoja-tasa.jpg', w: 1412, h: 480, alt: 'La hoja Closing del Dashboard: la tasa de cierre del período y cuántas llamadas cerraron' },
  closers: { src: '/vsl-assets/closing/hoja-closers.jpg', w: 1002, h: 344, alt: 'La tasa de cierre de cada closer, de la más alta a la más baja' },
} as const;

/** El logo de cada grabador que se conecta (GRABADORES_CLOSING, de lib/grabadores/catalogo.ts): los que ya están en public/. */
export const LOGO_GRABADOR: Readonly<Record<string, string>> = {
  'Fathom': '/vsl-assets/logos/integraciones/fathom.png',
  'tl;dv': '/logos/tldv.svg',
  'Fireflies.ai': '/logos/fireflies.svg',
  'Zoom': '/vsl-assets/logos/integraciones/zoom.svg',
  'Otter.ai': '/logos/otter.png',
};

/** La figura de cada fila de «De cada llamada a tu próximo cierre», en su orden (una por fila, como las suyas). Las tres primeras son
 *  lo que escribe el análisis, con llamadas REALES de Mauricio (16/11/2026; Martín: «utiliza de las que tenemos grabadas ahí con
 *  Mauricio»), sólo sus notas y las categorías de sus objeciones, sin frases ni nombres: la nota de una llamada y sus siete
 *  dimensiones (ClosingPuntaje), el coaching de esa llamada y cómo quedó la de un mes después (ClosingCoaching), y la llamada como en
 *  Google Meet con sus objeciones, respondidas o no (la de la portada, sólo la llamada). */
export const FIGURAS_FILAS = ['puntaje', 'coaching', 'objeciones', 'hoja', 'grabadores'] as const;
/** Las tres animaciones de lo que escribe el análisis, en su caja 16:10. */
const ANIMACION_FILA = {
  puntaje: <ClosingPuntaje />,
  coaching: <ClosingCoaching />,
  objeciones: <ClosingAntesDespues soloLlamada />,
} as const;

const CSS = `
@font-face{font-family:'d-closing-sans';src:url('/vsl-assets/fuentes/geist/geist-latin-var.woff2') format('woff2');font-weight:400 600;font-style:normal;font-display:swap}
@font-face{font-family:'d-closing-mono';src:url('/vsl-assets/fuentes/geist-mono/geist-mono-latin-var.woff2') format('woff2');font-weight:400 600;font-style:normal;font-display:swap}
.d-closing-raiz{--dc-fondo:#202020;--dc-tinta:#E9E9E4;--dc-gris:#BEBEB8;--dc-filete:#50504C;--dc-grilla:#383835;--dc-mono:'d-closing-mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  background:var(--dc-fondo);color:var(--dc-tinta);font-family:'d-closing-sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:clip}
.d-closing-raiz *,.d-closing-raiz *::before,.d-closing-raiz *::after{box-sizing:border-box}
.d-closing-in{max-width:1600px;margin:0 auto;padding:0 44px}
.d-closing-oculto{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.d-closing-nav{height:80px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.d-closing-nav ul{list-style:none;margin:0;padding:0;display:flex;align-items:center;gap:28px}
.d-closing-nav a{color:var(--dc-tinta);text-decoration:none;font-family:var(--dc-mono);font-size:10px;letter-spacing:.04em;text-transform:uppercase}
.d-closing-mono{font-family:var(--dc-mono);font-weight:400;text-transform:uppercase}
.d-closing-hero{padding:67px 0 48px;display:grid;gap:24px}
.d-closing-h1{margin:0;font-family:var(--dc-mono);font-weight:400;font-size:64.8px;line-height:1.13;letter-spacing:-.0386em;text-transform:uppercase;text-wrap:balance}
.d-closing-aparte{display:grid;gap:23px;margin-top:8px}
.d-closing-lead{margin:0;max-width:494px;font-size:16px;line-height:1.6;color:var(--dc-gris)}
.d-closing-acciones{display:flex;flex-wrap:wrap;gap:9px}
.d-closing-btn{display:inline-flex;align-items:center;gap:9px;height:40px;padding:0 14px;border:.8px solid #2F6FED;background:#2F6FED;color:#fff;font-family:var(--dc-mono);font-size:10px;font-weight:450;line-height:1.3;letter-spacing:.025em;text-transform:uppercase;text-decoration:none;transition:background .2s,border-color .2s}
.d-closing-btn:hover{background:#1F57C8;border-color:#1F57C8}
.d-closing-btn svg{width:19px;height:19px;flex:none}
.d-closing-muro-sec{padding-top:58px}
.d-closing-muro{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:1px;background:var(--dc-grilla);border:.8px solid var(--dc-grilla)}
.d-closing-muro li{background:var(--dc-fondo);min-height:90px;padding:26px 18px;display:flex;align-items:center;justify-content:center;text-align:center;font-family:var(--dc-mono);font-size:11px;line-height:1.4;letter-spacing:.06em;text-transform:uppercase;color:var(--dc-tinta);overflow-wrap:anywhere}
.d-closing-sec{margin-top:94px}
.d-closing-intro{border-top:.8px solid var(--dc-filete);padding-top:26px;display:flex;gap:50px}
.d-closing-h2{margin:0;max-width:915px;font-family:var(--dc-mono);font-weight:400;font-size:32px;line-height:1.18;letter-spacing:-.05em;text-transform:uppercase;text-wrap:balance}
.d-closing-problemas{list-style:none;margin:56px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:43px}
.d-closing-problemas li{border-top:.8px solid var(--dc-filete);padding-top:24px}
.d-closing-problemas p{margin:0;max-width:365px;font-size:16px;line-height:1.6;color:var(--dc-tinta)}
.d-closing-filas{display:grid;gap:94px;margin-top:56px}
.d-closing-fila{border-top:.8px solid var(--dc-filete);padding-top:38px;display:grid;grid-template-columns:minmax(0,497fr) minmax(0,746fr);column-gap:7%;align-items:center}
.d-closing-fila.d-closing-vuelta{grid-template-columns:minmax(0,746fr) minmax(0,497fr)}
.d-closing-fila.d-closing-vuelta .d-closing-copia{order:2}
.d-closing-ceja{margin:0;font-family:var(--dc-mono);font-size:10px;line-height:16px;letter-spacing:.13em;text-transform:uppercase;color:var(--dc-gris)}
.d-closing-h3{margin:14px 0 0;font-family:var(--dc-mono);font-weight:400;font-size:24px;line-height:1.25;letter-spacing:-.045em;text-transform:uppercase}
.d-closing-p{margin:18px 0 0;max-width:413px;font-size:14px;line-height:1.75;color:var(--dc-gris)}
.d-closing-tildes{list-style:none;margin:18px 0 0;padding:0;max-width:413px}
.d-closing-tildes li{display:flex;gap:10px;font-size:14px;line-height:1.75;color:var(--dc-gris)}
.d-closing-tildes li+li{margin-top:6px}
.d-closing-tildes svg{flex:none;width:15px;height:15px;margin-top:4.2px;color:var(--dc-tinta)}
.d-closing-figura{margin:0;border:.8px solid var(--dc-filete);background:#fff;padding:28px}
.d-closing-figura img{display:block;width:100%;height:auto}
.d-closing-anim{position:relative;padding:0;aspect-ratio:16/10;overflow:hidden}
@media (max-width:767px){.d-closing-anim:not([data-animacion="objeciones"]){aspect-ratio:4/3}}
.d-closing-hoja{background:#F4F3EF;display:grid;gap:14px}
.d-closing-hoja img:last-child{width:71%}
.d-closing-graba{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.d-closing-tile{border:1px solid #E4E3DE;border-radius:14px;padding:22px 14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:128px;text-align:center;color:#12151B;font-size:14px;font-weight:500;line-height:1.3}
.d-closing-tile img{width:auto!important;height:40px!important;max-width:120px;object-fit:contain}
.d-closing-tile-mako{background:#12151B;color:#fff;border-color:#12151B}
.d-closing-estrella{width:40px;height:40px;border-radius:11px;background:#1A1712;display:inline-flex;align-items:center;justify-content:center}
.d-closing-faq{border-top:.8px solid var(--dc-filete);padding-top:38px;display:grid;grid-template-columns:minmax(0,501fr) minmax(0,702fr);column-gap:134px}
.d-closing-faq .d-closing-h2{margin-top:18px}
.d-closing-preg{border-bottom:.8px solid var(--dc-filete)}
.d-closing-preg summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:21px 0;font-family:var(--dc-mono);font-size:12px;line-height:1.6;letter-spacing:.08em;text-transform:uppercase}
.d-closing-preg summary::-webkit-details-marker{display:none}
.d-closing-mas{flex:none;font-size:21px;font-weight:300;line-height:1.6;transition:transform .2s}
.d-closing-preg[open] .d-closing-mas{transform:rotate(45deg)}
.d-closing-resp{margin:0;padding:0 32px 23px 0;font-size:13px;line-height:1.75;color:var(--dc-gris)}
.d-closing-resp a{color:inherit}
.d-closing-cierre{margin-top:90px;padding:92px 0 100px}
.d-closing-cierre-h{margin:0;max-width:588px;font-family:var(--dc-mono);font-weight:400;font-size:39px;line-height:1.14;letter-spacing:-.055em;text-transform:uppercase}
.d-closing-cierre .d-closing-acciones{margin-top:26px}
.d-closing-cierre .d-closing-btn{height:45px;padding:0 18px;gap:18px}
.d-closing-chico{margin:16px 0 0;max-width:588px;font-size:13px;line-height:1.6;color:var(--dc-gris)}
.d-closing-pie{padding:40px 0;border-top:.8px solid var(--dc-filete)}
.d-closing-pie ul{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:10px 22px}
.d-closing-pie a{color:var(--dc-gris);font-size:13px;text-decoration:none}
@media (max-width:991px){
  .d-closing-h1{font-size:48px}
  .d-closing-muro{grid-template-columns:repeat(4,minmax(0,1fr))}
  .d-closing-faq{column-gap:56px}
}
@media (max-width:767px){
  .d-closing-in{padding:0 18px}
  .d-closing-nav ul li:not(:last-child){display:none}
  .d-closing-hero{padding:34px 0 29px;gap:30px}
  .d-closing-h1{font-size:34.75px;line-height:1.17}
  .d-closing-aparte{margin-top:0}
  .d-closing-muro li{min-height:66px;padding:18px 6px;font-size:9px;letter-spacing:.02em}
  .d-closing-h2{font-size:29px}
  .d-closing-problemas{grid-template-columns:1fr;gap:32px}
  .d-closing-fila,.d-closing-fila.d-closing-vuelta{grid-template-columns:minmax(0,1fr);row-gap:28px}
  .d-closing-fila.d-closing-vuelta .d-closing-copia{order:0}
  .d-closing-h3{font-size:22px}
  .d-closing-figura{padding:14px}
  .d-closing-graba{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .d-closing-tile{min-height:104px;padding:16px 10px;font-size:13px}
  .d-closing-faq{grid-template-columns:minmax(0,1fr);row-gap:27px}
  .d-closing-cierre{margin-top:64px;padding:64px 0 70px}
  .d-closing-cierre-h{font-size:30px}
}
`;

/** Su tilde (15 px) y su flecha de los botones del cierre. */
const Tilde = () => (
  <svg viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3 7.8l2.9 2.9L12 4.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" /></svg>
);
const Flecha = () => (
  <svg viewBox="0 0 19 19" fill="none" aria-hidden="true"><path d="M4.5 9.5h10M10.5 5.5l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" /></svg>
);
const Boton = ({ flecha = false }: { flecha?: boolean }) => <a href={RUTA_CTA} className={`${P}-btn`}>{TEXTO_CTA}{flecha && <Flecha />}</a>;

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;

/** La figura de la fila `i`: la animación de lo que escribe el análisis, la hoja Closing (dos tarjetas, como su composición de dos
 *  capturas) o los grabadores. */
function Figura({ i }: { i: number }) {
  const cual = FIGURAS_FILAS[i];
  if (cual === 'puntaje' || cual === 'coaching' || cual === 'objeciones') {
    return <figure className={`${P}-figura ${P}-anim`} data-tema-fijo="" data-animacion={cual}>{ANIMACION_FILA[cual]}</figure>;
  }
  if (cual === 'hoja') {
    return (
      <figure className={`${P}-figura ${P}-hoja`} data-tema-fijo="">
        {[FOTOS_CLOSING.tasa, FOTOS_CLOSING.closers].map((f) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={f.src} src={f.src} alt={f.alt} width={f.w} height={f.h} loading="lazy" decoding="async" />
        ))}
      </figure>
    );
  }
  if (cual === 'grabadores') {
    return (
      <figure className={`${P}-figura`} data-tema-fijo="">
        <div className={`${P}-graba`}>
          {GRABADORES_CLOSING.map((g) => (
            <div key={g} className={`${P}-tile`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_GRABADOR[g]} alt="" width={40} height={40} loading="lazy" decoding="async" />
              <span>{g}</span>
            </div>
          ))}
          <div className={`${P}-tile ${P}-tile-mako`}>
            <span className={`${P}-estrella`} aria-hidden="true">
              <svg width="24" height="24" viewBox="-12 -12 24 24"><path d="M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z" fill="#F2B01E" /></svg>
            </span>
            <span>La grabadora de MaKo</span>
          </div>
        </div>
      </figure>
    );
  }
  return null;
}

/** Las secciones, en el orden de la landing: el hero, el muro, los problemas, las filas y las preguntas (como la suya). */
function secciones(bloques: Bloque[]): ReactNode[] {
  const out: ReactNode[] = [];
  let tarjetas = 0;
  bloques.forEach((b, k) => {
    if (b.tipo === 'hero') {
      out.push(
        <section key={k} className={`${P}-hero`}>
          <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
          <div className={`${P}-aparte`}>
            <p className={`${P}-lead`} dangerouslySetInnerHTML={html(b.bajada)} />
            <div className={`${P}-acciones`}><Boton /></div>
          </div>
        </section>,
      );
      return;
    }
    if (b.tipo === 'tarjetas') {
      const t = b as Tarjetas;
      const n = tarjetas++;
      if (n === 0) {
        // Su muro de logos: la misma grilla, con lo que trae cada llamada analizada.
        out.push(
          <section key={k} className={`${P}-muro-sec`}>
            <h2 className={`${P}-oculto`} dangerouslySetInnerHTML={html(t.titulo)} />
            <ul className={`${P}-muro`}>
              {t.items.map((it) => <li key={it.titulo} title={it.texto} dangerouslySetInnerHTML={html(it.titulo)} />)}
            </ul>
          </section>,
        );
      } else if (n === 1) {
        out.push(
          <section key={k} className={`${P}-sec`}>
            <div className={`${P}-intro`}><h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(t.titulo)} /></div>
            <ul className={`${P}-problemas`}>
              {t.items.map((it) => <li key={it.titulo}><p dangerouslySetInnerHTML={html(it.titulo)} /></li>)}
            </ul>
          </section>,
        );
      } else {
        out.push(
          <section key={k} className={`${P}-sec`}>
            <div className={`${P}-intro`}><h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(t.titulo)} /></div>
            <div className={`${P}-filas`}>
              {t.items.map((it, i) => (
                <div key={it.titulo} className={`${P}-fila${i % 2 ? ` ${P}-vuelta` : ''}`}>
                  <div className={`${P}-copia`}>
                    {it.meta && <p className={`${P}-ceja`} dangerouslySetInnerHTML={html(it.meta)} />}
                    <h3 className={`${P}-h3`} dangerouslySetInnerHTML={html(it.titulo)} />
                    <p className={`${P}-p`} dangerouslySetInnerHTML={html(it.texto)} />
                    {it.puntos && (
                      <ul className={`${P}-tildes`}>
                        {it.puntos.map((pt) => <li key={pt}><Tilde /><span dangerouslySetInnerHTML={html(pt)} /></li>)}
                      </ul>
                    )}
                  </div>
                  <Figura i={i} />
                </div>
              ))}
            </div>
          </section>,
        );
      }
      return;
    }
    if (b.tipo === 'preguntas') {
      out.push(
        <section key={k} className={`${P}-sec`}>
          <div className={`${P}-faq`}>
            <div>
              <p className={`${P}-ceja`}>Preguntas</p>
              <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
            </div>
            <div>
              {b.items.map((q) => (
                <details key={q.p} className={`${P}-preg`}>
                  <summary><span dangerouslySetInnerHTML={html(q.p)} /><span className={`${P}-mas`} aria-hidden="true">+</span></summary>
                  <p className={`${P}-resp`} dangerouslySetInnerHTML={html(q.r)} />
                </details>
              ))}
            </div>
          </div>
        </section>,
      );
    }
    // Esta landing no tiene otros tipos de bloque (su referencia no tiene testimonios ni cifras sueltas).
  });
  return out;
}

export default function DisenoClosing({ landing }: PropsDiseno) {
  const otras = otrasFunciones(landing.slug);
  return (
    <div className={`${P}-raiz`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`${P}-in`}>
        <header className={`${P}-nav`}>
          <LogoMaKo tamano={30} claro />
          <ul>
            <li><a href="/planes">Precios</a></li>
            <li><a href={RUTA_CTA}>{TEXTO_CTA}</a></li>
          </ul>
        </header>
        <main>
          {secciones(landing.bloques)}
          {/* Donde va su «See AI call scoring in action» y su botón (el segundo, su demo, no va): el título dice lo que hace el botón. */}
          <section className={`${P}-cierre`}>
            <h2 className={`${P}-cierre-h`}>{TITULO_CIERRE_CLOSING}</h2>
            <div className={`${P}-acciones`}><Boton flecha /></div>
            <p className={`${P}-chico`} dangerouslySetInnerHTML={html(TEXTO_CIERRE)} />
          </section>
        </main>
        <footer className={`${P}-pie`}>
          <LogoMaKo tamano={26} claro />
          <ul aria-label="Las otras funciones de MaKo">
            {otras.map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}
          </ul>
        </footer>
      </div>
    </div>
  );
}
