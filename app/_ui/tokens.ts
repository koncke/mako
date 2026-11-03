// =============================================================================
// Tokens del sistema de diseño — la escala, en TypeScript
// =============================================================================
// Los tokens de COLOR viven en app/globals.css (custom properties) porque tienen
// que poder cambiar por media query y por tema. Acá vive lo que el código en
// línea necesita como NÚMERO: radios, espaciado, tipografía, sombras.
//
// Por qué existe este archivo teniendo el CSS: hoy hay 7.510 `style={{…}}` en
// app/. Cada uno escribe su propio `borderRadius: 11` y su propio `fontSize: 13`.
// Mientras eso siga siendo un literal, cambiar el radio de los botones son mil
// ediciones. Importando de acá es UNA.
//
// Regla: si estás por escribir un número de diseño a mano, buscalo primero acá.
// Si no está y lo vas a usar más de una vez, agregalo.

/** Familias tipográficas. «Geist» es Urbanist desde el 31/10/2026: el @font-face de app/globals.css. */
export const SANS = "'Geist', system-ui, sans-serif";
/** Mono: números, códigos, etiquetas en mayúscula con tracking. Nunca prosa. */
export const MONO = "'Geist Mono', monospace";

/**
 * Radios. Apuntan a las variables CSS para que un cambio de globals.css se
 * propague también a los estilos en línea, sin recompilar nada.
 */
export const radius = {
  sm: 'var(--r-sm)',
  md: 'var(--r-md)',
  lg: 'var(--r-lg)',
  xl: 'var(--r-xl)',
  pill: '999px',
} as const;

/**
 * Espaciado en múltiplos de 4. Los nombres son tamaños, no lugares: `space.md`
 * es una medida, no «el gap de las cards».
 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Tipografía: los SIETE niveles del §18.3 del documento de rediseño. Todos son
 * variables CSS, así que SUBEN SOLOS en mobile (globals.css, media query de
 * 820 px). Los nombres son el USO, no el tamaño: así el día que el título de
 * sección pase de 21 a 20 px no queda un token llamado `xl` valiendo 20.
 *
 * No hay token por debajo de 12 px a propósito. El documento reserva el 10-11
 * para «información excepcionalmente secundaria», y hoy hay 2.392 de 3.815
 * `fontSize:` en línea por debajo de 14: si existiera el token, se usaría.
 */
export const type = {
  /** metadata, chips, timestamps · 12 → 13 */
  meta: 'var(--fs-meta)',
  /** texto secundario, ayudas, celdas densas · 13 → 14.5 */
  sm: 'var(--fs-sm)',
  /** TEXTO BASE de la interfaz · 14 → 16 */
  md: 'var(--fs-md)',
  /** título de tarjeta · 15.5 → 16.5 */
  card: 'var(--fs-card)',
  /** título de sección · 21 → 20 */
  sect: 'var(--fs-sect)',
  /** título de página · 30 → 26 */
  page: 'var(--fs-page)',
  /** el número grande de un KPI · 34 → 30 */
  kpi: 'var(--fs-kpi)',
} as const;

/** Pesos. 600 es «título/activo»; 700 se reserva para acciones y números. */
export const weight = { normal: 500, medium: 600, bold: 700 } as const;

/**
 * CIFRAS TABULARES. Un número que el usuario puede ver CAMBIAR —un KPI que cuenta
 * hasta su valor nuevo, una marca de eje que se re-etiqueta, una columna de una
 * tabla que se reordena— con cifras proporcionales cambia de ANCHO en cada cuadro:
 * el `1` es angosto y el `8` es ancho, así que el número baila mientras se mueve y
 * eso se lee como barato al instante. `tabular-nums` le da a cada dígito el mismo
 * ancho, y entonces el número cambia de valor sin cambiar de tamaño.
 *
 * Va en todo número que se actualice, se alinee en columna o se compare con el de
 * al lado. NO va en prosa: en una frase, las cifras tabulares se ven separadas.
 */
