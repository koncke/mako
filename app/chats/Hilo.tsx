'use client';

// =============================================================================
// Hilo — las burbujas de la ventana del chat, copiadas de respond.io
// =============================================================================
// docs/diseno-chats.md §3; medidas en el relevamiento (respondio.md §1.4, capturas 07, 24, 27, 33):
//   · ENTRANTE a la izquierda, #f2f2f3, con el avatar de 32 y la insignia de canal SÓLO en la última
//     burbuja del grupo (las de antes quedan sangradas 40 px, el lugar del avatar).
//   · SALIENTE a la derecha, #f0f5ff, con el avatar del agente y su insignia; el estado de entrega a la
//     IZQUIERDA de la burbuja: ✓ gris enviado, ✓✓ gris entregado, ✓✓ #4287ff leído, círculo rojo «!»
//     fallido con el error del canal en el tooltip.
//   · COMENTARIO interno a la derecha, #ffebd1, con el avatar del autor y un cuadradito naranja donde
//     iría la insignia de canal.
//   · EVENTOS centrados en 12/400 con las partes en negrita (`MensajeChat.partes`); una tirada larga se
//     pliega en «› N eventos más».
//   · El CHIP DE FECHA centrado («Hoy», «Ayer», «12 dic 2025») queda FIJO arriba mientras se scrollea su
//     día: es `sticky` adentro de la sección del día, así el día siguiente lo empuja (como respond.io).
//   · Al pasar el mouse: la fila entera toma #f9fafb, aparece la barra flotante con «Copiar» y un
//     tooltip con la hora exacta («Enviado: 4 jun, 2:57:41 p. m.»).
//   · Adjuntos: imagen (con visor), audio (el reproductor de la casa), video, y el documento como
//     tarjeta con ícono + nombre.
//
// Lo que NO se copia de respond.io, y por qué: responder citando y traducir (v2; la cita no existe en
// Evolution ni en Zernio), «Copy link» (un mensaje no tiene URL propia en MaKo), la tarjeta de hito de
// abrir/cerrar (los eventos llegan como texto en partes; sale como línea centrada) y «escribiendo…»
// (ningún canal de MaKo lo entrega).
//
// ⚠️ EL HILO BAJA SOLO SÓLO SI LA PERSONA ESTÁ ABAJO. Si subió a leer algo, una lectura nueva (cada 8 s)
//    no la arrastra al final; enviar sí (`bajar`).
// ⚠️ LAS URL INTERNAS DE LA MEDIA (el proxy `/api/whatsapp/evolution/mensajes?media=`) LLEVAN EL `?ws=`:
//    un `<img>` o un `<a target="_blank">` no pasa por el fetch parcheado, y sin el ws el super admin
//    pide la foto en la cuenta de su cookie, no en la del cliente que mira (AGENTS.md, «cinco formas de
//    navegar»).

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChatResumen, MensajeChat } from '@/lib/chats-tipos';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
import { TextoMarcas } from '@/app/_components/TextoMarcas';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { AvatarRio, Ico } from './ventana-piezas';
import { armarHilo, extensionDoc, momentoExacto, partirEnlaces, plegarEventos, tickDe, type ItemHilo } from './ventana-reglas';

type Miembro = { nombre: string; foto_url: string | null };

export type HiloProps = {
  ws: number | null;
  chat: ChatResumen;
  mensajes: MensajeChat[];
  equipo: Miembro[];
  cargando: boolean;
  /** «No pude leer» y todavía no hay nada que mostrar: el tercer estado, con su Reintentar. */
  error: string | null;
  onReintentar: () => void;
  /** Cada vez que cambia, el hilo baja al final (se acaba de enviar algo). */
  bajar: number;
  onCopiado: () => void;
};

/** Pegado al final = a menos de esto del fondo. */
const PEGADO_PX = 120;

