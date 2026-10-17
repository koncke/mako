'use client';

// =============================================================================
// El Second Brain como chat: la pieza única, primera tanda (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md. La cara es la del Centro de Operaciones (app/admin/operaciones/), que ya
// cita sus fuentes: la barra con un muñeco por chat (Grok Bot), la barra y la caja de Claude web, y los sub-chats
// debajo de su jefe como los hilos de un canal de Discord. Copiado de ahí, con las mismas clases de centro.css.
//
//   · A la izquierda: «Nuevo chat», el jefe «Second Brain» y sus sub-chats (lib/chat-mako-reglas.ts → arbolDelJefe).
//     Son las conversaciones de la persona con MaKo: las MISMAS del teléfono (/m/mako), sin migrar nada.
//   · En el centro: la conversación con MaKo (el turno del teléfono, lib/mako-turno-app.ts, por /api/mako/chat), con
//     la tarjeta que se confirma y la caja con el micrófono de la casa. Sin streaming: «MaKo está escribiendo…».
//   · «Mapa» (sólo el admin): el grafo del negocio en el panel, como la Ticketera en el Centro. Lo arma el SERVIDOR
//     cuando la URL lo pide (`?panel=mapa`): a quien no le toca no le llega.
//
// ⚠️ LO QUE NO SE REINTENTA (el mismo criterio del teléfono y del CRM, app/m/mako/chat-ui.ts): un turno que pudo haber
//    corrido (red caída, corte, 5xx) ya pudo dejar una acción pendiente: se dice «no sé si llegó» y se ofrece recargar.
// ⚠️ UN CHAT NUEVO NO SE CREA AL APRETAR «Nuevo chat»: se crea con el primer mensaje (sin conversaciones vacías).
// ⚠️ LA URL dice qué chat está abierto (`?chat=<id>`), reescrita con `replaceState(null, …)`: el `__NA` de Next en el
//    estado hace que el router la pise (docs/hallazgos-operaciones.md).
//
// «CLAUDE CODE» (tanda 5, 17/10/2026; Martín: «quiero dejar de mandar prompts por aquí, quiero mandar prompts por MaKo en
// el Second Brain»). Para quien `puedeOperar` (lo decide el servidor: `centro` llega null para todos los demás), la
// barra suma la sección «Claude Code» con el Cerebro y cada jefe del Centro de Operaciones, y elegir uno abre SU
// conversación con la caja firmada. Son las MISMAS piezas y el MISMO motor que /admin/operaciones
// (app/admin/operaciones/useCentro.ts y PiezasCentro.tsx): el Centro es el adaptador, no una copia. Lo que es sólo
// del Centro (la Ticketera entera, los Runners, el comando de «Nuevo chat») sigue allá. La URL dice cuál con
// `?centro=<clave>`, porque `?chat=` es el número de una conversación con MaKo.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { useCentro, type Centro, type DatosCentro } from '@/app/admin/operaciones/useCentro';
import { ChatDelCentro, ListaCentro, MenusCentro, buscarChats } from '@/app/admin/operaciones/PiezasCentro';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { MunecoNuevo } from '@/app/admin/operaciones/NuevoChat';
import { Microfono } from '@/app/admin/operaciones/Microfono';
import { HiloMako } from '@/app/_chat/HiloMako';
import type { ItemPropuesta } from '@/app/_chat/TarjetaAccion';
import {
  archivosDeRespuesta, idLocal, itemsDeRespuesta, itemsDeSesion, leerRespuesta, problemaDeSeleccion, tipoDeElegido, trasTarjeta,
  type EstadoPropuesta, type ItemHilo, type Leido,
} from '@/app/m/mako/chat-ui';
import { achicarImagen } from '@/app/m/mako/subir';
import { IconoChat } from '@/app/m/mako/iconos';
import { ACCEPT_ADJUNTOS_CHAT, ERROR_ADJUNTO } from '@/lib/mako-adjuntos';
import {
  ARRANQUES_SECOND_BRAIN, AVISO_ANTES, JEFE_SECOND_BRAIN, SECCION_ANTES, SIN_TITULO, SUBS_VISIBLES, arbolDelJefe, edadCorta, filtrarSubs,
  nombreDeSub, tituloDe,
} from '@/lib/chat-mako-reglas';
import type { ChatDeAntes } from '@/lib/chat-mako-indice';
import type { MensajeChat, ResultadoTarjeta, RespuestaTurno, SesionChat, TarjetaPendiente } from '@/lib/mako-turno-app-reglas';
import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';

