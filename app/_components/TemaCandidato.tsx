'use client';

// =============================================================================
// TemaCandidato — probar un tema del rebrand sobre la app REAL
// =============================================================================
// Se elige en /admin/ui?tab=temas y se aplica a TODA la app: la idea es navegar
// el CRM, el plan y los anuncios de verdad con el tema puesto, no mirar una
// maqueta. Una maqueta siempre se ve bien; una tabla de 946 leads, no.
//
// Cómo funciona: pone `data-tema-candidato="<id>"` en <html> y las reglas viven
// en app/globals.css. No inyecta estilos en runtime ni pisa componentes — solo
// redefine tokens. Si una pantalla se rompe con esto puesto, se rompe el TEMA.
//
// ⚠️ EL <script> NO ES OPCIONAL Y NO ES UN DUPLICADO DEL EFECTO. Un useEffect
// corre DESPUÉS de la hidratación: entre el primer pintado y esa línea la app
// se ve con el tema viejo y después salta. En una navegación por link eso es un
// parpadeo en cada pantalla. El script inline corre mientras el navegador
// todavía parsea el documento, antes de pintar. El efecto sigue haciendo falta
// para el otro caso: cambiar de tema sin recargar.
//
// Y el chip de salida no es decoración. Si el único lugar donde se apaga fuera
// /admin/ui, quien se olvide el tema puesto ve la app de otro color en todas
// las pantallas sin ninguna pista de por qué — que es exactamente la regla de
// AGENTS.md: «si la única salida vive adentro de una pantalla condicional, no
// hay salida».
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { ATTR_TEMA, LS_TEMA, LS_MODO, TEMAS, esTemaValido } from '@/lib/temas-candidatos';

const MONO = "'Geist Mono', ui-monospace, monospace";

/** Lo que corre antes del primer pintado. Se mantiene chico a propósito. */
const BOOT = `
try{
  var t=localStorage.getItem('${LS_TEMA}');
  if(t)document.documentElement.setAttribute('${ATTR_TEMA}',t);
  if(t&&localStorage.getItem('${LS_MODO}')==='oscuro')document.documentElement.setAttribute('data-tema','oscuro');
}catch(e){}
`.trim();

/** Lee el estado del DOM, que es la fuente de verdad después del script. */
function leer() {
  if (typeof document === 'undefined') return { tema: null as string | null, oscuro: false };
  return {
    tema: document.documentElement.getAttribute(ATTR_TEMA),
    oscuro: document.documentElement.getAttribute('data-tema') === 'oscuro',
  };
}

/**
 * Aplica un tema. `null` lo saca.
 * Exportada porque la tab la usa para no repetir la lógica de los dos atributos
 * y las dos claves — que es donde se desincronizan estas cosas.
 */
export function aplicarTemaCandidato(id: string | null, oscuro: boolean) {
  const raiz = document.documentElement;
  if (id && esTemaValido(id)) {
    raiz.setAttribute(ATTR_TEMA, id);
    try { localStorage.setItem(LS_TEMA, id); } catch { /* modo incógnito */ }
  } else {
    raiz.removeAttribute(ATTR_TEMA);
    try { localStorage.removeItem(LS_TEMA); } catch { /* idem */ }
  }
  // ⚠️ Al SALIR hay que sacar también `data-tema`, no solo el del tema. Sin esta
  // rama la app se quedaba en su propio modo oscuro (--bg #22262E) después de
  // apagar el preview: el usuario veía la app «rota» de un color que nadie
  // eligió y sin ningún control a la vista para volver. Verificado en el
  // navegador — el bug existió y así se cierra.
  if (id && oscuro) raiz.setAttribute('data-tema', 'oscuro');
  else raiz.removeAttribute('data-tema');
  try { localStorage.setItem(LS_MODO, oscuro ? 'oscuro' : 'claro'); } catch { /* idem */ }
  window.dispatchEvent(new Event('mako-tema-candidato'));
}

