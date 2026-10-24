// =============================================================================
// etapas-crm-reglas — lo que decide editar las etapas de un CRM, PURO
// =============================================================================
// Sin `server-only`, a propósito: lo importan lib/etapas-crm-server.ts (la op de la pantalla, al escribir), la API de MaKo
// (lib/api-mako/areas/crm.run.ts, antes del «sí») y tests/api-mako-etapas-crm.test.ts, que lo EJECUTA. Una regla que vive
// adentro del módulo que hace el trabajo sucio no la puede importar ningún test (AGENTS.md, «un guard sobre algo
// destructivo»). 23/10/2026, P0-6 de la auditoría de la API.
// =============================================================================

import { esTerminal, type Stage } from './pipeline';

/**
 * Por qué NO se puede quitar la etapa `key` de este pipeline (`null` = se puede). La usan la op `eliminar` al escribir
 * y la API de MaKo antes del «sí» (`eliminar_etapa`): una sola lista de lo que no se borra.
 */
export function porQueNoSeElimina(pipeline: readonly Stage[], key: string): string | null {
  // Las cuatro terminales no se borran en ningún funnel: es la decisión de Martín, y acá se hace cumplir del lado del
  // server porque la pantalla no es la última palabra.
  if (esTerminal(key)) return 'Esa etapa está en todos los funnels y no se puede eliminar. Sí puedes cambiarle el nombre.';
  if (!pipeline.some((st) => st.key === key)) return 'Esa etapa no es del pipeline: no se puede eliminar, solo renombrar.';
  if (pipeline.length <= 1) return 'Tu funnel se quedaría sin etapas.';
  // La etapa de ENTRADA tampoco: sin ella el embudo no tiene por dónde llegar un lead, y es de donde cuelga la
  // declaración de cómo entra la gente.
  if (pipeline.find((st) => st.key === key)?.kind === 'entrada') {
    return 'Por esa etapa entra tu gente: no se puede eliminar. Sí puedes cambiarle el nombre.';
  }
  return null;
}

/**
 * El pipeline con las etapas `keys` en ese orden. La usan la op `reordenar` al escribir y la API de MaKo para mostrar el
 * orden que va a quedar antes del «sí» (`ordenar_etapas`).
 */
export function pipelineReordenado(pipeline: readonly Stage[], keys: readonly string[]): Stage[] {
  // Las claves que el navegador mandó, en su orden, y SÓLO las que existen.
  const vistas = new Set<string>();
  const ordenadas: Stage[] = [];
  for (const k of keys) {
    const st = pipeline.find((x) => x.key === k);
    if (st && !vistas.has(k)) { vistas.add(k); ordenadas.push(st); }
  }
  // ⚠️ Y LO QUE EL NAVEGADOR NO NOMBRÓ SE CONSERVA, al final. El pop-up sólo dibuja las etapas propias, así que `ganado`
  // —que vive en el pipeline y no se arrastra— nunca viaja en la lista: sin esto, un arrastre la borraría del embudo.
  for (const st of pipeline) if (!vistas.has(st.key)) ordenadas.push(st);
  // ⚠️ Y LA ENTRADA VUELVE A SU LUGAR, la pantalla haya mandado lo que haya mandado. El navegador ya no deja soltar nada
  // encima, pero el que decide es el server: una pestaña vieja —o un pedido armado a mano— dejaría el embudo empezando por
  // otra etapa, y ahí la declaración de cómo entra la gente cuelga de la que no es.
  const iEnt = ordenadas.findIndex((st) => st.kind === 'entrada');
  if (iEnt > 0) return [ordenadas[iEnt], ...ordenadas.filter((_, k) => k !== iEnt)];
  return ordenadas;
}
