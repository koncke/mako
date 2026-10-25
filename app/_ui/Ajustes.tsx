'use client';

// =============================================================================
// Ajustes — el molde de «Tu cuenta» y «Configuración del negocio» (15/10/2026)
// =============================================================================
// Copiado de myaccount.google.com (relevado el 15/10/2026): el índice a la izquierda, una columna de
// lectura y LISTAS AGRUPADAS donde la fila entera abre su detalle. Lo que se quita, se olvida o se
// regenera vive ADENTRO del detalle, nunca suelto en la lista (lo que Martín marcó: «tachos sueltos»).
// El CSS está en ajustes.css (global, como ui.css), con sólo tokens de la casa.
//
// Las secciones salen de lib/ajustes-secciones.ts: el índice no se escribe en cada pantalla.

import type { ReactNode } from 'react';
import Link from './Link';
import { IconoMenu, type NombreIconoMenu } from './iconos-menu';
import type { GrupoSecciones, SeccionAjustes } from '@/lib/ajustes-secciones';

/**
 * La pantalla: el índice de su lugar y la sección activa. Desde el 24/10/2026 el lugar es UNO, «Settings», y el índice va por
 * `grupos` («Tu cuenta» y «Tu negocio», lib/ajustes-negocio.ts → gruposDeAjustes), como los ajustes de Linear o Notion: una barra
 * con los dos grupos, cada uno con su nombre arriba. `secciones` sola (sin grupos) queda para un índice de un solo grupo.
 */
