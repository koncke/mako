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
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import type { ApiComunidad } from './api';
import type { AdjuntoVista, ComunidadVista, EncuestaVista, MiembroVista, VideoVista } from '@/lib/comunidad-tipos';
import { haceCuanto, type TokenTexto } from '@/lib/comunidad-reglas';
import { Ico } from './iconos';

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
// Viven en ./iconos.tsx desde el 16/10/2026 (sin 'use client': los dibuja también la Comunidad del
// teléfono, app/m/comunidad). Se re-exportan para que lo que ya importaba `Ico` de acá siga igual.

export { Ico } from './iconos';

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

/** `icono`: uno del set de la casa (app/_ui/iconos-menu.tsx; sexta tanda, general 10: «pon íconos en
 *  todos los desplegable, en todas las opciones»). `borrar` sale rojo solo. */
export type ItemMenu = { label: string; onClick: () => void; peligro?: boolean; icono?: NombreIconoMenu };

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
              {it.icono && <IconoMenu nombre={it.icono} size={16} />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
