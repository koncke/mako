'use client';

// =============================================================================
// Button · IconButton — la acción, con TODOS sus estados
// =============================================================================
// Reemplaza los 1.158 <button> sueltos de app/. La diferencia no es estética:
// un <button style={{…}}> no tiene :hover, ni :focus-visible, ni :disabled, ni
// forma de decir «estoy cargando». Cada pantalla resolvió eso a mano o no lo
// resolvió, y por eso dos botones que hacen lo mismo se ven distinto.
//
// Los estados que cubre, que son los que pide el documento de rediseño:
//   default · hover · focus · active · loading · disabled · éxito temporal
//
// Elegir la variante es elegir un SIGNIFICADO (ver la regla de color en
// globals.css). En particular: `mako` es para pedirle algo a la inteligencia,
// nunca para navegar; y nunca hay dos `primary` compitiendo en la misma vista.

import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';

/**
 * El «éxito temporal» del botón, listo para usar: `flash()` lo pone en verde y
 * vuelve solo. Existe para que una acción chica confirme EN EL LUGAR en vez de
 * disparar un toast — un toast por cada "Guardado" es ruido.
 *
 *   const { ok, flash } = useOkFlash();
 *   <Button ok={ok} okLabel="Guardado" onClick={async () => { await guardar(); flash(); }}>
 *     Guardar
 *   </Button>
 */
export function useOkFlash(ms = 1600) {
  const [ok, setOk] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback(() => {
    setOk(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOk(false), ms);
  }, [ms]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { ok, flash };
}

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'mako';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Base = {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícono a la izquierda del texto (un <Icon/>, un emoji, una chispa). */
  icon?: ReactNode;
  /** Ícono a la derecha (flechas, chevrons). */
  iconRight?: ReactNode;
  /** Ocupa todo el ancho disponible. En mobile suele ser lo correcto. */
  full?: boolean;
  /**
   * En curso. Bloquea el botón y muestra el spinner SIN sacar el texto: un
   * botón que cambia de tamaño al hacer click mueve todo lo que tiene al lado.
   */
  loading?: boolean;
  /**
   * Éxito temporal: se pone verde y muestra `okLabel` un instante. Es lo que
   * evita el toast en acciones chicas («Guardado», «Copiado»). Lo maneja quien
   * llama, normalmente con useOkFlash().
   */
  ok?: boolean;
  okLabel?: string;
  className?: string;
};

/** Alto del spinner según el tamaño del botón. */
const SPIN: Record<ButtonSize, number> = { sm: 12, md: 14, lg: 16 };

function inner({ children, icon, iconRight, loading, ok, okLabel, size }: Base) {
  const s = SPIN[size ?? 'md'];
  return (
    <>
      {loading
        ? <span className="mk-spin" style={{ width: s, height: s }} aria-hidden />
        : icon}
      {ok && okLabel ? okLabel : children}
      {!loading && iconRight}
    </>
  );
}

function classes({ variant = 'primary', size = 'md', full, loading, ok, className }: Base) {
  return [
    'mk-btn',
    `mk-btn--${variant}`,
    `mk-btn--${size}`,
    full ? 'mk-btn--full' : '',
    loading ? 'is-loading' : '',
    ok ? 'mk-btn--ok' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
}

export type ButtonProps = Base & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>;

export function Button({ variant, size, icon, iconRight, full, loading, ok, okLabel, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  const p = { children, variant, size, icon, iconRight, full, loading, ok, okLabel, className };
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes(p)} {...rest}>
      {inner(p)}
    </button>
  );
}

/**
 * El mismo botón, pero navega. Existe para que un enlace que se ve como botón
 * SEA un <a> — se puede abrir en pestaña nueva, el lector de pantalla lo anuncia
 * como enlace y el navegador muestra el destino abajo.
 */
export function ButtonLink({ href, variant, size, icon, iconRight, full, className, children, newTab }: Base & { href: string; newTab?: boolean }) {
  const p = { children, variant, size, icon, iconRight, full, className };
  const extra = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return <Link href={href} className={classes(p)} {...extra}>{inner(p)}</Link>;
}

/**
 * Botón de solo ícono. `title` es OBLIGATORIO: un ícono sin nombre es una
 * adivinanza, y sin él tampoco hay nada que anunciar por teclado.
 */
export function IconButton({ title, children, small, danger, className, ...rest }: {
  title: string;
  children: ReactNode;
  /** Versión compacta, para barras densas (filas de tabla, headers de card). */
  small?: boolean;
  /** Se tiñe de rojo al pasar el cursor: borrar, quitar, desconectar. */
  danger?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'title' | 'children'>) {
  const cls = ['mk-iconbtn', small ? 'mk-iconbtn--sm' : '', danger ? 'mk-iconbtn--danger' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type="button" title={title} aria-label={title} className={cls} {...rest}>
      {children}
    </button>
  );
}
