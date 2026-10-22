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
// LA CABECERA, la conversación y la caja abajo son el panel de PanelChat.tsx (21/10/2026): la MISMA pieza que monta el Ops
// Center de cada cliente con su chat con MaKo. Acá va lo de Claude Code: el hilo de los turnos, la pregunta de la Ticketera
// arriba de la caja, el Token y los selectores del «+».

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import { PanelDeChat } from './PanelChat';
import type { TurnoChat } from '@/lib/operaciones-reglas';
import { historialDelChat, nombreCuenta, textoDeEnvio, trabajaSinEscribir, type CarteroP, type ChatCentro, type Envio, type LineaChat, type TrabajoP } from '@/lib/centro-chats';
import { Modal } from '@/app/_ui';
import { SIN_MARCAS, type CambioMarca, type Cita, type MarcasChat } from '@/lib/centro-mensajes';
import { BarraFijados, CitaCaja, ContextoWA, InfoMensaje, MenuMensajeWA, ReenviarA, type AccionesWA, type MenuAbiertoWA, type MensajeWA } from './MensajeWA';
import type { TareaDelChat } from '@/lib/centro-plan-auto-reglas';
import type { PasoDelTurno } from '@/lib/centro-pasos';
import type { Aspecto } from '@/lib/centro-munecos';
import { hace, type PedidoP, type PushP } from '@/lib/progreso-reglas';
import type { AccionResponder, Decision } from '@/app/admin/runway/decisiones';
import { Hilo, TANDA_HILO } from './Hilo';
import type { Responder } from './PreguntaChat';
import type { PreguntaChat as PreguntaChatT } from '@/lib/centro-preguntas-chat';
import { Pregunta } from './Pregunta';
import type { AdjuntosDeCaja } from './AdjuntosCaja';
import { CajaChat } from '@/app/_chat/CajaChat';
import { TareasVinculadas, irAlTurno } from './Avance';
import { animoDe } from './Muneco';

const ESTADO_CHAT: Record<ChatCentro['estado'], string> = { trabajando: 'Trabajando', abierto: 'Abierto', cerrado: 'Cerrado', sin_dato: '' };
const SIN_PUSHES: PushP[] = [];

/** Lo de WhatsApp que la conversación necesita del motor (useCentro.ts): lo arma PiezasCentro.tsx → ChatDelCentro. */
export type WaDeConversacion = {
  marcas: MarcasChat;
  onMarcar: (c: CambioMarca) => void;
  cita: Cita | null;
  onCitar: (c: Cita | null) => void;
  chats: readonly ChatCentro[];
  onReenviar: (texto: string, claves: string[]) => Promise<number>;
  onCopiar: (texto: string) => void;
};

