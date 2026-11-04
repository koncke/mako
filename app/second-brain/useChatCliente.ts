'use client';

// =============================================================================
// El motor del Ops Center del cliente: UNO para la computadora y el teléfono (22/10/2026)
// =============================================================================
// Martín (21/10): «el ops center de los clientes se ve muy mal comparado al de SuperAdmin... Computadora Y teléfono». La
// computadora (app/second-brain/ChatSecondBrain.tsx) y el teléfono (app/m/second-brain/ChatClienteM.tsx) dibujan con las
// piezas del super admin, cada uno las suyas; lo que pasa por debajo es ESTO, una vez, como useCentro.ts lo es para los
// chats de Claude Code («hoy está escrita dos veces» era la falla que marcaba el diseño de la tanda 5).
//   · la lista: las conversaciones con MaKo de la persona, las de Offer del negocio y los chats de antes, en UNA
//     (lib/chat-mako-reglas.ts → listaDelCliente), con el Cerebro arriba;
//   · el hilo de lo elegido, con SU motor: el turno de MaKo (/api/mako/chat, con `antes` para un chat de antes) o el de
//     Offer (motor-offer.ts);
//   · la caja: el texto, lo adjuntado, lo pegado largo, la cita del mensaje que se responde;
//   · lo de WhatsApp de cada mensaje (las marcas de la persona, lib/chat-mako-marcas-db.ts) y si ya tiene SU IA.
// ⚠️ LO QUE NO SE REINTENTA (el mismo criterio del teléfono y del CRM, app/m/mako/chat-ui.ts): un turno que pudo haber
//    corrido (red caída, corte, 5xx) ya pudo dejar una acción pendiente: se dice «no sé si llegó» y se ofrece recargar.
// ⚠️ UN CHAT NUEVO NO SE CREA AL APRETAR «Nuevo chat»: se crea con el primer mensaje (sin conversaciones vacías).
// ⚠️ LO ELEGIDO LO LLEVA QUIEN LO MONTA (`elegido`): en la computadora del super admin lo comparte con los chats de Claude Code.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import type { AccionesWA, MenuAbiertoWA, MensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { copiar } from '@/app/admin/operaciones/mandar';
import { NO_PUDE_COPIAR } from '@/lib/copiar-texto';
import { SIN_MARCAS, aplicarMarca, armarConCita, type CambioMarca, type Cita, type MarcasChat } from '@/lib/centro-mensajes';
import type { ItemPropuesta } from '@/app/_chat/TarjetaAccion';
import {
  archivosDeRespuesta, conSinRespuesta, idLocal, itemsDeOffer, itemsDeRespuesta, itemsDeSesion, conTarjeta, leerRespuesta, mensajeWADe, opcionesDeOffer, respuestaDeOffer,
  textoTapadoDeRespuesta, problemaDeSeleccion, tipoDeElegido, trasTarjeta, trasTrabajo, type EstadoPropuesta, type ItemHilo, type Leido,
} from '@/app/m/mako/chat-ui';
import { achicarImagen } from '@/app/m/mako/subir';
import { abrirOffer, armarOffer, turnoOffer, type NotaDeVoz } from './motor-offer';
import { notaEnMp3 } from './nota-de-voz';
import { esOpcionArmar } from '@/app/offer/ayudas';
import { conPegados, esPegadoLargo } from '@/lib/chat-pegado';
import { ACCEPT_ADJUNTOS_CHAT, ERROR_ADJUNTO } from '@/lib/mako-adjuntos';
import {
  EDITORES, JEFE_SECOND_BRAIN, NOMBRE_JEFE, SECCION_OFFER, SIN_TITULO, colgarIrA, criaturaDeOffer, esFilaDe, linksDePedidos, listaDelCliente, partesDeClaveDeEditor, rutaDelLienzo,
  type AppDeEscritorio, type ElegidoChat, type IrA,
} from '@/lib/chat-mako-reglas';
import type { ChatDeAntes, ChatDeAutomatizacion, ChatDeEditor, ChatDeOffer } from '@/lib/chat-mako-indice';
import { etiquetaDesde, type Desde } from '@/lib/chat-desde';
import { aspectoDeChat, aspectoDeReferente, type Aspecto } from '@/lib/centro-munecos';
import type { MensajeChat, PropuestaPantalla, ResultadoTarjeta, RespuestaTurno, SesionChat, TarjetaPendiente } from '@/lib/mako-turno-app-reglas';
import type { OfferSesionVista } from '@/lib/offer-marco';
import { eleccionVigente, resumenDeIA, type CuentaDeIA, type EleccionIA } from '@/lib/chat-ia-reglas';

export const RUTA = '/api/mako/chat';
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

type Abierta = { sesion: SesionChat; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[]; pantallas?: PropuestaPantalla[] };
type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;
/** Un archivo elegido en la caja, antes de mandar. `url` es su vista previa (`blob:`): la usa también la burbuja
 *  mientras sale, y se suelta cuando vuelve guardado o cuando se quita. */
type ArchivoElegido = { id: string; file: File; tipo: 'image' | 'document'; url: string };
/** Una nota de voz de la caja: el binario, cuánto dura, su URL `blob:` (la del reproductor mientras sale) y de qué chat (su clave). */
type NotaEnLaCaja = NotaDeVoz & { url: string; chat: string };
/**
 * Cómo terminó mandar una nota: salió (o quedó guardada) y ya se escucha desde el servidor; vuelve a la barra para reintentar;
 * se tira (el motivo ya se dijo); o quedó en el hilo con su URL local (no se sabe si llegó, o no se pudo guardar el audio).
 */
