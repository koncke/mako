// =============================================================================
// /m/curso — lo que decide la pantalla del Curso en el teléfono, sin tocar la base (puro)
// =============================================================================
// Sin 'use client' ni 'server-only' a propósito: lo usan la página (server, al armar los datos), la
// pantalla (navegador, al volver de guardar el acceso) y tests/m-curso.test.ts lo EJECUTA.
//
// ⚠️ NADA DE ESTO ES UNA COPIA DE ESCRITORIO: los chips de una clase son los de `chipsDelEditor`
//    (app/customer-success/curso/modelo-ugc.ts), el candado se dice con `chipDeBloqueo` y
//    `rotuloDeBloqueo`, Público/Privado es `accesoDe` / `bloqueoPublico` / `privadoInicial`
//    (./bloqueo-editor.ts de escritorio) y el orden de las clases sale de `porEtapas` (./reglas.ts de
//    escritorio). Lo único propio es el AVANCE POR CLASE, que escritorio no dibuja (su tabla Avance es por
//    cliente y vive en Clientes desde el 07/10/2026): se cuenta con las MISMAS reglas que el portal
//    (`claseCompleta`, lib/curso-bloqueo.ts, y `PCT_VISTO`, lib/curso.ts).

import { PCT_VISTO, ROTULO_SIN_MEDIR, reproductorDeClase, type Clase, type Progreso } from '@/lib/curso';
import { claseCompleta, rotuloDeBloqueo, type Bloqueo } from '@/lib/curso-bloqueo';
import type { ModuloCurso } from '@/lib/curso-modulos';
import {
  accesoDe, bloqueoPublico, chipDeBloqueo, privadoInicial, type Acceso,
} from '@/app/customer-success/curso/bloqueo-editor';
import { SIN_ETAPA, chipsDelEditor } from '@/app/customer-success/curso/modelo-ugc';
import { porEtapas } from '@/app/customer-success/curso/reglas';

// ── Los rótulos ────────────────────────────────────────────────────────────────
// Los que el teléfono REPITE de escritorio, escritos una vez. tests/m-curso.test.ts busca cada uno ENTERO
// en su archivo de escritorio (la tabla de orígenes está escrita a mano en el test).

export const R = {
  /** El título de la página de escritorio (`<PageHeader titulo="Curso" />`). */
  curso: 'Curso',
  /** El menú de la marca de escritorio: la lista de los cursos. */
  cursos: 'Cursos',
  /** El selector Público | Privado del menú «…» de una clase. */
  acceso: 'Acceso',
  publico: 'Público',
  privado: 'Privado',
  seAbre: 'Se abre',
  accesoCambiado: 'Acceso cambiado',
  noSeGuardo: 'No se pudo guardar el candado.',
  sinModulo: 'Sin módulo',
  /** La columna del video en la tabla Avance (Clientes). */
  visto: 'Visto',
  sinClientes: 'Sin clientes en este producto',
  sinAvance: 'No pude leer el avance.',
  sinServicios: 'Todavía no hay servicios',
  irAClientes: 'Ir a Clientes',
  sinLeerServicios: 'No pude leer tus servicios',
} as const;

/** Lo del teléfono que escritorio no tiene escrito (el avance POR CLASE y los vacíos de esta pantalla). */
export const T = {
  /** El avance de la clase: escritorio lo tiene por cliente (Clientes › Avance), no por clase. */
  avance: 'Avance',
  terminada: 'Terminada',
  sinClases: 'Sin clases',
  cursoVacio: 'Este curso todavía no tiene clases.',
  sinLeerClases: 'No pude leer las clases de este curso.',
  claseIda: 'Esta clase ya no está.',
  sinConexion: 'Sin conexión',
  noSeDeshizo: 'No se pudo deshacer',
} as const;

/** La fila «… · En la computadora» de la pantalla: lo que en el teléfono no se hace. */
export const EN_LA_COMPUTADORA = 'Editar clases e Invitar alumnos';

// ── Los datos de la pantalla ────────────────────────────────────────────────────

