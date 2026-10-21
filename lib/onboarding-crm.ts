// =============================================================================
// El CRM a medida de lo que vende (20/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 10): «el armado del CRM también debe ser personalizado, no sé si está preseteado con lo
// que teníamos antes». Lo estaba: el arranque proponía la plantilla de su canal tal cual (`tiposOfrecidos`). Ahora, al
// llegar a la pregunta del CRM, MaKo elige el tipo (entre los de su canal, si lo dijo) y le pone a cada etapa el nombre de
// ESE negocio («Agendó llamada» → «Agendó su consulta»).
//
// ⚠️ SÓLO LOS NOMBRES: las claves quedan. Las nutriciones, los avisos y las automatizaciones mueven a cada cliente por la
// clave de su etapa (lib/pipeline.ts → `etapasDe` ya renombra así los tipos de fábrica). Una etapa nueva o una clave
// inventada por la IA rompería eso: se descartan.
// Una vez por onboarding (se guarda en el estado, `crmPropuesta`). Si la IA no contesta, queda la plantilla de su canal.
// Puro: el pedido a la IA es lib/offer-ia.ts → crmOffer, y la llamada, lib/onboarding-arranque-server.ts → propuestaDeCrm.
// =============================================================================

import { TIPOS_CRM, type Stage, type TipoCrm, type TipoCrmId } from './pipeline';
import type { CanalId } from './fase-diagnostico';
import { parseJsonObject } from './json-del-modelo';

/** Lo que propone MaKo: el tipo y, por clave de SUS etapas, el nombre con las palabras del negocio (sólo las que cambian). */
export type PropuestaCrm = { tipo: TipoCrmId; etapas: Record<string, string> };

/** El nombre de una etapa es el título de una columna del tablero: corto. */
export const TOPE_NOMBRE_ETAPA = 40;

/** Entre qué tipos elige MaKo: los de su canal si lo dijo (dónde cierra la venta); si no, todos. */
export function candidatosCrm(canal: CanalId | null): TipoCrm[] {
  const conEtapas = TIPOS_CRM.filter((t) => t.pipeline.length > 0);
  const delCanal = canal ? conEtapas.filter((t) => t.canal === canal) : [];
  return delCanal.length ? delCanal : conEtapas;
}

/** Los tipos para el prompt, con la clave y el nombre de fábrica de cada etapa. Lo escribe el código, no el dueño. */
export function tiposParaPrompt(tipos: readonly TipoCrm[]): string {
  return tipos.map((t) => `- ${t.id}: «${t.label}» (${t.linea}). Etapas: ${t.pipeline.map((s) => `${s.key} = ${s.label}`).join(' · ')}`).join('\n');
}

const normal = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Un nombre que sirve como título de columna: una línea, corto, sin emojis ni marcas. */
function nombreValido(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const n = v.replace(/\s+/g, ' ').trim().replace(/[.;:]+$/, '');
  if (n.length < 2 || n.length > TOPE_NOMBRE_ETAPA) return null;
  if (/[<>{}[\]*#_`|]/.test(n) || /\p{Extended_Pictographic}/u.test(n)) return null;
  return n;
}

/**
 * Lo que devolvió la IA, o null si no sirve: `{"tipo": "<id>", "etapas": {"<clave>": "<nombre>"}}`, con un tipo de los
 * CANDIDATOS. De las etapas se queda con las claves de ESE tipo y un nombre que sirva; un nombre que repite el de otra
 * etapa vuelve al de fábrica (dos columnas iguales no se distinguen). Un tipo sin ningún nombre nuevo también sirve.
 */
export function parsePropuestaCrm(raw: unknown, candidatos: readonly TipoCrm[]): PropuestaCrm | null {
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try { o = parseJsonObject(raw); } catch { return null; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  const tipo = candidatos.find((t) => t.id === r.tipo);
  if (!tipo) return null;
  const crudas = r.etapas && typeof r.etapas === 'object' && !Array.isArray(r.etapas) ? (r.etapas as Record<string, unknown>) : {};
  const etapas: Record<string, string> = {};
  const usados = new Set<string>();
  for (const s of tipo.pipeline) {
    const valido = nombreValido(crudas[s.key]);
    // Una terminal no puede decir lo contrario (revisión del Cerebro, 20/10): {"ganado": "Perdido"} es un nombre válido.
    const propuesto = valido && !contradiceLaTerminal(s.key, valido) ? valido : null;
    const nombre = propuesto && !usados.has(normal(propuesto)) ? propuesto : s.label;
    usados.add(normal(nombre));
    if (nombre !== s.label) etapas[s.key] = nombre;
  }
  return { tipo: tipo.id, etapas };
}

/** ¿El nombre de una etapa terminal dice lo contrario? «ganado» que habla de perder o «perdido» que habla de comprar. */
function contradiceLaTerminal(clave: string, nombre: string): boolean {
  const n = normal(nombre);
  if (clave === 'ganado') return /perd|no compr|no cerr|descart|rechaz|cancel/.test(n);
  if (clave === 'perdido') return /\bgan|\bcompr|\bcerr[oó]\b|cliente activ|venta hecha/.test(n);
  return false;
}

/** Las etapas con los nombres de la propuesta (las que no nombró, las de fábrica). Las claves no cambian. */
export function etapasConNombres(pipeline: readonly Stage[], nombres: Readonly<Record<string, string>> | null | undefined): Stage[] {
  return pipeline.map((s) => (nombres?.[s.key] ? { ...s, label: nombres[s.key] } : s));
}
