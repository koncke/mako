// =============================================================================
// Familias de cohortes: triggers que se REPARTEN un mismo universo de leads
// =============================================================================
// Una familia son dos o más triggers que parten el MISMO cohorte en mitades que
// tienen que ser excluyentes. Es distinto de dos cohortes cualesquiera: acá el
// riesgo no es que sobre gente, es que el mismo lead entre por las dos puertas
// y reciba dos mensajes que se contradicen.
//
// ⚠️ VIVE EN UN MÓDULO PROPIO, SIN NINGÚN IMPORT DEL SERVIDOR, A PROPÓSITO. Estaba en
// `lib/nutricion.ts`, que arrastra `lib/workspace.ts` y con eso todo el runtime
// de Next: ningún test lo puede importar. Y esto gobierna cuántos mensajes
// recibe una persona real, o sea que es justo lo que no puede quedarse sin red.
// Es el mismo criterio que `exigirClienteDePrueba` y que `lib/model-catalogo.ts`.
// (Desde la undécima tanda importa DOS módulos puros —`lib/pipeline.ts` por el TIPO de una etapa y
// `lib/nutricion-etapa.ts` por sus etapas—: `preparaReunion` decide por la forma del flujo.)

import { PIPELINE_KIND } from './pipeline';
import { etapasDe, TRIGGER_ETAPA } from './nutricion-etapa';

/** Agendó DESPUÉS de recibir tu bienvenida: ya te escuchó. Se retoma la charla. */
export const TRIGGER_AGENDA_CONOCIDO = 'agendado_ya_contactado';
/** Agendó sin haber recibido nada tuyo: este es el primer mensaje. Te presentás. */
export const TRIGGER_AGENDA_NUEVO = 'agendado_primer_contacto';

/**
 * Las dos mitades de la post-agenda.
 *
 * La condición que las separa —«¿ya le hablamos?»— NO es estable: mandarle el
 * audio a un lead de «primer contacto» lo convierte en «ya contactado». Por eso
 * la exclusión no puede ser «cada uno filtra su mitad»: quien está inscripto en
 * CUALQUIERA de las dos queda fuera de las dos, y la decisión se toma una sola
 * vez, al entrar.
 */
export const FAMILIA_POST_AGENDA: readonly string[] = [TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO];

/** A qué mitad de la post-agenda le toca un lead. Puro, y por eso testeable. */
export function mitadPostAgenda(yaLeHablamos: boolean): string {
  return yaLeHablamos ? TRIGGER_AGENDA_CONOCIDO : TRIGGER_AGENDA_NUEVO;
}

/** La post-agenda vieja, de una sola secuencia, antes de partirse en dos (2b6f693e). */
export const TRIGGER_AGENDA_SIN_CONFIRMAR = 'agendado_sin_confirmar';

/**
 * ¿Todo lo que esta secuencia tiene para decir es SOBRE una reunión que todavía no pasó?
 *
 * ⚠️ NO alcanza con mirar `paso.ancla === 'reunion'`, que era lo único que había. Los pasos de
 * la post-agenda NO están anclados: salen 1 h y 24 h después de AGENDARSE, no antes de la
 * reunión. Así que la guarda de «la reunión ya pasó» no los tocaba.
 *
 * Medido en producción el 25/09/2026, y por eso existe esto: los dos únicos leads en cola de
 * todo el sistema eran de Mauricio (2439 y 2400, secuencia 213) con la reunión el 23/09 y el
 * 25/09 a las 20:00 — y su primer audio estaba programado para el 25/09 a las 21:00, o sea
 * DESPUÉS. Con la línea caída 22 días, el reintento diario los fue empujando hasta pasarse de
 * largo. El mensaje que iban a recibir es «te dejo el video para que llegues con contexto».
 *
 * Es la misma regla que ya estaba escrita para el paso anclado —un recordatorio tardío es peor
 * que ninguno—, que acá además llega con la voz del dueño.
 */
export function preparaUnaReunion(triggerTipo: string): boolean {
  return FAMILIA_POST_AGENDA.includes(triggerTipo) || triggerTipo === TRIGGER_AGENDA_SIN_CONFIRMAR;
}

