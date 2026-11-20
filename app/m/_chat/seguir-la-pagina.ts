// =============================================================================
// EL HILO DE UN CHAT CON CLIENTES EN EL TELÉFONO, QUE ESCROLEA LA PÁGINA: LO PURO (20/11/2026, la auditoría de los chats, movil-1 a 5)
// =============================================================================
// /m/chats/[clave] y /m/crm/[id]/chat escrolean la PÁGINA entera, no una caja (el composer va fijo abajo, por portal). Son chats con
// PERSONAS (sus clientes), así que valen como WhatsApp (la decisión del 3/11, la excepción escrita de docs/hallazgos-chat.md):
//   · lo que llega baja a quien está abajo; a quien subió a leer no lo arrastra, y se le cuenta cuántos llegaron («N mensajes nuevos»);
//   · lo que manda ella baja siempre, cuando aparece (antes, un `setTimeout(400)` que perdía la carrera con una red lenta, movil-2);
//   · lo que CRECE (una foto que termina de cargar, movil-4) la mantiene abajo mientras estaba abajo.
// El mecanismo es el compartido (`bajarAlCrecer`, app/_chat/useBajarAlUltimo.ts) sobre `document.documentElement`. El hook y el botón:
// ./SeguirLaPagina.tsx. Sin React y sin CSS: lo prueba tests/chats-bajan-movil-admin.test.ts.
// =============================================================================

/** Llegó algo nuevo al hilo: baja si estaba abajo o si es lo que ella acaba de mandar; si no, se cuenta. */
export const queHacerAlLlegar = (p: { abajo: boolean; esperaLoSuyo: boolean }): 'bajar' | 'contar' => (p.abajo || p.esperaLoSuyo ? 'bajar' : 'contar');

/** Cuántos se suman al botón: los que llegaron desde lo último visto (al menos uno, si cambió el último). */
export const cuantosLlegaron = (antes: number, ahora: number): number => Math.max(1, ahora - antes);

/** Lo que dice el botón. */
export const rotuloNuevos = (n: number): string => (n === 1 ? '1 mensaje nuevo' : `${n} mensajes nuevos`);
