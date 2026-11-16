// =============================================================================
// /vsl/calendario con el DISEÑO de la página del planificador de Metricool (https://metricool.com/es/planificador/)
// =============================================================================
// Leída el 16/11/2026 con el navegador del panel, a 1440 y a 390 px; los valores son los MEDIDOS (getComputedStyle), no a ojo:
//   · la página: blanca, tinta #2D1A29 (ciruela), Plus Jakarta Sans. ⚠️ Esa letra (OFL) no está en public/vsl-assets/fuentes/ y bajar
//     archivos no estaba permitido en esta tanda: va Figtree (la más cercana de las que hay) hasta que se sume; es un renglón de @font-face.
//     La caja de 1344 px con 48 de aire (16 en el teléfono).
//   · el hero: el H1 enorme y centrado, 96/115,2 500 en 1150 px (30/36 en el teléfono); la bajada 24/28,8 en 881 px; el botón de 72 px
//     (20/24 700, padding 24/40, radio 16) y su renglón 14/16,8; debajo, la captura grande del planificador (1136 px) con una publicación
//     flotando arriba a la derecha (299 px, 184 px por encima de la captura), y «Publica sin límites…» 20/26 sobre su tira de logos de
//     50 px con 15 entre ellos, que se desliza. En el teléfono la captura se desborda a los lados (538 px de 358).
//   · «Posts, stories, reels…»: su dibujo a la izquierda y, a la derecha (599 px), el renglón 20/24 y la frase grande en 32 y 40 px.
//   · «Más que un calendario»: la imagen alta a la izquierda (577 px) y, a la derecha (680 px), el H2 64/76,8 500, su bajada 20/24, sus
//     tres pestañas 20/28 (la elegida en 700) y sus funciones de a dos (285 px), cada una con su ícono de 30 px, el título en MAYÚSCULAS
//     14,4/17,28 700 y el texto 14,4/17,28 (12,8 en el teléfono, de a una).
//   · «Planifica sin caos…»: el H2 64/76,8 400 a todo el ancho, su bajada 20/24 en 1000 px, su ilustración pegada a la izquierda (617 px)
//     y la lista 01-05 a la derecha, con el botón al final; sus testimonios: el H2 64/76,8 500 en 506 px a la izquierda y la tarjeta a la
//     derecha (el nombre 24/31,2 500, el rol 16/19,2 #4A5568, el título 20/24).
// De MaKo lleva sólo lo de ../marca.tsx: el logo, el botón para empezar (en el azul de MaKo, donde ella pone su ciruela con letra lima:
// los colores de marca van en los botones) y los links al resto de las funciones en el pie copiado (que el sitio oculta: va PieGlobal).
// Lo que NO se copió: su muro de logos de clientes y sus reseñas de G2 (MaKo no los tiene), el fondo dibujado de su hero (es suyo) y su
// menú (va la barra del sitio, BarraGlobal; la copiada se oculta por su clase, BARRA_PROPIA de ../TemaSitio.tsx).
// Server component sin JS: las pestañas son radios con :checked y la tira se desliza con CSS (quieta con «reducir movimiento»). Las
// fotos y el video van con data-tema-fijo: son pantallas de la app, y el sol y la luna no las toca.
// =============================================================================

import type { ReactNode } from 'react';
import type { Bloque } from '../tipos';
import type { PropsDiseno } from './index';
import { RUTA_CTA, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, CASO, html, otrasFunciones } from '../marca';
import { BrandDefs, SvcIcon } from '@/app/_components/ServicioVisual';
import { REDES_PUBLICAR, ROTULO_RED, type RedPublicar } from '@/lib/calendario-publicar-reglas';

const P = 'd-calendario';

/** Las pantallas REALES del Calendario y del Marketing CoPilot, con la semana de ejemplo del banco
 *  (C:/dev/bancos-portada/banco-calendario-landing: fotos.mjs). Nombres ficticios. */
