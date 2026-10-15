'use client';

// =============================================================================
// Chats — la pestaña de entrada del Centro: los chats de Claude con su punto y lo que hizo cada uno
// =============================================================================
// Martín (15/10/2026): «Al principio debería haber una tab que simule los chats... "En curso" podría ser el
// ícono verde en los chats de grok», y después, con Grok trabado: «que se guie de imagenes de pinterest o cosas
// así... Que busque referencias».
//
// Copiado de dos shots de Dribbble («ai chat sidebar history», mirados el 15/10): el de Playworks Agency y el
// «Build Chat» de Mathieu-William. La ESTRUCTURA, no el arte: a la izquierda la lista de conversaciones agrupada
// por tiempo (una línea por chat, la elegida con fondo suave, el buscador arriba); a la derecha la conversación,
// con lo que pidió la persona en burbujas a la derecha y lo que hizo el asistente como texto a la izquierda.
// Los colores, la tipografía y el punto de estado son los de la casa.
//
// ⚠️ Lo que una referencia no contesta y se resolvió acá: con 53 chats la lista scrollea ADENTRO de su columna
// (el panel tiene alto propio); un título larguísimo se corta con «…» y se lee entero en el tooltip y en la
// cabecera de la conversación; sin chats, un vacío que dice por qué. Un chat es una SESIÓN: lo anotado sin
// sesión se ve aparte, marcado «por nombre» (lib/centro-chats.ts).

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GRUPOS_CHAT, ROTULO_GRUPO_CHAT, grupoDeChat, historialDelChat, type ChatCentro, type EstadoChat, type TrabajoP,
} from '@/lib/centro-chats';
import { ROTULO_TIPO, hace, pushDelCommit, type PedidoP, type PushP } from '@/lib/progreso-reglas';

const ROTULO: Record<EstadoChat, string> = { trabajando: 'Trabajando', abierto: 'Abierto', cerrado: 'Cerrado', sin_dato: 'Sin dato' };
const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** El punto: lleno y verde trabajando, hueco abierto, nada cerrado; gris si el dato es viejo. */
function PuntoChat({ c }: { c: ChatCentro }) {
  if (c.estado === 'cerrado' || c.estado === 'sin_dato') return <span className="cc-punto cc-punto--nada" aria-hidden />;
  return <span className={`cc-punto cc-punto--${c.viejo ? 'viejo' : c.estado}`} aria-hidden />;
}

function estadoEnPalabras(c: ChatCentro, ahora: number): string {
  if (c.viejo && c.vistoAt != null) return `${ROTULO[c.estado]} · visto ${hace(c.vistoAt, ahora)}`;
  return ROTULO[c.estado];
}

