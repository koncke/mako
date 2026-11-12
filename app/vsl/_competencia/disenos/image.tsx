// =============================================================================
// /vsl/image con el DISEÑO de la portada de PostNitro en español (copiado el 11/11/2026)
// =============================================================================
// Referencia: https://postnitro.ai/es — los valores medidos con getComputedStyle a 1440 y a 390 px están en
// docs/diseno/landings-competencia/image.md. Se copió la página entera: el fondo gris verdoso #F5F8F7 con secciones
// blancas y grises alternadas, la barra de dos cajas flotantes, la cejilla en caja con borde, el hero de dos columnas con
// la captura dentro de un marco de selección (borde de color, cuadraditos en las esquinas y la pestaña con su nombre), la
// franja blanca de prueba social, la sección centrada de plantillas, los tres pasos con «01 ——», las secciones numeradas
// («01 DISEÑO ——») con filas alternadas de texto + lista con tildes + captura enmarcada, las tarjetas oscuras de
// «Automatizar», la grilla de testimonios, las preguntas en acordeón y el pie blanco con columnas.
// Fuentes: las mismas de PostNitro (Google Fonts, OFL): Archivo (titulares), Instrument Sans (texto) y JetBrains Mono
// (cejillas y pestañas), servidas desde /vsl-assets/fuentes/.
// De MaKo: el logo, el azul #2F6FED donde PostNitro pone su verde #087A68 (botones, marcos, pestañas, tildes, cejillas, la
// pregunta abierta), el visual de Image dentro de cada marco (en el hero, sus láminas y la franja de tu marca, como sus
// miniaturas y su «Kit de marca»; en cada fila, la parte que esa fila cuenta: el editor con su descarga, el chat, la portada
// con tu marca y el editor entero), el caso de Mauricio en el lugar de los testimonios, y en el pie las otras funciones en
// sus cuatro columnas y, abajo a la derecha, los términos y la privacidad de MaKo.
// Lo que NO se copió, y por qué:
//   · La franja de Black Friday, la banda oscura «Dale acceso a tu agente» (va en su lugar, «Automatizar»), el editor en vivo
//     «Pruébalo, no es un video», el cronograma (Image no programa) y la grilla de extras de la sección de diseño: ver la
//     cabecera de image.ts. Por eso las secciones numeradas son dos (01 Diseño, 02 Automatizar) y no tres.
//   · Su «Publica en» con los íconos de las redes: Image no publica; el renglón chico debajo del botón dice que se descarga.
//   · Los avatares, las estrellas y los logos de la franja de prueba social: ahí van los números de lo que Image trae.
//   · Sus 30 testimonios: la prueba de MaKo es el caso de Mauricio, contado en tres tarjetas con el diseño de las suyas.
//   · Los íconos de los tres pasos (los pasos de MaKo no traen ícono) y la flecha y la línea mono de las tarjetas oscuras
//     (en PostNitro son links con su comando; acá no llevan a otro lado).
//   · Debajo de las plantillas, su renglón «Personaliza cualquier plantilla…» y el botón «Explora todas las plantillas»: no
//     hay galería pública de MaKo a la que llevar. Y sus plantillas van en una fila de seis; las tarjetas de MaKo (desde el
//     12/11/2026, lo que hace «Carruseles que funcionan») son ocho, en dos filas de cuatro con el mismo tamaño y la misma sombra.
//   · Su captura del editor en «Pruébalo, no es un video»: la de «Carruseles que funcionan» dentro de MaKo NO se pudo tomar el
//     12/11/2026 (el `next dev` de la sesión no tenía AUTH_SECRET ni la base: /api/auth/dev-login contestó «falta AUTH_SECRET»),
//     y no se arma a mano. Cuando exista, va en un marco como el del hero, con el tamaño de su captura.
//   · El título propio de la primera fila de «01 Diseño» (en MaKo esa fila es la del título de la sección) y la grilla de
//     íconos de redes del pie.
// Server component sin JavaScript: las preguntas son <details>; las animaciones, CSS.
// =============================================================================

import type { PropsDiseno } from '.';
import { Icon } from '../../_detalle/FeatureDetail';
import { RUTA_CTA, CASO, LogoMaKo, TEXTO_CTA, html, otrasFunciones } from '../marca';
import type { Bloque } from '../tipos';
import { VisualDeLanding } from '../Visuales';

type Hero = Extract<Bloque, { tipo: 'hero' }>;
type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;

/** Qué parte del visual de Image se ve en el marco de cada fila (las clases mk-v-image-* son del visual). */
const PARTES = ['formatos', 'chat', 'marca', 'lienzo'] as const;

function Flecha() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>;
}
function Lapiz() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>;
}
function Tilde() {
  return (
    <svg className="d-image-tilde" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" />
    </svg>
  );
}

