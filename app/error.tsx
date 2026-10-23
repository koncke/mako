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

/**
 * Le avisa a la Ticketera (17/10/2026, Martín: «córrelo en toda la app... Y todo lo solucionas automáticamente»): el
 * servidor lo agrupa por huella y la primera vez es un ticket de bug que va solo al Cerebro (lib/errores-app.ts). Sin
 * imports, por lo de arriba. Un error del SERVIDOR llega acá sin su mensaje (sólo el digest): ése lo reporta el servidor
 * mismo (instrumentation.ts → onRequestError), y mandarlo también abriría un segundo ticket del mismo error.
 * Devuelve si ENTRÓ: la pantalla sólo dice «ya le avisamos» si es verdad.
 */
async function avisarAlEquipo(error: Error & { digest?: string }): Promise<boolean> {
  try {
    if (error?.digest && /Server Components render|omitted in production/i.test(error?.message ?? '')) return false;
    const r = await fetch('/api/errores', {
      method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nombre: error?.name || 'Error', mensaje: String(error?.message || '(sin mensaje)').slice(0, 500),
        stack: String(error?.stack || '').slice(0, 4000), digest: error?.digest,
        ruta: `${window.location.pathname}${window.location.search}`, navegador: navigator.userAgent,
        pantalla: `${window.innerWidth}x${window.innerHeight}`,
      }),
    });
    return r.status === 204;
  } catch {
    return false;
  }
}

/**
 * «Reportar a Soporte» (23/10/2026, Martín: «SIEMPRE que sale un error, en donde sea, debe aparecer el botón»): el mismo pedido
 * que el botón de la app (app/_ui/ReportarASoporte.tsx), a mano y sin imports por lo de arriba. Es un ticket que la persona ve
 * en su Ticketera; el servidor lo sanea (sin claves ni datos) y dice de quién es por la sesión. Devuelve qué decir.
 */
async function reportarASoporte(error: Error & { digest?: string }, que: string): Promise<string> {
  try {
    let zona: string | undefined;
    try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { zona = undefined; }
    const r = await fetch('/api/soporte/reportar', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: `${que}: ${String(error?.message || '(sin mensaje)').slice(0, 240)}`,
        ruta: `${window.location.pathname}${window.location.search}`, hora: new Date().toISOString(), zona,
        navegador: navigator.userAgent, pantalla: `${window.innerWidth}x${window.innerHeight}`, idioma: navigator.language,
      }),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; id?: number; error?: string } | null;
    return j?.ok ? `Lo mandamos al equipo · ticket #${j.id}` : (j?.error || 'No salió: vuelve a tocar en un rato.');
  } catch {
    return 'No salió: revisa tu conexión y vuelve a tocar.';
  }
}

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const [avisado, setAvisado] = useState(false);
  const [reporte, setReporte] = useState<string | null>(null);
  const [reportando, setReportando] = useState(false);

  useEffect(() => {
    // Queda en la consola del navegador además de en pantalla: si alguien SÍ
    // puede abrirla, el stack completo está ahí.
    console.error('[pantalla rota]', error);
    let vivo = true;
    void avisarAlEquipo(error).then((ok) => { if (vivo) setAvisado(ok); });
    return () => { vivo = false; };
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
          {avisado ? 'Ya le avisamos al equipo de MaKo: se está arreglando. Mientras tanto, prueba de nuevo.' : 'Prueba de nuevo, y si vuelve a pasar, copia el detalle y envíaselo a quien te dio el acceso.'}
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
          {reporte ? (
            <span role="status" style={{ alignSelf: 'center', fontSize: 14, fontWeight: 600, color: 'var(--dim, #5b6472)' }}>{reporte}</span>
          ) : (
            <button type="button" disabled={reportando}
              onClick={() => { setReportando(true); void reportarASoporte(error, 'La pantalla se rompió al dibujarse').then((t) => { setReporte(t); setReportando(false); }); }}
              style={{ padding: '11px 20px', borderRadius: 11, border: '1px solid var(--border-strong, #cfd4dc)', background: 'var(--surface, #fff)', color: 'var(--dim, #5b6472)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {reportando ? 'Mandando…' : 'Reportar a Soporte'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
