// =============================================================================
// Closing: una llamada real de Mauricio como en Google Meet y lo que hace MaKo con ella (16/11/2026)
// =============================================================================
// Martín, en varias vueltas: «similar a Google Meet… tipo objeciones, dolores»; «las cartas de Google Meet… más horizontales»; «no
// pongas MaKo en vivo»; «la tasa de closing o la cantidad de cierres»; «objeciones más típicas»; y la última: «pasa muy rápido el
// tema de las objeciones… que el zoom… sea estético»; «que no tenga sidebar el dashboard… que se vea sobre todo el analizar las
// llamadas… la calificación… o las objeciones»; «el gráfico… que vaya creciendo de 0 a 9 cierres y que se haga un zoom»; «poner
// tema de dinero»; y «ya no poner más la animación… de 0 a 9, sino que directamente la animación final sea el zoom al gráfico».
// El ciclo (18 s, sólo CSS): 1) la llamada; la cámara se acerca suave al costado de MaKo (las tarjetas quedan atrás, apagadas) y
// las tres objeciones salen de a una, con 2,5 s cada una para leerlas; 2) la hoja Closing de MaKo, sin barra del costado: a la
// izquierda el análisis de esa llamada (su score y sus objeciones, respondidas o no); a la derecha los cierres acumulados de 2026,
// que crecen de 0 a 9, con lo vendido; 3) la cámara se acerca a ese gráfico mientras crece. Todo sale de ./closing-mauricio.ts
// (datos reales, sin frases de terceros). En unidades del contenedor (cqw): entra igual en la computadora y en el teléfono.
import { CLOSING_MAURICIO, tasaDe } from './closing-mauricio';

/** El minuto como lo escribe un reproductor: m:ss, o h:mm:ss pasada la hora. */
const minuto = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
const usd = (n: number) => `US$${n.toLocaleString('es-AR')}`;
const FOTO_MAURICIO = '/vsl-assets/sitio/avatar/mauricio-meet.jpg';
const CICLO = 18;
/** En qué % del ciclo entra cada objeción (a los 2,4 s, 4,9 s y 7,4 s) y en qué % crece cada mes del gráfico. */
const ENTRA_OBJ = [13.3, 27.2, 41.1];
const CRECE_MES = (i: number) => 64 + i * 3;

