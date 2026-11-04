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
//     antes al turno de MaKo sobre esa sesión (`antes` en /api/mako/chat). Nunca «Esta conversación sigue en Offer»;
//   · cada mensaje tiene lo de WhatsApp del super admin (MensajeWA.tsx): el clic derecho, mantener apretado y deslizar para
//     responder, con las reacciones, destacar, fijar y eliminar para ella (guardadas en su negocio, por persona:
//     lib/chat-mako-marcas-db.ts) y la cita arriba de la caja. Sin «Reenviar»: no hay otro chat al que mandárselo firmado;
//   · si la persona todavía no conectó SU Claude o GPT, al final de la caja va «Conectar tu Claude», que abre «Tus cuentas de
//     IA» ahí mismo (el modal de /perfil/ia; para una integración jamás se sale de la tab).
//
// EL MOTOR DEL CHAT DEL CLIENTE ES UNO (22/10/2026): useChatCliente.ts, el mismo del teléfono (app/m/second-brain/ChatClienteM.tsx),
// y lo que se ve adentro del panel (el hilo y la caja) es PiezasCliente.tsx. Acá queda la pantalla: la barra, el panel y lo que es
// sólo del super admin (sus chats de Claude Code, la Ticketera, el Uso).
//
// LOS TRES DE ARRIBA (1/11/2026, Martín: «primero el chat principal de Ops Center, que ya no se llama cerebro... segundo funnel coach y
// ahí adentro la calculadora. Y tercero offer coach, que cambiaría por Hormozi»; docs/funnel-coach.md). Fijos, en ese orden, y para
// todos: el Funnel Coach se SUGIERE con la oferta cargada, nunca se esconde. Las conversaciones de Offer van debajo del Offer Coach, y
// la del onboarding entre ellas: es su primera mitad. Tocar la criatura de un coach elige quién aconseja (./ElegirReferente.tsx).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { Modal, Toast, useToast } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { useCentro, type Centro, type DatosCentro } from '@/app/admin/operaciones/useCentro';
import { claveParaUrl, esperaDe, partesDelNombre, seguirChat } from '@/lib/centro-chats';
import { pasaFiltroChats, type ChatFiltrable } from '@/lib/ops-center-filtro';
import { FiltroChats } from '@/app/admin/operaciones/FiltroChats';
import { EntradaOps } from './EntradaOps';
import { ChatDelCoach } from './ChatDelCoach';
import { ChatDelReferente } from './ChatDelReferente';
import { ChatDelGrupo } from './ChatDelGrupo';
import { FilasDelGrupo } from '@/app/_chat/grupo/FilasDelGrupo';
import { useGrupos } from '@/app/_chat/grupo/useGrupos';
import { ElegirReferente } from './ElegirReferente';
import { GaleriaDeGurus } from './GaleriaDeGurus';
import { BotonSecondBrainDe, CerebroDelGuru } from './SuSecondBrain';
import { useCoaches, useGurusConCharla } from './useCoaches';
import { ChatDelCentro, FilaDeChat, GruposPorJefe, ListaCentro, MenusCentro, NuevoChatCentro, PieCentro, RenglonDeFila, buscarChats } from '@/app/admin/operaciones/PiezasCentro';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { ChatNuevoCentro } from '@/app/admin/operaciones/ChatNuevo';
import { TicketeraCentro } from '@/app/admin/operaciones/TicketeraCentro';
import { esVistaTicketera, type VistaDeTicketera } from '@/app/tickets/decisiones/reglas';
import { cerebroDelCentro } from '@/app/tickets/bandeja/cerebro';
import { useTicketsPorDecidir } from '@/app/tickets/bandeja/usarContador';
import { useMisTickets } from '@/app/tickets/usarMisTickets';
import { TicketeraDelCliente } from './TicketeraDelCliente';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { VolverDelGrafo } from './volver';
import { useChatCliente } from './useChatCliente';
import { CajaDelCliente, HiloDelCliente, UsoDelCliente, estadoDelCliente } from './PiezasCliente';
import { RecomendacionesDeMako } from '@/app/_chat/RecomendacionesDeMako';
import { ORIGEN_FUNNEL_COACH, ORIGEN_OFFER_COACH, SUBS_VISIBLES, edadCorta, esFilaDe, gurusDeLaBarra, jefeDelGrupo, queAbreElOfferCoach, type ElegidoChat } from '@/lib/chat-mako-reglas';
import { ASPECTO_MAKO, aspectoDeChat, aspectoDeReferente } from '@/lib/centro-munecos';
import { asesorPorId, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import { tocarEnLaBarra, type EntradaBarra } from '@/lib/ops-center-navegar';
// Directo y no desde el índice de app/_ui (ver app/_ui/CargandoMako.tsx).
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { useGuiaDeLaTab } from '@/app/_ui/guia/useGuiaDeLaTab';
import { ancla } from '@/app/_ui/guia/ancla';
import { useAperturaDelCerebro } from './PiezasCliente';
import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';

/** Cuántas filas se ven debajo del Cerebro antes de «Mostrar N más». */
const FILAS_VISIBLES = SUBS_VISIBLES;

type Elegido = ElegidoChat;

/** Lo elegido, en la URL: `?chat=` una conversación con MaKo, `?offer=` una de Offer, `?antes=` una de antes, `?centro=`
 *  un chat de Claude Code, `?guru=` el chat con un gurú y `?grupo=` el grupo de un negocio (con esos dos abiertos, lo demás no se
 *  anota: es lo que se ve). */
const anotarEnUrl = (e: Elegido | null, centro: string | null, guru: IdAsesor | null = null, grupo: number | null = null) => {
  try {
    const u = new URL(window.location.href);
    const poner = (k: string, v: number | string | null) => { if (v != null) u.searchParams.set(k, String(v)); else u.searchParams.delete(k); };
    poner('chat', e && 'id' in e ? e.id : null);
    poner('offer', e && 'offer' in e ? e.offer : null);
    poner('antes', e && 'antes' in e ? e.antes : null);
    poner('coach', e && 'coach' in e ? e.coach : null);
    poner('centro', centro);
    poner('guru', guru);
    poner('grupo', grupo);
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
  /** El admin con la tab en su capa: ve el acceso «Mapa». */
  veMapa: boolean;
  /** El Mapa ya armado por el servidor (la URL lo pidió); null = la conversación. */
  mapa: ReactNode | null;
  chatInicial: number | null;
  /** `?offer=` y `?antes=`: la conversación de Offer o el chat de antes que se abre al entrar. */
  offerInicial?: number | null;
  antesInicial?: number | null;
  /** `?coach=funnel`: abre el Funnel Coach. */
  funnelInicial?: boolean;
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
  // ⚠️ UNA VUELTA DEL SERVIDOR QUE FALLA NO DESARMA EL OPS CENTER (22/10/2026, el 503 de cada deploy, medido por el Cerebro):
  // si `datosDelCentroSiOpera` no pudo leer la sesión, `centro` llegaba null, el árbol pasaba de `ConCentro` a `Cuerpo` solo y
  // TODO se volvía a montar: la Ticketera en «Cargando…» y la lista sin sus «Completado», con otro orden. Se queda el último que
  // se vio. Lo que se lee DESPUÉS sigue pasando por la guarda de cada acción (`puedeOperar`): esto no muestra nada nuevo.
  const visto = useRef<DatosCentro | null>(null);
  if (props.centro) visto.current = props.centro;
  const datos = props.centro ?? visto.current;
  return datos
    ? <ConCentro datos={datos}>{(k) => <Cuerpo {...props} centro={k} />}</ConCentro>
    : <Cuerpo {...props} centro={null} />;
}

/** El motor del Centro, montado una vez (un hook no puede ser condicional): sólo cuando el servidor mandó sus datos. */
function ConCentro({ datos, children }: { datos: DatosCentro; children: (k: Centro) => ReactNode }) {
  const { toast, show, clear } = useToast();
  const k = useCentro(datos, (t, tono) => show(t, undefined, tono));
  return <>{children(k)}<Toast state={toast} onClose={clear} /></>;
}

/** ¿Lo elegido escribe algo en la URL? Un chat sí (`?chat=`, `?offer=`, `?antes=`, `?centro=`); «Nuevo chat» no. */
const urlPelada = (e: Elegido | null): boolean => !!e && ('id' in e || 'offer' in e || 'antes' in e || 'centro' in e || 'coach' in e);

/** El chat de Claude Code de entrada: el Cerebro (va primero) o el primero que puede recibir. */
const centroDeEntrada = (k: Centro): string | null => (k.chats.find((c) => c.sesion) ?? k.chats[0])?.clave ?? null;

function Cuerpo({ veMapa, mapa, chatInicial, offerInicial = null, antesInicial = null, funnelInicial = false, opcionArmar = '', centro, centroInicial, ticketeraInicial = null, inicio = 'second-brain' }: Omit<Props, 'centro'> & { centro: Centro | null }) {
  const router = useRouter();
  /** La página en la que se está (/second-brain o /admin/operaciones): los links del Mapa vuelven a ella. */
  const base = usePathname() || '/second-brain';
  /** Ops Center: el super admin, con sus chats de Claude Code (el servidor mandó el Centro). */
  const ops = centro != null;
  const [elegido, setElegido] = useState<Elegido | null>(() => {
    if (funnelInicial) return { coach: 'funnel' };
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
  // El chat con un GURÚ (3/11/2026, #16): se abre desde «Nuevo chat» (GaleriaDeGurus.tsx), su fila o la del Offer Coach, ahí mismo y
  // sin conversación previa (ChatDelReferente.tsx). Lo que lo hace gurú es la clave de su conversación, no este estado: esto sólo dice
  // qué panel se ve. ⚠️ NO VA EN `ElegidoChat`: ese es el motor de ESTA pantalla, y el gurú tiene el suyo. `?guru=` lo trae de vuelta.
  const guruInicial = asesorPorId(useSearchParams().get('guru'))?.id ?? null;
  const [guru, setGuru] = useState<IdAsesor | null>(guruInicial);
  // ⚠️ UNA VEZ ABIERTO QUEDA MONTADO, ESCONDIDO, como el Funnel Coach (más abajo): tiene su propio motor, y desmontado a mitad de un turno
  // la respuesta llegaba a nadie. Irse a otro chat mientras contesta no la pierde.
  const [gurusMontados, setGurusMontados] = useState<readonly IdAsesor[]>(guruInicial ? [guruInicial] : []);
  const delGuru = asesorPorId(guru);
  // EL GRUPO DE UN NEGOCIO (3/11/2026, Martín: «tipo grupos de WhatsApp dentro del Ops Center»): lo mismo que el gurú, con su motor (ChatDelGrupo.tsx) y fuera de `ElegidoChat`. Se abre desde
  // su fila, fijada arriba, o desde el push (`?grupo=<ws>`). El ws es el del GRUPO, no el de la pestaña: un invitado sigue parado en su negocio (lib/grupo-puerta.ts). También queda montado.
  const grupoPedido = useSearchParams().get('grupo');
  const grupoInicial = grupoPedido && /^\d{1,15}$/.test(grupoPedido) ? Number(grupoPedido) : null;
  const [grupo, setGrupo] = useState<number | null>(grupoInicial);
  const [gruposMontados, setGruposMontados] = useState<readonly number[]>(grupoInicial != null ? [grupoInicial] : []);
  const grupos = useGrupos();
  const enOtroChat = delGuru != null || grupo != null;
  const enChatNuevo = elegido != null && 'virtual' in elegido && elegido.virtual === 'nuevo';
  const [conChat, setConChat] = useState(funnelInicial || guruInicial != null || grupoInicial != null || chatInicial != null || offerInicial != null || antesInicial != null || mapa != null || centroInicial != null || ticketeraInicial != null);
  const [ticketera, setTicketera] = useState<VistaDeTicketera | null>(ticketeraInicial);
  const [busca, setBusca] = useState('');
  /** El filtro de la barra (feedback 4, 22/10/2026): el de Automations, con las áreas y, para el super admin, el estado. */
  const [filtros, setFiltros] = useState<string[]>([]);
  const [todas, setTodas] = useState(false);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  // El motor de los chats del cliente (useChatCliente.ts), el mismo del teléfono. En Ops Center la lista es la de Claude Code: un
  // chat con MaKo se abre sólo si la URL lo pide.
  const { referentes, hayOferta, puedeElegir, elegirReferente } = useCoaches();
  const [eligiendoOffer, setEligiendoOffer] = useState(false);
  const gurusConCharla = useGurusConCharla(guru);
  const delOffer = asesorPorId(referentes.offer);
  const delFunnel = asesorPorId(referentes.funnel);
  const k = useChatCliente({ elegido, setElegido, activo: !ops, entrarAlCerebro: !ops, chatInicial, opcionArmar, busca, caja, aspectoOffer: delOffer ? aspectoDeReferente(delOffer.id) : null });
  const { idOffer, idAntes } = k;
  // El Second Brain del gurú de una conversación de Offer, en el lugar de la conversación (SuSecondBrain.tsx). Se guarda PARA QUÉ
  // conversación se abrió: cambiar de chat vuelve a la conversación sin un efecto que lo apague.
  const [cerebroDeOffer, setCerebroDeOffer] = useState<number | null>(null);
  const viendoCerebroOffer = delOffer != null && idOffer != null && cerebroDeOffer === idOffer;
  const idElegido = elegido && 'id' in elegido ? elegido.id : null;

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
  useEffect(() => {
    if (hayMapa) return;
    if (grupo != null) anotarEnUrl(null, null, null, grupo);
    else if (guru) anotarEnUrl(null, null, guru);
    else if (elegido) anotarEnUrl(elegido, urlCentro);
    else { anotarParam('guru', null); anotarParam('grupo', null); }
  }, [elegido, urlCentro, hayMapa, guru, grupo]);
  // ⚠️ EL CLIC CAMBIA LA VISTA EN EL ACTO (23/10/2026, Martín: «Cuando apreto "Second Brain" primero se va al chat de "Cerebro" y
  // luego de unos segundos ahí recién entra al second brain, eso está muy mal»). El grafo lo arma el SERVIDOR (`mapa`) y tarda
  // ~3 s; mientras tanto se dibujaba lo de antes. `yendo` es adónde se fue con el clic: hacia el grafo se ve su loader
  // (CargandoMako) hasta que llega, y hacia afuera se ve el chat ya, aunque el grafo todavía esté. Llega lo nuevo y se suelta.
  const [yendo, setYendo] = useState<'mapa' | 'fuera' | null>(null);
  useEffect(() => { setYendo(null); }, [mapa]);
  const verMapa = yendo ? yendo === 'mapa' : hayMapa;
  // ⚠️ LA VISTA SALE DE LA URL: un link a la página pelada (la barra de la app, el ícono del Ops Center) vuelve a la entrada.
  // Antes el panel se quedaba en el último chat aunque la URL dijera /second-brain. Lo que escribe `anotarEnUrl` nunca deja la
  // URL pelada con un chat elegido (sólo «Nuevo chat», que no lleva parámetro), así que esto es siempre una navegación de afuera.
  const qs = useSearchParams().toString();
  const elegidoRef = useRef(elegido);
  elegidoRef.current = elegido;
  const guruRef = useRef(guru);
  guruRef.current = guru;
  const grupoRef = useRef(grupo);
  grupoRef.current = grupo;
  const qsAntes = useRef(qs);
  useEffect(() => {
    const antes = qsAntes.current;
    qsAntes.current = qs;
    if (qs || !antes || (!urlPelada(elegidoRef.current) && !guruRef.current && grupoRef.current == null)) return;
    setGuru(null);
    setGrupo(null);
    setNuevoCentro(false);
    if (centro) { const entrada = centroDeEntrada(centro); if (entrada) setElegido({ centro: entrada }); return; }
    setElegido(k.lista[0]?.elegido ?? null);
  }, [qs]); // eslint-disable-line react-hooks/exhaustive-deps
  // ⚠️ LA TICKETERA SIGUE A LA URL, no a la prop: un link a esta misma página con otro `?ticketera=` (el ítem «Ticketera»
  // de la barra de admin) no la vuelve a montar (docs/hallazgos-operaciones.md). La del CLIENTE también (23/10/2026): era un
  // estado suelto, fuera de la URL, y con ella abierta «Second Brain» no hacía nada (lib/ops-center-navegar.ts).
  const qTicketera = useSearchParams().get('ticketera');
  useEffect(() => {
    // Las vistas de antes (`tarjetas`, `lista`: las preguntas de los chats) ya no existen: un link viejo abre los tickets.
    const v: VistaDeTicketera | null = esVistaTicketera(qTicketera) ? 'tickets' : null;
    setTicketera(v);
    if (v) setConChat(true);
  }, [qTicketera]);
  // Los tickets de los usuarios que esperan a Martín: el número del botón (17/10/2026, app/tickets/bandeja/).
  const ticketsPorDecidir = useTicketsPorDecidir(ops);
  // La Ticketera del CLIENTE (22/10/2026, Martín: «Que el Ops Center de clientes sea IGUAL que el de SuperAdmin, que tengan su
  // ticketera»): sus tickets, con su número (los que esperan su respuesta), en el mismo lugar que la del super admin.
  const misTickets = useMisTickets(!ops);
  // Su «Uso» (D3): el modal «Tus cuentas de IA», sin ir directo a conectar.
  const [verUso, setVerUso] = useState(false);
  const abrirTicketera = (v: VistaDeTicketera) => { setNuevoCentro(false); setTicketera(v); setConChat(true); anotarParam('ticketera', v); };
  /** `anotar: false` cuando sigue un `router.push`: la URL nueva ya no la trae, y reescribirla en medio de la navegación la pisa. */
  const cerrarTicketera = (anotar = true) => { setTicketera(null); if (anotar) anotarParam('ticketera', null); };

  // LA GUÍA DE LA PESTAÑA (29/10/2026, reemplaza al recorrido `sb-inicio`, que sólo se abría con `?recorrido=` al terminar el
  // onboarding): la primera vez de la persona en el Ops Center, entre por donde entre, MaKo pregunta en el hilo del Cerebro si le
  // enseña; el «?» la vuelve a ofrecer. Su catálogo: ./guia-ops-center.ts. Sólo la del cliente: la del super admin es la de sus
  // chats de Claude Code, donde no habla MaKo.
  const conGuia = !ops && !ticketera && !verMapa;
  const guia = useGuiaDeLaTab(ops ? '' : 'mako', { listo: conGuia && k.cargado && k.esJefe && k.app != null, hechos: { sinApp: k.app === 'bloquea', sinIA: k.iaConectada === false } });
  // Lo que MaKo dice primero en el Cerebro (la guía, o la escalera del primer ingreso: lib/aperturas/ops.ts).
  const apertura = useAperturaDelCerebro(k, { libre: conGuia });
  // Como un chat: abre mostrando lo último, y baja cuando llega algo nuevo.
  // El chat nuevo abre arriba: abajo de la portada están los gurús, y bajando se perdía lo que dice.
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = enChatNuevo && !k.items.length ? 0 : el.scrollHeight; }, [k.items.length, k.trabajo, k.idTurno, idOffer, enChatNuevo]);
  // El campo que crece y el scroll que lo acompaña son de la caja única (app/_chat/CajaChat.tsx): le pasa la conversación.
  const seguirHilo = useCallback(() => hilo.current, []);

  // ── Elegir en la barra ──
  /** Lo que hay en el panel (lib/ops-center-navegar.ts → panelQueSeVe). */
  const estadoPanel = () => ({ ticketera: ticketera != null, mapa: verMapa, nuevo: nuevoCentro });
  const elegir = (e: Elegido) => {
    if (!k.elegir(e)) return;
    setGuru(null);
    setGrupo(null);
    // ⚠️ ACÁ NO SE SUELTA `yendo` (24/10/2026, limpiando el `setYendoAlGrafo` que quedó huérfano del merge c77408c36): con el
    // grafo a la vista el paso de abajo es 'chat' y lo deja en 'fuera', que es lo que muestra el chat en el acto; si ya estaba
    // en 'fuera' (el grafo todavía montado, saliendo), ponerlo en null lo traería de vuelta al panel.
    const paso = tocarEnLaBarra('chat', estadoPanel());
    setNuevoCentro(paso.nuevo);
    setConChat(true);
    // La Ticketera se cierra ANTES de navegar (lib/ops-center-navegar.ts).
    if (ticketera) cerrarTicketera(paso.ir == null);
    // Con el Mapa abierto, volver a una conversación es volver a la página sin `panel` (lo arma el servidor).
    if (paso.ir) {
      setYendo('fuera');
      router.push('id' in e ? `${base}?chat=${e.id}` : 'coach' in e ? `${base}?coach=${e.coach}` : 'offer' in e ? `${base}?offer=${e.offer}` : 'antes' in e ? `${base}?antes=${e.antes}`
        : 'centro' in e ? `${base}?centro=${encodeURIComponent(e.centro)}` : base);
    }
  };

  // ── Lo que se dibuja ──
  const [cerebroFila, ...filasDeLaLista] = k.lista;
  // Las de Offer van debajo del Offer Coach, no en el resto.
  const filasOffer = filasDeLaLista.filter((f) => f.origen === 'offer');
  // Los gurús van debajo de los coaches (`coaches`), con el mismo lugar para el cliente y el super admin.
  const todasLasFilas = filasDeLaLista.filter((f) => f.origen !== 'offer' && !f.guru);
  // El filtro va sobre lo que ya dejó la búsqueda; el Cerebro queda siempre arriba.
  const restoFilas = filtros.length ? todasLasFilas.filter((f) => pasaFiltroChats({ titulo: f.titulo }, filtros)) : todasLasFilas;
  const corte = todas || busca.trim() || filtros.length ? restoFilas : restoFilas.filter((f, i) => i < FILAS_VISIBLES || esFilaDe(f, elegido));
  // El grafo se abre sin soltar el chat que estaba abierto: vuelve a él (17/10/2026: «nunca cambia de chat»).
  const conCoach = !!elegido && 'coach' in elegido;
  const hrefMapa = `${base}?panel=mapa${idElegido ? `&chat=${idElegido}` : urlCentro ? `&centro=${encodeURIComponent(urlCentro)}` : conCoach ? '&coach=funnel' : ''}`;
  /** Volver del Mapa a lo que estaba elegido (lo vuelve a armar el servidor). */
  const hrefVolver = conCoach ? `${base}?coach=funnel` : idElegido ? `${base}?chat=${idElegido}` : idOffer ? `${base}?offer=${idOffer}` : idAntes ? `${base}?antes=${idAntes}`
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
  const abrirNuevoCentro = () => tocar('nuevo');
  /** «Second Brain»: el grafo. El del cliente, con el grafo a la vista, vuelve a lo elegido; sin el grafo, el Cerebro. */
  const irAlSecondBrain = () => (veMapa ? tocar('second-brain') : elegir(cerebroFila.elegido));
  /** Una entrada de la barra que no es un chat de la lista: lo que hace lo dice lib/ops-center-navegar.ts, igual para las dos
   *  barras. Lo tocado se ve siempre; la Ticketera se cierra antes de navegar. */
  function tocar(e: Exclude<EntradaBarra, 'chat'>) {
    const paso = tocarEnLaBarra(e, estadoPanel(), { veMapa, alterna: !ops });
    setGuru(null);
    setGrupo(null);
    if (paso.ticketera && !ticketera) abrirTicketera('tickets');
    if (!paso.ticketera && ticketera) cerrarTicketera(paso.ir == null);
    setNuevoCentro(paso.nuevo);
    setConChat(true);
    if (paso.ir) { setYendo(paso.ir === 'mapa' ? 'mapa' : 'fuera'); router.push(paso.ir === 'mapa' ? hrefMapa : paso.ir === 'volver' ? hrefVolver : base); }
  }
  // Los chats de Claude Code que dicen lo buscado (el elegido, `chatCentro`, se sigue arriba).
  const chatsCentro = centro?.chats;
  const esperasCentro = centro?.esperas;
  /** Lo que el filtro sabe de un chat del super admin: su nombre, si trabaja y si espera su respuesta. */
  const filtrableCentro = useCallback((c: NonNullable<typeof chatsCentro>[number]): ChatFiltrable => (
    { titulo: c.titulo, trabajando: c.estado === 'trabajando', espera: esperaDe(c, esperasCentro ?? {}) > 0 }), [esperasCentro]);
  const delCentro = useMemo(() => {
    const buscados = chatsCentro ? buscarChats(chatsCentro, busca) : [];
    return filtros.length ? buscados.filter((c) => pasaFiltroChats(filtrableCentro(c), filtros)) : buscados;
  }, [chatsCentro, busca, filtros, filtrableCentro]);

  /** Una fila de la lista del cliente: la `FilaDeChat` del super admin, con SU criatura (una por chat: `aspecto`) y, si trabaja,
   *  «Trabajando…». En su grupo (`sub`), corrida a la derecha y sólo con lo de después de «›», como un sub-chat del super admin. */
  const fila = (f: (typeof k.lista)[number], sub = false) => {
    // El jefe de un grupo sin chat propio abre el más reciente de los suyos, pero el abierto es ése, no el jefe.
    const actual = !verMapa && !enOtroChat && !f.jefeDeGrupo && esFilaDe(f, elegido);
    const vivo = actual && k.enCurso;
    return (
      <FilaDeChat key={f.clave} titulo={f.titulo} criatura={f.criatura} aspecto={f.aspecto} animo={vivo ? 'trabajando' : 'despierto'} actual={actual}
        texto={sub ? partesDelNombre(f.titulo).sub ?? f.titulo : f.titulo} sub={sub}
        hace={edadCorta(f.actividad, k.ahora)} previa={vivo ? <RenglonDeFila vivo /> : null} onElegir={() => elegir(f.elegido)} />
    );
  };

  /** Abre el chat con un gurú ahí mismo: deja la Ticketera, el grafo y el chat nuevo, como tocar un chat de la lista. Sin el grafo no se
   *  navega: Martín, 2/11/2026, «no me tiene que redirigir a ningún lado». */
  const abrirGuru = (id: IdAsesor) => {
    const paso = tocarEnLaBarra('chat', estadoPanel());
    if (ticketera) cerrarTicketera(paso.ir == null);
    setNuevoCentro(false);
    setGrupo(null);
    setGuru(id);
    setGurusMontados((xs) => (xs.includes(id) ? xs : [...xs, id]));
    setConChat(true);
    if (paso.ir) { setYendo('fuera'); router.push(`${base}?guru=${encodeURIComponent(id)}`); }
  };
  /** La fila del Offer Coach (lib/chat-mako-reglas.ts → queAbreElOfferCoach): nunca es un clic muerto. */
  const abrirOfferCoach = () => {
    const a = queAbreElOfferCoach({ referente: delOffer?.id ?? null, offer: filasOffer[0]?.elegido ?? null });
    if ('guru' in a) abrirGuru(a.guru);
    else if ('elegido' in a) elegir(a.elegido);
    else setEligiendoOffer(true);
  };
  /** Abre el grupo de un negocio ahí mismo, como un gurú. */
  const abrirGrupo = (ws: number) => {
    const paso = tocarEnLaBarra('chat', estadoPanel());
    if (ticketera) cerrarTicketera(paso.ir == null);
    setNuevoCentro(false);
    setGuru(null);
    setGrupo(ws);
    setGruposMontados((xs) => (xs.includes(ws) ? xs : [...xs, ws]));
    setConChat(true);
    if (paso.ir) { setYendo('fuera'); router.push(`${base}?grupo=${ws}`); }
  };
  /** Cuándo fue lo último con un gurú. */
  const edadDeGuru = (id: IdAsesor | undefined) => { const at = gurusConCharla.find((g) => g.id === id)?.at; return edadCorta(at ? Date.parse(at) : null, k.ahora); };
  const filasDeGurus = gurusDeLaBarra({ conCharla: gurusConCharla, abierto: guru, delOffer: delOffer?.id ?? null, busca });

  /** Los dos coaches, fijos debajo del Ops Center, y debajo los gurús con los que ya habló. */
  const verFunnel = conCoach && !verMapa && !ticketera && !nuevoCentro && !enOtroChat;
  // ⚠️ UNA VEZ ABIERTO QUEDA MONTADO, ESCONDIDO (la revisión del 1/11/2026): tiene su propio motor, y el de esta pantalla no sabe si está ocupado. Desmontado a mitad de un
  // turno, la respuesta llegaba a nadie y al volver el hilo terminaba en la pregunta. Un trabajo largo corre en segundo plano y no bloquea la navegación.
  const [funnelAbierto, setFunnelAbierto] = useState(funnelInicial);
  useEffect(() => { if (conCoach) setFunnelAbierto(true); }, [conCoach]);
  // Sus herramientas son del admin del negocio (el presupuesto y el plan): a un closer o un setter el coach le prometería lo que no puede hacer.
  const coaches = (
    <div className="co-cuenta co-cuenta--coaches">
      {(ops || puedeElegir) && <FilaDeChat titulo={ORIGEN_FUNNEL_COACH} aspecto={delFunnel ? aspectoDeReferente(delFunnel.id) : ASPECTO_MAKO} animo="despierto" actual={verFunnel} hace=""
        previa={<span className="co-fila__coach">{delFunnel ? inspiradoEn(delFunnel) : hayOferta ? 'Sigue después de tu oferta' : 'Elige cómo conseguir clientes'}</span>}
        onElegir={() => elegir({ coach: 'funnel' })} />}
      {(ops || veMapa) && (
        <div className="co-jefe">
          <FilaDeChat titulo={delOffer?.nombre ?? ORIGEN_OFFER_COACH} criatura={delOffer?.nombre ?? ORIGEN_OFFER_COACH} aspecto={delOffer ? aspectoDeReferente(delOffer.id) : ASPECTO_MAKO} animo="despierto"
            actual={!verMapa && delOffer != null && delGuru?.id === delOffer.id} hace={edadDeGuru(delOffer?.id)}
            previa={<span className="co-fila__coach">{delOffer ? `${ORIGEN_OFFER_COACH} · ${inspiradoEn(delOffer)}` : ORIGEN_OFFER_COACH}</span>}
            // ⚠️ NO SACA A NADIE DEL OPS CENTER. Martín, 2/11/2026: «la tab de offer dentro del
            // OpsCenter me sigue llevando a la ruta de offer… si yo le doy clic, no me tiene que
            // redirigir a ningún lado». Y 3/11/2026: «Cuando le doy a "Hormozi" no se abre nada»: sin
            // conversación de Offer el clic no hacía nada. Ahora abre su chat, aunque nunca le haya escrito.
            onElegir={abrirOfferCoach} />
          {filasOffer.length > 0 && <div className="co-jefe__subs">{filasOffer.map((f) => fila(f, true))}</div>}
        </div>
      )}
      {/* El historial de los gurús: su cara, su nombre y cuándo fue lo último. */}
      {filasDeGurus.map(({ id }) => {
        const g = asesorPorId(id);
        return g && (
          <FilaDeChat key={id} titulo={g.nombre} aspecto={aspectoDeReferente(id)} animo="despierto" actual={!verMapa && guru === id} hace={edadDeGuru(id)}
            previa={<span className="co-fila__coach">{inspiradoEn(g)}</span>} onElegir={() => abrirGuru(id)} />
        );
      })}
    </div>
  );

  return (
    <div className="co" data-con-chat={conChat ? 'true' : 'false'}>
      {/* La criatura de MaKo mientras entra (feedback 5b, 23/10/2026): tapa el Ops Center hasta que la conversación se
          dibujó y vuela a su lugar, la criatura de la cabecera. Una vez por documento. */}
      <EntradaOps />
      <aside className="co-barra" aria-label="Chats" {...ancla('sb-chats')}>
        {/* ARRIBA, COMO LA LISTA DE AUTOMATIONS (feedback 4, 22/10/2026: «parecida a lo que tenemos en Automations»): la guía,
            la búsqueda y el filtro en una fila. «Ticketera» y «Second Brain» bajaron, junto al Uso. */}
        <div className="co-barra__arriba">
          <div className="co-barra__fila">
            {/* El «?»: la guía de la pestaña, «¿Qué quieres hacer?» en el hilo del Cerebro (sin repreguntar la primera vez). */}
            {!ops && (
              <button type="button" className="co-ayuda" onClick={() => guia.ofrecer()} aria-label="Que MaKo te enseñe esta pestaña" title="Guía">
                <Icon name="help" size={16} />
              </button>
            )}
            <label className="co-buscar" {...ancla('sb-buscar')}>
              <Icon name="search" size={16} />
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar un chat" />
            </label>
            <FiltroChats filas={centro ? (chatsCentro ?? []).map(filtrableCentro) : todasLasFilas.map((f) => ({ titulo: f.titulo }))}
              valores={filtros} onCambio={setFiltros} conEstado={!!centro} />
          </div>
        </div>

        <nav className="co-lista" aria-label="Chats">
          {/* Ops Center fuera del Second Brain: los chats de Claude Code (el Cerebro y cada jefe con sus sub-chats). */}
          {!listaSB && centro && (
            <>
              <NuevoChatCentro onNuevo={abrirNuevoCentro} actual={nuevoCentro && !verMapa && !ticketera} />
              <FilasDelGrupo g={grupos} abierto={!verMapa && !ticketera ? grupo : null} onElegir={abrirGrupo} />
              {coaches}
              {centro.chats.length > 0 && !delCentro.length && <p className="co-lista__vacio">Ningún chat con ese nombre.</p>}
              {centro.chats.length
                ? <ListaCentro centro={centro} visibles={delCentro} actual={ticketera || nuevoCentro || enOtroChat ? null : claveCentro} buscando={!!busca.trim()} onElegir={(clave) => elegir({ centro: clave })} />
                : <p className="co-lista__vacio">Conecta un Runner para ver tus chats aquí.</p>}
            </>
          )}
          {listaSB && (<>
          {/* «Nuevo chat» arriba de todos, como el de ChatGPT y Claude (y el del Ops Center del super admin). */}
          <NuevoChatCentro onNuevo={() => elegir({ virtual: 'nuevo' })} actual={!verMapa && !enOtroChat && enChatNuevo} />
          <FilasDelGrupo g={grupos} abierto={!verMapa && !ticketera ? grupo : null} onElegir={abrirGrupo} />
          {k.errorLista && <p className="co-lista__vacio">{k.errorLista}</p>}
          {/* UNA lista (21/10/2026): el Cerebro arriba y todos los demás por actividad, sin plegables; desde el 22/10, agrupados por
              su origen («Offer › …», «Dashboard › …») con el MISMO agrupado del super admin (`GruposPorJefe`). */}
          {k.sesiones != null && (
            <>
              <div className="co-cuenta co-cuenta--cerebro">{fila(cerebroFila)}</div>
              {coaches}
              <div className="co-cuenta">
                {/* Sin títulos de sección (22/10/2026, Martín): el grupo sin chat propio lleva su fila JEFE, con su criatura. */}
                <GruposPorJefe chats={corte} fila={fila} jefe={(g) => { const j = jefeDelGrupo(g); return j ? { ...j, aspecto: aspectoDeChat(j.clave) } : null; }} />
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
        {/* ABAJO, JUNTO AL USO (feedback 4): la Ticketera, con un ícono de ticket que se entienda, y el Second Brain. */}
        <div className="co-barra__accesos">
          {/* Ops Center: la Ticketera entera y el Second Brain (Martín: «que "Second brain" sea la sub tab debajo de la
              Ticketera»). */}
          {centro && (
            <button type="button" className="co-acceso co-acceso--ticketera" aria-pressed={ticketera != null}
              onClick={() => tocar('ticketera')}>
              <Icon name="ticket" size={17} />Ticketera
              {(ticketsPorDecidir ?? 0) > 0 && <span className="co-acceso__n">{ticketsPorDecidir}</span>}
            </button>
          )}
          {/* La del cliente: el mismo botón, con los suyos (los que esperan su respuesta, en el número). */}
          {!centro && !misTickets.fueraDelPlan && (
            <button type="button" className="co-acceso co-acceso--ticketera" aria-pressed={ticketera != null}
              onClick={() => tocar('ticketera')} {...ancla('sb-ticketera')}>
              <Icon name="ticket" size={17} />Ticketera
              {misTickets.esperanTuRespuesta > 0 && <span className="co-acceso__n">{misTickets.esperanTuRespuesta}</span>}
            </button>
          )}
          {centro && (
            <button type="button" className="co-acceso" aria-pressed={verMapa && !ticketera} onClick={irAlSecondBrain}>
              <Icon name="cerebro" size={17} />Second Brain
            </button>
          )}
          {/* El grafo del negocio (el botón del grafo de Obsidian). En Ops Center no está (17/10/2026: «la entrada "Mapa" se
              va»): el grafo lo abre «Second Brain». */}
          {veMapa && listaSB && (
            <button type="button" className="co-acceso" aria-pressed={verMapa && !ticketera} onClick={irAlSecondBrain}>
              {/* «Second Brain», no «Mapa» (Martín, llamada con Florencia del 18/10 [00:50:28]: «no debería llamarse mapa,
                  debería llamarse second brain»). La TAB es «Ops Center»; lo que se llama «Second Brain» es el grafo. */}
              <Icon name={centro ? 'grid' : 'cerebro'} size={17} />Second Brain
            </button>
          )}
        </div>
        {/* El Uso de las cuentas y sus Runners, en un desplegable siempre a la vista (sólo Ops Center). */}
        {centro && <PieCentro centro={centro} />}
        {/* El del cliente: sus cuentas de IA (22/10/2026). */}
        {!centro && <UsoDelCliente conectada={k.iaConectada} onAbrir={() => setVerUso(true)} />}
      </aside>

      {centro && ticketera ? (
        <TicketeraCentro cerebro={cerebroDelCentro(centro)} onVolver={() => { cerrarTicketera(); setConChat(false); }} />
      ) : !centro && ticketera ? (
        <TicketeraDelCliente mis={misTickets} onVolver={() => { cerrarTicketera(); setConChat(false); }} />
      ) : verMapa ? (
        // El grafo trae su cabecera («Second Brain», siempre en oscuro: VistaCerebro.tsx); el «volver» de la ventana
        // angosta le llega por contexto, porque el grafo lo arma el servidor y una función no viaja de ahí (volver.ts).
        // Mientras el servidor lo arma, su loader, en oscuro como el grafo (`yendo`, arriba).
        <section className="co-panel" aria-label="Second Brain" {...(mapa ? {} : { 'data-tema': 'oscuro', style: { background: 'var(--bg)' } })}>
          {mapa
            ? <VolverDelGrafo.Provider value={() => { setConChat(false); setYendo('fuera'); router.push(hrefVolver); }}>{mapa}</VolverDelGrafo.Provider>
            : <CargandoMako que="tu Second Brain" alto="100%" />}
        </section>
      ) : enOtroChat ? null : centro && nuevoCentro ? (
        // Un chat NUEVO de Claude Code: vacío, con su caja; con el primer mensaje, MaKo decide dónde va (ChatNuevo.tsx).
        <ChatNuevoCentro centro={centro} onAbrir={(clave) => elegir({ centro: clave })} onVolver={() => { setNuevoCentro(false); setConChat(false); }} gurus={<GaleriaDeGurus onElegir={abrirGuru} />} />
      ) : centro && chatCentro ? (
        // Un chat de Claude Code: la conversación del Centro, con su caja firmada (el único camino, mandar.ts).
        <ChatDelCentro centro={centro} chat={chatCentro} onVolver={() => setConChat(false)} />
      ) : !enSB ? (
        // Ops Center sin un chat de Claude Code para abrir (todavía no hay ninguno, o el de la URL ya no está).
        <section className="co-panel"><p className="co-vacio">{centro?.chats.length ? 'Elige un chat para escribirle.' : 'Conecta un Runner para ver tus chats aquí.'}</p></section>
      ) : conCoach ? null : (
        // Un chat con MaKo (o de Offer, o de antes): el panel del Ops Center (PanelChat.tsx), con SU motor.
        <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja}
          // La criatura del chat: el Cerebro es la estrella; uno de Offer, la de Offer (la cabecera del super admin, sin chips).
          cabecera={{ clave: JSON.stringify(elegido), titulo: k.nombre, criatura: k.nombreMuneco, aspecto: k.aspectoMuneco, animo: k.enCurso ? 'trabajando' : 'despierto', onVolver: () => setConChat(false),
            // En una conversación de Offer se ve quién aconseja y se puede cambiar, como la criatura de cualquier chat.
            ...(idOffer != null ? {
              onMuneco: puedeElegir ? () => setEligiendoOffer(true) : undefined,
              acciones: delOffer ? <><span className="co-cab__inspirado">{inspiradoEn(delOffer)}</span><BotonSecondBrainDe referente={delOffer} viendo={viendoCerebroOffer} onCambiar={(si) => setCerebroDeOffer(si ? idOffer : null)} /></> : undefined,
            } : {}) }}
          reemplazo={viendoCerebroOffer && delOffer ? <CerebroDelGuru referente={delOffer} /> : undefined}
          // Los fijados, arriba de la conversación (WhatsApp): tocar va al mensaje.
          arriba={<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={k.nombre} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />}
          despues={<>
            <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} />
            {k.infoWA && <Modal titulo="Info del mensaje" onCerrar={() => k.setInfoWA(null)} ancho={460}><InfoMensaje m={k.infoWA} /></Modal>}
          </>}
          caja={<>
            {/* Lo que MaKo recomienda a todo el negocio (26/10/2026), sólo en el Cerebro: en el bloque de preguntas, plegado. */}
            {k.esJefe && <RecomendacionesDeMako superficie="ops-center" alPedir={k.setTexto} />}
            <div className="co-caja"><CajaDelCliente k={k} campo={caja} seguir={seguirHilo} /></div>
          </>}
          estado={estadoDelCliente(k)}>
          <HiloDelCliente k={k} apertura={apertura} />
          {enChatNuevo && !k.items.length && !k.trabajo && <GaleriaDeGurus onElegir={abrirGuru} />}
        </PanelDeChat>
      )}
      {/* Un chat con un gurú (ChatDelReferente.tsx): su conversación, su cara y su Second Brain. */}
      {gurusMontados.map((id) => {
        const g = asesorPorId(id);
        const seVe = id === guru && !verMapa && !ticketera;
        return g && (
          <div key={id} style={{ display: seVe ? 'contents' : 'none' }}>
            <ChatDelReferente referente={g} visible={seVe} onVolver={() => { setGuru(null); setConChat(false); }} />
          </div>
        );
      })}
      {/* El grupo de un negocio (ChatDelGrupo.tsx): su hilo, los avisos y quién está. */}
      {gruposMontados.map((ws) => {
        const seVe = ws === grupo && !verMapa && !ticketera;
        return (
          <div key={ws} style={{ display: seVe ? 'contents' : 'none' }}>
            <ChatDelGrupo ws={ws} grupo={grupos.grupos?.find((f) => f.ws === ws) ?? null} visible={seVe} onVolver={() => { setGrupo(null); setConChat(false); }}
              onLeido={grupos.anotarLeido} onCambio={grupos.recargar}
              onSalio={() => { setGrupo(null); setConChat(false); setGruposMontados((xs) => xs.filter((x) => x !== ws)); grupos.recargar(); }} />
          </div>
        );
      })}
      {funnelAbierto && (
        <div style={{ display: verFunnel ? 'contents' : 'none' }}>
          <ChatDelCoach referente={referentes.funnel} hayOferta={hayOferta} puedeElegir={puedeElegir} onReferente={(id) => elegirReferente('funnel', id)} onVolver={() => setConChat(false)} />
        </div>
      )}
      {centro && <MenusCentro centro={centro} />}
      {eligiendoOffer && <ElegirReferente titulo={ORIGEN_OFFER_COACH} elegido={referentes.offer} onCerrar={() => setEligiendoOffer(false)} onElegir={(id) => { setEligiendoOffer(false); elegirReferente('offer', id); }} />}
      {/* «Tus cuentas de IA» ahí mismo (/perfil/ia): conectar su computadora con su Claude o, si es admin, la clave. */}
      {k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { k.setConectando(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>
      )}
      {verUso && !k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { setVerUso(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera />
        </Modal>
      )}
    </div>
  );
}
