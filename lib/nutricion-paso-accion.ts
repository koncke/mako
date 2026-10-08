// =============================================================================
// nutricion-paso-accion — el paso «⚡ Acción de MaKo» de una secuencia del chatbot
// =============================================================================
// Decisión de Martín (08/10/2026), textual: un paso de un flujo «que pueda hacer todo,
// sin limitaciones». El dueño confirma la acción al CONFIGURAR el paso; cuando la
// secuencia llega ahí, la acción se EJECUTA, sin pedir un «sí» (lib/api-mako/flujo.ts).
//
// ── LA FORMA: un sub-objeto `accion`, NO un `tipo` más ─────────────────────────
// `tipo` ('texto' | 'audio' | 'ia') dice qué CLASE DE MENSAJE manda un paso, y la mitad
// del repo lo lee así: `textoDelPaso`, `proveedorDelPaso`, el saneo, los wizards. Un
// `tipo: 'accion'` caería en la rama de texto de todos los que no lo conocen. Un paso de
// acción no es un mensaje: es OTRA cosa que ocurre (AGENTS.md, «Un TIPO DE NODO nuevo son
// CINCO puertas»), y lo dice la PRESENCIA de `accion`. Ausente = mensaje, como siempre:
// cero migración, y los pasos que ya están siguen válidos sin tocar uno. La forma es
// la misma `{ operacion, params }` que produce el editor compartido
// (app/_components/EditorAccionMako.tsx), así que viaja tal cual del panel a la fila.
//
// SIN `server-only`, a propósito: lo importan el motor (lib/nutricion.ts), el saneo
// (`setSecuenciaPasos`), el grafo (lib/flujo-conversacion.ts), el lienzo ('use client') y
// los tests. No importa NADA: un módulo que cruza la frontera de `'use client'` no puede
// arrastrar el registro de la API.
// =============================================================================

/** Lo que guarda un paso que corre una acción: qué operación del registro y con qué datos. */
export type AccionDelPaso = { operacion: string; params?: Record<string, unknown> };

/**
 * ¿Este paso corre una acción en vez de mandar un mensaje?
 *
 * Lo decide la PRESENCIA del objeto, no que la operación esté elegida: un paso recién
 * agregado (operación vacía) ya es una acción —se dibuja como tal y se edita con su
 * panel— y no un mensaje vacío. Que la operación falte se frena al GUARDAR (`sanearAccion`).
 */
export function esPasoAccion(p: { accion?: unknown } | null | undefined): boolean {
  const a = p?.accion;
  return a != null && typeof a === 'object' && !Array.isArray(a);
}

/** Los ids del registro son snake_case (`mover_lead_etapa`). Cualquier otra cosa no es una operación. */
const RX_OPERACION = /^[a-z][a-z0-9_]{1,79}$/;
/**
 * Techo de los datos de un paso, serializados. Los parámetros de una acción son unos
 * pocos campos; esto sólo frena un pegado accidental que haría crecer el jsonb de la
 * secuencia —que se relee entero en cada corrida del cron— sin que nadie lo vea.
 */
const TOPE_PARAMS = 20_000;

export type AccionSaneada = { ok: true; accion: AccionDelPaso } | { ok: false; motivo: string };

/**
 * Lo que se guarda de la acción de un paso, o por qué no se puede guardar.
 * `null` = el paso no es una acción (es un mensaje, y el saneo sigue como siempre).
 *
 * ⚠️ NO DESCARTA EN SILENCIO. Una acción sin elegir o con datos que no se pueden guardar
 * es una combinación IMPOSIBLE, y eso es una validación al guardar (AGENTS.md): sin esta
 * puerta, el dueño se entera en el log de un cron. Quien llama la convierte en un error
 * que la pantalla muestra.
 */
