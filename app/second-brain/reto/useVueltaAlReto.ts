'use client';

// =============================================================================
// «VUELVE A TU RETO» AL TERMINAR FUNNEL COACH (20/11/2026, auditoría D1-05; la maqueta, cuerpo.html b-ver-reto)
// =============================================================================
// Con el funnel guardado, el día 1 queda completo. Si la persona sigue en Funnel Coach, la pantalla marca la fila «Reto de 7 días» con
// «Vuelve a tu reto / Tu día 1 está completo.», y en el reto sigue «¡Terminaste tu día 1…!» (`finDelDia`, lib/reto/dias.ts).
//   · Sólo si el día 1 se COMPLETA mientras mira Funnel Coach (lo ve pasar de a medias a completo): volver a Funnel Coach otro día no
//     marca nada.
//   · Mientras Funnel Coach está a la vista y el día 1 no está completo, relee el reto cada 20 s: el funnel lo guarda el coach en el
//     servidor y la pantalla no se entera de otra forma (`funnel_coach.plan`, la lectura `1:funnel` de lib/reto/senales.ts).
//   · Una vez por visita (`yaMarcada`), nunca encima de otra marca, y no con la fila escondida (una pantalla angosta): ahí lo dice el reto.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { DIAS_RETO, diaTerminado, type MarcaReto } from '@/lib/reto/dias';
import { senalAhora } from '@/app/_ui/tutorial/store';
import { anotarMarcada, marcarTarea, useReto, yaMarcada } from './ChatDelReto';

const CLAVE = 'vuelta-al-reto';
export const CADA_MS_VUELTA = 20_000;
export const MARCA_VUELTA: MarcaReto = { sel: '[data-recorrido="sb-reto-chat"]', titulo: 'Vuelve a tu reto', texto: 'Tu día 1 está completo.', haz: 'Haz clic en Reto de 7 días', lado: 'derecha' };

function seVe(sel: string): boolean {
  const el = document.querySelector(sel);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
}

/** Lo que tarda el mensaje «Tu día 1 está completo…» (los tres puntitos y su lectura) antes de la marca (D1-05, verificación del 20/11). */
export const MS_ANTES_DE_LA_VUELTA = 2600;

/** `activo`: Funnel Coach a la vista, con el reto (el onboarding V2) y el chat del reto cerrado. Devuelve si el día 1 se completó en
 *  esta visita: Funnel Coach dibuja entonces el mensaje de MaKo (./MensajeVueltaAlReto.tsx), y la marca sale después. */
export function useVueltaAlReto(activo: boolean): boolean {
  const [llego, setLlego] = useState(false);
  const { d, leer } = useReto(activo);
  const completo = d?.estado ? diaTerminado(d.estado, DIAS_RETO[0]) : null;
  useEffect(() => {
    if (!activo || completo !== false) return;
    const t = window.setInterval(() => { void leer(); }, CADA_MS_VUELTA);
    return () => window.clearInterval(t);
  }, [activo, completo, leer]);
  const antes = useRef<boolean | null>(null);
  useEffect(() => {
    if (!activo) { antes.current = null; return; }
    if (completo == null) return;
    const seCompleto = antes.current === false && completo;
    antes.current = completo;
    if (!seCompleto || yaMarcada(CLAVE)) return;
    anotarMarcada(CLAVE);
    // Primero el mensaje en el chat (la maqueta: RETO_LISTO y recién después b-ver-reto); la marca, cuando ya se leyó.
    setLlego(true);
    const t = window.setTimeout(() => { if (!senalAhora() && seVe(MARCA_VUELTA.sel)) marcarTarea([MARCA_VUELTA], () => {}); }, MS_ANTES_DE_LA_VUELTA);
    return () => window.clearTimeout(t);
  }, [activo, completo]);
  return activo && llego;
}
