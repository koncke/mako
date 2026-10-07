/**
 * El MODELO NEUTRAL de un curso dibujado con el diseño de Conocimientos (`CursoUgc`).
 *
 * Por qué existe: el mismo dibujo lo usan TRES pantallas —el catálogo estático de
 * /conocimientos, el portal del alumno y la vista de Mauricio que edita— y cada una tiene
 * sus datos con otra forma (`Curso` de app/conocimientos/curso.ts, `VistaAlumno` de
 * lib/curso-portal.ts, las filas de curso_clases). Si el componente leyera cualquiera de
 * esas formas, las otras dos lo copiarían: ya pasó con CursoPortal y CursoReplica, «dos
 * componentes para la misma pantalla», y lo que se agregaba a uno no aparecía en el otro.
 *
 * Así que el componente recibe ESTO, y cada pantalla trae su adaptador.
 *
 * ⚠️ Sin `'use client'` y sin valores: sólo tipos. Lo puede importar un server component
 *    (para armar el modelo del lado del server) sin arrastrar React al grafo del server.
 */
import type { ReactNode } from 'react';

/**
 * El tono de un chip (`ChipUgc`). Vive acá y no en el componente para que un adaptador PURO (sin
 * React) pueda decidir el chip y tener test.
 */
export type TonoChip = 'neutro' | 'aviso' | 'tinta' | 'lima';
/** Un chip ya decidido: lo que dice y su tono. El adaptador lo arma; la pantalla lo dibuja. */
export type ChipDato = { tono: TonoChip; texto: string };

/** Dónde está quien cursa, por módulo. Sin estado = abierto y sin marca (Conocimientos). */
export type EstadoModulo = 'hecha' | 'actual' | 'bloqueada';

export type ModuloUgc = {
  /**
   * La IDENTIDAD del módulo: viaja en la URL (`#mod=<key>`) y ata cada clase a su módulo.
   * ⚠️ No es el nombre: renombrar una etapa no puede romper un link compartido. (El
   * adaptador de Conocimientos usa el nombre como key a propósito, para que los links
   * viejos —que llevan el nombre— sigan andando.)
   */
  key: string;
  nombre: string;
  /** El número que se dibuja: el chip, la lámina y la barra. */
  n: number;
  /**
   * La tapa. Va ENCIMA de la lámina dibujada (PortadaModulo), así que una ruta que da 404
   * deja la lámina y no un hueco negro.
   */
  portada?: string | null;
  /** `bloqueada`: se dibuja con candado y no se puede abrir. */
  estado?: EstadoModulo;
  /**
   * Cuántas clases tiene. EXPLÍCITO y no `clases.length`: un módulo bloqueado llega SIN
   * clases (lib/curso-portal.ts no las manda) y aun así tiene que poder decir cuántas.
   */
  cuantas: number;
  /** Barra de avance en la tarjeta y «3/10» en la barra lateral. */
  progreso?: { hechas: number; total: number };
  /** Lo que sigue a «N lecciones» en la tarjeta y en la barra: la duración, por ejemplo. */
  rotuloExtra?: string;
  /**
   * Texto EXACTO de la línea de la tarjeta y del contador de la barra. Existen sólo para que
   * un portal que ya está publicado conserve su texto al pixel; uno nuevo no los usa.
   */
  textoTarjeta?: string;
  textoBarra?: string;
  /**
   * Lo que va en la cabecera del módulo ABIERTO, a la derecha de su nombre: el link para agendar
   * la sesión de una etapa terminada (el alumno), las notas de la etapa y el aviso de que no
   * avanza sola (quien dicta). Es un hueco: el dibujo no sabe qué es.
   */
  acciones?: ReactNode;
};

export type ClaseUgc = {
  /** Entero > 0 y único en el curso: viaja en la URL (`#clase=<id>`). */
  id: number;
  /** La `key` de su módulo. */
  moduloKey: string;
  /** El número de la tarjeta: la posición DENTRO de su módulo (arranca en 1 en cada uno). */
  vn?: number | string;
  titulo: string;
  /** La línea chica de la tarjeta («5:23 · Formatos», «12 min»). */
  meta?: string;
  /** La tapa de la tarjeta. Sin tapa queda el degradé de la casa. */
  tapa?: string | null;
  /** Dibuja el triángulo de play sobre la tapa. */
  conVideo?: boolean;
  /** Chips de la tarjeta (estado de la tarea, % visto). Van con `<ChipUgc>`. */
  chips?: ReactNode;
  /** La pastilla arriba del título de la lección. Default: el nombre del módulo. */
  pastilla?: string;
  /** Texto que entra en la búsqueda además del título. Default: el nombre del módulo. */
  buscar?: string;
};

export type PestanaUgc = { nombre: string; cuerpo: ReactNode };

