// =============================================================================
// El botón de WhatsApp que flota abajo a la derecha, en las páginas públicas del sitio (16/11/2026)
// =============================================================================
// Martín: «me gustaría que esté flotando el loguito de WhatsApp al costado por si alguien quiere escribir algo y que evidentemente
// lleve al WhatsApp de MaKo». Abre wa.me con un mensaje corto ya escrito (./contacto.ts: el número vive ahí, una sola vez).
//
// DÓNDE VA: adentro del pie del sitio (./Pie.tsx), así que está en toda página que lo lleva —la portada, /planes, /accelerator y su
// formulario, Comparaciones, los funnels y cada landing— y en ninguna que no (el checkout, que va sin barra ni pie a propósito, y
// las legales). Un `position: fixed` no depende de dónde esté en el árbol: se ubica contra la pantalla (adentro de la caja fija de
// una landing de Web Generator también: esa caja no tiene `transform`).
//
// LO QUE NO TAPA (medido el 16/11/2026 con Chromium a 390 y a 1440, recorriendo cada página de arriba abajo y mirando qué queda
// ARRIBA donde el botón se cruza con algo pegado que se toca): sube cuando abajo hay algo pegado con un botón —la barra del
// teléfono de /accelerator (`.acl-pegado`, 86 px; y queda DEBAJO de ella cuando sube con la página), el botón fijo de las landings
// de Seguimiento y de Video, la píldora de Funnel, el video que queda flotando en la de Offer y el sol y la luna cuando flota— y se
// esconde con el menú del teléfono abierto (tapaba su botón de abajo). Cada regla nombra la clase QUE SE DIBUJA en esa página (la
// de Seguimiento se escribe `.s-fija` y sale `.d-seguimiento-fija`: su hoja le cambia el prefijo); si una landing suma otra barra
// pegada abajo, va acá. tests/sitio-whatsapp-y-pie.test.ts dibuja cada una y pide que la clase exista.
// EN /accelerator HABLA MARTÍN (16/11/2026, revisión, hallazgo 9): esa página va en primera persona del singular («Aplica a mi
// programa»), y el botón decía «Escríbenos». Hay dos <a> y la hoja deja ver uno: el de MaKo en todas, y el de Martín («Escríbeme»,
// con su mensaje) donde está el programa (`.acl-root`, la landing y su formulario). Uno con `display: none` no lo lee el lector de
// pantalla ni se enfoca con el tabulador, así que para la persona hay un solo botón.
// Server component, sin JavaScript: los <a> y su hoja. `data-tema-fijo`: el verde de WhatsApp no lo toca el sol y la luna.
// =============================================================================

import { GLIFO_WHATSAPP, VERDE_WHATSAPP, linkWhatsappMako } from './contacto';

/** El mensaje que ya viene escrito desde MaKo Accelerator: le escribe a Martín, que es quien habla en esa página. */
export const MENSAJE_WHATSAPP_ACCELERATOR = 'Hola Martín, vengo de la página de MaKo Accelerator y tengo una pregunta.';

/** Lo que tiene que quedar libre abajo, en px, cuando cada cosa está a la vista. */
const AIRE = 16;

