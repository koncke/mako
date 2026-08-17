'use client';

// =============================================================================
// TemaCandidato — el modo de cada usuario + el tema del rebrand en evaluación
// =============================================================================
// Aplica el TEMA CANDIDATO del rebrand, y SOLO si alguien lo prendió a mano
// desde /admin/ui?tab=temas. Sin tema puesto este componente no hace
// absolutamente nada: ni un atributo, ni un color, ni el modo oscuro.
//
// ⚠️ ESTO ES UNA HERRAMIENTA DE OBRA, NO UNA FEATURE. Hubo una versión en la
// que el modo claro/oscuro era «de todos los usuarios» y arrancaba mirando
// `prefers-color-scheme`. Resultado: un cliente NUEVO con el sistema en oscuro
// abrió MaKo en oscuro sin haber tocado nada, y se comió toda la cola de
// contraste que el rebrand todavía no arregló. El modo se lleva a producción
// cuando esa cola esté cerrada y se decida a propósito — no antes, y nunca por
// una preferencia del sistema operativo.
//
// ⚠️ EL <script> NO ES OPCIONAL Y NO ES UN DUPLICADO DEL EFECTO. Un useEffect
// corre DESPUÉS de la hidratación: entre el primer pintado y esa línea la app se
// ve clara y después salta a oscura. En una app que se navega por links eso es
// un fogonazo blanco en CADA pantalla. El script corre mientras el navegador
// todavía parsea el documento, antes de pintar.
//
// Y el chip de salida no es decoración: mientras hay un tema en prueba, lo dice
// y ofrece cómo sacarlo desde cualquier pantalla. Si el único lugar donde se
// apaga fuera la tab que lo prende, quien se lo olvide puesto ve la app de otro
// color sin saber por qué — la regla de AGENTS.md sobre la salida que vive
// adentro de una pantalla condicional.
// =============================================================================


import { ATTR_TEMA, ATTR_MODO, LS_TEMA, LS_MODO, esTemaValido } from '@/lib/temas-candidatos';

/** Lo que corre antes del primer pintado. Se mantiene chico a propósito. */
const BOOT = `
try{
  var t=localStorage.getItem('${LS_TEMA}');
  if(t){
    document.documentElement.setAttribute('${ATTR_TEMA}',t);
    if(localStorage.getItem('${LS_MODO}')==='oscuro')document.documentElement.setAttribute('${ATTR_MODO}','oscuro');
  }else{
    /* Sin tema en prueba no hay NADA que aplicar, y además se limpia lo que
       haya quedado guardado: si no, un navegador que probó el tema seguiría
       en oscuro para siempre. */
    localStorage.removeItem('${LS_MODO}');
  }
}catch(e){}
`.trim();

/**
 * Pone o saca el tema candidato. `null` lo saca.
 *
 * NO toca el modo: el claro/oscuro es del usuario y sobrevive a prender y
 * apagar un tema. Mezclarlos fue un bug real — salir del tema dejaba la app en
 * oscuro sin que nadie lo hubiera pedido.
 */
export function aplicarTemaCandidato(id: string | null) {
  const raiz = document.documentElement;
  if (id && esTemaValido(id)) {
    raiz.setAttribute(ATTR_TEMA, id);
    try { localStorage.setItem(LS_TEMA, id); } catch { /* incógnito */ }
  } else {
    // Sacar el tema saca TAMBIÉN el modo. El modo oscuro no existe por su
    // cuenta todavía: es parte del tema en prueba. Sin esto, apagar el tema
    // dejaba la app oscura y sin ningún control a la vista para volver.
    raiz.removeAttribute(ATTR_TEMA);
    raiz.removeAttribute(ATTR_MODO);
    try {
      localStorage.removeItem(LS_TEMA);
      localStorage.removeItem(LS_MODO);
    } catch { /* incógnito */ }
  }
  window.dispatchEvent(new Event('mako-tema-candidato'));
}

/**
 * No pinta nada: su único trabajo es el <script> de arranque. El control para
 * prender y apagar el tema vive en la barra de la agencia, que dentro del
 * Cliente de Diseño está siempre presente — así no hay un chip flotante que se
 * pueda quedar puesto en una pantalla donde no corresponde.
 */
export function TemaCandidato() {
  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
    </>
  );
}
