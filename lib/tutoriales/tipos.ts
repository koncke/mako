// =============================================================================
// El TUTORIAL de una pestaña: los datos que lee el motor del recorrido (18/11/2026)
// =============================================================================
// Un tutorial por pestaña de la app, con el formato de paso de la maqueta del onboarding (Martín, 18/11:
// «hacer el tutorial de todas las tabs teniendo en cuenta de que los vamos a hacer con la app real… para
// que quede similar»). Son DATOS: el motor que los muestra (el velo, el globo, el «Haz clic en…») lo arma el
// chat del onboarding sobre app/_ui/Recorrido.tsx y app/_ui/guia/, y sólo lo ve la revisión de Martín hasta
// que lo apruebe. Los guiones de cada uno: docs/reto-7-dias/tutoriales-por-pestana.md.
//
// UN SELECTOR PARA LAS DOS VERSIONES: la computadora (la ruta de escritorio) y el teléfono (MaKo Mobile,
// /m) son páginas distintas, pero el control equivalente lleva la MISMA marca (lib/tutoriales/marcas.ts), así
// que el paso anda en las dos. El paso que no tiene equivalente en el teléfono lo dice (`soloComputadora`):
// el motor lo saltea a sabiendas, no porque no encontró nada.
// =============================================================================

/** De qué lado del control sale el globo del paso. */
export type LadoPaso = 'arriba' | 'abajo' | 'izquierda' | 'derecha';

export type PasoTutorial = {
  /**
   * Lo que se marca: un selector CSS que se busca con `document.querySelector` (vale el PRIMERO que coincide).
   * Primero un `data-recorrido` (lib/tutoriales/marcas.ts); si no, un atributo que escribe el componente
   * (`aria-label`, `href`, otro `data-*`). Nunca una clase de un CSS Module ni un id de `useId`: cambian.
   */
  sel: string;
  /** El título del globo. Corto: dos a cuatro palabras. */
  titulo: string;
  /** Lo que dice el globo: qué es y para qué sirve, en una o dos frases. */
  texto: string;
  /** Lo que dice Martín en el video corto mientras el paso está marcado (el subtítulo). */
  sub?: string;
  /** De qué lado del control va el globo. */
  lado?: LadoPaso;
  /** El paso que pide un clic: el rótulo del botón del globo («Haz clic en «¿Qué hago hoy?»»). Va con `clic`. */
  haz?: string;
  /** Este paso termina con un clic de la persona en el control marcado (sólo el último paso). */
  clic?: true;
  /**
   * Un selector que se toca ANTES de marcar el paso (abrir un menú, «Mostrar más»), porque el control todavía no está en la
   * página. Si no se encuentra (ya se tocó, o en el teléfono no existe), se sigue sin tocarlo.
   */
  antes?: string;
  /** Sin equivalente en el teléfono: el motor saltea el paso en MaKo Mobile. */
  soloComputadora?: true;
  /**
   * Sin las tapas alrededor de lo marcado: el mouse tiene que poder pasar por otro lado (el menú de la foto se cierra si el mouse
   * sale de la foto y no llega al menú). Lo usan las marcas del reto (lib/reto/dias.ts, `MarcaReto.libre`).
   */
  libre?: true;
};

export type TutorialPestana = {
  /** La pestaña: la key de su archivo en lib/tutoriales (`crm`, `offer`, `settings`…). */
  pestana: string;
  /** El nombre que ve la persona (el de la barra o el del menú). */
  nombre: string;
  /** La ruta de escritorio donde corre. */
  ruta: string;
  /** La ruta de MaKo Mobile donde corre (sin ella, el tutorial es sólo de computadora). */
  rutaMovil?: string;
  /**
   * En qué momento de la pestaña corre, si no es al entrar: «editando la ficha de un lead», «adentro de una clase». Sin él, es
   * el tutorial de la pestaña (el que devuelve `tutorialDeRuta`); con él, lo pide el motor cuando la pantalla llega a ese estado.
   */
  estado?: string;
  /** La primera frase de Martín, antes del primer paso (sin marcar nada). */
  intro: string;
  pasos: PasoTutorial[];
};
