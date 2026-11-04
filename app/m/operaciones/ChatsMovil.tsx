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
import { preguntasDeLaApp, preguntasParaElBloque } from '@/lib/centro-chats';
import {
  TEXTO_SEGUNDO_RENGLON, avisosDe, comoSale, esPrioritario, seguirChat, esperaDe, historialDelChat, partesDelNombre, porJefe, seccionesDeChats, segundoRenglon, trabajaSinEscribir,
  textoDeEnvio, type CarteroP, type ChatCentro, type LineaChat, type TrabajoP,
} from '@/lib/centro-chats';
import type { PedidoP, PushP } from '@/lib/progreso-reglas';
import type { AccionResponder, Decision } from '@/app/admin/runway/decisiones';
import { preguntasDelChat, respuestasDelChat } from '@/lib/centro-preguntas';
import { BloqueDePreguntas } from '@/app/admin/operaciones/PreguntasDelChat';
import { BloqueCompletado } from '@/app/admin/operaciones/BloqueCompletado';
import { CirculoNuevo } from '@/app/admin/operaciones/NuevoChat';
import { useChatNuevo } from '@/app/admin/operaciones/ChatNuevo';
import { CriaturaChatNuevo, CuerpoChatNuevo, TituloChatNuevo } from '@/app/admin/operaciones/ChatNuevoPiezas';
import { CajaChatNuevo } from '@/app/admin/operaciones/CajaChatNuevo';
import { Hilo, TANDA_HILO } from '@/app/admin/operaciones/Hilo';
import { Muneco, animoDe } from '@/app/admin/operaciones/Muneco';
import { TareasVinculadas, irAlTurno } from '@/app/admin/operaciones/Avance';
import { ElegirMuneco } from '@/app/admin/operaciones/ElegirMuneco';
import { guardarMunecoAction } from '@/app/admin/operaciones/acciones';
import { aspectoDe, aspectoDeReferente, elegidoPara, esCriaturaDeMako, type Aspecto, type MunecosElegidos } from '@/lib/centro-munecos';
import { asesorPorId, type IdAsesor } from '@/lib/asesores/catalogo';
import { GaleriaDeGurus } from '@/app/second-brain/GaleriaDeGurus';
import { useGurusConCharla } from '@/app/second-brain/useCoaches';
import { HojaDelGuru } from '@/app/m/second-brain/HojaDelGuru';
import { HojaDelGrupo } from '@/app/m/second-brain/HojaDelGrupo';
import { FilasDelGrupoM } from '@/app/m/second-brain/FilasDelGrupoM';
import { useGrupos } from '@/app/_chat/grupo/useGrupos';

