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
  | 'proveedor_caido'
  /**
   * El mensaje no le ENTRA al proveedor. No es cuota y no es del cliente: es
   * nuestro tope de entrada, y es la única de las cinco donde «reintenta» es
   * mentira — el mismo texto va a volver a rebotar.
   */
  | 'mensaje_muy_largo'
  /**
   * Las keys del CLIENTE contestaron y el problema fue NUESTRO: le pedimos mal, o
   * descartamos lo que devolvieron. No se le pide nada — no hay nada que él pueda hacer.
   */
  | 'fallo_nuestro';

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
 * ⚠️ EL 413 DE GROQ SE LEÍA COMO CUOTA AGOTADA, Y MANDABA AL CLIENTE A CARGAR UNA KEY.
 *
 * «Request too large … on tokens per minute (TPM): Limit 6000, Requested 15000, please
 * reduce your message size and try again. Visit https://console.groq.com/docs/rate-limits»
 * — ese texto trae `rate-limits` en la URL de la documentación, así que `SIN_CUOTA` matchea
 * y la causa salía `sin_cuota`. Dos daños: le echa la culpa a las cuentas del cliente por
 * algo NUESTRO (le mandamos un prompt que no entra en el tope de entrada de ese
 * proveedor), y le dice «reintenta en un rato» sobre lo único que no se destraba con el
 * tiempo. Es la misma trampa que Mistral: un texto de error que FABRICA el veredicto.
 *
 * Se mira ANTES que la de cuota y se SACA de la lista, no se descarta la lista entera: si
 * otro proveedor rebotó con un 429 de verdad, ése sigue siendo el veredicto.
 */
const ES_TOPE_DE_TAMANO = /\b413\b|request too large|too large for model|reduce your message size|request_too_large|context length|maximum context|too many tokens/i;

/**
 * ⚠️ UN PROVEEDOR SATURADO NO SE ARREGLA CON OTRA KEY DEL MISMO. «HTTP 503: This model is
 * currently experiencing high demand» es Google sin capacidad para ESE modelo: la segunda key
 * de Gemini que el mensaje mandaba a cargar le pega al mismo Google. Medido el 07/10/2026 en el
 * ws13: una nota de voz perdida y el texto «Tienes una sola API key… Carga una segunda (son
 * gratis) y esto deja de frenarte», que era falso — no es nada del cliente ni de su key.
 */
const SATURADO = /\b503\b|high demand|overloaded|\bUNAVAILABLE\b|temporarily unavailable/i;
export const esSaturacion = (error: string): boolean => SATURADO.test(error);

/** true si ESE error es «no me entra», no «no me queda cuota». Exportada para que el
 *  call site pueda contar cuántas cuentas rebotaron de verdad por límite. */
export const esTopeDeTamano = (error: string): boolean => ES_TOPE_DE_TAMANO.test(error);

/**
 * De QUIÉN fue el problema.
 *
 * `keysDelCliente` es cuántas API keys de IA tiene cargadas ESTE workspace. Es el
 * dato que separa «se cayó el proveedor» de «se cayó el proveedor Y no tenías
 * respaldo»: el hecho técnico es el mismo y lo que el cliente puede hacer no.
 */
/**
 * Lo que hay que saber ADEMÁS del texto de los errores, y que ningún texto puede decir.
 *
 * ⚠️ `errores` tiene que traer SÓLO los de las keys DEL CLIENTE. Medido el 01/10/2026 en
 * el ws13: de las ocho entradas de ese turno, SIETE eran de la red de plataforma —keys de
 * la agencia— y los tres únicos 429 también. O sea que el «te quedaste sin cuota» que leyó
 * un cliente lo fabricaron nuestras propias keys, con la suya contestando HTTP 200.
 */
export type ContextoFallo = {
  /** Cuántas instancias del CLIENTE se llegaron a probar. 0 = no había ninguna usable. */
  probadas?: number;
  /** Cuántas de ésas devolvieron HTTP 200 y lo descartamos nosotros. */
  contestaron?: number;
};

