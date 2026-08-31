// =============================================================================
// flow-fallo-texto — qué se le dice a alguien cuando Google Flow no pudo
// =============================================================================
// SIN `server-only`, por el mismo motivo que `lib/fallo-ia-texto.ts`, que existe
// para exactamente esto: lo que decide qué se le dice a un cliente tiene que
// poder testearse sin levantar un server. Y de paso, al no ser server-only, la
// misma función clasifica en el navegador los errores que ya quedaron
// persistidos, sin necesidad de una migración.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// El error de Flow viajaba CRUDO hasta la pantalla. El dueño se encontró con
// cinco líneas de JSON de Google en el medio de su anuncio:
//
//     Invalid JSON payload received. Unknown name "userInput": Cannot find
//     field. [crudo] HTTP 400 · { "error": { "code": 400, ...
//
// Los otros nueve errores de esa pantalla SÍ estaban traducidos y decían dónde
// se arregla cada cosa; el crudo se colaba sólo por la rama del proveedor.
//
// ── ⚠️ Y EL BUG QUE ESE JSON NOMBRA YA ESTABA ARREGLADO ────────────────────
// Ese `userInput` es de una versión anterior de `lib/flow-imagen.ts`. Lo que se
// veía en pantalla era un FÓSIL: un error guardado hace horas que la pantalla
// devolvía para siempre sin volver a preguntarle a nadie.
//
// De ahí la regla que gobierna este módulo: **un error persistido sin fecha es
// indistinguible de un error de ahora.** Traducir el mensaje sin decir CUÁNDO
// pasó cambia una mentira por otra. Por eso `textoFlow` recibe el `at` y lo dice.

/**
 * De `flow_trabajos.motivo` —que el SERVER ya clasificó— a lo que ve el cliente.
 *
 * ⚠️ ESTO EXISTE PORQUE LA PANTALLA ESTABA ADIVINANDO. La columna `motivo` está
 * en la tabla desde la migración 0145, con la causa ya decidida por quien vio el
 * error crudo de Google; la pantalla no la leía y volvía a clasificar por TEXTO
 * sobre un mensaje que el propio server ya había traducido al castellano.
 *
 * Medido sobre los nueve mensajes que el server puede escribir: OCHO caían en
 * `desconocida`. Entre ellos el de la pestaña muda, que se convertía en «Google
 * no pudo hacer la imagen y no dijo por qué / tus créditos están bien» — cuando
 * la instrucción que lo arreglaba en dos segundos, «Recárgala (F5)», estaba
 * escrita palabra por palabra en la misma fila.
 *
 * Es un mapa CERRADO: un motivo nuevo devuelve `undefined` y quien llama cae a
 * `causaFlow`, que es adivinar. El compilador no avisa de eso; el test sí.
 */
export type CausaFlow =
  /** El pedido que sale de acá está mal armado. No es del cliente. */
  | 'nuestra'
  /** La sesión de Google venció o se cerró. */
  | 'sesion'
  /** La cuenta de Google se quedó sin créditos. */
  | 'sin_creditos'
  /** La extensión no contesta. */
  | 'puente'
  /** Google falló y no dijo por qué. */
  | 'google'
  /** El filtro de contenido de Google rechazó el prompt. Reintentar no sirve. */
  | 'contenido'
  /**
   * Google ACEPTÓ el trabajo y lo está haciendo; lo que falla es preguntarle
   * cómo va.
   *
   * ⚠️ Es una causa propia y no un `nuestra` más, y la diferencia no es de matiz:
   * el texto de `nuestra` afirma «no se gastaron créditos», que acá sería FALSO
   * —el clip se aceptó, así que se pagó— y su acción es «volver a generar», que
   * cobraría un segundo clip por uno que probablemente ya existe.
   *
   * Es la regla de la casa aplicada a la salida: «no puedo hacer X con este dato»
   * no es «este dato es falso». No poder LEER el estado no convierte a la toma en
   * fallida.
   */
  | 'ciego'
  /**
   * El clip ESTÁ HECHO del lado de Google y no tenemos con qué traerlo.
   *
   * ⚠️ Es distinto de `ciego`, y la diferencia importa porque cambia lo que
   * conviene hacer. En `ciego` no sabemos nada: puede estar generándose. Acá
   * Google contestó `MEDIA_GENERATION_STATUS_SUCCESSFUL` con el tamaño del
   * archivo — o sea que esperar más no sirve, y volver a filmar es tirar un clip
   * que ya se pagó y que existe.
   */
  | 'sin_enlace'
  | 'desconocida';

