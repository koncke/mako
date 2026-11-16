// =============================================================================
// /vsl/second-brain con el DISEÑO de la portada de Obsidian (https://obsidian.md/)
// =============================================================================
// Leída el 16/11/2026 con el navegador del panel, a 1440 y a 390 px; los valores son los MEDIDOS (getComputedStyle), no a ojo:
//   · la página: fondo #0F0F0F, tinta #EEEEEE, gris #BCBCBC; la letra del sistema (ui-sans-serif, system-ui…); el contenido en 1120 px
//     (20 px de gutter en el teléfono); la barra de 60 px.
//   · el hero, a la izquierda: «Sharpen your thinking.» en 60/60 con −1,2 px en 600 (50,75/55,8 en el teléfono), su bajada en 36/40 en el
//     gris (576 px; 30/36), y su botón de 16 × 24 con radio 8 en 20/28 y 500, con el link al lado. Debajo, la ventana de la app: fondo
//     #1E1E1E, borde de 0,8 px #363636, radio 8 (963 × 589, con el teléfono al costado: juntos llenan las 1120).
//   · sus tres frases: una lista de definiciones de 528 px, cada término en 24/32 y 500, su texto en 24/32 en el gris (20/28 en el
//     teléfono); al costado «Free without limits.» en 24/32 y 500 con «Download now» en el violeta claro.
//   · «Spark ideas.», «Sync securely.» y «Publish instantly.»: 60/60 con −1,2 px en 600 (44/48,4), su bajada en 24/32 en el gris (20/28).
//     La grilla: dos columnas de 548 px, cada término en 24/32 y 600 y su texto en 20/25 (18/22,5), con su muestra debajo. «Sync
//     securely.»: el texto de 512 px y sus pestañas (16 × 12 × 16 × 36 px, radio 8, el título en 18/27 y 600) con la tarjeta al costado.
//     «Publish instantly.»: tres columnas de 341 px, el término en 20/28 y 600.
//   · el cierre: el botón de 16 × 32 al centro; sus tres tarjetas de 309 px, el título en 20/28 y 600 y el texto en 18/22,5.
// De MaKo lleva sólo lo de ../marca.tsx: el logo, el botón para empezar (en el azul de MaKo: los colores de marca van en los botones; su
// violeta de los links es un azul claro de MaKo) y los links al resto de las funciones en el pie copiado (que el sitio oculta: va PieGlobal).
// La ventana de su app es el Second Brain DE VERDAD: BrainVivo (../../_sitio/BrainVivo.tsx), el mismo componente de la portada, que se
// arrastra, se acerca y se toca (siempre negro y fuera del sol y la luna: lleva su data-tema-fijo).
// Lo que NO se copió (dicho en ../second-brain.ts): su teléfono al costado de la ventana, sus muestras dibujadas (van los datos del código),
// sus plugins de la comunidad y su menú (va la barra del sitio; la copiada se oculta por su clase, BARRA_PROPIA de ../TemaSitio.tsx).
// Server component: las pestañas de «Aprende solo» son radios con :has(). Lo único con JS es el grafo, que es de la app.
// =============================================================================

