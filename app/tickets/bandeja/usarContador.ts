// =============================================================================
// El número del botón «Ticketera» de Ops Center: cuántos tickets de usuarios esperan a Martín
// =============================================================================
// Lo pide el navegador después de dibujar (y cada minuto): Ops Center no lo carga en su lectura del servidor.
// ⚠️ SIN 'use client' A PROPÓSITO (como mandar.ts): es un hook que sólo importan componentes de cliente.

import { useEffect, useState } from 'react';
import { cuantosEsperanAction } from './acciones';

export function useTicketsPorDecidir(activo: boolean): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const leer = () => { cuantosEsperanAction().then((x) => { if (vivo) setN(x); }).catch(() => {}); };
    leer();
    const t = window.setInterval(leer, 60_000);
    return () => { vivo = false; window.clearInterval(t); };
  }, [activo]);
  return n;
}