export const TABULAR = 'tabular-nums';

/**
 * TRACKING (`letter-spacing`). Los nombres son el USO, no el valor.
 *
 * La regla óptica: cuanto más grande la letra, más se CIERRA; las mayúsculas chicas
 * se ABREN. Un número de 34 px con el tracking por defecto se ve suelto, y un rótulo
 * de 12 px en mayúsculas sin abrir se ve apretado.
 *
 * Había 526 `letterSpacing` escritos a mano en `app/` y ningún token
 * (`docs/hallazgos-ui.md`), así que estos cinco valores son los que ya se usaban:
 * esto nombra lo que había, no inventa una escala nueva.
 */
export const tracking = {
  /** El número grande de un KPI y el título de página (lo de 26 px para arriba). */
  kpi: '-0.02em',
  /** Título de tarjeta y de sección (15 a 24 px). */
  titulo: '-0.015em',
  /** Texto corrido: sin tocar. Está para poder decirlo explícito. */
  normal: '0em',
  /** Un rótulo en MAYÚSCULAS, que es como va la etiqueta en mono de una KPI. */
  rotulo: '.08em',
  /** MAYÚSCULAS de 11 px o menos, donde hace falta abrir más. */
  rotuloAncho: '.12em',
} as const;

/**
 * Área táctil mínima. 40 px en desktop, 44 en mobile (globals.css). Todo lo
 * clickeable debe alcanzarla, aunque el ícono adentro sea de 16 px: se logra
 * con padding, no agrandando el dibujo.
 */
export const TOUCH = 'var(--touch)';

/** Sombras: sólo tres niveles. Card → menú flotante → modal. */
export const shadow = {
  card: 'var(--sombra-tarjeta)',
  pop: 'var(--sombra-pop)',
  modal: 'var(--sombra-modal)',
} as const;

/** Anillo de foco de teclado. Uno solo en toda la app. */
export const FOCUS = 'var(--focus-ring)';

/** Transición estándar de estados (hover, foco, activo). */
export const EASE = 'background .14s var(--ease-out), border-color .14s var(--ease-out), color .14s var(--ease-out), box-shadow .14s var(--ease-out)';

/**
 * Los tonos SEMÁNTICOS: los cinco significados de la regla de color. Cualquier
 * primitive que acepte un tono acepta exactamente estos, y ninguno más — es lo
 * que hace que un "warning" se vea igual en el CRM y en el Ads Manager.
 *
 *   mako    → intervino la inteligencia de MaKo   (dorado)
 *   info    → el usuario puede actuar             (azul)
 *   good    → resultado favorable o completado    (verde)
 *   warn    → cuidado, requiere atención          (naranja, NO dorado)
 *   bad     → riesgo, error o destrucción         (rojo)
 *   neutral → sin carga semántica                 (gris)
 */
export type Tono = 'mako' | 'info' | 'good' | 'warn' | 'bad' | 'neutral';

/** La paleta de cada tono: texto legible, relleno saturado, fondo y borde. */
export const TONO: Record<Tono, { ink: string; fill: string; bg: string; border: string }> = {
  mako: { ink: 'var(--mako-ink)', fill: 'var(--mako)', bg: 'var(--mako-bg)', border: 'var(--mako-border)' },
  info: { ink: 'var(--primary)', fill: 'var(--primary)', bg: 'var(--primary-bg)', border: 'var(--primary-weak)' },
  good: { ink: 'var(--good)', fill: 'var(--good)', bg: 'var(--good-bg)', border: 'var(--good)' },
  warn: { ink: 'var(--warn)', fill: 'var(--warn-fill)', bg: 'var(--warn-bg)', border: 'var(--warn-fill)' },
  bad: { ink: 'var(--bad)', fill: 'var(--bad)', bg: 'var(--bad-bg)', border: 'var(--bad)' },
  neutral: { ink: 'var(--dim)', fill: 'var(--faint)', bg: 'var(--surface-2)', border: 'var(--border-strong)' },
};