const RUTA = '/api/mako/chat';
/** El maxDuration de la ruta es 420 s: el corte del navegador va 5 s después (tests/mako-doer-plazo.test.ts). */
const TOPE_MS = 425_000;
/** Lo que tarda en abrir una lista o un hilo antes de decir que no se pudo. */
const TOPE_LECTURA_MS = 30_000;

type Abierta = { sesion: SesionChat; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[] };
type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;
/** Lo elegido en la barra: una conversación, un chat que todavía no tiene (el jefe sin nada, o «Nuevo chat»), un
 *  chat de antes (de «Pregúntale a MaKo»: se lee y no se escribe), o un chat de Claude Code (su clave del Centro). */
type Elegido = { id: number } | { virtual: 'jefe' | 'nuevo' } | { antes: number } | { centro: string };
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
/** Un turno con archivos: multipart, como el teléfono (el `?ws=` lo pone el `fetch` de la casa, WsFetch). */
const postArchivos = <T,>(sessionId: number, mensaje: string, archivos: readonly ArchivoElegido[]) => {
  const fd = new FormData();
  fd.append('sessionId', String(sessionId));
  fd.append('mensaje', mensaje);
  for (const a of archivos) fd.append('adjuntos', a.file, a.file.name);
  return pedir<T>(RUTA, { method: 'POST', body: fd, signal: AbortSignal.timeout(TOPE_MS) });
};

const anotarEnUrl = (id: number | null, centro: string | null) => {
  try {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set('chat', String(id)); else u.searchParams.delete('chat');
    if (centro) u.searchParams.set('centro', centro); else u.searchParams.delete('centro');
    window.history.replaceState(null, '', u);
  } catch { /* es una comodidad */ }
};