export function AjustesPagina({ lugar, secciones, grupos, activa, amplio, children }: {
  /** «Settings»: el título del índice. */
  lugar: string;
  secciones?: SeccionAjustes[];
  grupos?: GrupoSecciones[];
  activa: string;
  /** Sin el ancho de lectura: un tablero (Integraciones) necesita el ancho de la pantalla. */
  amplio?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="aj">
      <nav className="aj-indice" aria-label={lugar}>
        <div className="aj-indice-titulo">{lugar}</div>
        {(grupos ?? [{ titulo: '', secciones: secciones ?? [] }]).map((g) => (
          <div key={g.titulo || 'unico'} className="aj-indice-grupo" role="group" aria-label={g.titulo || undefined}>
            {g.titulo && <div className="aj-indice-grupo-titulo">{g.titulo}</div>}
            {g.secciones.map((s) => (
              <Link key={s.key} href={s.href} data-activa={s.key === activa} aria-current={s.key === activa ? 'page' : undefined}>
                <IconoMenu nombre={s.icono} size={18} />
                {s.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="aj-cuerpo" data-amplio={amplio || undefined}>{children}</div>
    </main>
  );
}

/** El título de la sección (o del detalle), con su bajada. */
export function TituloAjustes({ titulo, bajada, volver }: { titulo: string; bajada?: ReactNode; volver?: { href: string; label: string } }) {
  return (
    <>
      {volver && (
        <Link href={volver.href} className="aj-volver">
          <span aria-hidden>←</span> {volver.label}
        </Link>
      )}
      <h1 className="aj-titulo">{titulo}</h1>
      {bajada ? <p className="aj-bajada">{bajada}</p> : <div style={{ height: 20 }} />}
    </>
  );
}

/**
 * Una sección: su título y una línea, y la TARJETA con las filas o el formulario (`.aj-grupo-caja`).
 * EN DOS COLUMNAS EN LA COMPUTADORA (25/10/2026, Martín: «en desktop es como que esta cortado a la mitad, no llega al final del
 * ancho»): el título a la izquierda y la tarjeta a la derecha, separadas por una línea de la sección de arriba, como los ajustes de
 * Catalyst (Tailwind) y la página de descargas de Linear, abiertas y miradas ese día. Así el ancho entero trabaja y no queda un
 * tercio vacío. Sin título, la tarjeta igual va en la columna de la derecha (todo alineado). En una ventana angosta y en el
 * teléfono, una debajo de la otra (ajustes.css).
 */
export function GrupoAjustes({ titulo, descripcion, children, pie, ancha }: {
  titulo?: string; descripcion?: ReactNode; children?: ReactNode; pie?: ReactNode;
  /** Una lista que necesita el ancho (los miembros del equipo, con sus columnas): el título arriba y la tarjeta entera, como las
   *  tablas de Catalyst. */
  ancha?: boolean;
}) {
  const cab = !!(titulo || descripcion);
  return (
    <section className="aj-grupo" data-sin-cab={cab ? undefined : 'true'} data-ancha={ancha || undefined}>
      {cab && (
        <div className="aj-grupo-cab">
          {titulo && <h2>{titulo}</h2>}
          {descripcion && <p>{descripcion}</p>}
        </div>
      )}
      {(children || pie) && (
        <div className="aj-grupo-caja">
          {children}
          {pie && <div className="aj-grupo-pie">{pie}</div>}
        </div>
      )}
    </section>
  );
}

/**
 * Un APARTADO de la página: un título como el de la página, más chico, que junta las secciones que siguen (25/10/2026: en
 * Notificaciones, «Los avisos del negocio» debajo de los tuyos). Con `id`, un link lo abre ahí (`#negocio`).
 */
export function ApartadoAjustes({ id, titulo, bajada, children }: { id?: string; titulo: string; bajada?: ReactNode; children: ReactNode }) {
  return (
    <div id={id} className="aj-apartado">
      <h2 className="aj-apartado-titulo">{titulo}</h2>
      {bajada && <p className="aj-bajada">{bajada}</p>}
      {children}
    </div>
  );
}

/**
 * Un subtítulo suelto, para los paneles que ya traen su propio recuadro (Horario, Equipo, Integraciones):
 * meterlos en una tarjeta más sería un marco adentro de otro.
 */
export function SubtituloAjustes({ titulo, descripcion }: { titulo: string; descripcion?: ReactNode }) {
  return (
    <div style={{ margin: '6px 0 14px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--ink)', margin: '0 0 4px' }}>{titulo}</h2>
      {descripcion && <p className="aj-texto" style={{ margin: 0 }}>{descripcion}</p>}
    </div>
  );
}

/** El cuerpo de una tarjeta que no es una lista (un formulario, un texto). */
export function CuerpoGrupo({ children }: { children: ReactNode }) {
  return <div className="aj-grupo-cuerpo">{children}</div>;
}

export function Pastilla({ tono, children }: { tono: 'good' | 'warn'; children: ReactNode }) {
  return <span className="aj-pastilla" data-tono={tono}>{children}</span>;
}

/**
 * Una fila: ícono, título, detalle y la flecha. La fila ENTERA es el botón (un Link si tiene `href`,
 * un botón si tiene `onClick`); sin ninguno de los dos es un dato quieto, sin flecha.
 * `apilada`: el detalle debajo del título (Seguridad, como Google); sin ella, al lado (Información personal).
 */
export function FilaAjustes({ icono, titulo, detalle, tono, estado, href, onClick, apilada, fin }: {
  icono?: NombreIconoMenu;
  titulo: ReactNode;
  detalle?: ReactNode;
  /** Una pastilla al lado del detalle (verde = activo, ámbar = falta). */
  tono?: 'good' | 'warn';
  estado?: string;
  href?: string;
  onClick?: () => void;
  apilada?: boolean;
  /** Lo que va a la derecha en vez de la flecha (un interruptor, por ejemplo). */
  fin?: ReactNode;
}) {
  const quieta = !href && !onClick;
  const contenido = (
    <>
      {icono && <span className="aj-fila-icono"><IconoMenu nombre={icono} size={22} /></span>}
      <span className="aj-fila-texto">
        <span className="aj-fila-titulo">{titulo}</span>
        {(detalle || estado) && (
          <span className="aj-fila-detalle">
            {tono && estado && <Pastilla tono={tono}>{estado}</Pastilla>}
            {detalle}
          </span>
        )}
      </span>
      <span className="aj-fila-fin">{fin ?? (quieta ? null : <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>›</span>)}</span>
    </>
  );
  if (href) return <Link href={href} className="aj-fila" data-apilada={apilada || undefined}>{contenido}</Link>;
  if (onClick) return <button type="button" className="aj-fila" data-apilada={apilada || undefined} onClick={onClick}>{contenido}</button>;
  return <div className="aj-fila" data-apilada={apilada || undefined} data-quieta="true">{contenido}</div>;
}
