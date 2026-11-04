// =============================================================================
// cerebro-referente — el Second Brain de UN gurú: su curso entero, clase por clase (2/11/2026)
// =============================================================================
// Martín: «me gustaría que se lea entero los cursos, que no haya limitación de caracteres ni nada
// de eso, justamente la idea es que el segundo cerebro de estos gurús tenga todo el contexto».
//
// ⚠️ ESTO NO ES LA FICHA, Y CONFUNDIRLOS ERA EL ERROR. Son dos piezas con dos trabajos:
//
//   | | la ficha (`lib/asesores/ficha-<id>.ts`) | esta capa |
//   |---|---|---|
//   | qué es | cómo piensa, qué pregunta, cómo habla | el curso ENTERO, clase por clase |
//   | cuándo viaja | **en cada mensaje, siempre** | **sólo cuando la pregunta lo pide** |
//   | por eso | tope de 5.200 caracteres | **sin tope** |
//
// Sacarle el tope a la ficha metería las 740 KB de un curso en CADA turno de cada chat: caro, lento
// y peor de leer para el modelo, porque el método se ahoga entre el relleno. Lo que Martín quiere
// —«todo el contexto»— se resuelve de este lado.
//
// CÓMO FUNCIONA, y es el mismo mecanismo que `lib/cerebro-knowledge.ts` (31/10) cuelga para
// Knowledge: **el ÍNDICE viaja siempre** —una línea por clase, SIN el texto— y **el cuerpo largo de
// un nodo viaja sólo cuando el chat lo pide por id** (`lib/cerebro-recuperar.ts`, sin IA y con
// presupuesto). Preguntarle algo a Alborna trae la clase donde él lo explica, con sus palabras y
// completa, en vez de un resumen.
//
// ⚠️ ESTE ARCHIVO ES PURO: recibe las clases ya leídas y devuelve el grafo. No toca el disco ni la
// base, así que los tests lo EJECUTAN. Quién lee `public/cono-tx/<videoId>.json` es otro problema y
// vive del lado del servidor — meterlo acá haría este módulo intesteable, que es exactamente por lo
// que `lib/spy.ts` no se puede probar.
// =============================================================================

import { CAPA_CONOCIMIENTO, type AristaCerebro, type Cerebro, type NodoCerebro, type Taxonomia } from './cerebro-modelo';
import { palabrasDe } from './cerebro-recuperar';
import { paraBuscar } from './buscar-tareas';

export { CAPA_CONOCIMIENTO };

/** El `tipo` de un nodo de clase: así lo reconoce quien arma lo que viaja en el turno. */
export const TIPO_CLASE = 'Clase del curso';

/** Una clase del curso, con su texto COMPLETO. El texto no se recorta: ése es todo el punto. */
export type ClaseDeCurso = {
  /** El id del video, que es como se llama su archivo en `public/cono-tx/`. */
  videoId: string;
  titulo: string;
  /** Su lugar en el curso, desde 1. Dos clases seguidas se nombran entre sí. */
  orden: number;
  /** La transcripción entera, ya unida. Sin tope. */
  texto: string;
  /** El módulo del curso al que pertenece (su `grupo` en Knowledge): la sección de su Second Brain. */
  modulo?: string;
};

/** Lo poco que hace falta saber del referente para armar su capa. Sale de `lib/asesores/catalogo.ts`. */
export type ReferenteDelCerebro = {
  id: string;
  nombre: string;
  completo: string;
  especialidad: string;
  curso: string;
};

export const carpetaDeReferente = (id: string): string => `referente-${id}`;
export const idRaizDeReferente = (id: string): string => `ref:${id}`;
export const idDeClase = (id: string, videoId: string): string => `ref:${id}:${videoId}`;

/** Cuántos caracteres de curso hay detrás de esta capa. Es el dato que dice si vale la pena abrirla. */
export const pesoDelCurso = (clases: readonly ClaseDeCurso[]): number =>
  clases.reduce((n, c) => n + c.texto.length, 0);

/** Un resumen de una línea para el ÍNDICE. Nunca el texto: el índice viaja en cada turno. */
export function lineaDeClase(c: ClaseDeCurso): string {
  const miles = Math.round(c.texto.length / 1000);
  return `${c.titulo} — ${miles > 0 ? `${miles} mil caracteres` : 'sin transcripción'}`;
}

export function taxonomiaDeReferente(r: ReferenteDelCerebro): Taxonomia {
  const carpeta = carpetaDeReferente(r.id);
  return {
    carpetas: [{ id: carpeta, nombre: r.completo, que: `El curso «${r.curso}» entero, clase por clase, con las palabras del instructor.` }],
    areas: [{ id: `${carpeta}-clases`, padre: carpeta, nombre: r.especialidad, color: 'var(--grafo-documentos)', que: `Lo que ${r.nombre} enseña sobre ${r.especialidad.toLowerCase()}.` }],
    capas: [{ id: CAPA_CONOCIMIENTO, nombre: 'Knowledge', carpetas: [carpeta] }],
  };
}

