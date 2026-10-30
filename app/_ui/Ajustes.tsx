'use client';

// =============================================================================
// Ajustes — el molde de Settings, copiado de los ajustes de LINEAR (25/10/2026)
// =============================================================================
// Martín, 25/10/2026: «Pusiste textos previo a la configuración que están muy de sobra… Te pedí un rediseño completo de
// todas esas tabs… Fijate como lo hacen otras apps y hazlo bien». La referencia es Linear (Settings › My Account y
// Workspace; capturas y qué se copia de dónde en docs/settings/referencia.md):
//   · el índice a la izquierda, con «Settings» y dos grupos;
//   · una COLUMNA CENTRADA en el resto del ancho, con el título de la página y una línea, sin bajada;
//   · cada sección, su nombre y una tarjeta con FILAS: el nombre a la izquierda (y, si suma, una línea gris debajo) y el
//     control a la derecha —un interruptor, un select, un campo, un botón de texto o la flecha que abre el detalle—;
//   · todo guarda al instante, sin botón «Guardar», y un aviso chico lo confirma.
// Lo que se fue: la columna de la izquierda con un párrafo por sección (Catalyst, 25/10 mañana), que era justo el «texto de
// sobra». El CSS está en ajustes.css (global, como ui.css), con sólo tokens de la casa.
//
// Las secciones salen de lib/ajustes-secciones.ts: el índice no se escribe en cada pantalla.

import type { CSSProperties, ReactNode } from 'react';
import Link from './Link';
import { IconoMenu, type NombreIconoMenu } from './iconos-menu';
import type { GrupoSecciones, SeccionAjustes } from '@/lib/ajustes-secciones';

/**
 * La pantalla: el índice de Settings y la sección activa. El índice va por `grupos` («Tu cuenta» y «Tu negocio»,
 * lib/ajustes-negocio.ts → gruposDeAjustes), como «My Account» y «Workspace» de Linear. `secciones` sola (sin grupos)
 * queda para un índice de un solo grupo.
 */