export const CSS_WHATSAPP_FLOTANTE = `
.mk-wa-flota{position:fixed;z-index:2147470000;right:calc(${AIRE + 4}px + env(safe-area-inset-right,0px));bottom:calc(${AIRE + 4}px + env(safe-area-inset-bottom,0px));width:56px;height:56px;border-radius:50%;background:${VERDE_WHATSAPP};color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 28px rgba(0,0,0,.28),0 2px 6px rgba(0,0,0,.16);text-decoration:none;transition:transform .15s ease,box-shadow .15s ease,bottom .25s ease}
.mk-wa-flota:hover{transform:scale(1.06);box-shadow:0 14px 32px rgba(0,0,0,.32),0 2px 6px rgba(0,0,0,.16)}
.mk-wa-flota:focus-visible{outline:3px solid #2F6FED;outline-offset:3px}
.mk-wa-flota>svg{width:30px;height:30px;display:block}
@media (max-width:767px){.mk-wa-flota{width:52px;height:52px;right:calc(${AIRE}px + env(safe-area-inset-right,0px));bottom:calc(${AIRE}px + env(safe-area-inset-bottom,0px))}.mk-wa-flota>svg{width:28px;height:28px}}
/* Con el menú del teléfono abierto, no: tapaba «PRUÉBALO GRATIS», abajo del menú. */
body:has(details.s-mv[open]) .mk-wa-flota{display:none}
/* El sol y la luna, cuando flota abajo a la derecha (una página sin barra): arriba de él. */
body:has(.mk-tema-sitio-flota) .mk-wa-flota{bottom:calc(${AIRE}px + 44px + 12px + env(safe-area-inset-bottom,0px))}
/* /accelerator en el teléfono: la barra pegada de abajo («Aplica ahora», 86 px). */
@media (max-width:880px){body:has(.acl-pegado) .mk-wa-flota{bottom:calc(86px + ${AIRE}px + env(safe-area-inset-bottom,0px))}}
/* Las capas de /accelerator. En la computadora, debajo de la barra (su z-index es 90). Hasta 880 px, ARRIBA de todo (92): el precio y
   la sección final llevan 91 para tapar la barra pegada (app/accelerator/estilo.ts), y con 80 el botón desaparecía detrás de ellos
   (revisión del 16/11, hallazgo 3: a 390 px, en 19 de 216 posiciones de la página). Ya va levantado 86 + 16 px sobre la barra, así
   que sólo la cruza el instante en que la barra sube con la página al terminar su tramo: eso se acepta. */
body:has(.acl-pegado) .mk-wa-flota{z-index:80}
@media (max-width:880px){body:has(.acl-pegado) .mk-wa-flota{z-index:92}}
/* La voz: el de Martín donde está su programa, el de MaKo en todas las demás. */
.mk-wa-flota.mk-wa-martin{display:none}
body:has(.acl-root) .mk-wa-flota:not(.mk-wa-martin){display:none}
body:has(.acl-root) .mk-wa-flota.mk-wa-martin{display:flex}
/* Las landings con algo pegado abajo, mientras se ve: Seguimiento (su barra del teléfono), Video (su botón fijo), Funnel (la
   píldora) y Offer (el video que queda flotando abajo a la derecha: 158 px de alto a 3 del borde, y su cruz de cerrar justo
   arriba, de 160 a 188). */
@media (max-width:639.98px){body:has(.d-seguimiento-fija.d-seguimiento-fija-vis) .mk-wa-flota{bottom:calc(80px + ${AIRE}px + env(safe-area-inset-bottom,0px))}}
body:has(.d-video-fijo.d-video-ver) .mk-wa-flota{bottom:calc(84px + ${AIRE}px + env(safe-area-inset-bottom,0px))}
body:has(.d-funnel-float.is-on) .mk-wa-flota{bottom:calc(64px + ${AIRE}px + env(safe-area-inset-bottom,0px))}
body:has(.d-offer-video.d-offer-flota) .mk-wa-flota{bottom:calc(192px + ${AIRE}px + env(safe-area-inset-bottom,0px))}
/* EL GLOBITO, A LA VISTA Y CON SU X (Martín, 16/11/2026: «que esté directamente ahí eso y que se pueda cerrar con una X arriba»):
   entra al segundo y se queda; la X lo cierra y queda cerrado en este navegador (mako.wa.globo, SCRIPT_GLOBO); cerrado, vuelve
   sólo mientras el mouse pasa por el botón. Va adentro del botón, así lo sigue a donde lo suban las reglas de arriba. */
.mk-wa-globo{position:absolute;right:calc(100% + 12px);top:50%;white-space:nowrap;padding:10px 14px;border-radius:14px;background:#fff;color:#12151B;font:600 14px/18px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.22),0 1px 3px rgba(0,0,0,.12);opacity:1;transform:translateY(-50%);animation:mk-wa-globo-entra .4s 1s both}
/* La X: un ícono dibujado (la letra «×» no queda en el centro: su caja depende de la fuente) y centrado con flex; en rojo (Martín). */
.mk-wa-globo-x{position:absolute;top:-9px;left:-9px;width:22px;height:22px;border-radius:50%;background:#E5484D;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25);cursor:pointer}
/* La X, de 10 px: la regla del logo de WhatsApp (30 px) era para todo svg del botón y la agrandaba («quedó enorme»); ahora es sólo
   para su hijo directo (el logo). */
.mk-wa-flota .mk-wa-globo-x svg{display:block;width:10px;height:10px}
.mk-wa-globo-x:hover{background:#C93C40}
html.mk-wa-cerrado .mk-wa-globo{opacity:0;pointer-events:none;animation:none}
html.mk-wa-cerrado .mk-wa-globo-x{display:none}
.mk-wa-globo b{font-weight:700;color:#128C3E}
.mk-wa-globo::after{content:"";position:absolute;right:-5px;top:50%;width:11px;height:11px;margin-top:-5.5px;background:#fff;transform:rotate(45deg);border-radius:2px}
html.mk-wa-cerrado .mk-wa-flota:hover .mk-wa-globo,html.mk-wa-cerrado .mk-wa-flota:focus-visible .mk-wa-globo{opacity:1}
@keyframes mk-wa-globo-entra{from{opacity:0;transform:translateY(-50%) translateX(10px)}to{opacity:1;transform:translateY(-50%)}}
@media (max-width:767px){.mk-wa-globo{font-size:13px;line-height:17px;padding:8px 12px}}
@media (prefers-reduced-motion:reduce){.mk-wa-flota{transition:none}.mk-wa-globo{animation:none}}
@media print{.mk-wa-flota,html body .mk-wa-flota.mk-wa-martin{display:none}}
`;