const ESTADO: Record<ChatCentro['estado'], string> = { trabajando: 'Trabajando', abierto: 'Abierto', cerrado: 'Cerrado', sin_dato: '' };
const metaDe = (c: ChatCentro) => ESTADO[c.estado];
import { copiar, type useFirma } from '@/app/admin/operaciones/mandar';
import { NO_PUDE_COPIAR } from '@/lib/copiar-texto';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { CajaChat } from '@/app/_chat/CajaChat';
import type { Centro } from '@/app/admin/operaciones/useCentro';
import { SelectoresDeEnvio, resumenDeEnvio } from '@/app/admin/operaciones/PiezasCentro';
import { BarraFijados, CitaCaja, ContextoWA, InfoMensaje, MenuMensajeWA, ReenviarA, type AccionesWA, type MenuAbiertoWA, type MensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { alternarTranscripcion } from '@/app/admin/operaciones/voces-enviadas';
import type { Responder } from '@/app/admin/operaciones/PreguntaChat';
import { SIN_MARCAS, idDeLinea } from '@/lib/centro-mensajes';
import type { TurnoChat } from '@/lib/operaciones-reglas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

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
        {renombre?.error && <span className="m-operaciones-titulo__error" role="alert">{renombre.error}<ReportarASoporte /></span>}
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
function HojaChatNuevo({ centro, onCerrar, onAbrir, onGuru }: { centro: Centro; onCerrar: () => void; onAbrir: (clave: string) => void; onGuru: (id: IdAsesor) => void }) {
  const chatNuevo = useChatNuevo(centro, onAbrir);
  return (
    <SheetM abierto onCerrar={onCerrar} snap="alto"
      titulo={<span className="m-operaciones-titulo"><span className="m-operaciones-titulo__muneco"><CriaturaChatNuevo n={chatNuevo} /></span><span className="m-operaciones-titulo__texto"><TituloChatNuevo n={chatNuevo} /></span></span>}
      pie={<CajaChatNuevo n={chatNuevo} movil />}>
      <div className="m-operaciones-hilo"><CuerpoChatNuevo n={chatNuevo} alPie={<GaleriaDeGurus onElegir={onGuru} />} /></div>
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
  c: ChatCentro; sub: boolean; espera: number; aspecto: Aspecto | null; ahora: number;
  onAbrir: (clave: string) => void;
  /** Su «Completado» espera el ✓ (useCentro.ts → yaSinVer): avisa IGUAL que «Espera tu respuesta». */
  nuevo: boolean;
};
const FilaChatM = memo(function FilaChatM({ c, sub, espera, aspecto, ahora, onAbrir, nuevo }: PropsFilaChatM) {
  const renglon = segundoRenglon(c, espera, nuevo);
  // Dormido si no trabaja y no tiene nada para Martín (un aviso o un «Completado» sin ver): despierto sólo con uno de los dos.
  const animo = animoDe(c, avisosDe(espera, nuevo));
  return (
    <FilaM
      // Un sub-chat va corrido a la derecha, con su muñeco más chico y sólo lo que va después de «›».
      leading={<span className={sub ? 'm-operaciones-sub' : undefined}><Muneco titulo={c.titulo} aspecto={aspecto} animo={animo} size={sub ? 32 : 40} espera={avisosDe(espera, nuevo)} /></span>}
      titulo={<span className={`m-operaciones-texto1${animo === 'dormido' ? ' m-operaciones-texto1--dormido' : ''}`}>{sub ? `↳ ${partesDelNombre(c.titulo).sub}` : c.titulo}{c.nube && <> <span className="co-chip-cuenta">Nube</span></>}</span>}
      // «Trabajando…», «Espera tu respuesta» o nada (20/10/2026): lo decide `segundoRenglon`, el mismo de la computadora.
      segunda={renglon ? <span className={renglon === 'espera' ? 'm-operaciones-espera' : 'm-operaciones-vivo'}>{TEXTO_SEGUNDO_RENGLON[renglon]}</span> : undefined}
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
    && a.sub === b.sub && a.espera === b.espera && a.aspecto === b.aspecto && a.onAbrir === b.onAbrir && a.nuevo === b.nuevo
    && edad(a.c.actividad, a.ahora) === edad(b.c.actividad, b.ahora);
}

export function ChatsM({ chats, carteros, pedidos, trabajos, pushes, ahora, esperas, firma, munecos, onMunecos, decisiones, responder, parte, tituloChats = 'Chats', abierto: abiertoFuera, onAbierto, centro, grupoInicial = null }: {
  /** El motor del Centro (useCentro.ts): con él, la caja elige la cuenta, el modelo y el esfuerzo (17/10/2026), igual que
   *  la de la computadora (PiezasCentro.tsx → SelectoresDeEnvio), y la lista y la conversación salen de SUS mapas
   *  memorizados (`previas`, `enCursos`, `lineasDe`): calcularlas acá en cada toque era lo que hacía lento el «atrás». */
  centro: Centro;
  /** Sólo las filas o sólo la hoja de la conversación (ver arriba); sin esto, las dos. */
  parte?: 'lista' | 'hoja';
  /** `?grupo=`: el grupo que se abre al entrar (el push de un aviso). */
  grupoInicial?: number | null;
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
  // El chat con un gurú: su hoja, con su motor (HojaDelGuru.tsx). Una sola a la vez: sale de «Nuevo chat» y de su fila.
  const [guru, setGuru] = useState<IdAsesor | null>(null);
  const delGuru = asesorPorId(guru);
  const gurusConCharla = useGurusConCharla(guru, !parte);
  // El grupo de la plataforma (3/11/2026). `!parte`: en dos partes lo dibuja la lista del cliente, y esto no se pide.
  const grupos = useGrupos(!parte);
  const [grupo, setGrupo] = useState<number | null>(grupoInicial);
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
  const bloque = preguntasParaElBloque(lineas);
  const deLaApp = preguntasDeLaApp(lineas);
  const hilo = useRef<HTMLDivElement>(null);
  // La caja: el campo, para enfocarlo desde afuera. Lo que crece y el scroll que acompaña son de la caja única
  // (app/_chat/CajaChat.tsx): acá crece el CSS (`field-sizing`) y la que sigue abajo es la hoja.
  const caja = useRef<HTMLTextAreaElement>(null);
  const seguirHoja = useCallback(() => hilo.current?.closest('.m-sheet__cuerpo') as HTMLElement | null, []);
  // Como un chat: abre en lo último. La hoja monta su cuerpo en un portal y lo mide después del primer pintado,
  // así que se baja en el cuadro siguiente (en el mismo efecto no hay todavía qué scrollear).
  useEffect(() => {
    const t = setTimeout(() => { const el = hilo.current?.closest('.m-sheet__cuerpo') as HTMLElement | null; if (el) el.scrollTop = el.scrollHeight; }, 80);
    return () => clearTimeout(t);
  }, [abierto, lineas.length]);

  // Una sola lista (sin «Sin asignar», 17/10/2026): arriba lo que espera su respuesta (24/10/2026), después lo que trabaja,
  // después un «Completado» sin ver (`centro.avisos` los cuenta juntos; `esperanRespuesta`, sólo las preguntas, las mismas del
  // renglón de cada fila: lib/centro-chats.ts → prioridadEnLista).
  const avisos = centro.avisos;
  const esperanRespuesta = useMemo(() => (c: ChatCentro) => esperaDe(c, esperas), [esperas]);
  const secciones = useMemo(() => seccionesDeChats(chats, avisos, esperanRespuesta), [chats, avisos, esperanRespuesta]);

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
  /** El ✓ de un «Completado» (18/10/2026): guardado en MaKo, vale en la computadora. */
  const yaVistoCb = useCallback((instante: number) => {
    const { centro: k, elegido: c } = ultimos.current;
    if (c) void k.marcarYaVisto(c.clave, instante);
  }, []);
  /** Responder sobre un «Ya está» (26/10/2026, Martín: «que no escriba en el chat, que se mencione arriba en el chat, como cuando
   *  le doy a responder cualquier mensaje»): la cita «↩» de ese mensaje arriba de la caja, como en la computadora. */
  const feedback = useCallback((t: TurnoChat) => {
    const { centro: k, elegido: c } = ultimos.current;
    if (!c) return;
    k.citar(c.clave, { de: c.titulo, texto: t.texto, id: idDeLinea({ tipo: 'turno', instante: Date.parse(t.at), turno: t }) });
    enfocarCaja();
  }, []);
  const responderPregunta = useCallback<Responder>((p, e, o) => {
    const { centro: k, elegido: c } = ultimos.current;
    return c ? k.contestarPregunta(c, p, e, o) : Promise.resolve(null);
  }, []);
  const aspectoAbierto = elegido ? elegidoPara(munecos, elegido.titulo) : null;
  // La criatura de la cabecera, con el MISMO número que su fila (`centro.avisos`, con el «Completado» sin ✓): la de la fila estaba
  // despierta y ésta dormía (22/10/2026).
  const animoAbierto = elegido ? animoDe(elegido, centro.avisos(elegido)) : 'despierto';
  const datoAbierto = elegido ? trabajaSinEscribir(elegido, lineas) ?? metaDe(elegido) : '';
  const quien = useMemo(() => ({ titulo: elegido?.titulo ?? '', aspecto: aspectoAbierto, animo: animoAbierto, dato: datoAbierto }), [elegido?.titulo, aspectoAbierto, animoAbierto, datoAbierto]);
  // `trabado`: con una pregunta de la app de Claude abierta, lo que se le escribe espera, y la línea del envío lo dice ya.
  const trabado = deLaApp.length > 0;
  const vivo = useMemo(() => (elegido ? { chat: elegido, carteros, trabado } : undefined), [elegido, carteros, trabado]);

  // El grupo (3/11/2026): sólo sin `parte`. En dos partes, esta lista va debajo de la del cliente (SecondBrainCentroM.tsx), que ya lo dibuja: saldría doble.
  const hojaDelGrupo = !parte && grupo != null ? (
    <HojaDelGrupo key={grupo} ws={grupo} grupo={grupos.grupos?.find((f) => f.ws === grupo) ?? null} onCerrar={() => { setGrupo(null); grupos.recargar(); }} onLeido={grupos.anotarLeido}
      onCambio={grupos.recargar} onSalio={() => { setGrupo(null); grupos.recargar(); }} />
  ) : null;
  if (!chats.length) {
    if (parte === 'hoja') return null;
    // Sin chats de Claude Code el grupo sigue: no depende de un Runner.
    return (
      <>
        {hojaDelGrupo}
        {!parte && <ListaM etiqueta="Grupo"><FilasDelGrupoM g={grupos} abierto={grupo} onAbrir={setGrupo} /></ListaM>}
        <VacioM frase="Conecta un Runner desde la computadora para ver tus chats aquí." />
      </>
    );
  }

  // La sesión a la que va: la de la cuenta elegida (o la automática) si está el motor; si no, la del chat.
  const destino = elegido ? (centro ? centro.destinoDeChat(elegido) : elegido) : null;
  const envio = destino ? comoSale(destino, carteros, firma.clave === undefined ? undefined : firma.clave?.id ?? null, ahora) : null;
  // El borrador es el del motor (useCentro.ts): el mismo que en la computadora, guardado mientras se escribe.
  const texto = elegido && centro ? centro.borradorDe(elegido.clave) : '';
  const ponerTexto = (t: string) => { if (elegido && centro) centro.ponerBorrador(elegido.clave, t); };
  const marcas = elegido ? centro.marcasDe(elegido) : SIN_MARCAS;
  const elegirEnMenu = (m: MensajeWA, id: string) => {
    setMenuWA(null);
    if (!elegido) return;
    if (id.startsWith('reaccion:')) { const e = id.slice('reaccion:'.length); void centro.marcar(elegido, { tipo: 'reaccion', id: m.id, emoji: marcas.reacciones[m.id] === e ? null : e }); return; }
    if (id === 'transcripcion') { if (m.trabajo) alternarTranscripcion(m.trabajo.id); return; }
    if (id === 'responder') { accionesWA.responder(m); return; }
    if (id === 'copiar') { void copiar(m.texto).then((ok) => toast(ok ? 'Copiado' : NO_PUDE_COPIAR)); return; }
    if (id === 'reenviar' || id === 'info') { setPanelWA({ tipo: id, m }); return; }
    if (id === 'destacar') { void centro.marcar(elegido, { tipo: 'destacar', id: m.id, si: !marcas.destacados.includes(m.id) }); return; }
    if (id === 'fijar') { void centro.marcar(elegido, { tipo: 'fijar', id: m.id, si: !marcas.fijados.includes(m.id) }); return; }
    if (id === 'eliminar') { void centro.marcar(elegido, { tipo: 'ocultar', id: m.id }); if (centro.citaDe(elegido.clave)?.id === m.id) centro.citar(elegido.clave, null); }
  };
  // Las fotos y los PDF de la caja (17/10/2026): el estado es del motor (useCentro.ts), el mismo de la computadora.
  const adjuntos: AdjuntosDeCaja | undefined = centro && elegido ? {
    items: centro.adjuntosDe(elegido.clave), puede: centro.puedeAdjuntar(elegido),
    onSumar: (fs) => void centro.sumarAdjuntos(elegido.clave, fs), onQuitar: (id) => centro.quitarAdjunto(elegido.clave, id), onNoPuede: centro.sinAdjuntos, onSinImagen: centro.sinImagen,
  } : undefined;

  // Mandar es el del motor (useCentro.ts → mandar): el mismo de la computadora, con la cita si responde a un mensaje.
  const mandar = () => { if (elegido) centro.mandar(elegido); };
  const enviando = centro.enviando;
  const copiarClave = async () => {
    if (!firma.clave) return;
    toast(await copiar(firma.clave.spki) ? 'Copiado: pégalo en el Runner' : NO_PUDE_COPIAR);
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
        {/* La caja ÚNICA (app/_chat/CajaChat.tsx, 20/10/2026), la misma de la computadora: en el teléfono Enter baja de
            renglón y se manda con el botón. Arriba, la cita del mensaje que se responde; en el «+», con qué corre. */}
        <CajaChat texto={texto} onTexto={ponerTexto} onMandar={mandar} onGrabada={(g) => centro?.mandarNota(elegido, g.audio, g.segundos)} enviando={enviando} placeholder={`Escribe a ${elegido.titulo}`}
          adjuntos={adjuntos} campo={caja} seguir={seguirHoja} altoMax={null} onErrorMic={(m) => toast(m)} fila="m-operaciones-caja__fila" conversacion={elegido.clave}
          arriba={cita ? <CitaCaja cita={cita} onQuitar={() => centro.citar(elegido.clave, null)} verTodo={verTodo} /> : null}
          mas={centro ? (cerrar) => <><SelectoresDeEnvio centro={centro} chat={elegido} /><TareasVinculadas tareas={centro.tareasDe(elegido)} onIr={(u) => { cerrar(); verTodo(); window.setTimeout(() => irAlTurno(u), 80); }} /></> : undefined} />
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
    // Cada sub-chat con su jefe, en las dos secciones (los del Cerebro, debajo de él: lib/centro-chats.ts → seccionesDeChats). Uno
    // cuyo jefe no está en la lista va con su nombre entero, sin «↳»: corrido, parecía colgado del de arriba (23/10/2026).
    const deLaSeccion = porJefe(corte)
      .flatMap((g) => (g.chat ? [{ c: g.chat, sub: false }, ...g.subs.map((c) => ({ c, sub: true }))] : g.subs.map((c) => ({ c, sub: false }))))
      .map(({ c, sub }) => ({ tipo: 'chat' as const, c, sub }));
    return lista.length > corte.length ? [...deLaSeccion, { tipo: 'mas' as const, k, n: lista.length }] : deLaSeccion;
  });
  return (
    <>
      {/* «Nuevo chat», arriba de todos (NuevoChat.tsx), en la MISMA lista que los chats. Sólo en el Centro: en el Second
          Brain, «Nuevo chat» es el de MaKo. */}
      {!parte && centro && nuevoChat && !elegido && (
        <HojaChatNuevo centro={centro} onCerrar={() => setNuevoChat(false)} onAbrir={(clave) => { setNuevoChat(false); abrirEstable(clave); }}
          onGuru={(id) => { setNuevoChat(false); setGuru(id); }} />
      )}
      {delGuru && <HojaDelGuru key={delGuru.id} referente={delGuru} onCerrar={() => setGuru(null)} />}
      {hojaDelGrupo}
      {conLista && (
        <SeccionM titulo={tituloChats}>
          <ListaM etiqueta={tituloChats}>
            {!parte && <FilaM leading={<CirculoNuevo size={40} />} titulo="Nuevo chat" onClick={() => setNuevoChat(true)} navegacion />}
            {/* Fijado, el primero de los chats (Martín: «que esté posicionado arriba»). */}
            {!parte && <FilasDelGrupoM g={grupos} abierto={grupo} onAbrir={setGrupo} />}
            {/* El historial de los gurús: esta lista es la de Claude Code, y sus chats no salen en ella. */}
            {!parte && gurusConCharla.map(({ id, at }) => {
              const g = asesorPorId(id);
              return g && (
                <FilaM key={id} chevron={false} leading={<Muneco titulo={g.nombre} aspecto={aspectoDeReferente(id)} animo="despierto" size={40} />}
                  titulo={<span className="m-operaciones-texto1">{g.nombre}</span>}
                  riel={<span className="m-operaciones-riel"><span className="m-operaciones-hace">{edad(at ? Date.parse(at) : null, ahora)}</span></span>}
                  onClick={() => setGuru(id)} />
              );
            })}
            {filas.map((f) => (f.tipo === 'mas'
              ? <FilaM key={`mas-${f.k}`} titulo={`Ver los ${f.n} chats`} onClick={() => setEnteras((s) => new Set(s).add(f.k))} navegacion />
              : <FilaChatM key={f.c.clave} c={f.c} sub={f.sub}
                espera={esperaDe(f.c, esperas)} aspecto={elegidoPara(munecos, f.c.titulo)} ahora={ahora} onAbrir={abrirEstable} nuevo={centro.yaSinVer.has(f.c.clave)} />))}
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
          <TituloDeChat chat={elegido} aspecto={aspectoAbierto} avisos={centro.avisos(elegido)} renombre={renombre}
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
                yaVisto={centro.yaVistos?.[elegido.clave] ?? null} onYaVisto={yaVistoCb}
                mostrar={cuantos} onVerAnteriores={verTodo} />
            </ContextoWA.Provider>
            {/* TODO lo que espera a Martín, pegado a la caja y en UN bloque, como en la computadora (PreguntasDelChat.tsx →
                BloqueDePreguntas): la Ticketera, lo que pregunta el chat y lo de la app de Claude. Y sus «Completado» sin ✓, en
                el mismo marco y de a uno (BloqueCompletado.tsx, 25/10/2026): con una pregunta, en su tira. */}
            <BloqueCompletado key={`ya-${elegido.clave}`} chat={elegido} lineas={lineas} yaVisto={centro.yaVistos?.[elegido.clave] ?? null} onYaVisto={yaVistoCb}
              hayPreguntas={bloque.length + deLaApp.length + preguntas.length > 0} onResponderSobre={feedback} />
            <BloqueDePreguntas key={`b-${elegido.clave}`} chat={elegido.clave} ticketera={preguntas} responderTicketera={responder}
              delChat={bloque} onResponder={responderPregunta} avisoCerrado={(p) => centro.avisoDePregunta(elegido, p)} deLaApp={deLaApp} />
          </div>
        )}
      </SheetM>}
      {conHoja && <MenuMensajeWA abierto={menuWA} marcas={marcas} onCerrar={() => setMenuWA(null)} onElegir={elegirEnMenu} />}
    </>
  );
}
