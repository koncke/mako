// =============================================================================
// etapa-historial — la etapa SIEMPRE deja rastro, la mueva quien la mueva
// =============================================================================
// Regla del producto (textual del dueño): «no importa si lo hizo el sistema,
// TODO debe quedar en el history».
//
// Hay tres formas de que un lead cambie de columna y solo dos dejaban rastro:
//   1. una persona lo arrastra en el Kanban   → auditado (logLeadChanges)
//   2. el motor automático lo mueve            → escribía el UPDATE, no la línea
//   3. NADIE lo mueve: la etapa es DERIVADA    → no hay escritura que interceptar
//
// El caso 3 es el que rompió la promesa. La etapa que ve el usuario la calcula
// deriveStageKey() al LEER, a partir de las fechas y las asistencias: cuando la
// R1 pasa y asistio_j1 sigue en null, el lead se mueve solo. El lead 1395 llegó
// a "cambiar de estado" tres veces a ojos del dueño con CERO filas de historial.
//
// La pieza que faltaba es memoria: `leads.etapa_vista` (mig 0122) guarda la
// última etapa que el historial YA dio por registrada. Con eso:
//   · comparar es GRATIS — la pasada que ya trae todos los leads a memoria (los
//     "Datos sin marcar" del CRM) compara en RAM, sin una query por lead;
//   · es IDEMPOTENTE por construcción — la columna se actualiza junto con la
//     línea, así que correr la comparación dos veces no escribe dos veces. La
//     idempotencia vive en el dato, no en un flag ni en una ventana de tiempo.
//
// Este módulo es el ÚNICO lugar donde se decide "¿hay que registrar esta etapa?".
// lib/leads.ts lo usa en el camino de escritura (setPipelineStage/logLeadChanges)
// y lib/queries.ts en el camino de lectura (la pasada de los pendientes).
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { pipelineStageOf, MAKO_SETTER, type StageDerivable } from './pipeline';

/**
 * Etiqueta del cambio de etapa en `lead_audit`. Tiene que ser EXACTAMENTE la
 * misma que usa AUDIT_FIELDS en lib/leads.ts: la ficha filtra por este texto
 * para separar el sub-tab "Status" del de "Información" (STATUS_FIELDS en
 * AuditHistory), traduce el valor a su label con stageMeta() y lo usa para
 * calcular el "tiempo en cada etapa". Si acá dijera otra cosa, la línea existiría
 * pero el usuario no la vería en el lugar donde la busca.
 */
export const CAMPO_ETAPA = 'Etapa';

/**
 * Autor de los movimientos que no hizo una persona. Es el mismo 'MaKo' con el
 * que se firma la IA en el resto del repo (MAKO_SETTER), así el chip del
 * historial y el setter de las nutriciones automáticas hablan del mismo actor.
 */
export const AUTOR_SISTEMA = MAKO_SETTER;

/**
 * Lo mínimo que hace falta de un lead para saber en qué etapa lo ve el usuario y
 * cuál fue la última registrada. `etapa_vista` es opcional a propósito: si la
 * migración 0122 todavía no corrió, la columna no viene y el módulo degrada a
 * "nunca registrada" en vez de romper.
 */
export type LeadConEtapa = StageDerivable & { id: number; etapa_vista?: string | null };

/** Valor limpio de la última etapa registrada (null = nunca se registró). */
function etapaVistaDe(l: { etapa_vista?: string | null }): string | null {
  return l.etapa_vista?.trim() || null;
}

/**
 * Decide qué línea de historial corresponde para la etapa de UN lead, sin tocar
 * la base. Devuelve null si no hay nada que registrar.
 *
 * `desdeFallback` es la etapa anterior CALCULADA por el caller (el estado del
 * lead antes de su propia mutación). Solo se usa si el lead nunca fue registrado:
 * `etapa_vista` es más confiable porque es lo que el historial realmente dijo.
 */
export function cambioDeEtapa(
  despues: LeadConEtapa,
  desdeFallback?: string | null,
): { desde: string | null; hacia: string } | null {
  const hacia = pipelineStageOf(despues);
  const desde = etapaVistaDe(despues) ?? desdeFallback ?? null;
  return desde === hacia ? null : { desde, hacia };
}

// PostgREST manda el filtro `in` en la query string: con ~800 ids la URL se
// vuelve impracticable. 200 por trozo deja la URL en el orden de 1 KB.
const TROZO = 200;

/**
 * Fija `etapa_vista` para un lote de leads que van a la MISMA etapa. Un UPDATE
 * por etapa (no por lead), troceado para no armar una URL gigante en PostgREST.
 * @returns true si todos los trozos entraron bien.
 */
