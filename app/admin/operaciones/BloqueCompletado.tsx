'use client';

// =============================================================================
// Los «Completado» de un chat, en un BLOQUE arriba de la caja, como las preguntas (25/10/2026)
// =============================================================================
// Martín (25/10, 09:32): «Hay muchos chats que dicen "completado", pero no veo el mensaje... Tal vez sería bueno hacerlo como
// las preguntas, en bloque arriba del chat, sino se pierde en el scroll». La fila dice «Completado» mientras el último «Ya
// está» del chat no tiene su ✓ (lib/centro-chats.ts → esperaCheck), y ese mensaje quedaba en el hilo, tapado por lo que el chat
// escribió después. Ahora va fijo arriba de la caja, con el marco del bloque de preguntas (PreguntasDelChat.tsx), en la
// computadora (Conversacion.tsx) y en el teléfono (ChatsMovil.tsx).
// La tercera vuelta (25/10, ~15:20), Martín al verlo en producción: «Rediseña bien la tarjeta de "completado"... Mira la cantidad
// de botones juntos... Y si tengo varios "completados" pendientes, para eso ya tenemos la opción de "espera tu respuesta" tipo
// modular con varias preguntas con las flechitas para la siguiente o anterior». Tenía seis controles juntos («Ya lo vi», la
// flecha, «Ver todo», «Revisar», la tarea del Plan y «Responder sobre esto»). Ahora, como la bandeja de Linear y las
// notificaciones de GitHub (una acción que lo saca de la bandeja; el detalle se abre tocándolo):
//   · UNA acción, «Ya lo vi» (le pone el ✓ y pasa al siguiente), y UNA secundaria, «Revisar», si dejó una página;
//   · el texto se abre TOCÁNDOLO, sin «Ver todo», y el pedido también; responder es escribir en la caja de abajo;
//   · la tarea del Plan y «Responder sobre esto» quedan en la tarjeta del hilo (Avance.tsx → YaEstaMensaje), no acá;
//   · varios sin ver, de a uno, con las flechas y los puntos de las preguntas (`Pasos`), del más viejo al más nuevo. El ✓ es
//     «hasta éste» (lib/centro-ya-vistos-db.ts guarda un instante por chat): «Ya lo vi» en uno da por vistos los de antes;
//   · arriba de la respuesta, lo que respondía (`pedidoDelCompletado`): lo de Martín con su foto; lo de otro chat, con su
//     nombre y el ícono de chats, nunca con la foto de Martín. Sin pedido, no queda el hueco;
//   · la flecha lo pliega a su tira; uno NUEVO lo vuelve a abrir (`usePlegado` recuerda por los turnos);
//   · con una pregunta esperando, la pregunta manda: los «Completado» quedan en su tira, arriba de ella, hasta que se abran.

import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { Markdown, conFormato } from '@/app/_components/Markdown';
import {
  CUERPO_PLEGABLE_EN_BLOQUE, DETALLE_PLEGABLE_EN_BLOQUE, completadosSinVer, cortadoPorLaPC, destinoDeReview, partesDeYaEsta, partirPendiente, pedidoDelCompletado,
  sinMarkdown, yaEstaDelChat, type LineaChat,
} from '@/lib/centro-chats';
import type { TurnoChat } from '@/lib/operaciones-reglas';
import { TABS_DEL_MENU, type ChatDelYaEsta } from './Avance';
import { MiFoto } from './MiFoto';
import { Pasos, Plegar, usePlegado } from './PreguntasDelChat';

/** Desde cuántos caracteres el pedido se achica a 3 renglones (y se abre tocándolo). */
const PEDIDO_LARGO = 200;

/**
 * Un texto plegado que se abre TOCÁNDOLO (sin «Ver todo»): un link adentro se abre sin desplegar, y seleccionar texto tampoco
 * despliega. Abierto se queda abierto: en el teléfono, un toque al leer no lo vuelve a cerrar. Para el teclado, Enter o espacio.
 */
