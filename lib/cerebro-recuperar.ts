// =============================================================================
// cerebro-recuperar — lo que un CHAT trae del Second Brain: sólo los nodos que le sirven (17/10/2026)
// =============================================================================
// Punto 13 del feedback de Martín del 17/10: «MUY IMPORTANTE: que sirva para los CHATS. El grafo modulariza los datos
// del negocio para AHORRAR TOKENS: un chat (MaKo o un jefe) trae sólo los nodos que le hacen falta y no todo el
// contexto». El diseño está en docs/diseno-second-brain-grafo.md → «Cómo lo consume un chat».
//
// DOS PEDIDOS, copiados de GraphRAG (Microsoft) y de la vista local de Obsidian:
//   · EL ÍNDICE (la búsqueda «global» de GraphRAG): las carpetas y las áreas con cuántos datos tiene cada una y una
//     línea de qué son, más los puntos fijos (el Norte, el cuello, los leads). Es lo primero que pide un chat para
//     saber qué hay. Unos cientos de tokens.
//   · LA VISTA LOCAL (la búsqueda «local»): las SEMILLAS que nombra la pregunta (o los ids que el chat pide), sus
//     vecinos a un salto por las aristas, y un paquete de una línea por nodo hasta el presupuesto de tokens.
//
// SIN IA, a propósito: las semillas salen de las palabras de la pregunta (la misma búsqueda del grafo, con tildes,
// plurales y frontera de palabra: lib/buscar-tareas.ts → coincide) y de un mapa chico de sinónimos del negocio («cobro»
// lleva a la oferta y los productos aunque ningún nodo diga «cobro»). Así recuperar no cuesta un token de modelo, que
// es justamente lo que se quiere ahorrar. Si algún día hace falta por significado, se suma como otra fuente de semillas.
//
// PURO: recibe el Cerebro ya armado. Lo usan las dos operaciones de la API de MaKo (lib/api-mako/areas/negocio.*) y la
// medición (scripts/medir-recuperacion.ts). Lo prueba tests/second-brain-recuperar.test.ts.
// =============================================================================

import { coincide, paraBuscar } from './buscar-tareas';
import { TAXONOMIA_NEGOCIO, type Cerebro, type NodoCerebro } from './cerebro-modelo';
import { esEstructura, gradosDe, tipoDeNodo } from './cerebro-areas';

type Nodo = NodoCerebro<string>;
type Grafo = Pick<Cerebro<string>, 'negocio' | 'nodos' | 'aristas' | 'taxonomia'>;

/** Tokens de un texto, estimados: ~4 caracteres por token (la regla de Anthropic para texto en español e inglés). Es
 *  una ESTIMACIÓN y se dice así: alcanza para comparar dos paquetes, no para facturar. */
export const tokensDe = (s: string): number => Math.ceil(s.length / 4);

export const PRESUPUESTO_DEFECTO = 1500;
export const PRESUPUESTO_MAX = 6000;
/** Cuánto del detalle de un nodo entra en su línea (el resto, con `ids` y profundidad 0, entero), y en la de un vecino. */
const DETALLE_LINEA = 220;
const DETALLE_VECINO = 110;
/** Cuántos vecinos se traen por nodo de la frontera, y cuántos se nombran en la línea de una semilla. */
const VECINOS_POR_NODO = 4;

/** Las palabras que no dicen nada en una pregunta («¿qué es lo que vendo?» → «vendo»). */
const VACIAS = new Set(('el la los las un una unos unas de del al a y o u e en con sin por para que qué cual cuál cuales '
  + 'como cómo cuando cuándo donde dónde quien quién es son esta este esto estos estas ese esa eso mi mis tu tus su sus '
  + 'lo le les se me te nos ya hay ser tengo tiene tienen tenemos hace hacer puedo puede sobre entre mas más muy todo '
  + 'toda todos todas algo alguno dame decime dime muestra mostrame quiero necesito saber cuanto cuánto cuantos cuántos').split(' '));

/**
 * Las palabras del dueño que no están en ningún nodo, y el ÁREA a la que llevan. Es el puente lexical que en GraphRAG
 * hacen los embeddings: chico, a mano y verificable. Las claves van normalizadas (sin tildes, minúsculas).
 */