export function causaDelFallo(errores: string[], keysDelCliente: number, ctx: ContextoFallo = {}): CausaFalloIA {
  // Los «no me entra» salen de la bolsa antes de preguntar por la cuota (ver
  // ES_TOPE_DE_TAMANO). Si queda alguno adentro, ese decide; si NO queda ninguno, o
  // sea que el único motivo fue el tamaño, la causa es nuestra y se dice.
  const porTamano = errores.filter(esTopeDeTamano);
  const resto = errores.filter((e) => !esTopeDeTamano(e));
  const txt = resto.join(' · ');
  if (keysDelCliente === 0) return 'sin_keys';
  // ⚠️ CERO INSTANCIAS PROBADAS NO ES «SE CAYÓ SU PROVEEDOR». Pasa cuando hay filas en
  // `credenciales` pero ninguna resuelve (no se puede descifrar, quedó de otro entorno),
  // y el veredicto caía en `sin_respaldo` — que afirma una caída que nadie vio.
  if (ctx.probadas === 0) return 'sin_keys';
  // Y si SÍ contestaron, el problema es nuestro: eso manda sobre cualquier texto de error,
  // porque un 200 es la prueba más fuerte que hay de que del otro lado estaba todo bien.
  if ((ctx.contestaron ?? 0) > 0) return 'fallo_nuestro';
  if (SIN_CUOTA.test(txt)) return 'sin_cuota';
  if (porTamano.length && !resto.length) return 'mensaje_muy_largo';
  // Saturado de su lado: no es del cliente, y otra key del mismo proveedor no lo cubre (ver
  // SATURADO). Va antes de «una sola key» porque esa rama le pide justo eso.
  if (resto.length && resto.every(esSaturacion)) return 'proveedor_caido';
  // Con una sola key no hay cascada: cualquier bache de ese proveedor lo deja sin
  // MaKo. Es el caso del ws13 el 25/8 y la razón de que esto exista.
  if (keysDelCliente <= 1) return 'sin_respaldo';
  return 'proveedor_caido';
}

/**
 * LA CAUSA EN UNA FRASE, para un renglón de un aviso al DUEÑO (16/10/2026: «no pude escuchar su nota de voz: …», el AI
 * Step). Es la misma `causaDelFallo`, sin el link ni el pedido de `textoFalloIA`: el aviso de un lead no es el lugar del
 * tutorial. Y como ella, se elige con los errores de las keys DEL NEGOCIO, nunca con los de la red de plataforma.
 */
export function fraseDelFallo(causa: CausaFalloIA): string {
  switch (causa) {
    case 'sin_keys': return 'no hay ninguna API key de IA cargada';
    case 'sin_cuota': return 'las keys de IA del negocio no tienen cuota ahora';
    case 'sin_respaldo': return 'la única key de IA del negocio no contestó';
    case 'proveedor_caido': return 'los proveedores de IA no contestaron';
    case 'mensaje_muy_largo': return 'es demasiado largo para la IA';
    case 'fallo_nuestro': return 'falló de nuestro lado';
  }
}

/**
 * SIN RED POR LLEVAR DATOS DE CLIENTES (16/10/2026, Martín por Cerebro: el crédito de Claude, «por ahora solo en
 * onboarding», y si el AI Step con datos del lead se queda sin red, «que avise ("Conecta tu Claude…") y nunca use un
 * gratis»). La cascada saltea la red gratis de la agencia cuando el pedido lleva datos de clientes y lo anota en
 * `erroresPlataformaOut` con este comienzo (lib/ai-cheap.ts, `chatCheapCascade` y `transcribirAudio`).
 */
export const sinRedPorDatos = (erroresRed: readonly string[]): boolean => erroresRed.some((e) => e.startsWith('red gratis salteada:'));

