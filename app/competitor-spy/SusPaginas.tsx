'use client';

// =============================================================================
// SusPaginas — sus páginas, con su vista previa y un desplegable para cambiar de página (4/11/2026)
// =============================================================================
// Martín, con Den Borg: «debería analizar sus páginas trayendo la preview, ya tenemos construido esa funcionalidad... Y en el caso de
// denborg tiene muchas otras páginas dentro, que también podría analizar con un desplegable para ir cambiando entre páginas... Y no
// pongas nada abajo de las web, porque abajo no se verá más nada». El Cerebro: «las webs con su preview y un desplegable de páginas
// al final, sin nada debajo. Beacons es la fuente de las páginas de Den Borg».
//
// ⚠️ LA VISTA PREVIA ES LA QUE YA EXISTE: la ruta del Diagnóstico del Web Generator (`srcPaginaDiagnostico`,
// app/api/landing-generator/diagnostico/pagina/route.ts), que baja la página ajena y la sirve aislada (origen opaco, sin ventanas ni
// formularios). El iframe lleva el mismo `sandbox="allow-scripts"` que `VistaAfuera`. Esa ruta pide el admin y el Web Generator en
// el plan: sin eso (`conVistaPrevia` en false) se muestra la tarjeta con «Abrir», no un recuadro vacío.
//
// Las páginas salen de lo que leyó su oferta (`enlaces`, lib/spy-oferta.ts): su web y, si es una página de enlaces, cada página suya
// que enlaza. Va AL FINAL de la pestaña y no tiene nada debajo.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { srcPaginaDiagnostico } from '@/lib/editor-landing/diagnostico';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '../_components/icons';

const CSS = `
.spy-paginas-web{display:flex;flex-direction:column;gap:12px;scroll-margin-top:80px}
.spy-paginas-web__cabeza{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.spy-paginas-web__cabeza h3{margin:0;font-size:var(--fs-sect);font-weight:600;letter-spacing:-.01em}
.spy-paginas-web__cabeza .spy-paginas-web__n{color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-navegador{display:flex;flex-direction:column;border-radius:var(--r-lg);overflow:hidden;background:var(--surface);
  box-shadow:inset 0 0 0 1px var(--border),var(--sombra-tarjeta)}
.spy-navegador__barra{display:flex;align-items:center;gap:10px;min-height:48px;padding:6px 8px 6px 14px;border-bottom:1px solid var(--border)}
.spy-navegador__puntos{display:flex;gap:6px;flex:none}
.spy-navegador__puntos i{width:10px;height:10px;border-radius:50%;background:var(--border)}
.spy-navegador__url{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-radius:99px;
  background:var(--surface-2);color:var(--dim);font-size:var(--fs-sm);font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.spy-navegador__url span{overflow:hidden;text-overflow:ellipsis}
.spy-navegador__acciones{display:flex;gap:6px;flex:none}
.spy-navegador__cuerpo{position:relative;height:min(720px,72vh);background:#fff}
.spy-navegador__cuerpo iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
.spy-navegador__carga{position:absolute;inset:0;display:grid;place-items:center;background:var(--surface)}
.spy-navegador__sin{display:grid;place-items:center;min-height:220px;padding:28px 24px}
.spy-navegador__abrir{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 22px;border-radius:99px;background:var(--ink);color:var(--bg);font-weight:600;text-decoration:none}
.spy-navegador__abrir:hover{opacity:.9}
@media (max-width:760px){
  .spy-navegador__puntos{display:none}
  .spy-navegador__cuerpo{height:min(560px,70vh)}
}
`;

/** «beacons.page/denborg» o «passline.com/eventos/marca-personal», para el desplegable. */
export function nombreDePagina(url: string): string {
  try {
    const u = new URL(url);
    const camino = u.pathname.replace(/\/$/, '');
    return `${u.hostname.replace(/^www\./, '')}${camino.length > 40 ? `${camino.slice(0, 40)}…` : camino}`;
  } catch {
    return url;
  }
}

