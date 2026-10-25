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

import { conexion, rutaDeTarjeta } from './conexiones-catalogo';

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
   * Su IA no contestó A TIEMPO (un timeout nuestro, quizá con algún 503 al lado). No es del cliente ni de su cuota, y
   * otra key del MISMO proveedor no la cubre: lo que la cubre es una IA de otra marca (24/10/2026, el ws15).
   */
  | 'ia_lenta'
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

/**
 * ⚠️ UN TIMEOUT NO ES «SE CAYÓ» NI SE ARREGLA CON UNA SEGUNDA KEY DEL MISMO. Medido el 23/10/2026 14:05 UTC en el ws15:
 * «chatCheapTools(gemini): The operation was aborted due to timeout», una key, y el texto de `sin_respaldo` —«Tu proveedor
 * de IA se cayó justo ahora… Carga una segunda (son gratis)»—. Gemini no se cayó (los dos pasos anteriores de ese mismo
 * turno contestaron 200), y Brigitte hizo lo que le dijeron: a los 33 minutos cargó una segunda key de GEMINI, que le
 * pega al mismo Google. Lo que sí la cubre es una IA de otra marca.
 */
const TIMEOUT = /timeout|timed out|ETIMEDOUT/i;
export const esTimeout = (error: string): boolean => TIMEOUT.test(error);

/** Los proveedores que nombran los errores (`chatCheapTools(gemini · cuenta 2): …`, `gemini: …`, `anthropic/…`). */
export function proveedoresDeLosErrores(errores: readonly string[]): string[] {
  const out = new Set<string>();
  for (const e of errores) {
    const m = /\b(gemini|openai|anthropic|groq)\b/i.exec(e);
    if (m) out.add(m[1].toLowerCase());
  }
  return [...out];
}

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
  // No contestó a tiempo (ver TIMEOUT). Va antes de «una sola key» por lo mismo que la saturación: esa rama le pide
  // una segunda key del mismo proveedor, y eso no lo cubre.
  if (resto.some(esTimeout) && resto.every((e) => esTimeout(e) || esSaturacion(e))) return 'ia_lenta';
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
    case 'ia_lenta': return 'la IA del negocio tardó demasiado en contestar';
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

/**
 * D6b (Martín, 21/10/2026): un negocio con su propio Claude o su GPT no usa las keys ni la red gratis (lib/solo-su-ia.ts).
 * Lo que la cascada de texto iba a hacer, sin su clave de Claude ni su OpenAI, no tiene con qué: se dice ESTO. Ni
 * `CONECTA_TU_CLAUDE` («Conecta tu Claude», y puede que ya lo tenga en su computadora; «lleva datos de tus clientes», y
 * El Archivero lee los documentos del negocio) ni «conecta una IA gratis» (no se usaría). La computadora no sirve acá:
 * contesta los turnos del chat, no los pedidos de una pantalla. La misma frase que `AVISO_SIN_ARCHIVERO` del chat
 * (lib/mako-turno-app-reglas.ts). Lo dicen pantallas del admin (las áreas y la búsqueda del Second Brain): la clave es suya.
 * `tema` va adentro de la frase: 'generar las razones', 'leer tus documentos'…
 */
export const conSuIASinClave = (tema: string): string => `Con tu propio Claude, para ${tema} necesito tu clave de Claude, de OpenAI o de Gemini (en Integraciones).`;

/** Lo mismo para MIRAR una foto o un PDF escaneado: con su propio Claude ven su OpenAI y su Gemini (IA16). El mismo criterio
 *  que `AVISO_NO_LEI_SU_IA` del chat. */
export const CON_SU_IA_SIN_VISION = 'Con tu propio Claude, las fotos y los PDF escaneados los leo con tu clave de Claude, de OpenAI o de Gemini (en Integraciones).';

/** Qué era lo que MaKo estaba por hacer, para que la frase no quede genérica. */
export type QueIntentaba = 'contestar' | 'escuchar tu audio' | 'armar el borrador';

const NOMBRE_IA: Record<string, string> = { gemini: 'Gemini', openai: 'GPT', anthropic: 'Claude', groq: 'Groq' };

