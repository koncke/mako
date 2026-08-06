'use client';

// =============================================================================
// PageHeader · Section — el encabezado que va en casi todas las pantallas
// =============================================================================
// El documento de arquitectura (§3.4) le pone cinco piezas y ni una más:
//
//   Título · una línea de PROPÓSITO · estado relevante · filtros principales
//   · UNA acción primaria
//
// La línea de propósito es la que hoy no existe en ninguna tab y es la que más
// se nota: dice QUÉ PREGUNTA RESPONDE esta pantalla. Sin ella el usuario tiene
// que deducir para qué sirve un módulo entrando y mirando.
//
// ⚠️ No confundir con la regla de la casa «nada de subtítulos innecesarios».
// Esa prohíbe la bajada decorativa que repite el título con otras palabras. El
// propósito es lo contrario: información que no está en ningún otro lado. Si lo
// que ibas a escribir se deduce del título, no lo escribas — dejá `proposito`
// vacío y listo.
//
// Y una sola acción primaria (principio 13.3). Si tenés dos candidatas, una es
// secundaria: el usuario tiene que reconocer de un vistazo cuál avanza el flujo.

import type { ReactNode } from 'react';
import { MONO } from './tokens';

export function PageHeader({ titulo, proposito, estado, filtros, accion, acciones, tabs, compacto }: {
  titulo: string;
  /** Qué pregunta responde esta pantalla. Una línea. Omitilo si es obvio. */
  proposito?: string;
  /** Estado relevante del módulo: conexión, última sincronización, modo. */
  estado?: ReactNode;
  /** Los filtros PRINCIPALES. Los demás van a un menú o a un sheet. */
  filtros?: ReactNode;
  /** LA acción primaria. Una sola. */
  accion?: ReactNode;
  /** Acciones secundarias, a la izquierda de la primaria y con menos peso. */
  acciones?: ReactNode;
  /** Vistas hermanas del mismo nivel (Tabs). Van pegadas abajo del header. */
  tabs?: ReactNode;
  /** Versión de una línea, para pantallas de detalle dentro de un flujo. */
  compacto?: boolean;
}) {
  return (
    <header style={{
      display: 'flex', flexDirection: 'column', gap: 14,
      paddingBottom: tabs ? 0 : 18,
      marginBottom: tabs ? 0 : 'var(--sect-gap)',
      borderBottom: tabs ? undefined : '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{
              margin: 0, fontSize: compacto ? 'var(--fs-sect)' : 'var(--fs-page)',
              fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--ink)',
            }}>{titulo}</h1>
            {estado}
          </div>
          {proposito && (
            <p style={{ margin: '7px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5, maxWidth: 640 }}>
              {proposito}
            </p>
          )}
        </div>
        {(accion || acciones) && (
          // En mobile la fila se apila y la acción primaria toma el ancho: es la
          // única que tiene que poder tocarse sin apuntar.
          <div className="mk-row mk-row--stack" style={{ flex: 'none', justifyContent: 'flex-end' }}>
            {acciones}
            {accion}
          </div>
        )}
      </div>
      {filtros && (
        // Los filtros scrollean DENTRO de su caja en pantalla chica; el body
        // nunca se mueve de costado.
        <div className="mk-scroll-x">
          <div className="mk-row" style={{ flexWrap: 'nowrap', paddingBottom: 2 }}>{filtros}</div>
        </div>
      )}
      {tabs}
    </header>
  );
}

/**
 * Agrupación por título y espacio. El documento es explícito (§19.3): «no
 * siempre requiere tarjeta». Envolver todo en cards produce el padding sobre
 * padding que el mismo documento pide evitar — por defecto esto es solo un
 * título y aire, y la tarjeta es opt-in.
 */
export function Section({ titulo, nota, accion, children, card = false, id }: {
  titulo?: string;
  /** Una aclaración corta al lado del título. No una bajada. */
  nota?: ReactNode;
  /** Acción propia de esta sección (ver todo, agregar, configurar). */
  accion?: ReactNode;
  children: ReactNode;
  /** Envolver en una superficie con borde. Solo si el bloque es una unidad. */
  card?: boolean;
  id?: string;
}) {
  const cuerpo = card
    ? <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--card-pad)' }}>{children}</div>
    : children;
  return (
    <section id={id} style={{ marginBottom: 'var(--sect-gap)' }}>
      {(titulo || accion) && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {titulo && <h2 style={{ margin: 0, fontSize: 'var(--fs-sect)', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{titulo}</h2>}
          {nota && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{nota}</span>}
          <span style={{ flex: 1 }} />
          {accion}
        </div>
      )}
      {cuerpo}
    </section>
  );
}

/**
 * La etiqueta en versalitas y mono que la app ya usa para rotular bloques
 * («ADMINISTRACIÓN», «PROYECTOS»). Estaba escrita a mano en decenas de lugares
 * con cinco tamaños y cuatro tracking distintos.
 */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)' }}>
      {children}
    </span>
  );
}
