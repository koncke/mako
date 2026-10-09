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
import type { ValorLamina } from '@/lib/laminas';

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
  /**
   * Una tapa que NO es una foto (un degradado de lib/portadas.ts), como `background` CSS. Va en
   * el mismo lugar que `portada` y le gana a la lámina. Con las dos, gana la foto.
   */
  fondo?: string | null;
  /**
   * UNA LÁMINA DISEÑADA (item 5, app/_cursos/laminas/): el diseño, sus dos colores y su texto. Va en
   * el lugar del cuaderno de siempre (`PortadaModulo`), que es lo que se dibuja sin esto. La foto y
   * el degradado le siguen ganando.
   */
  lamina?: ValorLamina | null;
  /** `bloqueada`: se dibuja con candado y no se puede abrir. */
  estado?: EstadoModulo;
  /**
   * Un rótulo chico sobre la tapa, que NO cierra nada: el candado que el equipo le puso al módulo,
   * dicho para quien lo arma («7 días después de entrar»). Al alumno le llega `estado` y `motivo`.
   */
  aviso?: string;
  /**
   * Por qué está cerrado, CORTO («Se abre el 12 de octubre»): lo decide el server (lib/curso-bloqueo.ts)
   * y reemplaza al texto genérico del candado (`textos.bloqueada`). Ausente = el genérico.
   */
  motivo?: string;
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
   * la sesión de una etapa terminada (el alumno) y el aviso de que no avanza sola (quien dicta).
   * Es un hueco: el dibujo no sabe qué es.
   */
  acciones?: ReactNode;
  /**
   * Un módulo que armó la PANTALLA y no existe como tal (las clases de una etapa borrada): con
   * `edicion`, no se renombra ni se le agregan clases.
   */
  sinEdicion?: boolean;
  /**
   * Se dibuja ATENUADO (la tarjeta y su renglón de la barra) y se abre igual: lo que el super admin
   * ocultó en Conocimientos, que sólo le llega a él (app/conocimientos/modelo-ugc.ts). Lo dice además
   * con `aviso`: atenuado solo no explica nada.
   */
  atenuado?: boolean;
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
  /** Una tapa que no es una foto (un degradado), como `background` CSS. Con las dos, gana la foto. */
  fondo?: string | null;
  /**
   * Una lámina diseñada como tapa (ver `ModuloUgc.lamina`). Se dibuja sólo SIN `tapa`: el adaptador
   * no pone la miniatura del video cuando se eligió una lámina, o la taparía.
   */
  lamina?: ValorLamina | null;
  /** Dibuja el triángulo de play sobre la tapa. */
  conVideo?: boolean;
  /** Chips de la tarjeta (estado de la tarea, % visto). Van con `<ChipUgc>`. */
  chips?: ReactNode;
  /** La pastilla arriba del título de la lección. Default: el nombre del módulo. */
  pastilla?: string;
  /** Texto que entra en la búsqueda además del título. Default: el nombre del módulo. */
  buscar?: string;
  /** Se dibuja ATENUADA y se abre igual (ver `ModuloUgc.atenuado`); lo dice un chip. */
  atenuado?: boolean;
};

/**
 * Lo que una pantalla pone adentro de la lección. Todo es opcional.
 *
 * ⚠️ SIN PESTAÑAS desde el 08/10/2026 (item 14): «Dentro de una clase, no deberían haber tabs de
 *    "Tarea" y "Descripción", por defecto ambas juntas siempre, y primero siempre la descripción».
 *    El papel es UNO y la pantalla pone adentro la descripción y, debajo, la tarea. Un material con
 *    varias hojas (Conocimientos: documento y transcripción) trae su propia cabecera adentro del
 *    papel (`CabeceraPestanas`, que sigue exportada para eso).
 */