export async function marcarEtapaVista(ids: number[], etapa: string): Promise<boolean> {
  if (!ids.length) return true;
  const db = await getTenantDb();
  let ok = true;
  for (let i = 0; i < ids.length; i += TROZO) {
    const { error } = await db.from('leads').update({ etapa_vista: etapa }).in('id', ids.slice(i, i + TROZO));
    if (error) {
      // El error esperable acá es "column etapa_vista does not exist" (falta la
      // migración 0122). Se avisa y se corta: mejor no registrar nada que
      // escribir líneas que se van a repetir en cada carga del CRM.
      console.error(`[etapa-historial] no se pudo fijar etapa_vista (¿falta la migración 0122?): ${error.message}`);
      ok = false;
      break;
    }
  }
  return ok;
}

// Techo de leads que toca UNA pasada. Existe por la PRIMERA: un workspace con
// 812 leads los siembra todos de una y esa carga del CRM paga los ~14 UPDATE de
// golpe. Con el techo se reparte en dos o tres cargas y ninguna se nota; en
// régimen la pasada toca 0 leads, así que el techo nunca entra en juego. Los
// cambios REALES se atienden primero: la línea de historial no espera.
const TOPE_POR_PASADA = 500;

/** ids agrupados por etapa destino: la clave de que sea 1 UPDATE por etapa y no por lead. */
function agruparPorEtapa(items: Array<{ id: number; hacia: string }>): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const it of items) {
    const arr = out.get(it.hacia) ?? [];
    arr.push(it.id);
    out.set(it.hacia, arr);
  }
  return out;
}

export type ResumenEtapas = { registrados: number; lineas: number };

/**
 * Pasada masiva sobre los leads que el sistema YA tiene en memoria: detecta las
 * etapas que cambiaron por derivación y deja la línea que falta.
 *
 * Dos grupos, a propósito:
 *   · SIN etapa_vista (nunca registrado) → solo se fija la columna, SIN línea.
 *     Un lead que hace tres semanas está en No Show no puede recibir hoy una
 *     línea diciendo que recién cambió: eso sería inventar historia vieja. A
 *     partir de acá, su próximo cambio sí queda con su valor anterior real.
 *   · CON etapa_vista distinta → cambio real: línea + columna al día.
 *
 * Costo: 0 queries si no cambió nada. Si cambió, 1 UPDATE por etapa destino
 * (troceado) + 1 INSERT con todas las líneas juntas. Nunca una query por lead.
 */
export async function registrarEtapasDerivadas(
  leads: LeadConEtapa[],
  autor: string = AUTOR_SISTEMA,
): Promise<ResumenEtapas> {
  const vacio: ResumenEtapas = { registrados: 0, lineas: 0 };
  const primeraVez: Array<{ id: number; hacia: string }> = [];
  const cambios: Array<{ id: number; desde: string; hacia: string }> = [];

  for (const l of leads) {
    const hacia = pipelineStageOf(l);
    const vista = etapaVistaDe(l);
    if (vista === hacia) continue;
    if (vista === null) primeraVez.push({ id: l.id, hacia });
    else cambios.push({ id: l.id, desde: vista, hacia });
  }
  if (!primeraVez.length && !cambios.length) return vacio;
  // Los cambios reales primero; la siembra se lleva lo que sobre del presupuesto
  // y lo que quede afuera lo toma la próxima carga (es idempotente).
  const aSembrar = primeraVez.slice(0, Math.max(0, TOPE_POR_PASADA - cambios.length));

  try {
    // Los cambios REALES van primero y en este orden a propósito: se fija la
    // columna ANTES de escribir las líneas. Si algo falla en el medio, el peor
    // caso es perder una línea — nunca duplicarla en cada carga del CRM.
    let lineas = 0;
    const fijados: Array<{ id: number; desde: string; hacia: string }> = [];
    for (const [etapa, ids] of agruparPorEtapa(cambios)) {
      if (await marcarEtapaVista(ids, etapa)) fijados.push(...cambios.filter((c) => c.hacia === etapa));
    }
    if (fijados.length) {
      const { error } = await (await getTenantDb()).from('lead_audit').insert(
        fijados.map((c) => ({ lead_id: c.id, campo: CAMPO_ETAPA, valor_anterior: c.desde, valor_nuevo: c.hacia, autor })),
      );
      if (error) console.error(`[etapa-historial] insert de ${fijados.length} línea(s) falló: ${error.message}`);
      else lineas = fijados.length;
    }

    // Y recién después la siembra silenciosa de los que nunca se registraron.
    let registrados = fijados.length;
    for (const [etapa, ids] of agruparPorEtapa(aSembrar)) {
      if (await marcarEtapaVista(ids, etapa)) registrados += ids.length;
    }
    return { registrados, lineas };
  } catch (e) {
    console.error('[etapa-historial] excepción en la pasada de etapas derivadas:', e);
    return vacio;
  }
}
