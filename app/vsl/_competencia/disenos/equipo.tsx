// =============================================================================
// /vsl/equipo con el DISEÑO de la página «Equipos» de Pipedrive (https://www.pipedrive.com/es/features/teams)
// =============================================================================
// Leída el 16/11/2026 con el navegador del panel, a 1440 y a 390 px; los valores son los MEDIDOS (getComputedStyle), no a ojo:
//   · la página: blanca, tinta #192435, Inter (la suya; su titular va en Haffer, que no es libre: aquí va Inter 700, OFL, de
//     public/vsl-assets/fuentes/inter/); la caja de 1344 px con 48 de aire (20 en el teléfono), dos columnas de 644 con 40 entre ellas.
//   · el hero: su franja verde #D7F9D3 de 809 px; la cejilla en 14/700 mayúsculas y el H1 en 52/62 700, los dos en su verde #017737;
//     sus párrafos 18/30 en 645 px con 20 entre ellos; el botón de 56 px (22/32 700, padding 12/20, radio 4) y debajo su renglón 14/25;
//     la foto a la derecha. En el teléfono la foto va ARRIBA, el H1 baja a 32/42 y el botón ocupa todo el ancho.
//   · las secciones: H2 en 36/43 700 (30/38 en el teléfono), párrafos 18/30; «Qué buscar…» con su lista de cinco (el comienzo en
//     negrita, 40 px de sangría) a la derecha de su ilustración; «Funciones clave…» sobre #F7F7FE, tres columnas de 416 con 40 entre
//     ellas, cada tarjeta con su ícono de 72 px, el título 22/33 700 y el texto 18/30; las cuatro filas alternadas (la primera con el
//     texto a la derecha), «Más de 500 integraciones» centrada sobre #F7F7FE con su link 18/24 700 #413D99, su caso con la foto a la
//     derecha y el link #0D6ECE, sus preguntas centradas en 865 px (cada una 18/30 con 16 px arriba y abajo; la respuesta 14/25) y el
//     cierre verde con su H2 30/36 centrado, el botón y su renglón.
// De MaKo lleva sólo lo de ../marca.tsx: el logo, el botón para empezar (en el azul de MaKo: los colores de marca van en los botones,
// donde ella pone su violeta #6861F2) y los links al resto de las funciones en el pie copiado (que el sitio oculta: va el suyo, PieGlobal).
// Lo que NO se copió: su franja de calificaciones (G2, Capterra, Gartner) y sus testimonios (MaKo no los tiene), y su menú (va la barra
// del sitio, BarraGlobal; la copiada se oculta por su clase, BARRA_PROPIA de ../TemaSitio.tsx).
// Server component sin JS: las preguntas son <details>. Las fotos y el video van con data-tema-fijo: son pantallas de la app, y el sol y
// la luna no las toca.
// =============================================================================

import type { ReactNode } from 'react';
import type { Bloque } from '../tipos';
import type { PropsDiseno } from './index';
import { RUTA_CTA, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, CASO, html, otrasFunciones } from '../marca';
import { RENGLON_PLAN } from '../equipo';
import { ClosingCoaching } from '../../_sitio/ClosingNotas';
import { integracionesVivas, integracionesDeLaTira, LOGO_INTEGRACION, RUTA_INTEGRACIONES } from '../../_sitio/datos';

const P = 'd-equipo';

/** La grabación del hero: la sección Equipo REAL invitando a una closer (la misma de la fila de la portada). */
export const VIDEO_HERO_EQUIPO = { video: '/vsl-assets/sitio/equipo.webm', poster: '/vsl-assets/sitio/equipo.jpg' } as const;

/** Las pantallas REALES: Equipo y su modal (banco C:/dev/bancos-portada/banco-equipo-landing) y la hoja Closing (la de /vsl/closing,
 *  banco-closing-landing: números de ejemplo). Nombres ficticios. ⚠️ La ficha de una llamada (sus fortalezas, lo que hay que mejorar y
 *  el coaching) NO va en foto: lo escribe el análisis, y la que había era de una llamada INVENTADA. Va la animación (`FIGURAS_FILAS`). */
