'use client';

// =============================================================================
// El hilo del grupo sigue lo último, salvo que estés leyendo arriba (3/11/2026)
// =============================================================================
// Como WhatsApp: abre en lo primero sin leer y, si no hay, abajo. Lo nuevo baja el hilo sólo si ya estabas abajo o lo escribiste tú; si estabas leyendo arriba, no te mueve: cuenta
// cuántos llegaron y lo dice un botón. Lo mide por el scroll de lo que escrolea: `.co-hilo` en la computadora y el cuerpo de la hoja en el teléfono, que se monta y se mide después
// del primer pintado (el mismo cuidado que ChatClienteM.tsx).

import { useCallback, useEffect, useRef, useState } from 'react';
import { estaAbajo } from '@/lib/centro-caja';
import type { MensajeDelHilo } from '@/lib/grupo-reglas';

const CERCA_DE_ABAJO_PX = 90;
const MS_HOJA_MEDIDA = 80;

export function useSeguirElHilo({ contenedor, mensajes, pendientes, conError = 0, listo, visible }: {
  contenedor: () => HTMLElement | null;
  mensajes: readonly MensajeDelHilo[];
  pendientes: number;
  /** Cuántos no salieron: el «Reintentar» va debajo del globo, y sin bajar queda tapado por la caja. */
  conError?: number;
  listo: boolean;
  visible: boolean;
}) {
  const [nuevos, setNuevos] = useState(0);
  const [abajo, setAbajo] = useState(true);
  const estabaAbajo = useRef(true);
  const primera = useRef(true);
  const ultimoVisto = useRef(0);
  const pendientesAntes = useRef(0);
  const erroresAntes = useRef(0);

  const bajar = useCallback(() => {
    const el = contenedor();
    if (el) el.scrollTop = el.scrollHeight;
    estabaAbajo.current = true;
    setAbajo(true);
    setNuevos(0);
  }, [contenedor]);

  useEffect(() => {
    if (!visible || !listo) return;
    let el: HTMLElement | null = null;
    const alMover = () => {
      if (!el) return;
      const a = estaAbajo(el, CERCA_DE_ABAJO_PX);
      estabaAbajo.current = a;
      setAbajo(a);
      if (a) setNuevos(0);
    };
    const t = window.setTimeout(() => { el = contenedor(); el?.addEventListener('scroll', alMover, { passive: true }); alMover(); }, MS_HOJA_MEDIDA + 40);
    return () => { window.clearTimeout(t); el?.removeEventListener('scroll', alMover); };
  }, [visible, listo, contenedor]);

  const ultimo = mensajes[mensajes.length - 1]?.id ?? 0;
  useEffect(() => {
    if (!listo || !visible) return;
    if (primera.current) {
      primera.current = false;
      ultimoVisto.current = ultimo;
      pendientesAntes.current = pendientes;
      const t = window.setTimeout(() => {
        const el = contenedor();
        const marca = el?.querySelector<HTMLElement>('[data-sin-leer]');
        if (marca) marca.scrollIntoView({ block: 'start' });
        else bajar();
      }, MS_HOJA_MEDIDA);
      return () => window.clearTimeout(t);
    }
    const lleganPropios = pendientes > pendientesAntes.current || conError > erroresAntes.current;
    pendientesAntes.current = pendientes;
    erroresAntes.current = conError;
    const llegaron = mensajes.filter((m) => m.id > ultimoVisto.current);
    ultimoVisto.current = Math.max(ultimoVisto.current, ultimo);
    if (lleganPropios || estabaAbajo.current || (llegaron.length > 0 && llegaron.every((m) => m.autor.propio))) {
      const t = window.setTimeout(bajar, 0);
      return () => window.clearTimeout(t);
    }
    if (llegaron.length) setNuevos((n) => n + llegaron.filter((m) => !m.autor.propio && m.autor.tipo !== 'sistema').length);
    return undefined;
  }, [ultimo, pendientes, conError, listo, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return { nuevos, abajo, bajar };
}
