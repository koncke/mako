'use client';

// =============================================================================
// piezas — lo chico que comparten todas las pantallas de la comunidad
// =============================================================================
// El contexto (qué API, qué tema, quién mira), la cara con la insignia de nivel, el texto con links y
// menciones, el like, la encuesta, el video, el adjunto y el menú de los tres puntos. Las pantallas
// (Feed, PostAbierto, Ranking, Miembros) las arman; acá no se pide nada al server salvo el like y el voto.
//
// ⚠️ NINGÚN TEXTO DE UNA PERSONA SE INYECTA COMO HTML: el cuerpo llega partido en pedazos
//    (`tokensDeTexto`, lib/comunidad-reglas.ts) y cada pedazo se dibuja como texto de React. Un link es
//    un `<a>` con un href que ya pasó por `URL` y es http/https.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useCapaModal } from '@/app/_components/pila-modales';
import type { ApiComunidad } from './api';
import type { AdjuntoVista, ComunidadVista, EncuestaVista, MiembroVista, VideoVista } from '@/lib/comunidad-tipos';
import { haceCuanto, type TokenTexto } from '@/lib/comunidad-reglas';

// ── El contexto ──────────────────────────────────────────────────────────────────

export type Tema = 'equipo' | 'alumno';

export type CtxComunidad = {
  api: ApiComunidad;
  tema: Tema;
  comunidad: ComunidadVista;
  setComunidad: (f: (c: ComunidadVista) => ComunidadVista) => void;
  abrirPerfil: (clave: string) => void;
  abrirPost: (id: number) => void;
  /** Abre un evento del calendario (desde la campana): su id y la fecha de la ocurrencia. */
  abrirEvento: (id: number, ocurrencia: string | null) => void;
  /** Sacar a un alumno de la comunidad (moderación). `null` = quien mira no puede (no es del equipo). */
  sacar: ((m: Pick<MiembroVista, 'clave' | 'nombre'>) => void) | null;
  /** Un aviso corto (3-4 palabras). */
  aviso: (msg: string) => void;
  confirmar: (msg: ReactNode, opts: { title?: string; confirmLabel: string; cancelLabel: string }) => Promise<boolean>;
  /** El reloj de la pantalla, para los «hace cuánto» (se mueve cada minuto). `null` hasta montar. */
  ahora: number | null;
};

export const Ctx = createContext<CtxComunidad | null>(null);

export function useComunidad(): CtxComunidad {
  const c = useContext(Ctx);
  if (!c) throw new Error('useComunidad fuera de <Comunidad>');
  return c;
}

// ── Íconos chicos (los de la comunidad; el set de la app no tiene pulgar ni chinche) ──

