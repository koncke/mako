'use client';

// =============================================================================
// TemaCandidato — el modo de cada usuario + el tema del rebrand en evaluación
// =============================================================================
// Hace dos cosas que conviene no confundir:
//
//   1. Aplica EL MODO (claro/oscuro) que eligió el usuario. Es del producto y
//      es de todos: el botón vive en su perfil, en la barra.
//   2. Aplica EL TEMA CANDIDATO del rebrand, si hay uno puesto desde
//      /admin/ui?tab=temas. Eso solo se prende dentro del Cliente de Diseño, así
//      que no le cambia el color a ningún cliente real.
//
// ⚠️ EL <script> NO ES OPCIONAL Y NO ES UN DUPLICADO DEL EFECTO. Un useEffect
// corre DESPUÉS de la hidratación: entre el primer pintado y esa línea la app se
// ve clara y después salta a oscura. En una app que se navega por links eso es
// un fogonazo blanco en CADA pantalla. El script corre mientras el navegador
// todavía parsea el documento, antes de pintar.
//
// Y el chip de salida no es decoración: mientras hay un tema en prueba, lo dice
// y ofrece cómo sacarlo desde cualquier pantalla. Si el único lugar donde se
// apaga fuera la tab que lo prende, quien se lo olvide puesto ve la app de otro
// color sin saber por qué — la regla de AGENTS.md sobre la salida que vive
// adentro de una pantalla condicional.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { ATTR_TEMA, ATTR_MODO, LS_TEMA, LS_MODO, TEMAS, esTemaValido } from '@/lib/temas-candidatos';

/** Lo que corre antes del primer pintado. Se mantiene chico a propósito. */
const BOOT = `
try{
  var m=localStorage.getItem('${LS_MODO}');
  var oscuro = m ? m==='oscuro' : (window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  if(oscuro)document.documentElement.setAttribute('${ATTR_MODO}','oscuro');
  var t=localStorage.getItem('${LS_TEMA}');
  if(t)document.documentElement.setAttribute('${ATTR_TEMA}',t);
}catch(e){}
`.trim();

/**
 * Pone o saca el tema candidato. `null` lo saca.
 *
 * NO toca el modo: el claro/oscuro es del usuario y sobrevive a prender y
 * apagar un tema. Mezclarlos fue un bug real — salir del tema dejaba la app en
 * oscuro sin que nadie lo hubiera pedido.
 */
export function aplicarTemaCandidato(id: string | null) {
  const raiz = document.documentElement;
  if (id && esTemaValido(id)) {
    raiz.setAttribute(ATTR_TEMA, id);
    try { localStorage.setItem(LS_TEMA, id); } catch { /* incógnito */ }
  } else {
    raiz.removeAttribute(ATTR_TEMA);
    try { localStorage.removeItem(LS_TEMA); } catch { /* incógnito */ }
  }
  window.dispatchEvent(new Event('mako-tema-candidato'));
}

export function TemaCandidato() {
  const [tema, setTema] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setTema(document.documentElement.getAttribute(ATTR_TEMA));
    sync();
    window.addEventListener('mako-tema-candidato', sync);
    return () => window.removeEventListener('mako-tema-candidato', sync);
  }, []);

  const salir = useCallback(() => aplicarTemaCandidato(null), []);
  const nombre = TEMAS.find((t) => t.id === tema)?.nombre;

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      {tema && (
        <div
          role="status"
          // La marca existe para que una pantalla a pantalla completa lo pueda apagar sin
          // saber nada de este componente: la bienvenida del onboarding lo hacía con
          // `body:has(.bv)`. Es una herramienta del taller de diseño y no puede dibujarse
          // encima de lo primero que ve un cliente.
          data-chip-tema=""
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
          <span style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sidebar-text)' }}>
            Tema en prueba
          </span>
          <b style={{ fontWeight: 600 }}>{nombre}</b>
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
