// =============================================================================
// El resultado que queda guardado de una propuesta genérica (/mako/revisar), PURO: sin base ni `server-only`
// =============================================================================
// Lo escribe `aplicarPropuestaGenerica` (lib/api-mako/acciones.ts) en `propuestas.resultado` y lo leen la pantalla
// (app/mako/revisar/[id]/RevisarAccion.tsx: `resumen`, `ok`, `en_curso`) y `ver_propuesta_accion` (lib/api-mako/areas/mako.run.ts,
// en lista blanca).
//
// ⚠️ QUIÉN CONFIRMÓ VA EN SU PROPIO CAMPO (F114, 18/11/2026; docs/hallazgos-api-mako.md → «Lo que quedó sin hacer en el núcleo»:
//    «Actor fuera de `resultado`»). Hasta ese día se guardaba `{ resumen, ok, por, ...datos }`: lo que devolvía `ejecutar()` se
//    desparramaba ENCIMA, así que un runner con un dato llamado `por`, `ok` o `resumen` pisaba a la persona que confirmó, el
//    «salió bien» o el texto, sin un error. Ahora lo del runner va adentro de `datos` y no puede pisar nada.
// =============================================================================

/** Lo que se guarda al terminar de aplicar una propuesta genérica. */
export type ResultadoGuardado = {
  resumen: string;
  ok: boolean;
  /** Quién la confirmó (el actor del contexto). `null` = no se sabe (un flujo, la API). */
  por: string | null;
  /** Lo que devolvió `ejecutar()` (un id creado, un bloque), aparte: nunca encima de los campos de arriba. */
  datos?: Record<string, unknown>;
};

export function resultadoParaGuardar(r: { ok: boolean; resumen: string; datos?: Record<string, unknown> | null }, actor: string | null | undefined): ResultadoGuardado {
  const datos = r.datos && typeof r.datos === 'object' && !Array.isArray(r.datos) && Object.keys(r.datos).length ? r.datos : null;
  return { resumen: r.resumen, ok: r.ok, por: actor ?? null, ...(datos ? { datos } : {}) };
}
