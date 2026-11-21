'use client';
// =============================================================================
// AL LLEGAR DEL ONBOARDING (V2): la marca que lleva al chat «Reto de 7 días» (18/11/2026)
// =============================================================================
// Después del tutorial del Ops Center (lo arranca solo el motor, la primera vez en /second-brain), la pantalla se oscurece y se señala
// la fila del reto: sin botón (Martín, 18/11: «ese tipo de botones jamás»). Una vez por visita, mientras el reto no empezó. Vive aparte
// del Ops Center a propósito: esa pantalla no lleva un recorrido propio (tests/guia-catalogo.test.ts, «dos tutoriales en una pantalla»).
import { useEffect, useRef } from 'react';
import { useRecorrido } from '@/app/_ui/Recorrido';
import { elChatPresentaElReto, senalAhora, senalarDondeTocar, usePresentaReto, useSenal } from '@/app/_ui/tutorial/store';
import { RETO_SUB } from '@/lib/reto/dias';
import { useEnsayo, vistoEnEnsayo } from '@/app/_ui/tutorial/desde-cero';

/** UNA vez por pestaña (21/11/2026, Martín: «salga donde me salga, me marca que vuelva al reto de 7 días, no tiene sentido»): el `useRef`
 *  sólo cuidaba un montaje, y al pasar a Offer Coach la marca volvía a salir. Va en sessionStorage (`mako.reto.`: lo limpia el reinicio). */
const CLAVE_MARCADA = 'mako.reto.marcada.al-reto';
const yaSeMarco = (): boolean => { try { return sessionStorage.getItem(CLAVE_MARCADA) === '1'; } catch { return false; } };
const anotarMarcada = (): void => { try { sessionStorage.setItem(CLAVE_MARCADA, '1'); } catch { /* sin storage: queda el ref */ } };

/** `enOtroLado`: la persona eligió otro chat (un coach, un chat, un grupo): el recorrido no la persigue. */
export function MarcaAlReto({ empezo, listo, enOtroLado = false }: { empezo: boolean; listo: boolean; enOtroLado?: boolean }) {
  const ensayo = useEnsayo();
  const visto = useRecorrido('tutorial-ops-center', { autoabrir: false }).visto;
  // En el ensayo «desde cero», lo visto vive en el navegador (app/_ui/tutorial/desde-cero.ts).
  const opsVisto = ensayo.activo ? vistoEnEnsayo('tutorial-ops-center') : visto;
  const senal = useSenal();
  // OD-09 (20/11): mientras el chat «Onboarding» presenta el reto («¡Listo tu onboarding…!»), la marca espera a que lo diga.
  const presenta = usePresentaReto();
  const marcado = useRef(false);
  useEffect(() => {
    if (!listo || empezo || marcado.current || enOtroLado || yaSeMarco() || senal || presenta || opsVisto !== true) return;
    const t = window.setTimeout(() => {
      if (senalAhora() || elChatPresentaElReto() || marcado.current || yaSeMarco()) return;
      marcado.current = true;
      anotarMarcada();
      // Con «Lo hago después»: volver al reto es una invitación, nunca un cartel que obliga.
      senalarDondeTocar({ sel: '[data-recorrido="sb-reto-chat"]', titulo: 'Tu reto de 7 días', texto: RETO_SUB, haz: 'Haz clic en Reto de 7 días', lado: 'derecha' }, () => {}, { alOmitir: () => {} });
    }, 700);
    return () => window.clearTimeout(t);
  }, [listo, empezo, enOtroLado, senal, presenta, opsVisto, ensayo.v]);
  return null;
}
