'use client';

// =============================================================================
// Chats en el teléfono: la misma lista que la computadora (app/admin/operaciones/ChatsCentro.tsx), destilada
// =============================================================================
// Una fila por chat con su estado en la píldora y su actividad; la conversación (lo que se le pidió y lo que
// hizo) va en una hoja. Sólo para mirar. El color va en el punto de la píldora, nunca en el texto.

import { useMemo, useState } from 'react';
import { FilaM, ListaM, PildoraM, SheetM, VacioM, type TonoPildora } from '@/app/m/_ui';
import { historialDelChat, type ChatCentro, type EstadoChat, type TrabajoP } from '@/lib/centro-chats';
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
      <ListaM etiqueta="Chats">
        {chats.map((c) => (
          <FilaM
            key={c.clave}
            titulo={<span className="m-operaciones-texto1">{c.titulo}</span>}
            segunda={`${c.porNombre ? 'por nombre · ' : ''}${c.pedidos.length ? `${c.pedidos.length} pedidos · ` : ''}${hace(c.actividad, ahora)}`}
            pill={<PildoraM tono={c.viejo ? 'neutro' : TONO[c.estado]}>{c.viejo && c.vistoAt != null ? `${ROTULO[c.estado]} · ${hace(c.vistoAt, ahora)}` : ROTULO[c.estado]}</PildoraM>}
            onClick={() => setAbierto(c.clave)}
          />
        ))}
      </ListaM>
      <p className="m-operaciones-nota">
        {cuentas.length ? `El estado sale del cartero de ${cuentas.join(', ')}.` : 'Sin cartero: los chats salen de lo que anotaron.'} Los «por nombre» son lo anotado antes del 16/10.
      </p>
      <SheetM abierto={!!elegido} onCerrar={() => setAbierto(null)} titulo={elegido?.titulo ?? 'Chat'}>
        {elegido && (
          <div className="m-operaciones-hoja">
            {!lineas.length
              ? <p className="m-operaciones-motivo">{elegido.porNombre ? 'Sin pedidos anotados en estos días.' : 'Todavía no anotó trabajo con su sesión.'}</p>
              : (
                <ol className="m-operaciones-pasos">
                  {lineas.map((l, i) => (
                    <li key={i}>
                      {l.tipo === 'trabajo' && <span className="m-operaciones-paso-quien">{`Trabajo firmado · ${hace(l.instante, ahora)}`}</span>}
                      {l.tipo === 'derivado' && (
                        <>
                          <span className="m-operaciones-paso-quien">{`Martín pidió acá · lo trabajó ${l.trabajaron.join(', ') || 'nadie todavía'}`}</span>
                          <span>{l.pedido.texto}</span>
                        </>
                      )}
                      {l.tipo === 'pedido' && (
                        <>
                          <span className="m-operaciones-paso-quien">{`Martín pidió · ${hace(l.instante, ahora)}${l.desde ? ` · desde ${l.desde}` : ''}`}</span>
                          <span>{l.pedido.texto}</span>
                          {l.pasos.map((s, j) => <span key={j} className="m-operaciones-paso-quien">{`${ROTULO_TIPO[s.tipo] ?? s.tipo}: ${s.titulo}`}</span>)}
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              )}
          </div>
        )}
      </SheetM>
    </>
  );
}
