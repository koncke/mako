// =============================================================================
// El portal del alumno, traducido al dibujo de Conocimientos (app/_cursos/CursoUgc.tsx)
// =============================================================================
// Los MÓDULOS del curso son los módulos del dibujo y sus CLASES son las lecciones. Todo lo que decide
// —qué módulo o qué clase está abierta, y por qué no— lo decidió el server (`armarModulos`,
// lib/curso-portal.ts) y llega armado: acá sólo se traduce. Puro y sin React, para que tenga test
// (tests/cursos-ugc.test.ts); los chips salen como DATOS y la pantalla los dibuja.
//
// ⚠️ 08/10/2026: era «las ETAPAS de la entrega son los módulos». Desde D1 un módulo puede no ser una
// etapa (suelto) y cada módulo y cada clase tienen su candado con su MOTIVO (D2). El dibujo no se
// rediseñó acá: se tradujo la forma nueva (eso es del paso siguiente).
//
// ⚠️ Sólo TIPOS de lib/curso-portal: trae la capa de datos (tests/curso-portal.test.ts).

import type { ProductoVista, ModuloVista, ClaseVista, ClaseDelModulo } from '@/lib/curso-portal';
import type { EstadoTarea } from '@/lib/curso';
import { PCT_VISTO, ROTULO_TAREA, tapaDeVideo } from '@/lib/curso';
import { portadaDeClase, portadaDeEtapa, tapaDe } from '@/lib/curso-estilo';
import type { ChipDato, ClaseUgc, ModuloUgc, TextosUgc } from '@/app/_cursos/tipos';

/**
 * Lo que dice un módulo ABIERTO sin clases, en su tarjeta y adentro (`moduloVacio`). Corto. Va antes de
 * `TEXTOS_PORTAL`, que lo usa al cargar el módulo.
 */
export const TEXTO_PROXIMAMENTE = 'Próximamente';

/**
 * Lo del dibujo, en la voz del portal: español neutro con TÚ, y corto.
 *
 * ⚠️ «MÓDULOS» Y NO «ETAPAS» (item 11): el alumno ve el curso, y un módulo puede no ser una etapa del
 *    kanban (D1). El candado sin motivo del server dice lo mismo que el server (`MOTIVO_MAS_ADELANTE`).
 */
