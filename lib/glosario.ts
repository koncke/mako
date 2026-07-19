import 'server-only';

// =============================================================================
// glosario — términos/nombres propios del negocio, por workspace (punto 7)
// =============================================================================
// "Artemisa = el Fathom de Mauricio", "Clau = Claude". Guardar esto una vez hace
// que las próximas cargas de reuniones entiendan la jerga y corrijan la
// transcripción sin volver a preguntar.
//
// NO es una tabla nueva: se apoya en mako_knowledge (ya multi-tenant, mig 0071)
// con area='glosario'. Cada término es una fila (titulo=término, cuerpo=definición).
// =============================================================================

import { listActiveKnowledgeByArea, createKnowledge } from './mako-knowledge';

export const AREA_GLOSARIO = 'glosario';

export type TerminoGlosario = { termino: string; definicion: string };

/** Los términos del glosario del workspace, listos para inyectar en un prompt. */
export async function glosarioTexto(): Promise<string> {
  const items = await listActiveKnowledgeByArea(AREA_GLOSARIO).catch(() => []);
  if (!items.length) return '';
  return items.map((k) => `- ${k.titulo}: ${k.cuerpo}`).join('\n');
}

/** Guarda un término nuevo (la respuesta del usuario a "¿qué es X?"). Tenant-scoped. */
export async function guardarTermino(termino: string, definicion: string): Promise<void> {
  const t = termino.trim().slice(0, 80);
  const d = definicion.trim().slice(0, 400);
  if (!t || !d) return;
  await createKnowledge({ titulo: t, cuerpo: d, area: AREA_GLOSARIO, fuente: 'reunión' }).catch(() => null);
}