export const FOTOS_CALENDARIO = {
  semana: { src: '/vsl-assets/calendario/semana.jpg', w: 1600, h: 1000, alt: 'El Calendario de MaKo en la vista Semana: seis publicaciones (reels, carruseles, una story y un video), una llamada de venta, una sesión de entrega y un deadline del Plan, con sus cuatro usos arriba y «Programar publicaciones»' },
  evento: { src: '/vsl-assets/calendario/evento.jpg', w: 900, h: 1093, alt: 'Una publicación abierta en el Calendario: un reel del jueves a las 10, «Publicar en la red» en Instagram, el video subido, el texto y el botón «Programar»' },
  serie: { src: '/vsl-assets/calendario/serie.jpg', w: 1600, h: 1000, alt: '«Programar en serie» sobre la semana: se programan las seis publicaciones de la vista, que salen solas a su hora' },
  copiloto: { src: '/vsl-assets/calendario/copiloto.jpg', w: 1200, h: 663, alt: '«Esta semana» del Marketing CoPilot: dos reels, dos carruseles, stories casi todos los días y programar la semana, cada uno con su botón' },
} as const;

/** La grabación de la lista 01-05 (la misma de la fila de la portada): «Programar publicaciones» sobre la semana real. */
export const VIDEO_CALENDARIO = { video: '/vsl-assets/sitio/calendario.webm', poster: '/vsl-assets/sitio/calendario.jpg' } as const;

/** El logo de cada red en la app (las llaves de ICON de app/_components/ServicioVisual.tsx). */
export const LOGO_RED: Readonly<Record<RedPublicar, string>> = {
  instagram: 'red-instagram', facebook: 'red-facebook', tiktok: 'red-tiktok', youtube: 'youtube',
  linkedin: 'red-linkedin', twitter: 'red-twitter', threads: 'red-threads', googlebusiness: 'red-googlebusiness',
};

