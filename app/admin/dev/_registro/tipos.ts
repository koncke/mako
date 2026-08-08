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

/** Las dos cuentas que trabajan este repo. El detalle, en docs/dos-cuentas.md. */
export const CUENTAS = {
  claude1: { n: 1, nombre: 'Mauricio', ventana: 'miércoles a viernes', config: '~\\.claude' },
  claude2: { n: 2, nombre: 'Martín', ventana: 'sábado a martes', config: '~\\.claude-martin' },
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
};

export type Parte = { titulo: string; detalle: string; estado: 'hecha' | 'sigue' | 'cola' };

/** Lo que expone cada área para su tab. */
export type Registro = { partes: Parte[]; bitacora: Hito[] };
