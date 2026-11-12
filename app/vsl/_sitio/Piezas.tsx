// =============================================================================
// Las piezas chicas del sitio de MaKo: su botón de capas, los íconos y las flechas
// =============================================================================
// Referencia: el botón de https://www.beehiiv.com/ (12/11/2026): la cara de color y, debajo, dos capas que se separan al pasar
// el mouse. Su índigo es el azul de MaKo y sus rosas, los dorados (docs/diseno/sitio-beehiiv.md). Server component.
// =============================================================================

import { CALENDLY, TEXTO_CTA } from '../_competencia/marca';

/** Su botón. Sin `href`, el de la llamada (el único llamado a la acción de las landings de /vsl). */
export function Boton({ href = CALENDLY, texto = TEXTO_CTA, clase = '', flecha = false }: { href?: string; texto?: string; clase?: string; flecha?: boolean }) {
  return (
    <a href={href} className={`s-btn ${clase}`.trim()}>
      <span className="s-btn-t">{texto}{flecha ? <FlechaLarga /> : null}</span>
      <span className="s-btn-c2" aria-hidden="true" />
      <span className="s-btn-c1" aria-hidden="true" />
    </a>
  );
}

/** Un ícono de trazo (paths de 24 × 24, como los de las landings). */
export function Icono({ d, size = 20 }: { d: readonly string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => <path key={p} d={p} />)}
    </svg>
  );
}

/** La flecha de sus links («Get started free →», «Compare →»). */
export function Flecha({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" />
    </svg>
  );
}

/** La flecha larga y fina de su botón «Make the switch». */
export function FlechaLarga() {
  return (
    <svg width="30" height="14" viewBox="0 0 30 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 7h27" /><path d="M22 1l6 6l-6 6" />
    </svg>
  );
}

/** El chevron de los renglones del menú del teléfono (gira al abrir). */
export function Chevron() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6l-6 6" />
    </svg>
  );
}

/** El tilde de la tabla de comparaciones. */
export function Tilde() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5l10 -10" />
    </svg>
  );
}
