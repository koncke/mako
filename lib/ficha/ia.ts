// =============================================================================
// ficha/ia — «¿Qué vas a crear hoy?» de una tab de la ficha: MaKo arma la tab con bloques del catálogo (puro)
// =============================================================================
// Martín, 16/10/2026: «Si nunca configuró una tab, y entra por primera vez al detail de un lead, que le salten los
// templates y el ¿Qué vas a crear hoy?». Es el pedido de hoja del Dashboard (lib/graficos-ia.ts) llevado a una tab:
// la persona dice en palabras qué quiere ver y MaKo elige bloques del catálogo de ESA tab. La caja es la de la casa
// (CajaPedido); la ruta, app/api/crm/ficha/armar; la cascada, ./ia-generar.ts.
//
// LAS DOS CAPAS (AGENTS.md, «una regla en un prompt no es una regla»):
//   1. el prompt pide ids del catálogo que se le pasa y nada más;
//   2. `deIATab` resuelve cada pieza contra el catálogo y decide qué entra. Es el `validar` de la cascada: una salida
//      inservible prueba el proveedor siguiente en vez de llegar a la pantalla.
//
// ⚠️ SÓLO SE OFRECE LO QUE SE DIBUJA: los bloques de la tab que tienen componente (el registro de la pantalla), como
//    «Agregar bloque». Un bloque sin componente no se dibuja: elegirlo sería armar una tab que se ve vacía.
// ⚠️ NINGÚN DATO DEL LEAD NI DEL NEGOCIO VIAJA AL MODELO: el catálogo (qué bloques EXISTEN) y el pedido. La tab se arma
//    una vez para todos los leads del funnel: no depende de un lead.
// ⚠️ El sanear CORRIGE en silencio (un ancho que el bloque no acepta cae al de entrada, ./config.ts). Sobre una salida
//    de IA eso dibuja otra cosa que la pedida sin que nadie lo sepa: `deIATab` compara lo pedido contra lo saneado y lo
//    anota en `avisos`.
//
// Puro y sin `server-only`: lo leen la ruta, la cascada, el registro de prompts y los tests.
// =============================================================================

import { contenidoNoConfiable } from '../prompt-render-pure';
import { bloquesDeLaTab, NOMBRE_TAB, type Ancho, type BloqueDef, type BloqueId, type TabFicha } from './catalogo';
import { sanearLista, type BloquePuesto } from './config';

/** La feature del registro de modelos (lib/model-catalogo.ts): gratis, sin fila en CLAUDE_PERMITIDO. */
export const FEATURE_TAB_IA = 'crm-ficha-tab-ia';
/** El tope del pedido (lo que se escribe en la caja). */
export const TOPE_PEDIDO_TAB = 600;
/** Cuántos bloques arma MaKo como mucho: una tab con más que eso ya es todo el catálogo. */
export const TOPE_BLOQUES_IA = 10;

const NOMBRE_ANCHO: Readonly<Record<Ancho, string>> = { 3: '1/4', 4: '1/3', 6: '1/2', 12: 'completo' };
const ANCHO_DE: Readonly<Record<string, Ancho>> = { '1/4': 3, '1/3': 4, '1/2': 6, completo: 12 };

/**
 * El system, registrado y editable en /configuraciones (lib/prompt-registry.ts: crm.ficha-tab-ia.system). SIN slots: el
 * catálogo y el pedido viajan en el mensaje user, así un override guardado no pierde un bloque nuevo. Corto a propósito:
 * cada token de más le resta salida a Groq. Es un template literal: adentro no va ningún backtick.
 */
export const TAB_IA_SYSTEM_TEMPLATE = `Armas UNA tab de la ficha de un lead en un CRM, con los bloques del catálogo que te paso. Devuelves SOLO un objeto JSON, sin texto alrededor:
{"epica":false,"bloques":[{"bloque":"<id>","ancho":"1/2","diseno":"<id>"}]}
Reglas:
- Usa SOLO ids de bloques y de diseños del catálogo, escritos igual. El ancho es uno de los que acepta ese bloque.
- Entre 2 y ${TOPE_BLOQUES_IA} bloques, en el orden en que se leen: arriba lo que más importa para el pedido.
- "epica": true si el pedido quiere algo grande, simple o con pocas cosas. Entonces van de 3 a 5 bloques, con diseños de número grande, banner o botonera.
- Si algo del pedido no está en el catálogo, déjalo afuera: no lo inventes.
- No escribas títulos, colores ni íconos: los pone el sistema.`;

/**
 * Los bloques que MaKo puede elegir en una tab: los del catálogo que tienen componente (`registrado`: el registro de la
 * pantalla, app/crm/lead-view/ficha/reglas.ts) y que no son privados (el coaching no va en la ficha de todos).
 */
