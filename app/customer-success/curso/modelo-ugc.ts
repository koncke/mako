// =============================================================================
// La tab Curso, traducida al dibujo de Conocimientos (app/_cursos/CursoUgc.tsx)
// =============================================================================
// El MISMO dibujo que ve el alumno (app/compartido/curso/[token]/modelo-ugc.ts), con lo que sólo ve
// quien arma el curso: todas las etapas abiertas, los chips del equipo (qué le falta, si la clase
// cierra la etapa) y las clases de un módulo borrado en un módulo aparte («Sin módulo»). Puro y sin
// React, para que tenga test (tests/cursos-ugc.test.ts); los chips salen como DATOS.

import type { Clase } from '@/lib/curso';
import { reproductorDeClase, tapaDeVideo, tieneTarea } from '@/lib/curso';
import { portadaDeClase, portadaDeEtapa, tapaDe, type EstiloCurso } from '@/lib/curso-estilo';
import type { ChipDato, ClaseUgc, ModuloUgc, TextosUgc } from '@/app/_cursos/tipos';
import { puedeMoverPorPosicion } from '@/app/_cursos/reglas';
import { rotuloTipo, videoDeClase } from './reglas';

/**
 * La key del módulo de las clases cuya etapa ya no existe. No puede chocar con una etapa: las keys
 * de la entrega son slugs (lib/servicio-etapas.ts), sin guiones bajos al principio.
 */
export const SIN_ETAPA = '__sin-etapa';

/**
 * ⚠️ «MÓDULOS» Y NO «ETAPAS» (item 11, Martín, 07/10/2026: «Para las "Etapas" dentro del curso,
 *    llamalo "Módulos"»). En el KANBAN siguen siendo etapas, y ahí se llaman así; adentro del curso un
 *    módulo puede no ser una etapa (D1, uno suelto). Lo fija tests/cursos-ugc.test.ts.
 */
export const TEXTOS_EDITOR: Partial<TextosUgc> = {
  inicio: 'Inicio',
  modulos: 'Módulos',
  modulo: 'Módulo',
  losModulos: 'Los módulos',
  buscar: 'Buscar una clase',
  todasLasClases: 'Todas las clases',
  leccion: 'clase',
  lecciones: 'clases',
  clases: 'clases',
  menu: 'Módulos',
  nueva: '+ Nueva clase',
  nuevoModulo: '+ Nuevo módulo',
};

/**
 * ¿Alguna clase CIERRA la etapa? `etapaCompleta` pide al menos una obligatoria con tarea, a
 * propósito («nada que hacer» no es «terminó»): una etapa sin ninguna no avanza sola, y se dice en
 * su cabecera, que es donde se arregla.
 */
export const cierraLaEtapa = (lista: readonly Clase[]) => lista.some((c) => c.obligatoria && tieneTarea(c));

/** Un módulo, en lo que el dibujo necesita. `aviso`: su candado dicho para quien lo arma (ver `ModuloUgc.aviso`). */
type EtapaMin = { key: string; label: string; aviso?: string };

/**
 * Los MÓDULOS del curso (D1: las etapas que son módulo y los sueltos, en orden), y «Sin módulo» al
 * final si hay huérfanas.
 */
export function modulosDelEditor(etapas: readonly EtapaMin[], porEtapa: Record<string, Clase[]>, huerfanas: readonly Clase[], estilo?: EstiloCurso): ModuloUgc[] {
  const out: ModuloUgc[] = etapas.map((e, i) => {
    // La portada que se le eligió al módulo: una foto, un degradado o una lámina diseñada (item 5).
    // Sin ninguna, el cuaderno de siempre.
    const { tapa, fondo, lamina } = tapaDe(portadaDeEtapa(estilo, e.key));
    return {
      key: e.key,
      nombre: e.label,
      n: i + 1,
      cuantas: (porEtapa[e.key] ?? []).length,
      rotuloExtra: minutosDe(porEtapa[e.key] ?? []),
      portada: tapa ?? null,
      fondo: fondo ?? null,
      lamina: lamina ?? null,
      ...(e.aviso ? { aviso: e.aviso } : {}),
    };
  });
  if (huerfanas.length) {
    // «Sin módulo» no existe como módulo: no se renombra, no se arrastra, no se le agregan clases ni
    // se le pone tapa. Sus clases sí se arrastran a un módulo de la barra (es su salida).
    out.push({ key: SIN_ETAPA, nombre: 'Sin módulo', n: etapas.length + 1, cuantas: huerfanas.length, sinEdicion: true });
  }
  return out;
}