import type { ReactNode } from 'react';
import type { Bloque } from '../tipos';
import type { PropsDiseno } from './index';
import { RUTA_CTA, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';
import { AREAS_SECOND_BRAIN, CARPETAS_ZIP, MODOS_BUSQUEDA, NODO_DE_MUESTRA, PRIMERA_VEZ, PROCEDENCIAS, TEXTOS_SECOND_BRAIN } from '../second-brain';
import { BrainVivo } from '../../_sitio/BrainVivo';
import { archivoDeNodo } from '@/lib/vault-modelo';
import type { Cerebro } from '@/lib/cerebro-modelo';
// El negocio de Alex Hormozi del grafo de la portada: acá sólo en el servidor (el diseño no manda JS), para armar UN archivo del ZIP.
import CEREBRO_EJEMPLO from '../../_sitio/cerebro-ejemplo.json';

const P = 'd-second-brain';

/** Un archivo del ZIP DE VERDAD: el que arma la exportación (`archivoDeNodo`) para un nodo del negocio de ejemplo. */
export function archivoDeMuestra(): { ruta: string; texto: string } | null {
  const cerebro = CEREBRO_EJEMPLO as unknown as Cerebro;
  const nodo = cerebro.nodos.find((n) => n.id === NODO_DE_MUESTRA);
  return nodo ? archivoDeNodo(nodo, cerebro) : null;
}

/** La foto del grafo de la portada (el mismo de BrainVivo, su póster): la muestra de «Mapa». */
export const FOTO_MAPA = { src: '/vsl-assets/sitio/cerebro.jpg', w: 1182, h: 678 } as const;

/** La muestra de cada celda de «Tu negocio, conectado.», por su título: datos del código o la foto del grafo. */
export const MUESTRA_DE: Readonly<Record<string, 'areas' | 'mapa' | 'procedencia' | 'busqueda'>> = {
  'Áreas': 'areas', Mapa: 'mapa', Procedencia: 'procedencia', 'Búsqueda': 'busqueda',
};

const CSS = `
.d-second-brain-raiz{--ds-fondo:#0F0F0F;--ds-tinta:#EEEEEE;--ds-gris:#BCBCBC;--ds-ventana:#1E1E1E;--ds-borde:#363636;--ds-link:#8DB0F8;
  background:var(--ds-fondo);color:var(--ds-tinta);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Roboto,Inter,'Helvetica Neue',Arial,'Noto Sans',sans-serif;font-size:16px;line-height:24px;-webkit-font-smoothing:antialiased;overflow-x:clip}
.d-second-brain-raiz *,.d-second-brain-raiz *::before,.d-second-brain-raiz *::after{box-sizing:border-box}
.d-second-brain-in{max-width:1168px;margin:0 auto;padding:0 24px}
.d-second-brain-oculto{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.d-second-brain-nav{height:60px;display:flex;align-items:center;justify-content:space-between}
.d-second-brain-nav ul{list-style:none;margin:0;padding:0;display:flex;gap:22px}
.d-second-brain-nav a{color:var(--ds-tinta);text-decoration:none;font-size:14px}
.d-second-brain-btn{display:inline-flex;align-items:center;padding:16px 24px;border-radius:8px;background:#2F6FED;color:#fff;font-size:20px;line-height:28px;font-weight:500;text-decoration:none;transition:background .2s}
.d-second-brain-btn:hover{background:#1F57C8}
.d-second-brain-link{color:var(--ds-link);text-decoration:none;font-weight:500}
.d-second-brain-link:hover{text-decoration:underline}
.d-second-brain-hero{padding-top:126px}
.d-second-brain-h1{margin:0;max-width:820px;font-size:60px;line-height:60px;letter-spacing:-1.2px;font-weight:600}
.d-second-brain-bajada{margin:32px 0 0;max-width:576px;font-size:36px;line-height:40px;color:var(--ds-gris)}
.d-second-brain-acciones{margin-top:48px;display:flex;flex-wrap:wrap;align-items:center;gap:20px 32px}
.d-second-brain-acciones .d-second-brain-link{font-size:20px;line-height:28px}
.d-second-brain-ventana{margin-top:72px;border:.8px solid var(--ds-borde);border-radius:8px;background:var(--ds-ventana);overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.55)}
.d-second-brain-barra{height:38px;display:flex;align-items:flex-end;gap:2px;padding:0 10px;background:#262626;border-bottom:.8px solid var(--ds-borde)}
.d-second-brain-barra span{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 14px;border-radius:6px 6px 0 0;font-size:12.5px;color:var(--ds-gris)}
.d-second-brain-barra span:first-child{background:var(--ds-ventana);color:var(--ds-tinta)}
.d-second-brain-cuerpo{position:relative;aspect-ratio:1120/649}
.d-second-brain-frases{margin-top:152px;display:grid;grid-template-columns:minmax(0,528px) minmax(0,300px);justify-content:space-between;align-items:end;padding:0 32px}
.d-second-brain-frases dl{margin:0}
.d-second-brain-frases dl>div+div{padding-top:16px}
.d-second-brain-frases dt{font-size:24px;line-height:32px;font-weight:500}
.d-second-brain-frases dd{margin:4px 0 0;font-size:24px;line-height:32px;color:var(--ds-gris)}
.d-second-brain-libre{font-size:24px;line-height:32px;font-weight:500}
.d-second-brain-libre .d-second-brain-link{display:block}
.d-second-brain-sec{margin-top:200px}
.d-second-brain-h2{margin:0;font-size:60px;line-height:60px;letter-spacing:-1.2px;font-weight:600}
.d-second-brain-p{margin:16px 0 0;font-size:24px;line-height:32px;color:var(--ds-gris)}
.d-second-brain-centro{text-align:center;max-width:672px;margin-left:auto;margin-right:auto}
.d-second-brain-grilla{margin-top:72px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:48px 24px}
.d-second-brain-celda dl{margin:0;padding:24px}
.d-second-brain-celda dt{font-size:24px;line-height:32px;font-weight:600}
.d-second-brain-celda dd{margin:4px 0 0;font-size:20px;line-height:25px;color:var(--ds-gris)}
.d-second-brain-muestra{margin:0 24px;height:340px;border:.8px solid var(--ds-borde);border-radius:8px;background:var(--ds-ventana);overflow:hidden;position:relative}
.d-second-brain-muestra img{display:block;width:100%;height:100%;object-fit:cover}
.d-second-brain-areas{list-style:none;margin:0;padding:14px 10px;columns:2;column-gap:10px}
.d-second-brain-areas li{break-inside:avoid;display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:6px;font-size:14px;line-height:20px;color:var(--ds-tinta)}
.d-second-brain-areas li::before{content:'';flex:none;width:8px;height:8px;border-radius:50%;background:#8DB0F8}
.d-second-brain-areas li:nth-child(3n+2)::before{background:#F2B01E}
.d-second-brain-areas li:nth-child(3n)::before{background:#B59CF7}
.d-second-brain-filas{list-style:none;margin:0;padding:22px;display:flex;flex-direction:column;gap:12px}
.d-second-brain-filas li{display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border-radius:8px;background:rgba(255,255,255,.04);border:.8px solid var(--ds-borde)}
.d-second-brain-filas b{display:block;font-size:15px;line-height:22px;font-weight:600;color:var(--ds-tinta)}
.d-second-brain-filas span{display:block;font-size:14px;line-height:20px;color:var(--ds-gris)}
.d-second-brain-marca{flex:none;width:12px;height:12px;margin-top:5px;border-radius:50%;background:#8DB0F8}
.d-second-brain-filas li:nth-child(2) .d-second-brain-marca{background:transparent;border:2px solid #8DB0F8}
.d-second-brain-filas li:nth-child(3) .d-second-brain-marca{background:transparent;border:2px dashed #7A7A7A}
.d-second-brain-sync{margin-top:200px;display:grid;grid-template-columns:minmax(0,512px) minmax(0,1fr);gap:64px;align-items:center}
.d-second-brain-sync input{position:absolute;opacity:0;pointer-events:none}
.d-second-brain-tabs{margin-top:32px;display:flex;flex-direction:column}
.d-second-brain-tabs label{position:relative;display:block;cursor:pointer;padding:16px 12px 16px 36px;border-radius:8px;transition:background .2s}
.d-second-brain-tabs label::before{content:'';position:absolute;left:14px;top:23px;width:8px;height:8px;border-radius:50%;background:#4A4A4A}
.d-second-brain-tabs strong{display:block;font-size:18px;line-height:27px;font-weight:600;color:#E5E5E5}
.d-second-brain-tabs span{display:block;margin-top:4px;font-size:16px;line-height:24px;color:var(--ds-gris)}
.d-second-brain-tarjeta{border:.8px solid var(--ds-borde);border-radius:8px;background:var(--ds-ventana);padding:24px}
.d-second-brain-tarjeta h3{margin:0 0 16px;font-size:18px;line-height:27px;font-weight:600}
.d-second-brain-publicar{margin-top:56px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:48px}
.d-second-brain-publicar dt{font-size:20px;line-height:28px;font-weight:600}
.d-second-brain-publicar dd{margin:8px 0 0;font-size:18px;line-height:28px;color:var(--ds-gris)}
.d-second-brain-zip{margin-top:56px;border:.8px solid var(--ds-borde);border-radius:8px;background:var(--ds-ventana);display:grid;grid-template-columns:minmax(0,320px) minmax(0,1fr);overflow:hidden}
.d-second-brain-arbol{list-style:none;margin:0;padding:16px 10px;border-right:.8px solid var(--ds-borde);background:#191919}
.d-second-brain-arbol li{padding:5px 10px;font-size:13.5px;line-height:20px;color:var(--ds-gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.d-second-brain-arbol li.d-second-brain-madre{color:var(--ds-tinta);font-weight:600;margin-top:6px}
.d-second-brain-arbol li:not(.d-second-brain-madre){padding-left:26px}
.d-second-brain-nota{padding:28px 32px;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:13.5px;line-height:22px;color:var(--ds-gris);white-space:pre-wrap}
.d-second-brain-nota b{color:var(--ds-tinta);font-weight:600}
.d-second-brain-brillo{margin-top:200px;text-align:center}
.d-second-brain-brillo .d-second-brain-btn{margin-top:40px;padding:16px 32px}
.d-second-brain-chico{margin:20px auto 0;max-width:560px;font-size:16px;line-height:24px;color:var(--ds-gris)}
.d-second-brain-comunidad{margin:120px 0 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;padding-bottom:120px}
.d-second-brain-comunidad a{display:block;padding:24px;border:.8px solid var(--ds-borde);border-radius:8px;text-decoration:none;color:inherit;transition:background .2s}
.d-second-brain-comunidad a:hover{background:rgba(255,255,255,.03)}
.d-second-brain-comunidad b{display:block;font-size:20px;line-height:28px;font-weight:600;color:var(--ds-tinta)}
.d-second-brain-comunidad span{display:block;margin-top:12px;font-size:18px;line-height:22.5px;color:var(--ds-gris)}
.d-second-brain-pie{padding:40px 0;border-top:.8px solid var(--ds-borde)}
.d-second-brain-pie ul{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:10px 22px}
.d-second-brain-pie a{color:var(--ds-gris);font-size:13px;text-decoration:none}
@media (max-width:991px){
  .d-second-brain-sync{grid-template-columns:minmax(0,1fr);gap:40px}
  .d-second-brain-publicar{gap:28px}
}
@media (max-width:767px){
  .d-second-brain-in{padding:0 20px}
  .d-second-brain-nav ul li:not(:last-child){display:none}
  .d-second-brain-hero{padding-top:96px}
  .d-second-brain-h1{font-size:50.75px;line-height:55.8px;letter-spacing:-1.27px}
  .d-second-brain-bajada{margin-top:32px;font-size:30px;line-height:36px}
  .d-second-brain-acciones{margin-top:48px;flex-direction:column;align-items:flex-start}
  .d-second-brain-ventana{margin:56px -20px 0;border-radius:0;border-left:0;border-right:0}
  .d-second-brain-cuerpo{aspect-ratio:auto;height:440px}
  .d-second-brain-frases{margin-top:96px;grid-template-columns:minmax(0,1fr);gap:56px;padding:0}
  .d-second-brain-frases dt,.d-second-brain-frases dd,.d-second-brain-libre{font-size:20px;line-height:28px}
  .d-second-brain-libre{text-align:center}
  .d-second-brain-sec,.d-second-brain-sync,.d-second-brain-brillo{margin-top:120px}
  .d-second-brain-h2{font-size:44px;line-height:48.4px;letter-spacing:-.88px}
  .d-second-brain-p{font-size:20px;line-height:28px}
  .d-second-brain-grilla{grid-template-columns:minmax(0,1fr);gap:40px;margin-top:48px}
  .d-second-brain-celda dt{font-size:18px;line-height:28px}
  .d-second-brain-celda dd{font-size:18px;line-height:22.5px}
  .d-second-brain-muestra{margin:0;height:300px}
  .d-second-brain-areas{columns:1}
  .d-second-brain-areas li{padding:4px 8px}
  .d-second-brain-publicar{grid-template-columns:minmax(0,1fr)}
  .d-second-brain-publicar dt{font-size:18px}
  .d-second-brain-zip{grid-template-columns:minmax(0,1fr)}
  .d-second-brain-arbol{border-right:0;border-bottom:.8px solid var(--ds-borde)}
  .d-second-brain-nota{padding:20px}
  .d-second-brain-comunidad{grid-template-columns:minmax(0,1fr);margin-top:96px;padding-bottom:96px}
  .d-second-brain-comunidad b{font-size:18px}
}
`;

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
type Pasos = Extract<Bloque, { tipo: 'pasos' }>;

/** La muestra de una celda: los datos del código (las áreas, de dónde salió cada dato, los modos de la búsqueda) o la foto del grafo. */
function Muestra({ titulo }: { titulo: string }) {
  const que = MUESTRA_DE[titulo];
  if (que === 'mapa') {
    return (
      <div className={`${P}-muestra`} data-tema-fijo="">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FOTO_MAPA.src} alt="El grafo del Second Brain con el negocio de Alex Hormozi: sus áreas, su oferta, sus anuncios y sus videos, conectados" width={FOTO_MAPA.w} height={FOTO_MAPA.h} loading="lazy" decoding="async" />
      </div>
    );
  }
  if (que === 'areas') return <div className={`${P}-muestra`}><ul className={`${P}-areas`}>{AREAS_SECOND_BRAIN.map((a) => <li key={a.nombre}>{a.nombre}</li>)}</ul></div>;
  if (que === 'procedencia') {
    return (
      <div className={`${P}-muestra`}>
        <ul className={`${P}-filas`}>
          {PROCEDENCIAS.map((x) => <li key={x}><i className={`${P}-marca`} aria-hidden="true" /><span><b>{x.charAt(0).toUpperCase() + x.slice(1)}</b></span></li>)}
        </ul>
      </div>
    );
  }
  if (que === 'busqueda') {
    return (
      <div className={`${P}-muestra`}>
        <ul className={`${P}-filas`}>
          {MODOS_BUSQUEDA.map((m) => <li key={m.modo}><i className={`${P}-marca`} aria-hidden="true" /><span><b>{m.modo}</b><span>{m.que}</span></span></li>)}
        </ul>
      </div>
    );
  }
  return null;
}

