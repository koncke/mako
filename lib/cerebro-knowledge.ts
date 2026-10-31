// =============================================================================
// cerebro-knowledge — Knowledge como CAPA del Second Brain, para que los chats la recuperen (31/10/2026)
// =============================================================================
// Martín pidió Knowledge «modular como el Second Brain». En este repo eso no es una metáfora: un módulo del Second
// Brain es una CAPA —un `Cerebro<string>` con su propia taxonomía que se cuelga de la raíz del negocio con `conCapa`
// (lib/cerebro-union.ts)—, y el molde exacto es lib/cerebro-funciones.ts («Lo que hace MaKo»). Esta es la segunda.
//
// POR QUÉ UNA CAPA Y NO MÁS TEXTO EN EL PROMPT: la recuperación barata (lib/cerebro-recuperar.ts) lee el grafo sin IA y
// con presupuesto, así que una pregunta que nombra «copy», «VSL» o «el método de anuncios» trae ESE módulo y sus
// vecinos, no el índice entero. El índice sí viaja siempre, pero en una línea por módulo y sin contenido
// (`bloqueDeModulos`, lib/knowledge-modulos.ts).
//
// LA FORMA (la de siempre, lib/cerebro-modelo.ts):
//   · la raíz es `n1:knowledge` (una carpeta: `esEstructura` la reconoce y no la cuenta como dato ni como vecino);
//   · un área por módulo, porque cada módulo es un tema y el color agrupa por tema;
//   · un nodo `kn:<key>` por módulo: el detalle es su «que», los datos van con claves de palabras vacías («De qué
//     cursos», «Dónde se usa», «Cuánto hay cargado») para que no siembren todos los módulos a la vez, y el cuerpo
//     lleva el detalle largo (viaja sólo cuando un chat pide el nodo por id con profundidad 0);
//   · las aristas: raíz → módulo, y módulo ↔ módulo cuando comparten una tab (el que escribe el anuncio y el que
//     escribe la landing se apoyan en los dos).
//
// PURO y sin `server-only`: sin base y sin física. Las cargas (cuánto método tiene cada módulo) ENTRAN por argumento,
// como `armarFunciones(fs)` recibe el catálogo: quien tiene la base las mide (lib/knowledge.ts) y acá sólo se dibujan.
// =============================================================================

import { coincide, paraBuscar } from './buscar-tareas';
import { CAPA_CONOCIMIENTO, type AristaCerebro, type Cerebro, type NodoCerebro, type Taxonomia } from './cerebro-modelo';
import { MODULOS_KNOWLEDGE, type ModuloKnowledge } from './knowledge-modulos';

export { CAPA_CONOCIMIENTO };
/** La carpeta madre de la capa: lo que cuelga de la raíz del negocio en el grafo de los chats. */
export const ID_RAIZ_KNOWLEDGE = 'n1:knowledge';
export const CARPETA_KNOWLEDGE = 'knowledge';
export const PUENTE_KNOWLEDGE = 'Lo que MaKo aprendió de los cursos y aplica a este negocio';
export const idModulo = (key: string): string => `kn:${key}`;
const idArea = (key: string): string => `kn-${key}`;

/** Un color del lienzo por módulo. Si alguien suma un módulo y se olvida de darle color, hereda el de los documentos. */
const COLOR: Record<string, string> = {
  anuncios: 'var(--grafo-cliente)',
  venta: 'var(--grafo-oferta)',
  organico: 'var(--grafo-razones)',
  oferta: 'var(--grafo-norte)',
  paginas: 'var(--grafo-panorama)',
  piezas: 'var(--grafo-documentos)',
  app: 'var(--grafo-documentos)',
};

/** Cuánto método tiene cargado cada módulo, por su key. Lo mide quien tiene la base; acá es opcional. */
export type CargasKnowledge = Readonly<Record<string, number>>;

export function taxonomiaKnowledge(ms: readonly ModuloKnowledge[]): Taxonomia {
  return {
    carpetas: [{ id: CARPETA_KNOWLEDGE, nombre: 'Knowledge', que: 'El método de los cursos, por tema: qué enseña cada módulo, de qué cursos sale y en qué tabs se usa.' }],
    areas: ms.map((m) => ({ id: idArea(m.key), padre: CARPETA_KNOWLEDGE, nombre: m.nombre, color: COLOR[m.key] ?? 'var(--grafo-documentos)', que: m.que })),
    capas: [{ id: CAPA_CONOCIMIENTO, nombre: 'Knowledge', carpetas: [CARPETA_KNOWLEDGE] }],
  };
}

/** Qué dice un módulo sobre lo que tiene cargado. Sin dato medido, no se afirma nada: no es lo mismo «cero» que «no sé». */
export function cuantoHay(m: ModuloKnowledge, cargas?: CargasKnowledge): string {
  if (!cargas) return '';
  const n = cargas[m.key] ?? 0;
  return n === 0 ? 'Todavía sin método cargado' : `${n} ${n === 1 ? 'ficha' : 'fichas'} de método`;
}