/**
 * ¿Un cambio de la etapa DERIVADA del lead tiene que inscribir AL INSTANTE en las automatizaciones de la etapa
 * nueva? (undécima tanda, M1-b; decisión §9.5: «una reunión cargada a mano en la ficha también inscribe al
 * instante».) Sí cuando la etapa CAMBIÓ y la nueva es de tipo REUNIÓN (Agenda R1, Agenda R2): es una reunión
 * cargada a mano (la ficha, el Kanban «Agendada fuera de Calendly», el CRM automático).
 *
 * ⚠️ SÓLO LA REUNIÓN, NO CUALQUIER ETAPA DERIVADA. Los guardados de varios pasos (el asistente de un movimiento
 * del Kanban guarda la fecha, después la asistencia y recién al final la etapa) pasan por etapas derivadas
 * INTERMEDIAS: con cualquier etapa, marcar «no asistió» camino a «No Show» inscribía en lo de «noshow_r1», que el
 * barrido de la hora nunca alcanza (ahí manda la etapa puesta). Lo demás lo sigue levantando el barrido. Pura.
 */
export function entraAEtapaDeReunion(
  antes: string | null | undefined,
  despues: string | null | undefined,
  kindDeEtapa: (key: string) => string | null | undefined = (key) => PIPELINE_KIND[key] ?? null,
): boolean {
  return !!despues && antes !== despues && kindDeEtapa(despues) === 'reunion';
}

/** Un CRON como lo necesita `preparaReunion`: su trigger y, si es de etapa, su etapa o etapas. */
export type CronQuePrepara = { trigger_tipo: string; etapa?: string | null; etapas?: readonly unknown[] | null };

/** Lo que `preparaReunion` mira de una automatización (una fila, o una vista de `vistasPorDisparador`). */
export type SecuenciaQuePrepara = CronQuePrepara & {
  /** TODOS sus CRON (mig 0241). Ausente o vacía = el de las columnas (`trigger_tipo`, `etapa`, `etapas`). */
  disparadores?: readonly CronQuePrepara[] | null;
  /** Las tarjetas: se busca un DELAY «antes de la reunión» (`nodo: 'esperar'`, `espera.modo: 'antes_reunion'`). */
  pasos?: readonly unknown[] | null;
};

/** ¿Una tarjeta es un DELAY «antes de la reunión»? (Sin importar el modelo: este módulo no importa nada del servidor.) */
const esEsperaAntesDeLaReunion = (p: unknown): boolean => {
  const x = p as { nodo?: unknown; espera?: { modo?: unknown } | null } | null | undefined;
  return !!x && x.nodo === 'esperar' && x.espera?.modo === 'antes_reunion';
};

/**
 * ¿Esta automatización PREPARA UNA REUNIÓN? (undécima tanda, M2: docs/diseno-undecima-tanda.md §1.6 y §4.)
 *
 * Es la pregunta de cuatro cosas del motor: anotar `reunion_at` al inscribir, el REUSO al reagendar (Martín,
 * 06/10/2026: «también con reunión nueva»), «la reunión ya pasó» y el corte de la charla del AI Step después de
 * la reunión. Era `preparaUnaReunion(trigger_tipo)`, o sea la familia `agendado_*` y nada más: con «Un Lead
 * Agendó Llamada» colgado de la ETAPA «Agenda R1» ninguna de las cuatro valía, y una reagenda no volvía a
 * preparar nada.
 *
 * Vale si se cumple ALGUNA, por la FORMA del flujo y no por su nombre:
 *  1. algún CRON es de la familia de antes (`preparaUnaReunion`);
 *  2. algún CRON `etapa_actual` es de una etapa de TIPO reunión (`PIPELINE_KIND`: Agenda R1 y Agenda R2). Por
 *     el tipo y no por tener un DELAY: el «Un Lead Agendó Llamada» del ws13 es sólo el aviso al equipo, y sin
 *     esta regla perdía el reuso (hoy #240 avisa CADA reserva);
 *  3. tiene un DELAY «antes de la reunión».
 *
 * Mira la automatización ENTERA (todos sus CRON), también desde una vista de un CRON: la inscripción es una por
 * (lead, automatización). `kindDeEtapa` es el tipo de una etapa: el de la casa (`PIPELINE_KIND`) salvo que quien
 * llama sepa el de un embudo propio. Pura.
 */
export function preparaReunion(
  sec: SecuenciaQuePrepara,
  kindDeEtapa: (key: string) => string | null | undefined = (key) => PIPELINE_KIND[key] ?? null,
): boolean {
  const crones: readonly CronQuePrepara[] = sec.disparadores?.length ? sec.disparadores : [sec];
  for (const d of [sec, ...crones]) {
    if (preparaUnaReunion(d.trigger_tipo)) return true;
    if (d.trigger_tipo === TRIGGER_ETAPA && etapasDe(d).some((k) => kindDeEtapa(k) === 'reunion')) return true;
  }
  return (sec.pasos ?? []).some(esEsperaAntesDeLaReunion);
}

