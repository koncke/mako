// =============================================================================
// crm-auto-plan — planificador PURO del CRM automático (sin IO, testeable)
// =============================================================================
// Decide QUÉ acciones propondría MaKo para un lead (T1/T2/T3/T6). Sin efectos ni
// server-only: lo consumen el motor (lib/crm-auto.ts) y los tests (tests/*.test.ts).

import type { EstadoLead } from './leads';
import { pipelineStageOf } from './pipeline';

// Umbrales del motor (defaults). Cada workspace puede pisarlos desde su funnel
// (funnels.data.umbrales del funnel default — ver umbralesDelWorkspace en lib/crm-auto.ts).
//  - diasLeadSinAgenda:  a los N días sin agendar, el lead del Instant form pasa a
//                        Nutrición - No Agenda (invitación a agendar; sigue "caliente").
//  - diasSinAgendaFrio:  si NUNCA agendó y ya lleva N días, está FRÍO (capaz ni se
//                        acuerda del servicio) → Nutrición - Reactivación, no No Agenda.
//  - diasReactivacion:   No responde / Perdido enfriado N días → Reactivación.
//  - porEtapa:           el PLAZO declarado por ETAPA del embudo (ver PlazosPorEtapa).
export const AUTO_UMBRALES: AutoUmbrales = { diasLeadSinAgenda: 2, diasSinAgendaFrio: 7, diasReactivacion: 30, horasPostReunion: 3, porEtapa: {} };

/**
 * El PLAZO declarado POR ETAPA, en días. La clave es la `key` de un Stage del pipeline
 * del embudo (`funnels`, lib/funnels.ts) y el valor es cuántos días puede quedarse un
 * lead en esa etapa antes de que el motor lo mueva.
 *
 * ⚠️ TOLERANTE POR DISEÑO, copiando el molde de `umbralesDelWorkspace` (lib/crm-auto.ts):
 * una etapa que no esté declarada —o con un valor inválido— cae al umbral GLOBAL de
 * siempre. Un workspace que no declaró nada tiene que seguir viendo EXACTAMENTE lo que ve
 * hoy, y eso es lo que fija `tests/crm-auto-sla-etapa.test.ts` con su segundo sujeto.
 *
 * ⚠️ Y NO CUELGA DEL OBJETO `Stage`, A PROPÓSITO, aunque sea un dato de una etapa.
 * `applyTemplate` (app/funnel/FunnelEditor.tsx) hace `setPipeline(tpl.pipeline)` y `pk()`
 * reconstruye cada Stage desde DEFAULT_STAGES: un campo colgado del Stage sobrevive por
 * spread accidental y se borra con UN clic en «Aplicar plantilla», sin error y sin log.
 * Es textualmente el aviso que `lib/pipeline.ts` (§ EntradaId) dejó escrito cuando
 * `entradas` pasó a vivir en `funnels.data`. Vive en `funnels.data.umbrales.porEtapa`,
 * que `saveFunnelDe` conserva porque mergea en vez de reemplazar.
 */
export type PlazosPorEtapa = Record<string, number>;

export type AutoUmbrales = {
  diasLeadSinAgenda: number;
  diasSinAgendaFrio: number;
  diasReactivacion: number;
  horasPostReunion: number;
  porEtapa: PlazosPorEtapa;
};

/**
 * Lee `funnels.data.umbrales.porEtapa` y devuelve los plazos válidos + lo que DESCARTÓ,
 * con motivo.
 *
 * Lo descartado se devuelve en vez de tirarse (AGENTS.md: «lo que un saneador DESCARTA
 * queda escrito, con motivo»): sin esa lista, un plazo tipeado sobre una etapa que el
 * embudo no tiene es indistinguible de un plazo que nadie declaró.
 *
 * ⚠️ `etapas` AUSENTE NO DESCARTA NADA. `undefined`/`null` significa «no se pudo leer el
 * embudo», y un chequeo que no puede mirar se abstiene: descartar ahí apagaría todos los
 * plazos del cliente por una falla de lectura. `etapas` presente y sin la clave sí es un
 * hecho sobre el embudo.
 */
