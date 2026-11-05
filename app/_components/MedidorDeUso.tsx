'use client';

// =============================================================================
// MedidorDeUso — cuántas pantallas abre y cuántas acciones hace cada persona, por tab (5/11/2026, Admin › Activity)
// =============================================================================
// Martín: «qué acciones hacen los usuarios dentro de MaKo, cuándo es que se conectan, qué no están utilizando». Copiado del
// «pageview» de PostHog, con lo que pide el encargo: POR LOTES (un pedido por minuto como mucho, y uno al ocultar la
// pestaña), sin frenar a nadie (`keepalive`, sin esperar la respuesta) y sin contenido (del navegador sale la ruta y dos
// números; el server la vuelve tab y tira la ruta). Un lote que falla se pierde: nunca rompe lo que la persona hacía.
// Lo montan la barra de la computadora (./Sidebar.tsx) y el cromo del teléfono (app/m/_ui/ShellM.tsx): la app con sesión,
// nunca una página pública. Las cuentas del lote, en ./medidor-lote.ts (puro, con test).

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { tomarAcciones } from './contador-acciones';
import { crearLote, type Lote } from './medidor-lote';

/** Cada cuánto se manda el lote, como mucho. */
export const CADA_MS = 60_000;

export function MedidorDeUso() {
  const ruta = usePathname();
  const lote = useRef<Lote | null>(null);
  if (lote.current == null) lote.current = crearLote(tomarAcciones);

  useEffect(() => {
    const l = lote.current!;
    const enviar = () => {
      const entradas = l.vaciar();
      if (entradas.length === 0) return;
      try {
        void fetch('/api/actividad', {
          method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entradas }),
        }).catch(() => {});
      } catch { /* sin red: se pierde, y está bien */ }
    };
    const reloj = window.setInterval(enviar, CADA_MS);
    const alOcultar = () => { if (document.visibilityState === 'hidden') enviar(); };
    document.addEventListener('visibilitychange', alOcultar);
    window.addEventListener('pagehide', enviar);
    return () => {
      window.clearInterval(reloj);
      document.removeEventListener('visibilitychange', alOcultar);
      window.removeEventListener('pagehide', enviar);
      enviar();
    };
  }, []);

  useEffect(() => { if (ruta) lote.current!.entrar(ruta); }, [ruta]);

  return null;
}