export function AjustesPagina({ lugar, secciones, grupos, activa, amplio, children }: {
  /** «Settings»: el título del índice. */
  lugar: string;
  secciones?: SeccionAjustes[];
  grupos?: GrupoSecciones[];
  activa: string;
  /** Una columna más ancha: un tablero (Integraciones) necesita el ancho de la pantalla. */
  amplio?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="aj">
      <nav className="aj-indice" aria-label={lugar}>
        {/* La tuerca, el ícono de Settings en toda la app (25/10/2026, Martín: «siempre debe ser la tuerca»). `configurar` ES la
            tuerca desde la rama del Ops Center (app/_ui/icono-tuerca.ts); antes eran los deslizantes. */}
        <div className="aj-indice-titulo"><IconoMenu nombre="configurar" size={18} />{lugar}</div>
        {(grupos ?? [{ titulo: '', secciones: secciones ?? [] }]).map((g) => (
          <div key={g.titulo || 'unico'} className="aj-indice-grupo" role="group" aria-label={g.titulo || undefined}>
            {g.titulo && <div className="aj-indice-grupo-titulo">{g.titulo}</div>}
            {g.secciones.map((s) => (
              <Link key={s.key} href={s.href} data-activa={s.key === activa} aria-current={s.key === activa ? 'page' : undefined}>
                <IconoMenu nombre={s.icono} size={17} />
                {s.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="aj-cuerpo" data-amplio={amplio || undefined}>
        <div className="aj-columna">{children}</div>
      </div>
    </main>
  );
}

/**
 * El título de la página (o del detalle), y la línea que la separa de las secciones. Como Linear, sin bajada: la `bajada`
 * queda para un DATO de una línea (de quién es el perfil que miras), nunca para explicar la pantalla. `accion` va a la
 * derecha del título (un botón «Invitar», por ejemplo).
 */
export function TituloAjustes({ titulo, bajada, volver, accion }: {
  titulo: string; bajada?: ReactNode; volver?: { href: string; label: string }; accion?: ReactNode;
}) {
  return (
    <header className="aj-cabecera">
      {volver && (
        <Link href={volver.href} className="aj-volver">
          <span aria-hidden>←</span> {volver.label}
        </Link>
      )}
      <div className="aj-cabecera__fila">
        <h1 className="aj-titulo">{titulo}</h1>
        {accion && <div className="aj-cabecera__accion">{accion}</div>}
      </div>
      {bajada && <p className="aj-bajada">{bajada}</p>}
    </header>
  );
}

/**
 * Una sección: su nombre arriba y la TARJETA con las filas o el formulario (`.aj-grupo-caja`), como «General» o «Interface
 * and theme» en las preferencias de Linear. `descripcion` es UNA línea gris debajo del nombre, sólo si dice algo que la tarjeta
 * no dice (un estado, una cuenta); nunca un párrafo. `accion` va a la derecha del nombre («Cerrar todas», «Agregar»).
 */
export function GrupoAjustes({ titulo, descripcion, children, pie, accion }: {
  titulo?: string; descripcion?: ReactNode; children?: ReactNode; pie?: ReactNode; accion?: ReactNode;
  /** Ya no cambia nada (todas las secciones van a lo ancho de la columna); queda para no romper a quien lo pasa. */
  ancha?: boolean;
}) {
  const cab = !!(titulo || descripcion || accion);
  return (
    <section className="aj-grupo">
      {cab && (
        <div className="aj-grupo-cab">
          <div className="aj-grupo-cab__texto">
            {titulo && <h2>{titulo}</h2>}
            {descripcion && <p>{descripcion}</p>}
          </div>
          {accion && <div className="aj-grupo-cab__accion">{accion}</div>}
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
 * Un APARTADO de la página: un título como el de la página, más chico, que junta las secciones que siguen. Con `id`, un
 * link lo abre ahí (`#negocio`).
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
    <div className="aj-subtitulo">
      <h2>{titulo}</h2>
      {descripcion && <p>{descripcion}</p>}
    </div>
  );
}

/**
 * La cara de un select (app/components/Dropdown, `buttonStyle`) en una fila de Settings: del alto de los campos (34), con el
 * texto en peso normal, como los selects de las preferencias de Linear. El Dropdown de siempre es más alto y en negrita.
 */
export const SELECT_AJUSTES: CSSProperties = { minHeight: 34, height: 34, padding: '0 10px', borderRadius: 8, fontSize: 14, fontWeight: 500, borderColor: 'var(--border)' };

/** El cuerpo de una tarjeta que no es una lista (un formulario, un texto). */
export function CuerpoGrupo({ children }: { children: ReactNode }) {
  return <div className="aj-grupo-cuerpo">{children}</div>;
}

export function Pastilla({ tono, children }: { tono: 'good' | 'warn'; children: ReactNode }) {
  return <span className="aj-pastilla" data-tono={tono}>{children}</span>;
}

/** El punto de estado de Linear, al lado del resumen de un canal: verde = prendido, gris = apagado, ámbar = falta algo. */
export function PuntoEstado({ tono }: { tono: 'good' | 'off' | 'warn' }) {
  return <span className="aj-punto" data-tono={tono} aria-hidden />;
}

/**
 * Una fila de Linear: (ícono), el nombre y debajo una línea gris si suma; a la derecha, el control (`fin`) o el `valor` con la
 * flecha. La fila ENTERA es el botón si tiene `href` u `onClick`; sin ninguno de los dos es un dato quieto, sin flecha.
 */
export function FilaAjustes({ icono, titulo, detalle, tono, estado, valor, href, onClick, fin, peligro, ancho }: {
  icono?: NombreIconoMenu;
  titulo: ReactNode;
  /** La línea gris debajo del nombre. */
  detalle?: ReactNode;
  /** Una pastilla al lado del detalle (verde = activo, ámbar = falta). */
  tono?: 'good' | 'warn';
  estado?: string;
  /** El resumen a la derecha, antes de la flecha («Todos los avisos», «2 números»), como los canales de Linear. */
  valor?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Ya no cambia nada: el detalle va siempre debajo del nombre, como en Linear. */
  apilada?: boolean;
  /** Lo que va a la derecha en vez de la flecha (un interruptor, un select, un botón). */
  fin?: ReactNode;
  /** El nombre en rojo (quitar, cerrar sesión). */
  peligro?: boolean;
  /** El control es ancho (un select de zona, las horas, los días): en el teléfono baja debajo del nombre, a lo ancho. */
  ancho?: boolean;
}) {
  const quieta = !href && !onClick;
  const contenido = (
    <>
      {icono && <span className="aj-fila-icono"><IconoMenu nombre={icono} size={18} /></span>}
      <span className="aj-fila-texto">
        <span className="aj-fila-titulo" data-peligro={peligro || undefined}>{titulo}</span>
        {(detalle || estado) && (
          <span className="aj-fila-detalle">
            {tono && estado && <Pastilla tono={tono}>{estado}</Pastilla>}
            {detalle}
          </span>
        )}
      </span>
      {(valor != null || fin || !quieta) && (
        <span className="aj-fila-fin">
          {valor != null && <span className="aj-fila-valor">{valor}</span>}
          {fin ?? (quieta ? null : <span aria-hidden className="aj-fila-flecha">›</span>)}
        </span>
      )}
    </>
  );
  if (href) return <Link href={href} className="aj-fila">{contenido}</Link>;
  if (onClick) return <button type="button" className="aj-fila" onClick={onClick}>{contenido}</button>;
  return <div className="aj-fila" data-quieta="true" data-campo={ancho || undefined}>{contenido}</div>;
}