const CSS = `
.s-cad{container-type:inline-size;position:absolute;inset:0;background:#202124;color:#E8EAED;font-family:inherit;overflow:hidden}
/* 1) La llamada. La «cámara» se acerca con calma al costado de MaKo: fija su esquina de arriba a la derecha, así el panel entra
   entero (las objeciones a la vista) y las tarjetas de Meet quedan atrás, apagadas. */
.s-cad-cam{position:absolute;inset:0;transform-origin:97.6% 3.8%;animation:s-cad-zoom ${CICLO}s cubic-bezier(.45,0,.2,1) infinite}
@keyframes s-cad-zoom{0%,7%{transform:none}12%,52%{transform:scale(1.25)}57%,100%{transform:none}}
.s-cad-in{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 38cqw;gap:2cqw;padding:2.4cqw 2.4cqw 9cqw}
/* Las tarjetas como las de Meet: 16:9, una arriba de la otra y centradas (el tamaño más grande que entra, como las acomoda Meet). */
.s-cad-tiles{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4cqw;min-height:0;animation:s-cad-apaga ${CICLO}s infinite}
@keyframes s-cad-apaga{0%,7%{opacity:1}12%,52%{opacity:.35}57%,100%{opacity:1}}
.s-cad-tile{position:relative;flex:none;width:44cqw;max-width:100%;aspect-ratio:16/9;border-radius:1.2cqw;overflow:hidden;background:#3C4043}
.s-cad-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.s-cad-tile::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 .3cqw #8AB4F8;opacity:0}
.s-cad-apagada{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.s-cad-avatar{width:9.5cqw;height:9.5cqw;border-radius:50%;background:#7B61FF;color:#fff;font-size:4.6cqw;font-weight:500;display:flex;align-items:center;justify-content:center}
.s-cad-nombre{position:absolute;left:1.2cqw;bottom:1cqw;font-size:1.7cqw;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}
/* Quién habla, como en Meet: el borde celeste y el círculo azul con tres barritas (el prospecto mientras salen sus objeciones). */
.s-cad-ola{position:absolute;top:1cqw;right:1cqw;width:3cqw;height:3cqw;border-radius:50%;background:#1A73E8;display:flex;align-items:center;justify-content:center;gap:.32cqw;opacity:0}
.s-cad-ola i{width:.42cqw;height:.42cqw;border-radius:.3cqw;background:#fff;animation:s-cad-ola .5s ease-in-out infinite alternate}
.s-cad-ola i:nth-child(2){animation-delay:-.25s}
.s-cad-ola i:nth-child(3){animation-delay:-.4s}
@keyframes s-cad-ola{to{height:1.5cqw}}
.s-cad-tile-a::after,.s-cad-tile-a .s-cad-ola{animation:s-cad-a ${CICLO}s infinite}
.s-cad-tile-b::after,.s-cad-tile-b .s-cad-ola{animation:s-cad-b ${CICLO}s infinite}
@keyframes s-cad-a{0%,11%{opacity:1}13%,52%{opacity:0}54%,100%{opacity:1}}
@keyframes s-cad-b{0%,11%{opacity:0}13%,52%{opacity:1}54%,100%{opacity:0}}
.s-cad-panel{background:#fff;color:#12151B;border-radius:1.2cqw;padding:2cqw 1.8cqw;display:flex;flex-direction:column;gap:1.2cqw;min-height:0;overflow:hidden}
.s-cad-panel-t{display:flex;align-items:center;gap:1cqw;font-size:1.9cqw;font-weight:800}
.s-cad-panel-t svg{width:2.4cqw;height:2.4cqw}
.s-cad-panel-t small{margin-left:auto;font-size:1.45cqw;font-weight:700;color:#6B7280}
/* Cada objeción: el punto rojo (algo que frena la venta), qué fue, su minuto y si Mauricio la respondió (✓ verde) o no (✕ rojo). */
.s-cad-chip{display:flex;align-items:center;gap:.9cqw;padding:1.1cqw 1.3cqw;border-radius:1.2cqw;background:#FDF3F2;font-size:1.5cqw;font-weight:700;white-space:nowrap;opacity:0;transform:translateY(1cqw);animation:${CICLO}s infinite}
.s-cad-chip i{flex:none;width:1.3cqw;height:1.3cqw;border-radius:50%;background:#EA4335}
.s-cad-chip span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.s-cad-chip b{margin-left:auto;font-weight:600;color:#6B7280}
.s-cad-chip svg,.s-cad-obj svg{flex:none;width:1.8cqw;height:1.8cqw}
/* La barra de Meet: la hora; micrófono, cámara, subtítulos, mano, presentar, más y colgar; detalles, personas, chat, actividades y MaKo. */
.s-cad-barra{position:absolute;left:2.4cqw;right:2.4cqw;bottom:0;height:7.5cqw;display:grid;grid-template-columns:1fr auto 1fr;align-items:center}
.s-cad-hora{font-size:1.7cqw;font-weight:600;color:#E8EAED}
.s-cad-botones{display:flex;align-items:center;gap:1cqw}
.s-cad-boton{width:4.4cqw;height:4.4cqw;border-radius:50%;background:#3C4043;display:flex;align-items:center;justify-content:center}
.s-cad-boton svg,.s-cad-icono svg{width:2.2cqw;height:2.2cqw;fill:#E8EAED}
.s-cad-colgar{width:6.4cqw;border-radius:99px;background:#EA4335}
.s-cad-der{justify-self:end;display:flex;align-items:center;gap:.6cqw}
.s-cad-icono{width:4cqw;height:4cqw;border-radius:50%;display:flex;align-items:center;justify-content:center}
.s-cad-icono-on{background:rgba(138,180,248,.24)}
/* 2) La hoja Closing de MaKo, sin la barra del costado: el análisis de la llamada y los cierres acumulados con lo vendido. */
.s-cad-app{position:absolute;inset:0;z-index:2;background:#F4F6FA;color:#12151B;opacity:0;visibility:hidden;animation:s-cad-app ${CICLO}s infinite}
@keyframes s-cad-app{0%,56%{opacity:0;visibility:hidden}60%,96%{opacity:1;visibility:visible}99%,100%{opacity:0;visibility:hidden}}
/* 3) La cámara se acerca al gráfico mientras crece (fija su esquina de abajo a la derecha: el gráfico queda entero). */
.s-cad-dash{position:absolute;inset:0;padding:2.6cqw 3cqw;display:flex;flex-direction:column;gap:1.8cqw;transform-origin:96% 94%;animation:s-cad-zoom2 ${CICLO}s cubic-bezier(.45,0,.2,1) infinite}
@keyframes s-cad-zoom2{0%,68%{transform:none}78%,96%{transform:scale(1.12)}100%{transform:none}}
.s-cad-main-t{margin:0;display:flex;align-items:baseline;gap:1.2cqw;font-size:2.4cqw;font-weight:800;white-space:nowrap}
.s-cad-main-t small{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:1.45cqw;font-weight:600;color:#6B7280}
.s-cad-main-t em{margin-left:auto;font-style:normal;font-size:1.35cqw;font-weight:700;color:#2F6FED;background:#E8F0FE;padding:.5cqw 1.1cqw;border-radius:99px}
.s-cad-hoja{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:1.8cqw}
.s-cad-card{min-height:0;min-width:0;background:#fff;border:1px solid #E5E8EF;border-radius:1.6cqw;padding:2cqw 2.2cqw;display:flex;flex-direction:column;opacity:0;transform:translateY(1.6cqw);animation:${CICLO}s infinite}
.s-cad-card:nth-child(1){animation-name:s-cad-c1}.s-cad-card:nth-child(2){animation-name:s-cad-c2}
@keyframes s-cad-c1{0%,59%{opacity:0;transform:translateY(1.6cqw)}63%,72%{opacity:1;transform:none}78%,95%{opacity:.45;transform:none}99%,100%{opacity:0}}
@keyframes s-cad-c2{0%,61%{opacity:0;transform:translateY(1.6cqw)}65%,95%{opacity:1;transform:none}99%,100%{opacity:0}}
.s-cad-card-t{margin:0;font-size:1.5cqw;font-weight:700;color:#6B7280}
/* El análisis de la llamada: el score en su anillo y las objeciones con su estado. */
.s-cad-nota{display:flex;align-items:center;gap:1.6cqw;margin:1.4cqw 0 1.6cqw}
.s-cad-anillo{flex:none;width:9cqw;height:9cqw;border-radius:50%;display:flex;align-items:center;justify-content:center;background:conic-gradient(#F9AB00 calc(var(--p) * 1%),#EEF0F4 0);position:relative}
.s-cad-anillo::before{content:'';position:absolute;inset:1cqw;border-radius:50%;background:#fff}
.s-cad-anillo b{position:relative;font-size:3cqw;font-weight:800}
.s-cad-nota p{margin:0;font-size:1.45cqw;line-height:1.35;color:#374151}
.s-cad-nota p strong{display:block;font-size:1.9cqw;color:#12151B}
.s-cad-obj{display:flex;align-items:center;gap:.9cqw;padding:1cqw 0;border-top:1px solid #EEF0F4;font-size:1.45cqw;font-weight:600;white-space:nowrap}
.s-cad-obj span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.s-cad-obj b{margin-left:auto;font-weight:600;color:#9AA0A6}
/* Los cierres acumulados de 2026: cada mes crece después del anterior, con su número arriba; al final, lo vendido. */
.s-cad-cab{display:flex;align-items:flex-start;justify-content:space-between;gap:1cqw}
.s-cad-plata{text-align:right;opacity:0;animation:s-cad-plata ${CICLO}s infinite}
.s-cad-plata strong{display:block;font-size:3.4cqw;line-height:1;font-weight:800;color:#1E8E3E}
.s-cad-plata small{font-size:1.3cqw;font-weight:600;color:#6B7280}
@keyframes s-cad-plata{0%,80%{opacity:0;transform:translateY(.8cqw)}84%,95%{opacity:1;transform:none}99%,100%{opacity:0}}
.s-cad-barras{flex:1;min-height:0;display:grid;grid-template-columns:repeat(6,1fr);gap:1.4cqw;margin-top:1cqw}
.s-cad-barra-m{display:grid;grid-template-rows:minmax(0,1fr) auto;justify-items:center;gap:.5cqw;min-height:0;font-size:1.35cqw;font-weight:700;color:#6B7280}
.s-cad-pista{position:relative;width:100%;margin-top:2.6cqw}
.s-cad-pista i{position:absolute;left:0;right:0;bottom:0;height:var(--h);border-radius:.6cqw .6cqw 0 0;background:#2F6FED;transform-origin:bottom;transform:scaleY(0);animation:${CICLO}s cubic-bezier(.3,0,.2,1) infinite}
.s-cad-pista b{position:absolute;left:0;right:0;bottom:calc(var(--h) + .4cqw);text-align:center;color:#12151B;font-size:1.7cqw;opacity:0;animation:${CICLO}s infinite}
.s-cad-barra-m.s-cad-cero i{background:#D7DCE6}
/* En una caja chica (el teléfono): el panel más ancho, la letra más grande, sin el ✓/✕ de la llamada, la barra corta, y en la hoja el
   análisis y el gráfico más compactos. */
@container (max-width:480px){.s-cad-in{grid-template-columns:minmax(0,1fr) 46cqw}
.s-cad-chip{font-size:2.2cqw;padding:1.1cqw 1.6cqw}.s-cad-chip svg{display:none}.s-cad-chip i{width:2cqw;height:2cqw}.s-cad-panel-t{font-size:3cqw}.s-cad-panel-t small{font-size:2.3cqw}.s-cad-nombre,.s-cad-hora{font-size:2.8cqw}.s-cad-ola{width:4cqw;height:4cqw}
.s-cad-cc,.s-cad-mano,.s-cad-pres,.s-cad-der .s-cad-icono:not(.s-cad-icono-on){display:none}.s-cad-boton,.s-cad-icono{width:6cqw;height:6cqw}.s-cad-boton svg,.s-cad-icono svg{width:3cqw;height:3cqw}.s-cad-colgar{width:8.6cqw}
.s-cad-dash{padding:3cqw 3.4cqw;gap:2.2cqw;animation:none}.s-cad-hoja{grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr)}.s-cad-cab{flex-direction:column;gap:.4cqw}.s-cad-plata{text-align:left}.s-cad-main-t{font-size:3.8cqw}.s-cad-main-t small{display:none}.s-cad-main-t em{font-size:2.4cqw;padding:.8cqw 1.8cqw}
.s-cad-card{padding:2.4cqw 2.6cqw;border-radius:2.4cqw}.s-cad-card-t{font-size:2.3cqw}.s-cad-anillo{width:12cqw;height:12cqw}.s-cad-anillo b{font-size:4.4cqw}.s-cad-nota{margin:1.6cqw 0}.s-cad-nota p{display:none}.s-cad-obj{font-size:2.2cqw;padding:1.2cqw 0}.s-cad-obj b{display:none}.s-cad-obj svg{width:2.6cqw;height:2.6cqw}
.s-cad-plata strong{font-size:3.8cqw}.s-cad-plata small{font-size:1.9cqw}.s-cad-barra-m{font-size:2.2cqw}.s-cad-pista b{font-size:2.6cqw}.s-cad-pista{margin-top:3.6cqw}}
@media (prefers-reduced-motion:reduce){.s-cad-cam,.s-cad-tiles,.s-cad-dash{animation:none}.s-cad-chip,.s-cad-card,.s-cad-plata{animation:none;opacity:1;transform:none}.s-cad-tile-a::after,.s-cad-tile-a .s-cad-ola{animation:none;opacity:1}.s-cad-tile-b::after,.s-cad-tile-b .s-cad-ola{animation:none}.s-cad-ola i{animation:none;height:1cqw}.s-cad-app{animation:none}.s-cad-pista i{animation:none;transform:none}.s-cad-pista b{animation:none;opacity:1}}
`;

