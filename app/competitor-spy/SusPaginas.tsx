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

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Confirm } from '@/app/_ui';
import { lineaDeVersion } from '@/lib/extension-tienda';
import { alTerminarCaptura, extensionCaptura, pedirCaptura } from '@/lib/spy-captura-cliente';
import { capturaDe, VERSION_CAPTURA, type PaginaCapturada } from '@/lib/spy-pagina-capturada';
import { webComparable } from '@/lib/spy-oferta';
import { EsqueletoPagina } from './Esqueletos';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { srcPaginaDiagnostico } from '@/lib/editor-landing/diagnostico';
import { hrefReplicar } from '@/lib/editor-landing/replica-extension-cliente';
import { marcoVerificado, type AvisoDelMarco } from '@/lib/pagina-real';
import { Dropdown } from '../components/Dropdown';
import { Icon } from '../_components/icons';
import { CandadoSoloPro } from '../_components/CandadoSoloPro';
import { useSoloPro } from '../_components/solo-pro';

/** El candado de la barra (app/_components/Sidebar.tsx → `Candado`), en «Copiar su sitio» a un Esencial. */
function IconoCandado() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', opacity: 0.7 }}>
      <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

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
.spy-navegador__sin{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:220px;padding:28px 24px;text-align:center}
.spy-navegador__titulo{max-width:52ch;font-size:var(--fs-md);font-weight:600;color:var(--ink)}
.spy-navegador__botones{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
.spy-navegador__abrir{border:0;font:inherit;cursor:pointer}
.spy-navegador__espera{margin:0;max-width:44ch;color:var(--dim);font-size:var(--fs-sm);line-height:1.5}
.spy-navegador__captura{display:flex;flex-direction:column}
.spy-navegador__foto{max-height:min(720px,72vh);overflow:auto;background:#fff}
.spy-navegador__foto img{display:block;width:100%;height:auto}
.spy-navegador__pie{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-top:1px solid var(--border);
  color:var(--faint);font-size:var(--fs-sm);font-weight:600}
.spy-navegador__abrir{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 22px;border-radius:99px;background:var(--ink);color:var(--bg);font-weight:600;text-decoration:none}
.spy-navegador__abrir:hover{opacity:.9}
@media (max-width:760px){
  .spy-navegador__puntos{display:none}
  .spy-navegador__cuerpo{height:min(560px,70vh)}
}
`;

/** Lo que contestó la ruta de esa página: si abre, y a dónde manda si es un acortador. */
type Respuesta = { estado: 'abierta' | 'no-pudo'; final: string | null };

/** Cuánto se espera el aviso del marco antes de darlo por no verificado. El script avisa al cargar y a los 1,2 s y 3 s, pero la
 * página la baja antes la ruta del Diagnóstico, y una página lenta tarda: se espera con su esqueleto, no con un hueco. */
export const PLAZO_MARCO_MS = 20_000;
/** Cuánto se espera el aviso de la página nueva cuando el marco se va a otra (un clic adentro): sin él, se esconde. */
export const PLAZO_OTRA_PAGINA_MS = 4_000;

/** Lo que devuelve /api/competitor-spy/paginas de cada página capturada (sin su texto). */
type Capturada = Omit<PaginaCapturada, 'texto'>;

/** La versión de la extensión que dejó el puente en <html> (y se entera cuando aparece: se instaló con la pestaña abierta). */
function suscribirPuente(avisar: () => void): () => void {
  const mo = new MutationObserver(avisar);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mako-puente'] });
  window.addEventListener('focus', avisar);
  return () => { mo.disconnect(); window.removeEventListener('focus', avisar); };
}
const versionDelPuente = () => document.documentElement.getAttribute('data-mako-puente');

/** «4 nov», para «Capturada el …». */
const diaCorto = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
};

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
  // «Copiar su sitio» es de MaKo Pro (14/11/2026): a un Esencial, con el candado (app/_components/solo-pro.ts).
  const soloPro = useSoloPro('replicar-landing');
  const [verCandado, setVerCandado] = useState(false);
  // ⚠️ LO CAPTURADO CON LA EXTENSIÓN (4/11/2026, Martín: «Pero podemos hacerlo con la extension de mako... Yo no quiero vulnerar
  // a nadie, solo quiero capturar el diseño»). Cuando el servidor no puede mostrar la página (una barrera, como el «comprobar que
  // es una persona» de Beacons), «Capturar» la abre en una pestaña a la vista; la persona pasa la barrera si aparece y toca el ícono
  // de MaKo, y la extensión guarda la foto de lo que se ve (lib/spy-pagina-capturada.ts). Acá se muestra esa foto. Y las otras
  // páginas de una página de enlaces capturada entran al desplegable.
  const [capturas, setCapturas] = useState<Record<string, Capturada>>({});
  const [vueltaCapturas, setVueltaCapturas] = useState(0);
  useEffect(() => {
    if (!conVistaPrevia) return;
    let vivo = true;
    fetch(`/api/competitor-spy/paginas?id=${competidorId}`, { signal: AbortSignal.timeout(15_000) })
      .then((r) => r.json())
      .then((j: { ok?: boolean; capturas?: Capturada[] } | null) => {
        if (!vivo || !j?.ok || !Array.isArray(j.capturas)) return;
        setCapturas(Object.fromEntries(j.capturas.map((c) => [webComparable(c.url), c])));
      })
      .catch(() => { /* sin capturas: queda «Capturar» */ });
    return () => { vivo = false; };
  }, [conVistaPrevia, competidorId, vueltaCapturas]);
  const todas = useMemo(() => {
    const vistas = new Set<string>();
    return [...enlaces, ...Object.values(capturas).flatMap((c) => c.paginas)].filter((u) => {
      const k = webComparable(u);
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });
  }, [enlaces, capturas]);
  const url = elegida && todas.includes(elegida) ? elegida : todas[0] ?? null;
  // ⚠️ SI LA PÁGINA NO DEJA LEERLA, NO SE DIBUJA EL ERROR (4/11/2026: la captura de Martín decía «La página respondió 403: está
  // bloqueando la lectura automática»). La ruta del iframe dibuja su error ADENTRO del iframe y desde acá no se ve: se pregunta
  // antes (/api/competitor-spy/pagina, la misma lectura de siempre). Si abre, el iframe; si no, «Abrir» en el navegador de la
  // persona. Una vez por página en esta visita. Si la página es un acortador, la ruta dice a dónde manda (`final`) y se muestra ésa.
  const [abre, setAbre] = useState<Record<string, Respuesta>>({});
  const preguntadas = useRef(new Set<string>());
  useEffect(() => {
    if (!conVistaPrevia || !url || preguntadas.current.has(url)) return;
    preguntadas.current.add(url);
    fetch('/api/competitor-spy/pagina', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: competidorId, url }),
      signal: AbortSignal.timeout(35_000),
    })
      .then((r) => r.json())
      .then((j: { estado?: string; final?: unknown } | null): Respuesta => (j?.estado === 'abierta'
        ? { estado: 'abierta', final: typeof j.final === 'string' && /^https?:\/\//i.test(j.final) ? j.final : null }
        : { estado: 'no-pudo', final: null }))
      .catch((): Respuesta => ({ estado: 'no-pudo', final: null }))
      .then((e) => setAbre((m) => ({ ...m, [url]: e })));
  }, [conVistaPrevia, url, competidorId]);
  const respuesta = url ? abre[url] : undefined;
  const estado = respuesta?.estado;
  /** La que se muestra y se abre: el destino de un acortador, o la misma. */
  const destino = respuesta?.final ?? url;

  // ⚠️ EL MARCO NO SE MUESTRA HASTA QUE ÉL MISMO DICE QUE PINTÓ LA PÁGINA (4/11/2026, el Cerebro: «Ese iframe roto se dibuja como si
  // fuera la página… Dejá de mostrar iframes que no se puedan verificar»). Se carga escondido, con su esqueleto encima; el script del
  // Diagnóstico avisa cuánto texto pintó, el principio y el título (lib/pagina-real.ts → `marcoVerificado`). Sin ese aviso a tiempo
  // —la página se fue a otra que no se deja mostrar, o pintó su «500»— no se muestra: queda «Abrir». Y si después de verse se va a
  // otra página (un clic adentro), tiene que volver a avisar, o se esconde.
  const marco = useRef<HTMLIFrameElement>(null);
  const [visto, setVisto] = useState<Record<string, 'si' | 'no'>>({});
  const clave = estado === 'abierta' && destino ? destino : null;
  const veredicto = clave ? visto[clave] : undefined;
  useEffect(() => {
    if (!clave) return;
    const alAvisar = (e: MessageEvent) => {
      if (e.source !== marco.current?.contentWindow || (e.data as { gmDg?: unknown } | null)?.gmDg !== 1) return;
      const v = marcoVerificado(e.data as AvisoDelMarco);
      if (v !== 'espera') setVisto((m) => (m[clave] === v ? m : { ...m, [clave]: v }));
    };
    window.addEventListener('message', alAvisar);
    // Sin aviso a tiempo, no se verifica: no se muestra.
    const plazo = window.setTimeout(() => setVisto((m) => (m[clave] ? m : { ...m, [clave]: 'no' })), PLAZO_MARCO_MS);
    return () => { window.removeEventListener('message', alAvisar); window.clearTimeout(plazo); };
  }, [clave]);
  const cargas = useRef(0);
  const otraPagina = useRef<number | undefined>(undefined);
  // Una página nueva cuenta sus cargas desde cero.
  useEffect(() => { cargas.current = 0; const t = otraPagina; return () => window.clearTimeout(t.current); }, [clave]);
  const alCargar = () => {
    cargas.current += 1;
    if (cargas.current < 2 || !clave) return;
    // Se fue a otra página: vuelve a esperar su aviso, y sin él se esconde.
    setVisto((m) => { const n = { ...m }; delete n[clave]; return n; });
    window.clearTimeout(otraPagina.current);
    otraPagina.current = window.setTimeout(() => setVisto((m) => (m[clave] ? m : { ...m, [clave]: 'no' })), PLAZO_OTRA_PAGINA_MS);
  };

  const conAbrirGrande = !conVistaPrevia || estado === 'no-pudo' || veredicto === 'no';
  const capturada = url ? capturaDe(capturas as Record<string, PaginaCapturada>, url) : null;
  const tituloDe = (u: string) => titulos.get(u) || capturaDe(capturas as Record<string, PaginaCapturada>, u)?.titulo || '';
  const opciones = useMemo(() => todas.map((u) => {
    const t = titulos.get(u) || capturas[webComparable(u)]?.titulo || '';
    return { value: u, label: t ? `${t} · ${nombreDePagina(u)}` : nombreDePagina(u) };
  }), [todas, titulos, capturas]);

  // «Capturar»: con la extensión que sabe (0.76.0), la página se abre a la vista y se espera el toque en el ícono. Sin ella, el
  // pedido de instalarla (el mismo modal que el CRM), y al aparecer, la captura arranca sola.
  const version = useSyncExternalStore(suscribirPuente, versionDelPuente, () => null);
  const ext = extensionCaptura(version);
  const [capturando, setCapturando] = useState<string | null>(null);
  const [pideExt, setPideExt] = useState<string | null>(null);
  const [esperaExt, setEsperaExt] = useState<string | null>(null);
  const capturar = (u: string) => {
    if (ext !== 'si') { setPideExt(u); return; }
    setCapturando(u);
    void pedirCaptura(window as unknown as Parameters<typeof pedirCaptura>[0], competidorId, u).then((r) => {
      if (r.ok) return;
      setCapturando(null);
      // Sin respuesta del puente es una extensión que no sabe capturar (o se recargó): se pide la que sí.
      if (r.motivo === 'sin_respuesta' || r.motivo === 'extension') setPideExt(u);
    });
  };
  useEffect(() => alTerminarCaptura(window, (f) => {
    if (f.competidorId !== competidorId) return;
    setCapturando((c) => (c && webComparable(c) === webComparable(f.url) ? null : c));
    if (f.lista) setVueltaCapturas((n) => n + 1);
  }), [competidorId]);
  // Se instaló (o se actualizó) con la pestaña abierta: la captura que se pidió arranca sola.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- arranca lo que la persona ya pidió
  useEffect(() => { if (esperaExt && ext === 'si') { const u = esperaExt; setEsperaExt(null); capturar(u); } }, [esperaExt, ext]);
  const irAInstalar = () => {
    setEsperaExt(pideExt);
    setPideExt(null);
    window.dispatchEvent(new CustomEvent('MAKO_EXTENSION_REVISAR'));
    window.open('/extension/instalar', '_blank', 'noopener');
  };

  if (!url || !destino) return null;
  /** Sin vista del servidor, y con su foto capturada (mientras no se esté capturando de nuevo). */
  const conFoto = conAbrirGrande && conVistaPrevia && !!capturada?.foto && capturando !== url;

  return (
    <section id="spy-sus-paginas" className="spy-paginas-web" aria-label="Sus páginas">
      <style>{CSS}</style>
      <div className="spy-paginas-web__cabeza">
        <h3>Sus páginas</h3>
        {todas.length > 1 && <span className="spy-paginas-web__n">{todas.length}</span>}
        {todas.length > 1 && (
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
          <span className="spy-navegador__url" title={destino}><Icon name="web" size={14} /><span>{nombreDePagina(destino)}</span></span>
          <span className="spy-navegador__acciones">
            {/* ⚠️ `?replicar=` (9/11/2026): «Copiar su sitio» abre REPLICAR con esta página (`derechaDeQuery`, app/web-generator/
                panel-reglas.ts). Con `?analizar=` abría el Diagnóstico, que vuelve a bajar la página por el servidor y no replica: una
                página bloqueada fallaba otra vez. En Replicar, si el servidor no la baja, se copia con la extensión. */}
            {/* SÓLO MaKo Pro (14/11/2026, lib/editor-landing/replicar-candado.ts): a un Esencial, el botón con el candado, que
                abre el candado (el texto y «Pasar a Pro») acá mismo en vez de llevarlo a una pantalla que no puede usar. */}
            {soloPro ? (
              <button type="button" className="spy-boton" title="Copiar su sitio · De MaKo Pro" aria-expanded={verCandado} data-pro=""
                onClick={() => setVerCandado((v) => !v)}>
                Copiar su sitio<IconoCandado />
              </button>
            ) : <a href={conWs(hrefReplicar(destino), ws)} className="spy-boton">Copiar su sitio</a>}
            {(!conAbrirGrande || conFoto) && <a href={destino} target="_blank" rel="noreferrer noopener" className="spy-boton">Abrir</a>}
          </span>
        </div>
        {soloPro && verCandado && (
          <CandadoSoloPro funcion="replicar-landing" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }} />
        )}
        {conFoto && capturada?.foto ? (
          <div className="spy-navegador__captura" data-pagina="capturada">
            <div className="spy-navegador__foto">
              {/* eslint-disable-next-line @next/next/no-img-element -- la foto de nuestro Storage, con su tamaño */}
              <img src={capturada.foto} alt={`Así se veía ${nombreDePagina(destino)}`} loading="lazy" />
            </div>
            <div className="spy-navegador__pie">
              <span>Capturada el {diaCorto(capturada.capturadaEn)}</span>
              <button type="button" className="spy-boton" onClick={() => capturar(url)}>Capturar de nuevo</button>
            </div>
          </div>
        ) : conAbrirGrande ? (
          <div className="spy-navegador__sin" data-pagina="sin-vista">
            {tituloDe(url) && <b className="spy-navegador__titulo">{tituloDe(url)}</b>}
            {capturando === url ? (
              <p className="spy-navegador__espera" role="status">Se abrió en otra pestaña. Cuando la veas, toca el ícono de MaKo.</p>
            ) : (
              <div className="spy-navegador__botones">
                {conVistaPrevia && (
                  <button type="button" className="spy-navegador__abrir" onClick={() => capturar(url)}><Icon name="descargar" size={16} />Capturar</button>
                )}
                <a href={destino} target="_blank" rel="noreferrer noopener" className={conVistaPrevia ? 'spy-boton' : 'spy-navegador__abrir'}>
                  {!conVistaPrevia && <Icon name="web" size={16} />}Abrir
                </a>
              </div>
            )}
          </div>
        ) : !estado ? (
          <div className="spy-navegador__cuerpo"><EsqueletoPagina /></div>
        ) : (
          <div className="spy-navegador__cuerpo" data-pagina={veredicto === 'si' ? 'vista' : 'verificando'}>
            <iframe
              key={destino}
              ref={marco}
              src={conWs(srcPaginaDiagnostico(destino), ws)}
              // El mismo aislamiento que la vista del Diagnóstico (VistaAfuera): corre sus scripts, no ve nada de MaKo, no manda
              // formularios ni abre ventanas.
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              title={`Vista de ${nombreDePagina(destino)}`}
              // Escondido (no desmontado: tiene que cargar para poder avisar) hasta que avise que pintó la página.
              style={veredicto === 'si' ? undefined : { visibility: 'hidden' }}
              onLoad={alCargar}
            />
            {/* Mientras abre, la forma de una página y no la criatura (Martín, 4/11 tarde: «los placeholder típicos»). */}
            {veredicto !== 'si' && <EsqueletoPagina />}
          </div>
        )}
      </div>
      {pideExt && (
        <Confirm tone="primary" title={ext === 'vieja' ? 'Actualiza la extensión de MaKo' : 'Instala la extensión de MaKo'}
          confirmLabel={ext === 'vieja' ? 'Actualizar' : 'Instalar'}
          message={ext === 'vieja'
            ? lineaDeVersion(VERSION_CAPTURA, 'Tu extensión es de antes y no sabe capturar páginas. Actualízala y la captura empieza sola.')
            : 'Para capturar una página que no se puede mostrar aquí, MaKo la abre en tu navegador con su extensión. Instálala y la captura empieza sola.'}
          onConfirm={irAInstalar} onCancel={() => setPideExt(null)} />
      )}
    </section>
  );
}
