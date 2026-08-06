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

/** Familias tipográficas. La app entera es Geist (ver app/layout.tsx). */
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
 * Tipografía. Los cuatro primeros son variables CSS: SUBEN SOLOS en mobile
 * (globals.css, media query de 820 px). Usalos para todo lo que sea texto de
 * interfaz; los literales quedan para casos puntuales (números gigantes).
 */
export const type = {
  /** metadata, chips, timestamps · 12 → 13 en mobile */
  xs: 'var(--fs-xs)',
  /** texto secundario, ayudas, celdas densas · 13.5 → 14.5 */
  sm: 'var(--fs-sm)',
  /** texto base de la interfaz · 15 → 16 */
  md: 'var(--fs-md)',
  /** títulos de bloque · 17 → 18 */
  lg: 'var(--fs-lg)',
} as const;

/** Pesos. 600 es «título/activo»; 700 se reserva para acciones y números. */
export const weight = { normal: 500, medium: 600, bold: 700 } as const;

/**
 * Área táctil mínima. 40 px en desktop, 44 en mobile (globals.css). Todo lo
 * clickeable debe alcanzarla, aunque el ícono adentro sea de 16 px: se logra
 * con padding, no agrandando el dibujo.
 */
export const TOUCH = 'var(--touch)';

/** Sombras: sólo tres niveles. Card → menú flotante → modal. */
export const shadow = {
  card: '0 1px 2px rgba(18,21,27,.05)',
  pop: '0 16px 40px rgba(18,21,27,.22)',
  modal: '0 30px 70px rgba(18,21,27,.35)',
} as const;

/** Anillo de foco de teclado. Uno solo en toda la app. */
export const FOCUS = 'var(--focus-ring)';

/** Transición estándar de estados (hover, foco, activo). */
export const EASE = 'background .14s ease, border-color .14s ease, color .14s ease, box-shadow .14s ease';

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