/** «71 min»: la suma de lo que declaran las clases. Sin ninguna con minutos, nada. */
function minutosDe(lista: readonly Clase[]): string | undefined {
  const m = lista.reduce((t, c) => t + (c.minutos ?? 0), 0);
  return m > 0 ? `${m} min` : undefined;
}

/**
 * Las clases en el orden del curso (Anterior/Siguiente lo siguen): cada etapa en su orden y las
 * huérfanas al final. `vn` arranca en 1 en cada etapa, como en el portal.
 */
export function clasesDelEditor(etapas: readonly EtapaMin[], porEtapa: Record<string, Clase[]>, huerfanas: readonly Clase[], estilo?: EstiloCurso): ClaseUgc[] {
  const grupos: Array<[string, readonly Clase[]]> = [
    ...etapas.map((e): [string, readonly Clase[]] => [e.key, porEtapa[e.key] ?? []]),
    [SIN_ETAPA, huerfanas],
  ];
  return grupos.flatMap(([key, lista]) => lista.map((c, i) => {
    const { video } = reproductorDeClase(c);
    // La tapa elegida le gana a la miniatura del video, que es lo que hay cuando nadie eligió. Una
    // LÁMINA elegida también: con la miniatura puesta, la lámina quedaba tapada por el video.
    const elegida = tapaDe(portadaDeClase(estilo, c.id));
    return {
      id: c.id,
      moduloKey: key,
      vn: i + 1,
      titulo: c.titulo,
      meta: [rotuloTipo(c.tipo), c.minutos != null ? `${c.minutos} min` : null].filter(Boolean).join(' · '),
      tapa: elegida.tapa ?? (elegida.fondo || elegida.lamina ? null : tapaDeVideo(video)),
      fondo: elegida.fondo ?? null,
      lamina: elegida.lamina ?? null,
      conVideo: video != null && video.tipo !== 'afuera',
    };
  }));
}

/**
 * Los chips de la tarjeta de una clase para el EQUIPO: si le falta el video, si no se mide, qué pide
 * y si cierra la etapa.
 *
 * ⚠️ SIN «Grabar» / «No grabar» NI «N notas» desde el 08/10/2026 (items 13 y 15): la marca de grabar y
 *    las notas del equipo se fueron de la tab.
 * ⚠️ «CIERRA EL MÓDULO», CON EL NOMBRE DEL INTERRUPTOR Y SÓLO EN UN VINCULADO (revisión final del
 *    08/10/2026). La tarjeta decía «Cierra la etapa» y la lección, sobre el mismo dato, «Cierra el
 *    módulo» (./LeccionEditable.tsx): dos nombres en la misma pantalla para una sola marca. Y en un
 *    SUELTO la marca se conserva (llegó ahí al desvincular o al arrastrar, lib/curso-admin.ts) pero no
 *    cierra nada —un suelto no mueve a nadie en el kanban—: el chip afirmaba algo que no pasa, y la
 *    lección, que ya no ofrece el interruptor ahí, no lo mostraba.
 */
export function chipsDelEditor(c: Clase, vinculado: boolean): ChipDato[] {
  const out: ChipDato[] = [];
  const v = videoDeClase(c);
  if (!v.hay) out.push({ tono: 'neutro', texto: 'Sin video' });
  else if (!v.medible) out.push({ tono: 'neutro', texto: 'Sin medir' });
  if (tieneTarea(c)) out.push({ tono: 'neutro', texto: c.campos.length ? `Formulario · ${c.campos.length}` : 'Tarea' });
  if (vinculado && c.obligatoria && tieneTarea(c)) out.push({ tono: 'lima', texto: 'Cierra el módulo' });
  return out;
}

/**
 * Si una clase se puede mover: por posición dentro de su etapa. Las huérfanas no se ordenan: su
 * etapa no existe, y lo que se hace con ellas es moverlas a una que exista (desde el menú de la
 * clase: el modal de «Editar», que lo hacía antes, se fue el 08/10/2026).
 */
export function puedeMoverEnEditor(clases: readonly ClaseUgc[], id: number, dir: 'arriba' | 'abajo'): boolean {
  const c = clases.find((x) => x.id === id);
  if (!c || c.moduloKey === SIN_ETAPA) return false;
  return puedeMoverPorPosicion([...clases], id, dir);
}
