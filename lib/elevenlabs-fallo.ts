// =============================================================================
// elevenlabs-fallo — qué significa lo que contestó ElevenLabs
// =============================================================================
//
// SIN `server-only`, y es el mismo criterio que `flow-fallo-texto` y
// `acento-workspace`: acá vive lo único que puede fallar en silencio —mandar a
// alguien a pagar una factura que está al día, o a tocar unos permisos que están
// bien— y eso hay que poder probarlo sin una cuenta ni una llamada.
//
// ── El caso que lo hace necesario ──────────────────────────────────────────
//
// La MISMA cuenta devolvió 401 dos veces, con dos causas opuestas:
//
//   22/08/2026  {"detail":{"type":"payment_required","code":"payment_issue",
//                "message":"Your subscription has a failed or incomplete payment…"}}
//   02/09/2026  {"detail":{"type":"authentication_error","code":"unauthorized",
//                "status":"missing_permissions",
//                "message":"…missing the permission user_read…"}}
//
// Los dos son 401 y desde afuera se ven iguales. El primero se lee como «la key
// tiene permisos acotados» —que fue exactamente lo que se concluyó, y era
// falso— y el segundo como «hay que pagar». Mandan a hacer cosas distintas, así
// que **se clasifica por `detail.code`, nunca por el status.**

export type FalloEleven =
  | 'sin_key'
  | 'sin_permiso'
  | 'impago'
  | 'voz_muerta'
  | 'cuota'
  | 'proveedor'
  | 'nuestra';

export type Clasificado = { motivo: FalloEleven; error: string };

/**
 * Clasifica una respuesta de ElevenLabs a partir de su status y su cuerpo.
 *
 * El cuerpo puede no ser JSON (una página de error, un vacío): ahí se cae a la
 * clasificación por status, que es menos precisa pero nunca inventa un motivo.
 */
export function clasificarEleven(status: number, cuerpo: string): Clasificado {
  let d: Record<string, unknown> = {};
  try {
    const j = JSON.parse(cuerpo) as { detail?: unknown };
    // ⚠️ `detail` puede ser un ARRAY: es lo que devuelve el 422 de validación
    // («Field required»). Tratarlo como objeto no rompe, pero leerle `.code` da
    // undefined y el motivo caería al genérico.
    if (j.detail && typeof j.detail === 'object' && !Array.isArray(j.detail)) {
      d = j.detail as Record<string, unknown>;
    }
  } catch { /* no era JSON: manda el status */ }

  const code = String(d.code ?? '');
  const tipo = String(d.type ?? '');
  const est = String(d.status ?? '');
  const msg = String(d.message ?? '').trim();

  // El impago va PRIMERO: viene con status 401, o sea que cualquier regla que
  // mire el status antes se lo lleva puesto y manda a tocar los permisos.
  if (/payment/i.test(code) || /payment/i.test(tipo)) {
    return { motivo: 'impago', error: msg || 'La suscripción de ElevenLabs tiene un pago pendiente.' };
  }
  if (/voice_not_found|voice_does_not_exist/i.test(code)) {
    return { motivo: 'voz_muerta', error: msg || 'Esa voz ya no existe en la cuenta de ElevenLabs.' };
  }
  if (/quota|limit/i.test(code) || status === 429) {
    return { motivo: 'cuota', error: msg || 'Se agotó la cuota de ElevenLabs de este mes.' };
  }
  if (status === 401 || status === 403 || /missing_permissions/i.test(est)) {
    return { motivo: 'sin_permiso', error: msg || 'La API key de ElevenLabs no tiene permiso para esta operación.' };
  }
  if (status === 422 || status === 400) {
    return { motivo: 'nuestra', error: msg || `MaKo le pidió esto mal a ElevenLabs (HTTP ${status}).` };
  }
  return { motivo: 'proveedor', error: msg || `ElevenLabs respondió ${status}.` };
}

/**
 * ¿Este sondeo dice que la key PUEDE hacer la operación?
 *
 * ⚠️ EL SONDEO MANDA EL PEDIDO REAL SIN CUERPO, A PROPÓSITO. Si falta el permiso,
 * ElevenLabs contesta 401 antes de mirar el cuerpo; si está, contesta **422
 * "Field required"**. Así se comprueba la operación que se va a usar —que es la
 * regla de la casa— sin crear una voz ni gastar un carácter de cuota.
 *
 * Hace falta porque los cuatro caminos baratos dan verde sobre una cuenta que no
 * puede generar: el 22/08/2026, con la factura impaga, `GET /v1/voices` devolvía
 * 200 con las cinco voces y `POST /v1/voices/add` también daba 200. **Crear un
 * clon funciona, convertir no.**
 */
export function elSondeoDicePuede(status: number): boolean {
  return status === 422;
}