export const FOTOS_EQUIPO = {
  invitar: { src: '/vsl-assets/equipo/invitar.jpg', w: 900, h: 900, alt: '«Invitar al equipo» en MaKo: el correo y el nombre de Sofía Lara, y el rol abierto con sus tres opciones: Setter (CRM, WhatsApp, Email), Closer (CRM, WhatsApp, Closing) y Admin (todo el negocio)' },
  miembros: { src: '/vsl-assets/equipo/miembros.jpg', w: 1400, h: 912, alt: 'La sección Equipo de MaKo: cinco personas, cada una con su rol (una Admin, tres closers y una setter) y Sofía Lara con «invitación enviada»' },
  tasa: { src: '/vsl-assets/closing/hoja-tasa.jpg', w: 1412, h: 480, alt: 'La hoja Closing del Dashboard: la tasa de cierre del período y cuántas llamadas cerraron' },
  closers: { src: '/vsl-assets/closing/hoja-closers.jpg', w: 1002, h: 344, alt: 'La tasa de cierre de cada closer, de la más alta a la más baja' },
  rol: { src: '/vsl-assets/equipo/rol.jpg', w: 1400, h: 721, alt: 'El rol de Lucía Vega abierto en su fila de Equipo, con las tres opciones: Setter, Closer y Admin' },
  caso: { src: '/vsl-assets/caso-equipo.jpg', w: 959, h: 1280, alt: 'Mauricio con su equipo' },
} as const;

/** La figura de cada sección, en su orden: la de «Qué necesita…» y las de las cuatro filas (una por fila, como las suyas). La de lo
 *  que hace bien y corrige cada closer es el coaching que escribe el análisis: `'coaching'`, la animación de /vsl/closing con dos
 *  llamadas REALES de Mauricio (app/vsl/_sitio/ClosingNotas.tsx: el coaching de una y cómo quedó la de un mes después, sólo notas). */
export const FIGURA_QUE_NECESITA = 'invitar' as const;
export const FIGURAS_FILAS = [['miembros'], ['tasa', 'closers'], 'coaching', ['rol']] as const;

