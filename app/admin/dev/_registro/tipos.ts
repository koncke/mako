// =============================================================================
// El registro de construcción: los tipos, compartidos por todas las áreas
// =============================================================================
// Nacieron en la bitácora del rediseño (`app/admin/ui/bitacora.ts`) y se mueven
// acá cuando dejó de haber una sola: cada tab en desarrollo tiene su Roadmap y
// su Change History, y los tres se pintan con el MISMO componente. Copiar el
// tipo en cada área era la forma segura de que el quinto quedara viejo.
//
// Qué va en una entrada y qué no, que es lo mismo que pide AGENTS.md para los
// hallazgos: el motivo y la trampa, no el changelog. «Se agregó el componente
// X» ya está en el commit. Lo que no está en ningún lado es POR QUÉ, y sobre
// todo **el pedido textual del dueño** — la mitad de las reglas de la casa
// salieron de una frase suya, y resumida se pierde.
//
// LA HORA sale del commit, no del recuerdo (`git log --date=format:'%d %b %H:%M'`).
// EL CHAT es el título de la sesión de Claude Code; el índice completo está en
// docs/chats.md. LA CUENTA es cuál de las dos del repo lo hizo — sin eso, con
// dos sesiones en paralelo no hay a quién preguntarle por una decisión
// (docs/dos-cuentas.md).

/**
 * Las dos cuentas que trabajan este repo. El detalle, en docs/dos-cuentas.md.
 *
 * ⚠️ La 2 es de **Leandro Tejado**, no de Martín (corregido el 8/8 por Martín). El
 * `config` dice `.claude-martin` porque así se llamó la carpeta cuando se pensaba al
 * revés: es una RUTA, no el dueño de la cuenta, y renombrarla movería los junctions
 * de la memoria. No deduzcas de ahí quién está logueado.
 */
export const CUENTAS = {
  claude1: { n: 1, nombre: 'Mauricio', ventana: 'miércoles a viernes', config: '~\\.claude' },
  claude2: { n: 2, nombre: 'Leandro Tejado', ventana: 'sábado a martes', config: '~\\.claude-martin' },
  // La 3 es la de Martín (`~/.claude/cuentas.tsv`, desde el 10/10/2026). Su ventana y su carpeta no están
  // medidas: van «—» en vez de inventarlas. Sin esta fila, un hito firmado `claude3` rompía la pantalla
  // (`CUENTAS[h.cuenta].n` sobre undefined).
  claude3: { n: 3, nombre: 'Martín Koncke', ventana: '—', config: '—' },
  // La 4 entra el 16/10/2026 a la noche, cuando la 3 llegó al 99% semanal. El gmail es otro (está en
  // `~/.claude/cuentas.tsv`), pero la cuenta es de Martín, como las otras tres. Corre sólo en la app
  // (`~/.claude`); su semana renueva el martes a las 16:59 de Argentina.
  claude4: { n: 4, nombre: 'Leandro Tejado 2', ventana: '—', config: '~\\.claude (app)' },
} as const;

export type Cuenta = keyof typeof CUENTAS;

/** Quién produjo la entrada. Define el color, el avatar y el rótulo. */
export type Actor = 'martin' | 'claude';

export const TIPOS = {
  prompt: 'Prompt',
  implementacion: 'Implementación',
  investigacion: 'Investigación',
  correccion: 'Corrección',
  cosecha: 'Cosecha',
} as const;

export type Tipo = keyof typeof TIPOS;

export type Commit = { sha: string; msg: string; lineas: number; archivos: number };

export type Hito = {
  fecha: string;
  hora: string;
  /** Título de la sesión de Claude Code donde pasó. Ver docs/chats.md. */
  chat: string;
  /**
   * El id de la SESIÓN que lo anotó: `local_…` en la app (`echo $CLAUDE_CODE_HOST_SESSION_ID`) o
   * `cli_<CLAUDE_CODE_SESSION_ID>` en una terminal. El Centro de Operaciones junta cada hito con su chat
   * por esto y NUNCA por el título: hay títulos repetidos («CRM», «General») y chats renombrados
   * (docs/hallazgos-operaciones.md, 15/10/2026). Obligatorio desde el 16/10 (tests/progreso.test.ts).
   */
  sesion?: string;
  cuenta: Cuenta;
  actor: Actor;
  tipo: Tipo;
  titulo: string;
  /** El pedido TEXTUAL del dueño. Solo en los de tipo `prompt`. */
  pedido?: string;
  puntos: string[];
  /** Los commits que salieron de esto. */
  commits?: Commit[];
  /** Qué archivo hace qué, para no tener que buscarlo. */
  archivos?: string[];
  /** La página de MaKo donde Martín mira lo que se hizo (una ruta interna, «/crm?lead=12»): el Centro la pone en la
   *  sub-tab «Review» con el link «Revisar» (16/10/2026). */
  revisar?: string;
};

export type Parte = { titulo: string; detalle: string; estado: 'hecha' | 'sigue' | 'cola' };

/** Lo que expone cada área para su tab. */
/**
 * Lo que una AUDITORÍA midió sobre las tareas abiertas del tablero de un área.
 *
 * ⚠️ NO ES EL TABLERO Y NO LO REEMPLAZA. El título, el score y el deadline salen de
 * `plan_tareas` en cada carga; acá vive sólo el veredicto medido, que ninguna consulta
 * puede derivar — «esta tarea tiene una mitad hecha de verdad» es el resultado de ir a
 * leer el código, no un campo de la fila.
 *
 * ⚠️ Y ES UNA FOTO CON FECHA, por eso `fecha` es obligatoria y la pantalla la dibuja.
 * Un veredicto sin su fecha se lee como el estado de HOY, y el día que alguien arregle
 * una de estas tareas la línea miente sin que nada avise. Cuando la tarea se cierra, la
 * entrada se BORRA en vez de corregirse: media auditoría vieja es peor que ninguna.
 */
export type Auditoria = {
  /** Cuándo se midió, tal como se dibuja. */
  fecha: string;
  /** El slug del .md con el detalle largo, para el link a /admin/docs. */
  doc?: string;
  /** Por número de tarea del tablero. */
  filas: Record<number, { estado: 'medias' | 'sin'; falta: string }>;
};

export type Registro = { partes: Parte[]; bitacora: Hito[]; auditoria?: Auditoria };
