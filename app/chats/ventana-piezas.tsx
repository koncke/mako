'use client';

// =============================================================================
// ventana-piezas — los íconos, el avatar, los menús y el aviso de la ventana del chat
// =============================================================================
// Lo chico que comparten la cabecera (VentanaChat.tsx), el hilo (Hilo.tsx) y el composer
// (Composer.tsx), con el diseño de respond.io (docs/diseno-chats.md §3; relevamiento respondio.md
// §1.3-1.8): íconos de contorno de trazo 1,5 (su set propio se parece a Lucide), avatares redondos con
// la insignia de canal abajo a la derecha, menús blancos de radio 8 con ítems de 36 px.
//
// ⚠️ LOS MENÚS NO VAN POR PORTAL. Los tokens `--rio-*` viven adentro de `.rio` (chats.css), y un menú
//    montado en `<body>` se dibuja sin colores y sin un solo error (AGENTS.md, «un tema limitado a una
//    clase no llega a los portales»). Acá cuelgan `absolute` de su botón, adentro de la raíz: la
//    cabecera y el composer no recortan (`overflow` visible) y el hilo queda debajo.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import type { CanalChat } from '@/lib/chats-tipos';
import { InsigniaCanal } from './iconos-canal';
import { colorDe, inicialesDe } from './ventana-reglas';

// ── Íconos ───────────────────────────────────────────────────────────────────────────────────
// Dibujados para esta pantalla sobre una grilla de 24, trazo 1,5 y puntas redondas: el estilo de
// los de respond.io. Un nombre que no está acá no compila (el tipo es la lista).

const TRAZOS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checkCirculo: <><circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.8 2.8L16.2 9.6" /></>,
  circulo: <circle cx="12" cy="12" r="9" />,
  circuloPunteado: <circle cx="12" cy="12" r="9" strokeDasharray="3.2 2.6" />,
  chevAbajo: <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />,
  chevArriba: <path d="M6.5 14.5L12 9l5.5 5.5" />,
  chevDer: <path d="M9.5 6.5L15 12l-5.5 5.5" />,
  reloj: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.8v3.9l2.4 1.6M9.5 3h5M12 3v2.5M18.4 6.8l1.4-1.4" /></>,
  mas: <><circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
  panel: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M14.5 4.5v15" /></>,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.3-4.3" /></>,
  persona: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.8 19.5c1-3.3 3.9-5.3 7.2-5.3s6.2 2 7.2 5.3" /></>,
  personaMas: <><circle cx="10" cy="8.5" r="3.8" /><path d="M3 19.5c1-3.3 3.8-5.3 7-5.3 1.4 0 2.7.4 3.8 1M18 13v6M15 16h6" /></>,
  ficha: <><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><circle cx="12" cy="10" r="2.8" /><path d="M7.5 17c.8-1.9 2.5-3 4.5-3s3.7 1.1 4.5 3" /></>,
  prohibido: <><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></>,
  ojoTachado: <><path d="M3.5 12s3-6 8.5-6c1.6 0 3 .5 4.2 1.2M20.5 12s-3 6-8.5 6c-1.6 0-3-.5-4.2-1.2" /><path d="M10 12a2 2 0 0 0 2 2M4 4l16 16" /></>,
  ojo: <><path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  sincronizar: <><path d="M19.5 9A7.5 7.5 0 0 0 6 6.8L4.5 8.5M4.5 15A7.5 7.5 0 0 0 18 17.2l1.5-1.7" /><path d="M4.5 4.5v4h4M19.5 19.5v-4h-4" /></>,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  copiar: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></>,
  emoji: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><path d="M8.5 14.5c.8 1.3 2 2 3.5 2s2.7-.7 3.5-2M9 10h.01M15 10h.01" strokeWidth="2.2" /></>,
  micro: <><rect x="8.5" y="3.5" width="7" height="11" rx="3.5" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></>,
  clip: <path d="M20 11.5l-7.6 7.6a5 5 0 0 1-7.1-7.1l8-8a3.4 3.4 0 0 1 4.8 4.8l-7.9 7.9a1.7 1.7 0 0 1-2.4-2.4l7.2-7.2" />,
  enviar: <path d="M5 12h9M4.5 4.8l15 7.2-15 7.2 2.6-7.2z" />,
  varita: <><path d="M4 20L14.5 9.5M13 6.5l1.5 1.5 1.5-1.5L14.5 5zM19 3v3M17.5 4.5h3M19.5 12v2.5M18.2 13.2h2.6M8.5 3.5v2.4M7.3 4.7h2.4" /></>,
  // Las rayas del globo van con `style` y no con el atributo: un `var()` en un atributo de
  // presentación de SVG no se resuelve.
  comentario: <><rect x="3.5" y="4" width="17" height="14" rx="3" fill="currentColor" /><path d="M8 9.5h8M8 13h5" style={{ stroke: 'var(--rio-bg, #fff)' }} /></>,
  documento: <><path d="M6.5 3.5h7l4.5 4.5v12.5h-11.5z" /><path d="M13.5 3.5V8h4.5" /></>,
  alerta: <><circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" /><path d="M12 7.5v5.5M12 16.2v.3" stroke="#fff" strokeWidth="2" /></>,
  destello: <path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9-1.9 5.6-1.9-5.6-5.6-1.9 5.6-1.9z" fill="currentColor" stroke="none" />,
  calendario: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 9.5h16M8.5 3v4M15.5 3v4" /></>,
} as const;

