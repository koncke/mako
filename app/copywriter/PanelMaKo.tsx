'use client';

// =============================================================================
// PanelMaKo — el chat de MaKo a la izquierda del guion (el del Web Generator, en cada documento como en mila.gg)
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D2, D5). mila.gg pone el MISMO chat en cada documento, con su charla guardada por
// documento; MaKo ya tiene ese chat: el del agente del Web Generator (app/web-generator/editor/paneles/ChatAgente.tsx:
// el panel único del Ops Center con la estrella, el hilo `HiloMako` y la caja única `CajaChat` con el «+», las
// miniaturas, pegar, los emojis y el micrófono). Acá se usa ESE, no una copia (AGENTS.md, «Una cosa, un lugar»).
// Lo que es de esta pantalla:
//   · «DISCUTIR | EDITAR» (el par de Automations y del Web Generator, app/_chat/SelectorIntencion.tsx). «Discutir»
//     contesta sin tocar el guion. «Editar» devuelve HERRAMIENTAS (lib/copywriter/operaciones.ts) que se vuelven a
//     validar acá contra lo de AHORA, se construyen EN el documento a la vista (./editor/propuesta.ts) y quedan como
//     propuesta: «Aceptar · Descartar · Reintentar», como Notion AI. Mientras hay una propuesta, el guion no se edita
//     ni se guarda (la pausa de EditorGuion);
//   · «@» cita otro guion, la oferta o un archivo de El Archivero (como mila.gg: lib/copywriter/referencias-reglas.ts);
//   · la charla es del GUION abierto: se guarda con la clave `copywriter:<id>` (lib/hilo-de-tab-reglas.ts) y se ve en el
//     Ops Center; se guarda lo que se DIJO, nunca la propuesta (es de ese documento en ese momento);
//   · los archivos van con el pedido y los lee el server (app/_chat/useAdjuntosDelChat.ts + lib/adjuntos-del-chat.ts);
//   · la nota de voz sale en el acto y se pasa a texto por detrás (app/_chat/useNotaEnElActo.ts);
//   · sin la app de escritorio no se escribe (app/_chat/useAppDeEscritorio.tsx), como en todo chat de MaKo;
//   · el pedido de la caja grande del inicio llega acá y sale SOLO, en «Editar» (./pedido-guardado.ts): mila escribe
//     el documento apenas se lo pidió.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import type { EnMensaje } from '@/app/_chat/HiloMako';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { PanelAgenteChat, HiloAgente, CajaAgente, CitaAgente } from '@/app/web-generator/editor/paneles/ChatAgente';
import { SelectorIntencion, useIntencion } from '@/app/_chat/SelectorIntencion';
import { armarConCita, type Cita, type MensajeWA } from '@/lib/centro-mensajes';
import { cuerpoConArchivos, useAdjuntosDelChat } from '@/app/_chat/useAdjuntosDelChat';
import { useNotaEnElActo } from '@/app/_chat/useNotaEnElActo';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import Link, { useRouter } from '@/app/_ui/Link';
import { dichoDelGuion, laminasDelGuion } from '@/lib/copywriter/hacia-otras';
import { pasarGuion } from '@/lib/guion-pasado';
import { crearCarruselDesdeGuionAction } from '@/app/image-editor/actions';
import { rutaDeTarjeta } from '@/lib/conexiones-catalogo';
import { guardarEnHiloDeTab, leerHiloDeTab } from '@/lib/hilo-de-tab-cliente';
import { claveDeGuion } from '@/lib/hilo-de-tab-reglas';
import { filasDeAgente, mensajesDeFilas } from '@/app/web-generator/editor/hilo-agente';
import { SIN_TITULO, type GuionAbierto, type JsonNodo, type PaginaCopy, type PropsGuion } from '@/lib/copywriter/tipos';
import { escondida } from '@/lib/copywriter/arbol';
import type { CatalogosCopy } from '@/lib/copywriter/catalogos';
import { aplicarTodo, cuadrosDeConstruccion, sanearOperaciones, type Descartada } from '@/lib/copywriter/operaciones';
import { plantillaPorId } from '@/lib/copywriter/plantillas';
import {
  AL_NEGOCIO, EN_OFFER, FALTA, SEGUIR_SIN, faltaPorPreguntar, nombreDeOferta, ofertaElegida, otrasOfertasDeReplica, pasoDeReplica, pasoPendiente, pasosDeIniciativa,
  pedidoDeIniciativa, pedidoDeReplica, responderReplica, textoDeRespuesta, type OfertaCorta, type PreparacionCorta, type RespuestasIniciativa,
} from '@/lib/copywriter/iniciativa';
import { esCampoQueFalta } from '@/lib/copywriter/oferta-elegida';
import { textoDelDoc } from '@/lib/copywriter/doc';
import { REF_OFERTA, buscarReferencias, consultaArroba, elegirReferencia, type Referencia } from '@/lib/copywriter/referencias-reglas';
import { aceptar as aceptarEnDoc, construir, descartar as descartarEnDoc, type DocVivo } from './editor/propuesta';
import type { ApiPagina } from './editor/EditorGuion';
import { pedirCitables, pedirCompletarOferta, pedirPreparacion } from './cliente';
import { avisarOriginalNuevo } from './OriginalAlLado';
import { esRecienCreada, tomarPedido } from './pedido-guardado';
import { transcribirSiHaceFalta } from './transcribir-original';
import { ChipsReferencias, ListaReferencias } from './Referencias';

/** /api/copywriter/ia corta a los 300 s. */
const PLAZO_IA_MS = 305_000;

/** Una propuesta de MaKo: la foto de antes, el resultado y lo que cambia de la página. */
type Propuesta = {
  antes: JsonNodo;
  final: JsonNodo;
  nuevos: string[];
  titulo: string | null;
  props: Partial<PropsGuion>;
  instruccion: string;
  refs: Referencia[];
  descartadas: Descartada[];
  avisos: string[];
  /** Salió de adaptar la plantilla (las preguntas de MaKo al crear): reintentar vuelve a adaptar. */
  adaptar?: boolean;
};
type EstadoPropuesta = 'construyendo' | 'pendiente' | 'aceptada' | 'descartada';

type Mensaje =
  // `oculto`: el pedido que armaron las preguntas de MaKo. MaKo lo lee en la charla; la pantalla no lo dibuja (ya están las respuestas).
  | { id: number; de: 'yo'; texto: string; adjuntos?: string[]; oculto?: boolean }
  | { id: number; de: 'mako'; texto: string; error?: boolean; propuesta?: Propuesta; estado?: EstadoPropuesta };

/** Lo que el panel necesita del guion vivo (lo que todavía no se guardó también cuenta). */
export type GuionVivo = { titulo: string; props: PropsGuion };

let ultimoId = 0;
const nuevoId = () => ++ultimoId;
/** La tecla de deshacer de ESTA computadora: ⌘Z en una Mac, Ctrl+Z en las demás (sólo se dibuja después de aceptar, en el cliente). */
const teclaDeshacer = () => (typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent) ? '⌘Z' : 'Ctrl+Z');
/** Sin ofertas: una sola lista vacía, para que no cambie en cada render. */
const SIN_OFERTAS: readonly OfertaCorta[] = [];

