'use client';

// =============================================================================
// Los errores sueltos de la ventana van a la Ticketera solos (17/10/2026)
// =============================================================================
// Martín: «córrelo en toda la app: MaKo en los chats de la app, errores al navegar o lo que sea. Y todo lo solucionas
// automáticamente». Una pantalla que se rompe al DIBUJARSE la reporta su boundary (app/error.tsx); esto atrapa lo que no
// pasa por un boundary: un error en un clic, en un efecto o una promesa que nadie esperó.
//
// ⚠️ Se monta en el layout raíz SÓLO con sesión y fuera de las páginas públicas: el error tiene que ser de alguien de
// MaKo, y la ruta (/api/errores) lo exige igual.
// ⚠️ Cinco por página y nunca el mismo dos veces: un error en un bucle no puede mandar mil pedidos. Lo que es ruido
// (una extensión, la red, un deploy nuevo) lo descarta el servidor (lib/errores-app-reglas.ts, `esRuido`).

import { useEffect } from 'react';
import { ID_PANTALLA_DE_NEXT, esHidratacion, pistasDeHidratacion } from '@/lib/errores-app-reglas';

const TOPE_POR_PAGINA = 5;

export function ReportadorDeErrores() {
  useEffect(() => {
    const vistos = new Set<string>();
    const mandar = (nombre: string, mensaje: string, stack: string) => {
      const clave = `${nombre}|${mensaje}`.slice(0, 300);
      if (!mensaje || vistos.has(clave) || vistos.size >= TOPE_POR_PAGINA) return;
      vistos.add(clave);
      // Un turno después: si el error tumbó la app entera (la pantalla de Next), lo avisa CentinelaArranque con su nombre
      // propio y éste se calla — si no, el mismo choque abría dos tickets.
      setTimeout(() => {
        if (document.documentElement.id === ID_PANTALLA_DE_NEXT) return;
        try {
          void fetch('/api/errores', {
            method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              nombre, mensaje: mensaje.slice(0, 500), stack: stack.slice(0, 4000),
              ruta: `${window.location.pathname}${window.location.search}`, navegador: navigator.userAgent,
              pantalla: `${window.innerWidth}x${window.innerHeight}`,
              ...(esHidratacion(mensaje) ? { pistas: pistasDeHidratacion(document, navigator.language) } : {}),
            }),
          }).catch(() => {});
        } catch { /* reportar un error nunca puede romper nada */ }
      }, 0);
    };
    const alError = (e: ErrorEvent) => {
      const err = e.error as Error | undefined;
      mandar(err?.name || 'Error', err?.message || e.message || '', err?.stack || (e.filename ? `at ${e.filename}:${e.lineno}:${e.colno}` : ''));
    };
    const alRechazo = (e: PromiseRejectionEvent) => {
      const r = e.reason as unknown;
      if (r instanceof Error) mandar(r.name || 'Error', r.message, r.stack || '');
      else if (typeof r === 'string') mandar('PromesaRechazada', r, '');
    };
    window.addEventListener('error', alError);
    window.addEventListener('unhandledrejection', alRechazo);
    return () => {
      window.removeEventListener('error', alError);
      window.removeEventListener('unhandledrejection', alRechazo);
    };
  }, []);
  return null;
}
