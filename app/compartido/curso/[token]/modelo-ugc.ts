// =============================================================================
// El portal del alumno, traducido al dibujo de Conocimientos (app/_cursos/CursoUgc.tsx)
// =============================================================================
// Las ETAPAS de la entrega son los módulos y sus CLASES son las lecciones. Todo lo que decide —qué
// etapa está hecha, abierta o con candado— lo decidió el server (`armarEtapas`, lib/curso-portal.ts)
// y llega armado: acá sólo se traduce. Puro y sin React, para que tenga test
// (tests/cursos-ugc.test.ts); los chips salen como DATOS y la pantalla los dibuja.
//
// ⚠️ Sólo TIPOS de lib/curso-portal: trae la capa de datos (tests/curso-portal.test.ts).

import type { ProductoVista, EtapaVista, ClaseVista } from '@/lib/curso-portal';
import type { EstadoTarea } from '@/lib/curso';
import { PCT_VISTO, ROTULO_TAREA, tapaDeVideo } from '@/lib/curso';
import { portadaDeClase, portadaDeEtapa, tapaDe } from '@/lib/curso-estilo';
import type { ChipDato, ClaseUgc, ModuloUgc, TextosUgc } from '@/app/_cursos/tipos';

/** Lo del dibujo, en la voz del portal: español neutro con TÚ, y corto. */
export const TEXTOS_PORTAL: Partial<TextosUgc> = {
  inicio: 'Inicio',
  modulos: 'Etapas',
  modulo: 'Etapa',
  losModulos: 'Las etapas',
  buscar: 'Buscar una clase',
  todasLasClases: 'Todas las clases',
  leccion: 'clase',
  lecciones: 'clases',
  clases: 'clases',
  bloqueada: 'Se abre al terminar la etapa anterior',
  menu: 'Etapas',
};

/**
 * La marca de la barra: el nombre del PRODUCTO que compró, con la última palabra en lima (el corte
 * de color de la casa, como «Cono·cimientos»). Una sola palabra va entera, sin corte.
 */
export function marcaDelProducto(nombre: string): { texto: string; resaltado?: string } {
  const t = nombre.trim();
  const i = t.lastIndexOf(' ');
  return i > 0 ? { texto: t.slice(0, i + 1), resaltado: t.slice(i + 1) } : { texto: t };
}

/** ¿La clase trae una versión de la IA esperando su ok (la suya o la de alguna de sus áreas)? */
export function tieneTareaIA(c: ClaseVista): boolean {
  return c.tieneTarea && (c.areas ? c.areas.some((a) => !!a.ia) : !!c.ia);
}

/**
 * Cuánto vio. `null` = este video NO se puede medir (Loom, Drive, un link de afuera): «Sin medir»,
 * nunca «0%», que se leería como que no lo vio.
 */
export function chipVisto(pct: number | null): ChipDato {
  if (pct == null) return { tono: 'neutro', texto: 'Sin medir' };
  if (pct >= PCT_VISTO) return { tono: 'lima', texto: 'Visto' };
  if (pct > 0) return { tono: 'tinta', texto: `${pct}% visto` };
  return { tono: 'neutro', texto: 'Sin ver' };
}

/**
 * ⚠️ LA REVISADA DICE «REVISADA» (`ROTULO_TAREA`), no «Aprobada»: el cliente tiene un botón «Aprobar»
 * (la versión de la IA, paso 5 de #665), y un chip «Aprobada» al lado se leería como que la aprobó él.
 */
export function chipTarea(estado: EstadoTarea): ChipDato {
  if (estado === 'aprobada') return { tono: 'lima', texto: ROTULO_TAREA.aprobada };
  if (estado === 'enviada') return { tono: 'tinta', texto: 'Enviada' };
  return { tono: 'aviso', texto: 'Tarea pendiente' };
}

/** Los chips de la tarjeta de una clase, con el estado que la pantalla ya conoce. */
export function chipsDeClase(c: ClaseVista, vivo: { pct: number | null; estado: EstadoTarea; propuesta: boolean }): ChipDato[] {
  const out: ChipDato[] = [];
  if (c.video) out.push(chipVisto(vivo.pct));
  if (c.tieneTarea) out.push(chipTarea(vivo.estado));
  if (c.tieneTarea && vivo.propuesta) out.push({ tono: 'aviso', texto: 'Nueva versión' });
  return out;
}

/**
 * Las etapas como módulos. Una etapa con candado se DIBUJA (con su cuenta de clases) y no se abre:
 * es el mapa de lo que viene. Su `cuantas` sale del server, porque sus clases no viajan.
 */
