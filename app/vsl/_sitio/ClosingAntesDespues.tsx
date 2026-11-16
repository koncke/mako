// =============================================================================
// Closing: el antes y el después de Mauricio, una llamada como en Google Meet y la tarjeta de Closing de MaKo (16/11/2026)
// =============================================================================
// Martín: «me gustaría que aparezca algo así similar a Google Meet y que sea tipo objeciones, dolores, etcétera, y que al principio
// se vea un antes y después»; «copia como normalmente son las cartas de Google Meet… más horizontales»; «no pongas MaKo en vivo,
// porque no lo tenemos todavía en vivo»; «en lugar de poner puntuación… la tasa de closing o la cantidad de cierres»; «que
// aparezcan cosas como negativas que pasan… y que luego justamente se vea una parte dentro de MaKo»; «intenta representarlo un poco
// mejor con lo que es MaKo» (la hoja Closing del Dashboard); y «un zoom cuando van apareciendo las objeciones… más típicas».
// El ciclo (16 s, sólo CSS): 1) el antes y el después en cierres (0 → 9 por trimestre); 2) una llamada real de Mauricio como en Meet:
// la cámara se acerca al costado de MaKo mientras marca las objeciones en su minuto (y si se respondieron); 3) la tarjeta «Tasa de
// cierre» de la hoja Closing del Dashboard, con su mismo diseño (el de public/vsl-assets/closing/hoja-tasa.jpg) y los números de
// Mauricio, y debajo los cierres de cada mes. Todo sale de ./closing-mauricio.ts (datos reales, sin frases de terceros).
// Las tarjetas de Meet son de 16:9 y la foto de Mauricio es su retrato llevado a 16:9 (mauricio-meet.jpg). En unidades del
// contenedor (cqw): entra igual en la fila de la computadora y en la del teléfono. `data-tema-fijo`: el sol y la luna no lo toca.
import { CLOSING_MAURICIO, tasaDe } from './closing-mauricio';

/** El minuto como lo escribe un reproductor: m:ss, o h:mm:ss pasada la hora. */
const minuto = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
const FOTO_MAURICIO = '/vsl-assets/sitio/avatar/mauricio-meet.jpg';
const CICLO = 16;