/** La X del globito: lo cierra (y lo deja cerrado en este navegador) sin abrir el WhatsApp del botón que lo lleva adentro. */
export const SCRIPT_GLOBO = "(function(){var K='mako.wa.globo',h=document.documentElement;try{if(localStorage.getItem(K)==='cerrado')h.classList.add('mk-wa-cerrado');}catch(e){}if(window.__mkWaGlobo)return;window.__mkWaGlobo=1;document.addEventListener('click',function(e){var x=e.target&&e.target.closest&&e.target.closest('[data-wa-cerrar]');if(!x)return;e.preventDefault();e.stopPropagation();h.classList.add('mk-wa-cerrado');try{localStorage.setItem(K,'cerrado');}catch(err){}},true);})();";

/** El botón flotante. Uno por página: lo monta el pie del sitio (con su versión en la voz de Martín, para /accelerator). */
export function WhatsappFlotante() {
  const glifo = <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" d={GLIFO_WHATSAPP} /></svg>;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_WHATSAPP_FLOTANTE }} />
      <a className="mk-wa-flota" href={linkWhatsappMako()} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp" title="Escríbenos por WhatsApp" data-tema-fijo="">{glifo}<span className="mk-wa-globo" aria-hidden="true"><span className="mk-wa-globo-x" data-wa-cerrar="" title="Cerrar"><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" /></svg></span>¿Tienes una pregunta? <b>Escríbenos</b></span></a>
      <a className="mk-wa-flota mk-wa-martin" href={linkWhatsappMako(MENSAJE_WHATSAPP_ACCELERATOR)} target="_blank" rel="noopener noreferrer" aria-label="Escríbeme por WhatsApp" title="Escríbeme por WhatsApp" data-tema-fijo="">{glifo}<span className="mk-wa-globo" aria-hidden="true"><span className="mk-wa-globo-x" data-wa-cerrar="" title="Cerrar"><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" /></svg></span>¿Tienes una pregunta? <b>Escríbeme</b></span></a>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_GLOBO }} />
    </>
  );
}