const SINONIMOS: Record<string, string[]> = {
  cobro: ['oferta', 'productos'], cobras: ['oferta', 'productos'], cobrar: ['oferta', 'productos'], precio: ['oferta', 'productos'],
  precios: ['oferta', 'productos'], cuesta: ['oferta', 'productos'], vale: ['oferta', 'productos'], ticket: ['oferta', 'productos'],
  vendo: ['oferta', 'productos'], vendes: ['oferta', 'productos'], venta: ['oferta', 'funnel'], ventas: ['oferta', 'funnel'],
  garantia: ['oferta'], promesa: ['oferta'], bono: ['oferta'], bonos: ['oferta'],
  cliente: ['cliente', 'avatares'], clientes: ['cliente', 'avatares'], publico: ['cliente', 'avatares'], audiencia: ['avatares'],
  nicho: ['cliente'], dolor: ['cliente'], objecion: ['cliente'], objeciones: ['cliente'],
  anuncio: ['razones'], anuncios: ['razones'], ads: ['razones', 'avatares'], creativo: ['razones'], creativos: ['razones'], meta: ['avatares'],
  angulo: ['razones'], angulos: ['razones'], hook: ['razones'], gancho: ['razones', 'entregables'],
  lead: ['funnel'], leads: ['funnel'], prospecto: ['funnel'], prospectos: ['funnel'], etapa: ['funnel'], etapas: ['funnel'],
  agenda: ['funnel'], llamada: ['funnel'], cierre: ['funnel', 'norte'], cierres: ['funnel', 'norte'], embudo: ['funnel'],
  voz: ['voz'], tono: ['voz'], marca: ['voz'], hablo: ['voz'], suena: ['voz'], escribo: ['voz'],
  fase: ['norte'], objetivo: ['norte'], objetivos: ['norte'], kpi: ['norte'], kpis: ['norte'], freno: ['norte'],
  documento: ['documentos'], documentos: ['documentos'], archivo: ['documentos'], archivos: ['documentos'],
  resumen: ['panorama'], negocio: ['panorama'],
};

/** Las palabras que cuentan de una pregunta, normalizadas. Los NÚMEROS cuentan aunque sean cortos: «el avatar 3» es
 *  pedir uno puntual, y sin el 3 la pregunta trae a los veinte avatares por igual. */
export function palabrasDe(pregunta: string): string[] {
  return [...new Set(paraBuscar(pregunta).split(' ').filter((w) => /^\d+$/.test(w) || (w.length >= 3 && !VACIAS.has(w))))];
}

/** El texto de un nodo donde se busca más allá del nombre: su detalle, sus datos y su tipo. */
const textoDe = (n: Nodo) => `${n.detalle} ${(n.datos ?? []).map((d) => `${d.k} ${d.v}`).join(' ')} ${tipoDeNodo(n)}`;

/**
 * Las SEMILLAS de una pregunta, de la más a la menos pertinente: una palabra en el NOMBRE vale 3, en el detalle o los
 * datos 1, y un sinónimo que lleva a un área suma sus nodos más conectados (los que resumen esa parte del negocio).
 */
export function semillasDe(c: Grafo, pregunta: string, tope = 8): Nodo[] {
  const palabras = palabrasDe(pregunta);
  if (!palabras.length) return [];
  const grados = gradosDe(c.nodos, c.aristas);
  const puntos = new Map<string, number>();
  const sumar = (id: string, p: number) => puntos.set(id, (puntos.get(id) ?? 0) + p);
  const datos = c.nodos.filter((n) => !esEstructura(n));
  for (const w of palabras) {
    for (const n of datos) {
      if (coincide(n.etiqueta, `${w} `)) sumar(n.id, 3);
      else if (coincide(textoDe(n), `${w} `)) sumar(n.id, 1);
    }
    for (const area of SINONIMOS[w] ?? []) {
      const deArea = datos.filter((n) => n.area === area && n.autoria !== 'pendiente').sort((a, b) => (grados[b.id] ?? 0) - (grados[a.id] ?? 0));
      for (const n of deArea.slice(0, 3)) sumar(n.id, 2);
    }
  }
  return datos
    .filter((n) => puntos.has(n.id))
    .sort((a, b) => (puntos.get(b.id)! - puntos.get(a.id)!) || ((grados[b.id] ?? 0) - (grados[a.id] ?? 0)) || (a.id < b.id ? -1 : 1))
    .slice(0, tope);
}

