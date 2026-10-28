'use client';

// =============================================================================
// PanelMaKo — el chat de MaKo a la izquierda del guion (el del Web Generator, en cada documento como en mila.gg)
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D2, D5). mila.gg pone el MISMO chat en cada documento, con su charla guardada por
// documento; MaKo ya tiene ese chat: el del agente del Web Generator (app/web-generator/editor/paneles/ChatAgente.tsx:
// el panel único del Ops Center con la estrella, el hilo `HiloMako` y la caja única `CajaChat` con el «+», las
// miniaturas, pegar, los emojis y el micrófono). Acá se usa ESE, no una copia (AGENTS.md, «Una cosa, un lugar»).
// Lo que es de esta pantalla:
//   · la charla es del GUION abierto: se guarda con la clave `copywriter:<id>` (lib/hilo-de-tab-reglas.ts) y se ve en el
//     Ops Center; al abrir otro guion se trae la suya;
//   · los archivos van con el pedido y los lee el server (app/_chat/useAdjuntosDelChat.ts + lib/adjuntos-del-chat.ts);
//   · la nota de voz sale en el acto y se pasa a texto por detrás (app/_chat/useNotaEnElActo.ts);
//   · sin la app de escritorio no se escribe (app/_chat/useAppDeEscritorio.tsx), como en todo chat de MaKo;
//   · el primer pedido de un guion recién creado desde la caja grande del inicio llega acá (./pedido-guardado.ts).
// Tanda 1 (28/10/2026): «Discutir» (contesta sin tocar el guion). «Editar», que escribe en el documento, es la tanda 2.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import type { EnMensaje } from '@/app/_chat/HiloMako';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { PanelAgenteChat, HiloAgente, CajaAgente, CitaAgente } from '@/app/web-generator/editor/paneles/ChatAgente';
import { armarConCita, type Cita, type MensajeWA } from '@/lib/centro-mensajes';
import { cuerpoConArchivos, useAdjuntosDelChat } from '@/app/_chat/useAdjuntosDelChat';
import { useNotaEnElActo } from '@/app/_chat/useNotaEnElActo';
import { useAppDeEscritorio } from '@/app/_chat/useAppDeEscritorio';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { guardarEnHiloDeTab, leerHiloDeTab } from '@/lib/hilo-de-tab-cliente';
import { claveDeGuion } from '@/lib/hilo-de-tab-reglas';
import { filasDeAgente, mensajesDeFilas } from '@/app/web-generator/editor/hilo-agente';
import { SIN_TITULO, type GuionAbierto, type JsonNodo, type PaginaCopy, type PropsGuion } from '@/lib/copywriter/tipos';
import { tomarPedido } from './pedido-guardado';

/** /api/copywriter/ia corta a los 120 s. */
const PLAZO_IA_MS = 125_000;

type Mensaje =
  | { id: number; de: 'yo'; texto: string; adjuntos?: string[] }
  | { id: number; de: 'mako'; texto: string; error?: boolean };

/** Lo que el panel necesita del guion vivo (lo que todavía no se guardó también cuenta). */
export type GuionVivo = { titulo: string; props: PropsGuion };

let ultimoId = 0;
const nuevoId = () => ++ultimoId;

/** Lo que se ofrece para empezar (en «Discutir», PREGUNTAS: pensar el guion, no cambiarlo). */
const SUGERENCIAS_DISCUTIR = [
  '¿Qué le falta a este guion para vender más?',
  '¿El gancho frena el scroll?',
  '¿El CTA es claro?',
] as const;

/** Un archivo del pedido, en el hilo (no se abre desde ahí: viajó su texto, no se guardó). */
const archivoDe = (nombre: string) => ({ nombre, tipo: /\.(png|jpe?g|webp|gif|avif)$/i.test(nombre) ? 'image' as const : 'document' as const, sinAbrir: true });

