// =============================================================================
// flujo-pasos — QUÉ hace el motor en cada paso, sin tocar la base
// =============================================================================
// Vive separado de `lib/flujos.ts` y SIN `server-only` a propósito: es la mitad que
// decide, y adentro del módulo que hace el trabajo sucio ningún test la puede
// importar. Es la misma razón por la que `exigirClienteDePrueba` vive en
// `lib/auth-session.ts` y no adentro del Reset.
//
// ── POR QUÉ ESTE MÓDULO EXISTE AHORA ─────────────────────────────────────────
// Hasta el 04/10/2026 `ejecutarPasos` era un `for` SINCRÓNICO adentro del webhook:
// no escribía ninguna fila, no había tabla de corridas, y por eso el paso `esperar`
// —que estaba declarado en el tipo desde el día uno— hacía `break` y no se ejecutaba
// nunca. Sin estado no hay delay y no hay condicional: no es que faltara el tipo de
// paso, faltaba dónde guardar EN QUÉ PASO VA.
//
// El pedido que lo destrabó, textual: «si paso el cursor por una flecha, debería
// dejarme agregar un condicional en medio. O también un "Delay"», y antes «un
// "Condicional", que este último es por ejemplo, si responde al mensaje anterior».
//
// ── LA CONDICIÓN QUE EXISTE DE VERDAD, Y POR QUÉ SE LLAMA ASÍ ────────────────
// ⚠️ El motor de avisos NO ve si el LEAD contestó: sus mensajes salen al grupo de
// MaKo del dueño (`aviso_dueno`), y al lead no le sale nada (decisión del 06/10/2026:
// «nada al cliente»; ver lib/flujos.ts). La única señal de respuesta que este motor
// puede observar es la que ya corta las insistencias: alguien acusó recibo EN EL GRUPO
// (`esAcuse` → `cerrarPorAcuse`, app/api/webhooks/evolution/route.ts).
//
// Por eso la condición se llama `contestaron` y la tarjeta dice «si alguien contestó
// en el grupo», no «si responde el lead». La regla de la casa es que sólo se dibuja
// la rama que el motor EJECUTA, y un rótulo que promete una señal que no existe es
// la misma mentira con otra cara. El día que el motor vea la respuesta del lead, se
// agrega OTRA condición — no se le cambia el texto a ésta.

import { type Paso } from './flujos-tipos';
import { cumpleRama, type HechosLead } from './flujo-grafo';

/**
 * Las condiciones que el motor SABE evaluar. Es la lista que el lienzo puede dibujar.
 *
 * ⚠️ ESTA CONSTANTE ES EL CONTRATO ENTRE EL MOTOR Y EL DIBUJO, y tiene guard. Si el
 * lienzo dibuja una rama que `decidir` no sabe resolver, el diagrama afirma algo que
 * no ocurre — que es exactamente lo que el lienzo del chatbot ya fija con
 * `CONDICIONES_VIVAS`. Agregar una condición es tocar los dos lados o romper el test.
 */
export const CONDICIONES_FLUJO = ['contestaron', 'no_contestaron'] as const;
export type CondicionFlujo = (typeof CONDICIONES_FLUJO)[number];

export const ROTULO_CONDICION: Record<CondicionFlujo, string> = {
  contestaron: 'Si alguien contestó en el grupo',
  no_contestaron: 'Si nadie contestó',
};

/** Lo que el motor sabe de una corrida cuando tiene que decidir el paso siguiente. */
export type EstadoCorrida = {
  /** Índice del paso que toca. */
  paso: number;
  /** Cuándo arrancó la corrida, para medir la espera. */
  desde: Date;
  /** Cuándo alguien acusó recibo, si pasó. Es la señal del condicional. */
  respondioAt: Date | null;
  ahora: Date;
  /**
   * Los hechos del LEAD de la corrida, para la `condicion` de un evento de MaKo (11/10/2026). Los lee
   * `ejecutarPasos` una vez, al llegar a la primera; null o ausente = no se saben, y una condición que no se
   * sabe NUNCA se cumple (la regla de `cumpleFila`).
   */
  hechos?: HechosLead | null;
};

