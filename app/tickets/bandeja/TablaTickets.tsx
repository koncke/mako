'use client';

// =============================================================================
// La Ticketera en TABLA (22/10/2026): todos los tickets, con orden y el filtro por estado
// =============================================================================
// Martín: «Luego si quiero elegir la vista tabla también». Las columnas que pidió: número, título, quién, negocio,
// canal, estado y cuándo. Tocar el título de una columna ordena (y otra vez, al revés); los chips de siempre filtran por
// estado (Por decidir · Esperan al cliente · En curso · Cerrados). Tocar una fila abre el ticket entero.
//
// ⚠️ EL TELÉFONO DESTILA ESTO, no lo achica: debajo de 720 px de ANCHO DEL PANEL (container query, no la ventana: en la
//    compu el Ops Center también puede quedar angosto) cada fila es un renglón doble —la cara, el número y el título; abajo
//    quién, el negocio y cuándo— y el orden se elige con un selector, porque no hay títulos de columna que tocar.

import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import { PestanasPildora } from '@/app/_ui/TarjetaKanban';
import { avisoAlCliente } from '@/lib/tickets-aviso';
import type { FilaTicket } from '@/lib/tickets-db';
import { CaraTicket, ChipOrigen } from './TarjetaTicket';
import {
  COLUMNAS, GRUPOS, ORDEN_INICIAL, ROTULO_ESTADO, enGrupo, estadoObvio, haceCuanto, nombreDe, ordenarTabla, siguienteOrden, tipoCorto,
  type ColumnaTabla, type Orden,
} from './mazo-reglas';

export function TablaTickets({ tickets, ahoraLista, grupo, onGrupo, elegido, onAbrir, barra }: {
  tickets: readonly FilaTicket[] | null;
  ahoraLista: number;
  grupo: string;
  onGrupo: (g: string) => void;
  elegido: number | null;
  onAbrir: (id: number) => void;
  barra: ReactNode;
}) {
  const [orden, setOrden] = useState<Orden>(ORDEN_INICIAL);
  const filas = useMemo(() => ordenarTabla((tickets ?? []).filter((t) => enGrupo(t, grupo)), orden), [tickets, grupo, orden]);
  const cuenta = (clave: string) => (tickets ?? []).filter((t) => enGrupo(t, clave)).length;

  return (
    <section className="tickets-bandeja__tabla-vista" aria-label="Tickets">
      <header className="tickets-bandeja__franja tickets-bandeja__franja--tabla">
        <PestanasPildora ariaLabel="Estado" activo={grupo} onCambiar={onGrupo}
          items={GRUPOS.map((g) => ({ id: g.clave, label: g.titulo, n: cuenta(g.clave) }))} />
        <div className="tickets-bandeja__franja-der">{barra}</div>
      </header>

      <label className="tickets-bandeja__ordenar">
        <span>Ordenar</span>
        <select value={`${orden.col}:${orden.dir}`} onChange={(e) => { const [col, dir] = e.target.value.split(':'); setOrden({ col: col as ColumnaTabla, dir: dir as Orden['dir'] }); }}>
          <option value="cuando:desc">Lo más nuevo</option>
          <option value="cuando:asc">Lo más viejo</option>
          <option value="estado:asc">Prioridad</option>
          <option value="negocio:asc">Negocio</option>
          <option value="quien:asc">Quién</option>
          <option value="canal:asc">Canal</option>
        </select>
      </label>

      {tickets === null ? <p className="tickets-bandeja__vacio">Cargando…</p>
        : !filas.length ? <p className="tickets-bandeja__vacio">{grupo === 'decidir' ? 'Nada por decidir' : 'No hay tickets aquí'}</p>
          : (
            <table className="tickets-bandeja__tabla">
              <thead>
                <tr>
                  {COLUMNAS.map((c) => {
                    const activa = orden.col === c.clave;
                    return (
                      <th key={c.clave} scope="col" className={`tickets-bandeja__col--${c.clave}`}
                        aria-sort={activa ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" onClick={() => setOrden((o) => siguienteOrden(o, c.clave))}>
                          {c.titulo}
                          <span className="tickets-bandeja__flecha" aria-hidden>{activa ? (orden.dir === 'asc' ? '↑' : '↓') : ''}</span>
                        </button>
                      </th>
                    );
                  })}
                  <th className="tickets-bandeja__col--abrir" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {filas.map((t) => (
                  <tr key={t.id} data-ticket={t.id} className={elegido === t.id ? 'is-on' : undefined} onClick={() => onAbrir(t.id)}>
                    <td className="tickets-bandeja__col--id">
                      <span className={`tickets-bandeja__prio tickets-bandeja__prio--${t.prioridad}`} aria-hidden />#{t.id}
                    </td>
                    <td className="tickets-bandeja__col--titulo">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onAbrir(t.id); }}>
                        <span className="tickets-bandeja__solo-angosto">#{t.id} </span>{t.titulo}
                      </button>
                      <span className={`tickets-bandeja__tipo tickets-bandeja__tipo--${t.tipo}`}>{tipoCorto(t.tipo)}</span>
                    </td>
                    <td className="tickets-bandeja__col--quien">
                      <span className="tickets-bandeja__persona"><CaraTicket t={t} tam={28} /><span>{nombreDe(t)}</span></span>
                    </td>
                    <td className="tickets-bandeja__col--negocio">
                      <span className="tickets-bandeja__solo-angosto">{nombreDe(t)} · </span>{t.negocio ?? `Negocio ${t.workspace_id}`}
                    </td>
                    <td className="tickets-bandeja__col--canal"><ChipOrigen t={t} /></td>
                    <td className="tickets-bandeja__col--estado">
                      {(() => {
                        const rotulo = `${estadoObvio(t.estado, grupo) ? '' : ROTULO_ESTADO[t.estado]}${avisoAlCliente(t, ahoraLista)?.tono === 'bad' ? ' · ⚠ sin avisar' : ''}`.replace(/^ · /, '');
                        return rotulo ? <span className={`tickets-bandeja__estado tickets-bandeja__estado--${t.estado}`}>{rotulo}</span> : null;
                      })()}
                    </td>
                    <td className="tickets-bandeja__col--cuando">
                      <time dateTime={t.created_at} title={new Date(t.created_at).toLocaleString('es')}>{haceCuanto(t.created_at, ahoraLista)}</time>
                    </td>
                    <td className="tickets-bandeja__col--abrir" aria-hidden><Icon name="chevron" size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
    </section>
  );
}
