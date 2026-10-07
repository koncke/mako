// =============================================================================
// cs-senal — ¿cuál de mis clientes necesita atención HOY?
// =============================================================================
// Es el corazón de Customer Success: la pantalla no ordena por alfabeto, ordena
// por esto. Una función pura, sin `server-only`, para que la pueda importar un
// test (tests/cs-senal.test.ts) — la condición que decide qué se le muestra a
// quién no puede ser lo único sin red.
//
// ⚠️ TRES NIVELES, NO DOS. `atencion`, `bien` y **null**. `null` es «no lo sé»,
// y es un valor de primera clase: un cliente sin contrato cargado NO está bien,
// está sin datos, y la pantalla lo tiene que decir distinto. Confundir las dos
// cosas es la falla más cara de este repo — falla en silencio y en la dirección
// tranquilizadora.
//
// ⚠️ LAS REGLAS SALEN DE SEÑALES MEDIDAS, no de un semáforo inventado. Nada de
// health score: con 14 clientes un 78/100 esconde el hecho («tiene una cuota
// vencida hace 9 días») detrás de un número que nadie sabe cómo se calculó.
//
// LO QUE SE MIDIÓ (26/09/2026, los 3 workspaces con clientes ganados del
// producto: ws1 14, ws11 11, ws13 2) y por qué cada regla existe:
//
//   · `leads.fecha_cierre` es el ÚNICO campo que nunca falta: 27 de 27. Es el
//     único ancla temporal segura, y por eso es el reloj de respaldo cuando no
//     hay ninguna conversación.
//   · Cobros (`pagos`): ws1 37 filas / 3 vencidas, ws11 9 / 2, ws13 ninguna. Y
//     DOS cuotas impagas de ws11 no tienen `fecha_esperada`: impaga y vencida
//     son dos cosas, y una sin fecha no se puede declarar vencida nunca.
//   · Sesiones (`closing_analyses` con `lead_id`): 143 en ws1, **0 en ws11 y
//     ws13**. Una pantalla que gire sobre sesiones está vacía en 13 de 27.
//   · WhatsApp (`wa_mensajes`): 2.235 mensajes de ganados en ws1 (el último del
//     03/09) y 561 en ws11 (el último de AYER, con 301 entrantes). Es la única
//     señal viva fuera de ws1, y `from_me` contesta quién habló último.
//   · Tablero (`experimento_tareas`): 9 proyectos de cliente en ws1 y CERO en
//     ws11/ws13. Se usa si está; su ausencia no afirma nada.
//
// De ahí la forma de todo el módulo: **cada señal se puede no poder calcular**,
// y cuando no se puede, no se afirma. Por eso los flags `cobrosLeidos` /
// `contactoLeido` y los `number | null` en el trabajo.

/** `null` = no se puede saber. No es «bien» y no es «mal». */
import { palabra as plural } from './plural';

export type NivelSenal = 'atencion' | 'bien' | null;

/** Cuál de las reglas disparó. Va en el tipo para que la pantalla pueda pintar
 *  distinto sin volver a adivinar, y para que el orden sea determinista. */
export type ReglaSenal =
  // ── Piden algo hoy ──
  | 'cuota-vencida'
  | 'sin-contestar'
  | 'nunca-hablaron'
  | 'silencio'
  | 'tareas-atrasadas'
  | 'contrato-vencido'
  // ── No se puede saber ──
  | 'recien-cerrado'
  | 'sin-contrato'
  | 'sin-datos'
  // ── Nada pendiente ──
  | 'al-dia';

export type Senal = {
  nivel: NivelSenal;
  /** Una frase. Es lo que se lee en la card, así que no lleva el porqué: el
   *  porqué vive en el comentario de su regla, acá abajo. */
  motivo: string;
  regla: ReglaSenal;
  /** El número del que habla el motivo (días, cuotas, tareas). Ordena dentro de
   *  cada regla y deja la señal auditable sin volver a calcularla. */
  dias: number | null;
};

/**
 * Lo que hace falta para decidir. Es un subconjunto estructural de
 * `ClienteCartera` (lib/cs-cartera.ts), así que la cartera se le pasa entera.
 *
 * Los `| null` y los `*Leidos` NO son decoración: son la diferencia entre «no
 * hay» y «no pude averiguarlo», que es justamente lo que este módulo existe
 * para no confundir.
 */
