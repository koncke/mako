'use client';

// =============================================================================
// El globo de la estrella cerrada: lo que MaKo quiere decir en esta tab, al lado de su estrella (29/10/2026)
// =============================================================================
// Con el chat cerrado, MaKo habla sin tapar la tab: un globo chico junto a la estrella (./MakoEnLaTab.tsx). Dos cosas:
//   · la PRIMERA VEZ de la persona en la tab, la pregunta de la guía con sus botones (app/_ui/guia/): elegir un objetivo abre
//     el chat y señala;
//   · el CORTO de la apertura del Cerebro (lib/aperturas/: «¿Qué IA usas?»), como mucho uno por día en toda la app: tocarlo
//     abre el chat, donde está la pregunta entera.
// La × lo pliega por esta visita. `data-guia-globo`: un toque acá no pausa la guía ni cuenta como «usó la tab».

import { Muneco } from '@/app/admin/operaciones/Muneco';
import { JEFE_SECOND_BRAIN } from '@/lib/chat-mako-reglas';
import type { Apertura, Boton } from '@/lib/aperturas/reglas';

export function GloboDeLaEstrella({ left, texto, apertura = null, onElegir, onAbrir, onCerrar, zIndex }: {
  /** Dónde está la estrella (su `left`): el globo va a su derecha. */
  left: number;
  /** El corto (sin `apertura`) o el texto de la apertura. */
  texto: string;
  /** Con botones (la pregunta de la guía): cada uno se elige ahí mismo. */
  apertura?: Apertura | null;
  onElegir?: (b: Boton) => void;
  /** Tocar el globo: abre el chat. */
  onAbrir: () => void;
  onCerrar: () => void;
  zIndex?: number;
}) {
  let recomendado = false;
  return (
    <div className="ch-globo" style={{ left: left + 66, ...(zIndex ? { zIndex } : {}) }} role="status" data-guia-globo="">
      {apertura ? (
        <>
          <p className="ch-globo__texto">{texto}</p>
          <div className="ch-globo__botones">
            {apertura.botones.map((b) => {
              const rec = b.tipo !== 'callar' && !recomendado;
              if (rec) recomendado = true;
              return <button key={b.rotulo} type="button" className={rec ? 'ch-globo__boton ch-globo__boton--mako' : 'ch-globo__boton'} onClick={() => onElegir?.(b)}>{b.rotulo}</button>;
            })}
          </div>
        </>
      ) : (
        <button type="button" className="ch-globo__corto" onClick={onAbrir}>
          <Muneco titulo={JEFE_SECOND_BRAIN} animo="despierto" size={22} />
          <span>{texto}</span>
        </button>
      )}
      <button type="button" className="ch-globo__cerrar" aria-label="Ahora no" title="Ahora no" onClick={onCerrar}>×</button>
    </div>
  );
}
