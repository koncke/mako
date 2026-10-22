'use client';

// =============================================================================
// El Second Brain como chat: la pieza única, primera tanda (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md. La cara es la del Centro de Operaciones (app/admin/operaciones/), que ya
// cita sus fuentes: la barra con un muñeco por chat (Grok Bot), la barra y la caja de Claude web, y los sub-chats
// debajo de su jefe como los hilos de un canal de Discord. Copiado de ahí, con las mismas clases de centro.css.
//
//   · A la izquierda: «Nuevo chat», el Cerebro y, en UNA lista, todos los demás chats (lib/chat-mako-reglas.ts →
//     listaDelCliente). Son las conversaciones de la persona con MaKo (las MISMAS del teléfono, /m/mako), las de Offer
//     del negocio y las de antes («Pregúntale a MaKo»).
//   · En el centro: la conversación con MaKo (el turno del teléfono, lib/mako-turno-app.ts, por /api/mako/chat), con
//     la tarjeta que se confirma y la caja con el micrófono de la casa. Sin streaming: «Trabajando…».
//   · «Mapa» (sólo el admin): el grafo del negocio en el panel, como la Ticketera en el Centro. Lo arma el SERVIDOR
//     cuando la URL lo pide (`?panel=mapa`): a quien no le toca no le llega.
//
// ⚠️ LO QUE NO SE REINTENTA (el mismo criterio del teléfono y del CRM, app/m/mako/chat-ui.ts): un turno que pudo haber
//    corrido (red caída, corte, 5xx) ya pudo dejar una acción pendiente: se dice «no sé si llegó» y se ofrece recargar.
// ⚠️ UN CHAT NUEVO NO SE CREA AL APRETAR «Nuevo chat»: se crea con el primer mensaje (sin conversaciones vacías).
// ⚠️ LA URL dice qué chat está abierto (`?chat=<id>`, `?offer=<id>`, `?antes=<id>`), reescrita con
//    `replaceState(null, …)`: el `__NA` de Next en el estado hace que el router la pise (docs/hallazgos-operaciones.md).
//
// «CLAUDE CODE» (tanda 5, 17/10/2026; Martín: «quiero dejar de mandar prompts por aquí, quiero mandar prompts por MaKo en
// el Second Brain»). Para quien `puedeOperar` (lo decide el servidor: `centro` llega null para todos los demás), la
// barra suma la sección «Claude Code» con el Cerebro y cada jefe del Centro de Operaciones, y elegir uno abre SU
// conversación con la caja firmada. Son las MISMAS piezas y el MISMO motor que /admin/operaciones
// (app/admin/operaciones/useCentro.ts y PiezasCentro.tsx): el Centro es el adaptador, no una copia. La URL dice cuál con
// `?centro=<clave>`, porque `?chat=` es el número de una conversación con MaKo.
//
// «OPS CENTER» (17/10/2026, Martín mirando producción: «El Second Brain y el Centro deberían ser exactamente lo mismo en
// SuperAdmin», «Me gustaría que quede el nombre de "Ops Center"» y «que "Second brain" sea la sub tab debajo de la
// Ticketera»). Para quien `puedeOperar`, ESTA es la pantalla de /second-brain y de /admin/operaciones (una sola puerta:
// app/second-brain/pagina.tsx). Arriba de la barra van «Ticketera» y, debajo, «Second Brain»: tocarlo cambia la lista a
// los chats con MaKo (y el Mapa); si no, la lista son los chats de Claude Code. Abajo, el Uso y los Runners.
//
// EL OPS CENTER DEL CLIENTE ES EL DEL SUPER ADMIN (21/10/2026, Martín: «el ops center de los clientes se ve muy mal comparado
// al de SuperAdmin... eso debe funcionar»). Las MISMAS piezas, con un adaptador de datos para los chats del cliente:
//   · la fila de la barra es `FilaDeChat` (PiezasCentro.tsx), la del super admin; la lista es UNA, sin «Offer» ni «Antes»
//     plegables («Jamás debes categorizar en desplegables los chats de la sidebar»), y el jefe se llama «Cerebro», con la
//     estrella de MaKo («al igual que SuperAdmin, debe ser "Cerebro" y tener la criatura de MaKo»);
//   · el panel es `PanelDeChat` (PanelChat.tsx), el de Conversacion.tsx: la misma cabecera, el hilo en su columna, arrastrar
//     y soltar, y la caja ÚNICA (app/_chat/CajaChat.tsx). Las filas del hilo son las de Hilo.tsx (`FilaMia`, con la foto);
//   · un chat de Offer o uno de antes se SIGUE ahí mismo, con su motor: lo de Offer va a /api/offer (motor-offer.ts), lo de
//     antes al turno de MaKo sobre esa sesión (`antes` en /api/mako/chat). Nunca «Esta conversación sigue en Offer».

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter, useWs } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { conWs } from '@/lib/ws-tab';
import { useCentro, type Centro, type DatosCentro } from '@/app/admin/operaciones/useCentro';
import { claveParaUrl, seguirChat } from '@/lib/centro-chats';
import { ChatDelCentro, FilaDeChat, ListaCentro, MenusCentro, NuevoChatCentro, PieCentro, RenglonDeFila, buscarChats } from '@/app/admin/operaciones/PiezasCentro';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { ChatNuevoCentro } from '@/app/admin/operaciones/ChatNuevo';
import { TicketeraCentro } from '@/app/admin/operaciones/TicketeraCentro';
import { esVistaTicketera, type VistaDeTicketera } from '@/app/tickets/decisiones/reglas';
import { cerebroDelCentro } from '@/app/tickets/bandeja/cerebro';
import { useTicketsPorDecidir } from '@/app/tickets/bandeja/usarContador';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { CajaChat } from '@/app/_chat/CajaChat';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { HiloMako } from '@/app/_chat/HiloMako';
import type { ItemPropuesta } from '@/app/_chat/TarjetaAccion';
import {
  archivosDeRespuesta, idLocal, itemsDeOffer, itemsDeRespuesta, itemsDeSesion, conTarjeta, leerRespuesta, respuestaDeOffer, textoTapadoDeRespuesta,
  problemaDeSeleccion, tipoDeElegido, trasTarjeta, trasTrabajo, type EstadoPropuesta, type ItemHilo, type Leido,
} from '@/app/m/mako/chat-ui';
import { achicarImagen } from '@/app/m/mako/subir';
import { IconoChat } from '@/app/m/mako/iconos';
import { VolverDelGrafo } from './volver';
import { abrirOffer, armarOffer, turnoOffer } from './motor-offer';
import { esOpcionArmar } from '@/app/offer/ayudas';
import { caracteres, conPegados, esPegadoLargo, nombrePegado } from '@/lib/chat-pegado';
import { ACCEPT_ADJUNTOS_CHAT, ERROR_ADJUNTO } from '@/lib/mako-adjuntos';
import {
  ARRANQUES_SECOND_BRAIN, SECCION_OFFER, SIN_TITULO, SUBS_VISIBLES, colgarIrA, criaturaDeOffer, edadCorta, esFilaDe,
  linksDePedidos, listaDelCliente, type ElegidoChat, type IrA,
} from '@/lib/chat-mako-reglas';
import type { ChatDeAntes, ChatDeOffer } from '@/lib/chat-mako-indice';
import type { MensajeChat, PropuestaPantalla, ResultadoTarjeta, RespuestaTurno, SesionChat, TarjetaPendiente } from '@/lib/mako-turno-app-reglas';
import type { OfferSesionVista } from '@/lib/offer-marco';
import { Recorrido, useRecorrido } from '@/app/_ui/Recorrido';
import { RECORRIDO_INICIO } from '@/lib/onboarding-arranque';
import { PASOS_INICIO } from './recorrido-inicio';
import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';