/**
 * ¿Un cuerpo de respuesta es audio, o es un error disfrazado?
 *
 * ⚠️ UN 200 PUEDE TRAER EL FALLO ADENTRO, y acá el modo de falla es peor que un
 * error: el cuerpo se escribe en `sts-N.mp3` y ffmpeg revienta tres etapas
 * después con un mensaje sobre el formato del archivo, que manda a mirar el
 * lugar equivocado.
 *
 * El umbral no es arbitrario: un JSON de error de ElevenLabs pesa cientos de
 * bytes, y un segundo de mp3 a 192 kbps pesa ~24 KB. Cualquier cosa por debajo
 * de 4 KB no es audio útil ni aunque lo fuera.
 */
export function pareceAudio(bytes: number): boolean {
  return bytes >= 4000;
}

// ─────────────────────────────────────────────────────────────────────────
// De quién fue, y qué hacer
// ─────────────────────────────────────────────────────────────────────────

/** Dónde se carga la key. Un solo lugar: lo usan la tab y el onboarding. */
export const linkKeyEleven = (base = ''): string => `${base}/integraciones?abrir=elevenlabs`;

export type TextoEleven = {
  titulo: string;
  detalle: string;
  /** A dónde ir a arreglarlo. Ausente cuando NO hay nada que el cliente pueda hacer. */
  arreglaEn?: string;
  accion?: string;
};

/**
 * Qué se le dice al cliente por cada motivo.
 *
 * ⚠️ EL REPARTO DE CULPA ES LO QUE DECIDE SI LLEVA LINK, y desde que la voz es
 * BYOK cambió de dueño: antes ElevenLabs corría con la cuenta de MaKo, así que
 * todo fallo era nuestro. Ahora la cuenta es del cliente y la mayoría se arregla
 * en SU pantalla — mandarlo a esperar es mandarlo a esperar algo que no va a
 * llegar.
 *
 * ⚠️ Y la contracara, que se paga peor: `proveedor` y `nuestra` NO llevan link y
 * dicen con todas las letras que no es nada suyo. Culpar al cliente por un bache
 * ajeno lo manda a tocar algo que está bien.
 *
 * El mapa es CERRADO sobre `FalloEleven`: un motivo nuevo no compila hasta que
 * alguien escriba qué decirle a la persona.
 */
export function textoEleven(motivo: FalloEleven, base = ''): TextoEleven {
  const aMiCuenta = { arreglaEn: linkKeyEleven(base), accion: 'Ir a mi cuenta de ElevenLabs' };
  const mapa: Record<FalloEleven, TextoEleven> = {
    sin_key: {
      titulo: 'Falta conectar tu cuenta de ElevenLabs',
      detalle: 'La voz clonada se cobra por minuto, así que corre con TU cuenta de ElevenLabs. Se crea en dos minutos y la key se pega en Integraciones.',
      ...aMiCuenta,
      accion: 'Conectar ElevenLabs',
    },
    sin_permiso: {
      titulo: 'A tu key de ElevenLabs le faltan permisos',
      detalle: 'Necesita «Voices» con escritura para crear el clon y «Speech to Speech» para convertir. Con sólo «Text to Speech» se ve válida y falla recién al convertir.',
      ...aMiCuenta,
    },
    impago: {
      titulo: 'ElevenLabs tiene un pago pendiente en tu cuenta',
      detalle: 'Lo dice ElevenLabs, no MaKo: hasta que se regularice no deja generar audio.',
      ...aMiCuenta,
    },
    cuota: {
      titulo: 'Se agotó tu cuota de ElevenLabs de este mes',
      detalle: 'Se repone al empezar el próximo ciclo, o subiendo de plan. Mientras tanto tus anuncios se montan con la voz que genera Flow.',
      ...aMiCuenta,
    },
    voz_muerta: {
      titulo: 'El clon de tu voz ya no existe en ElevenLabs',
      detalle: 'Se borró desde el panel de ElevenLabs, o la key es de otra cuenta. Hay que volver a clonarla.',
      accion: 'Volver a clonar mi voz',
    },
    // ⚠️ SIN LINK, y a propósito: no hay nada que el cliente pueda tocar. La regla
    // del repo es que culpar al cliente por un bache ajeno se paga peor que el bug.
    proveedor: {
      titulo: 'ElevenLabs no está respondiendo',
      detalle: 'No es nada tuyo: tu cuenta y tu key están bien. Es una caída de ellos y se reintenta solo.',
    },
    nuestra: {
      titulo: 'MaKo pidió esto mal',
      detalle: 'No es nada tuyo ni de tu cuenta de ElevenLabs. Queda registrado de este lado.',
    },
  };
  return mapa[motivo];
}
