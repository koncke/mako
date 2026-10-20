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
// LA CABECERA (17/10/2026, 19:31): la criatura AL LADO del título, a la izquierda, como la foto de WhatsApp. Tocar la criatura
// deja cambiarla; tocar el título deja renombrarlo EN EL LUGAR (Enter guarda, Escape lo deja como estaba). Sin chips de cuenta
// ni estado: «esos botones al lado de la criatura NO van, para eso está el "+"» (la cuenta se elige en el «+» de la caja).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import type { TurnoChat } from '@/lib/operaciones-reglas';
import { conVinetas, enterEnLista, estaAbajo } from '@/lib/centro-caja';
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
import { BotonMandar } from './Microfono';
import { BotonEmojis } from './Emojis';
import { ListaAdjuntos, MasCaja, alPegar, alSoltar, traeArchivos, type AdjuntosDeCaja } from './AdjuntosCaja';
import { TareasVinculadas, irAlTurno } from './Avance';
import { LinksDeLaCaja, ResalteDeLinks, hayLinks } from './ConLinks';
import { Muneco, animoDe } from './Muneco';

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
  /** Se está arrastrando un archivo sobre la conversación: se dibuja dónde soltarlo (18/10/2026). */
  const [soltando, setSoltando] = useState(false);
  useEffect(() => { setFaltaMic(null); }, [chat.clave]);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  /** Dónde va el cursor después de que una lista cambió el texto (la viñeta, el ítem siguiente). */
  const cursor = useRef<number | null>(null);
  /** La capa que pinta los links (17/10/2026): se corre con el scroll del <textarea>. */
  const resalte = useRef<HTMLDivElement | null>(null);
  const conLinks = hayLinks(texto);

  // Como un chat: abre mostrando lo último, y baja cuando llega algo nuevo.
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [chat.clave, lineas.length]);
  // El renglón crece con lo que se escribe, hasta el tope del CSS. Y el scroll lo acompaña (18/10/2026, Martín: «la caja
  // crece y el chat no lo acompaña»): la conversación, que se achica cuando la caja crece, sigue abajo si estaba abajo
  // (se mide ANTES de crecer); y la caja, pasado su tope, sigue al cursor (el `height = 'auto'` le reseteaba el scroll).
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const h = hilo.current;
    const conversacionAbajo = h ? estaAbajo(h) : false;
    const antes = el.scrollTop;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
    el.scrollTop = el.selectionEnd >= el.value.length ? el.scrollHeight : antes;
    if (h && conversacionAbajo) h.scrollTop = h.scrollHeight;
    if (cursor.current != null) { el.setSelectionRange(cursor.current, cursor.current); cursor.current = null; }
  }, [texto]);
  // Elegir un chat deja el cursor en su caja, como cualquier app de chat.
  useEffect(() => { if (envio.puede) caja.current?.focus({ preventScroll: true }); }, [chat.clave, envio.puede]);

  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter manda; Shift+Enter baja de renglón. Mientras se compone un acento (IME), Enter es del teclado. Adentro de una
    // lista, Enter arma el ítem siguiente y en uno vacío la corta (lib/centro-caja.ts → enterEnLista).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const l = enterEnLista(texto, e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
      if (l) { cursor.current = l.cursor; onTexto(l.texto); return; }
      onMandar();
    }
  };

  const estado = textoDeEnvio(envio);
  const cuenta = nombreCuenta(chat.cuenta);
  // El título se renombra en el lugar (la cabecera): `editando` es lo que se está escribiendo.
  const [editando, setEditando] = useState<{ texto: string; error: string | null; mandando: boolean } | null>(null);
  useEffect(() => { setEditando(null); }, [chat.clave]);
  const guardarNombre = async () => {
    if (!editando || !onRenombrar || editando.mandando) return;
    setEditando({ ...editando, mandando: true, error: null });
    const mal = await onRenombrar(editando.texto);
    if (mal) setEditando({ ...editando, mandando: false, error: mal }); else setEditando(null);
  };
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
    <section className="co-panel" aria-label={`Conversación con ${chat.titulo}`} data-soltando={soltando || undefined}
      // Arrastrar una imagen o un PDF a la conversación lo adjunta (18/10/2026): sin esto el navegador lo abría en la pestaña.
      onDragOver={(e) => { if (!traeArchivos(e.dataTransfer)) return; e.preventDefault(); e.dataTransfer.dropEffect = adjuntos?.puede ? 'copy' : 'none'; if (!soltando) setSoltando(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSoltando(false); }}
      onDrop={(e) => { setSoltando(false); alSoltar(e, adjuntos); }}>
      {soltando && <div className="co-soltar" aria-hidden>{adjuntos?.puede ? 'Suelta para adjuntar' : 'Este chat no recibe archivos'}</div>}
      <header className="co-cab">
        <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} onClick={onVolver} aria-label="Volver a los chats">
          <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
        </button>
        {onMuneco ? (
          <button type="button" className="co-cab__muneco" onClick={onMuneco} title="Cambiar su criatura" aria-label={`Cambiar la criatura de ${chat.titulo}`}>
            <Muneco titulo={chat.titulo} aspecto={aspecto} animo={animo} size={34} espera={espera} />
          </button>
        ) : <span className="co-cab__muneco"><Muneco titulo={chat.titulo} aspecto={aspecto} animo={animo} size={34} espera={espera} /></span>}
        <div className="co-cab__texto">
          <h1 className="co-cab__titulo" title={chat.titulo}>
            {editando ? (
              <input className="co-cab__input" value={editando.texto} maxLength={120} autoFocus disabled={editando.mandando}
                aria-label={`Nombre de ${chat.titulo}`} enterKeyHint="done"
                onChange={(e) => setEditando({ ...editando, texto: e.target.value, error: null })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void guardarNombre(); }
                  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditando(null); }
                }}
                onBlur={() => { if (!editando.mandando) setEditando(null); }} />
            ) : onRenombrar ? (
              <button type="button" className="co-cab__nombre" title="Renombrar" aria-label={`Renombrar ${chat.titulo}`}
                onClick={() => setEditando({ texto: chat.titulo, error: null, mandando: false })}>{chat.titulo}</button>
            ) : chat.titulo}
          </h1>
          {editando?.error && <span className="co-cab__error" role="alert">{editando.error}</span>}
        </div>
        {/* Sin el botón «Plan» desde el 17/10/2026 (la C): el Plan del chat va en cada «Ya está» y en el «+» de la caja. */}
        {/* Sin «⋯» acá desde el 17/10/2026 (Martín: fuera los tres puntos): Renombrar y la criatura están en la fila de la
            barra (su «⋯» y el clic derecho), y la criatura también se cambia tocándola acá. */}
      </header>

      <div className="co-cuerpo">
      <div className="co-conv">
      {/* Los fijados, arriba de la conversación (WhatsApp): tocar va al mensaje. */}
      {wa && <BarraFijados marcas={marcas} lineas={lineas} titulo={chat.titulo} onSoltar={(id) => wa.onMarcar({ tipo: 'fijar', id, si: false })} verTodo={verTodo} />}
      <div className="co-hilo" ref={hilo}>
        <div className="co-hilo__col">
          <ContextoWA.Provider value={wa ? accionesWA : null}>
            <Hilo lineas={lineas} pushes={pushes ?? SIN_PUSHES} ahora={ahora} vacio="Escríbele abajo para empezar." quien={quien}
              vivo={vivo} onResponder={onResponder ? responderPregunta : undefined} tareas={tareas} onFeedback={feedback} marcas={wa?.marcas} pasos={pasos}
              yaVisto={yaVisto} onYaVisto={onYaVisto ? yaVistoCb : undefined}
              mostrar={cuantos} onVerAnteriores={verTodo} />
          </ContextoWA.Provider>
        </div>
      </div>
      {wa && <MenuMensajeWA abierto={menuWA} marcas={marcas} onCerrar={() => setMenuWA(null)} onElegir={elegirEnMenu} />}
      {wa && panelWA && (
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

      <div className="co-caja-wrap">
        {/* Lo que el empleado espera de Martín, arriba de la caja, como AskUserQuestion de Claude Code (Pregunta.tsx).
            La que se contesta se va de acá y queda en la conversación. */}
        {preguntas.length > 0 && <Pregunta key={chat.clave} preguntas={preguntas} responder={responder} />}
        {envio.puede ? (
          <div className="co-caja">
            {/* Respondiendo a un mensaje: su cita arriba de la caja, con la ✕ para soltarla (WhatsApp). */}
            {wa?.cita && <CitaCaja cita={wa.cita} onQuitar={() => wa.onCitar(null)} verTodo={verTodo} />}
            <ListaAdjuntos a={adjuntos} />
            {/* UNA FILA, como WhatsApp (17/10/2026; Martín: «que ocupe todo el ancho, con el "+" incluido... el botón de audio
                y el de enviar son UNO»): el «+» a la izquierda, el campo en el medio y un solo botón a la derecha (Microfono.tsx
                → BotonMandar). Lo elegido en el «+» que no es «Automático» va abajo, en la línea de estado. */}
            <div className="co-caja__fila">
              <MasCaja a={adjuntos} apagado={enviando} resumen={null}>
                {(cerrar) => <>{selectores}<TareasVinculadas tareas={tareas} onIr={(u) => { cerrar(); verTodo(); window.setTimeout(() => irAlTurno(u), 80); }} /></>}
              </MasCaja>
              {/* Los emojis, en su botón junto al campo (WhatsApp; Emojis.tsx). */}
              <BotonEmojis campo={caja} valor={texto} onValor={onTexto} apagado={enviando} />
              {/* Un link se ve azul mientras se escribe (la capa de abajo) y se abre desde su chip (17/10/2026). */}
              <div className="co-caja__campo">
              {conLinks && <ResalteDeLinks texto={texto} capa={(el) => { resalte.current = el; }} />}
              <textarea
                ref={caja}
                className={conLinks ? 'co-caja__texto--resalte' : undefined}
                onScroll={(e) => { if (resalte.current) resalte.current.scrollTop = e.currentTarget.scrollTop; }}
                rows={1}
                value={texto}
                onChange={(e) => {
                  // «- » y «* » al principio de un renglón se vuelven viñeta mientras se escribe (lib/centro-caja.ts).
                  const v = conVinetas(e.target.value, e.target.selectionStart);
                  if (v.texto !== e.target.value) cursor.current = v.cursor;
                  onTexto(v.texto);
                }}
                onKeyDown={tecla}
                onPaste={(e) => alPegar(e, adjuntos)}
                placeholder={`Escribe a ${chat.titulo}`}
                aria-label={`Escribe a ${chat.titulo}`}
                disabled={enviando}
              />
              </div>
              <BotonMandar valor={texto} onValor={(v) => { setFaltaMic(null); onTexto(v); }} onError={setFaltaMic} enviando={enviando}
                hayQueMandar={!!texto.trim() || !!adjuntos?.items.length} onMandar={onMandar} titulo="Firmar y mandar (Enter)" />
            </div>
            <LinksDeLaCaja texto={texto} />
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
        <p className="co-caja__estado" aria-live="polite">{envio.puede ? faltaMic ?? estado ?? resumenEnvio ?? '' : ''}</p>
      </div>
      </div>
      </div>
    </section>
  );
}