type Props = {
  /** El admin con la tab en su capa: ve el acceso «Mapa». */
  veMapa: boolean;
  /** El Mapa ya armado por el servidor (la URL lo pidió); null = la conversación. */
  mapa: ReactNode | null;
  chatInicial: number | null;
  /** Los chats de Claude Code del Centro (app/admin/operaciones/datos.ts): null para todos menos el super admin. */
  centro: DatosCentro | null;
  /** `?centro=`: el chat de Claude Code que se abre al entrar. */
  centroInicial: string | null;
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

function Cuerpo({ veMapa, mapa, chatInicial, centro, centroInicial }: Omit<Props, 'centro'> & { centro: Centro | null }) {
  const router = useRouter();
  const [sesiones, setSesiones] = useState<SesionChat[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [elegido, setElegido] = useState<Elegido | null>(() => (centro && centroInicial && centro.chats.some((c) => c.clave === centroInicial) ? { centro: centroInicial } : null));
  const [conChat, setConChat] = useState(chatInicial != null || mapa != null || centroInicial != null);
  /** La sección «Claude Code» de la barra, abierta o plegada. */
  const [claudeAbierta, setClaudeAbierta] = useState(true);
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
  /** Los chats de «Pregúntale a MaKo» (null = todavía no se pidieron: se piden al abrir la sección). */
  const [antes, setAntes] = useState<ChatDeAntes[] | null>(null);
  const [antesAbierta, setAntesAbierta] = useState(false);
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
  const [soltando, setSoltando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

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
      const { jefe } = arbolDelJefe(ss);
      // Lo que ya se eligió (el chat de Claude Code de la URL, o un toque antes de que llegara la lista) se queda.
      setElegido((prev) => prev ?? (pedida != null ? { id: pedida } : jefe ? { id: jefe.id } : { virtual: 'jefe' }));
    });
    return () => { vivo = false; };
  }, [cargarLista, chatInicial]);

  // ── El hilo de lo elegido ──
  const idElegido = elegido && 'id' in elegido ? elegido.id : null;
  const cargarHilo = useCallback(async (id: number, vigente: () => boolean = () => true) => {
    setCargado(false); setErrorCarga(null);
    const l = await pedir<Abierta>(`${RUTA}?sessionId=${id}`);
    if (!vigente()) return;
    if (!l.ok) { setErrorCarga(l.reintentable ? l.error : 'No pude abrir el chat.'); setCargado(true); return; }
    setItems(itemsDeSesion(l.datos.mensajes ?? [], l.datos.propuestas ?? []));
    setCargado(true);
  }, []);

  const idAntes = elegido && 'antes' in elegido ? elegido.antes : null;
  useEffect(() => {
    if (!elegido) return;
    sesionRef.current = idElegido;
    if (idAntes != null) {
      let vivo = true;
      setCargado(false); setErrorCarga(null);
      void pedir<{ mensajes: MensajeChat[] }>(`${RUTA}?antesId=${idAntes}`).then((l) => {
        if (!vivo) return;
        if (!l.ok) { setErrorCarga(l.reintentable ? l.error : 'No pude abrir el chat.'); setCargado(true); return; }
        setItems(itemsDeSesion(l.datos.mensajes ?? [], []));
        setCargado(true);
      });
      return () => { vivo = false; };
    }
    if (idElegido == null) { setItems([]); setErrorCarga(null); setCargado(true); return; }
    if (recienCreada.current === idElegido) { recienCreada.current = null; return; }
    let vivo = true;
    void cargarHilo(idElegido, () => vivo);
    return () => { vivo = false; };
  }, [elegido, idElegido, idAntes, cargarHilo]);

  const claveCentro = elegido && 'centro' in elegido ? elegido.centro : null;
  useEffect(() => { if (elegido) anotarEnUrl(idElegido, claveCentro); }, [elegido, idElegido, claveCentro]);

  // Como un chat: abre mostrando lo último, y baja cuando llega algo nuevo.
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [items.length, trabajo, idElegido]);
  // La caja crece con lo que se escribe, hasta el tope del CSS.
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [texto]);

  const desde = trabajo?.desde ?? null;
  useEffect(() => {
    if (desde == null) return;
    const t = window.setInterval(() => setSegs(Math.floor((Date.now() - desde) / 1000)), 1000);
    return () => { window.clearInterval(t); setSegs(0); };
  }, [desde]);

  const recargar = () => { if (!ocupadoRef.current && idElegido != null) void cargarHilo(idElegido); };

  // ── Elegir en la barra ──
  const elegir = (e: Elegido) => {
    if (ocupadoRef.current) return;
    setConChat(true);
    setFaltaMic(null);
    for (const a of elegidosRef.current) URL.revokeObjectURL(a.url);
    ponerElegidos([]);
    // Con el Mapa abierto, volver a una conversación es volver a la página sin `panel` (lo arma el servidor).
    if (mapa) { router.push('id' in e ? `/second-brain?chat=${e.id}` : 'centro' in e ? `/second-brain?centro=${encodeURIComponent(e.centro)}` : '/second-brain'); }
    setElegido(e);
    setTexto('');
    window.setTimeout(() => caja.current?.focus({ preventScroll: true }), 0);
  };

  const alternarAntes = () => {
    setAntesAbierta((v) => !v);
    if (antes == null) {
      void pedir<{ antes: ChatDeAntes[] }>(`${RUTA}?antes=1`).then((l) => setAntes(l.ok ? l.datos.antes ?? [] : []));
    }
  };

  const marcar = (id: string, cambio: Partial<ItemMsg>) =>
    setItems((xs) => xs.map((x) => (x.id === id && x.k === 'msg' ? { ...x, ...cambio } : x)));

  // ── El turno ──
  const mandar = async (idU: string, mensaje: string, archivos: readonly ArchivoElegido[]) => {
    setTrabajo({ desde: Date.now() });
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
        ? await postArchivos<RespuestaTurno>(sid, mensaje, archivos)
        : await postLargo<RespuestaTurno>({ action: 'send', sessionId: sid, mensaje });
      if (!l.ok) { marcar(idU, { estado: l.reintentable ? 'error' : 'incierto', error: l.error }); return; }
      // Los archivos volvieron guardados: la burbuja pasa a pedirlos por su mensaje y la vista previa se suelta.
      const guardados = archivosDeRespuesta(l.datos);
      marcar(idU, { estado: undefined, error: undefined, ...(guardados.length ? { archivos: guardados } : {}) });
      if (guardados.length) { for (const a of archivos) URL.revokeObjectURL(a.url); envios.current.delete(idU); }
      setItems((xs) => {
        const vistas = new Set(xs.flatMap((x) => (x.k === 'propuesta' ? [x.t.pendienteId] : [])));
        return [...xs, ...itemsDeRespuesta(l.datos, vistas)];
      });
      void cargarLista(); // el título y la hora de la fila
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
    void mandar(idU, t, archivos);
    return true;
  };

  const enviarCaja = () => {
    const t = texto.trim();
    if ((!t && !elegidosRef.current.length) || ocupadoRef.current) return;
    // La vista previa NO se suelta acá: la burbuja que sale la sigue mostrando hasta que vuelve guardada.
    if (enviar(t, elegidosRef.current)) { setTexto(''); ponerElegidos([]); }
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
  const puedeSoltar = idAntes == null && cargado && !errorCarga;
  const conArchivos = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const arrastre = {
    onDragOver: (e: DragEvent) => { if (!puedeSoltar || !conArchivos(e)) return; e.preventDefault(); setSoltando(true); },
    onDragLeave: (e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSoltando(false); },
    onDrop: (e: DragEvent) => {
      if (!puedeSoltar || !conArchivos(e)) return;
      e.preventDefault(); setSoltando(false);
      void sumarArchivos(Array.from(e.dataTransfer.files));
    },
  };
  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter manda; Shift+Enter baja de renglón. Mientras se compone un acento (IME), Enter es del teclado.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviarCaja(); }
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
  const alEstado = (pendienteId: number, estado: EstadoPropuesta, nota?: string, paraLaPersona?: string[]) => {
    setItems((xs) => {
      const sig = xs.map((x) => (x.k === 'propuesta' && x.t.pendienteId === pendienteId ? { ...x, estado, nota } : x));
      const extra: ItemHilo[] = (paraLaPersona ?? []).filter((t) => t.trim()).map((t) => ({ k: 'aviso', id: idLocal('v'), texto: t, tono: 'mako' }));
      return [...sig, ...extra];
    });
  };
  const correrTarjeta = async (x: ItemPropuesta, accion: 'confirmar' | 'cancelar') => {
    const sid = sesionRef.current;
    if (tarjeta || sid == null) return;
    const id = x.t.pendienteId;
    setTarjeta({ id, accion });
    if (accion === 'confirmar') alEstado(id, 'aplicando');
    try {
      const l = await postLargo<ResultadoTarjeta>({ action: accion, sessionId: sid, pendienteId: id });
      if (!l.ok) { alEstado(id, 'pendiente', l.reintentable ? l.error : 'No llegó la respuesta. Recarga el chat para ver si se ejecutó.'); return; }
      const d = trasTarjeta(l.datos, accion);
      alEstado(id, d.estado ?? 'pendiente', d.frase ?? undefined, l.datos.paraLaPersona);
    } finally {
      setTarjeta(null);
    }
  };

  // ── Lo que se dibuja ──
  const arbol = arbolDelJefe(sesiones ?? []);
  const subs = filtrarSubs(arbol.subs, busca);
  const corte = todas || busca.trim() ? subs : subs.filter((s, i) => i < SUBS_VISIBLES || s.id === idElegido);
  const esJefe = elegido != null && (('virtual' in elegido && elegido.virtual === 'jefe') || (arbol.jefe != null && idElegido === arbol.jefe.id));
  const sub = idElegido != null && !esJefe ? (sesiones ?? []).find((s) => s.id === idElegido) ?? null : null;
  const deAntes = idAntes != null ? (antes ?? []).find((a) => a.id === idAntes) ?? null : null;
  const nombre = esJefe ? JEFE_SECOND_BRAIN : idAntes != null ? (deAntes?.titulo?.trim() || 'Chat de antes') : sub ? tituloDe(sub) : SIN_TITULO;
  const nombreMuneco = esJefe ? JEFE_SECOND_BRAIN : idAntes != null ? SECCION_ANTES : nombreDeSub(sub ?? { titulo: null });
  const animo = trabajo ? 'trabajando' : 'despierto';
  const hrefMapa = `/second-brain?panel=mapa${idElegido ? `&chat=${idElegido}` : ''}${claveCentro ? `&centro=${encodeURIComponent(claveCentro)}` : ''}`;
  /** Volver del Mapa a lo que estaba elegido (lo vuelve a armar el servidor). */
  const hrefVolver = idElegido ? `/second-brain?chat=${idElegido}` : claveCentro ? `/second-brain?centro=${encodeURIComponent(claveCentro)}` : '/second-brain';
  // Los chats de Claude Code: el elegido, y los que dicen lo buscado.
  const chatCentro = centro && claveCentro ? centro.chats.find((c) => c.clave === claveCentro) ?? null : null;
  const chatsCentro = centro?.chats;
  const delCentro = useMemo(() => (chatsCentro ? buscarChats(chatsCentro, busca) : []), [chatsCentro, busca]);

  const fila = (clave: string, e: Elegido, titulo: string, muneco: string, actividad: string | null, esSub: boolean) => {
    const actual = !mapa && elegido != null && JSON.stringify(elegido) === JSON.stringify(e);
    const t = actividad ? Date.parse(actividad) : NaN;
    return (
      <div key={clave} className={`co-fila-wrap${esSub ? ' co-fila-wrap--sub' : ''}`}>
        <button type="button" title={titulo} className="co-fila" aria-current={actual ? 'true' : undefined} onClick={() => elegir(e)}>
          <Muneco titulo={muneco} animo={actual && trabajo ? 'trabajando' : 'despierto'} size={esSub ? 30 : 38} />
          <span className="co-fila__cuerpo">
            <span className="co-fila__l1">
              <span className="co-fila__titulo">{titulo}</span>
              <span className="co-fila__hace">{edadCorta(Number.isFinite(t) ? t : null, ahora)}</span>
            </span>
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="co" data-con-chat={conChat ? 'true' : 'false'}>
      <aside className="co-barra" aria-label="Chats">
        <div className="co-barra__arriba">
          <label className="co-buscar">
            <Icon name="search" size={16} />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar un chat" />
          </label>
          {/* El grafo del negocio, arriba de los chats: como la Ticketera en el Centro (el botón del grafo de Obsidian). */}
          {veMapa && (
            <button type="button" className="co-acceso" aria-pressed={mapa != null}
              onClick={() => { setConChat(true); router.push(mapa ? hrefVolver : hrefMapa); }}>
              <Icon name="cerebro" size={17} />Mapa
            </button>
          )}
        </div>

        <nav className="co-lista" aria-label="Chats">
          {/* «Nuevo chat» arriba de todos, como el de ChatGPT y Claude. */}
          <button type="button" className="co-fila co-fila--nuevo"
            aria-current={!mapa && elegido != null && 'virtual' in elegido && elegido.virtual === 'nuevo' ? 'true' : undefined}
            onClick={() => elegir({ virtual: 'nuevo' })}>
            <MunecoNuevo />
            <span className="co-fila__cuerpo"><span className="co-fila__l1"><span className="co-fila__titulo">Nuevo chat</span></span></span>
          </button>
          {errorLista && <p className="co-lista__vacio">{errorLista}</p>}
          {sesiones != null && (
            <div className="co-jefe">
              {fila('jefe', arbol.jefe ? { id: arbol.jefe.id } : { virtual: 'jefe' }, JEFE_SECOND_BRAIN, JEFE_SECOND_BRAIN, arbol.jefe?.updatedAt ?? null, false)}
              {corte.length > 0 && (
                <div className="co-jefe__subs">
                  {corte.map((s) => fila(`s${s.id}`, { id: s.id }, tituloDe(s), nombreDeSub(s), s.updatedAt, true))}
                </div>
              )}
              {!todas && !busca.trim() && subs.length > corte.length && (
                <button type="button" className="co-mas" onClick={() => setTodas(true)}>{`Mostrar ${subs.length - corte.length} más`}</button>
              )}
              {todas && !busca.trim() && subs.length > SUBS_VISIBLES && (
                <button type="button" className="co-mas" onClick={() => setTodas(false)}>Mostrar menos</button>
              )}
              {busca.trim() && !subs.length && !delCentro.length && <p className="co-lista__vacio">Ningún chat con ese nombre.</p>}
            </div>
          )}
          {/* Los chats de Claude Code de Martín (sólo quien `puedeOperar`): el Cerebro y cada jefe del Centro, con sus
              sub-chats, en una sección con su nombre arriba para que «CRM» no se confunda con el chat de MaKo del CRM. */}
          {centro && (
            <>
              <div className="co-cuenta">
                <button type="button" className="co-cuenta__cab" aria-expanded={claudeAbierta} onClick={() => setClaudeAbierta((v) => !v)}>
                  Claude Code
                  <span className={`co-chev${claudeAbierta ? '' : ' co-chev--cerrado'}`} aria-hidden><Icon name="chevron" size={14} /></span>
                </button>
              </div>
              {(claudeAbierta || !!busca.trim()) && (
                centro.chats.length
                  ? <ListaCentro centro={centro} visibles={delCentro} actual={mapa ? null : claveCentro} buscando={!!busca.trim()} onElegir={(clave) => elegir({ centro: clave })} />
                  : <p className="co-lista__vacio">Conecta un Runner para ver tus chats aquí.</p>
              )}
            </>
          )}
          {/* Los chats de «Pregúntale a MaKo», de sólo lectura, plegados al final (los grupos por fecha de ChatGPT). */}
          <div className="co-cuenta">
            <button type="button" className="co-cuenta__cab" aria-expanded={antesAbierta} onClick={alternarAntes}>
              {SECCION_ANTES}
              <span className={`co-chev${antesAbierta ? '' : ' co-chev--cerrado'}`} aria-hidden><Icon name="chevron" size={14} /></span>
            </button>
            {antesAbierta && antes == null && <p className="co-lista__vacio">Cargando…</p>}
            {antesAbierta && antes != null && !antes.length && <p className="co-lista__vacio">No hay chats de antes.</p>}
            {antesAbierta && (antes ?? []).map((a) => fila(`a${a.id}`, { antes: a.id }, a.titulo?.trim() || 'Chat de antes', 'Antes', a.updatedAt, false))}
          </div>
        </nav>
      </aside>

      {mapa ? (
        <section className="co-panel" aria-label="Mapa">
          <header className="co-cab">
            <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} aria-label="Volver a los chats"
              onClick={() => { setConChat(false); router.push(hrefVolver); }}>
              <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
            </button>
            <div className="co-cab__texto"><h1 className="co-cab__titulo">Mapa</h1></div>
          </header>
          <div className="ch-mapa__cuerpo">{mapa}</div>
        </section>
      ) : centro && chatCentro ? (
        // Un chat de Claude Code: la conversación del Centro, con su caja firmada (el único camino, mandar.ts).
        <ChatDelCentro centro={centro} chat={chatCentro} onVolver={() => setConChat(false)} />
      ) : (
        <section className={`co-panel${soltando ? ' ch-soltar' : ''}`} aria-label={`Conversación con ${nombre}`} {...arrastre}>
          <header className="co-cab">
            <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} onClick={() => setConChat(false)} aria-label="Volver a los chats">
              <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
            </button>
            <Muneco titulo={nombreMuneco} animo={animo} size={34} />
            <div className="co-cab__texto">
              <h1 className="co-cab__titulo" title={nombre}>{nombre}</h1>
              <span className="co-cab__meta">{esJefe ? 'Tu chat con MaKo' : idAntes != null ? SECCION_ANTES : JEFE_SECOND_BRAIN}</span>
            </div>
          </header>

          <div className="co-hilo" ref={hilo}>
            {!cargado ? null : errorCarga ? (
              <div className="co-portada">
                <p className="co-portada__dato">{errorCarga}</p>
                <button type="button" className="co-chip" onClick={recargar}>Reintentar</button>
              </div>
            ) : !items.length && !trabajo ? (
              <div className="co-portada">
                <Muneco titulo={nombreMuneco} animo="despierto" size={76} />
                <p className="co-portada__nombre">{idAntes != null ? 'Este chat está vacío.' : '¿En qué te ayudo?'}</p>
                {idAntes == null && <div className="ch-arranques">
                  {ARRANQUES_SECOND_BRAIN.map((a) => <button key={a} type="button" className="co-chip" onClick={() => enviar(a)}>{a}</button>)}
                </div>}
              </div>
            ) : (
              <HiloMako items={items} quien={{ nombre: nombreMuneco }} ahora={ahora} escribiendo={trabajo ? { segs } : null}
                tarjeta={tarjeta} onTarjeta={(x, a) => void correrTarjeta(x, a)} onReintentar={reintentar} onRecargar={recargar} />
            )}
          </div>

          <div className="co-caja-wrap">
            {idAntes != null ? (
              <div className="co-caja co-caja--quieta">
                <p>{AVISO_ANTES}</p>
                <button type="button" className="co-chip" onClick={() => elegir({ virtual: 'nuevo' })}>Seguir en uno nuevo</button>
              </div>
            ) : (
            <div className="co-caja">
              {elegidos.length > 0 && (
                <ul className="ch-elegidos" aria-label="Archivos para mandar">
                  {elegidos.map((a) => (
                    <li key={a.id} className="ch-elegido">
                      {/* eslint-disable-next-line @next/next/no-img-element -- la vista previa local (blob:) */}
                      {a.tipo === 'image' ? <img src={a.url} alt="" /> : <IconoChat nombre="archivo" size={20} />}
                      <span className="ch-elegido__nombre" title={a.file.name}>{a.file.name}</span>
                      <button type="button" className="ch-elegido__quitar" onClick={() => quitarArchivo(a.id)} aria-label={`Quitar ${a.file.name}`}>
                        <Icon name="x" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <textarea
                ref={caja} rows={1} value={texto}
                onChange={(e) => setTexto(e.target.value)} onKeyDown={tecla}
                onPaste={(e) => {
                  // Una celda de Excel o un párrafo de Word viajan como texto Y como imagen: si hay texto, se pega el texto.
                  const fs = Array.from(e.clipboardData.files);
                  if (fs.length && !Array.from(e.clipboardData.types).includes('text/plain')) { e.preventDefault(); void sumarArchivos(fs); }
                }}
                placeholder="Escríbele a MaKo" aria-label="Escríbele a MaKo"
                disabled={!cargado || !!errorCarga}
              />
              <div className="co-caja__barra">
                <button type="button" className="ch-adjuntar" onClick={() => entrada.current?.click()} disabled={!cargado || !!errorCarga}
                  aria-label="Adjuntar fotos o PDF" title="Adjuntar fotos o PDF">
                  <Icon name="plus" size={18} />
                </button>
                <input ref={entrada} type="file" accept={ACCEPT_ADJUNTOS_CHAT} multiple hidden
                  onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void sumarArchivos(fs); }} />
                <Microfono valor={texto} onValor={(v) => { setFaltaMic(null); setTexto(v); }} onError={setFaltaMic} apagado={!cargado || !!errorCarga} />
                <button type="button" className="co-enviar" onClick={enviarCaja} disabled={!!trabajo || (!texto.trim() && !elegidos.length) || !cargado || !!errorCarga}
                  aria-label="Mandar" title="Mandar (Enter)">
                  {trabajo ? <span className="co-enviar__giro" aria-hidden /> : <Icon name="flecha" size={18} />}
                </button>
              </div>
            </div>
            )}
            <p className="co-caja__estado" aria-live="polite">{faltaMic ?? ''}</p>
          </div>
        </section>
      )}
      {centro && <MenusCentro centro={centro} />}
    </div>
  );
}