/** Una clase, en lo que el teléfono dibuja. Nada del contenido (descripción, tarea, campos) viaja. */
export type ClaseDatos = {
  id: number;
  productoId: number;
  etapa: string;
  titulo: string;
  minutos: number | null;
  /** ¿Su módulo es una etapa del kanban? Decide el chip «Obligatoria» (`chipsDelEditor`). */
  vinculado: boolean;
  /** ¿Tiene un video que se dibuja? */
  video: boolean;
  /** ¿Se puede medir cuánto se vio? Drive y Loom se ven y no se miden («Sin medir»). */
  medible: boolean;
  /** Los chips de la tarjeta de escritorio, SIN el del candado (ése depende de los títulos de las demás). */
  chips: string[];
  /** Cuándo se abre. `null` = como su módulo (público). */
  bloqueo: Bloqueo | null;
};

export type ModuloDatos = { clave: string; nombre: string; sinModulo: boolean; clases: ClaseDatos[] };

/** El avance de UNA clase entre los alumnos del producto. `vistos: null` = su video no se mide. */
export type AvanceClase = { terminadas: number; vistos: number | null };

export type CursoDatos = {
  productoId: number;
  nombre: string;
  modulos: ModuloDatos[];
  /** No se pudieron leer sus clases: el curso lo DICE (una lista vacía se leería «no tiene clases»). */
  errorClases: boolean;
  /** `null` = no se pudo leer el avance (no es «nadie empezó»). */
  avance: { alumnos: number; porClase: Record<number, AvanceClase> } | null;
};

/** Una clase de la base, a lo que dibuja el teléfono. Lo usa también la pantalla con lo que devuelve guardar. */
export function claseDatos(c: Clase, vinculado: boolean): ClaseDatos {
  const { video, medible } = reproductorDeClase(c);
  return {
    id: c.id,
    productoId: c.productoId,
    etapa: c.etapa,
    titulo: c.titulo,
    minutos: c.minutos,
    vinculado,
    video: video != null,
    medible: video != null && medible,
    chips: chipsDelEditor(c, vinculado).map((x) => x.texto),
    bloqueo: c.bloqueo ?? null,
  };
}

/**
 * Cuántos alumnos del producto TERMINARON la clase (`claseCompleta`: la tarea enviada, o sin tarea el
 * tilde o el video hasta `PCT_VISTO`) y cuántos vieron su video hasta `PCT_VISTO`. Un video que no se
 * mide no da número: «no sé cuánto vio» no es «no lo vio» (`ROTULO_SIN_MEDIR`).
 */
export function avanceDeClase(
  c: Clase,
  alumnos: readonly number[],
  progreso: ReadonlyMap<number, ReadonlyMap<number, Progreso>>,
): AvanceClase {
  const { video, medible } = reproductorDeClase(c);
  const mide = video != null && medible;
  let terminadas = 0;
  let vistos = 0;
  for (const lead of alumnos) {
    const p = progreso.get(lead)?.get(c.id);
    if (claseCompleta(c, p)) terminadas += 1;
    if (mide && (p?.pct ?? 0) >= PCT_VISTO) vistos += 1;
  }
  return { terminadas, vistos: mide ? vistos : null };
}

/**
 * Un curso: sus MÓDULOS en el orden de escritorio (lib/curso-modulos.ts, `derivarModulos`), cada uno con
 * sus clases en su orden, y «Sin módulo» al final si hay clases cuyo módulo ya no existe (como el editor).
 */
export function cursoDatos(e: {
  productoId: number;
  nombre: string;
  modulos: readonly Pick<ModuloCurso, 'clave' | 'nombre' | 'vinculado'>[];
  clases: readonly Clase[];
  errorClases: boolean;
  /** Los leadId de los alumnos del producto; `null` = el avance no se pudo leer. */
  alumnos: readonly number[] | null;
  progreso: ReadonlyMap<number, ReadonlyMap<number, Progreso>> | null;
}): CursoDatos {
  const { porEtapa, huerfanas } = porEtapas(e.clases, e.modulos.map((m) => m.clave));
  const modulos: ModuloDatos[] = e.modulos.map((m) => ({
    clave: m.clave, nombre: m.nombre, sinModulo: false,
    clases: (porEtapa[m.clave] ?? []).map((c) => claseDatos(c, m.vinculado)),
  }));
  if (huerfanas.length) {
    modulos.push({ clave: SIN_ETAPA, nombre: R.sinModulo, sinModulo: true, clases: huerfanas.map((c) => claseDatos(c, false)) });
  }
  const { alumnos, progreso } = e;
  return {
    productoId: e.productoId,
    nombre: e.nombre,
    modulos,
    errorClases: e.errorClases,
    avance: alumnos && progreso
      ? { alumnos: alumnos.length, porClase: Object.fromEntries(e.clases.map((c) => [c.id, avanceDeClase(c, alumnos, progreso)])) }
      : null,
  };
}

