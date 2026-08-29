'use client';

// =============================================================================
// error.tsx — cuando una pantalla se rompe al DIBUJARSE, que se vea
// =============================================================================
// Hasta acá la app no tenía UN SOLO error boundary. Eso no significaba que no
// hubiera errores: significaba que cuando había uno, React desmontaba el árbol
// entero y quedaba una PANTALLA EN BLANCO, sin mensaje, sin consola abierta y
// sin nada que el usuario pueda contar. Se reporta como «no me carga», «está
// vacío» o «no me salta», que son tres formas de decir «no sé qué pasó».
//
// Y es la peor forma de fallar, porque DEPENDE DEL DISPOSITIVO: una API que
// existe en un Chrome de Windows y no en un Safari viejo rompe en una máquina y
// no en la otra, con los mismos datos y el mismo servidor. Sin esta pantalla, la
// única forma de diagnosticarlo era pedirle la consola a alguien que está en un
// teléfono — o sea, no diagnosticarlo.
//
// Por eso lo que se ve no es un «algo salió mal»: es QUÉ se rompió, con el
// detalle técnico a la vista y un botón para copiarlo y mandarlo. El texto que
// alguien pueda pegar en un WhatsApp es la única telemetría que no depende de
// que la persona sepa abrir DevTools.
//
// Se mantiene deliberadamente TONTO: estilos en línea, cero imports del resto de
// la app. Un boundary que depende del código que puede estar roto no es un
// boundary.
// =============================================================================

import { useEffect, useState } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    // Queda en la consola del navegador además de en pantalla: si alguien SÍ
    // puede abrirla, el stack completo está ahí.
    console.error('[pantalla rota]', error);
  }, [error]);

  const detalle = [
    `Pantalla: ${typeof window !== 'undefined' ? window.location.pathname : ''}`,
    `Error: ${error?.message || '(sin mensaje)'}`,
    error?.digest ? `Digest: ${error.digest}` : '',
    `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
    `Cuándo: ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n');

  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Geist', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 16, padding: 24, color: 'var(--ink, #12151b)' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Esta pantalla se rompió al dibujarse</div>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--dim, #5b6472)', margin: '0 0 16px' }}>
          Tus datos están a salvo: lo que falló es el dibujo de esta pantalla en este dispositivo, no lo que tienes guardado.
          Prueba de nuevo, y si vuelve a pasar, copia el detalle y envíaselo a quien te dio el acceso.
        </p>
        <pre style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2, #f4f5f7)', border: '1px solid var(--border, #e5e7eb)', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'Geist Mono', ui-monospace, monospace" }}>{detalle}</pre>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => reset()}
            style={{ padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--primary, #2F6FED)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Volver a dibujar la pantalla
          </button>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(detalle).then(() => setCopiado(true)).catch(() => setCopiado(false)); }}
            style={{ padding: '11px 20px', borderRadius: 11, border: '1px solid var(--border-strong, #cfd4dc)', background: 'var(--surface, #fff)', color: 'var(--dim, #5b6472)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {copiado ? '✓ Copiado' : 'Copiar el detalle'}
          </button>
          <button type="button" onClick={() => { window.location.href = '/'; }}
            style={{ padding: '11px 20px', borderRadius: 11, border: '1px solid var(--border-strong, #cfd4dc)', background: 'var(--surface, #fff)', color: 'var(--dim, #5b6472)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Ir al inicio
          </button>
        </div>
      </div>
    </main>
  );
}
