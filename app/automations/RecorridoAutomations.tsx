'use client';

// =============================================================================
// RecorridoAutomations — el recorrido guiado de la tab, montado como el de CURSO
// =============================================================================
// Los pasos y dónde está cada objetivo viven en ./recorrido-automations.ts (datos puros, con test).
// Acá queda lo que sólo puede vivir en el navegador: el gancho de «ya lo vio», el «?» y el recorrido,
// más `marcar` corriendo MIENTRAS está abierto (ver la cabecera de ./recorrido-automations.ts).
//
// Lo monta ./ChatAgentApp.tsx en tres lugares, y nada más:
//   const recorrido = useRecorridoAutomations(<¿un admin, con la lista y su lienzo a la vista?>);   (antes de los return)
//   <AyudaAutomations onClick={recorrido.reabrir} />          (en el renglón de la lista y en el cartel vacío)
//   <RecorridoAutomations abierto={recorrido.abierto} onCerrar={recorrido.onCerrar} />   (en el <main>)
//
// ⚠️ SE ABRE SOLO CUANDO SE VE LA PANTALLA LLENA (la lista con un lienzo), no con el cartel de «Todavía
//    no hay automatizaciones». «Todos arrancan vacíos»: abierto ahí, mostraría tres pasos y quedaría
//    VISTO, y el del lienzo no saldría nunca solo. Con la primera automatización (en blanco o de una
//    plantilla) sale entero; antes, el «?» del cartel vacío muestra lo que hay.

import { useLayoutEffect, useRef } from 'react';
import { BotonRecorrido, Recorrido, useRecorrido, type MotivoCierreRecorrido } from '@/app/_ui/Recorrido';
import { OBJETIVO_AYUDA, PASOS_AUTOMATIONS, RECORRIDO_AUTOMATIONS, marcar, soltar, type ElementoMarcable } from './recorrido-automations';

/** «¿Ya lo vio?» por persona, igual que CURSO. `autoabrir` = la primera vez se abre solo. */
export function useRecorridoAutomations(autoabrir: boolean) {
  return useRecorrido(RECORRIDO_AUTOMATIONS, { autoabrir });
}

/** El «?»: el último paso lo señala («Vuelve a verla»). */
export function AyudaAutomations({ onClick }: { onClick: () => void }) {
  return <BotonRecorrido objetivo={OBJETIVO_AYUDA} titulo="Ver la guía de Automations" onClick={onClick} />;
}

export function RecorridoAutomations({ abierto, onCerrar }: {
  abierto: boolean;
  onCerrar: (motivo: MotivoCierreRecorrido) => void;
}) {
  /** Un nodo propio adentro del <main> de la tab: de ahí sale dónde buscar (`closest('main')`). */
  const ancla = useRef<HTMLSpanElement>(null);

  // ANTES DE PINTAR (layout effect): el recorrido busca su primer paso en el cuadro siguiente, y para
  // entonces las marcas ya tienen que estar. Después, en cada cambio de la pantalla (una tarjeta que
  // aparece, el lienzo que termina de cargar), un cuadro y se vuelve a marcar. Sólo `childList`: las
  // marcas son atributos, y mirándolos esto se observaría a sí mismo.
  useLayoutEffect(() => {
    if (!abierto) return;
    const raiz: ParentNode = ancla.current?.closest('main') ?? document.body;
    const puestas = new Map<string, ElementoMarcable>();
    marcar(raiz, puestas);
    let cuadro = 0;
    const mo = new MutationObserver(() => {
      if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = 0; marcar(raiz, puestas); });
    });
    mo.observe(raiz, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (cuadro) cancelAnimationFrame(cuadro); soltar(puestas); };
  }, [abierto]);

  return (
    <>
      {/* `hidden`: no ocupa lugar en la columna flex de la tab. */}
      <span ref={ancla} hidden />
      <Recorrido id={RECORRIDO_AUTOMATIONS} pasos={PASOS_AUTOMATIONS} abierto={abierto} onCerrar={onCerrar} />
    </>
  );
}
