'use client';

// =============================================================================
// RecorridoAutomations — el recorrido guiado de la tab, montado como el de CURSO
// =============================================================================
// Los pasos y dónde está cada objetivo viven en ./recorrido-automations.ts (datos puros, con test).
// Acá queda lo que sólo puede vivir en el navegador: el gancho de «ya lo vio» y el recorrido, más `marcar`
// corriendo MIENTRAS está abierto (ver la cabecera de ./recorrido-automations.ts).
//
// Lo monta ./ChatAgentApp.tsx en dos lugares, y nada más:
//   const recorrido = useRecorridoAutomations(<¿un admin, y ya cargó la lista?>);   (antes de los return)
//   <RecorridoAutomations abierto={recorrido.abierto} pasos={…} onCerrar={…recorrido.onCerrar} />   (en el <main>)
// Y se vuelve a ver con «Tutorial» del menú de antes del buscador (`MenuAutomations`, ./ConfiguracionesBoton.tsx,
// con `onTutorial={recorrido.reabrir}`). El «?» de al lado de Configuraciones (`AyudaAutomations`) se fue en la
// undécima tanda (punto 9: «que los botones de "Configuraciones" y "Tutorial" estén en otro botón desplegable»).
//
// ⚠️ SE ABRE SOLO APENAS CARGA, TAMBIÉN CON CERO AUTOMATIZACIONES (duodécima tanda, decisión 11: «vos entrás en
//    la tab por primera vez y tenés que ver el lienzo y tiene que salir el tutorial»). Hasta la undécima esperaba
//    la pantalla llena: con el cartel de «Todavía no hay automatizaciones» mostraba tres pasos y quedaba VISTO, y el
//    del lienzo no salía nunca solo. El cartel se fue (la lista y la cuadrícula se ven vacías), y lo del lienzo lo
//    cubre `pasos`: si en la MISMA visita aparece el primer lienzo, ChatAgentApp lo reabre UNA vez con
//    `PASOS_DEL_LIENZO` (desde el CRON). Sin `pasos`, el entero.

import { useLayoutEffect, useRef } from 'react';
import { Recorrido, useRecorrido, type MotivoCierreRecorrido } from '@/app/_ui/Recorrido';
import type { PasoRecorrido } from '@/lib/recorridos';
import { PASOS_AUTOMATIONS, RECORRIDO_AUTOMATIONS, marcar, soltar, type ElementoMarcable } from './recorrido-automations';

/** «¿Ya lo vio?» por persona, igual que CURSO. `autoabrir` = la primera vez se abre solo. */
export function useRecorridoAutomations(autoabrir: boolean) {
  return useRecorrido(RECORRIDO_AUTOMATIONS, { autoabrir });
}

export function RecorridoAutomations({ abierto, onCerrar, pasos = PASOS_AUTOMATIONS }: {
  abierto: boolean;
  onCerrar: (motivo: MotivoCierreRecorrido) => void;
  /** Qué pasos muestra. Ausente = todos; la reapertura del primer lienzo pasa `PASOS_DEL_LIENZO`. */
  pasos?: PasoRecorrido[];
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
      <Recorrido id={RECORRIDO_AUTOMATIONS} pasos={pasos} abierto={abierto} onCerrar={onCerrar} />
    </>
  );
}
