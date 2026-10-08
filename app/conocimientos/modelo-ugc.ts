// =============================================================================
// Un curso de Conocimientos, traducido al dibujo de los cursos (app/_cursos/CursoUgc.tsx)
// =============================================================================
// Conocimientos tenía su propia copia del DOM (CursoReplica.tsx, borrado el 08/10/2026): el mismo
// dibujo del que salió CursoUgc, mantenido aparte. «Dos componentes para la misma pantalla» es el error
// que CursoUgc vino a cerrar — lo que se le agregaba a uno no aparecía en el otro —, así que ahora
// Conocimientos lo monta como las otras dos pantallas y trae ESTE adaptador.
//
// Puro y sin React, para que tenga test (tests/conocimientos-modelo-ugc.test.ts): los chips salen
// como DATOS y el dibujo de la lección lo arma ./CursoConocimientos.tsx.
//
// Recibe el curso YA AJUSTADO (lib/conocimiento-ajustes.ts, `aplicarAjustes`): lo que el super admin
// le cambió está puesto, y lo oculto sólo viene si quien mira es él.
//
// ⚠️ LA KEY DE UN MÓDULO ES EL NOMBRE ORIGINAL DE SU GRUPO, a propósito: los `#mod=<nombre>` que ya
//    circulan en links compartidos lo llevan, y con esta key siguen abriendo el mismo módulo aunque el
//    super admin lo renombre (el nombre que se DIBUJA va aparte).

import type { ChipDato, ClaseUgc, ModuloUgc, PortadaUgc, TextosUgc } from '@/app/_cursos/tipos';
import { tapaDe } from '@/lib/curso-estilo';
import { numerosPropios, type ClaseAjustada, type CursoConAjustes, type ModuloAjustado } from '@/lib/conocimiento-ajustes';

/**
 * La miniatura que Drive genera para CUALQUIER archivo suyo: el primer fotograma de un video, la primera
 * página de un PDF. Es pública y no se genera ni se guarda nada: hacer una tapa por clase a mano no
 * escala (había 3.444 clases y 30 con `portadaClase`). `Miniatura` se hace cargo del 404.
 */
export const DRIVE_THUMB = (id: string, w = 800) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;

/**
 * Los textos de Conocimientos. Lo que no está acá es el default del dibujo (app/_cursos/reglas.ts), que
 * ya dice «Inicio del curso», «Recursos del curso», «Todas las clases» y «Volver a los cursos».
 */
export const TEXTOS_CONOCIMIENTOS: Partial<TextosUgc> = {
  buscar: 'Buscar lección, modelo, formato',
};

/** «71 min»: los «m:ss» que traen las clases en su `cardDesc`. Sin ninguno, nada. */
export function minutosDe(clases: readonly { cardDesc?: string }[]): string | undefined {
  const seg = clases.reduce((t, c) => {
    const m = /(\d{1,2}):(\d{2})/.exec(c.cardDesc || '');
    return t + (m ? Number(m[1]) * 60 + Number(m[2]) : 0);
  }, 0);
  return seg ? `${Math.round(seg / 60)} min` : undefined;
}

/**
 * Los números de los módulos que se dibujan (el chip, la lámina, la barra).
 *
 * Si los módulos son los de la ficha, en su orden y con sus nombres, se numeran COMO SIEMPRE: el ordinal
 * del nombre, o el código de su primera lección, o la posición (`nFicha`). Si el super admin los
 * reordenó, renombró u ocultó, los números de la ficha dejarían huecos o saldrían desordenados: se
 * vuelve a numerar sobre lo que se ve — el ordinal propio si TODOS lo traen, si no la posición.
 */
export function numerosDeModulos(cur: Pick<CursoConAjustes, 'modulos' | 'modulosDeLaFicha'>): number[] {
  const ms = cur.modulos;
  const intactos = ms.length === cur.modulosDeLaFicha && ms.every((m, i) => m.orden0 === i && m.nombre === m.key);
  if (intactos) return ms.map((m) => m.nFicha);
  return numerosPropios(ms.map((m) => m.nombre)) ?? ms.map((_, i) => i + 1);
}

