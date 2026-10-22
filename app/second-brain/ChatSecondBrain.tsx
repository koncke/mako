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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { Modal, Toast, useToast } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { useCentro, type Centro, type DatosCentro } from '@/app/admin/operaciones/useCentro';
import { claveParaUrl, partesDelNombre, seguirChat } from '@/lib/centro-chats';
import { ChatDelCentro, FilaDeChat, GruposPorJefe, ListaCentro, MenusCentro, NuevoChatCentro, PieCentro, RenglonDeFila, buscarChats } from '@/app/admin/operaciones/PiezasCentro';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { ChatNuevoCentro } from '@/app/admin/operaciones/ChatNuevo';
import { TicketeraCentro } from '@/app/admin/operaciones/TicketeraCentro';
import { esVistaTicketera, type VistaDeTicketera } from '@/app/tickets/decisiones/reglas';
import { cerebroDelCentro } from '@/app/tickets/bandeja/cerebro';
import { useTicketsPorDecidir } from '@/app/tickets/bandeja/usarContador';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { VolverDelGrafo } from './volver';
import { useChatCliente } from './useChatCliente';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from './PiezasCliente';
import { SUBS_VISIBLES, edadCorta, esFilaDe, jefeDelGrupo, type ElegidoChat } from '@/lib/chat-mako-reglas';
import { aspectoDeChat } from '@/lib/centro-munecos';
import { Recorrido, useRecorrido } from '@/app/_ui/Recorrido';
import { RECORRIDO_INICIO } from '@/lib/onboarding-arranque';
import { PASOS_INICIO } from './recorrido-inicio';
import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';

/** Cuántas filas se ven debajo del Cerebro antes de «Mostrar N más». */
const FILAS_VISIBLES = SUBS_VISIBLES;

type Elegido = ElegidoChat;

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

/** El chat de Claude Code de entrada: el Cerebro (va primero) o el primero que puede recibir. */
const centroDeEntrada = (k: Centro): string | null => (k.chats.find((c) => c.sesion) ?? k.chats[0])?.clave ?? null;

function Cuerpo({ veMapa, mapa, chatInicial, offerInicial = null, antesInicial = null, opcionArmar = '', centro, centroInicial, ticketeraInicial = null, inicio = 'second-brain', tutorialInicio = false }: Omit<Props, 'centro'> & { centro: Centro | null }) {
  const router = useRouter();
  // El tutorial del Ops Center al terminar el onboarding (20/10/2026): se abre solo si lo pide la URL y la persona no lo vio.
  const tutorial = useRecorrido(RECORRIDO_INICIO, { autoabrir: tutorialInicio });
  /** La página en la que se está (/second-brain o /admin/operaciones): los links del Mapa vuelven a ella. */
  const base = usePathname() || '/second-brain';
  /** Ops Center: el super admin, con sus chats de Claude Code (el servidor mandó el Centro). */
  const ops = centro != null;
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
  const [busca, setBusca] = useState('');
  const [todas, setTodas] = useState(false);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  // El motor de los chats del cliente (useChatCliente.ts), el mismo del teléfono. En Ops Center la lista es la de Claude Code: un
  // chat con MaKo se abre sólo si la URL lo pide.
  const k = useChatCliente({ elegido, setElegido, activo: !ops, entrarAlCerebro: !ops, chatInicial, opcionArmar, busca, caja });
  const { idOffer, idAntes } = k;
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
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [k.items.length, k.trabajo, k.idTurno, idOffer]);
  // El campo que crece y el scroll que lo acompaña son de la caja única (app/_chat/CajaChat.tsx): le pasa la conversación.
  const seguirHilo = useCallback(() => hilo.current, []);

  // ── Elegir en la barra ──
  const elegir = (e: Elegido) => {
    if (!k.elegir(e)) return;
    setNuevoCentro(false);
    setConChat(true);
    // Con el Mapa abierto, volver a una conversación es volver a la página sin `panel` (lo arma el servidor).
    if (mapa) {
      router.push('id' in e ? `${base}?chat=${e.id}` : 'offer' in e ? `${base}?offer=${e.offer}` : 'antes' in e ? `${base}?antes=${e.antes}`
        : 'centro' in e ? `${base}?centro=${encodeURIComponent(e.centro)}` : base);
    }
    if (ticketera) cerrarTicketera();
  };

  // ── Lo que se dibuja ──
  const [cerebroFila, ...restoFilas] = k.lista;
  const corte = todas || busca.trim() ? restoFilas : restoFilas.filter((f, i) => i < FILAS_VISIBLES || esFilaDe(f, elegido));
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

  /** Una fila de la lista del cliente: la `FilaDeChat` del super admin, con SU criatura (una por chat: `aspecto`) y, si trabaja,
   *  «Trabajando…». En su grupo (`sub`), corrida a la derecha y sólo con lo de después de «›», como un sub-chat del super admin. */
  const fila = (f: (typeof k.lista)[number], sub = false) => {
    // El jefe de un grupo sin chat propio abre el más reciente de los suyos, pero el abierto es ése, no el jefe.
    const actual = !mapa && !f.jefeDeGrupo && esFilaDe(f, elegido);
    const vivo = actual && k.enCurso;
    return (
      <FilaDeChat key={f.clave} titulo={f.titulo} criatura={f.criatura} aspecto={f.aspecto} animo={vivo ? 'trabajando' : 'despierto'} actual={actual}
        texto={sub ? partesDelNombre(f.titulo).sub ?? f.titulo : f.titulo} sub={sub}
        hace={edadCorta(f.actividad, k.ahora)} previa={vivo ? <RenglonDeFila vivo /> : null} onElegir={() => elegir(f.elegido)} />
    );
  };

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
          {k.errorLista && <p className="co-lista__vacio">{k.errorLista}</p>}
          {/* UNA lista (21/10/2026): el Cerebro arriba y todos los demás por actividad, sin plegables; desde el 22/10, agrupados por
              su origen («Offer › …», «Dashboard › …») con el MISMO agrupado del super admin (`GruposPorJefe`). */}
          {k.sesiones != null && (
            <>
              <div className="co-cuenta co-cuenta--cerebro">{fila(cerebroFila)}</div>
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
        <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja}
          // La criatura del chat: el Cerebro es la estrella; uno de Offer, la de Offer (la cabecera del super admin, sin chips).
          cabecera={{ clave: JSON.stringify(elegido), titulo: k.nombre, criatura: k.nombreMuneco, aspecto: k.aspectoMuneco, animo: k.enCurso ? 'trabajando' : 'despierto', onVolver: () => setConChat(false) }}
          // Los fijados, arriba de la conversación (WhatsApp): tocar va al mensaje.
          arriba={<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={k.nombre} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />}
          despues={<>
            <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} />
            {k.infoWA && <Modal titulo="Info del mensaje" onCerrar={() => k.setInfoWA(null)} ancho={460}><InfoMensaje m={k.infoWA} /></Modal>}
          </>}
          caja={<div className="co-caja"><CajaDelCliente k={k} campo={caja} seguir={seguirHilo} /></div>}
          estado={estadoDelCliente(k)}>
          <HiloDelCliente k={k} />
        </PanelDeChat>
      )}
      {centro && <MenusCentro centro={centro} />}
      {/* «Tus cuentas de IA» ahí mismo (/perfil/ia): conectar su computadora con su Claude o, si es admin, la clave. */}
      {k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { k.setConectando(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>
      )}
    </div>
  );
}
