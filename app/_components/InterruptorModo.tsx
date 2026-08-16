'use client';

// =============================================================================
// InterruptorModo — el claro/oscuro de cada usuario, en su perfil
// =============================================================================
// Vive al lado de la foto de perfil, en la barra, y es de TODOS los usuarios: el
// modo oscuro dejó de ser una isla (`/second-brain`) para ser una preferencia.
// Se guarda en el navegador de cada uno; no viaja al server ni al workspace.
//
// EL INTERRUPTOR ES EL DE nordtheme.com, reimplementado desde su código fuente.
// Verificado contra el CSS que sirve el sitio, porque no es lo que uno supondría:
//   · NO es View Transitions, NO es un morph del SVG, NO es cross-fade, NO es
//     una máscara circular.
//   · Son DOS íconos (Eva `moon-fill` y `sun-fill`) apilados en el centro de un
//     botón con `overflow:hidden`, deslizándose por un carril vertical.
//   · La LUNA siempre viaja hacia ABAJO y el SOL siempre hacia ARRIBA. Nunca al
//     revés: eso es lo que hace que el gesto se sienta el mismo siempre.
//   · 400 ms, y el que ENTRA arranca 200 ms después que el que sale. Ese desfase
//     es lo que lo hace suave en vez de mecánico.
//
// Tres cosas que Nord NO hace y acá sí: respetar `prefers-reduced-motion`,
// arrancar en el modo del sistema, y recordar la elección más allá de la pestaña
// (Nord la guarda en `sessionStorage` y la olvida al cerrar).
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { ATTR_MODO, LS_MODO } from '@/lib/temas-candidatos';

const FUERA = 30;

/** Prende o apaga el modo oscuro y lo recuerda. Exportada: la usa el boot. */
export function aplicarModo(oscuro: boolean, recordar = true) {
  const raiz = document.documentElement;
  if (oscuro) raiz.setAttribute(ATTR_MODO, 'oscuro');
  else raiz.removeAttribute(ATTR_MODO);
  if (recordar) {
    try { localStorage.setItem(LS_MODO, oscuro ? 'oscuro' : 'claro'); } catch { /* incógnito */ }
  }
  window.dispatchEvent(new Event('mako-modo'));
}

/** ¿El usuario prefiere oscuro? Su elección manda; si no eligió, el sistema. */
export function modoPreferido(): boolean {
  try {
    const g = localStorage.getItem(LS_MODO);
    if (g) return g === 'oscuro';
  } catch { /* incógnito */ }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function InterruptorModo({ compacto = false }: { compacto?: boolean }) {
  // Arranca en claro y se corrige en el efecto: el server no sabe qué eligió
  // este navegador, y pintar otra cosa sería un mismatch de hidratación.
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    const sync = () => setOscuro(document.documentElement.getAttribute(ATTR_MODO) === 'oscuro');
    sync();
    window.addEventListener('mako-modo', sync);
    // El tema candidato también toca `data-tema`: sin escuchar los dos eventos,
    // el ícono se quedaba mostrando el modo viejo.
    window.addEventListener('mako-tema-candidato', sync);
    return () => {
      window.removeEventListener('mako-modo', sync);
      window.removeEventListener('mako-tema-candidato', sync);
    };
  }, []);

  const alternar = useCallback(() => aplicarModo(!oscuro), [oscuro]);
  const rotulo = oscuro ? 'Pasar a modo claro' : 'Pasar a modo oscuro';

  return (
    <button
      type="button" onClick={alternar} title={rotulo} aria-label={rotulo} aria-pressed={oscuro}
      style={{
        position: 'relative', overflow: 'hidden', flex: 'none',
        width: compacto ? 30 : 32, height: compacto ? 30 : 32,
        border: 0, borderRadius: 'var(--r-sm)', background: 'transparent',
        color: 'var(--sidebar-text)', cursor: 'pointer',
        transition: 'background-color 120ms ease-in-out, color 120ms ease-in-out',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sidebar-2)'; e.currentTarget.style.color = 'var(--on-sidebar)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-text)'; }}
    >
      {(['luna', 'sol'] as const).map((cual) => {
        const dentro = oscuro ? cual === 'sol' : cual === 'luna';
        // Fuera del recorte: la luna espera arriba y sale por abajo; el sol al revés.
        const y = dentro ? 0 : cual === 'luna' ? -FUERA : FUERA;
        return (
          <svg
            key={cual} viewBox="0 0 24 24" aria-hidden
            className="mk-modo-ico"
            style={{
              position: 'absolute', top: '50%', left: '50%', width: 16, height: 16,
              margin: '-8px 0 0 -8px', fill: 'currentColor',
              transform: `translateY(${y}px)`,
              transitionDelay: dentro ? '200ms' : '0ms',
            }}
          >
            <path d={cual === 'luna' ? LUNA : SOL} />
          </svg>
        );
      })}
    </button>
  );
}

// Eva Icons — moon-fill y sun-fill, los mismos dos que usa nordtheme.com.
const LUNA = 'M12.3 22h-.1a10.31 10.31 0 0 1-7.34-3.15 10.46 10.46 0 0 1-.26-14 10.13 10.13 0 0 1 4-2.74 1 1 0 0 1 1.06.22 1 1 0 0 1 .24 1 8.4 8.4 0 0 0 1.94 8.81 8.47 8.47 0 0 0 8.83 1.94 1 1 0 0 1 1.27 1.29A10.16 10.16 0 0 1 19.6 19a10.28 10.28 0 0 1-7.3 3z';
const SOL = 'M12 6a1 1 0 0 0 1-1V3a1 1 0 0 0-2 0v2a1 1 0 0 0 1 1zM21 11h-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2zM6 12a1 1 0 0 0-1-1H3a1 1 0 0 0 0 2h2a1 1 0 0 0 1-1zM6.22 5A1 1 0 0 0 4.8 6.42l1.44 1.39a1 1 0 0 0 .73.28 1 1 0 0 0 .72-.31 1 1 0 0 0 0-1.41zM17 8.14a1 1 0 0 0 .69-.28l1.44-1.39A1 1 0 0 0 17.78 5l-1.44 1.42a1 1 0 0 0 0 1.41 1 1 0 0 0 .66.31zM12 18a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1zM17.73 16.14a1 1 0 0 0-1.39 1.44L17.78 19a1 1 0 0 0 .69.28 1 1 0 0 0 .72-.31 1 1 0 0 0 0-1.41zM6.27 16.14 4.83 17.53a1 1 0 0 0 0 1.41 1 1 0 0 0 .72.31 1 1 0 0 0 .69-.28l1.44-1.39a1 1 0 0 0-1.41-1.44zM12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4z';