// ── Lo que dibuja la pantalla ───────────────────────────────────────────────────

/** El curso que se mira: el de `?producto=` si es uno de éstos (la clave de escritorio), o el primero. */
export function productoElegido(cursos: readonly Pick<CursoDatos, 'productoId'>[], param: string | null | undefined): number | null {
  const n = /^[1-9]\d{0,11}$/.test(param ?? '') ? Number(param) : null;
  if (n != null && cursos.some((c) => c.productoId === n)) return n;
  return cursos[0]?.productoId ?? null;
}

/** Público o privado, como el selector del menú «…» de escritorio. */
export const accesoDeClase = (c: Pick<ClaseDatos, 'bloqueo'>): Acceso => accesoDe('clase', c.bloqueo);

/** Lo que se guarda al elegir: Público es lo de siempre de una clase, Privado arranca «Al terminar la anterior». */
export const bloqueoDeAcceso = (a: Acceso): Bloqueo | null => (a === 'publico' ? bloqueoPublico('clase') : privadoInicial('clase'));

/** Cuándo se abre una clase privada, en palabras (`null` = es pública). */
export function seAbreDe(c: Pick<ClaseDatos, 'bloqueo'>, titulo: (claseId: number) => string | null): string | null {
  if (!c.bloqueo || accesoDeClase(c) === 'publico') return null;
  return rotuloDeBloqueo(c.bloqueo, titulo);
}

/** La línea gris de la fila: los chips de la tarjeta de escritorio, con su candado al final. */
export function segundaDe(c: Pick<ClaseDatos, 'chips' | 'bloqueo'>, titulo: (claseId: number) => string | null): string | undefined {
  const candado = chipDeBloqueo(c.bloqueo, titulo);
  const partes = candado ? [...c.chips, candado.texto] : c.chips;
  return partes.length ? partes.join(' · ') : undefined;
}

/** La baldosa de la fila: lo privado con el ojo tachado (no hay candado en icons.tsx), el video con su play. */
export function iconoDeClase(c: Pick<ClaseDatos, 'bloqueo' | 'video'>): 'eye-off' | 'play' | 'notepencil' {
  if (accesoDeClase(c) === 'privado') return 'eye-off';
  return c.video ? 'play' : 'notepencil';
}

/** «3 clases» a la derecha del módulo, como el conteo del editor (`TEXTOS_EDITOR.clases`). */
export const rotuloClases = (n: number): string => (n === 0 ? T.sinClases : n === 1 ? '1 clase' : `${n} clases`);

/** «12 min», el `meta` de la tarjeta de escritorio. */
export const rotuloMinutos = (m: number | null): string | undefined => (m != null && m > 0 ? `${m} min` : undefined);

/** «3 de 8». */
export const deTotal = (n: number, total: number): string => `${n} de ${total}`;

/**
 * Las filas del Avance de una clase en la hoja. Sin alumnos, una sola (el vacío de escritorio). El video,
 * sólo si hay uno: medible da su número, si no «Sin medir» (nunca «0 de 8», que se leería «no lo vio»).
 */
export function filasAvance(
  c: Pick<ClaseDatos, 'id' | 'video' | 'medible'>,
  avance: CursoDatos['avance'],
): { k: string; v: string }[] | 'error' | 'vacio' {
  if (!avance) return 'error';
  if (avance.alumnos === 0) return 'vacio';
  const a = avance.porClase[c.id] ?? { terminadas: 0, vistos: c.medible ? 0 : null };
  const filas: { k: string; v: string }[] = [{ k: T.terminada, v: deTotal(a.terminadas, avance.alumnos) }];
  if (c.video) filas.push({ k: R.visto, v: a.vistos == null ? ROTULO_SIN_MEDIR : deTotal(a.vistos, avance.alumnos) });
  return filas;
}

/** ¿Dos candados dicen lo mismo? (el «Deshacer» no se ofrece sobre un cambio que no cambió nada). */
export const mismoBloqueo = (a: Bloqueo | null | undefined, b: Bloqueo | null | undefined): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