/** Lo que una pantalla pone adentro de la lección. Todo es opcional. */
export type LeccionUgc = {
  /**
   * El reproductor. `cuerpo` va adentro del marco 16:9 (`.ugc-vframe`: un `<iframe>` o un
   * `<video>` descendiente se estira solo a la caja); `barra` es la franja de abajo.
   * Sin `video` no se dibuja el marco: un rectángulo negro sin nada adentro se lee como
   * un reproductor roto.
   */
  video?: { cuerpo: ReactNode; barra?: ReactNode };
  /** Debajo del video y antes de Anterior/Siguiente (la tarea del alumno, cuando hay video). */
  debajoDelVideo?: ReactNode;
  /** Pestañas del papel. CursoUgc maneja cuál está abierta y vuelve a la primera al cambiar de clase. */
  pestanas?: PestanaUgc[];
  /** El papel cuando no hay `pestanas`: va tal cual adentro de la columna derecha. */
  papel?: ReactNode;
  /** A lo ancho, debajo de las dos columnas («Material de esta clase»). */
  despues?: ReactNode;
};

/** Una entrada propia en la barra («Avance de los clientes»), con su cuerpo en el área de contenido. */
export type EntradaExtraUgc = {
  /** Viaja en la URL (`#x=<key>`): el Atrás vuelve a ella. */
  key: string;
  nombre: string;
  /** El número chico a la derecha de la entrada. */
  cuenta?: ReactNode;
  cuerpo: ReactNode;
};

/** Los controles de quien EDITA el curso. Sin esto, el dibujo es de sólo lectura. */
export type EdicionUgc = {
  /** «+ Clase», la última tarjeta de cada módulo abierto. */
  onNueva: (moduloKey: string) => void;
  /** «Editar» en el encabezado de la lección. */
  onEditar: (claseId: number) => void;
  onMover: (claseId: number, dir: 'arriba' | 'abajo') => void;
  onBorrar: (claseId: number) => void;
  /** Default: por posición dentro de su módulo (la primera no sube, la última no baja). */
  puedeMover?: (claseId: number, dir: 'arriba' | 'abajo') => boolean;
  /** Mientras se guarda: los controles se APAGAN, no se desmontan (uno que desaparece bajo el dedo se lee como un clic perdido). */
  ocupado?: boolean;
};

/** La lista de recursos de un curso. El dibujo lo trae la pantalla (hoy sólo Conocimientos). */
export type RecursosUgc = {
  cuantos: number;
  render: (ctl: { abierto?: string; abrir: (slug: string) => void; cerrar: () => void }) => ReactNode;
};

/** La portada del índice (el «hero»). Lleva a una clase. */
export type PortadaUgc = {
  tapa?: string | null;
  /** La cejilla, arriba del título (la categoría). */
  eyebrow?: string;
  titulo: string;
  resumen?: string;
  /** La clase a la que lleva el botón. Default: la primera de `clases`. */
  claseId?: number;
  /** Avance total del curso, debajo del botón. */
  progreso?: { hechas: number; total: number };
};

export type TextosUgc = {
  inicio: string;
  recursos: string;
  /** Rótulo de la lista de módulos en la barra. */
  modulos: string;
  /** La palabra de arriba del nombre en la lámina de la tarjeta de un módulo. */
  modulo: string;
  /** Título del riel de tarjetas del índice. */
  losModulos: string;
  /** El placeholder del buscador. */
  buscar: string;
  todasLasClases: string;
  /** La salida de la barra cuando hay `onSalir` y no hay lección abierta. */
  salir: string;
  /** El botón de la portada. */
  empezar: string;
  leccion: string;
  lecciones: string;
  /** El contador de arriba a la derecha: «37 clases». */
  clases: string;
  /** Lo que dice un módulo con candado. */
  bloqueada: string;
  /** El botón que abre la lista de módulos en el teléfono. */
  menu: string;
  nueva: string;
  editar: string;
};

export type ModoUgc = 'pagina' | 'embebido';

export type CursoUgcProps = {
  /** El nombre del curso: arriba a la derecha y mientras carga la hoja. */
  titulo: string;
  /** Debajo del título. Default: «N clases» contando `clases`. */
  subtitulo?: string;
  /** Arriba de la barra. `resaltado` va en lima (el corte de color de la casa). Con `onClick` es un botón. */
  marca: { texto: string; resaltado?: string; onClick?: () => void; ariaLabel?: string };
  modulos: ModuloUgc[];
  /** Sólo las que se pueden abrir, en el orden del curso (Anterior/Siguiente siguen este orden). */
  clases: ClaseUgc[];
  portada?: PortadaUgc;
  /** Se llama con la clase abierta, en cada render. */
  leccion: (clase: ClaseUgc) => LeccionUgc;
  recursos?: RecursosUgc;
  entradasExtra?: EntradaExtraUgc[];
  edicion?: EdicionUgc;
  /** Fijo arriba del contenido, debajo del buscador (un selector de producto, un saludo). */
  arriba?: ReactNode;
  /** Una línea chica al pie de la barra («Este enlace es personal»). En el teléfono no va. */
  pieBarra?: ReactNode;
  /** El nivel de arriba del curso. Sin esto no hay salida en la barra (un share de UN curso). */
  onSalir?: () => void;
  /**
   * `pagina` (default): la pantalla ES el curso; mide la ventana y traba el scroll del
   * documento. `embebido`: vive adentro de la app; mide su contenedor y no toca el
   * documento. El padre de un embebido es `display:flex; flex-direction:column` con alto,
   * o un bloque con `height` explícito.
   */
  modo?: ModoUgc;
  textos?: Partial<TextosUgc>;
};