const TRAZOS: Record<string, ReactNode> = {
  like: (<path d="M7 10v10H4.5A1.5 1.5 0 0 1 3 18.5v-7A1.5 1.5 0 0 1 4.5 10H7Zm0 0 4-7a2.2 2.2 0 0 1 2.6 2.7L12.8 9H18a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 16.8 20H7" />),
  comentario: (<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V16h0A1.5 1.5 0 0 1 4 14.5v-9Z" />),
  pin: (<><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" /><path d="M12 14v7" /></>),
  clip: (<path d="M15.5 7.5 9 14a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.6-5.6l-7 7a6 6 0 0 0 8.5 8.5L20 14" />),
  video: (<><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="m16 10.5 5-3v9l-5-3" /></>),
  encuesta: (<><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></>),
  puntos: (<g fill="currentColor" stroke="none"><circle cx="5.5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18.5" cy="12" r="1.7" /></g>),
  candado: (<><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>),
  archivo: (<><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4" /></>),
  x: (<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />),
  lapiz: (<><path d="M4 20l3.6-.9L18.2 8.5 15.5 5.8 4.9 16.4 4 20Z" /><path d="M14 7.3 16.7 10" /></>),
  link: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  // La segunda mitad: la campana, el calendario, la lupa, el reloj, el lugar y las flechas del mes.
  campana: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  campanaOff: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /><path d="M4 4l16 16" /></>),
  calendario: (<><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17" /><path d="M8 3v4M16 3v4" /></>),
  lupa: (<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>),
  reloj: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  lugar: (<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></>),
  izq: (<path d="m14.5 6-6 6 6 6" />),
  der: (<path d="m9.5 6 6 6-6 6" />),
  repetir: (<><path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3" /><path d="M20 13v2a3 3 0 0 1-3 3H5l3 3" /></>),
  info: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><path d="M12 8h.01" /></>),
};

export function Ico({ n, size = 18 }: { n: keyof typeof TRAZOS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" style={{ flex: 'none' }}>
      {TRAZOS[n] ?? null}
    </svg>
  );
}

// ── La cara: avatar con la insignia de nivel (abajo a la derecha, como Skool) ────

const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function AvatarNivel({ m, size = 40, sinNivel = false }: { m: Pick<MiembroVista, 'nombre' | 'foto' | 'nivel'>; size?: number; sinNivel?: boolean }) {
  const [rota, setRota] = useState(false);
  return (
    <span className="cmu-av" style={{ width: size, height: size }}>
      {m.foto && !rota ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cmu-av-img" src={m.foto} alt="" width={size} height={size} referrerPolicy="no-referrer"
          style={{ width: size, height: size }} onError={() => setRota(true)} />
      ) : (
        <span className="cmu-av-ini" aria-hidden style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>{iniciales(m.nombre)}</span>
      )}
      {/* La insignia crece con la cara: 18 px sobre un avatar de 104 no se lee. */}
      {!sinNivel && (
        <span className="cmu-av-nivel" title={`Nivel ${m.nivel}`}
          style={size >= 56 ? { minWidth: Math.round(size * 0.3), height: Math.round(size * 0.3), fontSize: Math.round(size * 0.15), right: 0, bottom: 0 } : undefined}>
          {m.nivel}
        </span>
      )}
    </span>
  );
}

/** El nombre de alguien, que abre su perfil. Con «Equipo» al lado si es del equipo. */
export function NombreMiembro({ m, conTag = true }: { m: MiembroVista; conTag?: boolean }) {
  const { abrirPerfil } = useComunidad();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <button type="button" className="cmu-nombre-btn" onClick={(e) => { e.stopPropagation(); abrirPerfil(m.clave); }}>
        <span className="cmu-nombre">{m.nombre}</span>
      </button>
      {conTag && m.equipo && <span className="cmu-tag cmu-tag--equipo">Equipo</span>}
    </span>
  );
}

/** «Hace cuánto», con la fecha entera en el `title`. */
export function Hace({ iso }: { iso: string | null | undefined }) {
  const { ahora } = useComunidad();
  if (!iso || ahora == null) return null;
  const d = new Date(iso);
  return <time dateTime={iso} title={Number.isFinite(d.getTime()) ? d.toLocaleString('es') : undefined}>{haceCuanto(iso, ahora)}</time>;
}

// ── El texto ────────────────────────────────────────────────────────────────────

/** Un cuerpo ya partido en texto, links y menciones. Una mención abre el perfil de esa persona. */
export function Texto({ tokens, className = 'cmu-texto' }: { tokens: readonly TokenTexto[]; className?: string }) {
  const { abrirPerfil } = useComunidad();
  return (
    <p className={className}>
      {tokens.map((t, i) => {
        if (t.tipo === 'link') {
          return <a key={i} className="cmu-link" href={t.href} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()}>{t.texto}</a>;
        }
        if (t.tipo === 'mencion') {
          return (
            <button key={i} type="button" className="cmu-nombre-btn cmu-mencion" onClick={(e) => { e.stopPropagation(); abrirPerfil(t.clave); }}>
              {t.texto}
            </button>
          );
        }
        return <span key={i}>{t.texto}</span>;
      })}
    </p>
  );
}

// ── El like ─────────────────────────────────────────────────────────────────────

/**
 * El like de un post o un comentario. Optimista: cambia en el acto y, si el server dice que no,
 * vuelve a lo de antes con el motivo. Lo propio no se likea (el botón queda apagado: el server lo
 * rechaza igual, ver `puedeDarLike`).
 */
export function BotonLike({ objetivo, likes, meGusta, puede, onCambio }: {
  objetivo: string;
  likes: number;
  meGusta: boolean;
  puede: boolean;
  onCambio: (likes: number, meGusta: boolean) => void;
}) {
  const { api, aviso } = useComunidad();
  const [enCurso, setEnCurso] = useState(false);
  const cambiar = async () => {
    if (!puede || enCurso) return;
    const si = !meGusta;
    const antes = { likes, meGusta };
    onCambio(Math.max(0, likes + (si ? 1 : -1)), si);
    setEnCurso(true);
    const r = await api.like(objetivo, si);
    setEnCurso(false);
    if (r.ok) onCambio(r.likes, r.meGusta);
    else { onCambio(antes.likes, antes.meGusta); aviso(r.error); }
  };
  return (
    <button type="button" className="cmu-accion" data-on={meGusta} disabled={!puede}
      aria-pressed={meGusta} title={puede ? (meGusta ? 'Quitar like' : 'Me gusta') : 'Es tuyo'}
      onClick={(e) => { e.stopPropagation(); void cambiar(); }}>
      <Ico n="like" /> <span>{likes}</span>
    </button>
  );
}

// ── La encuesta ─────────────────────────────────────────────────────────────────

/**
 * Las opciones con sus resultados. Se vota con un clic (y se cambia con otro); los resultados se ven
 * después de votar, como en Skool. Quien ya votó ve la barra y el %.
 */
