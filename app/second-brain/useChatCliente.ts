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
import { SIN_MARCAS, aplicarMarca, armarConCita, type CambioMarca, type Cita, type MarcasChat } from '@/lib/centro-mensajes';
import type { ItemPropuesta } from '@/app/_chat/TarjetaAccion';
import {
  archivosDeRespuesta, idLocal, itemsDeOffer, itemsDeRespuesta, itemsDeSesion, conTarjeta, leerRespuesta, mensajeWADe, respuestaDeOffer,
  textoTapadoDeRespuesta, problemaDeSeleccion, tipoDeElegido, trasTarjeta, trasTrabajo, type EstadoPropuesta, type ItemHilo, type Leido,
} from '@/app/m/mako/chat-ui';
import { achicarImagen } from '@/app/m/mako/subir';
import { abrirOffer, armarOffer, turnoOffer } from './motor-offer';
import { esOpcionArmar } from '@/app/offer/ayudas';
import { conPegados, esPegadoLargo } from '@/lib/chat-pegado';
import { ACCEPT_ADJUNTOS_CHAT, ERROR_ADJUNTO } from '@/lib/mako-adjuntos';
import {
  SECCION_OFFER, SIN_TITULO, colgarIrA, criaturaDeOffer, esFilaDe, linksDePedidos, listaDelCliente, type ElegidoChat, type IrA,
} from '@/lib/chat-mako-reglas';
import type { ChatDeAntes, ChatDeOffer } from '@/lib/chat-mako-indice';
import type { MensajeChat, PropuestaPantalla, ResultadoTarjeta, RespuestaTurno, SesionChat, TarjetaPendiente } from '@/lib/mako-turno-app-reglas';
import type { OfferSesionVista } from '@/lib/offer-marco';

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

export type ChatCliente = ReturnType<typeof useChatCliente>;

export function useChatCliente({ elegido, setElegido, activo, entrarAlCerebro, chatInicial, opcionArmar, busca, caja, sesionesIniciales = null }: {
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
}) {
  const ws = useWs();
  const [sesiones, setSesiones] = useState<SesionChat[] | null>(sesionesIniciales);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [items, setItems] = useState<ItemHilo[]>([]);
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [faltaMic, setFaltaMic] = useState<string | null>(null);
  const [trabajo, setTrabajo] = useState<{ desde: number } | null>(null);
  const [segs, setSegs] = useState(0);
  const [tarjeta, setTarjeta] = useState<{ id: number; accion: 'confirmar' | 'cancelar' } | null>(null);
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
  }, []);
  useEffect(() => { if (activo) cargarOtros(); }, [activo, cargarOtros]);
  const mirarSuIA = useCallback(() => {
    void pedir<{ conectada: boolean }>(`${RUTA}?suIA=1`).then((l) => setIaConectada(l.ok ? l.datos.conectada !== false : true));
  }, []);
  useEffect(() => { if (activo) mirarSuIA(); }, [activo, mirarSuIA]);

  // ── El hilo de lo elegido ──
  const idElegido = elegido && 'id' in elegido ? elegido.id : null;
  const idAntes = elegido && 'antes' in elegido ? elegido.antes : null;
  const idOffer = elegido && 'offer' in elegido ? elegido.offer : null;
  /** ¿Lo elegido es un chat del cliente (con MaKo, de Offer o de antes)? Un chat de Claude Code, no. */
  const esDelCliente = elegido != null && !('centro' in elegido);
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
    if (!esDelCliente) return;
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
  }, [elegido, esDelCliente, idTurno, idAntes, idOffer, cargarHilo, ponerOffer]);

  // Mientras Offer arma la oferta por detrás (`armar`), la conversación se relee: la oferta aparece sola, con su PDF.
  const armandoOffer = idOffer != null && !!deOfferAbierta?.armando?.corriendo;
  useEffect(() => {
    if (!armandoOffer || idOffer == null) return;
    const t = window.setInterval(() => {
      void abrirOffer(idOffer).then((l) => { if (l.ok && offerRef.current?.id === idOffer) ponerOffer(l.sesion); });
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
    if (idOffer != null) { void abrirOffer(idOffer).then((l) => { if (l.ok) ponerOffer(l.sesion); }); return; }
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
    if (id === 'copiar') { void copiar(m.texto).then((ok) => setFaltaMic(ok ? 'Copiado' : 'No pude copiar')); return; }
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
  const lista = useMemo(() => listaDelCliente({ sesiones: sesiones ?? [], offer: offer ?? [], antes: antes ?? [], busca }), [sesiones, offer, antes, busca]);
  /** La fila de lo abierto (un chat nuevo no tiene). */
  const filaAbierta = elegido ? lista.find((f) => esFilaDe(f, elegido)) ?? null : null;
  const esJefe = filaAbierta?.clave === 'jefe';
  const deOffer = idOffer != null ? (offer ?? []).find((o) => o.id === idOffer) ?? null : null;
  const deAntes = idAntes != null ? (antes ?? []).find((a) => a.id === idAntes) ?? null : null;
  const nombre = filaAbierta?.titulo
    ?? (idOffer != null ? deOfferAbierta?.titulo || deOffer?.titulo || SECCION_OFFER : idAntes != null ? deAntes?.titulo?.trim() || 'Chat de antes' : SIN_TITULO);
  const nombreMuneco = filaAbierta?.criatura ?? (idOffer != null ? criaturaDeOffer(nombre) : nombre);
  const enCurso = !!trabajo || armandoOffer;
  /** Los mensajes del hilo, para la barra de los fijados. */
  const mensajesWA = useMemo(() => items.flatMap((x) => (x.k === 'msg' ? [mensajeWADe(x, nombreMuneco)] : [])), [items, nombreMuneco]);

  return {
    sesiones, errorLista, lista, elegido, elegir, filaAbierta, esJefe, nombre, nombreMuneco, idOffer, idAntes, idTurno,
    items, cargado, errorCarga, recargar, ahora, trabajo, segs, enCurso, armandoOffer, tarjeta, correrTarjeta, alTerminarTrabajo, reintentar,
    texto, setTexto, faltaMic, setFaltaMic, enviar, enviarCaja, adjuntosCaja, pegados, quitarPegado, pegarLargo, cita, setCita,
    marcas, ponerMarca, accionesWA, menuWA, setMenuWA, infoWA, setInfoWA, elegirEnMenu, mensajesWA,
    iaConectada, conectando, setConectando, mirarSuIA,
  };
}