/** EL ÍNDICE: las carpetas y las áreas con su conteo y una línea, y los puntos fijos. Lo primero que pide un chat. */
export function indiceDelCerebro(c: Grafo): string {
  const tax = c.taxonomia ?? TAXONOMIA_NEGOCIO;
  const datos = c.nodos.filter((n) => !esEstructura(n));
  const lineas = [`# ${c.negocio}: el índice del Second Brain`, `${datos.filter((n) => n.autoria !== 'pendiente').length} datos. Pide la vista local con una pregunta o con ids.`];
  for (const carpeta of tax.carpetas) {
    const areas = tax.areas.filter((a) => a.padre === carpeta.id);
    if (!areas.length) continue;
    lineas.push('', `## ${carpeta.nombre}`);
    for (const a of areas) {
      const suyos = datos.filter((n) => n.area === a.id);
      const reales = suyos.filter((n) => n.autoria !== 'pendiente');
      const ejemplos = reales.slice(0, 3).map((n) => `${n.etiqueta} [${n.id}]`).join(', ');
      lineas.push(`- ${a.nombre} (${reales.length || 'falta'}): ${a.que}${ejemplos ? ` Ej.: ${ejemplos}.` : ''}`);
    }
  }
  const fijos = c.nodos.filter((n) => n.destacado || n.alerta || n.id === 'leads');
  if (fijos.length) lineas.push('', '## Puntos fijos', ...fijos.map((n) => `- ${tipoDeNodo(n)}: ${n.etiqueta} [${n.id}]`));
  return lineas.join('\n');
}

export type PedidoRecuperar = {
  /** La pregunta del chat, en palabras del dueño. */
  pregunta?: string;
  /** Ids que el chat ya conoce (del índice o de una vista anterior). */
  ids?: readonly string[];
  /** Cuántos saltos por las aristas: 0 = sólo las semillas (enteras), 1 = sus vecinos (default), 2 = los vecinos de ésos. */
  profundidad?: number;
  /** Tokens estimados del paquete (default 1.500, tope 6.000). */
  presupuesto?: number;
};

export type Paquete = {
  modo: 'vista-local' | 'indice';
  texto: string;
  /** Tokens estimados del texto (`tokensDe`). */
  tokens: number;
  semillas: string[];
  /** Los nodos que entraron, en el orden del paquete. */
  nodos: string[];
  /** Cuántos nodos de la vista local no entraron en el presupuesto. */
  quedaronAfuera: number;
};

