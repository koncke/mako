// =============================================================================
// /vsl/video con el DISEÑO de la portada de Cherry Studio (copiado el 11/11/2026)
// =============================================================================
// Referencia: https://cherrysweet.app/ — los valores medidos con getComputedStyle a 1440 y a 390 px están en
// docs/diseno/landings-competencia/video.md. Se copió la página entera: el fondo crema #ECE3DD con los paneles blancos
// de radio 30 apilados con 16 px entre uno y otro, la barra en forma de píldora, la cejilla en monoespaciada, los titulares
// en Outfit 900 con la parte final en el color de marca, la pastilla de color con la marca dentro del titular, las
// calcomanías negras con borde blanco, la lista numerada que se despliega, el comparador oscuro de dos mitades, la banda
// de papel rasgado con la hoja de calcomanías, la tarjeta de los tres pasos, las preguntas en dos columnas con × y +, la
// banda final rasgada y el pie centrado.
// Fuentes: las mismas de Cherry (Google Fonts, OFL): Outfit (titulares), Space Grotesk (texto) y DM Mono (cejillas),
// servidas desde /vsl-assets/fuentes/.
// De MaKo: el logo, el azul #2F6FED donde Cherry pone su rosa (la pastilla del titular, las palabras resaltadas, el número
// abierto, la banda rasgada, los íconos de las preguntas), el visual de Video en el lugar de su video y de su teléfono, y las
// otras funciones en la fila de links del pie.
// Lo que NO se copió, y por qué:
//   · «Mira a Cherry en acción» (la grilla de sus videos), el simulador, «Tu semana de contenido se publica sola», «Conecta
//     tu Instagram», «Cherry Studio trabaja con» y los precios: MaKo no tiene ese contenido (ver la cabecera de video.ts).
//     Por eso la tarjeta de los tres pasos va sola y centrada (en Cherry comparte la fila con la de Instagram).
//   · Sus calcomanías de estatuas, la letra manuscrita («toca cada paso», «arrástrame»), las fotos de sus reels y el sello
//     «very sweet»: son su arte. En su lugar, el ícono de cada capacidad en una calcomanía redonda.
//   · El segundo botón del hero («Ver precios»), la nota «Hay un plan gratis…», la palabra gigante calada de la banda final
//     y la fila de chips debajo de la hoja de calcomanías.
// Server component sin JavaScript: las preguntas y la lista numerada son <details>; las animaciones, CSS.
// =============================================================================

import type { PropsDiseno } from '.';
import { Icon } from '../../_detalle/FeatureDetail';
import { RUTA_CTA, LogoMaKo, TEXTO_CTA, html, otrasFunciones, TEXTO_CIERRE } from '../marca';
import type { Bloque } from '../tipos';
import { VisualDeLanding } from '../Visuales';
import { FaltaAnimacion } from '../FaltaAnimacion';

type Hero = Extract<Bloque, { tipo: 'hero' }>;

/** El borde rasgado de la banda: un zigzag irregular, el mismo arriba y abajo (en % del ancho). */
const RASGADO = (() => {
  const base = [0, 1.4, 0.2, 1.8, 0.6, 1.2, 0, 2, 0.8, 1.4, 0.3, 1.6, 0.5, 1.9, 0.1, 1.3, 0.7, 1.7, 0.2, 1.1];
  const dientes = [...base, ...base.slice().reverse(), ...base, 0];
  const paso = 100 / (dientes.length - 1);
  const arriba = dientes.map((d, i) => `${(i * paso).toFixed(2)}% ${(d * 5).toFixed(1)}px`);
  const abajo = [...dientes].reverse().map((d, i) => `${(100 - i * paso).toFixed(2)}% calc(100% - ${(d * 5).toFixed(1)}px)`);
  return `polygon(${[...arriba, ...abajo].join(', ')})`;
})();

function Boton({ clase = '' }: { clase?: string }) {
  return <a href={RUTA_CTA} className={`d-video-btn ${clase}`}>{TEXTO_CTA}</a>;
}

/** Antes y después: va la línea de tiempo real del editor de Video. Hasta tenerla grabada, el recuadro de lo que falta
 *  (12/11/2026: la onda dibujada a mano se sacó). */
function Onda({ pausas }: { pausas: boolean }) {
  return (
    <div className="d-video-falta">
      <FaltaAnimacion que={`La línea de tiempo real del editor de Video, ${pausas ? 'antes' : 'después'} de editar.`} />
    </div>
  );
}

