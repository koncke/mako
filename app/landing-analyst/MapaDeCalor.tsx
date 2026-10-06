'use client';
// =============================================================================
// MapaDeCalor — dónde toca la gente, dibujado sobre la página (Landing Analyst)
// =============================================================================
// Pedido de Martín (06/10/2026): «tienes que implementar el mapa de calor en
// Landing Analyst». Era lo único de Clarity sin reemplazo.
//
// LA PÁGINA DE FONDO es la foto completa de una grabación (lib/landing-mapa-foto.ts)
// reconstruida en un iframe PROPIO y SIN scripts (`sandbox="allow-same-origin"`):
// es lo que vio la gente, no corre el Pixel y se puede medir. Encima, un canvas
// del mismo tamaño con el calor. Los dos viven en la MISMA capa escalada, y cada
// posición se lee del DOM de la foto (getBoundingClientRect del elemento adentro
// del iframe), nunca se calcula a mano contra el transform (regla de la casa).
//
// DÓNDE VA CADA TOQUE: si trae su ancla (Pixel v22) va sobre su elemento; si no,
// por su punto de página (aproximado: el alto del documento varía entre visitas).
// Un elemento fijo sin ancla no se dibuja: su punto de página es dónde estaba el
// scroll, no dónde está el botón.
//
// Celular y computadora NUNCA se mezclan: son dos páginas distintas.
// =============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Select, Alert, EmptyState, ErrorState, SkeletonLines, Section, MONO } from '@/app/_ui';
import {
  colorDeCalor, rankingDe, ubicarPorAncla, ubicarPorPunto, PIXEL_ANCLA_DESDE, PIXEL_PUNTO_DESDE,
  type Dispositivo, type ToqueMapa,
} from '@/lib/landing-mapa';
import { RUTA_PIXEL } from '@/lib/pixel-aviso';
import type { PaginaDelMapa, DatosDelMapa, FondoDelMapa } from '@/lib/landing-mapa-server';

const SANS = "'Geist', sans-serif";

function hostPath(url: string): string {
  try { const u = new URL(url); return u.host + (u.pathname === '/' ? '' : u.pathname); } catch { return url; }
}

const TAGS: Record<string, string> = {
  IMG: 'una imagen', PICTURE: 'una imagen', SVG: 'un ícono', H1: 'un título', H2: 'un título', H3: 'un título',
  H4: 'un título', P: 'un texto', SPAN: 'un texto', LI: 'una lista', VIDEO: 'un video', INPUT: 'un campo',
  LABEL: 'un campo', TEXTAREA: 'un campo', SELECT: 'un campo',
};

/** Lo que se tocó, en palabras: el destino de un botón, o qué era lo que no es un botón. */
function rotuloDe(t: Pick<ToqueMapa, 'tipo' | 'etiqueta'>): string {
  const e = t.etiqueta;
  if (t.tipo === 'clic_vacio') {
    const tag = e.replace(/^vacio:\s*/, '').toUpperCase();
    return `Fuera de un botón · ${TAGS[tag] ?? 'una zona'}`;
  }
  if (e.startsWith('boton:')) return e.slice(6).trim() || 'Un botón sin texto';
  if (e.startsWith('ancla ')) return e.slice(6);
  if (/^https?:\/\//.test(e)) return hostPath(e.split(' — ')[0]);
  return e;
}

/** El calor: cada toque suma alfa en un círculo difuso, y la suma se pinta con la rampa. */
function pintarCalor(canvas: HTMLCanvasElement, puntos: Array<{ x: number; y: number }>, radio: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!puntos.length) return;
  // La densidad máxima se estima por celdas del tamaño del radio: con ella, la zona
  // más tocada llega al color más intenso sin que un toque aislado se pierda.
  const celdas = new Map<string, number>();
  for (const p of puntos) {
    const k = `${Math.floor(p.x / radio)}:${Math.floor(p.y / radio)}`;
    celdas.set(k, (celdas.get(k) ?? 0) + 1);
  }
  const max = Math.max(1, ...celdas.values());
  const alfa = Math.max(0.08, Math.min(1, 1.2 / max));
  for (const p of puntos) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radio);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alfa;
    ctx.fillStyle = g;
    ctx.fillRect(p.x - radio, p.y - radio, radio * 2, radio * 2);
  }
  ctx.globalAlpha = 1;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (!a) continue;
    const [r, gg, b, aa] = colorDeCalor(a / 255);
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = Math.round(aa * Math.min(1, (a / 255) * 4));
  }
  ctx.putImageData(img, 0, 0);
}

