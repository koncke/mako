// =============================================================================
// etapa-existentes — los que YA están en la etapa al activar una automatización «llega a etapa» (Leila, 20/10/2026)
// =============================================================================
// Leila (ws11), 20/10 17:38: «la activé para todos los que están en reactivación… todavía no pasa nada». El barrido SÍ
// mira a los que ya están parados en la etapa (`cohorteDeTrigger`, lib/nutricion.ts), pero con la ventana anti-revival de
// 90 días sobre el ÚLTIMO HITO del lead: el alta, la agenda o una reunión. MOVER A ALGUIEN DE ETAPA NO ES UN HITO (la tabla
// `leads` no guarda cuándo cambió de etapa), así que los de «reactivación» —leads viejos que se pasaron ahí a mano para
// revivirlos— quedaban afuera en cada pasada, sin un aviso. La ventana se queda (protege de escribirle por accidente a una
// base muerta): al ACTIVAR, la pantalla cuenta cuántos entran solos y cuántos no, y ofrece incluir a los otros
// (`incluirExistentes`, lib/nutricion.ts). Salen como todos, con el goteo y los topes de la línea.
// Puro: lo usan el motor, la pantalla y el test.
// =============================================================================

/** La ventana anti-revival del barrido por etapa: un lead sin hitos en estos días no entra solo. */
export const VENTANA_HITO_DIAS = 90;

/** Lo que de un lead cuenta como movimiento: el alta, la agenda y las dos reuniones. */
export type HitosDelLead = {
  created_at?: string | null;
  fecha_agenda?: string | null;
  fecha_junta_1?: string | null;
  fecha_junta_2?: string | null;
};

/** El último hito del lead en ms (0 si no tiene ninguno legible). La MISMA regla que el barrido. */
export function ultimoHitoMs(l: HitosDelLead): number {
  return Math.max(
    ...[l.created_at, l.fecha_agenda, l.fecha_junta_1, l.fecha_junta_2]
      .filter((x): x is string => Boolean(x))
      .map((x) => Date.parse(x))
      .filter((ms) => Number.isFinite(ms)),
    0,
  );
}

/** Lo que cuenta el server al activar (GET /api/whatsapp/secuencias?existentes=<id>). */
export type ExistentesEnEtapa = {
  /** Las etapas de los CRON «llega a etapa» (keys): la pantalla las nombra. */
  etapas: string[];
  /** Los que el barrido inscribe solo en la próxima pasada. */
  entran: number;
  /** Los que están en la etapa y NO entran solos: sin movimiento en `VENTANA_HITO_DIAS` días. */
  viejos: number;
};

const personas = (n: number) => `${n} ${n === 1 ? 'persona' : 'personas'}`;

/** ¿Hay algo que preguntar al activar? Sólo si quedan afuera algunos. */
export const hayQuePreguntar = (e: ExistentesEnEtapa | null | undefined): e is ExistentesEnEtapa => !!e && e.viejos > 0;

/**
 * LA PREGUNTA AL ACTIVAR, corta. `nombres`: las etapas ya nombradas («Reactivación»).
 * «En «Reactivación» hay 37 personas. 12 entran ahora; 25 no se movieron en 90 días. ¿Las incluyo? Salen de a poco.»
 */
export function preguntaExistentes(e: ExistentesEnEtapa, nombres: readonly string[]): string {
  const donde = nombres.length ? nombres.map((n) => `«${n}»`).join(' y ') : 'la etapa';
  const total = e.entran + e.viejos;
  const entran = e.entran ? `${e.entran} ${e.entran === 1 ? 'entra' : 'entran'} ahora; ` : '';
  return `En ${donde} hay ${personas(total)}. ${entran}${e.viejos} no se ${e.viejos === 1 ? 'movió' : 'movieron'} en ${VENTANA_HITO_DIAS} días. ¿${e.viejos === 1 ? 'La incluyo' : 'Las incluyo'}? Salen de a poco.`;
}

/** Lo que dice el aviso después de activar: cuántos entran, y cuántos se sumaron por la pregunta. */
export function textoAlActivar(entran: number, incluidos: number): string {
  const n = entran + incluidos;
  return n ? `Activada ✓ · ${n === 1 ? 'entra 1 persona' : `entran ${n} personas`} que ya ${n === 1 ? 'estaba' : 'estaban'} en la etapa` : 'Activada ✓';
}