export function Hilo({ ws, chat, mensajes, equipo, cargando, error, onReintentar, bajar, onCopiado }: HiloProps) {
  const scroll = useRef<HTMLDivElement | null>(null);
  const pegado = useRef(true);
  const primera = useRef(true);
  const [visor, setVisor] = useState<string | null>(null);
  // `new Date()` en cada armado: «Hoy» y «Ayer» se recalculan con cada lectura del sondeo (8 s), así
  // un hilo abierto a medianoche no queda diciendo «Hoy» sobre lo de ayer.
  const dias = useMemo(() => armarHilo(mensajes, new Date()), [mensajes]);
  const fotos = useMemo(() => new Map(equipo.map((e) => [e.nombre, e.foto_url])), [equipo]);

  const alFondo = () => { const el = scroll.current; if (el) el.scrollTop = el.scrollHeight; };

  useLayoutEffect(() => {
    if (!mensajes.length) return;
    if (primera.current) { primera.current = false; alFondo(); return; }
    if (pegado.current) alFondo();
  }, [mensajes]);
  useLayoutEffect(() => { if (bajar) { pegado.current = true; alFondo(); } }, [bajar]);

  useEffect(() => {
    if (!visor) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setVisor(null); } };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [visor]);

  const onScroll = () => {
    const el = scroll.current;
    if (el) pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < PEGADO_PX;
  };
  // Una imagen que termina de cargar estira el hilo: si estaba abajo, sigue abajo.
  const onCarga = () => { if (pegado.current) alFondo(); };

  const copiar = (texto: string) => {
    void navigator.clipboard?.writeText(texto).then(onCopiado, () => {});
  };

  return (
    <div className="rio-hilo" ref={scroll} onScroll={onScroll}>
      {!mensajes.length && (
        <div className="rio-hilo-estado">
          {error ? (
            <>
              <span>{error}</span>
              <button type="button" className="rio-btn" onClick={onReintentar}>Reintentar</button>
            </>
          ) : cargando ? <span className="rio-giro" aria-label="Cargando" /> : <span>Sin mensajes todavía.</span>}
        </div>
      )}
      {dias.map((d) => (
        <section key={d.dia} className="rio-dia">
          <div className="rio-dia-chip"><span className="rio-dia-chip-txt">{d.etiqueta}</span></div>
          {d.items.map((it) => (it.k === 'eventos'
            ? <Eventos key={it.id} eventos={it.eventos} />
            : <Fila key={it.m.id} it={it} ws={ws} chat={chat} fotos={fotos} onVer={setVisor} onCarga={onCarga} onCopiar={copiar} />))}
        </section>
      ))}
      {visor && (
        <div className="rio-visor" onClick={() => setVisor(null)} role="dialog" aria-label="Imagen">
          <button type="button" className="rio-visor-x" onClick={() => setVisor(null)} aria-label="Cerrar"><Ico n="x" s={20} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rio-visor-img" src={visor} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ── Una burbuja ──────────────────────────────────────────────────────────────────────────────

function Fila({ it, ws, chat, fotos, onVer, onCarga, onCopiar }: {
  it: Extract<ItemHilo, { k: 'msg' }>;
  ws: number | null;
  chat: ChatResumen;
  fotos: Map<string, string | null>;
  onVer: (url: string) => void;
  onCarga: () => void;
  onCopiar: (texto: string) => void;
}) {
  const m = it.m;
  const comentario = m.tipo === 'comentario';
  const sale = comentario || m.saliente;
  const autor = m.autor?.trim() || '';
  let avatar = null;
  if (it.ultimo) {
    if (comentario) avatar = <AvatarRio ws={ws} nombre={autor} foto={fotos.get(autor) ?? null} size={32} comentario mako={autor === 'MaKo'} />;
    else if (!m.saliente) avatar = <AvatarRio ws={ws} nombre={chat.nombre} tel={chat.avatarTel} size={32} canal={m.canal} />;
    // De una saliente de WhatsApp no se sabe quién la escribió (el espejo no lo guarda): la silueta,
    // no las iniciales de alguien que quizás no fue.
    else avatar = <AvatarRio ws={ws} nombre={autor} foto={autor ? fotos.get(autor) ?? null : null} size={32} canal={m.canal} mako={autor === 'MaKo'} />;
  }
  // Lo que se copia es el texto de la burbuja; en un documento, `texto` es el NOMBRE del archivo (así
  // lo guarda el espejo de WhatsApp) y copiarlo no le sirve a nadie.
  const copiable = m.formato !== 'document' && !!m.texto?.trim();
  const clase = comentario ? 'rio-b-nota' : m.saliente ? 'rio-b-sale' : 'rio-b-entra';
  return (
    <div className={`rio-msg ${sale ? 'rio-msg-sale' : 'rio-msg-entra'}${it.ultimo ? ' rio-msg-ult' : ''}`}>
      <div className="rio-msg-av">{avatar}</div>
      <div className="rio-msg-cuerpo">
        {sale && !comentario && <TickSaliente m={m} />}
        <div className="rio-burbuja-caja">
          <div className={`rio-burbuja ${clase}${m.formato === 'sticker' ? ' rio-b-sticker' : ''}`}>
            {!m.saliente && !comentario && it.primero && autor && <div className="rio-b-autor">{autor}</div>}
            <Contenido m={m} onVer={onVer} onCarga={onCarga} />
          </div>
          <span className="rio-tip-hora" role="tooltip">{momentoExacto(m.fecha, comentario ? null : m.saliente)}</span>
        </div>
      </div>
      {copiable && (
        <div className="rio-acciones-msg">
          <button type="button" className="rio-acc-btn" title="Copiar" aria-label="Copiar" onClick={() => onCopiar(m.texto as string)}><Ico n="copiar" s={20} /></button>
        </div>
      )}
    </div>
  );
}

function TickSaliente({ m }: { m: MensajeChat }) {
  // El optimista mientras viaja lleva un reloj (al salir pasa a ✓); un mensaje real sin estado no lleva nada (las filas
  // viejas del espejo no lo tienen, y un reloj eterno diría que nunca salió).
  if (m.id.startsWith('tmp:') && !m.status) return <span className="rio-tick" title="Enviando"><Ico n="reloj" s={14} /></span>;
  const t = tickDe(m.status);
  if (!t) return <span className="rio-tick" />;
  if (t === 'fallido') return <span className="rio-tick rio-tick-fallo" title={m.error || 'No se entregó'}><Ico n="alerta" s={16} /></span>;
  const doble = t !== 'enviado';
  return (
    <span className={`rio-tick${t === 'leido' ? ' rio-tick-leido' : ''}`} title={t === 'leido' ? 'Leído' : t === 'entregado' ? 'Entregado' : 'Enviado'}>
      <svg width={doble ? 18 : 14} height="14" viewBox={doble ? '0 0 18 14' : '0 0 14 14'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {doble
          ? <><path d="M1.5 7.5l3.2 3.2L11 4" /><path d="M7.5 10.2l.5.5L14.5 4" /></>
          : <path d="M2 7.5l3.5 3.5L12 4.5" />}
      </svg>
    </span>
  );
}

function Texto({ texto }: { texto: string }) {
  return (
    <span className="rio-txt">
      {partirEnlaces(texto).map((p, i) => (p.href
        ? <a key={i} className="rio-txt-link" href={p.href} target="_blank" rel="noreferrer noopener">{p.t}</a>
        // Con sus marcas de WhatsApp (*negrita*, _cursiva_): los asteriscos crudos se leen como un
        // error de tipeo (la misma regla que ChatHilo).
        : <TextoMarcas key={i} texto={p.t} />))}
    </span>
  );
}

function Contenido({ m, onVer, onCarga }: { m: MensajeChat; onVer: (url: string) => void; onCarga: () => void }) {
  const wsTab = useWs();
  const url = m.mediaUrl ? conWs(m.mediaUrl, wsTab) : null;
  const texto = m.texto?.trim() ? m.texto : null;
  switch (m.formato) {
    case 'image':
    case 'sticker':
      return (
        <>
          {url ? (
            <button type="button" className="rio-media-img" onClick={() => onVer(url)} aria-label="Ver imagen">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rio-media-img-el" src={url} alt="" loading="lazy" onLoad={onCarga} />
            </button>
          ) : <span className="rio-sin-media">(Imagen)</span>}
          {texto && m.formato === 'image' && <Texto texto={texto} />}
        </>
      );
    case 'video':
      return (
        <>
          {url ? <video className="rio-media-video" src={url} controls preload="metadata" onLoadedMetadata={onCarga} /> : <span className="rio-sin-media">(Video)</span>}
          {texto && <Texto texto={texto} />}
        </>
      );
    case 'audio':
      return url
        ? <AudioPlay src={url} color="var(--rio-primary, #1a6eff)" style={{ width: 240 }} />
        : <span className="rio-sin-media">(Audio)</span>;
    case 'document': {
      const nombre = texto ?? 'Documento';
      const ficha = (
        <>
          <span className="rio-doc-ico"><Ico n="documento" s={28} /><span className="rio-doc-ext">{extensionDoc(nombre, m.mediaMime)}</span></span>
          <span className="rio-doc-txt">
            <span className="rio-doc-nombre">{nombre}</span>
            <span className="rio-doc-det">{url ? extensionDoc(nombre, m.mediaMime) : 'No disponible'}</span>
          </span>
        </>
      );
      // Se abre en una pestaña nueva: el visor del PDF no entra en un iframe (X-Frame-Options).
      return url
        ? <a className="rio-doc" href={url} target="_blank" rel="noreferrer noopener">{ficha}</a>
        : <span className="rio-doc">{ficha}</span>;
    }
    case 'otro':
      return <span className="rio-sin-media">{texto ?? '(Mensaje no compatible)'}</span>;
    default:
      return texto ? <Texto texto={texto} /> : <span className="rio-sin-media">(Mensaje vacío)</span>;
  }
}

// ── Los eventos ──────────────────────────────────────────────────────────────────────────────

function LineaEvento({ e }: { e: MensajeChat }) {
  return (
    <div className="rio-ev" title={momentoExacto(e.fecha, null)}>
      {e.partes?.length
        ? e.partes.map((p, i) => (p.b ? <b key={i} className="rio-ev-b">{p.t}</b> : <Fragment key={i}>{p.t}</Fragment>))
        : e.texto}
    </div>
  );
}

function Eventos({ eventos }: { eventos: MensajeChat[] }) {
  const [abierto, setAbierto] = useState(false);
  const p = plegarEventos(eventos);
  if (abierto || !p.ocultos.length) {
    return <div className="rio-eventos">{eventos.map((e) => <LineaEvento key={e.id} e={e} />)}</div>;
  }
  return (
    <div className="rio-eventos">
      {p.cabeza.map((e) => <LineaEvento key={e.id} e={e} />)}
      <button type="button" className="rio-ev-mas" onClick={() => setAbierto(true)}>
        <Ico n="chevDer" s={14} />{p.ocultos.length} eventos más
      </button>
      {p.cola.map((e) => <LineaEvento key={e.id} e={e} />)}
    </div>
  );
}
