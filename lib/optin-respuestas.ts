// =============================================================================
// optin-respuestas — lo que la persona contestó en el formulario de la landing
// =============================================================================
// El snippet manda en `respuestas` los campos del formulario que NO son nombre, email, teléfono
// o empresa: en una inmobiliaria, la zona, el presupuesto, si busca comprar o rentar. Hasta el
// 14/10/2026 sólo viajaban en el WhatsApp del aviso; desde ahí quedan en el lead
// (`leads.optin_respuestas`, mig 0274) y los muestra el Resumen de la ficha.
//
// Sin `server-only`, para que tenga test. El cuerpo lo escribe una página ajena: se sanea y no
// se confía en el largo.
// =============================================================================

export type RespuestaOptin = { pregunta: string; respuesta: string };

/** Hasta 20 campos, la pregunta en 60 caracteres y la respuesta en 500. Lo que no es texto, afuera. */
export function respuestasDelOptin(crudo: unknown): RespuestaOptin[] {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return [];
  const out: RespuestaOptin[] = [];
  for (const [k, v] of Object.entries(crudo as Record<string, unknown>)) {
    if (out.length >= 20) break;
    if (v != null && typeof v === 'object') continue;
    const pregunta = String(k).trim().replace(/\s+/g, ' ').slice(0, 60);
    const respuesta = String(v ?? '').trim().slice(0, 500);
    if (pregunta && respuesta) out.push({ pregunta, respuesta });
  }
  return out;
}

/** Lo guardado de vuelta a filas (lo que se lee de la base también se sanea). */
export function respuestasGuardadas(v: unknown): RespuestaOptin[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is { pregunta: unknown; respuesta: unknown } => !!x && typeof x === 'object')
    .map((x) => ({ pregunta: String(x.pregunta ?? '').trim(), respuesta: String(x.respuesta ?? '').trim() }))
    .filter((x) => x.pregunta && x.respuesta)
    .slice(0, 20);
}