function SeAbreTocando({ abierto, abrir, clase, children }: { abierto: boolean; abrir: () => void; clase: string; children: ReactNode }) {
  if (abierto) return <div className={clase}>{children}</div>;
  const tocar = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a') || window.getSelection()?.toString()) return;
    abrir();
  };
  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); abrir(); }
  };
  return (
    <div className={`${clase} co-preg__ya-abrir`} role="button" tabIndex={0} aria-expanded={false} title="Tocar para leer todo"
      onClick={tocar} onKeyDown={tecla}>
      {children}
    </div>
  );
}

/** Lo que respondía: un globo a la derecha, como en el hilo. De Martín, con su foto; de otro chat, con su nombre y su ícono. */
function Pedido({ texto, de }: { texto: string; de: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const largo = texto.length > PEDIDO_LARGO;
  return (
    <div className="co-preg__ya-pedido">
      <div className="co-yo">
        <div className="co-burbuja">
          {de && <span className="co-burbuja__cita">{de}</span>}
          <SeAbreTocando abierto={abierto || !largo} abrir={() => setAbierto(true)}
            clase={`co-preg__ya-pedido-texto${abierto || !largo ? '' : ' co-preg__ya-pedido-texto--corto'}`}>
            {texto}
          </SeAbreTocando>
        </div>
        {de ? <span className="co-mifoto co-mifoto--otro" aria-hidden><Icon name="chats" size={14} /></span> : <MiFoto />}
      </div>
    </div>
  );
}

/** La respuesta: su título entero y el cuerpo, plegado a su resumen si es largo. Lo que sigue pendiente y cómo probarlo (la
 *  cola, `partirPendiente`) queda siempre a la vista, como en el hilo. Lo que la PC cortó al subir termina en «…». */
function Respuesta({ t }: { t: TurnoChat }) {
  const [abierto, setAbierto] = useState(false);
  const { titulo, cuerpo } = partesDeYaEsta(cortadoPorLaPC(t.texto) ? `${t.texto.trimEnd()}…` : t.texto);
  const partes = cuerpo.length > CUERPO_PLEGABLE_EN_BLOQUE
    ? partirPendiente(cuerpo, CUERPO_PLEGABLE_EN_BLOQUE, DETALLE_PLEGABLE_EN_BLOQUE) ?? { detalle: cuerpo, cola: '' } : null;
  return (
    <div className="co-preg__ya-respuesta">
      {titulo && <p className="co-ya__titulo">{conFormato(titulo, 'ya-t')}</p>}
      {partes ? (<>
        <SeAbreTocando abierto={abierto} abrir={() => setAbierto(true)}
          clase={`co-ya__md co-el__md co-ya__detalle${abierto ? '' : ' co-ya__detalle--plegado'}`}>
          <Markdown text={partes.detalle} enlaces />
        </SeAbreTocando>
        {partes.cola && <div className="co-ya__md co-el__md co-ya__cola"><Markdown text={partes.cola} enlaces /></div>}
      </>) : cuerpo && <div className="co-ya__md co-el__md"><Markdown text={cuerpo} enlaces /></div>}
    </div>
  );
}

export function BloqueCompletado({ chat, lineas, yaVisto, onYaVisto, hayPreguntas }: {
  chat: ChatDelYaEsta;
  /** La conversación del chat: de ahí salen sus «Ya está» sin el ✓ (`completadosSinVer`). */
  lineas: readonly LineaChat[];
  /** El ✓ de este chat (hasta qué «Ya está» lo vio Martín), y cómo se pone. Sin `onYaVisto`, no se ofrece «Ya lo vi». */
  yaVisto: number | null | undefined;
  onYaVisto?: (instante: number) => void;
  /** Hay una pregunta esperando en el bloque de preguntas: la pregunta manda, y esto va en su tira. */
  hayPreguntas: boolean;
}) {
  const todos = completadosSinVer(lineas, yaVisto);
  const ids = todos.map((x) => ({ id: x.uuid }));
  const firma = ids.map((x) => x.id).join(',');
  const [plegado, setPlegado] = usePlegado(`ya:${chat.clave}`, ids);
  // Abierto a mano con una pregunta esperando (se abren ÉSTOS; si llega uno nuevo, vuelve a su tira).
  const [abiertoConPreguntas, setAbiertoConPreguntas] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  if (!todos.length) return null;
  const i = Math.min(pos, todos.length - 1);
  const t = todos[i];
  const instante = Date.parse(t.at);
  const [n] = yaEstaDelChat([{ tipo: 'turno', instante, turno: t }]);
  // La tira es de un renglón y no dibuja formato: sin los asteriscos del Markdown (la regla de la lista, `sinMarkdown`).
  const titulo = n?.titulo && n.titulo !== 'Ya está' ? sinMarkdown(n.titulo) : 'Completado';
  if (plegado || (hayPreguntas && abiertoConPreguntas !== firma)) {
    const rotulo = todos.length > 1 ? `${todos.length} completados sin ver` : `Completado: ${titulo}`;
    return (
      <button type="button" className="co-preg co-preg--arriba co-preg--plegada co-preg--completado" aria-expanded={false}
        aria-label={`${rotulo}. Abrir`} onClick={() => { setPlegado(false); setAbiertoConPreguntas(firma); }}>
        <span className="co-preg__ya-tira">
          <span className="co-ya__sello" aria-hidden><Icon name="check" size={13} /></span>
          <span className="co-preg__ya-titulo">{rotulo}</span>
        </span>
        <span className="co-preg__flecha" aria-hidden>▴</span>
      </button>
    );
  }
  const pedido = pedidoDelCompletado(lineas, t);
  const destino = n ? destinoDeReview(n, chat, TABS_DEL_MENU) : null;
  return (
    <div className="co-preg co-preg--arriba co-preg--completado" role="group" aria-label={`Completado: ${titulo}`}>
      <div className="co-preg__cab">
        <span className="co-ya__sello" aria-hidden><Icon name="check" size={13} /></span>
        <span className="co-ya__rotulo">Completado</span>
        {/* Varios sin ver: de a uno, con las flechas y los puntos de las preguntas (sin «1 de 3» a la vista). */}
        {todos.length > 1 && <Pasos items={ids} pos={i} ir={setPos} contestada={() => false} nombre="Completado" />}
        <Plegar onPlegar={() => { setPlegado(true); setAbiertoConPreguntas(null); }} que={todos.length > 1 ? 'los completados' : 'el completado'} />
      </div>
      <div className="co-preg__ya-cuerpo">
        {pedido && <Pedido key={`p-${t.uuid}`} texto={pedido.texto} de={pedido.de} />}
        <p className="co-preg__ya-de">{`Respuesta de ${chat.titulo}`}</p>
        <Respuesta key={t.uuid} t={t} />
      </div>
      {(destino || (onYaVisto && Number.isFinite(instante))) && (
        <div className="co-preg__ya-pie">
          {destino && (
            <Link className="co-chip co-preg__ya-revisar" href={destino.href}>
              <Icon name="eye" size={15} />{destino.via === 'tab' ? 'Revisar en su tab' : 'Revisar'}
            </Link>
          )}
          {/* El ✓ de siempre (18/10/2026): hasta que se toca, la fila del chat dice «Completado». Es «hasta éste». */}
          {onYaVisto && Number.isFinite(instante) && (
            <button type="button" className="co-chip co-chip--primario co-preg__ya-visto"
              aria-label={i > 0 ? `Ya lo vi: marcar éste y ${i === 1 ? 'el de antes' : `los ${i} de antes`} como vistos` : 'Ya lo vi: marcarlo como visto'}
              onClick={() => { onYaVisto(instante); setPos(0); }}>
              <Icon name="check" size={15} />Ya lo vi
            </button>
          )}
        </div>
      )}
    </div>
  );
}