/** Las reglas de las pestañas de «Aprende solo» (radios con :has()): la elegida se ilumina. */
function cssPestanas(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += `.${P}-sync:has(#${P}-paso-${i}:checked) label[for="${P}-paso-${i}"]{background:rgba(255,255,255,.06)}.${P}-sync:has(#${P}-paso-${i}:checked) label[for="${P}-paso-${i}"]::before{background:#8DB0F8}`;
  return s;
}

/** Las secciones, en el orden de la landing (el de la portada de Obsidian). */
function secciones(bloques: Bloque[]): ReactNode[] {
  const out: ReactNode[] = [];
  const nota = archivoDeMuestra();
  let tarjetas = 0;
  bloques.forEach((b, k) => {
    if (b.tipo === 'hero') {
      out.push(
        <section key={k} className={`${P}-hero`}>
          <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
          <p className={`${P}-bajada`} dangerouslySetInnerHTML={html(b.bajada)} />
          <div className={`${P}-acciones`}>
            <a href={RUTA_CTA} className={`${P}-btn`}>{TEXTO_CTA}</a>
            <a href="/planes" className={`${P}-link`}>{TEXTOS_SECOND_BRAIN.verPrecios}</a>
          </div>
          {/* Su ventana de la app: el Second Brain de verdad (el de la portada), con su pestaña arriba. */}
          <div className={`${P}-ventana`}>
            <div className={`${P}-barra`} aria-hidden="true"><span>Second Brain</span><span>Mapa</span></div>
            <div className={`${P}-cuerpo`}><BrainVivo /></div>
          </div>
        </section>,
      );
      return;
    }
    if (b.tipo === 'tarjetas') {
      const t = b as Tarjetas;
      const n = tarjetas++;
      if (n === 0) {
        out.push(
          <section key={k} className={`${P}-frases`}>
            <dl>{t.items.map((it) => <div key={it.titulo}><dt dangerouslySetInnerHTML={html(it.titulo)} /><dd dangerouslySetInnerHTML={html(it.texto)} /></div>)}</dl>
            <div className={`${P}-libre`}>
              <span dangerouslySetInnerHTML={html(t.titulo)} />
              <a href={RUTA_CTA} className={`${P}-link`}>{TEXTO_CTA}</a>
            </div>
          </section>,
        );
      } else if (t.columnas === 2) {
        out.push(
          <section key={k} className={`${P}-sec`}>
            <div className={`${P}-centro`}>
              <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(t.titulo)} />
              {t.bajada && <p className={`${P}-p`} dangerouslySetInnerHTML={html(t.bajada)} />}
            </div>
            <div className={`${P}-grilla`}>
              {t.items.map((it) => (
                <div key={it.titulo} className={`${P}-celda`}>
                  <dl><dt dangerouslySetInnerHTML={html(it.titulo)} /><dd dangerouslySetInnerHTML={html(it.texto)} /></dl>
                  <Muestra titulo={it.titulo} />
                </div>
              ))}
            </div>
          </section>,
        );
      } else if (t.columnas === 3) {
        out.push(
          <section key={k} className={`${P}-sec`}>
            <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(t.titulo)} />
            {t.bajada && <p className={`${P}-p`} dangerouslySetInnerHTML={html(t.bajada)} />}
            <dl className={`${P}-publicar`}>
              {t.items.map((it) => <div key={it.titulo}><dt dangerouslySetInnerHTML={html(it.titulo)} /><dd dangerouslySetInnerHTML={html(it.texto)} /></div>)}
            </dl>
            {/* Donde va su captura de un sitio publicado: las carpetas del ZIP (las de la exportación, del código) y un archivo. */}
            <div className={`${P}-zip`}>
              <ul className={`${P}-arbol`} aria-label="Las carpetas del ZIP">
                {CARPETAS_ZIP.flatMap((c, i) => {
                  const [madre, hija] = c.split('/');
                  const nueva = i === 0 || CARPETAS_ZIP[i - 1].split('/')[0] !== madre;
                  return [...(nueva ? [<li key={madre} className={`${P}-madre`}>{madre}</li>] : []), <li key={c}>{hija}</li>];
                })}
              </ul>
              {nota && (
                <div className={`${P}-nota`}>
                  <b>{nota.ruta}</b>{'\n\n'}{nota.texto.trim()}
                </div>
              )}
            </div>
          </section>,
        );
      } else {
        // Sus tres tarjetas de comunidad: lo que MaKo tiene de eso (los links de «Recursos» del sitio).
        out.push(
          <section key={k} className={`${P}-comunidad`}>
            <h2 className={`${P}-oculto`} dangerouslySetInnerHTML={html(t.titulo)} />
            {t.items.map((it) => <a key={it.titulo} href={it.meta ?? '/'}><b dangerouslySetInnerHTML={html(it.titulo)} /><span dangerouslySetInnerHTML={html(it.texto)} /></a>)}
          </section>,
        );
      }
      return;
    }
    if (b.tipo === 'pasos') {
      const p = b as Pasos;
      out.push(
        <section key={k} className={`${P}-sync`}>
          <style dangerouslySetInnerHTML={{ __html: cssPestanas(p.pasos.length) }} />
          <div>
            <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(p.titulo)} />
            {p.bajada && <p className={`${P}-p`} dangerouslySetInnerHTML={html(p.bajada)} />}
            {p.pasos.map((x, i) => <input key={x.titulo} type="radio" name={`${P}-paso`} id={`${P}-paso-${i}`} defaultChecked={i === 0} aria-label={x.titulo} />)}
            <div className={`${P}-tabs`}>
              {p.pasos.map((x, i) => <label key={x.titulo} htmlFor={`${P}-paso-${i}`}><strong dangerouslySetInnerHTML={html(x.titulo)} /><span dangerouslySetInnerHTML={html(x.texto)} /></label>)}
            </div>
          </div>
          {/* Su tarjeta de «Shared vaults»: lo que el recolector lee y escribe, con los datos del código. */}
          <div className={`${P}-tarjeta`}>
            <h3>Aprende solo</h3>
            <ul className={`${P}-filas`} style={{ padding: 0 }}>
              <li><i className={`${P}-marca`} aria-hidden="true" /><span><b>WhatsApp</b><span>Tus conversaciones con un lead</span></span></li>
              <li><i className={`${P}-marca`} aria-hidden="true" /><span><b>Lo nuevo</b><span>{PRIMERA_VEZ}</span></span></li>
              <li><i className={`${P}-marca`} aria-hidden="true" /><span><b>Tu Second Brain</b><span>Los hechos de tu negocio, con su procedencia</span></span></li>
            </ul>
          </div>
        </section>,
      );
    }
    // Esta landing no tiene otros tipos de bloque (su referencia no tiene preguntas ni testimonios).
  });
  return out;
}

