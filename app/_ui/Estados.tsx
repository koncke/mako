'use client';

// =============================================================================
// Los estados de pantalla — ninguna vista puede quedar en blanco
// =============================================================================
// Principio 13.6 del documento de rediseño: «Diseñar éxito, error, carga, vacío,
// sin resultados, sin permiso, datos desactualizados, acción pendiente,
// ejecución y undo». De esos, hasta hoy la app tenía dos y medio: un EmptyState
// escrito a mano DOS veces (ClosingBrowser y /comercial), la confirmación
// repartida en dos implementaciones y un Undo que usaban dos archivos.
//
// La diferencia entre ellos NO es de matiz, y confundirlos hace que el producto
// parezca roto:
//
//   EmptyState       no hay contenido TODAVÍA. Primera vez. Dice para qué sirve
//                    esto y cuál es el primer paso.
//   NoResults        SÍ hay datos, el filtro no encontró nada. La salida es
//                    limpiar el filtro, no crear algo.
//   ErrorState       algo falló. Dice qué pasó y ofrece reintentar.
//   StaleData        lo que ves puede estar viejo. Dice DESDE CUÁNDO.
//   PermissionState  existe pero no te toca, por rol o por plan. No se puede
//                    confundir con «esto todavía no existe» (para eso está
//                    ComingSoon, en _components) ni con «es una función
//                    avanzada».
//
// Todos aceptan `inline` para vivir dentro de una card o una columna en vez de
// tomar la pantalla entera.

import type { ReactNode } from 'react';
import { Button, ButtonLink, type ButtonVariant } from './Button';
import { TONO, type Tono } from './tokens';

/** La salida del estado: o navega (href) o hace algo (onClick). Nunca las dos. */
type Accion = { label: string; onClick?: () => void; href?: string };

function Boton({ a, variant = 'primary' }: { a: Accion; variant?: ButtonVariant }) {
  if (a.href) return <ButtonLink href={a.href} size="sm" variant={variant}>{a.label}</ButtonLink>;
  return <Button size="sm" variant={variant} onClick={a.onClick}>{a.label}</Button>;
}

function Marco({ tono, ico, titulo, detalle, accion, secundaria, inline, extra }: {
  tono: Tono;
  ico: ReactNode;
  titulo: string;
  detalle?: ReactNode;
  accion?: Accion;
  secundaria?: Accion;
  inline?: boolean;
  extra?: ReactNode;
}) {
  const t = TONO[tono];
  return (
    <div className={`mk-state${inline ? ' mk-state--inline' : ''}`} role="status">
      <span className="mk-state__ico" style={{ background: t.bg, color: t.ink }} aria-hidden>{ico}</span>
      <span className="mk-state__t">{titulo}</span>
      {detalle && <span className="mk-state__d">{detalle}</span>}
      {(accion || secundaria) && (
        <div className="mk-row mk-row--stack" style={{ justifyContent: 'center', marginTop: 6 }}>
          {accion && <Boton a={accion} />}
          {secundaria && <Boton a={secundaria} variant="tertiary" />}
        </div>
      )}
      {extra}
    </div>
  );
}

// ── Los dibujos. Chicos, de línea, sin librería externa. ─────────────────────
const S = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const IcoVacio = <svg {...S}><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M3.5 10h17" /><path d="M12 13v3M10.5 14.5h3" /></svg>;
const IcoLupa = <svg {...S}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>;
const IcoError = <svg {...S}><path d="M12 3.6 21 20H3l9-16.4Z" /><path d="M12 10v4.2" /><path d="M12 17.2h.01" /></svg>;
const IcoReloj = <svg {...S}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
const IcoCandado = <svg {...S}><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>;

/**
 * Primera vez, sin contenido. Tiene que explicar el PROPÓSITO y dar el
 * siguiente paso — «No hay nada» a secas parece un error del producto.
 */
export function EmptyState({ titulo, detalle, accion, secundaria, ico, inline }: {
  titulo: string;
  /** Para qué sirve esta pantalla y qué va a aparecer acá. */
  detalle?: ReactNode;
  accion?: Accion;
  secundaria?: Accion;
  ico?: ReactNode;
  inline?: boolean;
}) {
  return <Marco tono="neutral" ico={ico ?? IcoVacio} titulo={titulo} detalle={detalle} accion={accion} secundaria={secundaria} inline={inline} />;
}