export type NombreIco = keyof typeof TRAZOS;

export function Ico({ n, s = 20, className }: { n: NombreIco; s?: number; className?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={{ display: 'block', flex: 'none' }}>
      {TRAZOS[n]}
    </svg>
  );
}

// ── El avatar ────────────────────────────────────────────────────────────────────────────────

/**
 * Los teléfonos sin foto, para no volver a pedirlos. ⚠️ CON EL WORKSPACE EN LA CLAVE (AGENTS.md, «una
 * caché en memoria lleva el ws»): el mismo número puede ser contacto de dos clientes, y el super admin
 * los abre en dos pestañas de la misma app.
 */
const sinFoto = new Set<string>();

export type AvatarRioProps = {
  ws: number | null;
  nombre: string;
  size: number;
  /** Teléfono para la foto de WhatsApp (el proxy ?avatarimg=). */
  tel?: string | null;
  /** Una foto ya resuelta (la de un miembro del equipo). Gana sobre `tel`. */
  foto?: string | null;
  /** La insignia de canal abajo a la derecha (respond.io: sólo en la última burbuja del grupo). */
  canal?: CanalChat | null;
  /** El cuadradito naranja de un comentario interno, donde iría la insignia de canal. */
  comentario?: boolean;
  /** Es MaKo: el destello dorado, no unas iniciales. */
  mako?: boolean;
};

export function AvatarRio({ ws, nombre, size, tel, foto, canal, comentario, mako }: AvatarRioProps) {
  const wsTab = useWs();
  const [, repintar] = useState(0);
  const digitos = (tel ?? '').replace(/\D/g, '');
  const claveFoto = `${ws ?? 0}|${digitos}`;
  const src = foto || (digitos && !sinFoto.has(claveFoto) ? conWs(`/api/whatsapp/evolution/mensajes?avatarimg=${encodeURIComponent(digitos)}`, wsTab) : null);
  const ini = inicialesDe(nombre);
  let cara: ReactNode;
  if (mako) {
    cara = <span className="rio-av-cara rio-av-mako"><Ico n="destello" s={Math.round(size * 0.55)} /></span>;
  } else if (src) {
    cara = (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="rio-av-cara" src={src} alt="" referrerPolicy="no-referrer"
        onError={() => { if (!foto) { sinFoto.add(claveFoto); repintar((n) => n + 1); } }} />
    );
  } else if (ini) {
    cara = <span className="rio-av-cara" style={{ background: colorDe(nombre), fontSize: Math.round(size * 0.4) }}>{ini}</span>;
  } else {
    // Sin nombre (una saliente de la que no se sabe quién la escribió): la silueta, como el
    // «sin asignar» de respond.io, no unas iniciales inventadas.
    cara = <span className="rio-av-cara rio-av-vacio"><Ico n="persona" s={Math.round(size * 0.6)} /></span>;
  }
  const badge = Math.max(12, Math.round(size / 2));
  return (
    <span className="rio-av" style={{ width: size, height: size }} title={nombre || undefined}>
      {cara}
      {canal && !comentario && <span className="rio-av-insignia"><InsigniaCanal canal={canal} size={badge} /></span>}
      {comentario && <span className="rio-av-nota" aria-hidden="true" />}
    </span>
  );
}