export function SusPaginas({ competidorId, enlaces, titulos, elegida, onElegir, conVistaPrevia }: {
  competidorId: number;
  /** Sus páginas: su web primero y las que enlaza. */
  enlaces: readonly string[];
  /** El título de cada página que se leyó (por url). */
  titulos: ReadonlyMap<string, string>;
  /** La que se está mirando (la elige también una evidencia de su funnel). */
  elegida: string | null;
  onElegir: (url: string) => void;
  /** El admin con el Web Generator en su plan: la ruta de la vista previa lo pide. */
  conVistaPrevia: boolean;
}) {
  const ws = useWs();
  const url = elegida && enlaces.includes(elegida) ? elegida : enlaces[0] ?? null;
  const [cargo, setCargo] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- una página nueva vuelve a mostrar la carga
  useEffect(() => { setCargo(false); }, [url]);
  // ⚠️ SI LA PÁGINA NO DEJA LEERLA, NO SE DIBUJA EL ERROR (4/11/2026: la captura de Martín decía «La página respondió 403: está
  // bloqueando la lectura automática»). La ruta del iframe dibuja su error ADENTRO del iframe y desde acá no se ve: se pregunta
  // antes (/api/competitor-spy/pagina, la misma lectura de siempre). Si abre, el iframe; si no, «Abrir» en el navegador de la
  // persona. Mientras pregunta, la carga de la casa. Una vez por página en esta visita.
  const [abre, setAbre] = useState<Record<string, 'abierta' | 'no-pudo'>>({});
  const preguntadas = useRef(new Set<string>());
  useEffect(() => {
    if (!conVistaPrevia || !url || preguntadas.current.has(url)) return;
    preguntadas.current.add(url);
    fetch('/api/competitor-spy/pagina', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: competidorId, url }),
      signal: AbortSignal.timeout(35_000),
    })
      .then((r) => r.json())
      .then((j: { estado?: string } | null) => (j?.estado === 'abierta' ? 'abierta' as const : 'no-pudo' as const))
      .catch(() => 'no-pudo' as const)
      .then((e) => setAbre((m) => ({ ...m, [url]: e })));
  }, [conVistaPrevia, url, competidorId]);
  const estado = url ? abre[url] : undefined;
  const conAbrirGrande = !conVistaPrevia || estado === 'no-pudo';
  const opciones = useMemo(() => enlaces.map((u) => ({ value: u, label: titulos.get(u) ? `${titulos.get(u)} · ${nombreDePagina(u)}` : nombreDePagina(u) })), [enlaces, titulos]);
  if (!url) return null;

  return (
    <section id="spy-sus-paginas" className="spy-paginas-web" aria-label="Sus páginas">
      <style>{CSS}</style>
      <div className="spy-paginas-web__cabeza">
        <h3>Sus páginas</h3>
        {enlaces.length > 1 && <span className="spy-paginas-web__n">{enlaces.length}</span>}
        {enlaces.length > 1 && (
          <Dropdown
            ariaLabel="Elegir otra de sus páginas"
            value={url}
            width={320}
            options={opciones}
            onChange={(v) => onElegir(v)}
            buttonStyle={{ height: 38, borderRadius: 99, fontSize: 'var(--fs-sm)', fontWeight: 600, maxWidth: 360 }}
          />
        )}
      </div>
      <div className="spy-navegador">
        <div className="spy-navegador__barra">
          <span className="spy-navegador__puntos" aria-hidden><i /><i /><i /></span>
          <span className="spy-navegador__url" title={url}><Icon name="web" size={14} /><span>{nombreDePagina(url)}</span></span>
          <span className="spy-navegador__acciones">
            {/* ⚠️ El parámetro es `?analizar=`, el que el Web Generator entiende (`derechaDeQuery`, app/web-generator/panel-reglas.ts). */}
            <a href={`/web-generator?analizar=${encodeURIComponent(url)}`} className="spy-boton">Copiar su sitio</a>
            {!conAbrirGrande && <a href={url} target="_blank" rel="noreferrer noopener" className="spy-boton">Abrir</a>}
          </span>
        </div>
        {conAbrirGrande ? (
          <div className="spy-navegador__sin">
            <a href={url} target="_blank" rel="noreferrer noopener" className="spy-navegador__abrir"><Icon name="web" size={16} />Abrir</a>
          </div>
        ) : !estado ? (
          <div className="spy-navegador__cuerpo"><div className="spy-navegador__carga"><CargandoMako que="su página" alto={240} size={56} /></div></div>
        ) : (
          <div className="spy-navegador__cuerpo">
            <iframe
              key={url}
              src={conWs(srcPaginaDiagnostico(url), ws)}
              // El mismo aislamiento que la vista del Diagnóstico (VistaAfuera): corre sus scripts, no ve nada de MaKo, no manda
              // formularios ni abre ventanas.
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              title={`Vista de ${nombreDePagina(url)}`}
              onLoad={() => setCargo(true)}
            />
            {!cargo && <div className="spy-navegador__carga"><CargandoMako que="su página" alto={240} size={56} /></div>}
          </div>
        )}
      </div>
    </section>
  );
}
