'use client';

// =============================================================================
// global-error.tsx — la red de abajo de todo
// =============================================================================
// `app/error.tsx` cubre las pantallas. Este cubre el caso en que se rompe el
// LAYOUT RAÍZ, que es donde viven la sidebar, el tema y los proveedores de
// contexto: ahí el otro boundary ni llega a montarse y el resultado vuelve a ser
// la pantalla en blanco.
//
// Por contrato de Next tiene que dibujar su propio <html> y <body>: reemplaza al
// documento entero, así que no puede apoyarse en NADA de la app —ni tokens de
// color, ni fuentes, ni componentes—. Todo literal y a mano, a propósito.
//
// Y desde el 17/10/2026 le avisa a la Ticketera, como app/error.tsx (allá está el porqué): el mismo pedido, a mano.
// =============================================================================

import { useEffect } from 'react';

/** Copia de `avisarAlEquipo` de app/error.tsx: un boundary no importa nada de la app. */
function avisarAlEquipo(error: Error & { digest?: string }): void {
  try {
    if (error?.digest && /Server Components render|omitted in production/i.test(error?.message ?? '')) return;
    void fetch('/api/errores', {
      method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nombre: error?.name || 'Error', mensaje: String(error?.message || '(sin mensaje)').slice(0, 500),
        stack: String(error?.stack || '').slice(0, 4000), digest: error?.digest,
        ruta: `${window.location.pathname}${window.location.search}`, navegador: navigator.userAgent,
        pantalla: `${window.innerWidth}x${window.innerHeight}`,
      }),
    }).catch(() => {});
  } catch { /* nunca rompe nada */ }
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { avisarAlEquipo(error); }, [error]);
  const detalle = `Error: ${error?.message || '(sin mensaje)'}${error?.digest ? `\nDigest: ${error.digest}` : ''}`;
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', color: '#12151b', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 520, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>MaKo no pudo arrancar en este dispositivo</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: '#5b6472', margin: '0 0 16px' }}>
            Tus datos están intactos. Falló el arranque de la aplicación aquí; copia el detalle y mándaselo a quien te dio el acceso.
          </p>
          <pre style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: '#f4f5f7', border: '1px solid #e5e7eb', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detalle}</pre>
          <button type="button" onClick={() => reset()}
            style={{ padding: '11px 20px', borderRadius: 11, border: 'none', background: '#2F6FED', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