export type Decision =
  | { que: 'ejecutar'; paso: Paso; siguiente: number }
  | { que: 'esperar'; hasta: Date; siguiente: number }
  | { que: 'saltar'; siguiente: number }
  | { que: 'terminar' };

/**
 * El techo de un delay. No es configurable por la misma razón que el de la
 * insistencia: una espera de meses deja una corrida viva que nadie recuerda haber
 * configurado, y el drenador la despierta sobre un mundo que ya cambió.
 *
 * 30 días es lo que dura el contexto de un aviso: más que eso, lo que había que
 * avisar ya no es cierto — es la misma regla que «un mensaje que habla de un MOMENTO
 * se re-pregunta al salir».
 */
export const DELAY_MAX_HORAS = 24 * 30;
export const DELAY_MIN_HORAS = 1 / 60; // un minuto: para poder probarlo

export function sanearHoras(h: unknown): number {
  const n = typeof h === 'number' && Number.isFinite(h) ? h : 1;
  return Math.min(DELAY_MAX_HORAS, Math.max(DELAY_MIN_HORAS, n));
}

/**
 * LA LÍNEA QUE LE LLEGA AL DUEÑO CUANDO UN PASO «⚡ ACCIÓN» NO SE PUDO.
 *
 * Una sola línea y corta: es un aviso en el grupo de MaKo, no un log. Dice QUÉ acción y
 * POR QUÉ, porque el paso corre solo (decisión de Martín, 08/10/2026) y nadie está
 * mirando: si falla callado, el dueño cree que la automatización hizo su trabajo.
 *
 * ⚠️ EL RESUMEN SE APLANA Y SE CORTA. Lo escribe el validador del registro o el error de
 * una operación, y puede traer saltos de línea o un párrafo entero; pegado tal cual, «una
 * línea» deja de serlo. Pura y sin `server-only` para que tenga test.
 */
export const TOPE_RESUMEN_FALLO = 160;

export function lineaDeFalloAccion(accion: string, aviso: string, resumen: string): string {
  const plano = (resumen || '').replace(/\s+/g, ' ').trim();
  const corto = plano.length > TOPE_RESUMEN_FALLO ? `${plano.slice(0, TOPE_RESUMEN_FALLO - 1).trimEnd()}…` : plano;
  return `⚠️ No se pudo «${accion}» (${aviso})${corto ? `: ${corto}` : '.'}`;
}

/** ¿La condición se cumple con lo que el motor sabe hoy? */
export function cumple(cond: CondicionFlujo, est: Pick<EstadoCorrida, 'respondioAt'>): boolean {
  if (cond === 'contestaron') return est.respondioAt !== null;
  return est.respondioAt === null;
}

/**
 * El paso siguiente, dado el estado. Pura: no toca la base ni el reloj del sistema.
 *
 * ⚠️ UN `esperar` QUE YA VENCIÓ NO VUELVE A ESPERAR. El drenador despierta la corrida
 * y vuelve a llamar acá con el MISMO índice de paso; si esto no mirara `desde`,
 * devolvería «esperar» otra vez y la corrida quedaría dando vueltas para siempre,
 * despertándose y volviéndose a dormir sin avanzar nunca. Por eso la espera se mide
 * contra `desde` —cuándo se durmió— y no contra «cuándo empezó todo».
 *
 * ⚠️ Y UN `condicional` SALTA UN SOLO PASO, el de al lado. Es lo que hace que la rama
 * sea legible en el lienzo sin inventar un grafo: «si pasa esto, hacé lo que sigue;
 * si no, saltealo». Un salto a un índice arbitrario necesitaría dibujar flechas que
 * cruzan, y eso es un editor de flechas — lo que el dueño ya tumbó por «rebuscado».
 */
