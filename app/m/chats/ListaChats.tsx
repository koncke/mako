'use client';

// =============================================================================
// La pestaña Chats del teléfono: la bandeja unificada de escritorio, destilada (17/10/2026)
// =============================================================================
// Escritorio (app/chats, copiado de respond.io) tiene a la izquierda las bandejas, en el medio la lista
// con «Abiertas, Más recientes ⌄» y «Sin responder», y la ventana del chat a la derecha. El teléfono pone
// lo mismo en una columna, como la app de respond.io y la de WhatsApp Business: arriba el buscador, el
// riel de bandejas (se desliza de costado), la línea del filtro y la lista; tocar abre la conversación
// en su pantalla (/m/chats/<clave>).
//
// Las filas llegan una vez (server) y TODO se filtra acá, con las MISMAS funciones de escritorio
// (`filtrarChats`, `coincideBusqueda`): tocar una bandeja no va al servidor. Refrescar (tirar hacia abajo)
// trae filas nuevas por props: nada de lo que llega se copia a un `useState` (PantallaM, «REFRESCAR TIENE
// QUE TRAER LO NUEVO»). La URL guarda «Sin responder» (`?ver=sin-responder`, el link de antes) con
// replaceState, sin navegar.
// =============================================================================

import { useMemo, useState } from 'react';
import { Icon } from '@/app/_components/icons';
import { IconoCanal } from '@/app/chats/iconos-canal';
import { AvatarM, FilaM, ListaM, PildoraM, SeccionM, SheetM, VacioM } from '@/app/m/_ui';
import { coincideBusqueda, filtrarChats, type FiltroChats } from '@/lib/chats-reglas';
import type { ConteosBandeja } from '@/lib/chats-reglas';
import type { CanalChat } from '@/lib/chats-tipos';
import type { YoChats } from '@/lib/chats';
import type { FilaChatM } from './datos';
import {
  CANALES_M, FILAS_POR_TANDA, FILTRO_INICIAL_M, MOSTRAR_M, ORDEN_M,
  bandejasVisibles, conteoDeBandeja, rotuloFiltro, rutaHiloM,
} from './modelo';

/** Las fuentes que lib/chats.ts nombra en `fallas`, en palabras (las mismas de escritorio). */
const FUENTE: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', email: 'Email', crm: 'el CRM',
};

function textoFallasLista(fallas: readonly string[]): string | null {
  const nombres = [...new Set(fallas.map((f) => FUENTE[f.split(':')[0]]).filter(Boolean))];
  if (!nombres.length) return null;
  return `No pude leer ${nombres.join(', ')}. Lo demás está al día.`;
}

const ESTADO: Record<string, string> = { cerrada: 'Cerrada', pospuesta: 'Pospuesta' };

