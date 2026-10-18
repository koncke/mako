'use client';

// =============================================================================
// Chats en el teléfono: la misma lista y la misma conversación que la computadora, destiladas (16/10/2026)
// =============================================================================
// Copiado de WhatsApp y de Codex en el iPhone (capturas del 15/10, docs/hallazgos-operaciones.md): UNA lista (sin
// grupos por cuenta desde el 15/10: Martín, «No quiero que exista "cuenta 1, cuenta 2, 3"»), cada fila con su punto,
// el título, la edad a la derecha y lo último que pasó debajo; al tocarla, la conversación a pantalla casi
// completa con la caja de escribir FIJA abajo, como WhatsApp. El hilo es el de la computadora (Hilo.tsx), y arriba
// va la barra «Avance 3/5» que se abre (Avance.tsx, la de «Tu oferta» de Offer en el teléfono). La cuenta, como chip.
// Los chats se unen por nombre (las tres cuentas) y cada sub-chat («CRM › Lead Detail») va debajo de su jefe, corrido
// a la derecha, como en la computadora. EL TÍTULO DE LA HOJA ES EL CHAT, como el de WhatsApp (17/10/2026, 19:31): la criatura a
// la izquierda del nombre; tocar la criatura deja cambiarla (en la misma hoja) y tocar el nombre lo renombra EN EL LUGAR. Sin
// chips de cuenta ni estado, sin lista de opciones y sin «Tu foto de perfil» (eso se cambia en Tu cuenta).
//
// ⚠️ MANDAR DESDE EL TELÉFONO pasa por el MISMO camino que la computadora (app/admin/operaciones/mandar.ts →
// encolarPedidoAction, con su `puedeOperar`): se firma con la clave de ESTE teléfono, y la PC tiene que
// aceptarla (cartero.mjs clave). Hasta entonces la caja lo dice y ofrece copiar la clave.
// ⚠️ EN DOS PARTES desde el 17/10 (tanda 5: los chats de Claude Code en el Second Brain del teléfono): `parte="lista"`
// dibuja sólo las filas (van ADENTRO de la hoja «Tus chats» de /m/second-brain) y `parte="hoja"` sólo la hoja de la
// conversación, que tiene que vivir AFUERA de esa hoja: si viviera adentro, cerrar «Tus chats» la desmontaría (una
// hoja sobre otra REEMPLAZA, SheetM.tsx). El chat abierto lo lleva el padre (`abierto` / `onAbierto`). Sin `parte`,
// todo junto, como en /m/operaciones.

import '@/app/admin/operaciones/centro.css';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FilaM, ListaM, PieM, SeccionM, SheetM, VacioM, useToastM } from '@/app/m/_ui';
import { Button } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { conVinetas, enterEnLista } from '@/lib/centro-caja';
import {
  SECCION_CHATS, avisosDe, comoSale, esPrioritario, seguirChat, esperaDe, historialDelChat, partesDelNombre, porJefe, seccionesDeChats, segundoRenglon, trabajaSinEscribir,
  textoDeEnvio, type CarteroP, type ChatCentro, type LineaChat, type TrabajoP, type VistaPrevia,
} from '@/lib/centro-chats';
import type { PedidoP, PushP } from '@/lib/progreso-reglas';
import type { AccionResponder, Decision } from '@/app/admin/runway/decisiones';
import { preguntasDelChat, respuestasDelChat } from '@/lib/centro-preguntas';
import { Pregunta } from '@/app/admin/operaciones/Pregunta';
import { CirculoNuevo } from '@/app/admin/operaciones/NuevoChat';
import { useChatNuevo } from '@/app/admin/operaciones/ChatNuevo';
import { CajaChatNuevo, CriaturaChatNuevo, CuerpoChatNuevo, TituloChatNuevo } from '@/app/admin/operaciones/ChatNuevoPiezas';
import { Hilo, TANDA_HILO, Tick } from '@/app/admin/operaciones/Hilo';
import { Muneco, animoDe } from '@/app/admin/operaciones/Muneco';
import { TareasVinculadas, irAlTurno } from '@/app/admin/operaciones/Avance';
import { LinksDeLaCaja, ResalteDeLinks, hayLinks } from '@/app/admin/operaciones/ConLinks';
import { ElegirMuneco } from '@/app/admin/operaciones/ElegirMuneco';
import { guardarMunecoAction } from '@/app/admin/operaciones/acciones';
import { BotonMandar } from '@/app/admin/operaciones/Microfono';
import { BotonEmojis } from '@/app/admin/operaciones/Emojis';
import { aspectoDe, elegidoPara, esCriaturaDeMako, type Aspecto, type MunecosElegidos } from '@/lib/centro-munecos';