export default function DisenoSecondBrain({ landing }: PropsDiseno) {
  const otras = otrasFunciones(landing.slug);
  // «It’s your time to shine.» va antes de sus tarjetas de comunidad, que son el último bloque (cada bloque dibuja una sección).
  const nodos = secciones(landing.bloques);
  const brillo = (
    <section key="brillo" className={`${P}-brillo`}>
      <h2 className={`${P}-h2`}>{TEXTOS_SECOND_BRAIN.cierre}</h2>
      <a href={RUTA_CTA} className={`${P}-btn`}>{TEXTO_CTA}</a>
      <p className={`${P}-chico`} dangerouslySetInnerHTML={html(TEXTO_CIERRE)} />
    </section>
  );
  nodos.splice(Math.max(0, nodos.length - 1), 0, brillo);
  return (
    <div className={`${P}-raiz`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`${P}-in`}>
        <header className={`${P}-nav`}>
          <LogoMaKo tamano={28} claro />
          <ul>
            <li><a href="/planes">Precios</a></li>
            <li><a href={RUTA_CTA}>{TEXTO_CTA}</a></li>
          </ul>
        </header>
        <main>{nodos}</main>
        <footer className={`${P}-pie`}>
          <LogoMaKo tamano={24} claro />
          <ul aria-label="Las otras funciones de MaKo">
            {otras.map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}
          </ul>
        </footer>
      </div>
    </div>
  );
}