export function Encuesta({ postId, encuesta, onCambio }: { postId: number; encuesta: EncuestaVista; onCambio: (e: EncuestaVista) => void }) {
  const { api, aviso } = useComunidad();
  const [enCurso, setEnCurso] = useState(false);
  const voto = encuesta.miVoto;
  const votar = async (opcion: string) => {
    if (enCurso || opcion === voto) return;
    setEnCurso(true);
    const r = await api.votar(postId, opcion);
    setEnCurso(false);
    if (r.ok) onCambio(r.encuesta); else aviso(r.error);
  };
  return (
    <div className="cmu-encuesta" onClick={(e) => e.stopPropagation()}>
      {encuesta.opciones.map((o) => (
        <button key={o.id} type="button" className="cmu-opcion" data-mio={voto === o.id} disabled={enCurso} onClick={() => void votar(o.id)}>
          {voto && <i className="cmu-opcion-barra" style={{ width: `${o.pct}%` }} aria-hidden />}
          <span className="cmu-opcion-texto">{o.texto}</span>
          {voto && <span className="cmu-mono">{o.pct}%</span>}
        </button>
      ))}
      <span className="cmu-meta">{encuesta.total} {encuesta.total === 1 ? 'voto' : 'votos'}</span>
    </div>
  );
}

// ── Video y adjunto ─────────────────────────────────────────────────────────────

export function Video({ video }: { video: VideoVista }) {
  return (
    <div className="cmu-video" onClick={(e) => e.stopPropagation()}>
      <iframe src={video.embed} title="Video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}

const tamano = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Una imagen se ve; cualquier otro archivo es una fila que abre (o baja) con su nombre. */
export function Adjunto({ adjunto }: { adjunto: AdjuntoVista }) {
  if (adjunto.imagen && adjunto.url) {
    return (
      <a href={adjunto.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cmu-img" src={adjunto.url} alt={adjunto.nombre} loading="lazy" />
      </a>
    );
  }
  const fila = (
    <>
      <Ico n="archivo" />
      <span className="cmu-adjunto-nombre">{adjunto.nombre}</span>
      <span className="cmu-meta">{adjunto.url ? tamano(adjunto.bytes) : 'No disponible'}</span>
    </>
  );
  return adjunto.url
    ? <a className="cmu-adjunto" href={adjunto.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{fila}</a>
    : <div className="cmu-adjunto">{fila}</div>;
}

// ── Un popover abierto es una CAPA ──────────────────────────────────────────────

/**
 * Registra un popover abierto (el menú de los tres puntos, el panel de la campana, las sugerencias de
 * una @mención) en la pila de modales, y lo cierra con Escape o con un clic afuera de `caja`. No
 * dibuja nada: se monta mientras el popover está abierto.
 *
 * ⚠️ SIN REGISTRARSE, EL ESCAPE CERRABA TAMBIÉN EL MODAL DE ABAJO. El post abierto, el compositor y
 *    el evento son un `Modal`, que escucha Escape en `document` y en captura; `stopPropagation` no
 *    frena a otro listener del MISMO nodo. Así, cerrar las sugerencias de una @mención con Escape
 *    cerraba el compositor entero (y el archivo subido se descartaba al desmontarlo). Registrado como
 *    capa `anidada`, el modal de abajo deja de ser «el de arriba» y se abstiene; éste frena con
 *    `stopImmediatePropagation` (AGENTS.md, «un popover anclado también es una capa»).
 */
export function CapaPopover({ caja, onCerrar }: { caja: RefObject<HTMLElement | null>; onCerrar: () => void }) {
  const { esElDeArriba } = useCapaModal(true, { anidada: true });
  // El último `onCerrar` sin re-registrar los listeners en cada render de quien lo monta.
  const cerrar = useRef(onCerrar);
  useEffect(() => { cerrar.current = onCerrar; });
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) cerrar.current(); };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esElDeArriba()) return;
      e.stopImmediatePropagation();
      cerrar.current();
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla, true); };
  }, [caja, esElDeArriba]);
  return null;
}

// ── El menú de los tres puntos ──────────────────────────────────────────────────

export type ItemMenu = { label: string; onClick: () => void; peligro?: boolean };

/**
 * El menú de una tarjeta o un comentario. No se dibuja si no hay nada que ofrecer.
 *
 * Con `boton`, el que lo abre es ese botón (con texto) y no los tres puntos; con `arriba`, la lista
 * abre hacia ARRIBA — la usa el pie de un modal, donde abrir hacia abajo la cortaría el borde.
 */
export function Menu({ items, etiqueta = 'Opciones', boton, arriba = false }: { items: ItemMenu[]; etiqueta?: string; boton?: ReactNode; arriba?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  return (
    <div className="cmu-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      {boton ? (
        <button type="button" className="mk-btn mk-btn--secondary mk-btn--md" aria-expanded={abierto} onClick={() => setAbierto((x) => !x)}>{boton}</button>
      ) : (
        <button type="button" className="cmu-menu-btn" aria-label={etiqueta} aria-expanded={abierto} onClick={() => setAbierto((x) => !x)}>
          <Ico n="puntos" />
        </button>
      )}
      {abierto && <CapaPopover caja={ref} onCerrar={() => setAbierto(false)} />}
      {abierto && (
        <div className="cmu-menu-lista" role="menu" data-arriba={arriba || undefined}>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={`cmu-menu-item${it.peligro ? ' cmu-menu-item--peligro' : ''}`}
              onClick={() => { setAbierto(false); it.onClick(); }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