function Leyenda() {
  const pasos = Array.from({ length: 12 }, (_, i) => {
    const [r, g, b, a] = colorDeCalor(i / 11);
    return `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--dim)' }}>
      <span>Pocos</span>
      <span aria-hidden style={{ width: 120, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${pasos.join(', ')})` }} />
      <span>Muchos toques</span>
    </div>
  );
}

export function MapaDeCalor() {
  const [paginas, setPaginas] = useState<PaginaDelMapa[] | null>(null);
  const [errorPaginas, setErrorPaginas] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [disp, setDisp] = useState<Dispositivo>('movil');
  const [datos, setDatos] = useState<DatosDelMapa | null>(null);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [fondo, setFondo] = useState<FondoDelMapa | null>(null);
  const [cargandoFondo, setCargandoFondo] = useState(false);
  const [capas, setCapas] = useState({ click: true, clic_vacio: true });
  const [resaltado, setResaltado] = useState<string | null>(null);

  // ── Las páginas ────────────────────────────────────────────────────────────
  const cargarPaginas = useCallback(async () => {
    setErrorPaginas(null);
    try {
      const j = await fetch('/api/landing-analyst/mapa').then((r) => r.json()).catch(() => ({ ok: false, error: 'La respuesta no se pudo leer.' }));
      if (!j.ok) { setErrorPaginas(j.error || 'No se pudieron leer tus páginas.'); return; }
      const ps = j.paginas as PaginaDelMapa[];
      setPaginas(ps);
      if (ps.length) {
        const p = ps[0];
        setUrl(p.url);
        setDisp(p.escritorio > p.movil ? 'escritorio' : 'movil');
      }
    } catch (e) { setErrorPaginas(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void cargarPaginas(); }, [cargarPaginas]);

  // ── Los toques y la foto de la página elegida ──────────────────────────────
  useEffect(() => {
    if (!url) return;
    let vivo = true;
    const q = `url=${encodeURIComponent(url)}&disp=${disp}`;
    setCargandoDatos(true); setErrorDatos(null); setDatos(null);
    fetch(`/api/landing-analyst/mapa?${q}`).then((r) => r.json()).then((j) => {
      if (!vivo) return;
      if (!j.ok) { setErrorDatos(j.error || 'No se pudieron leer los toques.'); return; }
      setDatos(j.data as DatosDelMapa);
    }).catch((e) => { if (vivo) setErrorDatos(String(e)); }).finally(() => { if (vivo) setCargandoDatos(false); });
    setCargandoFondo(true); setFondo(null);
    fetch(`/api/landing-analyst/mapa/fondo?${q}`).then((r) => r.json()).then((j) => {
      if (!vivo) return;
      setFondo(j.ok ? (j.fondo as FondoDelMapa) : { ok: false, motivo: 'sin_foto' });
    }).catch(() => { if (vivo) setFondo({ ok: false, motivo: 'sin_foto' }); }).finally(() => { if (vivo) setCargandoFondo(false); });
    return () => { vivo = false; };
  }, [url, disp]);

  const toques = useMemo(() => (datos?.toques ?? []).filter((t) => capas[t.tipo]), [datos, capas]);
  const ranking = useMemo(() => rankingDe(toques), [toques]);

  // ── El lienzo: foto + calor, en la misma capa escalada ─────────────────────
  /**
   * ⚠️ EL PANEL SE MIDE CON UNA REF DE FUNCIÓN, no con un efecto. El marco recién se monta
   * cuando llegaron los TOQUES, y la foto llega por otro pedido: con el efecto colgado de
   * `[fondo]`, si la foto contestaba primero el efecto corría sin marco, salía sin
   * observar, y al montarse el marco nadie lo medía (revisión del 06/10/2026). En
   * computadora eso dibujaba la página a tamaño real, cortada a la mitad; al pasar de
   * celular a computadora, diminuta. La ref de función corre cada vez que el nodo se monta,
   * venga primero lo que venga.
   */
  const roMarco = useRef<ResizeObserver | null>(null);
  const marcoRef = useCallback((el: HTMLDivElement | null) => {
    roMarco.current?.disconnect();
    roMarco.current = null;
    if (!el) return;
    const ro = new ResizeObserver(() => setAnchoPanel(el.clientWidth));
    ro.observe(el);
    roMarco.current = ro;
  }, []);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [anchoPanel, setAnchoPanel] = useState(0);
  const [altoDoc, setAltoDoc] = useState(0);
  const [noUbicados, setNoUbicados] = useState(0);
  const [caja, setCaja] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  // ⚠️ Cada carga de la foto cuenta: antes de que cargue, el iframe es un
  // documento vacío y ningún selector encuentra su elemento. Sin este disparo, si
  // el alto medido coincidía con el de la ventana, los toques quedaban ubicados por
  // su punto aproximado aunque trajeran el ancla.
  const [fotoLista, setFotoLista] = useState(0);

  const W = fondo?.ok ? fondo.ancho : 0;
  const H = altoDoc || (fondo?.ok ? fondo.alto : 0);
  // El celular se muestra a su tamaño (cabe), la computadora se achica al panel.
  const escala = W > 0 && anchoPanel > 0 ? Math.min(1, anchoPanel / W) : 1;

  const medir = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.documentElement) return;
    const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    if (h > 0) setAltoDoc(h);
  }, []);

  const elementoDe = useCallback((sel: string): Element | null => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return null;
    try { return doc.querySelector(sel); } catch { return null; }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fondo?.ok || !W || !H) return;
    canvas.width = W; canvas.height = H;
    const puntos: Array<{ x: number; y: number }> = [];
    let fuera = 0;
    for (const t of toques) {
      let p: { x: number; y: number } | null = null;
      if (t.sel && t.rx != null && t.ry != null) {
        const el = elementoDe(t.sel);
        if (el) p = ubicarPorAncla(t, el.getBoundingClientRect());
      }
      if (!p) p = ubicarPorPunto(t, W, H, disp);
      if (p) puntos.push(p); else fuera++;
    }
    setNoUbicados(fuera);
    pintarCalor(canvas, puntos, disp === 'movil' ? 22 : 30);
  }, [toques, fondo, W, H, disp, elementoDe, fotoLista]);

  useEffect(() => {
    if (!resaltado) { setCaja(null); return; }
    const el = elementoDe(resaltado);
    const r = el?.getBoundingClientRect();
    setCaja(r && r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null);
  }, [resaltado, elementoDe, altoDoc, fotoLista]);

  // ── Estados ────────────────────────────────────────────────────────────────
  if (errorPaginas) return <ErrorState titulo="No se pudieron leer tus páginas" detalle="Nada de lo de abajo se puede afirmar todavía." accion={{ label: 'Volver a intentar', onClick: () => void cargarPaginas() }} detalleTecnico={errorPaginas} />;
  if (!paginas) return <SkeletonLines lines={6} />;
  if (!paginas.length) {
    return <EmptyState titulo="Todavía no hay páginas" detalle="Elige tu página en el Pixel de MaKo y vuelve a pegar el código: los toques empiezan a llegar solos." accion={{ label: 'Ir al Pixel', href: RUTA_PIXEL }} />;
  }

  const pag = paginas.find((p) => p.url === url) ?? null;
  const version = datos?.version ?? null;
  const viejo = version != null && version < PIXEL_ANCLA_DESDE;

  return (
    <div style={{ display: 'grid', gap: 16, fontFamily: SANS }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select ariaLabel="Página" value={url ?? ''} onChange={(v) => { setUrl(v); setResaltado(null); setAltoDoc(0); }}
          options={paginas.map((p) => ({ value: p.url, label: `${hostPath(p.url)}${p.movil + p.escritorio ? ` · ${p.movil + p.escritorio}` : ''}` }))} width={340} />
        <div role="group" aria-label="Dispositivo" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {(['movil', 'escritorio'] as const).map((d) => (
            <button key={d} type="button" aria-pressed={disp === d} onClick={() => { setDisp(d); setResaltado(null); setAltoDoc(0); }}
              style={{ padding: '7px 13px', fontSize: 13, fontWeight: 600, fontFamily: SANS, cursor: 'pointer', border: 'none',
                background: disp === d ? 'var(--primary-bg)' : 'var(--surface)', color: disp === d ? 'var(--primary)' : 'var(--dim)' }}>
              {d === 'movil' ? `Celular${pag ? ` · ${pag.movil}` : ''}` : `Computadora${pag ? ` · ${pag.escritorio}` : ''}`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={capas.click} onChange={(e) => setCapas((c) => ({ ...c, click: e.target.checked }))} /> Botones
          </label>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={capas.clic_vacio} onChange={(e) => setCapas((c) => ({ ...c, clic_vacio: e.target.checked }))} /> Fuera de un botón
          </label>
        </div>
      </div>

      {errorDatos && <ErrorState titulo="No se pudieron leer los toques" detalleTecnico={errorDatos} />}
      {cargandoDatos && <SkeletonLines lines={4} />}

      {/* ⚠️ Los clics sin punto vienen de un código ANTERIOR (v20): la versión que
          mide hoy la página puede ser una que sí los trae. Decir «mide con la v21»
          al lado de «no traen su punto» se leía como que la 21 no los mide. */}
      {datos && datos.sinPunto > 0 && viejo && (
        <Alert tono="warn" accion={{ label: 'Actualizar el código', href: RUTA_PIXEL }}>
          {`${datos.sinPunto} clics no se pueden dibujar: llegaron con un código viejo del Pixel.`}
        </Alert>
      )}

      {datos && !cargandoDatos && datos.toques.length === 0 ? (
        <EmptyState
          titulo="Todavía no hay toques aquí"
          detalle={version != null && version < PIXEL_PUNTO_DESDE
            ? 'El código de esta página es anterior al mapa de calor. Vuelve a pegarlo y los toques empiezan a llegar.'
            : `Cuando alguien toque esta página en ${disp === 'movil' ? 'un celular' : 'una computadora'}, aparece aquí.`}
          accion={version != null && version < PIXEL_ANCLA_DESDE ? { label: 'Actualizar el código', href: RUTA_PIXEL } : undefined}
        />
      ) : datos && !cargandoDatos ? (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* EL LIENZO */}
          <div style={{ flex: '1 1 420px', minWidth: 300, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                <b style={{ color: 'var(--ink)', fontFamily: MONO }}>{toques.length}</b> {toques.length === 1 ? 'toque' : 'toques'} de <b style={{ color: 'var(--ink)', fontFamily: MONO }}>{datos.personas}</b> {datos.personas === 1 ? 'persona' : 'personas'} · {datos.dias} días
              </span>
              <Leyenda />
            </div>
            {cargandoFondo ? <SkeletonLines lines={8} /> : fondo?.ok ? (
              <div ref={marcoRef} style={{ width: '100%', maxWidth: disp === 'movil' ? Math.min(W, 430) : undefined, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' }}>
                <div style={{ width: W * escala, height: H * escala, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${escala})`, transformOrigin: '0 0' }}>
                    <iframe ref={iframeRef} title="Foto de la página" srcDoc={fondo.html} sandbox="allow-same-origin"
                      onLoad={() => { medir(); setFotoLista((n) => n + 1); iframeRef.current?.contentDocument?.fonts?.ready.then(medir).catch(() => {}); }}
                      style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, border: 'none', pointerEvents: 'none', background: '#fff' }} />
                    <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, pointerEvents: 'none' }} />
                    {caja && <div aria-hidden style={{ position: 'absolute', left: caja.left - 4, top: caja.top - 4, width: caja.width + 8, height: caja.height + 8, border: '3px solid var(--primary)', borderRadius: 8, pointerEvents: 'none' }} />}
                  </div>
                </div>
              </div>
            ) : (
              <Alert tono="info">
                {fondo && !fondo.ok && fondo.motivo === 'sin_grabaciones'
                  ? 'Todavía no hay una grabación de esta página para usar de fondo. Mientras tanto, a la derecha está lo más tocado.'
                  : `No hay una grabación de esta página en ${disp === 'movil' ? 'celular' : 'computadora'} para usar de fondo. A la derecha está lo más tocado.`}
              </Alert>
            )}
            {fondo?.ok && noUbicados > 0 && (
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>{noUbicados} toques no se pudieron ubicar sobre la foto.</span>
            )}
          </div>

          {/* LO MÁS TOCADO: la tabla del mapa (y lo único cuando no hay foto) */}
          <Section titulo="Lo más tocado">
            <div style={{ width: 300, display: 'grid', gap: 4 }}>
              {ranking.filas.map((f) => (
                <div key={f.clave}
                  onMouseEnter={() => setResaltado(f.sel)} onMouseLeave={() => setResaltado(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9,
                    background: resaltado && resaltado === f.sel ? 'var(--primary-bg)' : 'transparent', cursor: f.sel ? 'default' : undefined }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rotuloDe({ tipo: f.etiqueta.startsWith('vacio') ? 'clic_vacio' : 'click', etiqueta: f.etiqueta })}>
                    {rotuloDe({ tipo: f.etiqueta.startsWith('vacio') ? 'clic_vacio' : 'click', etiqueta: f.etiqueta })}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)', flex: 'none' }} title={`${f.toques} toques`}>{f.personas} {f.personas === 1 ? 'persona' : 'personas'}</span>
                </div>
              ))}
              {ranking.resto > 0 && <span style={{ fontSize: 12, color: 'var(--dim)', padding: '4px 10px' }}>y {ranking.resto} lugares más</span>}
            </div>
          </Section>
        </div>
      ) : null}
    </div>
  );
}