export type LeccionUgc = {
  /**
   * El reproductor. `cuerpo` va adentro del marco 16:9 (`.ugc-vframe`: un `<iframe>` o un
   * `<video>` descendiente se estira solo a la caja); `barra` es la franja de abajo (quien edita
   * pone ahí «Cambiar» y «Quitar»).
   * Sin `video` no se dibuja el marco: un rectángulo negro sin nada adentro se lee como
   * un reproductor roto.
   */
  video?: { cuerpo: ReactNode; barra?: ReactNode };
  /**
   * Sin `video`: lo que va EN SU LUGAR, adentro de un recuadro punteado del mismo 16:9 (item 16:
   * «debe siempre estar un placeholder donde iría el vídeo para la opción de "Agregar vídeo"»). Es
   * de quien edita; el alumno no lo recibe, y sin esto no se dibuja nada.
   */
  sinVideo?: ReactNode;
  /** Debajo del video y antes de Anterior/Siguiente (la ficha de la clase, un link de afuera). */
  debajoDelVideo?: ReactNode;
  /**
   * El papel: la descripción y debajo la tarea, juntas. Va tal cual adentro de la columna del texto.
   *
   * Como FUNCIÓN recibe lo que el dibujo pone ARRIBA de todo adentro del papel —el interruptor «Texto
   * al costado / Texto abajo» de quien edita (item 13 del 08/10/2026), `null` si no hay—, y lo dibuja
   * adentro de su recuadro. Un papel que es un nodo lo recibe arriba suyo, afuera del recuadro.
   */
  papel?: ReactNode | ((arriba: ReactNode) => ReactNode);
  /** A lo ancho, debajo de las dos columnas («Material de esta clase»). */
  despues?: ReactNode;
};

/**
 * Dónde va el texto de la lección respecto del video: al costado (dos columnas) o abajo (todo a lo
 * ancho). Es el ajuste `disposicion` del curso (lib/curso-estilo.ts), que lo guarda.
 */
export type DisposicionUgc = 'costado' | 'abajo';

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
  /**
   * «+ Nueva clase», la PRIMERA tarjeta de cada módulo abierto (item 12: «que aparezcan primero, no
   * por último»: con treinta clases, el botón del final había que ir a buscarlo). Sin esto, no se
   * dibuja: en Conocimientos las clases salen de la ficha del curso y no se crean desde la pantalla, y
   * un «+ Nueva clase» que no hace nada se lee como que la app está rota.
   */
  onNueva?: (moduloKey: string) => void;
  /**
   * «+ Nuevo módulo», la PRIMERA tarjeta del índice. Pide el nombre EN SU LUGAR (la tarjeta se vuelve
   * un campo) y lo manda con la casilla de `opcionNuevoModulo`. Devuelve si quedó: con `false` el
   * campo se queda con lo tipeado. Sin esto, no se dibuja.
   */
  onNuevoModulo?: (nombre: string, conOpcion: boolean) => Promise<boolean>;
  /**
   * Una casilla, prendida por default, debajo del nombre del módulo nuevo (en la tab Curso: «Etapa
   * del kanban»). Sin esto, no hay casilla.
   */
  opcionNuevoModulo?: string;
  /**
   * Cuántas letras deja escribir el campo de «+ Nuevo módulo»: el tope del server (en la tab Curso, el
   * de una etapa del kanban, 40). Sin esto, 80. Un campo que deja escribir más de lo que el server
   * acepta promete un nombre que después rebota.
   */
  topeNombreModulo?: number;
  /**
   * ARRASTRAR UN MÓDULO (item 7), en la grilla del índice o en la barra: la lista ENTERA de keys en
   * el orden nuevo (los que se pueden mover: sin `sinEdicion`). La pantalla mueve en el acto y, si el
   * server rechaza, vuelve. Sin esto, los módulos no se arrastran.
   */
  onOrdenarModulos?: (keys: string[]) => void;
  /**
   * ARRASTRAR UNA CLASE (item 7): en la grilla de su módulo (`antesDe` = la clase que queda después,
   * `null` = al final), o SOLTADA SOBRE OTRO MÓDULO de la barra (va al final de ése). Sin esto, las
   * clases no se arrastran.
   */
  onLlevarClase?: (claseId: number, moduloKey: string, antesDe: number | null) => void;
  /**
   * El menú «…» de un módulo (en su tarjeta y en su cabecera) y de una clase (en su tarjeta): lo ARMA
   * LA PANTALLA (renombrar, portada, candado, borrar…); el dibujo pone el botón y el desplegable. Sin
   * esto, no hay botón.
   */
  menuModulo?: (m: ModuloUgc, ctl: ControlMenuUgc) => ReactNode;
  menuClase?: (c: ClaseUgc, ctl: ControlMenuUgc) => ReactNode;
  // ⚠️ SIN `onEditar` desde el 08/10/2026 (item 16): el botón «Editar» y su modal se fueron, cada
  //    parte de la lección se edita en su lugar (ver `LeccionUgc`, y la pantalla que la arma).
  onMover: (claseId: number, dir: 'arriba' | 'abajo') => void;
  onBorrar: (claseId: number) => void;
  /** Default: por posición dentro de su módulo (la primera no sube, la última no baja). */
  puedeMover?: (claseId: number, dir: 'arriba' | 'abajo') => boolean;
  /** Mientras se guarda: los controles se APAGAN, no se desmontan (uno que desaparece bajo el dedo se lee como un clic perdido). */
  ocupado?: boolean;
  /**
   * El CLIC EN UN TEXTO lo edita en el lugar (el título y la descripción de la portada, el nombre
   * de un módulo, el título de una clase). Devuelve si quedó: con `false` vuelve el de antes.
   * Sin esto, los textos se leen y no se tocan.
   */
  onTexto?: (que: TextoUgc, valor: string) => Promise<boolean>;
  /**
   * «Portada» en la portada del curso, en cada tarjeta de módulo y en cada clase. La pantalla abre
   * su selector colgado de `ancla` (el botón que se tocó).
   */
  onPortada?: (que: ObjetivoUgc, ancla: HTMLElement) => void;
  /**
   * «Texto al costado / Texto abajo» en la lección (item 16). Cambia el ajuste del CURSO, no el de
   * esa clase: la pantalla lo guarda y vuelve a pasar `disposicion`. Sin esto, el interruptor no se
   * dibuja.
   */
  onDisposicion?: (d: DisposicionUgc) => void;
};

