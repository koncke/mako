'use client';

// =============================================================================
// Chats en el teléfono: la misma lista que la computadora (app/admin/operaciones/ChatsCentro.tsx), destilada
// =============================================================================
// Agrupada por tiempo como la barra de conversaciones de una app de chat (Trabajando ahora · Hoy · Ayer · Esta
// semana · Antes), una fila por chat con su estado en la píldora; la conversación va en una hoja, con lo que
// pidió Martín en burbujas a la derecha y lo que hizo el chat como texto a la izquierda. Sólo para mirar.

import { useMemo, useState } from 'react';
import { FilaM, ListaM, PildoraM, SeccionM, SheetM, VacioM, type TonoPildora } from '@/app/m/_ui';
import {
  GRUPOS_CHAT, ROTULO_GRUPO_CHAT, grupoDeChat, historialDelChat, type ChatCentro, type EstadoChat, type TrabajoP,
} from '@/lib/centro-chats';
import { ROTULO_TIPO, hace, type PedidoP } from '@/lib/progreso-reglas';

const ROTULO: Record<EstadoChat, string> = { trabajando: 'Trabajando', abierto: 'Abierto', cerrado: 'Cerrado', sin_dato: 'Sin dato' };
const TONO: Record<EstadoChat, TonoPildora> = { trabajando: 'good', abierto: 'info', cerrado: 'neutro', sin_dato: 'neutro' };

export function ChatsM({ chats, cuentas, pedidos, trabajos, ahora }: {
  chats: ChatCentro[]; cuentas: string[]; pedidos: PedidoP[]; trabajos: TrabajoP[]; ahora: number;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);
  const elegido = chats.find((c) => c.clave === abierto) ?? null;
  const lineas = elegido ? historialDelChat(elegido, porId, trabajos) : [];
  if (!chats.length) return <VacioM frase="Ningún chat con actividad en estos días." />;
  return (
    <>
      {GRUPOS_CHAT.map((g) => {
        const filas = chats.filter((c) => grupoDeChat(c, ahora) === g);
        if (!filas.length) return null;
        return (
          <SeccionM key={g} titulo={`${ROTULO_GRUPO_CHAT[g]} · ${filas.length}`}>
            <ListaM etiqueta={ROTULO_GRUPO_CHAT[g]}>
              {filas.map((c) => (
                <FilaM
                  key={c.clave}
                  titulo={<span className="m-operaciones-texto1">{c.titulo}</span>}
                  segunda={`${c.porNombre ? 'por nombre · ' : ''}${c.pedidos.length ? `${c.pedidos.length} pedidos · ` : ''}${hace(c.actividad, ahora)}`}
                  pill={<PildoraM tono={c.viejo ? 'neutro' : TONO[c.estado]}>{c.viejo && c.vistoAt != null ? `${ROTULO[c.estado]} · ${hace(c.vistoAt, ahora)}` : ROTULO[c.estado]}</PildoraM>}
                  onClick={() => setAbierto(c.clave)}
                />
              ))}
            </ListaM>
          </SeccionM>
        );
      })}
      <p className="m-operaciones-nota">
        {cuentas.length ? `El estado sale del cartero de ${cuentas.join(', ')}.` : 'Sin cartero: los chats salen de lo que anotaron.'} Los «por nombre» son lo anotado antes del 16/10.
      </p>
      <SheetM abierto={!!elegido} onCerrar={() => setAbierto(null)} titulo={elegido?.titulo ?? 'Chat'}>
        {elegido && (
          <div className="m-operaciones-conv">
            {!lineas.length && <p className="m-operaciones-motivo">{elegido.porNombre ? 'Sin pedidos anotados en estos días.' : 'Todavía no anotó trabajo con su sesión.'}</p>}
            {lineas.map((l, i) => {
              if (l.tipo === 'trabajo') return <p key={i} className="m-operaciones-sistema">{`Le mandaste un trabajo firmado · ${hace(l.instante, ahora)}`}</p>;
              return (
                <div key={i} className="m-operaciones-par">
                  <div className="m-operaciones-yo">
                    <p className="m-operaciones-burbuja">{l.pedido.texto}</p>
                    <p className="m-operaciones-pie">
                      {l.tipo === 'derivado'
                        ? `${hace(l.instante, ahora)} · lo trabajó ${l.trabajaron.join(', ') || 'nadie todavía'}`
                        : `${hace(l.instante, ahora)}${l.desde ? ` · desde ${l.desde}` : ''}`}
                    </p>
                  </div>
                  {l.tipo === 'pedido' && l.pasos.map((s, j) => (
                    <div key={j} className="m-operaciones-el">
                      <span className="m-operaciones-paso-quien">{`${ROTULO_TIPO[s.tipo] ?? s.tipo} · ${hace(s.instante, ahora)}`}</span>
                      <span>{s.titulo}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </SheetM>
    </>
  );
}
