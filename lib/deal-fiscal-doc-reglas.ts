// =============================================================================
// Las reglas de `guardar_documento_fiscal` (lib/api-mako/areas/cobros.*), sin base: qué archivo del mensaje es el
// documento, qué datos fiscales se completan (sólo los VACÍOS) y qué dice la tarjeta. El runner las usa al proponer y al
// confirmar; los tests (tests/documento-fiscal-desde-el-chat.test.ts) las prueban sin Supabase.
// =============================================================================

import { CAMPOS_DEAL, rotuloCampoDeal, valorDeCampoDeal } from './pagos-campo';

type Adjunto = { ref: string; nombre: string; tipo: 'image' | 'document' };
type Fiscal = Record<string, unknown> | null | undefined;

const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const vacio = (actual: Fiscal, campo: string): boolean => !String((actual ?? {})[campo] ?? '').trim();

export const SIN_ARCHIVO = 'En este mensaje no vino ningún archivo: pídele que adjunte el documento fiscal CON el pedido (el de un mensaje anterior no se puede usar), o que lo suba en la ficha › Pagos.';

export type PropuestaDocFiscal =
  | { error: string; faltan?: string[]; disponibles?: string[] }
  | { payload: { leadId: number; ref: string; nombre: string; completar: Record<string, string> }; resumen: string };

export function propuestaDocumentoFiscal(
  lead: { id: number; nombre: string | null; deal_fiscal?: Fiscal },
  adjuntos: readonly Adjunto[] | undefined,
  input: Record<string, unknown>,
): PropuestaDocFiscal {
  const lista = adjuntos ?? [];
  if (!lista.length) return { error: SIN_ARCHIVO };
  const archivo = s(input.archivo);
  const elegidos = archivo ? lista.filter((a) => a.nombre === archivo) : lista;
  if (elegidos.length !== 1) {
    return {
      error: archivo ? `En este mensaje no vino «${archivo}».` : `Adjuntó ${lista.length} archivos: di cuál es el documento fiscal (archivo).`,
      faltan: ['archivo'], disponibles: lista.map((a) => a.nombre),
    };
  }
  const a = elegidos[0];
  const completar: Record<string, string> = {};
  for (const campo of Object.keys(CAMPOS_DEAL.fiscal)) {
    const v = valorDeCampoDeal('fiscal', campo, input[campo]);
    if (!v.ok) return { error: `${rotuloCampoDeal('fiscal', campo)}: ${v.error}` };
    if (v.valor && vacio(lead.deal_fiscal, campo)) completar[campo] = v.valor;
  }
  const que = Object.entries(completar).map(([c, v]) => `${rotuloCampoDeal('fiscal', c)} «${v}»`);
  const quien = lead.nombre?.trim() || `el lead #${lead.id}`;
  return {
    payload: { leadId: lead.id, ref: a.ref, nombre: a.nombre, completar },
    resumen: `Guardar «${a.nombre}» como documento fiscal de ${quien}${(lead.deal_fiscal ?? {}).doc_path ? ' (reemplaza el que tenía)' : ''}${que.length ? ` y completar ${que.join(', ')}` : ''}.`,
  };
}

/** Lo que se completa AL CONFIRMAR: lo propuesto que sigue vacío (si alguien lo cargó entre la propuesta y el «sí», no se pisa). */
export function aCompletarAhora(actual: Fiscal, completar: unknown): Array<[campo: string, valor: string]> {
  if (!completar || typeof completar !== 'object') return [];
  return Object.entries(completar as Record<string, unknown>).flatMap(([campo, valor]) =>
    campo in CAMPOS_DEAL.fiscal && typeof valor === 'string' && valor.trim() && vacio(actual, campo) ? [[campo, valor] as [string, string]] : []);
}