function Cejilla({ texto, clara = false }: { texto?: string; clara?: boolean }) {
  return texto ? <p className={`d-video-cejilla${clara ? ' d-video-cejilla-osc' : ''}`}>{texto}</p> : null;
}

function DibujarBloque({ b, hero, icono }: { b: Bloque; hero: Hero | undefined; icono: string[] }) {
  switch (b.tipo) {
    case 'hero':
      return (
        <section className="d-video-panel d-video-hero">
          <span className="d-video-puntos" aria-hidden="true" />
          <Cejilla texto={b.etiqueta} />
          <h1 className="d-video-h1" dangerouslySetInnerHTML={html(b.titulo)} />
          <p className="d-video-hero-p" dangerouslySetInnerHTML={html(b.bajada)} />
          <div className="d-video-hero-vid"><VisualDeLanding visual={b.visual} /></div>
          <div className="d-video-hero-btns"><Boton /></div>
          {b.puntos?.length ? (
            <ul className="d-video-pegas">
              {b.puntos.map((p, i) => <li key={p} className={`d-video-pega d-video-pega-${i % 4}`} dangerouslySetInnerHTML={html(p)} />)}
            </ul>
          ) : null}
        </section>
      );
    case 'tarjetas':
      if (b.fondo) {
        // La banda rasgada de Cherry, con su «hoja de calcomanías».
        return (
          <section className="d-video-banda" style={{ clipPath: RASGADO }}>
            <span className="d-video-lunares" aria-hidden="true" />
            <Cejilla texto={b.etiqueta} />
            <h2 className="d-video-banda-h" dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada ? <p className="d-video-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
            <div className="d-video-pliego">
              {b.items.map((t, i) => (
                <div key={t.titulo} className="d-video-calca">
                  <span className={`d-video-calca-img d-video-calca-img-${i % 3}`}><Icon paths={t.icono ?? icono} size={58} /></span>
                  <b className="d-video-calca-t" dangerouslySetInnerHTML={html(t.titulo)} />
                  <span className="d-video-calca-x" dangerouslySetInnerHTML={html(t.texto)} />
                </div>
              ))}
            </div>
          </section>
        );
      }
      // «Lo que Cherry hace por ti»: la lista numerada a la izquierda (la primera abierta) y el video a la derecha.
      return (
        <section className="d-video-panel d-video-hace">
          <div>
            <Cejilla texto={b.etiqueta} />
            <h2 className="d-video-h2" dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada ? <p className="d-video-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
            <div className="d-video-pasitos">
              {b.items.map((t, i) => (
                <details key={t.titulo} className="d-video-pasito" open={i === 0}>
                  <summary><span className="d-video-pasito-n">{i + 1}</span><b dangerouslySetInnerHTML={html(t.titulo)} /></summary>
                  <p dangerouslySetInnerHTML={html(t.texto)} />
                </details>
              ))}
            </div>
          </div>
          <div className="d-video-marco" aria-hidden="true">
            {hero ? <div className="d-video-marco-tel"><VisualDeLanding visual={hero.visual} /></div> : null}
            <span className="d-video-pega d-video-pega-0 d-video-marco-pega" dangerouslySetInnerHTML={html(b.items[0]?.titulo ?? '')} />
          </div>
        </section>
      );
    case 'contraste':
      return (
        <section className="d-video-panel d-video-compara">
          <Cejilla texto={b.etiqueta} />
          <h2 className="d-video-h2" dangerouslySetInnerHTML={html(b.titulo)} />
          <div className="d-video-cmp">
            <div className="d-video-cmp-lado d-video-cmp-antes">
              <span className="d-video-cmp-chip" dangerouslySetInnerHTML={html(b.sin.titulo)} />
              <Onda pausas />
              <p className="d-video-cmp-x" dangerouslySetInnerHTML={html(b.sin.texto)} />
            </div>
            <div className="d-video-cmp-lado d-video-cmp-despues">
              <span className="d-video-cmp-chip" dangerouslySetInnerHTML={html(b.con.titulo)} />
              <Onda pausas={false} />
              <p className="d-video-cmp-x" dangerouslySetInnerHTML={html(b.con.texto)} />
            </div>
          </div>
        </section>
      );
    case 'pasos':
      return (
        <div className="d-video-fila-pasos">
          <section className="d-video-panel d-video-pasos">
            <Cejilla texto={b.etiqueta} />
            <h2 className="d-video-h2c" dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada ? <p className="d-video-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
            <ol className="d-video-pasos-l">
              {b.pasos.map((p, i) => (
                <li key={p.titulo}>
                  <span className={`d-video-paso-n${i === 1 ? ' d-video-paso-n-azul' : ''}`}>{i + 1}</span>
                  <div><b dangerouslySetInnerHTML={html(p.titulo)} /><span dangerouslySetInnerHTML={html(p.texto)} /></div>
                </li>
              ))}
            </ol>
            <Boton clase="d-video-btn-ancho" />
          </section>
        </div>
      );
    case 'preguntas':
      return (
        <>
          <div className="d-video-faq-cab">
            <Cejilla texto="Preguntas" />
            <h2 className="d-video-h2" dangerouslySetInnerHTML={html(b.titulo)} />
          </div>
          <section className="d-video-panel d-video-faq">
            {b.items.map((q, i) => (
              <details key={q.p} className="d-video-faq-i" open={i < 2}>
                <summary><span>{q.p}</span><span className="d-video-faq-ic" aria-hidden="true" /></summary>
                <p dangerouslySetInnerHTML={html(q.r)} />
              </details>
            ))}
          </section>
        </>
      );
    case 'cifras':
    case 'caso':
    case 'filas':
    case 'logos':
      // Video no tiene estos bloques (Cherry no tiene testimonios ni contadores).
      return null;
  }
}

