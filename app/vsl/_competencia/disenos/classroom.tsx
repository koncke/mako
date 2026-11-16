// =============================================================================
// /vsl/classroom con el DISEÑO de la portada de Circle (https://circle.so/, la que sirve el 16/11/2026: circle.so/b)
// =============================================================================
// Leída el 16/11/2026 con el navegador del panel, a 1440 y a 390 px; los valores son los MEDIDOS (getComputedStyle), no a ojo:
//   · la página: Inter, tinta #0A0A0A, gris #262626, blanco; el azul noche de sus franjas oscuras #0F0F35; contenido de 1200 px
//     (20 px de gutter en el teléfono).
//   · el hero: el titular que gira en 80/92 con −3,2 px y peso 500 (44/44 con −1,8 px en el teléfono), la palabra que gira en el azul;
//     su renglón chico en 18/23,4 con −0,5 px (16/24); el botón de 14 × 28 con radio 12, 16/20 en 600, con su degradado a 142°.
//   · la cinta de casos: tarjetas de 320 × 380 con su píldora (13 px en 500, rgba(0,0,0,.4), redonda) y su cifra de 32 px en 700, sobre
//     su degradado de 181° del blanco al azul noche (#C5C5FF, #8A8AFF, #4D4D9A), de 460 px de alto.
//   · «Where all-in-one meets best-in-class»: 40/48 con −1,5 px en 700 (28/36,4), su bajada 20/28 con −1 px en 500, las pestañas y la
//     captura en su marco de rgba(255,255,255,.18) con radio 20 (1200 × 764). «What is Circle?» en 48/57,6 (36/43,2) a la derecha.
//   · «Yes, you really can run everything on Circle» y «Great communities transform people»: 64/70,4 con −1,5 px en 700 (36/43,2).
//     Cada grupo: su título en 56/61,6 (32/38,4), su bajada 20/28 con −1 px en #262626 (635 px), sus píldoras de 8 × 16 en 18/28
//     (la elegida en #E0EAFC) y su panel de 1198 × 548 con radio 24 y 40 px de aire (40 × 24 en el teléfono): a la izquierda la frase
//     en 18 px y la lista (16/24, 12 px entre renglones, 400 px), a la derecha la captura de 660 × 548 contra los bordes. Los degradados
//     de los paneles, en su orden: #E0EAFC→#CFDEF3, #FFEBE1→#FFCCBB, #FEEFFF→#EED8F0.
//   · la grilla: 1200 px en filas de 664 + 516, 3 × 387 y 684 + 496, con 20 px; tarjetas blancas de radio 20, 32 px de aire y su sombra
//     de 0 4px 8px rgba(169,169,169,.08); el título de cada una en 20/28 con −0,5 px en 500, gris #737373.
//   · el cierre: la franja azul noche, 48/52,8 en 700 blanco (32/41,6).
// De MaKo lleva sólo lo de ../marca.tsx: el logo, el botón para empezar (en el azul de MaKo: los colores de marca van en los botones y en
// la palabra que gira), el caso de Mauricio y los links al resto de las funciones en el pie copiado (que el sitio oculta: va PieGlobal).
// Lo que NO se copió (está dicho en ../classroom.ts): su cinta de clientes con cifras, sus reseñas, su muro de creadores, sus citas de
// clientes en cada panel, sus grupos de app propia, IA, email y sitio, y su menú (va la barra del sitio; la copiada se oculta por su
// clase, BARRA_PROPIA de ../TemaSitio.tsx).
// Server component sin JS: las pestañas y las píldoras son radios con :has(), la palabra que gira y la cinta son CSS. Las capturas van con
// data-tema-fijo: son pantallas claras de la app, y el sol y la luna no las toca.
// =============================================================================

