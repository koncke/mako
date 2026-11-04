// =============================================================================
// agregar-en-bloque — a quiénes se suma a otro CRM en bloque (puro, sin `server-only`)
// =============================================================================
// La campaña de email de Mauricio (4/11/2026): «un CRM nuevo "Email Marketing" con esos leads», a todos «menos lo que
// están en ganado». Lo usa `agregar_en_bloque_a_crm` (lib/api-mako/areas/crm.run.ts) para decidir, ANTES del «sí», a
// quiénes suma y por qué quedan afuera los demás: el resumen que se confirma tiene que decir lo mismo que se ejecuta.
// =============================================================================

/** Lo que hace falta de cada lead para decidir. */
export type FilaParaAgregar = { id: number | string; estado_lead: string | null; email: string | null };

/** El email que sirve: no vacío y con una arroba entre algo. */
const tieneEmail = (e: string | null | undefined): boolean => !!e && /\S+@\S+\.\S+/.test(e.trim());

/**
 * Los ids que se suman (sin repetir, en orden), y lo que quedó afuera dicho en palabras («12 ganado», «40 sin email»).
 * `excluir`: los estados que NO entran (un lead sin estado cuenta como `abierto`, que es lo que es en la base).
 */
export function filtrarParaAgregar(filas: readonly FilaParaAgregar[], o: { excluir: ReadonlySet<string>; soloConEmail: boolean }): { ids: number[]; afuera: string[] } {
  const ids: number[] = [];
  const vistos = new Set<number>();
  const porEstado = new Map<string, number>();
  let sinEmail = 0;
  for (const f of filas) {
    const id = Number(f.id);
    if (!Number.isInteger(id) || id <= 0 || vistos.has(id)) continue;
    vistos.add(id);
    const estado = (f.estado_lead ?? 'abierto').trim() || 'abierto';
    if (o.excluir.has(estado)) { porEstado.set(estado, (porEstado.get(estado) ?? 0) + 1); continue; }
    if (o.soloConEmail && !tieneEmail(f.email)) { sinEmail += 1; continue; }
    ids.push(id);
  }
  const afuera = [...porEstado].map(([e, n]) => `${n} ${e.replace('_', ' ')}`);
  if (sinEmail) afuera.push(`${sinEmail} sin email`);
  return { ids, afuera };
}
