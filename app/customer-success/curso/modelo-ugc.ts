// =============================================================================
// La tab Curso, traducida al dibujo de Conocimientos (app/_cursos/CursoUgc.tsx)
// =============================================================================
// El MISMO dibujo que ve el alumno (app/compartido/curso/[token]/modelo-ugc.ts), con lo que sólo ve
// quien arma el curso: todas las etapas abiertas, los chips del equipo (grabar, notas, si la clase
// cierra la etapa) y las clases de una etapa borrada en un módulo aparte («Sin etapa»). Puro y sin
// React, para que tenga test (tests/cursos-ugc.test.ts); los chips salen como DATOS.

import type { Clase } from '@/lib/curso';
import { reproductorDeClase, tapaDeVideo, tieneTarea } from '@/lib/curso';
import type { ChipDato, ClaseUgc, ModuloUgc, TextosUgc } from '@/app/_cursos/tipos';
import { puedeMoverPorPosicion } from '@/app/_cursos/reglas';
import { rotuloTipo, videoDeClase } from './reglas';

/**
 * La key del módulo de las clases cuya etapa ya no existe. No puede chocar con una etapa: las keys
 * de la entrega son slugs (lib/servicio-etapas.ts), sin guiones bajos al principio.
 */
export const SIN_ETAPA = '__sin-etapa';

export const TEXTOS_EDITOR: Partial<TextosUgc> = {
  inicio: 'Inicio',
  modulos: 'Etapas',
  modulo: 'Etapa',
  losModulos: 'Las etapas',
  buscar: 'Buscar una clase',
  todasLasClases: 'Todas las clases',
  leccion: 'clase',
  lecciones: 'clases',
  clases: 'clases',
  menu: 'Etapas',
  nueva: '+ Clase',
  editar: 'Editar',
};

/**
 * ¿Alguna clase CIERRA la etapa? `etapaCompleta` pide al menos una obligatoria con tarea, a
 * propósito («nada que hacer» no es «terminó»): una etapa sin ninguna no avanza sola, y se dice en
 * su cabecera, que es donde se arregla.
 */
export const cierraLaEtapa = (lista: readonly Clase[]) => lista.some((c) => c.obligatoria && tieneTarea(c));

type EtapaMin = { key: string; label: string };

/** Las etapas como módulos, en el orden de la entrega; y «Sin etapa» al final si hay huérfanas. */
export function modulosDelEditor(etapas: readonly EtapaMin[], porEtapa: Record<string, Clase[]>, huerfanas: readonly Clase[]): ModuloUgc[] {
  const out: ModuloUgc[] = etapas.map((e, i) => ({
    key: e.key,
    nombre: e.label,
    n: i + 1,
    cuantas: (porEtapa[e.key] ?? []).length,
    rotuloExtra: minutosDe(porEtapa[e.key] ?? []),
  }));
  if (huerfanas.length) {
    out.push({ key: SIN_ETAPA, nombre: 'Sin etapa', n: etapas.length + 1, cuantas: huerfanas.length });
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
export function clasesDelEditor(etapas: readonly EtapaMin[], porEtapa: Record<string, Clase[]>, huerfanas: readonly Clase[]): ClaseUgc[] {
  const grupos: Array<[string, readonly Clase[]]> = [
    ...etapas.map((e): [string, readonly Clase[]] => [e.key, porEtapa[e.key] ?? []]),
    [SIN_ETAPA, huerfanas],
  ];
  return grupos.flatMap(([key, lista]) => lista.map((c, i) => {
    const { video } = reproductorDeClase(c);
    return {
      id: c.id,
      moduloKey: key,
      vn: i + 1,
      titulo: c.titulo,
      meta: [rotuloTipo(c.tipo), c.minutos != null ? `${c.minutos} min` : null].filter(Boolean).join(' · '),
      tapa: tapaDeVideo(video),
      conVideo: video != null && video.tipo !== 'afuera',
    };
  }));
}

/**
 * Los chips de la tarjeta de una clase para el EQUIPO. `marca`: la de grabar (`undefined` = no se
 * pudo leer: no se dice nada). `notas`: cuántas tiene (`0` = ninguna o no se pudo leer).
 */
export function chipsDelEditor(c: Clase, o: { marca: boolean | null | undefined; notas: number }): ChipDato[] {
  const out: ChipDato[] = [];
  const v = videoDeClase(c);
  if (!v.hay) out.push({ tono: 'neutro', texto: 'Sin video' });
  else if (!v.medible) out.push({ tono: 'neutro', texto: 'Sin medir' });
  if (tieneTarea(c)) out.push({ tono: 'neutro', texto: c.campos.length ? `Formulario · ${c.campos.length}` : 'Tarea' });
  if (c.obligatoria && tieneTarea(c)) out.push({ tono: 'lima', texto: 'Cierra la etapa' });
  if (o.marca === true) out.push({ tono: 'aviso', texto: 'Grabar' });
  if (o.marca === false) out.push({ tono: 'neutro', texto: 'No grabar' });
  if (o.notas > 0) out.push({ tono: 'tinta', texto: `${o.notas} ${o.notas === 1 ? 'nota' : 'notas'}` });
  return out;
}

/**
 * Si una clase se puede mover: por posición dentro de su etapa. Las huérfanas no se ordenan: su
 * etapa no existe, y lo que se hace con ellas es moverlas a una que exista (desde «Editar»).
 */
export function puedeMoverEnEditor(clases: readonly ClaseUgc[], id: number, dir: 'arriba' | 'abajo'): boolean {
  const c = clases.find((x) => x.id === id);
  if (!c || c.moduloKey === SIN_ETAPA) return false;
  return puedeMoverPorPosicion([...clases], id, dir);
}
