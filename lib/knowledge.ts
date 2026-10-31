// =============================================================================
// knowledge — el LECTOR de Knowledge para toda la app (31/10/2026)
// =============================================================================
// El pedido de Martín: el conocimiento de los cursos tiene que servirle a toda MaKo, no a una pantalla. Hasta hoy
// servía a siete lugares y cada uno cableaba su área a mano: `metodologiaDeArea('mensajes', …)` en lib/whatsapp-advisor,
// lib/nutricion-generator, lib/nutricion-plantillas y lib/post-llamada; `searchKnowledge(pedido, 4)` SIN área en
// lib/ig-writer, lib/landing-writer y lib/campaign-structurer. Es decir: una tab nueva no recibía nada hasta que alguien
// se acordara de cablearla, y las tres que piden sin área reciben el cajón entero.
//
// LA REGLA DE ACÁ EN ADELANTE: una tab pide su método por su KEY DEL NAV y el catálogo (lib/knowledge-modulos.ts)
// resuelve qué módulos le corresponden y de qué área salen. El área deja de estar escrita en el writer.
//
// ⚠️ MIENTRAS LAS ÁREAS NUEVAS ESTÉN VACÍAS, CAE AL RAG GENERAL. `organico`, `oferta`, `paginas` y `piezas` nacen sin
// una sola fila: si se filtrara por área y nada más, las tabs que hoy reciben el cajón general recibirían NADA, que es
// peor que antes. Así que sin filas en las áreas del módulo se busca sin área, como hoy. Es aditivo por construcción.
//
// ⚠️ Y NO INVENTA. Si no hay método, devuelve '' y el prompt sigue igual: el molde de `searchKnowledge`, que devuelve
// `[]` ante un fallo a propósito porque siete call sites lo inyectan en un prompt.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual, OWNER_WS, WS_NINGUNO, wsSuperAdmin } from './workspace';
import { sePresta, sinLoAjeno } from './rag-prestamo';
import { formatKnowledge, metodologiaDeArea, searchKnowledge, AREAS_RESERVADAS } from './mako-knowledge';
import { areasDeTab, modulosDeTab, moduloDeKey, MODULOS_KNOWLEDGE, type CargaDeModulo, type ModuloKnowledge } from './knowledge-modulos';

// El tipo del dato medido vive en el catálogo (puro), no acá: la pantalla lo recibe como prop y este módulo es
// `server-only`.
export type { CargaDeModulo };

/**
 * Los workspaces que Knowledge puede leer. Es la MISMA regla que `wsParaRag` de lib/mako-knowledge.ts y por el mismo
 * motivo: el método curado se presta read-only desde el workspace del dueño y desde la plataforma, y de los ajenos sólo
 * entra lo que sembró MaKo (`sinLoAjeno`). Está repetida y no importada porque allá es privada; si alguna de las dos
 * cambia, cambian las dos — el test lo dice.
 */
async function wsParaKnowledge(): Promise<number[]> {
  const ws = (await getWorkspaceActual()) ?? WS_NINGUNO;
  const plataforma = await wsSuperAdmin().catch(() => null);
  return [...new Set([ws, OWNER_WS, ...(plataforma != null ? [plataforma] : [])])];
}

/**
 * Cuántas fichas activas tiene cada módulo. Una sola consulta (sólo las columnas del filtro de préstamo), y se cuenta
 * en la app: PostgREST no agrupa sin una vista.
 *
 * ⚠️ NO SE LLAMA EN CADA TURNO. El índice que viaja al prompt es `bloqueDeModulos()`, que es puro. Esto es para la
 * pantalla, para la API y para el grafo que se DIBUJA: tres lugares donde una consulta más no se nota.
 */