export function TemaCandidato() {
  // Arranca vacío a propósito: el server no sabe qué eligió este navegador, y
  // pintar algo distinto sería un mismatch de hidratación.
  const [{ tema, oscuro }, setEstado] = useState<{ tema: string | null; oscuro: boolean }>(
    { tema: null, oscuro: false },
  );

  useEffect(() => {
    const sincronizar = () => setEstado(leer());
    sincronizar();
    window.addEventListener('mako-tema-candidato', sincronizar);
    return () => window.removeEventListener('mako-tema-candidato', sincronizar);
  }, []);

  const alternarModo = useCallback(() => {
    if (!tema) return;
    aplicarTemaCandidato(tema, !oscuro);
  }, [tema, oscuro]);

  const salir = useCallback(() => {
    aplicarTemaCandidato(null, false);
  }, []);

  const nombre = TEMAS.find((t) => t.id === tema)?.nombre;

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      {tema && (
        <div
          role="status"
          style={{
            position: 'fixed', left: 16, bottom: 16, zIndex: 5000,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 8px 7px 13px', borderRadius: 'var(--r-md)',
            background: 'var(--sidebar)', color: 'var(--on-sidebar)',
            border: '1px solid var(--sidebar-line)',
            boxShadow: '0 14px 34px rgba(18,21,27,.34)',
            fontSize: 12.5, lineHeight: 1.4,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sidebar-text)' }}>
            Tema en prueba
          </span>
          <b style={{ fontWeight: 600 }}>{nombre}</b>

          {/* El interruptor de nordtheme.com: dos íconos apilados en un botón que
              recorta, deslizándose por un carril vertical. La LUNA siempre baja
              y el SOL siempre sube; el que entra arranca 200 ms después que el
              que sale. Verificado contra el código fuente del sitio. */}
          <button
            type="button" onClick={alternarModo}
            aria-label={oscuro ? 'Pasar a claro' : 'Pasar a oscuro'}
            style={{
              position: 'relative', overflow: 'hidden', width: 30, height: 30,
              border: 0, borderRadius: 'var(--r-sm)', background: 'transparent',
              cursor: 'pointer', flex: 'none',
            }}
          >
            {(['luna', 'sol'] as const).map((cual) => {
              const dentro = oscuro ? cual === 'sol' : cual === 'luna';
              // Fuera del recorte: la luna por abajo, el sol por arriba.
              const y = dentro ? 0 : cual === 'luna' ? 26 : -26;
              return (
                <svg
                  key={cual} viewBox="0 0 24 24" aria-hidden
                  style={{
                    position: 'absolute', top: '50%', left: '50%', width: 15, height: 15,
                    margin: '-7.5px 0 0 -7.5px', fill: 'var(--on-sidebar)',
                    transform: `translateY(${y}px)`,
                    transition: 'transform 400ms cubic-bezier(0,0,.58,1)',
                    transitionDelay: dentro ? '200ms' : '0ms',
                  }}
                >
                  <path d={cual === 'luna' ? LUNA : SOL} />
                </svg>
              );
            })}
          </button>

          <button
            type="button" onClick={salir}
            style={{
              font: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              padding: '5px 10px', borderRadius: 'var(--r-sm)',
              background: 'transparent', color: 'var(--on-sidebar)',
              border: '1px solid var(--sidebar-line)',
            }}
          >
            Salir
          </button>
        </div>
      )}
    </>
  );
}

// Eva Icons — moon-fill y sun-fill, los mismos dos que usa nordtheme.com.
const LUNA = 'M12.3 22h-.1a10.31 10.31 0 0 1-7.34-3.15 10.46 10.46 0 0 1-.26-14 10.13 10.13 0 0 1 4-2.74 1 1 0 0 1 1.06.22 1 1 0 0 1 .24 1 8.4 8.4 0 0 0 1.94 8.81 8.47 8.47 0 0 0 8.83 1.94 1 1 0 0 1 1.27 1.29A10.16 10.16 0 0 1 19.6 19a10.28 10.28 0 0 1-7.3 3z';
const SOL = 'M12 6a1 1 0 0 0 1-1V3a1 1 0 0 0-2 0v2a1 1 0 0 0 1 1zM21 11h-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2zM6 12a1 1 0 0 0-1-1H3a1 1 0 0 0 0 2h2a1 1 0 0 0 1-1zM6.22 5A1 1 0 0 0 4.8 6.42l1.44 1.39a1 1 0 0 0 .73.28 1 1 0 0 0 .72-.31 1 1 0 0 0 0-1.41zM17 8.14a1 1 0 0 0 .69-.28l1.44-1.39A1 1 0 0 0 17.78 5l-1.44 1.42a1 1 0 0 0 0 1.41 1 1 0 0 0 .66.31zM12 18a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1zM17.73 16.14a1 1 0 0 0-1.39 1.44L17.78 19a1 1 0 0 0 .69.28 1 1 0 0 0 .72-.31 1 1 0 0 0 0-1.41zM6.27 16.14 4.83 17.53a1 1 0 0 0 0 1.41 1 1 0 0 0 .72.31 1 1 0 0 0 .69-.28l1.44-1.39a1 1 0 0 0-1.41-1.44zM12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4z';
