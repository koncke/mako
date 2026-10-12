// =============================================================================
// chatbot-puerta — cuándo se rellena «Tu WhatsApp», y cuándo «Tu forma de escribir» es la primera vez
// =============================================================================
// (Hasta el 12/10/2026 decidía además qué abría /automations: el QR o el lienzo. La puerta del QR se fue en la
// duodécima tanda; ver abajo.)
//
// Tarea #745 del plan (06/10/2026). Las dos preguntas se contestaban con un TILDE del
// onboarding guardado una vez y nunca vuelto a comparar con el dato:
//
//  · La puerta del QR leía el tilde de «Tu WhatsApp». Medido: el ws9 tiene el tilde
//    puesto desde el 05/08 y CERO líneas en evolution_instancias, así que /automations le
//    mostraba el lienzo sin número. Y al revés: quien vinculó desde el mismo /automations no
//    tenía tilde (nadie lo marcaba) y veía la pantalla de «Vincula tu WhatsApp» en cada
//    visita mientras el sondeo contestaba.
//  · La «primera vez» de «Tu forma de escribir» miraba el tilde de ese paso. El ws9 y
//    Código Inmobiliario lo tienen y NO tienen guía de voz: tildar «Lo adapta MaKo» nunca
//    les abría el tutorial y la IA escribía sin guía.
//
// La regla de las dos: EL DATO GANA AL TILDE cuando el dato está. El estado de la línea
// sale de su fila; si hay guía, sale de `mako.voz_guia`. El tilde sólo decide cuando el
// dato no se pudo leer — que es lo que pasaba antes en todos los casos.
//
// Sin `server-only`: la pantalla y los tests la importan.

/** Lo que contestó el onboarding de la tab, ya traducido. */
export type OnboardingChatbot = 'hecho' | 'pendiente' | 'sin_permiso' | 'no_se_pudo';

// ⛔ ACÁ VIVÍAN `abreEnQR` (¿/automations abre en el QR en vez del lienzo?) y `puertaAlRecargar` (la puerta en un
// recargue, que sólo cambiaba con un 'sin_vincular' comprobado). Se fueron el 12/10/2026 con la puerta del QR
// (duodécima tanda, §2.12): la tab ya no tiene onboarding. Martín, en la prueba con Fiesta Music: «Leandro entró a la
// tab y lo primero que le pidió es conectar WhatsApp; vos entrás en la tab por primera vez y tenés que ver el lienzo
// y tiene que salir el tutorial». El QR lo abren el chip «Sin conectar» de una tarjeta, Publicar, Probar y Activar
// (desde la decimoquinta tanda ya no salta solo al crear) o el aviso rojo de la línea (`ConectarMedio`). La regla de #745 —EL DATO GANA
// AL TILDE— sigue en las dos funciones de abajo.

/**
 * ¿Hay que marcar el paso «Tu WhatsApp» porque la línea YA está conectada?
 *
 * Quien vinculó por /whatsapp, o desde una tarjeta de /automations, quedó con la línea
 * conectada y el tilde pendiente. La tab ya no lo mira, pero sí lo mira el orden
 * del onboarding: «Tu forma de escribir» contestaba «falta completar Tu WhatsApp» al
 * terminarla. Se rellena al cargar, con el mismo POST que usa el aviso rojo de la línea.
 */
export function marcarWhatsappAlCargar(p: { onboarding: OnboardingChatbot; canal: string }): boolean {
  return p.onboarding === 'pendiente' && p.canal === 'conectado';
}

/**
 * ¿Tildar «Lo adapta MaKo» abre «Tu forma de escribir»?
 *
 * Sólo si el server CONTESTÓ que no hay guía. Si la pregunta falla, no se abre nada: la
 * IA escribe igual con un registro neutro, y un tutorial que salta por un error de red
 * se lee como que la casilla hace otra cosa. (La pantalla, además, lo ofrece una vez por
 * visita: quien lo cierra sin escribir guía no lo ve en cada casilla.)
 */
export function abrirGuiaVoz(respuesta: { ok?: unknown; guiaVoz?: unknown } | null | undefined): boolean {
  return respuesta?.ok === true && respuesta.guiaVoz === false;
}