/**
 * Hay datos, el filtro no encontró nada. La acción es SIEMPRE limpiar: si acá
 * ofrecés «crear», el usuario crea un duplicado de algo que sí existe pero está
 * filtrado.
 */
export function NoResults({ query, onLimpiar, detalle, inline }: {
  /** Lo que se buscó, para que se vea en el mensaje. */
  query?: string;
  onLimpiar?: () => void;
  detalle?: ReactNode;
  inline?: boolean;
}) {
  return (
    <Marco tono="neutral" ico={IcoLupa} inline={inline}
      titulo={query ? `Nada coincide con «${query}»` : 'Ningún resultado con estos filtros'}
      detalle={detalle ?? 'Hay datos cargados, pero ninguno pasa el filtro actual.'}
      accion={onLimpiar ? { label: 'Limpiar filtros', onClick: onLimpiar } : undefined} />
  );
}

/**
 * Algo falló. Dos cosas obligatorias: qué pasó en castellano (no el stack) y
 * cómo salir. Si `detalleTecnico` viene, queda plegado para reportarlo.
 */
export function ErrorState({ titulo, detalle, onReintentar, detalleTecnico, inline }: {
  titulo?: string;
  detalle?: ReactNode;
  onReintentar?: () => void;
  /** El mensaje crudo del servidor. Va plegado: sirve para reportar, no para leer. */
  detalleTecnico?: string;
  inline?: boolean;
}) {
  return (
    <Marco tono="bad" ico={IcoError} inline={inline}
      titulo={titulo ?? 'No se pudo cargar'}
      detalle={detalle ?? 'Puede ser una caída momentánea. Probá de nuevo en unos segundos.'}
      accion={onReintentar ? { label: 'Reintentar', onClick: onReintentar } : undefined}
      extra={detalleTecnico ? (
        <details style={{ marginTop: 10, maxWidth: '100%' }}>
          <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-xs)', color: 'var(--faint)' }}>Detalle técnico</summary>
          <pre style={{ margin: '8px 0 0', padding: 10, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', fontSize: 11.5, color: 'var(--dim)', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detalleTecnico}</pre>
        </details>
      ) : undefined} />
  );
}

/**
 * Cinta de datos viejos. NO es un estado de pantalla completa: se pone ARRIBA
 * del contenido, que se sigue viendo. Un número viejo con su fecha vale más que
 * ningún número.
 */
export function StaleData({ desde, onActualizar, offline }: {
  /** Cuándo se actualizó por última vez. Fecha o texto ya formateado. */
  desde: Date | string;
  onActualizar?: () => void;
  /** Sin conexión: cambia el mensaje, porque reintentar no va a servir. */
  offline?: boolean;
}) {
  const cuando = typeof desde === 'string' ? desde : desde.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '9px 14px', borderRadius: 'var(--r-md)',
      background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)',
      color: 'var(--warn)', fontSize: 'var(--fs-sm)', fontWeight: 600,
    }}>
      <span style={{ display: 'flex', flex: 'none' }} aria-hidden>{IcoReloj}</span>
      <span style={{ flex: 1, minWidth: 160, fontWeight: 500 }}>
        {offline ? 'Sin conexión. ' : ''}Estos datos son del <strong>{cuando}</strong>.
      </span>
      {onActualizar && !offline && <Button size="sm" variant="secondary" onClick={onActualizar}>Actualizar</Button>}
    </div>
  );
}

/**
 * Existe, pero no te toca. `motivo` decide el texto, y la distinción importa:
 * «rol» se resuelve pidiéndole acceso a alguien, «plan» se resuelve contratando.
 * Ninguno de los dos es «esto todavía no existe» — para eso está ComingSoon.
 */
export function PermissionState({ motivo = 'rol', que, accion, inline }: {
  motivo?: 'rol' | 'plan';
  /** Qué es lo que no se puede ver, para nombrarlo. Ej.: «el Ads Manager». */
  que?: string;
  accion?: Accion;
  inline?: boolean;
}) {
  const nombre = que ?? 'esta sección';
  return (
    <Marco tono="neutral" ico={IcoCandado} inline={inline}
      titulo={motivo === 'plan' ? `${nombre[0].toUpperCase()}${nombre.slice(1)} no está en tu plan` : 'No tenés acceso a esta sección'}
      detalle={motivo === 'plan'
        ? 'Está construida y funcionando; tu plan actual no la incluye.'
        : `Tu rol dentro del negocio no incluye ${nombre}. Pedíselo a quien administra la cuenta.`}
      accion={accion} />
  );
}
