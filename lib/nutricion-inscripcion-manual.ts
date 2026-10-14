// =============================================================================
// nutricion-inscripcion-manual — meter a UN lead en UNA secuencia elegida a mano
// =============================================================================
// Hasta el 08/10/2026 un lead entraba a una secuencia de nutrición de dos maneras: por su
// COHORTE (el cron, `comprometerInscripciones`) o por un EVENTO (`enrolarPorEvento`: el lead
// nuevo, la agenda, la etapa, la entrega). No había forma de decir «metelo en ESTA
// secuencia», y es justo lo que pide un paso «⚡ Acción» de un flujo (decisión de Martín del
// 08/10: un flujo «que pueda hacer todo, sin limitaciones») y lo que pide el dueño por
// WhatsApp. La lectura y la escritura viven en `inscribirEnSecuencia` (lib/nutricion.ts);
// acá vive la DECISIÓN, pura.
//
// ⚠️ SIN `server-only`, A PROPÓSITO: decide si se le escribe a una persona real, así que no
// puede quedarse sin test (tests/nutricion-inscripcion-manual.test.ts). Es el criterio de
// lib/nutricion-familias.ts y lib/nutricion-reinscripcion.ts.
//
// Las reglas, en el orden en que cortan:
//
//  1. LA SECUENCIA TIENE QUE PODER MANDAR. Archivada o pausada no: el motor (procesarEnvios)
//     lee sólo las secuencias activas y CIERRA como completada, sin mandar nada, la
//     inscripción vencida de una que no lo está. Inscribir ahí es afirmar algo que el motor
//     va a deshacer en silencio en la próxima corrida. Sin pasos, tampoco: se cierra igual.
//  2. NO SE DUPLICA. Una inscripción en curso (activa, pendiente, pausada) se dice y no se
//     toca: el unique (lead_id, secuencia_id) no deja otra, y reiniciar una en curso le
//     cortaría la secuencia por la mitad.
//  3. LO TERMINADO SE PUEDE VOLVER A ARRANCAR, Y SÓLO ESO. «Ya la terminó» (completada o sin
//     respuesta: `ESTADOS_TERMINADOS`, la misma lista que el reuso #789) vuelve a correr desde
//     el primer paso, repitiendo los mensajes: es una orden explícita de una persona, que
//     confirmó al configurar el paso o con el «sí». Lo demás NO, y no es un tope: es la misma
//     regla de la reinscripción —una cancelada puede ser una baja o «no tiene email», y
//     reabrirla es escribirle a quien pidió que no; con `respondio` el lead está hablando, y
//     con `handoff` la charla la sigue una persona—. Un estado que no está en ninguna lista
//     no se toca (en POSITIVO: sólo se reabre lo que se sabe terminado).
//  4. LO QUE EL MOTOR CERRARÍA AL MANDAR, SE DICE ANTES. Tres guardas del motor se vuelven a
//     mirar en cada envío y cierran la inscripción sin mandar: el tope de antigüedad de la
//     estrategia (paso 1), la reunión que ya pasó (secuencias que preparan una reunión o con
//     el primer paso anclado a ella) y el residuo que ya no está sin cerrar. Inscribir sobre
//     cualquiera de las tres es una inscripción que nace muerta, así que se contesta el motivo.
//  5. LA POST-AGENDA SON DOS MITADES EXCLUYENTES. Con la otra mitad EN CURSO, entrar a ésta le
//     manda los dos audios de apertura —uno presentándose y otro retomando la charla—, que es
//     el duplicado que partir la secuencia vino a evitar (lib/nutricion-familias.ts). Con la
//     otra mitad ya terminada, no: ahí es una decisión del dueño.
//  6. DESDE UN FLUJO NO SE REINICIA NADA (`desdeFlujo`, revisión del 08/10/2026). La regla 3 es
//     para una ORDEN de una persona; un «Ir a otra automatización» corre solo, en cada lead que
//     llega a esa tarjeta. Con la regla 3, el «Sigue con» convertido (#198 → #212) le reenviaba
//     la secuencia ENTERA a quien ya la había terminado —quizás para la misma reunión—, y uno que
//     apuntara a sí misma era un bucle. Es lo que hacía `encadenar` (lib/nutricion-desenlace.ts):
//     cualquier fila previa es «ya estuvo», y si el trabajo de la otra YA está hecho
//     (`hitoYaHecho`), tampoco.
// =============================================================================

