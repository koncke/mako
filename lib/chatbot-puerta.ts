// =============================================================================
// chatbot-puerta — qué abre /chatbot, y cuándo «Tu forma de escribir» es la primera vez
// =============================================================================
// Tarea #745 del plan (06/10/2026). Las dos preguntas se contestaban con un TILDE del
// onboarding guardado una vez y nunca vuelto a comparar con el dato:
//
//  · La puerta del QR leía el tilde de «Tu WhatsApp». Medido: el ws9 tiene el tilde
//    puesto desde el 05/08 y CERO líneas en evolution_instancias, así que /chatbot le
//    mostraba el lienzo sin número. Y al revés: quien vinculó desde el mismo /chatbot no
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

/**
 * ¿/chatbot abre en el QR (vincular el WhatsApp) en vez del lienzo?
 *
 * `canal` es el estado de la línea que manda el GET de secuencias (lib/evolution:
 * 'conectado' / 'sin_vincular' / 'desconectado' / 'conectando'; 'desconocido' si no se
 * pudo preguntar).
 *
 * ⚠️ UNA LÍNEA CAÍDA NO CAMBIA: con 'desconectado' sigue mandando el tilde, como hoy. Ahí
 * el lienzo muestra el aviso rojo de «volver a conectarlo» y no se le esconde el editor a
 * quien tiene secuencias armadas; decidir otra cosa es otra tarjeta.
 */
export function abreEnQR(p: { onboarding: OnboardingChatbot; canal: string }): boolean {
  // El setter no vincula nada: su pantalla es el lienzo, siempre.
  if (p.onboarding === 'sin_permiso') return false;
  if (p.canal === 'sin_vincular') return true;
  if (p.canal === 'conectado') return false;
  // Sin dato de la línea, decide el tilde. «No se pudo saber» abre el QR: es reversible
  // (se vincula o se sigue de largo), y el lienzo afirmaría que está todo listo.
  return p.onboarding !== 'hecho';
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