export const TEXTOS_PORTAL: Partial<TextosUgc> = {
  inicio: 'Inicio',
  modulos: 'Módulos',
  modulo: 'Módulo',
  losModulos: 'Los módulos',
  buscar: 'Buscar una clase',
  todasLasClases: 'Todas las clases',
  leccion: 'clase',
  lecciones: 'clases',
  clases: 'clases',
  bloqueada: 'Se abre más adelante',
  menu: 'Módulos',
  // Item 16 del audio del 08/10/2026 (03:00): un módulo publicado y vacío aparece, «como en Skool».
  moduloVacio: TEXTO_PROXIMAMENTE,
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

/** El chip de una clase CERRADA adentro de un módulo abierto: el candado, con su porqué. */
export function chipCerrada(motivo: string): ChipDato {
  return { tono: 'neutro', texto: motivo };
}

/** Los chips de la tarjeta de una clase, con el estado que la pantalla ya conoce. */
export function chipsDeClase(c: ClaseVista, vivo: { pct: number | null; estado: EstadoTarea; propuesta: boolean; hecha?: boolean }): ChipDato[] {
  const out: ChipDato[] = [];
  if (c.video) out.push(chipVisto(vivo.pct));
  if (c.tieneTarea) out.push(chipTarea(vivo.estado));
  if (c.tieneTarea && vivo.propuesta) out.push({ tono: 'aviso', texto: 'Nueva versión' });
  // El tilde de una clase SIN tarea (mig 0220, «Marcar como hecha»): lo que la completa.
  if (!c.tieneTarea && (vivo.hecha ?? c.hecha)) out.push({ tono: 'lima', texto: 'Hecha' });
  return out;
}

/**
 * El estado con el que se DIBUJA un módulo: cerrado = `bloqueada` (candado, no se abre), vinculado =
 * dónde está el alumno en el kanban (hecha / actual), suelto abierto = sin marca.
 */
export function estadoDeModulo(m: Pick<ModuloVista, 'abierto' | 'etapa'>): ModuloUgc['estado'] {
  if (!m.abierto) return 'bloqueada';
  return m.etapa === 'hecha' || m.etapa === 'actual' ? m.etapa : undefined;
}

/**
 * Los módulos del dibujo. Uno con candado se DIBUJA (con su cuenta de clases y su MOTIVO) y no se
 * abre: es el mapa de lo que viene. Su `cuantas` sale del server, porque sus clases no viajan.
 */
export function modulosDelPortal(p: ProductoVista): ModuloUgc[] {
  return p.modulos.map((e, i) => {
    // La portada que el equipo le eligió al módulo (lib/curso-estilo.ts): una foto, un degradado o una
    // lámina diseñada (item 5). Sin ninguna, el cuaderno de siempre.
    const { tapa, fondo, lamina } = tapaDe(portadaDeEtapa(p.estilo, e.key));
    const estado = estadoDeModulo(e);
    return {
      key: e.key,
      nombre: e.label,
      n: i + 1,
      ...(estado ? { estado } : {}),
      ...(!e.abierto && e.motivo ? { motivo: e.motivo } : {}),
      cuantas: e.cuantas,
      // Abierto y VACÍO (item 16): «Próximamente» en la tarjeta, en vez de «0 clases», que se lee como
      // un módulo roto. Con candado sigue diciendo su motivo y su cuenta.
      ...(e.abierto && e.cuantas === 0 ? { textoTarjeta: TEXTO_PROXIMAMENTE } : {}),
      // La barra y la tarjeta cuentan TAREAS ENVIADAS: es lo que cierra la etapa (`etapaCompleta`).
      progreso: e.tareas > 0 ? { hechas: e.tareasEnviadas, total: e.tareas } : undefined,
      portada: tapa ?? null,
      fondo: fondo ?? null,
      lamina: lamina ?? null,
    };
  });
}

/**
 * El `cuerpo` de una clase del portal, por id: lo que la lección necesita y la tarjeta no. `vista`
 * puede ser una CLASE CERRADA (`cerrada: true`): título y motivo, nada más (no viajó nada más).
 */
export type ClasePortal = { ugc: ClaseUgc; vista: ClaseDelModulo; modulo: ModuloVista };

/**
 * Las clases de los módulos ABIERTOS, en el orden del curso (Anterior/Siguiente lo siguen). Las de un
 * módulo con candado no llegan del server; si alguna llegara, igual no se lista: abrirla sería
 * saltearse el candado. Una clase cerrada adentro de un módulo abierto SÍ se lista (con su candado):
 * es parte del mapa del módulo.
 */
export function clasesDelPortal(p: ProductoVista): ClasePortal[] {
  const out: ClasePortal[] = [];
  for (const e of p.modulos) {
    if (!e.abierto) continue;
    e.clases.forEach((c, i) => {
      // La tapa elegida por el equipo le gana a la miniatura del video.
      const elegida = tapaDe(portadaDeClase(p.estilo, c.id));
      if ('cerrada' in c) {
        // Cerrada: viajó su título y el motivo. Sin tapa de video ni triángulo (no hay video que dar).
        out.push({ modulo: e, vista: c, ugc: { id: c.id, moduloKey: e.key, vn: i + 1, titulo: c.titulo, fondo: elegida.fondo ?? null, tapa: elegida.tapa ?? null, lamina: elegida.lamina ?? null } });
        return;
      }
      out.push({
        modulo: e,
        vista: c,
        ugc: {
          id: c.id,
          moduloKey: e.key,
          vn: i + 1,
          titulo: c.titulo,
          meta: c.minutos ? `${c.minutos} min` : undefined,
          // Una lámina elegida también le gana a la miniatura del video (si no, la taparía).
          tapa: elegida.tapa ?? (elegida.fondo || elegida.lamina ? null : tapaDeVideo(c.video)),
          fondo: elegida.fondo ?? null,
          lamina: elegida.lamina ?? null,
          // Un link de afuera no se reproduce acá: se abre en otra pestaña. Sin triángulo.
          conVideo: !!c.video && c.video.tipo !== 'afuera',
        },
      });
    });
  }
  return out;
}

/**
 * El módulo de la etapa en la que está el cliente (el vinculado `actual`), y su número. El nombre se
 * conserva: es «dónde está».
 *
 * ⚠️ SIN NINGUNO `actual`, EL ÚLTIMO QUE YA PASÓ (`hecha`), y si no pasó ninguno, EL PRIMERO — no «el
 * último del curso» (revisión del 08/10/2026). Desde D1 un cliente puede estar en una etapa que NO es
 * módulo: la que quedó al DESVINCULAR uno (sus clientes no se mueven). Con «el último», alguien a mitad
 * del programa leía «Etapa 9 de 9» y el botón de la portada lo llevaba a lo de adelante.
 */
export function etapaActual(p: ProductoVista): { etapa: ModuloVista | null; i: number } {
  const i = p.modulos.findIndex((e) => e.etapa === 'actual');
  if (i >= 0) return { etapa: p.modulos[i], i };
  let j = -1;
  p.modulos.forEach((e, k) => { if (e.etapa === 'hecha') j = k; });
  if (j >= 0) return { etapa: p.modulos[j], i: j };
  return p.modulos.length ? { etapa: p.modulos[0], i: 0 } : { etapa: null, i: 0 };
}

/**
 * Cuántos módulos lleva hechos, para la barra de la portada. Un VINCULADO cuenta cuando su etapa ya
 * pasó (lo de siempre); un SUELTO no tiene etapa, así que cuenta cuando completó todas sus clases.
 *
 * ⚠️ Con «sólo los de etapa `hecha`» sobre el total de módulos, un curso con un módulo suelto no
 * llegaba NUNCA a la barra llena (revisión del 08/10/2026). Un suelto vacío no cuenta: «completo por
 * vacío» es para no trabar candados, no para regalar avance.
 */
export function avanceDelCurso(p: ProductoVista): { hechas: number; total: number } {
  const hechas = p.modulos.filter((m) => (m.vinculado ? m.etapa === 'hecha' : m.completo && m.cuantas > 0)).length;
  return { hechas, total: p.modulos.length };
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
  // Una clase CERRADA no es a dónde llevar a nadie: el botón abriría un candado.
  const abiertas = clases.filter((c): c is ClasePortal & { vista: ClaseVista } => !('cerrada' in c.vista));
  const ia = abiertas.find((c) => vivo.propuesta(c.vista));
  if (ia) return ia.ugc.id;
  const deLaActual = abiertas.filter((c) => c.modulo.key === actualKey);
  const pendiente = deLaActual.find((c) => c.vista.tieneTarea && vivo.estado(c.vista) === 'pendiente');
  return (pendiente ?? deLaActual[0] ?? abiertas[0])?.ugc.id;
}

/** La línea de un módulo: cuántas clases y, si tiene tareas, cuántas van enviadas. */
export function metaDeEtapa(e: ModuloVista): string {
  const clases = `${e.cuantas} ${e.cuantas === 1 ? 'clase' : 'clases'}`;
  if (!e.tareas) return clases;
  return `${clases} · ${e.tareasEnviadas} de ${e.tareas} ${e.tareas === 1 ? 'tarea enviada' : 'tareas enviadas'}`;
}

/**
 * La etapa cuyo link de agenda se ofrece ARRIBA: la última terminada que lo trae. Completarla pasa
 * al cliente a la siguiente en el acto, así que es la de la sesión que le toca ahora; las anteriores
 * siguen teniendo su botón en la cabecera de su etapa.
 */
export function agendaVigente(p: ProductoVista): ModuloVista | null {
  for (let i = p.modulos.length - 1; i >= 0; i--) {
    const e = p.modulos[i];
    if (e.etapa === 'hecha' && e.agendaUrl) return e;
  }
  return null;
}

// ── La lección del alumno (08/10/2026, items 14 y 16) ────────────────────────────

/**
 * Lo que va en el papel de una clase abierta, EN ORDEN: primero la descripción, después la tarea o
 * «Marcar como hecha». Sin pestañas (item 14 de Martín: «por defecto ambas juntas siempre, y primero
 * siempre la descripción»). Vacío = la clase no tiene nada que leer ni que hacer: no hay papel.
 *
 * ⚠️ «MARCAR COMO HECHA» SÓLO EN UNA CLASE SIN TAREA, y nunca al líder de un área: una con tarea se
 *    completa ENVIÁNDOLA (la ruta del progreso contesta 404 si no, como a un pedido armado a mano), y
 *    el líder no completa clases por el cliente (su portal es el de sus tareas).
 */
export type PartePapel = 'descripcion' | 'tarea' | 'hecha';
export function partesDelPapel(c: Pick<ClaseVista, 'descripcion' | 'descripcionHtml' | 'tieneTarea'>, lider: boolean): PartePapel[] {
  const out: PartePapel[] = [];
  if (descripcionDeClase(c)) out.push('descripcion');
  if (c.tieneTarea) out.push('tarea');
  else if (!lider) out.push('hecha');
  return out;
}

/**
 * La descripción que se dibuja: la RICA si la clase la tiene (ya saneada en el server, con los
 * adjuntos por referencia), y si no, el texto plano en párrafos. `null` = no tiene.
 */
export function descripcionDeClase(c: Pick<ClaseVista, 'descripcion' | 'descripcionHtml'>):
  { tipo: 'html'; html: string } | { tipo: 'texto'; parrafos: string[] } | null {
  if (c.descripcionHtml?.trim()) return { tipo: 'html', html: c.descripcionHtml };
  const t = (c.descripcion ?? '').trim();
  return t ? { tipo: 'texto', parrafos: t.split(/\n{2,}/) } : null;
}

/** La entrada de la barra que lleva a la comunidad del producto (`#x=comunidad`). */
export const ENTRADA_COMUNIDAD = 'comunidad';

/**
 * ¿Se ofrece la comunidad (D8, «una pestaña "Comunidad" en el portal del alumno»)? Al CLIENTE, sí.
 *   · En la vista previa del equipo, no: no hay alumno, y la comunidad se lee y se escribe con SU
 *     token (la vista previa no tiene ninguno).
 *   · Al líder de un área, no: no es un miembro, y con su link escribiría con el nombre del cliente
 *     (`actorDelAlumno`, lib/comunidad-datos.ts, ya le contesta que no; acá ni se ofrece).
 */
export const ofreceComunidad = (o: { vistaPrevia: boolean; area: string | null }): boolean => !o.vistaPrevia && o.area == null;