const ESTADO: Record<ChatCentro['estado'], string> = { trabajando: 'Trabajando', abierto: 'Abierto', cerrado: 'Cerrado', sin_dato: '' };
const metaDe = (c: ChatCentro) => ESTADO[c.estado];
import { copiar, type useFirma } from '@/app/admin/operaciones/mandar';
import { ListaAdjuntos, MasCaja, alPegar, type AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import type { Centro } from '@/app/admin/operaciones/useCentro';
import { SelectoresDeEnvio, SelloCompletado, resumenDeEnvio } from '@/app/admin/operaciones/PiezasCentro';
import { BarraFijados, CitaCaja, ContextoWA, InfoMensaje, MenuMensajeWA, ReenviarA, type AccionesWA, type MenuAbiertoWA, type MensajeWA } from '@/app/admin/operaciones/MensajeWA';
import type { Responder } from '@/app/admin/operaciones/PreguntaChat';
import { SIN_MARCAS } from '@/lib/centro-mensajes';

/**
 * El título de la hoja de un chat, como la cabecera de WhatsApp (17/10/2026, Martín): la criatura a la izquierda del nombre.
 * Tocar la criatura deja cambiarla; tocar el nombre lo renombra EN EL LUGAR (Enter guarda; salir del campo lo deja como estaba).
 * Sin `onMuneco` (el Cerebro, que es siempre la estrella de MaKo) la criatura no se toca, y sin `onRenombrar` (un chat sin
 * sesión abierta a la que pedírselo) el nombre tampoco. Nada de chips de cuenta ni de estado: la cuenta se elige en el «+».
 */
function TituloDeChat({ chat, aspecto, avisos, renombre, onMuneco, onRenombrar, onTexto, onGuardar, onCancelar }: {
  chat: ChatCentro; aspecto: Aspecto | null;
  /** Lo que espera a Martín en este chat: sin nada y sin trabajar, la criatura duerme (`animoDe`). */
  avisos: number;
  renombre: { texto: string; error: string | null; mandando: boolean } | null;
  onMuneco?: () => void; onRenombrar?: () => void;
  onTexto: (t: string) => void; onGuardar: () => void; onCancelar: () => void;
}) {
  const muneco = <Muneco titulo={chat.titulo} aspecto={aspecto} animo={animoDe(chat, avisos)} size={34} />;
  return (
    <span className="m-operaciones-titulo">
      {onMuneco
        ? <button type="button" className="m-operaciones-titulo__muneco" onClick={onMuneco} aria-label={`Cambiar la criatura de ${chat.titulo}`}>{muneco}</button>
        : <span className="m-operaciones-titulo__muneco">{muneco}</span>}
      <span className="m-operaciones-titulo__texto">
        {renombre ? (
          <input className="m-operaciones-titulo__input" value={renombre.texto} maxLength={120} autoFocus disabled={renombre.mandando}
            aria-label={`Nombre de ${chat.titulo}`} enterKeyHint="done"
            onChange={(e) => onTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); onGuardar(); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancelar(); }
            }}
            onBlur={() => { if (!renombre.mandando) onCancelar(); }} />
        ) : onRenombrar
          ? <button type="button" className="m-operaciones-titulo__nombre" onClick={onRenombrar} aria-label={`Renombrar ${chat.titulo}`}>{chat.titulo}</button>
          : <span className="m-operaciones-titulo__nombre">{chat.titulo}</span>}
        {renombre?.error && <span className="m-operaciones-titulo__error" role="alert">{renombre.error}</span>}
      </span>
    </span>
  );
}

/** Cuántos chats se ven antes de «Ver todos». */
const VISIBLES = 10;
const SIN_LINEAS: LineaChat[] = [];
const SIN_PUSHES: PushP[] = [];