export function sanearPlazosPorEtapa(
  v: unknown,
  // Lo único que hace falta del embudo es poder PREGUNTAR si la etapa existe, así que el
  // tipo es eso y no un Set: el motor cachea las etapas como Map (key → rótulo, que el
  // aviso necesita) y un ReadonlySet lo obligaría a armar una segunda estructura con
  // la misma información — el segundo lugar donde vive el mismo dato.
  etapas?: { has: (k: string) => boolean } | null,
): { plazos: PlazosPorEtapa; descartes: string[] } {
  const plazos: PlazosPorEtapa = {};
  const descartes: string[] = [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { plazos, descartes };
  for (const [etapa, crudo] of Object.entries(v as Record<string, unknown>)) {
    const dias = typeof crudo === 'number' ? crudo : Number(crudo);
    if (!Number.isFinite(dias) || dias <= 0) {
      descartes.push(`${etapa}: plazo inválido (${JSON.stringify(crudo)})`);
      continue;
    }
    if (etapas && !etapas.has(etapa)) {
      descartes.push(`${etapa}: el embudo de este workspace no tiene esa etapa`);
      continue;
    }
    plazos[etapa] = Math.floor(dias);
  }
  return { plazos, descartes };
}

/** El plazo de ESA etapa, o el umbral global de siempre si no lo declaró nadie. */
export function plazoDeEtapa(
  etapa: string | null | undefined,
  plazos: PlazosPorEtapa | null | undefined,
  global: number,
): number {
  if (!etapa || !plazos) return global;
  const d = plazos[etapa];
  return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : global;
}

export type AutoReglaId = 'T1' | 'T2' | 'T3' | 'T6';

export type AutoAccion = {
  regla: AutoReglaId;
  tipo: 'reunion_check' | 'lead_a_nutri' | 'manual_vencida' | 'reactivacion';
  leadId: number;
  lead: string;                       // nombre legible
  descripcion: string;                // qué haría MaKo (para el dry-run y el historial)
  confirmar: boolean;                 // true = pide confirmación al entrar al CRM
  which?: 'j1' | 'j2';                // T1: qué reunión revisar
  resolver?: 'fathom' | 'chat';       // trabajo async que hace el commit (fase 2)
  move?: { to: string };              // destino directo (T2 / T6)
  /**
   * La etapa en la que el lead estaba QUIETO. La escriben T2 y T6 —las dos reglas que
   * miran un plazo por etapa— y la lee `resumenEstancados`, que es lo que se le manda al
   * dueño: sin ella el aviso sabría CUÁNTOS leads movió y no de qué columna salieron, que
   * es la única parte accionable.
   */
  desde?: string;
  /** El plazo (en días) que disparó la regla: el de la etapa si lo declaró, o el global. */
  plazoDias?: number;
};

// Subconjunto del lead que necesita el planificador (barato de traer).
export type AutoLead = {
  id: number;
  nombre: string | null;
  estado_lead: EstadoLead;
  pipeline_stage: string | null;
  fecha_agenda: string | null;
  fecha_junta_1: string | null;
  fecha_junta_2: string | null;
  junta_1_at: string | null;
  junta_2_at: string | null;
  asistio_j1: boolean | null;
  asistio_j2: boolean | null;
  nutricion_realizada?: boolean;
  nutricion_manual_deadline: string | null;
  created_at: string;
  updated_at: string | null;
};

/**
 * Cómo llamó el DUEÑO a sus dos reuniones: el rótulo de las etapas `kind: 'reunion'` de
 * su embudo, en orden (`j1` = la primera, `j2` = la segunda — el mismo índice que
 * `reunionesDe` + `slotPorIndice` de lib/funnel-etapas.ts le asignan a
 * `fecha_junta_1/asistio_j1` y `fecha_junta_2/asistio_j2`).
 *
 * Existe porque el motor escribía «R1»/«R2» a mano en el texto que lee el dueño (la
 * descripción, el historial, la confirmación), y un negocio que vende con UNA
 * «1ª sesión sin costo» no tiene ninguna «R1»: es el nombre interno de una columna
 * nuestra, y un texto que necesita glosario está en otro idioma (AGENTS.md).
 *
 * ⚠️ ES SÓLO TEXTO. Lo que identifica a la reunión sigue siendo `which` ('j1'/'j2'):
 * de ahí cuelgan la clave anti-loop `T1:j1`/`T1:j2` de mako_confirmaciones, las
 * columnas `asistio_j1/_j2` y las etapas `noshow_r1/_r2`. Un rótulo NO decide nada:
 * si se lo usara como clave, renombrar la etapa re-propondría todas las T1 ya
 * resueltas.
 */
export type RotulosReunion = { j1?: string; j2?: string };

/**
 * El nombre de la reunión `which` como lo escribió el dueño, o «R1»/«R2» si su embudo
 * no la nombra (rótulo ausente, vacío, o un embudo con una sola reunión que no tiene
 * `j2`). El fallback es el texto de siempre, así que sin rótulos el resultado es
 * IDÉNTICO al de antes de que existieran.
 */
export function rotuloReunion(which: 'j1' | 'j2', rotulos?: RotulosReunion | null): string {
  const r = rotulos?.[which]?.trim();
  return r || (which === 'j1' ? 'R1' : 'R2');
}

/** Días enteros entre una fecha/ISO pasada y hoy (0 si falta la fecha). */
function diasEntre(hoyISO: string, isoAntes: string | null): number {
  if (!isoAntes) return 0;
  const [ay, am, ad] = isoAntes.slice(0, 10).split('-').map(Number);
  const [hy, hm, hd] = hoyISO.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(hy, hm - 1, hd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * Reglas del CRM automático para UN lead (puro, sin efectos). Devuelve las
 * acciones que MaKo propondría hoy. El cron las muestra (dry-run) o las aplica.
 *
 * T1 dispara a las N horas EXACTAS después de la reunión cuando hay junta_*_at
 * (hora del webhook de Calendly); para leads viejos sin hora, cuando el día ya pasó.
 *
 * ⚠️ EL PLAZO POR ETAPA LO MIRAN T2 Y T6, NO LAS CUATRO — y eso es una decisión, no una
 * mitad sin hacer:
 *   · T1 no mide cuánto lleva el lead en una columna: mide horas desde una reunión que ya
 *     tiene fecha y hora. Un plazo en DÍAS de la etapa no contesta esa pregunta.
 *   · T3 cuelga de `nutricion_manual_deadline`, una fecha que una PERSONA escribió para
 *     ESE lead. Un plazo de etapa encima sería el código contradiciendo una decisión, que
 *     es el modo de falla que esta casa ya pagó.
 *
 * `rotulos` es cómo se llaman las reuniones en el embudo del dueño (ver RotulosReunion):
 * SOLO cambia las palabras de la descripción de T1. Sin él —o con un rótulo vacío— cae a
 * «R1»/«R2» y el resultado es idéntico al de siempre.
 */
export function planLeadAuto(
  l: AutoLead,
  hoyISO: string,
  nowMs: number = Date.now(),
  umbrales: AutoUmbrales = AUTO_UMBRALES,
  rotulos?: RotulosReunion | null,
): AutoAccion[] {
  const out: AutoAccion[] = [];
  const nombre = l.nombre?.trim() || `Lead ${l.id}`;
  const hoy = hoyISO.slice(0, 10);
  const stage = pipelineStageOf(l);

  // ¿La reunión ya pasó lo suficiente para revisar Fathom? Con hora exacta
  // (junta_*_at) dispara a las N horas EXACTAS después; sin ella (leads viejos),
  // cuando el día de la reunión ya pasó.
  const reunionPasada = (fechaAt: string | null, fecha: string | null): boolean =>
    fechaAt ? nowMs >= Date.parse(fechaAt) + umbrales.horasPostReunion * 3600000
            : !!fecha && fecha.slice(0, 10) < hoy;

  if (l.estado_lead === 'abierto') {
    // T1 — reunión pasada sin asistencia marcada → revisar Fathom.
    // El NOMBRE de la reunión sale del embudo del dueño (`rotulos`); `which` sigue siendo
    // 'j1'/'j2' porque es la llave de todo lo demás (ver RotulosReunion).
    const r1 = l.fecha_junta_1 ?? l.fecha_agenda;
    if (l.asistio_j1 == null && reunionPasada(l.junta_1_at, r1)) {
      const reunion = rotuloReunion('j1', rotulos);
      out.push({
        regla: 'T1', tipo: 'reunion_check', leadId: l.id, lead: nombre, which: 'j1', resolver: 'fathom', confirmar: true,
        descripcion: `${reunion} del ${r1?.slice(0, 10) ?? l.junta_1_at?.slice(0, 10) ?? 'la fecha agendada'} sin marcar → buscar grabación en Fathom: si aparece asistió (marca todo), si no No Show ${reunion}`,
      });
    } else if (l.asistio_j1 === true && l.fecha_junta_2 && l.asistio_j2 == null && reunionPasada(l.junta_2_at, l.fecha_junta_2)) {
      const reunion = rotuloReunion('j2', rotulos);
      out.push({
        regla: 'T1', tipo: 'reunion_check', leadId: l.id, lead: nombre, which: 'j2', resolver: 'fathom', confirmar: true,
        descripcion: `${reunion} del ${l.fecha_junta_2.slice(0, 10)} sin marcar → buscar grabación en Fathom: si aparece asistió → Facturando, si no No Show ${reunion}`,
      });
    }

    // T2 — Lead que no agendó. Reciente → Nutrición No Agenda (invitar a agendar);
    // frío (hace mucho, capaz ni se acuerda del servicio) → Nutrición - Reactivación
    // (re-introducir). Cubre el Instant form (stage 'lead') y también a los que YA
    // están en No Agenda hace mucho sin haber agendado nunca (los reclasifica).
    if ((stage === 'lead' || stage === 'nutri') && !l.fecha_agenda && !l.fecha_junta_1 && !l.fecha_junta_2) {
      const d = diasEntre(hoy, l.created_at);
      // El plazo DECLARADO de la etapa es el PISO de cualquier salida: nada se mueve de
      // acá antes de que se cumpla. No pisa al umbral de frío, lo empuja — si no, declarar
      // «dale 10 días a Lead entrante» seguiría mandando el lead a Reactivación a los 7, o
      // sea que el plazo declarado sería una promesa que el motor no cumple.
      //
      // Sin plazo declarado los dos cortes quedan donde están hoy: con los defaults,
      // Math.max(2, 7) = 7 para el frío y 2 para No Agenda.
      const plazoEtapa = plazoDeEtapa(stage, umbrales.porEtapa, umbrales.diasLeadSinAgenda);
      const corteFrio = Math.max(plazoEtapa, umbrales.diasSinAgendaFrio);
      if (d >= corteFrio) {
        out.push({
          regla: 'T2', tipo: 'lead_a_nutri', leadId: l.id, lead: nombre, confirmar: false, move: { to: 'reactivacion' },
          desde: stage, plazoDias: corteFrio,
          descripcion: `Lead sin agendar hace ${d} días (frío) → Nutrición - Reactivación`,
        });
      } else if (stage === 'lead' && d >= plazoEtapa) {
        out.push({
          regla: 'T2', tipo: 'lead_a_nutri', leadId: l.id, lead: nombre, confirmar: false, move: { to: 'nutri' },
          desde: stage, plazoDias: plazoEtapa,
          descripcion: `${d} días en Instant form sin agendar → Nutrición - No Agenda`,
        });
      }
    }

    // T3 — Nutrición manual vencida → revisar WhatsApp para decidir el desenlace.
    if (l.pipeline_stage === 'manual' && l.nutricion_manual_deadline && l.nutricion_manual_deadline.slice(0, 10) < hoy) {
      out.push({
        regla: 'T3', tipo: 'manual_vencida', leadId: l.id, lead: nombre, resolver: 'chat', confirmar: true,
        descripcion: `Nutrición manual vencida el ${l.nutricion_manual_deadline.slice(0, 10)} → revisar chat: con mensajes = No responde/Perdido, sin mensajes = Datos sin marcar`,
      });
    }
  }

  // T6 — Reactivación de fríos (No responde / Perdido) tras un tiempo enfriados.
  if ((l.estado_lead === 'no_responde' || l.estado_lead === 'perdido') && l.pipeline_stage !== 'reactivacion') {
    const d = diasEntre(hoy, l.updated_at ?? l.created_at);
    // Acá el plazo por etapa cae redondo: `updated_at` es cuándo entró a la etapa, así que
    // «N días quieto en No responde» es literalmente el plazo de esa columna.
    const plazo = plazoDeEtapa(stage, umbrales.porEtapa, umbrales.diasReactivacion);
    if (d >= plazo) {
      const et = l.estado_lead === 'no_responde' ? 'No responde' : 'Perdido';
      out.push({
        regla: 'T6', tipo: 'reactivacion', leadId: l.id, lead: nombre, confirmar: true, move: { to: 'reactivacion' },
        desde: stage, plazoDias: plazo,
        descripcion: `${et} hace ${d} días → Nutrición - Reactivación (re-contacto)`,
      });
    }
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// El AVISO — un mensaje por corrida, no uno por lead
// ─────────────────────────────────────────────────────────────────────────────
// El motor movía y nadie se enteraba. Y la salida fácil —emitir adentro del loop— con 30
// leads movidos son 30 WhatsApps: es la misma forma de «una acción en LOTE necesita UN
// deshacer, no N» (AGENTS.md), así que el texto se arma UNA vez con todo lo aplicado.
//
// VIVE ACÁ, PURO Y SIN `server-only`: es el único lugar donde un test puede comprobar que
// el mensaje no afirma más de lo que se midió.

export type EstancadoAplicado = {
  regla: AutoReglaId;
  /** La etapa de la que salió (`AutoAccion.desde`). Sin ella, el lead no entra al resumen. */
  desde?: string;
  /** El plazo que lo disparó, en días. */
  plazoDias?: number;
};

/**
 * El texto del aviso de leads estancados, o null si no hay nada que contar.
 *
 * Reglas que cumple, y las tres salieron de pisarlas antes en este repo:
 *
 * 1. **Sólo cuenta lo que se APLICÓ.** Un mensaje que se manda solo no puede afirmar lo
 *    que no verificó, así que el caller le pasa las acciones que de verdad movieron un
 *    lead — nunca las planificadas ni las salteadas.
 * 2. **Nombra la etapa como la ve el dueño, no por su key.** `etiqueta` sale de los
 *    Stages del embudo: «st0» o «noresp» no le dicen nada a nadie, y un título que
 *    necesita glosario está en otro idioma.
 * 3. **No promete nada que no pueda cumplir.** Dice dónde quedó el motivo (el historial
 *    del lead, que `logRegla` escribe siempre) y nada más.
 */
export function resumenEstancados(
  aplicadas: EstancadoAplicado[],
  etiqueta: (etapa: string) => string = (e) => e,
): string | null {
  const porEtapa = new Map<string, { n: number; plazo: number }>();
  for (const a of aplicadas) {
    if (!a.desde) continue;   // sin etapa de origen no se puede decir de dónde salió
    const prev = porEtapa.get(a.desde);
    porEtapa.set(a.desde, { n: (prev?.n ?? 0) + 1, plazo: a.plazoDias ?? prev?.plazo ?? 0 });
  }
  const total = [...porEtapa.values()].reduce((s, x) => s + x.n, 0);
  if (!total) return null;
  const partes = [...porEtapa.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([etapa, x]) => `${x.n} de *${etiqueta(etapa)}*${x.plazo ? ` (plazo ${x.plazo} ${x.plazo === 1 ? 'día' : 'días'})` : ''}`);
  const quedaron = total === 1 ? 'quedó' : 'quedaron';
  const lead = total === 1 ? 'lead' : 'leads';
  return `⏳ Moví *${total} ${lead}* que ${quedaron} más tiempo del que marca tu embudo: ${partes.join(' y ')}. El motivo quedó en el historial de cada uno. — MaKo`;
}