const CSS = `
@font-face{font-family:'d-calendario-sans';src:url('/vsl-assets/fuentes/figtree/figtree-latin.woff2') format('woff2');font-weight:300 900;font-style:normal;font-display:swap}
.d-calendario-raiz{--dk-tinta:#2D1A29;--dk-gris:#4A5568;background:#fff;color:var(--dk-tinta);font-family:'d-calendario-sans','Plus Jakarta Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.3;-webkit-font-smoothing:antialiased;overflow-x:clip}
.d-calendario-raiz *,.d-calendario-raiz *::before,.d-calendario-raiz *::after{box-sizing:border-box}
.d-calendario-in{max-width:1440px;margin:0 auto;padding:0 48px}
.d-calendario-oculto{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.d-calendario-nav{height:96px;display:flex;align-items:center}
.d-calendario-nav .d-calendario-in{display:flex;align-items:center;justify-content:space-between;width:100%}
.d-calendario-nav ul{list-style:none;margin:0;padding:0;display:flex;align-items:center;gap:28px}
.d-calendario-nav a{color:var(--dk-tinta);text-decoration:none;font-size:16px}
.d-calendario-hero{padding:32px 0 0;text-align:center}
.d-calendario-h1{margin:0 auto;max-width:1150px;font-size:96px;font-weight:500;line-height:1.2;letter-spacing:-.02em;text-wrap:balance}
.d-calendario-bajada{margin:18px auto 0;max-width:881px;font-size:24px;line-height:1.2}
.d-calendario-btn{display:inline-flex;align-items:center;justify-content:center;min-height:72px;padding:24px 40px;border-radius:16px;background:#2F6FED;color:#fff;font-size:20px;font-weight:700;line-height:24px;text-decoration:none;transition:background .15s}
.d-calendario-btn:hover{background:#1F57C8}
.d-calendario-hero .d-calendario-btn{margin-top:15px}
.d-calendario-chico{margin:12px 0 0;font-size:14px;line-height:1.2}
.d-calendario-escena{position:relative;max-width:1136px;margin:112px auto 0}
.d-calendario-captura{margin:0;border-radius:18px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(45,26,41,.45);border:1px solid #ECE7EB;background:#fff}
.d-calendario-captura img{display:block;width:100%;height:auto}
.d-calendario-flota{position:absolute;right:-20px;top:-184px;width:299px;margin:0;border-radius:16px;overflow:hidden;box-shadow:0 24px 50px -16px rgba(45,26,41,.45);border:1px solid #ECE7EB;background:#fff}
.d-calendario-flota img{display:block;width:100%;height:auto}
.d-calendario-redes{margin:33px auto 0;max-width:1134px;font-size:20px;line-height:1.3}
.d-calendario-tira{margin:24px 0 0;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.d-calendario-tira ul{list-style:none;margin:0;padding:0;display:flex;gap:15px;width:max-content;animation:d-calendario-desliza 30s linear infinite}
.d-calendario-tira li{flex:none;width:50px;height:50px;display:flex;align-items:center;justify-content:center}
@keyframes d-calendario-desliza{to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.d-calendario-tira ul{animation:none}}
.d-calendario-sec{padding:112px 0 0}
.d-calendario-par{display:grid;grid-template-columns:minmax(0,552fr) minmax(0,744fr);column-gap:48px;align-items:center}
.d-calendario-figura{margin:0;border-radius:16px;overflow:hidden;border:1px solid #ECE7EB;background:#fff;box-shadow:0 20px 44px -24px rgba(45,26,41,.4)}
.d-calendario-figura img,.d-calendario-figura video{display:block;width:100%;height:auto}
.d-calendario-renglon{margin:0;max-width:600px;font-size:20px;line-height:24px}
.d-calendario-frase{margin:22px 0 0;max-width:600px;font-size:40px;font-weight:500;line-height:1.15;letter-spacing:-.01em}
.d-calendario-nota{margin:18px 0 0;max-width:600px;font-size:16px;line-height:1.35;color:var(--dk-gris)}
.d-calendario-h2{margin:0;font-size:64px;font-weight:500;line-height:1.2;letter-spacing:-.02em;text-wrap:balance}
.d-calendario-sub{margin:20px 0 0;max-width:1000px;font-size:20px;line-height:24px}
.d-calendario-mas .d-calendario-par{grid-template-columns:minmax(0,577fr) minmax(0,680fr);column-gap:87px;align-items:start}
.d-calendario-tabs{margin-top:36px}
.d-calendario-radio{position:absolute;opacity:0;pointer-events:none}
.d-calendario-pestanas{display:flex;gap:40px;border-bottom:1px solid #ECE7EB}
.d-calendario-pestana{cursor:pointer;padding:12px 0;font-size:20px;line-height:28px;border-bottom:2px solid transparent;margin-bottom:-1px}
.d-calendario-panel{display:none;list-style:none;margin:30px 0 0;padding:0;grid-template-columns:repeat(2,minmax(0,285px));gap:30px 29px}
.d-calendario-tile svg{width:30px;height:30px;display:block}
.d-calendario-tile b{display:block;margin-top:10px;font-size:14.4px;font-weight:700;line-height:17.28px;text-transform:uppercase}
.d-calendario-tile span{display:block;margin-top:6px;font-size:14.4px;line-height:17.28px}
.d-calendario-pasos .d-calendario-par{grid-template-columns:minmax(0,617fr) minmax(0,680fr);column-gap:47px;align-items:start;margin-top:56px}
.d-calendario-pasos .d-calendario-figura{position:sticky;top:120px}
.d-calendario-lista{list-style:none;margin:0;padding:0}
.d-calendario-lista li{display:grid;grid-template-columns:72px minmax(0,1fr);gap:16px;align-items:baseline;padding:26px 0;border-bottom:1px solid #ECE7EB;font-size:24px;line-height:1.3}
.d-calendario-lista li:first-child{padding-top:0}
.d-calendario-num{font-size:40px;font-weight:300;line-height:1}
.d-calendario-lista a{color:inherit;text-decoration:underline;text-underline-offset:3px}
.d-calendario-pasos .d-calendario-btn{margin-top:40px}
.d-calendario-caso .d-calendario-par{grid-template-columns:minmax(0,506fr) minmax(0,839fr);column-gap:48px;align-items:start}
.d-calendario-caso .d-calendario-sub{font-size:14.4px;line-height:17.28px}
.d-calendario-tarjeta{border-radius:24px;background:#F7F4F6;padding:28px 32px}
.d-calendario-quien{margin:0;font-size:24px;font-weight:500;line-height:31.2px}
.d-calendario-rol{margin:6px 0 0;font-size:16px;line-height:19.2px;color:var(--dk-gris)}
.d-calendario-tit{margin:22px 0 0;font-size:20px;line-height:24px}
.d-calendario-cita{margin:14px 0 0;font-size:16px;line-height:1.45}
.d-calendario-tarjeta a{display:inline-block;margin-top:16px;color:var(--dk-gris);font-size:16px}
.d-calendario-fin{padding:112px 0 96px}
.d-calendario-pie{padding:40px 0;border-top:1px solid #ECE7EB}
.d-calendario-pie ul{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:10px 22px}
.d-calendario-pie a{color:var(--dk-tinta);font-size:14px;text-decoration:none}
@media (max-width:1100px){
  .d-calendario-h1{font-size:72px}
  .d-calendario-h2{font-size:48px}
  .d-calendario-flota{width:240px;right:0}
}
@media (max-width:767px){
  .d-calendario-in{padding:0 16px}
  .d-calendario-nav{height:72px}
  .d-calendario-nav ul li:not(:last-child){display:none}
  .d-calendario-hero{padding-top:24px}
  .d-calendario-h1{font-size:30px;line-height:36px}
  .d-calendario-bajada{font-size:18px;line-height:21.6px}
  .d-calendario-btn{display:flex;width:100%}
  .d-calendario-escena{margin:150px -90px 0;max-width:none}
  .d-calendario-flota{width:130px;top:-140px;right:100px}
  .d-calendario-redes{font-size:17.6px;line-height:21px}
  .d-calendario-sec{padding-top:64px}
  .d-calendario-par,.d-calendario-mas .d-calendario-par,.d-calendario-pasos .d-calendario-par,.d-calendario-caso .d-calendario-par{grid-template-columns:minmax(0,1fr);row-gap:28px}
  .d-calendario-renglon{font-size:17.6px;line-height:21px}
  .d-calendario-frase{font-size:24px}
  .d-calendario-h2{font-size:28px;line-height:33.6px}
  .d-calendario-sub{font-size:17.6px;line-height:21px}
  .d-calendario-pestanas{flex-wrap:wrap;gap:0 18px}
  .d-calendario-pestana{font-size:16px;white-space:nowrap}
  .d-calendario-panel{grid-template-columns:minmax(0,1fr);gap:22px}
  .d-calendario-tile b,.d-calendario-tile span{font-size:12.8px;line-height:15.36px}
  .d-calendario-pasos .d-calendario-figura{position:static}
  .d-calendario-lista li{grid-template-columns:48px minmax(0,1fr);font-size:18px}
  .d-calendario-num{font-size:28px}
  .d-calendario-tarjeta{padding:22px 20px}
  .d-calendario-fin{padding:64px 0 56px}
}
`;