/** Lo que se le dice al negocio entonces: la MISMA frase que lib/lead-insights.ts y lib/graficos-ia-elemento.ts. */
export const CONECTA_TU_CLAUDE = 'Conecta tu Claude en Integraciones: lleva datos de tus clientes, y MaKo no los manda a una IA gratis que entrena con ellos';

/** Qué era lo que MaKo estaba por hacer, para que la frase no quede genérica. */
export type QueIntentaba = 'contestar' | 'escuchar tu audio' | 'armar el borrador';

/**
 * El doer de WhatsApp sin keys propias y con un turno que lleva datos de clientes (17/10/2026): la red gratis no corre
 * (`turnoParaLaRed`, lib/doer-herramientas.ts). ⚠️ NO dice «Conecta tu Claude» como `CONECTA_TU_CLAUDE`: el
 * turno con herramientas corre sólo con las keys baratas del negocio (`chatCheapTools`), y la clave de Anthropic del
 * negocio mueve sólo la cascada de texto (la segunda puerta del veto, docs/hallazgos-ia.md). Mandarlo a conectar su
 * Claude sería mandarlo a hacer algo que no lo arregla.
 */
export function textoSinRedPorDatos(link: string, que: QueIntentaba = 'contestar'): string {
  return [
    `⚠️ No puedo ${que}: esto lleva datos de tus clientes, y sin una IA tuya no los mando a la IA gratis de MaKo, que entrena con lo que recibe.`,
    '',
    'Conecta tu propia API key de IA y lo hago 👇',
    link,
  ].join('\n');
}

/**
 * El mensaje. Tres reglas:
 *   1. Dice QUÉ pasó, sin adornos y sin echarse una culpa ajena.
 *   2. Dice QUÉ HACER, con el link a la pantalla exacta.
 *   3. Cuando no es del cliente, lo dice con todas las letras.
 */