export type HechosCliente = {
  /** Días desde `leads.fecha_cierre`. El único reloj que existe para los 27. */
  diasDesdeElCierre: number | null;

  /** ¿Se pudo leer `pagos`? Un error de lectura no es «no debe nada». */
  cobrosLeidos: boolean;
  cuotasVencidas: number;
  /** Días de la cuota vencida más vieja. */
  cuotaVencidaDias: number | null;
  /** Impagas SIN `fecha_esperada`: nunca se pueden declarar vencidas. */
  cuotasImpagasSinFecha: number;

  /** ¿Se pudieron leer sesiones Y WhatsApp? Si no, el silencio no se afirma. */
  contactoLeido: boolean;
  /** Días desde la última conversación, sea sesión o WhatsApp: lo que haya. */
  ultimoContactoHace: number | null;
  ultimoContactoFue: 'sesion' | 'whatsapp' | null;
  /** Días desde su último mensaje, si NADIE le contestó después. `null` = no
   *  está esperando (o no hay WhatsApp). */
  esperaRespuestaHace: number | null;

  /** Hay algo escrito de lo que se le vendió (`deal_*` o la duración). */
  tieneContrato: boolean;
  /** Su contrato ya venció (fecha de término o semanas cumplidas). */
  contratoTerminado: boolean;

  /** Del tablero. `null` = no se pudo leer o el cruce no existe: no se afirma. */
  tareasAbiertas: number | null;
  tareasAtrasadas: number | null;
};

// ── Los tres umbrales, con su porqué ────────────────────────────────────────
// Un umbral es un PROXY y hay que medirlo (AGENTS.md). Éstos se eligieron contra
// la distribución real de los 27 clientes, no contra lo que suena razonable.

/** Un mensaje suyo de AYER o antes sin respuesta. Hoy no: contestar el mismo día
 *  es lo normal, y marcar en rojo a quien escribió hace dos horas es enseñarle a
 *  la persona a ignorar la pantalla. Medido: ws11 tiene 301 entrantes y el último
 *  mensaje de un ganado es de ayer, así que este umbral es el que más veces va a
 *  decidir algo fuera de ws1. */
const DIAS_SIN_CONTESTAR = 2;

/** Un mes sin una palabra. Por debajo de 30 el ws1 entero entraría en atención
 *  (su último WhatsApp de un ganado es del 03/09, 23 días) y una pantalla donde
 *  están todos en rojo no tría nada. */
const DIAS_DE_SILENCIO = 30;

/** Los primeros 14 días de un cliente no son silencio: son el arranque. Los dos
 *  clientes de ws13 cerraron el 24 y el 25/09 sin deal, sin cuotas, sin sesiones
 *  y sin WhatsApp — ése es el estado normal del día 1, no un problema. */
const DIAS_DE_ARRANQUE = 14;

/** El orden de la lista. Es la prioridad, y está pensado: primero lo que le debe
 *  ÉL a uno con fecha (la plata), después una persona esperando respuesta, y
 *  recién ahí lo que uno le debe a él. */
const PESO: Record<ReglaSenal, number> = {
  'cuota-vencida': 0,
  'sin-contestar': 1,
  'nunca-hablaron': 2,
  'silencio': 3,
  'tareas-atrasadas': 4,
  'contrato-vencido': 5,
  'recien-cerrado': 6,
  'sin-contrato': 7,
  'sin-datos': 8,
  'al-dia': 9,
};



/**
 * La señal de un cliente. El ORDEN de los `if` es la regla.
 *
 * Todo lo que devuelve `atencion` afirma un hecho con su número. Todo lo que
 * devuelve `null` dice qué falta para poder contestar. `bien` se gana: hace
 * falta haber podido mirar.
 */