const CSS = `
.s-cad{container-type:inline-size;position:absolute;inset:0;background:#202124;color:#E8EAED;font-family:inherit;overflow:hidden}
/* La «cámara»: la llamada entera se acerca al costado de MaKo mientras salen las objeciones (del 21 % al 49 % del ciclo). */
.s-cad-cam{position:absolute;inset:0;transform-origin:97% 22%;animation:s-cad-zoom ${CICLO}s infinite}
@keyframes s-cad-zoom{0%,20%{transform:none}25%,48%{transform:scale(1.4)}53%,100%{transform:none}}
.s-cad-in{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 38cqw;gap:2cqw;padding:2.4cqw 2.4cqw 9cqw}
/* Las tarjetas como las de Meet: 16:9 y del tamaño más grande que entra, que en este alto es una arriba de la otra y centradas
   (así las acomoda Meet). La caja es de 16:10 (62,5cqw de alto): entre el margen de arriba y la barra quedan 51,1cqw, y dos de
   44cqw de ancho (24,75 de alto) con su espacio entran. */
.s-cad-tiles{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4cqw;min-height:0}
.s-cad-tile{position:relative;flex:none;width:44cqw;max-width:100%;aspect-ratio:16/9;border-radius:1.2cqw;overflow:hidden;background:#3C4043}
.s-cad-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.s-cad-tile::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 .3cqw #8AB4F8;opacity:0}
.s-cad-apagada{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.s-cad-avatar{width:9.5cqw;height:9.5cqw;border-radius:50%;background:#7B61FF;color:#fff;font-size:4.6cqw;font-weight:500;display:flex;align-items:center;justify-content:center}
.s-cad-nombre{position:absolute;left:1.2cqw;bottom:1cqw;font-size:1.7cqw;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}
/* Quién habla, como en Meet: el borde celeste y el círculo azul con tres barritas. El prospecto mientras van saliendo sus
   objeciones; el resto del tiempo, Mauricio. */
.s-cad-ola{position:absolute;top:1cqw;right:1cqw;width:3cqw;height:3cqw;border-radius:50%;background:#1A73E8;display:flex;align-items:center;justify-content:center;gap:.32cqw;opacity:0}
.s-cad-ola i{width:.42cqw;height:.42cqw;border-radius:.3cqw;background:#fff;animation:s-cad-ola .5s ease-in-out infinite alternate}
.s-cad-ola i:nth-child(2){animation-delay:-.25s}
.s-cad-ola i:nth-child(3){animation-delay:-.4s}
@keyframes s-cad-ola{to{height:1.5cqw}}
.s-cad-tile-a::after,.s-cad-tile-a .s-cad-ola{animation:s-cad-a ${CICLO}s infinite}
.s-cad-tile-b::after,.s-cad-tile-b .s-cad-ola{animation:s-cad-b ${CICLO}s infinite}
@keyframes s-cad-a{0%,20%{opacity:1}22%,50%{opacity:0}52%,100%{opacity:1}}
@keyframes s-cad-b{0%,20%{opacity:0}22%,50%{opacity:1}52%,100%{opacity:0}}
.s-cad-panel{background:#fff;color:#12151B;border-radius:1.2cqw;padding:2cqw 1.8cqw;display:flex;flex-direction:column;gap:1.2cqw;min-height:0;overflow:hidden}
.s-cad-panel-t{display:flex;align-items:center;gap:1cqw;font-size:1.9cqw;font-weight:800}
.s-cad-panel-t svg{width:2.4cqw;height:2.4cqw}
.s-cad-panel-t small{margin-left:auto;font-size:1.45cqw;font-weight:700;color:#6B7280}
/* Cada objeción: el punto rojo (algo que frena la venta), qué fue, su minuto y si Mauricio la respondió (✓ verde) o no (✕ rojo). */
.s-cad-chip{display:flex;align-items:center;gap:.9cqw;padding:1.1cqw 1.3cqw;border-radius:1.2cqw;background:#FDF3F2;font-size:1.5cqw;font-weight:700;white-space:nowrap;opacity:0;transform:translateY(1cqw);animation:${CICLO}s infinite}
.s-cad-chip i{flex:none;width:1.3cqw;height:1.3cqw;border-radius:50%;background:#EA4335}
.s-cad-chip span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.s-cad-chip b{margin-left:auto;font-weight:600;color:#6B7280}
.s-cad-chip svg{flex:none;width:1.8cqw;height:1.8cqw}
/* La barra de Meet: la hora a la izquierda; al medio el micrófono, la cámara, los subtítulos, levantar la mano, presentar, más y
   colgar (la píldora roja); a la derecha los detalles, las personas, el chat, las actividades y MaKo (abierto: resaltado). */
.s-cad-barra{position:absolute;left:2.4cqw;right:2.4cqw;bottom:0;height:7.5cqw;display:grid;grid-template-columns:1fr auto 1fr;align-items:center}
.s-cad-hora{font-size:1.7cqw;font-weight:600;color:#E8EAED}
.s-cad-botones{display:flex;align-items:center;gap:1cqw}
.s-cad-boton{width:4.4cqw;height:4.4cqw;border-radius:50%;background:#3C4043;display:flex;align-items:center;justify-content:center}
.s-cad-boton svg,.s-cad-icono svg{width:2.2cqw;height:2.2cqw;fill:#E8EAED}
.s-cad-colgar{width:6.4cqw;border-radius:99px;background:#EA4335}
.s-cad-der{justify-self:end;display:flex;align-items:center;gap:.6cqw}
.s-cad-icono{width:4cqw;height:4cqw;border-radius:50%;display:flex;align-items:center;justify-content:center}
.s-cad-icono-on{background:rgba(138,180,248,.24)}
/* 1) El antes y el después, en cierres. */
.s-cad-intro{position:absolute;inset:0;z-index:3;background:rgba(32,33,36,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4cqw;animation:s-cad-intro ${CICLO}s infinite}
.s-cad-intro-t{font-size:2.2cqw;font-weight:700;color:#BDC1C6;letter-spacing:.08em;text-transform:uppercase}
.s-cad-notas{display:flex;align-items:center;gap:3cqw}
.s-cad-nota{display:flex;flex-direction:column;align-items:center;gap:.4cqw}
.s-cad-n{font-size:10cqw;line-height:1;font-weight:800;letter-spacing:-.03em}
.s-cad-que{font-size:2.2cqw;font-weight:700;color:#E8EAED}
.s-cad-mes{font-size:1.8cqw;font-weight:600;color:#9AA0A6}
.s-cad-n-antes{color:#9AA0A6}
.s-cad-n-despues{color:#8AB4F8}
.s-cad-flecha svg{display:block;width:5cqw;height:5cqw;color:#5F6368}
@keyframes s-cad-intro{0%,15%{opacity:1;visibility:visible}19%,97%{opacity:0;visibility:hidden}100%{opacity:1;visibility:visible}}
/* 3) La hoja Closing del Dashboard de MaKo: su tarjeta «Tasa de cierre» (el verde petróleo con la cuadrícula, el número grande, la
   diferencia con el período anterior, la barra de las llamadas que terminaron en venta y la columna de analizadas, score y ganadas)
   y debajo los cierres de cada mes. */
.s-cad-app{position:absolute;inset:0;z-index:2;background:#F4F6FA;color:#12151B;display:grid;grid-template-columns:13cqw minmax(0,1fr);opacity:0;visibility:hidden;animation:s-cad-app ${CICLO}s infinite}
@keyframes s-cad-app{0%,55%{opacity:0;visibility:hidden;transform:translateY(2cqw)}59%,95%{opacity:1;visibility:visible;transform:none}98%,100%{opacity:0;visibility:hidden}}
.s-cad-lat{background:#fff;border-right:1px solid #E5E8EF;padding:2.6cqw 1.6cqw;display:flex;flex-direction:column;gap:1.6cqw}
.s-cad-lat svg{width:3.2cqw;height:3.2cqw;margin-bottom:1cqw}
.s-cad-lat span{height:1.3cqw;border-radius:1cqw;background:#E5E8EF}
.s-cad-lat span.s-cad-lat-on{background:#2F6FED}
.s-cad-main{padding:2.6cqw 3cqw;display:flex;flex-direction:column;gap:1.8cqw;min-width:0}
.s-cad-main-t{margin:0;font-size:2.4cqw;font-weight:800}
.s-cad-main-t small{margin-left:1.2cqw;font-size:1.5cqw;font-weight:600;color:#6B7280}
.s-cad-tasa{position:relative;overflow:hidden;border-radius:2cqw;color:#fff;display:grid;grid-template-columns:minmax(0,1fr) 15cqw;gap:2.4cqw;padding:2.4cqw 2.8cqw;background:linear-gradient(135deg,#0A2A2E 0%,#0D3539 55%,#13595F 100%)}
.s-cad-tasa::before{content:'';position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:3.4cqw 3.4cqw}
.s-cad-tasa>*{position:relative}
.s-cad-tasa-t{margin:0;font-size:1.7cqw;font-weight:700;color:#CFE6E4}
.s-cad-tasa-n{display:block;margin-top:.6cqw;font-size:7cqw;line-height:1;font-weight:800;letter-spacing:-.02em}
.s-cad-delta{display:flex;align-items:center;gap:1cqw;margin-top:1.2cqw;font-size:1.5cqw;font-weight:500;color:#E6F2F1}
.s-cad-delta b{padding:.4cqw .9cqw;border-radius:.7cqw;background:#B6F0C9;color:#0B3B2A;font-weight:800}
.s-cad-prog{margin-top:2.6cqw;height:1.1cqw;border-radius:1cqw;background:rgba(255,255,255,.14);overflow:hidden}
.s-cad-prog i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#5AB3B8,#E2FAF8);transform-origin:left;transform:scaleX(0);animation:s-cad-llena ${CICLO}s infinite}
@keyframes s-cad-llena{0%,60%{transform:scaleX(0)}68%,100%{transform:scaleX(1)}}
.s-cad-prog-t{display:flex;justify-content:space-between;gap:1cqw;margin-top:1cqw;font-size:1.45cqw;color:#E6F2F1}
.s-cad-tasa-der{border-left:1px solid rgba(255,255,255,.2);padding-left:2cqw;display:flex;flex-direction:column;justify-content:center}
.s-cad-tasa-der p{margin:0;padding:.7cqw 0;font-size:1.5cqw;color:#CFE6E4;border-bottom:1px solid rgba(255,255,255,.14)}
.s-cad-tasa-der p:last-child{border-bottom:0}
.s-cad-tasa-der b{display:block;font-size:2.8cqw;line-height:1.1;font-weight:800;color:#fff}
.s-cad-graf{flex:1;min-height:0;background:#fff;border:1px solid #E5E8EF;border-radius:1.4cqw;padding:1.6cqw 2.2cqw 1.2cqw;display:flex;flex-direction:column}
.s-cad-graf p{margin:0 0 .6cqw;font-size:1.5cqw;font-weight:700;color:#6B7280}
.s-cad-barras{flex:1;min-height:0;display:grid;grid-template-columns:repeat(6,1fr);gap:1.6cqw}
.s-cad-barra-m{display:grid;grid-template-rows:minmax(0,1fr) auto;justify-items:center;gap:.5cqw;min-height:0;font-size:1.4cqw;font-weight:700;color:#6B7280}
/* El número de cada mes justo arriba de su barra (--h es el alto de la barra), y aparece cuando la barra terminó de crecer. */
.s-cad-pista{position:relative;width:100%;margin-top:2.4cqw}
.s-cad-pista i{position:absolute;left:0;right:0;bottom:0;height:var(--h);border-radius:.6cqw .6cqw 0 0;background:#2F6FED;transform-origin:bottom;transform:scaleY(0);animation:s-cad-crece ${CICLO}s infinite}
.s-cad-pista b{position:absolute;left:0;right:0;bottom:calc(var(--h) + .4cqw);text-align:center;color:#12151B;font-size:1.5cqw;opacity:0;animation:s-cad-numero ${CICLO}s infinite}
.s-cad-barra-m.s-cad-cero i{background:#D7DCE6}
@keyframes s-cad-crece{0%,59%{transform:scaleY(0)}68%,100%{transform:scaleY(1)}}
@keyframes s-cad-numero{0%,66%{opacity:0}70%,95%{opacity:1}98%,100%{opacity:0}}
/* En una caja chica (el teléfono): las dos tarjetas igual (entran: 44cqw al lado de un panel de 46cqw), el panel más ancho, la
   letra más grande, sin el ✓/✕ de las objeciones, en la barra sólo el micrófono, la cámara, más, colgar y MaKo, y en la hoja de
   MaKo sólo la tarjeta de la tasa, más grande y sin la barra del costado. */
@container (max-width:480px){.s-cad-in{grid-template-columns:minmax(0,1fr) 46cqw}.s-cad-cam{transform-origin:98% 20%}
.s-cad-chip{font-size:2.2cqw;padding:1.1cqw 1.6cqw}.s-cad-chip svg{display:none}.s-cad-chip i{width:2cqw;height:2cqw}.s-cad-panel-t{font-size:3cqw}.s-cad-panel-t small{font-size:2.3cqw}.s-cad-nombre,.s-cad-hora{font-size:2.8cqw}.s-cad-ola{width:4cqw;height:4cqw}
.s-cad-intro-t{font-size:3.4cqw}.s-cad-que{font-size:3.2cqw}.s-cad-mes{font-size:2.8cqw}
.s-cad-cc,.s-cad-mano,.s-cad-pres,.s-cad-der .s-cad-icono:not(.s-cad-icono-on){display:none}.s-cad-boton,.s-cad-icono{width:6cqw;height:6cqw}.s-cad-boton svg,.s-cad-icono svg{width:3cqw;height:3cqw}.s-cad-colgar{width:8.6cqw}
.s-cad-app{grid-template-columns:minmax(0,1fr)}.s-cad-lat,.s-cad-graf{display:none}.s-cad-main{padding:4cqw 4.4cqw;gap:2.6cqw;justify-content:center}.s-cad-main-t{font-size:4cqw}.s-cad-main-t small{font-size:2.8cqw}
.s-cad-tasa{grid-template-columns:minmax(0,1fr) 22cqw;padding:3.6cqw 4cqw}.s-cad-tasa-t{font-size:3cqw}.s-cad-tasa-n{font-size:11cqw}.s-cad-delta{font-size:2.4cqw}.s-cad-prog{height:1.8cqw}.s-cad-prog-t{font-size:2.3cqw}.s-cad-prog-t span+span{display:none}.s-cad-tasa-der p{font-size:2.4cqw}.s-cad-tasa-der b{font-size:4.4cqw}}
@media (prefers-reduced-motion:reduce){.s-cad-intro{display:none}.s-cad-cam{animation:none}.s-cad-chip{animation:none;opacity:1;transform:none}.s-cad-tile-a::after,.s-cad-tile-a .s-cad-ola{animation:none;opacity:1}.s-cad-tile-b::after,.s-cad-tile-b .s-cad-ola{animation:none}.s-cad-ola i{animation:none;height:1cqw}.s-cad-app{animation:none}.s-cad-prog i,.s-cad-pista i{animation:none;transform:none}.s-cad-pista b{animation:none;opacity:1}}
`;