/**
 * Lo que recibe el armado de un menú «…»: cerrarlo, el botón del que cuelga (para abrir desde ahí otro
 * desplegable, como el de la portada) y, en un módulo, poner su nombre a editar en la tarjeta.
 */
export type ControlMenuUgc = { cerrar: () => void; ancla: HTMLElement | null; renombrar?: () => void };

/** De qué es una portada. */
export type ObjetivoUgc = { tipo: 'curso' } | { tipo: 'modulo'; key: string } | { tipo: 'clase'; id: number };

/** Qué texto se editó. */
export type TextoUgc =
  | { tipo: 'curso-titulo' }
  | { tipo: 'curso-resumen' }
  | { tipo: 'modulo'; key: string }
  | { tipo: 'clase'; id: number };

/** La lista de recursos de un curso. El dibujo lo trae la pantalla (hoy sólo Conocimientos). */
export type RecursosUgc = {
  cuantos: number;
  render: (ctl: { abierto?: string; abrir: (slug: string) => void; cerrar: () => void }) => ReactNode;
};

/** La portada del índice (el «hero»). Lleva a una clase. */
export type PortadaUgc = {
  tapa?: string | null;
  /** Una tapa que no es una foto (un degradado), como `background` CSS. Con las dos, gana la foto. */
  fondo?: string | null;
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
  /** La primera tarjeta de un módulo abierto, para quien edita. */
  nueva: string;
  /** La primera tarjeta del índice, para quien edita. */
  nuevoModulo: string;
  /** El campo de esa tarjeta, vacío. */
  nombreModulo: string;
  /** El rótulo (de accesibilidad) del botón «…» de un módulo o una clase. */
  opciones: string;
  /** Lo que se lee en la descripción vacía de la portada, mientras se edita. */
  sinResumen: string;
  /** El botón que cambia una portada. */
  portada: string;
  /**
   * Lo que dice un módulo ABIERTO y VACÍO a quien no edita (item 16 del audio del 08/10/2026: el módulo
   * publicado sin clases aparece «como en Skool», con un «coming soon»). Ausente = no se dice nada (el
   * dibujo de Conocimientos no tiene módulos vacíos).
   */
  moduloVacio?: string;
};

