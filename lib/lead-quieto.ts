// =============================================================================
// El lead QUIETO — un plazo por etapa y el aviso de cuando nadie lo movió (#800)
// =============================================================================
// «Ponerle un plazo a cada etapa del funnel y avisar cuando un lead lo pasa sin moverse.
// Hoy el CRM avisa cuando pasa algo; falta el aviso de cuando NO pasa nada.» (#800)
//
// ⚠️ NO ES EL AVISO DEL CRM AUTOMÁTICO. `crm-lead-estancado` (lib/crm-auto.ts) cuenta los
// leads que el motor MOVIÓ, y sólo mira tres columnas (T2 y T6, lib/crm-auto-plan.ts) en los
// negocios que tienen el motor prendido. Esto es lo otro: un lead en CUALQUIER etapa abierta
// que pasó el plazo que el dueño le puso, y nadie lo mueve — se avisa, no se toca. Un plazo
// sobre «Agenda R2» o «Facturando» no le significaba nada al motor, así que el campo del
// editor de etapas habría sido un control que no hace nada.
//
// Puro y sin `server-only`: lo importan el pop-up de etapas (qué etapa puede tener plazo), el
// server (qué leads se pasaron y el texto) y un test, que es lo único que puede comprobar que
// el mensaje no afirma más de lo que se midió.
// =============================================================================

import { TERMINALES } from './pipeline';

/** Los plazos de UN embudo: clave de etapa → días. Es `funnels.data.umbrales.porEtapa`. */
export type PlazosPorEtapa = Record<string, number>;

/** Techo del campo. Un plazo de más de un año no es un plazo: es «nunca». */
export const PLAZO_MAX_DIAS = 365;

const DIA_MS = 86_400_000;

/**
 * ¿Esta etapa puede tener un plazo?
 *
 * Las abiertas, sí: la entrada, los pasos, las reuniones, el pago. Las cuatro terminales y el
 * cierre, no: un lead en Ganado o en Perdido no está «quieto», ya terminó. Ofrecer el campo ahí
 * sería prometer un aviso sobre algo que no tiene que moverse.
 */
export function puedeTenerPlazo(e: { key: string; kind?: string | null }): boolean {
  if ((TERMINALES as readonly string[]).includes(e.key)) return false;
  return e.kind !== 'cierre';
}

/** Días enteros entre 1 y el techo, o null (vacío, cero, negativo, texto, de más). */
export function sanearPlazo(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  const d = Math.floor(n);
  return d >= 1 && d <= PLAZO_MAX_DIAS ? d : null;
}

/**
 * Los plazos válidos de un embudo, sólo sobre etapas que EXISTEN en él y que pueden tenerlo.
 *
 * Lo descartado no se pierde en silencio: se devuelve con su motivo (AGENTS.md: «lo que un
 * saneador DESCARTA queda escrito»). El caso normal de descarte es una etapa que se borró del
 * embudo después de ponerle plazo — el plazo queda guardado y vuelve si se deshace el borrado.
 */
export function plazosValidos(
  crudo: unknown,
  etapas: ReadonlyArray<{ key: string; kind?: string | null }>,
): { plazos: PlazosPorEtapa; descartes: string[] } {
  const plazos: PlazosPorEtapa = {};
  const descartes: string[] = [];
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return { plazos, descartes };
  const porKey = new Map(etapas.map((e) => [e.key, e]));
  for (const [k, v] of Object.entries(crudo as Record<string, unknown>)) {
    const d = sanearPlazo(v);
    if (d == null) { descartes.push(`${k}: plazo inválido (${JSON.stringify(v)})`); continue; }
    const e = porKey.get(k);
    if (!e) { descartes.push(`${k}: el funnel no tiene esa etapa`); continue; }
    if (!puedeTenerPlazo(e)) { descartes.push(`${k}: una etapa terminal no tiene plazo`); continue; }
    plazos[k] = d;
  }
  return { plazos, descartes };
}

/**
 * Desde cuándo está el lead en su etapa ACTUAL (la de su casa), o null si no se puede saber.
 *
 * `leads` no guarda la fecha de entrada a la etapa. Lo que sí hay es el historial: cada
 * cambio de etapa —el que hace una persona y el que sale de la derivación por fechas— deja una
 * fila `Etapa` en `lead_audit` con la clave nueva (lib/etapa-historial.ts), y `etapa_vista` es
 * la última que el historial dio por registrada.
 *
 * ⚠️ «NO SÉ» ES UN TERCER ESTADO, y se devuelve null en los dos casos donde el historial no
 * contesta. Un aviso que sale solo no puede afirmar «lleva más de 5 días» sobre un lead que
 * cambió ayer:
 *   · `etapaVista` distinta de la etapa de hoy: el cambio todavía no se registró (la pasada
 *     de «Datos sin marcar» corre al abrir el CRM). La última fila es de la etapa ANTERIOR.
 *   · la última fila `Etapa` dice otra clave que la de hoy: lo mismo, por el otro lado.
 *   · `etapaVista` vacía y sin filas: el lead nunca se registró.
 *
 * Sin filas y con `etapaVista` igual a la de hoy, el lead está en esa etapa desde que se creó
 * (o desde antes de que existiera el historial): vale `creadoEn`. Puede quedarse corto en
 * días, nunca largo respecto del plazo, porque desde que existe el historial cada cambio deja
 * su fila — por eso el aviso dice «más de su plazo» y nunca un número exacto de días.
 */
