'use client';

// =============================================================================
// Una conversación del Centro: lo que se le pidió a un chat, lo que hizo, y la caja para escribirle
// =============================================================================
// Martín (15/10/2026): «NO es funcional, no puedo mandar un prompt por allí a mis otras cuentas». La caja vive
// ABAJO de la conversación, como en cualquier app de chat: Enter manda, Shift+Enter baja de renglón.
//
// La estructura es la de Claude y ChatGPT (la caja redondeada con su barrita abajo de la conversación); el hilo
// —burbujas, días y ticks de WhatsApp— es Hilo.tsx, la misma pieza que dibuja el teléfono.
//
// ⚠️ El borrador de cada chat lo guarda el padre: cambiar de chat no borra lo que se estaba escribiendo.
//
// LA CABECERA (15/10/2026): la cuenta va como CHIP acá y no como grupo de la lista (Martín: «eso debe estar dentro
// de cada chat, con un chip»), y a la derecha el botón «Avance» abre la barra derecha con el roadmap de ESTE chat
// (Avance.tsx), como la de Offer.

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import type { Alcance } from '@/lib/operaciones-reglas';
import { avanceDelChat, conteoAvance, historialDelChat, nombreCuenta, textoDeEnvio, type ChatCentro, type Envio, type TrabajoP } from '@/lib/centro-chats';
import type { Aspecto } from '@/lib/centro-munecos';
import { hace, type PedidoP, type PushP } from '@/lib/progreso-reglas';
import type { AccionResponder, Decision } from '@/app/admin/runway/decisiones';
import { Hilo } from './Hilo';
import { Pregunta } from './Pregunta';
import { Microfono } from './Microfono';
import { RielAvance } from './Avance';
import { Muneco, animoDe } from './Muneco';

const ESTADO_CHAT: Record<ChatCentro['estado'], string> = { trabajando: 'Trabajando', abierto: 'Abierto', cerrado: 'Cerrado', sin_dato: '' };

