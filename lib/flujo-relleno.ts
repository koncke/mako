// =============================================================================
// flujo-relleno — un texto ENTRE CORCHETES en un mensaje de una automatización
// =============================================================================
// Dos casos, y ninguno lo decía la pantalla hasta el 10/11/2026 (la auditoría de Automations para un usuario nuevo, después
// de que Leandro no la pudo usar):
//   · `[algo]` —«Hola [nombre]», que es como mucha gente escribe un dato— es el relleno de una semilla sin terminar y el
//     motor NO LO MANDA NUNCA (`pasoConRelleno`, lib/nutricion.ts): queda «saltado» y se reprograma cada 24 h, sin un error.
//   · `[tu link …]` el detector lo deja pasar a propósito y le llega LITERAL al lead («te dejo el video: [tu link del
//     video]»): nada lo reemplaza (docs/hallazgos-chatbot.md).
// Una cosa, un lugar: lo leen el motor, la API de MaKo (chatbot.run.ts) y lo que frena Publicar en el lienzo
// (`faltaEscribir`, lib/flujo-conversacion.ts). Sin `server-only`: puro, con test (tests/flujo-relleno.test.ts).
// ⚠️ NO VA EN `validarGrafo`: esa vara la usa `setSecuenciaPasos` para RECHAZAR un guardado, y las semillas nacen con el
// corchete a propósito (lib/setting-semillas.ts: es lo que impide que una activada antes de escribirse salga sola).
// =============================================================================

/** El relleno sin terminar que el motor no manda: un `[…]` de 2 a 80 caracteres que no sea `[tu link …]`. */
export const RX_RELLENO = /\[(?!tu link)[^\]\n]{2,80}\]/i;
const RX_TU_LINK = /\[tu link[^\]\n]{0,80}\]/i;

type ConTexto = { cuerpo?: string | null; asunto?: string | null };

/** ¿El motor deja este mensaje sin mandar nunca? */
export function pasoConRelleno(p: ConTexto): boolean {
  return RX_RELLENO.test(p.cuerpo ?? '') || RX_RELLENO.test(p.asunto ?? '');
}

/** El primer corchete del mensaje y qué le pasa: `nunca` (no sale) o `literal` (le llega tal cual al lead). */
export function corcheteDe(p: ConTexto): { trozo: string; pasa: 'nunca' | 'literal' } | null {
  for (const t of [p.asunto ?? '', p.cuerpo ?? '']) {
    const r = RX_RELLENO.exec(t);
    if (r) return { trozo: r[0], pasa: 'nunca' };
  }
  for (const t of [p.asunto ?? '', p.cuerpo ?? '']) {
    const l = RX_TU_LINK.exec(t);
    if (l) return { trozo: l[0], pasa: 'literal' };
  }
  return null;
}

/** El motivo corto que frena Publicar, con el nombre de la tarjeta como se ve. null = no hay corchete. */
export function problemaDeCorchete(p: ConTexto, nombre: string): string | null {
  const c = corcheteDe(p);
  if (!c) return null;
  return c.pasa === 'nunca'
    ? `«${nombre}» tiene «${c.trozo}»: un texto entre corchetes no sale nunca. Para un dato del lead, usa { }`
    : `«${nombre}» dice «${c.trozo}»: le llegaría así al lead. Pega el link de verdad`;
}