type FinDeNota = 'salio' | 'volver' | 'tirar' | 'quedo';
/** Lo que el servidor ya dijo que no va a entrar igual: muy pesada, un formato que no es, o se escuchó y no había voz. */
const NOTA_DEFINITIVA = new Set([413, 415, 422]);
export type Pegado = { id: string; texto: string };

export async function pedir<T>(url: string, init: RequestInit = {}): Promise<Leido<T>> {
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
const postArchivos = <T,>(sessionId: number, mensaje: string, archivos: readonly ArchivoElegido[], antes: boolean, desde: Desde | null,
  voz: { mp3: Blob; secs: number } | null = null, ia: EleccionIA = null) => {
  const fd = new FormData();
  fd.append('sessionId', String(sessionId));
  fd.append('mensaje', mensaje);
  if (antes) fd.append('antes', '1');
  if (desde) fd.append('desde', JSON.stringify(desde));
  // Con qué IA corre ESTE chat (8b), sólo si se eligió algo: sin el campo, Automático (lo decide el chat jefe).
  if (ia) fd.append('ia', JSON.stringify(ia));
  for (const a of archivos) fd.append('adjuntos', a.file, a.file.name);
  // La nota de voz (OC7): SOLA, en MP3. La ruta la escucha con la IA del negocio antes de guardar nada.
  if (voz) { fd.append('voz', voz.mp3, 'nota-de-voz.mp3'); fd.append('vozSecs', String(voz.secs)); }
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

export type ChatCliente = ReturnType<typeof useChatCliente>;

export function useChatCliente({ elegido, setElegido, activo, entrarAlCerebro, chatInicial, opcionArmar, busca, caja, sesionesIniciales = null, desde: desdeTab = null, tab: tabPropia = null, aspectoOffer = null, quien = null }: {
  elegido: ElegidoChat | null;
  setElegido: Dispatch<SetStateAction<ElegidoChat | null>>;
  /** Lee Offer, los chats de antes y si tiene su IA. En el Ops Center del super admin la lista es la de Claude Code: no. */
  activo: boolean;
  /** Sin nada elegido al llegar la lista, abre el Cerebro (la computadora del cliente). */
  entrarAlCerebro: boolean;
  /** `?chat=`: la conversación que se abre al entrar, si es de la persona. */
  chatInicial: number | null;
  /** «Armar mi oferta» (lib/offer-reglas.ts → OPCION_ARMAR, que baja de la página). */
  opcionArmar: string;
  busca: string;
  /** El campo de la caja: responder un mensaje y elegir un chat lo enfocan. */
  caja: RefObject<HTMLTextAreaElement | null>;
  /** Las conversaciones que ya leyó el servidor (el teléfono las trae en el HTML: la lista se ve sin esperar). */
  sesionesIniciales?: SesionChat[] | null;
  /** Desde dónde escribe (OC6, lib/chat-desde.ts): la estrella de una tab, con su entidad y su modo. Viaja con cada mensaje. */
  desde?: Desde | null;
  /** La tab con chat propio de la persona (el Second Brain, 23/10/2026: lib/chat-mako-reglas.ts → TAB_SECOND_BRAIN): el primer
   *  mensaje crea ESA conversación (una por persona y negocio) y se sigue como las de las tabs (`antes`). */
  tab?: string | null;
  /** La criatura de los chats de Offer: la del referente que tiene al frente el coach, del que cuelgan (1/11/2026; uno solo desde el 4/11). Sin esto, la de cada chat. */
  aspectoOffer?: Aspecto | null;
  /** Quién contesta en un chat que se abre sin la lista (`activo: false`): el gurú o el coach. Sin esto no hay fila de la que sacarlo, y el
   *  hilo dibujaba una criatura sorteada con «Sin título» de nombre (Martín, 3/11/2026: «el que responde es una criatura de mako»). */
  quien?: { nombre: string; aspecto: Aspecto } | null;
}) {
  const ws = useWs();
  const [sesiones, setSesiones] = useState<SesionChat[] | null>(sesionesIniciales);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [items, setItems] = useState<ItemHilo[]>([]);
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [faltaMic, setFaltaMic] = useState<string | null>(null);
  /** Una nota de voz que no llegó a salir (se grabó mientras MaKo contestaba, o se cortó): vuelve a la barra para mandarla. */
  const [notaEnEspera, setNotaEnEspera] = useState<NotaEnLaCaja | null>(null);
  const [trabajo, setTrabajo] = useState<{ desde: number } | null>(null);
  const [segs, setSegs] = useState(0);
  const [tarjeta, setTarjeta] = useState<{ id: number; accion: 'confirmar' | 'cancelar' } | null>(null);
  /** Los chats de «Pregúntale a MaKo» (null = todavía no llegaron). Van en la MISMA lista y se siguen (21/10/2026). */
  const [antes, setAntes] = useState<ChatDeAntes[] | null>(null);
  /** Las conversaciones de Offer del negocio (20/10/2026, Martín: «el chat de OFFER no está llegando al Ops Center»): una
   *  proyección de offer_sesiones (lib/chat-mako-indice.ts → chatsDeOffer), con la puerta de la tab. null = todavía no llegó. */
  const [offer, setOffer] = useState<ChatDeOffer[] | null>(null);
  /** Las charlas del lienzo de Automations (22/10/2026, OC5): se leen acá y se siguen en el lienzo. */
  const [automations, setAutomations] = useState<ChatDeAutomatizacion[] | null>(null);
  /** Los chats del Image Editor y del Video Editor (22/10/2026, OC8): se leen acá y se siguen en el editor. */
  const [editores, setEditores] = useState<ChatDeEditor[] | null>(null);
  /** La conversación de Offer abierta, entera (sus opciones, su diagnóstico, si se está armando): la da el motor de Offer. */
  const [deOfferAbierta, setDeOfferAbierta] = useState<OfferSesionVista | null>(null);
  const offerRef = useRef<OfferSesionVista | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  /** La URL de una nota de voz con el `?ws=` del negocio que se mira (un `<audio src>` no pasa por el `fetch` de la casa). */
  const conWsDeAudio = useCallback((url: string) => conWs(url, ws), [ws]);
  const ocupadoRef = useRef(false);
  const sesionRef = useRef<number | null>(null);
  /** La conversación que se acaba de crear con el primer mensaje: su hilo YA está dibujado, no se recarga. */
  const recienCreada = useRef<number | null>(null);
  const envios = useRef(new Map<string, { texto: string; archivos: ArchivoElegido[] }>());
  /** Los archivos elegidos en la caja (el ref los tiene al día para sumar sin esperar un render). */
  const [elegidos, setElegidos] = useState<ArchivoElegido[]>([]);
  const elegidosRef = useRef<ArchivoElegido[]>([]);
  const ponerElegidos = (xs: ArchivoElegido[]) => { elegidosRef.current = xs; setElegidos(xs); };
  /** Los textos pegados de más de 1.000 caracteres (#864): no van a la caja, van como un documento con el mensaje
   *  (lib/chat-pegado.ts). El ref los tiene al día, como el de los archivos. */
  const [pegados, setPegados] = useState<Pegado[]>([]);
  const pegadosRef = useRef<Pegado[]>([]);
  const ponerPegados = (xs: Pegado[]) => { pegadosRef.current = xs; setPegados(xs); };
  /** Lo de WhatsApp del chat abierto: las marcas de la persona, la cita de la caja, el menú de un mensaje y su «Info». */
  const [marcas, setMarcas] = useState<MarcasChat>(SIN_MARCAS);
  const [cita, setCita] = useState<Cita | null>(null);
  const [menuWA, setMenuWA] = useState<MenuAbiertoWA | null>(null);
  const [infoWA, setInfoWA] = useState<MensajeWA | null>(null);
  /** ¿Ya conectó su Claude o su GPT? null = todavía no se sabe (el botón no aparece hasta saberlo). */
  const [iaConectada, setIaConectada] = useState<boolean | null>(null);
  /** ¿Instaló la app de escritorio? (23/10/2026, lib/chat-mako-reglas.ts → appDeEscritorio). null = todavía no se sabe. */
  const [app, setApp] = useState<AppDeEscritorio | null>(null);
  // CON QUÉ IA CORRE CADA CHAT (8b, 23/10/2026, Martín: «el "+" de la caja deja elegir con qué corre ese chat: el modelo y la
  // cuenta… Por defecto decide el chat jefe»). Las cuentas que se pueden elegir las arma el servidor (`?suIA=1` → `cuentas`,
  // lib/chat-ia-reglas.ts): sin ellas no hay selector. Lo elegido, por chat y en esta pestaña, como la cuenta del super admin.
  const [cuentasIA, setCuentasIA] = useState<CuentaDeIA[] | null>(null);
  const [iaDe, setIaDe] = useState<Record<string, EleccionIA>>({});
  const [conectando, setConectando] = useState(false);

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
      setElegido((prev) => prev ?? (pedida != null ? { id: pedida } : entrarAlCerebro ? jefe : null));
    });
    return () => { vivo = false; };
  }, [cargarLista, chatInicial, entrarAlCerebro, setElegido]);

  // Las conversaciones de Offer y los chats de antes, una vez (no en Ops Center: ahí la lista es la de Claude Code).
  const cargarOtros = useCallback(() => {
    void pedir<{ offer: ChatDeOffer[] }>(`${RUTA}?offer=1`).then((l) => setOffer(l.ok ? l.datos.offer ?? [] : []));
    void pedir<{ antes: ChatDeAntes[] }>(`${RUTA}?antes=1`).then((l) => setAntes(l.ok ? l.datos.antes ?? [] : []));
    void pedir<{ automations: ChatDeAutomatizacion[] }>(`${RUTA}?automations=1`).then((l) => setAutomations(l.ok ? l.datos.automations ?? [] : []));
    void pedir<{ editores: ChatDeEditor[] }>(`${RUTA}?editores=1`).then((l) => setEditores(l.ok ? l.datos.editores ?? [] : []));
  }, []);
  useEffect(() => { if (activo) cargarOtros(); }, [activo, cargarOtros]);
  const mirarSuIA = useCallback(() => {
    void pedir<{ conectada: boolean; cuentas?: CuentaDeIA[]; app?: AppDeEscritorio }>(`${RUTA}?suIA=1`).then((l) => {
      setIaConectada(l.ok ? l.datos.conectada !== false : true);
      // La app de escritorio (23/10/2026): sin saberlo, `tiene` (un bache no le tapa el chat a nadie).
      setApp(l.ok && (l.datos.app === 'bloquea' || l.datos.app === 'en-la-computadora') ? l.datos.app : 'tiene');
      setCuentasIA(l.ok && Array.isArray(l.datos.cuentas) && l.datos.cuentas.length ? l.datos.cuentas : null);
    });
  }, []);
  useEffect(() => { if (activo) mirarSuIA(); }, [activo, mirarSuIA]);
  // BLOQUEADO SIN LA APP, SE DESTRABA SOLO (23/10/2026): mientras falta, se vuelve a preguntar; en cuanto la computadora se conecta,
  // el chat aparece sin recargar. Sólo con la pestaña a la vista.
  useEffect(() => {
    if (app !== 'bloquea') return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') mirarSuIA(); }, 8_000);
    return () => window.clearInterval(t);
  }, [app, mirarSuIA]);

  // ── El hilo de lo elegido ──
  const idElegido = elegido && 'id' in elegido ? elegido.id : null;
  const idAntes = elegido && 'antes' in elegido ? elegido.antes : null;
  const idOffer = elegido && 'offer' in elegido ? elegido.offer : null;
  /** Una charla del lienzo de Automations: se LEE acá y se sigue en el lienzo (`hrefLienzo`). */
  const idAutomatizacion = elegido && 'automatizacion' in elegido ? elegido.automatizacion : null;
  const esAutomatizacion = idAutomatizacion != null;
  /** Un chat de un editor (OC8): se LEE acá y se sigue en el editor (`hrefEditor`). */
  const deEditor = elegido && 'editor' in elegido ? elegido : null;
  const esEditor = deEditor != null;
  /** ¿Lo elegido es un chat del cliente (con MaKo, de Offer o de antes)? Un chat de Claude Code, no. */
  const esDelCliente = elegido != null && !('centro' in elegido) && !('coach' in elegido);
  /** La sesión de chart_sessions a la que va el turno: la conversación con MaKo, o el chat de antes que se sigue. */
  const idTurno = idElegido ?? idAntes;
  /** El chat de las marcas (lib/chat-mako-marcas-db.ts): el de la lista. Uno nuevo, todavía ninguno. */
  const chatDeMarcas = idOffer != null ? `o${idOffer}` : idAntes != null ? `a${idAntes}` : idElegido != null ? `s${idElegido}` : null;
  useEffect(() => {
    setMarcas(SIN_MARCAS); setCita(null); setMenuWA(null); setInfoWA(null);
    if (!chatDeMarcas) return;
    let vivo = true;
    void pedir<{ marcas: MarcasChat }>(`${RUTA}?marcas=${chatDeMarcas}`).then((l) => { if (vivo && l.ok) setMarcas(l.datos.marcas ?? SIN_MARCAS); });
    return () => { vivo = false; };
  }, [chatDeMarcas]);
  /** Una marca se ve en el acto y se guarda; si no se pudo guardar, vuelve a como estaba. */
  const ponerMarca = async (c: CambioMarca) => {
    if (!chatDeMarcas) return;
    const antesDeMarcar = marcas;
    setMarcas(aplicarMarca(antesDeMarcar, c));
    const l = await postJson<{ marcas: MarcasChat }>({ action: 'marcar', chat: chatDeMarcas, cambio: c });
    if (l.ok) setMarcas(l.datos.marcas); else { setMarcas(antesDeMarcar); setFaltaMic(l.error); }
  };
  const ponerMarcaRef = useRef(ponerMarca);
  useLayoutEffect(() => { ponerMarcaRef.current = ponerMarca; });
  const cargarHilo = useCallback(async (id: number, deAntes: boolean, vigente: () => boolean = () => true) => {
    setCargado(false); setErrorCarga(null);
    const l = await pedir<Abierta>(`${RUTA}?sessionId=${id}${deAntes ? '&antes=1' : ''}`);
    if (!vigente()) return;
    if (!l.ok) { setErrorCarga(l.reintentable ? l.error : 'No pude abrir el chat.'); setCargado(true); return; }
    // Lo último de la persona sin respuesta (un turno que falló: su aviso no se guarda) se dice, con «Reintentar».
    setItems(conSinRespuesta(itemsDeSesion(l.datos.mensajes ?? [], l.datos.propuestas ?? [], l.datos.pantallas ?? [], conWsDeAudio), Date.now()));
    setCargado(true);
  }, [conWsDeAudio]);

  /**
   * Una conversación de Offer: lo que se DIBUJA es la proyección (lib/chat-mako-indice.ts → hiloDeOffer: la conversación con el
   * arranque del onboarding unido por hora y sus notas de voz), y lo que se SIGUE es la sesión de Offer (sus opciones, su
   * diagnóstico, si se está armando: motor-offer.ts). Sin la proyección, el arranque de un onboarding no se veía (el chat
   * Onboarding, 22/10/2026). Si la proyección no llega, se dibuja la de Offer.
   */
  const ponerOffer = useCallback(async (s: OfferSesionVista) => {
    offerRef.current = s;
    setDeOfferAbierta(s);
    const l = await pedir<{ mensajes: MensajeChat[] }>(`${RUTA}?offerId=${s.id}`);
    if (offerRef.current?.id !== s.id) return;
    if (!l.ok) { setItems(itemsDeOffer(s.mensajes, conWsDeAudio)); return; }
    const op = opcionesDeOffer(s.mensajes);
    setItems([...itemsDeSesion(l.datos.mensajes ?? [], [], [], conWsDeAudio), ...(op ? [op] : [])]);
  }, [conWsDeAudio]);

  useEffect(() => {
    if (!esDelCliente) return;
    sesionRef.current = idTurno;
    offerRef.current = null;
    setDeOfferAbierta(null);
    if (deEditor) {
      let vivo = true;
      setCargado(false); setErrorCarga(null);
      void pedir<{ mensajes: MensajeChat[] }>(`${RUTA}?editor=${deEditor.editor}&editorClave=${encodeURIComponent(deEditor.clave)}`).then((l) => {
        if (!vivo) return;
        if (!l.ok) { setErrorCarga(l.reintentable ? l.error : 'No pude abrir la charla.'); setCargado(true); return; }
        setItems(itemsDeSesion(l.datos.mensajes ?? [], []));
        setCargado(true);
      });
      return () => { vivo = false; };
    }
    if (idAutomatizacion != null) {
      let vivo = true;
      setCargado(false); setErrorCarga(null);
      void pedir<{ mensajes: MensajeChat[] }>(`${RUTA}?automatizacionId=${idAutomatizacion}`).then((l) => {
        if (!vivo) return;
        if (!l.ok) { setErrorCarga(l.reintentable ? l.error : 'No pude abrir la charla.'); setCargado(true); return; }
        setItems(itemsDeSesion(l.datos.mensajes ?? [], []));
        setCargado(true);
      });
      return () => { vivo = false; };
    }
    if (idOffer != null) {
      // Una conversación de Offer: se abre con SU motor (motor-offer.ts) y se sigue acá.
      let vivo = true;
      setCargado(false); setErrorCarga(null);
      void abrirOffer(idOffer).then(async (l) => {
        if (!vivo) return;
        if (!l.ok) { setErrorCarga(l.error); setCargado(true); return; }
        await ponerOffer(l.sesion);
        if (vivo) setCargado(true);
      });
      return () => { vivo = false; };
    }
    if (idTurno == null) { setItems([]); setErrorCarga(null); setCargado(true); return; }
    if (recienCreada.current === idTurno) { recienCreada.current = null; return; }
    let vivo = true;
    void cargarHilo(idTurno, idAntes != null, () => vivo);
    return () => { vivo = false; };
  }, [elegido, esDelCliente, idAutomatizacion, deEditor?.editor, deEditor?.clave, idTurno, idAntes, idOffer, cargarHilo, ponerOffer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mientras Offer arma la oferta por detrás (`armar`), la conversación se relee: la oferta aparece sola, con su PDF.
  const armandoOffer = idOffer != null && !!deOfferAbierta?.armando?.corriendo;
  useEffect(() => {
    if (!armandoOffer || idOffer == null) return;
    const t = window.setInterval(() => {
      void abrirOffer(idOffer).then((l) => { if (l.ok && offerRef.current?.id === idOffer) void ponerOffer(l.sesion); });
    }, RELEER_ARMADO_MS);
    return () => window.clearInterval(t);
  }, [armandoOffer, idOffer, ponerOffer]);

  const desde = trabajo?.desde ?? null;
  useEffect(() => {
    if (desde == null) return;
    const t = window.setInterval(() => setSegs(Math.floor((Date.now() - desde) / 1000)), 1000);
    return () => { window.clearInterval(t); setSegs(0); };
  }, [desde]);

  const recargar = () => {
    if (ocupadoRef.current) return;
    if (idOffer != null) { void abrirOffer(idOffer).then((l) => { if (l.ok) void ponerOffer(l.sesion); }); return; }
    if (idTurno != null) void cargarHilo(idTurno, idAntes != null);
  };

  // ── Lo de WhatsApp en cada mensaje (MensajeWA.tsx, el del super admin) ──
  const accionesWA = useMemo<AccionesWA>(() => ({
    abrirMenu: (m, x, y, tactil) => setMenuWA({ m, x, y, tactil }),
    responder: (m) => { setCita({ de: m.de, texto: m.texto, id: m.id }); window.setTimeout(() => caja.current?.focus(), 0); },
    reaccionar: (id, emoji) => void ponerMarcaRef.current({ tipo: 'reaccion', id, emoji }),
  }), [caja]);
  const elegirEnMenu = (m: MensajeWA, id: string) => {
    setMenuWA(null);
    if (id.startsWith('reaccion:')) { const e = id.slice('reaccion:'.length); void ponerMarca({ tipo: 'reaccion', id: m.id, emoji: marcas.reacciones[m.id] === e ? null : e }); return; }
    if (id === 'responder') { accionesWA.responder(m); return; }
    if (id === 'copiar') { void copiar(m.texto).then((ok) => setFaltaMic(ok ? 'Copiado' : NO_PUDE_COPIAR)); return; }
    if (id === 'info') { setInfoWA(m); return; }
    if (id === 'destacar') { void ponerMarca({ tipo: 'destacar', id: m.id, si: !marcas.destacados.includes(m.id) }); return; }
    if (id === 'fijar') { void ponerMarca({ tipo: 'fijar', id: m.id, si: !marcas.fijados.includes(m.id) }); return; }
    if (id === 'eliminar') { void ponerMarca({ tipo: 'ocultar', id: m.id }); if (cita?.id === m.id) setCita(null); }
  };

  /** Elegir otro chat: la caja arranca limpia (lo adjuntado y lo pegado eran del de antes). `false` = está mandando. */
  const elegir = (e: ElegidoChat): boolean => {
    if (ocupadoRef.current) return false;
    setFaltaMic(null);
    for (const a of elegidosRef.current) URL.revokeObjectURL(a.url);
    ponerElegidos([]);
    ponerPegados([]);
    setElegido(e);
    setTexto('');
    window.setTimeout(() => caja.current?.focus({ preventScroll: true }), 0);
    return true;
  };

  const marcar = (id: string, cambio: Partial<ItemMsg>) =>
    setItems((xs) => xs.map((x) => (x.id === id && x.k === 'msg' ? { ...x, ...cambio } : x)));

  // ── El turno ──
  const mandar = async (idU: string, mensaje: string, archivos: readonly ArchivoElegido[]) => {
    setTrabajo({ desde: Date.now() });
    const deAntes = idAntes != null || tabPropia != null;
    const ia = iaDelChat;
    // Arranca ya, junto con el turno (tarda segundos; el turno, decenas).
    const irA = linksDelPedido(mensaje);
    try {
      let sid = sesionRef.current;
      if (sid == null) {
        // El primer mensaje crea la conversación (el jefe que todavía no tenía, o un chat nuevo).
        const n = await postJson<{ sesion: SesionChat }>({ action: 'new', ...(tabPropia ? { tab: tabPropia } : {}) });
        if (!n.ok) { marcar(idU, { estado: 'error', error: n.reintentable ? n.error : 'No pude crear el chat.' }); return; }
        sid = n.datos.sesion.id;
        sesionRef.current = sid;
        recienCreada.current = sid;
        // La de una tab con chat propio (el Second Brain) no va en la lista de la persona: se sigue como las de las tabs.
        if (tabPropia) setElegido({ antes: sid });
        else { setSesiones((ss) => [...(ss ?? []), n.datos.sesion]); setElegido({ id: sid }); }
        pasarIaAlCreado(sid);
      }
      const l = archivos.length
        ? await postArchivos<RespuestaTurno>(sid, mensaje, archivos, deAntes, desdeTab, null, ia)
        : await postLargo<RespuestaTurno>({ action: 'send', sessionId: sid, mensaje, ...(deAntes ? { antes: 1 } : {}), ...(desdeTab ? { desde: desdeTab } : {}), ...(ia ? { ia } : {}) });
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
  const mandarAOffer = async (idU: string, mensaje: string, archivos: readonly ArchivoElegido[] = [], nota: NotaDeVoz | null = null): Promise<FinDeNota> => {
    const s = offerRef.current;
    if (!s) return 'volver';
    setTrabajo({ desde: Date.now() });
    try {
      const ultimo = s.mensajes[s.mensajes.length - 1];
      if (!nota && ultimo?.de === 'mako' && !ultimo.pregunta && s.puedeConcluir && esOpcionArmar(mensaje, opcionArmar)) {
        setItems((xs) => xs.filter((x) => x.id !== idU));
        const a = await armarOffer(s.id);
        if (a.ok) await ponerOffer(a.sesion); else setFaltaMic(a.error);
        return 'salio';
      }
      // Con los archivos del «+» y la nota de voz (OC7): se suben (y se leen) en ESTA conversación antes del turno, como en la tab.
      const r = await turnoOffer(s.id, mensaje, s.mensajes, respuestaDeOffer(s.mensajes, mensaje), archivos.map((a) => a.file), nota);
      if (r.ok || r.guardado) {
        if (r.sesion && offerRef.current?.id === s.id) await ponerOffer(r.sesion);
        // Guardado pero MaKo no contestó: el error va en la línea de estado, y lo dicho no se vuelve a mandar.
        if (!r.ok) setFaltaMic(r.error);
        cargarOtros();
        return 'salio';
      }
      // No salió. La nota vuelve a la barra (o se tira, si el servidor ya dijo que no entra); el texto queda con «Reintentar».
      if (nota) { setItems((xs) => xs.filter((x) => x.id !== idU)); setFaltaMic(r.error); }
      else marcar(idU, { estado: 'error', error: r.error });
      return r.definitivo ? 'tirar' : 'volver';
    } finally {
      ocupadoRef.current = false;
      setTrabajo(null);
    }
  };

  /**
   * La nota de voz a un chat de MaKo (OC7): en MP3 a /api/mako/chat, que la escucha con la IA del negocio ANTES de guardar nada
   * y corre el turno con lo que entendió. Rechazada antes del turno (un 4xx), no se guardó nada: vuelve a la barra, o se tira si
   * lo mismo no va a entrar. Sin saber si llegó (un corte, un 5xx), queda en el hilo «incierto», como un texto.
   */
  const mandarNotaAlChat = async (idU: string, a: NotaDeVoz): Promise<FinDeNota> => {
    setTrabajo({ desde: Date.now() });
    const deAntes = idAntes != null || tabPropia != null;
    const ia = iaDelChat;
    const sacar = (error: string) => { setItems((xs) => xs.filter((x) => x.id !== idU)); setFaltaMic(error); };
    try {
      let mp3: Blob;
      try { mp3 = await notaEnMp3(a.blob); } catch (e) { sacar(e instanceof Error ? e.message : 'No se pudo procesar el audio.'); return 'tirar'; }
      let sid = sesionRef.current;
      if (sid == null) {
        // La primera nota crea la conversación, como el primer mensaje (`mandar`).
        const n = await postJson<{ sesion: SesionChat }>({ action: 'new', ...(tabPropia ? { tab: tabPropia } : {}) });
        if (!n.ok) { sacar(n.reintentable ? n.error : 'No pude crear el chat.'); return 'volver'; }
        sid = n.datos.sesion.id;
        sesionRef.current = sid;
        recienCreada.current = sid;
        // La de una tab con chat propio (el Second Brain) no va en la lista de la persona: se sigue como las de las tabs.
        if (tabPropia) setElegido({ antes: sid });
        else { setSesiones((ss) => [...(ss ?? []), n.datos.sesion]); setElegido({ id: sid }); }
        pasarIaAlCreado(sid);
      }
      const l = await postArchivos<RespuestaTurno>(sid, '', [], deAntes, desdeTab, { mp3, secs: Math.max(1, Math.round(a.secs)) }, ia);
      if (!l.ok) {
        if (!l.reintentable) { marcar(idU, { estado: 'incierto', error: l.error }); return 'quedo'; }
        sacar(l.error);
        return l.status != null && NOTA_DEFINITIVA.has(l.status) ? 'tirar' : 'volver';
      }
      // Lo que se entendió va debajo de la nota; y la nota pasa a escucharse desde el servidor (si se pudo guardar).
      const yo = l.datos.mensajes.find((m) => m.role === 'user');
      const delServidor = yo?.audio?.url ? { url: conWsDeAudio(yo.audio.url), secs: yo.audio.secs } : null;
      marcar(idU, { estado: undefined, error: undefined, texto: yo?.content ?? '', ...(delServidor ? { voz: delServidor } : {}) });
      setItems((xs) => {
        const vistas = new Set(xs.flatMap((x) => (x.k === 'propuesta' ? [x.t.pendienteId] : [])));
        return [...xs, ...itemsDeRespuesta(l.datos, vistas)];
      });
      if (deAntes) cargarOtros(); else void cargarLista();
      return delServidor ? 'salio' : 'quedo';
    } finally {
      ocupadoRef.current = false;
      setTrabajo(null);
    }
  };

  /**
   * LA NOTA DE VOZ (OC7, 22/10/2026): el micrófono GRABA, como en la tab de Offer, y la nota se escucha en el hilo con lo que se
   * entendió debajo. En una conversación de Offer va a SU motor (la escucha el servidor de Offer); en un chat de MaKo, a la ruta
   * del chat. Las dos la escuchan con la IA del negocio. Con MaKo contestando, o si el chat cambió, espera en la barra.
   */
  const mandarNota = async (a: NotaEnLaCaja, chatAbierto: string) => {
    if (esAutomatizacion || esEditor) return;
    if (a.chat !== chatAbierto || ocupadoRef.current || !cargado || errorCarga) { setNotaEnEspera(a); return; }
    ocupadoRef.current = true;
    setFaltaMic(null);
    const idU = idLocal('u');
    setItems((xs) => [...xs, { k: 'msg', id: idU, role: 'user', texto: '', at: new Date().toISOString(), estado: 'enviando', voz: { url: a.url, secs: Math.max(1, Math.round(a.secs)) } }]);
    const fin = idOffer != null ? await mandarAOffer(idU, '', [], a) : await mandarNotaAlChat(idU, a);
    // La URL local se suelta cuando ya no se dibuja: lo que salió se escucha desde el servidor. La que quedó en el hilo, no.
    if (fin === 'volver') setNotaEnEspera(a); else if (fin !== 'quedo') URL.revokeObjectURL(a.url);
  };

  const enviar = (mensaje: string, archivos: readonly ArchivoElegido[] = []): boolean => {
    const t = mensaje.trim();
    // Una charla del lienzo no se sigue desde acá: se sigue en el lienzo (`AVISO_LIENZO`).
    // Sin la app de escritorio, el chat no manda nada (tampoco un pedido de la tab: el «Hacerlo» de una sugerencia).
    if (esAutomatizacion || esEditor || (!t && !archivos.length) || ocupadoRef.current || !cargado || errorCarga || app === 'bloquea') return false;
    ocupadoRef.current = true;
    setFaltaMic(null);
    const idU = idLocal('u');
    envios.current.set(idU, { texto: t, archivos: [...archivos] });
    const locales = archivos.map((a) => ({ nombre: a.file.name, tipo: a.tipo, local: a.url }));
    setItems((xs) => [...xs, { k: 'msg', id: idU, role: 'user', texto: t, at: new Date().toISOString(), estado: 'enviando', ...(locales.length ? { archivos: locales } : {}), ...(desdeTab ? { desde: etiquetaDesde(desdeTab) } : {}) }]);
    if (idOffer != null) void mandarAOffer(idU, t, archivos); else void mandar(idU, t, archivos);
    return true;
  };

  const enviarCaja = () => {
    // Con la cita del mensaje que se responde arriba (WhatsApp; lib/centro-mensajes.ts → armarConCita, la del super admin).
    const t = armarConCita(cita, texto.trim());
    const pg = pegadosRef.current.map((p) => p.texto);
    if ((!t && !elegidosRef.current.length && !pg.length) || ocupadoRef.current) return;
    // La vista previa NO se suelta acá: la burbuja que sale la sigue mostrando hasta que vuelve guardada. Los pegados
    // salen DENTRO del mensaje, entre sus marcas: el hilo los dibuja como documento y el turno los archiva (#884).
    if (enviar(conPegados(t, pg), elegidosRef.current)) { setTexto(''); ponerElegidos([]); ponerPegados([]); setCita(null); }
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
   *  En una conversación de Offer también: se suben y se leen en ella (motor-offer.ts → leerArchivosDeOffer). ⚠️ OC7 hizo la
   *  lectura y dejó esta puerta cerrada (`idOffer == null`): los documentos de Offer nunca llegaban (tests/ops-center-offer-voz). */
  const adjuntosCaja: AdjuntosDeCaja = {
    items: elegidos, puede: cargado && !errorCarga, onSumar: (fs) => void sumarArchivos(fs), onQuitar: quitarArchivo, accept: ACCEPT_ADJUNTOS_CHAT,
    onNoPuede: () => setFaltaMic('Espera a que cargue la conversación para sumar archivos.'),
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
  const quitarPegado = (id: string) => ponerPegados(pegadosRef.current.filter((x) => x.id !== id));

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
  const alTerminarTrabajo = (pendienteId: number, ok: boolean | null) => setItems((xs) => trasTrabajo(xs, pendienteId, ok));

  // ── Lo que se dibuja ──
  // Cada fila con SU criatura (lib/centro-munecos.ts → aspectoDeChat): el Cerebro, la estrella (sale de su nombre).
  const lista = useMemo(() => listaDelCliente({ sesiones: sesiones ?? [], offer: offer ?? [], antes: antes ?? [], busca, automations: automations ?? [], editores: editores ?? [] })
    .map((f) => ({ ...f, aspecto: f.clave === 'jefe' ? null : f.guru ? aspectoDeReferente(f.guru) : f.origen === 'offer' && aspectoOffer ? aspectoOffer : aspectoDeChat(f.clave) })), [sesiones, offer, antes, busca, automations, editores, aspectoOffer]);
  /** La fila de lo abierto (un chat nuevo no tiene). */
  const filaAbierta = elegido ? lista.find((f) => esFilaDe(f, elegido)) ?? null : null;
  const esJefe = filaAbierta?.clave === 'jefe';
  const deOffer = idOffer != null ? (offer ?? []).find((o) => o.id === idOffer) ?? null : null;
  const deAntes = idAntes != null ? (antes ?? []).find((a) => a.id === idAntes) ?? null : null;
  // ⚠️ MIENTRAS LLEGA LA LISTA, el que va a abrir el Cerebro ya es el Cerebro (22/10/2026, Martín con captura del panel de la
  // estrella: «Mira lo mal que se ve esto»). Sin la fila, la cabecera decía «Chat nuevo» con una criatura redonda y después
  // saltaba a «Cerebro» con la estrella. Con `entrarAlCerebro` y nada pedido ni elegido, es el Cerebro desde el primer cuadro.
  const vaAlCerebro = !filaAbierta && elegido == null && entrarAlCerebro && chatInicial == null;
  const nombre = quien?.nombre ?? filaAbierta?.titulo ?? (vaAlCerebro ? NOMBRE_JEFE
    : idOffer != null ? deOfferAbierta?.titulo || deOffer?.titulo || SECCION_OFFER : idAntes != null ? deAntes?.titulo?.trim() || deAntes?.tema?.trim() || SIN_TITULO : SIN_TITULO);
  const nombreMuneco = quien?.nombre ?? filaAbierta?.criatura ?? (vaAlCerebro ? JEFE_SECOND_BRAIN : idOffer != null ? criaturaDeOffer(nombre) : nombre);
  /** La criatura del chat abierto: la de su fila (la cabecera, la portada y el hilo, la misma que en la lista). */
  const aspectoMuneco = quien?.aspecto ?? filaAbierta?.aspecto ?? null;
  /** Dónde se sigue la charla del lienzo abierta: el lienzo de su automatización, en este negocio. */
  const hrefLienzo = idAutomatizacion != null ? conWs(rutaDelLienzo(idAutomatizacion), ws) : null;
  /** Dónde se sigue el chat de un editor abierto: ese diseño o ese proyecto, en este negocio. */
  const idDelEditor = deEditor ? partesDeClaveDeEditor(deEditor.clave)?.id ?? null : null;
  // Sólo si es de quien mira: el editor abre el hilo de la persona de la sesión, y el de otra persona sería otro.
  const editorPropio = !!deEditor && (editores ?? []).some((e) => e.tipo === deEditor.editor && e.clave === deEditor.clave && e.propio);
  const hrefEditor = deEditor && idDelEditor && editorPropio ? conWs(EDITORES[deEditor.editor].ruta(idDelEditor), ws) : null;
  const enCurso = !!trabajo || armandoOffer;
  /** La nota de voz de la caja (OC7): en cada chat que se sigue desde acá (el lienzo y los editores no tienen caja). */
  const chatAbierto = filaAbierta?.clave ?? 'nuevo';
  /** Lo elegido para el chat abierto, si todavía se puede (si no, Automático). Lo de Offer no pasa por acá: su motor es otro. */
  const iaDelChat = idOffer != null ? null : eleccionVigente(iaDe[chatAbierto] ?? null, cuentasIA);
  const elegirIA = (e: EleccionIA) => setIaDe((m) => ({ ...m, [chatAbierto]: e }));
  /** Un chat nuevo se crea con el primer mensaje: lo elegido en «nuevo» pasa a su fila (`s<id>`). */
  const pasarIaAlCreado = (sid: number) => setIaDe((m) => (chatAbierto === 'nuevo' && m.nuevo !== undefined ? { ...m, [`s${sid}`]: m.nuevo, nuevo: null } : m));
  const tirarNota = () => { if (notaEnEspera) URL.revokeObjectURL(notaEnEspera.url); setNotaEnEspera(null); };
  const reenviarNota = () => { const a = notaEnEspera; if (!a) return; setNotaEnEspera(null); void mandarNota(a, chatAbierto); };
  const vozCaja = {
    onAudio: (blob: Blob, secs: number) => { void mandarNota({ blob, secs, url: URL.createObjectURL(blob), chat: chatAbierto }, chatAbierto); },
    onError: setFaltaMic, rotuloEnviar: 'Enviar audio', apagada: enCurso,
    // La de OTRO chat no se ofrece acá: una grabación a medias no viaja a otro (como la tab de Offer, `key` por conversación).
    pendiente: notaEnEspera && notaEnEspera.chat === chatAbierto
      ? { url: notaEnEspera.url, secs: notaEnEspera.secs, onBorrar: tirarNota, onDejar: reenviarNota } : null,
  };
  /** Los mensajes del hilo, para la barra de los fijados. */
  const mensajesWA = useMemo(() => items.flatMap((x) => (x.k === 'msg' ? [mensajeWADe(x, nombreMuneco)] : [])), [items, nombreMuneco]);

  return {
    sesiones, errorLista, lista, elegido, elegir, filaAbierta, esJefe, nombre, nombreMuneco, aspectoMuneco, idOffer, idAntes, idTurno,
    esAutomatizacion, hrefLienzo, esEditor, hrefEditor,
    items, cargado, errorCarga, recargar, ahora, trabajo, segs, enCurso, armandoOffer, tarjeta, correrTarjeta, alTerminarTrabajo, reintentar,
    texto, setTexto, faltaMic, setFaltaMic, enviar, enviarCaja, adjuntosCaja, vozCaja, pegados, quitarPegado, pegarLargo, cita, setCita,
    marcas, ponerMarca, accionesWA, menuWA, setMenuWA, infoWA, setInfoWA, elegirEnMenu, mensajesWA,
    iaConectada, app, conectando, setConectando, mirarSuIA,
    cuentasIA: idOffer != null ? null : cuentasIA, iaDelChat, elegirIA, resumenIA: resumenDeIA(iaDelChat, cuentasIA),
  };
}