/** Lo que se ofrece para empezar: en «Discutir», PREGUNTAS; en «Editar», PEDIDOS (los del encargo de Martín). */
// Las de «Editar» son las de Notion AI sobre una página («Mejorar la escritura», «Acortar», «Alargar», «Cambiar el tono»,
// «Continuar escribiendo»), más las de la casa (la captura de Martín del chat del Web Generator, 29/10/2026).
const SUGERENCIAS: Readonly<Record<'discutir' | 'editar', readonly string[]>> = {
  discutir: ['¿Qué le falta para vender más?', '¿El gancho frena el scroll?', 'Resúmelo en 3 líneas'],
  editar: ['Mejorar la escritura', 'Acortar', 'Alargar', 'Cambiar el tono', 'Continuar escribiendo', 'Agregar una sección'],
};
/** Sobre una página VACÍA no hay nada que acortar ni mejorar (12/11/2026, en producción): pedidos para escribirla. */
const SUGERENCIAS_VACIA: readonly string[] = ['Escribe un reel de 30 segundos para mi oferta', 'Escribe un anuncio para mi oferta', 'Dame 10 ganchos para probar'];

/** Un archivo del pedido, en el hilo (no se abre desde ahí: viajó su texto, no se guardó). */
const archivoDe = (nombre: string) => ({ nombre, tipo: /\.(png|jpe?g|webp|gif|avif)$/i.test(nombre) ? 'image' as const : 'document' as const, sinAbrir: true });