import type { ReactNode } from 'react';
import type { Bloque } from '../tipos';
import type { PropsDiseno } from './index';
import { CASO, RUTA_CTA, LogoMaKo, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';
import { CANDADOS, TEXTOS_CLASSROOM } from '../classroom';

const P = 'd-classroom';

/** Las pantallas REALES del portal del alumno (C:/dev/bancos-portada/banco-classroom-landing, fotos.mjs), 1600 × 1000. */
export const FOTOS_CLASSROOM = {
  curso: '/vsl-assets/classroom/curso.jpg',
  clase: '/vsl-assets/classroom/clase.jpg',
  tarea: '/vsl-assets/classroom/tarea.jpg',
  comunidad: '/vsl-assets/classroom/comunidad.jpg',
  ranking: '/vsl-assets/classroom/ranking.jpg',
} as const;
type Foto = keyof typeof FOTOS_CLASSROOM;

/** La pantalla de cada pestaña de «Todo tu programa» y de cada píldora de los grupos (por su título). Una que falte sale sin captura. */
export const FOTO_DE: Readonly<Record<string, Foto>> = {
  Curso: 'curso', Clase: 'clase', Tarea: 'tarea', Comunidad: 'comunidad', Ranking: 'ranking',
  Publicaciones: 'comunidad', Clases: 'clase', Tareas: 'tarea', Candados: 'curso', 'Tu marca': 'curso',
  'Al ganar la venta': 'curso', 'Su link personal': 'curso',
};

/** Dónde se encuadra cada captura en un panel (lo que importa de la pantalla, de cerca). */
const ENCUADRE: Readonly<Record<string, string>> = {
  Publicaciones: '0% 0%', Ranking: '0% 0%', Clases: '0% 0%', Tareas: '100% 0%', Candados: '0% 100%', 'Tu marca': '30% 70%',
  'Al ganar la venta': '100% 0%', 'Su link personal': '100% 0%',
};

/** Los degradados de sus paneles, en su orden (Community, Branded app, AI & Automation). */
const PANELES = ['linear-gradient(#E0EAFC 0%, #CFDEF3 100%)', 'linear-gradient(0deg, #FFEBE1 -8.3%, #FFCCBB 130.75%)', 'linear-gradient(#FEEFFF 0%, #EED8F0 100%)'];
const CHIP = ['#E0EAFC', '#FFE3D6', '#F6E3F8'];

const CSS = `
@font-face{font-family:'d-classroom-inter';src:url('/vsl-assets/fuentes/inter/inter-latin-var.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
.d-classroom-raiz{--dc-tinta:#0A0A0A;--dc-gris:#262626;--dc-suave:#737373;--dc-noche:#0F0F35;--dc-azul:#2F6FED;
  background:#fff;color:var(--dc-tinta);font-family:'d-classroom-inter',Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:clip}
.d-classroom-raiz *,.d-classroom-raiz *::before,.d-classroom-raiz *::after{box-sizing:border-box}
.d-classroom-in{max-width:1240px;margin:0 auto;padding:0 20px}
.d-classroom-oculto{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.d-classroom-nav{height:70px;display:flex;align-items:center;justify-content:space-between}
.d-classroom-nav ul{list-style:none;margin:0;padding:0;display:flex;gap:20px;align-items:center}
.d-classroom-nav a{color:var(--dc-tinta);text-decoration:none;font-size:15px;font-weight:500}
.d-classroom-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 28px;border-radius:12px;background:linear-gradient(142deg,#2F6FED 18.68%,#1F57C8 78.25%);color:#fff;font-size:16px;line-height:20px;font-weight:600;letter-spacing:-.25px;text-decoration:none;transition:filter .2s}
.d-classroom-btn:hover{filter:brightness(1.08)}
.d-classroom-hero{padding:120px 0 64px;text-align:center}
.d-classroom-h1{margin:0 auto;font-size:80px;line-height:92px;letter-spacing:-3.2px;font-weight:500}
.d-classroom-h1 .d-classroom-linea{display:block}
.d-classroom-gira{display:inline-grid;justify-items:start;text-align:left;color:var(--dc-azul);vertical-align:top}
.d-classroom-gira span{grid-area:1/1;opacity:0;animation:d-classroom-gira 10s infinite}
.d-classroom-gira span:nth-child(2){animation-delay:2.5s}
.d-classroom-gira span:nth-child(3){animation-delay:5s}
.d-classroom-gira span:nth-child(4){animation-delay:7.5s}
@keyframes d-classroom-gira{0%{opacity:0;transform:translateY(35%)}3%,22%{opacity:1;transform:none}25%,100%{opacity:0;transform:translateY(-35%)}}
.d-classroom-chico{margin:18px auto 0;max-width:640px;font-size:18px;line-height:23.4px;letter-spacing:-.5px;font-weight:500;color:#191B1F}
.d-classroom-hero .d-classroom-btn{margin-top:28px}
.d-classroom-cinta{position:relative;height:460px;background:linear-gradient(181deg,#fff 3.51%,#C5C5FF 22.57%,#8A8AFF 41.16%,#4D4D9A 62.61%,#0F0F35 84%);overflow:hidden}
.d-classroom-cinta-pista{display:flex;gap:20px;width:max-content;padding-top:40px;animation:d-classroom-cinta 48s linear infinite}
.d-classroom-cinta:hover .d-classroom-cinta-pista{animation-play-state:paused}
@keyframes d-classroom-cinta{to{transform:translateX(-50%)}}
.d-classroom-caso{position:relative;width:320px;height:380px;border-radius:20px;padding:20px;display:flex;flex-direction:column;justify-content:flex-end;color:#fff;background:linear-gradient(180deg,rgba(15,15,53,.25),rgba(15,15,53,.85));border:1px solid rgba(255,255,255,.18);overflow:hidden}
.d-classroom-caso::before{content:'';position:absolute;inset:-30% -20% auto auto;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(47,111,237,.55),rgba(47,111,237,0) 70%)}
.d-classroom-pildora{position:absolute;left:20px;top:20px;padding:6px 12px;border-radius:9999px;background:rgba(0,0,0,.4);font-size:13px;font-weight:500}
.d-classroom-cifra{position:relative;margin:0;font-size:32px;line-height:32px;font-weight:700;letter-spacing:-.264px}
.d-classroom-cifra-l{position:relative;margin:8px 0 0;font-size:18px;line-height:18px;font-weight:500;color:rgba(255,255,255,.7)}
.d-classroom-noche{background:var(--dc-noche);color:#FAFAFA;padding:40px 0 110px}
.d-classroom-h2c{margin:0 auto;text-align:center;font-size:40px;line-height:48px;letter-spacing:-1.5px;font-weight:700;color:#FAFAFA}
.d-classroom-sub{margin:14px auto 0;text-align:center;max-width:640px;font-size:20px;line-height:28px;letter-spacing:-1px;font-weight:500}
.d-classroom-gal{margin-top:40px}
.d-classroom-gal input,.d-classroom-grupo input{position:absolute;opacity:0;pointer-events:none}
.d-classroom-tabs{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.d-classroom-tabs label{cursor:pointer;padding:10px 18px;border-radius:9999px;font-size:16px;line-height:24px;color:rgba(250,250,250,.78);transition:background .2s,color .2s}
.d-classroom-tabs label:hover{color:#fff}
.d-classroom-marco{position:relative;margin:28px auto 0;max-width:1200px;padding:9px;border-radius:20px;background:rgba(255,255,255,.18)}
.d-classroom-marco img{display:none;width:100%;height:auto;border-radius:12px}
.d-classroom-que{margin-top:110px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,515px);gap:64px;align-items:center}
.d-classroom-que img{display:block;width:100%;height:auto;border-radius:16px;border:1px solid rgba(255,255,255,.18)}
.d-classroom-que h2{margin:0;font-size:48px;line-height:57.6px;letter-spacing:-.48px;font-weight:700}
.d-classroom-que .d-classroom-negrita{margin:24px 0 0;font-size:18px;line-height:23.4px;letter-spacing:-.5px;font-weight:700}
.d-classroom-que p{margin:16px 0 0;font-size:16px;line-height:24px;color:rgba(250,250,250,.82)}
.d-classroom-que .d-classroom-btn{margin-top:28px}
.d-classroom-blanco{padding:120px 0 40px}
.d-classroom-h2{margin:0 auto;text-align:center;max-width:780px;font-size:64px;line-height:70.4px;letter-spacing:-1.5px;font-weight:700;color:var(--dc-tinta)}
.d-classroom-blanco>.d-classroom-in>.d-classroom-sub,.d-classroom-grilla-sec .d-classroom-sub{color:var(--dc-gris)}
.d-classroom-centro{text-align:center;margin-top:28px}
.d-classroom-grupo{margin-top:110px}
.d-classroom-grupo h3{margin:0;font-size:56px;line-height:61.6px;letter-spacing:-1.5px;font-weight:700}
.d-classroom-grupo-d{margin:16px 0 0;max-width:635px;font-size:20px;line-height:28px;letter-spacing:-1px;font-weight:500;color:var(--dc-gris)}
.d-classroom-chips{margin-top:28px;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}
.d-classroom-chips::-webkit-scrollbar{display:none}
.d-classroom-chips label{flex:none;cursor:pointer;padding:8px 16px;border-radius:9999px;font-size:18px;line-height:28px;letter-spacing:-.5px;font-weight:500;color:var(--dc-tinta);white-space:nowrap}
.d-classroom-panel{position:relative;margin-top:24px;min-height:548px;border-radius:24px;padding:40px;overflow:hidden}
.d-classroom-vista{display:none;gap:32px;justify-content:space-between;min-height:468px}
.d-classroom-copia{flex:1;max-width:400px;display:flex;flex-direction:column;gap:24px;position:relative;z-index:2}
.d-classroom-frase{margin:0;font-size:18px;line-height:23.94px;letter-spacing:-.25px;font-weight:500}
.d-classroom-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.d-classroom-lista li{display:flex;gap:8px;align-items:flex-start;font-size:16px;line-height:24px}
.d-classroom-lista svg{flex:none;width:20px;height:20px;margin-top:2px}
.d-classroom-captura{flex:1;max-width:660px;margin:-40px -40px -40px 0;align-self:stretch;position:relative;min-height:548px}
.d-classroom-captura img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-top-left-radius:16px;box-shadow:-12px 0 40px rgba(15,15,53,.12)}
.d-classroom-grilla-sec{background:#F5F5F7;padding:120px 0}
.d-classroom-grilla{margin:56px auto 0;max-width:1200px;display:grid;grid-template-columns:repeat(30,minmax(0,1fr));gap:20px}
.d-classroom-tarjeta{grid-column:span 10;background:#fff;border-radius:20px;padding:32px;box-shadow:0 4px 8px rgba(169,169,169,.08);display:flex;flex-direction:column;gap:24px;min-height:466px;overflow:hidden}
.d-classroom-tarjeta:nth-child(1){grid-column:span 17}.d-classroom-tarjeta:nth-child(2){grid-column:span 13}
.d-classroom-tarjeta:nth-child(6){grid-column:span 17}.d-classroom-tarjeta:nth-child(7){grid-column:span 13}
.d-classroom-tarjeta h3{margin:0;font-size:20px;line-height:28px;letter-spacing:-.5px;font-weight:500;color:var(--dc-suave)}
.d-classroom-tarjeta h3 strong{color:var(--dc-tinta);font-weight:500}
.d-classroom-recorte{flex:1;min-height:260px;border-radius:14px;overflow:hidden;background:#EEF2FB;position:relative}
.d-classroom-recorte img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:0 0}
.d-classroom-datos{flex:1;list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px}
.d-classroom-datos li{padding:8px 14px;border-radius:9999px;background:#E0EAFC;font-size:14px;line-height:20px;font-weight:500;color:var(--dc-tinta)}
.d-classroom-testi{padding:120px 0}
.d-classroom-testi-tarjeta{margin:56px auto 0;max-width:1000px;display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:40px;align-items:center;background:var(--dc-noche);color:#fff;border-radius:24px;padding:24px}
.d-classroom-testi-tarjeta video{display:block;width:100%;aspect-ratio:9/16;max-height:560px;object-fit:cover;border-radius:16px;background:#000}
.d-classroom-testi-tarjeta blockquote{margin:0;font-size:28px;line-height:36px;letter-spacing:-.8px;font-weight:600}
.d-classroom-testi-tarjeta p{margin:18px 0 0;font-size:16px;line-height:24px;color:rgba(255,255,255,.78)}
.d-classroom-testi-quien{margin-top:28px;display:flex;flex-direction:column;gap:2px;font-size:14px;line-height:20px}
.d-classroom-testi-quien strong{font-weight:700}
.d-classroom-meses{margin-top:22px;display:flex;gap:10px;flex-wrap:wrap}
.d-classroom-meses span{padding:8px 14px;border-radius:12px;background:rgba(255,255,255,.1);font-size:14px}
.d-classroom-meses b{display:block;font-size:20px;line-height:24px}
.d-classroom-cierre{background:var(--dc-noche);color:#fff;padding:120px 0;text-align:center}
.d-classroom-cierre h2{margin:0 auto;max-width:720px;font-size:48px;line-height:52.8px;letter-spacing:-1.5px;font-weight:700}
.d-classroom-cierre .d-classroom-btn{margin-top:32px}
.d-classroom-cierre-chico{margin:18px auto 0;max-width:560px;font-size:15px;line-height:22px;color:rgba(255,255,255,.72)}
.d-classroom-pie{padding:40px 0;border-top:1px solid #E4E7EB}
.d-classroom-pie ul{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:10px 22px}
.d-classroom-pie a{color:var(--dc-gris);font-size:13px;text-decoration:none}
@media (max-width:991px){
  .d-classroom-h1{font-size:60px;line-height:66px;letter-spacing:-2.4px}
  .d-classroom-que{grid-template-columns:minmax(0,1fr);gap:32px}
  .d-classroom-grilla{grid-template-columns:repeat(2,minmax(0,1fr))}
  .d-classroom-tarjeta,.d-classroom-tarjeta:nth-child(n){grid-column:span 1}
  .d-classroom-tarjeta:nth-child(1),.d-classroom-tarjeta:nth-child(7){grid-column:span 2}
}
@media (max-width:767px){
  .d-classroom-hero{padding:64px 0 40px}
  .d-classroom-h1{font-size:44px;line-height:44px;letter-spacing:-1.8px}
  .d-classroom-chico{font-size:16px;line-height:24px}
  .d-classroom-hero .d-classroom-btn{display:flex;width:100%;padding:18px 28px}
  .d-classroom-cinta{height:340px}
  .d-classroom-caso{width:195px;height:260px;padding:16px}
  .d-classroom-cifra{font-size:20px;line-height:24px;letter-spacing:-.4px}
  .d-classroom-cifra-l{font-size:14px;line-height:18px}
  .d-classroom-noche{padding:28px 0 72px}
  .d-classroom-h2c{font-size:28px;line-height:36.4px;letter-spacing:-.5px}
  .d-classroom-sub{font-size:16px;line-height:24px;letter-spacing:-.5px}
  .d-classroom-tabs{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;scrollbar-width:none;margin:0 -20px;padding:0 20px}
  .d-classroom-tabs label{flex:none;padding:8px 14px}
  .d-classroom-marco{padding:5px;border-radius:14px}
  .d-classroom-que{margin-top:64px}
  .d-classroom-que h2{font-size:36px;line-height:43.2px}
  .d-classroom-blanco{padding:72px 0 24px}
  .d-classroom-h2{font-size:36px;line-height:43.2px}
  .d-classroom-grupo{margin-top:72px}
  .d-classroom-grupo h3{font-size:32px;line-height:38.4px}
  .d-classroom-grupo-d{font-size:16px;line-height:24px;letter-spacing:-.5px}
  .d-classroom-chips{margin:20px -20px 0;padding:0 20px}
  .d-classroom-chips label{font-size:16px;line-height:24px}
  .d-classroom-panel{margin:20px -19px 0;padding:40px 24px 0;min-height:0}
  .d-classroom-vista{flex-direction:column;min-height:0}
  .d-classroom-copia{max-width:none}
  .d-classroom-captura{margin:0 -24px;min-height:0;height:260px;max-width:none;flex:none}
  .d-classroom-captura img{border-top-left-radius:0}
  .d-classroom-grilla-sec,.d-classroom-testi,.d-classroom-cierre{padding:72px 0}
  .d-classroom-grilla{grid-template-columns:minmax(0,1fr);gap:16px;margin-top:36px}
  .d-classroom-tarjeta,.d-classroom-tarjeta:nth-child(n){grid-column:span 1;min-height:0;padding:24px}
  .d-classroom-recorte{min-height:220px}
  .d-classroom-testi-tarjeta{grid-template-columns:minmax(0,1fr);padding:16px;gap:24px}
  .d-classroom-testi-tarjeta video{max-height:420px}
  .d-classroom-testi-tarjeta blockquote{font-size:22px;line-height:29px}
  .d-classroom-cierre h2{font-size:32px;line-height:41.6px}
}
@media (prefers-reduced-motion:reduce){
  .d-classroom-gira span{animation:none}.d-classroom-gira span:first-child{opacity:1}
  .d-classroom-cinta-pista{animation:none}
}
`;

/** Su tilde de las listas (un círculo con el visto). */
const Tilde = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#0A0A0A" /><path d="M6 10.2l2.6 2.6L14 7.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Boton = () => <a href={RUTA_CTA} className={`${P}-btn`}>{TEXTO_CTA}</a>;

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;
const Img = ({ f, alt, pos, clase }: { f: Foto; alt: string; pos?: string; clase?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={FOTOS_CLASSROOM[f]} alt={alt} width={1600} height={1000} loading="lazy" decoding="async" className={clase} style={pos ? { objectPosition: pos } : undefined} />
);

/** Las reglas de las pestañas y de las píldoras (radios con :has()): la elegida se pinta y muestra lo suyo. */
function cssDeRadios(grupo: string, n: number, color: string, img: boolean): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const sel = `.${P}-${grupo}:has(#${P}-${grupo}-${i}:checked)`;
    s += `${sel} label[for="${P}-${grupo}-${i}"]{background:${color};color:${img ? '#0F0F35' : '#0A0A0A'}}`;
    s += img ? `${sel} .${P}-${grupo}-img-${i}{display:block}` : `${sel} .${P}-${grupo}-vista-${i}{display:flex}`;
  }
  return s;
}