/** Cada objeción con SU tiempo en el ciclo (la primera a los 3,9 s, cuando la cámara ya se acercó, y una cada 1,2 s; se van todas
 *  juntas al final): con un `animation-delay` por chip, los últimos se cruzaban de una vuelta a la otra. Son los hijos 2.º en adelante. */
const CSS_CHIPS = CLOSING_MAURICIO.llamada.objeciones.map((_, i) => {
  const entra = Math.round(((3.9 + i * 1.2) / CICLO) * 1000) / 10;
  return `.s-cad-chip:nth-child(${i + 2}){animation-name:s-cad-chip-${i}}@keyframes s-cad-chip-${i}{0%,${entra}%{opacity:0;transform:translateY(1cqw)}${Math.round((entra + 2.5) * 10) / 10}%,95%{opacity:1;transform:none}98%,100%{opacity:0;transform:none}}`;
}).join('\n');

/** Los íconos de la barra de Meet (los de Material, en 24×24). */
const ICONO = {
  mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z',
  cam: 'M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z',
  cc: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
  mano: 'M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z',
  presentar: 'M21 3H3c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h18c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 16.02H3V4.98h18v14.04zM10 12H8l4-4 4 4h-2v4h-4v-4z',
  mas: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  colgar: 'M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z',
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  personas: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  chat: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z',
  actividades: 'M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z',
} as const;
const ESTRELLA = 'M0 -11 C1.5 -4.5 4.5 -1.5 11 0 C4.5 1.5 1.5 4.5 0 11 C-1.5 4.5 -4.5 1.5 -11 0 C-4.5 -1.5 -1.5 -4.5 0 -11 Z';
const Estrella = () => <svg viewBox="-12 -12 24 24" aria-hidden="true"><path d={ESTRELLA} fill="#F2B01E" /></svg>;