const recortar = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max).trimEnd()}…`);

/**
 * La línea de una SEMILLA: `- [Tipo] Nombre [id] — detalle · k: v; k: v · ↔ vecino [id], …`. La de un VECINO es corta
 * (`  - [Tipo] Nombre [id] — detalle`, sin sus vecinos ni más de dos datos): medido en el ws 3 (17/10/2026), con la
 * línea larga para todos, la pregunta de los leads traía 708 tokens contra 678 del grafo ENTERO — cada etapa repetía
 * la cadena de las otras.
 */
function lineaDe(n: Nodo, vecinos: Nodo[], como: 'semilla' | 'entera' | 'vecino'): string {
  const entero = como === 'entera';
  const det = (entero ? n.detalle : recortar(n.detalle.replace(/\s+/g, ' '), como === 'vecino' ? DETALLE_VECINO : DETALLE_LINEA)).trim();
  const ds = (n.datos ?? []).filter((d) => d.v?.trim());
  const datos = (como === 'vecino' ? ds.slice(0, 2) : ds).map((d) => `${d.k}: ${entero ? d.v : recortar(d.v, como === 'vecino' ? 60 : 120)}`).join('; ');
  const cuerpo = entero && n.cuerpo ? `\n  ${n.cuerpo.replace(/\n+/g, '\n  ')}` : '';
  const ve = como === 'vecino' ? '' : vecinos.slice(0, VECINOS_POR_NODO).map((v) => `${v.etiqueta} [${v.id}]`).join(', ');
  const sangria = como === 'vecino' ? '  ' : '';
  return `${sangria}- [${tipoDeNodo(n)}] ${n.etiqueta} [${n.id}]${det ? ` — ${det}` : ''}${datos ? ` · ${datos}` : ''}${ve ? ` · ↔ ${ve}` : ''}${cuerpo}`;
}

/** LA VISTA LOCAL: semillas + vecinos a `profundidad` saltos, en un paquete con presupuesto. Sin semillas, el índice. */
export function recuperar(c: Grafo, pedido: PedidoRecuperar): Paquete {
  const presupuesto = Math.min(PRESUPUESTO_MAX, Math.max(200, Math.round(pedido.presupuesto ?? PRESUPUESTO_DEFECTO)));
  const profundidad = Math.min(2, Math.max(0, Math.round(pedido.profundidad ?? 1)));
  const porId = new Map(c.nodos.map((n) => [n.id, n]));
  const pedidos = (pedido.ids ?? []).map((id) => porId.get(id)).filter((n): n is Nodo => !!n && n.id !== 'raiz');
  const semillas = [...new Map([...pedidos, ...semillasDe(c, pedido.pregunta ?? '')].map((n) => [n.id, n])).values()];
  if (!semillas.length) {
    const texto = indiceDelCerebro(c);
    return { modo: 'indice', texto, tokens: tokensDe(texto), semillas: [], nodos: [], quedaronAfuera: 0 };
  }

  const grados = gradosDe(c.nodos, c.aristas);
  const vecinosDe = new Map<string, Nodo[]>();
  for (const a of c.aristas) {
    const x = porId.get(a.de);
    const y = porId.get(a.a);
    if (!x || !y) continue;
    vecinosDe.set(x.id, [...(vecinosDe.get(x.id) ?? []), y]);
    vecinosDe.set(y.id, [...(vecinosDe.get(y.id) ?? []), x]);
  }
  // Los vecinos que son ESTRUCTURA (la raíz, un área, una carpeta) no entran como líneas: no dicen nada del negocio que
  // la semilla no diga, y el área de cada nodo ya se lee en su tipo.
  const vecinosUtiles = (id: string) => (vecinosDe.get(id) ?? []).filter((v) => !esEstructura(v) && v.autoria !== 'pendiente')
    .sort((a, b) => (grados[b.id] ?? 0) - (grados[a.id] ?? 0));

  const orden: Nodo[] = [...semillas];
  const vistos = new Set(orden.map((n) => n.id));
  let frontera = semillas;
  for (let salto = 0; salto < profundidad; salto++) {
    const siguiente: Nodo[] = [];
    for (const n of frontera) for (const v of vecinosUtiles(n.id).slice(0, VECINOS_POR_NODO)) if (!vistos.has(v.id)) { vistos.add(v.id); siguiente.push(v); }
    orden.push(...siguiente);
    frontera = siguiente;
  }

  const cabeza = `# ${c.negocio}: lo que el Second Brain sabe${pedido.pregunta?.trim() ? ` sobre «${recortar(pedido.pregunta.trim(), 120)}»` : ''}`;
  let texto = cabeza;
  const entraron: string[] = [];
  for (const n of orden) {
    // Las semillas pedidas por id con profundidad 0 van ENTERAS (es pedir el detalle de algo puntual).
    const esSemilla = semillas.some((x) => x.id === n.id);
    const linea = lineaDe(n, vecinosUtiles(n.id), !esSemilla ? 'vecino' : profundidad === 0 && pedidos.some((p) => p.id === n.id) ? 'entera' : 'semilla');
    if (tokensDe(`${texto}\n${linea}`) > presupuesto && entraron.length) break;
    texto += `\n${linea}`;
    entraron.push(n.id);
  }
  const afuera = orden.length - entraron.length;
  if (afuera > 0) texto += `\n_Quedaron afuera ${afuera} nodos de la vista: pídelos por id o sube el presupuesto._`;
  return { modo: 'vista-local', texto, tokens: tokensDe(texto), semillas: semillas.map((n) => n.id), nodos: entraron, quedaronAfuera: afuera };
}