export function senalDe(c: HechosCliente): Senal {
  // ── 1. Le debe plata, con fecha ───────────────────────────────────────────
  // Es el único hecho duro y fechado que existe en los tres workspaces. Va
  // primero porque no depende de ningún juicio.
  //
  // ⚠️ Una cuota impaga SIN `fecha_esperada` no entra acá: no se puede declarar
  // vencida (2 de las 3 impagas de ws11 están así). Sale más abajo, y como «no
  // lo sé», que es lo que es.
  if (c.cuotasVencidas > 0) {
    return {
      nivel: 'atencion',
      motivo: c.cuotaVencidaDias !== null
        ? `Cuota vencida hace ${c.cuotaVencidaDias} ${plural(c.cuotaVencidaDias, 'día', 'días')}`
        : `${c.cuotasVencidas} ${plural(c.cuotasVencidas, 'cuota vencida', 'cuotas vencidas')}`,
      regla: 'cuota-vencida',
      dias: c.cuotaVencidaDias,
    };
  }

  // ── 2. Te escribió y nadie contestó ───────────────────────────────────────
  // `from_me` de `wa_mensajes` contesta quién habló último. Es lo más accionable
  // de la pantalla y lo único vivo en el workspace con más clientes después de
  // Mauricio.
  if (c.esperaRespuestaHace !== null && c.esperaRespuestaHace >= DIAS_SIN_CONTESTAR) {
    return {
      nivel: 'atencion',
      motivo: `Te escribió hace ${c.esperaRespuestaHace} ${plural(c.esperaRespuestaHace, 'día', 'días')} y nadie contestó`,
      regla: 'sin-contestar',
      dias: c.esperaRespuestaHace,
    };
  }

  // ── 3. Cerró y nunca hubo una conversación ────────────────────────────────
  // Sólo se puede afirmar si se pudo leer el contacto: sin esa lectura, «no hay
  // conversación» y «no pude mirar» son la misma lista vacía.
  if (c.contactoLeido && c.ultimoContactoHace === null
      && c.diasDesdeElCierre !== null && c.diasDesdeElCierre > DIAS_DE_ARRANQUE) {
    return {
      nivel: 'atencion',
      motivo: `Cerró hace ${c.diasDesdeElCierre} días y no hay una sola conversación`,
      regla: 'nunca-hablaron',
      dias: c.diasDesdeElCierre,
    };
  }

  // ── 4. Se enfrió ──────────────────────────────────────────────────────────
  if (c.ultimoContactoHace !== null && c.ultimoContactoHace >= DIAS_DE_SILENCIO) {
    return {
      nivel: 'atencion',
      motivo: `${c.ultimoContactoHace} días sin hablar`,
      regla: 'silencio',
      dias: c.ultimoContactoHace,
    };
  }

  // ── 5. Le debés trabajo con fecha pasada ──────────────────────────────────
  // `null` es «no pude leer el tablero» y no dispara nada. En ws11 y ws13 no hay
  // un solo proyecto de cliente, así que esta regla simplemente no aplica ahí.
  if (c.tareasAtrasadas !== null && c.tareasAtrasadas > 0) {
    return {
      nivel: 'atencion',
      motivo: `${c.tareasAtrasadas} ${plural(c.tareasAtrasadas, 'tarea pasada', 'tareas pasadas')} de fecha`,
      regla: 'tareas-atrasadas',
      dias: c.tareasAtrasadas,
    };
  }

  // ── 6. Se le terminó el contrato y sigue activo ───────────────────────────
  // No es un fuego: es una decisión pendiente (renovar, graduar o cerrar). Por
  // eso va última de las de atención.
  if (c.contratoTerminado) {
    return { nivel: 'atencion', motivo: 'Se le terminó el contrato', regla: 'contrato-vencido', dias: null };
  }

  // ═══ De acá para abajo no hay nada que reclamar. Falta decidir si eso es
  //     «está bien» o «no tengo con qué saberlo». ═══

  // ── 7. Recién cerrado ─────────────────────────────────────────────────────
  // Sin conversación todavía y dentro de la ventana de arranque. No está bien ni
  // mal: es el día 1.
  if (c.ultimoContactoHace === null && c.diasDesdeElCierre !== null && c.diasDesdeElCierre <= DIAS_DE_ARRANQUE) {
    return {
      nivel: null,
      motivo: `Cerró hace ${c.diasDesdeElCierre} ${plural(c.diasDesdeElCierre, 'día', 'días')}`,
      regla: 'recien-cerrado',
      dias: c.diasDesdeElCierre,
    };
  }

  // ── 8. No se pudo mirar ───────────────────────────────────────────────────
  // Una lectura fallida, o un cliente del que no hay ni fecha de cierre ni una
  // conversación. Cualquiera de las dos hace que «al día» sea una afirmación sin
  // respaldo.
  if (!c.contactoLeido || !c.cobrosLeidos) {
    return { nivel: null, motivo: 'No pude leer cómo va', regla: 'sin-datos', dias: null };
  }
  if (c.ultimoContactoHace === null && c.diasDesdeElCierre === null) {
    return { nivel: null, motivo: 'Sin datos para saber cómo va', regla: 'sin-datos', dias: null };
  }

  // ── 9. Sin contrato cargado ───────────────────────────────────────────────
  // ⚠️ ESTO NO ES «BIEN». Sin saber qué se le vendió, hasta cuándo ni con qué
  // garantía, no hay con qué decir que la entrega va al día. Medido: 6 de 14 en
  // ws1, 1 de 11 en ws11, 2 de 2 en ws13 no tienen deal. Y una cuota impaga sin
  // fecha cae acá por la misma razón.
  if (!c.tieneContrato) {
    return { nivel: null, motivo: 'Sin contrato cargado', regla: 'sin-contrato', dias: null };
  }
  if (c.cuotasImpagasSinFecha > 0) {
    return {
      nivel: null,
      motivo: `${c.cuotasImpagasSinFecha} ${plural(c.cuotasImpagasSinFecha, 'cuota impaga', 'cuotas impagas')} sin fecha`,
      regla: 'sin-contrato',
      dias: c.cuotasImpagasSinFecha,
    };
  }

  // ── 10. Al día ────────────────────────────────────────────────────────────
  return { nivel: 'bien', motivo: 'Al día', regla: 'al-dia', dias: c.ultimoContactoHace };
}