export function modulosDelPortal(p: ProductoVista): ModuloUgc[] {
  return p.etapas.map((e, i) => {
    // La portada que el equipo le eligió a la etapa (lib/curso-estilo.ts). Sin ninguna, la lámina.
    const { tapa, fondo } = tapaDe(portadaDeEtapa(p.estilo, e.key));
    return {
      key: e.key,
      nombre: e.label,
      n: i + 1,
      estado: e.estado,
      cuantas: e.cuantas,
      // La barra y la tarjeta cuentan TAREAS ENVIADAS: es lo que cierra la etapa (`etapaCompleta`).
      progreso: e.tareas > 0 ? { hechas: e.tareasEnviadas, total: e.tareas } : undefined,
      portada: tapa ?? null,
      fondo: fondo ?? null,
    };
  });
}

/** El `cuerpo` de una clase del portal, por id: lo que la lección necesita y la tarjeta no. */
export type ClasePortal = { ugc: ClaseUgc; vista: ClaseVista; etapa: EtapaVista };

/**
 * Las clases que se pueden abrir, en el orden del curso (Anterior/Siguiente lo siguen). Las de una
 * etapa con candado no llegan del server; si alguna llegara, igual no se lista: abrirla sería
 * saltearse la etapa.
 */
export function clasesDelPortal(p: ProductoVista): ClasePortal[] {
  const out: ClasePortal[] = [];
  for (const e of p.etapas) {
    if (e.estado === 'bloqueada') continue;
    e.clases.forEach((c, i) => {
      // La tapa elegida por el equipo le gana a la miniatura del video.
      const elegida = tapaDe(portadaDeClase(p.estilo, c.id));
      out.push({
        etapa: e,
        vista: c,
        ugc: {
          id: c.id,
          moduloKey: e.key,
          vn: i + 1,
          titulo: c.titulo,
          meta: c.minutos ? `${c.minutos} min` : undefined,
          tapa: elegida.tapa ?? (elegida.fondo ? null : tapaDeVideo(c.video)),
          fondo: elegida.fondo ?? null,
          // Un link de afuera no se reproduce acá: se abre en otra pestaña. Sin triángulo.
          conVideo: !!c.video && c.video.tipo !== 'afuera',
        },
      });
    });
  }
  return out;
}

/** La etapa en la que está el cliente, y su número. Sin ninguna `actual` (todo hecho): la última. */
export function etapaActual(p: ProductoVista): { etapa: EtapaVista | null; i: number } {
  const i = p.etapas.findIndex((e) => e.estado === 'actual');
  if (i >= 0) return { etapa: p.etapas[i], i };
  return p.etapas.length ? { etapa: p.etapas[p.etapas.length - 1], i: p.etapas.length - 1 } : { etapa: null, i: 0 };
}

/**
 * A qué clase lleva el botón de la portada: lo que el alumno vino a hacer, en este orden.
 *   1. Una versión de la IA esperando su ok (paso 5): casi siempre de la etapa ANTERIOR, porque la
 *      llamada se agenda con la etapa completa y completarla lo pasa a la siguiente.
 *   2. La primera tarea pendiente de la etapa actual.
 *   3. La primera clase de la etapa actual, y si no hay, la primera del curso.
 *
 * `vivo` es lo que la pantalla ya sabe y el server todavía no (una propuesta que acaba de aprobar,
 * una tarea que acaba de mandar): sin eso, el botón lo devolvería a lo que ya resolvió.
 */
export function claseDeArranque(
  clases: ClasePortal[],
  actualKey: string | null,
  vivo: { propuesta: (c: ClaseVista) => boolean; estado: (c: ClaseVista) => EstadoTarea } = {
    propuesta: tieneTareaIA, estado: (c) => c.estado,
  },
): number | undefined {
  const ia = clases.find((c) => vivo.propuesta(c.vista));
  if (ia) return ia.ugc.id;
  const deLaActual = clases.filter((c) => c.etapa.key === actualKey);
  const pendiente = deLaActual.find((c) => c.vista.tieneTarea && vivo.estado(c.vista) === 'pendiente');
  return (pendiente ?? deLaActual[0] ?? clases[0])?.ugc.id;
}

/** La línea de una etapa: cuántas clases y, si tiene tareas, cuántas van enviadas. */
export function metaDeEtapa(e: EtapaVista): string {
  const clases = `${e.cuantas} ${e.cuantas === 1 ? 'clase' : 'clases'}`;
  if (!e.tareas) return clases;
  return `${clases} · ${e.tareasEnviadas} de ${e.tareas} ${e.tareas === 1 ? 'tarea enviada' : 'tareas enviadas'}`;
}

/**
 * La etapa cuyo link de agenda se ofrece ARRIBA: la última terminada que lo trae. Completarla pasa
 * al cliente a la siguiente en el acto, así que es la de la sesión que le toca ahora; las anteriores
 * siguen teniendo su botón en la cabecera de su etapa.
 */
export function agendaVigente(p: ProductoVista): EtapaVista | null {
  for (let i = p.etapas.length - 1; i >= 0; i--) {
    const e = p.etapas[i];
    if (e.estado === 'hecha' && e.agendaUrl) return e;
  }
  return null;
}