import { ESTADOS_TERMINADOS } from './nutricion-reinscripcion';

/** Lo que la decisión necesita de la secuencia. */
export type SecuenciaParaInscribir = { activa: boolean; archivada: boolean; pasos: number };

/** La inscripción que el lead YA tiene en esa secuencia (el unique deja una sola), o null. */
export type PreviaParaInscribir = { estado: string; desenlace: string | null } | null;

/** Lo que el motor vuelve a mirar al mandar, resuelto contra la base por quien llama. */
export type CondicionesDelMotor = {
  /** El tope de antigüedad de la secuencia lo deja entrar (`aTiempo`, la misma puerta del motor). */
  aTiempo: boolean;
  /** Prepara una reunión (o su primer paso se ancla a ella) y el lead no tiene ninguna futura. */
  sinReunion: boolean;
  /** Es la secuencia del residuo y el lead ya no está sin cerrar. */
  fueraDelResiduo: boolean;
  /** Tiene EN CURSO la otra mitad de la post-agenda. */
  enLaOtraMitad: boolean;
};

export type PorQueNoInscribe =
  | 'archivada' | 'pausada' | 'sin_pasos'
  | 'en_curso' | 'cancelada' | 'respondio' | 'handoff' | 'estado_desconocido'
  | 'ya_estuvo' | 'objetivo_hecho'
  | 'fuera_de_antiguedad' | 'sin_reunion' | 'fuera_del_residuo' | 'otra_mitad_post_agenda';

export type VeredictoInscripcion =
  | { inscribe: true; como: 'nueva' | 'reinicio' }
  | { inscribe: false; porque: PorQueNoInscribe };

/** Estados de una inscripción que sigue CORRIENDO: no se duplica ni se reinicia. */
export const ESTADOS_EN_CURSO: readonly string[] = ['activa', 'pendiente', 'pausada'];

export function decidirInscripcionManual(p: {
  secuencia: SecuenciaParaInscribir;
  previa: PreviaParaInscribir;
  motor: CondicionesDelMotor;
  /** Lo pide un «Ir a otra automatización» de un flujo, no una persona (regla 6). */
  desdeFlujo?: boolean;
  /**
   * La «Reentrada» del destino lo deja volver a entrar (`puedeReentrar`, lib/reentrada.ts; 14/10/2026). Sin ella, un
   * flujo nunca vuelve a meter a quien ya estuvo (`ya_estuvo`): era la regla escondida de antes, para todos igual.
   */
  reentraDesdeFlujo?: boolean;
  /** `hitoYaHecho(objetivo de la secuencia, lead) === true`. Sólo cuenta desde un flujo. */
  objetivoHecho?: boolean;
}): VeredictoInscripcion {
  const { secuencia, previa, motor } = p;
  if (secuencia.archivada) return { inscribe: false, porque: 'archivada' };
  if (!secuencia.activa) return { inscribe: false, porque: 'pausada' };
  if (secuencia.pasos <= 0) return { inscribe: false, porque: 'sin_pasos' };

  if (previa) {
    if (ESTADOS_EN_CURSO.includes(previa.estado)) return { inscribe: false, porque: 'en_curso' };
    if (previa.estado === 'cancelada' || previa.desenlace === 'cancelado') return { inscribe: false, porque: 'cancelada' };
    if (previa.estado === 'respondio') return { inscribe: false, porque: 'respondio' };
    if (previa.estado === 'handoff') return { inscribe: false, porque: 'handoff' };
    if (!ESTADOS_TERMINADOS.includes(previa.estado)) return { inscribe: false, porque: 'estado_desconocido' };
    // Terminada: una persona la puede volver a arrancar; un flujo, no (regla 6).
    if (p.desdeFlujo && !p.reentraDesdeFlujo) return { inscribe: false, porque: 'ya_estuvo' };
  }
  if (p.desdeFlujo && p.objetivoHecho) return { inscribe: false, porque: 'objetivo_hecho' };

  if (!motor.aTiempo) return { inscribe: false, porque: 'fuera_de_antiguedad' };
  if (motor.sinReunion) return { inscribe: false, porque: 'sin_reunion' };
  if (motor.fueraDelResiduo) return { inscribe: false, porque: 'fuera_del_residuo' };
  if (motor.enLaOtraMitad) return { inscribe: false, porque: 'otra_mitad_post_agenda' };

  return { inscribe: true, como: previa ? 'reinicio' : 'nueva' };
}