const edad = (t: number | null, ahora: number): string => {
  if (t == null || !Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86_400)} d`;
};

/**
 * La hoja del chat NUEVO del teléfono (17/10/2026): un chat vacío con su caja pegada abajo, como el de WhatsApp. Con el primer
 * mensaje, MaKo decide dónde va y cómo se llama (ChatNuevo.tsx); nada de formularios. La lógica es la de la computadora.
 */
function HojaChatNuevo({ centro, onCerrar, onAbrir }: { centro: Centro; onCerrar: () => void; onAbrir: (clave: string) => void }) {
  const chatNuevo = useChatNuevo(centro, onAbrir);
  return (
    <SheetM abierto onCerrar={onCerrar} snap="alto"
      titulo={<span className="m-operaciones-titulo"><span className="m-operaciones-titulo__muneco"><CriaturaChatNuevo n={chatNuevo} /></span><span className="m-operaciones-titulo__texto"><TituloChatNuevo n={chatNuevo} /></span></span>}
      pie={<CajaChatNuevo n={chatNuevo} movil />}>
      <div className="m-operaciones-hilo"><CuerpoChatNuevo n={chatNuevo} /></div>
    </SheetM>
  );
}

/**
 * Una fila de la lista, MEMORIZADA (17/10/2026, Martín: «Cuando estoy en un chat y le doy para atrás en mobile, tarda
 * bastante en reaccionar»). Abrir o cerrar una conversación, escribir en su caja o elegir la cuenta no cambia ninguna
 * fila: con `memo` y props que no cambian (la vista previa sale de los mapas de useCentro.ts, `onAbrir` es estable) React
 * no vuelve a dibujar las 50 filas en cada uno de esos toques. La medición, en docs/hallazgos-operaciones.md.
 */
type PropsFilaChatM = {
  c: ChatCentro; sub: boolean; previa: VistaPrevia | null; enCurso: string | null; espera: number; aspecto: Aspecto | null; ahora: number;
  onAbrir: (clave: string) => void;
  /** Trae un «Completado» que este teléfono no vio (useCentro.ts → yaSinVer): avisa IGUAL que «Espera tu respuesta» (17/10/2026). */
  nuevo: boolean;
  /** Lo escrito sin mandar (useCentro.ts → borradorDeLista): «Borrador: …», como WhatsApp. */
  borrador: string | null;
};
const FilaChatM = memo(function FilaChatM({ c, sub, previa: p, enCurso, espera, aspecto, ahora, onAbrir, nuevo, borrador }: PropsFilaChatM) {
  const renglon = segundoRenglon(c, espera, borrador, p, nuevo);
  // Dormido si no trabaja y no tiene nada para Martín (un aviso o un «Completado» sin ver): despierto sólo con uno de los dos.
  const animo = animoDe(c, avisosDe(espera, nuevo));
  return (
    <FilaM
      // Un sub-chat va corrido a la derecha, con su muñeco más chico y sólo lo que va después de «›».
      leading={<span className={sub ? 'm-operaciones-sub' : undefined}><Muneco titulo={c.titulo} aspecto={aspecto} animo={animo} size={sub ? 32 : 40} espera={avisosDe(espera, nuevo)} /></span>}
      titulo={<span className={`m-operaciones-texto1${animo === 'dormido' ? ' m-operaciones-texto1--dormido' : ''}`}>{sub ? `↳ ${partesDelNombre(c.titulo).sub}` : c.titulo}{c.nube && <> <span className="co-chip-cuenta">Nube</span></>}</span>}
      // El orden lo decide `segundoRenglon` (lib/centro-chats.ts), el mismo de la computadora.
      segunda={renglon ? {
        vivo: <span className="m-operaciones-vivo">{enCurso ?? 'trabajando…'}</span>,
        espera: <span className="m-operaciones-espera">Espera tu respuesta</span>,
        // El MISMO aviso, con el mismo estilo: un «Completado» sin ver, para revisar.
        revisar: <span className="m-operaciones-espera">Completado · para revisar</span>,
        borrador: <span className="m-operaciones-previa"><span className="co-borrador">Borrador:</span>{borrador}</span>,
        ya: <span className="m-operaciones-previa"><SelloCompletado />{p?.texto}</span>,
        previa: <span className="m-operaciones-previa">{p?.tick ? <Tick estado={p.tick} /> : p?.propio ? 'Tú: ' : ''}{p?.texto}</span>,
      }[renglon] : undefined}
      riel={<span className="m-operaciones-riel"><span className="m-operaciones-hace">{edad(c.actividad, ahora)}</span></span>}
      onClick={() => onAbrir(c.clave)}
      chevron={false}
    />
  );
}, mismaFila);

/** Dos filas se ven igual si lo que DIBUJAN es igual: el refresco (cada 8 s, cada 2,5 s con algo en camino) arma objetos nuevos
 *  de cada chat y de cada vista previa aunque nada haya cambiado, y sin esto las 90 filas se volvían a dibujar en cada uno. */
function mismaFila(a: PropsFilaChatM, b: PropsFilaChatM): boolean {
  return a.c.clave === b.c.clave && a.c.titulo === b.c.titulo && a.c.estado === b.c.estado && a.c.viejo === b.c.viejo && a.c.nube === b.c.nube
    && a.sub === b.sub && a.enCurso === b.enCurso && a.espera === b.espera && a.aspecto === b.aspecto && a.onAbrir === b.onAbrir && a.nuevo === b.nuevo && a.borrador === b.borrador
    && a.previa?.texto === b.previa?.texto && a.previa?.tick === b.previa?.tick && a.previa?.propio === b.previa?.propio && a.previa?.ya === b.previa?.ya
    && edad(a.c.actividad, a.ahora) === edad(b.c.actividad, b.ahora);
}

export function ChatsM({ chats, carteros, pedidos, trabajos, pushes, ahora, esperas, firma, munecos, onMunecos, decisiones, responder, parte, tituloChats = 'Chats', abierto: abiertoFuera, onAbierto, centro }: {
  /** El motor del Centro (useCentro.ts): con él, la caja elige la cuenta, el modelo y el esfuerzo (17/10/2026), igual que
   *  la de la computadora (PiezasCentro.tsx → SelectoresDeEnvio), y la lista y la conversación salen de SUS mapas
   *  memorizados (`previas`, `enCursos`, `lineasDe`): calcularlas acá en cada toque era lo que hacía lento el «atrás». */
  centro: Centro;
  /** Sólo las filas o sólo la hoja de la conversación (ver arriba); sin esto, las dos. */
  parte?: 'lista' | 'hoja';
  /** El título de la sección de los jefes (en el Second Brain, «Claude Code»: «Chats» ahí son los de MaKo). */
  tituloChats?: string;
  /** El chat abierto, cuando lo lleva el padre (las dos partes por separado). */
  abierto?: string | null;
  onAbierto?: (clave: string | null) => void;
  /** Las tarjetas de la Ticketera: cada chat contesta las suyas al final de su conversación, pegadas a la caja. */
  decisiones: readonly Decision[];
  responder: AccionResponder;
  chats: ChatCentro[];
  carteros: CarteroP[];
  pedidos: PedidoP[];
  trabajos: TrabajoP[];
  /** null mientras llegan los de Vercel: el avance no afirma «subió» sin leerlos. */
  pushes: PushP[] | null;
  ahora: number;
  /** Cuántas tarjetas de la Ticketera espera cada chat (lib/centro-chats.ts → esperasPorChat). */
  esperas: Record<string, number>;
  firma: ReturnType<typeof useFirma>;
  /** Lo que se acaba de mandar, para que se vea enseguida mientras llega el refresco. */
  onEnviado: (t: TrabajoP) => void;
  /** Los muñecos que Martín eligió, por nombre, y cómo quedan después de guardar uno. */
  munecos: MunecosElegidos;
  onMunecos: (m: MunecosElegidos) => void;
}) {
  const [abiertoPropio, setAbiertoPropio] = useState<string | null>(null);
  const abierto = abiertoFuera !== undefined ? abiertoFuera : abiertoPropio;
  const setAbierto = (clave: string | null) => { if (onAbierto) onAbierto(clave); else setAbiertoPropio(clave); };
  // Estable para las filas memorizadas (FilaChatM): si cambiara en cada render, `memo` no serviría de nada.
  const setAbiertoRef = useRef(setAbierto);
  useLayoutEffect(() => { setAbiertoRef.current = setAbierto; });
  const abrirEstable = useCallback((clave: string) => setAbiertoRef.current(clave), []);
  const [enteras, setEnteras] = useState<Set<string>>(new Set());
  // «Nuevo chat» (Martín, 17/10/2026: «jamás debe abrir un modal»): una hoja de chat vacía, con su caja (ChatNuevo.tsx).
  const [nuevoChat, setNuevoChat] = useState(false);
  const [renombre, setRenombre] = useState<{ texto: string; error: string | null; mandando: boolean } | null>(null);
  const [eligiendo, setEligiendo] = useState<{ aspecto: Aspecto; guardando: boolean } | null>(null);
  const toast = useToastM();
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);
  // El chat abierto se sigue aunque lo renombren (17/10/2026): su clave es su nombre, y si ya no está se lo busca por las
  // sesiones que tenía (lib/centro-chats.ts → seguirChat). Sin esto la hoja se cerraba sola al llegar el nombre nuevo.
  const miembrosAbierto = useRef<readonly string[] | null>(null);
  const elegido = seguirChat(chats, abierto, miembrosAbierto.current, trabajos);
  useEffect(() => {
    if (!elegido) return;
    miembrosAbierto.current = elegido.miembros;
    // La lista no lo corrige: con las dos partes, la de la hoja lo hace (la de la lista cierra «Tus chats» al elegir).
    if (parte !== 'lista' && abierto && elegido.clave !== abierto) setAbierto(elegido.clave);
  }, [elegido, abierto, parte]); // eslint-disable-line react-hooks/exhaustive-deps
  // La conversación del abierto sale del mapa memorizado del motor (el mismo cálculo, una vez por refresco y no en cada
  // tecla); un chat recién llegado que el mapa todavía no tiene se calcula acá.
  const lineas = elegido ? centro.lineasDe.get(elegido.clave) ?? historialDelChat(elegido, porId, trabajos, respuestasDelChat(elegido, decisiones, carteros), centro.turnosDe(elegido), centro.preguntasDe(elegido)) : SIN_LINEAS;
  // Lo que se dijo en el chat abierto: se pide mientras se lo mira (useCentro.ts → mirar). Sólo la hoja lo pide.
  const mirar = centro?.mirar;
  useEffect(() => {
    if (!mirar || parte === 'lista') return;
    mirar(elegido);
    return () => mirar(null);
  }, [elegido?.clave, mirar, parte]); // eslint-disable-line react-hooks/exhaustive-deps
  const preguntas = elegido ? preguntasDelChat(elegido, decisiones, carteros) : [];
  const hilo = useRef<HTMLDivElement>(null);
  // La caja: dónde va el cursor después de que una lista cambió el texto (la viñeta, el ítem siguiente).
  const caja = useRef<HTMLTextAreaElement>(null);
  const cursor = useRef<number | null>(null);
  const resalte = useRef<HTMLDivElement | null>(null);
  const borradorAbierto = elegido && centro ? centro.borradorDe(elegido.clave) : '';
  useEffect(() => {
    const el = caja.current;
    if (el && cursor.current != null) { el.setSelectionRange(cursor.current, cursor.current); cursor.current = null; }
  }, [borradorAbierto]);
  // Como un chat: abre en lo último. La hoja monta su cuerpo en un portal y lo mide después del primer pintado,
  // así que se baja en el cuadro siguiente (en el mismo efecto no hay todavía qué scrollear).
  useEffect(() => {
    const t = setTimeout(() => { const el = hilo.current?.closest('.m-sheet__cuerpo') as HTMLElement | null; if (el) el.scrollTop = el.scrollHeight; }, 80);
    return () => clearTimeout(t);
  }, [abierto, lineas.length]);

  // Una sola lista (sin «Sin asignar», 17/10/2026): arriba lo que trabaja, después lo que espera a Martín.
  // Lo que espera a Martín arriba: una pregunta, o un «Completado» sin ver (el mismo aviso: `centro.avisos`).
  const avisos = centro.avisos;
  const secciones = useMemo(() => seccionesDeChats(chats, avisos), [chats, avisos]);

  // ── Lo de WhatsApp en cada mensaje (17/10/2026, MensajeWA.tsx): el menú, su Info y Reenviar (adentro de ESTA hoja, con
  //    su «‹», como Renombrar: en el teléfono nunca hay dos hojas) ──────────────────────────────────────────────────
  // La conversación abre con los últimos mensajes (Hilo.tsx → TANDA_HILO); «Ver anteriores» o ir a uno viejo dibujan todos.
  const [cuantos, setCuantos] = useState(TANDA_HILO);
  useEffect(() => { setCuantos(TANDA_HILO); }, [abierto]);
  const verTodo = useCallback(() => setCuantos(Number.MAX_SAFE_INTEGER), []);
  const [menuWA, setMenuWA] = useState<MenuAbiertoWA | null>(null);
  const [panelWA, setPanelWA] = useState<{ tipo: 'info' | 'reenviar'; m: MensajeWA } | null>(null);
  const [reenviando, setReenviando] = useState(false);
  // Lo de AHORA para los callbacks estables: el hilo está memorizado (Hilo.tsx) y una función nueva en cada tecla lo
  // volvería a dibujar entero.
  const ultimos = useRef({ centro, elegido });
  useLayoutEffect(() => { ultimos.current = { centro, elegido }; });
  const enfocarCaja = () => window.setTimeout(() => { const el = caja.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0);
  const accionesWA = useMemo<AccionesWA>(() => ({
    abrirMenu: (m, x, y, tactil) => setMenuWA({ m, x, y, tactil }),
    responder: (m) => {
      const { centro: k, elegido: c } = ultimos.current;
      if (!c) return;
      k.citar(c.clave, { de: m.de, texto: m.texto, id: m.id });
      window.setTimeout(() => caja.current?.focus(), 0);
    },
    reaccionar: (id, emoji) => { const { centro: k, elegido: c } = ultimos.current; if (c) void k.marcar(c, { tipo: 'reaccion', id, emoji }); },
    verTodo,
  }), [verTodo]);
  /** Responder sobre un «Ya está» (la C): la caja arranca con «Sobre «…»: ». */
  const feedback = useCallback((titulo: string) => {
    const { centro: k, elegido: c } = ultimos.current;
    if (!c) return;
    const t = k.borradorDe(c.clave);
    const prefijo = `Sobre «${titulo}»: `;
    k.ponerBorrador(c.clave, t.startsWith(prefijo) ? t : prefijo + t);
    enfocarCaja();
  }, []);
  const responderPregunta = useCallback<Responder>((p, e, o) => {
    const { centro: k, elegido: c } = ultimos.current;
    return c ? k.contestarPregunta(c, p, e, o) : Promise.resolve(null);
  }, []);
  const aspectoAbierto = elegido ? elegidoPara(munecos, elegido.titulo) : null;
  const animoAbierto = elegido ? animoDe(elegido, esperaDe(elegido, esperas)) : 'despierto';
  const datoAbierto = elegido ? trabajaSinEscribir(elegido, lineas) ?? metaDe(elegido) : '';
  const quien = useMemo(() => ({ titulo: elegido?.titulo ?? '', aspecto: aspectoAbierto, animo: animoAbierto, dato: datoAbierto }), [elegido?.titulo, aspectoAbierto, animoAbierto, datoAbierto]);
  const vivo = useMemo(() => (elegido ? { chat: elegido, carteros } : undefined), [elegido, carteros]);

  if (!chats.length) return parte === 'hoja' ? null : <VacioM frase="Conecta un Runner desde la computadora para ver tus chats aquí." />;

  // La sesión a la que va: la de la cuenta elegida (o la automática) si está el motor; si no, la del chat.
  const destino = elegido ? (centro ? centro.destinoDeChat(elegido) : elegido) : null;
  const envio = destino ? comoSale(destino, carteros, firma.clave === undefined ? undefined : firma.clave?.id ?? null, ahora) : null;
  // El borrador es el del motor (useCentro.ts): el mismo que en la computadora, guardado mientras se escribe.
  const texto = borradorAbierto;
  const ponerTexto = (t: string) => { if (elegido && centro) centro.ponerBorrador(elegido.clave, t); };
  const marcas = elegido ? centro.marcasDe(elegido) : SIN_MARCAS;
  const elegirEnMenu = (m: MensajeWA, id: string) => {
    setMenuWA(null);
    if (!elegido) return;
    if (id.startsWith('reaccion:')) { const e = id.slice('reaccion:'.length); void centro.marcar(elegido, { tipo: 'reaccion', id: m.id, emoji: marcas.reacciones[m.id] === e ? null : e }); return; }
    if (id === 'responder') { accionesWA.responder(m); return; }
    if (id === 'copiar') { void copiar(m.texto).then((ok) => toast(ok ? 'Copiado' : 'No pude copiar')); return; }
    if (id === 'reenviar' || id === 'info') { setPanelWA({ tipo: id, m }); return; }
    if (id === 'destacar') { void centro.marcar(elegido, { tipo: 'destacar', id: m.id, si: !marcas.destacados.includes(m.id) }); return; }
    if (id === 'fijar') { void centro.marcar(elegido, { tipo: 'fijar', id: m.id, si: !marcas.fijados.includes(m.id) }); return; }
    if (id === 'eliminar') { void centro.marcar(elegido, { tipo: 'ocultar', id: m.id }); if (centro.citaDe(elegido.clave)?.id === m.id) centro.citar(elegido.clave, null); }
  };
  // Las fotos y los PDF de la caja (17/10/2026): el estado es del motor (useCentro.ts), el mismo de la computadora.
  const adjuntos: AdjuntosDeCaja | undefined = centro && elegido ? {
    items: centro.adjuntosDe(elegido.clave), puede: centro.puedeAdjuntar(elegido),
    onSumar: (fs) => void centro.sumarAdjuntos(elegido.clave, fs), onQuitar: (id) => centro.quitarAdjunto(elegido.clave, id), onNoPuede: centro.sinAdjuntos,
  } : undefined;

  // Mandar es el del motor (useCentro.ts → mandar): el mismo de la computadora, con la cita si responde a un mensaje.
  const mandar = () => { if (elegido) void centro.mandar(elegido); };
  const enviando = centro.enviando;
  const copiarClave = async () => {
    if (!firma.clave) return;
    toast(await copiar(firma.clave.spki) ? 'Copiado: pégalo en el Runner' : 'No pude copiar');
  };
  const crearClave = async () => { toast((await firma.crear()) ? 'Token creado' : 'No pude crear tu Token'); };

  // Renombrar EN EL LUGAR (el título de la hoja): a cada sesión del chat (las de las tres cuentas) le llega un trabajo firmado
  // que se lo pide. Es el mismo camino que la computadora (useCentro.ts → renombrarChat).
  async function renombrar() {
    if (!elegido || !renombre || renombre.mandando) return;
    setRenombre({ ...renombre, mandando: true, error: null });
    const mal = await centro.renombrarChat(elegido, renombre.texto);
    if (mal) { setRenombre({ ...renombre, mandando: false, error: mal }); return; }
    setRenombre(null);
  }
  async function guardarMuneco(aspecto: Aspecto | null) {
    if (!elegido || !eligiendo) return;
    setEligiendo({ ...eligiendo, guardando: true });
    const r = await guardarMunecoAction(elegido.titulo, aspecto);
    if (!r.ok) { setEligiendo({ ...eligiendo, guardando: false }); toast(r.error); return; }
    onMunecos(r.munecos);
    setEligiendo(null);
    toast('Criatura guardada');
  }
  const abrirMuneco = () => { if (elegido) setEligiendo({ aspecto: aspectoDe(elegido.titulo, elegidoPara(munecos, elegido.titulo)), guardando: false }); };
  const cerrarHoja = () => { setAbierto(null); setRenombre(null); setEligiendo(null); setMenuWA(null); setPanelWA(null); };
  const cita = elegido ? centro.citaDe(elegido.clave) : null;

  const estado = envio ? textoDeEnvio(envio) : null;
  const pie = elegido && envio ? (
    envio.puede ? (
      <div className="m-operaciones-caja">
        {/* Respondiendo a un mensaje: su cita arriba de la caja, con la ✕ para soltarla (WhatsApp). */}
        {cita && <CitaCaja cita={cita} onQuitar={() => centro.citar(elegido.clave, null)} verTodo={verTodo} />}
        <ListaAdjuntos a={adjuntos} />
        <div className="m-operaciones-caja__fila">
          {/* El «+» de la caja, como en la computadora: adjuntar y con qué corre (17/10/2026, la B). */}
          {centro && (
            <MasCaja a={adjuntos} apagado={enviando} resumen={null}>
              {(cerrar) => <><SelectoresDeEnvio centro={centro} chat={elegido} /><TareasVinculadas tareas={centro.tareasDe(elegido)} onIr={(u) => { cerrar(); verTodo(); window.setTimeout(() => irAlTurno(u), 80); }} /></>}
            </MasCaja>
          )}
          {/* Los emojis, en su botón junto al campo (WhatsApp; Emojis.tsx). */}
          <BotonEmojis campo={caja} valor={texto} onValor={ponerTexto} apagado={enviando} />
          <div className="co-caja__campo">
          {hayLinks(texto) && <ResalteDeLinks texto={texto} capa={(el) => { resalte.current = el; }} />}
          <textarea
            ref={caja}
            className={hayLinks(texto) ? 'co-caja__texto--resalte' : undefined}
            onScroll={(e) => { if (resalte.current) resalte.current.scrollTop = e.currentTarget.scrollTop; }}
            rows={1}
            value={texto}
            onChange={(e) => {
              const v = conVinetas(e.target.value, e.target.selectionStart);
              if (v.texto !== e.target.value) cursor.current = v.cursor;
              ponerTexto(v.texto);
            }}
            onKeyDown={(e) => {
              // En el teléfono Enter baja de renglón; adentro de una lista arma el ítem siguiente, o la corta.
              if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
              const l = enterEnLista(texto, e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
              if (l) { e.preventDefault(); cursor.current = l.cursor; ponerTexto(l.texto); }
            }}
            onPaste={(e) => alPegar(e, adjuntos)}
            placeholder={`Escribe a ${elegido.titulo}`}
            aria-label={`Escribe a ${elegido.titulo}`}
            disabled={enviando}
          />
          </div>
          {/* UN botón, como WhatsApp (Microfono.tsx → BotonMandar): el micrófono sin nada escrito y la flecha con texto. */}
          <BotonMandar valor={texto} onValor={ponerTexto} onError={(m) => toast(m)} enviando={enviando}
            hayQueMandar={!!texto.trim() || !!adjuntos?.items.length} onMandar={mandar} />
        </div>
        <LinksDeLaCaja texto={texto} />
        {/* Lo elegido en el «+» que no es «Automático» (la cuenta, el modelo) va acá abajo y no al lado del «+»: la fila es
            de la caja entera, como WhatsApp (17/10/2026). */}
        {(estado || resumenDeEnvio(centro, elegido)) && <div className="m-operaciones-caja__fila m-operaciones-caja__fila--meta"><span className="m-operaciones-caja__estado">{estado ?? resumenDeEnvio(centro, elegido)}</span></div>}
      </div>
    ) : envio.por === 'leyendo_clave' ? null : (
      <div className="m-operaciones-caja m-operaciones-caja--quieta">
        <span className="m-operaciones-caja__estado">{estado}</span>
        {envio.por === 'sin_clave' && <button type="button" className="co-chip" onClick={crearClave}>Crear Token</button>}
        {envio.por === 'clave_no_aceptada' && <button type="button" className="co-chip" onClick={copiarClave}><Icon name="copy" size={14} />Copiar Token</button>}
      </div>
    )
  ) : undefined;

  const conLista = parte !== 'hoja';
  const conHoja = parte !== 'lista';
  // UNA SOLA LISTA (Martín, 17/10/2026: «"Chats" - "Cerebro" y "Nuevo chat" no deben estar separados... Todos juntos, solo
  // que cerebro tiene la criatura de MaKo estrella... Y siempre "Nuevo Chat" arriba de todo»), como la de WhatsApp: arriba
  // «Nuevo chat», después el Cerebro (con la estrella de MaKo, lib/centro-munecos.ts → ASPECTO_MAKO) y después el resto,
  // lo que trabaja o espera primero. Sin títulos por sección.
  const filas = secciones.flatMap(({ clave: k, chats: lista }) => {
    const todas = enteras.has(k);
    // Lo que trabaja o espera a Martín nunca queda detrás de «Ver todos».
    const corte = todas ? lista : lista.filter((c, i) => i < VISIBLES || esPrioritario(c, avisos));
    const deLaSeccion = (k === SECCION_CHATS
      ? porJefe(corte).flatMap((g) => [...(g.chat ? [{ c: g.chat, sub: false }] : []), ...g.subs.map((c) => ({ c, sub: true }))])
      : corte.map((c) => ({ c, sub: false }))
    ).map(({ c, sub }) => ({ tipo: 'chat' as const, c, sub }));
    return lista.length > corte.length ? [...deLaSeccion, { tipo: 'mas' as const, k, n: lista.length }] : deLaSeccion;
  });
  return (
    <>
      {/* «Nuevo chat», arriba de todos (NuevoChat.tsx), en la MISMA lista que los chats. Sólo en el Centro: en el Second
          Brain, «Nuevo chat» es el de MaKo. */}
      {!parte && centro && nuevoChat && !elegido && (
        <HojaChatNuevo centro={centro} onCerrar={() => setNuevoChat(false)} onAbrir={(clave) => { setNuevoChat(false); abrirEstable(clave); }} />
      )}
      {conLista && (
        <SeccionM titulo={tituloChats}>
          <ListaM etiqueta={tituloChats}>
            {!parte && <FilaM leading={<CirculoNuevo size={40} />} titulo="Nuevo chat" onClick={() => setNuevoChat(true)} navegacion />}
            {filas.map((f) => (f.tipo === 'mas'
              ? <FilaM key={`mas-${f.k}`} titulo={`Ver los ${f.n} chats`} onClick={() => setEnteras((s) => new Set(s).add(f.k))} navegacion />
              : <FilaChatM key={f.c.clave} c={f.c} sub={f.sub} previa={centro.previas.get(f.c.clave) ?? null} enCurso={centro.enCursos.get(f.c.clave) ?? null}
                espera={esperaDe(f.c, esperas)} aspecto={elegidoPara(munecos, f.c.titulo)} ahora={ahora} onAbrir={abrirEstable} nuevo={centro.yaSinVer.has(f.c.clave)}
                borrador={f.c.clave === elegido?.clave ? null : centro.borradorDeLista(f.c.clave)} />))}
          </ListaM>
        </SeccionM>
      )}
      {/* ⚠️ UNA SOLA HOJA: en el teléfono nunca hay dos (SheetM → «Una hoja sobre otra REEMPLAZA»), así que el selector de la
          criatura y Reenviar/Info se abren ADENTRO de la de la conversación, con su «‹» para volver, como una navegación de
          iOS dentro de una hoja. Abrirlas en una hoja nueva cerraba la conversación, y con ella la hoja nueva.
          EL TÍTULO ES EL CHAT (17/10/2026, Martín): la criatura a la izquierda del nombre, como la foto de WhatsApp. Tocar la
          criatura la cambia; tocar el nombre lo renombra en el lugar. Sin desplegable, sin chips de cuenta ni «Tu foto de
          perfil» (eso se cambia en Tu cuenta). */}
      {conHoja && <SheetM abierto={!!elegido} onCerrar={cerrarHoja} snap="alto"
        titulo={eligiendo ? 'Su criatura' : panelWA ? (panelWA.tipo === 'info' ? 'Info del mensaje' : 'Reenviar a…') : elegido ? (
          <TituloDeChat chat={elegido} aspecto={aspectoAbierto} avisos={esperaDe(elegido, esperas)} renombre={renombre}
            onMuneco={esCriaturaDeMako(elegido.titulo) ? undefined : abrirMuneco}
            onRenombrar={elegido.sesiones.length > 0 ? () => setRenombre({ texto: elegido.titulo, error: null, mandando: false }) : undefined}
            onTexto={(texto) => setRenombre((r) => (r ? { ...r, texto, error: null } : r))}
            onGuardar={renombrar} onCancelar={() => setRenombre(null)} />
        ) : 'Chat'}
        ocupado={!!renombre?.mandando || !!eligiendo?.guardando || reenviando}
        pie={eligiendo ? (
          <PieM>
            <Button variant="primary" size="lg" full loading={eligiendo.guardando} onClick={() => guardarMuneco(eligiendo.aspecto)}>Guardar criatura</Button>
            {elegido && elegidoPara(munecos, elegido.titulo) && <Button variant="tertiary" size="lg" full disabled={eligiendo.guardando} onClick={() => guardarMuneco(null)}>Volver al de siempre</Button>}
          </PieM>
        ) : panelWA ? undefined : pie}>
        {elegido && (eligiendo || panelWA) && (
          <button type="button" className="m-operaciones-volver" disabled={!!eligiendo?.guardando || reenviando}
            onClick={() => { setEligiendo(null); setPanelWA(null); }}>
            <span aria-hidden>‹</span> {elegido.titulo}
          </button>
        )}
        {elegido && eligiendo && (
          <ElegirMuneco titulo={elegido.titulo} animo={animoDe(elegido)} aspecto={eligiendo.aspecto} onCambio={(a) => setEligiendo({ ...eligiendo, aspecto: a })} />
        )}
        {elegido && panelWA && (panelWA.tipo === 'info'
          ? <InfoMensaje m={panelWA.m} />
          : <ReenviarA chats={chats} origen={elegido.clave} enviando={reenviando} onEnviar={async (claves) => {
            setReenviando(true);
            const ok = await centro.reenviar(elegido, panelWA.m.texto, chats.filter((c) => claves.includes(c.clave)));
            setReenviando(false);
            if (ok) setPanelWA(null);
          }} />)}
        {elegido && !eligiendo && !panelWA && (
          <div className="m-operaciones-hilo" ref={hilo}>
            {/* Los fijados, pegados arriba de la conversación (WhatsApp): tocar va al mensaje. La criatura y el nombre ya no van
                acá: son el título de la hoja. */}
            <div className="m-operaciones-cabeza">
              <div className="m-operaciones-fijados"><BarraFijados marcas={marcas} lineas={lineas} titulo={elegido.titulo} onSoltar={(id) => void centro.marcar(elegido, { tipo: 'fijar', id, si: false })} verTodo={verTodo} /></div>
            </div>
            <ContextoWA.Provider value={accionesWA}>
              <Hilo lineas={lineas} pushes={pushes ?? SIN_PUSHES} ahora={ahora} vacio="Escríbele abajo para empezar." quien={quien}
                vivo={vivo} onResponder={responderPregunta} tareas={centro.tareasDe(elegido)} onFeedback={feedback} marcas={marcas} pasos={centro.pasosDe(elegido)}
                mostrar={cuantos} onVerAnteriores={verTodo} />
            </ContextoWA.Provider>
            {/* Lo que espera de Martín, al final de la conversación y pegado a la caja: AskUserQuestion de Claude Code. */}
            {preguntas.length > 0 && <Pregunta key={elegido.clave} preguntas={preguntas} responder={responder} />}
          </div>
        )}
      </SheetM>}
      {conHoja && <MenuMensajeWA abierto={menuWA} marcas={marcas} onCerrar={() => setMenuWA(null)} onElegir={elegirEnMenu} />}
    </>
  );
}