/** El marco de selección de PostNitro: la pestaña con el nombre, el borde de color y un cuadradito en cada esquina. */
function Marco({ nombre, children, clase = '' }: { nombre: string; children: React.ReactNode; clase?: string }) {
  return (
    <div className={`d-image-marco ${clase}`}>
      <span className="d-image-marco-tab">{nombre}</span>
      <div className="d-image-marco-caja">
        <i className="d-image-esq d-image-esq-1" /><i className="d-image-esq d-image-esq-2" /><i className="d-image-esq d-image-esq-3" /><i className="d-image-esq d-image-esq-4" />
        {children}
      </div>
    </div>
  );
}

function Cejilla({ texto, numero }: { texto?: string; numero?: number }) {
  if (!texto) return null;
  return numero ? (
    <p className="d-image-cej-num"><span>{String(numero).padStart(2, '0')}</span>{texto}</p>
  ) : <p className="d-image-cej">{texto}</p>;
}

function Checks({ items }: { items: Tarjetas['items'] }) {
  return (
    <ul className="d-image-checks">
      {items.map((t) => (
        <li key={t.titulo}>
          <Tilde />
          <span>
            <b dangerouslySetInnerHTML={html(t.titulo)} />
            <span dangerouslySetInnerHTML={html(t.texto)} />
            {t.meta ? <span className="d-image-checks-meta">{t.meta}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DibujarBloque({ b, hero, icono, n, nombre }: { b: Bloque; hero: Hero | undefined; icono: string[]; n: number; nombre: string }) {
  switch (b.tipo) {
    case 'hero':
      return (
        <section className="d-image-hero">
          <div className="d-image-hero-in">
            <div className="d-image-hero-txt">
              <p className="d-image-hero-cej"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" /></svg>{b.etiqueta}</p>
              <h1 className="d-image-h1" dangerouslySetInnerHTML={html(b.titulo)} />
              <p className="d-image-hero-p" dangerouslySetInnerHTML={html(b.bajada)} />
              <a href={RUTA_CTA} className="d-image-btn"><Lapiz />{TEXTO_CTA}</a>
              {b.puntos?.length ? <p className="d-image-hero-nota">{b.puntos.map((p, i) => <span key={p} dangerouslySetInnerHTML={html((i ? ' · ' : '') + p)} />)}</p> : null}
            </div>
            <Marco nombre={nombre} clase="d-image-marco-hero"><VisualDeLanding visual={b.visual} /></Marco>
          </div>
        </section>
      );
    case 'cifras':
      return (
        <section className="d-image-franja" aria-label={b.titulo ?? 'En números'}>
          {b.titulo ? <p className="d-image-franja-t">{b.titulo}</p> : null}
          <ul className="d-image-franja-l">
            {b.items.map((c) => <li key={c.label}><b>{c.valor}</b><span>{c.label}</span></li>)}
          </ul>
        </section>
      );
    case 'tarjetas': {
      if (n === 0) {
        // «Más de 100 plantillas, todas editables.»: centrada, con las miniaturas 4:5 en fila. Desde el 12/11/2026 son «Los
        // carruseles que funcionan, todos editables.»: cada tarjeta, una cosa que hace la portada de Image (../image.ts).
        return (
          <section className="d-image-sec d-image-blanca d-image-centro">
            <Cejilla texto={b.etiqueta} />
            <h2 className="d-image-h2c" dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada ? <p className="d-image-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
            <ul className="d-image-plantillas">
              {b.items.map((t, i) => (
                <li key={t.titulo} className={`d-image-plant d-image-plant-${i % 4}`}>
                  <span className="d-image-plant-top"><span>{t.meta}</span><Icon paths={t.icono ?? icono} size={18} /></span>
                  <b dangerouslySetInnerHTML={html(t.titulo)} />
                  <span className="d-image-plant-x" dangerouslySetInnerHTML={html(t.texto)} />
                </li>
              ))}
            </ul>
          </section>
        );
      }
      if (n === 5) {
        // «03 AUTOMATIZAR — El mismo motor…»: la cabecera numerada y las tarjetas oscuras.
        return (
          <section className="d-image-sec d-image-gris">
            <div className="d-image-cab">
              <Cejilla texto={b.etiqueta} numero={2} />
              <h2 className="d-image-h2" dangerouslySetInnerHTML={html(b.titulo)} />
              {b.bajada ? <p className="d-image-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
            </div>
            <div className="d-image-oscuras">
              {b.items.map((t) => (
                <div key={t.titulo} className="d-image-oscura">
                  <span className="d-image-oscura-h"><Icon paths={t.icono ?? icono} size={16} /><b dangerouslySetInnerHTML={html(t.titulo)} /></span>
                  <p dangerouslySetInnerHTML={html(t.texto)} />
                </div>
              ))}
            </div>
          </section>
        );
      }
      // Las filas de «01 DISEÑO»: la primera abre la sección con su cabecera; las otras siguen en el mismo gris.
      const parte = PARTES[Math.min(n - 1, PARTES.length - 1)];
      const marcoAntes = n % 2 === 0;
      return (
        <section className={`d-image-sec d-image-gris d-image-fila-sec${n === 1 ? ' d-image-fila-primera' : ''}${n === 4 ? ' d-image-fila-ultima' : ''}`}>
          {n === 1 ? (
            <div className="d-image-cab">
              <Cejilla texto={b.etiqueta} numero={1} />
              <h2 className="d-image-h2" dangerouslySetInnerHTML={html(b.titulo)} />
              {b.bajada ? <p className="d-image-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
            </div>
          ) : null}
          <div className={`d-image-fila${marcoAntes ? ' d-image-fila-inv' : ''}`}>
            <div className="d-image-fila-txt">
              {n > 1 ? <h3 className="d-image-h3" dangerouslySetInnerHTML={html(b.titulo)} /> : null}
              {n > 1 && b.bajada ? <p className="d-image-fila-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
              <Checks items={b.items} />
            </div>
            {hero ? (
              <Marco nombre={n === 1 ? 'Formatos' : (b.etiqueta ?? nombre)} clase={`d-image-parte-${parte}`}>
                <VisualDeLanding visual={hero.visual} />
              </Marco>
            ) : null}
          </div>
        </section>
      );
    }
    case 'pasos':
      return (
        <section className="d-image-sec d-image-blanca">
          <div className="d-image-cab">
            {b.etiqueta ? <Cejilla texto={b.etiqueta} /> : null}
            <h2 className="d-image-h2" dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada ? <p className="d-image-p" dangerouslySetInnerHTML={html(b.bajada)} /> : null}
          </div>
          <ol className="d-image-pasos">
            {b.pasos.map((p, i) => (
              <li key={p.titulo}>
                <span className="d-image-paso-n"><b>{String(i + 1).padStart(2, '0')}</b><i /></span>
                <h3 className="d-image-paso-t" dangerouslySetInnerHTML={html(p.titulo)} />
                <p className="d-image-paso-x" dangerouslySetInnerHTML={html(p.texto)} />
              </li>
            ))}
          </ol>
          <a href={RUTA_CTA} className="d-image-btn d-image-btn-linea">{TEXTO_CTA}<Flecha /></a>
        </section>
      );
    case 'caso':
      return (
        <section className="d-image-sec d-image-blanca d-image-centro">
          <h2 className="d-image-h2c" dangerouslySetInnerHTML={html(CASO.titulo)} />
          <p className="d-image-p">{CASO.sub}</p>
          <div className="d-image-testis">
            <div className="d-image-testi">
              <div className="d-image-testi-vid">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video muted autoPlay loop playsInline controls preload="metadata"><source src={CASO.video} type="video/mp4" /></video>
              </div>
              <span className="d-image-testi-quien"><i aria-hidden="true">{CASO.quien.slice(0, 1)}</i><span><b>{CASO.quien}</b><span>{CASO.rol}</span></span></span>
            </div>
            <div className="d-image-testi">
              {CASO.historia.map((h) => <p key={h} dangerouslySetInnerHTML={html(h)} />)}
            </div>
            <div className="d-image-testi">
              <p dangerouslySetInnerHTML={html(CASO.resultado)} />
              <ul className="d-image-testi-meses">
                {CASO.meses.map((m) => <li key={m.mes}><span>{m.mes}</span><b>{m.monto}</b></li>)}
              </ul>
            </div>
          </div>
          <div className="d-image-testis-btns"><a href={RUTA_CTA} className="d-image-btn">{TEXTO_CTA}<Flecha /></a></div>
        </section>
      );
    case 'preguntas':
      return (
        <section className="d-image-sec d-image-blanca d-image-centro d-image-faq-sec">
          <Cejilla texto="Preguntas" />
          <h2 className="d-image-h2c" dangerouslySetInnerHTML={html(b.titulo)} />
          <div className="d-image-faq">
            {b.items.map((q, i) => (
              <details key={q.p} className="d-image-faq-i" open={i === 0}>
                <summary><h3>{q.p}</h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg></summary>
                <p dangerouslySetInnerHTML={html(q.r)} />
              </details>
            ))}
          </div>
        </section>
      );
    case 'contraste':
    case 'filas':
    case 'logos':
      // Image no tiene estos bloques (PostNitro tampoco los tiene en esta página).
      return null;
  }
}

export default function DisenoImage({ landing }: PropsDiseno) {
  const hero = landing.bloques.find((b): b is Hero => b.tipo === 'hero');
  const otras = otrasFunciones(landing.slug);
  const columnas: { nombre: string; href: string }[][] = [];
  // Cuatro columnas, como las de PostNitro (Productos, Programación, Herramientas, Recursos).
  const porColumna = Math.ceil(otras.length / 4);
  for (let i = 0; i < otras.length; i += porColumna) columnas.push(otras.slice(i, i + porColumna));
  return (
    <div className="d-image">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="d-image-barra">
        <div className="d-image-barra-caja">
          <LogoMaKo className="d-image-logo" tamano={26} />
          <a href="/vsl" className="d-image-barra-link">Funcionalidades</a>
        </div>
        <div className="d-image-barra-caja">
          <a href={RUTA_CTA} className="d-image-barra-btn"><Lapiz />{TEXTO_CTA}</a>
        </div>
      </header>

      <main>
        {landing.bloques.map((b, i) => (
          <DibujarBloque key={`${b.tipo}-${i}`} b={b} hero={hero} icono={landing.icono} nombre={landing.nombre}
            n={landing.bloques.slice(0, i).filter((x) => x.tipo === b.tipo).length} />
        ))}
      </main>

      <footer className="d-image-pie">
        <div className="d-image-pie-in">
          <div className="d-image-pie-marca">
            <LogoMaKo tamano={36} />
            <p>El mejor SaaS para ventas High Ticket, de punta a punta.</p>
          </div>
          <div className="d-image-pie-cols">
            {columnas.map((col, i) => (
              <div key={i} className={i ? 'd-image-pie-sigue' : undefined}>
                {i === 0 ? <p className="d-image-pie-t">Funcionalidades</p> : null}
                <ul>{col.map((f) => <li key={f.href}><a href={f.href}>{f.nombre}</a></li>)}</ul>
              </div>
            ))}
          </div>
        </div>
        <div className="d-image-pie-base">
          <span>© MaKo — Todos los derechos reservados.</span>
          <span className="d-image-pie-legal"><a href="/terminos">Términos</a><a href="/privacidad">Privacidad</a></span>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
@font-face { font-family: 'DImgArchivo'; src: url('/vsl-assets/fuentes/archivo/archivo-latin-var.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
@font-face { font-family: 'DImgInstrument'; src: url('/vsl-assets/fuentes/instrument-sans/instrument-sans-latin-var.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'DImgMono'; src: url('/vsl-assets/fuentes/jetbrains-mono/jetbrains-mono-latin-var.woff2') format('woff2'); font-weight: 100 800; font-display: swap; }

.d-image { --d-img-tit: 'DImgArchivo', -apple-system, 'Segoe UI', sans-serif; --d-img-txt: 'DImgInstrument', -apple-system, 'Segoe UI', sans-serif; --d-img-mono: 'DImgMono', ui-monospace, Menlo, Consolas, monospace;
  --d-img-tinta: #07120F; --d-img-texto: #384843; --d-img-suave: #5A6C67; --d-img-borde: #D5E0DC; --d-img-gris: #F5F8F7; --d-img-azul: #2F6FED; --d-img-azul-osc: #1F57C8; --d-img-azul-claro: #8FB2F7;
  background: var(--d-img-gris); color: var(--d-img-texto); font-family: var(--d-img-txt); font-size: 16px; line-height: 25.6px; overflow-x: clip; }
.d-image *, .d-image *::before, .d-image *::after { box-sizing: border-box; }
.d-image :where(h1, h2, h3, p, ul, ol) { margin: 0; padding: 0; }
.d-image :where(ul, ol) { list-style: none; }
.d-image :where(a) { color: inherit; }
.d-image strong { font-weight: 600; color: var(--d-img-tinta); }

/* Barra: dos cajas blancas flotantes, radio 8, padding 4 / 8 */
.d-image-barra { position: sticky; top: 0; z-index: 30; display: flex; justify-content: space-between; gap: 16px; padding: 8px 13px; }
.d-image-barra-caja { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 8px; background: #fff; box-shadow: 0 1px 2px rgba(7,18,15,.06), 0 0 0 1px rgba(213,224,220,.6); }
.d-image-logo { margin-right: 8px; }
.d-image-logo span:last-child { font-family: var(--d-img-tit); font-weight: 700 !important; }
.d-image-barra-link { height: 28px; display: inline-flex; align-items: center; padding: 0 12px; border-radius: 8px; font-size: 13px; line-height: 13px; font-weight: 700; color: var(--d-img-tinta); text-decoration: none; transition: background-color .2s ease; }
.d-image-barra-link:hover { background: var(--d-img-gris); }
.d-image-barra-btn { height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 0 14px 0 9.3px; border-radius: 8px; background: var(--d-img-azul); color: #fff; font-size: 12px; line-height: 12px; font-weight: 600; text-decoration: none; white-space: nowrap; transition: background-color .2s ease; }
.d-image-barra-btn:hover { background: var(--d-img-azul-osc); }

/* Botones: alto 42, radio 8, 16 px 600 */
.d-image-btn { align-self: flex-start; height: 42px; display: inline-flex; align-items: center; gap: 8px; padding: 0 22px 0 14.67px; border-radius: 8px; background: var(--d-img-azul); color: #fff; font-size: 16px; line-height: 16px; font-weight: 600; text-decoration: none; white-space: nowrap; box-shadow: 0 1px 2px rgba(7,18,15,.12); transition: background-color .2s ease, transform .2s ease; }
.d-image-btn:hover { background: var(--d-img-azul-osc); transform: translateY(-1px); }
.d-image-btn-linea { background: #fff; color: var(--d-img-tinta); border: 1px solid var(--d-img-borde); padding: 0 12px 0 18px; }
.d-image-btn-linea:hover { background: var(--d-img-gris); }

/* Hero: dos columnas (574 px y la captura), gap 48, padding 0 72 */
.d-image-hero { padding: 92px 72px 72px; }
.d-image-hero-in { max-width: 1296px; margin: 0 auto; display: grid; grid-template-columns: 574px 1fr; gap: 48px; align-items: center; }
.d-image-hero-txt { display: flex; flex-direction: column; align-items: flex-start; }
.d-image-hero-cej { display: inline-flex; align-items: center; gap: 6.4px; height: 26px; padding: 0 12px; margin-bottom: 20.8px; border-radius: 8px; border: 1px solid var(--d-img-borde); background: #fff; font-size: 11px; line-height: 24px; font-weight: 700; letter-spacing: 0.66px; text-transform: uppercase; color: var(--d-img-texto); }
.d-image-hero-cej svg { color: var(--d-img-tinta); }
.d-image-h1 { font-family: var(--d-img-tit); font-size: 56px; line-height: 57.12px; font-weight: 800; letter-spacing: -1.792px; color: var(--d-img-tinta); }
.d-image-hero-p { margin-top: 16px; max-width: 527px; font-size: 18px; line-height: 27.9px; color: var(--d-img-texto); }
.d-image-hero-txt .d-image-btn { margin-top: 16px; }
.d-image-hero-nota { margin-top: 9px; font-size: 12px; line-height: 19.2px; color: var(--d-img-suave); }

/* El marco de selección: pestaña JetBrains 10 / 700 blanca sobre el color, borde de 1 px, cuadraditos de 7 px */
.d-image-marco { position: relative; display: flex; flex-direction: column; align-items: flex-start; }
.d-image-marco-tab { padding: 1.6px 6.72px; border-radius: 3px 3px 0 0; background: var(--d-img-azul); color: #fff; font-family: var(--d-img-mono); font-size: 10px; line-height: 16px; font-weight: 700; }
.d-image-marco-caja { position: relative; width: 100%; padding: 17.6px; border: 1px solid var(--d-img-azul); background: #fff; }
.d-image-esq { position: absolute; width: 7px; height: 7px; border: 1px solid var(--d-img-azul); background: #fff; }
.d-image-esq-1 { left: -4px; top: -4px; } .d-image-esq-2 { right: -4px; top: -4px; } .d-image-esq-3 { left: -4px; bottom: -4px; } .d-image-esq-4 { right: -4px; bottom: -4px; }
.d-image-fila .d-image-marco-caja { min-height: 365px; display: flex; align-items: center; justify-content: center; padding: 28px; background-color: #fff;
  background-image: linear-gradient(rgba(213,224,220,.45) 1px, transparent 1px), linear-gradient(90deg, rgba(213,224,220,.45) 1px, transparent 1px); background-size: 28px 28px; }
.d-image-fila .d-image-marco-caja > .mk-v-image { width: 100%; }
/* Qué parte del visual de Image va en cada marco. El del hero: las láminas y la franja de tu marca (como sus miniaturas y
   su «Kit de marca»); el chat va en su fila. */
.d-image-marco-hero .mk-v-image-chat, .d-image-marco-hero .mk-v-image-barra { display: none; }
.d-image-marco-hero .mk-v-image-editor { border: 0; box-shadow: none; padding: 0; }
.d-image-marco-hero .mk-v-image-laminas { padding-top: 0; }
.d-image-parte-formatos .mk-v-image-chat, .d-image-parte-formatos .mk-v-image-pie { display: none; }
.d-image-parte-chat .mk-v-image-editor { display: none; }
.d-image-parte-chat .mk-v-image-chat { max-width: 420px; margin: 0 auto; transform: scale(1.15); transform-origin: center; }
.d-image-parte-marca .mk-v-image-chat, .d-image-parte-marca .mk-v-image-barra, .d-image-parte-marca .mk-v-image-lam:not(.mk-v-image-lam-portada) { display: none; }
.d-image-parte-marca .mk-v-image-editor { width: 240px; margin: 0 auto; }
.d-image-parte-marca .mk-v-image-pags { display: none; }
.d-image-parte-marca .mk-v-image-marca { white-space: nowrap; }
.d-image-parte-marca .mk-v-image-laminas { grid-template-columns: 1fr; padding-top: 0; }
.d-image-parte-lienzo .mk-v-image-chat { display: none; }

/* Franja de prueba social: blanca, borde de 1 px arriba y abajo, padding 16.8 / 72 */
.d-image-franja { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px 25.6px; padding: 16.8px 72px; background: #fff; border-top: 1px solid var(--d-img-borde); border-bottom: 1px solid var(--d-img-borde); }
.d-image-franja-t { font-size: 13px; line-height: 20.8px; font-weight: 700; color: var(--d-img-tinta); padding-right: 25.6px; border-right: 1px solid var(--d-img-borde); }
.d-image-franja-l { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 28px; }
.d-image-franja-l li { display: flex; align-items: center; gap: 9.6px; font-size: 12px; line-height: 19.2px; color: var(--d-img-suave); }
.d-image-franja-l b { font-family: var(--d-img-tit); font-size: 22px; line-height: 24px; font-weight: 800; color: var(--d-img-tinta); }

/* Secciones: padding 96 / 72; blancas y grises alternadas */
.d-image-sec { padding: 96px 72px; }
.d-image-sec > * { max-width: 1296px; margin-left: auto; margin-right: auto; }
.d-image-blanca { background: #fff; border-top: 1px solid #EDF2F0; }
.d-image-gris { background: var(--d-img-gris); }
.d-image-centro { text-align: center; }
.d-image-centro > .d-image-cej, .d-image-centro > .d-image-h2c, .d-image-centro > .d-image-p { max-width: 768px; }
.d-image-cej { font-family: var(--d-img-mono); font-size: 11px; line-height: 17.6px; font-weight: 700; letter-spacing: 1.21px; text-transform: uppercase; color: var(--d-img-azul); margin-bottom: 12px; }
.d-image-cej-num { display: flex; align-items: center; gap: 10px; max-width: 768px; margin-bottom: 14px; font-family: var(--d-img-mono); font-size: 11px; line-height: 17.6px; font-weight: 700; letter-spacing: 1.21px; text-transform: uppercase; color: var(--d-img-texto); }
.d-image-cej-num span { color: var(--d-img-azul); }
.d-image-cej-num::after { content: ''; flex: 1; height: 1px; background: var(--d-img-borde); }
.d-image-h2c { font-family: var(--d-img-tit); font-size: 37.6px; line-height: 41.36px; font-weight: 800; letter-spacing: -0.9776px; color: var(--d-img-tinta); }
.d-image-h2 { max-width: 768px; font-family: var(--d-img-tit); font-size: 42.4px; line-height: 46.64px; font-weight: 600; letter-spacing: -0.848px; color: var(--d-img-tinta); }
.d-image-p { margin-top: 12px; font-size: 16.8px; line-height: 26.88px; color: var(--d-img-texto); }
.d-image-centro > .d-image-p { font-size: 16px; line-height: 25.6px; }
.d-image-cab { max-width: 1296px; }
.d-image-cab > * { max-width: 768px; }

/* Plantillas: miniaturas 4:5 con sombra, en grilla */
.d-image-plantillas { margin-top: 40px !important; display: grid; grid-template-columns: repeat(4, 220px); justify-content: center; gap: 18px; text-align: left; }
.d-image-plant { aspect-ratio: 4 / 5; display: flex; flex-direction: column; gap: 10px; padding: 16px 16px 18px; border-radius: 6px; box-shadow: 0 18px 30px -18px rgba(7,18,15,.45), 0 2px 6px rgba(7,18,15,.08); transition: transform .3s ease, box-shadow .3s ease; }
.d-image-plant:hover { transform: translateY(-4px) rotate(-0.6deg); box-shadow: 0 26px 40px -20px rgba(7,18,15,.5), 0 2px 6px rgba(7,18,15,.08); }
.d-image-plant-top { display: flex; justify-content: space-between; align-items: center; font-family: var(--d-img-mono); font-size: 10px; line-height: 16px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; opacity: .8; }
.d-image-plant b { margin-top: auto; font-family: var(--d-img-tit); font-size: 24px; line-height: 25px; font-weight: 800; letter-spacing: -0.6px; }
.d-image-plant-x { font-size: 13px; line-height: 18px; opacity: .86; }
.d-image-plant-0 { background: var(--d-img-tinta); color: #fff; }
.d-image-plant-1 { background: linear-gradient(160deg, #2F6FED, #1F57C8); color: #fff; }
.d-image-plant-2 { background: #F2B01E; color: var(--d-img-tinta); }
.d-image-plant-3 { background: #fff; color: var(--d-img-tinta); border: 1px solid var(--d-img-borde); }

/* Los tres pasos: «01 ——», título Archivo 18.4 / 600, texto 15.68 / 25.1, gap 43.2 */
.d-image-pasos { margin-top: 48px !important; display: grid; grid-template-columns: repeat(3, 1fr); gap: 43.2px; }
.d-image-pasos li { display: grid; gap: 13.6px; align-content: start; }
.d-image-paso-n { display: flex; align-items: center; gap: 13.6px; }
.d-image-paso-n b { font-family: var(--d-img-tit); font-size: 28px; line-height: 32px; font-weight: 600; color: var(--d-img-azul); }
.d-image-paso-n i { flex: 1; height: 1px; background: var(--d-img-borde); }
.d-image-paso-t { font-family: var(--d-img-tit); font-size: 18.4px; line-height: 23.92px; font-weight: 600; letter-spacing: -0.184px; color: var(--d-img-tinta); }
.d-image-paso-x { font-size: 15.68px; line-height: 25.09px; color: var(--d-img-texto); }
.d-image-sec > .d-image-btn-linea { display: flex; width: max-content; margin: 56px auto 0 0; }
@media (min-width: 1441px) { .d-image-sec > .d-image-btn-linea { margin-left: calc((100% - 1296px) / 2); } }

/* Filas de «01 DISEÑO»: dos columnas (619 px), gap 57.6, 86.4 entre filas */
.d-image-fila-sec { padding-top: 0; padding-bottom: 86.4px; }
.d-image-fila-primera { padding-top: 96px; }
.d-image-fila-primera .d-image-cab { margin-bottom: 64px; }
.d-image-fila-ultima { padding-bottom: 96px; }
.d-image-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 57.6px; align-items: center; }
.d-image-fila-inv .d-image-fila-txt { order: 2; }
.d-image-h3 { font-family: var(--d-img-tit); font-size: 27.2px; line-height: 32.64px; font-weight: 600; letter-spacing: -0.408px; color: var(--d-img-tinta); }
.d-image-fila-p { margin-top: 11px; font-size: 16px; line-height: 26.4px; color: var(--d-img-texto); }
.d-image-checks { margin-top: 28px; display: grid; gap: 18.4px; }
.d-image-fila-primera .d-image-checks { margin-top: 0; }
.d-image-checks li { display: grid; grid-template-columns: 20px 1fr; gap: 12.8px; align-items: start; }
.d-image-tilde { margin-top: 1px; color: var(--d-img-azul); }
.d-image-checks b { display: block; font-size: 16px; line-height: 22.4px; font-weight: 600; color: var(--d-img-tinta); }
.d-image-checks li > span > span { display: block; font-size: 15.2px; line-height: 23.56px; color: var(--d-img-texto); }
.d-image-checks .d-image-checks-meta { margin-top: 2px; font-family: var(--d-img-mono); font-size: 11px; line-height: 16px; letter-spacing: .3px; color: var(--d-img-suave); }

/* Tarjetas oscuras: #07120F, radio 9, padding 16 / 18.4 */
.d-image-oscuras { margin-top: 64px !important; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.d-image-oscura { padding: 16px 18.4px 18px; border-radius: 9px; background: var(--d-img-tinta); border: 1px solid var(--d-img-tinta); color: #9FB4AE; transition: transform .2s ease; }
.d-image-oscura:hover { transform: translateY(-2px); }
.d-image-oscura-h { display: flex; align-items: center; gap: 10px; color: var(--d-img-azul-claro); }
.d-image-oscura-h b { font-family: var(--d-img-tit); font-size: 15px; line-height: 18.75px; font-weight: 700; letter-spacing: -0.18px; color: #fff; }
.d-image-oscura p { margin-top: 12px; font-size: 13px; line-height: 19.5px; color: #9FB4AE; }

/* Testimonios: tarjetas grises con borde, radio 9 */
.d-image-testis { margin-top: 48px !important; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: start; text-align: left; }
.d-image-testi { display: grid; gap: 14px; padding: 20px; border-radius: 9px; background: var(--d-img-gris); border: 1px solid var(--d-img-borde); font-size: 14.4px; line-height: 22.3px; color: var(--d-img-texto); }
.d-image-testi-vid { position: relative; aspect-ratio: 848 / 480; border-radius: 6px; overflow: hidden; background: #000; }
.d-image-testi-vid video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.d-image-testi-quien { display: flex; align-items: center; gap: 10px; }
.d-image-testi-quien i { flex: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #E4EDFD; color: var(--d-img-azul); font-family: var(--d-img-mono); font-style: normal; font-size: 11px; font-weight: 700; }
.d-image-testi-quien b { display: block; font-size: 14px; line-height: 20px; font-weight: 600; color: var(--d-img-tinta); }
.d-image-testi-quien span span { display: block; font-size: 12.5px; line-height: 18px; color: var(--d-img-suave); }
.d-image-testi-meses { display: grid; gap: 6px; }
.d-image-testi-meses li { display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px solid var(--d-img-borde); font-size: 13px; }
.d-image-testi-meses b { font-family: var(--d-img-tit); font-weight: 800; color: var(--d-img-tinta); }
.d-image-testis-btns { margin-top: 32px !important; display: flex; justify-content: center; }

/* Preguntas: columna de 768 px, cada una con borde, radio 9; la abierta con el color */
.d-image-faq { margin-top: 40px !important; max-width: 768px; text-align: left; }
.d-image-faq-i { margin-bottom: 8px; border-radius: 9px; border: 1px solid var(--d-img-borde); background: #fff; transition: border-color .2s ease; }
.d-image-faq-i[open] { border-color: var(--d-img-azul); }
.d-image-faq-i summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13.6px 17.6px; color: var(--d-img-tinta); }
.d-image-faq-i summary::-webkit-details-marker { display: none; }
.d-image-faq-i summary h3 { font-size: 16px; line-height: 25.6px; font-weight: 700; color: var(--d-img-tinta); }
.d-image-faq-i summary svg { flex: none; color: var(--d-img-suave); transition: transform .2s ease; }
.d-image-faq-i[open] summary svg { transform: rotate(180deg); color: var(--d-img-azul); }
.d-image-faq-i p { padding: 0 17.6px 17.6px; font-size: 16px; line-height: 25.6px; color: var(--d-img-texto); }

/* Pie blanco: la marca a la izquierda y columnas con su título en JetBrains 10 / 700 */
.d-image-pie { background: #fff; border-top: 1px solid var(--d-img-borde); padding: 64px 72px 0; }
.d-image-pie-in { max-width: 1296px; margin: 0 auto; display: grid; grid-template-columns: 240px 1fr; gap: 64px; padding-bottom: 24px; }
.d-image-pie-marca p { margin-top: 18px; font-size: 14px; line-height: 21.7px; color: var(--d-img-suave); }
.d-image-pie-marca span:last-child { font-family: var(--d-img-tit); }
.d-image-pie-cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 31.7px; }
.d-image-pie-sigue { padding-top: 16px; }
.d-image-pie-t { min-height: 16px; font-family: var(--d-img-mono); font-size: 10px; line-height: 16px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; color: var(--d-img-suave); }
.d-image-pie-cols ul { margin-top: 13px; display: grid; gap: 5.6px; }
.d-image-pie-cols a { font-size: 13px; line-height: 18.85px; font-weight: 500; color: var(--d-img-texto); text-decoration: none; }
.d-image-pie-cols a:hover { color: var(--d-img-tinta); text-decoration: underline; }
.d-image-pie-base { max-width: 1296px; margin: 0 auto; padding: 18px 0 20px; border-top: 1px solid var(--d-img-borde); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; font-size: 13px; line-height: 18.85px; color: var(--d-img-suave); }
.d-image-pie-legal { display: flex; gap: 9.6px; }
.d-image-pie-legal a { color: var(--d-img-texto); text-decoration: none; }
.d-image-pie-legal a:hover { color: var(--d-img-tinta); text-decoration: underline; }

/* Entrada: el hero sube un poco al cargar (nada arranca invisible) */
@keyframes dImgSube { from { transform: translateY(12px); } to { transform: none; } }
.d-image-hero-txt, .d-image-marco-hero { animation: dImgSube .6s cubic-bezier(.2,.7,.2,1) both; }
.d-image-marco-hero { animation-delay: .08s; }
@media (prefers-reduced-motion: reduce) {
  .d-image *, .d-image *::before, .d-image *::after { animation: none !important; transition: none !important; }
}

@media (max-width: 1200px) {
  .d-image-hero-in { grid-template-columns: 1fr 1fr; }
  .d-image-plantillas { grid-template-columns: repeat(4, 1fr); }
}
/* Teléfono: los tamaños medidos a 390 px */
@media (max-width: 860px) {
  .d-image-barra { padding: 8px 12px; }
  .d-image-barra-link { display: none; }
  .d-image-hero { padding: 48px 20px 48px; }
  .d-image-hero-in { grid-template-columns: 1fr; gap: 40px; }
  .d-image-hero-txt { align-items: center; text-align: center; }
  .d-image-hero-txt .d-image-btn { align-self: center; }
  .d-image-hero-cej { height: auto; line-height: 18px; padding: 6px 12px; }
  .d-image-h1 { font-size: 33.6px; line-height: 34.27px; letter-spacing: -1.075px; }
  .d-image-hero-p { font-size: 16px; line-height: 25.6px; }
  .d-image-franja { padding: 16px 20px; }
  .d-image-franja-t { border-right: 0; padding-right: 0; width: 100%; }
  .d-image-franja { justify-content: flex-start; }
  .d-image-franja-l { display: grid; justify-content: start; gap: 8px; }
  .d-image-sec { padding: 64px 20px; }
  .d-image-h2c { font-size: 25.6px; line-height: 28.16px; letter-spacing: -0.6656px; }
  .d-image-h2 { font-size: 28px; line-height: 30.8px; letter-spacing: -0.56px; }
  .d-image-plantillas { grid-template-columns: 1fr 1fr; gap: 12px; }
  .d-image-plant { padding: 12px 12px 14px; }
  .d-image-plant b { font-size: 18px; line-height: 20px; }
  .d-image-plant-x { font-size: 11.5px; line-height: 15px; }
  .d-image-pasos { grid-template-columns: 1fr; gap: 32px; }
  .d-image-fila-sec { padding-top: 0; padding-bottom: 56px; }
  .d-image-fila-primera { padding-top: 64px; }
  .d-image-fila-ultima { padding-bottom: 64px; }
  .d-image-fila { grid-template-columns: 1fr; gap: 28px; }
  .d-image-fila .d-image-fila-txt { order: 2; }
  .d-image-fila .d-image-marco-caja { min-height: 0; padding: 18px; }
  .d-image-h3 { font-size: 20.8px; line-height: 24.96px; letter-spacing: -0.312px; }
  .d-image-parte-chat .mk-v-image-chat { transform: none; }
  .d-image-oscuras, .d-image-testis { grid-template-columns: 1fr; }
  .d-image-pie { padding: 40px 20px 0; }
  .d-image-pie-in { grid-template-columns: 1fr; gap: 36px; }
  .d-image-pie-cols { grid-template-columns: 1fr; gap: 0; }
  .d-image-pie-sigue { padding-top: 0; }
  .d-image-pie-sigue ul { margin-top: 5.6px; }
  .d-image-pie-base { flex-direction: column; }
}
`;