/**
 * ⚠️ NINGÚN CARTEL LE OFRECE GEMINI COMO «SU IA» (Martín, 25/10/2026, por el audio de Florencia del ws21): «le sigue diciendo
 * que debe conectar su IA de Gemini, cuando dijimos que todo eso se hace con la app de escritorio de MaKo y conectado a su
 * claude o GPT». Reemplaza lo del 22/10 que sumaba Gemini como «su IA» (IA16). Lo que se ofrece, y dónde:
 *   · aquí en WhatsApp, su GPT por CLAVE: es lo primero que prueba el grupo (`PROVS_SU_IA`), escucha las notas de voz y
 *     corre los turnos con herramientas. Su Claude por clave entra sólo en un turno sin NINGUNA herramienta (WA1,
 *     lib/mako-doer-in.ts: otro modelo después de una escritura la duplicaría; el turno del ws15 del 24/10 se colgó
 *     después de dos), así que ofrecérselo para el grupo es prometer un respaldo que justo cuando hace falta no está. Y
 *     Claude no escucha (`CASCADA_STT`, lib/ai-cheap.ts);
 *   · en la app, su Claude con MaKo en su computadora (MaKo Desktop): el chat de la app ya exige la computadora
 *     (lib/chat-mako-reglas.ts). El grupo todavía no pasa por ella (D6a).
 * Un negocio que YA tiene su Gemini sigue andando con él (la cascada lo prueba): lo que no se hace es mandarlo a conectar uno.
 */
const CUBREN_EL_TURNO = ['openai'] as const;
const respaldosDe = (prov: string): string[] => CUBREN_EL_TURNO.filter((p) => p !== prov);

/**
 * LAS CONEXIONES QUE NOMBRA UN CARTEL, cada una con SU link (25/10/2026: el aviso del 24/10 al ws21 nombraba «tu Claude, tu
 * GPT o tu Gemini, y también Fathom» con UN solo link, el de Claude). Las rutas salen del catálogo único
 * (lib/conexiones-catalogo.ts), que son contrato: `/integraciones?abrir=<key>` abre el modal de esa tarjeta y la computadora
 * va directo a «Conecta MaKo», que trae «Descargar MaKo» para quien no la tiene. `/second-brain`, el chat de la app (el Ops
 * Center), no es una conexión: va aparte.
 */
export type ConexionDelCartel = 'openai' | 'anthropic' | 'fathom' | 'pc' | 'app';
const delCatalogo = (key: string): string => conexion(key)?.ruta ?? rutaDeTarjeta(key);
export const RUTA_CONEXION: Record<ConexionDelCartel, string> = {
  openai: delCatalogo('openai'),
  anthropic: delCatalogo('anthropic'),
  fathom: delCatalogo('fathom'),
  pc: delCatalogo('pc'),
  app: '/second-brain',
};

/**
 * Lo que un pedido necesita además de la IA, según el ÁREA que nombra (lib/mako-intencion.ts, `areasDelMensaje`). Hoy, el
 * Closing: sus llamadas salen de Fathom (`gating.integracion`, lib/api-mako/areas/closing.def.ts). Es lo que preguntó
 * Florencia el 22/10 («Estas analizando mis fathom?»): el cartel le pidió una IA y no le dijo que también le faltaba Fathom.
 */
const CONEXION_DEL_AREA: Record<string, ConexionDelCartel> = { closing: 'fathom' };
export const conexionesDelPedido = (areas: readonly string[]): ConexionDelCartel[] =>
  [...new Set(areas.map((a) => CONEXION_DEL_AREA[a]).filter((c): c is ConexionDelCartel => !!c))];

/**
 * El link de OTRA conexión, con la misma base y el mismo `?ws=` que el link que recibió el cartel. El doer arma ese link de
 * dos formas: el de texto sin `ws` (lo suma `linksConWs` al mandar) y el del audio con él (sale directo, `linkApp`).
 */