const CSS = `
@font-face{font-family:'d-equipo-inter';src:url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
.d-equipo-raiz{--de-tinta:#192435;--de-verde:#017737;--de-menta:#D7F9D3;--de-lila:#F7F7FE;--de-link:#0D6ECE;--de-link2:#413D99;
  background:#fff;color:var(--de-tinta);font-family:'d-equipo-inter',Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:18px;line-height:30px;-webkit-font-smoothing:antialiased;overflow-x:clip}
.d-equipo-raiz *,.d-equipo-raiz *::before,.d-equipo-raiz *::after{box-sizing:border-box}
.d-equipo-in{max-width:1440px;margin:0 auto;padding:0 48px}
.d-equipo-oculto{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.d-equipo-nav{height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px;background:#fff}
.d-equipo-nav ul{list-style:none;margin:0;padding:0;display:flex;align-items:center;gap:28px}
.d-equipo-nav a{color:var(--de-tinta);text-decoration:none;font-size:16px}
.d-equipo-hero{background:var(--de-menta)}
.d-equipo-hero .d-equipo-in{display:grid;grid-template-columns:minmax(0,645fr) minmax(0,659fr);column-gap:40px;align-items:center;padding-top:84px;padding-bottom:96px}
.d-equipo-ceja{margin:0 0 13px;font-size:14px;font-weight:700;line-height:17px;text-transform:uppercase;color:var(--de-verde)}
.d-equipo-h1{margin:0;font-size:52px;font-weight:700;line-height:62px;letter-spacing:-.01em;color:var(--de-verde);text-wrap:balance}
.d-equipo-p{margin:20px 0 0;max-width:645px;font-size:18px;line-height:30px}
.d-equipo-btn{display:inline-flex;align-items:center;justify-content:center;min-height:56px;margin-top:32px;padding:12px 20px;border-radius:4px;background:#2F6FED;color:#fff;font-size:22px;font-weight:700;line-height:32px;text-decoration:none;transition:background .15s}
.d-equipo-btn:hover{background:#1F57C8}
.d-equipo-chico{margin:12px 0 0;font-size:14px;line-height:25px}
.d-equipo-hero-vis{margin:0;justify-self:center;width:100%;max-width:600px;border-radius:8px;overflow:hidden;box-shadow:0 24px 48px -18px rgba(25,36,53,.28);background:#fff}
.d-equipo-hero-vis video{display:block;width:100%;height:auto;aspect-ratio:960/600}
.d-equipo-sec{padding:100px 0}
.d-equipo-lila{background:var(--de-lila)}
.d-equipo-par{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:40px;align-items:center}
.d-equipo-par.d-equipo-vuelta .d-equipo-copia{order:-1}
.d-equipo-h2{margin:0;font-size:36px;font-weight:700;line-height:43px;letter-spacing:-.005em;text-wrap:balance}
.d-equipo-lista{margin:20px 0 0;padding:0 0 0 40px}
.d-equipo-lista li{margin:0 0 10px;font-size:18px;line-height:30px}
.d-equipo-lista b{font-weight:700}
.d-equipo-figura{margin:0;justify-self:center;width:100%;max-width:560px;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 18px 40px -20px rgba(25,36,53,.35);border:1px solid #E6E8EE}
.d-equipo-figura img{display:block;width:100%;height:auto}
.d-equipo-figura.d-equipo-foto{max-width:420px}
.d-equipo-figura.d-equipo-anim{position:relative;max-width:644px;aspect-ratio:16/10}
@media (max-width:767px){.d-equipo-figura.d-equipo-anim{aspect-ratio:4/3}}
.d-equipo-figura.d-equipo-dos{display:grid;gap:12px;padding:16px;background:#F4F3EF}
.d-equipo-figura.d-equipo-dos img{border-radius:8px}
.d-equipo-figura.d-equipo-dos img+img{width:72%}
.d-equipo-tarjetas{list-style:none;margin:40px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 40px}
.d-equipo-tarjeta{padding-top:40px}
.d-equipo-icono{width:72px;height:72px;border-radius:50%;background:var(--de-menta);color:var(--de-verde);display:flex;align-items:center;justify-content:center}
.d-equipo-icono svg{width:38px;height:38px}
.d-equipo-h3{margin:22px 0 10px;font-size:22px;font-weight:700;line-height:33px}
.d-equipo-tarjeta p{margin:0;font-size:18px;line-height:30px}
.d-equipo-fila{padding:80px 0}
.d-equipo-a{color:var(--de-link);text-decoration:none}
.d-equipo-a:hover{text-decoration:underline}
.d-equipo-centro{text-align:center}
.d-equipo-integ .d-equipo-p{margin-left:auto;margin-right:auto;max-width:703px}
.d-equipo-logos{list-style:none;margin:28px 0 0;padding:0;display:flex;flex-wrap:wrap;justify-content:center;gap:14px}
.d-equipo-logos li{width:56px;height:56px;border-radius:14px;background:#fff;border:1px solid #E6E8EE;display:flex;align-items:center;justify-content:center}
.d-equipo-logos img{width:30px;height:30px;object-fit:contain}
.d-equipo-link2{display:inline-block;margin-top:26px;font-size:18px;font-weight:700;line-height:24px;color:var(--de-link2);text-decoration:none}
.d-equipo-cita{margin:24px 0 0;padding:0;font-size:18px;line-height:30px;font-style:italic}
.d-equipo-faq .d-equipo-h2{text-align:center}
.d-equipo-pregs{max-width:865px;margin:40px auto 0}
.d-equipo-preg{border-bottom:1px solid #DCDFE6}
.d-equipo-preg summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 0;font-size:18px;line-height:30px}
.d-equipo-preg summary::-webkit-details-marker{display:none}
.d-equipo-mas{flex:none;width:24px;height:24px;transition:transform .2s}
.d-equipo-preg[open] .d-equipo-mas{transform:rotate(180deg)}
.d-equipo-resp{margin:0;padding:0 0 18px;font-size:14px;line-height:25px}
.d-equipo-resp a{color:var(--de-link)}
.d-equipo-cierre{background:var(--de-menta);padding:80px 0;text-align:center}
.d-equipo-cierre-h{margin:0 auto;max-width:600px;font-size:30px;font-weight:700;line-height:36px}
.d-equipo-cierre .d-equipo-btn{margin-top:28px}
.d-equipo-cierre .d-equipo-chico{margin-top:16px}
.d-equipo-pie{padding:40px 0;border-top:1px solid #E6E8EE}
.d-equipo-pie ul{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:10px 22px}
.d-equipo-pie a{color:var(--de-tinta);font-size:14px;text-decoration:none}
/* El sol y la luna deja los colores de marca de tono medio como están (aModo, ../TemaSitio.tsx): su verde #017737 y sus links quedaban
   sobre la franja verde ya oscura con un contraste de 2,2 (medido). En el oscuro van sus versiones claras. */
html[data-sitio-modo="oscuro"] .d-equipo-ceja,html[data-sitio-modo="oscuro"] .d-equipo-h1,html[data-sitio-modo="oscuro"] .d-equipo-icono{color:#7FDCA4}
html[data-sitio-modo="oscuro"] .d-equipo-a,html[data-sitio-modo="oscuro"] .d-equipo-resp a{color:#7FB2F5}
html[data-sitio-modo="oscuro"] .d-equipo-link2{color:#B3B0F7}
@media (max-width:1023px){
  .d-equipo-tarjetas{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:767px){
  .d-equipo-in{padding:0 20px}
  .d-equipo-nav{height:72px}
  .d-equipo-nav ul li:not(:last-child){display:none}
  .d-equipo-hero .d-equipo-in,.d-equipo-par{grid-template-columns:minmax(0,1fr);row-gap:32px}
  .d-equipo-hero .d-equipo-in{padding-top:40px;padding-bottom:56px}
  .d-equipo-hero-vis{order:-1}
  .d-equipo-h1{font-size:32px;line-height:42px}
  .d-equipo-btn{display:flex;width:100%;text-align:center}
  .d-equipo-sec{padding:60px 0}
  .d-equipo-fila{padding:40px 0}
  .d-equipo-h2{font-size:30px;line-height:38px}
  .d-equipo-par .d-equipo-copia,.d-equipo-par.d-equipo-vuelta .d-equipo-copia{order:2}
  .d-equipo-lista{padding-left:22px}
  .d-equipo-tarjetas{grid-template-columns:minmax(0,1fr)}
  .d-equipo-cierre-h{font-size:28px;line-height:36px}
}
`;