/** Cuántos [DATO: …] quedaron en lo escrito (lo que falta completar con datos del negocio). */
const datosQueFaltan = (doc: JsonNodo) => (textoDelDoc(doc).match(/\[DATO\b/g) ?? []).length;

/** Cuántos bloques escribió MaKo, en palabras. */
const cuantos = (n: number) => (n === 1 ? '1 bloque' : `${n} bloques`);

export function PanelMaKo({ ws, guion, paginas, editor, leerVivo, leerApi, catalogos, campo, onPausa, avisar, citarRef, onPendiente, volver, ofertas = SIN_OFERTAS }: {
  ws: number | null;
  guion: GuionAbierto | null;
  paginas: readonly PaginaCopy[];
  /** El documento vivo de la página abierta (BlockNote, por ./editor/propuesta.ts): MaKo lee y escribe por acá. */
  editor: DocVivo | null;
  /** El título y las propiedades de AHORA (EditorGuion los cambia antes de guardarlos). */
  leerVivo: () => GuionVivo | null;
  /** Lo que el chat cambia de la página al aceptar (el título y las propiedades). */
  leerApi: () => ApiPagina | null;
  catalogos: CatalogosCopy;
  campo: RefObject<HTMLTextAreaElement | null>;
  /** Una propuesta abierta: EditorGuion no se edita ni se guarda. */
  onPausa: (pausa: boolean) => void;
  avisar: (t: string) => void;
  /**
   * «Preguntar a MaKo» de la página (la barra de la selección y el «/»): lo seleccionado entra como CITA en la caja y
   * el selector pasa a «Editar» («mejora este párrafo» habla de ESO). Sin selección, sólo lleva el cursor a la caja.
   */
  citarRef?: MutableRefObject<((seleccion?: string) => void) | null>;
  /**
   * La propuesta que espera «Aceptar» (o null): el teléfono la decide desde la Página (13/11/2026, en producción a 375: MaKo
   * cambiaba el gancho, la vista saltaba a la Página con el cambio marcado y «Aceptar» quedaba escondido en la pestaña MaKo).
   */
  onPendiente?: (decidir: { aceptar: () => void; descartar: () => void } | null) => void;
  /** La «←» del shell de Create (app/_crear/PantallaCrear.tsx): da vuelta la tarjeta a la lista de páginas. */
  volver?: ReactNode;
  /**
   * Las ofertas del negocio (`listarOfertas`, la principal primero): los botones de «¿Lo adapto a tu oferta? ¿A cuál?» al
   * crear desde una plantilla (lib/copywriter/iniciativa.ts).
   */
  ofertas?: readonly OfertaCorta[];
}) {
  const id = guion?.pagina.id ?? null;
  // La plantilla de la que nació la página, si traía un ejemplo (docs/plantillas-reales/copywriter.md, 3.5).
  const plantilla = useMemo(() => { const pl = plantillaPorId(catalogos, guion?.doc.props.plantilla); return pl?.ejemplo ? pl : null; }, [catalogos, guion]);
  /** MaKo preguntó un dato para adaptar: lo próximo que escriba la persona también va como «adaptar». */
  const [adaptando, setAdaptando] = useState(false);
  /**
   * MaKo toma la iniciativa (Martín, 29/10/2026: «cuando se crea un copy, MaKo le pregunta: "¿cuál es el objetivo de
   * esto? ¿quieres que lo adapte?"»): con la página recién nacida de una plantilla y el chat vacío, pregunta para qué es y
   * a qué oferta adaptarla, con botones. Las preguntas no llaman a la IA; la última respuesta, sí (`pedidoDeIniciativa`).
   */
  const [respIni, setRespIni] = useState<RespuestasIniciativa>({});
  // Una página que replica un outlier (D18, `props.outlier`). El original le llega a la IA por el server en cada pedido
  // (lib/copywriter/ia.ts), así que el pedido es un «Editar» común, no «adaptar» una plantilla.
  // ⚠️ PRIMERO PREGUNTA, DESPUÉS ESCRIBE TODO (13/11/2026, la maqueta que aprobó el Cerebro; Martín: «no me hace las preguntas…
  // tampoco me pregunta sobre qué oferta, incluso escribe casi que cualquier cosa»). Al abrir la réplica vacía: transcribe el
  // original si es un video, pregunta con botones para qué oferta, lo que le falta a esa oferta (y lo guarda en ella) y, si el tema
  // no tiene que ver, cómo usarlo (lib/copywriter/iniciativa.ts, `pasoDeReplica`). Con eso, la escribe ENTERA y la deja en la página
  // sin «Aceptar» (lo de 11/11: «lo único que me replica es el título»). La oferta se puede cambiar después (`otrasOfertasDeReplica`).
  const replica = !plantilla && !!guion?.doc.props.outlier;
  const pasosIni = useMemo(() => (plantilla ? pasosDeIniciativa(plantilla, ofertas) : []), [plantilla, ofertas]);
  const pedidoIni = (r: RespuestasIniciativa) => pedidoDeIniciativa(pasosIni, r, ofertas);
  /** La charla guardada ya se leyó (con o sin mensajes): recién ahí se sabe si la réplica está por escribirse. */
  const [hiloLeido, setHiloLeido] = useState(false);
  /** La réplica que MaKo escribió sola: con qué oferta y en qué mensaje (debajo van las otras ofertas). */
  const [replicaHecha, setReplicaHecha] = useState<{ oferta: string; mensaje: number | null; desde: number } | null>(null);
  /** Lo que MaKo sabe para preguntar antes de escribir la réplica (las ofertas con lo que les falta, el tema), y lo contestado. */
  const [prep, setPrep] = useState<PreparacionCorta | null>(null);
  const [respRep, setRespRep] = useState<RespuestasIniciativa>({});
  const [guardandoDato, setGuardandoDato] = useState(false);
  /** Las preguntas y respuestas de la réplica: se guardan en la charla recién cuando empieza a escribir (si se corta antes, al volver pregunta de nuevo). */
  const sinGuardar = useRef<{ de: 'yo' | 'mako'; texto: string }[]>([]);
  const fallosAlGuardar = useRef<string[]>([]);
  const aceptarAlTerminar = useRef(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [cita, setCita] = useState<Cita | null>(null);
  const [errorCaja, setErrorCaja] = useState<string | null>(null);
  const [intencion, elegirIntencion] = useIntencion();
  const [refs, setRefs] = useState<Referencia[]>([]);
  const [citables, setCitables] = useState<Referencia[] | null>(null);
  const [activaRef, setActivaRef] = useState(0);
  const hiloRef = useRef<HTMLDivElement>(null);
  const corte = useRef<AbortController | null>(null);
  const saltear = useRef(false);
  const pedidoInicial = useRef<string | null>(null);
  const appEscritorio = useAppDeEscritorio();
  const adj = useAdjuntosDelChat({ puede: !corriendo && !!id, onError: setErrorCaja });
  const vivo = useRef({ mensajes, id, leerVivo, editor, paginas, leerApi, catalogos, plantilla });
  vivo.current = { mensajes, id, leerVivo, editor, paginas, leerApi, catalogos, plantilla };

  const conPropuestaAbierta = mensajes.some((m) => m.de === 'mako' && (m.estado === 'construyendo' || m.estado === 'pendiente'));

  // Al abrir un guion: su charla guardada, y el pedido que traía de la caja grande del inicio. Una propuesta de OTRO
  // guion ya no existe (su editor se desmontó sin guardarla): la pausa se suelta.
  useEffect(() => {
    setMensajes([]);
    setCita(null);
    setRefs([]);
    setAdaptando(false);
    setRespIni({});
    setHiloLeido(false);
    setReplicaHecha(null);
    setPrep(null);
    setRespRep({});
    setGuardandoDato(false);
    sinGuardar.current = [];
    fallosAlGuardar.current = [];
    aceptarAlTerminar.current = false;
    corte.current?.abort();
    setCorriendo(false);
    onPausa(false);
    if (!id) return;
    pedidoInicial.current = tomarPedido(ws, id);
    // Recién creada en esta pestaña (./cliente → marcarRecienCreada): su chat está vacío y no se espera a leerlo.
    if (esRecienCreada(id)) { setHiloLeido(true); return; }
    const ac = new AbortController();
    void leerHiloDeTab(claveDeGuion(id), ac.signal).then((filas) => {
      if (ac.signal.aborted) return;
      setHiloLeido(true);
      if (!filas?.length) return;
      setMensajes((ms) => (ms.length ? ms : mensajesDeFilas(filas).map((m): Mensaje => (m.de === 'yo'
        ? { id: nuevoId(), de: 'yo', texto: m.texto, ...(m.adjuntos?.length ? { adjuntos: m.adjuntos } : {}) }
        : { id: nuevoId(), de: 'mako', texto: m.texto, ...(m.error ? { error: true } : {}) }))));
    });
    return () => ac.abort();
  }, [id, ws]); // eslint-disable-line react-hooks/exhaustive-deps

  // El chat baja solo con cada mensaje nuevo.
  useEffect(() => {
    const el = hiloRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes.length, corriendo]);

  const cambiarMensaje = useCallback((mid: number, c: Partial<Extract<Mensaje, { de: 'mako' }>>) => {
    setMensajes((ms) => ms.map((m) => (m.id === mid && m.de === 'mako' ? { ...m, ...c } : m)));
  }, []);

  /** El título de la charla en el Ops Center. */
  const tituloCharla = useCallback(() => `Copywriter · ${(vivo.current.leerVivo()?.titulo || guion?.pagina.titulo || SIN_TITULO).trim()}`, [guion]);

  /** Un pedido a /api/copywriter/ia, con los archivos en multipart. Nunca tira. */
  const pedirIA = async (datos: Record<string, unknown>, archivos: File[], ac: AbortController): Promise<{ ok: true; [k: string]: unknown } | { ok: false; error: string }> => {
    try {
      const res = await fetch('/api/copywriter/ia', {
        method: 'POST',
        ...(archivos.length ? { body: cuerpoConArchivos(datos, archivos) } : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }),
        signal: AbortSignal.any ? AbortSignal.any([ac.signal, AbortSignal.timeout(PLAZO_IA_MS)]) : ac.signal,
      });
      const t = await res.text();
      let d: unknown = null;
      try { d = JSON.parse(t); } catch { /* no es JSON: el corte de la plataforma */ }
      if (d && typeof d === 'object' && typeof (d as { ok?: unknown }).ok === 'boolean') {
        const o = d as { ok: boolean; error?: unknown };
        return o.ok ? (d as { ok: true }) : { ok: false, error: typeof o.error === 'string' ? o.error : `Error ${res.status}` };
      }
      return { ok: false, error: res.status === 413 ? 'Los archivos pesan demasiado.' : res.status === 504 ? 'MaKo tardó demasiado. Vuelve a intentar.' : `Error ${res.status}` };
    } catch {
      return ac.signal.aborted ? { ok: false, error: 'Detenido' } : { ok: false, error: 'Sin conexión. Vuelve a intentar.' };
    }
  };

  /** Lo que viaja de la charla (lo último que se dijo). */
  const charla = () => vivo.current.mensajes.slice(-8).map((m) => ({ de: m.de, texto: m.texto }));
  const guionVivo = () => {
    const v = vivo.current.leerVivo();
    return { titulo: v?.titulo ?? '', props: v?.props, contenido: vivo.current.editor?.leer() as JsonNodo };
  };
  // `Record` y no `{ noLeidos?: unknown }`: un tipo con todo opcional es «débil», y TS no deja pasar la respuesta (que no lo
  // nombra) aunque tenga índice (TS2559, lo vio el tsc acotado del 28/10).
  const notaNoLeidos = (r: Record<string, unknown>) => (Array.isArray(r.noLeidos) && r.noLeidos.length ? `\n\n(No pude leer: ${r.noLeidos.join(', ')}.)` : '');

  /** «Discutir»: lo escrito (y lo adjuntado y citado) va a MaKo con el guion vivo; la respuesta queda en el hilo y en la base. */
  const pedirDiscusion = useCallback(async (pregunta: string, archivos: File[] = [], citadas: Referencia[] = []) => {
    const { id: idG, editor: ed } = vivo.current;
    if (!idG || !ed || !pregunta.trim()) return false;
    const yo: Mensaje = { id: nuevoId(), de: 'yo', texto: pregunta, ...(archivos.length ? { adjuntos: archivos.map((f) => f.name) } : {}) };
    setMensajes((xs) => [...xs, yo]);
    setCorriendo(true);
    const ac = new AbortController();
    corte.current = ac;
    const r = await pedirIA({ accion: 'discutir', pregunta, guion: guionVivo(), charla: charla(), referencias: citadas }, archivos, ac);
    if (corte.current === ac) corte.current = null;
    setCorriendo(false);
    if (vivo.current.id !== idG) return true;
    const mako: Mensaje = r.ok
      ? { id: nuevoId(), de: 'mako', texto: String(r.respuesta ?? '') + notaNoLeidos(r) }
      : { id: nuevoId(), de: 'mako', texto: r.error, error: true };
    setMensajes((xs) => [...xs, mako]);
    void guardarEnHiloDeTab(claveDeGuion(idG), tituloCharla(), filasDeAgente([yo, mako]));
    return true;
  }, [tituloCharla]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * «Editar»: MaKo devuelve herramientas; acá se vuelven a validar contra el guion de AHORA, se construyen a la vista y
   * quedan como propuesta. Nada se guarda hasta «Aceptar». Con `adaptar`, es adaptar la plantilla (la última respuesta a
   * las preguntas de MaKo al crear): si MaKo contesta con una pregunta, el panel queda «adaptando».
   * `mostrar = false`: el pedido que arman las preguntas de MaKo NO se dibuja (las respuestas ya están arriba, con su pregunta);
   * igual queda en la charla que lee MaKo y en el hilo guardado. 11/11/2026, en producción: «Mensajes con una palabra» y «Sprint de Diseño» en píldora,
   * y abajo otra burbuja «Es para: Mensajes con una palabra. Adáptalo a mi oferta…», con otro estilo, diciendo lo mismo.
   */
  const pedirEdicion = useCallback(async (instruccion: string, archivos: File[] = [], citadas: Referencia[] = [], adaptar = false, mostrar = true) => {
    const { id: idG, editor: ed } = vivo.current;
    if (!idG || !ed || !instruccion.trim()) return false;
    const yo: Mensaje = { id: nuevoId(), de: 'yo', texto: instruccion, ...(archivos.length ? { adjuntos: archivos.map((f) => f.name) } : {}), ...(mostrar ? {} : { oculto: true }) };
    setMensajes((xs) => [...xs, yo]);
    setCorriendo(true);
    const ac = new AbortController();
    corte.current = ac;
    const r = await pedirIA({ accion: adaptar ? 'adaptar' : 'editar', instruccion, guion: guionVivo(), charla: charla(), referencias: citadas }, archivos, ac);
    if (corte.current === ac) corte.current = null;
    if (vivo.current.id !== idG || vivo.current.editor !== ed || !ed.vivo()) { setCorriendo(false); return true; }
    if (!r.ok) {
      setCorriendo(false);
      const mako: Mensaje = { id: nuevoId(), de: 'mako', texto: r.error, error: true };
      setMensajes((xs) => [...xs, mako]);
      void guardarEnHiloDeTab(claveDeGuion(idG), tituloCharla(), filasDeAgente([yo, mako]));
      return true;
    }
    // Otra vez contra lo de AHORA (la persona pudo escribir mientras MaKo pensaba): un id que ya no está se descarta.
    const antes = ed.leer();
    // La plantilla como NACIÓ (sus secciones con las guías, nada escrito por la persona): no hay nada que pisar, así que lo que
    // escribe MaKo queda en la página sin «Aceptar», como la réplica (12/11/2026, en producción: la plantilla quedaba como
    // propuesta; memoria «replicar-deja-todo-escrito»). Sobre lo ya escrito sigue siendo propuesta.
    const pl = vivo.current.plantilla;
    // Y una página VACÍA, pida lo que pida (12/11/2026, en producción: «Página en blanco» + «escribe un reel» pedía «Aceptar»).
    const textoAntes = textoDelDoc(antes as JsonNodo).trim();
    const nacida = !textoAntes || (adaptar && !!pl && textoAntes === textoDelDoc(pl.esqueleto()).trim());
    const cat = vivo.current.catalogos;
    const s = sanearOperaciones(r.operaciones, antes, { angulos: new Set(cat.angulos.map((a) => a.id)), estructuras: new Set(cat.estructuras.map((e) => e.id)) });
    const res = aplicarTodo(antes, s.ops);
    const respuesta = String(r.respuesta ?? '') + notaNoLeidos(r);
    const cambiaAlgo = res.nuevos.length > 0 || res.titulo != null || Object.keys(res.props).length > 0 || JSON.stringify(res.doc) !== JSON.stringify(antes);
    // Adaptando, una respuesta sin cambios es una PREGUNTA de MaKo: la próxima respuesta de la persona sigue adaptando.
    setAdaptando(adaptar && !cambiaAlgo);
    if (!cambiaAlgo) {
      setCorriendo(false);
      const mako: Mensaje = { id: nuevoId(), de: 'mako', texto: respuesta };
      setMensajes((xs) => [...xs, mako]);
      void guardarEnHiloDeTab(claveDeGuion(idG), tituloCharla(), filasDeAgente([yo, mako]));
      return true;
    }
    const propuesta: Propuesta = {
      antes, final: res.doc, nuevos: res.nuevos, titulo: res.titulo, props: res.props, instruccion, refs: citadas,
      descartadas: [...(Array.isArray(r.descartadas) ? (r.descartadas as Descartada[]) : []), ...s.descartadas, ...res.descartadas],
      avisos: Array.isArray(r.avisos) ? (r.avisos as string[]) : [],
      ...(adaptar ? { adaptar: true } : {}),
    };
    const mako: Extract<Mensaje, { de: 'mako' }> = { id: nuevoId(), de: 'mako', texto: respuesta, propuesta, estado: 'construyendo' };
    setMensajes((xs) => [...xs, mako]);
    void guardarEnHiloDeTab(claveDeGuion(idG), tituloCharla(), filasDeAgente([yo, { de: 'mako', texto: respuesta }]));
    // A la vista: el guion queda quieto (sin editar ni guardar) y se construye.
    onPausa(true);
    saltear.current = false;
    const ok = await construir(ed, cuadrosDeConstruccion(antes, s.ops), new Set(res.nuevos), { saltear: () => saltear.current });
    setCorriendo(false);
    if (!ok) {
      descartarEnDoc(ed, antes);
      onPausa(false);
      cambiarMensaje(mako.id, { estado: 'descartada', texto: `${respuesta}\n\n(No se pudo poner en la página: queda como estaba.)` });
      return true;
    }
    cambiarMensaje(mako.id, { estado: 'pendiente' });
    // Con algo descartado queda como propuesta: la tarjeta dice qué no se pudo poner (12/11/2026, el Carrusel: 3 de 4 cambios).
    if (nacida && !propuesta.descartadas.length) aceptar({ ...mako, estado: 'pendiente' });
    return true;
  }, [cambiarMensaje, onPausa, tituloCharla]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Aceptar: el resultado en UN paso de deshacer, y el título y las propiedades a la página. Recién ahí se guarda. */
  const aceptar = (m: Extract<Mensaje, { de: 'mako' }>) => {
    const ed = vivo.current.editor;
    if (!m.propuesta || !ed) return;
    if (!aceptarEnDoc(ed, m.propuesta.antes, m.propuesta.final)) { avisar('No se pudo poner en la página'); return; }
    const api = vivo.current.leerApi();
    if (m.propuesta.titulo) api?.cambiarTitulo(m.propuesta.titulo);
    if (Object.keys(m.propuesta.props).length) api?.cambiarProps(m.propuesta.props);
    onPausa(false);
    cambiarMensaje(m.id, { estado: 'aceptada' });
  };
  /** Descartar: la foto de antes, exacta. */
  const descartar = (m: Extract<Mensaje, { de: 'mako' }>) => {
    const ed = vivo.current.editor;
    if (!m.propuesta || !ed) return;
    descartarEnDoc(ed, m.propuesta.antes);
    onPausa(false);
    cambiarMensaje(m.id, { estado: 'descartada' });
  };
  /** Reintentar: descarta y vuelve a pedir lo mismo (con lo mismo citado). */
  const reintentar = (m: Extract<Mensaje, { de: 'mako' }>) => {
    if (!m.propuesta) return;
    const { instruccion, refs: citadas, adaptar } = m.propuesta;
    descartar(m);
    void pedirEdicion(instruccion, [], citadas, !!adaptar);
  };

  const puede = !!id && !!editor && !corriendo && !conPropuestaAbierta && !appEscritorio.bloqueada;
  /** Las otras ofertas para rehacer la réplica. */
  const ofertasReplica = prep?.ofertas ?? ofertas;
  const otrasReplica = replicaHecha ? otrasOfertasDeReplica(replicaHecha.oferta, ofertasReplica) : [];

  // La réplica, a otra función de MaKo (13/11/2026): el avatar recibe lo que se DICE (lib/guion-pasado.ts, sin la URL) y abre tu
  // último avatar; el carrusel se arma en Image con las láminas del guion y se abre.
  const router = useRouter();
  const [armandoCarrusel, setArmandoCarrusel] = useState(false);
  const hacerConAvatar = () => {
    const ed = vivo.current.editor;
    const dicho = ed ? dichoDelGuion(ed.leer() as JsonNodo) : '';
    if (!dicho) { avisar('La página no tiene nada que decir todavía.'); return; }
    pasarGuion('avatar', ws, dicho);
    // La ruta de AI Avatar (la de PERSONAJE_CON_IA, app/video-editor/plantillas-crear.ts; el teléfono la lleva a /m solo).
    router.push('/ai-avatar');
  };
  const hacerCarrusel = async () => {
    const ed = vivo.current.editor;
    if (!ed || armandoCarrusel) return;
    setArmandoCarrusel(true);
    const r = await crearCarruselDesdeGuionAction({ titulo: vivo.current.leerVivo()?.titulo ?? '', laminas: laminasDelGuion(ed.leer() as JsonNodo) })
      .catch(() => ({ ok: false as const, error: 'No se pudo crear el carrusel.' }));
    setArmandoCarrusel(false);
    if (!r.ok) { avisar(r.error); return; }
    // La ruta del diseño (la de `rutaDiseno`, app/image-editor/ruta.ts, que sólo importa el editor: tests/image-editor-integracion
    // 4); el `?ws=` lo pega este router.
    router.push(`/image-editor/${encodeURIComponent(r.id)}`);
  };

  // La pregunta de la iniciativa que sigue (sólo con el chat vacío), y contestarla: con la última, el pedido a la IA.
  // Recién con la charla leída: antes, una página vieja mostraba un instante la primera pregunta (12/11/2026, en producción).
  const pasoIni = hiloLeido && mensajes.length === 0 && id ? pasoPendiente(pasosIni, respIni) : null;
  const responderIni = (valor: string) => {
    if (!pasoIni) return;
    const r = { ...respIni, [pasoIni.id]: valor };
    setRespIni(r);
    if (pasoPendiente(pasosIni, r)) return;
    const pedido = pedidoIni(r);
    if (pedido.adaptar) { void pedirEdicion(pedido.texto, [], [], true, false); return; }
    setMensajes((xs) => [...xs, { id: nuevoId(), de: 'yo', texto: pedido.texto, oculto: true }, { id: nuevoId(), de: 'mako', texto: 'Listo: la estructura queda para ti. Cuando quieras, pídeme lo que necesites.' }]);
  };
  /** Esa respuesta cierra las preguntas y pide a la IA: espera a que se pueda (editor listo, sin otro pedido corriendo). */
  const llamaALaIA = (valor: string) => {
    if (!pasoIni) return false;
    const r = { ...respIni, [pasoIni.id]: valor };
    return !pasoPendiente(pasosIni, r) && pedidoIni(r).adaptar;
  };

  /** Lo escrito: a la pregunta de MaKo si hay una; si no, a «Discutir» o «Editar» (o a «adaptar», si MaKo preguntó un dato). */
  const pedir = (t: string, archivos: File[] = [], citadas: Referencia[] = []) => {
    if (pasoIni) { responderIni(t.trim()); return Promise.resolve(true); }
    if (pasoRep) {
      // Un dato de la oferta se contesta escribiendo; las demás preguntas, con sus botones (o escribiendo uno de ellos).
      const op = pasoRep.opciones.find((o) => o.texto.toLowerCase() === t.trim().toLowerCase());
      if (pasoRep.libre || op) { void responderRep(op ? op.valor : t.trim()); return Promise.resolve(true); }
      avisar('Toca una de las opciones de MaKo.');
      return Promise.resolve(false);
    }
    return adaptando ? pedirEdicion(t, archivos, citadas, true)
      : intencion === 'discutir' ? pedirDiscusion(t, archivos, citadas) : pedirEdicion(t, archivos, citadas);
  };
  /** Una sugerencia o el selector: salen de «adaptando». */
  const pedirSugerencia = (s: string) => { setAdaptando(false); void (intencion === 'discutir' ? pedirDiscusion(s) : pedirEdicion(s)); };

  // El pedido de la caja grande del inicio sale SOLO, en «Editar», apenas el editor está listo.
  useEffect(() => {
    const p = pedidoInicial.current;
    if (!p || !editor || !id || corriendo || appEscritorio.bloqueada) return;
    pedidoInicial.current = null;
    elegirIntencion('editar');
    void pedirEdicion(`Escribe esta página: ${p}`);
  }, [editor, id, corriendo, appEscritorio.bloqueada]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Escribe la réplica ENTERA con lo contestado (la oferta, sus datos, cómo usar el tema) y la deja en la página sin «Aceptar»: sobre
   * la página vacía y también al rehacerla para otra oferta (13/11/2026, la maqueta: «sin Aceptar»; Ctrl+Z la deshace).
   */
  const escribirReplica = (r: RespuestasIniciativa) => {
    const idG = vivo.current.id;
    if (!idG) return;
    elegirIntencion('editar');
    aceptarAlTerminar.current = true;
    setReplicaHecha({ oferta: r.oferta ?? AL_NEGOCIO, mensaje: null, desde: vivo.current.mensajes.length });
    // Las preguntas y respuestas quedan en la charla (las lee MaKo y se ven al volver), recién ahora que empieza a escribir.
    if (sinGuardar.current.length) void guardarEnHiloDeTab(claveDeGuion(idG), tituloCharla(), filasDeAgente(sinGuardar.current));
    sinGuardar.current = [];
    void pedirEdicion(pedidoDeReplica(r, ofertasReplica, prep?.tema.original?.nombre ?? null).texto, [], [], false, false);
  };

  // Al abrir la réplica vacía (la charla ya leída y vacía, el editor listo, la página sin texto): transcribe el original si es un
  // video (13/11/2026, Martín: «primero tiene que transcribir y mostrar la transcripción»; ./transcribir-original.ts) y trae lo que
  // MaKo necesita para preguntar (las ofertas con lo que les falta y el tema: lib/copywriter/replica-servidor.ts). Las preguntas no
  // llaman a la IA: salen aunque no esté la app de escritorio; escribir, no.
  const preparando = useRef<string | null>(null);
  const [lineaTranscripcion, setLineaTranscripcion] = useState<string | null>(null);
  useEffect(() => {
    if (!replica || !id || !editor || !hiloLeido || corriendo || replicaHecha || prep || preparando.current === id) return;
    if (mensajes.length || textoDelDoc(editor.leer() as JsonNodo).trim()) return;
    const outlier = guion?.doc.props.outlier ?? '';
    preparando.current = id;
    void (async () => {
      const t = await transcribirSiHaceFalta(outlier, setLineaTranscripcion).catch(() => null);
      if (vivo.current.id !== id) { preparando.current = null; return; }
      if (t) {
        setMensajes((xs) => [...xs, { id: nuevoId(), de: 'mako', texto: t.texto }]);
        sinGuardar.current.push({ de: 'mako', texto: t.texto });
        if (t.ok) avisarOriginalNuevo(outlier);
      }
      setLineaTranscripcion('Mirando tus ofertas…');
      const p = await pedirPreparacion(outlier).catch(() => null);
      setLineaTranscripcion(null);
      preparando.current = null;
      if (vivo.current.id !== id) return;
      // Sin la preparación (la base no contestó), igual pregunta la oferta, sin saber qué le falta.
      setPrep(p?.ok ? p : { tema: { original: null, negocio: null, relacionado: true }, ofertas: ofertas.map((o) => ({ ...o, falta: [] })) });
    })();
  }, [replica, id, editor, hiloLeido, corriendo, replicaHecha, prep, mensajes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // La pregunta de la réplica que sigue; sin ninguna, escribe (cuando se puede: editor listo, sin otro pedido, con la app).
  const pasoRep = replica && prep && !replicaHecha ? pasoDeReplica(prep, respRep) : null;
  useEffect(() => {
    if (!replica || !prep || replicaHecha || corriendo || guardandoDato || !editor || !id || appEscritorio.bloqueada) return;
    if (pasoDeReplica(prep, respRep)) return;
    escribirReplica(respRep);
  }, [replica, prep, respRep, replicaHecha, corriendo, guardandoDato, editor, id, appEscritorio.bloqueada]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Contestar una pregunta de la réplica (un botón, o lo escrito en un dato de la oferta). La pregunta y la respuesta quedan en la
   * charla, en orden. Un dato de la oferta se GUARDA en la oferta (lo ven Offer y el resto de MaKo); si no se puede guardar, igual
   * va en el pedido. «Completarla en Offer» lleva a esa oferta en Offer.
   */
  const responderRep = async (valor: string) => {
    const paso = pasoRep;
    if (!paso || !prep || !id || guardandoDato) return;
    if (valor === EN_OFFER) {
      const o = ofertaElegida(prep, respRep);
      router.push(o ? `/offer?oferta=${o.id}` : '/offer');
      return;
    }
    const qa: Mensaje[] = [{ id: nuevoId(), de: 'mako', texto: paso.pregunta }, { id: nuevoId(), de: 'yo', texto: textoDeRespuesta(paso, valor) }];
    setMensajes((xs) => [...xs, ...qa]);
    sinGuardar.current.push(...qa.map((m) => ({ de: m.de, texto: m.texto })));
    const nuevas = responderReplica(paso, valor, respRep);
    const campo = paso.id.slice(FALTA.length);
    const o = ofertaElegida(prep, respRep);
    if (paso.id.startsWith(FALTA) && valor !== SEGUIR_SIN && o && esCampoQueFalta(campo)) {
      setGuardandoDato(true);
      const r = await pedirCompletarOferta(o.id, campo, valor);
      setGuardandoDato(false);
      if (vivo.current.id !== id) return;
      if (!r.ok) fallosAlGuardar.current.push(r.error);
      if (!faltaPorPreguntar(prep, nuevas).length) {
        const dicho = fallosAlGuardar.current.length
          ? `No pude guardarlo en tu oferta (${fallosAlGuardar.current[0].replace(/\.$/, '')}): lo uso igual en esta pieza.`
          : `Listo: lo guardé en tu oferta «${o.nombre}» (lo ven también Offer y el resto de MaKo).`;
        setMensajes((xs) => [...xs, { id: nuevoId(), de: 'mako', texto: dicho }]);
        sinGuardar.current.push({ de: 'mako', texto: dicho });
      }
    }
    setRespRep(nuevas);
  };

  /** «¿Lo rehago para otra?»: la misma réplica con otra oferta (pregunta lo que le falte a ésa) y escrita sin «Aceptar». */
  const rehacerPara = (valor: string) => {
    setRespRep((r) => ({ ...(r.tema ? { tema: r.tema } : {}), oferta: valor }));
    setReplicaHecha(null);
  };

  // Lo que escribió sobre la página vacía queda en la página sin pedir «Aceptar» (no había nada que pisar), y su mensaje lleva
  // abajo las otras ofertas.
  useEffect(() => {
    if (!replicaHecha || replicaHecha.mensaje != null) return;
    // Sólo lo que llegó desde este pedido (al rehacer para otra oferta, el mensaje de antes ya estaba).
    const ultimo = mensajes.slice(replicaHecha.desde).reverse().find((m) => m.de === 'mako');
    if (!ultimo || ultimo.de !== 'mako') return;
    if (ultimo.estado === 'construyendo') return;
    setReplicaHecha({ ...replicaHecha, mensaje: ultimo.id });
    if (aceptarAlTerminar.current && ultimo.estado === 'pendiente') aceptar(ultimo);
    aceptarAlTerminar.current = false;
  }, [mensajes]); // eslint-disable-line react-hooks/exhaustive-deps

  // La propuesta pendiente, para quien la decide desde afuera (el teléfono: onPendiente).
  useEffect(() => {
    if (!onPendiente) return;
    const m = [...mensajes].reverse().find((x): x is Extract<Mensaje, { de: 'mako' }> => x.de === 'mako' && x.estado === 'pendiente' && !!x.propuesta);
    onPendiente(m ? { aceptar: () => aceptar(m), descartar: () => descartar(m) } : null);
  }, [mensajes, onPendiente]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!citarRef) return;
    citarRef.current = (seleccion) => {
      const t = (seleccion ?? '').replace(/\s+/g, ' ').trim();
      if (t) { setCita({ de: 'La página', texto: t, id: null }); elegirIntencion('editar'); }
      window.setTimeout(() => campo.current?.focus(), 0);
    };
    return () => { citarRef.current = null; };
  }, [citarRef, campo, elegirIntencion]);

  // La nota de voz sale en el acto y, ya en texto, va como lo escrito.
  const nota = useNotaEnElActo({ clave: `copywriter:${id ?? 'nada'}`, puede, mandar: (t) => { void pedir(t); } });

  // ── «@» ────────────────────────────────────────────────────────────────────
  const consulta = consultaArroba(texto);
  useEffect(() => {
    if (consulta == null || citables) return;
    setCitables([]);
    void pedirCitables().then((r) => setCitables(r.ok ? r.archivos.map((a): Referencia => ({ tipo: 'archivo', id: a.id, nombre: a.nombre })) : []));
  }, [consulta, citables]);
  const todasLasCitables = useMemo((): Referencia[] => [
    REF_OFERTA,
    ...paginas.filter((p) => p.id !== id && !escondida(paginas, p.id)).map((p): Referencia => ({ tipo: 'guion', id: p.id, nombre: p.titulo, tipoGuion: p.tipo })),
    ...(citables ?? []),
  ], [paginas, id, citables]);
  const opcionesRef = consulta == null ? [] : buscarReferencias(consulta, todasLasCitables, refs);
  useEffect(() => { setActivaRef(0); }, [consulta]);
  const elegirRef = useCallback((r: Referencia) => {
    const e = elegirReferencia(texto, r, refs);
    setTexto(e.texto);
    setRefs(e.elegidas);
    window.setTimeout(() => campo.current?.focus(), 0);
  }, [texto, refs, campo]);
  // Con la lista abierta, las flechas eligen y Enter o Tab citan (antes que la caja, que mandaría el mensaje).
  const teclasRef = useRef({ abierta: false, opciones: opcionesRef, activa: activaRef, elegir: elegirRef });
  teclasRef.current = { abierta: consulta != null && opcionesRef.length > 0, opciones: opcionesRef, activa: activaRef, elegir: elegirRef };
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    const tecla = (e: KeyboardEvent) => {
      const t = teclasRef.current;
      if (!t.abierta) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setActivaRef((a) => (a + 1) % t.opciones.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setActivaRef((a) => (a - 1 + t.opciones.length) % t.opciones.length); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); const r = t.opciones[t.activa]; if (r) t.elegir(r); }
    };
    el.addEventListener('keydown', tecla, true);
    return () => el.removeEventListener('keydown', tecla, true);
  }, [campo, id]);

  const mandar = () => {
    if (!puede || adj.preparando || (!texto.trim() && !adj.hay)) return;
    const t = armarConCita(cita, texto.trim() || 'Mira lo que te adjunto.');
    const archivos = adj.tomar();
    const citadas = refs;
    setTexto('');
    setCita(null);
    setRefs([]);
    void pedir(t, archivos, citadas);
  };

  const citar = useCallback((m: MensajeWA) => {
    setCita({ de: m.de, texto: m.texto, id: m.id });
    window.setTimeout(() => campo.current?.focus(), 0);
  }, [campo]);

  const items = useMemo((): ItemHilo[] => mensajes.filter((m) => !(m.de === 'yo' && m.oculto)).map((m): ItemHilo => (m.de === 'yo'
    ? { k: 'msg', id: String(m.id), role: 'user', texto: m.texto, at: null, ...(m.adjuntos?.length ? { archivos: m.adjuntos.map(archivoDe) } : {}) }
    : { k: 'msg', id: String(m.id), role: 'assistant', texto: m.error ? '' : m.texto, at: null })), [mensajes]);

  const enMensaje = (x: Extract<ItemHilo, { k: 'msg' }>): EnMensaje | null => {
    const m = mensajes.find((y) => String(y.id) === x.id);
    if (!m || m.de !== 'mako') return null;
    // Sin IA no es una falla para Soporte: es algo que se conecta (12/11/2026, en producción, el negocio de prueba replicando desde
    // el teléfono: «No hay ninguna IA conectada…» con «Reportar a Soporte» y ningún camino). Es una invitación, no un error: va
    // como `status` (un `alert` lleva siempre «Reportar a Soporte», tests/reportar-a-soporte.test.ts). El link es el de contrato.
    if (m.error && /^No hay ninguna IA conectada/.test(m.texto)) {
      return { arriba: <div className="nt-mako-error" role="status">{m.texto}<div className="nt-mako-pildoras"><Link href={rutaDeTarjeta('ia')} className="nt-mako-pildora">Conectar mi IA</Link></div></div> };
    }
    if (m.error) return { arriba: <div className="nt-mako-error" role="alert">{m.texto}<ReportarASoporte /></div> };
    if (!m.propuesta || !m.estado) return null;
    const p = m.propuesta;
    return {
      abajo: (
        <div className="nt-propuesta-tarjeta" data-estado={m.estado}>
          {m.estado === 'construyendo' && (
            <div className="nt-propuesta-fila">
              <span className="nt-mako-estado">Escribiendo en la página…</span>
              <button type="button" className="nt-boton-texto" onClick={() => { saltear.current = true; }}>Saltear</button>
            </div>
          )}
          {m.estado === 'pendiente' && (
            <>
              <div className="nt-mako-estado">
                {/* «1 bloque nuevo», no «1 bloque nuevos» (11/11/2026, en producción). */}
                {p.nuevos.length ? `${cuantos(p.nuevos.length)} ${p.nuevos.length === 1 ? 'nuevo, marcado' : 'nuevos, marcados'} en la página.` : 'Cambios marcados en la página.'}
                {p.titulo ? ` Título: «${p.titulo}».` : ''}
              </div>
              {p.avisos.map((a) => <div key={a} className="nt-propuesta-aviso">{a}</div>)}
              {p.descartadas.length > 0 && <div className="nt-mako-estado">{p.descartadas.length === 1 ? 'Un cambio no se pudo poner' : `${p.descartadas.length} cambios no se pudieron poner`}: {p.descartadas[0].motivo}</div>}
              <div className="nt-propuesta-fila">
                <button type="button" className="nt-boton-primario" onClick={() => aceptar(m)}>Aceptar</button>
                <button type="button" className="nt-boton-texto" onClick={() => descartar(m)}>Descartar</button>
                <button type="button" className="nt-boton-texto" onClick={() => reintentar(m)}>Reintentar</button>
              </div>
            </>
          )}
          {/* La tecla, sólo donde hay teclado (11/11/2026, en producción el teléfono decía «Ctrl+Z en la página lo deshace»):
              `.nt[data-movil]` la esconde, y en una Mac es ⌘Z. */}
          {m.estado === 'aceptada' && <div className="nt-mako-estado">{m.id === replicaHecha?.mensaje ? 'Quedó escrito en la página.' : 'Aceptado.'}<span className="nt-solo-teclado"> {teclaDeshacer()} en la página lo deshace.</span></div>}
          {/* Lo que avisa también cuando quedó escrito solo (la réplica, la plantilla sin tocar): hasta el 12/11/2026 sólo se veía con
              «Aceptar», así que el aviso de frases copiadas nunca salía en una réplica. */}
          {m.estado === 'aceptada' && p.avisos.map((a) => <div key={a} className="nt-propuesta-aviso">{a}</div>)}
          {/* La réplica escrita sola: con qué oferta, y las otras para rehacerla (11/11/2026: «si hay una oferta principal, usala
              y dejá cambiarla»). */}
          {m.id === replicaHecha?.mensaje && (m.estado === 'aceptada' || m.estado === 'pendiente') && otrasReplica.length > 0 && (
            <>
              <div className="nt-mako-estado">{`Lo escribí para ${nombreDeOferta(replicaHecha.oferta, ofertasReplica) ? `tu oferta «${nombreDeOferta(replicaHecha.oferta, ofertasReplica)}»` : 'tu negocio'}. ¿Lo rehago para otra?`}</div>
              <div className="nt-mako-pildoras">
                {otrasReplica.map((o) => (
                  <button key={o.valor} type="button" className="nt-mako-pildora" disabled={!puede} onClick={() => rehacerPara(o.valor)}>{o.texto}</button>
                ))}
              </div>
            </>
          )}
          {/* Llevarla a otra función (13/11/2026, Martín en la llamada con Leila: es enlazar, no rehacer; quien prefiere grabarse
              se queda con el guion): el avatar recibe lo que se DICE, Image arma las LÁMINAS (lib/copywriter/hacia-otras.ts). */}
          {/* Lo que falta completar, contado (la maqueta: «Falta: 1 dato (un caso real)»): cifras y casos sólo del negocio. */}
          {m.id === replicaHecha?.mensaje && m.estado === 'aceptada' && datosQueFaltan(p.final) > 0 && (
            <div className="nt-mako-estado">{datosQueFaltan(p.final) === 1 ? 'Falta 1 dato: está marcado [DATO: …] en la página.' : `Faltan ${datosQueFaltan(p.final)} datos: están marcados [DATO: …] en la página.`}</div>
          )}
          {m.id === replicaHecha?.mensaje && m.estado === 'aceptada' && (
            <div className="nt-mako-pildoras">
              <button type="button" className="nt-mako-pildora" onClick={hacerConAvatar}>Hacerlo con tu avatar IA</button>
              <button type="button" className="nt-mako-pildora" disabled={armandoCarrusel} onClick={() => void hacerCarrusel()}>{armandoCarrusel ? 'Armando el carrusel…' : 'Hacerlo carrusel'}</button>
            </div>
          )}
          {m.estado === 'descartada' && <div className="nt-mako-estado">Descartado: la página quedó como estaba.</div>}
        </div>
      ),
    };
  };

  const vacia = !!editor && !textoDelDoc(editor.leer() as JsonNodo).trim();
  const sugerencias = intencion === 'editar' && vacia ? SUGERENCIAS_VACIA : SUGERENCIAS[intencion];

  return (
    // Un <section> y no un <aside> (la barra de la agencia le fuerza el alto de la ventana a todo <aside>: PanelAgente.tsx).
    <section role="complementary" className="nt-mako" aria-label="MaKo">
      <PanelAgenteChat hilo={hiloRef} adjuntos={adj.caja}
        cabecera={{
          clave: `copywriter:${id ?? 'nada'}`, titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: corriendo ? 'trabajando' : 'despierto', antes: volver,
          acciones: <span className="nt-mako-estado">{corriendo ? 'escribiendo…' : 'en línea'}</span>,
        }}
        caja={(
          <div className="nt-mako-pie">
            <SelectorIntencion valor={intencion} onCambio={(v) => { setAdaptando(false); elegirIntencion(v); }} deshabilitado={corriendo || conPropuestaAbierta} />
            <CajaAgente campo={campo} texto={texto} onTexto={setTexto} onMandar={mandar} adjuntos={adj.caja} hayAlgoMas={adj.hay || refs.length > 0}
              ocupado={corriendo || conPropuestaAbierta || nota.pendientes || adj.preparando || guardandoDato} apagado={!id || !editor} placeholder={pasoRep?.libre ? 'Escribe tu respuesta' : 'Escribe a MaKo'} tituloMandar="Enviar" enterManda
              bloqueo={appEscritorio.bloqueo} onGrabada={nota.onGrabada}
              arriba={(
                <>
                  {consulta != null && <ListaReferencias opciones={opcionesRef} activa={activaRef} onElegir={elegirRef} />}
                  <ChipsReferencias refs={refs} onQuitar={(r) => setRefs((xs) => xs.filter((x) => !(x.tipo === r.tipo && x.id === r.id)))} />
                  {cita ? <CitaAgente cita={cita} onQuitar={() => setCita(null)} /> : null}
                </>
              )} />
            {conPropuestaAbierta && !corriendo && <p className="nt-mako-estado">Acepta o descarta lo que escribió MaKo para seguir.</p>}
            {errorCaja && <p className="nt-mako-estado" role="alert">{errorCaja}<ReportarASoporte /></p>}
          </div>
        )}>
        {/* Lo que MaKo ya preguntó y la persona contestó: queda arriba de la charla que sigue. */}
        {id && pasosIni.filter((x) => x.id in respIni).map((x) => (
          <div key={x.id} className="nt-mako-par">
            <div className="nt-mako-bienvenida">{x.pregunta}</div>
            <div className="nt-mako-respuesta">{textoDeRespuesta(x, respIni[x.id])}</div>
          </div>
        ))}
        {pasoIni ? (
          // La página nació de una plantilla: MaKo pregunta, de a una y con botones, sin llamar a la IA (se ve aunque no esté
          // la app de escritorio). El botón que cierra las preguntas y pide a la IA espera a que se pueda.
          <>
            <div className="nt-mako-bienvenida">{pasoIni.pregunta}{pasoIni.libre ? ' Toca una opción o escríbelo.' : ''}</div>
            <div className="nt-mako-pildoras">
              {pasoIni.opciones.map((o, i) => (
                <button key={o.valor} type="button" className="nt-mako-pildora" {...(i === 0 ? { 'data-principal': '' } : {})}
                  disabled={llamaALaIA(o.valor) && !puede} onClick={() => responderIni(o.valor)}>{o.texto}</button>
              ))}
            </div>
            {/* Los botones grises dicen por qué (13/11/2026, en producción, un negocio sin la app: las ofertas apagadas y nada al lado). */}
            {appEscritorio.bloqueada && pasoIni.opciones.some((o) => llamaALaIA(o.valor)) && (
              <div className="nt-mako-estado">Para que MaKo lo escriba, instala su app: el botón está abajo.</div>
            )}
          </>
        ) : mensajes.length === 0 && Object.keys(respIni).length === 0 && id && hiloLeido && !pasosIni.length && !replica && (
          // Sin el texto que explicaba cómo usar el chat (12/11/2026, Martín: «arriba en MaKo dice un texto que es innecesario… eso es
          // totalmente innecesario»): sólo lo que se le puede pedir, en botones. Sin página abierta no hay nada que decir.
          // Con el hilo LEÍDO y fuera de una plantilla (13/11/2026, en producción: al abrir una plantilla salían «Mejorar la
          // escritura · Acortar · Alargar» uno a cinco segundos, hasta que llegaba la pregunta de MaKo).
          <div className="nt-mako-pildoras">
            {sugerencias.map((s) => (
              <button key={s} type="button" className="nt-mako-pildora" disabled={!puede} onClick={() => pedirSugerencia(s)}>{s}</button>
            ))}
          </div>
        )}
        <HiloAgente items={nota.conNotas(items)} corriendo={corriendo} enMensaje={enMensaje} onCitar={citar}
          onReintentar={nota.reintentar(() => {})} onDescartar={nota.descartar} />
        {pasoRep && (
          // La réplica: MaKo pregunta antes de escribir, de a una y con botones (lib/copywriter/iniciativa.ts, `pasoDeReplica`).
          <>
            <div className="nt-mako-bienvenida">{pasoRep.pregunta}{pasoRep.libre ? ' Escríbelo abajo.' : ''}</div>
            <div className="nt-mako-pildoras">
              {pasoRep.opciones.map((o, i) => (
                <button key={o.valor} type="button" className="nt-mako-pildora" {...(i === 0 && !pasoRep.libre ? { 'data-principal': '' } : {})}
                  disabled={guardandoDato || corriendo} onClick={() => void responderRep(o.valor)}>{o.texto}</button>
              ))}
            </div>
          </>
        )}
        {guardandoDato && <div className="nt-mako-estado" aria-live="polite">Guardando en tu oferta…</div>}
        {replica && prep && !pasoRep && !replicaHecha && appEscritorio.bloqueada && (
          <div className="nt-mako-estado">Para que MaKo lo escriba, instala su app: el botón está abajo.</div>
        )}
        {lineaTranscripcion && <div className="nt-mako-estado" aria-live="polite">{lineaTranscripcion}</div>}
        {corriendo && !conPropuestaAbierta && (
          <button type="button" className="nt-mako-pildora" onClick={() => { corte.current?.abort(); avisar('Detenido'); }}>Detener</button>
        )}
      </PanelAgenteChat>
    </section>
  );
}
