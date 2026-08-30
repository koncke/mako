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
export function ErrorState({
  titulo, detalle, onReintentar, accion, secundaria, detalleTecnico, inline,
}: {
  titulo?: string;
  detalle?: ReactNode;
  /**
   * El atajo de siempre. Dibuja un botón que dice «Reintentar» a secas — que la
   * casa prohíbe — y por eso sigue acá SOLO para los call-sites que ya lo usan.
   * Para algo nuevo va `accion`, que nombra su objeto.
   */
  onReintentar?: () => void;
  /** La salida, nombrada: «Volver a generar la imagen del escenario 1». */
  accion?: { label: string; onClick?: () => void; href?: string };
  /** La otra salida, cuando existe: casi siempre la que NO depende de nosotros. */
  secundaria?: { label: string; onClick?: () => void; href?: string };
  /** El mensaje crudo del servidor. Va plegado: sirve para reportar, no para leer. */
  detalleTecnico?: string;
  inline?: boolean;
}) {
  return (
    <Marco tono="bad" ico={IcoError} inline={inline}
      titulo={titulo ?? 'No se pudo cargar'}
      detalle={detalle ?? 'Puede ser una caída momentánea. Prueba de nuevo en unos segundos.'}
      accion={accion ?? (onReintentar ? { label: 'Reintentar', onClick: onReintentar } : undefined)}
      secundaria={secundaria}
      extra={detalleTecnico ? (
        <details style={{ marginTop: 10, maxWidth: '100%' }}>
          <summary style={{ cursor: 'pointer', fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>Detalle técnico</summary>
          <pre style={{ margin: '8px 0 0', padding: 10, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', fontSize: 11.5, color: 'var(--dim)', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detalleTecnico}</pre>
        </details>
      ) : undefined} />
  );
}

/**
 * Cinta a lo ancho: NO es un estado de pantalla, es un mensaje ARRIBA del
 * contenido, que se sigue viendo. Sirve para las dos piezas que el documento
 * separa (§19.5) y que solo se diferencian por su alcance:
 *
 *   Alert   — mensaje contextual DENTRO de una pantalla, pegado a lo que
 *             afecta («esta campaña está pausada desde el martes»).
 *   Banner  — estado GLOBAL o de módulo, arriba de todo («la conexión con
 *             Meta se cayó», «estás viendo la cuenta de un cliente»).
 *
 * Es el mismo componente porque son la misma forma con distinto alcance;
 * `alcance` es lo único que cambia. Escribir dos habría sido volver a la
 * enfermedad que este sistema viene a curar.
 */
export function Banner({ tono = 'info', children, accion, onCerrar, ico, alcance = 'global' }: {
  tono?: Tono;
  children: ReactNode;
  accion?: Accion;
  /** Si se puede descartar. Sin esto, la cinta se queda hasta que el estado cambie. */
  onCerrar?: () => void;
  ico?: ReactNode;
  /** `global` va arriba del contenido; `local` va pegado a lo que afecta. */
  alcance?: 'global' | 'local';
}) {
  const t = TONO[tono];
  return (
    <div role={tono === 'bad' ? 'alert' : 'status'} style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: alcance === 'global' ? '10px 14px' : '8px 12px',
      borderRadius: 'var(--r-md)',
      background: t.bg, border: `1px solid ${t.border}`, color: t.ink,
      fontSize: 'var(--fs-sm)', lineHeight: 1.5,
    }}>
      {ico && <span style={{ display: 'flex', flex: 'none' }} aria-hidden>{ico}</span>}
      <span style={{ flex: 1, minWidth: 160 }}>{children}</span>
      {accion && <Boton a={accion} variant="secondary" />}
      {onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Descartar aviso"
          style={{ flex: 'none', background: 'transparent', border: 'none', color: 'currentColor', opacity: 0.6, fontSize: 15, cursor: 'pointer', lineHeight: 1, padding: 4 }}>
          ✕
        </button>
      )}
    </div>
  );
}

/** El mismo Banner, con alcance local: el mensaje vive junto a lo que afecta. */
export function Alert(p: Omit<Parameters<typeof Banner>[0], 'alcance'>) {
  return <Banner {...p} alcance="local" />;
}

/**
 * Datos viejos u offline. Es un Banner de tono `warn` con el texto ya resuelto:
 * lo importante es que SIEMPRE diga desde cuándo. Un número viejo con su fecha
 * vale más que ningún número; un número viejo sin fecha vale menos.
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
    <Banner tono="warn" ico={IcoReloj}
      accion={onActualizar && !offline ? { label: 'Actualizar', onClick: onActualizar } : undefined}>
      {offline ? 'Sin conexión. ' : ''}Estos datos son del <strong>{cuando}</strong>.
    </Banner>
  );
}

/**
 * Existe, pero no te toca. `motivo` decide el texto, y la distinción importa
 * porque cada uno se resuelve en un lugar distinto:
 *   · «rol»    → se resuelve pidiéndole acceso a quien administra la cuenta.
 *   · «plan»   → se resuelve contratando.
 *   · «ajeno»  → no se resuelve: el link es de OTRA cuenta. Lo único que se
 *                puede hacer es volver a lo propio.
 * Ninguno de los tres es «esto todavía no existe» — para eso está ComingSoon.
 *
 * ⚠️ POR QUÉ 'ajeno' ESTÁ ACÁ Y NO ES UNA PANTALLA SUELTA. Antes, abrir el link
 * de un lead de otro workspace tiraba el 404 crudo de Next («This page could not
 * be found»), que dice la cosa equivocada: la página existe, el lead existe, lo
 * que no coincide es la cuenta. El dueño lo vio y lo pidió con esas palabras
 * («debería ser algo como "este lead no es tuyo", con un botón a tu CRM»).
 *
 * Y el texto NO nombra de quién es. Decir «esto es de Fulano» convierte una
 * pantalla de error en un oráculo: probando ids se reconstruye la cartera de
 * clientes ajena. Se dice que no es de esta cuenta y nada más.
 */
export function PermissionState({ motivo = 'rol', que, accion, secundaria, inline }: {
  motivo?: 'rol' | 'plan' | 'ajeno';
  /** Qué es lo que no se puede ver, para nombrarlo. Ej.: «el Ads Manager». */
  que?: string;
  accion?: Accion;
  secundaria?: Accion;
  inline?: boolean;
}) {
  const nombre = que ?? 'esta sección';
  const Nombre = `${nombre[0].toUpperCase()}${nombre.slice(1)}`;
  const titulo = motivo === 'plan' ? `${Nombre} no está en tu plan`
    : motivo === 'ajeno' ? `${Nombre} no es de esta cuenta`
    : 'No tienes acceso a esta sección';
  const detalle = motivo === 'plan' ? 'Está construida y funcionando; tu plan actual no la incluye.'
    : motivo === 'ajeno' ? 'El link que abriste es de otro negocio. Entra con la cuenta que corresponde, o sigue con lo tuyo.'
    : `Tu rol dentro del negocio no incluye ${nombre}. Pedíselo a quien administra la cuenta.`;
  return (
    <Marco tono="neutral" ico={IcoCandado} inline={inline}
      titulo={titulo} detalle={detalle} accion={accion} secundaria={secundaria} />
  );
}