function Conversacion({ c, pedidos, trabajos, pushes, ahora }: {
  c: ChatCentro; pedidos: ReadonlyMap<string, PedidoP>; trabajos: readonly TrabajoP[]; pushes: readonly PushP[]; ahora: number;
}) {
  const lineas = historialDelChat(c, pedidos, trabajos);
  const fondo = useRef<HTMLDivElement>(null);
  // Como un chat: abre mostrando lo último.
  useEffect(() => { const el = fondo.current; if (el) el.scrollTop = el.scrollHeight; }, [c.clave]);
  return (
    <section className="cc-conv" aria-label={`Conversación con ${c.titulo}`}>
      <header className="cc-conv-cabeza">
        <h2 className="cc-conv-titulo" title={c.titulo}>{c.titulo}</h2>
        <p className="cc-conv-meta"><PuntoChat c={c} />{estadoEnPalabras(c, ahora)}{c.cuenta ? ` · ${c.cuenta}` : ''}{c.porNombre ? ' · por nombre' : ''}</p>
      </header>
      <div className="cc-conv-cuerpo" ref={fondo}>
        {!lineas.length ? (
          <p className="cc-vacio">{c.porNombre ? 'Sin pedidos anotados en estos días.' : 'Todavía no anotó trabajo con su sesión: lo de antes del 16/10 está en el chat «por nombre».'}</p>
        ) : lineas.map((l, i) => {
          if (l.tipo === 'trabajo') return <p key={i} className="cc-sistema">{`Le mandaste un trabajo firmado · ${hace(l.instante, ahora)}`}</p>;
          if (l.tipo === 'derivado') {
            return (
              <div key={i} className="cc-yo">
                <p className="cc-burbuja">{l.pedido.texto}</p>
                <p className="cc-pie">{`${hace(l.instante, ahora)} · lo trabajó ${l.trabajaron.join(', ') || 'nadie todavía'}`}</p>
              </div>
            );
          }
          return (
            <div key={i} className="cc-par">
              <div className="cc-yo">
                <p className="cc-burbuja">{l.pedido.texto}</p>
                <p className="cc-pie">{`${hace(l.instante, ahora)}${l.desde ? ` · desde ${l.desde}` : ''}`}</p>
              </div>
              {l.pasos.map((s, j) => (
                <div key={j} className="cc-el">
                  <p className="cc-el-rotulo">{`${ROTULO_TIPO[s.tipo] ?? s.tipo} · ${hace(s.instante, ahora)}`}</p>
                  <p className="cc-el-texto">{s.titulo}</p>
                  {s.commits.map((k) => {
                    const push = pushDelCommit(k.sha, pushes);
                    return push ? <p key={k.sha} className="cc-pie">{`Subió ${hace(push.creado, ahora)}`}</p> : null;
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ChatsCentro({ chats, cuentas, pedidos, trabajos, pushes, ahora }: {
  chats: ChatCentro[];
  /** Qué cuentas tienen cartero: la lista dice de dónde sale. */
  cuentas: string[];
  pedidos: PedidoP[];
  trabajos: TrabajoP[];
  pushes: PushP[];
  ahora: number;
}) {
  const [busca, setBusca] = useState('');
  const [elegido, setElegido] = useState<string | null>(chats[0]?.clave ?? null);
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);
  const visibles = busca.trim() ? chats.filter((c) => normal(c.titulo).includes(normal(busca.trim()))) : chats;
  const actual = chats.find((c) => c.clave === elegido) ?? visibles[0] ?? null;
  if (!chats.length) {
    return <p className="prog-vacio">Ningún chat con actividad en estos días. Aparecen cuando el cartero los ve o cuando anotan trabajo en su bitácora.</p>;
  }
  return (
    <>
      <p className="prog-nota">
        {cuentas.length ? `El estado sale del cartero de ${cuentas.join(', ')}; los chats de otras cuentas aparecen por lo que anotaron.` : 'Sin cartero: los chats aparecen por lo que anotaron en sus bitácoras.'}
      </p>
      <div className="cc">
        <nav className="cc-lista" aria-label="Chats">
          <input
            className="cc-buscar" type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar un chat" aria-label="Buscar un chat"
          />
          <div className="cc-filas">
            {!visibles.length && <p className="cc-vacio">Ningún chat con ese nombre.</p>}
            {GRUPOS_CHAT.map((g) => {
              const filas = visibles.filter((c) => grupoDeChat(c, ahora) === g);
              if (!filas.length) return null;
              return (
                <div key={g} className="cc-grupo">
                  <p className="cc-grupo-titulo">{`${ROTULO_GRUPO_CHAT[g]} · ${filas.length}`}</p>
                  {filas.map((c) => (
                    <button
                      key={c.clave} type="button" title={c.titulo}
                      className={`cc-fila${actual?.clave === c.clave ? ' cc-fila--activa' : ''}`}
                      aria-current={actual?.clave === c.clave ? 'true' : undefined}
                      onClick={() => setElegido(c.clave)}
                    >
                      <PuntoChat c={c} />
                      <span className="cc-fila-texto">
                        <span className="cc-fila-titulo">{c.titulo}</span>
                        <span className="cc-fila-meta">
                          {`${estadoEnPalabras(c, ahora)}${c.pedidos.length ? ` · ${c.pedidos.length} pedidos` : ''}${c.porNombre ? ' · por nombre' : ''}`}
                        </span>
                      </span>
                      <span className="cc-fila-hace">{hace(c.actividad, ahora).replace('hace ', '')}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </nav>
        {actual
          ? <Conversacion c={actual} pedidos={porId} trabajos={trabajos} pushes={pushes} ahora={ahora} />
          : <section className="cc-conv"><p className="cc-vacio">Elegí un chat.</p></section>}
      </div>
    </>
  );
}