export function textoFalloIA(
  causa: CausaFalloIA,
  link: string,
  que: QueIntentaba = 'contestar',
  keysDelCliente = 1,
): string {
  switch (causa) {
    case 'sin_keys':
      return [
        `⚠️ No puedo ${que}: todavía no cargaste ninguna API key de IA.`,
        '',
        'Es lo que me da la cabeza para pensar. Las de Google y Groq son *gratis* y se cargan en dos minutos 👇',
        link,
      ].join('\n');
    case 'sin_cuota':
      // ⚠️ CON VARIAS CUENTAS, EL TEXTO DE UNA SOLA ES UN INSULTO. Le pedía
      // «cargá otra, podés tener varias y las voy rotando» a alguien que ya tenía
      // TRES cargadas. El dueño lo reportó así: «no puede ser que tengo 3 API de
      // gemini conectadas y me dice que me quedé sin tokens». Pedirle lo que ya
      // hizo no es solo redundante: le avisa que el producto no se enteró.
      // ⚠️ Y NO SE AFIRMA CUÁL LÍMITE FUE. Esto decía «llegaron al tope de HOY» y «se
      // reponen solas mañana», y las dos cosas son inventadas: lo único que sabemos es
      // que el proveedor contestó un error de límite. Gemini tiene tope por MINUTO y por
      // día, y el del minuto se destraba en un rato — mandar a esperar a mañana por un
      // 429 de RPM es dejar al cliente sin MaKo un día entero por nada.
      //
      // Medido el 27/09/2026, y por eso se toca: el 22 y el 24/09 este texto le salió a un
      // cliente diciendo «tus 2 cuentas llegaron al tope de hoy» en días en que su
      // workspace tiene CERO llamadas registradas contra un tope de 250 por día. La causa
      // se elige con una regex sobre el texto del error y nunca le pregunta a la cuota.
      //
      // ⚠️ Y NO SE ARREGLA CONSULTANDO NUESTRO CONTADOR para decir «entonces no es cuota»:
      // las keys son del CLIENTE y puede gastarlas fuera de MaKo, así que nuestro contador
      // en cero no prueba que le quede cuota. Lo que se arregla es dejar de afirmar.
      // ⚠️ Y NO SE AFIRMA CUÁNTAS SE PROBARON. Decía «Probé tus 4 cuentas y las 4 me
      // rebotaron» con un número que sale de CONTAR FILAS en `credenciales`
      // (`contarKeysIA`), no intentos: el 30/09/2026 el dueño lo leyó y preguntó «¿se
      // acabó de 4 cuentas con un par de mensajes?». Y tenía razón en dudar — en ese
      // turno la cascada del doer sólo llega a dos de esos cinco proveedores, y el
      // proveedor que contestó devolvió OCHO veces HTTP 200. `keysDelCliente` sigue
      // eligiendo la RAMA (con dos o más, pedirle «cargá otra» es un insulto) y ya no
      // sale escrito: son dos preguntas distintas y una sola no las puede contestar.
      if (keysDelCliente >= 2) {
        return [
          `⚠️ No puedo ${que}: la IA que tengo conectada me está rebotando por límite.`,
          '',
          'Puede ser el límite por minuto o el del día. Si es el del minuto se destraba solo: vuelve a intentarlo en un rato. Si sigue igual, una cuenta más lo resuelve 👇',
          link,
        ].join('\n');
      }
      return [
        `⚠️ Te quedaste sin cuota de IA, por eso no puedo ${que}.`,
        '',
        'Tu API key llegó al tope. Puede ser el del minuto —y ahí se destraba solo en un rato— o el del día. Si cargas otra sigo funcionando *ahora*: puedes tener varias y las voy rotando 👇',
        link,
      ].join('\n');
    case 'sin_respaldo':
      return [
        `⚠️ Tu proveedor de IA se cayó justo ahora y no puedo ${que}.`,
        '',
        'Tienes *una sola* API key cargada, así que cuando esa falla me quedo sin nada. Carga una segunda (son gratis) y esto deja de frenarte 👇',
        link,
      ].join('\n');
    case 'proveedor_caido':
      // ⚠️ ACÁ NO SE CULPA A NADIE, y es a propósito: tiene sus keys en orden. Un
      // mensaje que lo mande a revisar su configuración le hace perder el tiempo
      // en algo que está bien.
      return [
        `No pude ${que}: los proveedores de IA están con problemas en este momento.`,
        '',
        'No es nada tuyo, tus keys están bien. Reintenta en un par de minutos.',
      ].join('\n');
    case 'fallo_nuestro':
      // ⚠️ ACÁ NO VA NI LINK NI «CARGÁ OTRA KEY»: su IA contestó. Lo que falló fue cómo se
      // lo pedimos, y el cliente no tiene ninguna palanca. Se dice y se pide de nuevo,
      // que es lo único verdadero — es la contracara exacta de la regla del dueño: culpar
      // al cliente por un bache ajeno se paga peor que comerse la culpa propia.
      return [
        `No pude ${que}: tu IA respondió bien y el problema fue mío.`,
        '',
        'No es nada tuyo ni de tus keys. Mándamelo de nuevo y lo hago.',
      ].join('\n');
    case 'mensaje_muy_largo':
      // ⚠️ ACÁ NO VA EL LINK NI VA «REINTENTA»: cargar otra key no cambia el tope de
      // entrada, y el mismo mensaje va a rebotar igual. Lo único que destraba esto lo
      // puede hacer la persona, así que es lo único que se dice.
      return [
        `No pude ${que}: lo que me mandaste es más largo de lo que acepta la IA que tenía libre.`,
        '',
        'Mándamelo en partes y lo hago igual. No es nada tuyo: tus keys están bien.',
      ].join('\n');
  }
}

/** El link a la pantalla donde se cargan las keys, con el modal ya abierto. */
export const linkKeysIA = (base: string): string => `${base}/integraciones?abrir=gemini`;