export default function DisenoVideo({ landing }: PropsDiseno) {
  const hero = landing.bloques.find((b): b is Hero => b.tipo === 'hero');
  return (
    <div className="d-video">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="d-video-barra">
        <LogoMaKo className="d-video-logo" tamano={30} />
        <nav className="d-video-barra-nav" aria-label="Principal">
          <a href="/vsl" className="d-video-barra-link">Funcionalidades</a>
          <a href={RUTA_CTA} className="d-video-barra-btn">{TEXTO_CTA}</a>
        </nav>
      </header>

      <main className="d-video-main">
        {landing.bloques.map((b, i) => <DibujarBloque key={`${b.tipo}-${i}`} b={b} hero={hero} icono={landing.icono} />)}

        <section className="d-video-banda d-video-final" style={{ clipPath: RASGADO }}>
          <span className="d-video-lunares" aria-hidden="true" />
          <h2 className="d-video-final-h">¿Lo quieres funcionando en tu negocio?</h2>
          <p className="d-video-final-p">{TEXTO_CIERRE}</p>
          <Boton />
          {/* Las tarjetas inclinadas que Cherry asoma al pie de la banda: acá, el visual de Video, cortado por el borde. */}
          {hero ? <div className="d-video-final-vis" aria-hidden="true"><VisualDeLanding visual={hero.visual} /></div> : null}
        </section>
      </main>

      <footer className="d-video-pie">
        <LogoMaKo tamano={26} />
        <nav className="d-video-pie-nav" aria-label="Otras funcionalidades">
          {otrasFunciones(landing.slug).map((f) => <a key={f.href} href={f.href}>{f.nombre}</a>)}
        </nav>
        <p className="d-video-pie-p">El mejor software para vender High Ticket.</p>
        <p className="d-video-pie-p">© MaKo — Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

const CSS = `
@font-face { font-family: 'DVidOutfit'; src: url('/vsl-assets/fuentes/outfit/outfit-latin-var.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
@font-face { font-family: 'DVidGrotesk'; src: url('/vsl-assets/fuentes/space-grotesk/space-grotesk-latin-var.woff2') format('woff2'); font-weight: 300 700; font-display: swap; }
@font-face { font-family: 'DVidMono'; src: url('/vsl-assets/fuentes/dm-mono/dm-mono-latin-500.woff2') format('woff2'); font-weight: 500; font-display: swap; }

.d-video { --d-vid-tit: 'DVidOutfit', 'Arial Black', system-ui, sans-serif; --d-vid-txt: 'DVidGrotesk', 'Segoe UI', system-ui, sans-serif; --d-vid-mono: 'DVidMono', ui-monospace, Consolas, monospace;
  --d-vid-tinta: #140C11; --d-vid-negro: #0B0709; --d-vid-crema: #ECE3DD; --d-vid-suave: rgba(20,12,17,.68); --d-vid-azul: #2F6FED; --d-vid-azul-osc: #1F57C8;
  background: var(--d-vid-crema); color: var(--d-vid-tinta); font-family: var(--d-vid-txt); font-size: 16px; line-height: 24px; padding: 0 24px 60px; overflow-x: clip; }
.d-video *, .d-video *::before, .d-video *::after { box-sizing: border-box; }
.d-video :where(h1, h2, h3, p, ul, ol) { margin: 0; padding: 0; }
.d-video :where(ul, ol) { list-style: none; }
.d-video :where(a) { color: inherit; }
.d-video em { font-style: normal; color: var(--d-vid-azul); }
.d-video strong { font-weight: 700; color: var(--d-vid-tinta); }

/* El panel «vol» de Cherry: blanco con un degradado apenas crema, borde de 1 px y la sombra suave */
.d-video-panel, .d-video-barra { border: 1px solid rgba(20,12,17,.09); background-image: radial-gradient(120% 90% at 78% 72%, rgba(20,12,17,.05), rgba(0,0,0,0) 60%), linear-gradient(#FFFFFF, #FBF7F4);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 1px 0 rgba(0,0,0,.04), 0 26px 50px -26px rgba(70,40,50,.22), 0 2px 6px -2px rgba(70,40,50,.12); }
.d-video-panel { position: relative; border-radius: 30px; }

/* Barra: píldora de 1160 × 58, padding 9 10 9 18 */
.d-video-barra { position: sticky; top: 0; z-index: 30; max-width: 1160px; margin: 0 auto 16px; height: 58px; display: flex; align-items: center; gap: 10px; padding: 9px 10px 9px 18px; border-radius: 999px; }
.d-video-logo span:last-child { font-family: var(--d-vid-tit); font-weight: 800 !important; }
.d-video-barra-nav { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.d-video-barra-link { padding: 10px 12px; border-radius: 999px; font-size: 14px; line-height: 14px; font-weight: 500; color: var(--d-vid-suave); text-decoration: none; transition: background-color .2s ease, color .2s ease; }
.d-video-barra-link:hover { background: rgba(20,12,17,.06); color: var(--d-vid-tinta); }
.d-video-barra-btn { padding: 12px 18px; border-radius: 999px; background: var(--d-vid-tinta); color: var(--d-vid-crema); font-size: 14px; line-height: 14px; font-weight: 500; text-decoration: none; white-space: nowrap; transition: transform .2s ease; }
.d-video-barra-btn:hover { transform: translateY(-1px); }

.d-video-main { max-width: 1160px; margin: 0 auto; display: grid; gap: 16px; }

/* Cejilla: DM Mono 10.5 / 12.6, 500, 1.47 px, en mayúsculas */
.d-video-cejilla { font-family: var(--d-vid-mono); font-size: 10.5px; line-height: 12.6px; font-weight: 500; letter-spacing: 1.47px; text-transform: uppercase; color: var(--d-vid-suave); }
.d-video-cejilla-osc { color: rgba(11,7,9,.55); }

/* Titulares: Outfit 900 */
.d-video-h1 { font-family: var(--d-vid-tit); font-size: 60px; line-height: 58.8px; font-weight: 900; letter-spacing: -2.7px; color: var(--d-vid-tinta); text-align: center; max-width: 852px; margin: 0 auto; }
.d-video-h1 em { display: inline-block; padding: 0 12px 4px; margin: 0 2px; border-radius: 14px; background: var(--d-vid-azul); color: var(--d-vid-negro); box-shadow: 0 14px 30px -12px rgba(47,111,237,.7); transform: rotate(-2deg); }
.d-video-h2 { font-family: var(--d-vid-tit); font-size: 58px; line-height: 52.2px; font-weight: 900; letter-spacing: -2.61px; color: var(--d-vid-tinta); }
.d-video-h2c { font-family: var(--d-vid-tit); font-size: 42px; line-height: 39.48px; font-weight: 900; letter-spacing: -1.89px; color: var(--d-vid-tinta); }
.d-video-p { margin-top: 6px; max-width: 616px; font-size: 15.5px; line-height: 23.25px; color: var(--d-vid-suave); }

/* Botón: negro, píldora, 16 / 700, padding 17 26 */
.d-video-btn { display: inline-flex; align-items: center; justify-content: center; padding: 17px 26px; border-radius: 999px; background: var(--d-vid-tinta); color: var(--d-vid-crema); font-size: 16px; line-height: 16px; font-weight: 700; text-decoration: none; white-space: nowrap; box-shadow: 0 12px 26px -10px rgba(70,40,50,.22); transition: transform .2s ease, box-shadow .2s ease; }
.d-video-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 30px -10px rgba(70,40,50,.32); }
.d-video-btn-ancho { width: 100%; }

/* Hero: el panel de 1160, padding 64 40, todo centrado */
.d-video-hero { padding: 56px 40px 44px; display: flex; flex-direction: column; align-items: center; gap: 16px; overflow: hidden; }
.d-video-puntos { position: absolute; left: 372px; top: 30px; width: 132px; height: 78px; background-image: radial-gradient(rgba(20,12,17,.13) 1.6px, rgba(0,0,0,0) 1.8px); background-size: 10px 10px; pointer-events: none; }
.d-video-hero .d-video-cejilla { position: relative; }
.d-video-hero-vid { width: 780px; max-width: 100%; margin-top: 6px; padding: 30px 28px; border-radius: 20px; background: linear-gradient(160deg, #F4F7FE 0%, #E4ECFC 100%); box-shadow: 0 26px 50px -24px rgba(50,20,35,.65); }
.d-video-hero-btns { margin-top: 2px; display: flex; gap: 8px; }
.d-video-hero-p { max-width: 520px; text-align: center; font-size: 16px; line-height: 24px; color: var(--d-vid-suave); }
.d-video-hero-p strong { color: var(--d-vid-tinta); }

/* Calcomanías («pega»): negras, crema o azules, con un borde blanco de 4 px */
.d-video-pegas { margin-top: 24px; display: flex; flex-wrap: wrap; justify-content: center; gap: 18px 26px; }
.d-video-pega { display: inline-block; padding: 11px 15px 12px; border-radius: 12px; font-family: var(--d-vid-tit); font-size: 17px; line-height: 19px; font-weight: 800; letter-spacing: -0.2px; box-shadow: 0 0 0 4px #fff, 0 10px 18px rgba(70,40,50,.28); transition: transform .25s ease; }
.d-video-pega-0 { background: var(--d-vid-negro); color: #fff; transform: rotate(-5deg); }
.d-video-pega-1 { background: #F4ECE7; color: var(--d-vid-negro); transform: rotate(3deg); }
.d-video-pega-2 { background: var(--d-vid-azul); color: #fff; transform: rotate(-2deg); }
.d-video-pega-3 { background: #F2B01E; color: var(--d-vid-negro); transform: rotate(4deg); }
.d-video-pega:hover { transform: rotate(0deg) scale(1.04); }

/* «Lo que hace»: dos columnas (569 px y el marco de 360 × 450) */
.d-video-hace { padding: 48px 48px 48px 36px; display: grid; grid-template-columns: 569px 1fr; gap: 26px 40px; align-items: center; }
.d-video-hace .d-video-h2 { margin-top: 8px; }
.d-video-pasitos { margin-top: 26px; display: grid; gap: 8px; }
.d-video-pasito { border-radius: 22px; border: 1px solid transparent; transition: background-color .2s ease; }
.d-video-pasito summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: 40px 1fr; gap: 14px; align-items: center; padding: 14px 14px 14px 10px; }
.d-video-pasito summary::-webkit-details-marker { display: none; }
.d-video-pasito b { font-family: var(--d-vid-tit); font-size: 21px; line-height: 22.05px; font-weight: 900; letter-spacing: -0.42px; color: rgba(20,12,17,.72); }
.d-video-pasito p { padding: 0 14px 18px 64px; margin-top: -8px; font-size: 14.5px; line-height: 21.03px; color: var(--d-vid-suave); }
.d-video-pasito[open] { background: #fff; border-color: rgba(20,12,17,.09); box-shadow: 0 14px 28px -20px rgba(70,40,50,.22); }
.d-video-pasito[open] b { color: var(--d-vid-tinta); }
.d-video-pasito:not([open]):hover { background: rgba(255,255,255,.6); }
.d-video-pasito-n { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: var(--d-vid-negro); color: #fff; font-family: var(--d-vid-tit); font-size: 19px; font-weight: 900; box-shadow: 0 0 0 3px #fff, 0 6px 12px rgba(70,40,50,.25); transform: rotate(-4deg); }
.d-video-pasito[open] .d-video-pasito-n { background: var(--d-vid-azul); color: #fff; }
.d-video-marco { position: relative; justify-self: center; width: 360px; height: 450px; display: flex; align-items: center; justify-content: center; }
.d-video-marco-tel .mk-v-video-panel, .d-video-marco-tel .mk-v-video-linea { display: none; }
.d-video-marco-tel { transform: scale(1.5); }
.d-video-marco-pega { position: absolute; top: -12px; right: 0; z-index: 3; }

/* Comparador: panel con padding 40 / 44 y la caja oscura de 1070 × 240, radio 22 */
.d-video-compara { padding: 40px 44px; display: grid; gap: 12px; }
.d-video-cmp { margin-top: 6px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); border-radius: 22px; overflow: hidden; border: 1px solid rgba(255,255,255,.09); background: #140D12; }
.d-video-cmp-lado { position: relative; padding: 14px 14px 20px; display: flex; flex-direction: column; gap: 16px; min-height: 240px; }
.d-video-cmp-despues { background: linear-gradient(#172019, #0F1511); border-left: 2px solid rgba(255,255,255,.85); }
.d-video-cmp-chip { align-self: flex-start; padding: 7px 9px; border-radius: 8px; font-family: var(--d-vid-mono); font-size: 10.5px; line-height: 10.5px; font-weight: 500; letter-spacing: 1.26px; text-transform: uppercase; }
.d-video-cmp-antes .d-video-cmp-chip { background: rgba(47,111,237,.22); color: #9DBBF7; }
.d-video-cmp-despues .d-video-cmp-chip { margin-left: auto; background: rgba(110,212,156,.16); color: #6ED49C; }
.d-video-falta { border-radius: 14px; background: #fff; }
.d-video-onda { height: 96px; display: flex; align-items: center; gap: 0; padding: 0 6px; }
.d-video-onda-tramo { height: 100%; display: flex; align-items: center; gap: 4px; }
.d-video-onda-tramo i { display: block; width: 4px; border-radius: 2px; background: #F4ECE7; }
.d-video-cmp-despues .d-video-onda-tramo i { background: #6ED49C; }
.d-video-onda-pausa { align-self: stretch; margin: 0 8px; width: 74px; border-radius: 6px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 6px; background: rgba(47,111,237,.16); color: rgba(244,236,231,.55); font-size: 11px; line-height: 11px; }
.d-video-cmp-x { font-size: 14px; line-height: 21px; color: rgba(244,236,231,.78); max-width: 460px; }
.d-video-cmp-x strong { color: #fff; }

/* La banda rasgada: degradado del color de marca, lunares y la hoja de calcomanías */
.d-video-banda { position: relative; border-radius: 3px; padding: 52px 40px 44px; color: var(--d-vid-negro);
  background-image: radial-gradient(90% 70% at 20% 0%, #6E9BF5, rgba(0,0,0,0) 60%), linear-gradient(160deg, #2F6FED, #1F57C8); box-shadow: 0 40px 80px -40px rgba(47,111,237,.6); }
.d-video-lunares { position: absolute; inset: 0; background-image: radial-gradient(rgba(11,7,9,.22) 1.4px, rgba(0,0,0,0) 1.6px); background-size: 14px 14px; pointer-events: none; -webkit-mask-image: linear-gradient(180deg, #000, transparent 70%); mask-image: linear-gradient(180deg, #000, transparent 70%); }
.d-video-banda > * { position: relative; }
.d-video-banda .d-video-cejilla { color: rgba(11,7,9,.66); }
.d-video-banda-h { margin-top: 8px; max-width: 580px; font-family: var(--d-vid-tit); font-size: 66px; line-height: 59.4px; font-weight: 900; letter-spacing: -2.97px; color: var(--d-vid-negro); }
.d-video-pliego { margin-top: 24px; padding: 30px 26px 26px; border-radius: 28px; background: #F6F9FF; box-shadow: 0 30px 60px -24px rgba(0,25,80,.7), inset 0 0 0 2px rgba(47,111,237,.12); display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px 12px; outline: 2px dashed rgba(47,111,237,.32); outline-offset: -12px; }
.d-video-calca { display: grid; justify-items: center; gap: 6px; text-align: center; }
.d-video-calca-img { width: 132px; height: 132px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #fff; color: var(--d-vid-negro); box-shadow: 0 0 0 6px #fff, 0 12px 22px rgba(0,25,80,.28); border: 2px solid #E6EDFB; transition: transform .3s ease; }
.d-video-calca-img-0 { transform: rotate(-6deg); }
.d-video-calca-img-1 { transform: rotate(4deg); color: var(--d-vid-azul); }
.d-video-calca-img-2 { transform: rotate(-2deg); }
.d-video-calca:hover .d-video-calca-img { transform: rotate(0deg) scale(1.05); }
.d-video-calca-t { margin-top: 10px; padding: 8px 13px 10px; border-radius: 10px; background: var(--d-vid-negro); color: #fff; font-family: var(--d-vid-tit); font-size: 19px; line-height: 21px; font-weight: 800; letter-spacing: -0.3px; box-shadow: 0 0 0 4px #fff; transform: rotate(-2deg); }
.d-video-calca:nth-child(even) .d-video-calca-t { transform: rotate(2deg); }
.d-video-calca-x { max-width: 260px; font-size: 13.5px; line-height: 18.23px; font-weight: 500; color: rgba(11,7,9,.8); }
.d-video-calca-x strong { color: var(--d-vid-negro); }

/* La tarjeta de los tres pasos: 477 px, padding 24 / 22 */
.d-video-fila-pasos { display: flex; justify-content: center; }
.d-video-pasos { width: 100%; max-width: 560px; padding: 24px 22px; display: grid; gap: 16px; }
.d-video-pasos-l { display: grid; gap: 14px; }
.d-video-pasos-l li { display: grid; grid-template-columns: 40px 1fr; gap: 18px; align-items: start; }
.d-video-pasos-l b { display: block; font-family: var(--d-vid-tit); font-size: 18px; line-height: 20.7px; font-weight: 800; letter-spacing: -0.18px; color: var(--d-vid-tinta); }
.d-video-pasos-l li span:not(.d-video-paso-n) { display: block; margin-top: 3px; font-size: 14px; line-height: 21px; color: var(--d-vid-suave); }
.d-video-paso-n { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: var(--d-vid-negro); color: #fff; font-family: var(--d-vid-tit); font-size: 19px; font-weight: 900; box-shadow: 0 0 0 3px #fff, 0 6px 12px rgba(70,40,50,.25); transform: rotate(-4deg); }
.d-video-paso-n-azul { background: var(--d-vid-azul); transform: rotate(3deg); }
.d-video-pasos .d-video-btn { margin-top: 4px; }

/* Preguntas: la cabecera suelta y el panel con dos columnas de <details> */
.d-video-faq-cab { padding: 28px 6px 2px; display: grid; gap: 8px; }
.d-video-faq-cab .d-video-h2 { font-size: 62px; line-height: 55.8px; letter-spacing: -2.79px; }
.d-video-faq { padding: 8px 32px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 40px; align-items: start; }
.d-video-faq-i { border-bottom: 1px solid rgba(20,12,17,.09); }
.d-video-faq-i summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 17px 0; font-size: 15.5px; line-height: 20.93px; font-weight: 700; color: var(--d-vid-tinta); }
.d-video-faq-i summary::-webkit-details-marker { display: none; }
.d-video-faq-ic { position: relative; flex: none; width: 12px; height: 12px; transition: transform .25s ease; }
.d-video-faq-ic::before, .d-video-faq-ic::after { content: ''; position: absolute; left: 0; top: 5px; width: 12px; height: 2px; border-radius: 2px; background: var(--d-vid-azul); }
.d-video-faq-ic::after { transform: rotate(90deg); }
.d-video-faq-i[open] .d-video-faq-ic { transform: rotate(45deg); }
.d-video-faq-i p { padding: 0 0 17px; font-size: 14.5px; line-height: 21.75px; color: var(--d-vid-suave); }

/* Banda final: la misma banda rasgada, centrada, titular de 92 px */
.d-video-final { margin-top: 40px; padding: 90px 40px 0; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 18px; overflow: hidden; }
.d-video-final-vis { margin-top: 40px; height: 250px; width: 560px; max-width: 100%; display: flex; justify-content: center; align-items: flex-start; }
.d-video-final-vis .mk-v-video-linea { display: none; }
.d-video-final-vis .mk-v-video-arriba { transform: rotate(-4deg); transform-origin: top center; }
.d-video-final-vis .mk-v-video-tel { box-shadow: 0 0 0 4px #fff, 0 24px 50px -20px rgba(0,0,0,.6); }
.d-video-final-h { max-width: 760px; font-family: var(--d-vid-tit); font-size: 92px; line-height: 80.96px; font-weight: 900; letter-spacing: -4.6px; color: var(--d-vid-negro); }
.d-video-final-p { max-width: 413px; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--d-vid-negro); }
.d-video-final .d-video-btn { background: var(--d-vid-negro); color: #fff; }

/* Pie centrado: logo, la fila de links, el texto chico */
.d-video-pie { max-width: 1160px; margin: 0 auto; padding: 26px 8px 0; display: grid; justify-items: center; gap: 14px; text-align: center; }
.d-video-pie .d-video-logo, .d-video-pie a[aria-label] span:last-child { font-family: var(--d-vid-tit); }
.d-video-pie-nav { max-width: 760px; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; }
.d-video-pie-nav a { font-size: 14px; line-height: 21px; color: var(--d-vid-suave); text-decoration: none; }
.d-video-pie-nav a:hover { color: var(--d-vid-tinta); text-decoration: underline; }
.d-video-pie-p { font-size: 12.5px; line-height: 18.75px; color: rgba(20,12,17,.48); }

/* Entrada: los paneles suben un poco al cargar (nada arranca invisible) */
@keyframes dVidSube { from { transform: translateY(16px); } to { transform: none; } }
.d-video-hero, .d-video-hace { animation: dVidSube .7s cubic-bezier(.2,.7,.2,1) both; }
.d-video-hace { animation-delay: .06s; }
@media (prefers-reduced-motion: reduce) {
  .d-video *, .d-video *::before, .d-video *::after { animation: none !important; transition: none !important; }
}

@media (max-width: 1100px) {
  .d-video-hace { grid-template-columns: minmax(0, 1fr); }
  .d-video-marco { margin-top: 30px; }
  .d-video-puntos { display: none; }
}
/* Teléfono: los tamaños medidos a 390 px */
@media (max-width: 760px) {
  .d-video { padding: 0 16px 40px; }
  .d-video-barra { height: 54px; padding: 8px 8px 8px 14px; }
  .d-video-barra-link { display: none; }
  .d-video-barra-btn { padding: 11px 14px; font-size: 13.5px; line-height: 13.5px; }
  .d-video-hero { padding: 26px 20px 30px; gap: 14px; }
  .d-video-h1 { font-size: 34px; line-height: 33.32px; letter-spacing: -1.53px; }
  .d-video-h1 em { padding: 0 8px 3px; border-radius: 10px; }
  .d-video-hero-vid { padding: 16px 10px; border-radius: 16px; }
  .d-video-pegas { gap: 14px 16px; }
  .d-video-pega { font-size: 14px; line-height: 16px; }
  .d-video-hace { padding: 26px 18px 30px; }
  .d-video-h2 { font-size: 35.1px; line-height: 31.59px; letter-spacing: -1.58px; }
  .d-video-pasito b { font-size: 18px; line-height: 20px; }
  .d-video-pasito p { padding: 0 12px 16px 64px; }
  .d-video-marco { width: 100%; height: 400px; }
  .d-video-marco-tel { transform: scale(1.3); }
  .d-video-compara { padding: 26px 18px; }
  .d-video-cmp { grid-template-columns: minmax(0, 1fr); }
  .d-video-cmp-despues { border-left: 0; border-top: 2px solid rgba(255,255,255,.85); }
  .d-video-onda { height: 70px; overflow: hidden; }
  .d-video-onda-pausa { width: 44px; margin: 0 5px; font-size: 9.5px; }
  .d-video-onda-tramo { gap: 3px; }
  .d-video-onda-tramo i { width: 3px; }
  .d-video-banda { padding: 40px 20px 34px; }
  .d-video-banda-h { font-size: 39px; line-height: 35.1px; letter-spacing: -1.76px; }
  .d-video-pliego { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); padding: 24px 12px 22px; gap: 24px 8px; }
  .d-video-calca-img { width: 96px; height: 96px; }
  .d-video-calca-img svg { width: 44px; height: 44px; }
  .d-video-calca-t { font-size: 16px; line-height: 18px; }
  .d-video-calca-x { font-size: 12.5px; line-height: 16.5px; }
  .d-video-h2c { font-size: 31.2px; line-height: 29.33px; letter-spacing: -1.4px; }
  .d-video-faq-cab .d-video-h2 { font-size: 37.05px; line-height: 33.35px; letter-spacing: -1.67px; }
  .d-video-faq { grid-template-columns: minmax(0, 1fr); padding: 8px 22px; }
  .d-video-final { padding: 66px 22px 0; }
  .d-video-final-vis { height: 190px; }
  .d-video-final-h { font-size: 46.8px; line-height: 41.18px; letter-spacing: -2.34px; }
}
`;