export function PanelMaKo({ ws, guion, paginas, editor, leerVivo, campo, avisar }: {
  ws: number | null;
  guion: GuionAbierto | null;
  paginas: readonly PaginaCopy[];
  editor: Editor | null;
  /** El título y las propiedades de AHORA (EditorGuion los cambia antes de guardarlos). */
  leerVivo: () => GuionVivo | null;
  campo: RefObject<HTMLTextAreaElement | null>;
  onPausa?: (pausa: boolean) => void;
  avisar: (t: string) => void;
}) {
  const id = guion?.pagina.id ?? null;
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [cita, setCita] = useState<Cita | null>(null);
  const [errorCaja, setErrorCaja] = useState<string | null>(null);
  const hiloRef = useRef<HTMLDivElement>(null);
  const corte = useRef<AbortController | null>(null);
  const appEscritorio = useAppDeEscritorio();
  const adj = useAdjuntosDelChat({ puede: !corriendo && !!id, onError: setErrorCaja });
  const vivo = useRef({ mensajes, id, leerVivo, editor, paginas });
  vivo.current = { mensajes, id, leerVivo, editor, paginas };

  // Al abrir un guion: su charla guardada, y el pedido que traía de la caja grande del inicio.
  useEffect(() => {
    setMensajes([]);
    setCita(null);
    corte.current?.abort();
    setCorriendo(false);
    if (!id) return;
    const pedido = tomarPedido(ws, id);
    if (pedido) setTexto(pedido);
    const ac = new AbortController();
    void leerHiloDeTab(claveDeGuion(id), ac.signal).then((filas) => {
      if (ac.signal.aborted || !filas?.length) return;
      setMensajes((ms) => (ms.length ? ms : mensajesDeFilas(filas).map((m): Mensaje => (m.de === 'yo'
        ? { id: nuevoId(), de: 'yo', texto: m.texto, ...(m.adjuntos?.length ? { adjuntos: m.adjuntos } : {}) }
        : { id: nuevoId(), de: 'mako', texto: m.texto, ...(m.error ? { error: true } : {}) }))));
    });
    return () => ac.abort();
  }, [id, ws]);

  // El chat baja solo con cada mensaje nuevo.
  useEffect(() => {
    const el = hiloRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes.length, corriendo]);

  /** El título de la charla en el Ops Center. */
  const tituloCharla = useCallback(() => `Copywriter · ${(vivo.current.leerVivo()?.titulo || guion?.pagina.titulo || SIN_TITULO).trim()}`, [guion]);

  /** «Discutir»: lo escrito (y lo adjuntado) va a MaKo con el guion vivo; la respuesta queda en el hilo y en la base. */
  const pedirDiscusion = useCallback(async (pregunta: string, archivos: File[] = []) => {
    const { id: idG, editor: ed, leerVivo: lv, mensajes: ms } = vivo.current;
    if (!idG || !ed || !pregunta.trim()) return false;
    const v = lv();
    const yo: Mensaje = { id: nuevoId(), de: 'yo', texto: pregunta, ...(archivos.length ? { adjuntos: archivos.map((f) => f.name) } : {}) };
    setMensajes((xs) => [...xs, yo]);
    setCorriendo(true);
    const ac = new AbortController();
    corte.current = ac;
    const datos = {
      accion: 'discutir',
      pregunta,
      guion: { titulo: v?.titulo ?? '', props: v?.props, contenido: ed.getJSON() as JsonNodo },
      charla: ms.slice(-8).map((m) => ({ de: m.de, texto: m.texto })),
    };
    let r: { ok: true; respuesta: string; noLeidos?: string[] } | { ok: false; error: string };
    try {
      const res = await fetch('/api/copywriter/ia', {
        method: 'POST',
        ...(archivos.length ? { body: cuerpoConArchivos(datos, archivos) } : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }),
        signal: AbortSignal.any ? AbortSignal.any([ac.signal, AbortSignal.timeout(PLAZO_IA_MS)]) : ac.signal,
      });
      const t = await res.text();
      let d: unknown = null;
      try { d = JSON.parse(t); } catch { /* no es JSON: el corte de la plataforma */ }
      r = d && typeof d === 'object' && typeof (d as { ok?: unknown }).ok === 'boolean'
        ? (d as typeof r)
        : { ok: false, error: res.status === 413 ? 'Los archivos pesan demasiado.' : res.status === 504 ? 'MaKo tardó demasiado. Vuelve a intentar.' : `Error ${res.status}` };
    } catch {
      r = ac.signal.aborted ? { ok: false, error: 'Detenido' } : { ok: false, error: 'Sin conexión. Vuelve a intentar.' };
    }
    if (corte.current === ac) corte.current = null;
    setCorriendo(false);
    if (vivo.current.id !== idG) return true;
    const mako: Mensaje = r.ok
      ? { id: nuevoId(), de: 'mako', texto: r.respuesta + (r.noLeidos?.length ? `\n\n(No pude leer: ${r.noLeidos.join(', ')}.)` : '') }
      : { id: nuevoId(), de: 'mako', texto: r.error, error: true };
    setMensajes((xs) => [...xs, mako]);
    void guardarEnHiloDeTab(claveDeGuion(idG), tituloCharla(), filasDeAgente([yo, mako]));
    return true;
  }, [tituloCharla]);

  const puede = !!id && !!editor && !corriendo && !appEscritorio.bloqueada;

  // La nota de voz sale en el acto y, ya en texto, va como lo escrito.
  const nota = useNotaEnElActo({ clave: `copywriter:${id ?? 'nada'}`, puede, mandar: (t) => { void pedirDiscusion(t); } });

  const mandar = () => {
    if (!puede || adj.preparando || (!texto.trim() && !adj.hay)) return;
    const pregunta = armarConCita(cita, texto.trim() || 'Mira lo que te adjunto.');
    const archivos = adj.tomar();
    setTexto('');
    setCita(null);
    void pedirDiscusion(pregunta, archivos);
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
    if (!m || m.de !== 'mako' || !m.error) return null;
    return { arriba: <div className="nt-mako-error" role="alert">{m.texto}<ReportarASoporte /></div> };
  };

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
            <CajaAgente campo={campo} texto={texto} onTexto={setTexto} onMandar={mandar} adjuntos={adj.caja} hayAlgoMas={adj.hay}
              ocupado={corriendo || nota.pendientes || adj.preparando} apagado={!id || !editor} placeholder="Escribe a MaKo" tituloMandar="Enviar" enterManda
              bloqueo={appEscritorio.bloqueo} onGrabada={nota.onGrabada}
              arriba={cita ? <CitaAgente cita={cita} onQuitar={() => setCita(null)} /> : null} />
            {errorCaja && <p className="nt-mako-estado" role="alert">{errorCaja}<ReportarASoporte /></p>}
          </div>
        )}>
        {mensajes.length === 0 && (
          <>
            <div className="nt-mako-bienvenida">
              {id ? 'Pregúntame lo que quieras de este guion: te digo qué cambiaría, sin tocar nada.' : 'Elige un guion de la izquierda, o escribe arriba cuál quieres crear.'}
            </div>
            {id && (
              <div className="nt-mako-pildoras">
                {SUGERENCIAS_DISCUTIR.map((s) => (
                  <button key={s} type="button" className="nt-mako-pildora" disabled={!puede} onClick={() => void pedirDiscusion(s)}>{s}</button>
                ))}
              </div>
            )}
          </>
        )}
        <HiloAgente items={nota.conNotas(items)} corriendo={corriendo} enMensaje={enMensaje} onCitar={citar}
          onReintentar={nota.reintentar(() => {})} onDescartar={nota.descartar} />
        {corriendo && (
          <button type="button" className="nt-mako-pildora" onClick={() => { corte.current?.abort(); avisar('Detenido'); }}>Detener</button>
        )}
      </PanelAgenteChat>
    </section>
  );
}
