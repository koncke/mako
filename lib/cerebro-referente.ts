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

export { CAPA_CONOCIMIENTO };

/** Una clase del curso, con su texto COMPLETO. El texto no se recorta: ése es todo el punto. */
export type ClaseDeCurso = {
  /** El id del video, que es como se llama su archivo en `public/cono-tx/`. */
  videoId: string;
  titulo: string;
  /** Su lugar en el curso, desde 1. Dos clases seguidas se nombran entre sí. */
  orden: number;
  /** La transcripción entera, ya unida. Sin tope. */
  texto: string;
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
    tipo: 'Clase del curso',
    etiqueta: c.titulo,
    // El DETALLE es lo que viaja en el índice: una línea, sin el texto.
    detalle: lineaDeClase(c),
    datos: [
      { k: 'Curso', v: r.curso },
      { k: 'Clase', v: String(c.orden) },
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