export async function estadoDeLosModulos(): Promise<CargaDeModulo[]> {
  const base = MODULOS_KNOWLEDGE.map((m) => ({ key: m.key, nombre: m.nombre, area: m.area, fichas: 0, prestables: 0, tabs: m.tabs, secciones: m.secciones }));
  try {
    const wsPropio = (await getWorkspaceActual()) ?? WS_NINGUNO;
    const { data, error } = await getSupabaseServer()
      .from('mako_knowledge')
      .select('area, fuente, workspace_id')
      .in('workspace_id', await wsParaKnowledge())
      .eq('activo', true);
    // El error de la consulta se separa del vacío: un esquema cambiado se leía igual que «no hay método cargado»
    // (la misma trampa que ya mordió en `searchKnowledge`).
    if (error) { console.error('[knowledge] no pude contar el método por módulo:', error.message); return base; }
    if (!data) return base;
    const filas = sinLoAjeno(data as Array<{ area: string; fuente: string; workspace_id: number }>, wsPropio);
    const porArea = new Map<string, number>();
    const prestadasPorArea = new Map<string, number>();
    for (const f of filas) {
      porArea.set(f.area, (porArea.get(f.area) ?? 0) + 1);
      if (sePresta(f.fuente)) prestadasPorArea.set(f.area, (prestadasPorArea.get(f.area) ?? 0) + 1);
    }
    return base.map((m) => ({ ...m, fichas: porArea.get(m.area) ?? 0, prestables: prestadasPorArea.get(m.area) ?? 0 }));
  } catch (e) {
    console.error('[knowledge] no pude contar el método por módulo:', e instanceof Error ? e.message : e);
    return base;
  }
}

// El mapa que se DIBUJA (`mapaDelSecondBrain`, app/second-brain/pagina.tsx) todavía no muestra la capa de Knowledge:
// va por `unirCerebros` + física, que es otro camino que el de los chats. `armarKnowledge` ya acepta las cargas
// (`CargasKnowledge`, lib/cerebro-knowledge.ts) para cuando se sume; el puente se escribe ahí y no acá.

const ROTULO = (ms: readonly ModuloKnowledge[]) =>
  `EL MÉTODO DE LOS CURSOS QUE APLICA AQUÍ (Knowledge › ${ms.map((m) => m.nombre).join(' + ')}). Es método, no el dato del negocio: aplícalo, no lo copies textual`;

/**
 * El método que le corresponde a una tab, listo para pegar en su prompt. `tab` es la key del nav
 * (`copywriter`, `ads-writer`, …) y `pregunta` es lo que se está por contestar o escribir.
 *
 * Devuelve '' cuando no hay nada: ni rótulo vacío ni «todavía no cargaste método» —eso lo dice la pantalla, con el
 * dato, no un prompt (la regla de «sin falta si no hay dato»).
 */
export async function metodoDeTab(tab: string, pregunta: string, maxChars = 12_000): Promise<string> {
  const ms = modulosDeTab(tab);
  if (!ms.length) return '';
  const areas = areasDeTab(tab).filter((a) => !AREAS_RESERVADAS.includes(a));
  if (!areas.length) return '';
  try {
    // Por área, lo que haya. El tope se reparte entre las áreas de la tab: una tab con dos módulos no manda el doble.
    const porArea = Math.max(1_500, Math.floor(maxChars / areas.length));
    const trozos = (await Promise.all(areas.map((a) => metodologiaDeArea(a, pregunta, porArea).catch(() => '')))).filter((t) => t.trim());
    if (trozos.length) return `${ROTULO(ms)}:\n${trozos.join('\n\n')}`;
    // Ninguna de sus áreas tiene filas todavía: el RAG general, como antes de que Knowledge existiera.
    const general = formatKnowledge(await searchKnowledge(pregunta, 4).catch(() => []));
    return general ? `${ROTULO(ms)} — todavía sin destilar por módulo, va lo más cercano del conocimiento general:\n${general}` : '';
  } catch {
    return '';
  }
}

/**
 * El método de UN módulo, por su key. Es lo que pide la API de MaKo cuando el índice del prompt le dice que existe.
 * Sin filas, '' (y quien llama dice que todavía no hay nada: acá no se afirma).
 */
export async function metodoDeModulo(key: string, pregunta: string, maxChars = 12_000): Promise<string> {
  const m = moduloDeKey(key);
  if (!m) return '';
  return (await metodologiaDeArea(m.area, pregunta, maxChars).catch(() => '')).trim();
}