/**
 * De qué es culpa este fallo.
 *
 * El orden importa: se pregunta primero por lo más específico. Un 400 de forma
 * dice «Invalid JSON payload» y también podría contener la palabra «quota» en
 * algún campo, y confundir los dos manda a recargar créditos que están bien.
 */
export function causaFlow(crudo: string): CausaFlow {
  const m = (crudo || '').toLowerCase();
  if (!m.trim()) return 'desconocida';

  // Nuestra: el pedido tiene un campo que Google no reconoce.
  if (/invalid json payload|unknown name|cannot find field|invalid_argument|badrequest/.test(m)) return 'nuestra';

  // Sin créditos ANTES que sesión: un 403 por cuota trae las dos señales.
  if (/quota|insufficient|out of credits|sin cr[eé]ditos|resource_exhausted/.test(m)) return 'sin_creditos';

  if (/unauthenticated|permission_denied|\b401\b|\b403\b|sesi[oó]n|sign in|logged out/.test(m)) return 'sesion';

  if (/sin_plantilla|parche_fallo|fetch_timeout|fetch_fallo|no_flow_tab|captcha|puente/.test(m)) return 'puente';

  if (/\b5\d\d\b|unavailable|internal|deadline|timeout/.test(m)) return 'google';

  return 'desconocida';
}

const CAUSA_DE_MOTIVO: Record<string, CausaFlow> = {
  puente_dormido: 'puente',
  // No hay pestaña abierta: el puente no existe, no es que la sesión venció.
  sin_pestana: 'puente',
  captcha: 'puente',
  contenido: 'contenido',
  cuota: 'sin_creditos',
  // El pedido nombra un modelo que esta cuenta no tiene: lo armamos nosotros.
  modelo: 'nuestra',
  medio_vencido: 'google',
  transitorio: 'google',
  // Lo armamos mal nosotros. El texto de `nuestra` ya lo dice bien y —lo que mas
  // importa— no manda al cliente a revisar nada suyo.
  pedido_invalido: 'nuestra',
  // Sin ambigüedad recién desde que `NO_FLOW_TAB` dejó de ser `sin_sesion`.
  sin_sesion: 'sesion',
  sesion_marcada: 'sesion',
};

/** La causa que el server ya decidió, o `undefined` si el motivo es nuevo. */
export function causaDeMotivo(motivo: string): CausaFlow | undefined {
  return CAUSA_DE_MOTIVO[(motivo || '').trim()];
}

export type TextoFlow = {
  titulo: string;
  detalle: string;
  /** A dónde se va a arreglar. Ausente = no hay nada que el cliente pueda tocar. */
  arreglaEn?: string;
  /** Qué dice el botón principal del error. Nunca «Reintentar» a secas. */
  accion: string;
  secundaria?: string;
};

/** Cuánto hace que pasó, en palabras, o `''` si fue recién. */
export function cuandoPaso(at: string | undefined, ahora: Date): string {
  if (!at) return '';
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return '';
  const horas = (ahora.getTime() - t) / 3_600_000;
  // ⚠️ Sólo se dice cuando YA NO ES DE AHORA. Fechar un error de hace dos
  // minutos es ruido; no fechar uno de hace tres días es una mentira.
  if (horas < 24) return '';
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'Esto pasó ayer.' : `Esto pasó hace ${dias} días.`;
}

/**
 * El texto que ve la persona.
 *
 * `que` nombra el objeto: «la imagen del escenario 1», «la toma 3». Un error que
 * no dice sobre qué es obliga a adivinar cuál de las siete filas se rompió.
 */
