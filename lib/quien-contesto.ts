// =============================================================================
// quien-contesto — QUÉ IA CONTESTÓ un pedido, para decírselo a la persona (27/10/2026, puro)
// =============================================================================
// El Cerebro (27/10, la llamada con Aaron, 876825880-04): «primero la IA que eligió el admin del negocio; Gemini sólo como
// último respaldo, y el chat dice qué IA contestó». El orden ya era ése (lib/ai-cheap.ts → `chatCheapCascade`: su Claude, su
// ChatGPT, su Gemini, la red de MaKo y el crédito de Claude, en ese orden); lo que faltaba era decirlo. La cascada anota en
// `quienOut` quién escribió lo que se aceptó, y esto lo pasa a palabras.
// =============================================================================

/** Quién escribió la respuesta que se aceptó: el proveedor y de quién era la cuenta. */
export type QuienContesto = {
  proveedor: string;
  modelo?: string | null;
  /** `negocio`: una clave suya. `plataforma`: la red gratis de MaKo. `credito`: el crédito de Claude que asigna MaKo. */
  de: 'negocio' | 'plataforma' | 'credito';
};

const NOMBRE: Readonly<Record<string, string>> = { anthropic: 'Claude', openai: 'ChatGPT', gemini: 'Gemini', groq: 'Groq', mistral: 'Mistral', openrouter: 'OpenRouter', cerebras: 'Cerebras' };

/** «Con tu Claude», «Con la Gemini de MaKo (respaldo)»… null si no se sabe (un pedido viejo, o nadie contestó). */
export function textoDeQuienContesto(q: QuienContesto | null | undefined): string | null {
  if (!q || !q.proveedor) return null;
  const n = NOMBRE[q.proveedor] ?? q.proveedor;
  if (q.de === 'negocio') return `Con tu ${n}`;
  if (q.de === 'credito') return 'Con el crédito de Claude de MaKo';
  return `Con ${q.proveedor === 'gemini' ? 'la Gemini' : 'la IA'} de MaKo (respaldo)`;
}