/** El nodo de UNA clase. El `cuerpo` es la transcripción completa y NO se recorta. */
export function nodoDeClase(r: ReferenteDelCerebro, c: ClaseDeCurso): NodoCerebro<string> {
  return {
    id: idDeClase(r.id, c.videoId),
    area: `${carpetaDeReferente(r.id)}-clases`,
    tipo: TIPO_CLASE,
    etiqueta: c.titulo,
    // El DETALLE es lo que viaja en el índice: una línea, sin el texto.
    detalle: lineaDeClase(c),
    datos: [
      { k: 'Curso', v: r.curso },
      { k: 'Clase', v: String(c.orden) },
      ...(c.modulo ? [{ k: 'Módulo', v: c.modulo }] : []),
    ],
    // ⚠️ ACÁ VA EL CURSO ENTERO Y NO SE TOPEA. Es el pedido de Martín, y es seguro porque este
    // cuerpo viaja SÓLO cuando un chat lo pide por id.
    cuerpo: c.texto,
    fuente: `public/cono-tx/${c.videoId}.json`,
    autoria: 'mako',
  };
}

/**
 * La capa de un referente: su raíz, una clase por nodo, y las clases encadenadas en orden.
 *
 * ⚠️ LAS CLASES SE ENCADENAN (1→2→3) a propósito. Un curso tiene orden y el método se construye
 * encima de lo anterior: sin la arista, una pregunta que cae en la clase 7 no trae la 6, donde está
 * la mitad del razonamiento. Es la misma idea que los módulos de Knowledge que comparten tab.
 */
export function armarReferente(r: ReferenteDelCerebro, clases: readonly ClaseDeCurso[]): Cerebro<string> {
  const enOrden = [...clases].sort((a, b) => a.orden - b.orden);
  const raiz = idRaizDeReferente(r.id);
  const miles = Math.round(pesoDelCurso(enOrden) / 1000);
  const nodos: NodoCerebro<string>[] = [
    {
      id: raiz,
      area: `${carpetaDeReferente(r.id)}-clases`,
      tipo: 'Carpeta',
      etiqueta: r.completo,
      detalle: enOrden.length
        ? `«${r.curso}»: ${enOrden.length} ${enOrden.length === 1 ? 'clase' : 'clases'}, ${miles} mil caracteres.`
        : `«${r.curso}»: todavía sin transcripciones cargadas.`,
      fuente: 'lib/asesores/catalogo.ts',
      autoria: 'mako',
    },
    ...enOrden.map((c) => nodoDeClase(r, c)),
  ];
  const aristas: AristaCerebro[] = enOrden.map((c) => ({
    de: raiz, a: idDeClase(r.id, c.videoId), motivo: `Una clase de «${r.curso}»: ${c.titulo}`,
  }));
  for (let i = 1; i < enOrden.length; i++) {
    aristas.push({
      de: idDeClase(r.id, enOrden[i - 1].videoId),
      a: idDeClase(r.id, enOrden[i].videoId),
      motivo: 'La clase siguiente: el método se construye encima de la anterior',
    });
  }
  return {
    negocio: 'MaKo', nodos, aristas,
    // `pendientes` es 0 y `usuario` también: esto no lo cargó nadie del negocio, es el curso.
    cuenta: { total: nodos.length, mako: nodos.length, usuario: 0, pendientes: 0 },
    vacias: [],
    // Sin física: los chats no usan posiciones, y calcularlas acá metería d3-force en este camino.
    posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 },
    taxonomia: taxonomiaDeReferente(r),
  };
}

// ── LO QUE VIAJA EN EL TURNO de un chat con el gurú al frente (3/11/2026) ──────────────────────────
//
// ⚠️ EL CUERPO DE UNA CLASE NO VIAJABA NUNCA, y el diagnóstico obvio era el equivocado. Se había
// colgado la capa en el grafo del turno confiando en que `recuperar` trae «el cuerpo de una clase si
// la pregunta la nombra». No lo hace: `recuperar` sólo pone el `cuerpo` de un nodo pedido POR ID y
// con profundidad 0 (lib/cerebro-recuperar.ts, `lineaDe` → `entera`). En el turno no hay ids, así que
// el chat veía «Título — 18 mil caracteres» y nunca una palabra del curso. Y la herramienta que sí
// pide por id lee `grafoParaChat()`, que no tiene la capa: preguntar por la clase traía el índice.
//
// Por eso el curso va en un bloque PROPIO, que elige TRAMOS y no clases: las clases van de 2,4 mil a
// 58 mil caracteres (medido el 3/11 en los dos cursos cargados), así que una clase entera por turno
// es o nada o media conversación. Un tramo de ~3 mil caracteres trae el pedazo donde el gurú habla
// de lo que se preguntó, con sus palabras.

/** Cuántos caracteres del curso viajan en un turno con el gurú al frente (~6.000 tokens). El índice va aparte. */
export const PRESUPUESTO_CURSO_TURNO = 24_000;
/** El largo de un tramo: lo que se elige de una clase. */
export const LARGO_TRAMO = 3_000;

