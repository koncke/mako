'use client';
// =============================================================================
// AL LLEGAR DEL ONBOARDING (V2): la marca que lleva al chat «Reto de 7 días» (18/11/2026)
// =============================================================================
// Después del tutorial del Ops Center (lo arranca solo el motor, la primera vez en /second-brain), la pantalla se oscurece y se señala
// la fila del reto: sin botón (Martín, 18/11: «ese tipo de botones jamás»). Una vez por visita, mientras el reto no empezó. Vive aparte
// del Ops Center a propósito: esa pantalla no lleva un recorrido propio (tests/guia-catalogo.test.ts, «dos tutoriales en una pantalla»).
import { useEffect, useRef } from 'react';
import { useRecorrido } from '@/app/_ui/Recorrido';
import { senalAhora, senalarDondeTocar, useSenal } from '@/app/_ui/tutorial/store';
import { RETO_SUB } from '@/lib/reto/dias';

export function MarcaAlReto({ empezo, listo }: { empezo: boolean; listo: boolean }) {
  const opsVisto = useRecorrido('tutorial-ops-center', { autoabrir: false }).visto;
  const senal = useSenal();
  const marcado = useRef(false);
  useEffect(() => {
    if (!listo || empezo || marcado.current || senal || opsVisto !== true) return;
    const t = window.setTimeout(() => {
      if (senalAhora() || marcado.current) return;
      marcado.current = true;
      senalarDondeTocar({ sel: '[data-recorrido="sb-reto-chat"]', titulo: 'Tu reto de 7 días', texto: RETO_SUB, haz: 'Haz clic en Reto de 7 días', lado: 'derecha' }, () => {});
    }, 700);
    return () => window.clearTimeout(t);
  }, [listo, empezo, senal, opsVisto]);
  return null;
}
