'use client';

// =============================================================================
// ficha-cambio — «guardé algo»: el aviso que hace que el pop-up de la ficha se relea
// =============================================================================
// La ficha del tablero (app/crm/LeadSheet.tsx) es una FOTO: la trae `getLeadFullAction` al
// abrirse, y el `router.refresh()` que hace cada tarjeta después de guardar NO la toca (refresca
// el tablero de atrás, no el estado de cliente del pop-up). Medido el 08/10/2026 en el CRM de
// Leila (ws11): con la foto vieja, la cabecera seguía diciendo «Sin empresa» y «1 sin marcar»
// después de guardar la empresa, y «Solucionar» abría «Completar datos» con la etapa de ANTES —
// cuyo Guardar movía al lead de vuelta (tres veces en el #2608, y en el #2605 le sacó el Ganado).
//
// La ruta /crm/[id] no lo necesita: recibe el lead del server y el refresh se lo trae de nuevo.
// Por eso el aviso es un CONTEXTO y no una prop: las mismas tarjetas se montan en las dos
// pantallas, y en la ruta no hay nadie escuchando (el aviso no hace nada).
//
// ⚠️ TODA TARJETA DE LA FICHA QUE GUARDA usa `useRefrescarFicha()` en lugar de `router.refresh()`
// suelto. Es el choke point de «la ficha cambió»: una tarjeta nueva que guarde y llame sólo al
// router deja la foto vieja otra vez, sin ningún error. Lo fija tests/ficha-se-relee.test.ts.
// =============================================================================

import { createContext, useCallback, useContext } from 'react';
import { useRouter } from '@/app/_ui/Link';

const AvisoDeCambio = createContext<(() => void) | null>(null);

/** Lo monta la ficha del tablero con su `releer`. Fuera de ella no hay proveedor y el aviso no hace nada. */
export const FichaCambioProvider = AvisoDeCambio.Provider;

/** El `router.refresh()` de una tarjeta de la ficha, más el aviso para que el pop-up se relea. */
export function useRefrescarFicha(): () => void {
  const router = useRouter();
  const avisar = useContext(AvisoDeCambio);
  return useCallback(() => {
    router.refresh();
    avisar?.();
  }, [router, avisar]);
}