export function Conversacion({
  chat, pedidos, trabajos, pushes, ahora, espera, envio, texto, onTexto, enviando, onMandar, onCrearClave, onCopiarClave, onVolver,
  aspecto, onMuneco, onRenombrar, preguntas, respuestas, responder, selectores, turnos = [], adjuntos, carteros,
  preguntasChat = [], onResponder, resumenEnvio = null, tareas = [], lineas: lineasDeFuera, wa, pasos, yaVisto = null, onYaVisto,
}: {
  /** Los pasos en vivo de su turno abierto (la E): van en el «Trabajando…» del hilo. */
  pasos?: readonly PasoDelTurno[];
  /** La conversación ya calculada (useCentro.ts → lineasDe, memorizada): sin esto se calcula acá en cada render. */
  lineas?: readonly LineaChat[];
  /** Lo de WhatsApp en cada mensaje (17/10/2026, MensajeWA.tsx): las marcas, la cita de la caja, reenviar y copiar. */
  wa?: WaDeConversacion;
  /** Las tareas del Plan de este chat (lib/centro-plan-auto-reglas.ts): la tarjeta de cada «Ya está» y «Tareas vinculadas». */
  tareas?: readonly TareaDelChat[];
  /** El ✓ de sus «Completado» (18/10/2026): hasta qué «Ya está» lo vio Martín, y cómo se marca (useCentro.ts → marcarYaVisto). */
  yaVisto?: number | null;
  onYaVisto?: (instante: number) => void;
  /** Lo elegido para mandar que no es «Automático» (la cuenta, el modelo), en chico al lado del «+». */
  resumenEnvio?: string | null;
  /** Las preguntas del chat como formulario en su conversación (17/10/2026), y cómo se contestan (useCentro.ts). */
  preguntasChat?: readonly PreguntaChatT[];
  onResponder?: Responder;
  /** Los Runners: con ellos cada trabajo dice en qué está y por qué tarda (Hilo.tsx → VivoDelHilo). */
  carteros?: readonly CarteroP[];
  /** Las fotos y los PDF de la caja (17/10/2026): elegirlos, pegarlos con Ctrl+V y quitarlos (useCentro.ts). */
  adjuntos?: AdjuntosDeCaja;
  /** Lo que se le dijo y lo que contestó, del transcript (useCentro.ts → turnosDe): la conversación de verdad. */
  turnos?: readonly TurnoChat[];
  /** A qué cuenta va y con qué modelo y esfuerzo corre (PiezasCentro.tsx → SelectoresDeEnvio), adentro del «+» de la caja. */
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
  /** El muñeco que Martín le eligió (o null: el de siempre). */
  aspecto: Aspecto | null;
  /** Tocar al muñeco abre el selector (Martín: «que si le doy click pueda elegir cambiar a otro»). Sin esto (el Cerebro,
   *  que es siempre la estrella de MaKo) la criatura no se toca. */
  onMuneco?: () => void;
  /** Renombrar el chat desde el título, en el lugar: devuelve el error, o null si salió (useCentro.ts → renombrarChat). Sin esto
   *  (un chat sin sesión abierta) el título no se toca. */
  onRenombrar?: (nombre: string) => Promise<string | null>;
  envio: Envio;
  texto: string;
  onTexto: (t: string) => void;
  enviando: boolean;
  onMandar: () => void;
  onCrearClave: () => void;
  onCopiarClave: () => void;
  onVolver: () => void;
}) {
  const lineas = lineasDeFuera ?? historialDelChat(chat, pedidos, trabajos, respuestas, turnos, preguntasChat);
  // Lo que dijo el micrófono si no pudo (permiso, transcripción): va en la línea de estado de la caja.
  const [faltaMic, setFaltaMic] = useState<string | null>(null);
  useEffect(() => { setFaltaMic(null); }, [chat.clave]);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);

  // Como un chat: abre mostrando lo último, y baja cuando llega algo nuevo.
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [chat.clave, lineas.length]);
  // El campo que crece y el scroll que lo acompaña son de la caja única (app/_chat/CajaChat.tsx): le pasa la conversación.
  const seguirHilo = useCallback(() => hilo.current, []);
  // Elegir un chat deja el cursor en su caja, como cualquier app de chat.
  useEffect(() => { if (envio.puede) caja.current?.focus({ preventScroll: true }); }, [chat.clave, envio.puede]);

  const estado = textoDeEnvio(envio);
  const cuenta = nombreCuenta(chat.cuenta);
  const meta = chat.viejo && chat.vistoAt != null ? `${ESTADO_CHAT[chat.estado]} ${hace(chat.vistoAt, ahora)}` : ESTADO_CHAT[chat.estado];
  /** Responder sobre un «Ya está»: la caja arranca con «Sobre «…»: » y queda lista para escribir. */
  const responderSobre = (titulo: string) => {
    const prefijo = `Sobre «${titulo}»: `;
    onTexto(texto.startsWith(prefijo) ? texto : prefijo + texto);
    enfocarCaja();
  };
  const enfocarCaja = () => window.setTimeout(() => { const el = caja.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0);

  // ── Lo que la conversación le pasa al hilo, ESTABLE: el hilo está memorizado (Hilo.tsx) y una función o un objeto
  //    nuevos en cada tecla lo volverían a dibujar entero ──────────────────────────────────────────────────────────
  const ultimos = useRef({ onResponder, responderSobre, wa, chat, onYaVisto });
  useLayoutEffect(() => { ultimos.current = { onResponder, responderSobre, wa, chat, onYaVisto }; });
  const yaVistoCb = useCallback((instante: number) => ultimos.current.onYaVisto?.(instante), []);
  const responderPregunta = useCallback<NonNullable<typeof onResponder>>((p, e, o) => ultimos.current.onResponder?.(p, e, o) ?? Promise.resolve(null), []);
  const feedback = useCallback((titulo: string) => ultimos.current.responderSobre(titulo), []);
  const animo = animoDe(chat, espera);
  const dato = trabajaSinEscribir(chat, lineas) ?? [cuenta, meta].filter(Boolean).join(' · ');
  const quien = useMemo(() => ({ titulo: chat.titulo, aspecto, animo, dato }), [chat.titulo, aspecto, animo, dato]);
  const vivo = useMemo(() => (carteros ? { chat, carteros } : undefined), [chat, carteros]);

  // ── Lo de WhatsApp: el menú de un mensaje, su Info y Reenviar ───────────────────────────────────────────────────
  // La conversación abre con los últimos mensajes (Hilo.tsx → TANDA_HILO); «Ver anteriores» o ir a uno viejo dibujan todos.
  const [cuantos, setCuantos] = useState(TANDA_HILO);
  useEffect(() => { setCuantos(TANDA_HILO); }, [chat.clave]);
  const verTodo = useCallback(() => setCuantos(Number.MAX_SAFE_INTEGER), []);
  const [menuWA, setMenuWA] = useState<MenuAbiertoWA | null>(null);
  const [panelWA, setPanelWA] = useState<{ tipo: 'info' | 'reenviar'; m: MensajeWA } | null>(null);
  const [reenviando, setReenviando] = useState(false);
  useEffect(() => { setMenuWA(null); setPanelWA(null); }, [chat.clave]);
  const marcas = wa?.marcas ?? SIN_MARCAS;
  const accionesWA = useMemo<AccionesWA>(() => ({
    abrirMenu: (m, x, y, tactil) => setMenuWA({ m, x, y, tactil }),
    responder: (m) => {
      ultimos.current.wa?.onCitar({ de: m.de, texto: m.texto, id: m.id });
      window.setTimeout(() => caja.current?.focus(), 0);
    },
    reaccionar: (id, emoji) => ultimos.current.wa?.onMarcar({ tipo: 'reaccion', id, emoji }),
    verTodo,
  }), [verTodo]);
  const elegirEnMenu = (m: MensajeWA, id: string) => {
    setMenuWA(null);
    if (!wa) return;
    if (id.startsWith('reaccion:')) { const e = id.slice('reaccion:'.length); wa.onMarcar({ tipo: 'reaccion', id: m.id, emoji: marcas.reacciones[m.id] === e ? null : e }); return; }
    if (id === 'responder') { accionesWA.responder(m); return; }
    if (id === 'copiar') { wa.onCopiar(m.texto); return; }
    if (id === 'reenviar' || id === 'info') { setPanelWA({ tipo: id, m }); return; }
    if (id === 'destacar') { wa.onMarcar({ tipo: 'destacar', id: m.id, si: !marcas.destacados.includes(m.id) }); return; }
    if (id === 'fijar') { wa.onMarcar({ tipo: 'fijar', id: m.id, si: !marcas.fijados.includes(m.id) }); return; }
    if (id === 'eliminar') { wa.onMarcar({ tipo: 'ocultar', id: m.id }); if (wa.cita?.id === m.id) wa.onCitar(null); }
  };

  return (
    <PanelDeChat hilo={hilo} adjuntos={adjuntos}
      cabecera={{ clave: chat.clave, titulo: chat.titulo, aspecto, animo, espera, onMuneco, onRenombrar, onVolver }}
      // Los fijados, arriba de la conversación (WhatsApp): tocar va al mensaje.
      arriba={wa && <BarraFijados marcas={marcas} lineas={lineas} titulo={chat.titulo} onSoltar={(id) => wa.onMarcar({ tipo: 'fijar', id, si: false })} verTodo={verTodo} />}
      despues={wa && <>
        <MenuMensajeWA abierto={menuWA} marcas={marcas} onCerrar={() => setMenuWA(null)} onElegir={elegirEnMenu} />
        {panelWA && (
          <Modal titulo={panelWA.tipo === 'info' ? 'Info del mensaje' : 'Reenviar a…'} onCerrar={() => setPanelWA(null)} ancho={460}>
            {panelWA.tipo === 'info'
              ? <InfoMensaje m={panelWA.m} />
              : <ReenviarA chats={wa.chats} origen={chat.clave} enviando={reenviando} onEnviar={async (claves) => {
                setReenviando(true);
                const ok = await wa.onReenviar(panelWA.m.texto, claves);
                setReenviando(false);
                if (ok) setPanelWA(null);
              }} />}
          </Modal>
        )}
      </>}
      caja={<>
        {/* Lo que el empleado espera de Martín, arriba de la caja, como AskUserQuestion de Claude Code (Pregunta.tsx).
            La que se contesta se va de acá y queda en la conversación. */}
        {preguntas.length > 0 && <Pregunta key={chat.clave} preguntas={preguntas} responder={responder} />}
        {envio.puede ? (
          <div className="co-caja">
            {/* La caja ÚNICA (app/_chat/CajaChat.tsx, 20/10/2026): la misma en toda la app. Arriba, la cita del mensaje que se
                responde (con su ✕, WhatsApp); en el «+», con qué corre y las tareas del chat. */}
            <CajaChat texto={texto} onTexto={(v) => { setFaltaMic(null); onTexto(v); }} onMandar={onMandar} enviando={enviando}
              placeholder={`Escribe a ${chat.titulo}`} tituloMandar="Firmar y mandar (Enter)" enterManda
              adjuntos={adjuntos} campo={caja} seguir={seguirHilo} onErrorMic={setFaltaMic}
              arriba={wa?.cita ? <CitaCaja cita={wa.cita} onQuitar={() => wa.onCitar(null)} verTodo={verTodo} /> : null}
              mas={(cerrar) => <>{selectores}<TareasVinculadas tareas={tareas} onIr={(u) => { cerrar(); verTodo(); window.setTimeout(() => irAlTurno(u), 80); }} /></>} />
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
      </>}
      estado={envio.puede ? faltaMic ?? estado ?? resumenEnvio ?? '' : ''}>
      <ContextoWA.Provider value={wa ? accionesWA : null}>
        <Hilo lineas={lineas} pushes={pushes ?? SIN_PUSHES} ahora={ahora} vacio="Escríbele abajo para empezar." quien={quien}
          vivo={vivo} onResponder={onResponder ? responderPregunta : undefined} tareas={tareas} onFeedback={feedback} marcas={wa?.marcas} pasos={pasos}
          yaVisto={yaVisto} onYaVisto={onYaVisto ? yaVistoCb : undefined}
          mostrar={cuantos} onVerAnteriores={verTodo} />
      </ContextoWA.Provider>
    </PanelDeChat>
  );
}
