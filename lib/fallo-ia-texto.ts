// =============================================================================
// fallo-ia-texto — cuando MaKo no puede pensar, DE QUIÉN es y qué se hace
// =============================================================================
// Sin `server-only`, a propósito: lo que decide qué se le dice a un cliente tiene
// que poder testearse. Mismo criterio que `lib/respuesta-doer.ts`.
//
// EL PEDIDO DEL DUEÑO (2026-08-25), y es de fondo:
//
//   «Si la culpa es DEL CLIENTE, porque no cargó sus key, el mensaje tiene que
//    reflejar eso. No un "He fallado en la transcripción"… Ahí MaKo queda mal,
//    queda como el culpable. Tiene que decir "Te quedaste sin Tokens, cargá tus
//    otras key aquí" y enviar el link.»
//
// Tenía razón dos veces. La primera es obvia: MaKo se estaba comiendo la culpa de
// algo que no era suyo («se me cayó la transcripción» cuando lo que pasaba era que
// el cliente tenía UNA sola key y estaba agotada). La segunda importa más: **un
// mensaje que se echa la culpa no dice qué hacer.** «Reintentá en un momento» sobre
// una cuota agotada es mandar a repetir algo que va a volver a fallar, y el cliente
// no tiene forma de enterarse de que la solución está a dos clics.
//
// ⚠️ Y LA CONTRACARA, que es igual de importante: cuando el fallo NO es del cliente
// —los proveedores se cayeron y él tiene sus keys en orden— hay que decirlo también.
// Culpar al cliente por un bache ajeno es el mismo error con el signo cambiado, y
// se paga peor: manda a tocar algo que está bien.
// =============================================================================

export type CausaFalloIA =
  /** No hay NINGUNA key cargada: sin eso MaKo no puede pensar. */
  | 'sin_keys'
  /** Hay keys, pero llegaron al tope de su cuota. */
  | 'sin_cuota'
  /** Su único proveedor tuvo un bache y no hay una segunda key que lo cubra. */
  | 'sin_respaldo'
  /** Falló todo teniendo con qué: es de los proveedores, no del cliente. */
  | 'proveedor_caido';

/** Un error que dice «esa key no existe». Lo tira `proveedor()` en ai-cheap. */
const SIN_KEY = /sin proveedor de ia barata|falta [A-Z_]*API_KEY|_API_KEY\)/i;

/**
 * Cuota agotada. `429` y sus nombres en los distintos proveedores.
 *
 * ⚠️ Se busca el 429 con borde de palabra: sin eso, un id o un timestamp que
 * contenga «429» clasificaría un bache de red como cuota agotada, y el cliente
 * saldría a cargar una key que no le hacía falta.
 */
const SIN_CUOTA = /\b429\b|quota|rate.?limit|resource[_ ]?exhausted|exceeded|insufficient|billing/i;

/**
 * De QUIÉN fue el problema.
 *
 * `keysDelCliente` es cuántas API keys de IA tiene cargadas ESTE workspace. Es el
 * dato que separa «se cayó el proveedor» de «se cayó el proveedor Y no tenías
 * respaldo»: el hecho técnico es el mismo y lo que el cliente puede hacer no.
 */
export function causaDelFallo(errores: string[], keysDelCliente: number): CausaFalloIA {
  const txt = errores.join(' · ');
  if (keysDelCliente === 0) return 'sin_keys';
  if (SIN_CUOTA.test(txt)) return 'sin_cuota';
  // Con una sola key no hay cascada: cualquier bache de ese proveedor lo deja sin
  // MaKo. Es el caso del ws13 el 25/8 y la razón de que esto exista.
  if (keysDelCliente <= 1) return 'sin_respaldo';
  return 'proveedor_caido';
}

/** Qué era lo que MaKo estaba por hacer, para que la frase no quede genérica. */
export type QueIntentaba = 'contestar' | 'escuchar tu audio' | 'armar el borrador';

/**
 * El mensaje. Tres reglas:
 *   1. Dice QUÉ pasó, sin adornos y sin echarse una culpa ajena.
 *   2. Dice QUÉ HACER, con el link a la pantalla exacta.
 *   3. Cuando no es del cliente, lo dice con todas las letras.
 */
export function textoFalloIA(causa: CausaFalloIA, link: string, que: QueIntentaba = 'contestar'): string {
  switch (causa) {
    case 'sin_keys':
      return [
        `⚠️ No puedo ${que}: todavía no cargaste ninguna API key de IA.`,
        '',
        'Es lo que me da la cabeza para pensar. Las de Google y Groq son *gratis* y se cargan en dos minutos 👇',
        link,
      ].join('\n');
    case 'sin_cuota':
      return [
        `⚠️ Te quedaste sin cuota de IA, por eso no puedo ${que}.`,
        '',
        'Tu API key llegó al tope. Se repone sola mañana, pero si cargás otra sigo funcionando *ahora* — podés tener varias y las voy rotando 👇',
        link,
      ].join('\n');
    case 'sin_respaldo':
      return [
        `⚠️ Tu proveedor de IA se cayó justo ahora y no puedo ${que}.`,
        '',
        'Tenés *una sola* API key cargada, así que cuando esa falla me quedo sin nada. Cargá una segunda (son gratis) y esto deja de frenarte 👇',
        link,
      ].join('\n');
    case 'proveedor_caido':
      // ⚠️ ACÁ NO SE CULPA A NADIE, y es a propósito: tiene sus keys en orden. Un
      // mensaje que lo mande a revisar su configuración le hace perder el tiempo
      // en algo que está bien.
      return [
        `No pude ${que}: los proveedores de IA están con problemas en este momento.`,
        '',
        'No es nada tuyo, tus keys están bien. Reintentá en un par de minutos.',
      ].join('\n');
  }
}

/** El link a la pantalla donde se cargan las keys, con el modal ya abierto. */
export const linkKeysIA = (base: string): string => `${base}/integraciones?abrir=gemini`;