export type ModoUgc = 'pagina' | 'embebido';

export type CursoUgcProps = {
  /** El nombre del curso: arriba a la derecha y mientras carga la hoja. */
  titulo: string;
  /** Debajo del título. Default: «N clases» contando `clases`. */
  subtitulo?: string;
  /** Arriba de la barra. `resaltado` va en lima (el corte de color de la casa). Con `onClick` es un botón. */
  marca: {
    texto: string; resaltado?: string; onClick?: () => void; ariaLabel?: string;
    /**
     * El menú que despliega la marca: cambiar de producto, el color, la vista del alumno. Con
     * `menu`, la marca es un DESPLEGABLE (y `onClick` no se usa). Recibe con qué cerrarlo.
     */
    menu?: (cerrar: () => void) => ReactNode;
  };
  /**
   * El color de acento del curso (el lima de la casa por default), en `#RRGGBB`. Lo pinta
   * `varsDeAcento` (lib/curso-estilo.ts), que ya lo trae legible.
   */
  acento?: string | null;
  modulos: ModuloUgc[];
  /** Sólo las que se pueden abrir, en el orden del curso (Anterior/Siguiente siguen este orden). */
  clases: ClaseUgc[];
  portada?: PortadaUgc;
  /** Se llama con la clase abierta, en cada render. */
  leccion: (clase: ClaseUgc) => LeccionUgc;
  /** Dónde va el texto de la lección (default `costado`). Ver `DisposicionUgc`. */
  disposicion?: DisposicionUgc;
  recursos?: RecursosUgc;
  entradasExtra?: EntradaExtraUgc[];
  edicion?: EdicionUgc;
  /** Fijo arriba del contenido, debajo del buscador (un selector de producto, un saludo). */
  arriba?: ReactNode;
  /**
   * Botones de la barra de arriba, entre el buscador y el nombre del curso: lo que se hace con el
   * curso ENTERO («Invitar alumnos», «Vista del alumno», el «?» del recorrido; en Conocimientos,
   * «Compartir»). Siempre a la vista: en un menú no los encuentra nadie.
   */
  topbarExtra?: ReactNode;
  /**
   * Arriba a la DERECHA, EN LUGAR del nombre del curso: las acciones de quien EDITA («Vista del
   * alumno», «Invitar alumnos» y el «?» del recorrido; item 14 del 08/10/2026). Sin esto va el nombre
   * del curso con su cuenta de clases, que es lo que ve el alumno. A diferencia del nombre, no se
   * esconde en el teléfono: baja de renglón (una barra no scrollea de costado, AGENTS.md).
   */
  acciones?: ReactNode;
  /**
   * La fuente del curso: un id de app/_cursos/fuentes.ts (`null` = la de siempre). La pinta
   * `varsDeFuente` en `.ugc`, como el acento, y la hoja de esa familia se pide sólo si hace falta.
   */
  fuente?: string | null;
  /** Una línea chica al pie de la barra («Este curso es personal. © …»). En el teléfono no va. */
  pieBarra?: ReactNode;
  /**
   * La lección con UN SOLO SCROLL, el del contenido: las dos columnas crecen con lo suyo y no scrollean por
   * su cuenta, y el video queda pegado arriba (sticky) mientras se lee al costado. Sin esto (default), cada
   * columna scrollea la suya, como en Conocimientos, donde un documento mide 8000 px.
   *
   * Lo pide la VISTA DEL ALUMNO (punto 4 del audio del 08/10 a la noche, min 10: «hay dos scroll… tengo que
   * poner el cursor acá para que pueda deslizar»). Medido: la columna del papel es un contenedor de scroll
   * con `overscroll-behavior: contain`, y con el cursor encima la rueda no llegaba al contenido — en la
   * vista previa, ni un píxel. Conocimientos (con alumnos reales) y la tab Curso siguen como estaban.
   */
  unSoloScroll?: boolean;
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