const Boton = ({ d, clase = '' }: { d: string; clase?: string }) => (
  <span className={`s-cad-boton${clase ? ` ${clase}` : ''}`}><svg viewBox="0 0 24 24"><path d={d} /></svg></span>
);

/** ✓ verde si la objeción se respondió; ✕ roja si quedó sin responder. */
const Estado = ({ ok }: { ok: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="8" fill={ok ? '#34A853' : '#EA4335'} />
    {ok
      ? <path d="M4.6 8.3 7 10.6l4.4-4.8" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      : <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />}
  </svg>
);

export function ClosingAntesDespues() {
  const { antes, despues, porMes, llamada } = CLOSING_MAURICIO;
  const maxMes = Math.max(...porMes.map((m) => m.cierres), 1);
  const tasa = tasaDe(despues);
  return (
    <div className="s-cad" data-tema-fijo="" role="img"
      aria-label={`Mauricio con MaKo: de ${antes.cierres} cierres (${antes.periodo}) a ${despues.cierres} (${despues.periodo}); una llamada suya con las objeciones que marcó MaKo, y su tasa de cierre de ${tasaDe(antes)} % a ${tasa} %`}>
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_CHIPS }} />
      <div className="s-cad-cam">
        <div className="s-cad-in">
          <div className="s-cad-tiles">
            <div className="s-cad-tile s-cad-tile-a">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={FOTO_MAURICIO} alt="" />
              <span className="s-cad-ola"><i /><i /><i /></span>
              <span className="s-cad-nombre">Mauricio</span>
            </div>
            <div className="s-cad-tile s-cad-tile-b">
              <div className="s-cad-apagada"><span className="s-cad-avatar">P</span></div>
              <span className="s-cad-ola"><i /><i /><i /></span>
              <span className="s-cad-nombre">Prospecto</span>
            </div>
          </div>
          <div className="s-cad-panel">
            <div className="s-cad-panel-t"><Estrella />MaKo<small>Objeciones</small></div>
            {llamada.objeciones.map((o) => (
              <div key={o.tipo} className="s-cad-chip">
                <i /><span>{o.tipo}</span><b>{minuto(o.segundo)}</b><Estado ok={o.respondida} />
              </div>
            ))}
          </div>
        </div>
        <div className="s-cad-barra" aria-hidden="true">
          <span className="s-cad-hora">{minuto(llamada.duracionMin * 60)}</span>
          <div className="s-cad-botones">
            <Boton d={ICONO.mic} />
            <Boton d={ICONO.cam} />
            <Boton d={ICONO.cc} clase="s-cad-cc" />
            <Boton d={ICONO.mano} clase="s-cad-mano" />
            <Boton d={ICONO.presentar} clase="s-cad-pres" />
            <Boton d={ICONO.mas} />
            <Boton d={ICONO.colgar} clase="s-cad-colgar" />
          </div>
          <div className="s-cad-der">
            {[ICONO.info, ICONO.personas, ICONO.chat, ICONO.actividades].map((d) => (
              <span key={d} className="s-cad-icono"><svg viewBox="0 0 24 24"><path d={d} /></svg></span>
            ))}
            <span className="s-cad-icono s-cad-icono-on"><Estrella /></span>
          </div>
        </div>
      </div>
      <div className="s-cad-app" aria-hidden="true">
        <div className="s-cad-lat"><Estrella /><span /><span /><span className="s-cad-lat-on" /><span /><span /></div>
        <div className="s-cad-main">
          <p className="s-cad-main-t">Closing<small>Mauricio · {despues.periodo} 2026</small></p>
          <div className="s-cad-tasa">
            <div>
              <p className="s-cad-tasa-t">Tasa de cierre</p>
              <strong className="s-cad-tasa-n">{tasa}%</strong>
              <span className="s-cad-delta"><b>{tasa - tasaDe(antes)} pts ▲</b>sobre el período anterior</span>
              <div className="s-cad-prog"><i style={{ width: `${tasa}%` }} /></div>
              <div className="s-cad-prog-t">
                <span><b>{despues.cierres}</b> de {despues.reuniones} primeras reuniones terminaron en venta</span>
                <span>{despues.reuniones - despues.cierres} sin cerrar</span>
              </div>
            </div>
            <div className="s-cad-tasa-der">
              <p>Analizadas<b>{despues.analizadas}</b></p>
              <p>Score<b>{despues.score}</b></p>
              <p>Ganadas<b>{despues.cierres}</b></p>
            </div>
          </div>
          <div className="s-cad-graf">
            <p>Cierres por mes</p>
            <div className="s-cad-barras">
              {porMes.map((m) => (
                <div key={m.mes} className={`s-cad-barra-m${m.cierres ? '' : ' s-cad-cero'}`}>
                  <span className="s-cad-pista" style={{ ['--h' as string]: `${m.cierres ? Math.round((m.cierres / maxMes) * 100) : 4}%` }}>
                    <i /><b>{m.cierres}</b>
                  </span>
                  {m.mes}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="s-cad-intro" aria-hidden="true">
        <span className="s-cad-intro-t">Mauricio, con MaKo</span>
        <div className="s-cad-notas">
          <div className="s-cad-nota"><span className="s-cad-n s-cad-n-antes">{antes.cierres}</span><span className="s-cad-que">cierres</span><span className="s-cad-mes">{antes.periodo}</span></div>
          <span className="s-cad-flecha"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div className="s-cad-nota"><span className="s-cad-n s-cad-n-despues">{despues.cierres}</span><span className="s-cad-que">cierres</span><span className="s-cad-mes">{despues.periodo}</span></div>
        </div>
      </div>
    </div>
  );
}