/** Las tres pestañas: la elegida en 700 y su panel a la vista (sin JS: radios con :checked). */
const cssPestanas = (n: number) => Array.from({ length: n }, (_, i) =>
  `#${P}-t${i}:checked~.${P}-pestanas label[for="${P}-t${i}"]{font-weight:700;border-bottom-color:currentColor}#${P}-t${i}:checked~.${P}-p${i}{display:grid}`).join('');

const Boton = () => <a href={RUTA_CTA} className={`${P}-btn`}>{TEXTO_CTA}</a>;
/** El ícono de cada función de las pestañas: un calendario con su tilde («calendar-check» de Tabler, MIT), como los suyos de 30 px. */
const IconoTile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11.5 21h-5.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M15 19l2 2l4 -4" />
  </svg>
);

function Foto({ f, clase = `${P}-figura` }: { f: (typeof FOTOS_CALENDARIO)[keyof typeof FOTOS_CALENDARIO]; clase?: string }) {
  return (
    <figure className={clase} data-tema-fijo="">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={f.src} alt={f.alt} width={f.w} height={f.h} loading="lazy" decoding="async" />
    </figure>
  );
}

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;

/** Las secciones, en el orden de la landing (el de la suya). */
function secciones(bloques: Bloque[]): ReactNode[] {
  const out: ReactNode[] = [];
  bloques.forEach((b, k) => {
    if (b.tipo === 'hero') {
      // La tira se dibuja dos veces seguidas: se desliza hasta la mitad y vuelve sin corte (sin lazy: la copia no «entra» nunca).
      const redes = [...REDES_PUBLICAR, ...REDES_PUBLICAR];
      out.push(
        <section key={k} className={`${P}-hero`}>
          <div className={`${P}-in`}>
            <p className={`${P}-oculto`}>{b.etiqueta}</p>
            <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
            <p className={`${P}-bajada`} dangerouslySetInnerHTML={html(b.bajada)} />
            <Boton />
            <p className={`${P}-chico`} dangerouslySetInnerHTML={html(TEXTO_CIERRE)} />
            <div className={`${P}-escena`}>
              <figure className={`${P}-captura`} data-tema-fijo="">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FOTOS_CALENDARIO.semana.src} alt={FOTOS_CALENDARIO.semana.alt} width={FOTOS_CALENDARIO.semana.w} height={FOTOS_CALENDARIO.semana.h} decoding="async" fetchPriority="high" />
              </figure>
              <Foto f={FOTOS_CALENDARIO.evento} clase={`${P}-flota`} />
            </div>
            {(b.puntos ?? []).map((pt) => <p key={pt} className={`${P}-redes`} dangerouslySetInnerHTML={html(pt)} />)}
          </div>
          <div className={`${P}-tira`} aria-label={`Las redes donde publica: ${REDES_PUBLICAR.map((r) => ROTULO_RED[r]).join(', ')}`}>
            <ul>
              {redes.map((r, i) => <li key={`${r}-${i}`} title={ROTULO_RED[r]} aria-hidden={i >= REDES_PUBLICAR.length ? true : undefined}><SvcIcon k={LOGO_RED[r]} size={28} box={50} radius={14} /></li>)}
            </ul>
          </div>
        </section>,
      );
      return;
    }
    if (b.tipo === 'contraste') {
      // «Posts, stories, reels…»: el dibujo a la izquierda (aquí, «Esta semana» del CoPilot) y el renglón con la frase grande.
      out.push(
        <section key={k} className={`${P}-sec`}>
          <div className={`${P}-in ${P}-par`}>
            <Foto f={FOTOS_CALENDARIO.copiloto} />
            <div>
              <p className={`${P}-renglon`}><span dangerouslySetInnerHTML={html(b.sin.titulo)} /> <span dangerouslySetInnerHTML={html(b.sin.texto)} /></p>
              <h2 className={`${P}-frase`} dangerouslySetInnerHTML={html(b.titulo)} />
              <p className={`${P}-nota`}><b dangerouslySetInnerHTML={html(b.con.titulo)} />: <span dangerouslySetInnerHTML={html(b.con.texto)} /></p>
            </div>
          </div>
        </section>,
      );
      return;
    }
    if (b.tipo === 'tarjetas') {
      // «Más que un calendario»: la imagen a la izquierda y, a la derecha, sus tres pestañas con sus funciones de a dos.
      const t = b as Tarjetas;
      out.push(
        <section key={k} className={`${P}-sec ${P}-mas`}>
          <style dangerouslySetInnerHTML={{ __html: cssPestanas(t.items.length) }} />
          <div className={`${P}-in ${P}-par`}>
            <Foto f={FOTOS_CALENDARIO.serie} />
            <div>
              <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(t.titulo)} />
              {t.bajada && <p className={`${P}-sub`} dangerouslySetInnerHTML={html(t.bajada)} />}
              <div className={`${P}-tabs`}>
                {t.items.map((_, i) => <input key={i} type="radio" name={`${P}-tabs`} id={`${P}-t${i}`} className={`${P}-radio`} defaultChecked={i === 0} />)}
                <div className={`${P}-pestanas`}>
                  {t.items.map((it, i) => <label key={it.titulo} htmlFor={`${P}-t${i}`} className={`${P}-pestana`} dangerouslySetInnerHTML={html(it.titulo)} />)}
                </div>
                {t.items.map((it, i) => (
                  <ul key={it.titulo} className={`${P}-panel ${P}-p${i}`}>
                    {(it.puntos ?? []).map((pt) => {
                      const [tit, tx] = pt.split('|');
                      return <li key={pt} className={`${P}-tile`}><IconoTile /><b dangerouslySetInnerHTML={html(tit)} /><span dangerouslySetInnerHTML={html(tx ?? '')} /></li>;
                    })}
                  </ul>
                ))}
              </div>
            </div>
          </div>
        </section>,
      );
      return;
    }
    if (b.tipo === 'pasos') {
      // «Planifica sin caos…»: el H2 a todo el ancho, la grabación pegada a la izquierda y la lista 01-05 con el botón.
      out.push(
        <section key={k} className={`${P}-sec ${P}-pasos`}>
          <div className={`${P}-in`}>
            <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(b.titulo)} />
            {b.bajada && <p className={`${P}-sub`} dangerouslySetInnerHTML={html(b.bajada)} />}
            <div className={`${P}-par`}>
              <figure className={`${P}-figura`} data-tema-fijo="">
                <video src={VIDEO_CALENDARIO.video} poster={VIDEO_CALENDARIO.poster} autoPlay muted loop playsInline preload="metadata" aria-label="El Calendario de MaKo: «Programar publicaciones» programa de una vez las seis publicaciones de la semana" />
              </figure>
              <div>
                <ol className={`${P}-lista`}>
                  {b.pasos.map((ps, i) => <li key={ps.titulo}><span className={`${P}-num`}>{String(i + 1).padStart(2, '0')}</span><span dangerouslySetInnerHTML={html(ps.titulo)} /></li>)}
                </ol>
                <Boton />
              </div>
            </div>
          </div>
        </section>,
      );
      return;
    }
    if (b.tipo === 'caso') {
      // Sus testimonios: el H2 a la izquierda con su renglón, y la tarjeta a la derecha (aquí, el caso de Mauricio).
      out.push(
        <section key={k} className={`${P}-sec ${P}-caso ${P}-fin`}>
          <div className={`${P}-in ${P}-par`}>
            <div>
              <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(CASO.titulo)} />
              <p className={`${P}-sub`} dangerouslySetInnerHTML={html(CASO.sub)} />
            </div>
            <div className={`${P}-tarjeta`}>
              <p className={`${P}-quien`}>{CASO.quien}</p>
              <p className={`${P}-rol`}>{CASO.rol}</p>
              <p className={`${P}-tit`} dangerouslySetInnerHTML={html(CASO.resultado)} />
              {CASO.historia.map((h) => <p key={h} className={`${P}-cita`} dangerouslySetInnerHTML={html(h)} />)}
              <a href="/#caso">Mira su historia</a>
            </div>
          </div>
        </section>,
      );
    }
    // Esta landing no tiene otros tipos de bloque (su referencia no tiene preguntas frecuentes).
  });
  return out;
}

export default function DisenoCalendario({ landing }: PropsDiseno) {
  const otras = otrasFunciones(landing.slug);
  return (
    <div className={`${P}-raiz`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <BrandDefs />
      <header className={`${P}-nav`}>
        <div className={`${P}-in`}>
          <LogoMaKo tamano={30} />
          <ul>
            <li><a href="/planes">Precios</a></li>
            <li><a href={RUTA_CTA}>{TEXTO_CTA}</a></li>
          </ul>
        </div>
      </header>
      <main>{secciones(landing.bloques)}</main>
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
