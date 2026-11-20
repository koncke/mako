'use client';
// =============================================================================
// EL HILO DE UN CHAT CON CLIENTES EN EL TELÉFONO, QUE ESCROLEA LA PÁGINA (20/11/2026, la auditoría de los chats, movil-1 a 5)
// =============================================================================
// Las reglas y el porqué: ./seguir-la-pagina.ts. Lo usan los composers de /m/chats/[clave] (ComposerChatsM.tsx) y /m/crm/[id]/chat
// (ComposerChat.tsx): la página les pasa la clave del ÚLTIMO mensaje dibujado y cuántos hay. Nunca una cuenta sola: la cuenta no
// cambia cuando un mensaje reemplaza a otro, y la clave sí.
// =============================================================================
import './nuevos.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bajarAlCrecer, CERCA_DE_ABAJO_PX } from '@/app/_chat/useBajarAlUltimo';
import { estaAbajo } from '@/lib/centro-caja';
import { Icon } from '@/app/_components/icons';
import { cuantosLlegaron, queHacerAlLlegar, rotuloNuevos } from './seguir-la-pagina';

const alFinal = () => window.scrollTo({ top: document.documentElement.scrollHeight });

/**
 * `ultimo`: la clave del último mensaje dibujado; `total`: cuántos hay. Devuelve cuántos llegaron mientras leía arriba, `bajar` (el
 * botón) y `esperarLoSuyo` (lo llama el composer al mandar: lo suyo baja cuando aparece, llegue cuando llegue).
 */
export function useSeguirLaPagina(ultimo: string, total: number): { nuevos: number; bajar: () => void; esperarLoSuyo: () => void } {
  const abajo = useRef(true);
  const esperaLoSuyo = useRef(false);
  const visto = useRef({ ultimo, total });
  const mirarHijos = useRef<(() => void) | null>(null);
  const [nuevos, setNuevos] = useState(0);

  const bajar = useCallback(() => {
    alFinal();
    abajo.current = true;
    esperaLoSuyo.current = false;
    setNuevos(0);
  }, []);

  // Al abrir, lo último a la vista. Desde ahí: si está abajo (la mide su scroll) y lo que crece la mantiene abajo.
  useEffect(() => {
    const raiz = document.documentElement;
    const alMover = () => {
      const a = estaAbajo(raiz, CERCA_DE_ABAJO_PX);
      abajo.current = a;
      if (a) setNuevos(0);
      // Subió a leer: lo suyo, cuando llegue, ya no la arrastra.
      else esperaLoSuyo.current = false;
    };
    window.addEventListener('scroll', alMover, { passive: true });
    const crece = bajarAlCrecer(raiz, () => abajo.current || esperaLoSuyo.current);
    mirarHijos.current = crece.mirarHijos;
    bajar();
    return () => { window.removeEventListener('scroll', alMover); crece.soltar(); mirarHijos.current = null; };
  }, [bajar]);

  // Llegó otro último mensaje (el sondeo, o lo suyo que volvió del servidor): baja o se cuenta.
  useEffect(() => {
    const antes = visto.current;
    if (antes.ultimo === ultimo) return;
    visto.current = { ultimo, total };
    mirarHijos.current?.();
    if (queHacerAlLlegar({ abajo: abajo.current, esperaLoSuyo: esperaLoSuyo.current }) === 'bajar') { bajar(); return; }
    setNuevos((n) => n + cuantosLlegaron(antes.total, total));
  }, [ultimo, total, bajar]);

  const esperarLoSuyo = useCallback(() => { bajar(); esperaLoSuyo.current = true; }, [bajar]);
  return { nuevos, bajar, esperarLoSuyo };
}

/** «3 mensajes nuevos», arriba de la caja mientras se lee arriba. Tocarlo baja. */
export function NuevosM({ n, onBajar }: { n: number; onBajar: () => void }) {
  if (n <= 0) return null;
  return (
    <button type="button" className="m-chats-nuevos" onClick={onBajar}>
      <span aria-hidden style={{ display: 'inline-flex' }}><Icon name="chevron" size={14} /></span>
      {rotuloNuevos(n)}
    </button>
  );
}