export function Conversacion({
  chat, pedidos, trabajos, pushes, ahora, espera, envio, texto, onTexto, alcance, onAlcance, enviando, onMandar, onCrearClave, onCopiarClave, onVolver,
  avance, onAvance, aspecto, onMenu, onMuneco, preguntas, respuestas, responder, selectores,
}: {
  /** A qué cuenta va y con qué modelo y esfuerzo corre (PiezasCentro.tsx → SelectoresDeEnvio), en la barrita de la caja. */
  selectores?: ReactNode;
  /** Las tarjetas de la Ticketera que ESTE chat espera (lib/centro-preguntas.ts): se contestan arriba de la caja. */
  preguntas: readonly Decision[];
  /** Las suyas ya contestadas: van en la conversación como respuestas de Martín. */
  respuestas: readonly Decision[];
  responder: AccionResponder;
  chat: ChatCentro;
  /** Cuántas tarjetas de la Ticketera esperan una respuesta de Martín para este chat. */
  espera: number;
  pedidos: ReadonlyMap<string, PedidoP>;
  trabajos: readonly TrabajoP[];
  /** Los pushes de Vercel; null mientras llegan (el avance no afirma «subió» sin leerlos). */
  pushes: readonly PushP[] | null;
  ahora: number;
  /** La barra derecha del avance, abierta o no (la decide el padre: se recuerda entre chats). */
  avance: boolean;
  onAvance: (abierta: boolean) => void;
  /** El muñeco que Martín le eligió (o null: el de siempre). */
  aspecto: Aspecto | null;
  /** El «⋯» de la cabecera: el menú del chat, abierto en ese punto. */
  onMenu: (x: number, y: number) => void;
  /** Tocar al muñeco abre el selector (Martín: «que si le doy click pueda elegir cambiar a otro»). */
  onMuneco: () => void;
  envio: Envio;
  texto: string;
  onTexto: (t: string) => void;
  alcance: Alcance;
  onAlcance: (a: Alcance) => void;
  enviando: boolean;
  onMandar: () => void;
  onCrearClave: () => void;
  onCopiarClave: () => void;
  onVolver: () => void;
}) {
  const lineas = historialDelChat(chat, pedidos, trabajos, respuestas);
  // Lo que dijo el micrófono si no pudo (permiso, transcripción): va en la línea de estado de la caja.
  const [faltaMic, setFaltaMic] = useState<string | null>(null);
  useEffect(() => { setFaltaMic(null); }, [chat.clave]);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);

  // Como un chat: abre mostrando lo último, y baja cuando llega algo nuevo.
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [chat.clave, lineas.length]);
  // El renglón crece con lo que se escribe, hasta el tope del CSS.
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [texto]);
  // Elegir un chat deja el cursor en su caja, como cualquier app de chat.
  useEffect(() => { if (envio.puede) caja.current?.focus({ preventScroll: true }); }, [chat.clave, envio.puede]);

  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter manda; Shift+Enter baja de renglón. Mientras se compone un acento (IME), Enter es del teclado.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onMandar(); }
  };

  const estado = textoDeEnvio(envio);
  const cuenta = nombreCuenta(chat.cuenta);
  // La cuenta como chip: una por cuenta donde vive el chat (unido por nombre), la que recibe primero.
  const cuentas = [...new Set(chat.sesiones.map((s) => s.cuenta).filter((c): c is string => !!c))];
  if (!cuentas.length && chat.cuenta) cuentas.push(chat.cuenta);
  const meta = chat.viejo && chat.vistoAt != null ? `${ESTADO_CHAT[chat.estado]} ${hace(chat.vistoAt, ahora)}` : ESTADO_CHAT[chat.estado];
  const nodos = avanceDelChat(lineas);
  const { hechos, total } = conteoAvance(nodos);

  return (
    <section className="co-panel" aria-label={`Conversación con ${chat.titulo}`}>
      <header className="co-cab">
        <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} onClick={onVolver} aria-label="Volver a los chats">
          <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
        </button>
        <button type="button" className="co-cab__muneco" onClick={onMuneco} title="Cambiar su muñeco" aria-label={`Cambiar el muñeco de ${chat.titulo}`}>
          <Muneco titulo={chat.titulo} aspecto={aspecto} animo={animoDe(chat)} size={34} espera={espera} />
        </button>
        <div className="co-cab__texto">
          <h1 className="co-cab__titulo" title={chat.titulo}>{chat.titulo}</h1>
          <span className="co-cab__meta">
            {cuentas.map((c) => <span key={c} className="co-chip-cuenta">{nombreCuenta(c)}</span>)}
            {meta}
          </span>
        </div>
        <button type="button" className="co-cab__avance" aria-pressed={avance} onClick={() => onAvance(!avance)}
          title={avance ? 'Cerrar el Plan' : 'Ver el Plan de este chat'}>
          <Icon name="todo" size={16} />
          <span className="co-cab__avance-txt">Plan</span>
          {total > 0 && <span className="co-avance__conteo">{hechos}<span>/{total}</span></span>}
        </button>
        <button type="button" className="co-cab__mas" aria-label={`Opciones de ${chat.titulo}`} title="Opciones"
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onMenu(r.left - 150, r.bottom + 4); }}>
          <Icon name="mas" size={18} />
        </button>
      </header>

      <div className="co-cuerpo">
      <div className="co-conv">
      <div className="co-hilo" ref={hilo}>
        <div className="co-hilo__col">
          <Hilo lineas={lineas} pushes={pushes ?? []} ahora={ahora} vacio="Escríbele abajo para empezar." quien={{ titulo: chat.titulo, aspecto, animo: animoDe(chat), dato: [cuenta, meta].filter(Boolean).join(' · ') }} />
        </div>
      </div>

      <div className="co-caja-wrap">
        {/* Lo que el empleado espera de Martín, arriba de la caja, como AskUserQuestion de Claude Code (Pregunta.tsx).
            La que se contesta se va de acá y queda en la conversación. */}
        {preguntas.length > 0 && <Pregunta key={chat.clave} preguntas={preguntas} responder={responder} />}
        {envio.puede ? (
          <div className="co-caja">
            <textarea
              ref={caja}
              rows={1}
              value={texto}
              onChange={(e) => onTexto(e.target.value)}
              onKeyDown={tecla}
              placeholder={`Escribe a ${chat.titulo}`}
              aria-label={`Escribe a ${chat.titulo}`}
              disabled={enviando}
            />
            <div className="co-caja__barra">
              <button
                type="button" className="co-chip" aria-pressed={alcance === 'de_ahora_en_mas'}
                title="Con «Y de ahora en más», el chat deja la regla escrita además de hacerlo"
                onClick={() => onAlcance(alcance === 'solo_esto' ? 'de_ahora_en_mas' : 'solo_esto')}
              >
                {alcance === 'solo_esto' ? 'Sólo esto' : 'Y de ahora en más'}
              </button>
              {selectores}
              <Microfono valor={texto} onValor={(v) => { setFaltaMic(null); onTexto(v); }} onError={setFaltaMic} apagado={enviando} />
              <button type="button" className="co-enviar" onClick={onMandar} disabled={enviando || !texto.trim()} aria-label="Firmar y mandar" title="Firmar y mandar (Enter)">
                {enviando ? <span className="co-enviar__giro" aria-hidden /> : <Icon name="flecha" size={18} />}
              </button>
            </div>
          </div>
        ) : envio.por === 'leyendo_clave' ? (
          <div className="co-caja co-caja--quieta" aria-busy="true"><p>&nbsp;</p></div>
        ) : (
          <div className="co-caja co-caja--quieta">
            <p>{estado}</p>
            {envio.por === 'sin_clave' && <button type="button" className="co-chip" onClick={onCrearClave}>Crear Token</button>}
            {envio.por === 'clave_no_aceptada' && <button type="button" className="co-chip" onClick={onCopiarClave}><Icon name="copy" size={14} />Copiar Token</button>}
          </div>
        )}
        <p className="co-caja__estado" aria-live="polite">{envio.puede ? faltaMic ?? estado ?? '' : ''}</p>
      </div>
      </div>
      {avance && <RielAvance nodos={nodos} pushes={pushes} ahora={ahora} onCerrar={() => onAvance(false)} chat={chat} />}
      </div>
    </section>
  );
}