const RUTA = '/api/mako/chat';
/** El maxDuration de la ruta es 420 s: el corte del navegador va 5 s después (tests/mako-doer-plazo.test.ts). */
const TOPE_MS = 425_000;
/** Lo que tarda en abrir una lista o un hilo antes de decir que no se pudo. */
const TOPE_LECTURA_MS = 30_000;
/** «Entender el pedido» (tanda 10): la ruta compartida de los chats, con la IA a 7,5 s (app/api/mako/pedidos). */
const RUTA_PEDIDOS = '/api/mako/pedidos';
const TOPE_PEDIDOS_MS = 15_000;
/** El tope de texto de esa ruta: lo más largo no se le pregunta (contestaría 400). */
const MAX_TEXTO_PEDIDOS = 4_000;
/** Mientras Offer arma la oferta por detrás, cada cuánto se relee la conversación (el de la tab, app/offer/OfferApp.tsx). */
const RELEER_ARMADO_MS = 5_000;
/** Cuántas filas se ven debajo del Cerebro antes de «Mostrar N más». */
const FILAS_VISIBLES = SUBS_VISIBLES;

type Abierta = { sesion: SesionChat; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[]; pantallas?: PropuestaPantalla[] };
type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;
type Elegido = ElegidoChat;
/** Un archivo elegido en la caja, antes de mandar. `url` es su vista previa (`blob:`): la usa también la burbuja
 *  mientras sale, y se suelta cuando vuelve guardado o cuando se quita. */
type ArchivoElegido = { id: string; file: File; tipo: 'image' | 'document'; url: string };

async function pedir<T>(url: string, init: RequestInit = {}): Promise<Leido<T>> {
  let status = 0; let cuerpo = '';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TOPE_LECTURA_MS), ...init });
    status = r.status; cuerpo = await r.text();
  } catch { /* red caída o corte por tiempo: status 0 */ }
  return leerRespuesta<T>(status, cuerpo);
}
const postJson = <T,>(cuerpo: Record<string, unknown>) =>
  pedir<T>(RUTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
/** Un turno o una tarjeta: lo que puede tardar lo que dura la ruta (confirmar replicar_landing corre ~275 s). */
const postLargo = <T,>(cuerpo: Record<string, unknown>) =>
  pedir<T>(RUTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(TOPE_MS) });
/** Un turno con archivos: multipart, como el teléfono (el `?ws=` lo pone el `fetch` de la casa, WsFetch). `antes`: un chat
 *  de antes que se sigue (la ruta corre el turno sobre ESA sesión). */
const postArchivos = <T,>(sessionId: number, mensaje: string, archivos: readonly ArchivoElegido[], antes: boolean) => {
  const fd = new FormData();
  fd.append('sessionId', String(sessionId));
  fd.append('mensaje', mensaje);
  if (antes) fd.append('antes', '1');
  for (const a of archivos) fd.append('adjuntos', a.file, a.file.name);
  return pedir<T>(RUTA, { method: 'POST', body: fd, signal: AbortSignal.timeout(TOPE_MS) });
};

/**
 * Lo que la persona pidió que se hace en OTRA pantalla: el link para ir (tanda 10, docs/diseno-mako-pedidos.md). Se pide
 * EN PARALELO al turno, y si falla o tarda no hay links y nada más: es un agregado, nunca frena la respuesta.
 * ⚠️ El mensaje NO se parte (lib/chat-mako-reglas.ts → linksDePedidos): MaKo lo contesta entero y esto suma el link.
 */
async function linksDelPedido(texto: string): Promise<IrA[]> {
  if (!texto.trim() || texto.length > MAX_TEXTO_PEDIDOS) return [];
  const l = await pedir<unknown>(RUTA_PEDIDOS, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, tab: 'mako' }),
    signal: AbortSignal.timeout(TOPE_PEDIDOS_MS),
  });
  return l.ok ? linksDePedidos(l.datos) : [];
}

/** Lo elegido, en la URL: `?chat=` una conversación con MaKo, `?offer=` una de Offer, `?antes=` una de antes y `?centro=`
 *  un chat de Claude Code. */
const anotarEnUrl = (e: Elegido | null, centro: string | null) => {
  try {
    const u = new URL(window.location.href);
    const poner = (k: string, v: number | string | null) => { if (v != null) u.searchParams.set(k, String(v)); else u.searchParams.delete(k); };
    poner('chat', e && 'id' in e ? e.id : null);
    poner('offer', e && 'offer' in e ? e.offer : null);
    poner('antes', e && 'antes' in e ? e.antes : null);
    poner('centro', centro);
    window.history.replaceState(null, '', u);
  } catch { /* es una comodidad */ }
};

/** Un parámetro suelto de la URL (la Ticketera), con el mismo cuidado que `anotarEnUrl`. */
const anotarParam = (k: string, v: string | null) => {
  try {
    const u = new URL(window.location.href);
    if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
    window.history.replaceState(null, '', u);
  } catch { /* es una comodidad */ }
};

type Props = {
  /** Al terminar el onboarding (`?recorrido=sb-inicio`): arranca el tutorial del Ops Center (20/10/2026). */
  tutorialInicio?: boolean;
  /** El admin con la tab en su capa: ve el acceso «Mapa». */
  veMapa: boolean;
  /** El Mapa ya armado por el servidor (la URL lo pidió); null = la conversación. */
  mapa: ReactNode | null;
  chatInicial: number | null;
  /** `?offer=` y `?antes=`: la conversación de Offer o el chat de antes que se abre al entrar. */
  offerInicial?: number | null;
  antesInicial?: number | null;
  /** «Armar mi oferta», la opción con que Offer arma la oferta (lib/offer-reglas.ts → OPCION_ARMAR, que baja de la página:
   *  importarlo en el navegador arrastraría las reglas del motor). */
  opcionArmar?: string;
  /** Los chats de Claude Code del Centro (app/admin/operaciones/datos.ts): null para todos menos el super admin. */
  centro: DatosCentro | null;
  /** `?centro=`: el chat de Claude Code que se abre al entrar. */
  centroInicial: string | null;
  /** `?ticketera=`: Ops Center abre con la Ticketera entera (las rutas viejas de la Ticketera traen acá). */
  ticketeraInicial?: VistaDeTicketera | null;
  /** Qué se abre sin nada en la URL: el jefe del Second Brain (/second-brain) o el Cerebro (/admin/operaciones). */
  inicio?: 'second-brain' | 'centro';
};