/** El nodo de un módulo. */
export function nodoDeModulo(m: ModuloKnowledge, cargas?: CargasKnowledge): NodoCerebro<string> {
  return {
    id: idModulo(m.key), area: idArea(m.key), tipo: 'Módulo de Knowledge', etiqueta: m.nombre,
    detalle: m.que,
    datos: [
      { k: 'De qué cursos', v: m.secciones.join(' · ') },
      { k: 'Dónde se usa', v: m.tabs.length ? m.tabs.join(', ') : 'Sólo la plataforma' },
      { k: 'Cuánto hay cargado', v: cuantoHay(m, cargas) },
    ],
    cuerpo: `${m.que}\n\nSale de las secciones del portal de cursos: ${m.secciones.join(', ')}.\nSu método se pide por el módulo «${m.key}».`,
    fuente: 'lib/knowledge-modulos.ts', autoria: 'mako',
    href: '/classroom/methodology', abrirEn: 'Knowledge',
  };
}

/** El grafo de Knowledge, sin física (los chats no usan posiciones). */
export function armarKnowledge(ms: readonly ModuloKnowledge[] = MODULOS_KNOWLEDGE, cargas?: CargasKnowledge): Cerebro<string> {
  const nodos: NodoCerebro<string>[] = [{
    id: ID_RAIZ_KNOWLEDGE, area: idArea(ms[0]?.key ?? 'anuncios'), tipo: 'Carpeta', etiqueta: 'Knowledge',
    detalle: `Los ${ms.length} módulos del método de los cursos: qué enseña cada uno y en qué tabs se usa.`,
    fuente: 'lib/knowledge-modulos.ts', autoria: 'mako', href: '/classroom/methodology', abrirEn: 'Knowledge',
  }, ...ms.map((m) => nodoDeModulo(m, cargas))];
  const aristas: AristaCerebro[] = ms.map((m) => ({ de: ID_RAIZ_KNOWLEDGE, a: idModulo(m.key), motivo: `Un módulo del método: ${m.nombre}` }));
  // Dos módulos que trabajan en la misma tab se nombran entre sí: el que escribe el anuncio y el que escribe la página
  // de venta se apoyan en los dos, y sin la arista una pregunta sobre uno no trae al otro.
  const vistas = new Set<string>();
  for (const a of ms) {
    for (const b of ms) {
      if (a.key === b.key) continue;
      const juntas = a.tabs.filter((t) => b.tabs.includes(t));
      if (!juntas.length) continue;
      const par = [a.key, b.key].sort().join('|');
      if (vistas.has(par)) continue;
      vistas.add(par);
      aristas.push({ de: idModulo(a.key), a: idModulo(b.key), motivo: `Se usan juntos en ${juntas.join(', ')}` });
    }
  }
  return {
    negocio: 'MaKo', nodos, aristas,
    cuenta: { total: ms.length, mako: ms.length, usuario: 0, pendientes: 0 }, vacias: [],
    posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 },
    taxonomia: taxonomiaKnowledge(ms),
  };
}

let cache: Cerebro<string> | null = null;
/** El grafo de Knowledge SIN cargas, una vez por proceso (el catálogo es código: cambia con un deploy). */
export function knowledgeDeMako(): Cerebro<string> {
  cache ??= armarKnowledge();
  return cache;
}

// ── ¿La pregunta es sobre el MÉTODO? ──────────────────────────────────────────────────────────────────────────────────
// El mismo problema que tuvo la capa de las funciones: los nombres de los módulos son también palabras del negocio
// («oferta», «anuncios», «venta»), así que nombrar un módulo NO alcanza para meter la capa en el turno — «¿cuál es mi
// oferta?» pregunta por la oferta del negocio, que ya está en el prompt, no por el método de armar una. La capa entra
// cuando la pregunta pide el MÉTODO: lo dice con una palabra de método, o nombra un módulo Y una de esas palabras.

/** Las palabras que piden el método, no el dato. */
const DE_METODO = /(?<![\p{L}\p{N}])(?:m[eé]todo|metodolog[ií]a|knowledge|playbook|curso(?:s)?|clase(?:s)?|c[oó]mo se (?:hace|escribe|arma|estructura|construye)|buenas pr[aá]cticas|mejores pr[aá]cticas|qu[eé] dice(?:n)? (?:el|los) curso|seg[uú]n (?:el|los) curso|framework|f[oó]rmula|plantilla de|gui[oó]n(?:es)? al estilo|al estilo de)(?![\p{L}\p{N}])/iu;

export function esPreguntaDeConocimiento(pregunta: string, ms: readonly ModuloKnowledge[] = MODULOS_KNOWLEDGE): boolean {
  const q = pregunta.trim();
  if (!q) return false;
  if (DE_METODO.test(q)) return true;
  // Sin palabra de método, el nombre del módulo solo no alcanza. Lo que sí alcanza es nombrar la capa por su nombre.
  return ms.some((m) => coincide(q, `${paraBuscar(m.nombre)} `) && /(?<![\p{L}\p{N}])knowledge(?![\p{L}\p{N}])/iu.test(q));
}

/** El grafo sin la capa de Knowledge (sus nodos `kn:`, su carpeta y sus aristas): para una pregunta del negocio. */
export function sinKnowledge<C extends Pick<Cerebro<string>, 'nodos' | 'aristas'>>(c: C): C {
  const esDeLaCapa = (id: string) => id === ID_RAIZ_KNOWLEDGE || id.startsWith('kn:') || id.startsWith(`${CAPA_CONOCIMIENTO}:`);
  if (!c.nodos.some((n) => esDeLaCapa(n.id))) return c;
  return { ...c, nodos: c.nodos.filter((n) => !esDeLaCapa(n.id)), aristas: c.aristas.filter((a) => !esDeLaCapa(a.de) && !esDeLaCapa(a.a)) };
}