/**
 * El nivel como CLAVE de objeto o valor de un parámetro.
 *
 * ⚠️ `null` no se puede usar como clave ni viajar en un enum, y colapsarlo a
 * `'bien'` sería exactamente la confusión que esta señal existe para evitar. Por
 * eso tiene su propio nombre —`sin-datos`— y vive ACÁ: sin esta función cada
 * consumidor escribe su propio ternario, y el día que uno lo escriba al revés la
 * pantalla va a decir que un cliente sin datos está al día.
 *
 * Sin `server-only` en este módulo, así que la importan igual la pantalla
 * (`'use client'`), el server y la API de MaKo.
 */
export type ClaveNivel = 'atencion' | 'sin-datos' | 'bien';
export const claveNivel = (n: NivelSenal): ClaveNivel => (n === null ? 'sin-datos' : n);

/** Rango del nivel. «No lo sé» va DESPUÉS de lo que pide algo y ANTES de lo que
 *  está bien: es trabajo —cargar el contrato, conectar WhatsApp—, no calma. */
const rango = (s: Senal): number => (s.nivel === 'atencion' ? 0 : s.nivel === null ? 1 : 2);

/**
 * El orden de la cartera. ES la pantalla: contesta «¿cuál necesita atención
 * hoy?», que es la segunda pregunta de la tab. El alfabeto no contesta nada.
 *
 * Dentro de una misma regla manda el número más grande (más días vencida, más
 * días de silencio), y el nombre desempata para que la lista no baile entre dos
 * cargas.
 */
export function ordenCartera(
  a: { senal: Senal; nombre: string },
  b: { senal: Senal; nombre: string },
): number {
  return rango(a.senal) - rango(b.senal)
    || PESO[a.senal.regla] - PESO[b.senal.regla]
    || (b.senal.dias ?? -1) - (a.senal.dias ?? -1)
    || a.nombre.localeCompare(b.nombre);
}

/**
 * Le enchufa a la cartera lo que el TABLERO sabe de cada cliente, recalcula la
 * señal y la vuelve a ordenar.
 *
 * Existe porque el trabajo no se puede leer dentro de `cartera()`: el cruce
 * cliente ↔ proyecto necesita la lista de clientes (app/customer-success/trabajo.ts,
 * `tableroDeLaCartera`), así que son dos pasos. La señal se calcula igual en el
 * primero —con el trabajo en `null`, o sea «no lo sé»— para que un fallo del tablero
 * nunca deje la cartera sin ordenar.
 *
 * Lo llama MaKo (`carteraConTrabajo`, lib/api-mako/areas/cs.run.ts), que es quien lee
 * la cartera. Hasta el 06/10/2026 no lo llamaba nadie fuera de su test.
 *
 * `porLead === null` = el tablero no se pudo leer. No es «no tiene trabajo».
 */
export function conTrabajo<T extends HechosCliente & { leadId: number; nombre: string; senal: Senal }>(
  clientes: T[],
  porLead: Record<number, { abiertas: number; atrasadas: number }> | null,
): T[] {
  return clientes
    .map((c) => {
      const t = porLead ? (porLead[c.leadId] ?? { abiertas: 0, atrasadas: 0 }) : null;
      const hechos = { ...c, tareasAbiertas: t?.abiertas ?? null, tareasAtrasadas: t?.atrasadas ?? null };
      return { ...hechos, senal: senalDe(hechos) };
    })
    .sort(ordenCartera);
}

/** Los umbrales, exportados para el test: un test que los copia a mano mide su
 *  propia copia (AGENTS.md, «una cosa, un lugar»). */
export const UMBRALES = { DIAS_SIN_CONTESTAR, DIAS_DE_SILENCIO, DIAS_DE_ARRANQUE } as const;