export function ofrecidosParaIA(tab: TabFicha, registrado: (id: BloqueId) => boolean): BloqueDef[] {
  return bloquesDeLaTab(tab).filter((d) => registrado(d.id) && !d.privado);
}

/** El catálogo de la tab, en el orden del menú: id — nombre · anchos · diseños. */
export function catalogoDeTab(tab: TabFicha, ofrecidos: readonly BloqueDef[]): string {
  const filas = ofrecidos.map((d) => `- ${d.id} — ${d.titulo} · anchos: ${d.anchos.map((a) => NOMBRE_ANCHO[a]).join(', ')} · diseños: ${d.disenos.map((x) => `${x.id} (${x.nombre})`).join(', ')}`);
  return `CATÁLOGO DE LA TAB «${NOMBRE_TAB[tab]}»:\n${filas.join('\n')}`;
}

/** El mensaje user: el catálogo y el pedido, marcado como dato (no son instrucciones para el modelo). */
export function userDeTab(pedido: string, tab: TabFicha, ofrecidos: readonly BloqueDef[]): string {
  return `${catalogoDeTab(tab, ofrecidos)}\n\nEL PEDIDO:\n${contenidoNoConfiable(pedido.slice(0, TOPE_PEDIDO_TAB), 'pedido')}`;
}

export type ResultadoTabIA = {
  /** La lista ya saneada (`sanearLista`): lo que se guarda si la persona la usa. */
  bloques: BloquePuesto[];
  epica: boolean;
  /** Lo que se corrigió o se dejó afuera, en palabras (el primero va al toast). */
  avisos: string[];
  /** Lo que la hace inservible: con algo acá, la cascada prueba el proveedor siguiente. */
  errores: string[];
};

/**
 * LA SEGUNDA CAPA: lo que mandó el modelo, contra el catálogo de la tab. Entra lo que existe y se ofrece; se anota lo
 * que se corrigió. Es inservible si no queda ningún bloque (aparte de lo que no se puede quitar) o si más de la mitad
 * de lo pedido no existe.
 */
export function deIATab(obj: Record<string, unknown>, tab: TabFicha, ofrecidos: readonly BloqueDef[]): ResultadoTabIA {
  const avisos: string[] = [];
  const errores: string[] = [];
  const crudos = Array.isArray(obj.bloques) ? obj.bloques : [];
  if (!crudos.length) return { bloques: [], epica: false, avisos, errores: ['"bloques" vacío o ausente'] };
  const porId = new Map(ofrecidos.map((d) => [d.id, d] as const));
  const pedidos: Array<{ id: string; ancho?: Ancho; diseno?: string }> = [];
  let malos = 0;
  for (const x of crudos.slice(0, TOPE_BLOQUES_IA * 2)) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const id = typeof o.bloque === 'string' ? o.bloque.trim() : typeof o.id === 'string' ? o.id.trim() : '';
    const def = porId.get(id as BloqueDef['id']);
    if (!def) { malos++; errores.push(`«${id || '(sin id)'}» no es un bloque del catálogo de ${NOMBRE_TAB[tab]}`); continue; }
    if (pedidos.some((p) => p.id === id) && !def.varias) continue;
    const ancho = typeof o.ancho === 'string' ? ANCHO_DE[o.ancho.trim()] : undefined;
    if (ancho && !def.anchos.includes(ancho)) avisos.push(`${def.titulo} no va de ${o.ancho}: quedó de ${NOMBRE_ANCHO[def.ancho]}`);
    const diseno = typeof o.diseno === 'string' ? o.diseno.trim() : undefined;
    if (diseno && !def.disenos.some((d) => d.id === diseno)) avisos.push(`${def.titulo} no tiene el diseño «${diseno}»`);
    pedidos.push({ id, ancho: ancho && def.anchos.includes(ancho) ? ancho : undefined, diseno });
  }
  const bloques = sanearLista(pedidos.slice(0, TOPE_BLOQUES_IA).map((p) => ({ id: p.id, ancho: p.ancho ?? porId.get(p.id as BloqueDef['id'])!.ancho, diseno: p.diseno })), tab);
  if (pedidos.length > TOPE_BLOQUES_IA) avisos.push(`Quedaron los primeros ${TOPE_BLOQUES_IA} bloques`);
  // Lo que el saneo pone solo (el contacto del Resumen) no cuenta como algo que armó MaKo.
  const propios = bloques.filter((b) => pedidos.some((p) => p.id === b.id));
  const sirve = propios.length > 0 && malos <= pedidos.length;
  return { bloques, epica: obj.epica === true, avisos, errores: sirve ? [] : errores.length ? errores : ['ningún bloque del catálogo'] };
}