/** Una clase en tramos de `largo`, cortados en un punto (o en un espacio) para no partir una frase. */
export function tramosDe(texto: string, largo = LARGO_TRAMO): string[] {
  const t = texto.replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    let fin = Math.min(t.length, i + largo);
    if (fin < t.length) {
      const punto = t.lastIndexOf('. ', fin);
      const espacio = t.lastIndexOf(' ', fin);
      fin = punto > i + largo * 0.6 ? punto + 1 : espacio > i ? espacio : fin;
    }
    const tramo = t.slice(i, fin).trim();
    if (tramo) out.push(tramo);
    i = fin;
  }
  return out;
}

/** La raíz de una palabra para comparar: «anuncios» y «anuncio» cuentan igual. */
const raiz = (w: string): string => (w.length > 5 ? w.slice(0, -2) : w);

/** Cuánto habla un texto de la pregunta: cada palabra suya que aparece suma, y repetida suma un poco más (hasta 3). */
function puntosDe(texto: string, raices: readonly string[]): number {
  const cuenta = new Map<string, number>();
  for (const w of paraBuscar(texto).split(' ')) {
    for (const r of raices) if (w.startsWith(r)) cuenta.set(r, (cuenta.get(r) ?? 0) + 1);
  }
  let p = 0;
  for (const n of cuenta.values()) p += 1 + Math.min(n, 3) * 0.5;
  return p;
}

const ordenDeClase = (n: NodoCerebro<string>): number => Number(n.datos?.find((d) => d.k === 'Clase')?.v) || 0;

/**
 * El bloque del curso para el system del turno: SIEMPRE la lista de clases (una línea, con su id, para
 * pedir una entera) y los tramos que hablan de la pregunta, hasta `presupuesto` caracteres, en el orden
 * del curso. Sin una palabra de la pregunta en el curso, sólo la lista: no se rellena con la clase 1.
 * Vacío si la capa no tiene clases.
 */
export function cursoParaElTurno(
  capa: Pick<Cerebro<string>, 'nodos'>,
  r: Pick<ReferenteDelCerebro, 'nombre' | 'completo' | 'curso'>,
  pregunta: string,
  presupuesto = PRESUPUESTO_CURSO_TURNO,
): string {
  const clases = capa.nodos.filter((n) => n.tipo === TIPO_CLASE && n.cuerpo).sort((a, b) => ordenDeClase(a) - ordenDeClase(b));
  if (!clases.length) return '';
  const raices = palabrasDe(pregunta).map(raiz);
  const candidatos = raices.length ? clases.flatMap((c) => {
    // El título de la clase vale doble: si la clase se llama como la pregunta, es ésa.
    const extra = puntosDe(c.etiqueta, raices) * 2;
    const tramos = tramosDe(c.cuerpo ?? '');
    return tramos.map((texto, i) => ({ c, i, de: tramos.length, texto, puntos: puntosDe(texto, raices) + extra }));
  }).filter((t) => t.puntos > 0) : [];
  // Los mejores primero; a igual puntaje, el que va antes en el curso.
  candidatos.sort((a, b) => b.puntos - a.puntos || ordenDeClase(a.c) - ordenDeClase(b.c) || a.i - b.i);
  const elegidos: typeof candidatos = [];
  let usados = 0;
  for (const t of candidatos) {
    if (elegidos.length && usados + t.texto.length > presupuesto) continue;
    elegidos.push(t);
    usados += t.texto.length;
    if (usados >= presupuesto) break;
  }
  elegidos.sort((a, b) => ordenDeClase(a.c) - ordenDeClase(b.c) || a.i - b.i);

  const lista = clases.map((c) => `${ordenDeClase(c)}. ${c.etiqueta} [${c.id}]`).join('\n');
  const cabeza = `EL CURSO DE ${r.completo.toUpperCase()} («${r.curso}»), CON SUS PALABRAS. Es la fuente de este chat: contesta con lo que enseña aquí y di de qué clase sale («en la clase 3, ${r.nombre} explica…»). Lo que el curso no dice, no se lo atribuyas. Para leer una clase entera, pídela con recuperar_del_segundo_cerebro, con su id y profundidad 0.`;
  const tramos = elegidos.length
    ? `LO QUE DICE SOBRE ESTA PREGUNTA:\n${elegidos.map((t) => `### Clase ${ordenDeClase(t.c)} · «${t.c.etiqueta}» [${t.c.id}]${t.de > 1 ? ` (tramo ${t.i + 1} de ${t.de})` : ''}\n${t.texto}`).join('\n\n')}`
    : 'Ninguna clase nombra lo que se preguntó: contesta con su ficha y, si hace falta, pide la clase que corresponda por su id.';
  return `${cabeza}\n\nLAS CLASES:\n${lista}\n\n${tramos}`;
}

/** Los referentes que nombran unos ids del grafo (`ref:<id>` o `ref:<id>:<video>`), sin repetir. */
export function referentesDeIds(ids: readonly string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const m = /^ref:([a-z0-9-]+)(?::|$)/.exec(String(id));
    if (m) out.add(m[1]);
  }
  return [...out];
}