const Boton = () => <a href={RUTA_CTA} className={`${P}-btn`}>{TEXTO_CTA}</a>;
const Icono = ({ d }: { d?: readonly string[] }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {(d ?? []).map((x) => <path key={x} d={x} />)}
  </svg>
);
const Flecha = () => (
  <svg className={`${P}-mas`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);

/** Una figura: una foto o dos (la hoja Closing: la tasa del período y la de cada closer, como en /vsl/closing). */
function Figura({ cuales }: { cuales: readonly (keyof typeof FOTOS_EQUIPO)[] }) {
  return (
    <figure className={`${P}-figura${cuales.length > 1 ? ` ${P}-dos` : ''}${cuales[0] === 'caso' ? ` ${P}-foto` : ''}`} data-tema-fijo="">
      {cuales.map((c) => {
        const f = FOTOS_EQUIPO[c];
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={f.src} src={f.src} alt={f.alt} width={f.w} height={f.h} loading="lazy" decoding="async" />;
      })}
    </figure>
  );
}

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;

/** Las secciones, en el orden de la landing (el de la suya). */
function secciones(bloques: Bloque[]): ReactNode[] {
  const out: ReactNode[] = [];
  let tarjetas = 0;
  bloques.forEach((b, k) => {
    if (b.tipo === 'hero') {
      out.push(
        <section key={k} className={`${P}-hero`}>
          <div className={`${P}-in`}>
            <div>
              <p className={`${P}-ceja`}>{b.etiqueta}</p>
              <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
              <p className={`${P}-p`} dangerouslySetInnerHTML={html(b.bajada)} />
              {(b.puntos ?? []).map((pt) => <p key={pt} className={`${P}-p`} dangerouslySetInnerHTML={html(pt)} />)}
              <Boton />
              <p className={`${P}-chico`}>{RENGLON_PLAN}</p>
            </div>
            <figure className={`${P}-hero-vis`} data-tema-fijo="">
              <video src={VIDEO_HERO_EQUIPO.video} poster={VIDEO_HERO_EQUIPO.poster} autoPlay muted loop playsInline preload="metadata" aria-label="La sección Equipo de MaKo: se invita a una closer con su correo, su nombre y su rol, y entra a la lista con su invitación enviada" />
            </figure>
          </div>
        </section>,
      );
      return;
    }
    if (b.tipo === 'tarjetas') {
      const t = b as Tarjetas;
      const n = tarjetas++;
      if (n === 0) {
        // «Qué buscar en un CRM para el trabajo en equipo»: la ilustración a la izquierda y la lista a la derecha.
        out.push(
          <section key={k} className={`${P}-sec`}>
            <div className={`${P}-in ${P}-par`}>
              <Figura cuales={[FIGURA_QUE_NECESITA]} />
              <div className={`${P}-copia`}>
                <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(t.titulo)} />
                {t.bajada && <p className={`${P}-p`} dangerouslySetInnerHTML={html(t.bajada)} />}
                <ul className={`${P}-lista`}>
                  {t.items.map((it) => <li key={it.titulo}><b dangerouslySetInnerHTML={html(it.titulo)} /> <span dangerouslySetInnerHTML={html(it.texto)} /></li>)}
                </ul>
              </div>
            </div>
          </section>,
        );
      } else {
        // «Funciones clave…»: seis tarjetas con su ícono, de a tres, sobre su franja lila.
        out.push(
          <section key={k} className={`${P}-sec ${P}-lila`}>
            <div className={`${P}-in`}>
              <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(t.titulo)} />
              <ul className={`${P}-tarjetas`}>
                {t.items.map((it) => (
                  <li key={it.titulo} className={`${P}-tarjeta`}>
                    <span className={`${P}-icono`}><Icono d={it.icono} /></span>
                    <h3 className={`${P}-h3`} dangerouslySetInnerHTML={html(it.titulo)} />
                    <p dangerouslySetInnerHTML={html(it.texto)} />
                  </li>
                ))}
              </ul>
            </div>
          </section>,
        );
      }
      return;
    }
    if (b.tipo === 'filas') {
      // Sus cuatro filas alternadas: la primera con el texto a la derecha (la ilustración a la izquierda), como la suya.
      out.push(<h2 key={`${k}-h`} className={`${P}-oculto`} dangerouslySetInnerHTML={html(b.titulo)} />);
      b.items.forEach((it, i) => {
        const fig = FIGURAS_FILAS[i];
        out.push(
          <section key={`${k}-${i}`} className={`${P}-fila`}>
            <div className={`${P}-in ${P}-par${i % 2 ? ` ${P}-vuelta` : ''}`}>
              {fig === 'coaching' ? (
                <figure className={`${P}-figura ${P}-anim`} data-tema-fijo="" data-animacion="coaching"><ClosingCoaching /></figure>
              ) : <Figura cuales={fig ?? []} />}
              <div className={`${P}-copia`}>
                <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(it.titulo)} />
                <p className={`${P}-p`} dangerouslySetInnerHTML={html(it.texto)} />
                {(it.puntos ?? []).map((pt) => <p key={pt} className={`${P}-p`} dangerouslySetInnerHTML={html(pt)} />)}
              </div>
            </div>
          </section>,
        );
      });
      return;
    }
    if (b.tipo === 'logos') {
      // «Más de 500 integraciones»: el número de MaKo, contado, y los logos de las apps de la tira de la portada.
      const n = integracionesVivas().length;
      out.push(
        <section key={k} className={`${P}-sec ${P}-lila ${P}-centro ${P}-integ`}>
          <div className={`${P}-in`}>
            <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
            <p className={`${P}-p`}>{n} integraciones: tus anuncios, tus chats, tu agenda, tus reuniones y tus cobros, en la misma app que usa tu equipo.</p>
            <ul className={`${P}-logos`} aria-label="Algunas de las apps que se conectan">
              {integracionesDeLaTira().filter((d) => LOGO_INTEGRACION[d.key]).map((d) => (
                // eslint-disable-next-line @next/next/no-img-element
                <li key={d.key}><img src={`/vsl-assets/logos/integraciones/${LOGO_INTEGRACION[d.key]}`} alt={d.nombre} width={30} height={30} /></li>
              ))}
            </ul>
            <a className={`${P}-link2`} href={RUTA_INTEGRACIONES}>Mira todas tus integraciones</a>
          </div>
        </section>,
      );
      return;
    }
    if (b.tipo === 'caso') {
      // Su caso de estudio: el titular, la historia, la cita y su link, con la foto a la derecha.
      out.push(
        <section key={k} className={`${P}-sec`}>
          <div className={`${P}-in ${P}-par`}>
            <div className={`${P}-copia`} style={{ order: -1 }}>
              <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(CASO.titulo)} />
              {CASO.historia.map((h) => <p key={h} className={`${P}-p`} dangerouslySetInnerHTML={html(h)} />)}
              <p className={`${P}-cita`} dangerouslySetInnerHTML={html(`«${CASO.sub}»`)} />
              <p className={`${P}-p`}><a className={`${P}-a`} href="/#caso">Mira el caso de {CASO.quien}</a></p>
            </div>
            <Figura cuales={['caso']} />
          </div>
        </section>,
      );
      return;
    }
    if (b.tipo === 'preguntas') {
      out.push(
        <section key={k} className={`${P}-sec ${P}-lila ${P}-faq`}>
          <div className={`${P}-in`}>
            <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
            <div className={`${P}-pregs`}>
              {b.items.map((q) => (
                <details key={q.p} className={`${P}-preg`}>
                  <summary><span dangerouslySetInnerHTML={html(q.p)} /><Flecha /></summary>
                  <p className={`${P}-resp`} dangerouslySetInnerHTML={html(q.r)} />
                </details>
              ))}
            </div>
          </div>
        </section>,
      );
    }
    // Esta landing no tiene otros tipos de bloque.
  });
  return out;
}

export default function DisenoEquipo({ landing }: PropsDiseno) {
  const otras = otrasFunciones(landing.slug);
  return (
    <div className={`${P}-raiz`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className={`${P}-nav`}>
        <div className={`${P}-in`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <LogoMaKo tamano={30} />
          <ul>
            <li><a href="/planes">Precios</a></li>
            <li><a href={RUTA_CTA}>{TEXTO_CTA}</a></li>
          </ul>
        </div>
      </header>
      <main>
        {secciones(landing.bloques)}
        {/* «Obtén mejores resultados con un CRM para el trabajo en equipo», su botón y su renglón. */}
        <section className={`${P}-cierre`}>
          <div className={`${P}-in`}>
            <h2 className={`${P}-cierre-h`}>Vende más con tu equipo en MaKo</h2>
            <Boton />
            <p className={`${P}-chico`} dangerouslySetInnerHTML={html(TEXTO_CIERRE)} />
          </div>
        </section>
      </main>
      <footer className={`${P}-pie`}>
        <div className={`${P}-in`}>
          <LogoMaKo tamano={26} />
          <ul aria-label="Las otras funciones de MaKo">
            {otras.map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}
          </ul>
        </div>
      </footer>
    </div>
  );
}