export function entradaALaEtapa(p: {
  etapa: string;
  etapaVista: string | null | undefined;
  ultimaEtapa: { valor: string | null; at: string } | null | undefined;
  creadoEn: string | null | undefined;
}): string | null {
  const vista = p.etapaVista?.trim() || null;
  if (vista !== p.etapa) return null;
  if (p.ultimaEtapa) return p.ultimaEtapa.valor === p.etapa ? p.ultimaEtapa.at : null;
  return p.creadoEn || null;
}

/**
 * Desde cuándo corre el reloj del plazo: en una etapa de REUNIÓN, desde el día de la reunión.
 *
 * Un lead en «Agenda R1» con la reunión dentro de diez días no está quieto: está esperando su
 * reunión, que es exactamente lo que esa columna significa. El que sí está quieto es el que tuvo
 * la reunión hace días y sigue en la columna sin que nadie marque si asistió.
 *
 * `reunion` es la fecha (YYYY-MM-DD) o el instante de ESA reunión; sin ella, vale la entrada.
 */
export function relojDesde(entrada: string | null, reunion: string | null | undefined): string | null {
  if (!entrada) return null;
  if (!reunion) return entrada;
  const r = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(reunion) ? `${reunion}T00:00:00Z` : reunion);
  if (!Number.isFinite(r)) return entrada;
  return r > Date.parse(entrada) ? new Date(r).toISOString() : entrada;
}

export type EnEtapa = {
  leadId: number;
  nombre: string;
  /** El embudo de esa etapa: el de la casa del lead, o el de su fila de `lead_funnel`. */
  funnelId: number;
  etapa: string;
  /** Desde cuándo está ahí (ISO). null = no se sabe, y entonces no se afirma nada. */
  desde: string | null;
};

export type LeadQuieto = EnEtapa & { plazo: number; dias: number };

/**
 * Los que pasaron el plazo de su etapa, del que más lleva al que menos.
 *
 * El mismo lead puede aparecer dos veces —en su casa y en un producto agregado— y es correcto:
 * son dos etapas distintas con dos plazos distintos.
 */
export function leadsQuietos(
  items: readonly EnEtapa[],
  plazoDe: (funnelId: number, etapa: string) => number | null | undefined,
  ahoraMs: number,
): LeadQuieto[] {
  const out: LeadQuieto[] = [];
  for (const it of items) {
    if (!it.desde) continue;
    const plazo = plazoDe(it.funnelId, it.etapa);
    if (!plazo) continue;
    const t = Date.parse(it.desde);
    if (!Number.isFinite(t)) continue;
    const dias = Math.floor((ahoraMs - t) / DIA_MS);
    if (dias >= plazo) out.push({ ...it, plazo, dias });
  }
  return out.sort((a, b) => b.dias - a.dias || a.leadId - b.leadId);
}

/** Cuántos nombres van en el mensaje. Los demás están en el CRM, a un clic. */
const NOMBRES_MAX = 3;

const lista = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

/**
 * El texto del aviso, o null si no hay nada que contar.
 *
 * Lo que cumple, y cada regla tiene su precedente en esta casa:
 *  1. Nombra la etapa como la escribió el dueño (`etiqueta`), nunca por su clave: «st0» no le
 *     dice nada a nadie. Con `embudo` dice además de cuál: «Agenda R2» puede existir en dos.
 *  2. Dice «más de N días» con N = el PLAZO, nunca los días exactos de cada lead: la entrada a
 *     la etapa puede salir de la fecha de alta (ver `entradaALaEtapa`), y un número exacto
 *     sería una afirmación que no se midió.
 *  3. Nombra a los que más esperan —es lo único accionable— y deja el resto en el link.
 */
export function textoLeadsQuietos(
  quietos: readonly LeadQuieto[],
  etiqueta: (funnelId: number, etapa: string) => { etapa: string; embudo?: string | null },
  link?: string | null,
): string | null {
  if (!quietos.length) return null;
  const grupos = new Map<string, { label: string; n: number; plazo: number }>();
  const rotulo = (funnelId: number, etapa: string) => {
    const r = etiqueta(funnelId, etapa);
    return r.embudo ? `*${r.etapa}* de *${r.embudo}*` : `*${r.etapa}*`;
  };
  for (const q of quietos) {
    const k = `${q.funnelId}:${q.etapa}`;
    const g = grupos.get(k);
    if (g) g.n += 1;
    else grupos.set(k, { label: rotulo(q.funnelId, q.etapa), n: 1, plazo: q.plazo });
  }
  const partes = [...grupos.values()]
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .map((g) => `${g.n} en ${g.label} (más de ${g.plazo} ${g.plazo === 1 ? 'día' : 'días'})`);
  const nombres = [...new Set(quietos.map((q) => q.nombre))].slice(0, NOMBRES_MAX);
  const total = new Set(quietos.map((q) => q.leadId)).size;
  const cabeza = total === 1
    ? '⏳ *1 lead* lleva en su etapa más de lo que marca tu funnel'
    : `⏳ *${total} leads* llevan en su etapa más de lo que marca tu funnel`;
  const quienes = nombres.length ? ` Los que más esperan: ${lista(nombres)}.` : '';
  return `${cabeza}: ${lista(partes)}.${quienes}${link ? ` Míralos aquí 👉 ${link}` : ''} — MaKo`;
}