export function enlaceA(link: string, conexion: ConexionDelCartel): string {
  const base = /^https?:\/\/[^/?#]+/.exec(link)?.[0] ?? '';
  const ws = /[?&]ws=(\d+)/.exec(link)?.[1];
  const ruta = RUTA_CONEXION[conexion];
  return `${base}${ruta}${ws ? `${ruta.includes('?') ? '&' : '?'}ws=${ws}` : ''}`;
}

/** Lo que el cartel sabe del negocio además de las claves (25/10/2026). */
export type ContextoCartel = {
  /** Alguien del negocio conectó su computadora: su Claude está, pero desde ahí contesta en la app, no en WhatsApp. */
  conPc?: boolean;
  /** Tiene su Claude por clave: para una nota de voz, «tu Claude no escucha» en vez de «no conectaste una IA». */
  suClaude?: boolean;
  /** Lo que el pedido necesita además de la IA y no está conectado (`conexionesDelPedido`, filtrado por el doer). */
  faltan?: readonly ConexionDelCartel[];
};

/** Cada conexión que falta, en una línea con su link. */
const LINEA_FALTA: Partial<Record<ConexionDelCartel, string>> = {
  fathom: 'Y para leer tus llamadas, conecta tu Fathom 👇',
};
const lineasDeLoQueFalta = (link: string, faltan: readonly ConexionDelCartel[] = []): string[] =>
  faltan.filter((c) => LINEA_FALTA[c]).flatMap((c) => ['', LINEA_FALTA[c]!, enlaceA(link, c)]);

/**
 * El doer de WhatsApp sin keys propias y con un turno que lleva datos de clientes (17/10/2026): la red gratis no corre
 * (`turnoParaLaRed`, lib/doer-herramientas.ts).
 *
 * ⚠️ DESDE IA16 SÓLO DONDE LA RED EXISTE, y es el workspace de la plataforma (`provsGratisDePlataforma` devuelve `[]` para
 * cualquier negocio). Para un negocio, «no los mando a la IA gratis de MaKo» da a entender que sin datos de clientes MaKo
 * le habría contestado, y no: sin su IA no contesta nada. Al ws21 le salió el 22/10 09:36 UTC, antes de IA16 (decidida esa
 * noche, en main desde el 24/10 00:29 ART), y ese día era cierto; con IA16 el cartel cierto para un negocio es `sin_keys`.
 * Por eso el doer deja la marca sólo si había una red que saltear (lib/mako-doer-in.ts, 24/10/2026).
 * No nombra a Claude: en el workspace de la plataforma la clave de Claude no la vuelve «su IA» (`negocioConSuIA`).
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
  /** Los errores DEL NEGOCIO con que se eligió la causa: `ia_lenta` saca de ahí qué IA fue (`proveedoresDeLosErrores`). */
  errores: readonly string[] = [],
  ctx: ContextoCartel = {},
): string {
  const gpt = enlaceA(link, 'openai');
  // Qué IA del negocio falló, si los errores lo dicen y es UNA sola marca.
  const provs = proveedoresDeLosErrores(errores).filter((p) => NOMBRE_IA[p]);
  const prov = provs.length === 1 ? provs[0] : null;
  switch (causa) {
    case 'ia_lenta': {
      // ⚠️ NI «SE CAYÓ» NI «CARGA UNA SEGUNDA»: ver TIMEOUT. Dice qué pasó (y que lo cortamos nosotros: nada por
      // detrás), que lo mande de nuevo —casi siempre anda al rato— y, si TODA su IA es de una marca, qué le da respaldo.
      // El respaldo es su GPT (`CUBREN_EL_TURNO`): con su GPT lento no se le ofrece nada, ni su Gemini.
      const respaldo = prov ? respaldosDe(prov)[0] : undefined;
      const quien = prov ? `${NOMBRE_IA[prov]}, tu IA,` : 'tu IA';
      const lento = `⚠️ No pude ${que}: ${quien} tardó demasiado en responder y corté para no dejarte esperando.`;
      if (!respaldo) return [lento, '', 'No es nada tuyo ni de tus keys. Mándamelo de nuevo en un rato.'].join('\n');
      return [
        lento,
        '',
        'Mándamelo de nuevo. Si conectas también tu GPT (una clave de OpenAI), lo uso de respaldo cuando una se pone lenta 👇',
        gpt,
      ].join('\n');
    }
    case 'sin_keys':
      // ⚠️ IA16 (22/10/2026): CADA NEGOCIO PAGA SU IA. Decía «Las de Google y Groq son *gratis*», y desde IA16 Groq sólo
      // escucha notas de voz. Desde el 25/10, sin Gemini (ver `CUBREN_EL_TURNO`) y con un link por cada cosa que falta.
      // ⚠️ CON LA COMPUTADORA CONECTADA, «NO TIENE SU IA» ES FALSO (25/10/2026). `negocioConSuIA` da `suIA` a todo negocio
      // con MaKo Desktop, y como la computadora no cuenta claves, la causa salía `sin_keys` y el grupo le decía «tu negocio
      // todavía no tiene su IA conectada» a quien la tenía. Lo cierto: su Claude contesta en la app, no aquí.
      if (que === 'escuchar tu audio') {
        // Una nota de voz no la escucha su Claude, ni por clave ni en su computadora: la escucha su GPT.
        if (ctx.conPc && !ctx.suClaude) {
          return [
            '⚠️ No puedo escuchar tu audio: tu Claude está en tu computadora, y desde ahí no escucha notas de voz ni te contesta en WhatsApp.',
            '',
            'Para que te escuche y te conteste aquí, conecta tu GPT (una clave de OpenAI) 👇',
            gpt,
            '',
            'O escríbeme en la app 👇',
            enlaceA(link, 'app'),
          ].join('\n');
        }
        if (ctx.conPc || ctx.suClaude) {
          return [
            '⚠️ No puedo escuchar tu audio: tu Claude no escucha notas de voz.',
            '',
            'Escríbemelo, o conecta tu GPT (una clave de OpenAI) y te escucho los audios 👇',
            gpt,
          ].join('\n');
        }
        return [
          '⚠️ No puedo escuchar tu audio: tu negocio todavía no conectó una IA que escuche.',
          '',
          'Las notas de voz las escucho con tu GPT. Conecta tu clave de OpenAI y lo hago 👇',
          gpt,
        ].join('\n');
      }
      if (ctx.conPc) {
        return [
          `⚠️ Aquí no puedo ${que}: tu Claude está en tu computadora, y desde ahí te contesto en la app, no en WhatsApp.`,
          '',
          'Escríbeme en la app 👇',
          enlaceA(link, 'app'),
          '',
          'Para que también te conteste aquí, conecta tu GPT (una clave de OpenAI) 👇',
          gpt,
          ...lineasDeLoQueFalta(link, ctx.faltan),
        ].join('\n');
      }
      return [
        `⚠️ No puedo ${que}: tu negocio todavía no conectó su IA.`,
        '',
        'Para que te conteste aquí, conecta tu GPT (una clave de OpenAI) 👇',
        gpt,
        '',
        'Y para escribirme en la app, instala MaKo en tu computadora y conecta tu Claude 👇',
        enlaceA(link, 'pc'),
        ...lineasDeLoQueFalta(link, ctx.faltan),
      ].join('\n');
    case 'sin_cuota': {
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
      // El link abre el modal de la IA que llegó al tope (otra cuenta de esa); si fue su Gemini, el de su GPT: no se lo
      // manda a conectar otro Gemini (ver `CUBREN_EL_TURNO`).
      const otraCuenta = prov === 'openai' || prov === 'anthropic' ? enlaceA(link, prov) : gpt;
      if (keysDelCliente >= 2) {
        return [
          `⚠️ No puedo ${que}: la IA que tengo conectada me está rebotando por límite.`,
          '',
          'Puede ser el límite por minuto o el del día. Si es el del minuto se destraba solo: vuelve a intentarlo en un rato. Si sigue igual, una cuenta más lo resuelve 👇',
          otraCuenta,
        ].join('\n');
      }
      return [
        `⚠️ Te quedaste sin cuota de IA, por eso no puedo ${que}.`,
        '',
        'Tu API key llegó al tope. Puede ser el del minuto —y ahí se destraba solo en un rato— o el del día. Si cargas otra sigo funcionando *ahora*: puedes tener varias y las voy rotando 👇',
        otraCuenta,
      ].join('\n');
    }
    case 'sin_respaldo': {
      // ⚠️ NI «SE CAYÓ» NI «CARGA UNA SEGUNDA (SON GRATIS)» (25/10/2026). No sabemos que se cayó: no contestó. Y desde IA16
      // nada es gratis; una segunda del MISMO proveedor no cubre su bache, y su Gemini no se ofrece (`CUBREN_EL_TURNO`). Lo
      // que lo cubre es su GPT, salvo que su única IA YA sea su GPT: ahí no hay otra que ofrecer (su Claude no corre los
      // turnos con herramientas ni escucha audios), y se dice sólo que lo mande de nuevo.
      const respaldo = prov ? respaldosDe(prov)[0] : undefined;
      const noContesto = `⚠️ ${prov ? `${NOMBRE_IA[prov]}, tu IA,` : 'Tu IA'} no me contestó justo ahora y no pude ${que}.`;
      if (!respaldo) return [noContesto, '', 'Mándamelo de nuevo en un rato.'].join('\n');
      return [
        noContesto,
        '',
        'Mándamelo de nuevo en un rato. Tienes *una sola* IA conectada: si conectas también tu GPT (una clave de OpenAI), lo uso de respaldo cuando la otra falla 👇',
        gpt,
      ].join('\n');
    }
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

/**
 * La pantalla de la IA que destraba a MaKo en WhatsApp, con el modal ya abierto: su GPT, para texto Y para audio (25/10/2026,
 * ver `CUBREN_EL_TURNO`). Antes, su Claude para el texto (IA9) y su Gemini para la nota de voz (24/10), y las dos cosas
 * mandaban a conectar algo que en el grupo no lo resuelve: su Claude no corre los turnos con herramientas ni escucha, y
 * Gemini no se ofrece. Las otras conexiones que nombra un cartel salen de éste con `enlaceA`.
 * ⚠️ Lo que sale por WhatsApp va con su `?ws=` (`linkApp`, lib/app-url.ts): el aviso de la nota de voz se manda directo, sin
 * pasar por `linksConWs` como la respuesta de texto, y salía sin él.
 */
export const rutaKeysIA = (): string => RUTA_CONEXION.openai;

/** `rutaKeysIA` con la base de la app adelante. */
export const linkKeysIA = (base: string): string => `${base}${rutaKeysIA()}`;

/**
 * QUÉ CARTEL SALE en el doer de WhatsApp cuando ninguna IA contestó (24/10/2026, el incidente del ws21): el texto Y la fila
 * `cartel:<esto>` que lee el vigía. Es la causa (`causaDelFallo`), salvo sin keys propias y con la marca «red gratis
 * salteada» en los errores de la red (`erroresPlataforma`): ahí, `sin_red_por_datos` (`textoSinRedPorDatos`).
 *
 * ⚠️ LA MARCA TIENE QUE SIGNIFICAR «HABÍA UNA RED Y SE LA SALTEÓ». Hasta el 24/10 el doer la dejaba con sólo mirar el turno,
 * y desde IA16 no hay red para ningún negocio: a uno sin su IA que preguntaba por sus reuniones le decía «no los mando a
 * la IA gratis de MaKo» (un porqué falso), y a otro pedido del mismo negocio, sin datos, `sin_keys`: dos carteles para la
 * misma causa. Esta función no puede saberlo (es pura): lo garantiza el doer preguntando por la red antes de marcar.
 */
export function cartelDelFallo(causa: CausaFalloIA, erroresRed: readonly string[]): CausaFalloIA | 'sin_red_por_datos' {
  return causa === 'sin_keys' && sinRedPorDatos(erroresRed) ? 'sin_red_por_datos' : causa;
}

/**
 * EL MOTIVO DE LA FILA `cartel-ia`, CON EL TEXTO QUE LE LLEGÓ A LA PERSONA (25/10/2026). El cartel no entra al historial del
 * grupo (`avisoDeSistema`, lib/mako-doer-in.ts), y la fila decía sólo «ws21 · consultar · 0 keys · 0 probadas · 0
 * contestaron»: lo que leyó Florencia el 22/10 hubo que reconstruirlo desde el código de esa hora. El vigía
 * (lib/vigia-mako-grupos.ts) lee este motivo; el `ws` va primero porque de ahí saca el negocio. El texto va antes que los
 * errores, que son largos, y en una sola línea.
 */
export const MOTIVO_CARTEL_MAX = 1500;
export function motivoDelCartel(datos: readonly string[], texto: string, errores: readonly string[] = []): string {
  const enUnaLinea = texto.split('\n').map((l) => l.trim()).filter(Boolean).join(' / ');
  const partes = [...datos.filter(Boolean), `texto: «${enUnaLinea}»`];
  if (errores.length) partes.push(`errores: ${errores.join(' · ').slice(0, 300)}`);
  return partes.join(' · ').slice(0, MOTIVO_CARTEL_MAX);
}
