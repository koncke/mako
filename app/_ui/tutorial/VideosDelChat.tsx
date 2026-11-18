'use client';
// =============================================================================
// EL ÍCONO DE VIDEOS DE UN CHAT (18/11/2026)
// =============================================================================
// Martín: «que el usuario dentro de Funnel Coach tenga el mismo ícono de videos que tiene el reto de 7 días… Lo mismo en todos los
// chats que tienen videos… que al cliquearlo se vean los videos de ese chat». En la cabecera del chat: abre la lista de SUS videos
// (sólo los que están en el manifiesto: nunca otro en su lugar) y el que se toca corre en el cuadrito de abajo a la derecha
// (`reproducirFlotante`, ./store.ts). Sin ningún video todavía, no se dibuja.
// =============================================================================
import { useState } from 'react';
import { videoDe } from '@/lib/tutoriales/videos';
import { useManifiesto } from './useVideoTutorial';
import { reproducirFlotante } from './store';

export type VideoDeUnChat = { clave: string; titulo: string };

export function VideosDelChat({ videos }: { videos: readonly VideoDeUnChat[] }) {
  const m = useManifiesto();
  const [abierto, setAbierto] = useState(false);
  const hay = m ? videos.filter((v) => videoDe(m, v.clave)) : [];
  if (!hay.length) return null;
  return (
    <span className="mk-vchat">
      <style>{CSS}</style>
      <button type="button" className="co-chip mk-vchat__boton" aria-expanded={abierto} aria-label={`Los videos de este chat (${hay.length})`} onClick={() => setAbierto((a) => !a)}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" /></svg>
        Videos
      </button>
      {abierto && (
        <ul className="mk-vchat__lista" role="menu">
          {hay.map((v) => (
            <li key={v.clave} role="none">
              <button type="button" role="menuitem" onClick={() => { setAbierto(false); reproducirFlotante(v.clave, v.titulo, 0); }}>▶ {v.titulo}</button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md).
const CSS = `
.mk-vchat { position: relative; display: inline-flex; }
.mk-vchat__boton { display: inline-flex; align-items: center; gap: 6px; }
.mk-vchat__lista { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; min-width: 240px; max-width: min(320px, calc(100vw - 32px)); margin: 0; padding: 6px; list-style: none; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); box-shadow: 0 12px 32px rgba(0,0,0,.18); }
.mk-vchat__lista button { display: block; width: 100%; text-align: left; border: 0; background: none; padding: 8px 10px; border-radius: 8px; font: inherit; font-size: var(--fs-sm); color: var(--ink); cursor: pointer; }
.mk-vchat__lista button:hover { background: var(--surface-2, rgba(0,0,0,.05)); }
@media (max-width: 640px) { .mk-vchat__lista { right: auto; left: 0; } }
`;