/**
 * De las secuencias que un evento dispara, las que le corresponden a ESTE lead.
 *
 * Existe porque el enrolamiento por evento no pasa por `leadsDeCohorte`: agarra
 * el lead y lo mete en TODAS las secuencias del evento. Sin este filtro, el que
 * agenda entra a las dos mitades de la post-agenda y recibe los dos audios de
 * apertura — uno presentándose y el otro retomando una charla, con minutos de
 * diferencia y desde el mismo número.
 *
 * ⚠️ ESTÁ ACÁ, PURA, Y NO INLINE EN `enrolarPorEvento`, PORQUE ALLÁ NO SE PUEDE
 * PROBAR. La primera versión de su test era un `assert.match` sobre el fuente
 * de la función, y al romper el filtro a propósito el test **siguió pasando**:
 * la cadena que buscaba aparecía en la línea de al lado. Un test que no falla
 * cuando rompés lo que persigue no mide nada — y éste protege cuántos mensajes
 * recibe una persona real.
 *
 * Lo que NO decide: si el lead ya está inscripto. Eso lo sabe la base y lo
 * resuelve el llamador; acá solo vive la regla.
 */
export function secuenciasParaElLead<T extends { trigger_tipo: string }>(secuencias: T[], yaLeHablamos: boolean): T[] {
  const deLaFamilia = secuencias.filter((s) => FAMILIA_POST_AGENDA.includes(s.trigger_tipo));
  // Con una sola de las dos configurada no hay ambigüedad que resolver, y
  // filtrar sería peor: al lead le tocaría no recibir nada porque justo la
  // mitad que le corresponde no existe todavía.
  if (deLaFamilia.length < 2) return secuencias;
  const quiero = mitadPostAgenda(yaLeHablamos);
  return secuencias.filter((s) => !FAMILIA_POST_AGENDA.includes(s.trigger_tipo) || s.trigger_tipo === quiero);
}

// ── ¿Se puede AFIRMAR en qué etapa está el cohorte? ─────────────────────────

/**
 * Si la glosa del cohorte puede nombrar una etapa, o tiene que abstenerse.
 *
 * ⚠️ EL CONTEXTO DE UNA SECUENCIA NO PUEDE AFIRMAR LO QUE NO SABE. La glosa que va al
 * prompt dice «Lead parado en la etapa "X" del funnel del negocio», y la arma leyendo el
 * funnel POR DEFECTO. Eso era exacto mientras hubiera uno solo. Desde que el opt-in de
 * una landing guarda el `funnel_id` del producto de esa página (04/10/2026) hay
 * workspaces con dos embudos vivos —medido: 4 de 11— y el lead puede estar en el otro:
 *
 * · si la clave de etapa NO existe en el default, el `find` no encuentra y la glosa cae
 *   a la genérica, que es lo correcto y ya pasaba;
 * · si existe CON OTRO RÓTULO, la función afirma una etapa en la que el lead no está —
 *   y se lo afirma al modelo que escribe el mensaje.
 *
 * O sea que la pregunta no es «qué etiqueta pongo» sino «puedo saberlo». Con más de un
 * embudo vivo y una secuencia que no declara el suyo, no se puede: se pierde una frase
 * de contexto y no el mensaje, que es exactamente «"no puedo hacer X con este dato" no
 * es "este dato es falso"».
 *
 * ⚠️ Y LO QUE DESTRABA ESTO NO ES CÓDIGO: es que cada secuencia DECLARE su embudo
 * (`nutricion_secuencias.funnel_id`, mig 0170, hoy NULL en las 62). Eso son 62
 * decisiones de producto que no se deducen de ningún dato — las secuencias se
 * escribieron cuando había un embudo solo— así que las contesta una persona, no un
 * backfill. Mientras tanto esta función se abstiene.
 */
export function puedeAfirmarEtapa(o: { embudosVivos: number; secDeclaraFunnel: boolean }): boolean {
  if (o.secDeclaraFunnel) return true;        // sabe de cuál habla: puede nombrarlo
  return o.embudosVivos <= 1;                 // hay uno solo: el default ES el del lead
}