export function ListaChats({ filas, conteos, yo, canales, fallas, fuera, sinResponderInicial }: {
  filas: FilaChatM[];
  conteos: ConteosBandeja;
  yo: YoChats;
  canales: CanalChat[];
  fallas: string[];
  fuera: number;
  sinResponderInicial: boolean;
}) {
  const [filtro, setFiltro] = useState<FiltroChats>(() => ({ ...FILTRO_INICIAL_M, sinResponder: sinResponderInicial }));
  const [q, setQ] = useState('');
  const [tope, setTope] = useState(FILAS_POR_TANDA);
  const [filtros, setFiltros] = useState(false);

  const poner = (cambio: Partial<FiltroChats>) => {
    setFiltro((f) => ({ ...f, ...cambio }));
    setTope(FILAS_POR_TANDA);
    if ('sinResponder' in cambio) {
      try {
        const u = new URL(window.location.href);
        if (cambio.sinResponder) u.searchParams.set('ver', 'sin-responder'); else u.searchParams.delete('ver');
        window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
      } catch { /* la URL es un extra: el filtro anda igual */ }
    }
  };

  const visibles = useMemo(() => {
    const porClave = new Map(filas.map((f) => [f.chat.clave, f]));
    const chats = filtrarChats(filas.map((f) => f.chat), filtro, yo).filter((c) => coincideBusqueda(c, q));
    return chats.map((c) => porClave.get(c.clave)).filter((f): f is FilaChatM => !!f);
  }, [filas, filtro, yo, q]);

  const bandejas = bandejasVisibles(conteos);
  const aviso = textoFallasLista(fallas);
  const hayFiltro = filtro.mostrar !== FILTRO_INICIAL_M.mostrar || filtro.orden !== FILTRO_INICIAL_M.orden || filtro.canal != null;

  return (
    <>
      <div className="m-chats-buscar" role="search">
        <span className="m-chats-buscar__ico" aria-hidden><Icon name="search" size={18} /></span>
        <input
          type="search" inputMode="search" enterKeyHint="search" autoComplete="off"
          placeholder="Buscar contactos" aria-label="Buscar contactos"
          value={q} onChange={(e) => { setQ(e.target.value); setTope(FILAS_POR_TANDA); }}
        />
        {q && (
          <button type="button" className="m-chats-buscar__limpiar" aria-label="Borrar la búsqueda" onClick={() => setQ('')}>
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      <div className="m-chats-bandejas" role="tablist" aria-label="Bandeja">
        {bandejas.map((b) => {
          const { n, nuevos } = conteoDeBandeja(conteos, b.id);
          const es = filtro.vista === b.id;
          return (
            <button key={b.id} type="button" role="tab" aria-selected={es} className="m-chats-bandeja" onClick={() => poner({ vista: b.id })}>
              {b.label}
              {n > 0 && <span className="m-chats-bandeja__n" data-nuevos={nuevos || undefined}>{n > 99 ? '99+' : n}</span>}
            </button>
          );
        })}
      </div>

      <div className="m-chats-filtro">
        <button type="button" className="m-chats-filtro__boton" aria-pressed={hayFiltro} onClick={() => setFiltros(true)}>
          {rotuloFiltro(filtro)}
          <Icon name="chevron" size={14} />
        </button>
        <button type="button" className="m-chats-filtro__sin" aria-pressed={filtro.sinResponder} onClick={() => poner({ sinResponder: !filtro.sinResponder })}>
          Sin responder
        </button>
      </div>

      {aviso && <p className="m-chats-aviso">{aviso}</p>}

      <div className="m-chats-lista">
        {visibles.length > 0 ? (
          <>
            <ListaM>
              {visibles.slice(0, tope).map(({ chat: c, segunda, riel }) => (
                <FilaM
                  key={c.clave}
                  leading={(
                    <span className="m-chats-av">
                      <AvatarM nombre={c.nombre} />
                      <span className="m-chats-insignia"><IconoCanal canal={c.canalUltimo} size={12} /></span>
                    </span>
                  )}
                  titulo={<span className={c.sinLeer ? 'm-chats-nombre m-chats-nombre--nuevo' : 'm-chats-nombre'}>{c.nombre}</span>}
                  segunda={segunda}
                  pill={ESTADO[c.estado] ? <PildoraM>{ESTADO[c.estado]}</PildoraM> : undefined}
                  riel={(
                    <span className="m-chats-riel" data-nuevo={c.sinLeer || undefined}>
                      {riel}
                      {c.sinLeer && <i className="m-chats-punto" aria-hidden />}
                    </span>
                  )}
                  href={rutaHiloM(c.clave)}
                  chevron={false}
                  etiqueta={`${c.nombre}${c.sinLeer ? ', sin leer' : ''}: ${segunda}`}
                />
              ))}
            </ListaM>
            {visibles.length > tope && (
              <button type="button" className="m-chats-mas" onClick={() => setTope((t) => t + FILAS_POR_TANDA)}>
                Ver más ({visibles.length - tope})
              </button>
            )}
          </>
        ) : (
          <VacioM frase={q ? 'Nadie con ese nombre.' : filtro.sinResponder ? 'Nadie espera respuesta.' : filas.length ? 'Nada en esta bandeja.' : 'Todavía no hay chats.'} />
        )}
        {fuera > 0 && <p className="m-chats-aviso">Las {fuera} más viejas, en la computadora.</p>}
      </div>

      <SheetM id="filtros" abierto={filtros} onCerrar={() => setFiltros(false)} titulo="Filtrar">
        <SeccionM titulo="Mostrar">
          <ListaM>
            {MOSTRAR_M.map((m) => (
              <FilaM key={m.v} titulo={m.label} chevron={false} onClick={() => poner({ mostrar: m.v })}
                riel={filtro.mostrar === m.v ? <span className="m-chats-check"><Icon name="check" size={18} /></span> : undefined} />
            ))}
          </ListaM>
        </SeccionM>
        <SeccionM titulo="Orden">
          <ListaM>
            {ORDEN_M.map((o) => (
              <FilaM key={o.v} titulo={o.label} chevron={false} onClick={() => poner({ orden: o.v })}
                riel={filtro.orden === o.v ? <span className="m-chats-check"><Icon name="check" size={18} /></span> : undefined} />
            ))}
          </ListaM>
        </SeccionM>
        {canales.length > 1 && (
          <SeccionM titulo="Canal">
            <ListaM>
              <FilaM titulo="Todos" chevron={false} onClick={() => poner({ canal: null, cuenta: null })}
                riel={filtro.canal == null ? <span className="m-chats-check"><Icon name="check" size={18} /></span> : undefined} />
              {CANALES_M.filter((x) => canales.includes(x.v)).map((x) => (
                <FilaM key={x.v} titulo={x.label} chevron={false} leading={<IconoCanal canal={x.v} size={24} />}
                  onClick={() => poner({ canal: x.v, cuenta: null })}
                  riel={filtro.canal === x.v ? <span className="m-chats-check"><Icon name="check" size={18} /></span> : undefined} />
              ))}
            </ListaM>
          </SeccionM>
        )}
      </SheetM>
    </>
  );
}
