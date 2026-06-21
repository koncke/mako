// =============================================================================
// mako-context — arma el system prompt de MaKo (todo aditivo)
// =============================================================================
// Combina: persona activa + núcleo fijo (código) + perfil del negocio +
// instrucción de la sección + conocimiento recuperado (RAG) + datos del gráfico.
// Cada pieza es resiliente: si falla o está vacía, se omite. Con todo vacío y la
// persona por defecto, el prompt es IDÉNTICO al de hoy.

import 'server-only';
import { MAKO_NUCLEO, getActivePersona } from './mako-prompts';
import { getFaseInstruccion } from './mako-fases';
import { perfilNegocioTexto } from './onboarding';
import { searchKnowledge, formatKnowledge } from './mako-knowledge';

export async function buildSystemPrompt(opts: { chartKey: string; titulo: string; contexto: string; query: string }): Promise<string> {
  const { chartKey, titulo, contexto, query } = opts;

  const [persona, perfil, fase, knowledge] = await Promise.all([
    getActivePersona().catch(() => ''),
    perfilNegocioTexto().catch(() => ''),
    getFaseInstruccion(chartKey).catch(() => ''),
    searchKnowledge(query, 4).catch(() => [] as Array<{ titulo: string; cuerpo: string }>),
  ]);

  let base = `${persona}\n\n${MAKO_NUCLEO}`.trim();
  if (perfil) base += `\n\nNEGOCIO DE MARTÍN (perfil del cliente):\n${perfil}`;
  if (fase) base += `\n\nQUÉ TENÉS QUE MIRAR Y HACER EN ESTA SECCIÓN:\n${fase}`;
  const know = formatKnowledge(knowledge);
  if (know) base += `\n\nTU METODOLOGÍA (lo más relevante a esta consulta):\n${know}`;

  if (!contexto.trim()) {
    return `${base}\n\nCONTEXTO: chat general del dashboard del negocio de Martín. Ayudá con lo que pregunte; si te pega datos, analizalos.`;
  }
  return `${base}\n\nCONTEXTO: estás mirando el gráfico "${titulo}" del PROPIO negocio de Martín. Ya tenés los datos abajo, analizá directo.\n\nDATOS DEL GRÁFICO:\n${contexto}`;
}