/** La galería del azul noche: las pestañas y la captura grande de cada una. */
function Galeria({ t }: { t: Tarjetas }) {
  return (
    <div className={`${P}-gal`}>
      <style dangerouslySetInnerHTML={{ __html: cssDeRadios('gal', t.items.length, '#fff', true) }} />
      {t.items.map((it, i) => <input key={it.titulo} type="radio" name={`${P}-gal`} id={`${P}-gal-${i}`} defaultChecked={i === 0} aria-label={it.titulo} />)}
      <div className={`${P}-tabs`}>
        {t.items.map((it, i) => <label key={it.titulo} htmlFor={`${P}-gal-${i}`}>{it.titulo}</label>)}
      </div>
      <div className={`${P}-marco`} data-tema-fijo="">
        {t.items.map((it, i) => {
          const f = FOTO_DE[it.titulo];
          // Con lazy: las escondidas (display:none) no se piden hasta que se toca su pestaña.
          return f ? <Img key={it.titulo} f={f} alt={it.texto} clase={`${P}-gal-img-${i}`} /> : null;
        })}
      </div>
    </div>
  );
}

/** Un grupo («Community», «Payments»…): su título, su bajada, sus píldoras y el panel de color de la elegida. */
function Grupo({ t, n }: { t: Tarjetas; n: number }) {
  const g = `grupo${n}`;
  return (
    <div className={`${P}-grupo ${P}-${g}`}>
      <style dangerouslySetInnerHTML={{ __html: cssDeRadios(g, t.items.length, CHIP[n % CHIP.length], false) }} />
      <h3 dangerouslySetInnerHTML={html(t.titulo)} />
      {t.bajada && <p className={`${P}-grupo-d`} dangerouslySetInnerHTML={html(t.bajada)} />}
      {t.items.map((it, i) => <input key={it.titulo} type="radio" name={`${P}-${g}`} id={`${P}-${g}-${i}`} defaultChecked={i === 0} aria-label={it.titulo} />)}
      <div className={`${P}-chips`}>
        {t.items.map((it, i) => <label key={it.titulo} htmlFor={`${P}-${g}-${i}`}>{it.titulo}</label>)}
      </div>
      <div className={`${P}-panel`} style={{ background: PANELES[n % PANELES.length] }}>
        {t.items.map((it, i) => {
          const f = FOTO_DE[it.titulo];
          return (
            <div key={it.titulo} className={`${P}-vista ${P}-${g}-vista-${i}`}>
              <div className={`${P}-copia`}>
                {it.meta && <p className={`${P}-frase`} dangerouslySetInnerHTML={html(it.meta)} />}
                {it.puntos && (
                  <ul className={`${P}-lista`}>
                    {it.puntos.map((pt) => <li key={pt}><Tilde /><span dangerouslySetInnerHTML={html(pt)} /></li>)}
                  </ul>
                )}
              </div>
              {f && <div className={`${P}-captura`} data-tema-fijo=""><Img f={f} alt={it.texto} pos={ENCUADRE[it.titulo]} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Lo que va adentro de cada tarjeta de la grilla: su captura de cerca o, donde no hay pantalla, los datos del código. */
function Recorte({ que }: { que: string }) {
  if (que === 'candados') return <ul className={`${P}-datos`}>{CANDADOS.map((c) => <li key={c}>{c}</li>)}</ul>;
  if (que === 'acceso') return <ul className={`${P}-datos`}>{['Su link personal', 'Sin usuario ni contraseña', 'Sólo sus productos', 'La invitación, al ganar la venta'].map((c) => <li key={c}>{c}</li>)}</ul>;
  const f = (que in FOTOS_CLASSROOM ? que : 'curso') as Foto;
  const pos: Record<string, string> = { curso: '30% 40%', clase: '45% 30%', tarea: '100% 30%', comunidad: '0% 20%', ranking: '30% 20%' };
  return <div className={`${P}-recorte`} data-tema-fijo=""><Img f={f} alt="" pos={pos[f]} /></div>;
}

/** Las secciones, en el orden de la landing (el de la portada de Circle). */
function secciones(bloques: Bloque[]): ReactNode[] {
  const out: ReactNode[] = [];
  let tarjetas = 0;
  let grupos = 0;
  let noche: ReactNode[] = [];
  const cerrarNoche = (k: string) => {
    if (!noche.length) return;
    out.push(<section key={`noche-${k}`} className={`${P}-noche`}><div className={`${P}-in`}>{noche}</div></section>);
    noche = [];
  };
  bloques.forEach((b, k) => {
    if (b.tipo === 'hero') {
      const [primera, ...resto] = TEXTOS_CLASSROOM.gira;
      out.push(
        <section key={k} className={`${P}-hero`}>
          <div className={`${P}-in`}>
            <h1 className={`${P}-h1`} aria-label={b.titulo}>
              <span className={`${P}-linea`} aria-hidden="true">Aloja tu <span className={`${P}-gira`}><span>{primera}</span>{resto.map((w) => <span key={w}>{w}</span>)}</span></span>
              <span className={`${P}-linea`} aria-hidden="true">en MaKo</span>
            </h1>
            <p className={`${P}-chico`} dangerouslySetInnerHTML={html(b.bajada)} />
            <Boton />
          </div>
        </section>,
      );
      return;
    }
    if (b.tipo === 'tarjetas') {
      const t = b as Tarjetas;
      const n = tarjetas++;
      if (n === 0) {
        // Su cinta de casos: las mismas tarjetas, con de dónde viene el video de cada clase. Va dos veces para que no corte.
        const una = (copia: boolean) => t.items.map((it) => (
          <div key={`${copia ? 'b' : 'a'}-${it.titulo}`} className={`${P}-caso`} aria-hidden={copia || undefined}>
            <span className={`${P}-pildora`}>{it.meta}</span>
            <p className={`${P}-cifra`}>{it.titulo}</p>
            <p className={`${P}-cifra-l`}>{it.texto}</p>
          </div>
        ));
        out.push(
          <section key={k} className={`${P}-cinta`}>
            <h2 className={`${P}-oculto`} dangerouslySetInnerHTML={html(t.titulo)} />
            <div className={`${P}-cinta-pista`}>{una(false)}{una(true)}</div>
          </section>,
        );
      } else if (n === 1) {
        noche.push(
          <div key={k}>
            <h2 className={`${P}-h2c`} dangerouslySetInnerHTML={html(t.titulo)} />
            {t.bajada && <p className={`${P}-sub`} dangerouslySetInnerHTML={html(t.bajada)} />}
            <Galeria t={t} />
          </div>,
        );
      } else if (n === 2) {
        const it = t.items[0];
        noche.push(
          <div key={k} className={`${P}-que`}>
            <div data-tema-fijo=""><Img f="curso" alt="El portal del alumno: la portada del curso con sus módulos" /></div>
            <div>
              <h2 dangerouslySetInnerHTML={html(t.titulo)} />
              {it && <p className={`${P}-negrita`} dangerouslySetInnerHTML={html(it.titulo)} />}
              {it && <p dangerouslySetInnerHTML={html(it.texto)} />}
              {t.cta && <Boton />}
            </div>
          </div>,
        );
        cerrarNoche(String(k));
        // «Yes, you really can run everything on Circle»: el título de los grupos, con su botón.
        out.push(
          <section key={`grupos-${k}`} className={`${P}-blanco`}>
            <div className={`${P}-in`}>
              <h2 className={`${P}-h2`}>{TEXTOS_CLASSROOM.grupos.titulo}</h2>
              <p className={`${P}-sub`}>{TEXTOS_CLASSROOM.grupos.bajada}</p>
              <div className={`${P}-centro`}><Boton /></div>
            </div>
          </section>,
        );
      } else if (t.fondo) {
        out.push(
          <section key={k} className={`${P}-grilla-sec`}>
            <div className={`${P}-in`}>
              <h2 className={`${P}-h2`} dangerouslySetInnerHTML={html(t.titulo)} />
              {t.bajada && <p className={`${P}-sub`} dangerouslySetInnerHTML={html(t.bajada)} />}
              <div className={`${P}-centro`}><Boton /></div>
              <div className={`${P}-grilla`}>
                {t.items.map((it) => (
                  <div key={it.titulo} className={`${P}-tarjeta`}>
                    <h3><strong dangerouslySetInnerHTML={html(it.titulo)} /></h3>
                    <Recorte que={it.texto} />
                  </div>
                ))}
              </div>
            </div>
          </section>,
        );
      } else {
        out.push(<section key={k} className={`${P}-in`}><Grupo t={t} n={grupos++} /></section>);
      }
      return;
    }
    if (b.tipo === 'caso') {
      // «Loved by the best»: su testimonio, con el caso de Mauricio (su video, su frase y sus tres meses).
      out.push(
        <section key={k} className={`${P}-testi`}>
          <div className={`${P}-in`}>
            <h2 className={`${P}-h2`}>El caso de {CASO.quien}</h2>
            <div className={`${P}-testi-tarjeta`} data-tema-fijo="">
              <video src={CASO.video} controls playsInline preload="metadata" />
              <div>
                <blockquote dangerouslySetInnerHTML={html(CASO.titulo)} />
                <p>{CASO.sub}</p>
                <div className={`${P}-meses`}>{CASO.meses.map((m) => <span key={m.mes}><b>{m.monto}</b>{m.mes}</span>)}</div>
                <div className={`${P}-testi-quien`}><strong>{CASO.quien}</strong><span>{CASO.rol}</span></div>
              </div>
            </div>
          </div>
        </section>,
      );
    }
    // Esta landing no tiene otros tipos de bloque (su referencia no tiene preguntas ni cifras sueltas).
  });
  cerrarNoche('fin');
  return out;
}

export default function DisenoClassroom({ landing }: PropsDiseno) {
  const otras = otrasFunciones(landing.slug);
  return (
    <div className={`${P}-raiz`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`${P}-in`}>
        <header className={`${P}-nav`}>
          <LogoMaKo tamano={30} />
          <ul>
            <li><a href="/planes">Precios</a></li>
            <li><a href={RUTA_CTA}>{TEXTO_CTA}</a></li>
          </ul>
        </header>
      </div>
      <main>
        {secciones(landing.bloques)}
        {/* «Join thousands and build your home on Circle today» y su botón. */}
        <section className={`${P}-cierre`}>
          <div className={`${P}-in`}>
            <h2>{TEXTOS_CLASSROOM.cierre}</h2>
            <Boton />
            <p className={`${P}-cierre-chico`} dangerouslySetInnerHTML={html(TEXTO_CIERRE)} />
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
