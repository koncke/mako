'use client';

// =============================================================================
// EL PASO DE OFFER COACH A FUNNEL COACH, CUANDO LA PERSONA YA VIO SU OFERTA (onboarding V2, 18/11/2026)
// =============================================================================
// La segunda tarea del día 1 (lib/reto/dias.ts) lleva a Funnel Coach con una marca, nunca con un botón. Martín, sobre la maqueta:
// «me manda la oferta con el PDF para descargar… pero apenas me la manda automáticamente ya sale el botón para hacer clic en Funnel
// Coach. Eso no tiene sentido… mínimo déjame verla». Así que la marca:
//   · sale sólo después de ENTREGAR una oferta en esta visita (`entregadaEn`: la pone quien la ve entregarse: el Offer Coach, o la
//     conversación de oferta que cuelga de él, con su PDF);
//   · espera a que la persona la vea: que haga algo con ella (descargue el PDF, baje hasta el final o escriba) o ~20 s de lectura
//     (`marcaAlFunnelYa`); nunca con MaKo escribiendo;
//   · nunca encima de la oferta: la tarjeta va DEBAJO de la fila de Funnel Coach, en la barra (a la derecha caía sobre el chat), y si
//     la fila no se ve (pantalla angosta, con el chat a pantalla completa) no se marca: el reto la marca después, en su chat;
//   · una vez por visita (la misma cuenta que el chat del reto, `yaMarcada`), y no si la tarea ya está hecha;
//   · al tocar la fila, la tarea queda hecha, como desde el chat del reto.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { DIAS_RETO, claveTarea, marcaAlFunnelYa, tareaHecha, LECTURA_DE_LA_OFERTA_MS } from '@/lib/reto/dias';
import { senalAhora } from '@/app/_ui/tutorial/store';
import { anotarMarcada, marcarTarea, useReto, yaMarcada } from './ChatDelReto';

const TAREA = DIAS_RETO[0].tareas.find((t) => t.id === 'funnel')!;
const CLAVE = claveTarea(1, TAREA.id);
/** El último gesto con la rueda, el dedo o el teclado: un scroll sin esto lo hizo la pantalla (bajar al último mensaje), no la persona. */
const GESTO_RECIENTE_MS = 1_200;

/** ¿Se ve la fila de Funnel Coach? Escondida (la barra en una pantalla angosta), la tarjeta del motor caería en el medio. */
function filaVisible(sel: string): boolean {
  const el = document.querySelector(sel);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
}

export function usePasoAlFunnel({ activo, entregadaEn, ocupado, contenedor }: {
  /** El chat que entregó la oferta está a la vista, con los dos coaches (el onboarding V2). */
  activo: boolean;
  /** Cuándo se entregó la oferta en esta visita (null = todavía no). */
  entregadaEn: number | null;
  /** MaKo está escribiendo: la marca espera. */
  ocupado: boolean;
  /** Donde está la oferta: ahí se miran el PDF y el scroll. */
  contenedor: () => HTMLElement | null;
}): void {
  const { d, hacer } = useReto(activo);
  const [gesto, setGesto] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  // Una oferta nueva vuelve a empezar la lectura.
  useEffect(() => { setGesto(false); }, [entregadaEn]);

  // Escribir es hacer algo: un turno que EMPIEZA después de la entrega (la marca espera a que termine). ⚠️ Que empiece, no que esté
  // corriendo: mientras Offer arma la oferta, la conversación ya está ocupada, y contar eso marcaba Funnel Coach en el acto.
  const antesOcupado = useRef(ocupado);
  useEffect(() => {
    if (ocupado && !antesOcupado.current && entregadaEn != null) setGesto(true);
    antesOcupado.current = ocupado;
  }, [ocupado, entregadaEn]);

  // Descargar el PDF o bajar hasta el final de la oferta, con la persona haciéndolo (no la pantalla).
  useEffect(() => {
    const el = contenedor();
    if (!activo || entregadaEn == null || !el) return;
    let ultimoGesto = 0;
    const marcaGesto = () => { ultimoGesto = Date.now(); };
    const alClic = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest('a, button');
      if (!a) return;
      const dice = `${a.textContent ?? ''} ${a.getAttribute('href') ?? ''} ${a.getAttribute('download') ?? ''} ${a.getAttribute('aria-label') ?? ''}`;
      if (/pdf/i.test(dice)) setGesto(true);
    };
    const alScroll = () => {
      if (Date.now() - ultimoGesto > GESTO_RECIENTE_MS) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setGesto(true);
    };
    el.addEventListener('click', alClic, true);
    el.addEventListener('wheel', marcaGesto, { passive: true });
    el.addEventListener('touchmove', marcaGesto, { passive: true });
    el.addEventListener('keydown', marcaGesto);
    el.addEventListener('scroll', alScroll, { passive: true });
    return () => {
      el.removeEventListener('click', alClic, true);
      el.removeEventListener('wheel', marcaGesto);
      el.removeEventListener('touchmove', marcaGesto);
      el.removeEventListener('keydown', marcaGesto);
      el.removeEventListener('scroll', alScroll);
    };
  }, [activo, entregadaEn, contenedor]);

  // El tiempo de lectura: se vuelve a mirar cuando se cumple.
  useEffect(() => {
    if (!activo || entregadaEn == null) return;
    const falta = entregadaEn + LECTURA_DE_LA_OFERTA_MS - Date.now();
    if (falta <= 0) { setAhora(Date.now()); return; }
    const t = window.setTimeout(() => setAhora(Date.now()), falta + 50);
    return () => window.clearTimeout(t);
  }, [activo, entregadaEn]);

  const hecha = !!d?.estado && tareaHecha(d.estado, 1, TAREA.id);
  const marcada = useRef(false);
  useEffect(() => {
    if (!activo || hecha || marcada.current || !marcaAlFunnelYa({ entregadaEn, ahora: Math.max(ahora, Date.now()), gesto, ocupado })) return;
    const [m] = TAREA.marcas;
    if (!m || yaMarcada(CLAVE) || senalAhora() || !filaVisible(m.sel)) return;
    marcada.current = true;
    anotarMarcada(CLAVE);
    // Debajo de la fila, en la barra: a la derecha, la tarjeta tapaba el principio de la conversación (la oferta).
    marcarTarea([{ ...m, lado: 'abajo' }], () => { if (d?.estado) void hacer({ accion: 'hecha', dia: 1, id: TAREA.id }); });
  }, [activo, hecha, entregadaEn, ahora, gesto, ocupado, d?.estado, hacer]);
}
