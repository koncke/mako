'use client';

// =============================================================================
// Lo que hay detrás de su web: sus píxeles, a dónde manda a pagar y con qué muestra el video
// =============================================================================
// Las reglas viven en lib/spy-funnel.ts. Tres estados, no dos:
//   · sin lectura → no se dibuja nada: nadie dice «no tiene» sobre una página que no se leyó.
//   · leída y sin nada → «no se ve desde afuera», que NO es «no tiene píxeles».
//   · leída y con algo → las filas, y sólo las que tienen algo.

import { funnelDeLasPaginas, NOMBRE_PIXEL } from '@/lib/spy-funnel';

export function SuFunnel({ filas }: { filas: readonly unknown[] }) {
  const u = funnelDeLasPaginas(filas);
  if (!u) return null;
  if (!u.pixeles.length && !u.checkouts.length && !u.videos.length) {
    return <p className="spy-funnel-nada">Desde afuera no se ve ningún píxel, checkout ni video.</p>;
  }
  // Tag Manager carga el resto desde el navegador, y una página bajada desde el servidor no lo ejecuta.
  const faltaVer = !u.vioElNavegador && u.pixeles.some((p) => p.proveedor === 'gtm');
  return (
    <div className="spy-funnel">
      {!!u.pixeles.length && (
        <div className="spy-funnel-fila">
          <b>Píxeles</b>
          <div className="spy-etiquetas">
            {u.pixeles.map((p) => (
              <span key={p.proveedor} className="spy-pildora-gris spy-funnel-pixel" title={p.ids.join(', ') || undefined}>
                {NOMBRE_PIXEL[p.proveedor]}{!!p.ids.length && <small>{p.ids[0]}{p.ids.length > 1 ? ` +${p.ids.length - 1}` : ''}</small>}
              </span>
            ))}
          </div>
          {faltaVer && <small className="spy-funnel-nota">Tag Manager puede cargar más: desde afuera no se ve.</small>}
        </div>
      )}
      {!!u.checkouts.length && (
        <div className="spy-funnel-fila">
          <b>Cobra con</b>
          <div className="spy-etiquetas">
            {u.checkouts.map((c) => (
              <a key={c.url} className="spy-pildora-gris" href={c.url} target="_blank" rel="noreferrer noopener" title={c.url}>{c.nombre}</a>
            ))}
          </div>
        </div>
      )}
      {!!u.videos.length && (
        <div className="spy-funnel-fila">
          <b>Video</b>
          <div className="spy-etiquetas">{u.videos.map((v) => <span key={v} className="spy-pildora-gris">{v}</span>)}</div>
        </div>
      )}
    </div>
  );
}
