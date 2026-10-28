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

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
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
import { guardarEnHiloDeTab, leerHiloDeTab } from '@/lib/hilo-de-tab-cliente';
import { claveDeGuion } from '@/lib/hilo-de-tab-reglas';
import { filasDeAgente, mensajesDeFilas } from '@/app/web-generator/editor/hilo-agente';
import { SIN_TITULO, type GuionAbierto, type JsonNodo, type PaginaCopy, type PropsGuion } from '@/lib/copywriter/tipos';
import { escondida } from '@/lib/copywriter/arbol';
import type { CatalogosCopy } from '@/lib/copywriter/catalogos';
import { aplicarTodo, cuadrosDeConstruccion, sanearOperaciones, type Descartada } from '@/lib/copywriter/operaciones';
import { REF_OFERTA, buscarReferencias, consultaArroba, elegirReferencia, type Referencia } from '@/lib/copywriter/referencias-reglas';
import { aceptar as aceptarEnDoc, construir, descartar as descartarEnDoc } from './editor/propuesta';
import type { ApiPagina } from './editor/EditorGuion';
import { pedirCitables } from './cliente';
import { tomarPedido } from './pedido-guardado';
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
};
type EstadoPropuesta = 'construyendo' | 'pendiente' | 'aceptada' | 'descartada';

type Mensaje =
  | { id: number; de: 'yo'; texto: string; adjuntos?: string[] }
  | { id: number; de: 'mako'; texto: string; error?: boolean; propuesta?: Propuesta; estado?: EstadoPropuesta };

/** Lo que el panel necesita del guion vivo (lo que todavía no se guardó también cuenta). */
export type GuionVivo = { titulo: string; props: PropsGuion };

let ultimoId = 0;
const nuevoId = () => ++ultimoId;

/** Lo que se ofrece para empezar: en «Discutir», PREGUNTAS; en «Editar», PEDIDOS (los del encargo de Martín). */
const SUGERENCIAS: Readonly<Record<'discutir' | 'editar', readonly string[]>> = {
  discutir: ['¿Qué le falta a este guion para vender más?', '¿El gancho frena el scroll?', '¿El CTA es claro?'],
  editar: ['Escribe el guion completo', 'Cambia el gancho', 'Haz 3 variantes del CTA'],
};

/** Un archivo del pedido, en el hilo (no se abre desde ahí: viajó su texto, no se guardó). */
const archivoDe = (nombre: string) => ({ nombre, tipo: /\.(png|jpe?g|webp|gif|avif)$/i.test(nombre) ? 'image' as const : 'document' as const, sinAbrir: true });

/** Cuántos bloques escribió MaKo, en palabras. */
const cuantos = (n: number) => (n === 1 ? '1 bloque' : `${n} bloques`);