export function ChatSecondBrain(props: Props) {
  return props.centro
    ? <ConCentro datos={props.centro}>{(k) => <Cuerpo {...props} centro={k} />}</ConCentro>
    : <Cuerpo {...props} centro={null} />;
}

/** El motor del Centro, montado una vez (un hook no puede ser condicional): sólo cuando el servidor mandó sus datos. */
function ConCentro({ datos, children }: { datos: DatosCentro; children: (k: Centro) => ReactNode }) {
  const { toast, show, clear } = useToast();
  const k = useCentro(datos, (t, tono) => show(t, undefined, tono));
  return <>{children(k)}<Toast state={toast} onClose={clear} /></>;
}

/** El chat de Claude Code de entrada: el Cerebro (va primero) o el primero que puede recibir. */
const centroDeEntrada = (k: Centro): string | null => (k.chats.find((c) => c.sesion) ?? k.chats[0])?.clave ?? null;

function Cuerpo({ veMapa, mapa, chatInicial, offerInicial = null, antesInicial = null, opcionArmar = '', centro, centroInicial, ticketeraInicial = null, inicio = 'second-brain', tutorialInicio = false }: Omit<Props, 'centro'> & { centro: Centro | null }) {
  const router = useRouter();
  const ws = useWs();
  // El tutorial del Ops Center al terminar el onboarding (20/10/2026): se abre solo si lo pide la URL y la persona no lo vio.
  const tutorial = useRecorrido(RECORRIDO_INICIO, { autoabrir: tutorialInicio });
  /** La página en la que se está (/second-brain o /admin/operaciones): los links del Mapa vuelven a ella. */
  const base = usePathname() || '/second-brain';
  /** Ops Center: el super admin, con sus chats de Claude Code (el servidor mandó el Centro). */
  const ops = centro != null;
  const [sesiones, setSesiones] = useState<SesionChat[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [elegido, setElegido] = useState<Elegido | null>(() => {
    if (offerInicial != null) return { offer: offerInicial };
    if (antesInicial != null) return { antes: antesInicial };
    if (!centro) return null;
    // La clave de un chat, o la de una de sus sesiones (los links de siempre del Centro: `?chat=local_…`). Un link con el
    // nombre de antes de un renombre lleva al chat renombrado (lib/centro-chats.ts → seguirChat).
    const pedido = seguirChat(centro.chats, centroInicial, null, centro.trabajos);
    if (pedido) return { centro: pedido.clave };
    // En Ops Center, sin nada pedido, abre el Cerebro, como el Centro de siempre (desde el 17/10/2026 también por la puerta
    // de /second-brain: «Second Brain» es el grafo, no una lista aparte).
    const entrada = chatInicial == null && mapa == null ? centroDeEntrada(centro) : null;
    return entrada ? { centro: entrada } : null;
  });
  // «Nuevo chat» de Claude Code (Ops Center): un chat vacío con su caja, sin modal; MaKo decide dónde va con el primer mensaje.
  const [nuevoCentro, setNuevoCentro] = useState(false);
  const [conChat, setConChat] = useState(chatInicial != null || offerInicial != null || antesInicial != null || mapa != null || centroInicial != null || ticketeraInicial != null);
  const [ticketera, setTicketera] = useState<VistaDeTicketera | null>(ticketeraInicial);
  const [items, setItems] = useState<ItemHilo[]>([]);
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [faltaMic, setFaltaMic] = useState<string | null>(null);
  const [trabajo, setTrabajo] = useState<{ desde: number } | null>(null);
  const [segs, setSegs] = useState(0);
  const [tarjeta, setTarjeta] = useState<{ id: number; accion: 'confirmar' | 'cancelar' } | null>(null);
  const [busca, setBusca] = useState('');
  const [todas, setTodas] = useState(false);
  /** Los chats de «Pregúntale a MaKo» (null = todavía no llegaron). Van en la MISMA lista y se siguen (21/10/2026). */
  const [antes, setAntes] = useState<ChatDeAntes[] | null>(null);
  /** Las conversaciones de Offer del negocio (20/10/2026, Martín: «el chat de OFFER no está llegando al Ops Center»): una
   *  proyección de offer_sesiones (lib/chat-mako-indice.ts → chatsDeOffer), con la puerta de la tab. null = todavía no llegó. */
  const [offer, setOffer] = useState<ChatDeOffer[] | null>(null);
  /** La conversación de Offer abierta, entera (sus opciones, su diagnóstico, si se está armando): la da el motor de Offer. */
  const [deOfferAbierta, setDeOfferAbierta] = useState<OfferSesionVista | null>(null);
  const offerRef = useRef<OfferSesionVista | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const ocupadoRef = useRef(false);
  const sesionRef = useRef<number | null>(null);
  /** La conversación que se acaba de crear con el primer mensaje: su hilo YA está dibujado, no se recarga. */
  const recienCreada = useRef<number | null>(null);
  const envios = useRef(new Map<string, { texto: string; archivos: ArchivoElegido[] }>());
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  /** Los archivos elegidos en la caja (el ref los tiene al día para sumar sin esperar un render). */
  const [elegidos, setElegidos] = useState<ArchivoElegido[]>([]);
  const elegidosRef = useRef<ArchivoElegido[]>([]);
  const ponerElegidos = (xs: ArchivoElegido[]) => { elegidosRef.current = xs; setElegidos(xs); };
  /** Los textos pegados de más de 1.000 caracteres (#864): no van a la caja, van como un documento con el mensaje
   *  (lib/chat-pegado.ts). El ref los tiene al día, como el de los archivos. */
  const [pegados, setPegados] = useState<Array<{ id: string; texto: string }>>([]);
  const pegadosRef = useRef<Array<{ id: string; texto: string }>>([]);
  const ponerPegados = (xs: Array<{ id: string; texto: string }>) => { pegadosRef.current = xs; setPegados(xs); };

  useEffect(() => { const t = window.setInterval(() => setAhora(Date.now()), 60_000); return () => window.clearInterval(t); }, []);

  // ── La lista: las conversaciones de esta persona ──
  const cargarLista = useCallback(async (): Promise<SesionChat[] | null> => {
    const l = await pedir<{ sesiones: SesionChat[] }>(`${RUTA}?sesiones=1`);
    if (!l.ok) { setErrorLista(l.reintentable ? l.error : 'No pude cargar tus chats.'); return null; }
    setErrorLista(null);
    setSesiones(l.datos.sesiones ?? []);
    return l.datos.sesiones ?? [];
  }, []);

  useEffect(() => {
    let vivo = true;
    void cargarLista().then((ss) => {
      if (!vivo || !ss) return;
      const pedida = chatInicial != null && ss.some((s) => s.id === chatInicial) ? chatInicial : null;
      const jefe = listaDelCliente({ sesiones: ss, offer: [], antes: [], busca: '' })[0].elegido;
      // Lo que ya se eligió (el chat de Claude Code de la URL, o un toque antes de que llegara la lista) se queda.
      // En Ops Center la lista es la de Claude Code: un chat con MaKo se abre sólo si la URL lo pide.
      setElegido((prev) => prev ?? (pedida != null ? { id: pedida } : ops ? null : jefe));
    });
    return () => { vivo = false; };
  }, [cargarLista, chatInicial, ops]);

  // Las conversaciones de Offer y los chats de antes, una vez (no en Ops Center: ahí la lista es la de Claude Code).
  const cargarOtros = useCallback(() => {
    void pedir<{ offer: ChatDeOffer[] }>(`${RUTA}?offer=1`).then((l) => setOffer(l.ok ? l.datos.offer ?? [] : []));
    void pedir<{ antes: ChatDeAntes[] }>(`${RUTA}?antes=1`).then((l) => setAntes(l.ok ? l.datos.antes ?? [] : []));
  }, []);
  useEffect(() => { if (!ops) cargarOtros(); }, [ops, cargarOtros]);

  // ── El hilo de lo elegido ──
  const idElegido = elegido && 'id' in elegido ? elegido.id : null;
  const idAntes = elegido && 'antes' in elegido ? elegido.antes : null;
  const idOffer = elegido && 'offer' in elegido ? elegido.offer : null;
  /** La sesión de chart_sessions a la que va el turno: la conversación con MaKo, o el chat de antes que se sigue. */
  const idTurno = idElegido ?? idAntes;
  const cargarHilo = useCallback(async (id: number, deAntes: boolean, vigente: () => boolean = () => true) => {
    setCargado(false); setErrorCarga(null);
    const l = await pedir<Abierta>(`${RUTA}?sessionId=${id}${deAntes ? '&antes=1' : ''}`);
    if (!vigente()) return;
    if (!l.ok) { setErrorCarga(l.reintentable ? l.error : 'No pude abrir el chat.'); setCargado(true); return; }
    setItems(itemsDeSesion(l.datos.mensajes ?? [], l.datos.propuestas ?? [], l.datos.pantallas ?? []));
    setCargado(true);
  }, []);

  /** La URL de un audio de Offer con el `?ws=` del negocio que se mira (un `<audio src>` no pasa por el `fetch` de la casa). */
  const conWsDeAudio = useCallback((url: string) => conWs(url, ws), [ws]);
  const ponerOffer = useCallback((s: OfferSesionVista) => {
    offerRef.current = s;
    setDeOfferAbierta(s);
    setItems(itemsDeOffer(s.mensajes, conWsDeAudio));
  }, [conWsDeAudio]);

  useEffect(() => {
    if (!elegido) return;
    sesionRef.current = idTurno;
    offerRef.current = null;
    setDeOfferAbierta(null);
    if (idOffer != null) {
      // Una conversación de Offer: se abre con SU motor (motor-offer.ts) y se sigue acá.
      let vivo = true;
      setCargado(false); setErrorCarga(null);
      void abrirOffer(idOffer).then((l) => {
        if (!vivo) return;
        if (!l.ok) { setErrorCarga(l.error); setCargado(true); return; }
        ponerOffer(l.sesion);
        setCargado(true);
      });
      return () => { vivo = false; };
    }
    if (idTurno == null) { setItems([]); setErrorCarga(null); setCargado(true); return; }
    if (recienCreada.current === idTurno) { recienCreada.current = null; return; }
    let vivo = true;
    void cargarHilo(idTurno, idAntes != null, () => vivo);
    return () => { vivo = false; };
  }, [elegido, idTurno, idAntes, idOffer, cargarHilo, ponerOffer]);

  // Mientras Offer arma la oferta por detrás (`armar`), la conversación se relee: la oferta aparece sola, con su PDF.
  const armandoOffer = idOffer != null && !!deOfferAbierta?.armando?.corriendo;
  useEffect(() => {
    if (!armandoOffer || idOffer == null) return;
    const t = window.setInterval(() => {
      void abrirOffer(idOffer).then((l) => { if (l.ok && offerRef.current?.id === idOffer) ponerOffer(l.sesion); });
    }, RELEER_ARMADO_MS);
    return () => window.clearInterval(t);
  }, [armandoOffer, idOffer, ponerOffer]);

  const claveCentro = elegido && 'centro' in elegido ? elegido.centro : null;
  // ⚠️ EL CHAT ABIERTO SE SIGUE AUNQUE LO RENOMBREN (17/10/2026: renombrarlo dejaba a Martín en un panel vacío). Su clave es
  // su nombre: si ya no está, se lo busca por las sesiones que tenía (`miembrosAbierto`) y la clave pasa a la nueva.
  const miembrosAbierto = useRef<readonly string[] | null>(null);
  const chatCentro = centro && claveCentro ? seguirChat(centro.chats, claveCentro, miembrosAbierto.current, centro.trabajos) : null;
  useEffect(() => {
    if (!chatCentro) return;
    miembrosAbierto.current = chatCentro.miembros;
    if (claveCentro && chatCentro.clave !== claveCentro) setElegido({ centro: chatCentro.clave });
  }, [chatCentro, claveCentro]);
  // En la URL va su SESIÓN (no cambia al renombrarlo); el que no tiene, su clave.
  const urlCentro = chatCentro ? claveParaUrl(chatCentro) : claveCentro;
  // ⚠️ Con el grafo abierto, la URL es del grafo (`?panel=mapa`): tocar un chat navega con `router.push`, y si este efecto
  // reescribe la URL con `replaceState` ANTES de que esa navegación termine, la deja otra vez en `?panel=mapa&centro=…` y el grafo
  // no se va nunca (Martín, 17/10/2026: «una vez que entro a Second Brain, no puedo salir más dándole click a un chat»). Mientras
  // hay grafo no se anota nada; al irse, el efecto vuelve a correr y anota el chat.
  const hayMapa = mapa != null;
  useEffect(() => { if (elegido && !hayMapa) anotarEnUrl(elegido, urlCentro); }, [elegido, urlCentro, hayMapa]);
  // ⚠️ LA TICKETERA SIGUE A LA URL, no a la prop: un link a esta misma página con otro `?ticketera=` (el ítem «Ticketera»
  // de la barra de admin) no la vuelve a montar (docs/hallazgos-operaciones.md).
  const qTicketera = useSearchParams().get('ticketera');
  useEffect(() => {
    if (!ops) return;
    // Las vistas de antes (`tarjetas`, `lista`: las preguntas de los chats) ya no existen: un link viejo abre los tickets.
    const v: VistaDeTicketera | null = esVistaTicketera(qTicketera) ? 'tickets' : null;
    setTicketera(v);
    if (v) setConChat(true);
  }, [qTicketera, ops]);
  // Los tickets de los usuarios que esperan a Martín: el número del botón (17/10/2026, app/tickets/bandeja/).
  const ticketsPorDecidir = useTicketsPorDecidir(ops);
  const abrirTicketera = (v: VistaDeTicketera) => { setNuevoCentro(false); setTicketera(v); setConChat(true); anotarParam('ticketera', v); };
  const cerrarTicketera = () => { setTicketera(null); anotarParam('ticketera', null); };

  // Como un chat: abre mostrando lo último, y baja cuando llega algo nuevo.
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [items.length, trabajo, idTurno, idOffer]);
  // El campo que crece y el scroll que lo acompaña son de la caja única (app/_chat/CajaChat.tsx): le pasa la conversación.
  const seguirHilo = useCallback(() => hilo.current, []);

  const desde = trabajo?.desde ?? null;
  useEffect(() => {
    if (desde == null) return;
    const t = window.setInterval(() => setSegs(Math.floor((Date.now() - desde) / 1000)), 1000);
    return () => { window.clearInterval(t); setSegs(0); };
  }, [desde]);

  const recargar = () => {
    if (ocupadoRef.current) return;
    if (idOffer != null) { void abrirOffer(idOffer).then((l) => { if (l.ok) ponerOffer(l.sesion); }); return; }
    if (idTurno != null) void cargarHilo(idTurno, idAntes != null);
  };

  // ── Elegir en la barra ──
  const elegir = (e: Elegido) => {
    if (ocupadoRef.current) return;
    setNuevoCentro(false);
    setConChat(true);
    setFaltaMic(null);
    for (const a of elegidosRef.current) URL.revokeObjectURL(a.url);
    ponerElegidos([]);
    ponerPegados([]);
    // Con el Mapa abierto, volver a una conversación es volver a la página sin `panel` (lo arma el servidor).
    if (mapa) {
      router.push('id' in e ? `${base}?chat=${e.id}` : 'offer' in e ? `${base}?offer=${e.offer}` : 'antes' in e ? `${base}?antes=${e.antes}`
        : 'centro' in e ? `${base}?centro=${encodeURIComponent(e.centro)}` : base);
    }
    if (ticketera) cerrarTicketera();
    setElegido(e);
    setTexto('');
    window.setTimeout(() => caja.current?.focus({ preventScroll: true }), 0);
  };

  const marcar = (id: string, cambio: Partial<ItemMsg>) =>
    setItems((xs) => xs.map((x) => (x.id === id && x.k === 'msg' ? { ...x, ...cambio } : x)));

  // ── El turno ──
  const mandar = async (idU: string, mensaje: string, archivos: readonly ArchivoElegido[]) => {
    setTrabajo({ desde: Date.now() });
    const deAntes = idAntes != null;
    // Arranca ya, junto con el turno (tarda segundos; el turno, decenas).
    const irA = linksDelPedido(mensaje);
    try {
      let sid = sesionRef.current;
      if (sid == null) {
        // El primer mensaje crea la conversación (el jefe que todavía no tenía, o un chat nuevo).
        const n = await postJson<{ sesion: SesionChat }>({ action: 'new' });
        if (!n.ok) { marcar(idU, { estado: 'error', error: n.reintentable ? n.error : 'No pude crear el chat.' }); return; }
        sid = n.datos.sesion.id;
        sesionRef.current = sid;
        recienCreada.current = sid;
        setSesiones((ss) => [...(ss ?? []), n.datos.sesion]);
        setElegido({ id: sid });
      }
      const l = archivos.length
        ? await postArchivos<RespuestaTurno>(sid, mensaje, archivos, deAntes)
        : await postLargo<RespuestaTurno>({ action: 'send', sessionId: sid, mensaje, ...(deAntes ? { antes: 1 } : {}) });
      if (!l.ok) { marcar(idU, { estado: l.reintentable ? 'error' : 'incierto', error: l.error }); return; }
      // Los archivos volvieron guardados: la burbuja pasa a pedirlos por su mensaje y la vista previa se suelta.
      const guardados = archivosDeRespuesta(l.datos);
      marcar(idU, { estado: undefined, error: undefined, ...textoTapadoDeRespuesta(l.datos, mensaje), ...(guardados.length ? { archivos: guardados } : {}) });
      if (guardados.length) { for (const a of archivos) URL.revokeObjectURL(a.url); envios.current.delete(idU); }
      setItems((xs) => {
        const vistas = new Set(xs.flatMap((x) => (x.k === 'propuesta' ? [x.t.pendienteId] : [])));
        return [...xs, ...itemsDeRespuesta(l.datos, vistas)];
      });
      // Los links no demoran la respuesta: se cuelgan de ella cuando llegan.
      void irA.then((links) => { if (links.length) setItems((xs) => colgarIrA(xs, links, idU)); });
      // El título y la hora de la fila (un chat de antes sube arriba de la lista).
      if (deAntes) cargarOtros(); else void cargarLista();
    } finally {
      ocupadoRef.current = false;
      setTrabajo(null);
    }
  };

  /** Lo escrito en una conversación de Offer va a SU motor (motor-offer.ts). Tocar «Armar mi oferta» la arma, como en la tab. */
  const mandarAOffer = async (idU: string, mensaje: string) => {
    const s = offerRef.current;
    if (!s) return;
    setTrabajo({ desde: Date.now() });
    try {
      const ultimo = s.mensajes[s.mensajes.length - 1];
      if (ultimo?.de === 'mako' && !ultimo.pregunta && s.puedeConcluir && esOpcionArmar(mensaje, opcionArmar)) {
        setItems((xs) => xs.filter((x) => x.id !== idU));
        const a = await armarOffer(s.id);
        if (a.ok) ponerOffer(a.sesion); else setFaltaMic(a.error);
        return;
      }
      const r = await turnoOffer(s.id, mensaje, s.mensajes, respuestaDeOffer(s.mensajes, mensaje));
      if (r.sesion && offerRef.current?.id === s.id) ponerOffer(r.sesion);
      // Con la conversación de vuelta, lo dicho ya quedó guardado: el error va en la línea de estado y no se reintenta.
      if (!r.ok && !r.sesion) marcar(idU, { estado: 'error', error: r.error });
      else if (!r.ok) setFaltaMic(r.error);
      cargarOtros();
    } finally {
      ocupadoRef.current = false;
      setTrabajo(null);
    }
  };

  const enviar = (mensaje: string, archivos: readonly ArchivoElegido[] = []): boolean => {
    const t = mensaje.trim();
    if ((!t && !archivos.length) || ocupadoRef.current || !cargado || errorCarga) return false;
    ocupadoRef.current = true;
    setFaltaMic(null);
    const idU = idLocal('u');
    envios.current.set(idU, { texto: t, archivos: [...archivos] });
    const locales = archivos.map((a) => ({ nombre: a.file.name, tipo: a.tipo, local: a.url }));
    setItems((xs) => [...xs, { k: 'msg', id: idU, role: 'user', texto: t, at: new Date().toISOString(), estado: 'enviando', ...(locales.length ? { archivos: locales } : {}) }]);
    if (idOffer != null) void mandarAOffer(idU, t); else void mandar(idU, t, archivos);
    return true;
  };

  const enviarCaja = () => {
    const t = texto.trim();
    const pg = pegadosRef.current.map((p) => p.texto);
    if ((!t && !elegidosRef.current.length && !pg.length) || ocupadoRef.current) return;
    // La vista previa NO se suelta acá: la burbuja que sale la sigue mostrando hasta que vuelve guardada. Los pegados
    // salen DENTRO del mensaje, entre sus marcas: el hilo los dibuja como documento y el turno los archiva (#884).
    if (enviar(conPegados(t, pg), elegidosRef.current)) { setTexto(''); ponerElegidos([]); ponerPegados([]); }
  };

  // ── Los archivos de la caja: el «+», pegar y arrastrar. Los mismos topes que la ruta (4 archivos, 4 MB). ──
  const sumarArchivos = async (lista: readonly File[]) => {
    if (!lista.length) return;
    setFaltaMic(null);
    const validos = lista.filter((f) => tipoDeElegido(f) != null);
    if (validos.length < lista.length) setFaltaMic(ERROR_ADJUNTO.formato);
    const listos: File[] = [];
    for (const f of validos) {
      try { listos.push(await achicarImagen(f)); } catch (e) { setFaltaMic(e instanceof Error ? e.message : 'No pude leer esa imagen.'); }
    }
    if (!listos.length) return;
    const problema = problemaDeSeleccion([...elegidosRef.current.map((a) => a.file.size), ...listos.map((f) => f.size)]);
    if (problema) { setFaltaMic(problema); return; }
    ponerElegidos([...elegidosRef.current, ...listos.map((f) => ({
      id: idLocal('f'), file: f, tipo: tipoDeElegido(f) === 'image' ? 'image' as const : 'document' as const, url: URL.createObjectURL(f),
    }))]);
    caja.current?.focus({ preventScroll: true });
  };
  const quitarArchivo = (id: string) => {
    const a = elegidosRef.current.find((x) => x.id === id);
    if (a) URL.revokeObjectURL(a.url);
    ponerElegidos(elegidosRef.current.filter((x) => x.id !== id));
  };
  /** Las fotos y los PDF de la caja, para la caja única: sólo fotos y PDF (lo que lee /api/mako/chat, lib/mako-adjuntos.ts).
   *  En una conversación de Offer todavía no: sus documentos van por la lectura de Offer (lo que queda, en el relevo). */
  const adjuntosCaja: AdjuntosDeCaja = {
    items: elegidos, puede: idOffer == null && cargado && !errorCarga, onSumar: (fs) => void sumarArchivos(fs), onQuitar: quitarArchivo, accept: ACCEPT_ADJUNTOS_CHAT,
    onNoPuede: () => setFaltaMic('En esta conversación de Offer, pega el texto o el link en el mensaje.'),
    onSinImagen: (puedeLeer) => setFaltaMic(puedeLeer ? 'No hay una imagen copiada' : 'Este navegador no deja pegar'),
  };
  /** Un texto de más de 1.000 caracteres no entra a la caja: queda como un documento pegado (#864, como Claude). Una imagen
   *  pegada la toma la caja única (pegar.ts → alPegar). */
  const pegarLargo = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    // Una celda de Excel o un párrafo de Word viajan como texto Y como imagen: con texto, manda el texto (la revisión de
    // caja-voz, 20/10/2026: salir con cualquier archivo dejaba un pegado de 5.000 caracteres crudo en la caja, sin archivarse).
    if (e.clipboardData.files.length && !Array.from(e.clipboardData.types).includes('text/plain')) return;
    const pegado = e.clipboardData.getData('text/plain');
    // En Offer lo largo va entero en el mensaje: su motor lo parte en documentos (app/api/offer/route.ts → repartirTextoLargo).
    if (idOffer == null && esPegadoLargo(pegado)) { e.preventDefault(); ponerPegados([...pegadosRef.current, { id: idLocal('p'), texto: pegado }]); }
  };

  /** Sólo lo que NO llegó (un 4xx): se saca y se manda de nuevo. */
  const reintentar = (id: string) => {
    const t = envios.current.get(id);
    if (!t || ocupadoRef.current) return;
    setItems((xs) => xs.filter((x) => x.id !== id));
    envios.current.delete(id);
    enviar(t.texto, t.archivos);
  };

  // ── Las tarjetas ──
  /** `r`: lo que contestó la tarjeta (su «Abrir», los avisos y lo que dibuja el resultado: `conTarjeta`). */
  const alEstado = (pendienteId: number, estado: EstadoPropuesta, nota?: string, r?: ResultadoTarjeta) => {
    setItems((xs) => conTarjeta(xs, pendienteId, estado, nota, r));
  };
  const correrTarjeta = async (x: ItemPropuesta, accion: 'confirmar' | 'cancelar') => {
    const sid = sesionRef.current;
    if (tarjeta || sid == null) return;
    const id = x.t.pendienteId;
    setTarjeta({ id, accion });
    if (accion === 'confirmar') alEstado(id, 'aplicando');
    try {
      const l = await postLargo<ResultadoTarjeta>({ action: accion, sessionId: sid, pendienteId: id, ...(idAntes != null ? { antes: 1 } : {}) });
      if (!l.ok) { alEstado(id, 'pendiente', l.reintentable ? l.error : 'No llegó la respuesta. Recarga el chat para ver si se ejecutó.'); return; }
      const d = trasTarjeta(l.datos, accion);
      alEstado(id, d.estado ?? 'pendiente', d.frase ?? undefined, l.datos);
    } finally {
      setTarjeta(null);
    }
  };

  // ── Lo que se dibuja ──
  const lista = useMemo(() => listaDelCliente({ sesiones: sesiones ?? [], offer: offer ?? [], antes: antes ?? [], busca }), [sesiones, offer, antes, busca]);
  const [cerebroFila, ...restoFilas] = lista;
  const corte = todas || busca.trim() ? restoFilas : restoFilas.filter((f, i) => i < FILAS_VISIBLES || esFilaDe(f, elegido));
  /** La fila de lo abierto (un chat nuevo no tiene). */
  const filaAbierta = elegido ? lista.find((f) => esFilaDe(f, elegido)) ?? null : null;
  const esJefe = filaAbierta?.clave === 'jefe';
  const deOffer = idOffer != null ? (offer ?? []).find((o) => o.id === idOffer) ?? null : null;
  const deAntes = idAntes != null ? (antes ?? []).find((a) => a.id === idAntes) ?? null : null;
  const nombre = filaAbierta?.titulo
    ?? (idOffer != null ? deOfferAbierta?.titulo || deOffer?.titulo || SECCION_OFFER : idAntes != null ? deAntes?.titulo?.trim() || 'Chat de antes' : SIN_TITULO);
  const nombreMuneco = filaAbierta?.criatura ?? (idOffer != null ? criaturaDeOffer(nombre) : nombre);
  const animo = trabajo || armandoOffer ? 'trabajando' : 'despierto';
  // El grafo se abre sin soltar el chat que estaba abierto: vuelve a él (17/10/2026: «nunca cambia de chat»).
  const hrefMapa = `${base}?panel=mapa${idElegido ? `&chat=${idElegido}` : urlCentro ? `&centro=${encodeURIComponent(urlCentro)}` : ''}`;
  /** Volver del Mapa a lo que estaba elegido (lo vuelve a armar el servidor). */
  const hrefVolver = idElegido ? `${base}?chat=${idElegido}` : idOffer ? `${base}?offer=${idOffer}` : idAntes ? `${base}?antes=${idAntes}`
    : urlCentro ? `${base}?centro=${encodeURIComponent(urlCentro)}` : base;
  /** ¿El panel muestra un chat con MaKo? Fuera de Ops Center, siempre; en Ops Center, sólo si es el elegido (por la URL). */
  const enSB = !ops || (elegido != null && !('centro' in elegido));
  /** ¿La lista es la de los chats con MaKo? Fuera de Ops Center. En Ops Center la lista es SIEMPRE la de Claude Code: abrir el
   *  grafo no la cambia (Martín, 17/10/2026: la entrada «Second Brain» «abre sólo el grafo y nunca cambia de chat»). */
  const listaSB = !ops;
  // «Second Brain» abre el GRAFO en el panel (Martín, 17/10/2026: «Entro a la tab de Second Brain y me envía a un CHAT de
  // Second Brain... cuando ahí debería saltar el grafo»), con el chat que estaba abierto anotado para volver. Sin el Mapa
  // (no es admin de la tab), el chat con MaKo.
  /** «Nuevo chat»: abre el chat vacío (ChatNuevo.tsx). Con el grafo o la Ticketera abiertos, los deja. */
  const abrirNuevoCentro = () => {
    if (mapa) router.push(base);
    if (ticketera) cerrarTicketera();
    setNuevoCentro(true);
    setConChat(true);
  };
  const irAlSecondBrain = () => {
    if (veMapa) { if (ticketera) cerrarTicketera(); setNuevoCentro(false); setConChat(true); router.push(hrefMapa); return; }
    elegir(cerebroFila.elegido);
  };
  // Los chats de Claude Code que dicen lo buscado (el elegido, `chatCentro`, se sigue arriba).
  const chatsCentro = centro?.chats;
  const delCentro = useMemo(() => (chatsCentro ? buscarChats(chatsCentro, busca) : []), [chatsCentro, busca]);

  /** Una fila de la lista del cliente: la `FilaDeChat` del super admin, con su criatura y, si trabaja, «Trabajando…». */
  const fila = (f: (typeof lista)[number]) => {
    const actual = !mapa && esFilaDe(f, elegido);
    const vivo = actual && (!!trabajo || armandoOffer);
    return (
      <FilaDeChat key={f.clave} titulo={f.titulo} criatura={f.criatura} animo={vivo ? 'trabajando' : 'despierto'} actual={actual}
        hace={edadCorta(f.actividad, ahora)} previa={vivo ? <RenglonDeFila vivo /> : null} onElegir={() => elegir(f.elegido)} />
    );
  };
  /** La caja del chat con MaKo (o de Offer, o de antes): la ÚNICA de la app, apagada mientras el chat no cargó. */
  const caja_ = (
    <div className="co-caja">
      {/* La caja ÚNICA (app/_chat/CajaChat.tsx, 20/10/2026): la misma del Ops Center, en toda la app (Martín: «Te pedí
          que unificaras el chat del Ops Center en todos lados, su diseño y funcionalidades»). Arriba, los textos
          largos pegados como documento. */}
      <CajaChat texto={texto} onTexto={(v) => { setFaltaMic(null); setTexto(v); }} onMandar={enviarCaja}
        ocupado={!!trabajo || armandoOffer} apagado={!cargado || !!errorCarga} placeholder={`Escribe a ${nombre}`} tituloMandar="Mandar (Enter)"
        enterManda campo={caja} seguir={seguirHilo} onErrorMic={setFaltaMic} adjuntos={adjuntosCaja}
        hayAlgoMas={pegados.length > 0} onPegar={pegarLargo}
        arriba={pegados.length > 0 ? (
        <ul className="ch-elegidos" aria-label="Textos pegados">
          {pegados.map((p) => (
            <li key={p.id} className="ch-elegido ch-elegido--pegado">
              <IconoChat nombre="archivo" size={20} />
              <span className="ch-elegido__nombre" title={nombrePegado(p.texto)}>{`${nombrePegado(p.texto, 24)} · ${caracteres(p.texto)}`}</span>
              <button type="button" className="ch-elegido__quitar" onClick={() => ponerPegados(pegadosRef.current.filter((x) => x.id !== p.id))} aria-label="Quitar el texto pegado">
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
        ) : null} />
    </div>
  );

  return (
    <div className="co" data-con-chat={conChat ? 'true' : 'false'}>
      <Recorrido id={RECORRIDO_INICIO} pasos={PASOS_INICIO} abierto={tutorial.abierto} onCerrar={tutorial.onCerrar} />
      <aside className="co-barra" aria-label="Chats" data-recorrido="sb-chats">
        <div className="co-barra__arriba">
          <label className="co-buscar">
            <Icon name="search" size={16} />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar un chat" />
          </label>
          {/* Ops Center: la Ticketera entera y, debajo, el Second Brain (Martín: «que "Second brain" sea la sub tab debajo de
              la Ticketera»), como «Buscar» y «Biblioteca» en la barra de ChatGPT. */}
          {centro && (
            <button type="button" className="co-acceso co-acceso--ticketera" aria-pressed={ticketera != null}
              onClick={() => (ticketera ? cerrarTicketera() : abrirTicketera('tickets'))}>
              <Icon name="soporte" size={17} />Ticketera
              {(ticketsPorDecidir ?? 0) > 0 && <span className="co-acceso__n">{ticketsPorDecidir}</span>}
            </button>
          )}
          {centro && (
            <button type="button" className="co-acceso" aria-pressed={mapa != null && !ticketera} onClick={irAlSecondBrain}>
              <Icon name="cerebro" size={17} />Second Brain
            </button>
          )}
          {/* El grafo del negocio, arriba de los chats: como la Ticketera en el Centro (el botón del grafo de Obsidian). En
              Ops Center no está (17/10/2026: «la entrada "Mapa" se va»): el grafo lo abre «Second Brain». */}
          {veMapa && listaSB && (
            <button type="button" className="co-acceso" aria-pressed={mapa != null}
              onClick={() => { setConChat(true); router.push(mapa ? hrefVolver : hrefMapa); }}>
              {/* «Second Brain», no «Mapa» (Martín, llamada con Florencia del 18/10 [00:50:28]: «no debería llamarse mapa,
                  debería llamarse second brain»). La TAB es «Ops Center»; lo que se llama «Second Brain» es el grafo. */}
              <Icon name={centro ? 'grid' : 'cerebro'} size={17} />Second Brain
            </button>
          )}
        </div>

        <nav className="co-lista" aria-label="Chats">
          {/* Ops Center fuera del Second Brain: los chats de Claude Code (el Cerebro y cada jefe con sus sub-chats). */}
          {!listaSB && centro && (
            <>
              <NuevoChatCentro onNuevo={abrirNuevoCentro} actual={nuevoCentro && !mapa && !ticketera} />
              {centro.chats.length > 0 && !delCentro.length && <p className="co-lista__vacio">Ningún chat con ese nombre.</p>}
              {centro.chats.length
                ? <ListaCentro centro={centro} visibles={delCentro} actual={ticketera || nuevoCentro ? null : claveCentro} buscando={!!busca.trim()} onElegir={(clave) => elegir({ centro: clave })} />
                : <p className="co-lista__vacio">Conecta un Runner para ver tus chats aquí.</p>}
            </>
          )}
          {listaSB && (<>
          {/* «Nuevo chat» arriba de todos, como el de ChatGPT y Claude (y el del Ops Center del super admin). */}
          <NuevoChatCentro onNuevo={() => elegir({ virtual: 'nuevo' })} actual={!mapa && elegido != null && 'virtual' in elegido && elegido.virtual === 'nuevo'} />
          {errorLista && <p className="co-lista__vacio">{errorLista}</p>}
          {/* UNA lista (21/10/2026): el Cerebro arriba y todos los demás por actividad, sin secciones ni plegables. */}
          {sesiones != null && (
            <>
              <div className="co-cuenta co-cuenta--cerebro">{fila(cerebroFila)}</div>
              <div className="co-cuenta">
                {corte.map(fila)}
                {!todas && !busca.trim() && restoFilas.length > corte.length && (
                  <button type="button" className="co-mas" onClick={() => setTodas(true)}>{`Mostrar ${restoFilas.length - corte.length} más`}</button>
                )}
                {todas && !busca.trim() && restoFilas.length > FILAS_VISIBLES && (
                  <button type="button" className="co-mas" onClick={() => setTodas(false)}>Mostrar menos</button>
                )}
                {busca.trim() && !restoFilas.length && <p className="co-lista__vacio">Ningún chat con ese nombre.</p>}
              </div>
            </>
          )}
          </>)}
        </nav>
        {/* El Uso de las cuentas y sus Runners, en un desplegable siempre a la vista (sólo Ops Center). */}
        {centro && <PieCentro centro={centro} />}
      </aside>

      {centro && ticketera ? (
        <TicketeraCentro cerebro={cerebroDelCentro(centro)} onVolver={() => { cerrarTicketera(); setConChat(false); }} />
      ) : mapa ? (
        // El grafo trae su cabecera («Second Brain», siempre en oscuro: VistaCerebro.tsx); el «volver» de la ventana
        // angosta le llega por contexto, porque el grafo lo arma el servidor y una función no viaja de ahí (volver.ts).
        <section className="co-panel" aria-label="Second Brain">
          <VolverDelGrafo.Provider value={() => { setConChat(false); router.push(hrefVolver); }}>{mapa}</VolverDelGrafo.Provider>
        </section>
      ) : centro && nuevoCentro ? (
        // Un chat NUEVO de Claude Code: vacío, con su caja; con el primer mensaje, MaKo decide dónde va (ChatNuevo.tsx).
        <ChatNuevoCentro centro={centro} onAbrir={(clave) => elegir({ centro: clave })} onVolver={() => { setNuevoCentro(false); setConChat(false); }} />
      ) : centro && chatCentro ? (
        // Un chat de Claude Code: la conversación del Centro, con su caja firmada (el único camino, mandar.ts).
        <ChatDelCentro centro={centro} chat={chatCentro} onVolver={() => setConChat(false)} />
      ) : !enSB ? (
        // Ops Center sin un chat de Claude Code para abrir (todavía no hay ninguno, o el de la URL ya no está).
        <section className="co-panel"><p className="co-vacio">{centro?.chats.length ? 'Elige un chat para escribirle.' : 'Conecta un Runner para ver tus chats aquí.'}</p></section>
      ) : (
        // Un chat con MaKo (o de Offer, o de antes): el panel del Ops Center (PanelChat.tsx), con SU motor.
        <PanelDeChat hilo={hilo} adjuntos={adjuntosCaja}
          // La criatura del chat: el Cerebro es la estrella; uno de Offer, la de Offer (la cabecera del super admin, sin chips).
          cabecera={{ clave: JSON.stringify(elegido), titulo: nombre, criatura: nombreMuneco, animo, onVolver: () => setConChat(false) }}
          caja={caja_}
          estado={faltaMic ?? (armandoOffer ? 'MaKo está armando tu oferta. Puede tardar unos minutos.' : '')}>
          {!cargado ? null : errorCarga ? (
            <div className="co-portada">
              <p className="co-portada__dato">{errorCarga}</p>
              <button type="button" className="co-chip" onClick={recargar}>Reintentar</button>
            </div>
          ) : !items.length && !trabajo ? (
            <div className="co-portada">
              <Muneco titulo={nombreMuneco} animo="despierto" size={76} />
              <p className="co-portada__nombre">¿En qué te ayudo?</p>
              {(esJefe || idTurno == null) && idOffer == null && <div className="ch-arranques">
                {ARRANQUES_SECOND_BRAIN.map((a) => <button key={a} type="button" className="co-chip" onClick={() => enviar(a)}>{a}</button>)}
              </div>}
            </div>
          ) : (
            <HiloMako items={items} quien={{ nombre: nombreMuneco }} ahora={ahora} escribiendo={trabajo || armandoOffer ? { segs } : null}
              tarjeta={tarjeta} onTarjeta={(x, a) => void correrTarjeta(x, a)} onReintentar={reintentar} onRecargar={recargar}
              onResponder={(t) => enviar(t)} onTrabajo={(id, ok) => setItems((xs) => trasTrabajo(xs, id, ok))} />
          )}
        </PanelDeChat>
      )}
      {centro && <MenusCentro centro={centro} />}
    </div>
  );
}
