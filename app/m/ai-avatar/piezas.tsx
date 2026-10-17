'use client';

// =============================================================================
// /m/ai-avatar — las piezas que comparten las cuatro pantallas: los chips, la portada y el reproductor de voces
// =============================================================================
// Las mismas de escritorio (app/ai-avatar/AiAvatarCliente.tsx: Chip, Portada, useReproductor), en tamaño de
// teléfono: chips de 44 px en una tira que se desliza (los filtros de la biblioteca de HeyGen en su app), y un solo
// audio sonando en toda la pantalla.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import type { PlantillaAvatar } from '@/lib/ai-avatar/plantillas';

/** La tira de chips de filtro (se desliza de costado si no entra). */
export function ChipsM({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  return <div className="m-ai-avatar-chips" role="group" aria-label={etiqueta} data-m-sin-pull>{children}</div>;
}

export function ChipM({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="m-ai-avatar-chip" aria-pressed={activo} onClick={onClick}>{children}</button>
  );
}

/** La portada de una plantilla: su video real si lo hay; si no, el lugar escrito (como escritorio). */
export function PortadaM({ p }: { p: PlantillaAvatar }) {
  if (p.ejemplo) {
    // Muted + playsInline: sin las dos, el teléfono no deja autoplay.
    return <video className="m-ai-avatar-portada" src={p.ejemplo.video} poster={p.ejemplo.poster} autoPlay loop muted playsInline />;
  }
  return <div className="m-ai-avatar-portada m-ai-avatar-portada--texto"><span>{p.lugar}</span></div>;
}

/** Un solo audio sonando en toda la pantalla: apretar otra muestra corta la anterior. */
export function useReproductorM() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [sonando, setSonando] = useState<string | null>(null);
  const tocar = useCallback((clave: string, url: string) => {
    if (!audio.current) {
      audio.current = new Audio();
      audio.current.onended = () => setSonando(null);
    }
    if (sonando === clave) { audio.current.pause(); setSonando(null); return; }
    audio.current.src = url;
    void audio.current.play().then(() => setSonando(clave), () => setSonando(null));
  }, [sonando]);
  useEffect(() => () => { audio.current?.pause(); }, []);
  return { sonando, tocar };
}

/** El botón redondo de escuchar / pausar (44 px), el de la biblioteca de voces de HeyGen. */
export function BotonEscucharM({ activo, onClick, etiqueta }: { activo: boolean; onClick: () => void; etiqueta: string }) {
  return (
    <button type="button" className="m-ai-avatar-play" aria-label={activo ? 'Pausar' : etiqueta} aria-pressed={activo}
      onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <Icon name={activo ? 'pausa' : 'play'} size={18} />
    </button>
  );
}