// ── Menús ────────────────────────────────────────────────────────────────────────────────────

/**
 * Cierra un menú con un clic afuera o con Escape. Devuelve el ref de la CAJA que contiene el botón y
 * el menú: un clic en el botón no es «afuera» (lo maneja su propio onClick, que alterna).
 * ⚠️ Escape con `stopImmediatePropagation`: los Escape de la casa viven en `document`, y sin esto el
 *    mismo Escape cerraba el menú y además lo que hubiera abajo (la ficha, un modal).
 */
export function useAfuera<T extends HTMLElement>(abierto: boolean, cerrar: () => void) {
  const caja = useRef<T | null>(null);
  const cerrarRef = useRef(cerrar);
  useEffect(() => { cerrarRef.current = cerrar; }, [cerrar]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && caja.current?.contains(t)) return;
      cerrarRef.current();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      cerrarRef.current();
    };
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('mousedown', fuera, true);
      document.removeEventListener('keydown', tecla, true);
    };
  }, [abierto]);
  return caja;
}

/** Un renglón de menú: ícono de 16 + texto 14, y a la derecha un detalle (12 secundario) o un chevron. */
export function ItemMenu({ icono, children, detalle, elegido, deshabilitado, peligro, onClick, title }: {
  icono?: ReactNode;
  children: ReactNode;
  detalle?: ReactNode;
  elegido?: boolean;
  deshabilitado?: boolean;
  peligro?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button type="button" role="menuitem" className={`rio-mi${elegido ? ' rio-mi-on' : ''}${peligro ? ' rio-mi-peligro' : ''}`}
      disabled={deshabilitado} onClick={onClick} title={title}>
      {icono && <span className="rio-mi-ico">{icono}</span>}
      <span className="rio-mi-txt">{children}</span>
      {detalle != null && <span className="rio-mi-det">{detalle}</span>}
    </button>
  );
}

// ── El aviso ─────────────────────────────────────────────────────────────────────────────────
// El toast de respond.io: abajo a la izquierda, verde claro con un check (o rojo con un «!») y una ✕.
// Tres o cuatro palabras (AGENTS.md); el detalle de un error va en el `title`.

export type AvisoRio = { texto: string; error?: boolean; detalle?: string | null } | null;

export function useAvisoRio(ms = 3200) {
  const [aviso, setAviso] = useState<AvisoRio>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.error ? ms * 2 : ms);
    return () => clearTimeout(t);
  }, [aviso, ms]);
  return {
    aviso,
    ok: (texto: string, detalle?: string | null) => setAviso({ texto, detalle: detalle ?? null }),
    error: (texto: string, detalle?: string | null) => setAviso({ texto, error: true, detalle: detalle ?? null }),
    cerrar: () => setAviso(null),
  };
}

export function AvisoVentana({ aviso, onCerrar }: { aviso: AvisoRio; onCerrar: () => void }) {
  if (!aviso) return null;
  return (
    <div role="status" aria-live="polite" className={`rio-aviso${aviso.error ? ' rio-aviso-error' : ''}`} title={aviso.detalle ?? undefined}>
      {aviso.error ? <span className="rio-aviso-ico-error"><Ico n="alerta" s={18} /></span> : <span className="rio-aviso-ok"><Ico n="check" s={12} /></span>}
      <span>{aviso.texto}</span>
      <button type="button" className="rio-aviso-x" onClick={onCerrar} aria-label="Cerrar aviso"><Ico n="x" s={14} /></button>
    </div>
  );
}

/** Un POST JSON que nunca tira: la red caída vuelve como `{ ok:false, error }`, como un 500. */
export async function postJson<T extends { ok?: boolean; error?: string }>(url: string, body: unknown): Promise<T> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    const j = (await r.json().catch(() => null)) as T | null;
    if (j && typeof j === 'object') return (r.ok ? j : { ...j, ok: false }) as T;
    return { ok: false, error: `Error ${r.status}` } as T;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Sin conexión' } as T;
  }
}