export function decidir(pasos: Paso[], est: EstadoCorrida): Decision {
  const paso = pasos[est.paso];
  if (!paso) return { que: 'terminar' };

  if (paso.tipo === 'esperar') {
    const hasta = new Date(est.desde.getTime() + sanearHoras(paso.horas) * 3_600_000);
    if (est.ahora.getTime() >= hasta.getTime()) return { que: 'saltar', siguiente: est.paso + 1 };
    return { que: 'esperar', hasta, siguiente: est.paso + 1 };
  }

  if (paso.tipo === 'condicional') {
    // Si NO se cumple, se saltea el paso de al lado: el `+2` es la rama corta.
    return { que: 'saltar', siguiente: cumple(paso.condicion as CondicionFlujo, est) ? est.paso + 1 : est.paso + 2 };
  }

  // LA CONDITION DE UN EVENTO DE MAKO: una sola salida. Se cumple con los hechos del lead → sigue; no, o sin
  // hechos → termina. «No sé» no es «sí»: mandarle al grupo lo de una rama que no se pudo decidir sería
  // afirmar algo del lead que nadie miró.
  if (paso.tipo === 'condicion') {
    return est.hechos && cumpleRama(paso.rama, est.hechos) ? { que: 'saltar', siguiente: est.paso + 1 } : { que: 'terminar' };
  }

  return { que: 'ejecutar', paso, siguiente: est.paso + 1 };
}

/**
 * «NO PUDE LEER AL LEAD» NO ES «NO SE CUMPLE» (revisión del 11/10/2026): la CONDITION de un evento de MaKo, cuando la
 * lectura de los hechos FALLA, se duerme y se vuelve a preguntar en vez de terminar.
 *
 * ⚠️ POR QUÉ NO ALCANZA CON TERMINAR: el emisor reclama el dedup del evento ANTES de correr (`emitirPorEvento`), así
 * que una corrida que termina por un bache de la base gasta la ventana sin haber dicho nada — en la cobranza son 120
 * días: el cron vuelve a ofrecer la cuota los días siguientes y recibe `deduped`. «Sin lead» (o un lead que ya no
 * está) sigue terminando: eso sí es «no se sabe», y lo que no se sabe NUNCA se cumple (`decidir`).
 *
 * ⚠️ Y TIENE TOPE, CORTO: cada reintento es la MISMA corrida un rato después, con el mismo texto armado en la mano
 * («⏰ En 30 min tienes la R1…» si la tarjeta va antes de cualquier DELAY). Tres vueltas de 5 minutos: un bache de la
 * base se cura en ese rato, y más tarde el mensaje ya habla de otro momento. Agotado, la corrida se corta y lo dice.
 */
export const REINTENTO_HECHOS_MIN = 5;
export const TOPE_REINTENTOS_HECHOS = 3;

export function reintentoDeHechos(
  reintentos: unknown, ahora: Date,
): { que: 'reintentar'; hasta: Date; reintentos: number } | { que: 'rendirse' } {
  const n = typeof reintentos === 'number' && Number.isFinite(reintentos) && reintentos > 0 ? Math.floor(reintentos) : 0;
  if (n >= TOPE_REINTENTOS_HECHOS) return { que: 'rendirse' };
  return { que: 'reintentar', hasta: new Date(ahora.getTime() + REINTENTO_HECHOS_MIN * 60_000), reintentos: n + 1 };
}

/**
 * LO QUE ENVEJECE: las claves de `datos` que son la FOTO del momento en que el evento pasó (AGENTS.md, «Un dato
 * EXACTO que viaja con un trabajo diferido es la FOTO de cuando se guardó»). `cuota_dias` es «hace cuánto
 * venció» HOY: dormida 48 h diría «1 día» sobre un atraso de tres. Es la `CLAVE_QUE_ENVEJECE` de lib/cobranza.ts
 * (el test lo cruza). Una tarjeta después de un DELAY no la puede usar (`pasosDelEvento`, lib/aviso-evento.ts).
 */
export const QUE_ENVEJECEN: readonly string[] = ['cuota_dias'];

/**
 * EL CONTEXTO QUE GUARDA UNA CORRIDA AL DORMIRSE (`abrirCorrida`, lib/flujo-corridas.ts): el mismo, sin lo que
 * envejece. Lo que viene después del DELAY sale con los datos estables (el número, el monto, el vencimiento);
 * el mensaje de entrada ya salió con todos.
 */
export function ctxParaDormir<C extends { datos?: Record<string, string> }>(ctx: C): C {
  if (!ctx.datos) return ctx;
  const datos = Object.fromEntries(Object.entries(ctx.datos).filter(([k]) => !QUE_ENVEJECEN.includes(k)));
  return { ...ctx, datos };
}