export function textoFlow(
  causa: CausaFlow,
  que: string,
  at?: string,
  ahora = new Date(),
  /**
   * La frase que escribió el SERVER, si la hay. GANA sobre la constante.
   *
   * El server vio el error crudo y muchas veces sabe algo que acá no se puede
   * saber —qué pestaña, qué campo, qué hay que apretar—. Reemplazarla por un
   * texto genérico es tirar la única parte accionable del mensaje.
   */
  delServidor = '',
): TextoFlow {
  const cuando = cuandoPaso(at, ahora);
  const con = (d: string) => {
    const base = (delServidor || '').trim() || d;
    return cuando ? `${cuando} ${base}` : base;
  };

  switch (causa) {
    case 'nuestra':
      return {
        titulo: 'MaKo le pidió esto mal a Google',
        // ⚠️ SIN link a configuración, a propósito. Mandar a alguien a revisar
        // sus credenciales por un bache nuestro es el mismo error con el signo
        // cambiado, y se paga peor: lo manda a tocar algo que está bien.
        detalle: con(
          `No es tuyo ni de tu cuenta, y no se gastaron créditos: el pedido que sale de aquí tiene un campo que Google no reconoce. Ya quedó anotado y se arregla de nuestro lado. Mientras tanto puedes subir una foto y seguir sin esperar.`,
        ),
        accion: `Volver a generar ${que}`,
        secundaria: 'Subir mi foto del lugar',
      };

    case 'ciego':
      return {
        // El título nombra ${que} porque, con siete tomas, un error que no dice
        // cuál obliga a adivinar. Y es literal: dice lo que pasa, no lo que se
        // siente.
        titulo: `MaKo no puede leer cómo va ${que}`,
        // ⚠️ UNA LÍNEA. La versión anterior eran 40 palabras en un párrafo
        // centrado de tres renglones, debajo de un lienzo de 720 px y encima de
        // dos pliegues sueltos y un volcado de JSON. El dueño lo cortó: «esos
        // mensajes de abajo están muy mal diseñados».
        //
        // Lo que sobraba no era el tono: era que la pantalla explicaba en vez de
        // ofrecer. Lo tranquilizador —no es tu cuenta, no son tus créditos, MaKo
        // sigue preguntando— es cierto y no es lo que alguien necesita leer con
        // el botón a la vista. Queda la causa en catorce palabras; el resto lo
        // dice el botón.
        detalle: con('Google aceptó el pedido y lo está haciendo. Lo que falla es nuestra consulta.'),
        // ⚠️ NO dice «volver a generar»: la toma ya se pagó y volver a pedirla
        // cobraría un segundo clip por uno que probablemente ya existe.
        accion: 'Preguntar de nuevo',
        secundaria: 'Abrir Google Flow',
      };

    case 'sin_enlace':
      return {
        titulo: `${que.charAt(0).toUpperCase()}${que.slice(1)} ya está lista en Google`,
        detalle: con('El video está hecho y MaKo todavía no sabe con qué enlace traerlo. Se está resolviendo de nuestro lado; el clip no se pierde ni se vuelve a cobrar.'),
        accion: 'Buscar el video otra vez',
      };

    case 'sesion':
      return {
        titulo: 'Google no reconoció tu cuenta',
        detalle: con('Tu sesión de Google Flow venció o se cerró. Abre Flow, inicia sesión y vuelve a intentarlo.'),
        accion: `Volver a generar ${que}`,
      };

    case 'sin_creditos':
      return {
        titulo: 'Tu cuenta de Google se quedó sin créditos',
        detalle: con('Cada toma cuesta unos 15 créditos y ya no alcanzan. Recárgalos en tu cuenta de Google y vuelve a filmar.'),
        arreglaEn: '/integraciones',
        accion: 'Ver la conexión con Google',
      };

    case 'contenido':
      return {
        titulo: `Google no aceptó el prompt de ${que}`,
        detalle: con('El filtro de contenido de Google rechazó cómo está escrito el escenario. No se gastaron créditos, y volver a intentarlo con el mismo texto va a dar lo mismo: hay que reescribirlo.'),
        accion: 'Decir qué cambiar',
      };

    case 'puente':
      return {
        titulo: 'El puente con Google Flow no responde',
        detalle: con('MaKo filma a través de una extensión instalada en tu navegador. Está cerrada, o la sesión de Google no está abierta.'),
        accion: 'Revisar el puente',
      };

    default:
      return {
        titulo: `Google no pudo hacer ${que} y no dijo por qué`,
        detalle: con('No es nada tuyo ni de tu cuenta, y tus créditos están bien. Vuelve a intentarlo en unos minutos; si se repite, envíanos el detalle técnico de aquí abajo.'),
        accion: `Volver a generar ${que}`,
      };
  }
}