/** Cada objeción y cada mes con SU tiempo en el ciclo (con un `animation-delay` por elemento, los últimos se cruzaban de una vuelta a
 *  la otra). Las objeciones son los hijos 2.º en adelante del panel; los meses, los de las barras. */
const CSS_TIEMPOS = [
  ...ENTRA_OBJ.map((e, i) => `.s-cad-chip:nth-child(${i + 2}){animation-name:s-cad-chip-${i}}@keyframes s-cad-chip-${i}{0%,${e}%{opacity:0;transform:translateY(1cqw)}${Math.round((e + 2) * 10) / 10}%,55%{opacity:1;transform:none}58%,100%{opacity:0;transform:none}}`),
  ...CLOSING_MAURICIO.porMes.map((_, i) => {
    const a = CRECE_MES(i);
    return `.s-cad-barra-m:nth-child(${i + 1}) i{animation-name:s-cad-mes-${i}}.s-cad-barra-m:nth-child(${i + 1}) b{animation-name:s-cad-num-${i}}`
      + `@keyframes s-cad-mes-${i}{0%,${a}%{transform:scaleY(0)}${a + 3}%,96%{transform:scaleY(1)}99%,100%{transform:scaleY(0)}}`
      + `@keyframes s-cad-num-${i}{0%,${a + 1}%{opacity:0}${a + 3}%,96%{opacity:1}99%,100%{opacity:0}}`;
  }),
].join('\n');

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
  // Los cierres ACUMULADOS de 2026 (0, 0, 0, 1, 4, 9) y lo vendido en total (abril a junio).
  const acumulados = porMes.reduce<number[]>((a, m) => [...a, (a[a.length - 1] ?? 0) + m.cierres], []);
  const total = acumulados[acumulados.length - 1] || 1;
  const vendido = porMes.reduce((a, m) => a + m.usd, 0);
  const sinResponder = llamada.objeciones.filter((o) => !o.respondida).length;
  return (
    <div className="s-cad" data-tema-fijo="" role="img"
      aria-label={`Una llamada de venta de Mauricio con las objeciones que marcó MaKo, y sus cierres de 2026: de ${antes.cierres} entre ${antes.periodo.toLowerCase()} a ${despues.cierres} entre ${despues.periodo.toLowerCase()} (tasa de cierre ${tasaDe(despues)} %), ${usd(vendido)} vendidos`}>
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_TIEMPOS }} />
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
        <div className="s-cad-dash">
          <p className="s-cad-main-t">Closing<small>Las llamadas de venta analizadas: qué decide tus cierres.</small><em>2026</em></p>
          <div className="s-cad-hoja">
            <div className="s-cad-card">
              <p className="s-cad-card-t">La llamada, analizada</p>
              <div className="s-cad-nota">
                <span className="s-cad-anillo" style={{ ['--p' as string]: Number(llamada.score) * 10 }}><b>{llamada.score.replace('.', ',')}</b></span>
                <p><strong>Score {llamada.score.replace('.', ',')} de 10</strong>{sinResponder} de {llamada.objeciones.length} objeciones sin responder</p>
              </div>
              {llamada.objeciones.map((o) => (
                <div key={o.tipo} className="s-cad-obj"><Estado ok={o.respondida} /><span>{o.tipo}</span><b>{minuto(o.segundo)}</b></div>
              ))}
            </div>
            <div className="s-cad-card">
              <div className="s-cad-cab">
                <p className="s-cad-card-t">Cierres acumulados</p>
                <span className="s-cad-plata"><strong>{usd(vendido)}</strong><small>vendidos de abril a junio</small></span>
              </div>
              <div className="s-cad-barras">
                {porMes.map((m, i) => (
                  <div key={m.mes} className={`s-cad-barra-m${acumulados[i] ? '' : ' s-cad-cero'}`}>
                    <span className="s-cad-pista" style={{ ['--h' as string]: `${acumulados[i] ? Math.round((acumulados[i] / total) * 100) : 4}%` }}>
                      <i /><b>{acumulados[i]}</b>
                    </span>
                    {m.mes}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