export function PanelMaKo({ ws, guion, paginas, editor, leerVivo, leerApi, catalogos, campo, onPausa, avisar }: {
  ws: number | null;
  guion: GuionAbierto | null;
  paginas: readonly PaginaCopy[];
  editor: Editor | null;
  /** El título y las propiedades de AHORA (EditorGuion los cambia antes de guardarlos). */
  leerVivo: () => GuionVivo | null;
  /** Lo que el chat cambia de la página al aceptar (el título y las propiedades). */
  leerApi: () => ApiPagina | null;
  catalogos: CatalogosCopy;
  campo: RefObject<HTMLTextAreaElement | null>;
  /** Una propuesta abierta: EditorGuion no se edita ni se guarda. */
  onPausa: (pausa: boolean) => void;
  avisar: (t: string) => void;
}) {
  const id = guion?.pagina.id ?? null;
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
  const vivo = useRef({ mensajes, id, leerVivo, editor, paginas, leerApi, catalogos });
  vivo.current = { mensajes, id, leerVivo, editor, paginas, leerApi, catalogos };

  const conPropuestaAbierta = mensajes.some((m) => m.de === 'mako' && (m.estado === 'construyendo' || m.estado === 'pendiente'));

  // Al abrir un guion: su charla guardada, y el pedido que traía de la caja grande del inicio. Una propuesta de OTRO
  // guion ya no existe (su editor se desmontó sin guardarla): la pausa se suelta.
  useEffect(() => {
    setMensajes([]);
    setCita(null);
    setRefs([]);
    corte.current?.abort();
    setCorriendo(false);
    onPausa(false);
    if (!id) return;
    pedidoInicial.current = tomarPedido(ws, id);
    const ac = new AbortController();
    void leerHiloDeTab(claveDeGuion(id), ac.signal).then((filas) => {
      if (ac.signal.aborted || !filas?.length) return;
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
    return { titulo: v?.titulo ?? '', props: v?.props, contenido: vivo.current.editor?.getJSON() as JsonNodo };
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
   * quedan como propuesta. Nada se guarda hasta «Aceptar».
   */
  const pedirEdicion = useCallback(async (instruccion: string, archivos: File[] = [], citadas: Referencia[] = []) => {
    const { id: idG, editor: ed } = vivo.current;
    if (!idG || !ed || !instruccion.trim()) return false;
    const yo: Mensaje = { id: nuevoId(), de: 'yo', texto: instruccion, ...(archivos.length ? { adjuntos: archivos.map((f) => f.name) } : {}) };
    setMensajes((xs) => [...xs, yo]);
    setCorriendo(true);
    const ac = new AbortController();
    corte.current = ac;
    const r = await pedirIA({ accion: 'editar', instruccion, guion: guionVivo(), charla: charla(), referencias: citadas }, archivos, ac);
    if (corte.current === ac) corte.current = null;
    if (vivo.current.id !== idG || vivo.current.editor !== ed || ed.isDestroyed) { setCorriendo(false); return true; }
    if (!r.ok) {
      setCorriendo(false);
      const mako: Mensaje = { id: nuevoId(), de: 'mako', texto: r.error, error: true };
      setMensajes((xs) => [...xs, mako]);
      void guardarEnHiloDeTab(claveDeGuion(idG), tituloCharla(), filasDeAgente([yo, mako]));
      return true;
    }
    // Otra vez contra lo de AHORA (la persona pudo escribir mientras MaKo pensaba): un id que ya no está se descarta.
    const antes = ed.getJSON() as JsonNodo;
    const cat = vivo.current.catalogos;
    const s = sanearOperaciones(r.operaciones, antes, { angulos: new Set(cat.angulos.map((a) => a.id)), estructuras: new Set(cat.estructuras.map((e) => e.id)) });
    const res = aplicarTodo(antes, s.ops);
    const respuesta = String(r.respuesta ?? '') + notaNoLeidos(r);
    const cambiaAlgo = res.nuevos.length > 0 || res.titulo != null || Object.keys(res.props).length > 0 || JSON.stringify(res.doc) !== JSON.stringify(antes);
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
      cambiarMensaje(mako.id, { estado: 'descartada', texto: `${respuesta}\n\n(No se pudo poner en el guion: queda como estaba.)` });
      return true;
    }
    cambiarMensaje(mako.id, { estado: 'pendiente' });
    return true;
  }, [cambiarMensaje, onPausa, tituloCharla]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Aceptar: el resultado en UN paso de deshacer, y el título y las propiedades a la página. Recién ahí se guarda. */
  const aceptar = (m: Extract<Mensaje, { de: 'mako' }>) => {
    const ed = vivo.current.editor;
    if (!m.propuesta || !ed) return;
    if (!aceptarEnDoc(ed, m.propuesta.antes, m.propuesta.final)) { avisar('No se pudo poner en el guion'); return; }
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
    const { instruccion, refs: citadas } = m.propuesta;
    descartar(m);
    void pedirEdicion(instruccion, [], citadas);
  };

  const puede = !!id && !!editor && !corriendo && !conPropuestaAbierta && !appEscritorio.bloqueada;

  /** Lo escrito, a «Discutir» o a «Editar» según el selector. */
  const pedir = (t: string, archivos: File[] = [], citadas: Referencia[] = []) => (intencion === 'discutir' ? pedirDiscusion(t, archivos, citadas) : pedirEdicion(t, archivos, citadas));

  // El pedido de la caja grande del inicio sale SOLO, en «Editar», apenas el editor está listo.
  useEffect(() => {
    const p = pedidoInicial.current;
    if (!p || !editor || !id || corriendo || appEscritorio.bloqueada) return;
    pedidoInicial.current = null;
    elegirIntencion('editar');
    void pedirEdicion(`Escribe el guion: ${p}`);
  }, [editor, id, corriendo, appEscritorio.bloqueada]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const items = useMemo((): ItemHilo[] => mensajes.map((m): ItemHilo => (m.de === 'yo'
    ? { k: 'msg', id: String(m.id), role: 'user', texto: m.texto, at: null, ...(m.adjuntos?.length ? { archivos: m.adjuntos.map(archivoDe) } : {}) }
    : { k: 'msg', id: String(m.id), role: 'assistant', texto: m.error ? '' : m.texto, at: null })), [mensajes]);

  const enMensaje = (x: Extract<ItemHilo, { k: 'msg' }>): EnMensaje | null => {
    const m = mensajes.find((y) => String(y.id) === x.id);
    if (!m || m.de !== 'mako') return null;
    if (m.error) return { arriba: <div className="nt-mako-error" role="alert">{m.texto}<ReportarASoporte /></div> };
    if (!m.propuesta || !m.estado) return null;
    const p = m.propuesta;
    return {
      abajo: (
        <div className="nt-propuesta-tarjeta" data-estado={m.estado}>
          {m.estado === 'construyendo' && (
            <div className="nt-propuesta-fila">
              <span className="nt-mako-estado">Escribiendo en el guion…</span>
              <button type="button" className="nt-boton-texto" onClick={() => { saltear.current = true; }}>Saltear</button>
            </div>
          )}
          {m.estado === 'pendiente' && (
            <>
              <div className="nt-mako-estado">
                {p.nuevos.length ? `${cuantos(p.nuevos.length)} nuevos, marcados en el guion.` : 'Cambios marcados en el guion.'}
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
          {m.estado === 'aceptada' && <div className="nt-mako-estado">Aceptado. Ctrl+Z en el guion lo deshace.</div>}
          {m.estado === 'descartada' && <div className="nt-mako-estado">Descartado: el guion quedó como estaba.</div>}
        </div>
      ),
    };
  };

  const sugerencias = SUGERENCIAS[intencion];

  return (
    // Un <section> y no un <aside> (la barra de la agencia le fuerza el alto de la ventana a todo <aside>: PanelAgente.tsx).
    <section role="complementary" className="nt-mako" aria-label="MaKo">
      <PanelAgenteChat hilo={hiloRef} adjuntos={adj.caja}
        cabecera={{
          clave: `copywriter:${id ?? 'nada'}`, titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: corriendo ? 'trabajando' : 'despierto',
          acciones: <span className="nt-mako-estado">{corriendo ? 'escribiendo…' : 'en línea'}</span>,
        }}
        caja={(
          <div className="nt-mako-pie">
            <SelectorIntencion valor={intencion} onCambio={elegirIntencion} deshabilitado={corriendo || conPropuestaAbierta} />
            <CajaAgente campo={campo} texto={texto} onTexto={setTexto} onMandar={mandar} adjuntos={adj.caja} hayAlgoMas={adj.hay || refs.length > 0}
              ocupado={corriendo || conPropuestaAbierta || nota.pendientes || adj.preparando} apagado={!id || !editor} placeholder="Escribe a MaKo" tituloMandar="Enviar" enterManda
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
        {mensajes.length === 0 && (
          <>
            <div className="nt-mako-bienvenida">
              {!id ? 'Elige un guion, o escribe en la caja grande cuál quieres crear.'
                : intencion === 'discutir' ? 'Pregúntame lo que quieras de este guion: te digo qué cambiaría, sin tocar nada.'
                  : 'Pídeme que escriba o cambie el guion: lo escribo acá al lado y tú decides si queda.'}
              {id && ' Con @ citas otro guion, la oferta o un archivo.'}
            </div>
            {id && (
              <div className="nt-mako-pildoras">
                {sugerencias.map((s) => (
                  <button key={s} type="button" className="nt-mako-pildora" disabled={!puede} onClick={() => void pedir(s)}>{s}</button>
                ))}
              </div>
            )}
          </>
        )}
        <HiloAgente items={nota.conNotas(items)} corriendo={corriendo} enMensaje={enMensaje} onCitar={citar}
          onReintentar={nota.reintentar(() => {})} onDescartar={nota.descartar} />
        {corriendo && !conPropuestaAbierta && (
          <button type="button" className="nt-mako-pildora" onClick={() => { corte.current?.abort(); avisar('Detenido'); }}>Detener</button>
        )}
      </PanelAgenteChat>
    </section>
  );
}