export function sanearAccion(crudo: unknown): AccionSaneada | null {
  if (crudo == null || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const c = crudo as { operacion?: unknown; params?: unknown };
  const operacion = typeof c.operacion === 'string' ? c.operacion.trim() : '';
  if (!RX_OPERACION.test(operacion)) return { ok: false, motivo: 'es una acción sin elegir' };
  if (c.params == null) return { ok: true, accion: { operacion } };
  if (typeof c.params !== 'object' || Array.isArray(c.params)) return { ok: false, motivo: 'tiene datos que no se pueden guardar' };
  let json: string;
  try { json = JSON.stringify(c.params); } catch { return { ok: false, motivo: 'tiene datos que no se pueden guardar' }; }
  if (json.length > TOPE_PARAMS) return { ok: false, motivo: 'tiene datos demasiado largos' };
  // Por JSON y de vuelta: lo que se guarda es exactamente lo que el jsonb va a devolver
  // (sin `undefined`, sin funciones, sin fechas como objeto).
  const params = JSON.parse(json) as Record<string, unknown>;
  return Object.keys(params).length ? { ok: true, accion: { operacion, params } } : { ok: true, accion: { operacion } };
}

/**
 * El ORIGEN que queda en la fila que deja la acción (la pendiente o la propuesta): qué
 * secuencia y qué paso la corrió. Es el rastro de «qué hizo esta automatización y cuándo»,
 * y es lo que pide `ejecutarDesdeFlujo`.
 */
export const origenDelPaso = (secuenciaId: number, orden: number): string => `secuencia:${secuenciaId}:paso:${orden}`;

/** Lo que devuelve `ejecutarDesdeFlujo` (lib/api-mako/flujo.ts), escrito estructural: este módulo no lo importa. */
export type ResultadoEjecucion = { ok: boolean; resumen: string; via?: string };

export type DepsPasoAccion = {
  /**
   * EL RECLAMO, con compare-and-set: avanza la inscripción al paso siguiente SÓLO si
   * sigue en éste y activa. `true` = la tomó esta corrida; `false` = otra la tomó entre
   * medio (el cron y la vía rápida de un evento corren el mismo motor). Tira si la base
   * no contestó: ahí no se sabe, y no se corre nada.
   */
  reclamar: () => Promise<boolean>;
  ejecutar: (
    operacion: string,
    params: Record<string, unknown> | undefined,
    opts: { ws: number; origen: string; nombre: string; leadId: number },
  ) => Promise<ResultadoEjecucion>;
  /** La fila de `nutricion_envios`: 'accion' si salió bien, 'fallo' con el motivo si no. */
  registrar: (r: { estado: 'accion' | 'fallo'; operacion: string; resumen: string }) => Promise<void>;
};

export type EntradaPasoAccion = {
  accion: AccionDelPaso;
  /** El workspace de la corrida. `null` = no se sabe de quién es: no se corre nada ajeno. */
  ws: number | null;
  secuenciaId: number;
  /** El nombre humano de la secuencia: queda como «MaKo · automatización «nombre»». */
  nombre: string;
  /** El paso, contado desde 1 (el mismo número que `nutricion_envios.paso`). */
  orden: number;
  leadId: number;
};

export type ResultadoPasoAccion =
  /** Corrió y salió bien. La inscripción ya avanzó. */
  | { estado: 'accion'; nota: string }
  /** Corrió y falló: quedó registrado y la inscripción YA avanzó — no se reintenta. */
  | { estado: 'fallo'; nota: string }
  /** No corrió: otra corrida lo tomó, o no se pudo reclamar. La inscripción no se tocó acá. */
  | { estado: 'saltado'; nota: string };

/**
 * Corre el paso «⚡ Acción» de UNA inscripción: reclama, ejecuta y registra. Nunca tira.
 *
 * ⚠️ RECLAMAR VA ANTES DE EJECUTAR, Y ES LA REGLA DE LA CASA (AGENTS.md, «Marcar va ANTES
 * de mandar, con compare-and-set»). Al revés, dos corridas del mismo minuto —el cron y la
 * vía rápida de `enrolarPorEvento`— corren la acción dos veces: dos tareas, dos leads, dos
 * WhatsApps. El costo de este orden es el opuesto y es el correcto: si la acción falla
 * después del reclamo, ese paso no se vuelve a intentar. Y eso es justo lo que se quiere:
 * una acción que falla igual cada vez (un lead que ya no existe, una etapa que se borró)
 * reintentada en cada corrida es una fila de 'fallo' por hora para siempre. Se registra,
 * con el motivo, y la secuencia sigue.
 */
export async function correrPasoAccion(e: EntradaPasoAccion, deps: DepsPasoAccion): Promise<ResultadoPasoAccion> {
  let tomada: boolean;
  try {
    tomada = await deps.reclamar();
  } catch (err) {
    return { estado: 'saltado', nota: `no pude reclamar el paso: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!tomada) return { estado: 'saltado', nota: 'otra corrida ya tomó este paso' };

  let r: ResultadoEjecucion;
  if (e.ws == null) {
    r = { ok: false, resumen: 'No sé de qué negocio es esta corrida: no corrí la acción.' };
  } else {
    try {
      r = await deps.ejecutar(e.accion.operacion, e.accion.params, {
        ws: e.ws, origen: origenDelPaso(e.secuenciaId, e.orden), nombre: e.nombre, leadId: e.leadId,
      });
    } catch (err) {
      // `ejecutarDesdeFlujo` no tira, pero un import dinámico sí puede: el paso ya se
      // reclamó, así que esto también se registra y se sigue.
      r = { ok: false, resumen: err instanceof Error ? err.message : String(err) };
    }
  }
  const estado = r.ok ? 'accion' as const : 'fallo' as const;
  try {
    await deps.registrar({ estado, operacion: e.accion.operacion, resumen: r.resumen });
  } catch (err) {
    // El rastro es best-effort: la acción ya corrió (o ya falló) y el reclamo ya avanzó la
    // inscripción. Un registro que falla no puede reabrir nada.
    console.error(`[nutricion] rastro de la acción ${e.accion.operacion} (secuencia ${e.secuenciaId}, paso ${e.orden}):`, err instanceof Error ? err.message : String(err));
  }
  return { estado, nota: r.resumen };
}