/**
 * Lo que contesta `inscribirEnSecuencia` además de las reglas: un id que no es de ESTE negocio
 * (la secuencia o el lead: se leen con `getTenantDb`, así que el de otro negocio no existe acá),
 * o la fila que otra corrida movió entre la lectura y la escritura.
 */
export type PorQueNoSeInscribio = PorQueNoInscribe | 'secuencia_no_existe' | 'lead_no_existe' | 'carrera'
  /** El recordatorio de la reunión o un evento de MaKo: los manda su emisor, no el motor (11/10/2026). */
  | 'del_emisor';

/**
 * El motivo, en una frase que lee la persona (y el modelo). Un Record y no un switch: un
 * motivo nuevo sin su frase no compila.
 */
const MOTIVOS: Record<PorQueNoSeInscribio, (s: string, lead: string, ids: { secuenciaId: number; leadId: number }) => string> = {
  secuencia_no_existe: (_s, _l, ids) => `No existe la secuencia #${ids.secuenciaId} en este negocio. Pide el id con listar_secuencias_nutricion.`,
  lead_no_existe: (_s, _l, ids) => `No existe el lead #${ids.leadId} en este negocio. Búscalo con buscar_leads.`,
  carrera: (s, lead) => `La inscripción de ${lead} en «${s}» cambió mientras tanto: no se tocó nada. Revisa inscripciones_lead.`,
  del_emisor: (s) => `«${s}» no se inscribe: sale sola cuando pasa su evento (la reunión, la respuesta, la cuota), no por lead.`,
  archivada: (s) => `La secuencia «${s}» está archivada: hay que desarchivarla (desarchivar_secuencia) y activarla antes.`,
  pausada: (s) => `La secuencia «${s}» está pausada, y el motor cierra sin mandar lo que le toca a una secuencia pausada. Actívala antes (proponer_toggle_nutricion).`,
  sin_pasos: (s) => `La secuencia «${s}» no tiene pasos: no hay nada que mandar.`,
  en_curso: (s, lead) => `${lead} ya está en «${s}» y la secuencia sigue en curso: no se inscribe dos veces.`,
  cancelada: (s, lead) => `La inscripción de ${lead} en «${s}» se canceló (puede ser una baja, o que le falta el email o el teléfono): no se vuelve a abrir.`,
  respondio: (s, lead) => `${lead} contestó en «${s}» y la charla puede seguir abierta: no se reinicia mientras habla.`,
  handoff: (s, lead) => `La charla de ${lead} en «${s}» la sigue una persona: no se reinicia.`,
  estado_desconocido: (s, lead) => `La inscripción de ${lead} en «${s}» está en un estado que no se puede reabrir.`,
  ya_estuvo: (s, lead) => `${lead} ya pasó por «${s}»: desde una automatización no se le repite.`,
  objetivo_hecho: (s, lead) => `${lead} ya hizo lo que busca «${s}»: no se le manda.`,
  fuera_de_antiguedad: (s, lead) => `«${s}» sólo le escribe a leads recién llegados (el tope de antigüedad de su estrategia) y ${lead} llegó antes: el motor cerraría la inscripción sin mandar nada.`,
  sin_reunion: (s, lead) => `«${s}» prepara una reunión y ${lead} no tiene ninguna futura: el motor cerraría la inscripción sin mandar nada.`,
  fuera_del_residuo: (s, lead) => `«${s}» es para leads que quedaron sin cerrar y ${lead} ya no lo está (pagó, agendó u otra secuencia le habla): el motor la cerraría sin mandar nada.`,
  otra_mitad_post_agenda: (s, lead) => `${lead} está recibiendo la otra mitad de la post-agenda: entrar a «${s}» le mandaría los dos audios de apertura.`,
};

/** `secuencia` y `lead` son los nombres, si se pudieron leer; sin ellos, el id. */
export function motivoNoInscribe(porque: PorQueNoSeInscribio, p: { secuenciaId: number; secuencia?: string | null; leadId: number; lead?: string | null }): string {
  const s = p.secuencia?.trim() || `#${p.secuenciaId}`;
  const lead = p.lead?.trim() || `el lead #${p.leadId}`;
  return MOTIVOS[porque](s, lead, { secuenciaId: p.secuenciaId, leadId: p.leadId });
}