/** La tapa de la FICHA de un módulo: la de su archivo (si el curso las tiene) o la de su primera clase con tapa. */
function tapaDeLaFicha(cur: Pick<CursoConAjustes, 'portadasModulo'>, m: ModuloAjustado): string | null {
  // ⚠️ La ruta sale de `nFicha`, no del número que se dibuja: es un dato del archivo, y mover el módulo
  //    no puede cambiarle la foto. Sin `portadasModulo`, la de su primera clase.
  if (cur.portadasModulo) return `${cur.portadasModulo}${m.nFicha}.webp`;
  return m.clases.find((c) => c.portadaClase)?.portadaClase ?? null;
}

export function modulosUgc(cur: CursoConAjustes): ModuloUgc[] {
  const ns = numerosDeModulos(cur);
  return cur.modulos.map((m, i) => {
    // La portada que se le eligió: una foto, un degradado o una lámina diseñada. Una elegida que NO es foto
    // va SIN la tapa de la ficha: la foto le gana a la lámina y al degradado, y los taparía.
    const elegida = tapaDe(m.portadaElegida);
    const hayElegida = !!(elegida.tapa || elegida.fondo || elegida.lamina);
    const visibles = m.clases.filter((c) => !c.oculta);
    return {
      key: m.key,
      nombre: m.nombre,
      n: ns[i],
      portada: hayElegida ? (elegida.tapa ?? null) : tapaDeLaFicha(cur, m),
      fondo: elegida.fondo ?? null,
      lamina: elegida.lamina ?? null,
      cuantas: m.clases.length,
      rotuloExtra: minutosDe(visibles),
      // Lo oculto lo ve SÓLO el super admin (a nadie más le llega), atenuado y dicho.
      ...(m.oculto ? { atenuado: true, aviso: 'Oculto' } : {}),
    };
  });
}

/** El número de cada clase en su módulo: el de la ficha mientras el módulo sea el de la ficha; si no, la posición. */
function numeroDeClase(c: ClaseAjustada, i: number, intactas: boolean): number | string {
  return intactas ? (c.vn ?? c.codigo ?? c.n) : i + 1;
}

export function clasesUgc(cur: CursoConAjustes): ClaseUgc[] {
  return cur.modulos.flatMap((m) => m.clases.map((c, i): ClaseUgc => {
    // La tapa elegida le gana a la de la ficha (la hecha a mano, o el fotograma del video). Una lámina o
    // un degradado elegidos también: con la miniatura puesta, quedarían tapados.
    const elegida = tapaDe(c.portadaElegida);
    const hayElegida = !!(elegida.tapa || elegida.fondo || elegida.lamina);
    const deLaFicha = c.portadaClase ?? (c.videoId ? DRIVE_THUMB(c.videoId) : null);
    return {
      id: c.n,
      moduloKey: m.key,
      vn: numeroDeClase(c, i, m.clasesIntactas),
      titulo: c.titulo,
      meta: c.cardDesc,
      tapa: hayElegida ? (elegida.tapa ?? null) : deLaFicha,
      fondo: elegida.fondo ?? null,
      lamina: elegida.lamina ?? null,
      conVideo: !!c.videoId,
      // La pastilla de la lección: su módulo y el código del origen («Formatos · 4.1.1»).
      pastilla: `${m.nombre}${c.codigo ? ` · ${c.codigo}` : ''}`,
      buscar: `${m.nombre} ${c.codigo ?? ''}`,
      ...(c.oculta ? { atenuado: true } : {}),
    };
  }));
}

/** Los chips de la tarjeta de una clase. Hoy, sólo el de oculta (lo ve el super admin). */
export function chipsDeClase(c: Pick<ClaseAjustada, 'oculta'>): ChipDato[] {
  return c.oculta ? [{ tono: 'aviso', texto: 'Oculta' }] : [];
}

/**
 * La portada del índice. La cejilla es la CATEGORÍA (dice algo que no está en otro lado), el título es el
 * del curso sin el autor, y la tapa es la elegida, o la de la primera clase, o la del curso. El botón
 * lleva a la primera clase que se ve.
 */
export function portadaUgc(cur: CursoConAjustes): PortadaUgc {
  const primera = cur.clases.find((c) => !c.oculta) ?? cur.clases[0];
  const elegida = tapaDe(cur.portadaElegida);
  const hayElegida = !!(elegida.tapa || elegida.fondo);
  return {
    eyebrow: cur.categoria,
    titulo: cur.tituloCorto ?? cur.titulo,
    resumen: cur.resumen,
    tapa: hayElegida ? (elegida.tapa ?? null) : (primera?.portadaClase ?? cur.portada ?? null),
    fondo: elegida.fondo ?? null,
    ...(primera ? { claseId: primera.n } : {}),
  };
}
