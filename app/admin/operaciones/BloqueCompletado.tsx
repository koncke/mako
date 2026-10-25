'use client';

// =============================================================================
// El último «Completado» de un chat, en un BLOQUE arriba de la caja, como las preguntas (25/10/2026)
// =============================================================================
// Martín (25/10, 09:32): «Hay muchos chats que dicen "completado", pero no veo el mensaje... Tal vez sería bueno hacerlo como
// las preguntas, en bloque arriba del chat, sino se pierde en el scroll». La fila dice «Completado» mientras el último «Ya
// está» del chat no tiene su ✓ (lib/centro-chats.ts → esperaCheck), y ese mensaje quedaba en el hilo, tapado por lo que el chat
// escribió después. Ahora el MISMO mensaje (YaEstaMensaje: qué cambió, «Revisar», su tarea del Plan y «Responder sobre esto»)
// va fijo arriba de la caja, con el marco del bloque de preguntas (PreguntasDelChat.tsx), en la computadora (Conversacion.tsx)
// y en el teléfono (ChatsMovil.tsx):
//   · «Visto» le pone el ✓: el chat deja de decir «Completado» y el bloque se va (queda en el hilo, como siempre);
//   · la flecha lo pliega a su tira; un «Ya está» NUEVO lo vuelve a abrir (`usePlegado` recuerda por el turno);
//   · con una pregunta esperando, la pregunta manda: el «Completado» queda en su tira, arriba de ella, hasta que se lo abra.

import { useState } from 'react';
import { Icon } from '@/app/_components/icons';
import { completadoSinVer, sinMarkdown, yaEstaDelChat, type LineaChat } from '@/lib/centro-chats';
import type { TareaDelChat } from '@/lib/centro-plan-auto-reglas';
import { YaEstaMensaje, type ChatDelYaEsta } from './Avance';
import { Plegar, usePlegado } from './PreguntasDelChat';

export function BloqueCompletado({ chat, lineas, yaVisto, onYaVisto, tareas, onFeedback, hayPreguntas }: {
  chat: ChatDelYaEsta;
  /** La conversación del chat: de ahí sale su último «Ya está» (`completadoSinVer`). */
  lineas: readonly LineaChat[];
  /** El ✓ de este chat (hasta qué «Ya está» lo vio Martín), y cómo se pone. Sin `onYaVisto`, no se ofrece «Visto». */
  yaVisto: number | null | undefined;
  onYaVisto?: (instante: number) => void;
  tareas?: readonly TareaDelChat[];
  onFeedback?: (titulo: string) => void;
  /** Hay una pregunta esperando en el bloque de preguntas: la pregunta manda, y esto va en su tira. */
  hayPreguntas: boolean;
}) {
  const t = completadoSinVer(lineas, yaVisto);
  const [plegado, setPlegado] = usePlegado(`ya:${chat.clave}`, t ? [{ id: t.uuid }] : []);
  // Abierto a mano con una pregunta esperando (se abre el de ESTE «Ya está»; uno nuevo vuelve a su tira).
  const [abiertoConPreguntas, setAbiertoConPreguntas] = useState<string | null>(null);
  if (!t) return null;
  const instante = Date.parse(t.at);
  const [n] = yaEstaDelChat([{ tipo: 'turno', instante, turno: t }]);
  // La tira es de un renglón y no dibuja formato: sin los asteriscos del Markdown (la regla de la lista, `sinMarkdown`).
  const titulo = n?.titulo && n.titulo !== 'Ya está' ? sinMarkdown(n.titulo) : 'Completado';
  if (plegado || (hayPreguntas && abiertoConPreguntas !== t.uuid)) {
    return (
      <button type="button" className="co-preg co-preg--arriba co-preg--plegada co-preg--completado" aria-expanded={false}
        aria-label={`Completado: ${titulo}. Abrir`} onClick={() => { setPlegado(false); setAbiertoConPreguntas(t.uuid); }}>
        <span className="co-preg__ya-tira">
          <span className="co-ya__sello" aria-hidden><Icon name="check" size={13} /></span>
          <span className="co-preg__ya-titulo">{`Completado: ${titulo}`}</span>
        </span>
        <span className="co-preg__flecha" aria-hidden>▴</span>
      </button>
    );
  }
  return (
    <div className="co-preg co-preg--arriba co-preg--completado" role="group" aria-label={`Completado: ${titulo}`}>
      <div className="co-preg__cab">
        <span className="co-ya__sello" aria-hidden><Icon name="check" size={13} /></span>
        <span className="co-ya__rotulo">Completado</span>
        {/* El ✓ de siempre (18/10/2026): hasta que se toca, la fila del chat dice «Completado». */}
        {onYaVisto && Number.isFinite(instante) && (
          <button type="button" className="co-ya__check" aria-label="Marcar como visto" title="Marcar como visto" onClick={() => onYaVisto(instante)}>
            <Icon name="check" size={15} />Visto
          </button>
        )}
        <Plegar onPlegar={() => { setPlegado(true); setAbiertoConPreguntas(null); }} que="el completado" />
      </div>
      <div className="co-preg__ya-cuerpo">
        <YaEstaMensaje t={t} chat={chat} tareas={tareas} onFeedback={onFeedback} sinCabecera />
      </div>
    </div>
  );
}
